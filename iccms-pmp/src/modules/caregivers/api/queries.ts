import type { Scope } from "@/core/access/types";

import { districtsForCaregiverScope, fetchCaregiverServices } from "./client";

export function caregiverScopeKey(scope: Scope): string {
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

export const caregiverKeys = {
  all: ["caregivers"] as const,
  services: (scope: string, districts: ReadonlyArray<string>) =>
    [...caregiverKeys.all, "services", scope, ...districts] as const,
};

export function caregiverServicesQuery(scope: Scope) {
  const districts = districtsForCaregiverScope(scope);
  return {
    queryKey: caregiverKeys.services(caregiverScopeKey(scope), districts),
    queryFn: () => fetchCaregiverServices(scope),
    enabled: scope.level !== "none",
    staleTime: 10 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}
