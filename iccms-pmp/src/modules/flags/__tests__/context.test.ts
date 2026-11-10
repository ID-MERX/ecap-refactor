import { describe, expect, it } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { flagContextTarget } from "../model/context";
import { flagsManifest } from "../manifest";

describe("Flags scaffold boundaries", () => {
  it("is disabled by default and registers only scoped read routes", () => {
    expect(defaultFeatures["module.flags"]).toBe(false);
    expect(flagsManifest.minScope).toBe("district");
    expect(flagsManifest.routes).toEqual([
      expect.objectContaining({ path: "/flags", requires: ["records.view"] }),
      expect.objectContaining({ path: "/flags/new", requires: ["records.view"] }),
    ]);
    expect(flagsManifest.nav?.[0]).toMatchObject({ to: "/flags", requires: ["records.view"] });
    expect(
      buildRoutes([flagsManifest], deriveAccess({ description: "Administrator" })).routes,
    ).toEqual([]);
  });

  it.each([
    ["HH-1", null, { kind: "household", id: "HH-1" }],
    [null, "VCA-2", { kind: "vca", id: "VCA-2" }],
    ["  HH-1  ", "", { kind: "household", id: "HH-1" }],
    [null, null, { kind: null }],
    ["", " ", { kind: null }],
    ["HH-1", "VCA-2", { kind: null }],
  ] as const)("validates context params %j, %j", (householdId, vcaId, expected) => {
    expect(flagContextTarget(householdId, vcaId)).toEqual(expected);
  });
});
