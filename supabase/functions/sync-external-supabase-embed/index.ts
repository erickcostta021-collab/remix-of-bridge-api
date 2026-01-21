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

function generateUpsertSQL(data: InstanceData[]): string {
  if (data.length === 0) return "";

  const values = data
    .map((item) => `(
      '${item.instance_name.replace(/'/g, "''")}',
      '${item.uazapi_instance_token}',
      '${item.instance_status}',
      '${item.location_id.replace(/'/g, "''")}',
      ${item.ghl_user_id ? `'${item.ghl_user_id.replace(/'/g, "''")}'` : "NULL"},
      ${item.ghl_subaccount_token ? `'${item.ghl_subaccount_token.replace(/'/g, "''")}'` : "NULL"},
      '${item.account_name.replace(/'/g, "''")}',
      '${item.api_base_url.replace(/'/g, "''")}',
      '${item.api_admin_token.replace(/'/g, "''")}',
      ${item.ignore_groups},
      ${item.global_webhook_url ? `'${item.global_webhook_url.replace(/'/g, "''")}'` : "NULL"}
    )`)
    .join(",\n");

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

async function getUserProjects(patToken: string): Promise<{ success: boolean; projects?: any[]; error?: string }> {
  try {
    const response = await fetch("https://api.supabase.com/v1/projects", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${patToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) return { success: false, error: "Token PAT inválido ou expirado" };
      return { success: false, error: `Erro ao buscar projetos: ${response.status}` };
    }

    const projects = await response.json();
    return { success: true, projects };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}

async function executeSQL(projectRef: string, patToken: string, sql: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${patToken}`,
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
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const embedToken = String(body?.embedToken || "").trim();
    const instanceId = String(body?.instanceId || "").trim();

    if (!embedToken || !instanceId) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role para ler dados internos com segurança; validação por embedToken evita acesso indevido.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Valida se a instância pertence a uma subconta que possui esse embedToken
    const { data: inst, error: instErr } = await admin
      .from("instances")
      .select(
        `id, instance_name, instance_status, uazapi_instance_token, ignore_groups, ghl_user_id,
         ghl_subaccounts!inner(id, user_id, account_name, location_id, ghl_subaccount_token, embed_token)`
      )
      .eq("id", instanceId)
      .eq("ghl_subaccounts.embed_token", embedToken)
      .single();

    if (instErr || !inst) {
      return new Response(JSON.stringify({ error: "Instância não encontrada para este token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sub = Array.isArray((inst as any).ghl_subaccounts)
      ? (inst as any).ghl_subaccounts[0]
      : (inst as any).ghl_subaccounts;

    if (!sub?.user_id) {
      return new Response(JSON.stringify({ error: "Subconta inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = String(sub.user_id);

    const { data: settings, error: settingsErr } = await admin
      .from("user_settings")
      .select("external_supabase_pat, uazapi_base_url, uazapi_admin_token, global_webhook_url")
      .eq("user_id", userId)
      .single();

    if (settingsErr || !settings?.external_supabase_pat) {
      return new Response(JSON.stringify({ error: "Integração externa não configurada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const projectsResult = await getUserProjects(settings.external_supabase_pat);
    if (!projectsResult.success || !projectsResult.projects?.length) {
      return new Response(JSON.stringify({ error: projectsResult.error || "Nenhum projeto encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const activeProject =
      projectsResult.projects.find((p: any) => p.status === "ACTIVE_HEALTHY") || projectsResult.projects[0];
    const projectRef = activeProject.id;

    const createResult = await executeSQL(projectRef, settings.external_supabase_pat, CREATE_TABLE_SQL);
    if (!createResult.success) {
      return new Response(JSON.stringify({ error: `Erro ao criar tabela: ${createResult.error}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formatted: InstanceData[] = [
      {
        instance_name: inst.instance_name,
        uazapi_instance_token: inst.uazapi_instance_token,
        instance_status: inst.instance_status || "disconnected",
        location_id: sub.location_id || "",
        ghl_user_id: inst.ghl_user_id || null,
        ghl_subaccount_token: sub.ghl_subaccount_token || null,
        account_name: sub.account_name || "",
        api_base_url: settings.uazapi_base_url || "https://atllassa.uazapi.com",
        api_admin_token: settings.uazapi_admin_token || "",
        ignore_groups: Boolean(inst.ignore_groups),
        global_webhook_url: settings.global_webhook_url || null,
      },
    ];

    const upsertSQL = generateUpsertSQL(formatted);
    const upsertResult = await executeSQL(projectRef, settings.external_supabase_pat, upsertSQL);
    if (!upsertResult.success) {
      return new Response(JSON.stringify({ error: `Erro ao sincronizar dados: ${upsertResult.error}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Sincronizado com sucesso", count: 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
