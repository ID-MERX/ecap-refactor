import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function LegacyCaregiverRiskRedirect(): ReactNode {
  const location = useLocation();
  return <Navigate to={`/caregivers/risk${location.search}${location.hash}`} replace />;
}
