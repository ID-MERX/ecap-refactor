/**
 * `deriveAccess` tests.
 *
 * The first block is the important one: it executes the **backend's real `deriveScope`** (a verbatim
 * extract from `backend.patch`, see `test/contract/backend-userScope.cjs`) against the same fixtures as
 * ours and asserts the two agree. A drift here means the UI and the server-side row filter disagree,
 * which shows up as a page that renders and then 403s — the single most confusing bug class in this
 * app.
 *
 * The rest covers the individual rules and the legacy disagreements listed in `docs/AUDIT.md` §4.4.
 */

import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { deriveAccess, derivePermissions, deriveScope, scopeDistricts } from "../deriveAccess";
import type { AccessProfile } from "../types";

const require = createRequire(import.meta.url);

/** The backend module, loaded for its `deriveScope` only. */
const backend = require("../../../../test/contract/backend-userScope.cjs") as {
  deriveScope: (profile: AccessProfile, claims?: { admin_access?: boolean }) => unknown;
  DISTRICTS_BY_PROVINCE?: Record<string, string[]>;
};

// ---------------------------------------------------------------------------------------------
// The fixtures. Every profile is a plausible Directus row, not a made-up string soup.
// ---------------------------------------------------------------------------------------------

const PROFILES: Record<string, AccessProfile> = {
  "national: token admin_access claim": { description: null },
  "national: role named administrator": { role: { name: "Administrator" }, description: null },
  "national: description contains admin": { description: "Administrator" },
  "national: lowercase admin": { description: "administrator" },
  "national: ecap+ support label": { description: "ECAP+ support" },
  "national: role but no description, no location": { role: { name: "ECAP II" } },

  "province: Central Province": { description: "Provincial User", title: "Central Province" },
  "province: Southern Province": { description: "provincial officer", title: "Southern Province" },
  "province: title is All": { description: "Provincial User", title: "All" },
  "province: title missing": { description: "Provincial User" },
  "province: title misspelled": { description: "Provincial User", title: "Central Prov" },
  "province: lowercase title": { description: "Provincial User", title: "central province" },

  "district: District User with location": { description: "District User", location: "Kabwe" },
  "district: description is just district": { description: "district", location: "Monze" },
  "district: location but no description": { location: "Livingstone" },
  "district: unknown location": { description: "District User", location: "Lusaka" },
  "district: location is All": { description: "District User", location: "All" },

  "none: empty profile": {},
  "none: description only": { description: "Caseworker" },
  "none: blank strings": { description: "", title: "", location: "", role: { name: "" } },
};

const CASES: ReadonlyArray<{ name: string; claims: { admin_access?: boolean } }> = [
  { name: "no claim", claims: {} },
  { name: "admin_access false", claims: { admin_access: false } },
  { name: "admin_access true", claims: { admin_access: true } },
];

describe("parity with the backend deriveScope", () => {
  it("extracted the backend rule set, not an empty stub", () => {
    expect(typeof backend.deriveScope).toBe("function");
    // Proves the extraction grabbed the real file body rather than a header.
    expect(backend.deriveScope.toString()).toContain("provincial");
  });

  for (const [label, profile] of Object.entries(PROFILES)) {
    for (const { name: claimName, claims } of CASES) {
      it(`${label} (${claimName})`, () => {
        const theirs = backend.deriveScope(profile, claims);
        const ours = deriveScope(profile, claims);

        // The one intentional divergence: the backend returns the raw `location` for a district user;
        // we validate it against the geography map and return `none` when it is not a programme
        // district. An unknown district would otherwise render an empty register with no explanation.
        // Denying is the safe direction, and this test pins the divergence so it cannot widen.
        const backendLevel = (theirs as { level: string }).level;
        if (ours.level === "none" && backendLevel === "district") {
          const location = profile.location;
          const known = Object.values(backendGeography()).flat();
          expect(known).not.toContain(location);
          return;
        }

        // Otherwise the two must agree exactly, including the province's district list.
        expect(ours).toEqual(theirs);
      });
    }
  }

  it("agrees on the district list a province user gets", () => {
    const scope = deriveScope({ description: "Provincial User", title: "Southern Province" });
    if (scope.level !== "province") throw new Error("expected a province scope");
    expect([...scope.districts]).toEqual([
      "Livingstone",
      "Mazabuka",
      "Monze",
      "Choma",
      "Kazungula",
    ]);
  });
});

/** The backend's own map, so the divergence check above is not circular. */
function backendGeography(): Record<string, string[]> {
  // Read from the geography contract fixture rather than importing the JS module, which needs axios.
  const mod = require("../../../../test/contract/backend-geography.cjs") as {
    DISTRICTS_BY_PROVINCE: Record<string, string[]>;
  };
  return mod.DISTRICTS_BY_PROVINCE;
}

// ---------------------------------------------------------------------------------------------
// Individual rules
// ---------------------------------------------------------------------------------------------

describe("admin detection", () => {
  it("treats the token claim as absolute", () => {
    expect(deriveScope({}, { admin_access: true })).toEqual({ level: "national" });
  });

  it("accepts the ecap+ support label in any case", () => {
    expect(deriveScope({ description: "ECAP+ Support" }).level).toBe("national");
    expect(deriveScope({ description: "ecap+ support" }).level).toBe("national");
  });

  it("does NOT treat a support user as admin (legacy disagreement 3)", () => {
    // Legacy had three definitions of "support". Only the exact `ecap+ support` string grants
    // national access, matching the backend.
    expect(deriveScope({ description: "Support User" }).level).toBe("none");
    expect(deriveScope({ role: { name: "support" } }).level).toBe("national");
  });

  it("does not make a described, located user an admin just for having a role", () => {
    expect(deriveScope({ role: { name: "ECAP II" }, location: "Kabwe" }).level).toBe("district");
  });
});

describe("province detection", () => {
  it("accepts any description containing province (legacy disagreement 4)", () => {
    // A1 accepted this, A2/A7 required exactly "Provincial User". We follow A1 + the backend.
    expect(
      deriveScope({ description: "Provincial Officer", title: "Central Province" }).level,
    ).toBe("province");
  });

  it("requires an exact, case-sensitive province name", () => {
    // The backend looks the title up as an object key; anything else is a miss and yields none.
    for (const title of ["central province", "Central Prov", "ALL", ""]) {
      expect(deriveScope({ description: "Provincial User", title }).level).toBe("none");
    }
  });

  it("denies rather than falling through to district or national", () => {
    expect(deriveScope({ description: "Provincial User", location: "Kabwe" }).level).toBe("none");
  });
});

describe("district detection", () => {
  it("uses the location field", () => {
    expect(deriveScope({ location: "Monze" })).toEqual({ level: "district", district: "Monze" });
  });

  it("treats All as no location", () => {
    expect(deriveScope({ description: "District User", location: "All" }).level).toBe("none");
  });

  it("rejects a location that is not a programme district", () => {
    expect(deriveScope({ location: "Lusaka" }).level).toBe("none");
  });

  it("has no VITE_DEFAULT_DISTRICT fallback (legacy disagreement 5)", () => {
    // The legacy app silently gave every unscoped user the default district's data.
    expect(deriveScope({}).level).toBe("none");
    expect(deriveScope({ role: { name: "ECAP II" }, description: "" }).level).toBe("national");
  });
});

describe("permissions", () => {
  it("gives a national user the admin surfaces legacy left unguarded", () => {
    const permissions = derivePermissions({ level: "national" });
    expect(permissions).toContain("users.manage");
    expect(permissions).toContain("pipeline.view");
    expect(permissions).toContain("scope.national");
  });

  it("does not let a provincial user manage users", () => {
    const permissions = derivePermissions({
      level: "province",
      province: "Central Province",
      districts: [],
    });
    expect(permissions).toContain("registers.view");
    expect(permissions).not.toContain("users.manage");
    expect(permissions).not.toContain("support.viewAllUsers");
  });

  it("gives a district user the minimum", () => {
    const permissions = derivePermissions({ level: "district", district: "Kabwe" });
    expect([...permissions].sort()).toEqual(["records.view", "registers.view", "scope.district"]);
  });

  it("gives an unscoped user nothing at all", () => {
    expect([...derivePermissions({ level: "none" })]).toEqual([]);
  });
});

describe("deriveAccess", () => {
  it("bundles scope and permissions", () => {
    const access = deriveAccess({ description: "District User", location: "Choma" });
    expect(access.isNational).toBe(false);
    expect(access.scope).toEqual({ level: "district", district: "Choma" });
    expect(access.permissions.has("registers.view")).toBe(true);
  });
});

describe("scopeDistricts", () => {
  it("omits the filter for a national user", () => {
    expect(scopeDistricts({ level: "national" })).toBeUndefined();
  });

  it("returns every district for a province user", () => {
    expect(
      scopeDistricts({ level: "province", province: "Southern Province", districts: ["Monze"] }),
    ).toEqual(["Monze"]);
  });

  it("returns a single district for a district user", () => {
    expect(scopeDistricts({ level: "district", district: "Kabwe" })).toEqual(["Kabwe"]);
  });

  it("returns an empty list for no scope, so callers must handle it explicitly", () => {
    expect(scopeDistricts({ level: "none" })).toEqual([]);
  });
});
