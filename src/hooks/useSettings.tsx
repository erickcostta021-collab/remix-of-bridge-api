import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { getOAuthRedirectUri } from "@/lib/canonicalOrigin";

export interface UserSettings {
  id: string;
  user_id: string;
  ghl_agency_token: string | null;
  ghl_client_id: string | null;
  ghl_client_secret: string | null;
  ghl_conversation_provider_id: string | null;
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
): Promise<{ success: boolean; error?: string }> {
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
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const errorMsg = data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro de conexão" };
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

      const result = await configureGlobalWebhook(
        settings.uazapi_base_url,
        settings.uazapi_admin_token,
        webhookUrl
      );

      if (!result.success) {
        throw new Error(result.error || "Falha ao configurar webhook global na UAZAPI");
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

  // Generate OAuth URL
  const getOAuthUrl = () => {
    if (!settings?.ghl_client_id) return null;

    // IMPORTANT: Use the canonical (published) origin for redirect_uri.
    // The Preview domain is temporary and will cause "Missing user context in state"
    // when the provider redirects elsewhere.
    const redirectUri = getOAuthRedirectUri();

    // State is used by the backend callback to identify which logged-in user
    // initiated the installation.
    const state = btoa(JSON.stringify({ userId: user?.id }));
    
    const scopes = [
      "locations.readonly",
      "contacts.readonly",
      "contacts.write",
      "opportunities.readonly",
      "opportunities.write",
      "users.readonly",
      "conversations/message.write",
      "conversations/message.readonly",
      "users.write",
      "calendars/events.readonly",
      "calendars/events.write",
      "calendars/groups.readonly",
      "calendars/groups.write",
      "calendars/resources.readonly",
      "calendars/resources.write",
      "conversations/reports.readonly",
      "conversations/livechat.write",
      "socialplanner/post.write",
      "workflows.readonly",
      "recurring-tasks.readonly",
      "recurring-tasks.write",
      "locations/customValues.readonly",
      "locations/customValues.write",
      "locations/customFields.readonly",
      "locations/customFields.write",
      "locations/tasks.readonly",
      "locations/tasks.write",
      "conversations.readonly",
      "conversations.write",
      "calendars.write",
      "calendars.readonly",
      "locations/tags.readonly",
      "locations/tags.write",
    ].join(" ");
    
    const params = new URLSearchParams({
      client_id: settings.ghl_client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes,
      state,
    });
    
    return `https://marketplace.leadconnectorhq.com/oauth/chooselocation?${params.toString()}`;
  };

  return {
    settings,
    isLoading,
    updateSettings,
    applyGlobalWebhook,
    getOAuthUrl,
  };
}
