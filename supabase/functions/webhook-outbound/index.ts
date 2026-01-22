import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("GHL Outbound Webhook received:", JSON.stringify(body, null, 2));

    // GHL sends different event types
    const { type, locationId, contactId, body: messageBody, attachments, message } = body;

    // Handle message events
    if (type !== "OutboundMessage" && type !== "message" && !message) {
      return new Response(
        JSON.stringify({ received: true, ignored: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageText = messageBody || message?.body || message?.text || "";
    const finalLocationId = locationId || message?.locationId || "";
    const finalContactId = contactId || message?.contactId || "";

    if (!finalLocationId || !messageText) {
      console.log("Missing locationId or message");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "missing data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find subaccount by location_id
    const { data: subaccount, error: subaccountError } = await supabase
      .from("ghl_subaccounts")
      .select("*")
      .eq("location_id", finalLocationId)
      .single();

    if (subaccountError || !subaccount) {
      console.log("Subaccount not found for location:", finalLocationId);
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "subaccount not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user settings for UAZAPI config
    const { data: settings } = await supabase
      .from("user_settings")
      .select("uazapi_base_url, uazapi_admin_token, ghl_client_id, ghl_client_secret")
      .eq("user_id", subaccount.user_id)
      .single();

    if (!settings?.uazapi_base_url || !settings?.uazapi_admin_token) {
      console.log("UAZAPI not configured");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "uazapi not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find an active instance for this subaccount
    const { data: instances } = await supabase
      .from("instances")
      .select("*")
      .eq("subaccount_id", subaccount.id)
      .eq("instance_status", "connected");

    if (!instances || instances.length === 0) {
      console.log("No connected WhatsApp instance for this subaccount");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "no connected instance" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the first connected instance (or you could match by ghl_user_id)
    const instance = instances[0];

    // Get contact phone from GHL
    let phone = "";
    if (finalContactId && subaccount.ghl_access_token) {
      // Get valid token
      let token = subaccount.ghl_access_token;
      const expiresAt = new Date(subaccount.ghl_token_expires_at);
      
      if (new Date() >= expiresAt && settings.ghl_client_id) {
        // Token expired, refresh it
        const tokenParams = new URLSearchParams({
          client_id: settings.ghl_client_id,
          client_secret: settings.ghl_client_secret,
          grant_type: "refresh_token",
          refresh_token: subaccount.ghl_refresh_token,
          user_type: "Location",
        });

        const tokenResponse = await fetch("https://services.leadconnectorhq.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: tokenParams.toString(),
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          token = tokenData.access_token;
          
          // Update stored token
          await supabase
            .from("ghl_subaccounts")
            .update({
              ghl_access_token: token,
              ghl_refresh_token: tokenData.refresh_token,
              ghl_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            })
            .eq("id", subaccount.id);
        }
      }

      // Fetch contact details
      const contactResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/${finalContactId}`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Version": "2021-07-28",
            "Accept": "application/json",
          },
        }
      );

      if (contactResponse.ok) {
        const contactData = await contactResponse.json();
        phone = contactData.contact?.phone || contactData.phone || "";
      }
    }

    // Also check if phone was passed directly in the webhook
    if (!phone) {
      phone = body.phone || body.to || message?.phone || message?.to || "";
    }

    if (!phone) {
      console.log("Could not determine recipient phone number");
      return new Response(
        JSON.stringify({ received: true, ignored: true, reason: "no phone number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone for WhatsApp (remove all non-digits)
    const cleanPhone = phone.replace(/\D/g, "");
    const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Send via UAZAPI
    const uazapiBaseUrl = settings.uazapi_base_url.replace(/\/$/, "");
    
    // Try multiple endpoints
    const endpoints = [
      `/message/sendText/${instance.uazapi_instance_token}`,
      `/api/${instance.uazapi_instance_token}/message/sendText`,
      `/${instance.uazapi_instance_token}/sendText`,
    ];

    let sent = false;
    for (const endpoint of endpoints) {
      try {
        const sendResponse = await fetch(`${uazapiBaseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "admintoken": settings.uazapi_admin_token,
          },
          body: JSON.stringify({
            phone: whatsappNumber,
            message: messageText,
          }),
        });

        if (sendResponse.ok) {
          sent = true;
          console.log(`✅ Message sent via UAZAPI to ${whatsappNumber}`);
          break;
        }
      } catch (e) {
        console.log(`Endpoint ${endpoint} failed:`, e);
      }
    }

    if (!sent) {
      // Try with token header
      for (const endpoint of endpoints) {
        try {
          const sendResponse = await fetch(`${uazapiBaseUrl}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instance.uazapi_instance_token,
            },
            body: JSON.stringify({
              phone: whatsappNumber,
              message: messageText,
            }),
          });

          if (sendResponse.ok) {
            sent = true;
            console.log(`✅ Message sent via UAZAPI to ${whatsappNumber}`);
            break;
          }
        } catch (e) {
          console.log(`Endpoint ${endpoint} failed:`, e);
        }
      }
    }

    if (!sent) {
      return new Response(
        JSON.stringify({ received: true, error: "Failed to send via UAZAPI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle attachments if any
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const url of attachments) {
        try {
          const mediaEndpoint = `/message/sendMedia/${instance.uazapi_instance_token}`;
          await fetch(`${uazapiBaseUrl}${mediaEndpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "admintoken": settings.uazapi_admin_token,
            },
            body: JSON.stringify({
              phone: whatsappNumber,
              mediaUrl: url,
              caption: "",
            }),
          });
        } catch (e) {
          console.log("Failed to send attachment:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        phone: whatsappNumber,
        message: "Message sent to WhatsApp" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Outbound webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
