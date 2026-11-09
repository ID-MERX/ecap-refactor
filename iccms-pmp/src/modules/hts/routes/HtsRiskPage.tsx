import { useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import type { ColumnDef } from "@/platform/data-table/types";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { allowedHtsDistricts } from "../api/client";
import { htsRegisterQuery } from "../api/queries";
import { HTS_RISK_TYPES, isHtsRiskType, type HtsRecord } from "../api/schemas";
import { selectHtsRiskRows, selectHtsWindow, sortHtsRows } from "../model/register";

const PAGE_SIZE = 25;
const RESULT_OPTIONS = ["all", "positive", "negative", "pending"] as const;
type ResultOption = (typeof RESULT_OPTIONS)[number];

const CSV_COLUMNS: ReadonlyArray<ColumnDef<HtsRecord>> = [
  { id: "clientId", header: "Case ID", meta: { field: "clientId", label: "Case ID" } },
  { id: "resultText", header: "HIV status", meta: { field: "resultText", label: "HIV status" } },
  { id: "artDate", header: "ART date", meta: { field: "artDate", label: "ART date" } },
  { id: "artNumber", header: "ART number", meta: { field: "artNumber", label: "ART number" } },
  {
    id: "testingModality",
    header: "Modality",
    meta: { field: "testingModality", label: "Modality" },
  },
  { id: "facility", header: "Facility", meta: { field: "facility", label: "Facility" } },
  { id: "district", header: "District", meta: { field: "district", label: "District" } },
  { id: "recordDate", header: "Record date", meta: { field: "recordDate", label: "Record date" } },
];

export function HtsRiskPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const selectedDistrict =
    scope.level === "district" ? scope.district : (params.get("district") ?? undefined);
  const query = useQuery(htsRegisterQuery(scope, selectedDistrict));
  const requestedType = params.get("type") ?? "all";
  const riskType = isHtsRiskType(requestedType) ? requestedType : "all";
  const requestedResult = params.get("result") ?? "all";
  const resultFilter: ResultOption = RESULT_OPTIONS.includes(requestedResult as ResultOption)
    ? (requestedResult as ResultOption)
    : "all";
  const search = params.get("q")?.trim().toLowerCase() ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const allowedDistrictsList = allowedHtsDistricts(scope);
  const fyRows = useMemo(
    () => selectHtsWindow(query.data?.rows ?? [], window),
    [query.data, window],
  );
  const categoryRows = useMemo(() => selectHtsRiskRows(fyRows, riskType), [fyRows, riskType]);
  const filtered = useMemo(
    () =>
      sortHtsRows(
        categoryRows.filter((row) => {
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
          ].some((value) => value.toLowerCase().includes(search));
        }),
      ),
    [categoryRows, resultFilter, search],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedType = HTS_RISK_TYPES.find((item) => item.value === riskType)!;

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
        table: `hts_${riskType}`,
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
      toCsv(filtered, CSV_COLUMNS),
    );
  }

  if (scope.level === "none")
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">
          HTS risk records are not available in your current access scope.
        </h1>
      </main>
    );

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/hts" className="text-sm text-brand-700 underline">
            ← HTS register
          </Link>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            HTS risk register · {window.label}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{selectedType.label.trim()}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {selectedType.description} · {filtered.length.toLocaleString()} records
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export filtered CSV
        </button>
      </header>
      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District scope is fixed: <strong>{scope.district}</strong>
        </p>
      ) : null}
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        Risk results use the platform FY/custom window ({window.label}). The backend does not apply
        FY to this endpoint, so the selected record date is filtered locally.
      </p>
      {query.data?.truncatedDistricts.length ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Retained rows are capped at 20,000 per district (
          {query.data.truncatedDistricts.join(", ")}); the backend response itself is unpaginated.
        </p>
      ) : null}
      {query.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          HTS risk records could not be loaded. Please retry.
        </p>
      ) : null}
      <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3">
        <label className="flex flex-col gap-1 text-sm">
          Risk category
          <select
            value={riskType}
            onChange={(event) => updateParam("type", event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            {HTS_RISK_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label.trim()}
              </option>
            ))}
          </select>
        </label>
        {scope.level !== "district" ? (
          <label className="flex flex-col gap-1 text-sm">
            District
            <select
              value={selectedDistrict ?? ""}
              onChange={(event) => updateParam("district", event.target.value)}
              className="rounded-md border bg-white px-3 py-2"
            >
              <option value="">All permitted districts</option>
              {allowedDistrictsList.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Result
          <select
            value={resultFilter}
            onChange={(event) => updateParam("result", event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            <option value="all">Any result</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="pending">Pending / unknown</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Search case ID or facility
          <input
            value={params.get("q") ?? ""}
            onChange={(event) => updateParam("q", event.target.value)}
            className="min-w-56 rounded-md border px-3 py-2"
            placeholder="Case ID or facility"
          />
        </label>
      </section>
      <section className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Case ID",
                "HIV status",
                "ART date",
                "Modality",
                "Facility",
                "District",
                "Record date",
                "Profile",
              ].map((heading) => (
                <th key={heading} className="px-3 py-3">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((row, index) => (
              <tr key={`${row.rowId}:${row.recordDate ?? "undated"}:${row.testDate}:${index}`}>
                <td className="px-3 py-3 font-medium">{row.clientId || row.rowId}</td>
                <td className="px-3 py-3">{row.resultText}</td>
                <td className="px-3 py-3">{row.artDate}</td>
                <td className="px-3 py-3">{row.testingModality}</td>
                <td className="px-3 py-3">{row.facility}</td>
                <td className="px-3 py-3">{row.district}</td>
                <td className="px-3 py-3">{row.recordDate ?? "Undated"}</td>
                <td className="px-3 py-3">
                  {row.clientId ? (
                    <Link
                      className="text-brand-700 underline"
                      to={`/hts/${encodeURIComponent(row.clientId)}`}
                    >
                      Details
                    </Link>
                  ) : (
                    <span className="text-slate-400">Unavailable</span>
                  )}
                </td>
              </tr>
            ))}
            {!query.isLoading && visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                  No HTS records match this risk view and filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <footer className="flex items-center justify-between text-sm">
        <span>
          {filtered.length.toLocaleString()} records · Page {safePage} of {pages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => updateParam("page", String(safePage - 1))}
            className="rounded border bg-white px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={safePage >= pages}
            onClick={() => updateParam("page", String(safePage + 1))}
            className="rounded border bg-white px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </footer>
      <p className="text-xs text-slate-500">
        Names, phone numbers, addresses, caseworker names, comments, and raw joined fields are
        omitted from the view and export.
      </p>
    </main>
  );
}
