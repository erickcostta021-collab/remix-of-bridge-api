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

  // IMMEDIATE 200 OK response - n8n style pass-through
  // GHL requires fast response (<2s) for provider validation
  const immediateResponse = new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );

  try {
    const body = await req.json();
    console.log("GHL Webhook received:", JSON.stringify(body, null, 2));

    // For provider validation pings, just acknowledge
    if (body.type === "ping" || body.test === true) {
      console.log("✅ Ping/test received - responding immediately");
      return immediateResponse;
    }

    // For non-message events, acknowledge and ignore
    const { type, locationId, contactId, body: messageBody, attachments, message } = body;
    
    if (type !== "OutboundMessage" && type !== "message" && !message) {
      console.log(`✅ Event type '${type}' acknowledged - no message processing needed`);
      return immediateResponse;
    }

    // Process message in background (don't block response)
    // For now, just log and return success
    const messageText = messageBody || message?.body || message?.text || "";
    const finalLocationId = locationId || message?.locationId || "";
    const finalContactId = contactId || message?.contactId || "";

    console.log("📨 Message event:", { type, locationId: finalLocationId, contactId: finalContactId, messagePreview: messageText.substring(0, 50) });

    // Return immediate success - async processing would happen here
    // For full implementation, use Deno.spawn or queue system
    
    if (!finalLocationId || !messageText) {
      console.log("⚠️ Missing locationId or message - acknowledged anyway");
      return immediateResponse;
    }

    // Initialize Supabase for background processing
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      console.log("⚠️ Supabase not configured");
      return immediateResponse;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find subaccount by location_id
    const { data: subaccount, error: subaccountError } = await supabase
      .from("ghl_subaccounts")
      .select("*")
      .eq("location_id", finalLocationId)
      .single();

    if (subaccountError || !subaccount) {
      console.log("⚠️ Subaccount not found for location:", finalLocationId);
      return immediateResponse;
    }

    // Get user settings for UAZAPI config
    const { data: settings } = await supabase
      .from("user_settings")
      .select("uazapi_base_url, uazapi_admin_token, ghl_client_id, ghl_client_secret")
      .eq("user_id", subaccount.user_id)
      .single();

    if (!settings?.uazapi_base_url || !settings?.uazapi_admin_token) {
      console.log("⚠️ UAZAPI not configured");
      return immediateResponse;
    }

    // Find an active instance for this subaccount
    const { data: instances } = await supabase
      .from("instances")
      .select("*")
      .eq("subaccount_id", subaccount.id)
      .eq("instance_status", "connected");

    if (!instances || instances.length === 0) {
      console.log("⚠️ No connected WhatsApp instance for this subaccount");
      return immediateResponse;
    }

    const instance = instances[0];

    // Get contact phone from GHL
    let phone = "";
    if (finalContactId && subaccount.ghl_access_token) {
      let token = subaccount.ghl_access_token;
      const expiresAt = new Date(subaccount.ghl_token_expires_at);
      
      if (new Date() >= expiresAt && settings.ghl_client_id) {
        const tokenParams = new URLSearchParams({
          client_id: settings.ghl_client_id,
          client_secret: settings.ghl_client_secret,
          grant_type: "refresh_token",
          refresh_token: subaccount.ghl_refresh_token,
          user_type: "Location",
        });

        const tokenResponse = await fetch("https://services.leadconnectorhq.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString(),
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          token = tokenData.access_token;
          
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

    if (!phone) {
      phone = body.phone || body.to || message?.phone || message?.to || "";
    }

    if (!phone) {
      console.log("⚠️ Could not determine recipient phone number");
      return immediateResponse;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const whatsappNumber = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Send via UAZAPI
    const uazapiBaseUrl = settings.uazapi_base_url.replace(/\/$/, "");
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
          body: JSON.stringify({ phone: whatsappNumber, message: messageText }),
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
      for (const endpoint of endpoints) {
        try {
          const sendResponse = await fetch(`${uazapiBaseUrl}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instance.uazapi_instance_token,
            },
            body: JSON.stringify({ phone: whatsappNumber, message: messageText }),
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
      console.log("❌ Failed to send via UAZAPI");
    }

    // Handle attachments
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
            body: JSON.stringify({ phone: whatsappNumber, mediaUrl: url, caption: "" }),
          });
        } catch (e) {
          console.log("Failed to send attachment:", e);
        }
      }
    }

    return immediateResponse;

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    // Always return 200 OK even on error - n8n style
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
