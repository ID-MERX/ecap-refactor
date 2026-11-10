import { Map } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { DistrictsPage } from "./routes/DistrictsPage";

const DISTRICTS_ACCESS = ["records.view"] as const;

/** Disabled pending caller-authorized district aggregates with consistent count semantics. */
export const districtsManifest: ModuleManifest = {
  id: "districts",
  feature: "module.districts",
  navGroup: "Overview",
  routes: [{ path: "/districts", component: DistrictsPage, requires: DISTRICTS_ACCESS }],
  nav: [{ label: "Districts", to: "/districts", icon: Map, requires: DISTRICTS_ACCESS }],
  // A single-district view is not a comparison page; keep district users out.
  minScope: "province",
};
