import type { ReactNode } from "react";

/** No analytics request is made until the backend enforces the caller's assigned jurisdiction. */
export function PerformancePage(): ReactNode {
  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Analytics</p>
        <h1 className="mt-1 text-2xl font-semibold">Performance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Service delivery comparisons for facilities, caseworkers and service types.
        </p>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">Performance data unavailable</h2>
        <p className="mt-2">
          The existing performance endpoints accept a caller-supplied district but do not verify it
          against the signed-in user’s jurisdiction. This page does not request performance data
          until the backend enforces caller-derived scope.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="font-semibold">Reporting period</h2>
        <p className="mt-2">
          When available, these summaries compare the current calendar month with the previous
          calendar month. The existing handlers ignore FY and custom date bounds, so the global FY
          filter will not be represented as applying to this page.
        </p>
      </section>
      <p className="text-xs text-slate-500">
        The facility endpoint may repeat monthly totals across ward and district groups. Avoid
        summing those rows into a headline total until that backend aggregation is corrected.
      </p>
    </main>
  );
}
