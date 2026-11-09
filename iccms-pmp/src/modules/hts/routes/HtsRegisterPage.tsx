import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import type { ColumnDef } from "@/platform/data-table/types";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { allowedHtsDistricts } from "../api/client";
import { htsRegisterQuery } from "../api/queries";
import type { HtsRecord } from "../api/schemas";
import {
  calculateHtsMetrics,
  htsDistrictMetrics,
  selectHtsWindow,
  sortHtsRows,
} from "../model/register";

const PAGE_SIZE = 25;
type Tab = "register" | "charts";
type ResultFilter = "all" | "positive" | "negative" | "pending";

const CSV_COLUMNS: ReadonlyArray<ColumnDef<HtsRecord>> = [
  { id: "clientId", header: "Case ID", meta: { field: "clientId", label: "Case ID" } },
  { id: "clientType", header: "Type", meta: { field: "clientType", label: "Type" } },
  { id: "resultText", header: "HIV result", meta: { field: "resultText", label: "HIV result" } },
  { id: "facility", header: "Facility", meta: { field: "facility", label: "Facility" } },
  { id: "district", header: "District", meta: { field: "district", label: "District" } },
  { id: "testDate", header: "Test date", meta: { field: "testDate", label: "Test date" } },
  {
    id: "testingModality",
    header: "Modality",
    meta: { field: "testingModality", label: "Modality" },
  },
  { id: "entryPoint", header: "Entry point", meta: { field: "entryPoint", label: "Entry point" } },
  { id: "artDate", header: "ART date", meta: { field: "artDate", label: "ART date" } },
  { id: "artNumber", header: "ART number", meta: { field: "artNumber", label: "ART number" } },
];

function count(value: number): string {
  return value.toLocaleString();
}

export function HtsRegisterPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("register");
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const district =
    scope.level === "district" ? scope.district : (params.get("district") ?? undefined);
  const query = useQuery(htsRegisterQuery(scope, district));
  const allowedDistrictsList = allowedHtsDistricts(scope);
  const allowedSelection =
    district && allowedHtsDistricts(scope, district).length ? district : undefined;
  const fyRows = useMemo(
    () => selectHtsWindow(query.data?.rows ?? [], window),
    [query.data, window],
  );
  const metrics = useMemo(() => calculateHtsMetrics(fyRows), [fyRows]);
  const districtMetrics = useMemo(() => htsDistrictMetrics(fyRows), [fyRows]);
  const search = params.get("q")?.trim().toLowerCase() ?? "";
  const requestedResult = params.get("result") ?? "all";
  const resultFilter: ResultFilter =
    requestedResult === "positive" ||
    requestedResult === "negative" ||
    requestedResult === "pending"
      ? requestedResult
      : "all";
  const filtered = useMemo(() => {
    const matching = fyRows.filter((row) => {
      if (resultFilter === "positive" && row.result !== "positive") return false;
      if (resultFilter === "negative" && row.result !== "negative") return false;
      if (resultFilter === "pending" && row.result !== "pending" && row.result !== "unknown")
        return false;
      if (!search) return true;
      return [
        row.clientId,
        row.clientNumber,
        row.ecapId,
        row.facility,
        row.district,
        row.resultText,
        row.testingModality,
        row.entryPoint,
      ].some((value) => value.toLowerCase().includes(search));
    });
    return sortHtsRows(matching);
  }, [fyRows, resultFilter, search]);
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(
    (Math.min(page, pages) - 1) * PAGE_SIZE,
    Math.min(page, pages) * PAGE_SIZE,
  );
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
        table: "hts_register",
        scope:
          scope.level === "district"
            ? scope.district
            : scope.level === "province"
              ? scope.province
              : (allowedSelection ?? "all_districts"),
        period: window.slug,
        date: new Date().toISOString().slice(0, 10),
        extension: "csv",
      }),
      toCsv(filtered, CSV_COLUMNS),
    );
  }

  if (scope.level === "none")
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">
          HTS is not available in your current access scope.
        </h1>
      </main>
    );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            HTS register · {window.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">HIV testing services</h1>
          <p className="mt-1 text-sm text-slate-600">
            Testing, results, and ART linkage outcomes · {count(metrics.total)} tests in the
            selected window
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("register")}
            aria-pressed={tab === "register"}
            className={`rounded-md border px-3 py-2 text-sm ${tab === "register" ? "border-brand-600 bg-brand-50" : "bg-white"}`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setTab("charts")}
            aria-pressed={tab === "charts"}
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
          District filter
          <select
            value={district ?? ""}
            onChange={(event) => updateParam("district", event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            <option value="">All permitted districts</option>
            {allowedDistrictsList.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        The platform FY/custom window ({window.label}) applies to the register, charts, risk views,
        and export. HTS dates are filtered client-side because the endpoint does not support
        FY/custom parameters.
      </p>
      {query.data?.truncatedDistricts.length ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Retained HTS rows are capped at 20,000 per district (
          {query.data.truncatedDistricts.join(", ")}). The backend still transfers each district
          response without pagination; results may be incomplete.
        </p>
      ) : null}
      {query.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          The HTS register could not be loaded. Please retry.
        </p>
      ) : null}
      {tab === "charts" ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Total tested", metrics.total, "all"],
              ["HIV positive", metrics.positives, "positive"],
              ["Positive not linked to ART", metrics.positivesNotOnArt, "unlinked"],
              ["HIV negative", metrics.negatives, "negative"],
              ["Pending or unknown", metrics.pending, "pending"],
            ].map(([label, value, key]) => (
              <Link
                key={String(label)}
                to={
                  key === "unlinked"
                    ? "/hts/risk?type=unlinked"
                    : key === "positive" || key === "negative"
                      ? `/hts/risk?type=all&result=${key}`
                      : key === "all"
                        ? "/hts/risk?type=all"
                        : "/hts/risk?type=pending"
                }
                className="rounded-xl border bg-white p-4 hover:border-brand-300"
              >
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{count(Number(value))}</p>
              </Link>
            ))}
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold">Testing volume and positives by district</h2>
              <div className="mt-4 space-y-3">
                {districtMetrics.map((item) => (
                  <div
                    key={item.district}
                    className="grid grid-cols-[minmax(5rem,1fr)_3rem_3rem] items-center gap-3 text-sm"
                  >
                    <span>{item.district}</span>
                    <span className="text-right tabular-nums">{count(item.tests)}</span>
                    <span className="text-right tabular-nums text-rose-700">
                      {count(item.positives)}+
                    </span>
                  </div>
                ))}
                {districtMetrics.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No HTS rows are available in this window.
                  </p>
                ) : null}
              </div>
            </article>
            <article className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold">Yield by district</h2>
              <div className="mt-4 space-y-3">
                {districtMetrics.map((item) => (
                  <div
                    key={item.district}
                    className="grid grid-cols-[minmax(5rem,1fr)_1fr_3rem] items-center gap-3 text-sm"
                  >
                    <span>{item.district}</span>
                    <div className="h-3 overflow-hidden rounded bg-slate-100">
                      <div
                        className="h-full rounded bg-brand-600"
                        style={{ width: `${Math.min(100, item.yieldPct)}%` }}
                      />
                    </div>
                    <span className="text-right tabular-nums">{item.yieldPct}%</span>
                  </div>
                ))}
                {districtMetrics.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No HTS rows are available in this window.
                  </p>
                ) : null}
              </div>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
            <label className="flex flex-col gap-1 text-sm">
              Search by case ID, facility, or service detail
              <input
                value={params.get("q") ?? ""}
                onChange={(event) => updateParam("q", event.target.value)}
                className="min-w-64 rounded-md border px-3 py-2"
                placeholder="Case ID or facility"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Result
              <select
                value={resultFilter}
                onChange={(event) => updateParam("result", event.target.value)}
                className="rounded-md border bg-white px-3 py-2"
              >
                <option value="all">All results</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="pending">Pending / unknown</option>
              </select>
            </label>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Export filtered CSV
            </button>
            <Link to="/hts/risk" className="rounded-md border bg-white px-4 py-2 text-sm">
              Risk register
            </Link>
          </section>
          <section className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Case ID",
                    "Type",
                    "HIV result",
                    "Facility / District",
                    "Test date",
                    "Modality",
                    "ART link",
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((row, index) => (
                  <tr
                    key={`${row.rowId}:${row.recordDate ?? "undated"}:${row.testDate}:${index}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 font-medium">
                      {row.clientId ? (
                        <Link
                          className="text-brand-700 underline"
                          to={`/hts/${encodeURIComponent(row.clientId)}`}
                        >
                          {row.clientId}
                        </Link>
                      ) : (
                        row.rowId
                      )}
                    </td>
                    <td className="px-3 py-3">{row.clientType}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${row.result === "positive" ? "bg-rose-100 text-rose-800" : row.result === "negative" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
                      >
                        {row.resultText}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {row.facility}
                      <span className="block text-xs text-slate-500">{row.district}</span>
                    </td>
                    <td className="px-3 py-3">{row.testDate}</td>
                    <td className="px-3 py-3">{row.testingModality}</td>
                    <td className="px-3 py-3">
                      {row.artDate !== "N/A" || row.artNumber !== "N/A"
                        ? "Linked"
                        : "No link recorded"}
                    </td>
                  </tr>
                ))}
                {!query.isLoading && visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-12 text-center text-slate-500">
                      No HTS records match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
          <footer className="flex items-center justify-between text-sm">
            <span>
              {count(filtered.length)} records · Page {Math.min(page, pages)} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateParam("page", String(page - 1))}
                className="rounded border bg-white px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => updateParam("page", String(page + 1))}
                className="rounded border bg-white px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </footer>
        </>
      )}
      <p className="text-xs text-slate-500">
        Names, phone numbers, addresses, caseworker names, comments, and raw joined fields are not
        displayed or exported.
      </p>
    </main>
  );
}
