export const SERVICE_TYPES = ["vca", "household", "caregiver"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_PILLARS: Record<ServiceType, ReadonlyArray<string>> = {
  vca: ["HIV", "Health", "Education", "Safety", "Stability"],
  caregiver: ["HIV", "Health", "Education", "Safety", "Stability"],
  household: ["Health", "Household", "Education", "Safety", "Stability"],
};

/** Explicit backend column mapping; labels are presentation-only and do not always match field names. */
export const SERVICE_PILLAR_COLUMNS: Record<ServiceType, Readonly<Record<string, string>>> = {
  vca: {
    HIV: "hiv_services",
    Health: "health_services",
    Education: "schooled_services",
    Safety: "safe_services",
    Stability: "stable_services",
  },
  caregiver: {
    HIV: "hiv_services",
    Health: "health_services",
    Education: "schooled_services",
    Safety: "safe_services",
    Stability: "stable_services",
  },
  household: {
    Health: "health_services",
    Household: "hh_level_services",
    Education: "schooled_services",
    Safety: "safe_services",
    Stability: "stable_services",
  },
};

export const SERVICE_ISSUES = [
  "missing_date",
  "no_service_details",
  "missing_caseworker",
  "missing_district",
  "stale_90d",
] as const;
export type ServiceIssue = (typeof SERVICE_ISSUES)[number];

export type ServiceRecord = {
  id: string;
  type: ServiceType;
  entityId: string;
  entityLabel: "VCA" | "Household";
  district: string;
  facility: string;
  serviceDate: string;
  serviceNames: ReadonlyArray<string>;
  pillars: ReadonlyArray<string>;
  status: string;
  issues: ReadonlyArray<string>;
  issueKeys: ReadonlyArray<string>;
  ageDays: number | null;
};

export type ServicePageResult = {
  rows: ReadonlyArray<ServiceRecord>;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  stats: {
    loaded: number;
    monthly: number;
    recordsWithIssues: number;
    issueCounts: Record<string, number>;
  };
  truncated: boolean;
};

export type ServiceSummary = {
  type: ServiceType;
  source: string;
  generatedAt: string | null;
  data: Record<string, unknown>;
};

export function isServiceType(value: unknown): value is ServiceType {
  return typeof value === "string" && SERVICE_TYPES.includes(value as ServiceType);
}

function string(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || fallback;
}

function strings(value: unknown): ReadonlyArray<string> {
  if (Array.isArray(value)) return value.map((item) => string(item)).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => string(item)).filter(Boolean);
  } catch {
    // Older service columns can contain comma-separated text rather than JSON.
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeServiceRecord(
  value: Record<string, unknown>,
  type: ServiceType,
): ServiceRecord {
  const entityId = string(
    value.entityId ?? value.entity_id ?? value.vcaid ?? value.household_id ?? value.hh_id,
  );
  const issueKeys = strings(value.issueKeys ?? value.issue_keys);
  const issues = strings(value.issues);
  const explicitPillars = strings(value.pillars);
  const pillars = explicitPillars.length
    ? explicitPillars
    : SERVICE_PILLARS[type].filter((pillar) => {
        const key = SERVICE_PILLAR_COLUMNS[type][pillar];
        return key ? strings(value[key]).length > 0 : false;
      });
  const serviceNames = strings(value.serviceNames ?? value.service_names);
  const serviceDate = string(value.serviceDate ?? value.service_date, "N/A");
  const rawStatus = string(value.status ?? value.case_status, "Synced");

  const rawAgeDays = value.ageDays ?? value.age_days;
  const parsedAgeDays = rawAgeDays === null || rawAgeDays === undefined ? null : Number(rawAgeDays);

  return {
    id: string(value.id, `${type}-${entityId}-${serviceDate}`),
    type,
    entityId,
    entityLabel: type === "vca" ? "VCA" : "Household",
    district: string(value.district, "N/A"),
    facility: string(value.facility, "N/A"),
    serviceDate,
    serviceNames,
    pillars,
    status:
      rawStatus.toLowerCase() === "1" || rawStatus.toLowerCase() === "active"
        ? "Active"
        : rawStatus,
    issues,
    issueKeys,
    ageDays: parsedAgeDays !== null && Number.isFinite(parsedAgeDays) ? parsedAgeDays : null,
  };
}

export function parseServiceRows(payload: unknown, type: ServiceType): ServicePageResult {
  if (!payload || typeof payload !== "object") return emptyServicePage();
  const outer = payload as Record<string, unknown>;
  const data = Array.isArray(outer.data) ? outer.data : [];
  const stats =
    outer.stats && typeof outer.stats === "object" ? (outer.stats as Record<string, unknown>) : {};
  const issueCounts =
    stats.issueCounts && typeof stats.issueCounts === "object"
      ? Object.fromEntries(
          Object.entries(stats.issueCounts as Record<string, unknown>).map(([key, count]) => [
            key,
            number(count),
          ]),
        )
      : {};
  const page = Math.max(1, number(outer.page, 1));
  const pageSize = Math.max(1, number(outer.pageSize ?? outer.page_size, 12));
  const total = Math.max(
    0,
    number(outer.totalRecords ?? outer.total_records ?? stats.loaded, data.length),
  );
  return {
    rows: data
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => normalizeServiceRecord(row, type)),
    total,
    totalPages: Math.max(
      1,
      number(outer.totalPages ?? outer.total_pages, Math.ceil(total / pageSize)),
    ),
    page,
    pageSize,
    stats: {
      loaded: number(stats.loaded, total),
      monthly: number(stats.monthly),
      recordsWithIssues: number(stats.recordsWithIssues ?? stats.records_with_issues),
      issueCounts,
    },
    truncated: false,
  };
}

export function emptyServicePage(): ServicePageResult {
  return {
    rows: [],
    total: 0,
    totalPages: 1,
    page: 1,
    pageSize: 12,
    stats: { loaded: 0, monthly: 0, recordsWithIssues: 0, issueCounts: {} },
    truncated: false,
  };
}
