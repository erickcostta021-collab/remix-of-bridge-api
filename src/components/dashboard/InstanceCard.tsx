import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Smartphone, QrCode, Trash2, Settings2, Loader2, Wifi, WifiOff } from "lucide-react";
import { Instance, useInstances } from "@/hooks/useInstances";
import { toast } from "sonner";

interface InstanceCardProps {
  instance: Instance;
}

export function InstanceCard({ instance }: InstanceCardProps) {
  const { deleteInstance, getQRCode, updateInstanceWebhook } = useInstances();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(instance.webhook_url || "");
  const [ignoreGroups, setIgnoreGroups] = useState(instance.ignore_groups || false);

  const handleGetQRCode = async () => {
    setLoadingQR(true);
    try {
      const qr = await getQRCode(instance);
      setQrCode(qr);
      setQrDialogOpen(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingQR(false);
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

  const statusConfig = {
    connected: {
      label: "Conectado",
      variant: "default" as const,
      className: "bg-success",
      icon: Wifi,
    },
    connecting: {
      label: "Conectando",
      variant: "secondary" as const,
      className: "bg-warning animate-pulse-glow",
      icon: Wifi,
    },
    disconnected: {
      label: "Desconectado",
      variant: "destructive" as const,
      className: "",
      icon: WifiOff,
    },
  };

  const status = statusConfig[instance.instance_status];
  const StatusIcon = status.icon;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Smartphone className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-base text-card-foreground">
                {instance.instance_name}
              </CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {instance.uazapi_instance_token.slice(0, 8)}...
              </p>
            </div>
          </div>
          <Badge className={status.className}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          {/* QR Code Button */}
          <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetQRCode}
                disabled={loadingQR || instance.instance_status === "connected"}
                className="border-border"
              >
                {loadingQR ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                <span className="ml-1">QR Code</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-card-foreground">Conectar Instância</DialogTitle>
                <DialogDescription>
                  Escaneie o QR Code com seu WhatsApp para conectar
                </DialogDescription>
              </DialogHeader>
              {qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img
                    src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Webhook Config Button */}
          <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-border">
                <Settings2 className="h-4 w-4 mr-1" />
                Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-card-foreground">Configurar Webhook</DialogTitle>
                <DialogDescription>
                  Configure a URL do webhook para esta instância
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">URL do Webhook</Label>
                  <Input
                    id="webhook-url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://..."
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
              <div className="flex justify-end">
                <Button onClick={handleSaveWebhook} disabled={updateInstanceWebhook.isPending}>
                  {updateInstanceWebhook.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-card-foreground">Excluir Instância?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A instância será removida permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteInstance.mutate(instance)}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
