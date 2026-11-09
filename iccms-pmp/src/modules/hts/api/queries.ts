import type { Scope } from "@/core/access/types";

import { allowedHtsDistricts, fetchHtsRegister } from "./client";

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

export const htsKeys = {
  all: ["hts"] as const,
  register: (scope: Scope, selectedDistrict?: string) =>
    [
      ...htsKeys.all,
      "register",
      scopeKey(scope),
      allowedHtsDistricts(scope, selectedDistrict),
    ] as const,
  record: (scope: Scope, clientId: string, selectedDistrict?: string) =>
    [
      ...htsKeys.all,
      "record",
      scopeKey(scope),
      allowedHtsDistricts(scope, selectedDistrict),
      clientId,
    ] as const,
};

export function htsRegisterQuery(scope: Scope, selectedDistrict?: string) {
  return {
    queryKey: htsKeys.register(scope, selectedDistrict),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchHtsRegister(scope, selectedDistrict, signal),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

/** The ID remains client-normalized from the same district-scoped response; the endpoint has no by-ID route. */
export function htsRecordQuery(scope: Scope, clientId: string) {
  return {
    queryKey: htsKeys.record(scope, clientId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchHtsRegister(scope, undefined, signal, clientId),
    enabled: scope.level !== "none" && Boolean(clientId),
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}
