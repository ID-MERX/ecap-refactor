import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { DataTable } from "@/platform/data-table/DataTable";
import type { ServerTableSource } from "@/platform/data-table/types";
import { FilterBar } from "@/platform/filters/FilterBar";
import { applyFilters } from "@/platform/filters/applyFilters";
import { useTableUrlState } from "@/platform/filters/useTableUrlState";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { MAX_VCA_ROWS } from "../api/client";
import { vcaActiveQuery, vcaServicesQuery } from "../api/queries";
import {
  buildVcaRiskRows,
  selectVcaRiskRows,
  vcaRiskColumns,
  vcaRiskExportColumns,
  vcaRiskFilters,
  VCA_RISK_TYPES,
  type VcaRiskType,
} from "../model/table";

const FILTERS_WITHOUT_TYPE = vcaRiskFilters.filter((filter) => filter.id !== "type");

export function VcaRiskPage(): ReactNode {
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const defs = useMemo(
    () =>
      scope.level === "district"
        ? vcaRiskFilters.filter((filter) => filter.id !== "district")
        : vcaRiskFilters,
    [scope.level],
  );
  const table = useTableUrlState(defs, { sort: { field: "vcaId", direction: "asc" } });
  const requestedType = table.filters.type;
  const type: VcaRiskType = VCA_RISK_TYPES.some((item) => item.value === requestedType)
    ? (requestedType as VcaRiskType)
    : "health_domain";
  const vcasQuery = useQuery(vcaActiveQuery(scope, window));
  const servicesQuery = useQuery(vcaServicesQuery(scope));
  const allRows = useMemo(
    () =>
      selectVcaRiskRows(
        buildVcaRiskRows(vcasQuery.data?.rows ?? [], servicesQuery.data?.rows ?? [], window),
        type,
      ),
    [vcasQuery.data, servicesQuery.data, window, type],
  );
  const filtered = useMemo(
    () =>
      applyFilters(
        allRows,
        FILTERS_WITHOUT_TYPE.filter(
          (filter) => scope.level !== "district" || filter.id !== "district",
        ),
        table.filters,
      ),
    [allRows, table.filters, scope.level],
  );
  const pageRows = useMemo(
    () =>
      filtered.slice(
        (table.page.page - 1) * table.page.pageSize,
        table.page.page * table.page.pageSize,
      ),
    [filtered, table.page],
  );
  const districts = useMemo(
    () =>
      [
        ...new Set(
          allRows
            .map((row) => row.district)
            .filter((district): district is string => Boolean(district)),
        ),
      ].sort((a, b) => a.localeCompare(b, "en")),
    [allRows],
  );
  const source: ServerTableSource<(typeof allRows)[number]> = {
    mode: "server",
    query: {
      page: table.page.page,
      pageSize: table.page.pageSize,
      sort: table.sort.field,
      order: table.sort.direction,
      filters: table.queryParams,
    },
    onQueryChange: (next) => {
      if (next.page !== undefined) table.setPage(next.page);
      if (next.pageSize !== undefined) table.setPageSize(next.pageSize);
    },
    data: {
      rows: pageRows,
      total: filtered.length,
      page: table.page.page,
      pageSize: table.page.pageSize,
    },
    isLoading: vcasQuery.isLoading || servicesQuery.isLoading,
    isFetching: vcasQuery.isFetching || servicesQuery.isFetching,
    error: vcasQuery.error ?? servicesQuery.error,
    sortableFields: [],
  };
  const selected = VCA_RISK_TYPES.find((item) => item.value === type)!;

  function exportCsv() {
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: "vca_domain_gap",
        scope:
          scope.level === "district"
            ? scope.district
            : scope.level === "province"
              ? scope.province
              : table.filters.district || "all_districts",
        period: window.slug,
        date: new Date().toISOString().slice(0, 10),
        extension: "csv",
      }),
      toCsv(filtered, vcaRiskExportColumns),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            VCA service domains · {window.label}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{selected.label}</h1>
          <p className="text-sm text-slate-500">
            {filtered.length.toLocaleString()} VCAs found
            {table.filters.district && table.filters.district !== "All"
              ? ` in ${table.filters.district}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export CSV
        </button>
      </header>
      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District: <strong>{scope.district}</strong>
        </p>
      ) : null}
      {vcasQuery.data?.truncated || servicesQuery.data?.truncated ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Risk analysis uses capped data (maximum {MAX_VCA_ROWS.toLocaleString()} rows per source)
          until the backend supports pagination; results may be incomplete.
        </p>
      ) : null}
      {window.from || window.to ? (
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Service coverage is limited to dates within {window.label}. Service rows without a
          recognized date are excluded.
        </p>
      ) : (
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Service coverage uses all available service history.
        </p>
      )}
      <FilterBar
        defs={defs}
        state={table.filters}
        onFilterChange={table.setFilter}
        onClear={table.clearFilters}
        activeCount={table.activeCount}
        dynamicOptions={{ district: districts }}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          tableId="vcas.risk"
          columns={vcaRiskColumns}
          getRowId={(row) => row.vcaId}
          rowHref={(row) => `/vcas/${encodeURIComponent(row.vcaId)}`}
          source={source}
          emptyTitle={"No VCAs found"}
          emptyDescription="Adjust the selected domain, district, or search."
        />
      </div>
    </div>
  );
}
