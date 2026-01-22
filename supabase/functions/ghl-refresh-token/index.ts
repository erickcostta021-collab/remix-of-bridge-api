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
    const { locationId, userId } = await req.json();

    if (!locationId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing locationId or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get integration and settings
    const [integrationResult, settingsResult] = await Promise.all([
      supabase
        .from("ghl_subaccounts")
        .select("*")
        .eq("location_id", locationId)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("user_settings")
        .select("ghl_client_id, ghl_client_secret")
        .eq("user_id", userId)
        .single(),
    ]);

    if (integrationResult.error || !integrationResult.data) {
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (settingsResult.error || !settingsResult.data?.ghl_client_id) {
      return new Response(
        JSON.stringify({ error: "OAuth credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const integration = integrationResult.data;
    const settings = settingsResult.data;

    if (!integration.ghl_refresh_token) {
      return new Response(
        JSON.stringify({ error: "No refresh token available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh the token
    const tokenParams = new URLSearchParams({
      client_id: settings.ghl_client_id,
      client_secret: settings.ghl_client_secret,
      grant_type: "refresh_token",
      refresh_token: integration.ghl_refresh_token,
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
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to refresh token", details: errorText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update integration
    const { error: updateError } = await supabase
      .from("ghl_subaccounts")
      .update({
        ghl_access_token: access_token,
        ghl_refresh_token: refresh_token,
        ghl_token_expires_at: expiresAt.toISOString(),
        ghl_subaccount_token: access_token,
        oauth_last_refresh: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("location_id", locationId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update integration:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update integration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Token refreshed for location ${locationId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        access_token,
        expires_at: expiresAt.toISOString() 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Token refresh error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
