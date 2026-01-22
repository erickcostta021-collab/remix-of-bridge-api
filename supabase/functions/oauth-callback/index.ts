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
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    let locationId = url.searchParams.get("locationId");
    const companyId = url.searchParams.get("companyId");
    const state = url.searchParams.get("state"); // Contains user_id

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse state to get user_id
    let userId: string | null = null;
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        userId = stateData.userId;
      } catch {
        console.log("Could not parse state parameter");
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing user context in state" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user settings to retrieve OAuth credentials
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("ghl_client_id, ghl_client_secret, ghl_conversation_provider_id")
      .eq("user_id", userId)
      .single();

    if (settingsError || !settings?.ghl_client_id || !settings?.ghl_client_secret) {
      console.error("OAuth credentials not found:", settingsError);
      return new Response(
        JSON.stringify({ error: "OAuth credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the base URL for redirect - use frontend URL which proxies to this function
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://bridge-api.lovable.app";
    const redirectUri = `${frontendUrl}/oauth/callback`;

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      client_id: settings.ghl_client_id,
      client_secret: settings.ghl_client_secret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
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
      console.error("Token exchange failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to exchange code for tokens", details: errorText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, scope, userId: ghlUserId, locationId: tokenLocationId } = tokenData;

    // Use locationId from token response if not provided in URL
    const finalLocationId = tokenLocationId || locationId;
    
    if (!finalLocationId) {
      console.error("No locationId in URL or token response:", tokenData);
      return new Response(
        JSON.stringify({ error: "Could not determine locationId from OAuth response" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Get location name from GHL API
    let accountName = `Location ${finalLocationId}`;
    try {
      const locationResponse = await fetch(
        `https://services.leadconnectorhq.com/locations/${finalLocationId}`,
        {
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "Version": "2021-07-28",
            "Accept": "application/json",
          },
        }
      );

      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        accountName = locationData.location?.name || locationData.name || accountName;
      }
    } catch (e) {
      console.log("Could not fetch location name:", e);
    }

    // Upsert integration record
    const { error: upsertError } = await supabase
      .from("ghl_subaccounts")
      .upsert({
        user_id: userId,
        location_id: finalLocationId,
        company_id: companyId || null,
        account_name: accountName,
        ghl_access_token: access_token,
        ghl_refresh_token: refresh_token,
        ghl_token_expires_at: expiresAt.toISOString(),
        ghl_token_scopes: scope,
        ghl_subaccount_token: access_token, // Also set as subaccount token for existing functionality
        oauth_installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,location_id",
      });

    if (upsertError) {
      console.error("Failed to save integration:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save integration", details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ OAuth completed for location ${finalLocationId}`);
    console.log(`ℹ️ Provider activation must be done manually in GHL: Settings > Phone Numbers > Advanced Settings > SMS Provider`);

    // NOTE: GHL does not have a public API to activate conversation providers.
    // The user must manually enable it in the sub-account:
    // Settings > Phone Numbers > Advanced Settings > SMS Provider
    // Then select the app and click Save.

    // Redirect to success page (will auto-redirect to dashboard after 3s)
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": `${frontendUrl}/oauth/success/${finalLocationId}`,
      },
    });

  } catch (error: unknown) {
    console.error("OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
