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

// SQL to create the table
const CREATE_TABLE_SQL = `
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

ALTER TABLE public.unified_instance_ghl ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'unified_instance_ghl' AND policyname = 'Allow all access'
  ) THEN
    CREATE POLICY "Allow all access" ON public.unified_instance_ghl FOR ALL USING (true);
  END IF;
END $$;
`;

// SQL to upsert data
function generateUpsertSQL(data: InstanceData[]): string {
  if (data.length === 0) {
    return "";
  }

  const values = data.map(item => `(
    '${item.instance_name.replace(/'/g, "''")}',
    '${item.uazapi_instance_token}',
    '${item.instance_status}',
    '${item.location_id}',
    ${item.ghl_user_id ? `'${item.ghl_user_id}'` : 'NULL'},
    ${item.ghl_subaccount_token ? `'${item.ghl_subaccount_token}'` : 'NULL'},
    '${item.account_name.replace(/'/g, "''")}',
    '${item.api_base_url}',
    '${item.api_admin_token}',
    ${item.ignore_groups},
    ${item.global_webhook_url ? `'${item.global_webhook_url}'` : 'NULL'}
  )`).join(',\n');

  return `
    INSERT INTO public.unified_instance_ghl (
      instance_name,
      uazapi_instance_token,
      instance_status,
      location_id,
      ghl_user_id,
      ghl_subaccount_token,
      account_name,
      api_base_url,
      api_admin_token,
      ignore_groups,
      global_webhook_url
    ) VALUES ${values}
    ON CONFLICT (uazapi_instance_token) DO UPDATE SET
      instance_name = EXCLUDED.instance_name,
      instance_status = EXCLUDED.instance_status,
      location_id = EXCLUDED.location_id,
      ghl_user_id = EXCLUDED.ghl_user_id,
      ghl_subaccount_token = EXCLUDED.ghl_subaccount_token,
      account_name = EXCLUDED.account_name,
      api_base_url = EXCLUDED.api_base_url,
      api_admin_token = EXCLUDED.api_admin_token,
      ignore_groups = EXCLUDED.ignore_groups,
      global_webhook_url = EXCLUDED.global_webhook_url,
      updated_at = now();
  `;
}

// Get user's projects using PAT
async function getUserProjects(patToken: string): Promise<{ success: boolean; projects?: any[]; error?: string }> {
  try {
    const response = await fetch("https://api.supabase.com/v1/projects", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${patToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "Token PAT inválido ou expirado" };
      }
      return { success: false, error: `Erro ao buscar projetos: ${response.status}` };
    }

    const projects = await response.json();
    return { success: true, projects };
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}

// Execute SQL using Management API
async function executeSQL(projectRef: string, patToken: string, sql: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${patToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Management API error:", errorText);
      return { success: false, error: `Erro ao executar SQL: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error executing SQL:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
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
        JSON.stringify({ error: "Configurações não encontradas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.external_supabase_pat) {
      return new Response(
        JSON.stringify({ error: "Token PAT não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate PAT and get user's projects
    console.log("Validating PAT token...");
    const projectsResult = await getUserProjects(settings.external_supabase_pat);
    
    if (!projectsResult.success) {
      return new Response(
        JSON.stringify({ error: projectsResult.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!projectsResult.projects || projectsResult.projects.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum projeto Supabase encontrado para este token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the first active project
    const activeProject = projectsResult.projects.find((p: any) => p.status === "ACTIVE_HEALTHY") || projectsResult.projects[0];
    const projectRef = activeProject.id;
    
    console.log(`Using project: ${activeProject.name} (${projectRef})`);

    // Create table if not exists
    console.log("Creating table if not exists...");
    const createResult = await executeSQL(projectRef, settings.external_supabase_pat, CREATE_TABLE_SQL);
    
    if (!createResult.success) {
      return new Response(
        JSON.stringify({ error: `Erro ao criar tabela: ${createResult.error}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        JSON.stringify({ error: "Erro ao buscar instâncias", details: instancesError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format data for external table
    const formattedData: InstanceData[] = (instances || []).map((inst: any) => ({
      instance_name: inst.instance_name,
      uazapi_instance_token: inst.uazapi_instance_token,
      instance_status: inst.instance_status || "disconnected",
      location_id: inst.ghl_subaccounts?.location_id || "",
      ghl_user_id: null,
      ghl_subaccount_token: inst.ghl_subaccounts?.ghl_subaccount_token || null,
      account_name: inst.ghl_subaccounts?.account_name || "",
      api_base_url: settings.uazapi_base_url || "https://atllassa.uazapi.com",
      api_admin_token: settings.uazapi_admin_token || "",
      ignore_groups: inst.ignore_groups || false,
      global_webhook_url: settings.global_webhook_url || null,
    }));

    if (formattedData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhuma instância para sincronizar",
          project: activeProject.name,
          count: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert data using SQL
    console.log(`Syncing ${formattedData.length} instances...`);
    const upsertSQL = generateUpsertSQL(formattedData);
    const upsertResult = await executeSQL(projectRef, settings.external_supabase_pat, upsertSQL);

    if (!upsertResult.success) {
      return new Response(
        JSON.stringify({ error: `Erro ao sincronizar dados: ${upsertResult.error}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${formattedData.length} instância(s) sincronizada(s) com sucesso!`,
        project: activeProject.name,
        count: formattedData.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
