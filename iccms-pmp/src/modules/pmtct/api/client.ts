import { allDistricts } from "@/config";
import { request } from "@/core/api";
import type { Scope } from "@/core/access/types";
import { normalizeDistrict } from "@/core/lib/values";
import type { FyWindow } from "@/platform/scope/fy";

import {
  normalizePmtctRecord,
  parsePmtctRows,
  type PmtctListResult,
  type PmtctProfileResult,
  type PmtctRecord,
} from "./schemas";

export const PMTCT_MAX_RETAINED_ROWS_PER_DISTRICT = 20_000;

export function districtsForPmtctScope(scope: Scope): ReadonlyArray<string> {
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

export function allowedPmtctDistricts(scope: Scope, selected?: string): ReadonlyArray<string> {
  const allowed = districtsForPmtctScope(scope);
  if (scope.level === "none") return [];
  if (!selected || selected === "All" || selected === "All Districts") return allowed;
  const normalized = normalizeDistrict(selected);
  return allowed.filter((district) => normalizeDistrict(district) === normalized);
}

function dateQuery(window: FyWindow): Record<string, string | undefined> {
  // Backend accepts these bounds in the route contract, though the current handler ignores them.
  return { from: window.from ?? undefined, to: window.to ?? undefined };
}

async function fetchKind(
  scope: Scope,
  kind: "mother" | "infant",
  window: FyWindow,
  selectedDistrict?: string,
  signal?: AbortSignal,
  requestedClientId?: string,
  requestedPmtctId?: string,
): Promise<PmtctListResult> {
  const districts = allowedPmtctDistricts(scope, selectedDistrict);
  if (!districts.length) return { rows: [], truncatedDistricts: [] };
  const pathSegment = kind === "mother" ? "pmtct-mother-register" : "pmtct-child-register";
  const results = await Promise.all(
    districts.map(async (district) => {
      const payload = await request<unknown>({
        path: `/etl/${pathSegment}/${encodeURIComponent(district)}`,
        query: dateQuery(window),
        signal,
      });
      const expectedDistrict = normalizeDistrict(district);
      const rows: PmtctRecord[] = [];
      let validCount = 0;
      for (const raw of parsePmtctRows(payload)) {
        const row = normalizePmtctRecord(raw, kind);
        if (!expectedDistrict || normalizeDistrict(row.district) !== expectedDistrict) continue;
        validCount += 1;
        const requested =
          Boolean(requestedClientId) &&
          row.clientId.toLowerCase() === requestedClientId!.toLowerCase();
        const linked =
          kind === "infant" &&
          Boolean(requestedPmtctId) &&
          row.pmtctId.toLowerCase() === requestedPmtctId!.toLowerCase();
        if (rows.length < PMTCT_MAX_RETAINED_ROWS_PER_DISTRICT || requested || linked) {
          rows.push(row);
        }
      }
      return { district, rows, truncated: validCount > PMTCT_MAX_RETAINED_ROWS_PER_DISTRICT };
    }),
  );
  return {
    rows: results.flatMap((result) => result.rows),
    truncatedDistricts: results
      .filter((result) => result.truncated)
      .map((result) => result.district),
  };
}

export function fetchPmtctMothers(
  scope: Scope,
  window: FyWindow,
  selectedDistrict?: string,
  signal?: AbortSignal,
  requestedClientId?: string,
): Promise<PmtctListResult> {
  return fetchKind(scope, "mother", window, selectedDistrict, signal, requestedClientId);
}

export function fetchPmtctInfants(
  scope: Scope,
  window: FyWindow,
  selectedDistrict?: string,
  signal?: AbortSignal,
  requestedPmtctId?: string,
): Promise<PmtctListResult> {
  return fetchKind(scope, "infant", window, selectedDistrict, signal, undefined, requestedPmtctId);
}

export async function fetchPmtctProfile(
  scope: Scope,
  window: FyWindow,
  clientId: string,
  signal?: AbortSignal,
  selectedDistrict?: string,
): Promise<PmtctProfileResult> {
  const mothers = await fetchPmtctMothers(scope, window, selectedDistrict, signal, clientId);
  const mother =
    mothers.rows.find((row) => row.clientId.toLowerCase() === clientId.toLowerCase()) ?? null;
  if (!mother || mother.pmtctId === "N/A")
    return { mother, infants: [], truncatedDistricts: mothers.truncatedDistricts };
  const infants = await fetchPmtctInfants(scope, window, selectedDistrict, signal, mother.pmtctId);
  const linked = infants.rows.filter(
    (row) => row.pmtctId.toLowerCase() === mother.pmtctId.toLowerCase(),
  );
  return {
    mother,
    infants: linked,
    truncatedDistricts: [
      ...new Set([...mothers.truncatedDistricts, ...infants.truncatedDistricts]),
    ],
  };
}
