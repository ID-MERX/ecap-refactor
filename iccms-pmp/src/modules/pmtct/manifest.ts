import { HeartPulse } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { LegacyPmtctRedirect } from "./routes/LegacyPmtctRedirect";
import { PmtctProfilePage } from "./routes/PmtctProfilePage";
import { PmtctRegisterPage } from "./routes/PmtctRegisterPage";

const PMTCT_ACCESS = ["records.view"] as const;

export const pmtctManifest: ModuleManifest = {
  id: "pmtct",
  feature: "module.pmtct",
  navGroup: "Registers",
  routes: [
    { path: "/pmtct", component: PmtctRegisterPage, requires: PMTCT_ACCESS },
    { path: "/pmtct/:id", component: PmtctProfilePage, requires: PMTCT_ACCESS },
    { path: "/registers/pmtct", component: LegacyPmtctRedirect, requires: PMTCT_ACCESS },
    { path: "/profile/pmtct-details", component: LegacyPmtctRedirect, requires: PMTCT_ACCESS },
  ],
  nav: [{ label: "PMTCT", to: "/pmtct", icon: HeartPulse, requires: PMTCT_ACCESS }],
  minScope: "district",
};
