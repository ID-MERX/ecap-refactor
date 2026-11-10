import { UserCircle2 } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { AccountPage } from "./routes/AccountPage";

/** Read the existing authenticated session profile only; no account-by-ID access or mutations. */
export const accountManifest: ModuleManifest = {
  id: "account",
  feature: "module.account",
  navGroup: "Account",
  routes: [{ path: "/account", component: AccountPage, redirects: ["/profile"] }],
  nav: [{ label: "My account", to: "/account", icon: UserCircle2 }],
};
