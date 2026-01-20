import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/useSettings";
import { Save, Loader2, Eye, EyeOff } from "lucide-react";

export default function Settings() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [showTokens, setShowTokens] = useState(false);
  
  const [formData, setFormData] = useState({
    ghl_agency_token: "",
    uazapi_admin_token: "",
    uazapi_base_url: "",
    global_webhook_url: "",
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        ghl_agency_token: settings.ghl_agency_token || "",
        uazapi_admin_token: settings.uazapi_admin_token || "",
        uazapi_base_url: settings.uazapi_base_url || "https://atllassa.uazapi.com",
        global_webhook_url: settings.global_webhook_url || "",
      });
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(formData);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Configure seus tokens de API e preferências
          </p>
        </div>

        {/* GHL Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">GoHighLevel (GHL)</CardTitle>
            <CardDescription>
              Token de agência para sincronizar subcontas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ghl-token">Token de Agência</Label>
              <div className="relative">
                <Input
                  id="ghl-token"
                  type={showTokens ? "text" : "password"}
                  value={formData.ghl_agency_token}
                  onChange={(e) => setFormData({ ...formData, ghl_agency_token: e.target.value })}
                  placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="bg-secondary border-border pr-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre seu token em: GHL → Settings → Company → API Keys
              </p>
            </div>
          </CardContent>
        </Card>

        {/* UAZAPI Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">UAZAPI</CardTitle>
            <CardDescription>
              Configurações para criar e gerenciar instâncias WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uazapi-url">URL Base da API</Label>
              <Input
                id="uazapi-url"
                type="text"
                value={formData.uazapi_base_url}
                onChange={(e) => setFormData({ ...formData, uazapi_base_url: e.target.value })}
                placeholder="https://seu-servidor.uazapi.com"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uazapi-token">Token Admin</Label>
              <Input
                id="uazapi-token"
                type={showTokens ? "text" : "password"}
                value={formData.uazapi_admin_token}
                onChange={(e) => setFormData({ ...formData, uazapi_admin_token: e.target.value })}
                placeholder="Seu token admin da UAZAPI"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL Global</Label>
              <Input
                id="webhook-url"
                type="text"
                value={formData.global_webhook_url}
                onChange={(e) => setFormData({ ...formData, global_webhook_url: e.target.value })}
                placeholder="https://seu-webhook.com/endpoint"
                className="bg-secondary border-border"
              />
              <p className="text-xs text-muted-foreground">
                URL padrão para novos webhooks de instância
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setShowTokens(!showTokens)}
            className="border-border"
          >
            {showTokens ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Ocultar Tokens
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Mostrar Tokens
              </>
            )}
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {updateSettings.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
