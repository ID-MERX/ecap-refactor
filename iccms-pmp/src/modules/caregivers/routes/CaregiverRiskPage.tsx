import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { normalizeDistrict } from "@/core/lib/values";
import { householdPaths, householdRegisterQuery } from "@/modules/households";
import { DataTable } from "@/platform/data-table/DataTable";
import { sortRows } from "@/platform/data-table/sort";
import type { ServerTableSource } from "@/platform/data-table/types";
import { downloadCsv, exportFilename, toCsv } from "@/platform/export/csv";
import { applyFilters } from "@/platform/filters/applyFilters";
import { FilterBar } from "@/platform/filters/FilterBar";
import { useTableUrlState } from "@/platform/filters/useTableUrlState";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { MAX_CAREGIVER_ROWS, districtsForCaregiverScope } from "../api/client";
import { caregiverServicesQuery } from "../api/queries";
import {
  buildCaregiverRiskRows,
  CAREGIVER_RISK_TYPES,
  caregiverRiskColumns,
  caregiverRiskExportColumns,
  caregiverRiskFilters,
  selectCaregiverRiskRows,
  type CaregiverRiskType,
} from "../model/table";

const ROW_FILTERS = caregiverRiskFilters.filter((filter) => filter.id !== "type");

export function CaregiverRiskPage(): ReactNode {
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const allowedDistricts = districtsForCaregiverScope(scope);
  const allowedDistrictKeys = useMemo(
    () => new Set(allowedDistricts.map((district) => normalizeDistrict(district)).filter(Boolean)),
    [allowedDistricts],
  );
  const defs = useMemo(
    () =>
      scope.level === "district"
        ? caregiverRiskFilters.filter((filter) => filter.id !== "district")
        : caregiverRiskFilters,
    [scope.level],
  );
  const table = useTableUrlState(defs, { sort: { field: "householdId", direction: "asc" } });
  const requestedType = table.filters.type;
  const type: CaregiverRiskType = CAREGIVER_RISK_TYPES.some((item) => item.value === requestedType)
    ? (requestedType as CaregiverRiskType)
    : "health_domain";
  const householdsQuery = useQuery(householdRegisterQuery(scope, window));
  const servicesQuery = useQuery(caregiverServicesQuery(scope));
  const households = useMemo(
    () =>
      (householdsQuery.data?.rows ?? []).filter(
        (row) => row.district && allowedDistrictKeys.has(normalizeDistrict(row.district)),
      ),
    [householdsQuery.data, allowedDistrictKeys],
  );
  const riskResult = useMemo(
    () => buildCaregiverRiskRows(households, servicesQuery.data?.rows ?? [], window),
    [households, servicesQuery.data, window],
  );
  const scopedRows = useMemo(
    () => selectCaregiverRiskRows(riskResult.rows, type),
    [riskResult.rows, type],
  );
  const dynamicDistricts = useMemo(
    () => [...allowedDistricts].sort((a, b) => a.localeCompare(b, "en")),
    [allowedDistricts],
  );
  const activeFilters = useMemo(
    () => ROW_FILTERS.filter((filter) => scope.level !== "district" || filter.id !== "district"),
    [scope.level],
  );
  const districtScope = scope.level === "district" ? scope.district : "";
  const filterState = useMemo(
    () => (districtScope ? { ...table.filters, district: districtScope } : table.filters),
    [districtScope, table.filters],
  );
  const filtered = useMemo(
    () =>
      applyFilters(
        scopedRows as ReadonlyArray<Record<string, unknown>>,
        activeFilters,
        filterState,
      ) as ReadonlyArray<(typeof scopedRows)[number]>,
    [scopedRows, activeFilters, filterState],
  );
  const sorted = useMemo(
    () => sortRows(filtered, { field: table.sort.field, direction: table.sort.direction }),
    [filtered, table.sort.field, table.sort.direction],
  );
  const pageRows = useMemo(() => {
    const start = (table.page.page - 1) * table.page.pageSize;
    return sorted.slice(start, start + table.page.pageSize);
  }, [sorted, table.page]);
  const source: ServerTableSource<(typeof scopedRows)[number]> = {
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
    isLoading: householdsQuery.isLoading || servicesQuery.isLoading,
    isFetching: householdsQuery.isFetching || servicesQuery.isFetching,
    error: householdsQuery.error ?? servicesQuery.error,
    sortableFields: ["householdId", "district"],
  };
  const selected = CAREGIVER_RISK_TYPES.find((item) => item.value === type)!;

  function exportCsv() {
    downloadCsv(
      exportFilename({
        appShortName: siteConfig.appShortName,
        table: "caregiver_service_gaps",
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
      toCsv(sorted, caregiverRiskExportColumns),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Household-level caregiver services · {window.label}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{selected.label} registry</h1>
          <p className="text-sm text-slate-500">
            {sorted.length.toLocaleString()} households found
            {scope.level === "district"
              ? ` in ${scope.district}`
              : table.filters.district && table.filters.district !== "All"
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
      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District: <strong>{scope.district}</strong>
        </p>
      ) : null}
      <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-900">
        {type === "graduation_path"
          ? "Graduation-ready households have recorded caregiver services in all four configured domains."
          : `This register highlights households with no recorded caregiver ${selected.domain?.replace("_services", "").replaceAll("_", " ")} service in the selected period.`}
      </p>
      {householdsQuery.data?.truncated || servicesQuery.data?.truncated ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          This analysis is based on capped data (maximum {MAX_CAREGIVER_ROWS.toLocaleString()} rows
          per source) until the backend supports pagination; results may be incomplete.
        </p>
      ) : null}
      {riskResult.undatedServiceCount > 0 && (window.from || window.to) ? (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {riskResult.undatedServiceCount.toLocaleString()} caregiver service rows with missing or
          unrecognized dates were excluded from {window.label} coverage.
        </p>
      ) : null}
      {window.from || window.to ? (
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Only caregiver services dated within {window.label} count toward domain coverage.
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
        dynamicOptions={{ district: dynamicDistricts }}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <DataTable
          tableId="caregivers.risk"
          columns={caregiverRiskColumns}
          getRowId={(row) => row.householdId}
          rowHref={(row) => householdPaths.profile(row.householdId)}
          source={source}
          emptyTitle="No households found"
          emptyDescription="Adjust the selected domain, district, or search."
        />
      </div>
    </div>
  );
}
