import { describe, expect, it } from "vitest";

import { allFeatureKeys, resolveFlags, type FeatureKey } from "./features";

describe("features", () => {
  it("ships referrals, flags, performance, caseworkers, and the training log off by default", () => {
    // These modules either lack usable APIs or rely on endpoints that do not enforce caller scope.
    expect(resolveFlags([])["module.referrals"]).toBe(false);
    expect(resolveFlags([])["module.flags"]).toBe(false);
    expect(resolveFlags([])["module.performance"]).toBe(false);
    expect(resolveFlags([])["module.caseworkers"]).toBe(false);
    expect(resolveFlags([])["module.trainingLog"]).toBe(false);
  });

  it("turns a module on", () => {
    expect(resolveFlags([])["module.households"]).toBe(true);
  });

  it("lets VITE_FEATURES_OFF disable anything, including one that defaults on", () => {
    expect(resolveFlags(["module.households"])["module.households"]).toBe(false);
  });

  it("ignores unknown keys instead of crashing on a stale .env", () => {
    const flags = resolveFlags(["module.households", "module.doesNotExist"]);
    expect(flags["module.households"]).toBe(false);
    expect(flags).not.toHaveProperty("module.doesNotExist");
  });

  it("every declared key resolves to a boolean", () => {
    const flags = resolveFlags([]) as Record<FeatureKey, boolean>;
    for (const key of allFeatureKeys) {
      expect(typeof flags[key]).toBe("boolean");
    }
  });
});
