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

  // Log immediately for validation tracking
  console.log("✅ webhook-outbound HIT", {
    method: req.method,
    url: req.url,
    contentType: req.headers.get("content-type"),
    userAgent: req.headers.get("user-agent"),
  });

  try {
    const body = await req.json();
    console.log("GHL Outbound payload:", JSON.stringify(body, null, 2));

    // GHL sends: { type, locationId, contactId, message, ... }
    const { type, locationId, contactId, message, phone, conversationId } = body;

    // If this is just a validation ping (no message content), respond immediately
    if (!message && !phone && !contactId) {
      console.log("Validation ping received, responding 200 OK");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find subaccount by locationId
    const { data: subaccount, error: subError } = await supabase
      .from("ghl_subaccounts")
      .select("*, instances(*), user_settings:user_id(uazapi_base_url, uazapi_admin_token)")
      .eq("location_id", locationId)
      .single();

    if (subError || !subaccount) {
      console.error("Subaccount not found for location:", locationId);
      return new Response(
        JSON.stringify({ success: false, error: "Subaccount not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get instance for this subaccount
    const instance = subaccount.instances?.[0];
    if (!instance) {
      console.error("No instance found for subaccount");
      return new Response(
        JSON.stringify({ success: false, error: "No instance configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user settings
    const userSettings = subaccount.user_settings;
    if (!userSettings?.uazapi_base_url || !instance.uazapi_instance_token) {
      console.error("UAZAPI not configured");
      return new Response(
        JSON.stringify({ success: false, error: "UAZAPI not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract phone number - clean it
    let targetPhone = phone || "";
    if (!targetPhone && contactId) {
      // Fetch contact from GHL to get phone
      const token = subaccount.ghl_access_token;
      if (token) {
        try {
          const contactRes = await fetch(
            `https://services.leadconnectorhq.com/contacts/${contactId}`,
            {
              headers: {
                "Authorization": `Bearer ${token}`,
                "Version": "2021-07-28",
                "Accept": "application/json",
              },
            }
          );
          if (contactRes.ok) {
            const contactData = await contactRes.json();
            targetPhone = contactData.contact?.phone || "";
          }
        } catch (e) {
          console.error("Failed to fetch contact:", e);
        }
      }
    }

    // Clean phone number (remove +, spaces, etc)
    targetPhone = targetPhone.replace(/\D/g, "");

    if (!targetPhone) {
      console.error("No phone number available");
      return new Response(
        JSON.stringify({ success: false, error: "No phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send message via UAZAPI
    const uazapiUrl = `${userSettings.uazapi_base_url}/chat/send-text`;
    
    console.log("Sending to UAZAPI:", {
      url: uazapiUrl,
      phone: targetPhone,
      message: message?.substring(0, 50) + "...",
    });

    const uazapiRes = await fetch(uazapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${instance.uazapi_instance_token}`,
      },
      body: JSON.stringify({
        phone: targetPhone,
        message: message,
      }),
    });

    const uazapiData = await uazapiRes.text();
    console.log("UAZAPI response:", uazapiRes.status, uazapiData);

    if (!uazapiRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "UAZAPI send failed", details: uazapiData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Message sent to WhatsApp: ${targetPhone}`);

    return new Response(
      JSON.stringify({ success: true, sent: true, phone: targetPhone }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook outbound error:", error);
    // Always return 200 to avoid GHL retries
    return new Response(
      JSON.stringify({ success: true, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
