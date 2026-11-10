import type { ReactNode } from "react";

/** No register download or district count request is made until the backend enforces scope. */
export function DistrictsPage(): ReactNode {
  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          District coverage
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Geographic coverage &amp; reach</h1>
        <p className="mt-1 text-sm text-slate-600">
          District-level programme coverage is unavailable.
        </p>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">District aggregates unavailable</h2>
        <p className="mt-2">
          The current count endpoints trust a caller-supplied district and do not enforce the
          signed-in user’s jurisdiction. The legacy page also downloads the national household
          register to build its table. This page makes no such request until a caller-authorized
          aggregate endpoint is available.
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="font-semibold">Count definitions need alignment</h2>
        <p className="mt-2">
          Existing household counts and VCA counts use different active/archived definitions. The
          detailed legacy export also contains household and caregiver details, so it is not
          included in this scaffold. No district totals or exports are shown.
        </p>
      </section>
    </main>
  );
}
