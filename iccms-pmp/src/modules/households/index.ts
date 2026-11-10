/**
 * Public surface of the households module.
 *
 * Other modules may import from here and nowhere else — `pnpm lint` enforces it (`boundaries/dependencies`
 * plus `no-restricted-imports`). Expose only stable domain types, shared query options, and path builders;
 * never expose pages or internal transport details.
 */

export type { Household } from "./api/schemas";
export { normalizeHousehold } from "./api/schemas";
export { householdRegisterQuery } from "./api/queries";
export { householdFlagContextQuery } from "./api/flagContext";
export type { HouseholdFlagContext } from "./api/flagContext";
export type { RegisterResult as HouseholdRegisterResult } from "./api/client";

/** Path builders, so no module inlines a URL string. */
export const householdPaths = {
  register: () => "/households",
  archived: () => "/households/archived",
  risk: () => "/households/risk",
  profile: (householdId: string) => `/households/${encodeURIComponent(householdId)}`,
} as const;

export { householdsManifest } from "./manifest";
