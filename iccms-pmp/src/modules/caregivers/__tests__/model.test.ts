import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeHousehold, type Household } from "@/modules/households";

import { districtsForCaregiverScope, fetchCaregiverServices } from "../api/client";
import {
  buildCaregiverRiskRows,
  caregiverRiskExportColumns,
  isCaregiverCategoryProvided,
  selectCaregiverRiskRows,
} from "../model/table";

const FY = { from: "2026-04-01", to: "2027-03-31", label: "FY2026", slug: "FY2026" };
const ALL_TIME = { from: null, to: null, label: "All time", slug: "all_time" };
const household = (id: string, district = "Kabwe"): Household =>
  normalizeHousehold({ household_id: id, district });

afterEach(() => vi.unstubAllGlobals());

describe("caregiver service-gap model", () => {
  it("counts only meaningful service categories and handles serialized values", () => {
    expect(isCaregiverCategoryProvided('["Clinic", "none"]')).toBe(true);
    expect(isCaregiverCategoryProvided('["none", "n/a"]')).toBe(false);
    expect(isCaregiverCategoryProvided("not applicable")).toBe(false);
    expect(isCaregiverCategoryProvided({ outcome: "Clinic" })).toBe(true);
  });

  it("joins by household and district, filters service events to the selected window", () => {
    const result = buildCaregiverRiskRows(
      [household("HH-1"), household("HH-2", "Chibombo")],
      [
        {
          household_id: "HH-1",
          district: "Kabwe",
          service_date: "15-05-2026",
          health_services: "Clinic",
        },
        {
          household_id: "HH-1",
          district: "Kabwe",
          service_date: "2025-01-20",
          stable_services: "Cash",
        },
        {
          household_id: "HH-1",
          district: "Choma",
          service_date: "2026-05-15",
          safe_services: "Referral",
        },
        {
          household_id: "HH-2",
          district: "Chibombo",
          service_date: "2026-06-01",
          stable_services: "Cash",
        },
        {
          household_id: "HH-2",
          district: "Chibombo",
          service_date: "unknown",
          safe_services: "Referral",
        },
      ],
      FY,
    );
    expect(result.rows).toEqual([
      {
        householdId: "HH-1",
        district: "Kabwe",
        domainCount: 1,
        hasHealth: true,
        hasSchooled: false,
        hasSafe: false,
        hasStable: false,
      },
      {
        householdId: "HH-2",
        district: "Chibombo",
        domainCount: 1,
        hasHealth: false,
        hasSchooled: false,
        hasSafe: false,
        hasStable: true,
      },
    ]);
    expect(result.undatedServiceCount).toBe(1);
    expect(
      selectCaregiverRiskRows(result.rows, "health_domain").map((row) => row.householdId),
    ).toEqual(["HH-2"]);
    expect(selectCaregiverRiskRows(result.rows, "graduation_path")).toEqual([]);
  });

  it("keeps caregiver names out of the export columns", () => {
    expect(caregiverRiskExportColumns.map((column) => column.meta?.exportHeader)).not.toContain(
      "Caregiver name",
    );
  });

  it("includes all history in All time mode and includes a household with no service rows as missing all domains", () => {
    const result = buildCaregiverRiskRows(
      [household("HH-1"), household("HH-2")],
      [
        {
          household_id: "HH-1",
          district: "Kabwe",
          service_date: "bad-date",
          health_services: "Clinic",
        },
      ],
      ALL_TIME,
    );
    expect(result.undatedServiceCount).toBe(0);
    expect(result.rows[0]?.hasHealth).toBe(true);
    expect(result.rows[1]?.domainCount).toBe(0);
    expect(
      selectCaregiverRiskRows(result.rows, "health_domain").map((row) => row.householdId),
    ).toEqual(["HH-2"]);
  });
});

describe("caregiver service scope", () => {
  it("expands only the effective scope to configured districts", () => {
    expect(districtsForCaregiverScope({ level: "district", district: "Kabwe" })).toEqual(["Kabwe"]);
    expect(
      districtsForCaregiverScope({
        level: "province",
        province: "Central Province",
        districts: ["Kabwe", "Chibombo"],
      }),
    ).toEqual(["Kabwe", "Chibombo"]);
    expect(districtsForCaregiverScope({ level: "none" })).toEqual([]);
  });

  it("queries each allowed province district separately and unions only matching rows", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      const district = url.pathname.split("/").at(-1);
      return new Response(
        JSON.stringify({ data: [{ household_id: `HH-${district}`, district }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const result = await fetchCaregiverServices({
        level: "province",
        province: "Central Province",
        districts: ["Kabwe", "Chibombo"],
      });
      expect(result.rows.map((row) => row.household_id)).toEqual(["HH-Kabwe", "HH-Chibombo"]);
      expect(calls).toEqual([
        expect.stringContaining("/caregiver-services-by-district/Kabwe"),
        expect.stringContaining("/caregiver-services-by-district/Chibombo"),
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("drops rows from other districts even if an endpoint response leaks them", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      return new Response(
        JSON.stringify({
          data: [
            { household_id: "HH-1", district: "Kabwe" },
            { household_id: "OUTSIDE", district: "Choma" },
            { household_id: "UNTAGGED" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const result = await fetchCaregiverServices({ level: "district", district: "Kabwe" });
      expect(result.rows.map((row) => row.household_id)).toEqual(["HH-1"]);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain("/household/caregiver-services-by-district/Kabwe");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
