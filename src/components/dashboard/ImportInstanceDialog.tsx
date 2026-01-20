import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Loader2, Smartphone, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useInstances, UazapiInstance } from "@/hooks/useInstances";
import { toast } from "sonner";

interface ImportInstanceDialogProps {
  subaccountId: string;
}

export function ImportInstanceDialog({ subaccountId }: ImportInstanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uazapiInstances, setUazapiInstances] = useState<UazapiInstance[]>([]);
  const { fetchUazapiInstances, importInstance, instances } = useInstances(subaccountId);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const data = await fetchUazapiInstances();
      setUazapiInstances(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadInstances();
    }
  };

  const handleImport = (uazapiInstance: UazapiInstance) => {
    importInstance.mutate(
      { uazapiInstance, subaccountId },
      {
        onSuccess: () => {
          // Remove from list after import
          setUazapiInstances((prev) =>
            prev.filter((i) => i.token !== uazapiInstance.token)
          );
        },
      }
    );
  };

  // Filter out already imported instances
  const importedTokens = new Set(instances.map((i) => i.uazapi_instance_token));
  const availableInstances = uazapiInstances.filter(
    (i) => !importedTokens.has(i.token)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-border">
          <Download className="h-4 w-4 mr-2" />
          Importar Existente
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            Importar Instância da UAZAPI
          </DialogTitle>
          <DialogDescription>
            Selecione uma instância existente para vincular a esta subconta
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadInstances}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : availableInstances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {uazapiInstances.length === 0
                ? "Nenhuma instância encontrada na UAZAPI"
                : "Todas as instâncias já foram importadas"}
            </div>
          ) : (
            <div className="space-y-3">
              {availableInstances.map((instance) => {
                const isConnected =
                  instance.status === "connected" ||
                  instance.status === "open" ||
                  instance.status === "authenticated";

                return (
                  <div
                    key={instance.token}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/10 rounded-lg">
                        <Smartphone className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {instance.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {instance.token.slice(0, 8)}...
                        </p>
                        {instance.phone && (
                          <p className="text-xs text-muted-foreground">
                            📱 {instance.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          isConnected
                            ? "bg-success"
                            : "bg-destructive"
                        }
                      >
                        {isConnected ? (
                          <Wifi className="h-3 w-3 mr-1" />
                        ) : (
                          <WifiOff className="h-3 w-3 mr-1" />
                        )}
                        {isConnected ? "Online" : "Offline"}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleImport(instance)}
                        disabled={importInstance.isPending}
                      >
                        {importInstance.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Vincular"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
