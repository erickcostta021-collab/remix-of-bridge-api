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

  const createInstance = useMutation({
    mutationFn: async ({ name, subaccountId }: { name: string; subaccountId: string }) => {
      if (!user || !settings?.uazapi_admin_token || !settings?.uazapi_base_url) {
        throw new Error("Configurações UAZAPI não encontradas");
      }

      // Create instance in UAZAPI
      const response = await fetch(`${settings.uazapi_base_url}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "admin_token": settings.uazapi_admin_token,
        },
        body: JSON.stringify({
          name,
          webhook_url: settings.global_webhook_url || "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao criar instância na UAZAPI");
      }

      const uazapiData = await response.json();

      // Save to database
      const { data, error } = await supabase
        .from("instances")
        .insert({
          user_id: user.id,
          subaccount_id: subaccountId,
          instance_name: name,
          uazapi_instance_token: uazapiData.token || uazapiData.instance_token,
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
    mutationFn: async (instance: Instance) => {
      if (!settings?.uazapi_admin_token || !settings?.uazapi_base_url) {
        throw new Error("Configurações UAZAPI não encontradas");
      }

      // Delete from UAZAPI
      await fetch(`${settings.uazapi_base_url}/instance/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "admin_token": settings.uazapi_admin_token,
        },
        body: JSON.stringify({
          token: instance.uazapi_instance_token,
        }),
      });

      // Delete from database
      const { error } = await supabase
        .from("instances")
        .delete()
        .eq("id", instance.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Instância excluída!");
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": instance.uazapi_instance_token,
      },
    });

    if (!response.ok) {
      throw new Error("Erro ao obter QR Code");
    }

    const data = await response.json();
    return data.qrcode || data.base64 || data.qr;
  };

  const updateInstanceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InstanceStatus }) => {
      const { error } = await supabase
        .from("instances")
        .update({ instance_status: status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
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
    getQRCode,
    updateInstanceStatus,
    updateInstanceWebhook,
  };
}
