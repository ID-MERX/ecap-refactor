/**
 * Every module's manifest, in navigation order.
 *
 * Empty in Phase 3 on purpose: there is nothing to show until a module exists. Phase 5 appends one
 * entry per module, and the router and sidebar pick it up with no other change — which is the whole
 * point of the registry.
 */

import type { ModuleManifest } from "./manifest";

export const manifests: ReadonlyArray<ModuleManifest> = [];
