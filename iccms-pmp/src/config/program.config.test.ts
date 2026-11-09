import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  allDistricts,
  districtsByProvince,
  fiscalYearRange,
  geography,
  getCurrentFy,
  provinces,
  programConfig,
  subPopulationDataKey,
  subPopulations,
  subPopulationsFor,
} from "./program.config";

/**
 * The backend's copy of the same map. Read as source text rather than imported: the backend is a
 * separate read-only checkout with its own module system, and this must fail if the file is missing
 * rather than silently skip the most important assertion in the suite.
 */
const BACKEND_GEOGRAPHY = resolve(import.meta.dirname, "../../test/contract/backend-geography.cjs");

describe("geography", () => {
  it("is exactly two provinces with twelve districts", () => {
    expect(provinces).toHaveLength(2);
    expect(allDistricts).toHaveLength(12);
  });

  it("matches the backend map exactly", () => {
    // `backend:lib/userScope.js` looks a province user's province up as an exact, case-sensitive key
    // in this map. If the two drift, the user is silently resolved to `level: "none"` and gets 403
    // on every dashboard request. This test is the guard.
    //
    // The fixture is a verbatim extract of `config/geography.js` from `backend.patch`; regenerate it
    // with `node scripts/sync-backend-contract.mjs` (also run by `pnpm check`).
    expect(existsSync(BACKEND_GEOGRAPHY)).toBe(true);

    const source = readFileSync(BACKEND_GEOGRAPHY, "utf8");
    const backend = parseProvincesFromSource(source);

    expect(backend).toEqual({ ...geography.provinces });
  });

  it("lists no district twice across provinces", () => {
    const names = allDistricts.map((d) => d.district);
    expect(new Set(names).size).toBe(names.length);
  });

  it("reports each district's province", () => {
    expect(districtsByProvince["Central Province"]).toContain("Kabwe");
    expect(allDistricts.find((d) => d.district === "Livingstone")?.province).toBe(
      "Southern Province",
    );
  });
});

/**
 * Extracts `PROVINCES = { "Name": ["a", "b"] }` from the backend's JS module without executing it.
 * Deliberately strict: it throws if the shape is not recognised, so a backend refactor surfaces here
 * instead of quietly making the parity test vacuous.
 */
function parseProvincesFromSource(source: string): Record<string, string[]> {
  const block = /DISTRICTS_BY_PROVINCE\s*=\s*\{([\s\S]*?)\n\}/.exec(source);
  if (!block) throw new Error("Could not find DISTRICTS_BY_PROVINCE in the backend geography file");

  const result: Record<string, string[]> = {};
  const entry = /["']([^"']+)["']\s*:\s*\[([\s\S]*?)\]/g;
  for (const match of (block[1] ?? "").matchAll(entry)) {
    const province = match[1];
    const body = match[2];
    if (province === undefined || body === undefined) continue;
    result[province] = [...body.matchAll(/["']([^"']+)["']/g)].flatMap((m) =>
      m[1] === undefined ? [] : [m[1]],
    );
  }
  if (Object.keys(result).length === 0)
    throw new Error("Backend geography parsed to zero provinces");
  return result;
}

describe("fiscal year", () => {
  it("starts on 1 October", () => {
    // 30 Sep 2026 is still FY2026; 1 Oct 2026 is FY2027.
    expect(getCurrentFy(new Date("2026-09-30T12:00:00Z"))).toBe(2026);
    expect(getCurrentFy(new Date("2026-10-01T12:00:00Z"))).toBe(2027);
  });

  it("covers the whole year at the boundaries", () => {
    expect(getCurrentFy(new Date("2026-01-01T12:00:00Z"))).toBe(2026);
    expect(getCurrentFy(new Date("2026-12-31T12:00:00Z"))).toBe(2027);
  });

  it("returns an inclusive 1 Oct – 30 Sep range", () => {
    expect(fiscalYearRange(2027)).toEqual({ start: "2026-10-01", end: "2027-09-30" });
  });
});

describe("shared risk configuration", () => {
  it("uses the same service-domain definitions for household and VCA risk registers", () => {
    expect(programConfig.vcaRiskTypes).toEqual(programConfig.householdRiskTypes);
    expect(programConfig.vcaRiskTypes.map(({ value }) => value)).toEqual([
      "health_domain",
      "schooled_domain",
      "safe_domain",
      "stable_domain",
      "graduation_path",
    ]);
  });
});

describe("subPopulations", () => {
  it("has 14 unique keys", () => {
    expect(subPopulations).toHaveLength(14);
    expect(new Set(subPopulations.map((sp) => sp.key)).size).toBe(14);
  });

  it("gives household registers 7 chips and VCA registers 14", () => {
    expect(subPopulationsFor("household")).toHaveLength(7);
    expect(subPopulationsFor("vca")).toHaveLength(14);
  });

  it("drops the legacy C/ prefix from the two labels that carried it", () => {
    // Legacy was inconsistent: household registers showed "CALHIV"/"CWLHIV", VCA registers showed
    // "C/ALHIV"/"C/WLHIV". Decision 13 unified on the unprefixed form. "C/SV" is NOT a prefix — it is
    // the acronym for Child Survivors of Violence — so it legitimately keeps its slash.
    const labels = subPopulations.map((sp) => sp.label);
    expect(labels).not.toContain("C/ALHIV");
    expect(labels).not.toContain("C/WLHIV");
    expect(labels).toContain("CALHIV");
    expect(labels).toContain("CWLHIV");
    expect(labels).toContain("C/SV");
  });

  it("labels each key exactly once, in the documented order", () => {
    expect(subPopulations.map((sp) => sp.key)).toEqual([
      "calhiv",
      "hei",
      "cwlhiv",
      "agyw",
      "csv",
      "cfsw",
      "abym",
      "caahh",
      "caichh",
      "caich",
      "calwd",
      "caifhh",
      "muc",
      "pbfw",
    ]);
  });

  it("maps the seven long-form VCA columns", () => {
    expect(subPopulationDataKey("caahh")).toBe("child_adolescent_in_aged_headed_household");
    expect(subPopulationDataKey("muc")).toBe("under_5_malnourished");
    // Keys without a dataKey fall back to the key itself, which is the column name.
    expect(subPopulationDataKey("calhiv")).toBe("calhiv");
    expect(subPopulationDataKey("pbfw")).toBe("pbfw");
  });
});
