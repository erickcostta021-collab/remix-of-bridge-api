import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useExternalSupabase() {
  const syncToExternal = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-external-supabase`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to sync");
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Dados sincronizados com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao sincronizar: " + error.message);
    },
  });

  return {
    syncToExternal,
  };
}
