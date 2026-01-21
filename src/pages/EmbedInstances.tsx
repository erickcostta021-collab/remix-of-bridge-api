import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Smartphone, Wifi, WifiOff, Phone, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmbedInstance {
  id: string;
  instance_name: string;
  instance_status: "connected" | "connecting" | "disconnected";
  phone?: string;
  profilePicUrl?: string;
}

interface SubaccountData {
  id: string;
  account_name: string;
  location_id: string;
}

export default function EmbedInstances() {
  const { embedToken } = useParams();
  const [searchParams] = useSearchParams();
  const isIframe = searchParams.get("iframe") === "true";
  
  const [loading, setLoading] = useState(true);
  const [subaccount, setSubaccount] = useState<SubaccountData | null>(null);
  const [instances, setInstances] = useState<EmbedInstance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!embedToken) {
      setError("Token inválido");
      setLoading(false);
      return;
    }

    try {
      // Fetch subaccount by embed token
      const { data: subData, error: subError } = await supabase
        .from("ghl_subaccounts")
        .select("id, account_name, location_id")
        .eq("embed_token", embedToken)
        .single();

      if (subError || !subData) {
        setError("Subconta não encontrada");
        setLoading(false);
        return;
      }

      setSubaccount(subData);

      // Fetch instances for this subaccount
      const { data: instData, error: instError } = await supabase
        .from("instances")
        .select("id, instance_name, instance_status")
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

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length >= 10) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    }
    return phone;
  };

  const statusConfig = {
    connected: {
      label: "Conectado",
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      icon: Wifi,
    },
    connecting: {
      label: "Conectando",
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse",
      icon: Wifi,
    },
    disconnected: {
      label: "Desconectado",
      className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      icon: WifiOff,
    },
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
            {instances.map((instance) => {
              const status = statusConfig[instance.instance_status];
              const StatusIcon = status.icon;

              return (
                <Card 
                  key={instance.id} 
                  className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl shrink-0">
                        <Smartphone className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-card-foreground truncate">
                            {instance.instance_name}
                          </h3>
                        </div>
                        <Badge variant="outline" className={`${status.className} mt-1`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}