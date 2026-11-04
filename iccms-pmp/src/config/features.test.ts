import { describe, expect, it } from "vitest";

import { allFeatureKeys, resolveFlags, type FeatureKey } from "./features";

describe("features", () => {
  it("ships referrals and the training log off by default", () => {
    // No backend endpoint exists for referrals, and the training log has no API at all. Both would
    // show empty or fake pages if they defaulted on.
    expect(resolveFlags([])["module.referrals"]).toBe(false);
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
