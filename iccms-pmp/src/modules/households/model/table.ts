/**
 * Columns and filters for the household register.
 *
 * One declaration feeds the table, the export and (once the backend paginates) the server query. The
 * legacy page declared its columns four times and the four disagreed.
 */

import { subPopulationsFor } from "@/config";
import type { ColumnDef } from "@/platform/data-table/types";
import type { FilterDef } from "@/platform/filters/types";

import type { Household } from "../api/schemas";

/** The seven sub-populations the household register exposes (decision 13, `subPopulationsFor`). */
export const HOUSEHOLD_SUB_POPULATIONS = subPopulationsFor("household");

export const householdColumns: ReadonlyArray<ColumnDef<Household>> = [
  {
    id: "householdId",
    header: "Household ID",
    sortField: "household_id",
    meta: {
      field: "householdId",
      label: "Household ID",
      exportHeader: "Household ID",
      locked: true,
      className: "font-mono text-xs font-semibold",
    },
  },
  {
    id: "homeAddress",
    header: "Household details",
    meta: {
      field: "homeAddress",
      label: "Household details",
      exportHeader: "Home Address",
      // The legacy cell joined Address/Facility/Province/District/Ward with newlines but rendered them
      // in a plain div, so they collapsed into one run of text (`audit: households.md`, Bugs).
      className: "whitespace-pre-line max-w-72",
    },
    cell: (row) =>
      [
        row.homeAddress ? `Address: ${row.homeAddress}` : null,
        row.facility ? `Facility: ${row.facility}` : null,
        row.province ? `Province: ${row.province}` : null,
        row.district ? `District: ${row.district}` : null,
        row.ward ? `Ward: ${row.ward}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
  },
  {
    id: "caseworkerName",
    header: "Case worker",
    sortField: "caseworker_name",
    meta: { field: "caseworkerName", label: "Case worker", exportHeader: "Case Worker" },
  },
  {
    id: "facility",
    header: "Facility",
    meta: { field: "facility", label: "Facility", exportHeader: "Facility" },
  },
  {
    id: "district",
    header: "District",
    sortField: "district",
    meta: { field: "district", label: "District", exportHeader: "District" },
  },
  {
    id: "province",
    header: "Province",
    meta: { field: "province", label: "Province", exportHeader: "Province", hidden: true },
  },
  {
    id: "ward",
    header: "Ward",
    meta: { field: "ward", label: "Ward", exportHeader: "Ward", hidden: true },
  },
  {
    id: "screened",
    header: "Screened",
    meta: { field: "screened", label: "Screened", exportHeader: "Screened", hidden: true },
  },
  {
    id: "lastServiceDate",
    header: "Last service",
    sortField: "last_service_date",
    meta: {
      field: "lastServiceDate",
      label: "Last service",
      exportHeader: "Last Service Date",
      hidden: true,
    },
  },
];

/** Columns the export includes when the user has not narrowed the set. */
export const householdExportColumns = householdColumns.filter((column) => !column.meta?.hidden);

export const householdFilters: ReadonlyArray<FilterDef> = [
  {
    id: "q",
    label: "Search",
    type: "text",
    placeholder: "Search by ID, facility, or caseworker…",
    fields: ["householdId", "facility", "homeAddress", "district", "ward", "caseworkerName"],
  },
  {
    id: "district",
    label: "District",
    type: "select",
    field: "district",
    allLabel: "All Districts",
    allValue: "All",
  },
  ...HOUSEHOLD_SUB_POPULATIONS.map(
    ({ key, label }) =>
      ({
        id: key,
        label,
        type: "subPopulation" as const,
        key,
      }) satisfies FilterDef,
  ),
];
