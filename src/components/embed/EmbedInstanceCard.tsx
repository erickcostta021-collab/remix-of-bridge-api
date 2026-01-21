import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Smartphone, 
  QrCode, 
  Loader2, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  MoreVertical,
  Power,
  Phone,
  UserPlus,
  User
} from "lucide-react";
import { toast } from "sonner";
import { EmbedAssignUserDialog } from "./EmbedAssignUserDialog";

export interface EmbedInstance {
  id: string;
  instance_name: string;
  instance_status: "connected" | "connecting" | "disconnected";
  uazapi_instance_token: string;
  phone?: string | null;
  profile_pic_url?: string | null;
  ghl_user_id?: string | null;
}

interface EmbedInstanceCardProps {
  instance: EmbedInstance;
  subaccountId: string;
  embedToken: string;
  locationId: string;
  ghlSubaccountToken: string | null;
  uazapiBaseUrl: string;
  uazapiAdminToken: string;
  onStatusChange?: () => void;
}

export function EmbedInstanceCard({ 
  instance, 
  subaccountId,
  embedToken,
  locationId,
  ghlSubaccountToken,
  uazapiBaseUrl,
  uazapiAdminToken,
  onStatusChange 
}: EmbedInstanceCardProps) {
  const [syncing, setSyncing] = useState(false);
  // Use cached values from DB as initial state
  const [connectedPhone, setConnectedPhone] = useState<string | null>(instance.phone || null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(instance.profile_pic_url || null);
  const [currentStatus, setCurrentStatus] = useState(instance.instance_status);
  const [ghlUserName, setGhlUserName] = useState<string | null>(null);
  const [assignUserDialogOpen, setAssignUserDialogOpen] = useState(false);
  const [currentGhlUserId, setCurrentGhlUserId] = useState(instance.ghl_user_id);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  const fetchInstanceStatus = async () => {
    try {
      const base = uazapiBaseUrl.replace(/\/$/, "");
      const candidatePaths = [
        "/instance/status",
        "/api/instance/status",
        "/v2/instance/status",
        "/api/v2/instance/status",
      ];

      let response: Response | null = null;
      for (const path of candidatePaths) {
        const url = `${base}${path}`;
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // A UAZAPI costuma esperar o token da instância neste header (não Bearer)
            token: instance.uazapi_instance_token,
          },
        });
        if (r.status === 404) continue;
        response = r;
        break;
      }

      if (!response || !response.ok) return null;

      const data = await response.json();
      
      // Extract status with multiple fallbacks - check nested structures
      // UAZAPI returns: instance.status or status.connected
      const rawStatus = data.instance?.status 
        || data.instance?.connectionState 
        || data.instance?.state
        || (data.status?.connected ? "connected" : null)
        || data.status 
        || data.state 
        || data.connection 
        || data.connectionState
        || "disconnected";
      
      // Extract phone number with multiple fallbacks - check nested structures
      // UAZAPI returns: instance.owner or status.jid
      const phone = data.instance?.owner
        || data.instance?.phoneNumber 
        || data.instance?.phone 
        || data.instance?.number
        || data.instance?.wid?.user
        || data.status?.jid?.split("@")?.[0]?.split(":")?.[0]
        || data.phone 
        || data.phoneNumber 
        || data.number 
        || data.wid?.user
        || data.jid?.split("@")?.[0]
        || data.instance?.jid?.split("@")?.[0]
        || "";
      
      // Extract profile picture with multiple fallbacks - check nested structures
      // UAZAPI returns: instance.profilePicUrl
      const pic = data.instance?.profilePicUrl
        || data.instance?.profilePic
        || data.instance?.picture
        || data.instance?.imgUrl
        || data.profilePicUrl
        || data.profilePic
        || data.picture
        || data.imgUrl
        || "";
      
      return {
        status: mapUazapiStatus(rawStatus),
        phone,
        profilePicUrl: pic,
      };
    } catch (error) {
      console.error("[EmbedInstanceCard] Error fetching status:", error);
      return null;
    }
  };

  const mapUazapiStatus = (uazapiStatus: string): "connected" | "connecting" | "disconnected" => {
    const statusMap: Record<string, "connected" | "connecting" | "disconnected"> = {
      "CONNECTED": "connected",
      "connected": "connected",
      "open": "connected",
      "CONNECTING": "connecting",
      "connecting": "connecting",
      "DISCONNECTED": "disconnected",
      "disconnected": "disconnected",
      "close": "disconnected",
      "closed": "disconnected",
    };
    return statusMap[uazapiStatus] || "disconnected";
  };

  // Fetch GHL user name on mount
  useEffect(() => {
    const fetchGhlUserName = async () => {
      if (currentGhlUserId && ghlSubaccountToken && locationId) {
        try {
          const response = await fetch(
            `https://services.leadconnectorhq.com/users/?locationId=${locationId}`,
            {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${ghlSubaccountToken}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const user = data.users?.find((u: any) => u.id === currentGhlUserId);
            if (user) {
              setGhlUserName(user.name);
            }
          }
        } catch (error) {
          console.error("Failed to fetch GHL user name:", error);
        }
      }
    };

    fetchGhlUserName();
  }, [currentGhlUserId, ghlSubaccountToken, locationId]);

  useEffect(() => {
    // Only fetch from UAZAPI if we don't have cached data
    if (!instance.phone || !instance.profile_pic_url) {
      fetchInstanceStatus().then((result) => {
        if (result) {
          if (result.phone) setConnectedPhone(result.phone);
          if (result.profilePicUrl) setProfilePicUrl(result.profilePicUrl);
          setCurrentStatus(result.status);
          // Save to DB cache via update
          updateInstanceCache(result.phone, result.profilePicUrl);
        }
      });
    }
  }, [instance.uazapi_instance_token]);

  // Helper to save phone/pic to DB cache
  const updateInstanceCache = async (phone?: string, picUrl?: string) => {
    if (!phone && !picUrl) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const updateData: Record<string, string> = {};
      if (phone) updateData.phone = phone;
      if (picUrl) updateData.profile_pic_url = picUrl;
      
      await supabase
        .from("instances")
        .update(updateData)
        .eq("id", instance.id);
    } catch (e) {
      console.error("Failed to cache instance data:", e);
    }
  };

  const handleSyncStatus = async () => {
    setSyncing(true);
    try {
      const result = await fetchInstanceStatus();
      if (result) {
        if (result.phone) setConnectedPhone(result.phone);
        if (result.profilePicUrl) setProfilePicUrl(result.profilePicUrl);
        setCurrentStatus(result.status);
        // Update cache in DB
        await updateInstanceCache(result.phone, result.profilePicUrl);
        toast.success("Status atualizado!");
        onStatusChange?.();
      }
    } catch {
      toast.error("Erro ao atualizar status");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const response = await fetch(`${uazapiBaseUrl.replace(/\/$/, "")}/instance/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: instance.uazapi_instance_token,
        },
      });

      if (response.ok) {
        setCurrentStatus("disconnected");
        setConnectedPhone(null);
        setProfilePicUrl(null);
        toast.success("Desconectado com sucesso!");
        onStatusChange?.();
      } else {
        throw new Error("Falha ao desconectar");
      }
    } catch {
      toast.error("Erro ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const base = uazapiBaseUrl.replace(/\/$/, "");
      // Primeira tentativa: connect (padrão mais comum)
      await fetch(`${base}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: instance.uazapi_instance_token,
        },
      });

      // Then get QR code
      const response = await fetch(`${base}/instance/qrcode`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          token: instance.uazapi_instance_token,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const qr = data.qrcode || data.qr || data.base64;
        if (qr) {
          setQrCode(qr);
          setQrDialogOpen(true);
        } else {
          throw new Error("QR Code não disponível");
        }
      } else {
        throw new Error("Erro ao obter QR Code");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar");
    } finally {
      setConnecting(false);
    }
  };

  const handleUserAssigned = (userId: string | null, userName: string | null) => {
    setCurrentGhlUserId(userId);
    setGhlUserName(userName);
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
      className: "bg-muted/50 text-muted-foreground border-muted",
      icon: WifiOff,
    },
  };

  const status = statusConfig[currentStatus];
  const StatusIcon = status.icon;
  const isConnected = currentStatus === "connected";

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/40 transition-all duration-300 group overflow-hidden">
        <CardContent className="p-0">
          {/* Header Section */}
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Profile Picture or Default Icon */}
                {profilePicUrl ? (
                  <Avatar className="h-11 w-11 shrink-0 border-2 border-primary/20">
                    <AvatarImage src={profilePicUrl} alt="WhatsApp Profile" />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="p-2.5 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl shrink-0">
                    <Smartphone className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-card-foreground truncate">
                      {instance.instance_name}
                    </h3>
                    <Badge variant="outline" className={`${status.className} shrink-0`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                  
                  {/* Phone number */}
                  {connectedPhone ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-sm text-emerald-400 font-medium">
                        {formatPhoneNumber(connectedPhone)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Número não disponível
                    </p>
                  )}
                  
                  {/* GHL User */}
                  {currentGhlUserId && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {ghlUserName || currentGhlUserId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem onClick={() => setAssignUserDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Atribuir Usuário GHL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Status Section */}
          {isConnected ? (
            <div className="mx-4 mb-3 flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <Wifi className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-sm">WhatsApp Conectado</span>
            </div>
          ) : (
            <div 
              className="mx-4 mb-3 flex flex-col items-center justify-center py-5 border border-dashed border-border/70 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={handleConnect}
            >
              {connecting ? (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <QrCode className="h-10 w-10 text-muted-foreground mb-1.5" />
                  <span className="text-sm text-muted-foreground">
                    Clique para conectar
                  </span>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncStatus}
              disabled={syncing}
              className="w-full border-border/50 h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              Status
            </Button>

            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400 h-9"
              >
                <Power className="h-3.5 w-3.5 mr-1.5" />
                Desconectar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full bg-primary hover:bg-primary/90 h-9"
              >
                <QrCode className="h-3.5 w-3.5 mr-1.5" />
                Conectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      {qrDialogOpen && qrCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQrDialogOpen(false)}>
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-card-foreground mb-4">Conectar WhatsApp</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-xl">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Abra o WhatsApp → Menu → Dispositivos conectados → Conectar dispositivo
              </p>
              <Button onClick={() => setQrDialogOpen(false)} variant="outline" className="border-border">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign User Dialog */}
      <EmbedAssignUserDialog
        open={assignUserDialogOpen}
        onOpenChange={setAssignUserDialogOpen}
        instanceId={instance.id}
        instanceName={instance.instance_name}
        currentUserId={currentGhlUserId || null}
        embedToken={embedToken}
        locationId={locationId}
        ghlSubaccountToken={ghlSubaccountToken}
        onAssigned={handleUserAssigned}
      />
    </>
  );
}
