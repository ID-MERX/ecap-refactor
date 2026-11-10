import { CalendarDays } from "lucide-react";

import type { ModuleManifest } from "@/core/modules";

import { CalendarPage } from "./routes/CalendarPage";

const CALENDAR_ACCESS = ["records.view"] as const;

/** Keep calendar event reads and writes disabled until Directus ownership permissions are verified. */
export const calendarManifest: ModuleManifest = {
  id: "calendar",
  feature: "module.calendar",
  navGroup: "Overview",
  routes: [{ path: "/calendar", component: CalendarPage, requires: CALENDAR_ACCESS }],
  nav: [{ label: "Calendar", to: "/calendar", icon: CalendarDays, requires: CALENDAR_ACCESS }],
  minScope: "district",
};
