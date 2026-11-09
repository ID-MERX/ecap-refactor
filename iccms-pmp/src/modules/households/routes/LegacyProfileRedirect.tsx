import { Navigate, useSearchParams } from "react-router";

/** Preserve legacy query-string profile links, but never fall back to the old sessionStorage id. */
export function LegacyProfileRedirect() {
  const [params] = useSearchParams();
  const id = params.get("id");
  return <Navigate to={id ? `/households/${encodeURIComponent(id)}` : "/households"} replace />;
}
