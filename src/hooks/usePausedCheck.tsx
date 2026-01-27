import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePausedCheck() {
  const { user, signOut } = useAuth();
  const [isPaused, setIsPaused] = useState(false);
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
          .select("is_paused")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error checking paused status:", error);
          setChecking(false);
          return;
        }

        if (data?.is_paused) {
          setIsPaused(true);
          // Sign out the user if they're paused
          await signOut();
        }
      } catch (err) {
        console.error("Error in paused check:", err);
      } finally {
        setChecking(false);
      }
    }

    checkPausedStatus();
  }, [user, signOut]);

  return { isPaused, checking };
}
