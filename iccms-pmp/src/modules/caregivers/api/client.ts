import { allDistricts } from "@/config";
import { request } from "@/core/api";
import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";

export const MAX_CAREGIVER_ROWS = 20_000;

type ListResult = { rows: ReadonlyArray<Record<string, unknown>>; truncated: boolean };

function unwrapRows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(payload))
    return payload.filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
    );
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  if (Array.isArray(value.data)) return unwrapRows(value.data);
  if (Array.isArray(value.results)) return unwrapRows(value.results);
  if (value.data && typeof value.data === "object") return unwrapRows(value.data);
  return [];
}

export function districtsForCaregiverScope(scope: Scope): ReadonlyArray<string> {
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

export async function fetchCaregiverServices(scope: Scope): Promise<ListResult> {
  const districts = districtsForCaregiverScope(scope);
  const collected: Record<string, unknown>[] = [];
  let truncated = false;

  for (let index = 0; index < districts.length; index += 1) {
    const district = districts[index]!;
    const payload = await request<unknown>({
      path: `/household/caregiver-services-by-district/${encodeURIComponent(district)}`,
    });
    const rows = unwrapRows(payload).filter(
      (row) =>
        typeof row.district === "string" &&
        normalizeDistrict(row.district) === normalizeDistrict(district),
    );
    const remaining = MAX_CAREGIVER_ROWS - collected.length;
    collected.push(...rows.slice(0, remaining));
    if (
      rows.length > remaining ||
      (collected.length >= MAX_CAREGIVER_ROWS && index < districts.length - 1)
    ) {
      truncated = true;
      break;
    }
  }

  return { rows: collected, truncated };
}
