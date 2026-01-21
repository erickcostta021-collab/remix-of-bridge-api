import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface UserSettings {
  id: string;
  user_id: string;
  ghl_agency_token: string | null;
  uazapi_admin_token: string | null;
  uazapi_base_url: string | null;
  global_webhook_url: string | null;
  external_supabase_url: string | null;
  external_supabase_key: string | null;
  external_supabase_pat: string | null;
}

// Configure webhook on a single UAZAPI instance
async function configureUazapiWebhook(
  baseUrl: string,
  instanceToken: string,
  webhookUrl: string
): Promise<boolean> {
  try {
    const base = baseUrl.replace(/\/$/, "");
    const response = await fetch(`${base}/instance/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instanceToken,
      },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        webhook_enabled: true,
        events: ["messages", "messages_update"],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function useSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["user-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserSettings | null;
    },
    enabled: !!user,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<Omit<UserSettings, "id" | "user_id">>) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_settings")
        .update(newSettings)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });

  // Apply global webhook to all user instances in UAZAPI
  const applyGlobalWebhook = useMutation({
    mutationFn: async (webhookUrl: string) => {
      if (!user) throw new Error("Not authenticated");
      if (!settings?.uazapi_base_url) throw new Error("URL base da UAZAPI não configurada");

      // Fetch all user instances
      const { data: instances, error } = await supabase
        .from("instances")
        .select("id, uazapi_instance_token")
        .eq("user_id", user.id);

      if (error) throw error;
      if (!instances || instances.length === 0) {
        return { success: 0, failed: 0, total: 0 };
      }

      let success = 0;
      let failed = 0;

      // Configure webhook on each instance
      for (const instance of instances) {
        const ok = await configureUazapiWebhook(
          settings.uazapi_base_url,
          instance.uazapi_instance_token,
          webhookUrl
        );
        if (ok) {
          // Update local DB
          await supabase
            .from("instances")
            .update({ webhook_url: webhookUrl })
            .eq("id", instance.id);
          success++;
        } else {
          failed++;
        }
      }

      return { success, failed, total: instances.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      if (result.total === 0) {
        toast.info("Nenhuma instância encontrada para configurar");
      } else if (result.failed === 0) {
        toast.success(`Webhook configurado em ${result.success} instância(s)!`);
      } else {
        toast.warning(`Webhook configurado em ${result.success}/${result.total} instâncias`);
      }
    },
    onError: (error) => {
      toast.error("Erro ao aplicar webhook: " + error.message);
    },
  });

  return {
    settings,
    isLoading,
    updateSettings,
    applyGlobalWebhook,
  };
}
