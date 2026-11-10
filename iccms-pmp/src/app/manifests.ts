/**
 * Every module's manifest, in navigation order.
 *
 * Adding a module is one line here plus its folder — the router, sidebar, command palette and legacy
 * redirects are all derived from this list.
 */

import { caregiversManifest } from "@/modules/caregivers";
import { householdsManifest } from "@/modules/households";
import { htsManifest } from "@/modules/hts";
import { pmtctManifest } from "@/modules/pmtct";
import { motherIndexManifest } from "@/modules/mother-index";
import { servicesManifest } from "@/modules/services";
import { vcasManifest } from "@/modules/vcas";

import type { ModuleManifest } from "@/core/modules";

export const manifests: ReadonlyArray<ModuleManifest> = [
  householdsManifest,
  vcasManifest,
  caregiversManifest,
  servicesManifest,
  htsManifest,
  pmtctManifest,
  motherIndexManifest,
];
