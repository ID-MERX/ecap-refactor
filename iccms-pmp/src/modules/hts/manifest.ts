import { TestTube } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { LegacyHtsRedirect } from "./routes/LegacyHtsRedirect";
import { HtsProfilePage } from "./routes/HtsProfilePage";
import { HtsRegisterPage } from "./routes/HtsRegisterPage";
import { HtsRiskPage } from "./routes/HtsRiskPage";

const HTS_ACCESS = ["records.view"] as const;

export const htsManifest: ModuleManifest = {
  id: "hts",
  feature: "module.hts",
  navGroup: "Registers",
  routes: [
    { path: "/hts", component: HtsRegisterPage, requires: HTS_ACCESS },
    { path: "/hts/risk", component: HtsRiskPage, requires: HTS_ACCESS },
    { path: "/hts/:clientId", component: HtsProfilePage, requires: HTS_ACCESS },
    { path: "/registers/hts", component: LegacyHtsRedirect, requires: HTS_ACCESS },
    { path: "/registers/hts-risk", component: LegacyHtsRedirect, requires: HTS_ACCESS },
    { path: "/profile/hts-details", component: LegacyHtsRedirect, requires: HTS_ACCESS },
  ],
  nav: [{ label: "HTS register", to: "/hts", icon: TestTube, requires: HTS_ACCESS }],
  minScope: "district",
};
