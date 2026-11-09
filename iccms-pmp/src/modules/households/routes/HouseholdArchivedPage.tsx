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

import { archivedHouseholdQuery } from "../api/extended";
import type { Household } from "../api/schemas";
import { archivedColumns, archivedExportColumns, archivedFilters } from "../model/extended";

const DEFAULT_SORT = { field: "householdId", direction: "desc" as const };

export function HouseholdArchivedPage(): ReactNode {
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const table = useTableUrlState(archivedFilters, { sort: DEFAULT_SORT });
  const reason = table.filters.reason || "all";
  const query = useQuery(archivedHouseholdQuery(scope, window, reason));
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  const districts = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.district)
            .filter((district): district is string => Boolean(district)),
        ),
      ].sort((a, b) => a.localeCompare(b, "en")),
    [rows],
  );
  const filtered = useMemo(
    () =>
      applyFilters(
        rows as ReadonlyArray<Record<string, unknown>>,
        archivedFilters,
        table.filters,
      ) as ReadonlyArray<Household>,
    [rows, table.filters],
  );
  const sorted = useMemo(
    () => sortRows(filtered, { field: table.sort.field, direction: table.sort.direction }),
    [filtered, table.sort.field, table.sort.direction],
  );
  const pageRows = useMemo(() => {
    const start = (table.page.page - 1) * table.page.pageSize;
    return sorted.slice(start, start + table.page.pageSize);
  }, [sorted, table.page]);

  const source: ServerTableSource<Household> = {
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
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };

  function exportCsv() {
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: "archived_households",
        scope: table.filters.district || "all_districts",
        period: window.slug,
        date: new Date().toISOString().slice(0, 10),
        extension: "csv",
      }),
      toCsv(sorted, archivedExportColumns),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Archived households · {window.label}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Graduated &amp; exited households
          </h1>
          <p className="text-sm text-slate-500">
            Deregistered · {sorted.length.toLocaleString()} records
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
      {query.data?.truncated ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          This archived register is capped at 20,000 rows until the backend supports pagination.
        </p>
      ) : null}
      <FilterBar
        defs={archivedFilters}
        state={table.filters}
        onFilterChange={table.setFilter}
        onClear={table.clearFilters}
        activeCount={table.activeCount}
        dynamicOptions={{ district: districts }}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          tableId="households.archived"
          columns={archivedColumns}
          getRowId={(row) => row.householdId}
          rowHref={(row) => `/households/${encodeURIComponent(row.householdId)}`}
          source={source}
          emptyTitle="No archived households found matching criteria."
          emptyDescription="Try changing the district, reason, or search."
        />
      </div>
    </div>
  );
}
