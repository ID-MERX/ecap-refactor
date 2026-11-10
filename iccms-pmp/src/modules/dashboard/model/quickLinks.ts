export type DashboardNavItem = {
  moduleId: string;
  label: string;
  to: string;
};

export type DashboardNavGroup = {
  group: string | null;
  items: ReadonlyArray<DashboardNavItem>;
};

/** Only use links already filtered by the app registry for this user's scope and permissions. */
export function dashboardQuickLinks(
  groups: ReadonlyArray<DashboardNavGroup>,
): ReadonlyArray<DashboardNavItem> {
  return groups
    .flatMap(({ items }) => items)
    .filter((item) => item.moduleId !== "dashboard" && item.to !== "/" && item.to !== "/dashboard");
}
