import { afterEach, describe, expect, it, vi } from "vitest";

import { householdFlagContextQuery, fetchHouseholdFlagContext } from "../api/flagContext";

afterEach(() => vi.unstubAllGlobals());

describe("household flag context lookup", () => {
  it("looks up a selected ID only within the scope and returns minimal non-PII context", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      urls.push(url);
      const rows = url.pathname.includes("archived")
        ? []
        : [
            {
              household_id: "HH-1",
              district: "Kabwe",
              province: "Central Province",
              facility: "Clinic A",
              caregiver_name: "Sensitive Name",
            },
            { household_id: "HH-2", district: "Choma", province: "Southern Province" },
          ];
      return new Response(JSON.stringify({ data: rows }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const scope = { level: "district", district: "Kabwe" } as const;
    const context = await fetchHouseholdFlagContext(scope, "HH-1");
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => decodeURIComponent(url.pathname).includes("Kabwe"))).toBe(true);
    expect(context).toEqual({
      householdId: "HH-1",
      district: "Kabwe",
      province: "Central Province",
      facility: "Clinic A",
    });
    expect(context).not.toHaveProperty("caregiver_name");
  });

  it("does not query for an unscoped user and never persists selected context", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const query = householdFlagContextQuery({ level: "none" }, "HH-1");
    expect(query.enabled).toBe(false);
    expect(query.meta).toEqual({ persist: false });
    expect(await fetchHouseholdFlagContext({ level: "none" }, "HH-1")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
