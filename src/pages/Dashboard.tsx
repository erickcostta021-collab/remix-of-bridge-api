import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SubaccountCard } from "@/components/dashboard/SubaccountCard";
import { InstanceCard } from "@/components/dashboard/InstanceCard";
import { CreateInstanceDialog } from "@/components/dashboard/CreateInstanceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSubaccounts, Subaccount } from "@/hooks/useSubaccounts";
import { useInstances } from "@/hooks/useInstances";
import { useSettings } from "@/hooks/useSettings";
import { RefreshCw, Search, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Dashboard() {
  const [selectedSubaccount, setSelectedSubaccount] = useState<Subaccount | null>(null);
  const [search, setSearch] = useState("");
  const { subaccounts, isLoading, syncSubaccounts } = useSubaccounts();
  const { instances } = useInstances(selectedSubaccount?.id);
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                  {selectedSubaccount.account_name}
                </h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {selectedSubaccount.location_id}
                </p>
              </div>
            </div>
            {hasUAZAPIConfig && (
              <CreateInstanceDialog subaccountId={selectedSubaccount.id} />
            )}
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
          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhuma instância
              </h3>
              <p className="text-muted-foreground max-w-md">
                Esta subconta ainda não possui instâncias UAZAPI vinculadas.
                Clique em "Nova Instância" para criar uma.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {instances.map((instance) => (
                <InstanceCard key={instance.id} instance={instance} />
              ))}
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
