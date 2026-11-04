/**
 * Access-control types.
 *
 * The legacy app had **no access-control module** (`docs/AUDIT.md` §4.4): the question "who is this
 * user?" was answered by reading free-text Directus fields in at least eight places, with different
 * rules each time. This module replaces all of them with one function.
 */

import type { District, Province } from "@/config";

/**
 * What data a user may see. Mirrors `backend:lib/userScope.js` exactly — the backend already returns
 * one of these four shapes from `deriveScope`, and the frontend must not invent a different answer,
 * or the UI and the server-side row filter disagree.
 *
 * `none` means *deny*. It never means "show everything".
 */
export type AccessLevel = "national" | "province" | "district";

/** The scope itself. A discriminated union so a district scope cannot be read without a district. */
export type Scope =
  | { readonly level: "national" }
  | {
      readonly level: "province";
      readonly province: Province;
      /** Every district in that province, from `programConfig.geography`. */
      readonly districts: ReadonlyArray<District>;
    }
  | { readonly level: "district"; readonly district: District }
  | { readonly level: "none" };

/**
 * Permissions are an explicit set, never derived from role-name string matching. Phase 3 ships the
 * minimum the shell needs; modules add their own keys in later phases and must declare them.
 */
export const PERMISSIONS = [
  "registers.view",
  "records.view",
  "pipeline.view",
  "users.manage",
  "flags.resolve",
  "support.viewAllUsers",
  "scope.national",
  "scope.province",
  "scope.district",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * The Directus profile fields the rules read. These are free text set by hand in the Directus UI
 * (`docs/AUDIT.md` §4.4), which is why the rules are substring matches and why backend ask #3
 * (explicit role/scope fields) exists.
 */
export type AccessProfile = {
  readonly description?: string | null;
  readonly title?: string | null;
  readonly location?: string | null;
  readonly role?: { readonly name?: string | null } | null;
};

/** Token claims that affect access. `admin_access` is the only one today. */
export type AccessClaims = {
  readonly admin_access?: boolean;
};

export type Access = {
  readonly scope: Scope;
  readonly permissions: ReadonlySet<Permission>;
  /** Convenience for the shell: an escape hatch for UI that only needs a yes/no. */
  readonly isNational: boolean;
};
