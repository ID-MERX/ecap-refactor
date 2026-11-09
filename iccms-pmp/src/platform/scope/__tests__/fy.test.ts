/**
 * Ported from the checks in `old-ecap-pmp/FY_FILTER_REVIEW.md` §1, plus the precedence rule the legacy
 * implementation got wrong.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_FY_STATE,
  fyFromParams,
  fyKey,
  fyToParams,
  initialFyState,
  loadFyState,
  recentFys,
  resolveFy,
  saveFyState,
  type FyState,
} from "../fy";
import { storage } from "@/core/lib/storage";

describe("resolveFy", () => {
  it("uses an inclusive 1 Oct – 30 Sep window", () => {
    expect(resolveFy({ mode: "fy", fy: 2026 })).toEqual({
      from: "2025-10-01",
      to: "2026-09-30",
      label: "FY2026",
      slug: "FY2026",
    });
  });

  it("has no bounds for all time", () => {
    const window = resolveFy({ mode: "all" });
    expect(window.from).toBeNull();
    expect(window.to).toBeNull();
    expect(window.label).toBe("All time");
  });

  it("orders a reversed custom range instead of returning zero rows", () => {
    // A reversed range silently yields nothing, which looks like an empty register rather than a
    // user error. Swapping is the least surprising behaviour.
    const window = resolveFy({ mode: "custom", from: "2026-06-30", to: "2026-01-01" });
    expect(window.from).toBe("2026-01-01");
    expect(window.to).toBe("2026-06-30");
    expect(window.label).toBe("Custom: 1 Jan 2026 – 30 Jun 2026");
  });
});

describe("URL round-trip", () => {
  const cases: ReadonlyArray<FyState> = [
    { mode: "fy", fy: 2026 },
    { mode: "all" },
    { mode: "custom", from: "2026-01-01", to: "2026-06-30" },
  ];

  for (const state of cases) {
    it(`preserves ${state.mode}`, () => {
      const params = new URLSearchParams(fyToParams(state));
      expect(fyFromParams(params)).toEqual(state);
    });
  }

  it("returns null when the URL says nothing about the FY", () => {
    expect(fyFromParams(new URLSearchParams(""))).toBeNull();
    expect(fyFromParams(new URLSearchParams("district=Kabwe"))).toBeNull();
  });

  it("rejects a half-specified custom range", () => {
    // `from` with no `to` would silently mean "open-ended", showing more data than the link intended.
    expect(fyFromParams(new URLSearchParams("fy=custom&from=2026-01-01"))).toBeNull();
    expect(fyFromParams(new URLSearchParams("fy=custom&to=2026-06-30"))).toBeNull();
  });

  it("rejects malformed dates and nonsense years", () => {
    expect(fyFromParams(new URLSearchParams("fy=custom&from=01/01/2026&to=2026-06-30"))).toBeNull();
    expect(fyFromParams(new URLSearchParams("fy=abc"))).toBeNull();
    expect(fyFromParams(new URLSearchParams("fy=1999"))).toBeNull();
  });
});

describe("precedence: URL → storage → default", () => {
  it("lets the URL beat a saved preference", () => {
    // The legacy app read storage first, so a shared FY2024 link opened on the recipient's FY.
    const result = initialFyState(new URLSearchParams("fy=2024"), { mode: "fy", fy: 2026 });
    expect(result).toEqual({ mode: "fy", fy: 2024 });
  });

  it("falls back to storage when the URL is silent", () => {
    expect(initialFyState(new URLSearchParams(""), { mode: "all" })).toEqual({ mode: "all" });
  });

  it("falls back to the current FY when there is nothing at all", () => {
    expect(initialFyState(new URLSearchParams(""), null)).toEqual(DEFAULT_FY_STATE);
  });

  it("defaults to the current fiscal year", () => {
    expect(DEFAULT_FY_STATE.mode).toBe("fy");
  });
});

describe("storage", () => {
  it("round-trips a saved state", () => {
    storage.wipeNamespace();
    saveFyState({ mode: "custom", from: "2026-01-01", to: "2026-06-30" });
    expect(loadFyState()).toEqual({ mode: "custom", from: "2026-01-01", to: "2026-06-30" });
  });

  it("ignores corrupt saved state rather than throwing", () => {
    storage.wipeNamespace();
    storage.set("fy.filter", "{not json");
    expect(loadFyState()).toBeNull();
    storage.set("fy.filter", '{"mode":"nonsense"}');
    expect(loadFyState()).toBeNull();
  });
});

describe("recentFys", () => {
  it("offers the current FY and the two before it", () => {
    expect(recentFys(new Date("2026-11-04T00:00:00Z"))).toEqual([2027, 2026, 2025]);
  });
});

describe("fyKey", () => {
  it("distinguishes all-time from a window", () => {
    expect(fyKey(resolveFy({ mode: "all" }))).toBe("all");
    expect(fyKey(resolveFy({ mode: "fy", fy: 2026 }))).toBe("2025-10-01_2026-09-30");
  });
});
