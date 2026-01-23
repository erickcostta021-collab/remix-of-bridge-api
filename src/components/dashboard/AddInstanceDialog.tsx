import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Loader2, RefreshCw, HelpCircle, User } from "lucide-react";
import { useInstances, UazapiInstance } from "@/hooks/useInstances";
import { useGHLUsers, GHLUser } from "@/hooks/useGHLUsers";
import { Subaccount } from "@/hooks/useSubaccounts";
import { toast } from "sonner";

interface AddInstanceDialogProps {
  subaccount: Subaccount;
}

type TabType = "create" | "import";

export function AddInstanceDialog({ subaccount }: AddInstanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("create");
  
  // Create state
  const [name, setName] = useState("");
  const [systemName, setSystemName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  
  // Import state
  const [uazapiInstances, setUazapiInstances] = useState<UazapiInstance[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<Set<string>>(new Set());
  const [loadingInstances, setLoadingInstances] = useState(false);
  
  // GHL Users state
  const [ghlUsers, setGhlUsers] = useState<GHLUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const { createInstance, importInstance, instances, fetchUazapiInstances } = useInstances(subaccount.id);
  const { fetchLocationUsers } = useGHLUsers();

  // Load GHL users when dialog opens
  useEffect(() => {
    if (open && subaccount.location_id) {
      loadGHLUsers();
    }
  }, [open, subaccount.location_id]);

  const loadGHLUsers = async () => {
    if (!subaccount.ghl_access_token) {
      console.warn("App não instalado na subconta via OAuth");
      return;
    }
    setLoadingUsers(true);
    try {
      const users = await fetchLocationUsers(subaccount.location_id, subaccount.ghl_access_token);
      setGhlUsers(users);
    } catch (error: any) {
      console.error("Error loading GHL users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadUazapiInstances = async () => {
    setLoadingInstances(true);
    try {
      const data = await fetchUazapiInstances();
      setUazapiInstances(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingInstances(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && activeTab === "import") {
      loadUazapiInstances();
    }
    if (!isOpen) {
      // Reset state
      setName("");
      setSystemName("");
      setSelectedUserId("");
      setSelectedInstances(new Set());
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "import" && uazapiInstances.length === 0) {
      loadUazapiInstances();
    }
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    
    createInstance.mutate(
      { name: name.trim(), subaccountId: subaccount.id },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setSystemName("");
          setSelectedUserId("");
        },
      }
    );
  };

  const handleImport = async () => {
    if (selectedInstances.size === 0) return;

    const instancesToImport = uazapiInstances.filter((i) =>
      selectedInstances.has(i.token)
    );

    for (const instance of instancesToImport) {
      await new Promise<void>((resolve) => {
        importInstance.mutate(
          { uazapiInstance: instance, subaccountId: subaccount.id },
          {
            onSuccess: () => {
              setSelectedInstances((prev) => {
                const next = new Set(prev);
                next.delete(instance.token);
                return next;
              });
              resolve();
            },
            onError: () => resolve(),
          }
        );
      });
    }

    if (selectedInstances.size === 0) {
      setOpen(false);
    }
  };

  const toggleInstanceSelection = (token: string) => {
    setSelectedInstances((prev) => {
      const next = new Set(prev);
      if (next.has(token)) {
        next.delete(token);
      } else {
        next.add(token);
      }
      return next;
    });
  };

  // Filter out already imported instances
  const importedTokens = new Set(instances.map((i) => i.uazapi_instance_token));
  const availableInstances = uazapiInstances.filter(
    (i) => !importedTokens.has(i.token)
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">
            Adicionar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Crie uma nova ou vincule uma existente.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "create"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleTabChange("create")}
          >
            Criar Nova
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "import"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => handleTabChange("import")}
          >
            Importar
          </button>
        </div>

        {/* Create Tab Content */}
        {activeTab === "create" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Nome da Instância</Label>
              <Input
                id="instance-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: [CJ][01]"
                className="bg-secondary border-border"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="system-name">System Name</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-xs">
                      Nome interno usado para identificação no sistema.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="system-name"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder={name || "Nome interno"}
                className="bg-secondary border-border"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <Label>Usuário GHL (Opcional)</Label>
              </div>
              <Select
                value={selectedUserId}
                onValueChange={setSelectedUserId}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Nenhum usuário" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="none">Nenhum usuário</SelectItem>
                  {!subaccount.ghl_access_token ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      App não instalado na subconta
                    </div>
                  ) : loadingUsers ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : ghlUsers.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      Nenhum usuário encontrado
                    </div>
                  ) : (
                    ghlUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleCreate}
              disabled={!name.trim() || createInstance.isPending}
            >
              {createInstance.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Plus className="h-4 w-4 mr-2" />
              Criar Instância
            </Button>
          </div>
        )}

        {/* Import Tab Content */}
        {activeTab === "import" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Instâncias no Servidor
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadUazapiInstances}
                disabled={loadingInstances}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${loadingInstances ? "animate-spin" : ""}`}
                />
                Atualizar
              </Button>
            </div>

            <ScrollArea className="h-[280px] pr-2">
              {loadingInstances ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : availableInstances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {uazapiInstances.length === 0
                    ? "Nenhuma instância encontrada no servidor"
                    : "Todas as instâncias já foram importadas"}
                </div>
              ) : (
                <div className="space-y-2">
                  {availableInstances.map((instance) => (
                    <div
                      key={instance.token}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedInstances.has(instance.token)
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground bg-secondary/50"
                      }`}
                      onClick={() => toggleInstanceSelection(instance.token)}
                    >
                      <Checkbox
                        checked={selectedInstances.has(instance.token)}
                        onCheckedChange={() =>
                          toggleInstanceSelection(instance.token)
                        }
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {instance.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {instance.token}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Button
              className="w-full bg-primary/80 hover:bg-primary"
              onClick={handleImport}
              disabled={selectedInstances.size === 0 || importInstance.isPending}
            >
              {importInstance.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Plus className="h-4 w-4 mr-2" />
              Vincular Instâncias
              {selectedInstances.size > 0 && ` (${selectedInstances.size})`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
