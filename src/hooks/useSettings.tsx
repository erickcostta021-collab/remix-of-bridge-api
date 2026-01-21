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

// Configure global webhook on UAZAPI (admin level - all instances)
async function configureGlobalWebhook(
  baseUrl: string,
  adminToken: string,
  webhookUrl: string
): Promise<boolean> {
  try {
    const base = baseUrl.replace(/\/$/, "");
    const response = await fetch(`${base}/globalwebhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        admintoken: adminToken,
      },
      body: JSON.stringify({
        url: webhookUrl,
        enabled: true,
        events: ["messages", "messages_update"],
        excludeMessages: ["wasSentByApi"],
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

  // Apply global webhook at admin level in UAZAPI
  const applyGlobalWebhook = useMutation({
    mutationFn: async (webhookUrl: string) => {
      if (!user) throw new Error("Not authenticated");
      if (!settings?.uazapi_base_url) throw new Error("URL base da UAZAPI não configurada");
      if (!settings?.uazapi_admin_token) throw new Error("Token Admin da UAZAPI não configurado");

      const ok = await configureGlobalWebhook(
        settings.uazapi_base_url,
        settings.uazapi_admin_token,
        webhookUrl
      );

      if (!ok) {
        throw new Error("Falha ao configurar webhook global na UAZAPI");
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Webhook global configurado com sucesso!");
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
