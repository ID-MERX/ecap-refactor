/**
 * Public surface of the households module.
 *
 * Other modules may import from here and nowhere else — `pnpm lint` enforces it (`boundaries/dependencies`
 * plus `no-restricted-imports`). Everything below is deliberately minimal: domain types and path
 * builders, not pages or queries.
 */

export type { Household } from "./api/schemas";
export { normalizeHousehold } from "./api/schemas";

/** Path builders, so no module inlines a URL string. */
export const householdPaths = {
  register: () => "/households",
  archived: () => "/households/archived",
  risk: () => "/households/risk",
  profile: (householdId: string) => `/households/${encodeURIComponent(householdId)}`,
} as const;

export { householdsManifest } from "./manifest";
