import type { Scope } from "@/core/access/types";
import type { FyWindow } from "@/platform/scope/fy";

import {
  allowedReferralDistricts,
  fetchCaregiverReferralMonths,
  fetchVcaReferralMonths,
} from "./client";

function scopeKey(scope: Scope): string {
  switch (scope.level) {
    case "national":
      return "national";
    case "province":
      return `province:${scope.province}`;
    case "district":
      return `district:${scope.district}`;
    case "none":
      return "none";
  }
}

function windowKey(window: FyWindow): readonly [string | null, string | null] {
  return [window.from, window.to];
}

export const referralKeys = {
  all: ["referrals"] as const,
  caregiverMonths: (scope: Scope, window: FyWindow, selectedDistrict?: string) =>
    [
      ...referralKeys.all,
      "caregiver-months",
      scopeKey(scope),
      allowedReferralDistricts(scope, selectedDistrict),
      windowKey(window),
    ] as const,
  vcaMonths: (scope: Scope, window: FyWindow, selectedDistrict?: string) =>
    [
      ...referralKeys.all,
      "vca-months",
      scopeKey(scope),
      allowedReferralDistricts(scope, selectedDistrict),
      windowKey(window),
    ] as const,
};

export function caregiverReferralMonthsQuery(
  scope: Scope,
  window: FyWindow,
  selectedDistrict?: string,
) {
  return {
    queryKey: referralKeys.caregiverMonths(scope, window, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchCaregiverReferralMonths(scope, window, selectedDistrict, signal),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { persist: false },
  } as const;
}

export function vcaReferralMonthsQuery(scope: Scope, window: FyWindow, selectedDistrict?: string) {
  return {
    queryKey: referralKeys.vcaMonths(scope, window, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchVcaReferralMonths(scope, window, selectedDistrict, signal),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { persist: false },
  } as const;
}
