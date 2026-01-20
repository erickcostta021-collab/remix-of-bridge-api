import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Smartphone, 
  QrCode, 
  Trash2, 
  Settings2, 
  Loader2, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  MoreVertical,
  Unlink,
  Power,
  Copy
} from "lucide-react";
import { Instance, useInstances } from "@/hooks/useInstances";
import { toast } from "sonner";

interface InstanceCardProps {
  instance: Instance;
}

export function InstanceCard({ instance }: InstanceCardProps) {
  const { 
    deleteInstance, 
    getQRCode, 
    updateInstanceWebhook, 
    syncInstanceStatus,
    connectInstance,
    disconnectInstance 
  } = useInstances();
  
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteFromUazapi, setDeleteFromUazapi] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(instance.webhook_url || "");
  const [ignoreGroups, setIgnoreGroups] = useState(instance.ignore_groups || false);
  const [syncing, setSyncing] = useState(false);

  const handleConnect = async () => {
    setLoadingQR(true);
    try {
      await connectInstance(instance);
      const qr = await getQRCode(instance);
      setQrCode(qr);
      setQrDialogOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingQR(false);
    }
  };

  const handleSyncStatus = async () => {
    setSyncing(true);
    try {
      await syncInstanceStatus.mutateAsync(instance);
      toast.success("Status atualizado!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveWebhook = () => {
    updateInstanceWebhook.mutate({
      instance,
      webhookUrl,
      ignoreGroups,
    });
    setWebhookDialogOpen(false);
  };

  const handleDelete = () => {
    deleteInstance.mutate({ instance, deleteFromUazapi });
    setDeleteDialogOpen(false);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(instance.uazapi_instance_token);
    toast.success("Token copiado!");
  };

  const statusConfig = {
    connected: {
      label: "Conectado",
      className: "bg-success text-success-foreground",
      icon: Wifi,
    },
    connecting: {
      label: "Conectando",
      className: "bg-warning text-warning-foreground animate-pulse",
      icon: Wifi,
    },
    disconnected: {
      label: "Desconectado",
      className: "bg-muted text-muted-foreground",
      icon: WifiOff,
    },
  };

  const status = statusConfig[instance.instance_status];
  const StatusIcon = status.icon;
  const isConnected = instance.instance_status === "connected";

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/30 transition-all group">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 rounded-xl">
                <Smartphone className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-card-foreground text-lg">
                  {instance.instance_name}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {instance.uazapi_instance_token.slice(0, 12)}...
                </p>
              </div>
            </div>
            <Badge className={status.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>

          {/* QR Code Area */}
          {!isConnected && (
            <div 
              className="flex flex-col items-center justify-center py-6 mb-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={handleConnect}
            >
              {loadingQR ? (
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <QrCode className="h-12 w-12 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Clique para conectar
                  </span>
                </>
              )}
            </div>
          )}

          {isConnected && (
            <div className="flex items-center justify-center py-4 mb-4 bg-success/10 rounded-xl">
              <Wifi className="h-6 w-6 text-success mr-2" />
              <span className="text-success font-medium">WhatsApp Conectado</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncStatus}
              disabled={syncing}
              className="flex-1 border-border"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Status
            </Button>

            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectInstance.mutate(instance)}
                disabled={disconnectInstance.isPending}
                className="flex-1 border-border text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Power className="h-4 w-4 mr-1" />
                Desconectar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={loadingQR}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <QrCode className="h-4 w-4 mr-1" />
                Conectar
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={copyToken}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Token
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWebhookDialogOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Configurar Webhook
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    setDeleteFromUazapi(false);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-warning"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  Desvincular
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    setDeleteFromUazapi(true);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Permanentemente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          {qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-xl">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Abra o WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
              </p>
              <Button onClick={handleConnect} variant="outline" className="border-border">
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar Novo QR Code
              </Button>
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Webhook Dialog */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Configurar Webhook</DialogTitle>
            <DialogDescription>
              Configure a URL do webhook para receber mensagens
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL do Webhook</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://seu-webhook.com/endpoint"
                className="bg-secondary border-border"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="ignore-groups">Ignorar mensagens de grupos</Label>
              <Switch
                id="ignore-groups"
                checked={ignoreGroups}
                onCheckedChange={setIgnoreGroups}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWebhookDialogOpen(false)} className="border-border">
              Cancelar
            </Button>
            <Button onClick={handleSaveWebhook} disabled={updateInstanceWebhook.isPending}>
              {updateInstanceWebhook.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-card-foreground">
              {deleteFromUazapi ? "Excluir Permanentemente?" : "Desvincular Instância?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFromUazapi 
                ? "Esta ação vai excluir a instância da UAZAPI e do sistema. A conexão com o WhatsApp será perdida permanentemente."
                : "A instância será removida do sistema mas continuará existindo na UAZAPI. Você poderá importá-la novamente depois."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={deleteFromUazapi ? "bg-destructive hover:bg-destructive/90" : "bg-warning hover:bg-warning/90"}
            >
              {deleteFromUazapi ? "Excluir" : "Desvincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
