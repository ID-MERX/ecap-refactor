/** API calls used by the archived/risk registers and a household profile. */

import { directusRequest, request } from "@/core/api";
import { scopeDistricts } from "@/core/access/deriveAccess";
import type { Scope } from "@/core/access/types";
import { fyKey, type FyWindow } from "@/platform/scope/fy";

import { normalizeHousehold, unwrapList, type Household } from "./schemas";
import { MAX_ROWS } from "./client";

function districtPath(districts: ReadonlyArray<string> | undefined): string {
  return encodeURIComponent(districts?.join(",") ?? "");
}

function rows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  return unwrapList(payload);
}

function capped<T>(all: ReadonlyArray<T>): { rows: ReadonlyArray<T>; truncated: boolean } {
  return { rows: all.slice(0, MAX_ROWS), truncated: all.length > MAX_ROWS };
}

export const archivedHouseholdKeys = {
  all: ["households", "archived"] as const,
  list: (scope: string, fy: string, reason: string) =>
    [...archivedHouseholdKeys.all, scope, fy, reason] as const,
};

export async function fetchArchivedHouseholds(
  scope: Scope,
  window: FyWindow,
  reason: string,
): Promise<{ rows: ReadonlyArray<Household>; truncated: boolean }> {
  const query: Record<string, string> = {};
  if (reason !== "all") query.de_registration_reason = reason;
  if (window.from) query.from = window.from;
  if (window.to) query.to = window.to;
  const payload = await request<unknown>({
    path: `/household/all-households-archived/${districtPath(scopeDistricts(scope))}`,
    query,
  });
  const result = capped(
    rows(payload)
      .map(normalizeHousehold)
      .filter((row) => row.householdId !== ""),
  );
  return result;
}

export function archivedHouseholdQuery(scope: Scope, window: FyWindow, reason: string) {
  return {
    queryKey: archivedHouseholdKeys.list(
      `${scope.level}:${scope.level === "district" ? scope.district : scope.level === "province" ? scope.province : ""}`,
      fyKey(window),
      reason,
    ),
    queryFn: () => fetchArchivedHouseholds(scope, window, reason),
    enabled: scope.level !== "none",
    staleTime: 10 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export const householdRiskKeys = {
  services: (scope: string) => ["households", "risk", "services", scope] as const,
};

export async function fetchHouseholdServices(
  scope: Scope,
): Promise<{ rows: ReadonlyArray<Record<string, unknown>>; truncated: boolean }> {
  const payload = await request<unknown>({
    path: `/household/household-services-by-district/${districtPath(scopeDistricts(scope))}`,
  });
  return capped(rows(payload));
}

export function householdServicesQuery(scope: Scope) {
  const key = `${scope.level}:${scope.level === "district" ? scope.district : scope.level === "province" ? scope.province : ""}`;
  return {
    queryKey: householdRiskKeys.services(key),
    queryFn: () => fetchHouseholdServices(scope),
    enabled: scope.level !== "none",
    staleTime: 10 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export type HouseholdProfileData = {
  members: ReadonlyArray<Record<string, unknown>>;
  services: ReadonlyArray<Record<string, unknown>>;
  casePlans: ReadonlyArray<Record<string, unknown>>;
  casePlanDomains: ReadonlyArray<Record<string, unknown>>;
  referrals: ReadonlyArray<Record<string, unknown>>;
};

export const householdProfileKeys = {
  root: (scope: string, id: string) => ["households", "profile", scope, id] as const,
  members: (scope: string, id: string) =>
    [...householdProfileKeys.root(scope, id), "members"] as const,
  services: (scope: string, id: string) =>
    [...householdProfileKeys.root(scope, id), "services"] as const,
  plans: (scope: string, id: string) => [...householdProfileKeys.root(scope, id), "plans"] as const,
  domains: (scope: string, id: string) =>
    [...householdProfileKeys.root(scope, id), "domains"] as const,
  referrals: (scope: string, id: string) =>
    [...householdProfileKeys.root(scope, id), "referrals"] as const,
};

async function getList(
  path: string,
  signal?: AbortSignal,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  return rows(await request<unknown>({ path, signal }));
}

/** Only called after the household has been matched in its access-scoped active/archive register. */
export type HouseholdFlag = {
  id: string;
  household_id: string;
  status: string;
  comment: string | null;
  category: string | null;
  severity: string | null;
  created_on: string | null;
};

export const householdFlagsKey = (scope: string, id: string) =>
  ["households", "profile", scope, id, "flags"] as const;

function unwrapDirectusData(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (payload && typeof payload === "object" && "data" in payload && Array.isArray(payload.data)) {
    return (payload.data as unknown[]).filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
    );
  }
  return [];
}

export async function fetchHouseholdFlags(id: string): Promise<ReadonlyArray<HouseholdFlag>> {
  const payload = await directusRequest<unknown>({
    path: "/items/flagged_forms_ecapplus_pmp",
    query: {
      "filter[household_id][_eq]": id,
      fields: "id,household_id,status,comment,category,severity,date_created",
      sort: "-date_created",
      limit: 100,
    },
  });
  return unwrapDirectusData(payload).map((row) => ({
    id: String(row.id ?? ""),
    household_id: String(row.household_id ?? ""),
    status: String(row.status ?? "pending"),
    comment: typeof row.comment === "string" ? row.comment : null,
    category: typeof row.category === "string" ? row.category : null,
    severity: typeof row.severity === "string" ? row.severity : null,
    created_on: typeof row.date_created === "string" ? row.date_created : null,
  }));
}

export async function createHouseholdFlag(payload: {
  household_id: string;
  comment: string;
  category: string;
  severity: string;
  verifier: string;
  status: "pending";
}): Promise<void> {
  await directusRequest({
    path: "/items/flagged_forms_ecapplus_pmp",
    method: "POST",
    body: payload,
  });
}

export async function resolveHouseholdFlag(id: string): Promise<void> {
  await directusRequest({
    path: `/items/flagged_forms_ecapplus_pmp/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: { status: "resolved" },
  });
}

export function casePlanDomainsQuery(scopeKey: string, householdId: string, enabled: boolean) {
  const id = encodeURIComponent(householdId);
  return {
    queryKey: householdProfileKeys.domains(scopeKey, householdId),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getList(`/household/caregiver-caseplan-domains/${id}`, signal),
    enabled: enabled && householdId.length > 0,
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
}

export function householdProfileQueries(scopeKey: string, householdId: string) {
  const id = encodeURIComponent(householdId);
  const common = {
    enabled: householdId.length > 0,
    staleTime: 5 * 60_000,
    meta: { etl: true, persist: false },
  } as const;
  return [
    {
      ...common,
      queryKey: householdProfileKeys.members(scopeKey, householdId),
      queryFn: ({ signal }: { signal: AbortSignal }) => getList(`/household/members/${id}`, signal),
    },
    {
      ...common,
      queryKey: householdProfileKeys.services(scopeKey, householdId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getList(`/household/caregiver-services/${id}`, signal),
    },
    {
      ...common,
      queryKey: householdProfileKeys.plans(scopeKey, householdId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getList(`/household/caregiver-caseplans/${id}`, signal),
    },
    {
      ...common,
      queryKey: householdProfileKeys.referrals(scopeKey, householdId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getList(`/household/caregiver-referrals/${id}`, signal),
    },
  ];
}
