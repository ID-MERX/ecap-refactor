import { MapPin } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { CaseworkerJourneysPage } from "./routes/CaseworkerJourneysPage";
import { CaseworkerProfilePage } from "./routes/CaseworkerProfilePage";

const CASEWORKER_ACCESS = ["records.view"] as const;

/** Off until GPS and caseworker profile endpoints enforce the signed-in user's scope. */
export const caseworkersManifest: ModuleManifest = {
  id: "caseworkers",
  feature: "module.caseworkers",
  navGroup: "Services",
  routes: [
    {
      path: "/caseworkers/journeys",
      component: CaseworkerJourneysPage,
      requires: CASEWORKER_ACCESS,
      redirects: ["/caseworker-journeys", "/profile/caseworker-details"],
    },
    {
      path: "/caseworkers/:caseworkerId",
      component: CaseworkerProfilePage,
      requires: CASEWORKER_ACCESS,
    },
  ],
  nav: [
    {
      label: "Caseworker journeys",
      to: "/caseworkers/journeys",
      icon: MapPin,
      requires: CASEWORKER_ACCESS,
    },
  ],
  minScope: "district",
};
