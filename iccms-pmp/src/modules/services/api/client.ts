import { allDistricts } from "@/config";
import { request } from "@/core/api";
import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";
import type { FyWindow } from "@/platform/scope/fy";

import {
  emptyServicePage,
  parseServiceRows,
  SERVICE_PILLARS,
  SERVICE_PILLAR_COLUMNS,
  type ServicePageResult,
  type ServiceRecord,
  type ServiceType,
} from "./schemas";

export const SERVICE_PAGE_SIZE = 100;
export const SERVICE_MERGE_CAP_PER_DISTRICT = 5_000;
export const SERVICE_EXPORT_CAP = 20_000;

export type ServiceListFilters = {
  district?: string;
  search?: string;
  domain?: string;
  issue?: string;
  dateWindow?: string;
};

export type ServicePageRequest = ServiceListFilters & {
  type: ServiceType;
  scope: Scope;
  page: number;
  pageSize: number;
};

export function districtsForServicesScope(scope: Scope): ReadonlyArray<string> {
  switch (scope.level) {
    case "national":
      return allDistricts.map(({ district }) => district);
    case "province":
      return scope.districts;
    case "district":
      return [scope.district];
    case "none":
      return [];
  }
}

export function serviceDistrictsForFilter(scope: Scope, selected?: string): ReadonlyArray<string> {
  const allowed = districtsForServicesScope(scope);
  if (scope.level === "none") return [];
  if (!selected || selected === "All" || selected.toLowerCase() === "all") return allowed;
  const normalized = normalizeDistrict(selected);
  return allowed.filter((district) => normalizeDistrict(district) === normalized);
}

function unwrapRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function queryForPage(
  filters: ServiceListFilters,
  page: number,
  pageSize: number,
  entityId?: string,
): Record<string, string> {
  const query: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
  if (entityId) query.entityId = entityId;
  if (filters.search?.trim()) query.search = filters.search.trim();
  if (filters.domain && filters.domain !== "all") query.domain = filters.domain;
  if (filters.issue) query.issue = filters.issue;
  if (filters.dateWindow && filters.dateWindow !== "all") query.dateWindow = filters.dateWindow;
  return query;
}

async function requestRecordsPage(
  type: ServiceType,
  district: string,
  filters: ServiceListFilters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
  entityId?: string,
): Promise<ServicePageResult> {
  const payload = await request<unknown>({
    path: `/etl/services/${type}/records`,
    query: { ...queryForPage(filters, page, pageSize, entityId), district },
    signal,
  });
  return parseServiceRows(payload, type);
}

function parsedDate(value: string): number {
  if (!value || value === "N/A") return 0;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  let date: Date | null = null;
  if (iso) date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  else {
    const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(value);
    if (dmy) date = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  }
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function scopedRows(
  rows: ReadonlyArray<ServiceRecord>,
  district: string,
): ReadonlyArray<ServiceRecord> {
  const normalized = normalizeDistrict(district);
  return rows.filter((row) => normalizeDistrict(row.district) === normalized);
}

/**
 * Merge server pages from one exact district per request. For page N, fetch the first N pages' worth
 * from each allowed district so the merged date order is stable. Every returned row is rechecked against
 * the requested district because the API trusts this path parameter.
 */
export async function fetchServiceRecords(
  input: ServicePageRequest,
  signal?: AbortSignal,
): Promise<ServicePageResult> {
  const districts = serviceDistrictsForFilter(input.scope, input.district);
  if (districts.length === 0) return emptyServicePage();
  const targetPrefix = input.page * input.pageSize;
  const cappedPrefix = Math.min(targetPrefix, SERVICE_MERGE_CAP_PER_DISTRICT);
  const pagesNeeded = Math.max(1, Math.ceil(cappedPrefix / SERVICE_PAGE_SIZE));
  const requests = districts.flatMap((district) =>
    Array.from({ length: pagesNeeded }, (_, index) => ({ district, page: index + 1 })),
  );
  const responses = await Promise.all(
    requests.map(({ district, page }) =>
      requestRecordsPage(input.type, district, input, page, SERVICE_PAGE_SIZE, signal),
    ),
  );

  const collected: ServiceRecord[] = [];
  let total = 0;
  const stats = {
    loaded: 0,
    monthly: 0,
    recordsWithIssues: 0,
    issueCounts: {} as Record<string, number>,
  };
  responses.forEach((response, index) => {
    const requestDistrict = requests[index]!.district;
    const validRows = scopedRows(response.rows, requestDistrict);
    collected.push(...validRows);
    if (requests[index]!.page === 1) {
      total += response.total;
      stats.loaded += response.stats.loaded;
      stats.monthly += response.stats.monthly;
      stats.recordsWithIssues += response.stats.recordsWithIssues;
      for (const [key, count] of Object.entries(response.stats.issueCounts))
        stats.issueCounts[key] = (stats.issueCounts[key] ?? 0) + count;
    }
  });

  const unique = new Map<string, ServiceRecord>();
  for (const row of collected)
    unique.set(
      `${row.type}:${normalizeDistrict(row.district)}:${row.entityId}:${row.serviceDate}:${row.id}`,
      row,
    );
  const ordered = [...unique.values()].sort(
    (a, b) =>
      parsedDate(b.serviceDate) - parsedDate(a.serviceDate) ||
      a.entityId.localeCompare(b.entityId, "en"),
  );
  const start = (input.page - 1) * input.pageSize;
  const rows = ordered.slice(start, start + input.pageSize);
  const capped = targetPrefix > SERVICE_MERGE_CAP_PER_DISTRICT;
  return {
    rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    page: input.page,
    pageSize: input.pageSize,
    stats,
    truncated: capped,
  };
}

function sumValues(values: ReadonlyArray<unknown>): unknown {
  const objects = values.filter(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value),
  );
  if (objects.length) {
    const keys = [...new Set(objects.flatMap((object) => Object.keys(object)))];
    return Object.fromEntries(
      keys.map((key) => [key, sumValues(objects.map((object) => object[key]))]),
    );
  }
  const numbers = values.map((value) => Number(value));
  if (values.length && numbers.every(Number.isFinite))
    return numbers.reduce((total, value) => total + value, 0);
  return values.find((value) => value !== null && value !== undefined) ?? null;
}

export async function fetchServiceSummary(
  type: ServiceType,
  scope: Scope,
  window: FyWindow,
  district?: string,
) {
  const districts = serviceDistrictsForFilter(scope, district);
  const payloads = await Promise.all(
    districts.map((requestedDistrict) => {
      const query: Record<string, string> = { district: requestedDistrict };
      if (window.from) query.from = window.from;
      if (window.to) query.to = window.to;
      return request<unknown>({ path: `/etl/services/${type}/summary`, query });
    }),
  );
  const values = payloads.map(unwrapRecord);
  const data = values
    .map((value) => (value.data && typeof value.data === "object" ? value.data : {}))
    .filter(Boolean);
  return {
    type,
    source: values
      .map((value) => String(value.source ?? ""))
      .filter(Boolean)
      .join(" · "),
    generatedAt:
      values
        .map((value) => String(value.generated_at ?? ""))
        .sort()
        .at(-1) ?? null,
    data: sumValues(data) as Record<string, unknown>,
  };
}

async function fetchDistrictCollection(
  path: string,
  scope: Scope,
  district: string | undefined,
  type: ServiceType,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  const districts = serviceDistrictsForFilter(scope, district);
  const responses = await Promise.all(
    districts.map((requestedDistrict) =>
      request<unknown>({ path, query: { type, district: requestedDistrict } }),
    ),
  );
  return responses.flatMap((payload) => {
    const record = unwrapRecord(payload);
    return Array.isArray(record.data)
      ? record.data.filter(
          (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
        )
      : [];
  });
}

export async function fetchServiceTimeseries(type: ServiceType, scope: Scope, district?: string) {
  const raw = await fetchDistrictCollection(
    `/etl/services/${type}/timeseries`,
    scope,
    district,
    type,
  );
  const totals = new Map<string, { month: string; label: string; count: number }>();
  for (const row of raw) {
    const month = String(row.month ?? "");
    if (!month) continue;
    const existing = totals.get(month) ?? { month, label: String(row.label ?? month), count: 0 };
    existing.count += Number(row.count ?? 0) || 0;
    totals.set(month, existing);
  }
  return [...totals.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export async function fetchServiceDistribution(type: ServiceType, scope: Scope, district?: string) {
  const raw = await fetchDistrictCollection(
    `/etl/services/${type}/distribution`,
    scope,
    district,
    type,
  );
  const totals = new Map<string, number>();
  for (const row of raw) {
    const service = String(row.service ?? row.pillar ?? "");
    if (service) totals.set(service, (totals.get(service) ?? 0) + (Number(row.count ?? 0) || 0));
  }
  return [...totals]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchServiceActionQueue(type: ServiceType, scope: Scope, district?: string) {
  const raw = await fetchDistrictCollection("/etl/action-queue", scope, district, type);
  const merged = new Map<string, Record<string, unknown>>();
  for (const item of raw) {
    const key = String(item.key ?? "");
    if (!key) continue;
    const current = merged.get(key) ?? { ...item, count: 0 };
    current.count = (Number(current.count) || 0) + (Number(item.count) || 0);
    merged.set(key, current);
  }
  return [...merged.values()];
}

export async function fetchServiceDuplicates(type: ServiceType, scope: Scope, district?: string) {
  const districts = serviceDistrictsForFilter(scope, district);
  const payloads = await Promise.all(
    districts.map((requestedDistrict) =>
      request<unknown>({ path: "/etl/duplicates", query: { type, district: requestedDistrict } }),
    ),
  );
  const groups = payloads.flatMap((payload) => {
    const data = unwrapRecord(payload).data;
    return data &&
      typeof data === "object" &&
      Array.isArray((data as Record<string, unknown>).groups)
      ? ((data as Record<string, unknown>).groups as unknown[]).filter(
          (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
        )
      : [];
  });
  const safeGroups = groups.filter((group) =>
    districts.some((district) => normalizeDistrict(district) === normalizeDistrict(group.district)),
  );
  return { groups: safeGroups, totalGroups: safeGroups.length };
}

export type SafeServiceDetail = {
  type: ServiceType;
  entityId: string;
  district: string;
  facility: string;
  serviceDate: string;
  status: string;
  servicesByDomain: ReadonlyArray<{ domain: string; values: ReadonlyArray<string> }>;
};

function safeDetail(value: Record<string, unknown>, type: ServiceType): SafeServiceDetail {
  // Build only explicitly approved fields; never spread the joined backend payload.
  const safeDomains = SERVICE_PILLARS[type].map((domain) => {
    const key = SERVICE_PILLAR_COLUMNS[type][domain];
    const otherKey = key ? `other_${key}` : "";
    return {
      domain,
      values: [
        ...new Set([
          ...(key ? stringList(value[key]) : []),
          ...(otherKey ? stringList(value[otherKey]) : []),
        ]),
      ],
    };
  });
  const statusRaw = String(value.case_status ?? value.status ?? "Synced");
  return {
    type,
    entityId: String(value.vcaid ?? value.uid ?? value.household_id ?? value.entity_id ?? ""),
    district: String(value.district ?? "N/A"),
    facility: String(value.facility ?? "N/A"),
    serviceDate: String(value.service_date ?? value.serviceDate ?? "N/A"),
    status: statusRaw.trim() === "1" || statusRaw.toLowerCase() === "active" ? "Active" : statusRaw,
    servicesByDomain: safeDomains,
  };
}

function stringList(value: unknown): ReadonlyArray<string> {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Preserve a plain-text "other" intervention as one value.
  }
  return [value.trim()];
}

/** Resolve scope first through district-filtered records, then fetch the endpoint's latest detail. */
export async function fetchServiceDetail(
  type: ServiceType,
  entityId: string,
  scope: Scope,
  selectedDate?: string,
  signal?: AbortSignal,
): Promise<{ selected: ServiceRecord; latest: SafeServiceDetail; isLatestVisit: boolean }> {
  const districts = districtsForServicesScope(scope);
  if (!entityId || districts.length === 0)
    throw new Error("This service record is not available in your scope.");
  const firstPages = await Promise.all(
    districts.map((district) =>
      requestRecordsPage(
        type,
        district,
        { search: entityId, dateWindow: "all" },
        1,
        SERVICE_PAGE_SIZE,
        signal,
      ),
    ),
  );
  const matches = firstPages.flatMap((result, index) =>
    scopedRows(result.rows, districts[index]!)
      .filter((row) => row.entityId.toLowerCase() === entityId.toLowerCase())
      .map((row) => ({ row, district: districts[index]! })),
  );
  if (matches.length === 0) throw new Error("This service record is not available in your scope.");
  const candidateDistricts = [...new Set(matches.map(({ district }) => district))];
  let requested: { row: ServiceRecord; district: string } | undefined;
  for (const district of candidateDistricts) {
    const first = await requestRecordsPage(
      type,
      district,
      {},
      1,
      SERVICE_PAGE_SIZE,
      signal,
      entityId,
    );
    const entityRows = scopedRows(first.rows, district).filter(
      (row) => row.entityId.toLowerCase() === entityId.toLowerCase(),
    );
    requested = entityRows.find((row) => !selectedDate || row.serviceDate === selectedDate)
      ? {
          row: entityRows.find((row) => !selectedDate || row.serviceDate === selectedDate)!,
          district,
        }
      : undefined;
    if (!requested && selectedDate) {
      const lastPage = Math.min(
        first.totalPages,
        Math.ceil(SERVICE_MERGE_CAP_PER_DISTRICT / SERVICE_PAGE_SIZE),
      );
      for (let page = 2; page <= lastPage && !requested; page += 1) {
        const next = await requestRecordsPage(
          type,
          district,
          {},
          page,
          SERVICE_PAGE_SIZE,
          signal,
          entityId,
        );
        const row = scopedRows(next.rows, district).find(
          (item) =>
            item.entityId.toLowerCase() === entityId.toLowerCase() &&
            item.serviceDate === selectedDate,
        );
        if (row) requested = { row, district };
      }
    }
    if (requested) break;
  }
  if (!requested) throw new Error("The selected visit is not available in your scope.");
  const payload = await request<unknown>({
    path: `/etl/services/${type}/record-detail`,
    query: { entityId, district: requested.district },
    signal,
  });
  const details = unwrapRecord(payload);
  const latestRaw =
    details.data && typeof details.data === "object"
      ? (details.data as Record<string, unknown>)
      : {};
  const latest = safeDetail(latestRaw, type);
  if (
    latest.entityId.toLowerCase() !== entityId.toLowerCase() ||
    normalizeDistrict(latest.district) !== normalizeDistrict(requested.district)
  )
    throw new Error("The service detail did not match the scoped record.");
  const latestDate = parsedDate(latest.serviceDate);
  const selectedDateValue = parsedDate(requested.row.serviceDate);
  return {
    selected: requested.row,
    latest,
    isLatestVisit:
      latestDate > 0 && selectedDateValue > 0
        ? latestDate === selectedDateValue
        : latest.serviceDate === requested.row.serviceDate,
  };
}

export async function fetchServiceExportRows(
  type: ServiceType,
  scope: Scope,
  filters: ServiceListFilters,
  signal?: AbortSignal,
): Promise<{ rows: ReadonlyArray<ServiceRecord>; total: number; truncated: boolean }> {
  const districts = serviceDistrictsForFilter(scope, filters.district);
  const firstPages = await Promise.all(
    districts.map((district) =>
      requestRecordsPage(type, district, filters, 1, SERVICE_PAGE_SIZE, signal),
    ),
  );
  const total = firstPages.reduce((sum, result) => sum + result.total, 0);
  const rows: ServiceRecord[] = [];
  for (let index = 0; index < districts.length && rows.length < SERVICE_EXPORT_CAP; index += 1) {
    const district = districts[index]!;
    const first = firstPages[index]!;
    const districtRows = [...scopedRows(first.rows, district)];
    const pages = Math.ceil(first.total / SERVICE_PAGE_SIZE);
    for (
      let page = 2;
      page <= pages && rows.length + districtRows.length < SERVICE_EXPORT_CAP;
      page += 1
    ) {
      const next = await requestRecordsPage(
        type,
        district,
        filters,
        page,
        SERVICE_PAGE_SIZE,
        signal,
      );
      districtRows.push(...scopedRows(next.rows, district));
    }
    rows.push(...districtRows.slice(0, Math.max(0, SERVICE_EXPORT_CAP - rows.length)));
  }
  return { rows, total, truncated: total > rows.length };
}
