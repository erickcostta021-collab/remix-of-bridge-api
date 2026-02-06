import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return { hasActiveSubscription: false, instanceLimit: 0 };
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("instance_limit, is_paused")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching subscription:", error);
        return { hasActiveSubscription: false, instanceLimit: 0 };
      }

      // User has active subscription if instance_limit > 0 and not paused
      const hasActiveSubscription = (profile?.instance_limit ?? 0) > 0 && !profile?.is_paused;
      
      return {
        hasActiveSubscription,
        instanceLimit: profile?.instance_limit ?? 0,
        isPaused: profile?.is_paused ?? false,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
  });

  return {
    hasActiveSubscription: data?.hasActiveSubscription ?? false,
    instanceLimit: data?.instanceLimit ?? 0,
    isPaused: data?.isPaused ?? false,
    isLoading,
    refetch,
  };
}
