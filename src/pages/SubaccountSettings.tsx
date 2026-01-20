import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, Eye, EyeOff, CheckCircle2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";

interface SubaccountData {
  id: string;
  account_name: string;
  location_id: string;
  ghl_subaccount_token: string | null;
  ghl_user_id: string | null;
}

export default function SubaccountSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();

  const [subaccount, setSubaccount] = useState<SubaccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    ghl_subaccount_token: "",
  });

  useEffect(() => {
    if (id && user) {
      loadSubaccount();
    }
  }, [id, user]);

  useEffect(() => {
    if (subaccount) {
      setFormData({
        ghl_subaccount_token: subaccount.ghl_subaccount_token || "",
      });
    }
  }, [subaccount]);

  const loadSubaccount = async () => {
    try {
      const { data, error } = await supabase
        .from("ghl_subaccounts")
        .select("*")
        .eq("id", id)
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setSubaccount(data);
    } catch (error: any) {
      console.error("Error loading subaccount:", error);
      toast.error("Erro ao carregar subconta");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!subaccount) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("ghl_subaccounts")
        .update({
          ghl_subaccount_token: formData.ghl_subaccount_token || null,
        })
        .eq("id", subaccount.id)
        .eq("user_id", user?.id);

      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
      await loadSubaccount();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!subaccount) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Subconta não encontrada</p>
        </div>
      </DashboardLayout>
    );
  }

  const isConnected = !!subaccount.ghl_subaccount_token;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground italic">
                  Integração & Servidor
                </h1>
                <Badge 
                  variant={isConnected ? "default" : "secondary"}
                  className={isConnected ? "bg-success text-success-foreground" : ""}
                >
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      SUBCONTA CONECTADA
                    </>
                  ) : (
                    "NÃO CONFIGURADA"
                  )}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Configure os dados do GHL e as definições globais do UaZapi.
              </p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Tudo
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="credentials" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3 bg-secondary">
            <TabsTrigger value="credentials">Credenciais</TabsTrigger>
            <TabsTrigger value="webhook">Webhook Global</TabsTrigger>
            <TabsTrigger value="privacy">Privacidade</TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* GHL Subaccount Settings */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Subconta GoHighLevel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="location-id">Location ID</Label>
                    <Input
                      id="location-id"
                      value={subaccount.location_id}
                      readOnly
                      className="bg-muted border-border font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bearer-token">Bearer Token</Label>
                    <div className="relative">
                      <Input
                        id="bearer-token"
                        type={showToken ? "text" : "password"}
                        value={formData.ghl_subaccount_token}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            ghl_subaccount_token: e.target.value,
                          }))
                        }
                        placeholder="Cole o token da subconta aqui..."
                        className="bg-background border-border pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowToken(!showToken)}
                      >
                        {showToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* UAZAPI Settings (uses global by default) */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">API UaZapi (Servidor)</CardTitle>
                  <CardDescription className="text-primary">
                    * Usando as configurações globais da Agência
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="uazapi-url">API Base URL</Label>
                    <Input
                      id="uazapi-url"
                      value={settings?.uazapi_base_url || ""}
                      readOnly
                      placeholder="Não configurado"
                      className="bg-muted border-border text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="uazapi-token">Admin Token</Label>
                    <Input
                      id="uazapi-token"
                      type="password"
                      value={settings?.uazapi_admin_token || ""}
                      readOnly
                      placeholder="Não configurado"
                      className="bg-muted border-border"
                    />
                  </div>

                  <Alert className="border-info bg-info/10">
                    <Info className="h-4 w-4 text-info" />
                    <AlertDescription className="text-info text-xs">
                      Configure nas Configurações Globais para alterar
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="webhook" className="mt-6">
            <Card className="bg-card border-border max-w-xl">
              <CardHeader>
                <CardTitle className="text-lg">Webhook Global</CardTitle>
                <CardDescription>
                  URL de callback para eventos desta subconta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <Input
                    value={settings?.global_webhook_url || ""}
                    readOnly
                    placeholder="Usando webhook global da agência"
                    className="bg-muted border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Configure nas Configurações Globais para alterar o webhook padrão.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="mt-6">
            <Card className="bg-card border-border max-w-xl">
              <CardHeader>
                <CardTitle className="text-lg">Privacidade</CardTitle>
                <CardDescription>
                  Configurações de privacidade e segurança
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Configurações de privacidade serão adicionadas em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
