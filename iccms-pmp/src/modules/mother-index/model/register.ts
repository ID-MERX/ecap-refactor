import type { MotherAnswer, MotherRecord } from "../api/schemas";

export type MotherFilters = {
  hei: MotherAnswer | "all";
  hiv: MotherAnswer | "all";
  onArt: MotherAnswer | "all";
  linked: MotherAnswer | "all";
};

export const EMPTY_MOTHER_FILTERS: MotherFilters = {
  hei: "all",
  hiv: "all",
  onArt: "all",
  linked: "all",
};

export function distinctMothers(rows: ReadonlyArray<MotherRecord>): ReadonlyArray<MotherRecord> {
  const seen = new Set<string>();
  const distinct: MotherRecord[] = [];
  for (const row of rows) {
    if (!row.motherId || row.motherId === "N/A") continue;
    const key = row.motherId.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(row);
  }
  return distinct;
}

export function filterMothers(
  rows: ReadonlyArray<MotherRecord>,
  filters: MotherFilters,
  query: string,
): ReadonlyArray<MotherRecord> {
  const normalizedQuery = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.hei !== "all" && row.hei !== filters.hei) return false;
    if (filters.hiv !== "all" && row.hivAnswer !== filters.hiv) return false;
    if (filters.onArt !== "all" && row.onArt !== filters.onArt) return false;
    if (filters.linked !== "all" && row.linked !== filters.linked) return false;
    if (!normalizedQuery) return true;
    return [row.motherId, row.facility].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });
}

export function sortMothers(rows: ReadonlyArray<MotherRecord>): ReadonlyArray<MotherRecord> {
  return [...rows].sort(
    (a, b) =>
      (b.updatedAt ?? b.enrolledDate ?? "").localeCompare(a.updatedAt ?? a.enrolledDate ?? "") ||
      a.motherId.localeCompare(b.motherId, "en"),
  );
}
