import type { ReactNode } from "react";

/** No caseworker list or GPS request is made until those endpoints enforce caller scope. */
export function CaseworkerJourneysPage(): ReactNode {
  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Field operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Caseworker journeys</h1>
        <p className="mt-1 text-sm text-slate-600">
          GPS-tagged field visits and movement patterns.
        </p>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">Journey data unavailable</h2>
        <p className="mt-2">
          The current journey endpoint returns precise GPS coordinates and household IDs without
          enforcing the signed-in user’s district or province. This page does not fetch or display
          journey data until the backend enforces caller-derived scope.
        </p>
      </section>
    </main>
  );
}
