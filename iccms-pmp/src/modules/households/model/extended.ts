import { programConfig } from "@/config";
import type { ColumnDef } from "@/platform/data-table/types";
import type { FilterDef } from "@/platform/filters/types";

import type { Household } from "../api/schemas";
import { HOUSEHOLD_SUB_POPULATIONS } from "./table";

export const archivedFilters: ReadonlyArray<FilterDef> = [
  {
    id: "q",
    label: "Search",
    type: "text",
    placeholder: "Search by ID, facility, or caseworker…",
    fields: ["householdId", "homeAddress", "ward", "caseworkerName", "facility"],
  },
  {
    id: "district",
    label: "District",
    type: "select",
    field: "district",
    allLabel: "All Districts",
    allValue: "All",
  },
  {
    id: "reason",
    label: "Reason",
    type: "select",
    field: "reason",
    allLabel: "All reasons",
    allValue: "all",
    options: [
      { value: "all", label: "All reasons" },
      ...programConfig.householdArchiveReasons.map((reason) => ({ value: reason, label: reason })),
    ],
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

export const archivedColumns: ReadonlyArray<ColumnDef<Household>> = [
  {
    id: "householdId",
    header: "Household ID",
    meta: {
      field: "householdId",
      label: "Household ID",
      exportHeader: "Household ID",
      locked: true,
    },
    cell: (row) => row.householdId || "N/A",
  },
  {
    id: "details",
    header: "Household details",
    meta: {
      field: "homeAddress",
      label: "Household details",
      exportHeader: "Home Address",
      className: "whitespace-pre-line",
    },
    cell: (row) =>
      [
        row.homeAddress && `Address: ${row.homeAddress}`,
        row.facility && `Facility: ${row.facility}`,
        row.province && `Province: ${row.province}`,
        row.district && `District: ${row.district}`,
        row.ward && `Ward: ${row.ward}`,
      ]
        .filter(Boolean)
        .join("\n"),
  },
  {
    id: "district",
    header: "District",
    meta: { field: "district", label: "District", exportHeader: "District" },
  },
  {
    id: "archivedOn",
    header: "Archived on",
    meta: { field: "archivedOn", label: "Archived on", exportHeader: "Archived On" },
  },
  {
    id: "reason",
    header: "Reason",
    meta: { field: "reason", label: "Reason", exportHeader: "Reason" },
  },
  {
    id: "caseworker",
    header: "Case worker",
    meta: { field: "caseworkerName", label: "Case worker", exportHeader: "Case Worker" },
  },
];

export const archivedExportColumns: ReadonlyArray<ColumnDef<Household>> = [
  {
    id: "householdId",
    header: "Household ID",
    meta: {
      field: "householdId",
      label: "Household ID",
      exportHeader: "Household ID",
      exportValue: (row) => row.householdId,
    },
  },
  {
    id: "homeAddress",
    header: "Home Address",
    meta: {
      field: "homeAddress",
      label: "Home Address",
      exportHeader: "Home Address",
      exportValue: (row) => row.homeAddress ?? "",
    },
  },
  {
    id: "facility",
    header: "Facility",
    meta: {
      field: "facility",
      label: "Facility",
      exportHeader: "Facility",
      exportValue: (row) => row.facility ?? "",
    },
  },
  {
    id: "province",
    header: "Province",
    meta: {
      field: "province",
      label: "Province",
      exportHeader: "Province",
      exportValue: (row) => row.province ?? "",
    },
  },
  {
    id: "district",
    header: "District",
    meta: {
      field: "district",
      label: "District",
      exportHeader: "District",
      exportValue: (row) => row.district ?? "",
    },
  },
  {
    id: "ward",
    header: "Ward",
    meta: {
      field: "ward",
      label: "Ward",
      exportHeader: "Ward",
      exportValue: (row) => row.ward ?? "",
    },
  },
  {
    id: "caseworkerName",
    header: "Case Worker",
    meta: {
      field: "caseworkerName",
      label: "Case Worker",
      exportHeader: "Case Worker",
      exportValue: (row) => row.caseworkerName ?? "",
    },
  },
  {
    id: "archivedOn",
    header: "Archived On",
    meta: {
      field: "archivedOn",
      label: "Archived On",
      exportHeader: "Archived On",
      exportValue: (row) => row.archivedOn ?? "N/A",
    },
  },
  {
    id: "reason",
    header: "Reason",
    meta: {
      field: "reason",
      label: "Reason",
      exportHeader: "Reason",
      exportValue: (row) => row.reason ?? "N/A",
    },
  },
];

export type RiskType = (typeof programConfig.householdRiskTypes)[number]["value"];
export const RISK_TYPES = programConfig.householdRiskTypes;

export type RiskRow = {
  householdId: string;
  district: string;
  lastServiceDate: string;
  domainCount: number;
  hasHealth: boolean;
  hasSchooled: boolean;
  hasSafe: boolean;
  hasStable: boolean;
  active90d: boolean;
};

const EMPTY_MARKERS = new Set([
  "",
  "not applicable",
  "none",
  "null",
  "n/a",
  "na",
  "no",
  "false",
  "0",
  "[]",
  "{}",
]);

/** Port of legacy `isCategoryProvided`, with the source catalogue treated as untrusted data. */
export function isCategoryProvided(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        return isCategoryProvided(JSON.parse(trimmed) as unknown);
      } catch {
        return !EMPTY_MARKERS.has(trimmed.toLowerCase());
      }
    }
    return !EMPTY_MARKERS.has(trimmed.toLowerCase());
  }
  if (Array.isArray(value))
    return value.some((item) => !EMPTY_MARKERS.has(String(item).trim().toLowerCase()));
  return true;
}

function idOf(row: Record<string, unknown>): string {
  for (const key of ["household_id", "hh_id", "hhid", "id"]) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== "")
      return String(value).trim();
  }
  return "";
}

export function buildRiskRows(
  households: ReadonlyArray<Record<string, unknown>>,
  services: ReadonlyArray<Record<string, unknown>>,
  now = new Date(),
): ReadonlyArray<RiskRow> {
  const byId = new Map<string, Record<string, boolean>>();
  const activeSince = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  for (const service of services) {
    const id = idOf(service);
    if (!id) continue;
    const flags = byId.get(id) ?? {
      health: false,
      schooled: false,
      safe: false,
      stable: false,
      active: false,
    };
    flags.health ||= isCategoryProvided(service.health_services);
    flags.schooled ||= isCategoryProvided(service.schooled_services);
    flags.safe ||= isCategoryProvided(service.safe_services);
    flags.stable ||= isCategoryProvided(service.stable_services);
    const date = Date.parse(String(service.service_date ?? ""));
    flags.active ||= Number.isFinite(date) && date >= activeSince && date <= now.getTime();
    byId.set(id, flags);
  }
  return households.flatMap((household) => {
    const id = idOf(household);
    if (!id) return [];
    const flags = byId.get(id) ?? {
      health: false,
      schooled: false,
      safe: false,
      stable: false,
      active: false,
    };
    const domainCount = [flags.health, flags.schooled, flags.safe, flags.stable].filter(
      Boolean,
    ).length;
    return [
      {
        householdId: id,
        district: String(household.district ?? "Unknown"),
        lastServiceDate: String(household.last_service_date ?? "N/A"),
        domainCount,
        hasHealth: Boolean(flags.health),
        hasSchooled: Boolean(flags.schooled),
        hasSafe: Boolean(flags.safe),
        hasStable: Boolean(flags.stable),
        active90d: Boolean(flags.active),
      },
    ];
  });
}

export function selectRiskRows(
  rows: ReadonlyArray<RiskRow>,
  type: RiskType,
): ReadonlyArray<RiskRow> {
  switch (type) {
    case "health_domain":
      return rows.filter((row) => !row.hasHealth);
    case "schooled_domain":
      return rows.filter((row) => !row.hasSchooled);
    case "safe_domain":
      return rows.filter((row) => !row.hasSafe);
    case "stable_domain":
      return rows.filter((row) => !row.hasStable);
    case "graduation_path":
      return rows.filter((row) => row.domainCount === 4);
  }
}

export const riskFilters: ReadonlyArray<FilterDef> = [
  {
    id: "q",
    label: "Search",
    type: "text",
    placeholder: "Search by household ID or district…",
    fields: ["householdId", "district"],
  },
  {
    id: "district",
    label: "District",
    type: "select",
    field: "district",
    allLabel: "All Districts",
    allValue: "All",
  },
  {
    id: "type",
    label: "Metric category",
    type: "select",
    field: "type",
    allLabel: "Missing health services",
    allValue: "health_domain",
    options: RISK_TYPES.map((item) => ({ value: item.value, label: item.label })),
  },
];

export const riskColumns: ReadonlyArray<ColumnDef<RiskRow>> = [
  {
    id: "householdId",
    header: "Household ID",
    meta: { field: "householdId", label: "Household ID", locked: true },
  },
  { id: "district", header: "District", meta: { field: "district", label: "District" } },
  {
    id: "lastServiceDate",
    header: "Last service",
    meta: { field: "lastServiceDate", label: "Last service" },
  },
  {
    id: "domainCount",
    header: "Domains covered",
    meta: { field: "domainCount", label: "Domains covered" },
    cell: (row) => `${row.domainCount} / 4`,
  },
  {
    id: "statusTags",
    header: "Domains covered",
    meta: { field: "domainCount", label: "Status tags" },
    cell: (row) =>
      [
        row.hasHealth ? "Health" : null,
        row.hasSchooled ? "Schooled" : null,
        row.hasSafe ? "Safe" : null,
        row.hasStable ? "Stable" : null,
        row.domainCount === 4 ? "Grad-ready" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "None",
  },
  {
    id: "active90d",
    header: "Active (90d)",
    meta: { field: "active90d", label: "Active (90d)" },
    cell: (row) => (row.active90d ? "Yes" : "No"),
  },
];

export const riskExportColumns: ReadonlyArray<ColumnDef<RiskRow>> = [
  {
    id: "householdId",
    header: "Household ID",
    meta: {
      field: "householdId",
      label: "Household ID",
      exportHeader: "Household ID",
      exportValue: (row) => row.householdId,
    },
  },
  {
    id: "district",
    header: "District",
    meta: {
      field: "district",
      label: "District",
      exportHeader: "District",
      exportValue: (row) => row.district,
    },
  },
  {
    id: "lastServiceDate",
    header: "Last Service Date",
    meta: {
      field: "lastServiceDate",
      label: "Last Service Date",
      exportHeader: "Last Service Date",
      exportValue: (row) => row.lastServiceDate,
    },
  },
  {
    id: "domainCount",
    header: "Domains Covered",
    meta: {
      field: "domainCount",
      label: "Domains Covered",
      exportHeader: "Domains Covered",
      exportValue: (row) => `${row.domainCount}/4`,
    },
  },
  {
    id: "hasHealth",
    header: "Health",
    meta: {
      field: "hasHealth",
      label: "Health",
      exportHeader: "Health",
      exportValue: (row) => (row.hasHealth ? "Yes" : "No"),
    },
  },
  {
    id: "hasSchooled",
    header: "Schooled",
    meta: {
      field: "hasSchooled",
      label: "Schooled",
      exportHeader: "Schooled",
      exportValue: (row) => (row.hasSchooled ? "Yes" : "No"),
    },
  },
  {
    id: "hasSafe",
    header: "Safe",
    meta: {
      field: "hasSafe",
      label: "Safe",
      exportHeader: "Safe",
      exportValue: (row) => (row.hasSafe ? "Yes" : "No"),
    },
  },
  {
    id: "hasStable",
    header: "Stable",
    meta: {
      field: "hasStable",
      label: "Stable",
      exportHeader: "Stable",
      exportValue: (row) => (row.hasStable ? "Yes" : "No"),
    },
  },
  {
    id: "active90d",
    header: "Active (90d)",
    meta: {
      field: "active90d",
      label: "Active (90d)",
      exportHeader: "Active (90d)",
      exportValue: (row) => (row.active90d ? "Yes" : "No"),
    },
  },
];
