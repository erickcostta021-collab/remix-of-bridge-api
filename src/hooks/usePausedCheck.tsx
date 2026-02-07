import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const GRACE_PERIOD_DAYS = 3;

export function usePausedCheck() {
  const { user, signOut } = useAuth();
  const [isPaused, setIsPaused] = useState(false);
  const [isInGracePeriod, setIsInGracePeriod] = useState(false);
  const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState<Date | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkPausedStatus() {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_paused, paused_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error checking paused status:", error);
          setChecking(false);
          return;
        }

        if (data?.is_paused) {
          // Fully paused (grace period expired)
          setIsPaused(true);
          setIsInGracePeriod(false);
          await signOut();
        } else if (data?.paused_at) {
          // In grace period - payment failed but still within 3 days
          const pausedAt = new Date(data.paused_at);
          const endsAt = new Date(pausedAt);
          endsAt.setDate(endsAt.getDate() + GRACE_PERIOD_DAYS);
          
          const now = new Date();
          if (now < endsAt) {
            setIsInGracePeriod(true);
            setGracePeriodEndsAt(endsAt);
          } else {
            // Grace period has expired locally but cron hasn't run yet
            setIsPaused(true);
            setIsInGracePeriod(false);
          }
        } else {
          setIsPaused(false);
          setIsInGracePeriod(false);
          setGracePeriodEndsAt(null);
        }
      } catch (err) {
        console.error("Error in paused check:", err);
      } finally {
        setChecking(false);
      }
    }

    checkPausedStatus();
  }, [user, signOut]);

  return { isPaused, isInGracePeriod, gracePeriodEndsAt, checking };
}
