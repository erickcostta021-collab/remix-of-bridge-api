import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { audio, format, locationId, contactId, conversationId, phone } = await req.json();

    if (!audio || !locationId) {
      return new Response(JSON.stringify({ error: "audio and locationId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ghost-audio] Received:", { 
      format, locationId, contactId, conversationId, 
      phone, audioSize: audio?.length 
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Find the subaccount for this locationId
    const { data: subaccount, error: subErr } = await supabase
      .from("ghl_subaccounts")
      .select("id, user_id")
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

    // 2. Resolve the target phone number from context
    let targetPhone = phone;

    // If no phone provided, try to resolve from contactId via GHL API or preferences
    if (!targetPhone && contactId) {
      // Try to get phone from contact_instance_preferences
      const { data: pref } = await supabase
        .from("contact_instance_preferences")
        .select("lead_phone")
        .eq("contact_id", contactId)
        .eq("location_id", locationId)
        .limit(1);
      
      if (pref?.length && pref[0].lead_phone) {
        targetPhone = pref[0].lead_phone;
      }
    }

    if (!targetPhone) {
      // Try ghl_contact_phone_mapping
      if (contactId) {
        const { data: mapping } = await supabase
          .from("ghl_contact_phone_mapping")
          .select("original_phone")
          .eq("contact_id", contactId)
          .eq("location_id", locationId)
          .limit(1);
        
        if (mapping?.length) {
          targetPhone = mapping[0].original_phone;
        }
      }
    }

    if (!targetPhone) {
      console.error("[ghost-audio] Could not resolve target phone");
      return new Response(JSON.stringify({ error: "Could not resolve target phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number
    const cleanPhone = targetPhone.replace(/\D/g, "");
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
