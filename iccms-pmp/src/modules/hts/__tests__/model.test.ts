import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchHtsRegister, allowedHtsDistricts, districtsForHtsScope } from "../api/client";
import { classifyHtsResult, normalizeHtsRecord, parseHtsDate } from "../api/schemas";
import { calculateHtsMetrics, selectHtsRiskRows, selectHtsWindow } from "../model/register";
import { htsManifest } from "../manifest";

const FY = { from: "2026-04-01", to: "2027-03-31", label: "FY2026", slug: "FY2026" };

afterEach(() => vi.unstubAllGlobals());

describe("HTS normalization and classification", () => {
  it("uses the approved client ID precedence and keeps personal fields out of normalized data", () => {
    const result = normalizeHtsRecord({
      ecap_id: "CASE-1",
      client_number: "CLIENT-1",
      hts_id: "HTS-1",
      hiv_result: "Newly Tested HIV+",
      individual_age: "19",
      date_created: "05-10-2025",
      district: "Kabwe",
      firstname: "Private Name",
      lastname: "Private Surname",
      phone_number: "+260 900 000 000",
      address: "Private address",
      caseworker_name: "Private staff",
      comment: "Private note",
    });
    expect(result.clientId).toBe("CASE-1");
    expect(result.clientType).toBe("CA (Child)");
    expect(result.result).toBe("positive");
    expect(result.recordDate).toBe("2025-10-05");
    expect(result).not.toHaveProperty("firstname");
    expect(result).not.toHaveProperty("phone_number");
    expect(result).not.toHaveProperty("address");
    expect(result).not.toHaveProperty("caseworker_name");
    expect(result).not.toHaveProperty("comment");
  });

  it("classifies negative terms before reactive and keeps ambiguous values out of negative", () => {
    expect(classifyHtsResult("Non-reactive")).toBe("negative");
    expect(classifyHtsResult("Non reactive")).toBe("negative");
    expect(classifyHtsResult("Newly Tested HIV-")).toBe("negative");
    expect(classifyHtsResult("Known Positive")).toBe("positive");
    expect(classifyHtsResult("Indeterminate")).toBe("pending");
    expect(classifyHtsResult("Other result")).toBe("unknown");
  });

  it("parses ISO and D-M-Y strictly rather than using browser date guessing", () => {
    expect(parseHtsDate("2026-02-29")).toBeNull();
    expect(parseHtsDate("2024-02-29T10:30:00Z")).toBe("2024-02-29");
    expect(parseHtsDate("05-10-2025")).toBe("2025-10-05");
    expect(parseHtsDate("31-13-2025")).toBeNull();
  });

  it("applies only the approved FY/custom date window and computes risk totals", () => {
    const records = [
      normalizeHtsRecord({
        ecap_id: "1",
        hiv_result: "Positive",
        date_created: "2026-05-02",
        district: "Kabwe",
      }),
      normalizeHtsRecord({
        ecap_id: "2",
        hiv_result: "Negative",
        date_created: "2026-03-31",
        district: "Kabwe",
      }),
      normalizeHtsRecord({
        ecap_id: "3",
        hiv_result: "Unknown",
        date_created: "2026-05-03",
        district: "Kabwe",
      }),
    ];
    const rows = selectHtsWindow(records, FY);
    expect(rows.map((record) => record.clientId)).toEqual(["1", "3"]);
    expect(calculateHtsMetrics(rows)).toMatchObject({
      total: 2,
      positives: 1,
      negatives: 0,
      pending: 1,
      positivesNotOnArt: 1,
    });
    expect(selectHtsRiskRows(rows, "pending").map((record) => record.clientId)).toEqual(["3"]);
  });

  it("registers the district-or-higher, records-view HTS routes and compatibility redirects", () => {
    expect(htsManifest.minScope).toBe("district");
    expect(htsManifest.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/hts", requires: ["records.view"] }),
        expect.objectContaining({ path: "/hts/risk", requires: ["records.view"] }),
        expect.objectContaining({ path: "/hts/:clientId", requires: ["records.view"] }),
        expect.objectContaining({ path: "/registers/hts" }),
        expect.objectContaining({ path: "/registers/hts-risk" }),
        expect.objectContaining({ path: "/profile/hts-details" }),
      ]),
    );
  });
});

describe("HTS scope boundaries", () => {
  it("fixes district users to one district and restricts province selections", () => {
    expect(districtsForHtsScope({ level: "district", district: "Kabwe" })).toEqual(["Kabwe"]);
    expect(allowedHtsDistricts({ level: "district", district: "Kabwe" }, "All")).toEqual(["Kabwe"]);
    expect(allowedHtsDistricts({ level: "district", district: "Kabwe" }, "Choma")).toEqual([]);
    expect(
      allowedHtsDistricts(
        { level: "province", province: "Central Province", districts: ["Kabwe", "Chibombo"] },
        "Choma",
      ),
    ).toEqual([]);
    expect(districtsForHtsScope({ level: "none" })).toEqual([]);
  });

  it("fans out to the allowed provincial districts and rejects rows returned under the wrong district", async () => {
    const originalFetch = globalThis.fetch;
    const requested: string[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      const district = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      requested.push(district);
      return new Response(
        JSON.stringify({
          status: "success",
          data: [
            { client_number: `HTS-${district}`, test_result: "Negative", district },
            { client_number: "OUTSIDE", test_result: "Positive", district: "Choma" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const result = await fetchHtsRegister({
        level: "province",
        province: "Central Province",
        districts: ["Kabwe", "Chibombo"],
      });
      expect(requested.sort()).toEqual(["Chibombo", "Kabwe"]);
      expect(result.rows.map((row) => row.district).sort()).toEqual(["Chibombo", "Kabwe"]);
      expect(result.rows.map((row) => row.clientId).sort()).toEqual(["HTS-Chibombo", "HTS-Kabwe"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
