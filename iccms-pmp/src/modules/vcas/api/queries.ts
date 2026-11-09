import { fyKey, type FyWindow } from "@/platform/scope/fy";
import type { Scope } from "@/core/access/types";

import { fetchActiveVcas, fetchArchivedVcas, fetchVcaServices, fetchVcaDetailList } from "./client";

export function vcaScopeKey(scope: Scope): string {
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

export const vcaKeys = {
  all: ["vcas"] as const,
  active: (scope: string, period: string) => [...vcaKeys.all, "active", scope, period] as const,
  archived: (scope: string, period: string, reason: string) =>
    [...vcaKeys.all, "archived", scope, period, reason] as const,
  services: (scope: string) => [...vcaKeys.all, "services", scope] as const,
  profile: (scope: string, id: string) => [...vcaKeys.all, "profile", scope, id] as const,
};

export function vcaActiveQuery(scope: Scope, window: FyWindow, enabled = true) {
  const key = vcaScopeKey(scope);
  return {
    queryKey: vcaKeys.active(key, fyKey(window)),
    queryFn: () => fetchActiveVcas(scope, window.from, window.to),
    enabled: enabled && scope.level !== "none",
    staleTime: 10 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function vcaArchivedQuery(scope: Scope, window: FyWindow, reason: string, enabled = true) {
  const key = vcaScopeKey(scope);
  return {
    queryKey: vcaKeys.archived(key, fyKey(window), reason),
    queryFn: () => fetchArchivedVcas(scope, window.from, window.to, reason),
    enabled: enabled && scope.level !== "none",
    staleTime: 10 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function vcaServicesQuery(scope: Scope) {
  const key = vcaScopeKey(scope);
  return {
    queryKey: vcaKeys.services(key),
    queryFn: () => fetchVcaServices(scope),
    enabled: scope.level !== "none",
    staleTime: 10 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export type VcaIdentifiers = {
  routeId: string;
  serviceId: string;
  uniqueId: string;
  flagId: string;
  flagIds: ReadonlyArray<string>;
};

export function vcaProfileQueries(scope: string, identifiers: VcaIdentifiers | null) {
  const id = identifiers?.routeId ?? "";
  const enabled = Boolean(identifiers);
  const root = vcaKeys.profile(scope, id);
  const common = { enabled, staleTime: 5 * 60_000, meta: { etl: true, persist: false } } as const;
  return [
    {
      ...common,
      queryKey: [...root, "services", identifiers?.serviceId ?? ""],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchVcaDetailList("/child/vca-services", identifiers?.serviceId ?? "", signal),
    },
    {
      ...common,
      queryKey: [...root, "caseplans", identifiers?.uniqueId ?? ""],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchVcaDetailList("/child/vca-caseplans", identifiers?.uniqueId ?? "", signal),
    },
    {
      ...common,
      queryKey: [...root, "referrals", identifiers?.uniqueId ?? ""],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchVcaDetailList("/child/vca-referrals", identifiers?.uniqueId ?? "", signal),
    },
  ];
}

export function vcaCasePlanDomainsQuery(scope: string, id: string, enabled: boolean) {
  return {
    queryKey: [...vcaKeys.profile(scope, id), "caseplan-domains"],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchVcaDetailList("/child/vca-caseplan-domains", id, signal),
    enabled: enabled && Boolean(id),
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}
