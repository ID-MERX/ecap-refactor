import { Home } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { HouseholdRegisterPage } from "./routes/HouseholdRegisterPage";

/**
 * The households module.
 *
 * Only the active register is registered in Phase 4 — it is the pilot that proves the platform. The
 * archived and risk registers, and the profile page, land in Phase 5 as their own routes.
 */
export const householdsManifest: ModuleManifest = {
  id: "households",
  feature: "module.households",
  navGroup: "Registers",
  routes: [
    {
      path: "/households",
      component: HouseholdRegisterPage,
      // Every legacy household URL keeps working; old notification and email links must not 404.
      redirects: ["/registers/households"],
    },
  ],
  nav: [{ label: "Households", to: "/households", icon: Home }],
  minScope: "district",
};
