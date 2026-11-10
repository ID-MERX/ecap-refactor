/**
 * Registry tests: which modules, routes and nav items a user can see.
 *
 * This is where finding S2/S3 from the audit get fixed — legacy hid nav links it could not protect,
 * so `/users`, `/data-pipeline` and `/districts` were reachable by URL for anyone signed in.
 */

import { describe, expect, it } from "vitest";

import { deriveAccess } from "@/core/access/deriveAccess";
import type { Access } from "@/core/access/types";
import type { ModuleManifest } from "@/core/modules";
import { buildNav, buildRoutes, visibleModules } from "@/app/registry";

const Noop = () => null;

function manifest(
  overrides: Partial<ModuleManifest> & Pick<ModuleManifest, "id" | "feature">,
): ModuleManifest {
  return {
    routes: [{ path: `/${overrides.id}`, component: Noop }],
    ...overrides,
  };
}

const national: Access = deriveAccess({ description: "Administrator" });
const province: Access = deriveAccess({
  description: "Provincial User",
  title: "Central Province",
});
const district: Access = deriveAccess({ description: "District User", location: "Kabwe" });
const none: Access = deriveAccess({ description: "Caseworker" });

const MODULES: ReadonlyArray<ModuleManifest> = [
  manifest({
    id: "dashboard",
    feature: "module.dashboard",
    nav: [{ label: "Dashboard", to: "/" }],
  }),
  manifest({
    id: "households",
    feature: "module.households",
    navGroup: "Registers",
    nav: [{ label: "Households", to: "/households" }],
    routes: [{ path: "/households", component: Noop, redirects: ["/registers/households"] }],
  }),
  manifest({
    id: "vcas",
    feature: "module.vcas",
    navGroup: "Registers",
    nav: [{ label: "VCAs", to: "/vcas" }],
  }),
  manifest({
    id: "users",
    feature: "module.users",
    navGroup: "Admin",
    nav: [{ label: "Users", to: "/users", requires: ["users.manage"] }],
    routes: [{ path: "/users", component: Noop, requires: ["users.manage"] }],
  }),
  manifest({
    id: "districts",
    feature: "module.districts",
    navGroup: "Registers",
    nav: [{ label: "Districts", to: "/districts" }],
    routes: [{ path: "/districts", component: Noop }],
    // Decision 26: a district user sees one row, which is meaningless on a comparison page.
    minScope: "province",
  }),
  manifest({
    id: "referrals",
    feature: "module.referrals", // defaults off — no backend endpoint yet
    nav: [{ label: "Referrals", to: "/referrals" }],
  }),
];

describe("visibleModules", () => {
  it("drops a module whose feature flag is off, even for an admin", () => {
    const ids = visibleModules(MODULES, national).map((m) => m.id);
    expect(ids).not.toContain("referrals");
  });

  it("keeps the default-off /districts module hidden at every scope", () => {
    for (const access of [district, province, national]) {
      expect(visibleModules(MODULES, access).map((m) => m.id)).not.toContain("districts");
    }
  });
});

describe("buildRoutes", () => {
  it("registers an admin-only route for an admin", () => {
    expect(buildRoutes(MODULES, national).routes.map((r) => r.path)).toContain("/users");
  });

  it("does not register /users for a province or district user", () => {
    // This is the S2 fix: the route is absent, so typing the URL gets NotFound, not a page that
    // renders and then fails to save.
    expect(buildRoutes(MODULES, province).routes.map((r) => r.path)).not.toContain("/users");
    expect(buildRoutes(MODULES, district).routes.map((r) => r.path)).not.toContain("/users");
  });

  it("registers nothing at all for an unscoped user", () => {
    expect(buildRoutes(MODULES, none).routes).toEqual([]);
  });

  it("collects legacy redirects", () => {
    expect(buildRoutes(MODULES, national).redirects).toContainEqual({
      from: "/registers/households",
      to: "/households",
    });
  });
});

describe("buildNav", () => {
  it("groups items in first-seen order", () => {
    const groups = buildNav(MODULES, national).map((g) => g.group);
    expect(groups).toEqual([null, "Registers", "Admin"]);
  });

  it("drops a group whose every item is hidden", () => {
    const groups = buildNav(MODULES, district).map((g) => g.group);
    expect(groups).not.toContain("Admin");
  });

  it("hides the Admin link from a province user", () => {
    const admin = buildNav(MODULES, province).find((g) => g.group === "Admin");
    expect(admin).toBeUndefined();
  });

  it("gives a district user no districts link (decision 26)", () => {
    const labels = buildNav(MODULES, district).flatMap((g) => g.items.map((i) => i.label));
    expect(labels).not.toContain("Districts");
    expect(labels).toContain("Households");
  });

  it("gives an unscoped user an empty navigation", () => {
    expect(buildNav(MODULES, none)).toEqual([]);
  });
});
