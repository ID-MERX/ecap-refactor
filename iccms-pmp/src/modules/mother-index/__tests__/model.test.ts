import { afterEach, describe, expect, it, vi } from "vitest";

import type { Scope } from "@/core/access/types";

import { fetchMotherProfile, fetchMotherRegister } from "../api/client";
import { normalizeMotherRecord, normalizeHouseholdChild } from "../api/schemas";
import {
  distinctMothers,
  EMPTY_MOTHER_FILTERS,
  filterMothers,
  sortMothers,
} from "../model/register";
import { motherIndexManifest } from "../manifest";

const WINDOW = { from: "2026-04-01", to: "2027-03-31", label: "FY2026", slug: "FY2026" };
const DISTRICT: Scope = { level: "district", district: "Kabwe" };

afterEach(() => vi.unstubAllGlobals());

describe("Mother Index normalization and filters", () => {
  it("uses the approved mother ID precedence and keeps HIV separate from ART status", () => {
    const mother = normalizeMotherRecord({
      mother_id: "M-1",
      household_id: "HH-1",
      ecap_id: "EC-1",
      caregiver_hiv_status: "HIV Positive",
      art_status: "Not on ART",
      hei_status: "Yes",
      linkage_status: "Linked",
      district: "Kabwe",
      facility: "Clinic",
      date_enrolled: "18-08-2026",
      updated_at: "2026-09-01",
      firstname: "Private",
      phone_number: "Private",
    });
    expect(mother.motherId).toBe("M-1");
    expect(mother.hivAnswer).toBe("yes");
    expect(mother.onArt).toBe("no");
    expect(mother.hei).toBe("yes");
    expect(mother.linked).toBe("yes");
    expect(mother.enrolledDate).toBe("2026-08-18");
    expect(mother).not.toHaveProperty("firstname");
    expect(normalizeMotherRecord({ household_id: "HH-2", ecap_id: "EC-2" }).motherId).toBe("HH-2");
    expect(normalizeMotherRecord({ ecap_id: "EC-3" }).motherId).toBe("EC-3");
  });

  it("normalizes unknown child HIV results as unknown, not negative", () => {
    expect(
      normalizeHouseholdChild({ uid: "V-1", household_id: "HH-1", district: "Kabwe" }).hivPositive,
    ).toBeNull();
    expect(normalizeHouseholdChild({ uid: "V-2", is_hiv_positive: "Yes" }).hivPositive).toBe(true);
    expect(normalizeHouseholdChild({ uid: "V-3", is_hiv_positive: "No" }).hivPositive).toBe(false);
  });

  it("deduplicates by canonical mother ID and combines tri-state categories with search", () => {
    const rows = [
      normalizeMotherRecord({
        mother_id: "M-1",
        district: "Kabwe",
        facility: "Alpha",
        hiv_status: "Negative",
        art_status: "Yes",
        hei_status: "Yes",
        linkage_status: "No",
        updated_at: "2026-09-01",
      }),
      normalizeMotherRecord({ mother_id: "M-1", district: "Kabwe", facility: "Duplicate" }),
      normalizeMotherRecord({
        mother_id: "M-2",
        district: "Kabwe",
        facility: "Beta",
        hiv_status: "Unknown",
        art_status: "No",
        hei_status: "No",
        linkage_status: "Yes",
        updated_at: "2026-08-01",
      }),
      normalizeMotherRecord({ district: "Kabwe", facility: "No ID" }),
    ];
    const distinct = distinctMothers(rows);
    expect(distinct.map((row) => row.motherId)).toEqual(["M-1", "M-2"]);
    expect(
      filterMothers(distinct, { ...EMPTY_MOTHER_FILTERS, onArt: "no" }, "beta").map(
        (row) => row.motherId,
      ),
    ).toEqual(["M-2"]);
    expect(sortMothers(distinct).map((row) => row.motherId)).toEqual(["M-1", "M-2"]);
  });
});

describe("Mother Index scoped queries", () => {
  it("sends FY bounds and revalidates district rows", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      return new Response(
        JSON.stringify({
          data: [
            { mother_id: "M-1", district: "Kabwe", facility: "One" },
            { mother_id: "M-2", district: "Choma", facility: "Outside" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const result = await fetchMotherRegister(DISTRICT, WINDOW);
    expect(result.rows.map((row) => row.motherId)).toEqual(["M-1"]);
    expect(urls[0]?.pathname).toContain("/mother/district/Kabwe/filtered");
    expect(urls[0]?.searchParams.get("from")).toBe(WINDOW.from);
    expect(urls[0]?.searchParams.get("to")).toBe(WINDOW.to);
  });

  it("loads family members only after scoped mother discovery and requires exact household and district", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      if (url.pathname.includes("/household/members/")) {
        return new Response(
          JSON.stringify({
            status: "success for a single household family members",
            data: [
              { uid: "V-1", household_id: "HH-1", district: "Kabwe", is_hiv_positive: "Yes" },
              { uid: "V-2", household_id: "HH-10", district: "Kabwe" },
              { uid: "V-3", household_id: "HH-1", district: "Choma" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          data: [{ mother_id: "M-1", household_id: "HH-1", district: "Kabwe", facility: "Clinic" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const profile = await fetchMotherProfile(DISTRICT, WINDOW, "M-1");
    expect(profile.mother?.householdId).toBe("HH-1");
    expect(profile.children.map((child) => child.id)).toEqual(["V-1"]);
    expect(urls).toHaveLength(2);
  });

  it("registers protected routes and legacy redirects", () => {
    expect(motherIndexManifest.minScope).toBe("district");
    expect(motherIndexManifest.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/mother-index", requires: ["records.view"] }),
        expect.objectContaining({ path: "/mother-index/:id", requires: ["records.view"] }),
        expect.objectContaining({ path: "/registers/mother-index" }),
        expect.objectContaining({ path: "/profile/mother-index-details" }),
      ]),
    );
  });
});
