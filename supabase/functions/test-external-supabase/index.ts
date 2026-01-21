import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { external_supabase_url, external_supabase_key, external_supabase_pat } = await req.json();

    if (!external_supabase_url || !external_supabase_key) {
      return new Response(
        JSON.stringify({ success: false, error: "URL e Service Key são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL format
    try {
      new URL(external_supabase_url);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "URL inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test connection with service key
    const externalSupabase = createClient(external_supabase_url, external_supabase_key);
    
    // Try a simple query to test the connection
    const { error: connectionError } = await externalSupabase
      .from("_test_connection_")
      .select("*")
      .limit(1);

    // We expect an error since the table doesn't exist, but a specific error
    // If we get "relation does not exist" that means the connection worked!
    if (connectionError) {
      const errorMessage = connectionError.message.toLowerCase();
      
      // These errors mean the connection worked but table doesn't exist (expected)
      if (errorMessage.includes("does not exist") || errorMessage.includes("relation")) {
        // Connection successful
      } else if (errorMessage.includes("invalid api key") || errorMessage.includes("jwt")) {
        return new Response(
          JSON.stringify({ success: false, error: "Service Key inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (errorMessage.includes("fetch failed") || errorMessage.includes("network")) {
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível conectar ao servidor" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Test PAT token if provided
    let patValid = false;
    if (external_supabase_pat) {
      const projectRefMatch = external_supabase_url.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (projectRefMatch) {
        const projectRef = projectRefMatch[1];
        try {
          const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${external_supabase_pat}`,
            },
          });
          patValid = response.ok;
        } catch {
          patValid = false;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Conexão estabelecida com sucesso!",
        patValid: external_supabase_pat ? patValid : null,
        patMessage: external_supabase_pat 
          ? (patValid ? "Token PAT válido - tabela será criada automaticamente" : "Token PAT inválido - tabela precisará ser criada manualmente")
          : null
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
