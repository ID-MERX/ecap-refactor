import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import type { ColumnDef } from "@/platform/data-table/types";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { allowedPmtctDistricts } from "../api/client";
import { pmtctInfantsQuery, pmtctMothersQuery } from "../api/queries";
import type { PmtctRecord } from "../api/schemas";
import {
  calculatePmtctMetrics,
  pmtctDistrictOutcomes,
  pmtctEnrollmentTrend,
  pmtctFacilityMetrics,
  searchPmtctRows,
} from "../model/register";

const PAGE_SIZE = 25;
const EMPTY_ROWS: ReadonlyArray<PmtctRecord> = [];
type Tab = "register" | "charts";
const CSV_COLUMNS: ReadonlyArray<ColumnDef<PmtctRecord>> = [
  { id: "clientId", header: "PMTCT ID", meta: { field: "clientId", label: "PMTCT ID" } },
  { id: "clientType", header: "Type", meta: { field: "clientType", label: "Type" } },
  {
    id: "hivStatusText",
    header: "HIV Status",
    meta: { field: "hivStatusText", label: "HIV Status" },
  },
  {
    id: "enrolledDate",
    header: "Enrolment date",
    meta: { field: "enrolledDate", label: "Enrolment date" },
  },
  { id: "facility", header: "Facility", meta: { field: "facility", label: "Facility" } },
  { id: "district", header: "District", meta: { field: "district", label: "District" } },
];

function count(value: number): string {
  return value.toLocaleString();
}

function BarList({
  title,
  rows,
}: {
  title: string;
  rows: ReadonlyArray<{ label: string; value: number }>;
}): ReactNode {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(6rem,1fr)_2fr_3rem] items-center gap-3 text-sm"
          >
            <span className="truncate" title={row.label}>
              {row.label}
            </span>
            <div className="h-3 overflow-hidden rounded bg-slate-100">
              <div
                className="h-full rounded bg-brand-600"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </div>
            <span className="text-right tabular-nums">{count(row.value)}</span>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No chart data for this selection.</p>
        ) : null}
      </div>
    </section>
  );
}

export function PmtctRegisterPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("register");
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const selectedDistrict =
    scope.level === "district" ? scope.district : (params.get("district") ?? undefined);
  const mothersQuery = useQuery(pmtctMothersQuery(scope, window, selectedDistrict));
  const infantsQuery = useQuery(pmtctInfantsQuery(scope, window, selectedDistrict));
  const permittedDistricts = allowedPmtctDistricts(scope);
  const search = params.get("q") ?? "";
  const allMothers = mothersQuery.data?.rows ?? EMPTY_ROWS;
  const filtered = useMemo(() => searchPmtctRows(allMothers, search), [allMothers, search]);
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          (b.enrolledDate ?? "").localeCompare(a.enrolledDate ?? "") ||
          a.clientId.localeCompare(b.clientId),
      ),
    [filtered],
  );
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const infants = infantsQuery.data?.rows ?? [];
  const metrics = calculatePmtctMetrics(sorted, infants);
  const outcomes = pmtctDistrictOutcomes(infants);
  const facilities = pmtctFacilityMetrics(sorted);
  const trend = pmtctEnrollmentTrend(sorted);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }
  function exportCsv() {
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: "pmtct_register",
        scope:
          scope.level === "district"
            ? scope.district
            : scope.level === "province"
              ? scope.province
              : (selectedDistrict ?? "all_districts"),
        period: window.slug,
        date: new Date().toISOString().slice(0, 10),
        extension: "csv",
      }),
      toCsv(sorted, CSV_COLUMNS),
    );
  }

  if (scope.level === "none")
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">
          PMTCT is not available in your current access scope.
        </h1>
      </main>
    );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            PMTCT register · {window.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Prevention of mother-to-child transmission
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Mother and infant pairs, HIV exposure, and follow-up status
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-pressed={tab === "register"}
            onClick={() => setTab("register")}
            className={`rounded-md border px-3 py-2 text-sm ${tab === "register" ? "border-brand-600 bg-brand-50" : "bg-white"}`}
          >
            Register
          </button>
          <button
            type="button"
            aria-pressed={tab === "charts"}
            onClick={() => setTab("charts")}
            className={`rounded-md border px-3 py-2 text-sm ${tab === "charts" ? "border-brand-600 bg-brand-50" : "bg-white"}`}
          >
            Charts
          </button>
        </div>
      </header>
      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District scope is fixed: <strong>{scope.district}</strong>
        </p>
      ) : (
        <label className="flex w-fit flex-col gap-1 text-sm">
          District
          <select
            value={selectedDistrict ?? ""}
            onChange={(event) => updateParam("district", event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            <option value="">All permitted districts</option>
            {permittedDistricts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        The platform FY/custom window ({window.label}) is sent to both PMTCT endpoints as `from` and
        `to`. The current backend may ignore these parameters until server-side filtering is
        deployed.
      </p>
      {[
        mothersQuery.data?.truncatedDistricts ?? [],
        infantsQuery.data?.truncatedDistricts ?? [],
      ].some((districts) => districts.length > 0) ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Some unpaginated responses exceed the 20,000 retained-row per-district cap. Data transfer
          is still unbounded by the backend.
        </p>
      ) : null}
      {mothersQuery.isError || infantsQuery.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          PMTCT data could not be loaded. Please retry.
        </p>
      ) : null}
      {tab === "charts" ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total records", metrics.mothers],
              ["Infants (HEI)", metrics.infants],
              ["Mothers", metrics.mothers],
              ["HIV positive", metrics.mothers],
            ].map(([label, value]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => setTab("register")}
                className="rounded-xl border bg-white p-4 text-left hover:border-brand-300"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{count(Number(value))}</p>
                <p className="mt-1 text-xs text-slate-400">Click to view register</p>
              </button>
            ))}
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold">Final outcomes for HEIs per district</h2>
              <p className="mt-1 text-xs text-slate-500">DBS test result at birth</p>
              <div className="mt-4 space-y-3">
                {outcomes.map((item) => (
                  <div
                    key={item.district}
                    className="grid grid-cols-[minmax(6rem,1fr)_repeat(3,3rem)] gap-2 text-sm"
                  >
                    <span>{item.district}</span>
                    <span className="text-right text-rose-700">{item.detected}</span>
                    <span className="text-right text-emerald-700">{item.notDetected}</span>
                    <span className="text-right text-amber-700">{item.pending}</span>
                  </div>
                ))}
                {outcomes.length === 0 ? (
                  <p className="text-sm text-slate-500">No HEI DBS records available.</p>
                ) : null}
              </div>
            </section>
            <BarList
              title="Top facilities by caseload"
              rows={facilities.map(({ facility, count: value }) => ({ label: facility, value }))}
            />
            <BarList
              title="Enrolment trend · last six months with data"
              rows={trend.map(({ month, count: value }) => ({ label: month, value }))}
            />
            <BarList
              title="Beneficiary type distribution"
              rows={[
                { label: "Mothers", value: metrics.mothers },
                { label: "Infants (HEI)", value: metrics.infants },
              ]}
            />
          </section>
        </>
      ) : (
        <>
          <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
            <label className="flex flex-col gap-1 text-sm">
              Search by ID, household ID or facility
              <input
                value={search}
                onChange={(event) => updateParam("q", event.target.value)}
                className="min-w-72 rounded-md border px-3 py-2"
                placeholder="ID, household ID or facility"
              />
            </label>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!sorted.length}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Export CSV
            </button>
          </section>
          <section className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "PMTCT ID",
                    "Type",
                    "HIV status",
                    "Enrolment date",
                    "Facility",
                    "District",
                    "Profile",
                  ].map((title) => (
                    <th key={title} className="px-3 py-3">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((row, index) => (
                  <tr key={`${row.rowId}:${index}`} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-medium">{row.clientId || row.rowId}</td>
                    <td className="px-3 py-3">Mother</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">
                        HIV Positive
                      </span>
                    </td>
                    <td className="px-3 py-3">{row.enrolledDate ?? "N/A"}</td>
                    <td className="px-3 py-3">{row.facility}</td>
                    <td className="px-3 py-3">{row.district}</td>
                    <td className="px-3 py-3">
                      {row.clientId ? (
                        <Link
                          className="text-brand-700 underline"
                          to={`/pmtct/${encodeURIComponent(row.clientId)}${selectedDistrict ? `?district=${encodeURIComponent(selectedDistrict)}` : ""}`}
                        >
                          Details
                        </Link>
                      ) : (
                        <span className="text-slate-400">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!mothersQuery.isLoading && visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-slate-500">
                      No PMTCT mother records match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
          <footer className="flex items-center justify-between text-sm">
            <span>
              Showing {sorted.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–
              {Math.min(safePage * PAGE_SIZE, sorted.length)} of {count(sorted.length)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => updateParam("page", String(safePage - 1))}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-2 py-1">
                Page {safePage} of {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => updateParam("page", String(safePage + 1))}
                className="rounded-md border px-3 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
