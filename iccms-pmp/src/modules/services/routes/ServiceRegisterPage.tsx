import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { useFyWindow } from "@/platform/scope/FyProvider";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import type { ColumnDef } from "@/platform/data-table/types";

import {
  districtsForServicesScope,
  fetchServiceExportRows,
  SERVICE_EXPORT_CAP,
  SERVICE_MERGE_CAP_PER_DISTRICT,
  serviceDistrictsForFilter,
} from "../api/client";
import { serviceRecordsQuery, serviceSummaryQuery } from "../api/queries";
import {
  SERVICE_PILLARS,
  SERVICE_TYPES,
  isServiceType,
  type ServiceRecord,
  type ServiceType,
} from "../api/schemas";

const ROLLING_WINDOWS = [
  { value: "all", label: "All dates" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 365 days" },
] as const;

function typeTitle(type: ServiceType): string {
  return type === "vca"
    ? "VCA services"
    : type === "household"
      ? "Household services"
      : "Caregiver services";
}

function formatCount(value: unknown): string {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString() : "—";
}

const EXPORT_COLUMNS: ReadonlyArray<ColumnDef<ServiceRecord>> = [
  { id: "type", header: "Type", meta: { field: "type", label: "Type" } },
  { id: "entityId", header: "Entity ID", meta: { field: "entityId", label: "Entity ID" } },
  { id: "district", header: "District", meta: { field: "district", label: "District" } },
  { id: "facility", header: "Facility", meta: { field: "facility", label: "Facility" } },
  {
    id: "serviceDate",
    header: "Service date",
    meta: { field: "serviceDate", label: "Service date" },
  },
  {
    id: "pillars",
    header: "Domains",
    meta: { field: "pillars", label: "Domains", exportValue: (row) => row.pillars.join("; ") },
  },
  {
    id: "serviceNames",
    header: "Services",
    meta: {
      field: "serviceNames",
      label: "Services",
      exportValue: (row) => row.serviceNames.join("; "),
    },
  },
  { id: "status", header: "Status", meta: { field: "status", label: "Status" } },
  {
    id: "issues",
    header: "Issues",
    meta: { field: "issues", label: "Issues", exportValue: (row) => row.issues.join("; ") },
  },
];

export function ServiceRegisterPage(): ReactNode {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useAuth();
  const window = useFyWindow();
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const validType = isServiceType(params.type);
  const type: ServiceType = validType ? (params.type as ServiceType) : "vca";
  const districtParam = searchParams.get("district") ?? undefined;
  const search = searchParams.get("q") ?? "";
  const issue = searchParams.get("issue") ?? "";
  const domain = searchParams.get("domain") ?? "all";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const rolling = ROLLING_WINDOWS.some(({ value }) => value === searchParams.get("days"))
    ? (searchParams.get("days") ?? "all")
    : "all";
  const selectedDistrict = scope.level === "district" ? scope.district : districtParam;
  const summaryOptions = serviceSummaryQuery(type, scope, window, selectedDistrict);
  const summary = useQuery({ ...summaryOptions, enabled: validType && summaryOptions.enabled });
  const recordOptions = serviceRecordsQuery(
    type,
    scope,
    {
      district: selectedDistrict,
      search,
      domain,
      issue: issue || undefined,
      dateWindow: rolling,
    },
    page,
    25,
  );
  const records = useQuery({ ...recordOptions, enabled: validType && recordOptions.enabled });

  const allowedDistricts = districtsForServicesScope(scope);
  const districts = [...allowedDistricts].sort((a, b) => a.localeCompare(b, "en"));
  const pillars = SERVICE_PILLARS[type];
  const summaryData = summary.data?.data ?? {};
  const rows = records.data?.rows ?? [];
  const totalPages = Math.max(1, records.data?.totalPages ?? 1);
  const validSelectedDistrict =
    selectedDistrict && serviceDistrictsForFilter(scope, selectedDistrict).length
      ? selectedDistrict
      : undefined;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next, { replace: true });
  }

  async function exportCsv() {
    setIsExporting(true);
    setExportNotice("");
    try {
      const result = await fetchServiceExportRows(type, scope, {
        district: validSelectedDistrict,
        search,
        domain,
        issue: issue || undefined,
        dateWindow: rolling,
      });
      downloadCsv(
        exportFilename({
          appShortName: siteConfig.appShortName,
          table: `${type}_services`,
          scope:
            scope.level === "district"
              ? scope.district
              : scope.level === "province"
                ? scope.province
                : (validSelectedDistrict ?? "all_districts"),
          period: `${window.slug}_${rolling}d`,
          date: new Date().toISOString().slice(0, 10),
          extension: "csv",
        }),
        toCsv(result.rows, EXPORT_COLUMNS),
      );
      if (result.truncated || result.rows.length < result.total)
        setExportNotice(
          `Export capped at ${SERVICE_EXPORT_CAP.toLocaleString()} safe rows; ${result.total.toLocaleString()} records matched.`,
        );
    } catch {
      setExportNotice("The filtered service export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!validType) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Unknown service register</h1>
        <Link className="mt-3 inline-block text-brand-700 underline" to="/services/vca">
          Open VCA services
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Service registers
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{typeTitle(type)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {formatCount(records.data?.total)} records · Summary cohort window: {window.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SERVICE_TYPES.map((item) => (
            <Link
              key={item}
              to={`/services/${item}`}
              className={`rounded-md border px-3 py-2 text-sm ${item === type ? "border-brand-600 bg-brand-50 text-brand-900" : "bg-white"}`}
            >
              {typeTitle(item)}
            </Link>
          ))}
          {type === "vca" ? (
            <Link
              to="/services/vca/overview"
              className="rounded-md border bg-white px-3 py-2 text-sm"
            >
              VCA overview
            </Link>
          ) : null}
        </div>
      </header>

      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District scope is fixed: <strong>{scope.district}</strong>
        </p>
      ) : null}
      <section aria-label="Service summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Enrolled", summaryData.enrolled],
          ["Active", summaryData.active],
          ["Services this month", summaryData.services_this_month],
          ["Services last month", summaryData.services_last_month],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">{String(label)}</p>
            <p className="mt-1 text-2xl font-semibold">{formatCount(value)}</p>
          </article>
        ))}
      </section>
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        The FY/custom window ({window.label}) applies to the cohort summary above. The rolling
        window below filters service records only; the records endpoint does not support FY/custom
        dates.
      </p>
      <section
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3"
        aria-label="Service record filters"
      >
        <label className="flex flex-col gap-1 text-sm">
          Search entity or service
          <input
            value={search}
            onChange={(event) => setParam("q", event.target.value)}
            className="min-w-56 rounded-md border px-3 py-2"
            placeholder="Entity ID or service text"
          />
        </label>
        {scope.level !== "district" ? (
          <label className="flex flex-col gap-1 text-sm">
            District
            <select
              value={selectedDistrict ?? ""}
              onChange={(event) => setParam("district", event.target.value)}
              className="rounded-md border bg-white px-3 py-2"
            >
              <option value="">All permitted districts</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          Service domain
          <select
            value={domain}
            onChange={(event) => setParam("domain", event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            <option value="all">All domains</option>
            {pillars.map((pillar) => (
              <option key={pillar} value={pillar}>
                {pillar}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Issue
          <select
            value={issue}
            onChange={(event) => setParam("issue", event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            <option value="">All records</option>
            <option value="missing_date">Missing date</option>
            <option value="no_service_details">No service details</option>
            <option value="missing_caseworker">Missing caseworker</option>
            <option value="missing_district">Missing district</option>
            <option value="stale_90d">Older than 90 days</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Rolling record window
          <select
            value={rolling}
            onChange={(event) => setParam("days", event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            {ROLLING_WINDOWS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={exportCsv}
          disabled={records.isLoading || isExporting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isExporting ? "Preparing export…" : "Export filtered results"}
        </button>
      </section>
      {exportNotice ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {exportNotice}
        </p>
      ) : null}
      {records.data?.truncated ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          The merged page view is capped at {SERVICE_MERGE_CAP_PER_DISTRICT.toLocaleString()} rows
          per district. Refine filters or select a district to continue deeper into the result set.
        </p>
      ) : null}
      {records.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Service records could not be loaded. Please try again.
        </p>
      ) : null}
      <section className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                "Entity ID",
                "District",
                "Facility",
                "Service date",
                "Domains",
                "Services",
                "Status",
                "Issues",
              ].map((header) => (
                <th key={header} className="px-3 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row: ServiceRecord) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 font-medium">
                  <Link
                    className="text-brand-700 underline"
                    to={`/services/${type}/${encodeURIComponent(row.entityId)}?date=${encodeURIComponent(row.serviceDate)}`}
                  >
                    {row.entityId || "Unavailable"}
                  </Link>
                </td>
                <td className="px-3 py-3">{row.district}</td>
                <td className="px-3 py-3">{row.facility}</td>
                <td className="px-3 py-3">{row.serviceDate}</td>
                <td className="px-3 py-3">{row.pillars.join(", ") || "—"}</td>
                <td className="max-w-64 px-3 py-3">{row.serviceNames.join(", ") || "—"}</td>
                <td className="px-3 py-3">{row.status}</td>
                <td className="px-3 py-3">{row.issues.join(", ") || "—"}</td>
              </tr>
            ))}
            {!records.isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-slate-500">
                  No service records match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <footer className="flex items-center justify-between text-sm">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setParam("page", String(page - 1))}
            className="rounded border bg-white px-3 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setParam("page", String(page + 1))}
            className="rounded border bg-white px-3 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </footer>
    </main>
  );
}
