import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { DataTable } from "@/platform/data-table/DataTable";
import type { ServerTableSource } from "@/platform/data-table/types";
import { FilterBar } from "@/platform/filters/FilterBar";
import { applyFilters } from "@/platform/filters/applyFilters";
import { useTableUrlState } from "@/platform/filters/useTableUrlState";
import { sortRows } from "@/platform/data-table/sort";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { householdRegisterQuery } from "../api/queries";
import { householdServicesQuery } from "../api/extended";
import {
  buildRiskRows,
  riskColumns,
  riskExportColumns,
  riskFilters,
  RISK_TYPES,
  selectRiskRows,
  type RiskType,
} from "../model/extended";

const ROW_FILTERS = riskFilters.filter((filter) => filter.id !== "type");

export function HouseholdRiskPage(): ReactNode {
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const table = useTableUrlState(riskFilters, { sort: { field: "householdId", direction: "asc" } });
  const requestedType = table.filters.type;
  const type: RiskType = RISK_TYPES.some((item) => item.value === requestedType)
    ? (requestedType as RiskType)
    : "health_domain";
  const householdQuery = useQuery(householdRegisterQuery(scope, window));
  const serviceQuery = useQuery(householdServicesQuery(scope));
  const householdRows = useMemo(() => householdQuery.data?.rows ?? [], [householdQuery.data]);
  const rawHouseholds = useMemo(() => householdRows.map((row) => row.flags), [householdRows]);
  const services = useMemo(() => serviceQuery.data?.rows ?? [], [serviceQuery.data]);

  const allRows = useMemo(
    () => selectRiskRows(buildRiskRows(rawHouseholds, services), type),
    [rawHouseholds, services, type],
  );
  const districts = useMemo(
    () => [...new Set(allRows.map((row) => row.district))].sort((a, b) => a.localeCompare(b, "en")),
    [allRows],
  );
  const filtered = useMemo(
    () =>
      applyFilters(
        allRows as ReadonlyArray<Record<string, unknown>>,
        ROW_FILTERS,
        table.filters,
      ) as ReadonlyArray<(typeof allRows)[number]>,
    [allRows, table.filters],
  );
  const sorted = useMemo(
    () => sortRows(filtered, { field: table.sort.field, direction: table.sort.direction }),
    [filtered, table.sort.field, table.sort.direction],
  );
  const pageRows = useMemo(() => {
    const start = (table.page.page - 1) * table.page.pageSize;
    return sorted.slice(start, start + table.page.pageSize);
  }, [sorted, table.page]);
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
      if (next.sort !== undefined)
        table.setSort({ field: next.sort, direction: next.order ?? table.sort.direction });
    },
    data: {
      rows: pageRows,
      total: sorted.length,
      page: table.page.page,
      pageSize: table.page.pageSize,
    },
    isLoading: householdQuery.isLoading || serviceQuery.isLoading,
    isFetching: householdQuery.isFetching || serviceQuery.isFetching,
    error: householdQuery.error ?? serviceQuery.error,
  };
  const selected = RISK_TYPES.find((item) => item.value === type)!;

  function exportCsv() {
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: "household_domain_gap",
        scope: table.filters.district || "all_districts",
        period: window.slug,
        date: new Date().toISOString().slice(0, 10),
        extension: "csv",
      }),
      toCsv(sorted, riskExportColumns),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Household services · {window.label}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{selected.label}</h1>
          <p className="text-sm text-slate-500">
            {sorted.length.toLocaleString()} households found
            {table.filters.district && table.filters.district !== "All"
              ? ` in ${table.filters.district}`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={sorted.length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export CSV
        </button>
      </header>
      {householdQuery.data?.truncated || serviceQuery.data?.truncated ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Risk analysis uses capped data until the backend provides aggregate endpoints. The
          displayed results may be incomplete.
        </p>
      ) : null}
      <FilterBar
        defs={riskFilters}
        state={table.filters}
        onFilterChange={table.setFilter}
        onClear={table.clearFilters}
        activeCount={table.activeCount}
        dynamicOptions={{ district: districts }}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          tableId="households.risk"
          columns={riskColumns}
          getRowId={(row) => row.householdId}
          rowHref={(row) => `/households/${encodeURIComponent(row.householdId)}`}
          source={source}
          emptyTitle="No records found"
          emptyDescription="Adjust the selected domain, district, or search."
        />
      </div>
    </div>
  );
}
