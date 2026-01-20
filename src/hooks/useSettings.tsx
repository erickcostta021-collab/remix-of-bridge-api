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

  return {
    settings,
    isLoading,
    updateSettings,
  };
}
