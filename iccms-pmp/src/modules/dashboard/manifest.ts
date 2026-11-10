import { LayoutDashboard } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { DashboardPage } from "./routes/DashboardPage";

const DASHBOARD_ACCESS = ["records.view"] as const;

/** Static welcome/quick links only until widget endpoints have safe scope contracts. */
export const dashboardManifest: ModuleManifest = {
  id: "dashboard",
  feature: "module.dashboard",
  navGroup: "Overview",
  routes: [{ path: "/dashboard", component: DashboardPage, requires: DASHBOARD_ACCESS }],
  nav: [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, requires: DASHBOARD_ACCESS },
  ],
  minScope: "district",
};
