import type { ReactNode } from "react";

/** No request is made here: the legacy collection endpoint returns unscoped flags. */
export function FlagsPage(): ReactNode {
  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data quality</p>
        <h1 className="mt-1 text-2xl font-semibold">Flags</h1>
        <p className="mt-1 text-sm text-slate-600">Flag review is not available yet.</p>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">Flag register unavailable</h2>
        <p className="mt-2">
          The backend list endpoint does not enforce the caller’s district or province scope, and
          flag records do not contain reliable district or province fields for safe filtering. This
          page intentionally does not request or display flag records. It can be enabled after the
          backend provides and enforces a scoped list endpoint.
        </p>
      </section>
    </main>
  );
}
