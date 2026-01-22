import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Captura os parâmetros OAuth do GHL
    const code = searchParams.get("code");
    const locationId = searchParams.get("locationId");
    const companyId = searchParams.get("companyId");
    const state = searchParams.get("state");

    // Se o usuário acessar /oauth/callback manualmente (sem parâmetros),
    // não devemos redirecionar para a função do backend.
    if (!code) return;

    // Redireciona para a Edge Function com todos os parâmetros
    const edgeFunctionUrl = new URL(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-callback`
    );

    if (code) edgeFunctionUrl.searchParams.set("code", code);
    if (locationId) edgeFunctionUrl.searchParams.set("locationId", locationId);
    if (companyId) edgeFunctionUrl.searchParams.set("companyId", companyId);
    if (state) edgeFunctionUrl.searchParams.set("state", state);

    // Redireciona imediatamente
    window.location.href = edgeFunctionUrl.toString();
  }, [searchParams]);

  const hasCode = !!searchParams.get("code");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        {hasCode ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Processando autenticação...</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">Callback OAuth</h1>
            <p className="text-muted-foreground mt-2 max-w-md">
              Esta URL é usada apenas como retorno do GoHighLevel. Para testar, inicie a
              instalação pelo Marketplace para que os parâmetros (ex: <code>code</code>) sejam
              enviados.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
