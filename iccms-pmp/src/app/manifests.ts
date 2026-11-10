/**
 * Every module's manifest, in navigation order.
 *
 * Adding a module is one line here plus its folder — the router, sidebar, command palette and legacy
 * redirects are all derived from this list.
 */

import { caregiversManifest } from "@/modules/caregivers";
import { districtsManifest } from "@/modules/districts";
import { dashboardManifest } from "@/modules/dashboard";
import { caseworkersManifest } from "@/modules/caseworkers";
import { flagsManifest } from "@/modules/flags";
import { householdsManifest } from "@/modules/households";
import { htsManifest } from "@/modules/hts";
import { pmtctManifest } from "@/modules/pmtct";
import { performanceManifest } from "@/modules/performance";
import { referralsManifest } from "@/modules/referrals";
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
  referralsManifest,
  flagsManifest,
  performanceManifest,
  caseworkersManifest,
  districtsManifest,
  dashboardManifest,
];
