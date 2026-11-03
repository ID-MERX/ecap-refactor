import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearAllCacheEntries } from "@/lib/indexedDbCache";
import { getBackendBaseUrl } from "@/lib/env";
import { getStoredToken } from "@/lib/auth";

/**
 * Push-style cache invalidation tied to Mage AI ETL outcomes.
 *
 * Polls /etl/last-success every 30s. The endpoint returns the
 * completed_at timestamp of the most recent successful Mage run.
 *
 * - Timestamp advances forward → ETL ran successfully → we call
 *   queryClient.invalidateQueries(), marking every cached query stale.
 *   Visible queries refetch in the background; users see fresh data
 *   within seconds with no manual refresh.
 *
 * - Timestamp unchanged → either no new run, or the latest run failed.
 *   Nothing happens. The cache stays. Users keep seeing the last
 *   known-good data. This is the fail-soft behaviour we want.
 *
 * - Timestamp goes backwards (rare, e.g. a manual rollback) → we ignore
 *   it. We only react to forward movement.
 *
 * Mounts once at the app root and runs for the lifetime of the tab.
 * Render output is null — it's a behavioural component.
 */
const POLL_INTERVAL_MS = 30 * 1000;
const DQA_BASE_URL = getBackendBaseUrl();

async function fetchLastSuccess(): Promise<string | null> {
  try {
    const token = getStoredToken();
    if (!token) return null;
    const response = await fetch(`${DQA_BASE_URL}/etl/last-success`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.last_success_at ?? null;
  } catch {
    return null;
  }
}

const EtlInvalidator = () => {
  const queryClient = useQueryClient();
  const lastSeenRef = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ["etl", "last-success"],
    queryFn: fetchLastSuccess,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: 0,
    gcTime: POLL_INTERVAL_MS * 2,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const previous = lastSeenRef.current;
    lastSeenRef.current = data;

    if (previous === null) {
      // First successful poll — establish the baseline only.
      return;
    }

    if (data > previous) {
      // Mage AI completed a new successful run since we last looked.
      // Wipe the aux IDB cache so queryFns refetch fresh from the network
      // instead of serving the pre-ETL response within its own TTL window.
      void clearAllCacheEntries();
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "etl",
      });
      if (typeof window !== "undefined" && "console" in window) {
        console.info("[ETL] Mage run completed at", data, "— refreshing caches.");
      }
    }
  }, [data, queryClient]);

  return null;
};

export default EtlInvalidator;
