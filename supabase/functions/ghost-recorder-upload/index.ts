const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchGHL(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429 || (res.status >= 500 && i < retries)) {
      const wait = res.headers.get("retry-after")
        ? parseInt(res.headers.get("retry-after")!) * 1000
        : Math.pow(2, i) * 1000;
      console.log(`[ghost-recorder-upload] Retry ${i + 1} after ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const locationId = formData.get("locationId") as string | null;
    const conversationId = formData.get("conversationId") as string | null;
    const contactId = formData.get("contactId") as string | null;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "audio file required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!locationId) {
      return new Response(
        JSON.stringify({ error: "locationId required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!conversationId && !contactId) {
      return new Response(
        JSON.stringify({
          error: "conversationId or contactId required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[ghost-recorder-upload] Request:", {
      locationId,
      conversationId,
      contactId,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      fileName: audioFile.name,
    });

    // Look up GHL access token for this location
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subaccount, error: subErr } = await supabase
      .from("ghl_subaccounts")
      .select("ghl_access_token, ghl_subaccount_token")
      .eq("location_id", locationId)
      .order("oauth_installed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      console.error("[ghost-recorder-upload] DB error:", subErr);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accessToken =
      subaccount?.ghl_access_token || subaccount?.ghl_subaccount_token;

    if (!accessToken) {
      console.error(
        "[ghost-recorder-upload] No access token for location:",
        locationId
      );
      return new Response(
        JSON.stringify({ error: "No GHL token found for this location" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 1: Upload file to GHL
    const uploadForm = new FormData();
    const audioBuffer = await audioFile.arrayBuffer();
    const uploadBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    uploadForm.append(
      "fileAttachment",
      uploadBlob,
      "voice_message.mp3"
    );

    if (conversationId) {
      uploadForm.append("conversationId", conversationId);
    } else if (contactId) {
      uploadForm.append("contactId", contactId);
    }

    console.log("[ghost-recorder-upload] Uploading to GHL...");

    const uploadRes = await fetchGHL(
      "https://services.leadconnectorhq.com/conversations/messages/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Version: "2021-04-15",
        },
        body: uploadForm,
      }
    );

    const uploadText = await uploadRes.text();
    console.log(
      "[ghost-recorder-upload] GHL response:",
      uploadRes.status,
      uploadText
    );

    if (!uploadRes.ok) {
      return new Response(
        JSON.stringify({
          error: "GHL upload failed",
          status: uploadRes.status,
          detail: uploadText,
        }),
        {
          status: uploadRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let uploadData;
    try {
      uploadData = JSON.parse(uploadText);
    } catch {
      uploadData = { raw: uploadText };
    }

    console.log("[ghost-recorder-upload] Upload success:", uploadData);

    return new Response(
      JSON.stringify({ success: true, data: uploadData }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[ghost-recorder-upload] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
