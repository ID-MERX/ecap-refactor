import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { programConfig, siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { DataTable } from "@/platform/data-table/DataTable";
import type { ServerTableSource } from "@/platform/data-table/types";
import { sortRows } from "@/platform/data-table/sort";
import { FilterBar } from "@/platform/filters/FilterBar";
import { applyFilters } from "@/platform/filters/applyFilters";
import { useTableUrlState } from "@/platform/filters/useTableUrlState";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { MAX_VCA_ROWS } from "../api/client";
import { vcaActiveQuery, vcaArchivedQuery } from "../api/queries";
import type { Vca } from "../api/schemas";
import {
  activeVcaColumns,
  activeVcaExportColumns,
  archivedVcaColumns,
  archivedVcaExportColumns,
  archivedVcaFilters,
  vcaFilters,
} from "../model/table";

type Props = { archived?: boolean };

export function VcaRegisterPage({ archived = false }: Props): ReactNode {
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const baseFilters = archived ? archivedVcaFilters : vcaFilters;
  const defs = useMemo(
    () =>
      scope.level === "district"
        ? baseFilters.filter((filter) => filter.id !== "district")
        : baseFilters,
    [baseFilters, scope.level],
  );
  const table = useTableUrlState(defs, {
    sort: { field: archived ? "uid" : "household_id", direction: "desc" },
  });
  const reason = archived ? table.filters.reason || "all" : "all";
  const activeQuery = useQuery(vcaActiveQuery(scope, window, !archived));
  const archivedQuery = useQuery(vcaArchivedQuery(scope, window, reason, archived));
  const query = archived ? archivedQuery : activeQuery;
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  const filtered = useMemo(
    () => applyFilters(rows, defs, table.filters) as ReadonlyArray<Vca>,
    [rows, defs, table.filters],
  );
  const sorted = useMemo(
    () => sortRows(filtered, { field: table.sort.field, direction: table.sort.direction }),
    [filtered, table.sort.field, table.sort.direction],
  );
  const pageRows = useMemo(
    () =>
      sorted.slice(
        (table.page.page - 1) * table.page.pageSize,
        table.page.page * table.page.pageSize,
      ),
    [sorted, table.page],
  );
  const districts = useMemo(
    () =>
      [
        ...new Set(rows.map((row) => row.district).filter((item): item is string => Boolean(item))),
      ].sort((a, b) => a.localeCompare(b, "en")),
    [rows],
  );
  const source: ServerTableSource<Vca> = {
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
    sortableFields: [],
  };

  function exportCsv() {
    const columns = archived ? archivedVcaExportColumns : activeVcaExportColumns;
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: archived ? "archived_vcas" : "vcas",
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
      toCsv(sorted, columns),
    );
  }

  const title = archived ? "Graduated & exited VCAs" : "Children & adolescents";
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {archived ? "Archived VCAs" : "VCA register"} · {window.label}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500">
            {sorted.length.toLocaleString()} {archived ? "archived" : "active"} records ·{" "}
            {programConfig.terms.child}
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
      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District: <strong>{scope.district}</strong>
        </p>
      ) : null}
      {query.data?.truncated ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Showing at most {MAX_VCA_ROWS.toLocaleString()} scoped rows. The legacy endpoint does not
          paginate; results may be incomplete.
        </p>
      ) : null}
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
          tableId={archived ? "vcas.archived" : "vcas.register"}
          columns={archived ? archivedVcaColumns : activeVcaColumns}
          getRowId={(row) => row.vcaId}
          rowHref={(row) => `/vcas/${encodeURIComponent(row.vcaId)}`}
          source={source}
          emptyTitle={query.error ? "Could not load VCAs" : "No VCAs found matching criteria."}
          emptyDescription="Try changing the search, district, reason, or sub-population filters."
        />
      </div>
    </div>
  );
}
