import { describe, expect, it } from "vitest";

import { allDistricts, subPopulationsFor } from "@/config";

import { districtsForVcaScope, fetchActiveVcas } from "../api/client";
import { normalizeVca, vcaMatchesId } from "../api/schemas";
import {
  buildVcaRiskRows,
  calculateVcaAge,
  isCategoryProvided,
  serviceDateInWindow,
  selectVcaRiskRows,
  vcaFilters,
  archivedVcaFilters,
} from "../model/table";

const FY = { from: "2026-04-01", to: "2027-03-31", label: "FY2026", slug: "FY2026" };
const ALL_TIME = { from: null, to: null, label: "All time", slug: "all_time" };

describe("VCA normalization and scope", () => {
  it("normalizes stable ID aliases and matches them case-insensitively", () => {
    const row = normalizeVca({ unique_id: " vca-7 ", district: " Kabwe ", household_id: " HH-1 " });
    expect(row).toMatchObject({
      vcaId: "vca-7",
      uniqueId: "vca-7",
      district: "Kabwe",
      householdId: "HH-1",
    });
    expect(vcaMatchesId(row, "VCA-7")).toBe(true);
  });

  it("drops foreign-district rows even if a backend district response leaks them", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            { uid: "KABWE-1", district: "Kabwe" },
            { uid: "CHOMA-LEAK", district: "Choma" },
            { uid: "NO-DISTRICT" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    try {
      const result = await fetchActiveVcas({ level: "district", district: "Kabwe" }, null, null);
      expect(result.rows.map(({ vcaId }) => vcaId)).toEqual(["KABWE-1"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requests only the assigned district set; national scope expands to configured districts", () => {
    expect(districtsForVcaScope({ level: "district", district: "Kabwe" })).toEqual(["Kabwe"]);
    expect(
      districtsForVcaScope({
        level: "province",
        province: "Central Province",
        districts: ["Kabwe", "Chibombo"],
      }),
    ).toEqual(["Kabwe", "Chibombo"]);
    expect(districtsForVcaScope({ level: "national" })).toEqual(
      allDistricts.map(({ district }) => district),
    );
    expect(districtsForVcaScope({ level: "none" })).toEqual([]);
  });

  it("uses the config sub-population catalogue for active and archived registers", () => {
    const expected = subPopulationsFor("vca").map(({ key, label }) => ({ key, label }));
    for (const defs of [vcaFilters, archivedVcaFilters]) {
      expect(
        defs
          .filter((item) => item.type === "subPopulation")
          .map((item) => ({ key: item.key, label: item.label })),
      ).toEqual(expected);
    }
  });
});

describe("VCA service-domain risk model", () => {
  it.each([
    ["Clinic visit", true],
    ["N/A", false],
    ["None", false],
    ['["none", "school supplies"]', true],
    ['["none", "N/A"]', false],
    ["{malformed", true],
  ])("evaluates service category %j as %s", (value, expected) => {
    expect(isCategoryProvided(value)).toBe(expected);
  });

  it("parses service dates and applies the selected FY inclusively", () => {
    expect(serviceDateInWindow("2026-04-01", FY)).toBe(true);
    expect(serviceDateInWindow("31-03-2026", FY)).toBe(false);
    expect(serviceDateInWindow("2026-11-04", FY)).toBe(true);
    expect(serviceDateInWindow("unknown", FY)).toBeNull();
    expect(serviceDateInWindow("unknown", ALL_TIME)).toBe(true);
  });

  it("uses only service events in the chosen FY when calculating domain gaps", () => {
    const vcas = [
      normalizeVca({ uid: "vca-1", district: "Kabwe" }),
      normalizeVca({ uid: "vca-2", district: "Kabwe" }),
    ];
    const services = [
      { vcaid: "vca-1", service_date: "2026-07-10", health_services: "Clinic" },
      { vcaid: "vca-1", service_date: "2025-07-10", schooled_services: "School" },
      {
        vcaid: "vca-2",
        service_date: "10-06-2026",
        health_services: "N/A",
        schooled_services: "School",
      },
    ];
    const rows = buildVcaRiskRows(vcas, services, FY);
    expect(rows[0]).toMatchObject({ hasHealth: true, hasSchooled: false, domainCount: 1 });
    expect(rows[1]).toMatchObject({ hasHealth: false, hasSchooled: true, domainCount: 1 });
    expect(selectVcaRiskRows(rows, "health_domain").map((row) => row.vcaId)).toContain("vca-2");
    expect(buildVcaRiskRows(vcas, services, ALL_TIME)[0]?.hasSchooled).toBe(true);
  });

  it("calculates age without turning missing or invalid birthdates into zero", () => {
    expect(calculateVcaAge("2000-06-15", new Date("2026-06-14T00:00:00Z"))).toBe(25);
    expect(calculateVcaAge("2000-06-15", new Date("2026-06-15T00:00:00Z"))).toBe(26);
    expect(calculateVcaAge("15-06-2000", new Date("2026-06-15T00:00:00Z"))).toBe(26);
    expect(calculateVcaAge("not-a-date", new Date("2026-06-15T00:00:00Z"))).toBeNull();
  });
});
