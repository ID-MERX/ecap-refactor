import { Archive, Home } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { HouseholdArchivedPage } from "./routes/HouseholdArchivedPage";
import { HouseholdProfilePage } from "./routes/HouseholdProfilePage";
import { HouseholdRegisterPage } from "./routes/HouseholdRegisterPage";
import { HouseholdRiskPage } from "./routes/HouseholdRiskPage";
import { LegacyProfileRedirect } from "./routes/LegacyProfileRedirect";

/** The active and archived registers, service-domain risk view, and scoped record profile. */
export const householdsManifest: ModuleManifest = {
  id: "households",
  feature: "module.households",
  navGroup: "Registers",
  routes: [
    {
      path: "/households",
      component: HouseholdRegisterPage,
      redirects: ["/registers/households"],
    },
    {
      path: "/households/archived",
      component: HouseholdArchivedPage,
    },
    {
      path: "/households/risk",
      component: HouseholdRiskPage,
      redirects: ["/registers/household-risk"],
    },
    {
      path: "/households/:householdId",
      component: HouseholdProfilePage,
    },
    {
      path: "/profile/household-details",
      component: LegacyProfileRedirect,
    },
  ],
  nav: [
    { label: "Households", to: "/households", icon: Home },
    { label: "Archived households", to: "/households/archived", icon: Archive, group: "Archived" },
    // Risk register remains unlisted, matching the legacy page's URL-only access.
  ],
  minScope: "district",
};
