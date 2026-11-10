import { Gauge } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { PerformancePage } from "./routes/PerformancePage";

const PERFORMANCE_ACCESS = ["records.view"] as const;

/** Disabled until the performance endpoints enforce caller-derived scope on the server. */
export const performanceManifest: ModuleManifest = {
  id: "performance",
  feature: "module.performance",
  navGroup: "Services",
  routes: [{ path: "/performance", component: PerformancePage, requires: PERFORMANCE_ACCESS }],
  nav: [{ label: "Performance", to: "/performance", icon: Gauge, requires: PERFORMANCE_ACCESS }],
  minScope: "district",
};
