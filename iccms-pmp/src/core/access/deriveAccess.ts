/**
 * `deriveAccess` — the single answer to "what may this user see?".
 *
 * **This mirrors `backend:lib/userScope.js` `deriveScope` rule for rule.** That is the whole point:
 * the backend enforces the data boundary (Superset row-level security), the frontend decides what to
 * render, and if the two disagree the user sees a page that then 403s. `src/core/access/__tests__`
 * asserts the parity, and `test/contract/backend-userScope.cjs` holds the backend's real source.
 *
 * The rules read **free-text** Directus profile fields, which is fragile (a description containing
 * "admin" anywhere makes you a national admin). It is kept because the backend does it, and because
 * changing one side alone breaks the other. Backend ask #3 replaces both with explicit role/scope
 * fields; until then, this file and `lib/userScope.js` must change together.
 *
 * Where the legacy frontend's eight rule sites disagreed with each other, this follows the backend
 * (see the table in `docs/PROGRESS.md`, "Access-rule resolutions").
 */

import { districtsByProvince, provinces, type District, type Province } from "@/config";

import type { Access, AccessClaims, AccessProfile, Permission, Scope } from "./types";

/** Directus stores "no value" as the literal string `"All"` in these two fields. */
function normalisePlace(value: string | null | undefined): string | null {
  return value && value !== "All" ? value : null;
}

function asProvince(value: string | null): Province | null {
  // The backend looks the province up as a case-sensitive object key and returns `level: "none"`
  // when it misses. Doing the same here means a typo in the Directus `title` field produces the same
  // "no data scope assigned" state on both sides instead of a page that renders and then 403s.
  return provinces.includes(value as Province) ? (value as Province) : null;
}

function asDistrict(value: string | null): District | null {
  for (const province of provinces) {
    const districts: ReadonlyArray<string> = districtsByProvince[province];
    if (districts.includes(value ?? "")) return value as District;
  }
  return null;
}

/**
 * The scope half of `deriveAccess`. Deliberately a separate function so the parity test can compare
 * it with `deriveScope` in isolation.
 */
export function deriveScope(profile: AccessProfile, claims: AccessClaims = {}): Scope {
  const description = String(profile.description ?? "").toLowerCase();
  const roleName =
    typeof profile.role === "object" && profile.role
      ? String(profile.role.name ?? "").toLowerCase()
      : "";
  const location = normalisePlace(profile.location);
  const provinceTitle = normalisePlace(profile.title);

  // --- 1. National / admin ---------------------------------------------------------------------
  // The union of the backend's five conditions. `description.includes("admin")` is the fragile one,
  // but it is what the backend does and what existing admin accounts rely on.
  const isAdmin =
    claims.admin_access === true ||
    roleName === "administrator" ||
    description.includes("admin") ||
    description === "ecap+ support" ||
    // "has a role but no description" — the legacy sidebar did this, and the backend kept it so
    // existing admin accounts were not locked out during the migration.
    (!description && Boolean(roleName) && !location && !provinceTitle);

  if (isAdmin) return { level: "national" };

  // --- 2. Province -----------------------------------------------------------------------------
  if (description.includes("provincial") || description.includes("province")) {
    const province = provinceTitle === null ? null : asProvince(provinceTitle);
    if (province === null) {
      // A province user whose `title` is missing or misspelled gets nothing. This is the backend's
      // behaviour and it is the safe direction: deny, never fall through to nation-wide.
      return { level: "none" };
    }
    return {
      level: "province",
      province,
      districts: districtsByProvince[province] as ReadonlyArray<District>,
    };
  }

  // --- 3. District -----------------------------------------------------------------------------
  const isDistrictUser = description.includes("district") || Boolean(location);
  if (isDistrictUser && location) {
    const district = asDistrict(location);
    // The backend returns the raw `location` without validating it against the geography map. We
    // validate, because an unknown district would otherwise render an empty register with no
    // explanation. An unknown location is treated as "no scope", which denies rather than fails open.
    return district === null ? { level: "none" } : { level: "district", district };
  }

  // --- 4. Anything else ------------------------------------------------------------------------
  // Legacy had a `VITE_DEFAULT_DISTRICT` fallback here that silently gave every unscoped user that
  // district's data (`docs/AUDIT.md` §4.4 disagreement 5). It is deliberately gone.
  return { level: "none" };
}

/** Permissions follow from the scope, never from role-name matching. */
export function derivePermissions(scope: Scope): ReadonlySet<Permission> {
  const permissions = new Set<Permission>();

  if (scope.level === "none") return permissions;

  permissions.add("registers.view");
  permissions.add("records.view");

  // National users see everything, including the admin-only surfaces the legacy app left unguarded
  // by URL (S2: `/users`, `/data-pipeline` were reachable by any logged-in user).
  if (scope.level === "national") {
    permissions.add("scope.national");
    permissions.add("pipeline.view");
    permissions.add("users.manage");
    permissions.add("flags.resolve");
    permissions.add("support.viewAllUsers");
  }

  if (scope.level === "province") {
    permissions.add("scope.province");
    permissions.add("pipeline.view");
    permissions.add("flags.resolve");
  }

  if (scope.level === "district") {
    permissions.add("scope.district");
  }

  return permissions;
}

export function deriveAccess(profile: AccessProfile, claims: AccessClaims = {}): Access {
  const scope = deriveScope(profile, claims);
  return {
    scope,
    permissions: derivePermissions(scope),
    isNational: scope.level === "national",
  };
}

/** The scope every request must carry. Never send `"All"` for a scoped user. */
export function scopeDistricts(scope: Scope): ReadonlyArray<string> | undefined {
  switch (scope.level) {
    case "national":
      // `undefined` means "no district filter" — the backend treats a missing param that way.
      return undefined;
    case "province":
      return scope.districts;
    case "district":
      return [scope.district];
    case "none":
      // An empty list would be read by the backend as "no filter" in several handlers. Callers must
      // check for `level: "none"` and render the no-scope state instead of issuing a request.
      return [];
  }
}
