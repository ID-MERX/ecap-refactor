import { afterEach, describe, expect, it, vi } from "vitest";
import type { Scope } from "@/core/access/types";
import { defaultFeatures } from "@/config";

import {
  allowedReferralDistricts,
  fetchCaregiverReferralMonths,
  fetchVcaReferralMonths,
} from "../api/client";
import { normalizeReferralMonthlyRow, parseReferralMonth } from "../api/schemas";
import { combineReferralMonths } from "../model/monthly";
import { referralsManifest } from "../manifest";

afterEach(() => vi.unstubAllGlobals());

const WINDOW = { from: "2026-04-01", to: "2027-03-31", label: "FY2026", slug: "FY2026" };

describe("scoped referral aggregates", () => {
  it("restricts requested districts to the configured user scope", () => {
    const districtScope: Scope = { level: "district", district: "Kabwe" };
    const provinceScope: Scope = {
      level: "province",
      province: "Central Province",
      districts: ["Kabwe", "Chibombo"],
    };
    expect(allowedReferralDistricts(districtScope, "Choma")).toEqual([]);
    expect(allowedReferralDistricts(districtScope)).toEqual(["Kabwe"]);
    expect(allowedReferralDistricts(provinceScope)).toEqual(["Kabwe", "Chibombo"]);
  });

  it("parses monthly counts and discards malformed months/counts", () => {
    expect(parseReferralMonth("01-2026")).toBe("2026-01");
    expect(parseReferralMonth("13-2026")).toBeNull();
    expect(
      normalizeReferralMonthlyRow({
        district: "Kabwe",
        referral_month: "02-2026",
        referral_count: "7",
      }),
    ).toMatchObject({ month: "2026-02", count: 7 });
    expect(
      normalizeReferralMonthlyRow({
        district: "Kabwe",
        referral_month: "2026-02",
        referral_count: "x",
      }),
    ).toBeNull();
  });

  it("combines caregiver and child series without calculating a misleading grand total", () => {
    expect(
      combineReferralMonths(
        [
          { district: "Kabwe", month: "2026-01", count: 5 },
          { district: "Kabwe", month: "2026-02", count: 3 },
        ],
        [{ district: "Kabwe", month: "2026-01", count: 4 }],
      ),
    ).toEqual([
      { month: "2026-01", caregivers: 5, children: 4 },
      { month: "2026-02", caregivers: 3, children: 0 },
    ]);
  });

  it("sends date bounds to the existing monthly endpoint and revalidates each returned district", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      return new Response(
        JSON.stringify({
          data: [
            { district: "Kabwe", referral_count: "12", referral_month: "01-2026" },
            { district: "Choma", referral_count: "99", referral_month: "01-2026" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const scope: Scope = { level: "district", district: "Kabwe" };
    const result = await fetchCaregiverReferralMonths(scope, WINDOW);
    expect(result.rows).toEqual([{ district: "Kabwe", month: "2026-01", count: 12 }]);
    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toContain("/household/caregiver-referrals-by-month/Kabwe");
    expect(urls[0]?.searchParams.get("from")).toBe(WINDOW.from);
    expect(urls[0]?.searchParams.get("to")).toBe(WINDOW.to);
  });

  it("fans out only to configured province districts and drops rows outside the requested district", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      const requestedDistrict = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      return new Response(
        JSON.stringify({
          data: [
            { district: requestedDistrict, referral_count: "2", referral_month: "02-2026" },
            { district: "Choma", referral_count: "99", referral_month: "02-2026" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const scope: Scope = {
      level: "province",
      province: "Central Province",
      districts: ["Kabwe", "Chibombo"],
    };
    const result = await fetchVcaReferralMonths(scope, WINDOW);
    expect(
      urls.map((url) => decodeURIComponent(url.pathname.split("/").at(-1) ?? "")).sort(),
    ).toEqual(["Chibombo", "Kabwe"]);
    expect(result.rows.map((row) => row.district).sort()).toEqual(["Chibombo", "Kabwe"]);
  });

  it("registers the feature-flagged route with records.view and district scope", () => {
    expect(defaultFeatures["module.referrals"]).toBe(false);
    expect(referralsManifest.minScope).toBe("district");
    expect(referralsManifest.routes).toEqual([
      expect.objectContaining({ path: "/referrals", requires: ["records.view"] }),
    ]);
  });
});
