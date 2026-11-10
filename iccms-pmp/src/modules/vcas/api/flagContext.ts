import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";

import { districtsForVcaScope, fetchActiveVcas, fetchArchivedVcas } from "./client";
import { vcaMatchesId, type Vca } from "./schemas";

export type VcaFlagContext = {
  vcaId: string;
  householdId: string | null;
  district: string | null;
  province: string | null;
  facility: string | null;
};

function toContext(row: Vca): VcaFlagContext {
  return {
    vcaId: row.vcaId,
    householdId: row.householdId,
    district: row.district,
    province: row.province,
    facility: typeof row.facility === "string" ? row.facility : null,
  };
}

export async function fetchVcaFlagContext(
  scope: Scope,
  vcaId: string,
): Promise<VcaFlagContext | null> {
  if (scope.level === "none" || !vcaId.trim()) return null;
  const districts = districtsForVcaScope(scope);
  if (districts.length === 0) return null;
  const [active, archived] = await Promise.all([
    fetchActiveVcas(scope, null, null),
    fetchArchivedVcas(scope, null, null, "all"),
  ]);
  const allowedDistricts = new Set(districts.map((district) => normalizeDistrict(district)));
  const match = [...active.rows, ...archived.rows].find(
    (row) =>
      vcaMatchesId(row, vcaId) &&
      row.district !== null &&
      allowedDistricts.has(normalizeDistrict(row.district)),
  );
  return match ? toContext(match) : null;
}

export function vcaFlagContextQuery(scope: Scope, vcaId: string) {
  const scopeKey =
    scope.level === "national"
      ? "national"
      : scope.level === "province"
        ? `province:${scope.province}`
        : scope.level === "district"
          ? `district:${scope.district}`
          : "none";
  return {
    queryKey: ["vcas", "flag-context", scopeKey, vcaId] as const,
    queryFn: () => fetchVcaFlagContext(scope, vcaId),
    enabled: scope.level !== "none" && vcaId.trim().length > 0,
    staleTime: 5 * 60_000,
    meta: { persist: false },
  } as const;
}
