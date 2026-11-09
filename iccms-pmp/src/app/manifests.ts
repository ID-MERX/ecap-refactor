/**
 * Every module's manifest, in navigation order.
 *
 * Adding a module is one line here plus its folder — the router, sidebar, command palette and legacy
 * redirects are all derived from this list.
 */

import { householdsManifest } from "@/modules/households";
import { vcasManifest } from "@/modules/vcas";

import type { ModuleManifest } from "@/core/modules";

export const manifests: ReadonlyArray<ModuleManifest> = [householdsManifest, vcasManifest];
