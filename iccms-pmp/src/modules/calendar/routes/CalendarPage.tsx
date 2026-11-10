import type { ReactNode } from "react";

/** No event reads, writes, reminders, or notifications until per-user backend ownership is verified. */
export function CalendarPage(): ReactNode {
  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overview</p>
        <h1 className="mt-1 text-2xl font-semibold">Calendar</h1>
        <p className="mt-1 text-sm text-slate-600">
          Personal events and reminders are unavailable.
        </p>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">Calendar unavailable</h2>
        <p className="mt-2">
          The current Directus collection permissions have not been verified, and its create policy
          may allow one user to assign events to another. This scaffold makes no calendar requests
          and does not run reminder polling or browser notifications until ownership is enforced by
          the backend.
        </p>
      </section>
    </main>
  );
}
