import { programConfig, subPopulationsFor, type SubPopulation } from "@/config";
import { pick } from "@/core/lib/values";
import type { ColumnDef } from "@/platform/data-table/types";
import type { FilterDef } from "@/platform/filters/types";
import type { FyWindow } from "@/platform/scope/fy";

import type { Vca } from "../api/schemas";

const subPopulationFilters: ReadonlyArray<FilterDef> = subPopulationsFor("vca").map(
  (item: SubPopulation) => ({
    id: item.key,
    label: item.label,
    type: "subPopulation",
    key: item.key,
  }),
);

export const vcaFilters: ReadonlyArray<FilterDef> = [
  {
    id: "q",
    label: "Search",
    type: "text",
    placeholder: "Search by ID, facility, or location…",
    fields: ["vcaId", "homeaddress", "facility", "province", "district", "ward", "vca_gender"],
  },
  {
    id: "district",
    label: "District",
    type: "select",
    field: "district",
    allLabel: "All Districts",
    allValue: "All",
  },
  ...subPopulationFilters,
];

export const archivedVcaFilters: ReadonlyArray<FilterDef> = [
  ...vcaFilters,
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
];

function detail(row: Vca): string {
  return [
    row.homeaddress && `Address: ${row.homeaddress}`,
    row.facility && `Facility: ${row.facility}`,
    row.province && `Province: ${row.province}`,
    row.district && `District: ${row.district}`,
    row.ward && `Ward: ${row.ward}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function calculateVcaAge(value: unknown, now = new Date()): number | null {
  const parsed = parseBirthDate(value);
  if (!parsed) return null;
  let age = now.getFullYear() - parsed.getFullYear();
  if (
    now.getMonth() < parsed.getMonth() ||
    (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate())
  )
    age -= 1;
  return age >= 0 ? age : null;
}

function parseBirthDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(input);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(input);
  if (match) return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input);
  if (match) return validDate(Number(match[3]), Number(match[1]), Number(match[2]));
  return null;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function vcaExportValue(row: Vca, field: string): string {
  const value = row[field];
  return value === null || value === undefined ? "" : String(value);
}

export const activeVcaColumns: ReadonlyArray<ColumnDef<Vca>> = [
  {
    id: "vcaId",
    header: "Unique ID",
    sortField: "uid",
    meta: { field: "vcaId", label: "Unique ID", exportHeader: "Unique ID", locked: true },
  },
  {
    id: "gender",
    header: "Gender",
    meta: { field: "vca_gender", label: "Gender", exportHeader: "Gender" },
    cell: (row) => String(row.vca_gender ?? row.gender ?? "N/A"),
  },
  {
    id: "age",
    header: "Age",
    meta: { field: "birthdate", label: "Age", exportHeader: "Age" },
    cell: (row) => calculateVcaAge(row.birthdate)?.toString() ?? "N/A",
  },
  {
    id: "details",
    header: "Household details",
    meta: {
      field: "homeaddress",
      label: "Household details",
      exportHeader: "Home Address",
      className: "whitespace-pre-line max-w-72",
    },
    cell: detail,
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
];

export const activeVcaExportColumns: ReadonlyArray<ColumnDef<Vca>> = [
  {
    id: "vcaId",
    header: "Unique ID",
    meta: {
      field: "vcaId",
      label: "Unique ID",
      exportHeader: "Unique ID",
      exportValue: (row) => row.vcaId,
    },
  },
  {
    id: "gender",
    header: "Gender",
    meta: {
      field: "vca_gender",
      label: "Gender",
      exportHeader: "Gender",
      exportValue: (row) => String(row.vca_gender ?? row.gender ?? ""),
    },
  },
  {
    id: "age",
    header: "Age",
    meta: {
      field: "birthdate",
      label: "Age",
      exportHeader: "Age",
      exportValue: (row) => String(calculateVcaAge(row.birthdate) ?? ""),
    },
  },
  {
    id: "homeAddress",
    header: "Home Address",
    meta: {
      field: "homeaddress",
      label: "Home Address",
      exportHeader: "Home Address",
      exportValue: (row) => vcaExportValue(row, "homeaddress"),
    },
  },
  {
    id: "facility",
    header: "Facility",
    meta: {
      field: "facility",
      label: "Facility",
      exportHeader: "Facility",
      exportValue: (row) => vcaExportValue(row, "facility"),
    },
  },
  {
    id: "province",
    header: "Province",
    meta: {
      field: "province",
      label: "Province",
      exportHeader: "Province",
      exportValue: (row) => vcaExportValue(row, "province"),
    },
  },
  {
    id: "district",
    header: "District",
    meta: {
      field: "district",
      label: "District",
      exportHeader: "District",
      exportValue: (row) => vcaExportValue(row, "district"),
    },
  },
  {
    id: "ward",
    header: "Ward",
    meta: {
      field: "ward",
      label: "Ward",
      exportHeader: "Ward",
      exportValue: (row) => vcaExportValue(row, "ward"),
    },
  },
  {
    id: "lastServiceDate",
    header: "Last Service Date",
    meta: {
      field: "last_service_date",
      label: "Last Service Date",
      exportHeader: "Last Service Date",
      exportValue: (row) => vcaExportValue(row, "last_service_date"),
    },
  },
  {
    id: "virallySuppressed",
    header: "Virally Suppressed",
    meta: {
      field: "virally_suppressed",
      label: "Virally Suppressed",
      exportHeader: "Virally Suppressed",
      exportValue: (row) => vcaExportValue(row, "virally_suppressed"),
    },
  },
];

export const archivedVcaColumns: ReadonlyArray<ColumnDef<Vca>> = [
  ...activeVcaColumns,
  {
    id: "archivedOn",
    header: "Archived",
    meta: { field: "de_registration_date", label: "Archived", exportHeader: "Archived On" },
    cell: (row) => String(row.de_registration_date ?? "—"),
  },
  {
    id: "reason",
    header: "Reason",
    meta: { field: "reason", label: "Reason", exportHeader: "Reason" },
  },
];

export const archivedVcaExportColumns: ReadonlyArray<ColumnDef<Vca>> = [
  ...activeVcaExportColumns,
  {
    id: "archivedOn",
    header: "Archived On",
    meta: {
      field: "de_registration_date",
      label: "Archived On",
      exportHeader: "Archived On",
      exportValue: (row) => vcaExportValue(row, "de_registration_date"),
    },
  },
  {
    id: "reason",
    header: "Reason",
    meta: {
      field: "reason",
      label: "Reason",
      exportHeader: "Reason",
      exportValue: (row) => vcaExportValue(row, "reason"),
    },
  },
];

export type VcaRiskRow = Vca & {
  hasHealth: boolean;
  hasSchooled: boolean;
  hasSafe: boolean;
  hasStable: boolean;
  domainCount: number;
  statusTags: string;
};

export const VCA_RISK_TYPES = programConfig.vcaRiskTypes;
export type VcaRiskType = (typeof VCA_RISK_TYPES)[number]["value"];

const SERVICE_FIELDS = {
  hasHealth: "health_services",
  hasSchooled: "schooled_services",
  hasSafe: "safe_services",
  hasStable: "stable_services",
} as const;

export function isCategoryProvided(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0) return false;
  let candidate: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        candidate = JSON.parse(trimmed) as unknown;
      } catch {
        candidate = trimmed;
      }
    }
  }
  if (Array.isArray(candidate))
    return candidate.some(
      (item) =>
        !["", "not applicable", "none", "null", "n/a", "na", "no", "false", "0"].includes(
          String(item).trim().toLowerCase(),
        ),
    );
  if (candidate && typeof candidate === "object") return Object.keys(candidate).length > 0;
  return ![
    "",
    "not applicable",
    "n/a",
    "na",
    "none",
    "no",
    "false",
    "0",
    "[]",
    "{}",
    "null",
  ].includes(String(candidate).trim().toLowerCase());
}

export function serviceDateInWindow(value: unknown, window: FyWindow): boolean | null {
  if (window.from === null && window.to === null) return true;
  const day = sourceDay(value);
  if (!day) return null;
  if (window.from && day < window.from) return false;
  if (window.to && day > window.to) return false;
  return true;
}

function sourceDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) return dayString(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dayFirst = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(raw);
  if (dayFirst) return dayString(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  return null;
}

function dayString(year: number, month: number, day: number): string | null {
  const date = validDate(year, month, day);
  return date
    ? `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    : null;
}

export function buildVcaRiskRows(
  vcas: ReadonlyArray<Vca>,
  services: ReadonlyArray<Record<string, unknown>>,
  window: FyWindow,
): ReadonlyArray<VcaRiskRow> {
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const service of services) {
    if (serviceDateInWindow(pick(service, ["service_date", "visit_date", "date"]), window) !== true)
      continue;
    const id = String(pick(service, ["vcaid", "vca_id", "child_id", "uid", "id"]) ?? "")
      .trim()
      .toLowerCase();
    if (!id) continue;
    grouped.set(id, [...(grouped.get(id) ?? []), service]);
  }
  return vcas.map((vca) => {
    const ids = [vca.vcaId, vca.uid, vca.uniqueId, vca.vcaid]
      .filter(Boolean)
      .map((id) => id!.toLowerCase());
    const linked = ids.flatMap((id) => grouped.get(id) ?? []);
    const coverage = Object.fromEntries(
      Object.entries(SERVICE_FIELDS).map(([key, field]) => [
        key,
        linked.some((row) => isCategoryProvided(row[field])),
      ]),
    ) as Pick<VcaRiskRow, keyof typeof SERVICE_FIELDS>;
    const domainCount = Object.values(coverage).filter(Boolean).length;
    const statusTags =
      [
        coverage.hasHealth ? "Health" : null,
        coverage.hasSchooled ? "Schooled" : null,
        coverage.hasSafe ? "Safe" : null,
        coverage.hasStable ? "Stable" : null,
        domainCount === 4 ? "Grad-ready" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "None";
    return { ...vca, ...coverage, domainCount, statusTags };
  });
}

export function selectVcaRiskRows(
  rows: ReadonlyArray<VcaRiskRow>,
  type: VcaRiskType,
): ReadonlyArray<VcaRiskRow> {
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

export const vcaRiskFilters: ReadonlyArray<FilterDef> = [
  {
    id: "type",
    label: "Risk type",
    type: "select",
    field: "domainCount",
    allValue: "All",
    allLabel: "Missing health services",
    options: VCA_RISK_TYPES.map(({ value, label }) => ({ value, label })),
  },
  {
    id: "q",
    label: "Search",
    type: "text",
    placeholder: "Search by ID or district…",
    fields: ["vcaId", "district"],
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

export const vcaRiskColumns: ReadonlyArray<ColumnDef<VcaRiskRow>> = [
  {
    id: "vcaId",
    header: "VCA ID",
    meta: { field: "vcaId", label: "VCA ID", exportHeader: "VCA ID", locked: true },
  },
  {
    id: "district",
    header: "District",
    meta: { field: "district", label: "District", exportHeader: "District" },
  },
  {
    id: "age",
    header: "Age",
    meta: { field: "age", label: "Age", exportHeader: "Age" },
    cell: (row) => String(row.age ?? calculateVcaAge(row.birthdate) ?? "N/A"),
  },
  {
    id: "statusTags",
    header: "Domain status",
    meta: {
      field: "statusTags",
      label: "Domain status",
      exportHeader: "Domain Status",
      exportValue: (row) => row.statusTags,
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
    cell: (row) => (row.hasHealth ? "Yes" : "No"),
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
    cell: (row) => (row.hasSchooled ? "Yes" : "No"),
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
    cell: (row) => (row.hasSafe ? "Yes" : "No"),
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
    cell: (row) => (row.hasStable ? "Yes" : "No"),
  },
  {
    id: "domainCount",
    header: "Domains covered",
    meta: {
      field: "domainCount",
      label: "Domains covered",
      exportHeader: "Domains Covered",
      exportValue: (row) => `${row.domainCount}/4`,
    },
    cell: (row) => `${row.domainCount} / 4`,
  },
];

export const vcaRiskExportColumns: ReadonlyArray<ColumnDef<VcaRiskRow>> = vcaRiskColumns;

export function sortVcaRowsByDate(
  rows: ReadonlyArray<Record<string, unknown>>,
  dateKeys: ReadonlyArray<string>,
): ReadonlyArray<Record<string, unknown>> {
  return [...rows].sort((a, b) =>
    (sourceDay(pick(b, dateKeys)) ?? "").localeCompare(sourceDay(pick(a, dateKeys)) ?? ""),
  );
}
