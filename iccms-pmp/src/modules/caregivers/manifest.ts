import { HeartPulse } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { CaregiverRiskPage } from "./routes/CaregiverRiskPage";
import { LegacyCaregiverRiskRedirect } from "./routes/LegacyCaregiverRiskRedirect";

export const caregiversManifest: ModuleManifest = {
  id: "caregivers",
  feature: "module.caregivers",
  navGroup: "Registers",
  routes: [
    { path: "/caregivers/risk", component: CaregiverRiskPage },
    { path: "/registers/caregiver-risk", component: LegacyCaregiverRiskRedirect },
  ],
  nav: [{ label: "Caregiver service gaps", to: "/caregivers/risk", icon: HeartPulse }],
  minScope: "district",
};
