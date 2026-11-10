import { allDistricts } from "@/config";
import { scopeDistricts } from "@/core/access/deriveAccess";
import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";

import { fetchHouseholdRegister } from "./client";
import { fetchArchivedHouseholds } from "./extended";
import type { Household } from "./schemas";

export type HouseholdFlagContext = {
  householdId: string;
  district: string | null;
  province: string | null;
  facility: string | null;
};

const ALL_TIME = { from: null, to: null, label: "All time", slug: "all_time" } as const;

function comparable(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim().toLowerCase();
}

function matchesId(row: Household, id: string): boolean {
  return [
    row.householdId,
    row.flags.uid,
    row.flags.unique_id,
    row.flags.household_code,
    row.flags.household_id,
    row.flags.householdId,
    row.flags.hh_id,
    row.flags.id,
  ].some((candidate) => comparable(candidate) === comparable(id));
}

function toContext(row: Household): HouseholdFlagContext {
  return {
    householdId: row.householdId,
    district: row.district,
    province: row.province,
    facility: row.facility,
  };
}

export async function fetchHouseholdFlagContext(
  scope: Scope,
  householdId: string,
): Promise<HouseholdFlagContext | null> {
  if (scope.level === "none" || !householdId.trim()) return null;

  // The national empty-path convention means "all" to this backend. Send the explicit configured
  // district allow-list instead, and only expose the minimal context needed by the flag form.
  const districts = scopeDistricts(scope) ?? allDistricts.map(({ district }) => district);
  if (districts.length === 0) return null;
  const [active, archived] = await Promise.all([
    fetchHouseholdRegister({ districts, from: null, to: null }),
    fetchArchivedHouseholds(scope, ALL_TIME, "all"),
  ]);
  const allowedDistricts = new Set(districts.map((district) => normalizeDistrict(district)));
  const match = [...active.rows, ...archived.rows].find(
    (row) =>
      matchesId(row, householdId) &&
      row.district !== null &&
      allowedDistricts.has(normalizeDistrict(row.district)),
  );
  return match ? toContext(match) : null;
}

export function householdFlagContextQuery(scope: Scope, householdId: string) {
  const scopeKey =
    scope.level === "national"
      ? "national"
      : scope.level === "province"
        ? `province:${scope.province}`
        : scope.level === "district"
          ? `district:${scope.district}`
          : "none";
  return {
    queryKey: ["households", "flag-context", scopeKey, householdId] as const,
    queryFn: () => fetchHouseholdFlagContext(scope, householdId),
    enabled: scope.level !== "none" && householdId.trim().length > 0,
    staleTime: 5 * 60_000,
    meta: { persist: false },
  } as const;
}
