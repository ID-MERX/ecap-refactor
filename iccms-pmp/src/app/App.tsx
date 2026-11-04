/**
 * Provider tree + router.
 *
 * Order matters: `QueryClientProvider` wraps `AuthProvider` because the auth layer purges the query
 * cache on sign-out.
 *
 * Phase 3 ships no modules yet, so the manifest list is empty. Phase 5 adds them one at a time by
 * appending to `manifests.ts` — nothing here changes.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";

import { setAuthFailureHandler, setTokenProvider } from "@/core/api";
import { AuthProvider, useAuth } from "@/core/auth";
import { getToken, setToken } from "@/core/auth/session";
import { createQueryClient } from "@/core/api/queryClient";

import { createAppRouter } from "./router";
import { manifests as allManifests } from "./manifests";

function Router({ manifests }: { manifests: typeof allManifests }): ReactNode {
  const { access, state } = useAuth();

  // Routes and nav are derived from access, so the router must be rebuilt when it changes. Keying on
  // the access level (plus "anonymous") is enough: within one level the route set is identical.
  const accessKey = state.status === "authenticated" ? state.access.scope.level : "anonymous";

  const router = useMemo(
    () => createAppRouter(manifests, access),
    // `access` is deliberately absent from the deps: it is a new object every render, and `accessKey`
    // captures everything that actually changes the route set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manifests, accessKey],
  );

  // Remount on access change so no stale route stays mounted across a sign-out.
  // URL-state providers are mounted as a layout route *inside* the router (see `router.tsx`), because
  // nuqs and the FY filter both read the router's location.
  return <RouterProvider key={accessKey} router={router} />;
}

export function App(): ReactNode {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    setTokenProvider(getToken);
    return () => setTokenProvider(() => null);
  }, []);

  const manifests = useMemo(() => allManifests, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthFailureBridge />
      <AuthProvider>
        <Router manifests={manifests} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * A 401/403 from any request means the token is gone (there is no refresh endpoint — backend ask #6).
 * Clearing it here sends the next render to `/login` instead of leaving a half-broken page behind.
 *
 * Registered above the auth provider so it is in place before the first profile request.
 */
function AuthFailureBridge(): null {
  useEffect(() => {
    setAuthFailureHandler(() => setToken(null, { persist: false }));
    return () => setAuthFailureHandler(null);
  }, []);
  return null;
}
