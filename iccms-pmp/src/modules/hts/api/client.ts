import { allDistricts } from "@/config";
import { request } from "@/core/api";
import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";

import {
  normalizeHtsRecord,
  parseHtsRows,
  type HtsRecord,
  type HtsRegisterResult,
} from "./schemas";

export const HTS_MAX_RETAINED_ROWS_PER_DISTRICT = 20_000;

export function districtsForHtsScope(scope: Scope): ReadonlyArray<string> {
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

export function allowedHtsDistricts(scope: Scope, selected?: string): ReadonlyArray<string> {
  const allowed = districtsForHtsScope(scope);
  if (scope.level === "none") return [];
  if (!selected || selected === "All") return allowed;
  const normalized = normalizeDistrict(selected);
  return allowed.filter((district) => normalizeDistrict(district) === normalized);
}

export async function fetchHtsRegister(
  scope: Scope,
  selectedDistrict?: string,
  signal?: AbortSignal,
  requestedClientId?: string,
): Promise<HtsRegisterResult> {
  const districts = allowedHtsDistricts(scope, selectedDistrict);
  if (districts.length === 0) return { rows: [], truncatedDistricts: [] };

  const responses = await Promise.all(
    districts.map(async (district) => {
      const payload = await request<unknown>({
        path: `/household/hts-register-by-district/${encodeURIComponent(district)}`,
        signal,
      });
      const rawRows = parseHtsRows(payload);
      const expectedDistrict = normalizeDistrict(district);
      const rows: HtsRecord[] = [];
      let validCount = 0;
      let requestedRecordAdded = false;
      const requestedId = requestedClientId?.toLowerCase();
      for (const raw of rawRows) {
        const normalized = normalizeHtsRecord(raw);
        if (!expectedDistrict || normalizeDistrict(normalized.district) !== expectedDistrict)
          continue;
        validCount += 1;
        const isRequested =
          Boolean(requestedId) && normalized.clientId.toLowerCase() === requestedId;
        if (
          rows.length < HTS_MAX_RETAINED_ROWS_PER_DISTRICT ||
          (isRequested && !requestedRecordAdded)
        ) {
          rows.push(normalized);
          if (isRequested) requestedRecordAdded = true;
        }
      }
      return { district, rows, truncated: validCount > HTS_MAX_RETAINED_ROWS_PER_DISTRICT };
    }),
  );

  return {
    rows: responses.flatMap((result) => result.rows),
    truncatedDistricts: responses
      .filter((result) => result.truncated)
      .map((result) => result.district),
  };
}
