import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const GRACE_PERIOD_DAYS = 3;

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user) return { hasActiveSubscription: false, instanceLimit: 0 };
      
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("instance_limit, is_paused, paused_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching subscription:", error);
        return { hasActiveSubscription: false, instanceLimit: 0 };
      }

      const isPaused = profile?.is_paused ?? false;
      const pausedAt = profile?.paused_at ? new Date(profile.paused_at) : null;
      
      // Check grace period
      let isInGracePeriod = false;
      let gracePeriodEndsAt: Date | null = null;
      
      if (!isPaused && pausedAt) {
        const endsAt = new Date(pausedAt);
        endsAt.setDate(endsAt.getDate() + GRACE_PERIOD_DAYS);
        
        if (new Date() < endsAt) {
          isInGracePeriod = true;
          gracePeriodEndsAt = endsAt;
        }
      }

      // User has active subscription if instance_limit > 0 and not fully paused
      const hasActiveSubscription = (profile?.instance_limit ?? 0) > 0 && !isPaused;
      
      return {
        hasActiveSubscription,
        instanceLimit: profile?.instance_limit ?? 0,
        isPaused,
        isInGracePeriod,
        gracePeriodEndsAt,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute
  });

  return {
    hasActiveSubscription: data?.hasActiveSubscription ?? false,
    instanceLimit: data?.instanceLimit ?? 0,
    isPaused: data?.isPaused ?? false,
    isInGracePeriod: data?.isInGracePeriod ?? false,
    gracePeriodEndsAt: data?.gracePeriodEndsAt ?? null,
    isLoading,
    refetch,
  };
}
