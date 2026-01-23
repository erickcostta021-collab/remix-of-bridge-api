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

// Helper to detect media type from URL
function detectMediaType(url: string): string {
  const lower = url.toLowerCase();
  if (/\.(mp3|wav|ogg|m4a|aac)/.test(lower)) return "myaudio";
  if (/\.(mp4|mov|avi|mkv|webm)/.test(lower)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp)/.test(lower)) return "image";
  if (/\.(pdf|doc|docx|xls|xlsx|txt)/.test(lower)) return "document";
  return "file";
}

// Send text message via UAZAPI
async function sendTextMessage(base: string, instanceToken: string, phone: string, text: string): Promise<{ sent: boolean; status: number; body: string }> {
  const attempts: Array<{ path: string; headers: Record<string, string>; body: Record<string, string> }> = [
    // n8n style - primary
    {
      path: "/send/text",
      headers: { token: instanceToken },
      body: { number: phone, text, readchat: "true" },
    },
    {
      path: "/send/text",
      headers: { token: instanceToken },
      body: { number: phone, text, readchat: "1" },
    },
    {
      path: "/chat/send/text",
      headers: { Token: instanceToken },
      body: { Phone: phone, Body: text },
    },
    {
      path: "/chat/send/text",
      headers: { Token: instanceToken },
      body: { Phone: `${phone}@s.whatsapp.net`, Body: text },
    },
    {
      path: "/chat/send/text",
      headers: { Authorization: `Bearer ${instanceToken}` },
      body: { Phone: phone, Body: text },
    },
    {
      path: "/message/text",
      headers: { Token: instanceToken },
      body: { id: phone, message: text },
    },
    {
      path: "/api/sendText",
      headers: { Authorization: `Bearer ${instanceToken}` },
      body: { chatId: `${phone}@c.us`, text },
    },
  ];

  let lastStatus = 0;
  let lastBody = "";
  
  for (const attempt of attempts) {
    const url = `${base}${attempt.path}`;
    console.log("Trying UAZAPI text send:", { url, phone, headers: Object.keys(attempt.headers) });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...attempt.headers },
      body: JSON.stringify(attempt.body),
    });

    lastStatus = res.status;
    lastBody = await res.text();
    console.log("UAZAPI text response:", { url, status: lastStatus, body: lastBody.substring(0, 200) });

    if (res.ok) {
      return { sent: true, status: lastStatus, body: lastBody };
    }
  }

  return { sent: false, status: lastStatus, body: lastBody };
}

// Send media message via UAZAPI (based on n8n flow)
async function sendMediaMessage(base: string, instanceToken: string, phone: string, fileUrl: string, mediaType: string, caption?: string): Promise<{ sent: boolean; status: number; body: string }> {
  // Based on n8n: POST {base}/send/media with header token and body { number, type, file, readchat, text (optional caption) }
  const attempts: Array<{ path: string; headers: Record<string, string>; body: Record<string, any> }> = [
    // n8n style - primary
    {
      path: "/send/media",
      headers: { token: instanceToken },
      body: { number: phone, type: mediaType, file: fileUrl, readchat: "true", ...(caption ? { text: caption } : {}) },
    },
    {
      path: "/send/media",
      headers: { token: instanceToken },
      body: { number: phone, type: mediaType, file: fileUrl, readchat: "1", ...(caption ? { text: caption } : {}) },
    },
    // Alternative without type
    {
      path: "/send/media",
      headers: { token: instanceToken },
      body: { number: phone, file: fileUrl, readchat: "true", ...(caption ? { text: caption } : {}) },
    },
    // Wuzapi style
    {
      path: "/chat/send/media",
      headers: { Token: instanceToken },
      body: { Phone: phone, Url: fileUrl, Caption: caption || "" },
    },
    {
      path: "/chat/send/document",
      headers: { Token: instanceToken },
      body: { Phone: phone, Url: fileUrl },
    },
    // For audio specifically
    {
      path: "/send/audio",
      headers: { token: instanceToken },
      body: { number: phone, file: fileUrl, readchat: "true" },
    },
  ];

  let lastStatus = 0;
  let lastBody = "";
  
  for (const attempt of attempts) {
    const url = `${base}${attempt.path}`;
    console.log("Trying UAZAPI media send:", { url, phone, mediaType, headers: Object.keys(attempt.headers) });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...attempt.headers },
      body: JSON.stringify(attempt.body),
    });

    lastStatus = res.status;
    lastBody = await res.text();
    console.log("UAZAPI media response:", { url, status: lastStatus, body: lastBody.substring(0, 200) });

    if (res.ok) {
      return { sent: true, status: lastStatus, body: lastBody };
    }
  }

  return { sent: false, status: lastStatus, body: lastBody };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("✅ webhook-outbound HIT", {
    method: req.method,
    url: req.url,
    contentType: req.headers.get("content-type"),
    userAgent: req.headers.get("user-agent"),
  });

  try {
    const body = await req.json();
    console.log("GHL Outbound payload:", JSON.stringify(body, null, 2));

    // Only handle outbound messages
    const eventType = String(body.type ?? "");
    const direction = String(body.direction ?? "");
    if (eventType !== "OutboundMessage" && direction !== "outbound") {
      console.log("Ignoring non-outbound event:", { eventType, direction });
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "not outbound" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const locationId: string | undefined = body.locationId;
    const contactId: string | undefined = body.contactId;
    const messageText: string = String(body.message ?? body.body ?? "");
    const phoneRaw: string = String(body.phone ?? body.to ?? "");
    const attachments: string[] = Array.isArray(body.attachments) ? body.attachments : [];

    // Validation ping check
    if (!messageText && !phoneRaw && !contactId && attachments.length === 0) {
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

    // Find subaccount
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

    // Get phone from contact
    let targetPhone = phoneRaw || "";
    if (contactId) {
      try {
        if (settings?.ghl_client_id && settings?.ghl_client_secret) {
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

    targetPhone = targetPhone.replace(/\D/g, "");

    if (!targetPhone) {
      console.error("No phone number available");
      return new Response(
        JSON.stringify({ success: false, error: "No phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we have content to send
    if (!messageText && attachments.length === 0) {
      console.log("No message text or attachments provided; acknowledging");
      return new Response(JSON.stringify({ success: true, ignored: true, reason: "missing content" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = settings.uazapi_base_url.replace(/\/$/, "");
    const instanceToken = instance.uazapi_instance_token;
    const results: Array<{ type: string; sent: boolean; status: number }> = [];

    // Send attachments first (media)
    for (const attachment of attachments) {
      const mediaType = detectMediaType(attachment);
      console.log("Sending media:", { attachment, mediaType, phone: targetPhone });
      
      const result = await sendMediaMessage(base, instanceToken, targetPhone, attachment, mediaType, messageText || undefined);
      results.push({ type: `media:${mediaType}`, sent: result.sent, status: result.status });
      
      if (!result.sent) {
        console.error("Failed to send media:", { attachment, status: result.status, body: result.body });
      }
    }

    // Send text message if there's text AND no attachments (to avoid duplicate text)
    // If there were attachments, text was already sent as caption
    if (messageText && attachments.length === 0) {
      console.log("Sending text:", { text: messageText.substring(0, 50), phone: targetPhone });
      const result = await sendTextMessage(base, instanceToken, targetPhone, messageText);
      results.push({ type: "text", sent: result.sent, status: result.status });
      
      if (!result.sent) {
        console.error("Failed to send text:", { status: result.status, body: result.body });
      }
    }

    const allSent = results.every(r => r.sent);
    const anySent = results.some(r => r.sent);

    console.log(`${anySent ? "✅" : "❌"} Message processing complete:`, { phone: targetPhone, results });

    return new Response(
      JSON.stringify({ success: true, sent: anySent, allSent, phone: targetPhone, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook outbound error:", error);
    return new Response(
      JSON.stringify({ success: true, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
