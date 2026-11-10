import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchVcaFlagContext, vcaFlagContextQuery } from "../api/flagContext";

afterEach(() => vi.unstubAllGlobals());

describe("VCA flag context lookup", () => {
  it("checks only permitted districts and returns a minimal context", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      const district = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
      const rows = url.pathname.includes("archived")
        ? []
        : [
            {
              uid: `VCA-${district}`,
              household_id: "HH-1",
              district,
              province: "Central Province",
              facility: "Clinic A",
              child_name: "Sensitive Name",
            },
            { uid: "FOREIGN", district: "Choma" },
          ];
      return new Response(JSON.stringify({ data: rows }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const scope = {
      level: "province",
      province: "Central Province",
      districts: ["Kabwe", "Chibombo"],
    } as const;
    const context = await fetchVcaFlagContext(scope, "VCA-Kabwe");
    expect(urls).toHaveLength(4);
    expect(
      urls.map((url) => decodeURIComponent(url.pathname.split("/").at(-1) ?? "")).sort(),
    ).toEqual(["Chibombo", "Chibombo", "Kabwe", "Kabwe"]);
    expect(context).toEqual({
      vcaId: "VCA-Kabwe",
      householdId: "HH-1",
      district: "Kabwe",
      province: "Central Province",
      facility: "Clinic A",
    });
    expect(context).not.toHaveProperty("child_name");
  });

  it("disables unscoped and empty-ID lookups and marks context non-persistent", () => {
    expect(vcaFlagContextQuery({ level: "none" }, "VCA-1")).toMatchObject({
      enabled: false,
      meta: { persist: false },
    });
    expect(vcaFlagContextQuery({ level: "district", district: "Kabwe" }, "")).toMatchObject({
      enabled: false,
      meta: { persist: false },
    });
  });
});
