import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/core/auth";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { htsRecordQuery } from "../api/queries";
import { isHtsArtLinked } from "../api/schemas";

function Field({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export function HtsProfilePage(): ReactNode {
  const { clientId = "" } = useParams();
  const { state } = useAuth();
  const fyWindow = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const query = useQuery(htsRecordQuery(scope, clientId));
  const record = query.data?.rows.find(
    (row) => row.clientId.toLowerCase() === clientId.toLowerCase(),
  );

  if (scope.level === "none")
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">
          This HTS record is not available in your access scope.
        </h1>
      </main>
    );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link to="/hts" className="w-fit text-sm text-brand-700 underline">
        ← Back to HTS register
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          HTS profile · {fyWindow.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Individual tested · name hidden for privacy</h1>
        <p className="mt-1 text-sm text-slate-600">Case ID: {clientId}</p>
      </header>
      {query.isLoading ? (
        <p role="status" className="rounded-lg border bg-white p-4">
          Loading scoped HTS record…
        </p>
      ) : null}
      {query.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          The HTS record could not be loaded. Retry from the register.
        </p>
      ) : null}
      {!query.isLoading && !query.isError && !record ? (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold">Record not found</h2>
          <p className="mt-2 text-sm text-slate-600">
            No HTS record with this ID was found in your permitted districts.
            {query.data?.truncatedDistricts.length
              ? " The matching row may fall beyond the client-retained cap; use the register or request a scoped backend by-ID endpoint."
              : ""}
          </p>
        </section>
      ) : null}
      {record ? (
        <>
          <section className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">HIV result</p>
                <h2 className="mt-1 text-xl font-semibold">{record.resultText}</h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${record.result === "positive" ? "bg-rose-100 text-rose-800" : record.result === "negative" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
              >
                {record.result === "positive"
                  ? "Positive"
                  : record.result === "negative"
                    ? "Negative"
                    : "Pending / unknown"}
              </span>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Case ID" value={record.clientId} />
              <Field label="Client type" value={record.clientType} />
              <Field label="Test date" value={record.testDate} />
              <Field label="Recorded date" value={record.recordDate ?? "Date unavailable"} />
              <Field label="Facility" value={record.facility} />
              <Field label="District" value={record.district} />
              <Field label="Testing modality" value={record.testingModality} />
              <Field label="Entry point" value={record.entryPoint} />
              <Field
                label="ART linkage"
                value={isHtsArtLinked(record) ? "Link recorded" : "No link recorded"}
              />
              <Field label="ART date" value={record.artDate} />
              <Field label="ART number" value={record.artNumber} />
              <Field label="Sub-population" value={record.subPopulation} />
            </dl>
          </section>
          {query.data?.truncatedDistricts.length ? (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              This profile lookup uses the capped district register result. Exact server-side by-ID
              lookup remains a backend follow-up.
            </p>
          ) : null}
        </>
      ) : null}
      <p className="text-xs text-slate-500">
        Personal names, phone numbers, addresses, caseworker names, free-text comments, and raw
        joined payloads are intentionally excluded.
      </p>
    </main>
  );
}
