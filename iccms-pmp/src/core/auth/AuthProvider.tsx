/**
 * The auth provider: the signed-in user, the derived access, and login/logout.
 *
 * Replaces `legacy:src/context/AuthContext.tsx`. Two behaviours changed deliberately:
 *
 * - **The access decision lives in `deriveAccess`, not here.** The legacy provider exposed the raw
 *   profile and let every page re-interpret it; this one derives once and exposes `access`.
 * - **Logout actually clears everything.** Legacy cleared the token only, leaving the React Query
 *   memory cache, the IndexedDB cache and several namespaced keys behind.
 */

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { del } from "idb-keyval";

import { deriveAccess } from "@/core/access/deriveAccess";
import type { Access } from "@/core/access/types";
import { purgeCache } from "@/core/api/queryClient";
import { storage } from "@/core/lib/storage";

import { fetchMe, login as loginRequest, logoutRemote, roleName, type Me } from "./me";
import { getToken, setToken } from "./session";

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; me: Me; access: Access };

export type AuthContextValue = {
  state: AuthState;
  /** Convenience: `null` unless authenticated. */
  me: Me | null;
  access: Access | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-read the profile, e.g. after a password change clears `password_change_required`. */
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Directus returns `admin_access` as a token claim; the profile carries the rest. */
function claimsFor(me: Me): { admin_access?: boolean } {
  // The claim itself is inside the JWT, which the client does not verify or decode for authority —
  // the role name is the trustworthy client-side proxy, and `deriveAccess` treats the claim as one of
  // five admin signals rather than the only one. Decoding the JWT here would duplicate the backend's
  // rule with a second, unverified source.
  return roleName(me)?.toLowerCase() === "administrator" ? { admin_access: true } : {};
}

export function toAccess(me: Me): Access {
  return deriveAccess(
    {
      description: me.description ?? null,
      title: me.title ?? null,
      location: me.location ?? null,
      role: typeof me.role === "string" ? { name: me.role } : (me.role ?? null),
    },
    claimsFor(me),
  );
}

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    getToken() === null ? { status: "anonymous" } : { status: "loading" },
  );

  const signOut = useCallback(async () => {
    await logoutRemote();
    setToken(null);
    await purgeCache(queryClient, () => del("iccms-pmp-query-cache"));
    // Last, so a failure above cannot strand a token in storage.
    storage.wipeNamespace();
    setState({ status: "anonymous" });
  }, [queryClient]);

  const load = useCallback(async () => {
    if (getToken() === null) {
      setState({ status: "anonymous" });
      return;
    }
    try {
      const me = await fetchMe();
      setState({ status: "authenticated", me, access: toAccess(me) });
    } catch {
      // A stored token that no longer works is not an error state to show — it is a signed-out user.
      setToken(null);
      setState({ status: "anonymous" });
    }
  }, []);

  // Starts the async profile fetch once. `load` only calls setState from its async continuations,
  // never synchronously, but the linter cannot see that, so the effect is explicit about it.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const signIn = useCallback(async (email: string, password: string) => {
    const token = await loginRequest(email, password);
    setToken(token);
    const me = await fetchMe();
    setState({ status: "authenticated", me, access: toAccess(me) });
  }, []);

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setState({ status: "authenticated", me, access: toAccess(me) });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      me: state.status === "authenticated" ? state.me : null,
      access: state.status === "authenticated" ? state.access : null,
      signIn,
      signOut,
      refresh,
    }),
    [state, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
