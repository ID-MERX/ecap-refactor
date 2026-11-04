import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { useAuth } from "@/core/auth";

import { LoadingScreen } from "./LoadingScreen";

/** Used by `/login`: a signed-in user should not see the sign-in form. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}
