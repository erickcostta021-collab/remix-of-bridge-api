import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SubaccountCard } from "@/components/dashboard/SubaccountCard";
import { InstanceCard } from "@/components/dashboard/InstanceCard";
import { AddInstanceDialog } from "@/components/dashboard/AddInstanceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useSubaccounts, Subaccount } from "@/hooks/useSubaccounts";
import { useInstances } from "@/hooks/useInstances";
import { useSettings } from "@/hooks/useSettings";
import { RefreshCw, Search, ArrowLeft, Loader2, AlertCircle, Plus, Smartphone, Link2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Dashboard() {
  const [selectedSubaccount, setSelectedSubaccount] = useState<Subaccount | null>(null);
  const [search, setSearch] = useState("");
  const { subaccounts, isLoading, syncSubaccounts } = useSubaccounts();
  const { instances, syncAllInstancesStatus } = useInstances(selectedSubaccount?.id);
  const { settings } = useSettings();

  const filteredSubaccounts = subaccounts.filter((s) =>
    s.account_name.toLowerCase().includes(search.toLowerCase()) ||
    s.location_id.toLowerCase().includes(search.toLowerCase())
  );

  const hasGHLToken = !!settings?.ghl_agency_token;
  const hasUAZAPIConfig = !!settings?.uazapi_admin_token && !!settings?.uazapi_base_url;

  if (selectedSubaccount) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedSubaccount(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Minhas Instâncias
                </h1>
                <p className="text-muted-foreground">
                  Gerencie suas conexões do WhatsApp e status em tempo real.
                </p>
              </div>
            </div>
            
            {/* Subaccount Info */}
            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl border border-border">
              <div>
                <p className="font-medium text-foreground">{selectedSubaccount.account_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedSubaccount.location_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncAllInstancesStatus.mutate()}
                  disabled={syncAllInstancesStatus.isPending || instances.length === 0}
                  className="border-border"
                >
                  {syncAllInstancesStatus.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline ml-2">Atualizar Status</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      let token = selectedSubaccount.embed_token;
                      
                      if (!token) {
                        // Generate token if not exists
                        const { data: tokenData } = await supabase.rpc("generate_embed_token");
                        token = tokenData || btoa(crypto.randomUUID()).slice(0, 20);
                        
                        await supabase
                          .from("ghl_subaccounts")
                          .update({ embed_token: token })
                          .eq("id", selectedSubaccount.id);
                      }
                      
                      const embedUrl = `${window.location.origin}/embed/${token}?iframe=true`;
                      await navigator.clipboard.writeText(embedUrl);
                      toast.success("Link copiado para a área de transferência!");
                    } catch (error) {
                      toast.error("Erro ao gerar link");
                    }
                  }}
                  className="border-border"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Copiar Link GHL
                </Button>
                {hasUAZAPIConfig && (
                  <AddInstanceDialog subaccount={selectedSubaccount} />
                )}
              </div>
            </div>
          </div>

          {/* Alert if UAZAPI not configured */}
          {!hasUAZAPIConfig && (
            <Alert className="border-warning bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Configure seu token UAZAPI nas configurações para criar e gerenciar instâncias.
              </AlertDescription>
            </Alert>
          )}

          {/* Instances Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Add Instance Card */}

            {/* Instance Cards */}
            {instances.map((instance) => (
              <InstanceCard key={instance.id} instance={instance} />
            ))}
          </div>

          {/* Empty State */}
          {instances.length === 0 && !hasUAZAPIConfig && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Smartphone className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhuma instância
              </h3>
              <p className="text-muted-foreground max-w-md">
                Configure a UAZAPI nas configurações para começar a criar instâncias.
              </p>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Gestor</h1>
            <p className="text-muted-foreground">
              Gerencie suas subcontas e instâncias
            </p>
          </div>
          {hasGHLToken && (
            <Button
              onClick={() => syncSubaccounts.mutate()}
              disabled={syncSubaccounts.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {syncSubaccounts.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar CRM
            </Button>
          )}
        </div>

        {/* Alert if GHL not configured */}
        {!hasGHLToken && (
          <Alert className="border-warning bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Configure seu token de agência GoHighLevel nas configurações para sincronizar subcontas.
            </AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar subcontas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>

        {/* Subaccounts Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredSubaccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {subaccounts.length === 0 ? "Nenhuma subconta" : "Nenhum resultado"}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {subaccounts.length === 0
                ? "Clique em 'Sincronizar CRM' para importar suas subcontas do GoHighLevel."
                : "Tente ajustar sua busca."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSubaccounts.map((subaccount) => (
              <SubaccountCard
                key={subaccount.id}
                subaccount={subaccount}
                onClick={() => setSelectedSubaccount(subaccount)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
