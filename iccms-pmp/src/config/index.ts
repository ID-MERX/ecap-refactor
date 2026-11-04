/**
 * Public surface of `src/config`. Everything outside `src/config` imports from here, never from the
 * individual files — that keeps the config-to-nothing dependency rule obvious and greppable.
 */

import { env } from "./env";
import { resolveFlags } from "./features";
import { programConfig } from "./program.config";
import { siteConfig } from "./site.config";

export { siteConfig, type SiteConfig } from "./site.config";
export {
  programConfig,
  geography,
  provinces,
  districtsByProvince,
  allDistricts,
  subPopulations,
  subPopulationsFor,
  subPopulationDataKey,
  getCurrentFy,
  fiscalYearRange,
  type ProgramConfig,
  type Province,
  type District,
  type GeographyLevel,
  type ServiceDomain,
  type SubPopulation,
  type SubPopulationKey,
} from "./program.config";
export { env, REMOVED_VARS, type Env } from "./env";
export {
  defaultFeatures,
  resolveFlags,
  allFeatureKeys,
  type FeatureKey,
  type FeatureFlags,
} from "./features";

/** Convenience: the resolved flag set for this build. */
export const features = resolveFlags(env.featuresOff);

/** True when a module flag is on. Reads the resolved set, so `VITE_FEATURES_OFF` is honoured. */
export function isEnabled(key: keyof typeof features): boolean {
  return features[key];
}

/** Kept for the `pnpm check:brand` allow-list — see `scripts/check-brand.mjs`. */
export const brand = {
  appName: siteConfig.appName,
  appShortName: siteConfig.appShortName,
  organization: siteConfig.organization.name,
  assistantName: siteConfig.assistant.name,
  programCountry: programConfig.country,
} as const;
