import type { Scope } from "@/core/access/types";
import type { FyWindow } from "@/platform/scope/fy";

import {
  allowedPmtctDistricts,
  fetchPmtctInfants,
  fetchPmtctMothers,
  fetchPmtctProfile,
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

export const pmtctKeys = {
  all: ["pmtct"] as const,
  mothers: (scope: Scope, window: FyWindow, selectedDistrict?: string) =>
    [
      ...pmtctKeys.all,
      "mothers",
      scopeKey(scope),
      allowedPmtctDistricts(scope, selectedDistrict),
      windowKey(window),
    ] as const,
  infants: (scope: Scope, window: FyWindow, selectedDistrict?: string) =>
    [
      ...pmtctKeys.all,
      "infants",
      scopeKey(scope),
      allowedPmtctDistricts(scope, selectedDistrict),
      windowKey(window),
    ] as const,
  profile: (scope: Scope, window: FyWindow, clientId: string, selectedDistrict?: string) =>
    [
      ...pmtctKeys.all,
      "profile",
      scopeKey(scope),
      allowedPmtctDistricts(scope, selectedDistrict),
      windowKey(window),
      clientId,
    ] as const,
};

export function pmtctMothersQuery(scope: Scope, window: FyWindow, selectedDistrict?: string) {
  return {
    queryKey: pmtctKeys.mothers(scope, window, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchPmtctMothers(scope, window, selectedDistrict, signal),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function pmtctInfantsQuery(scope: Scope, window: FyWindow, selectedDistrict?: string) {
  return {
    queryKey: pmtctKeys.infants(scope, window, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchPmtctInfants(scope, window, selectedDistrict, signal),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function pmtctProfileQuery(
  scope: Scope,
  window: FyWindow,
  clientId: string,
  selectedDistrict?: string,
) {
  return {
    queryKey: pmtctKeys.profile(scope, window, clientId, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchPmtctProfile(scope, window, clientId, signal, selectedDistrict),
    enabled: scope.level !== "none" && Boolean(clientId),
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}
