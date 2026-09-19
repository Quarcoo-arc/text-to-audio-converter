import { useCallback, useEffect, useState } from "react";
import { listConversions } from "../api/client";
import { useAuth } from "../auth/useAuth";
import type { ConversionRecord } from "../api/types";

const POLL_INTERVAL_MS = 2500;

/** Loads the signed-in user's conversions and keeps polling while any of
 * them are still queued or processing. */
export function useConversions() {
  const { idToken, isAuthenticated } = useAuth();
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!idToken) return;
    const data = await listConversions(idToken);
    setConversions(data);
    setIsLoading(false);
  }, [idToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Fetching from the API on mount/auth-change is the canonical use of
    // an effect (synchronizing with an external system), not derived state.
    // eslint-disable-next-line react/set-state-in-effect
    refetch();
  }, [isAuthenticated, refetch]);

  useEffect(() => {
    const hasActive = conversions.some(
      (c) => c.status === "queued" || c.status === "processing",
    );
    if (!hasActive) return;
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [conversions, refetch]);

  return { conversions, isLoading, refetch };
}
