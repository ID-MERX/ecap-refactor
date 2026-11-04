/**
 * Query key factory and options for the households module.
 *
 * Keys always contain the scope and the FY window, because a district user's rows and a national user's
 * rows are different data. The legacy register keyed on `["households", "All", fyKey]` and applied the
 * district afterwards on the client — which is why two users shared a persisted cache entry.
 */

import { queryOptions } from "@tanstack/react-query";

import { fyKey, type FyWindow } from "@/platform/scope/fy";
import type { Scope } from "@/core/access/types";
import { scopeDistricts } from "@/core/access/deriveAccess";

import { fetchHouseholdRegister, MAX_ROWS } from "./client";

export const householdKeys = {
  all: ["households"] as const,
  register: (scopeKey: string, period: string) =>
    [...householdKeys.all, "register", scopeKey, period] as const,
};

/** A stable string for the scope, so the cache key changes when the user's scope does. */
export function scopeKey(scope: Scope): string {
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

export function householdRegisterQuery(scope: Scope, window: FyWindow) {
  return queryOptions({
    queryKey: householdKeys.register(scopeKey(scope), fyKey(window)),
    queryFn: () =>
      fetchHouseholdRegister({
        districts: scopeDistricts(scope) ?? [],
        from: window.from,
        to: window.to,
      }),
    // The register only changes when the ETL runs; `platform/freshness` invalidates on that signal.
    staleTime: 10 * 60_000,
    // `none` must never issue a request — an empty district list is read by the backend as "no filter".
    enabled: scope.level !== "none",
    meta: { etl: true },
  });
}

export { MAX_ROWS };
