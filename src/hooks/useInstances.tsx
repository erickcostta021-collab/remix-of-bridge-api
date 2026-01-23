import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useSettings } from "./useSettings";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type InstanceStatus = Database["public"]["Enums"]["instance_status"];

export interface Instance {
  id: string;
  user_id: string;
  subaccount_id: string;
  instance_name: string;
  uazapi_instance_token: string;
  instance_status: InstanceStatus;
  webhook_url: string | null;
  ignore_groups: boolean | null;
  ghl_user_id: string | null;
  phone: string | null; // Cached in DB
  profile_pic_url: string | null; // Cached in DB
}

export interface UazapiInstance {
  token: string;
  name: string;
  status: string;
  phone?: string;
  webhook_url?: string;
}

// Helper function to sync with external Supabase
const syncToExternalSupabase = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Check if external Supabase PAT is configured
    const { data: settings } = await supabase
      .from("user_settings")
      .select("external_supabase_pat")
      .eq("user_id", session.user.id)
      .single();

    if (!settings?.external_supabase_pat) {
      return; // External Supabase PAT not configured, skip sync
    }

    // Call sync function
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-external-supabase`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Auto-sync to external Supabase failed:", error);
  }
};

export function useInstances(subaccountId?: string) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const queryClient = useQueryClient();

  const { data: instances, isLoading } = useQuery({
    queryKey: ["instances", user?.id, subaccountId],
    queryFn: async () => {
      if (!user) return [];
      let query = supabase
        .from("instances")
        .select("*")
        .eq("user_id", user.id);

      if (subaccountId) {
        query = query.eq("subaccount_id", subaccountId);
      }

      const { data, error } = await query.order("instance_name");
      if (error) throw error;
      return data as Instance[];
    },
    enabled: !!user,
  });

  // Fetch all instances from UAZAPI
  const fetchUazapiInstances = async (): Promise<UazapiInstance[]> => {
    if (!settings?.uazapi_admin_token || !settings?.uazapi_base_url) {
      throw new Error("Configurações UAZAPI não encontradas");
    }

    const base = settings.uazapi_base_url.replace(/\/$/, "");
    // Per UAZAPI docs: GET /instance/all for listing all instances
    const candidatePaths = [
      "/instance/all",
      "/api/instance/all",
    ];

    let response: Response | null = null;
    for (const path of candidatePaths) {
      const url = `${base}${path}`;
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          admintoken: settings.uazapi_admin_token,
        },
      });

      // If endpoint doesn't exist on this server, try the next candidate.
      if (r.status === 404) continue;

      response = r;
      break;
    }

    if (!response) {
      throw new Error(
        "Não encontrei um endpoint válido para listar instâncias (tente conferir se a API está usando o prefixo /api)."
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro ${response.status} ao buscar instâncias`);
    }

    const data = await response.json();
    
    // Handle different response formats
    const instancesArray = Array.isArray(data) ? data : (data.instances || data.data || []);
    
    return instancesArray.map((inst: any) => ({
      token: inst.token || inst.instanceToken || inst.instance_token || "",
      name: inst.name || inst.instanceName || inst.instance_name || "Sem nome",
      status: inst.status || inst.state || "disconnected",
      phone: inst.phone || inst.number || "",
      webhook_url: inst.webhook_url || inst.webhookUrl || "",
    }));
  };

  // Get status of a specific instance (returns status, phone and profile pic)
  const getInstanceStatus = async (instanceToken: string): Promise<{ status: string; phone?: string; profilePicUrl?: string }> => {
    if (!settings?.uazapi_base_url) {
      throw new Error("URL base da UAZAPI não configurada");
    }

    try {
      const base = settings.uazapi_base_url.replace(/\/$/, "");
      const candidatePaths = ["/instance/status", "/api/instance/status", "/v2/instance/status", "/api/v2/instance/status"];

      let response: Response | null = null;
      for (const path of candidatePaths) {
        const url = `${base}${path}`;
        // eslint-disable-next-line no-await-in-loop
        const r = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            token: instanceToken,
          },
        });
        if (r.status === 404) continue;
        response = r;
        break;
      }

      if (!response) return { status: "disconnected" };

      if (!response.ok) {
        return { status: "disconnected" };
      }

      const data = await response.json();
      
      // Handle nested structure: { instance: {...}, status: { connected: true, jid: "..." } }
      let status = "disconnected";
      let phone = "";
      let profilePicUrl = "";
      
      // Check nested status object first
      if (data.status?.connected === true || data.status?.loggedIn === true) {
        status = "connected";
      } else if (data.instance?.status) {
        status = data.instance.status;
      } else if (data.status && typeof data.status === 'string') {
        status = data.status;
      } else if (data.state) {
        status = data.state;
      }
      
      // Extract phone from various possible locations
      phone = data.instance?.owner 
        || data.status?.jid?.split("@")?.[0]
        || data.phone 
        || data.number 
        || data.jid?.split("@")?.[0] 
        || "";
      
      // Extract profile picture URL
      profilePicUrl = data.instance?.profilePicUrl
        || data.profilePicUrl
        || data.profilePic
        || data.picture
        || data.imgUrl
        || "";
      
      return { status, phone, profilePicUrl };
    } catch {
      return { status: "disconnected", profilePicUrl: "" };
    }
  };

  // Sync status from UAZAPI and save to DB cache
  const syncInstanceStatus = useMutation({
    mutationFn: async (instance: Instance): Promise<{ status: InstanceStatus; phone?: string; profilePicUrl?: string }> => {
      const result = await getInstanceStatus(instance.uazapi_instance_token);
      
      let mappedStatus: InstanceStatus = "disconnected";
      if (result.status === "connected" || result.status === "open" || result.status === "authenticated") {
        mappedStatus = "connected";
      } else if (result.status === "connecting" || result.status === "qr" || result.status === "waiting") {
        mappedStatus = "connecting";
      }

      // Update status AND cache phone/profile_pic_url in DB
      const updateData: Record<string, unknown> = { instance_status: mappedStatus };
      if (result.phone) updateData.phone = result.phone;
      if (result.profilePicUrl) updateData.profile_pic_url = result.profilePicUrl;

      const { error } = await supabase
        .from("instances")
        .update(updateData)
        .eq("id", instance.id);

      if (error) throw error;
      return { status: mappedStatus, phone: result.phone, profilePicUrl: result.profilePicUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      // Auto-sync to external Supabase
      syncToExternalSupabase();
    },
  });

  // Sync ALL instances status from UAZAPI
  const syncAllInstancesStatus = useMutation({
    mutationFn: async (): Promise<{ successful: number; failed: number; notFound: string[]; total: number }> => {
      if (!instances || instances.length === 0) {
        throw new Error("Nenhuma instância para atualizar");
      }

      const notFoundInstances: string[] = [];

      const results = await Promise.allSettled(
        instances.map(async (instance) => {
          const result = await getInstanceStatus(instance.uazapi_instance_token);
          
          // Check if instance doesn't exist on UAZAPI server
          // When token is invalid/not found, UAZAPI typically returns disconnected with no phone
          // We also check if the instance responds at all
          const instanceExists = await checkInstanceExists(instance.uazapi_instance_token);
          
          if (!instanceExists) {
            notFoundInstances.push(instance.id);
            return { id: instance.id, status: "not_found" as const };
          }
          
          let mappedStatus: InstanceStatus = "disconnected";
          if (result.status === "connected" || result.status === "open" || result.status === "authenticated") {
            mappedStatus = "connected";
          } else if (result.status === "connecting" || result.status === "qr" || result.status === "waiting") {
            mappedStatus = "connecting";
          }

          const updateData: Record<string, unknown> = { instance_status: mappedStatus };
          if (result.phone) updateData.phone = result.phone;
          if (result.profilePicUrl) updateData.profile_pic_url = result.profilePicUrl;

          await supabase
            .from("instances")
            .update(updateData)
            .eq("id", instance.id);

          return { id: instance.id, status: mappedStatus };
        })
      );

      const successful = results.filter(r => r.status === "fulfilled" && (r.value as any).status !== "not_found").length;
      const failed = results.filter(r => r.status === "rejected").length;

      return { successful, failed, notFound: notFoundInstances, total: instances.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      syncToExternalSupabase();
      
      if (data.notFound.length > 0) {
        toast.warning(`${data.notFound.length} instância(s) não encontrada(s) no servidor UAZAPI`, {
          description: "Clique em 'Limpar' para removê-las",
          action: {
            label: "Limpar",
            onClick: () => {
              data.notFound.forEach(async (id) => {
                await supabase.from("instances").delete().eq("id", id);
              });
              queryClient.invalidateQueries({ queryKey: ["instances"] });
              toast.success("Instâncias inexistentes removidas!");
            },
          },
          duration: 10000,
        });
      } else if (data.failed > 0) {
        toast.success(`${data.successful} instâncias atualizadas, ${data.failed} falharam`);
      } else {
        toast.success(`${data.successful} instâncias atualizadas com sucesso!`);
      }
    },
    onError: (error) => {
      toast.error("Erro ao atualizar instâncias: " + error.message);
    },
  });

  // Check if instance exists on UAZAPI server
  const checkInstanceExists = async (instanceToken: string): Promise<boolean> => {
    if (!settings?.uazapi_base_url) return false;

    try {
      const base = settings.uazapi_base_url.replace(/\/$/, "");
      
      // Try to get instance info - if it doesn't exist, we'll get an error
      const response = await fetch(`${base}/instance/status`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          token: instanceToken,
        },
      });

      // 401/403/404 means instance doesn't exist or token is invalid
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return false;
      }

      const data = await response.json();
      
      // Check for error responses that indicate instance doesn't exist
      if (data.error === true || data.message?.toLowerCase().includes("not found") || 
          data.message?.toLowerCase().includes("invalid") || data.message?.toLowerCase().includes("não encontrad")) {
        return false;
      }

      return true;
    } catch {
      // Network error or other issue - assume exists to be safe
      return true;
    }
  };

  // Import existing instance from UAZAPI
  const importInstance = useMutation({
    mutationFn: async ({ 
      uazapiInstance, 
      subaccountId 
    }: { 
      uazapiInstance: UazapiInstance; 
      subaccountId: string;
    }) => {
      if (!user) throw new Error("Não autenticado");

      // Check if already imported
      const { data: existing } = await supabase
        .from("instances")
        .select("id")
        .eq("uazapi_instance_token", uazapiInstance.token)
        .maybeSingle();

      if (existing) {
        throw new Error("Esta instância já foi importada");
      }

      let mappedStatus: InstanceStatus = "disconnected";
      if (uazapiInstance.status === "connected" || uazapiInstance.status === "open") {
        mappedStatus = "connected";
      } else if (uazapiInstance.status === "connecting" || uazapiInstance.status === "qr") {
        mappedStatus = "connecting";
      }

      const { data, error } = await supabase
        .from("instances")
        .insert({
          user_id: user.id,
          subaccount_id: subaccountId,
          instance_name: uazapiInstance.name,
          uazapi_instance_token: uazapiInstance.token,
          instance_status: mappedStatus,
          webhook_url: uazapiInstance.webhook_url || settings?.global_webhook_url || null,
          ignore_groups: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Instância importada com sucesso!");
      // Auto-sync to external Supabase
      syncToExternalSupabase();
    },
    onError: (error) => {
      toast.error("Erro ao importar: " + error.message);
    },
  });

  const createInstance = useMutation({
    mutationFn: async ({ name, subaccountId }: { name: string; subaccountId: string }) => {
      if (!user || !settings?.uazapi_admin_token || !settings?.uazapi_base_url) {
        throw new Error("Configurações UAZAPI não encontradas");
      }

      const base = settings.uazapi_base_url.replace(/\/$/, "");
      
      // Per UAZAPI docs: POST /instance/init to create instance
      const response = await fetch(`${base}/instance/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admintoken": settings.uazapi_admin_token,
        },
        body: JSON.stringify({
          name,
          systemName: "lovable-ghl-bridge",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Erro ao criar instância na UAZAPI");
      }

      const uazapiData = await response.json();
      const instanceToken = uazapiData.token || uazapiData.instance_token || uazapiData.instanceToken;

      if (!instanceToken) {
        throw new Error("Token da instância não retornado pela API");
      }

      // Save to database
      const { data, error } = await supabase
        .from("instances")
        .insert({
          user_id: user.id,
          subaccount_id: subaccountId,
          instance_name: name,
          uazapi_instance_token: instanceToken,
          instance_status: "disconnected" as InstanceStatus,
          webhook_url: settings.global_webhook_url,
          ignore_groups: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Instância criada com sucesso!");
      // Auto-sync to external Supabase
      syncToExternalSupabase();
    },
    onError: (error) => {
      toast.error("Erro ao criar instância: " + error.message);
    },
  });

  const deleteInstance = useMutation({
    mutationFn: async ({ instance, deleteFromUazapi = false }: { instance: Instance; deleteFromUazapi?: boolean }) => {
      if (deleteFromUazapi) {
        if (!settings?.uazapi_admin_token || !settings?.uazapi_base_url) {
          throw new Error("Configurações UAZAPI não encontradas");
        }

        // Delete from UAZAPI
        const response = await fetch(`${settings.uazapi_base_url}/instance/delete`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "admintoken": settings.uazapi_admin_token,
            "token": instance.uazapi_instance_token,
          },
        });

        // Try alternative method if first fails
        if (!response.ok) {
          await fetch(`${settings.uazapi_base_url}/admin/delete`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "admintoken": settings.uazapi_admin_token,
            },
            body: JSON.stringify({ token: instance.uazapi_instance_token }),
          });
        }
      }

      // Delete from database
      const { error } = await supabase
        .from("instances")
        .delete()
        .eq("id", instance.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success(variables.deleteFromUazapi 
        ? "Instância excluída do sistema e da UAZAPI!" 
        : "Instância removida do sistema!");
      // Auto-sync to external Supabase
      syncToExternalSupabase();
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const getQRCode = async (instance: Instance) => {
    if (!settings?.uazapi_base_url) {
      throw new Error("URL base da UAZAPI não configurada");
    }

    const response = await fetch(`${settings.uazapi_base_url}/instance/qrcode`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "token": instance.uazapi_instance_token,
      },
    });

    if (!response.ok) {
      throw new Error("Erro ao obter QR Code - verifique se a instância existe");
    }

    const data = await response.json();
    return data.qrcode || data.base64 || data.qr || data.code;
  };

  const connectInstance = async (instance: Instance) => {
    if (!settings?.uazapi_base_url) {
      throw new Error("URL base da UAZAPI não configurada");
    }

    // First try to connect/initialize the instance
    await fetch(`${settings.uazapi_base_url}/instance/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": instance.uazapi_instance_token,
      },
    });

    // Update status to connecting
    await supabase
      .from("instances")
      .update({ instance_status: "connecting" })
      .eq("id", instance.id);

    queryClient.invalidateQueries({ queryKey: ["instances"] });
  };

  const disconnectInstance = useMutation({
    mutationFn: async (instance: Instance) => {
      if (!settings?.uazapi_base_url) {
        throw new Error("URL base da UAZAPI não configurada");
      }

      await fetch(`${settings.uazapi_base_url}/instance/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": instance.uazapi_instance_token,
        },
      });

      const { error } = await supabase
        .from("instances")
        .update({ instance_status: "disconnected" })
        .eq("id", instance.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Instância desconectada!");
      // Auto-sync to external Supabase
      syncToExternalSupabase();
    },
    onError: (error) => {
      toast.error("Erro ao desconectar: " + error.message);
    },
  });

  const updateInstanceWebhook = useMutation({
    mutationFn: async ({ instance, webhookUrl, ignoreGroups }: { 
      instance: Instance; 
      webhookUrl: string; 
      ignoreGroups: boolean 
    }) => {
      if (!settings?.uazapi_base_url) {
        throw new Error("URL base da UAZAPI não configurada");
      }

      // Update in UAZAPI
      await fetch(`${settings.uazapi_base_url}/instance/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": instance.uazapi_instance_token,
        },
        body: JSON.stringify({
          webhook_url: webhookUrl,
          ignore_groups: ignoreGroups,
        }),
      });

      // Update in database
      const { error } = await supabase
        .from("instances")
        .update({ webhook_url: webhookUrl, ignore_groups: ignoreGroups })
        .eq("id", instance.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Webhook atualizado!");
      // Auto-sync to external Supabase
      syncToExternalSupabase();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar webhook: " + error.message);
    },
  });

  const updateInstanceGHLUser = useMutation({
    mutationFn: async ({ instanceId, ghlUserId }: { 
      instanceId: string; 
      ghlUserId: string | null;
    }) => {
      const { error } = await supabase
        .from("instances")
        .update({ ghl_user_id: ghlUserId })
        .eq("id", instanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Usuário GHL atribuído com sucesso!");
      // Auto-sync to external Supabase
      syncToExternalSupabase();
    },
    onError: (error) => {
      toast.error("Erro ao atribuir usuário: " + error.message);
    },
  });

  return {
    instances: instances || [],
    isLoading,
    createInstance,
    deleteInstance,
    importInstance,
    getQRCode,
    connectInstance,
    disconnectInstance,
    syncInstanceStatus,
    syncAllInstancesStatus,
    updateInstanceWebhook,
    updateInstanceGHLUser,
    fetchUazapiInstances,
  };
}