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
    const locationId: string | undefined = body.locationId;
    const contactId: string | undefined = body.contactId;

    // Normalize message fields (GHL can send either `message` or `body`)
    const messageText: string = String(body.message ?? body.body ?? "");

    // Normalize phone fields (GHL can send either `phone` or `to`)
    const phoneRaw: string = String(body.phone ?? body.to ?? "");

    // If this is just a validation ping (no message content), respond immediately
    if (!messageText && !phoneRaw && !contactId) {
      console.log("Validation ping received, responding 200 OK");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!locationId) {
      console.error("Missing locationId in payload");
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "missing locationId" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find subaccount by locationId
    const { data: subaccount, error: subError } = await supabase
      .from("ghl_subaccounts")
      .select("id, user_id, location_id, ghl_access_token")
      .eq("location_id", locationId)
      .single();

    if (subError || !subaccount) {
      console.error("Subaccount lookup failed:", { locationId, subError });
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "subaccount not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: instances, error: instErr } = await supabase
      .from("instances")
      .select("id, uazapi_instance_token")
      .eq("subaccount_id", subaccount.id)
      .order("created_at", { ascending: true });

    const instance = instances?.[0];
    if (instErr || !instance) {
      console.error("No instance found for subaccount");
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "no instance configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingsErr } = await supabase
      .from("user_settings")
      .select("uazapi_base_url, uazapi_admin_token")
      .eq("user_id", subaccount.user_id)
      .single();

    if (settingsErr || !settings?.uazapi_base_url || !instance.uazapi_instance_token) {
      console.error("UAZAPI not configured:", { settingsErr });
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "uazapi not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract phone number - clean it
    let targetPhone = phoneRaw || "";
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

    if (!messageText) {
      console.log("No message text provided; acknowledging");
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "missing message" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send message via UAZAPI
    // Based on wuzapi/UAZAPI docs, the endpoint is /chat/send/text with Token header
    // Body format: { "Phone": "...", "Body": "..." }
    const base = settings.uazapi_base_url.replace(/\/$/, "");
    const instanceToken = instance.uazapi_instance_token;

    // Try multiple endpoint/payload combinations based on different UAZAPI versions
    const attempts: Array<{ path: string; headers: Record<string, string>; body: Record<string, string> }> = [
      // wuzapi style: /chat/send/text with Phone/Body
      {
        path: "/chat/send/text",
        headers: { "Token": instanceToken },
        body: { Phone: targetPhone, Body: messageText },
      },
      // Alternative: with @s.whatsapp.net suffix
      {
        path: "/chat/send/text",
        headers: { "Token": instanceToken },
        body: { Phone: `${targetPhone}@s.whatsapp.net`, Body: messageText },
      },
      // Alternative header style
      {
        path: "/chat/send/text",
        headers: { "Authorization": `Bearer ${instanceToken}` },
        body: { Phone: targetPhone, Body: messageText },
      },
      // message/text style
      {
        path: "/message/text",
        headers: { "Token": instanceToken },
        body: { id: targetPhone, message: messageText },
      },
      // api/sendText style
      {
        path: "/api/sendText",
        headers: { "Authorization": `Bearer ${instanceToken}` },
        body: { chatId: `${targetPhone}@c.us`, text: messageText },
      },
    ];

    let sent = false;
    let lastStatus = 0;
    let lastBody = "";
    
    for (const attempt of attempts) {
      const url = `${base}${attempt.path}`;
      console.log("Trying UAZAPI send:", { url, phone: targetPhone, headers: Object.keys(attempt.headers) });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...attempt.headers,
        },
        body: JSON.stringify(attempt.body),
      });

      lastStatus = res.status;
      lastBody = await res.text();
      console.log("UAZAPI response:", { url, status: lastStatus, body: lastBody.substring(0, 200) });

      if (res.ok) {
        sent = true;
        break;
      }
      
      // If we get 404, try next. If we get 401/403, might be auth issue
      if (lastStatus === 401 || lastStatus === 403) {
        console.log("Auth issue, trying next method...");
      }
    }

    if (!sent) {
      return new Response(
        JSON.stringify({ success: true, sent: false, error: "uazapi send failed", lastStatus, lastBody }),
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
