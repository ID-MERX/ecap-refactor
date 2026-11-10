/**
 * Feature flags.
 *
 * A module flag that is `false` removes the module's routes and nav items entirely (the manifest
 * loader reads this), so a disabled module is unreachable — not merely hidden.
 *
 * Two modules default off because they cannot show real data yet:
 * - `module.referrals` — no working district-level referral list endpoint (`docs/AUDIT.md` §6.2, backend ask #9).
 * - `module.flags` — backend list/mutation operations do not enforce caller scope; flag rows also lack reliable district/province fields (`docs/audit/flags.md`).
 * - `module.trainingLog` — no API at all; the legacy page was demo data (`docs/AUDIT.md` §6.9).
 *
 * `support.calls` is off per decision 4 (WebRTC calls, chat and voice notes are dropped).
 *
 * Anything can be forced off per environment with `VITE_FEATURES_OFF`, e.g.
 * `VITE_FEATURES_OFF=assistant,support.chat`.
 */

/** The defaults. `as const` keeps the key names as literal types for `FeatureKey`. */
export const defaultFeatures = {
  "module.households": true,
  "module.vcas": true,
  "module.caregivers": true,
  "module.services": true,
  "module.hts": true,
  "module.pmtct": true,
  "module.motherIndex": true,
  "module.referrals": false,
  "module.flags": false,
  "module.performance": true,
  "module.caseworkers": true,
  "module.districts": true,
  "module.dashboard": true,
  "module.calendar": true,
  "module.users": true,
  "module.account": true,
  "module.dataPipeline": true,
  "module.support": true,
  "module.docs": true,
  "module.assistant": true,
  "module.analytics": true,
  "module.trainingLog": false,
  "support.chat": true,
  "support.calls": false,
} as const;

export type FeatureKey = keyof typeof defaultFeatures;
export type FeatureFlags = Record<FeatureKey, boolean>;

export const allFeatureKeys = Object.keys(defaultFeatures) as ReadonlyArray<FeatureKey>;

/**
 * Defaults with the given keys forced off.
 *
 * Unknown keys are ignored on purpose: a stale `.env` should not take the app down, and there is no
 * "force on" escape hatch — a module that defaults off needs a code change and a reason.
 */
export function resolveFlags(off: ReadonlyArray<string>): FeatureFlags {
  const flags = { ...defaultFeatures } as FeatureFlags;
  for (const key of off) {
    if (key in flags) flags[key as FeatureKey] = false;
  }
  return flags;
}
