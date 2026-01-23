import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get valid access token (refresh if needed)
async function getValidToken(supabase: any, subaccount: any, settings: any): Promise<string> {
  const accessToken: string | null = subaccount.ghl_access_token ?? null;
  const refreshToken: string | null = subaccount.ghl_refresh_token ?? null;
  const expiresAtIso: string | null = subaccount.ghl_token_expires_at ?? null;

  if (!accessToken || !refreshToken || !expiresAtIso) return accessToken || "";

  const now = new Date();
  const expiresAt = new Date(expiresAtIso);
  const expiresIn1Hour = expiresAt.getTime() - now.getTime() < 60 * 60 * 1000;

  if (now >= expiresAt || expiresIn1Hour) {
    const tokenParams = new URLSearchParams({
      client_id: settings.ghl_client_id,
      client_secret: settings.ghl_client_secret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
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
      const err = await tokenResponse.text();
      console.error("Failed to refresh GHL token:", err);
      throw new Error("Failed to refresh GHL token");
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
      .eq("id", subaccount.id);

    return tokenData.access_token;
  }

  return accessToken;
}

async function fetchGhlContactPhone(token: string, contactId: string): Promise<string> {
  const contactRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
    }
  );

  const bodyText = await contactRes.text();
  if (!contactRes.ok) {
    console.error("GHL contact lookup failed:", { status: contactRes.status, body: bodyText.substring(0, 300) });
    return "";
  }

  try {
    const parsed = JSON.parse(bodyText);
    return String(
      parsed?.contact?.phone ||
        parsed?.contact?.phoneNumber ||
        parsed?.contact?.primaryPhone ||
        ""
    );
  } catch {
    return "";
  }
}

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

    // Only handle outbound messages (avoid loops / noise)
    // Example from your n8n: body.type === "OutboundMessage"
    const eventType = String(body.type ?? "");
    const direction = String(body.direction ?? "");
    if (eventType !== "OutboundMessage" && direction !== "outbound") {
      console.log("Ignoring non-outbound event:", { eventType, direction });
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "not outbound" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      .select("id, user_id, location_id, ghl_access_token, ghl_refresh_token, ghl_token_expires_at")
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
      .select("uazapi_base_url, uazapi_admin_token, ghl_client_id, ghl_client_secret")
      .eq("user_id", subaccount.user_id)
      .single();

    if (settingsErr || !settings?.uazapi_base_url || !instance.uazapi_instance_token) {
      console.error("UAZAPI not configured:", { settingsErr });
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "uazapi not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract phone number - don't trust `to` (GHL often sends agent name), fetch contact phone when possible
    let targetPhone = phoneRaw || "";
    if (contactId) {
      try {
        if (!settings?.ghl_client_id || !settings?.ghl_client_secret) {
          console.error("Missing OAuth client credentials in user_settings");
        } else {
          const token = await getValidToken(supabase, subaccount, settings);
          if (token) {
            const contactPhone = await fetchGhlContactPhone(token, contactId);
            if (contactPhone) targetPhone = contactPhone;
          }
        }
      } catch (e) {
        console.error("Failed to resolve contact phone:", e);
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
    // Match the working n8n flow:
    // POST {base}/send/text
    // header: token: <instanceToken>
    // body: { number, text, readchat }
    const base = settings.uazapi_base_url.replace(/\/$/, "");
    const instanceToken = instance.uazapi_instance_token;

    // Try multiple endpoint/payload combinations based on different UAZAPI versions
    const attempts: Array<{ path: string; headers: Record<string, string>; body: Record<string, string> }> = [
      // n8n style
      {
        path: "/send/text",
        headers: { token: instanceToken },
        body: { number: targetPhone, text: messageText, readchat: "true" },
      },
      // sometimes expects boolean
      {
        path: "/send/text",
        headers: { token: instanceToken },
        body: { number: targetPhone, text: messageText, readchat: "1" },
      },
      // wuzapi style: /chat/send/text with Phone/Body
      {
        path: "/chat/send/text",
        headers: { Token: instanceToken },
        body: { Phone: targetPhone, Body: messageText },
      },
      // Alternative: with @s.whatsapp.net suffix
      {
        path: "/chat/send/text",
        headers: { Token: instanceToken },
        body: { Phone: `${targetPhone}@s.whatsapp.net`, Body: messageText },
      },
      // Alternative header style
      {
        path: "/chat/send/text",
        headers: { Authorization: `Bearer ${instanceToken}` },
        body: { Phone: targetPhone, Body: messageText },
      },
      // message/text style
      {
        path: "/message/text",
        headers: { Token: instanceToken },
        body: { id: targetPhone, message: messageText },
      },
      // api/sendText style
      {
        path: "/api/sendText",
        headers: { Authorization: `Bearer ${instanceToken}` },
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
