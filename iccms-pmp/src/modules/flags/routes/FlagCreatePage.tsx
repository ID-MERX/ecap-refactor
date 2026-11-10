import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";

import { householdFlagContextQuery, type HouseholdFlagContext } from "@/modules/households";
import { vcaFlagContextQuery, type VcaFlagContext } from "@/modules/vcas";
import { useAuth } from "@/core/auth";

import { flagContextTarget } from "../model/context";

function ContextDetails({
  context,
}: {
  context: HouseholdFlagContext | VcaFlagContext;
}): ReactNode {
  const isHousehold = "householdId" in context && "facility" in context && !("vcaId" in context);
  const rows = isHousehold
    ? [
        ["Household ID", context.householdId],
        ["District", context.district],
        ["Province", context.province],
        ["Facility", context.facility],
      ]
    : [
        ["VCA ID", (context as VcaFlagContext).vcaId],
        ["Household ID", context.householdId],
        ["District", context.district],
        ["Province", context.province],
        ["Facility", context.facility],
      ];
  return (
    <dl className="mt-4 grid gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-medium">{value || "Unavailable"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FlagCreatePage(): ReactNode {
  const [params] = useSearchParams();
  const { state } = useAuth();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const target = flagContextTarget(params.get("householdId"), params.get("vcaId"));
  const householdQuery = useQuery(
    householdFlagContextQuery(scope, target.kind === "household" ? target.id : ""),
  );
  const vcaQuery = useQuery(vcaFlagContextQuery(scope, target.kind === "vca" ? target.id : ""));

  const selectedQuery =
    target.kind === "household" ? householdQuery : target.kind === "vca" ? vcaQuery : null;
  const context = selectedQuery?.data ?? null;

  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data quality</p>
        <h1 className="mt-1 text-2xl font-semibold">Flag a record</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record context is resolved from the user’s scoped household or VCA register.
        </p>
      </header>
      {!target.kind ? (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">No record selected</h2>
          <p className="mt-2 text-sm text-slate-600">
            Open this page with exactly one householdId or vcaId query parameter. A record is only
            shown when it is present in the current user’s scoped register.
          </p>
          <Link to="/households" className="mt-4 inline-block text-sm font-medium text-brand-700">
            Go to households
          </Link>
        </section>
      ) : selectedQuery?.isLoading ? (
        <p role="status" className="rounded-lg border bg-white p-5 text-sm text-slate-600">
          Checking the selected record in your assigned scope…
        </p>
      ) : selectedQuery?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800"
        >
          The scoped record context could not be loaded. Try again from its register or contact an
          administrator.
        </p>
      ) : context ? (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Selected record</h2>
          <ContextDetails context={context} />
        </section>
      ) : (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Record not found in your scope</h2>
          <p className="mt-2 text-sm text-slate-600">
            The selected ID was not found in the current user’s assigned register. No direct by-ID
            request was made.
          </p>
        </section>
      )}
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
        <h2 className="font-semibold">Flag submission unavailable</h2>
        <p className="mt-2">
          The backend mutation endpoint does not yet enforce caller scope and write permissions.
          This scaffold does not submit or persist flag content until that backend support is
          available.
        </p>
      </section>
    </main>
  );
}
