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
  phone?: string; // Fetched from UAZAPI at runtime
}

export interface UazapiInstance {
  token: string;
  name: string;
  status: string;
  phone?: string;
  webhook_url?: string;
}

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

  // Get status of a specific instance (returns status and phone)
  const getInstanceStatus = async (instanceToken: string): Promise<{ status: string; phone?: string }> => {
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
      const status = data.status || data.state || "disconnected";
      const phone = data.phone || data.number || data.jid?.split("@")?.[0] || "";
      return { status, phone };
    } catch {
      return { status: "disconnected" };
    }
  };

  // Sync status from UAZAPI
  const syncInstanceStatus = useMutation({
    mutationFn: async (instance: Instance): Promise<{ status: InstanceStatus; phone?: string }> => {
      const result = await getInstanceStatus(instance.uazapi_instance_token);
      
      let mappedStatus: InstanceStatus = "disconnected";
      if (result.status === "connected" || result.status === "open" || result.status === "authenticated") {
        mappedStatus = "connected";
      } else if (result.status === "connecting" || result.status === "qr" || result.status === "waiting") {
        mappedStatus = "connecting";
      }

      const { error } = await supabase
        .from("instances")
        .update({ instance_status: mappedStatus })
        .eq("id", instance.id);

      if (error) throw error;
      return { status: mappedStatus, phone: result.phone };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });

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
    },
    onError: (error) => {
      toast.error("Erro ao atualizar webhook: " + error.message);
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
    updateInstanceWebhook,
    fetchUazapiInstances,
  };
}