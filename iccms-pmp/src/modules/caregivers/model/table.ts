import { programConfig } from "@/config";
import { normalizeDistrict } from "@/core/lib/values";
import type { ColumnDef } from "@/platform/data-table/types";
import type { FilterDef } from "@/platform/filters/types";
import type { FyWindow } from "@/platform/scope/fy";
import type { Household } from "@/modules/households";

export type CaregiverRiskType = (typeof programConfig.householdRiskTypes)[number]["value"];
export const CAREGIVER_RISK_TYPES = programConfig.householdRiskTypes;

export type CaregiverRiskRow = {
  householdId: string;
  district: string;
  domainCount: number;
  hasHealth: boolean;
  hasSchooled: boolean;
  hasSafe: boolean;
  hasStable: boolean;
};

export type CaregiverRiskResult = {
  rows: ReadonlyArray<CaregiverRiskRow>;
  undatedServiceCount: number;
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

/** Meaningful service values mirror the household risk register's backend field convention. */
export function isCaregiverCategoryProvided(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0) return false;
  if (typeof value === "string") {
    const text = value.trim();
    if (
      (text.startsWith("[") && text.endsWith("]")) ||
      (text.startsWith("{") && text.endsWith("}"))
    ) {
      try {
        return isCaregiverCategoryProvided(JSON.parse(text) as unknown);
      } catch {
        return !EMPTY_MARKERS.has(text.toLowerCase());
      }
    }
    return !EMPTY_MARKERS.has(text.toLowerCase());
  }
  if (Array.isArray(value)) return value.some((item) => isCaregiverCategoryProvided(item));
  if (typeof value === "object") return Object.values(value).some(isCaregiverCategoryProvided);
  return true;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/.exec(input);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(input);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (match) return validDate(Number(match[3]), Number(match[1]), Number(match[2]));
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function eventInWindow(row: Record<string, unknown>, window: FyWindow): boolean | null {
  if (!window.from && !window.to) return true;
  const date = parseDate(row.service_date ?? row.date_service ?? row.date);
  if (!date) return null;
  return (!window.from || date >= window.from) && (!window.to || date <= window.to);
}

function householdServiceKey(id: string, district: string): string {
  return `${normalizeDistrict(district) ?? ""}:${id.trim().toLowerCase()}`;
}

export function buildCaregiverRiskRows(
  households: ReadonlyArray<Household>,
  services: ReadonlyArray<Record<string, unknown>>,
  window: FyWindow,
): CaregiverRiskResult {
  const coverage = new Map<string, [boolean, boolean, boolean, boolean]>();
  let undatedServiceCount = 0;

  for (const service of services) {
    const id = String(service.household_id ?? service.hh_id ?? "").trim();
    const district = typeof service.district === "string" ? service.district : "";
    if (!id || !normalizeDistrict(district)) continue;
    const inWindow = eventInWindow(service, window);
    if (inWindow === null) {
      undatedServiceCount += 1;
      continue;
    }
    if (!inWindow) continue;

    const key = householdServiceKey(id, district);
    const flags = coverage.get(key) ?? [false, false, false, false];
    flags[0] ||= isCaregiverCategoryProvided(service.health_services);
    flags[1] ||= isCaregiverCategoryProvided(service.schooled_services);
    flags[2] ||= isCaregiverCategoryProvided(service.safe_services);
    flags[3] ||= isCaregiverCategoryProvided(service.stable_services);
    coverage.set(key, flags);
  }

  const seenHouseholds = new Set<string>();
  const rows = households.flatMap((household) => {
    const id = household.householdId.trim();
    const district = household.district?.trim() ?? "";
    if (!id || !normalizeDistrict(district)) return [];
    const key = householdServiceKey(id, district);
    if (seenHouseholds.has(key)) return [];
    seenHouseholds.add(key);
    const flags = coverage.get(key) ?? [false, false, false, false];
    const domainCount = flags.filter(Boolean).length;
    return [
      {
        householdId: id,
        district,
        domainCount,
        hasHealth: flags[0],
        hasSchooled: flags[1],
        hasSafe: flags[2],
        hasStable: flags[3],
      },
    ];
  });

  return { rows, undatedServiceCount };
}

export function selectCaregiverRiskRows(
  rows: ReadonlyArray<CaregiverRiskRow>,
  type: CaregiverRiskType,
): ReadonlyArray<CaregiverRiskRow> {
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

export const caregiverRiskFilters: ReadonlyArray<FilterDef> = [
  {
    id: "type",
    label: "Risk category",
    type: "select",
    field: "type",
    options: CAREGIVER_RISK_TYPES.map(({ value, label }) => ({ value, label })),
  },
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
];

export const caregiverRiskColumns: ReadonlyArray<ColumnDef<CaregiverRiskRow>> = [
  {
    id: "householdId",
    header: "Household ID",
    meta: {
      field: "householdId",
      label: "Household ID",
      exportHeader: "Household ID",
      locked: true,
    },
  },
  {
    id: "caregiverName",
    header: "Caregiver name",
    meta: { field: "caregiverName", label: "Caregiver name" },
    cell: () => "Hidden for privacy",
  },
  {
    id: "district",
    header: "District",
    meta: { field: "district", label: "District", exportHeader: "District" },
  },
  {
    id: "health",
    header: "Health",
    meta: { field: "hasHealth", label: "Health", exportHeader: "Health" },
    cell: (row) => (row.hasHealth ? "Yes" : "No"),
  },
  {
    id: "schooled",
    header: "Schooled",
    meta: { field: "hasSchooled", label: "Schooled", exportHeader: "Schooled" },
    cell: (row) => (row.hasSchooled ? "Yes" : "No"),
  },
  {
    id: "safe",
    header: "Safe",
    meta: { field: "hasSafe", label: "Safe", exportHeader: "Safe" },
    cell: (row) => (row.hasSafe ? "Yes" : "No"),
  },
  {
    id: "stable",
    header: "Stable",
    meta: { field: "hasStable", label: "Stable", exportHeader: "Stable" },
    cell: (row) => (row.hasStable ? "Yes" : "No"),
  },
  {
    id: "domains",
    header: "Domains covered",
    meta: { field: "domainCount", label: "Domains covered", exportHeader: "Domains Covered" },
    cell: (row) => `${row.domainCount}/4`,
  },
];

export const caregiverRiskExportColumns: ReadonlyArray<ColumnDef<CaregiverRiskRow>> = [
  caregiverRiskColumns[0]!,
  caregiverRiskColumns[2]!,
  caregiverRiskColumns[3]!,
  caregiverRiskColumns[4]!,
  caregiverRiskColumns[5]!,
  caregiverRiskColumns[6]!,
  caregiverRiskColumns[7]!,
];
