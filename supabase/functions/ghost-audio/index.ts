import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry wrapper for GHL API calls
async function fetchGHL(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 && attempt < maxRetries) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (response.status >= 500 && attempt < maxRetries) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 8000)));
      }
    }
  }
  throw lastError || new Error("fetchGHL: all retries exhausted");
}

// Get valid GHL access token (refresh if needed)
async function getValidToken(supabase: any, subaccount: any, settings: any): Promise<string> {
  const accessToken = subaccount.ghl_access_token;
  const refreshToken = subaccount.ghl_refresh_token;
  const expiresAtIso = subaccount.ghl_token_expires_at;
  if (!accessToken || !refreshToken || !expiresAtIso) return accessToken || "";

  const now = new Date();
  const expiresAt = new Date(expiresAtIso);
  if (now < expiresAt && (expiresAt.getTime() - now.getTime()) >= 3600000) return accessToken;

  const tokenParams = new URLSearchParams({
    client_id: settings.ghl_client_id,
    client_secret: settings.ghl_client_secret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    user_type: "Location",
  });

  const tokenResponse = await fetchGHL("https://services.leadconnectorhq.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    console.error("[ghost-audio] Token refresh failed:", await tokenResponse.text());
    return accessToken; // fallback to existing
  }

  const tokenData = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  await supabase.from("ghl_subaccounts").update({
    ghl_access_token: tokenData.access_token,
    ghl_refresh_token: tokenData.refresh_token,
    ghl_token_expires_at: newExpiresAt.toISOString(),
    ghl_subaccount_token: tokenData.access_token,
    oauth_last_refresh: new Date().toISOString(),
  }).eq("id", subaccount.id);

  return tokenData.access_token;
}

// Search for contact by phone in GHL
async function findContactByPhone(phone: string, locationId: string, token: string): Promise<string | null> {
  const cleanPhone = phone.replace(/\D/g, "");
  const searchResponse = await fetchGHL(
    `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${cleanPhone}`,
    { headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" } }
  );
  if (searchResponse.ok) {
    const data = await searchResponse.json();
    if (data.contacts?.length > 0) return data.contacts[0].id;
  }
  // Fallback: last 10 digits
  if (cleanPhone.length > 10) {
    const last10 = cleanPhone.slice(-10);
    const res2 = await fetchGHL(
      `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${last10}`,
      { headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28", Accept: "application/json" } }
    );
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.contacts?.length > 0) return data2.contacts[0].id;
    }
  }
  return null;
}

// Mirror audio as outbound message in GHL conversation
async function mirrorOutboundInGHL(contactId: string, token: string): Promise<void> {
  const payload = {
    type: "SMS",
    contactId,
    message: "🎤",
    status: "delivered",
    direction: "outbound",
  };

  console.log("[ghost-audio] Mirroring outbound in GHL:", { contactId });

  const response = await fetchGHL("https://services.leadconnectorhq.com/conversations/messages/inbound", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-04-15",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("[ghost-audio] Failed to mirror in GHL:", responseText);
  } else {
    console.log("[ghost-audio] ✅ Outbound mirrored in GHL:", responseText.substring(0, 200));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { audio, format, locationId, conversationId, phone } = await req.json();

    if (!audio || !locationId || !phone) {
      return new Response(JSON.stringify({ error: "audio, locationId and phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ghost-audio] Received:", { 
      format, locationId, conversationId, 
      phone, audioSize: audio?.length 
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find the subaccount for this locationId
    const { data: subaccount, error: subErr } = await supabase
      .from("ghl_subaccounts")
      .select("id, user_id, ghl_access_token, ghl_refresh_token, ghl_token_expires_at")
      .eq("location_id", locationId)
      .limit(1);

    if (subErr || !subaccount?.length) {
      console.error("[ghost-audio] Subaccount not found for location:", locationId);
      return new Response(JSON.stringify({ error: "Subaccount not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sub = subaccount[0];

    // 2. Clean phone number directly from the provided phone
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 8) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[ghost-audio] Target phone:", cleanPhone);

    // 3. Resolve the correct instance for this contact
    let instance: any = null;

    // Try contact_instance_preferences first (by phone last 10 digits)
    const last10 = cleanPhone.slice(-10);
    const { data: prefByPhone } = await supabase
      .from("contact_instance_preferences")
      .select("instance_id")
      .eq("location_id", locationId)
      .ilike("lead_phone", `%${last10}`)
      .limit(1);

    if (prefByPhone?.length) {
      const { data: inst } = await supabase
        .from("instances")
        .select("id, uazapi_instance_token, uazapi_base_url, user_id")
        .eq("id", prefByPhone[0].instance_id)
        .eq("instance_status", "connected")
        .limit(1);
      if (inst?.length) instance = inst[0];
    }

    // Fallback: get any connected instance for this subaccount
    if (!instance) {
      const { data: inst } = await supabase
        .from("instances")
        .select("id, uazapi_instance_token, uazapi_base_url, user_id")
        .eq("subaccount_id", sub.id)
        .eq("instance_status", "connected")
        .limit(1);
      if (inst?.length) instance = inst[0];
    }

    if (!instance) {
      console.error("[ghost-audio] No connected instance found");
      return new Response(JSON.stringify({ error: "No connected instance found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ghost-audio] Using instance:", instance.id);

    // 4. Resolve base URL
    let baseUrl = instance.uazapi_base_url;
    if (!baseUrl) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("uazapi_base_url")
        .eq("user_id", instance.user_id)
        .limit(1);
      baseUrl = settings?.[0]?.uazapi_base_url;
    }

    if (!baseUrl) {
      console.error("[ghost-audio] No UAZAPI base URL configured");
      return new Response(JSON.stringify({ error: "No UAZAPI server configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Send audio via UAZAPI - try multiple approaches
    const token = instance.uazapi_instance_token;
    const phoneWithJid = cleanPhone + "@s.whatsapp.net";

    // Convert base64 to data URI for UAZAPI
    const mimeType = format || "audio/ogg";
    const dataUri = "data:" + mimeType + ";base64," + audio;

    const attempts = [
      // Attempt 1: /send/audio with base64 data URI
      {
        path: "/send/audio",
        headers: { "Content-Type": "application/json", token: token },
        body: { number: phoneWithJid, file: dataUri, readchat: "true" },
      },
      // Attempt 2: /send/audio with different field names
      {
        path: "/send/audio",
        headers: { "Content-Type": "application/json", token: token },
        body: { Phone: cleanPhone, Url: dataUri },
      },
      // Attempt 3: /chat/send/audio
      {
        path: "/chat/send/audio",
        headers: { "Content-Type": "application/json", Token: token },
        body: { Phone: cleanPhone, Url: dataUri },
      },
      // Attempt 4: /send/media with audio type
      {
        path: "/send/media",
        headers: { "Content-Type": "application/json", token: token },
        body: { number: phoneWithJid, type: "audio", file: dataUri, readchat: "true" },
      },
      // Attempt 5: /chat/send/media
      {
        path: "/chat/send/media",
        headers: { "Content-Type": "application/json", Token: token },
        body: { Phone: cleanPhone, Url: dataUri, Caption: "" },
      },
    ];

    let lastStatus = 0;
    let lastBody = "";

    for (const attempt of attempts) {
      const url = baseUrl + attempt.path;
      console.log("[ghost-audio] Trying:", { url, bodyKeys: Object.keys(attempt.body) });

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: attempt.headers,
          body: JSON.stringify(attempt.body),
        });

        lastStatus = res.status;
        lastBody = await res.text();
        console.log("[ghost-audio] Response:", { url, status: lastStatus, body: lastBody.substring(0, 300) });

        if (res.ok) {
          console.log("[ghost-audio] ✅ Audio sent successfully via", attempt.path);

          // Mirror as outbound in GHL (fire-and-forget)
          try {
            // Get GHL token and user_settings for OAuth credentials
            const { data: settings } = await supabase
              .from("user_settings")
              .select("ghl_client_id, ghl_client_secret")
              .eq("user_id", sub.user_id)
              .limit(1);

            if (settings?.[0]?.ghl_client_id && sub.ghl_access_token) {
              const ghlToken = await getValidToken(supabase, sub, settings[0]);
              const contactId = await findContactByPhone(cleanPhone, locationId, ghlToken);
              if (contactId) {
                await mirrorOutboundInGHL(contactId, ghlToken);
              } else {
                console.log("[ghost-audio] Contact not found in GHL, skipping mirror");
              }
            } else {
              console.log("[ghost-audio] No GHL OAuth configured, skipping mirror");
            }
          } catch (mirrorErr) {
            console.error("[ghost-audio] Mirror error (non-fatal):", mirrorErr);
          }

          return new Response(JSON.stringify({ success: true, path: attempt.path }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("[ghost-audio] Fetch error for", attempt.path, ":", e);
      }
    }

    console.error("[ghost-audio] All attempts failed. Last:", { status: lastStatus, body: lastBody.substring(0, 300) });
    return new Response(JSON.stringify({ error: "Failed to send audio", lastStatus, lastBody: lastBody.substring(0, 300) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[ghost-audio] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
