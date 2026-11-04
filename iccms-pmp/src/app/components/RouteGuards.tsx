import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useAuth } from "@/core/auth";
import { satisfies } from "@/app/manifest";
import type { Permission } from "@/core/access/types";

import { LoadingScreen } from "./LoadingScreen";
import { NoScopeScreen } from "./NoScopeScreen";
import { ForbiddenScreen } from "./ForbiddenScreen";

/**
 * The three gates, in order: signed in → has a data scope → has the permission.
 *
 * The legacy app had only the first (`legacy:src/components/auth/ProtectedRoute.tsx`, which checked
 * "authenticated" and "password change required" and nothing else). Every role check was cosmetic, so
 * `/users`, `/users/new`, `/data-pipeline` and `/districts` were reachable by typing the URL
 * (`docs/AUDIT.md` §4.4 item 6). A guard here is the only thing that makes hiding a nav link mean
 * anything.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "anonymous") {
    // Remember where they were going so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Requires a *scope*, not just a session: an unscoped user has nothing to look at. */
export function RequireScope({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  if (state.access?.scope.level === "none") return <NoScopeScreen />;
  return <>{children}</>;
}

export function RequirePermission({
  permissions,
  children,
}: {
  permissions: ReadonlyArray<Permission>;
  children: ReactNode;
}) {
  const { state } = useAuth();
  if (state.status !== "authenticated") return <Navigate to="/login" replace />;
  if (!satisfies(state.access, permissions)) return <ForbiddenScreen />;
  return <>{children}</>;
}
