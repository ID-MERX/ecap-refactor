import { describe, expect, it } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { performanceManifest } from "../manifest";

describe("Performance scaffold", () => {
  it("is off by default and declares the scoped performance route", () => {
    expect(defaultFeatures["module.performance"]).toBe(false);
    expect(performanceManifest.minScope).toBe("district");
    expect(performanceManifest.routes).toEqual([
      expect.objectContaining({ path: "/performance", requires: ["records.view"] }),
    ]);
    expect(performanceManifest.nav?.[0]).toMatchObject({
      to: "/performance",
      requires: ["records.view"],
    });
    expect(
      buildRoutes([performanceManifest], deriveAccess({ description: "Administrator" })).routes,
    ).toEqual([]);
  });
});
