import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Action = "status" | "connect" | "qrcode";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

async function tryFetchJson(
  baseUrl: string,
  candidatePaths: string[],
  init: RequestInit
): Promise<{ ok: boolean; status: number; data: any; usedUrl?: string }>
{
  const base = normalizeBaseUrl(baseUrl);
  let lastText = "";
  for (const path of candidatePaths) {
    const url = `${base}${path}`;
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, init);
      if (res.status === 404) continue;

      const text = await res.text().catch(() => "");
      lastText = text;
      const data = text ? JSON.parse(text) : {};
      return { ok: res.ok, status: res.status, data, usedUrl: url };
    } catch (e) {
      lastText = e instanceof Error ? e.message : String(e);
      continue;
    }
  }
  return { ok: false, status: 0, data: { error: "No endpoint matched", details: lastText } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const embedToken = String(body?.embedToken || "").trim();
    const instanceId = String(body?.instanceId || "").trim();
    const action = String(body?.action || "").trim() as Action;

    if (!embedToken || !instanceId || !["status", "connect", "qrcode"].includes(action)) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role: validação por embedToken evita acesso indevido.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validar se a instância pertence a uma subconta que possui esse embedToken
    const { data: inst, error: instErr } = await admin
      .from("instances")
      .select(
        `id, uazapi_instance_token,
         ghl_subaccounts!inner(id, user_id, embed_token)`
      )
      .eq("id", instanceId)
      .eq("ghl_subaccounts.embed_token", embedToken)
      .maybeSingle();

    if (instErr || !inst) {
      return new Response(JSON.stringify({ error: "Instância não encontrada para este token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sub = Array.isArray((inst as any).ghl_subaccounts)
      ? (inst as any).ghl_subaccounts[0]
      : (inst as any).ghl_subaccounts;

    const userId = String(sub?.user_id || "");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Subconta inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings, error: settingsErr } = await admin
      .from("user_settings")
      .select("uazapi_base_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsErr || !settings?.uazapi_base_url) {
      return new Response(JSON.stringify({ error: "UAZAPI não configurada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uazapiBaseUrl = String(settings.uazapi_base_url);
    const instanceToken = String((inst as any).uazapi_instance_token);

    const commonHeaders = {
      "Content-Type": "application/json",
      token: instanceToken,
    };

    if (action === "status") {
      const result = await tryFetchJson(
        uazapiBaseUrl,
        ["/instance/status", "/api/instance/status", "/v2/instance/status", "/api/v2/instance/status"],
        { method: "GET", headers: commonHeaders }
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "connect") {
      const result = await tryFetchJson(
        uazapiBaseUrl,
        ["/instance/connect", "/api/instance/connect", "/v2/instance/connect", "/api/v2/instance/connect"],
        { method: "POST", headers: commonHeaders }
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // qrcode
    const result = await tryFetchJson(
      uazapiBaseUrl,
      [
        "/instance/qrcode",
        "/instance/qr",
        "/qrcode",
        "/api/instance/qrcode",
        "/api/instance/qr",
        "/v2/instance/qrcode",
        "/api/v2/instance/qrcode",
      ],
      { method: "GET", headers: commonHeaders }
    );
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("uazapi-proxy-embed error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
