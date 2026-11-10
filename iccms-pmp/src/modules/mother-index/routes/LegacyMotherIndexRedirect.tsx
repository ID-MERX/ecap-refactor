import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function LegacyMotherIndexRedirect(): ReactNode {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const id = params.get("id") ?? params.get("motherId") ?? "";
  let target = "/mother-index";
  if (location.pathname === "/profile/mother-index-details" && id) {
    target = `/mother-index/${encodeURIComponent(id)}`;
    params.delete("id");
    params.delete("motherId");
  }
  const search = params.toString();
  return <Navigate to={`${target}${search ? `?${search}` : ""}${location.hash}`} replace />;
}
