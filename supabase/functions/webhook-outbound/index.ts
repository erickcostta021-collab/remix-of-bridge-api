import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // n8n-style PASS-THROUGH (GHL provider validation)
  // Requirements:
  // - Public endpoint (no JWT/session)
  // - Zero latency before 200 OK (<1-2s)
  // - Always log ANY request arrival
  console.log("✅ webhook-outbound HIT", {
    method: req.method,
    url: req.url,
    contentType: req.headers.get("content-type"),
    userAgent: req.headers.get("user-agent"),
  });

  // First response: immediate 200 OK
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
