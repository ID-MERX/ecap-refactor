import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function LegacyPmtctRedirect(): ReactNode {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  let target = "/pmtct";
  if (location.pathname === "/profile/pmtct-details") {
    const id = params.get("id") ?? params.get("clientId") ?? "";
    if (id) target = `/pmtct/${encodeURIComponent(id)}`;
    params.delete("id");
    params.delete("clientId");
  }
  const search = params.toString();
  return <Navigate to={`${target}${search ? `?${search}` : ""}${location.hash}`} replace />;
}
