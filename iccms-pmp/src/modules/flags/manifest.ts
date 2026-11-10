import { Flag } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { FlagsPage } from "./routes/FlagsPage";
import { FlagCreatePage } from "./routes/FlagCreatePage";

const FLAG_ACCESS = ["records.view"] as const;

/** The module is disabled by default until the backend enforces record scope and mutation access. */
export const flagsManifest: ModuleManifest = {
  id: "flags",
  feature: "module.flags",
  navGroup: "Services",
  routes: [
    { path: "/flags", component: FlagsPage, requires: FLAG_ACCESS },
    { path: "/flags/new", component: FlagCreatePage, requires: FLAG_ACCESS },
  ],
  nav: [{ label: "Flags", to: "/flags", icon: Flag, requires: FLAG_ACCESS }],
  minScope: "district",
};
