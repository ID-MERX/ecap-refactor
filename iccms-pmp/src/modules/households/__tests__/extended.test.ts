import { afterEach, describe, expect, it, vi } from "vitest";

import { subPopulationsFor } from "@/config";

import { buildRiskRows, isCategoryProvided, selectRiskRows } from "../model/extended";
import { archivedFilters } from "../model/extended";
import { householdFilters } from "../model/table";
import { fetchHouseholdFlags } from "../api/extended";

const NOW = new Date("2026-11-04T00:00:00.000Z");

describe("config-driven household filters", () => {
  it("uses the unified program labels for active and archived registers", () => {
    const expected = subPopulationsFor("household").map(({ key, label }) => ({ key, label }));
    for (const filters of [householdFilters, archivedFilters]) {
      expect(
        filters
          .filter((filter) => filter.type === "subPopulation")
          .map((filter) => ({ key: filter.key, label: filter.label })),
      ).toEqual(expected);
    }
  });
});

describe("household domain-gap model", () => {
  it.each([
    [null, false],
    ["  ", false],
    ["Not Applicable", false],
    ["0", false],
    ["Routine visit", true],
    ['["none", "N/A"]', false],
    ['["none", "home visit"]', true],
    ['{"provided":true}', true],
    ["{malformed", true],
  ])("interprets service category %j as %s", (input, expected) => {
    expect(isCategoryProvided(input)).toBe(expected);
  });

  it("aggregates four domains across service rows and excludes households without an ID", () => {
    const rows = buildRiskRows(
      [
        { household_id: "HH-1", district: "Kabwe", last_service_date: "2026-10-20" },
        { district: "No id" },
      ],
      [
        { household_id: "HH-1", health_services: "Clinic", service_date: "2026-10-01" },
        { hh_id: "HH-1", schooled_services: '["School supplies"]', service_date: "2026-07-01" },
        {
          household_id: "HH-1",
          safe_services: "N/A",
          stable_services: "Housing support",
          service_date: "2026-09-01",
        },
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      householdId: "HH-1",
      domainCount: 3,
      hasHealth: true,
      hasSchooled: true,
      hasSafe: false,
      hasStable: true,
      active90d: true,
    });
    expect(selectRiskRows(rows, "graduation_path")).toHaveLength(0);
    expect(selectRiskRows(rows, "safe_domain")).toHaveLength(1);
  });

  it("marks recent activity only inside the preceding 90 days", () => {
    const rows = buildRiskRows(
      [{ household_id: "HH-2" }],
      [{ household_id: "HH-2", service_date: "2026-08-01" }],
      NOW,
    );
    expect(rows[0]?.active90d).toBe(false);
  });
});

describe("household flags API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests only the selected household's flags from Directus", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: 7,
                household_id: "HH-1",
                status: "open",
                comment: "Check",
                date_created: "2026-11-03",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const flags = await fetchHouseholdFlags("HH-1");
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.origin).toBe("http://directus.test");
    expect(url.searchParams.get("filter[household_id][_eq]")).toBe("HH-1");
    expect(flags[0]).toMatchObject({
      id: "7",
      household_id: "HH-1",
      status: "open",
      comment: "Check",
    });
  });
});
