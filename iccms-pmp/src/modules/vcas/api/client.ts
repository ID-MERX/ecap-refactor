import { allDistricts } from "@/config";
import { normalizeDistrict } from "@/core/lib/values";
import { request } from "@/core/api";
import type { Scope } from "@/core/access/types";

import { normalizeVca, unwrapVcaList, type Vca } from "./schemas";

export const MAX_VCA_ROWS = 20_000;

type ListKind = "active" | "archived";
type ListResult = { rows: ReadonlyArray<Vca>; truncated: boolean };

export function districtsForVcaScope(scope: Scope): ReadonlyArray<string> {
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

async function fetchDistrictList(
  kind: ListKind,
  district: string,
  from: string | null,
  to: string | null,
  reason = "all",
): Promise<ReadonlyArray<Vca>> {
  const query: Record<string, string> = {};
  if (from) query.from = from;
  if (to) query.to = to;
  if (kind === "archived" && reason !== "all") query.reason = reason;
  const endpoint = kind === "active" ? "vcas-assessed-register" : "vcas-archived-register";
  const payload = await request<unknown>({
    path: `/child/${endpoint}/${encodeURIComponent(district)}`,
    query,
  });
  return unwrapVcaList(payload)
    .map(normalizeVca)
    .filter(
      (row) =>
        row.vcaId !== "" &&
        row.district !== null &&
        normalizeDistrict(row.district) === normalizeDistrict(district),
    );
}

async function fetchScopedList(
  kind: ListKind,
  scope: Scope,
  from: string | null,
  to: string | null,
  reason = "all",
): Promise<ListResult> {
  const districts = districtsForVcaScope(scope);
  const collected: Vca[] = [];
  let truncated = false;
  // The endpoint has no server-side limit. Fetch exact allowed districts, never the empty path that
  // means national data. Stop at the documented cap and expose that the result is partial.
  for (let index = 0; index < districts.length; index += 1) {
    const rows = await fetchDistrictList(kind, districts[index]!, from, to, reason);
    const remaining = MAX_VCA_ROWS - collected.length;
    collected.push(...rows.slice(0, remaining));
    if (
      rows.length > remaining ||
      (collected.length >= MAX_VCA_ROWS && index < districts.length - 1)
    ) {
      truncated = true;
      break;
    }
  }
  return { rows: collected, truncated };
}

export function fetchActiveVcas(scope: Scope, from: string | null, to: string | null) {
  return fetchScopedList("active", scope, from, to);
}

export function fetchArchivedVcas(
  scope: Scope,
  from: string | null,
  to: string | null,
  reason = "all",
) {
  return fetchScopedList("archived", scope, from, to, reason);
}

export async function fetchVcaServices(
  scope: Scope,
): Promise<{ rows: ReadonlyArray<Record<string, unknown>>; truncated: boolean }> {
  const districts = districtsForVcaScope(scope);
  const collected: Record<string, unknown>[] = [];
  let truncated = false;
  for (let index = 0; index < districts.length; index += 1) {
    const district = districts[index]!;
    const payload = await request<unknown>({
      path: `/child/vca-services-by-district/${encodeURIComponent(district)}`,
    });
    const rows = unwrapVcaList(payload).filter(
      (row) =>
        typeof row.district === "string" &&
        normalizeDistrict(row.district) === normalizeDistrict(district),
    );
    const remaining = MAX_VCA_ROWS - collected.length;
    collected.push(...rows.slice(0, remaining));
    if (
      rows.length > remaining ||
      (collected.length >= MAX_VCA_ROWS && index < districts.length - 1)
    ) {
      truncated = true;
      break;
    }
  }
  return { rows: collected, truncated };
}

export async function fetchVcaDetailList(
  path: string,
  id: string,
  signal?: AbortSignal,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  if (!id) return [];
  const payload = await request<unknown>({ path: `${path}/${encodeURIComponent(id)}`, signal });
  return unwrapVcaList(payload);
}
