import { Baby } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { LegacyMotherIndexRedirect } from "./routes/LegacyMotherIndexRedirect";
import { MotherIndexProfilePage } from "./routes/MotherIndexProfilePage";
import { MotherIndexRegisterPage } from "./routes/MotherIndexRegisterPage";

const MOTHER_ACCESS = ["records.view"] as const;

export const motherIndexManifest: ModuleManifest = {
  id: "mother-index",
  feature: "module.motherIndex",
  navGroup: "Registers",
  routes: [
    { path: "/mother-index", component: MotherIndexRegisterPage, requires: MOTHER_ACCESS },
    { path: "/mother-index/:id", component: MotherIndexProfilePage, requires: MOTHER_ACCESS },
    {
      path: "/registers/mother-index",
      component: LegacyMotherIndexRedirect,
      requires: MOTHER_ACCESS,
    },
    {
      path: "/profile/mother-index-details",
      component: LegacyMotherIndexRedirect,
      requires: MOTHER_ACCESS,
    },
  ],
  nav: [
    { label: "Mother Index Register", to: "/mother-index", icon: Baby, requires: MOTHER_ACCESS },
  ],
  minScope: "district",
};
