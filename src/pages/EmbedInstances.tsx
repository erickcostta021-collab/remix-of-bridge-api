import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useEmbedSupabase } from "@/hooks/useEmbedSupabase";
import { Smartphone, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmbedInstanceCard, EmbedInstance } from "@/components/embed/EmbedInstanceCard";

interface SubaccountData {
  id: string;
  account_name: string;
  location_id: string;
  ghl_access_token: string | null;
  user_id: string;
}

interface UserSettings {
  uazapi_base_url: string | null;
  uazapi_admin_token: string | null;
}

export default function EmbedInstances() {
  const { embedToken } = useParams();
  const [searchParams] = useSearchParams();
  const isIframe = searchParams.get("iframe") === "true";
  const supabase = useEmbedSupabase();
  
  const [loading, setLoading] = useState(true);
  const [subaccount, setSubaccount] = useState<SubaccountData | null>(null);
  const [instances, setInstances] = useState<EmbedInstance[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!embedToken) {
      setError("Token inválido");
      setLoading(false);
      return;
    }

    try {
      console.log("[EmbedInstances] Fetching subaccount for token:", embedToken);
      
      // Fetch subaccount by embed token
      const { data: subData, error: subError } = await supabase
        .from("ghl_subaccounts")
        .select("id, account_name, location_id, ghl_access_token, user_id")
        .eq("embed_token", embedToken)
        .single();

      console.log("[EmbedInstances] Subaccount query result:", { subData, subError });

      if (subError) {
        console.error("[EmbedInstances] Subaccount error:", subError);
        setError(`Erro ao buscar subconta: ${subError.message}`);
        setLoading(false);
        return;
      }
      
      if (!subData) {
        setError("Subconta não encontrada");
        setLoading(false);
        return;
      }

      setSubaccount(subData);

      // Fetch user settings for UAZAPI config
      const { data: settingsData } = await supabase
        .from("user_settings")
        .select("uazapi_base_url, uazapi_admin_token")
        .eq("user_id", subData.user_id)
        .single();

      setUserSettings(settingsData);

      // Fetch instances for this subaccount
      const { data: instData, error: instError } = await supabase
        .from("instances")
        .select("id, instance_name, instance_status, uazapi_instance_token, ghl_user_id")
        .eq("subaccount_id", subData.id)
        .order("instance_name");

      if (instError) {
        console.error("Error fetching instances:", instError);
        setInstances([]);
      } else {
        setInstances(instData || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [embedToken]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isIframe ? "bg-transparent" : "bg-background"}`}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isIframe ? "bg-transparent" : "bg-background"}`}>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isIframe ? "bg-transparent p-2" : "bg-background p-6"}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            {!isIframe && subaccount && (
              <h1 className="text-xl font-semibold text-foreground">
                {subaccount.account_name}
              </h1>
            )}
            <p className="text-sm text-muted-foreground">
              {instances.length} instância{instances.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-border"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Instances Grid */}
        {instances.length === 0 ? (
          <div className="text-center py-12">
            <Smartphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma instância encontrada</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instances.map((instance) => (
              <EmbedInstanceCard
                key={instance.id}
                instance={instance}
                subaccountId={subaccount!.id}
                embedToken={embedToken!}
                locationId={subaccount!.location_id}
                ghlAccessToken={subaccount!.ghl_access_token}
                uazapiBaseUrl={userSettings?.uazapi_base_url || "https://atllassa.uazapi.com"}
                uazapiAdminToken={userSettings?.uazapi_admin_token || ""}
                onStatusChange={handleRefresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
