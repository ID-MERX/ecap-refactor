import { Navigate, useSearchParams } from "react-router";

/** Replace legacy `?id=` / navigation-state profile URLs with the explicit route param. */
export function LegacyVcaProfileRedirect() {
  const [params] = useSearchParams();
  const id = params.get("id");
  return <Navigate to={id ? `/vcas/${encodeURIComponent(id)}` : "/vcas"} replace />;
}
