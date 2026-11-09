import type { FyWindow } from "@/platform/scope/fy";

import type { PmtctRecord } from "../api/schemas";

export type PmtctMetrics = {
  mothers: number;
  infants: number;
  detected: number;
  notDetected: number;
  pending: number;
};

export type FacilityMetric = { facility: string; count: number };
export type MonthMetric = { month: string; count: number };
export type DistrictOutcome = {
  district: string;
  detected: number;
  notDetected: number;
  pending: number;
  total: number;
};

/** Backend owns FY/custom filtering. Kept as a pure helper for URL/request parity tests and UI labels. */
export function pmtctWindowParams(window: FyWindow): Record<string, string> {
  return window.from && window.to ? { from: window.from, to: window.to } : {};
}

export function calculatePmtctMetrics(
  mothers: ReadonlyArray<PmtctRecord>,
  infants: ReadonlyArray<PmtctRecord>,
): PmtctMetrics {
  return {
    mothers: mothers.length,
    infants: infants.length,
    detected: infants.filter((row) => row.outcome === "positive").length,
    notDetected: infants.filter((row) => row.outcome === "negative").length,
    pending: infants.filter((row) => row.outcome === "pending" || row.outcome === "unknown").length,
  };
}

export function pmtctDistrictOutcomes(
  infants: ReadonlyArray<PmtctRecord>,
): ReadonlyArray<DistrictOutcome> {
  const totals = new Map<string, DistrictOutcome>();
  for (const row of infants) {
    const district = row.district === "N/A" ? "Unknown district" : row.district;
    const value = totals.get(district) ?? {
      district,
      detected: 0,
      notDetected: 0,
      pending: 0,
      total: 0,
    };
    value.total += 1;
    if (row.outcome === "positive") value.detected += 1;
    else if (row.outcome === "negative") value.notDetected += 1;
    else value.pending += 1;
    totals.set(district, value);
  }
  return [...totals.values()].sort(
    (a, b) => b.total - a.total || a.district.localeCompare(b.district, "en"),
  );
}

export function pmtctFacilityMetrics(
  mothers: ReadonlyArray<PmtctRecord>,
): ReadonlyArray<FacilityMetric> {
  const counts = new Map<string, number>();
  for (const row of mothers) {
    const key = row.facility === "N/A" ? "Unknown facility" : row.facility;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .map(([facility, count]) => ({ facility, count }))
    .sort((a, b) => b.count - a.count || a.facility.localeCompare(b.facility, "en"))
    .slice(0, 8);
}

export function pmtctEnrollmentTrend(
  mothers: ReadonlyArray<PmtctRecord>,
): ReadonlyArray<MonthMetric> {
  const counts = new Map<string, number>();
  for (const row of mothers) {
    if (!row.enrolledDate) continue;
    const month = row.enrolledDate.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
}

export function searchPmtctRows(
  rows: ReadonlyArray<PmtctRecord>,
  query: string,
): ReadonlyArray<PmtctRecord> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) =>
    [row.clientId, row.pmtctId, row.householdId, row.facility, row.district].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}
