import { Navigate, useLocation } from "react-router";

/** Keep the legacy risk URL's `type` and `district` filters when redirecting. */
export function LegacyVcaRiskRedirect() {
  const location = useLocation();
  return <Navigate to={`/vcas/risk${location.search}`} replace />;
}
