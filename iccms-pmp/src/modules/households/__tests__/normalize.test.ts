import { describe, expect, it } from "vitest";

import { normalizeHousehold, unwrapList } from "../api/schemas";

describe("normalizeHousehold", () => {
  it("reads the first non-empty ID candidate", () => {
    // The legacy page used four different candidate orders for table/sort/search/export, which is how a
    // row with only `id` could still navigate to "N/A".
    expect(normalizeHousehold({ household_id: "HH1" }).householdId).toBe("HH1");
    expect(normalizeHousehold({ householdId: "HH2" }).householdId).toBe("HH2");
    expect(normalizeHousehold({ hh_id: "HH3" }).householdId).toBe("HH3");
    expect(normalizeHousehold({ id: 42 }).householdId).toBe("42");
  });

  it("prefers household_id over id when both exist", () => {
    expect(normalizeHousehold({ id: "row-1", household_id: "HH9" }).householdId).toBe("HH9");
  });

  it("falls back to cwac_member_name for the caseworker", () => {
    expect(normalizeHousehold({ cwac_member_name: "A. Banda" }).caseworkerName).toBe("A. Banda");
  });

  it("collapses whitespace and treats blank as null", () => {
    const household = normalizeHousehold({ facility: "  Kabwe   GH  ", ward: "   " });
    expect(household.facility).toBe("Kabwe GH");
    expect(household.ward).toBeNull();
  });

  it("keeps the raw row so sub-population columns are still reachable", () => {
    expect(normalizeHousehold({ calhiv: "1" }).flags.calhiv).toBe("1");
  });
});

describe("unwrapList", () => {
  it("accepts a bare array", () => {
    expect(unwrapList([{ a: 1 }])).toHaveLength(1);
  });

  it("accepts a single data envelope", () => {
    expect(unwrapList({ data: [{ a: 1 }, { a: 2 }] })).toHaveLength(2);
  });

  it("accepts a double-wrapped envelope, which the backend also produces", () => {
    expect(unwrapList({ data: { data: [{ a: 1 }] } })).toHaveLength(1);
  });

  it("returns an empty list for an unrecognised shape rather than throwing", () => {
    expect(unwrapList({ nope: true })).toEqual([]);
    expect(unwrapList(null)).toEqual([]);
  });
});
