import { allDistricts } from "@/config";
import { request } from "@/core/api";
import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";
import type { FyWindow } from "@/platform/scope/fy";

import {
  normalizeReferralMonthlyRow,
  parseReferralMonthlyRows,
  type ReferralMonthlyCount,
  type ReferralMonthlyResult,
} from "./schemas";

export function districtsForReferralScope(scope: Scope): ReadonlyArray<string> {
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

export function allowedReferralDistricts(scope: Scope, selected?: string): ReadonlyArray<string> {
  const allowed = districtsForReferralScope(scope);
  if (scope.level === "none") return [];
  if (!selected || selected === "All" || selected === "All Districts") return allowed;
  const normalized = normalizeDistrict(selected);
  return allowed.filter((district) => normalizeDistrict(district) === normalized);
}

async function fetchMonthly(
  scope: Scope,
  beneficiary: "caregiver" | "vca",
  window: FyWindow,
  selectedDistrict?: string,
  signal?: AbortSignal,
): Promise<ReferralMonthlyResult> {
  const districts = allowedReferralDistricts(scope, selectedDistrict);
  if (!districts.length) return { rows: [] };
  const endpoint =
    beneficiary === "caregiver"
      ? "/household/caregiver-referrals-by-month"
      : "/child/vca-referrals-by-month";
  const results = await Promise.all(
    districts.map(async (district) => {
      const payload = await request<unknown>({
        path: `${endpoint}/${encodeURIComponent(district)}`,
        query: { from: window.from ?? undefined, to: window.to ?? undefined },
        signal,
      });
      const expectedDistrict = normalizeDistrict(district);
      const rows: ReferralMonthlyCount[] = [];
      for (const raw of parseReferralMonthlyRows(payload)) {
        const normalized = normalizeReferralMonthlyRow(raw);
        if (!normalized || normalizeDistrict(normalized.district) !== expectedDistrict) continue;
        rows.push(normalized);
      }
      return rows;
    }),
  );
  return { rows: results.flat() };
}

export function fetchCaregiverReferralMonths(
  scope: Scope,
  window: FyWindow,
  selectedDistrict?: string,
  signal?: AbortSignal,
): Promise<ReferralMonthlyResult> {
  return fetchMonthly(scope, "caregiver", window, selectedDistrict, signal);
}

export function fetchVcaReferralMonths(
  scope: Scope,
  window: FyWindow,
  selectedDistrict?: string,
  signal?: AbortSignal,
): Promise<ReferralMonthlyResult> {
  return fetchMonthly(scope, "vca", window, selectedDistrict, signal);
}
