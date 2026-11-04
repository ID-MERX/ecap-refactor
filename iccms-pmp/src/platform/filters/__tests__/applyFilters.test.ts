import { describe, expect, it } from "vitest";

import {
  applyFilters,
  countActiveFilters,
  isFilterActive,
  parseFilterState,
  toQueryParams,
} from "../applyFilters";
import type { FilterDef, FilterState } from "../types";

const ROWS: ReadonlyArray<Record<string, unknown>> = [
  {
    household_id: "HH1",
    district: "Kabwe",
    province: "Central Province",
    calhiv: "1",
    hei: "0",
    facility: "Kabwe GH",
  },
  {
    household_id: "HH2",
    district: "  kabwe  ",
    province: "Central Province",
    calhiv: "Yes",
    hei: null,
    facility: "Mumbwa Clinic",
  },
  {
    household_id: "HH10",
    district: "Monze",
    province: "Southern Province",
    calhiv: 0,
    hei: "true",
    facility: null,
  },
];

const DEFS: ReadonlyArray<FilterDef> = [
  { id: "q", label: "Search", type: "text", fields: ["household_id", "facility"] },
  { id: "district", label: "District", type: "select", field: "district" },
  { id: "calhiv", label: "CALHIV", type: "subPopulation", key: "calhiv" },
  { id: "hei", label: "HEI", type: "subPopulation", key: "hei" },
];

function state(overrides: FilterState = {}): FilterState {
  return { q: "", district: "All", calhiv: "all", hei: "all", ...overrides };
}

describe("text filter", () => {
  it("searches only the fields the def declares", () => {
    // `q` declares household_id + facility. "kabwe" is in HH1's facility but in HH2's *district*,
    // which is not declared — so only HH1 matches. A search that quietly widened to every column would
    // return rows the user cannot see the reason for.
    expect(applyFilters(ROWS, DEFS, state({ q: "kabwe" })).map((r) => r.household_id)).toEqual([
      "HH1",
    ]);
    expect(applyFilters(ROWS, DEFS, state({ q: "monze" }))).toHaveLength(0);
    expect(applyFilters(ROWS, DEFS, state({ q: "Mumbwa" })).map((r) => r.household_id)).toEqual([
      "HH2",
    ]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(applyFilters(ROWS, DEFS, state({ q: "  HH1  " }))).toHaveLength(2);
  });

  it("is inactive when empty", () => {
    expect(isFilterActive(DEFS[0]!, state())).toBe(false);
  });
});

describe("select filter", () => {
  it("ignores case and padding in both the row and the filter value", () => {
    // The legacy register compared a trimmed row value against untrimmed variants, so a padded value
    // like "  kabwe  " never matched the district select.
    expect(applyFilters(ROWS, DEFS, state({ district: "Kabwe" }))).toHaveLength(2);
  });

  it("treats All as no constraint", () => {
    expect(applyFilters(ROWS, DEFS, state({ district: "All" }))).toHaveLength(3);
  });

  it("returns nothing for a district with no rows", () => {
    expect(applyFilters(ROWS, DEFS, state({ district: "Choma" }))).toHaveLength(0);
  });
});

describe("sub-population filter", () => {
  it("matches 1/true/yes as yes", () => {
    // "Yes" matched NEITHER button in the legacy registers, which is exactly what the backend's
    // ILIKE 'yes' counts treat as true.
    expect(applyFilters(ROWS, DEFS, state({ calhiv: "yes" })).map((r) => r.household_id)).toEqual([
      "HH1",
      "HH2",
    ]);
  });

  it("matches 0/false as no", () => {
    expect(applyFilters(ROWS, DEFS, state({ calhiv: "no" })).map((r) => r.household_id)).toEqual([
      "HH10",
    ]);
  });

  it("does not count an unknown or missing value as no", () => {
    // HH2 has `hei: null`. It is neither yes nor no, so it appears in neither list. Folding null into
    // "no" is what made the legacy negative counts wrong.
    expect(applyFilters(ROWS, DEFS, state({ hei: "yes" })).map((r) => r.household_id)).toEqual([
      "HH10",
    ]);
    expect(applyFilters(ROWS, DEFS, state({ hei: "no" })).map((r) => r.household_id)).toEqual([
      "HH1",
    ]);
    // The point: HH2 is absent from both.
    for (const answer of ["yes", "no"]) {
      expect(
        applyFilters(ROWS, DEFS, state({ hei: answer })).map((r) => r.household_id),
      ).not.toContain("HH2");
    }
  });

  it("ands multiple sub-population filters", () => {
    // Only HH1 is calhiv=yes AND hei=no. HH2 fails hei (unknown), HH10 fails calhiv.
    expect(
      applyFilters(ROWS, DEFS, state({ calhiv: "yes", hei: "no" })).map((r) => r.household_id),
    ).toEqual(["HH1"]);
  });

  it("reads the long-form column when the key differs", () => {
    const defs: ReadonlyArray<FilterDef> = [
      { id: "caahh", label: "CAAHH", type: "subPopulation", key: "caahh" },
    ];
    const rows = [{ child_adolescent_in_aged_headed_household: "1" }];
    expect(applyFilters(rows, defs, { caahh: "yes" })).toHaveLength(1);
  });
});

describe("countActiveFilters", () => {
  it("counts only the filters that constrain something", () => {
    expect(countActiveFilters(DEFS, state())).toBe(0);
    expect(countActiveFilters(DEFS, state({ q: "x", calhiv: "yes" }))).toBe(2);
  });
});

describe("parseFilterState", () => {
  it("splits a date range", () => {
    const defs: ReadonlyArray<FilterDef> = [
      { id: "period", label: "Period", type: "dateRange", field: "date" },
    ];
    const [parsed] = parseFilterState(defs, { period: "2026-01-01..2026-06-30" });
    expect(parsed?.value).toEqual({ kind: "dateRange", from: "2026-01-01", to: "2026-06-30" });
  });

  it("splits a multi-select", () => {
    const defs: ReadonlyArray<FilterDef> = [
      { id: "d", label: "Districts", type: "multiSelect", field: "district" },
    ];
    const [parsed] = parseFilterState(defs, { d: "Kabwe,Monze" });
    expect(parsed?.value).toEqual({ kind: "multiSelect", value: ["Kabwe", "Monze"] });
  });
});

describe("toQueryParams", () => {
  it("always sends sort and pagination", () => {
    expect(
      toQueryParams(
        DEFS,
        state(),
        { field: "household_id", direction: "desc" },
        { page: 2, pageSize: 50 },
      ),
    ).toMatchObject({
      sort: "household_id",
      order: "desc",
      page: "2",
      pageSize: "50",
    });
  });

  it("omits inactive filters so the server does not filter on them", () => {
    const params = toQueryParams(
      DEFS,
      state(),
      { field: "id", direction: "asc" },
      { page: 1, pageSize: 50 },
    );
    expect(params).not.toHaveProperty("q");
    expect(params).not.toHaveProperty("district");
    expect(params).not.toHaveProperty("calhiv");
  });

  it("sends a sub-population by its data column, not its key", () => {
    const defs: ReadonlyArray<FilterDef> = [
      { id: "caahh", label: "CAAHH", type: "subPopulation", key: "caahh" },
    ];
    const params = toQueryParams(
      defs,
      { caahh: "yes" },
      { field: "id", direction: "asc" },
      { page: 1, pageSize: 50 },
    );
    expect(params.child_adolescent_in_aged_headed_household).toBe("true");
    expect(params).not.toHaveProperty("caahh");
  });
});
