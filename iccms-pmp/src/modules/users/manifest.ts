import { Users } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { UsersPage } from "./routes/UsersPage";

const USERS_ACCESS = ["users.manage"] as const;

/** User-directory access stays disabled until server-side account permissions are verified. */
export const usersManifest: ModuleManifest = {
  id: "users",
  feature: "module.users",
  navGroup: "Admin",
  routes: [{ path: "/users", component: UsersPage, requires: USERS_ACCESS }],
  nav: [{ label: "Users", to: "/users", icon: Users, requires: USERS_ACCESS }],
  minScope: "national",
};
