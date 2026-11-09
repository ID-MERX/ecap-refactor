import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/core/auth";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { pmtctProfileQuery } from "../api/queries";
import type { PmtctRecord } from "../api/schemas";

function Field({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function display(value: string | null): string {
  return value ?? "N/A";
}

export function PmtctProfilePage(): ReactNode {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const selectedDistrict = params.get("district") ?? undefined;
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const query = useQuery(pmtctProfileQuery(scope, window, id, selectedDistrict));
  const mother = query.data?.mother;
  const infants = query.data?.infants ?? [];

  if (scope.level === "none")
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">
          This PMTCT record is not available in your access scope.
        </h1>
      </main>
    );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link to="/pmtct" className="w-fit text-sm text-brand-700 underline">
        ← Back to PMTCT register
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          PMTCT profile · {window.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {mother?.beneficiaryName ?? "Mother and infant record"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          PMTCT ID: {mother?.clientId ?? id} · {mother?.district ?? "District unavailable"}
        </p>
      </header>
      {query.isLoading ? (
        <p role="status" className="rounded-lg border bg-white p-4">
          Loading scoped PMTCT record…
        </p>
      ) : null}
      {query.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          The PMTCT record could not be loaded. Please retry.
        </p>
      ) : null}
      {!query.isLoading && !query.isError && !mother ? (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold">Record not found</h2>
          <p className="mt-2 text-sm text-slate-600">
            No PMTCT mother with this ID was found in your permitted districts.
          </p>
        </section>
      ) : null}
      {mother ? (
        <>
          <section className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">HIV status</p>
                <h2 className="mt-1 text-xl font-semibold">HIV Positive</h2>
              </div>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-medium text-rose-800">
                Mother · PMTCT
              </span>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="PMTCT ID" value={mother.pmtctId} />
              <Field label="Beneficiary ID" value={mother.ecapId} />
              <Field label="Household ID" value={mother.householdId} />
              <Field label="Beneficiary name" value={mother.beneficiaryName} />
              <Field label="Age" value={mother.age} />
              <Field label="Sex" value={mother.sex} />
              <Field label="Phone" value={mother.phone} />
              <Field label="Home address" value={mother.homeAddress} />
              <Field label="Nearest landmark" value={mother.landmark} />
              <Field label="Partner" value={mother.partner} />
              <Field label="Relation" value={mother.relation} />
              <Field label="Caseworker" value={mother.caseworker} />
              <Field label="Province" value={mother.province} />
              <Field label="District" value={mother.district} />
              <Field label="Facility" value={mother.facility} />
              <Field label="Date enrolled in PMTCT" value={display(mother.enrolledDate)} />
              <Field label="Date initiated ART" value={display(mother.artStartDate)} />
              <Field label="Date tested" value={display(mother.dateTested)} />
            </dl>
          </section>
          <section className="overflow-x-auto rounded-xl border bg-white">
            <div className="p-4">
              <h2 className="font-semibold">Linked HIV-exposed infants</h2>
              <p className="mt-1 text-sm text-slate-500">
                Scoped child-register rows matched by shared PMTCT ID.
              </p>
            </div>
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {["Infant ID", "Outcome", "DBS date", "ART start", "Facility", "District"].map(
                    (label) => (
                      <th key={label} className="px-3 py-3">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {infants.map((infant: PmtctRecord, index: number) => (
                  <tr key={`${infant.rowId}:${index}`}>
                    <td className="px-3 py-3 font-medium">{infant.clientId || infant.rowId}</td>
                    <td className="px-3 py-3">{infant.infantOutcome}</td>
                    <td className="px-3 py-3">{display(infant.dbsDate)}</td>
                    <td className="px-3 py-3">{display(infant.artStartDate)}</td>
                    <td className="px-3 py-3">{infant.facility}</td>
                    <td className="px-3 py-3">{infant.district}</td>
                  </tr>
                ))}
                {infants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                      No linked HEI rows found in your permitted districts.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
          {query.data?.truncatedDistricts.length ? (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              One or more scoped district lists exceeded the retained-row cap; linked infant results
              may be incomplete. The backend endpoint is currently unpaginated.
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
