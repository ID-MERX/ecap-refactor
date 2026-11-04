/**
 * `/households` — the active household register. Phase 4 pilot.
 *
 * Composes the platform pieces rather than reimplementing them: `useTableUrlState` for URL state,
 * `FilterBar` for the controls, `DataTable` for the grid, `exportRows` for the CSV. The page itself is
 * lazy about *domain* logic only, which is why it stays short.
 *
 * Two behaviours differ from the legacy page on purpose, both documented in `docs/audit/households.md`:
 *  - District filtering uses the real scope, not a client-side guess, and is sent to the API.
 *  - A truncated fetch says so, instead of silently presenting a partial register as the whole thing.
 */

import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { programConfig, siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { DataTable } from "@/platform/data-table/DataTable";
import type { ServerTableSource } from "@/platform/data-table/types";
import { FilterBar } from "@/platform/filters/FilterBar";
import { useTableUrlState } from "@/platform/filters/useTableUrlState";
import { applyFilters } from "@/platform/filters/applyFilters";
import { sortRows } from "@/platform/data-table/sort";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { MAX_ROWS } from "../api/client";
import { householdRegisterQuery } from "../api/queries";
import type { Household } from "../api/schemas";
import { householdColumns, householdExportColumns, householdFilters } from "../model/table";

const DEFAULT_SORT = { field: "householdId", direction: "desc" as const };

export function HouseholdRegisterPage(): ReactNode {
  const { state } = useAuth();
  const window = useFyWindow();

  const access = state.status === "authenticated" ? state.access : null;
  const scope = access?.scope;

  const query = useQuery({
    ...householdRegisterQuery(scope ?? { level: "none" }, window),
  });

  const table = useTableUrlState(householdFilters, { sort: DEFAULT_SORT });

  // Memoised so the two derived `useMemo`s below do not recompute on every render.
  const rows = useMemo<ReadonlyArray<Household>>(() => query.data?.rows ?? [], [query.data]);

  // District options come from the loaded data, as the legacy register did, so a district with no rows
  // is not offered. Sorted for a stable, scannable list.
  const districtOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) if (row.district) seen.add(row.district);
    return [...seen].sort((a, b) => a.localeCompare(b, "en"));
  }, [rows]);

  // The API does not paginate yet, so filtering/sorting/paging happen here over one page of a held array.
  const filtered = useMemo(
    () =>
      applyFilters(
        rows as ReadonlyArray<Record<string, unknown>>,
        householdFilters,
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
      if (next.sort !== undefined) {
        table.setSort({ field: next.sort, direction: next.order ?? table.sort.direction });
      }
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

  function handleExport() {
    // Exports every filtered row, not just the visible page, in the displayed sort order — the same
    // selection the on-screen count reports.
    const csv = toCsv(sorted, householdExportColumns);
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: "households",
        scope:
          table.filters.district && table.filters.district !== "All"
            ? table.filters.district
            : "all_districts",
        period: window.slug,
        date: new Date().toISOString().slice(0, 10),
        extension: "csv",
      }),
      csv,
    );
  }

  const truncated = query.data?.truncated ?? false;
  const atCap = sorted.length >= MAX_ROWS;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Household register</p>
          <h1 className="text-2xl font-semibold tracking-tight">Active households</h1>
          <p className="text-sm text-slate-500">
            {sorted.length.toLocaleString()} records ·{" "}
            {programConfig.fiscalYear.label(programConfig.fiscalYear.current())}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={sorted.length === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Export CSV
        </button>
      </header>

      {truncated || atCap ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Showing the first {MAX_ROWS.toLocaleString()} rows only. This register is still returned
          in full by the API and truncated in the browser; server-side pagination is required to see
          everything.
        </p>
      ) : null}

      <FilterBar
        defs={householdFilters}
        state={table.filters}
        onFilterChange={table.setFilter}
        onClear={table.clearFilters}
        activeCount={table.activeCount}
        dynamicOptions={{ district: districtOptions }}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          tableId="households.register"
          columns={householdColumns}
          getRowId={(row) => row.householdId}
          rowHref={(row) => `/households/${encodeURIComponent(row.householdId)}`}
          source={source}
          emptyTitle="No households found matching criteria."
          emptyDescription="Try removing a filter, choosing another district, or widening the fiscal year."
        />
      </div>
    </div>
  );
}
