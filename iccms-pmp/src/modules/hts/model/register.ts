import type { FyWindow } from "@/platform/scope/fy";

import { isHtsArtLinked } from "../api/schemas";
import type { HtsRecord, HtsRiskType } from "../api/schemas";

export type HtsMetrics = {
  total: number;
  positives: number;
  negatives: number;
  pending: number;
  positivesNotOnArt: number;
};

export type HtsDistrictMetric = {
  district: string;
  tests: number;
  positives: number;
  yieldPct: number;
};

export function inFyWindow(record: HtsRecord, window: FyWindow): boolean {
  if (!window.from && !window.to) return true;
  if (!record.recordDate) return false;
  return (
    (!window.from || record.recordDate >= window.from) &&
    (!window.to || record.recordDate <= window.to)
  );
}

export function selectHtsWindow(
  rows: ReadonlyArray<HtsRecord>,
  window: FyWindow,
): ReadonlyArray<HtsRecord> {
  return rows.filter((row) => inFyWindow(row, window));
}

export function calculateHtsMetrics(rows: ReadonlyArray<HtsRecord>): HtsMetrics {
  const positives = rows.filter((row) => row.result === "positive");
  return {
    total: rows.length,
    positives: positives.length,
    negatives: rows.filter((row) => row.result === "negative").length,
    pending: rows.filter((row) => row.result === "pending" || row.result === "unknown").length,
    positivesNotOnArt: positives.filter((row) => !isHtsArtLinked(row)).length,
  };
}

export function htsDistrictMetrics(
  rows: ReadonlyArray<HtsRecord>,
): ReadonlyArray<HtsDistrictMetric> {
  const totals = new Map<string, { tests: number; positives: number }>();
  for (const row of rows) {
    const district = row.district === "N/A" ? "Unknown district" : row.district;
    const item = totals.get(district) ?? { tests: 0, positives: 0 };
    item.tests += 1;
    if (row.result === "positive") item.positives += 1;
    totals.set(district, item);
  }
  return [...totals]
    .map(([district, value]) => ({
      district,
      tests: value.tests,
      positives: value.positives,
      yieldPct: value.tests ? Math.round((value.positives / value.tests) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.district.localeCompare(b.district, "en"));
}

function dateTime(date: string | null): number {
  return date ? Date.parse(`${date}T00:00:00Z`) : 0;
}

export function sortHtsRows(rows: ReadonlyArray<HtsRecord>): ReadonlyArray<HtsRecord> {
  return [...rows].sort(
    (a, b) =>
      dateTime(b.recordDate) - dateTime(a.recordDate) || a.rowId.localeCompare(b.rowId, "en"),
  );
}

export function selectHtsRiskRows(
  rows: ReadonlyArray<HtsRecord>,
  type: HtsRiskType,
  now: Date = new Date(),
): ReadonlyArray<HtsRecord> {
  switch (type) {
    case "unlinked":
      return rows.filter((row) => row.result === "positive" && !isHtsArtLinked(row));
    case "pending":
      return rows.filter((row) => row.result === "pending" || row.result === "unknown");
    case "new": {
      const cutoff =
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 7 * 86_400_000;
      const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      return rows.filter((row) => {
        if (row.result !== "positive" || !row.recordDate) return false;
        const value = dateTime(row.recordDate);
        return value >= cutoff && value <= today;
      });
    }
    case "all":
      return rows;
  }
}
