import type { ReactNode } from "react";
import { useParams } from "react-router";

/** A placeholder only: the backend has no scoped profile-by-username endpoint yet. */
export function CaseworkerProfilePage(): ReactNode {
  const { caseworkerId } = useParams();
  const hasId = Boolean(caseworkerId?.trim());
  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Caseworkers</p>
        <h1 className="mt-1 text-2xl font-semibold">Caseworker profile</h1>
      </header>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">
          {hasId ? "Caseworker profile unavailable" : "No caseworker selected"}
        </h2>
        <p className="mt-2">
          Profiles will use the stable OpenSRP username as the route ID. The backend does not yet
          provide a caller-scoped profile endpoint, so this page does not fetch national household
          or service tables or resolve a profile by display name.
        </p>
      </section>
    </main>
  );
}
