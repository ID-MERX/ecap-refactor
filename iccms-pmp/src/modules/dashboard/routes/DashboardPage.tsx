import type { ReactNode } from "react";
import { Link, useOutletContext } from "react-router";

import type { DashboardNavGroup } from "../model/quickLinks";
import { dashboardQuickLinks } from "../model/quickLinks";

/** No widget API calls: quick links come from the access-filtered navigation in AppShell. */
export function DashboardPage(): ReactNode {
  const groups = useOutletContext<ReadonlyArray<DashboardNavGroup>>();
  const links = dashboardQuickLinks(groups);

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your programme overview and available modules.
        </p>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">Dashboard metrics unavailable</h2>
        <p className="mt-2">
          Legacy dashboard widgets depend on endpoints that do not consistently enforce caller scope
          and include national downloads or unauthorised mutations. No dashboard data is requested
          until those contracts are safe.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Available modules</h2>
        {links.length > 0 ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((item) => (
              <li key={`${item.moduleId}:${item.to}`}>
                <Link
                  to={item.to}
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No other modules are available in this scope.
          </p>
        )}
      </section>
    </main>
  );
}
