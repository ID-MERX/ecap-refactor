import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function LegacyHtsRedirect(): ReactNode {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rest = new URLSearchParams(params);
  let target = "/hts";

  if (location.pathname === "/registers/hts-risk") {
    target = "/hts/risk";
  } else if (location.pathname === "/profile/hts-details") {
    const id = params.get("id") ?? params.get("clientId") ?? "";
    if (id) target = `/hts/${encodeURIComponent(id)}`;
    rest.delete("id");
    rest.delete("clientId");
  }

  const query = rest.toString();
  return <Navigate to={`${target}${query ? `?${query}` : ""}${location.hash}`} replace />;
}
