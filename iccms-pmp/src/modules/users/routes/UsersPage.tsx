import type { ReactNode } from "react";

/** No user or role reads and no account actions until backend authorization is verified. */
export function UsersPage(): ReactNode {
  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Administration
        </p>
        <h1 className="mt-1 text-2xl font-semibold">User management</h1>
        <p className="mt-1 text-sm text-slate-600">Account administration is unavailable.</p>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">User directory unavailable</h2>
        <p className="mt-2">
          The existing user endpoints do not provide verified server-side authorization for listing
          and changing accounts. This scaffold makes no user or role requests and provides no
          account actions until those permissions are enforced by the backend.
        </p>
      </section>
    </main>
  );
}
