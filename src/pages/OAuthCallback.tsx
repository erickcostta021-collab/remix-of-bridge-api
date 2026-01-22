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

    // Redireciona para a Edge Function com todos os parâmetros
    const edgeFunctionUrl = new URL(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghl-oauth-callback`
    );

    if (code) edgeFunctionUrl.searchParams.set("code", code);
    if (locationId) edgeFunctionUrl.searchParams.set("locationId", locationId);
    if (companyId) edgeFunctionUrl.searchParams.set("companyId", companyId);
    if (state) edgeFunctionUrl.searchParams.set("state", state);

    // Redireciona imediatamente
    window.location.href = edgeFunctionUrl.toString();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Processando autenticação...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
