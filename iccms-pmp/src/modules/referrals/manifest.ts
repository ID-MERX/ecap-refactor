import { Share2 } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { ReferralsPage } from "./routes/ReferralsPage";

const REFERRAL_ACCESS = ["records.view"] as const;

export const referralsManifest: ModuleManifest = {
  id: "referrals",
  feature: "module.referrals",
  navGroup: "Services",
  routes: [{ path: "/referrals", component: ReferralsPage, requires: REFERRAL_ACCESS }],
  nav: [{ label: "Referrals", to: "/referrals", icon: Share2, requires: REFERRAL_ACCESS }],
  minScope: "district",
};
