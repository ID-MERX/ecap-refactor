import type { Scope } from "@/core/access/types";
import type { FyWindow } from "@/platform/scope/fy";

import { allowedMotherDistricts, fetchMotherProfile, fetchMotherRegister } from "./client";

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

export const motherKeys = {
  all: ["mother-index"] as const,
  register: (scope: Scope, window: FyWindow, selectedDistrict?: string) =>
    [
      ...motherKeys.all,
      "register",
      scopeKey(scope),
      allowedMotherDistricts(scope, selectedDistrict),
      windowKey(window),
    ] as const,
  profile: (scope: Scope, window: FyWindow, id: string, selectedDistrict?: string) =>
    [
      ...motherKeys.all,
      "profile",
      scopeKey(scope),
      allowedMotherDistricts(scope, selectedDistrict),
      windowKey(window),
      id,
    ] as const,
};

export function motherRegisterQuery(scope: Scope, window: FyWindow, selectedDistrict?: string) {
  return {
    queryKey: motherKeys.register(scope, window, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchMotherRegister(scope, window, selectedDistrict, signal),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function motherProfileQuery(
  scope: Scope,
  window: FyWindow,
  id: string,
  selectedDistrict?: string,
) {
  return {
    queryKey: motherKeys.profile(scope, window, id, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchMotherProfile(scope, window, id, selectedDistrict, signal),
    enabled: scope.level !== "none" && Boolean(id),
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}
