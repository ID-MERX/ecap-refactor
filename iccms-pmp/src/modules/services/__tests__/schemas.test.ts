import { describe, expect, it } from "vitest";

import { normalizeServiceRecord, parseServiceRows, SERVICE_PILLAR_COLUMNS } from "../api/schemas";
import { fetchServiceDetail, fetchServiceRecords, serviceDistrictsForFilter } from "../api/client";
import { servicesManifest } from "../manifest";

describe("service response normalization", () => {
  it("normalizes only allowlisted record fields and never exposes joined identity columns", () => {
    const row = normalizeServiceRecord(
      {
        id: "vca-VCA-7-2026-05-01-0",
        vcaid: "VCA-7",
        name: "Confidential Person",
        caseworker: "Confidential Caseworker",
        phone: "+260 900 000 000",
        raw: { name: "Confidential Person" },
        district: "Kabwe",
        facility: "Clinic",
        serviceDate: "2026-05-01",
        serviceNames: ["Clinic referral"],
        pillars: ["Health"],
        status: "1",
        issues: ["Missing caseworker"],
        issueKeys: ["missing_caseworker"],
        ageDays: 3,
      },
      "vca",
    );
    expect(row.entityId).toBe("VCA-7");
    expect(row.status).toBe("Active");
    expect(row).not.toHaveProperty("name");
    expect(row).not.toHaveProperty("caseworker");
    expect(row).not.toHaveProperty("phone");
    expect(row).not.toHaveProperty("raw");
  });

  it("uses per-type backend field mappings and only parses the documented response envelope", () => {
    expect(SERVICE_PILLAR_COLUMNS.household.Household).toBe("hh_level_services");
    const parsed = parseServiceRows(
      {
        data: [
          {
            household_id: "HH-1",
            district: "Kabwe",
            service_date: "2026-06-01",
            hh_level_services: '["Cash support"]',
          },
        ],
        totalRecords: 1,
        totalPages: 1,
        page: 1,
        pageSize: 25,
        stats: { loaded: 1, recordsWithIssues: 0 },
      },
      "household",
    );
    expect(parsed.rows[0]?.pillars).toContain("Household");
    expect(parsed.total).toBe(1);
  });
});

describe("service district boundaries", () => {
  it("fans province reads out to exact districts and discards rows outside each requested district", async () => {
    const originalFetch = globalThis.fetch;
    const requestedDistricts: string[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      requestedDistricts.push(url.searchParams.get("district") ?? "");
      const district = url.searchParams.get("district") ?? "";
      return new Response(
        JSON.stringify({
          data: [
            {
              entityId: `ID-${district}`,
              district,
              serviceDate: "2026-06-01",
              serviceNames: ["Clinic"],
              pillars: ["Health"],
            },
            { entityId: "wrong-scope", district: "Choma", serviceDate: "2026-06-02" },
          ],
          totalRecords: 1,
          totalPages: 1,
          page: 1,
          pageSize: 100,
          stats: { loaded: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const result = await fetchServiceRecords({
        type: "vca",
        scope: {
          level: "province",
          province: "Central Province",
          districts: ["Kabwe", "Chibombo"],
        },
        page: 1,
        pageSize: 25,
      });
      expect(requestedDistricts.sort()).toEqual(["Chibombo", "Kabwe"]);
      expect(result.rows.map((row) => row.district).sort()).toEqual(["Chibombo", "Kabwe"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps district users fixed and only permits districts supplied by effective provincial scope", () => {
    expect(serviceDistrictsForFilter({ level: "district", district: "Kabwe" }, "All")).toEqual([
      "Kabwe",
    ]);
    expect(serviceDistrictsForFilter({ level: "district", district: "Kabwe" }, "Choma")).toEqual(
      [],
    );
    expect(
      serviceDistrictsForFilter(
        { level: "province", province: "Central Province", districts: ["Kabwe", "Chibombo"] },
        "Choma",
      ),
    ).toEqual([]);
    expect(
      serviceDistrictsForFilter(
        { level: "province", province: "Central Province", districts: ["Kabwe", "Chibombo"] },
        undefined,
      ),
    ).toEqual(["Kabwe", "Chibombo"]);
    expect(serviceDistrictsForFilter({ level: "none" }, undefined)).toEqual([]);
  });
});

describe("service detail and module routes", () => {
  it("keeps the selected visit while projecting latest detail through a PII-free allowlist", async () => {
    const originalFetch = globalThis.fetch;
    const calls: URL[] = [];
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      if (url.pathname.endsWith("/record-detail")) {
        return new Response(
          JSON.stringify({
            status: "success",
            data: {
              vcaid: "VCA-1",
              uid: "VCA-1",
              district: "Kabwe",
              facility: "District Clinic",
              service_date: "2026-06-01",
              case_status: "1",
              health_services: '["Clinic visit"]',
              phone_number: "+260 900 000 000",
              firstname: "Private",
              raw: { secret: "not for the UI" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      const entityQuery = url.searchParams.has("entityId");
      const data = entityQuery
        ? [
            {
              entityId: "VCA-1",
              district: "Kabwe",
              serviceDate: "2026-01-01",
              serviceNames: ["Selected visit"],
            },
            {
              entityId: "VCA-1",
              district: "Kabwe",
              serviceDate: "2026-06-01",
              serviceNames: ["Latest visit"],
            },
          ]
        : [{ entityId: "VCA-1", district: "Kabwe", serviceDate: "2026-06-01" }];
      return new Response(
        JSON.stringify({
          data,
          totalRecords: data.length,
          totalPages: 1,
          page: 1,
          pageSize: 100,
          stats: { loaded: data.length },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      const result = await fetchServiceDetail(
        "vca",
        "VCA-1",
        { level: "district", district: "Kabwe" },
        "2026-01-01",
      );
      expect(result.selected.serviceDate).toBe("2026-01-01");
      expect(result.latest.serviceDate).toBe("2026-06-01");
      expect(result.latest.status).toBe("Active");
      expect(result.isLatestVisit).toBe(false);
      expect(result.latest).not.toHaveProperty("phone_number");
      expect(result.latest).not.toHaveProperty("firstname");
      expect(result.latest).not.toHaveProperty("raw");
      expect(
        result.latest.servicesByDomain.find((item) => item.domain === "Health")?.values,
      ).toEqual(["Clinic visit"]);
      expect(calls.every((url) => url.searchParams.get("district") === "Kabwe")).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("registers static compatibility and approved read-only overview routes at district scope or higher", () => {
    expect(servicesManifest.minScope).toBe("district");
    expect(servicesManifest.routes.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "/services/:type",
        "/services/:type/:entityId",
        "/services/vca/overview",
        "/services/household-services",
        "/vca-services",
        "/household-services",
        "/caregiver-services",
      ]),
    );
  });
});
