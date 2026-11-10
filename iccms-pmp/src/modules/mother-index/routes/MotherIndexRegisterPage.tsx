import { useDeferredValue, useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { programConfig, siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import type { ColumnDef } from "@/platform/data-table/types";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { allowedMotherDistricts } from "../api/client";
import { motherRegisterQuery } from "../api/queries";
import type { MotherAnswer, MotherRecord } from "../api/schemas";
import { distinctMothers, filterMothers, sortMothers } from "../model/register";

const PAGE_SIZE = 25;
const EMPTY_ROWS: ReadonlyArray<MotherRecord> = [];
type FilterKey = "hei" | "hiv" | "onArt" | "linked";
type FilterValue = MotherAnswer | "all";
const FILTERS: ReadonlyArray<{
  key: FilterKey;
  param: string;
  label: string;
}> = [
  { key: "hei", param: "hei", label: "HEI Status" },
  { key: "hiv", param: "hiv", label: "HIV Status" },
  { key: "onArt", param: "art", label: "On ART" },
  { key: "linked", param: "linked", label: "Linked" },
];
const CSV_COLUMNS: ReadonlyArray<ColumnDef<MotherRecord>> = [
  { id: "motherId", header: "Mother ID", meta: { field: "motherId", label: "Mother ID" } },
  { id: "district", header: "District", meta: { field: "district", label: "District" } },
  { id: "facility", header: "Facility", meta: { field: "facility", label: "Facility" } },
  { id: "hivStatus", header: "HIV Status", meta: { field: "hivStatus", label: "HIV Status" } },
  { id: "artStatus", header: "ART Status", meta: { field: "artStatus", label: "ART Status" } },
  { id: "heiStatus", header: "HEI Status", meta: { field: "heiStatus", label: "HEI Status" } },
  {
    id: "linkageStatus",
    header: "Linkage Status",
    meta: { field: "linkageStatus", label: "Linkage Status" },
  },
];

function filterValue(value: string | null): FilterValue {
  return value === "yes" || value === "no" || value === "unknown" ? value : "all";
}

function count(value: number): string {
  return value.toLocaleString();
}

export function MotherIndexRegisterPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const selectedDistrict =
    scope.level === "district" ? scope.district : (params.get("district") ?? undefined);
  const query = useQuery(motherRegisterQuery(scope, window, selectedDistrict));
  const allowedDistrictList = allowedMotherDistricts(scope);
  const rawRows = query.data?.rows ?? EMPTY_ROWS;
  const uniqueRows = useMemo(() => distinctMothers(rawRows), [rawRows]);
  const deferredSearch = useDeferredValue(params.get("q") ?? "");
  const heiFilter = filterValue(params.get("hei"));
  const hivFilter = filterValue(params.get("hiv"));
  const artFilter = filterValue(params.get("art"));
  const linkedFilter = filterValue(params.get("linked"));
  const filters = useMemo(
    () => ({ hei: heiFilter, hiv: hivFilter, onArt: artFilter, linked: linkedFilter }),
    [heiFilter, hivFilter, artFilter, linkedFilter],
  );
  const filtered = useMemo(
    () => filterMothers(uniqueRows, filters, deferredSearch),
    [uniqueRows, filters, deferredSearch],
  );
  const sorted = useMemo(() => sortMothers(filtered), [filtered]);
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }
  function clearFilters() {
    const next = new URLSearchParams(params);
    for (const key of ["q", "hei", "hiv", "art", "linked", "page"]) next.delete(key);
    setParams(next, { replace: true });
  }
  function exportCsv() {
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: "mother_index",
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
          {programConfig.terms.motherIndex} is not available in your current access scope.
        </h1>
      </main>
    );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {programConfig.terms.motherIndex} register · {window.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">All registered mothers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Index mother records, category filters, and CSV export.
          </p>
        </div>
        <span className="rounded-full border bg-white px-3 py-1 text-sm">
          {count(sorted.length)} records
        </span>
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
            {allowedDistrictList.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        The platform FY/custom window ({window.label}) is sent as `from` and `to`. The current
        mother endpoint ignores those bounds until backend filtering is implemented; this page does
        not filter dates locally.
      </p>
      {query.data?.truncatedDistricts.length ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Some unpaginated district responses exceed the 20,000-row retained cap. The cap does not
          limit data transferred by the backend.
        </p>
      ) : null}
      {query.isError ? (
        <p
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Mother Index records could not be loaded.
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="rounded-md border border-red-300 px-3 py-1"
          >
            Retry
          </button>
        </p>
      ) : null}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Mother category</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {FILTERS.map((filter) => {
            const current = filters[filter.key];
            return (
              <fieldset key={filter.key} className="min-w-0">
                <legend className="mb-1 text-xs font-medium text-slate-600">{filter.label}</legend>
                <div className="flex overflow-hidden rounded-md border">
                  <button
                    type="button"
                    aria-pressed={current === "all"}
                    onClick={() => updateParam(filter.param, "all")}
                    className={`flex-1 px-2 py-2 text-xs ${current === "all" ? "bg-slate-100 font-semibold" : "bg-white"}`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    aria-pressed={current === "yes"}
                    onClick={() => updateParam(filter.param, "yes")}
                    className={`flex-1 border-l px-2 py-2 text-xs ${current === "yes" ? "bg-emerald-100 font-semibold text-emerald-900" : "bg-white"}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    aria-pressed={current === "no"}
                    onClick={() => updateParam(filter.param, "no")}
                    className={`flex-1 border-l px-2 py-2 text-xs ${current === "no" ? "bg-rose-100 font-semibold text-rose-900" : "bg-white"}`}
                  >
                    No
                  </button>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>
      <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
        <label className="flex flex-col gap-1 text-sm">
          Search by mother ID or facility
          <input
            value={params.get("q") ?? ""}
            onChange={(event) => updateParam("q", event.target.value)}
            className="min-w-64 rounded-md border px-3 py-2"
            placeholder="Mother ID or facility"
          />
        </label>
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-md border px-3 py-2 text-sm"
        >
          Clear filters
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!sorted.length}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export filtered CSV
        </button>
      </section>
      <section className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Mother ID",
                "District",
                "Facility",
                "HIV Status",
                "ART Status",
                "HEI",
                "Linked",
                "Updated",
                "Profile",
              ].map((label) => (
                <th key={label} className="px-3 py-3">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((row, index) => (
              <tr key={`${row.motherId}:${index}`} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-medium text-rose-800">{row.motherId}</td>
                <td className="px-3 py-3">{row.district}</td>
                <td className="px-3 py-3">{row.facility}</td>
                <td className="px-3 py-3">{row.hivStatus}</td>
                <td className="px-3 py-3">{row.artStatus}</td>
                <td className="px-3 py-3">{row.heiStatus}</td>
                <td className="px-3 py-3">{row.linkageStatus}</td>
                <td className="px-3 py-3">{row.updatedAt ?? "N/A"}</td>
                <td className="px-3 py-3">
                  {row.motherId !== "N/A" ? (
                    <Link
                      className="text-brand-700 underline"
                      to={`/mother-index/${encodeURIComponent(row.motherId)}${selectedDistrict ? `?district=${encodeURIComponent(selectedDistrict)}` : ""}`}
                    >
                      Details
                    </Link>
                  ) : (
                    <span className="text-slate-400">Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
            {!query.isLoading && !query.isError && visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-slate-500">
                  No mother records match this selection.
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
    </main>
  );
}
