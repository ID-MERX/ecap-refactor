import type { Scope } from "@/core/access/types";
import { fyKey, type FyWindow } from "@/platform/scope/fy";

import {
  districtsForServicesScope,
  fetchServiceActionQueue,
  fetchServiceDetail,
  fetchServiceDistribution,
  fetchServiceDuplicates,
  fetchServiceRecords,
  fetchServiceSummary,
  fetchServiceTimeseries,
  type ServiceListFilters,
} from "./client";
import type { ServiceType } from "./schemas";

function scopeKey(scope: Scope): string {
  switch (scope.level) {
    case "national":
      return "national";
    case "province":
      return `province:${scope.province}`;
    case "district":
      return `district:${scope.district}`;
    case "none":
      return "none";
  }
}

export const serviceKeys = {
  all: ["services"] as const,
  records: (
    type: ServiceType,
    scope: Scope,
    filters: ServiceListFilters,
    page: number,
    pageSize: number,
  ) =>
    [
      ...serviceKeys.all,
      type,
      "records",
      scopeKey(scope),
      districtsForServicesScope(scope),
      filters,
      page,
      pageSize,
    ] as const,
  summary: (type: ServiceType, scope: Scope, window: FyWindow, district?: string) =>
    [
      ...serviceKeys.all,
      type,
      "summary",
      scopeKey(scope),
      fyKey(window),
      district ?? "all",
    ] as const,
  timeseries: (type: ServiceType, scope: Scope, district?: string) =>
    [...serviceKeys.all, type, "timeseries", scopeKey(scope), district ?? "all"] as const,
  distribution: (type: ServiceType, scope: Scope, district?: string) =>
    [...serviceKeys.all, type, "distribution", scopeKey(scope), district ?? "all"] as const,
  actionQueue: (type: ServiceType, scope: Scope, district?: string) =>
    [...serviceKeys.all, type, "action-queue", scopeKey(scope), district ?? "all"] as const,
  duplicates: (type: ServiceType, scope: Scope, district?: string) =>
    [...serviceKeys.all, type, "duplicates", scopeKey(scope), district ?? "all"] as const,
  detail: (type: ServiceType, id: string, date: string, scope: Scope) =>
    [...serviceKeys.all, type, "detail", scopeKey(scope), id, date] as const,
};

export function serviceRecordsQuery(
  type: ServiceType,
  scope: Scope,
  filters: ServiceListFilters,
  page: number,
  pageSize: number,
) {
  return {
    queryKey: serviceKeys.records(type, scope, filters, page, pageSize),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchServiceRecords({ type, scope, ...filters, page, pageSize }, signal),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function serviceSummaryQuery(
  type: ServiceType,
  scope: Scope,
  window: FyWindow,
  district?: string,
) {
  return {
    queryKey: serviceKeys.summary(type, scope, window, district),
    queryFn: () => fetchServiceSummary(type, scope, window, district),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function serviceTimeseriesQuery(type: ServiceType, scope: Scope, district?: string) {
  return {
    queryKey: serviceKeys.timeseries(type, scope, district),
    queryFn: () => fetchServiceTimeseries(type, scope, district),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function serviceDistributionQuery(type: ServiceType, scope: Scope, district?: string) {
  return {
    queryKey: serviceKeys.distribution(type, scope, district),
    queryFn: () => fetchServiceDistribution(type, scope, district),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function serviceActionQueueQuery(type: ServiceType, scope: Scope, district?: string) {
  return {
    queryKey: serviceKeys.actionQueue(type, scope, district),
    queryFn: () => fetchServiceActionQueue(type, scope, district),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function serviceDuplicatesQuery(type: ServiceType, scope: Scope, district?: string) {
  return {
    queryKey: serviceKeys.duplicates(type, scope, district),
    queryFn: () => fetchServiceDuplicates(type, scope, district),
    enabled: scope.level !== "none",
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function serviceDetailQuery(type: ServiceType, id: string, date: string, scope: Scope) {
  return {
    queryKey: serviceKeys.detail(type, id, date, scope),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      fetchServiceDetail(type, id, scope, date, signal),
    enabled: scope.level !== "none" && Boolean(id),
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}
