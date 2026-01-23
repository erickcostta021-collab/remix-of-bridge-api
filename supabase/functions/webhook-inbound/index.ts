import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get valid access token (refresh if needed)
async function getValidToken(supabase: any, integration: any, settings: any): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(integration.ghl_token_expires_at);
  const expiresIn1Hour = (expiresAt.getTime() - now.getTime()) < 3600000;

  if (now >= expiresAt || expiresIn1Hour) {
    // Refresh token
    const tokenParams = new URLSearchParams({
      client_id: settings.ghl_client_id,
      client_secret: settings.ghl_client_secret,
      grant_type: "refresh_token",
      refresh_token: integration.ghl_refresh_token,
      user_type: "Location",
    });

    const tokenResponse = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokenData = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await supabase
      .from("ghl_subaccounts")
      .update({
        ghl_access_token: tokenData.access_token,
        ghl_refresh_token: tokenData.refresh_token,
        ghl_token_expires_at: newExpiresAt.toISOString(),
        ghl_subaccount_token: tokenData.access_token,
        oauth_last_refresh: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return tokenData.access_token;
  }

  return integration.ghl_access_token;
}

// Helper to search/create contact in GHL
async function findOrCreateContact(
  phone: string,
  name: string,
  locationId: string,
  token: string
): Promise<any> {
  // Search for existing contact
  const searchResponse = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${phone}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
    }
  );

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    if (searchData.contacts && searchData.contacts.length > 0) {
      return searchData.contacts[0];
    }
  }

  // Create new contact
  const createResponse = await fetch("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-07-28",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      firstName: name || "WhatsApp Contact",
      phone: `+${phone}`,
      locationId,
      source: "WhatsApp Integration",
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error("Failed to create contact:", errorText);

    // Some locations disallow duplicates and return an existing contactId in meta.
    // Example: { statusCode: 400, message: "This location does not allow duplicated contacts.", meta: { contactId: "..." } }
    try {
      const parsed = JSON.parse(errorText);
      const maybeExistingId = parsed?.meta?.contactId;
      const msg = String(parsed?.message || "");

      if (createResponse.status === 400 && maybeExistingId && msg.toLowerCase().includes("duplicated")) {
        console.log("Duplicate contact detected, reusing existing contactId:", maybeExistingId);
        return { id: maybeExistingId };
      }
    } catch {
      // ignore JSON parse errors
    }

    throw new Error("Failed to create contact in GHL");
  }

  const createData = await createResponse.json();
  return createData.contact;
}

// Helper to send message to GHL
async function sendMessageToGHL(contactId: string, message: string, token: string): Promise<void> {
  const response = await fetch("https://services.leadconnectorhq.com/conversations/messages/inbound", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Version": "2021-04-15",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      type: "SMS",
      contactId,
      message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send message to GHL:", errorText);
    throw new Error("Failed to send message to GHL");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("UAZAPI Webhook received:", JSON.stringify(body, null, 2));

    // Handle different event types from UAZAPI
    // EventType is a string, but event can be an object
    const eventType = body.EventType || body.type || "";
    
    // Check if it's a message event (string check)
    const isMessageEvent = typeof eventType === "string" && eventType.toLowerCase().includes("message");
    
    if (!isMessageEvent) {
      // Not a message event, acknowledge
      console.log("Not a message event, ignoring:", eventType);
      return new Response(
        JSON.stringify({ received: true, ignored: true, eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract message data from UAZAPI payload (new structure)
    const messageData = body.message || body.data || {};
    const chatData = body.chat || {};
    
    // Get sender info - try multiple paths
    const from = messageData.sender || messageData.chatid || chatData.wa_chatid || "";
    const message = messageData.text || messageData.content || messageData.conversation || "";
    const pushName = messageData.senderName || chatData.wa_name || chatData.name || "";
    const instanceToken = body.token || body.instanceToken || messageData.instanceToken || "";

    console.log("Extracted data:", { from, message, pushName, instanceToken: instanceToken?.substring(0, 20) + "..." });

    if (!from || !message) {
      console.log("Missing from or message in payload");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "missing data", from, message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if from a group
    const isGroup = from.endsWith("@g.us");

    // Extract phone number
    const phoneNumber = from.split("@")[0];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the instance by token
    const { data: instance, error: instanceError } = await supabase
      .from("instances")
      .select("*, ghl_subaccounts!inner(*)")
      .eq("uazapi_instance_token", instanceToken)
      .single();

    if (instanceError || !instance) {
      console.log("Instance not found for token:", instanceToken);
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "instance not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if should ignore groups
    if (isGroup && instance.ignore_groups) {
      console.log("Ignoring group message");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "group ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subaccount = instance.ghl_subaccounts;

    // Check if OAuth is configured
    if (!subaccount.ghl_access_token || !subaccount.ghl_refresh_token) {
      console.log("OAuth not configured for this subaccount");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "oauth not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user settings for OAuth credentials
    const { data: settings } = await supabase
      .from("user_settings")
      .select("ghl_client_id, ghl_client_secret")
      .eq("user_id", subaccount.user_id)
      .single();

    if (!settings?.ghl_client_id) {
      console.log("OAuth credentials not found in user settings");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "oauth credentials missing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get valid token
    const token = await getValidToken(supabase, subaccount, settings);

    // Find or create contact
    const contact = await findOrCreateContact(
      phoneNumber,
      pushName,
      subaccount.location_id,
      token
    );

    // Send message to GHL
    await sendMessageToGHL(contact.id, message, token);

    console.log(`✅ Message forwarded to GHL: ${phoneNumber} -> ${contact.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        contactId: contact.id,
        message: "Message forwarded to GHL" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
