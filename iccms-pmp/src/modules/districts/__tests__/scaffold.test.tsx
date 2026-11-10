import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { DistrictsPage } from "../routes/DistrictsPage";
import { districtsManifest } from "../manifest";

afterEach(() => vi.unstubAllGlobals());

describe("Districts scaffold", () => {
  it("is off by default and is a province-or-higher summary route", () => {
    expect(defaultFeatures["module.districts"]).toBe(false);
    expect(districtsManifest.minScope).toBe("province");
    expect(districtsManifest.routes).toEqual([
      expect.objectContaining({ path: "/districts", requires: ["records.view"] }),
    ]);
    expect(districtsManifest.nav?.[0]).toMatchObject({
      to: "/districts",
      requires: ["records.view"],
    });
    expect(
      buildRoutes([districtsManifest], deriveAccess({ description: "Administrator" })).routes,
    ).toEqual([]);
    expect(
      buildRoutes(
        [districtsManifest],
        deriveAccess({ description: "District User", location: "Kabwe" }),
      ).routes,
    ).toEqual([]);
  });

  it("explains the blocker without making network requests or showing exports", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DistrictsPage />);
    expect(screen.getByRole("heading", { name: "District aggregates unavailable" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
