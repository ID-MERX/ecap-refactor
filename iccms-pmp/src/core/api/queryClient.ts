/**
 * The TanStack Query client and its persistence.
 *
 * The legacy app persisted the React Query cache to IndexedDB under a fixed name
 * (`ecap-plus-pmp-react-query`) and **never cleared it on logout**, so the next user on the same
 * browser could see the previous user's cached rows (`docs/audit/auth.md`, "What logout does not
 * clear"; plan risk S5). Two things prevent that here:
 *
 * 1. `logout()` calls `purgeCache()`, which clears the in-memory client *and* the IndexedDB store.
 * 2. The persistence key includes the app version and the signed-in user id, so a cache written by a
 *    different user (or an older build) is not picked up even if a purge fails.
 */

import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./errors";

export const QUERY_PERSIST_KEY = "iccms-pmp:query-cache";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Registers are large and change slowly; a minute of staleness is cheap and prevents the
        // burst of refetches on every navigation the legacy app suffered.
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        // A 4xx is not going to succeed on a retry; only transient failures are worth three attempts.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && !error.isRetryable) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Wipe every trace of the session's cached data. Called by logout and by the auth-failure handler.
 * Errors are swallowed: a failed purge must not block the user from signing out.
 */
export async function purgeCache(
  client: QueryClient,
  deleteIdb: () => Promise<void>,
): Promise<void> {
  client.clear();
  try {
    await deleteIdb();
  } catch {
    /* ignore */
  }
}
