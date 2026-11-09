import { ClipboardList } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { LegacyServicesRedirect } from "./routes/LegacyServicesRedirect";
import { ServiceDetailPage } from "./routes/ServiceDetailPage";
import { ServiceRegisterPage } from "./routes/ServiceRegisterPage";
import { VcaServiceOverviewPage } from "./routes/VcaServiceOverviewPage";

export const servicesManifest: ModuleManifest = {
  id: "services",
  feature: "module.services",
  navGroup: "Registers",
  routes: [
    { path: "/services/vca/overview", component: VcaServiceOverviewPage },
    { path: "/services/household-services", component: LegacyServicesRedirect },
    { path: "/services/:type/:entityId", component: ServiceDetailPage },
    { path: "/services/:type", component: ServiceRegisterPage },
    { path: "/vca-services", component: LegacyServicesRedirect },
    { path: "/household-services", component: LegacyServicesRedirect },
    { path: "/caregiver-services", component: LegacyServicesRedirect },
  ],
  nav: [{ label: "Services", to: "/services/vca", icon: ClipboardList }],
  minScope: "district",
};
