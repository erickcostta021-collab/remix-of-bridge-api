import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InstanceData {
  instance_name: string;
  uazapi_instance_token: string;
  instance_status: string;
  location_id: string;
  ghl_user_id: string | null;
  ghl_subaccount_token: string | null;
  account_name: string;
  api_base_url: string;
  api_admin_token: string;
  ignore_groups: boolean;
  global_webhook_url: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;

    // Get user settings
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Settings not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.external_supabase_url || !settings.external_supabase_key) {
      return new Response(
        JSON.stringify({ error: "External Supabase credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create external Supabase client
    const externalSupabase = createClient(
      settings.external_supabase_url,
      settings.external_supabase_key
    );

    // Get all instances with their subaccount data
    const { data: instances, error: instancesError } = await supabase
      .from("instances")
      .select(`
        *,
        ghl_subaccounts!inner(
          account_name,
          location_id,
          ghl_subaccount_token
        )
      `)
      .eq("user_id", userId);

    if (instancesError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch instances", details: instancesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format data for external table
    const formattedData: InstanceData[] = (instances || []).map((inst: any) => ({
      instance_name: inst.instance_name,
      uazapi_instance_token: inst.uazapi_instance_token,
      instance_status: inst.instance_status || "disconnected",
      location_id: inst.ghl_subaccounts?.location_id || "",
      ghl_user_id: null, // Will be populated if available
      ghl_subaccount_token: inst.ghl_subaccounts?.ghl_subaccount_token || null,
      account_name: inst.ghl_subaccounts?.account_name || "",
      api_base_url: settings.uazapi_base_url || "https://atllassa.uazapi.com",
      api_admin_token: settings.uazapi_admin_token || "",
      ignore_groups: inst.ignore_groups || false,
      global_webhook_url: settings.global_webhook_url || null,
    }));

    // Try to create the table if it doesn't exist (using service role on external)
    // First, try to upsert data - if table doesn't exist, we'll get an error
    const { error: upsertError } = await externalSupabase
      .from("unified_instance_ghl")
      .upsert(formattedData, { 
        onConflict: "uazapi_instance_token",
        ignoreDuplicates: false 
      });

    if (upsertError) {
      // Table might not exist, try to inform user
      if (upsertError.message.includes("relation") && upsertError.message.includes("does not exist")) {
        return new Response(
          JSON.stringify({ 
            error: "Table 'unified_instance_ghl' does not exist. Please create it first.",
            createTableSQL: `
CREATE TABLE IF NOT EXISTS public.unified_instance_ghl (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL,
  uazapi_instance_token TEXT NOT NULL UNIQUE,
  instance_status TEXT NOT NULL DEFAULT 'disconnected',
  location_id TEXT NOT NULL,
  ghl_user_id TEXT,
  ghl_subaccount_token TEXT,
  account_name TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  api_admin_token TEXT NOT NULL,
  ignore_groups BOOLEAN DEFAULT false,
  global_webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unified_instance_ghl ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (or customize as needed)
CREATE POLICY "Allow all access" ON public.unified_instance_ghl FOR ALL USING (true);
            `.trim()
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to sync data", details: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${formattedData.length} instances to external Supabase`,
        data: formattedData 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
