import { useContext } from "react";

import { AuthContext, type AuthContextValue } from "./AuthProvider";

/** Throws outside a provider rather than returning `null` and failing later with a confusing error. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

/** Convenience for components that only need the access decision. */
export function useAccess() {
  const { access } = useAuth();
  return access;
}
