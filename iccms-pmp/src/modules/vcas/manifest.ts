import { Archive, Users } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { VcaArchivedPage } from "./routes/VcaArchivedPage";
import { VcaProfilePage } from "./routes/VcaProfilePage";
import { VcaRegisterPage } from "./routes/VcaRegisterPage";
import { VcaRiskPage } from "./routes/VcaRiskPage";
import { LegacyVcaProfileRedirect } from "./routes/LegacyVcaProfileRedirect";
import { LegacyVcaRiskRedirect } from "./routes/LegacyVcaRiskRedirect";

export const vcasManifest: ModuleManifest = {
  id: "vcas",
  feature: "module.vcas",
  navGroup: "Registers",
  routes: [
    { path: "/vcas", component: VcaRegisterPage },
    { path: "/vcas/archived", component: VcaArchivedPage },
    { path: "/vcas/risk", component: VcaRiskPage },
    { path: "/registers/vca-risk", component: LegacyVcaRiskRedirect },
    { path: "/vcas/:vcaId", component: VcaProfilePage },
    { path: "/profile/vca-details", component: LegacyVcaProfileRedirect },
  ],
  nav: [
    { label: "VCAs", to: "/vcas", icon: Users },
    { label: "Archived VCAs", to: "/vcas/archived", icon: Archive, group: "Archived" },
    // The risk register remains URL-only, matching the legacy navigation.
  ],
  minScope: "district",
};
