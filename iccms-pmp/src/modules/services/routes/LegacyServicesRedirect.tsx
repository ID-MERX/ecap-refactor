import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

const targets: Record<string, string> = {
  "/vca-services": "/services/vca",
  "/household-services": "/services/household",
  "/caregiver-services": "/services/caregiver",
  "/services/household-services": "/services/household",
};

export function LegacyServicesRedirect(): ReactNode {
  const location = useLocation();
  const target = targets[location.pathname] ?? "/services/household";
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}
