import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPmtctMothers, fetchPmtctProfile } from "../api/client";
import {
  classifyPmtctOutcome,
  normalizePmtctRecord,
  parsePmtctDate,
  parsePmtctRows,
} from "../api/schemas";
import { calculatePmtctMetrics, pmtctDistrictOutcomes, pmtctWindowParams } from "../model/register";
import { pmtctManifest } from "../manifest";
import type { Scope } from "@/core/access/types";

const WINDOW = { from: "2026-04-01", to: "2027-03-31", label: "FY2026", slug: "FY2026" };
const DISTRICT: Scope = { level: "district", district: "Kabwe" };

afterEach(() => vi.unstubAllGlobals());

describe("PMTCT normalization and models", () => {
  it("uses ecap_id before pmtct_id and safely normalizes maternal and infant records", () => {
    const mother = normalizePmtctRecord(
      {
        ecap_id: "EC-1",
        pmtct_id: "PM-1",
        firstname: "Amina",
        lastname: "Test",
        district: "Kabwe",
        date_enrolled_pmtct: "18-08-2026",
        phone_number: "260900000000",
        home_address: "private",
      },
      "mother",
    );
    expect(mother.clientId).toBe("EC-1");
    expect(mother.pmtctId).toBe("PM-1");
    expect(mother.hivStatus).toBe("positive");
    expect(mother.enrolledDate).toBe("2026-08-18");
    expect(mother.phone).toBe("260900000000");
    const infant = normalizePmtctRecord(
      {
        pmtct_id: "PM-1",
        final_outcome: "Not Detected",
        dbs_at_birth_actual_date: "2026-09-02",
        district: "Kabwe",
      },
      "infant",
    );
    expect(infant.outcome).toBe("negative");
    expect(infant.dbsDate).toBe("2026-09-02");
    expect(mother).not.toHaveProperty("raw");
  });

  it("parses supported ISO and D-M-Y dates strictly and classifies DBS outcomes", () => {
    expect(parsePmtctDate("31-02-2026")).toBeNull();
    expect(parsePmtctDate("2026-02-28T00:00:00Z")).toBe("2026-02-28");
    expect(classifyPmtctOutcome("Detected")).toBe("positive");
    expect(classifyPmtctOutcome("Not Detected")).toBe("negative");
    expect(classifyPmtctOutcome("Pending")).toBe("pending");
    expect(classifyPmtctOutcome("other")).toBe("unknown");
    expect(parsePmtctRows({ data: { results: [{ id: "x" }] } })).toHaveLength(1);
  });

  it("prepares FY/custom bounds for backend requests without applying a client-side filter", () => {
    expect(pmtctWindowParams(WINDOW)).toEqual({ from: "2026-04-01", to: "2027-03-31" });
    expect(
      pmtctWindowParams({ from: null, to: null, label: "All time", slug: "all_time" }),
    ).toEqual({});
    const mothers = [normalizePmtctRecord({ ecap_id: "1", district: "Kabwe" }, "mother")];
    const infants = [
      normalizePmtctRecord(
        { pmtct_id: "1", district: "Kabwe", final_outcome: "Detected" },
        "infant",
      ),
      normalizePmtctRecord(
        { pmtct_id: "2", district: "Kabwe", final_outcome: "Not detected" },
        "infant",
      ),
    ];
    expect(calculatePmtctMetrics(mothers, infants)).toMatchObject({
      mothers: 1,
      infants: 2,
      detected: 1,
      notDetected: 1,
    });
    expect(pmtctDistrictOutcomes(infants)[0]).toMatchObject({
      district: "Kabwe",
      total: 2,
      detected: 1,
      notDetected: 1,
    });
  });

  it("locks district scope, sends date bounds, and rejects rows returned for other districts", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      return new Response(
        JSON.stringify({
          status: "success",
          data: [
            {
              ecap_id: "allowed",
              pmtct_id: "pm-allowed",
              district: "Kabwe",
              date_enrolled_pmtct: "2026-04-01",
            },
            { ecap_id: "outside", pmtct_id: "pm-out", district: "Choma" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const data = await fetchPmtctMothers(DISTRICT, WINDOW);
    expect(data.rows.map((row) => row.clientId)).toEqual(["allowed"]);
    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toContain("pmtct-mother-register/Kabwe");
    expect(urls[0]?.searchParams.get("from")).toBe(WINDOW.from);
    expect(urls[0]?.searchParams.get("to")).toBe(WINDOW.to);
  });

  it("discovers a requested profile by scoped ID and matches infants by PMTCT ID", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const isChild = url.pathname.includes("child-register");
      return new Response(
        JSON.stringify({
          data: isChild
            ? [
                { ecap_id: "CH-1", pmtct_id: "PM-1", district: "Kabwe", final_outcome: "Detected" },
                { ecap_id: "CH-2", pmtct_id: "PM-2", district: "Kabwe", final_outcome: "Negative" },
              ]
            : [{ ecap_id: "EC-1", pmtct_id: "PM-1", district: "Kabwe", firstname: "Mother" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const profile = await fetchPmtctProfile(DISTRICT, WINDOW, "EC-1");
    expect(profile.mother?.pmtctId).toBe("PM-1");
    expect(profile.infants.map((row) => row.pmtctId)).toEqual(["PM-1"]);
  });

  it("registers protected PMTCT routes and legacy redirects", () => {
    expect(pmtctManifest.minScope).toBe("district");
    expect(pmtctManifest.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/pmtct", requires: ["records.view"] }),
        expect.objectContaining({ path: "/pmtct/:id", requires: ["records.view"] }),
        expect.objectContaining({ path: "/registers/pmtct" }),
        expect.objectContaining({ path: "/profile/pmtct-details" }),
      ]),
    );
  });
});
