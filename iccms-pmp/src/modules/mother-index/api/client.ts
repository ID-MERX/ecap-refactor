import { allDistricts } from "@/config";
import { request } from "@/core/api";
import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";
import type { FyWindow } from "@/platform/scope/fy";

import {
  normalizeHouseholdChild,
  normalizeMotherRecord,
  parseMotherRows,
  type HouseholdChild,
  type MotherListResult,
  type MotherProfileResult,
  type MotherRecord,
} from "./schemas";

export const MOTHER_MAX_RETAINED_ROWS_PER_DISTRICT = 20_000;

export function districtsForMotherScope(scope: Scope): ReadonlyArray<string> {
  switch (scope.level) {
    case "national":
      return allDistricts.map(({ district }) => district);
    case "province":
      return scope.districts;
    case "district":
      return [scope.district];
    case "none":
      return [];
  }
}

export function allowedMotherDistricts(scope: Scope, selected?: string): ReadonlyArray<string> {
  const allowed = districtsForMotherScope(scope);
  if (scope.level === "none") return [];
  if (!selected || selected === "All" || selected === "All Districts") return allowed;
  const normalized = normalizeDistrict(selected);
  return allowed.filter((district) => normalizeDistrict(district) === normalized);
}

function dateQuery(window: FyWindow): Record<string, string | undefined> {
  return { from: window.from ?? undefined, to: window.to ?? undefined };
}

export async function fetchMotherRegister(
  scope: Scope,
  window: FyWindow,
  selectedDistrict?: string,
  signal?: AbortSignal,
  requestedId?: string,
): Promise<MotherListResult> {
  const districts = allowedMotherDistricts(scope, selectedDistrict);
  if (!districts.length) return { rows: [], truncatedDistricts: [] };
  const results = await Promise.all(
    districts.map(async (district) => {
      const payload = await request<unknown>({
        path: `/mother/district/${encodeURIComponent(district)}/filtered`,
        query: dateQuery(window),
        signal,
      });
      const expectedDistrict = normalizeDistrict(district);
      const rows: MotherRecord[] = [];
      let validCount = 0;
      const requested = requestedId?.toLowerCase();
      for (const raw of parseMotherRows(payload)) {
        const row = normalizeMotherRecord(raw);
        if (!expectedDistrict || normalizeDistrict(row.district) !== expectedDistrict) continue;
        validCount += 1;
        const requestedRow = Boolean(requested) && row.motherId.toLowerCase() === requested;
        if (rows.length < MOTHER_MAX_RETAINED_ROWS_PER_DISTRICT || requestedRow) rows.push(row);
      }
      return { district, rows, truncated: validCount > MOTHER_MAX_RETAINED_ROWS_PER_DISTRICT };
    }),
  );
  return {
    rows: results.flatMap((result) => result.rows),
    truncatedDistricts: results
      .filter((result) => result.truncated)
      .map((result) => result.district),
  };
}

function householdIdKey(value: string): string {
  return value.trim().toLocaleLowerCase("en");
}

export async function fetchMotherProfile(
  scope: Scope,
  window: FyWindow,
  id: string,
  selectedDistrict?: string,
  signal?: AbortSignal,
): Promise<MotherProfileResult> {
  const list = await fetchMotherRegister(scope, window, selectedDistrict, signal, id);
  const mother = list.rows.find((row) => row.motherId.toLowerCase() === id.toLowerCase()) ?? null;
  if (!mother || mother.householdId === "N/A" || mother.district === "N/A") {
    return { mother, children: [], truncatedDistricts: list.truncatedDistricts };
  }
  // This ID lookup is issued only after the mother has been found in the caller's scoped register.
  // Validate both household and district on every returned member; no name/phone fallback is used.
  const payload = await request<unknown>({
    path: `/household/members/${encodeURIComponent(mother.householdId)}`,
    signal,
  });
  const expectedHousehold = householdIdKey(mother.householdId);
  const expectedDistrict = normalizeDistrict(mother.district);
  const children: HouseholdChild[] = parseMotherRows(payload)
    .map(normalizeHouseholdChild)
    .filter(
      (child) =>
        child.id !== "N/A" &&
        householdIdKey(child.householdId) === expectedHousehold &&
        normalizeDistrict(child.district) === expectedDistrict,
    );
  return { mother, children, truncatedDistricts: list.truncatedDistricts };
}
