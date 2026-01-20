import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useSettings } from "./useSettings";
import { toast } from "sonner";

export interface Subaccount {
  id: string;
  user_id: string;
  location_id: string;
  account_name: string;
  ghl_user_id: string | null;
  ghl_subaccount_token: string | null;
}

export function useSubaccounts() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const queryClient = useQueryClient();

  const { data: subaccounts, isLoading } = useQuery({
    queryKey: ["subaccounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("ghl_subaccounts")
        .select("*")
        .eq("user_id", user.id)
        .order("account_name");

      if (error) throw error;
      return data as Subaccount[];
    },
    enabled: !!user,
  });

  const syncSubaccounts = useMutation({
    mutationFn: async () => {
      if (!user || !settings?.ghl_agency_token) {
        throw new Error("Token de agência GHL não configurado");
      }

      // Call GHL API to get locations
      const response = await fetch("https://services.leadconnectorhq.com/locations/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.ghl_agency_token}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: settings.ghl_agency_token.split("-")[1], // Extract company ID from token
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao buscar subcontas do GHL");
      }

      const data = await response.json();
      const locations = data.locations || [];

      // Upsert locations to database
      for (const location of locations) {
        await supabase
          .from("ghl_subaccounts")
          .upsert({
            user_id: user.id,
            location_id: location.id,
            account_name: location.name,
          }, {
            onConflict: "user_id,location_id",
          });
      }

      return locations.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["subaccounts"] });
      toast.success(`${count} subcontas sincronizadas!`);
    },
    onError: (error) => {
      toast.error("Erro ao sincronizar: " + error.message);
    },
  });

  return {
    subaccounts: subaccounts || [],
    isLoading,
    syncSubaccounts,
  };
}
