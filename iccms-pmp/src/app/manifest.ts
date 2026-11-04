/**
 * What a module is, as far as the shell is concerned.
 *
 * The legacy app assembled its router by hand in one 500-line `App.tsx` and its sidebar by hand in a
 * separate 200-line component, so a route and its nav entry could drift apart. A manifest declares
 * both in one place; the shell reads every manifest and builds the router and the sidebar from the
 * same data.
 */

import type { ComponentType } from "react";

import type { FeatureKey } from "@/config";
import type { Access, Permission } from "@/core/access/types";

/** A sidebar link. Groups are created by `group`, in the order groups are first seen. */
export type NavItem = {
  label: string;
  to: string;
  icon?: ComponentType<{ className?: string }>;
  /** Modules sharing a group appear under one heading. Omit for an ungrouped link. */
  group?: string;
  /** Shown only to users holding all of these. Omit for "anyone signed in with a scope". */
  requires?: ReadonlyArray<Permission>;
};

export type RouteDefinition = {
  path: string;
  /** Rendered inside the shell layout. */
  component: ComponentType;
  /** Omit for "any authenticated user with a data scope". */
  requires?: ReadonlyArray<Permission>;
  /** Redirect targets from the legacy app that must keep working. */
  redirects?: ReadonlyArray<string>;
};

export type ModuleManifest = {
  /** Matches the folder name under `src/modules/` and the audit file `docs/audit/<id>.md`. */
  id: string;
  /** The nav heading this module's items belong to, if any. */
  navGroup?: string;
  /** Off means the module's routes and nav entries are not registered at all. */
  feature: FeatureKey;
  routes: ReadonlyArray<RouteDefinition>;
  nav?: ReadonlyArray<NavItem>;
  /** Platform data scope this module needs. `districts` is national-only — see decision 26. */
  minScope?: "national" | "province" | "district";
};

/** Does this user hold every permission the requirement lists? */
export function satisfies(access: Access | null, requires?: ReadonlyArray<Permission>): boolean {
  if (!requires || requires.length === 0) return access !== null && access.scope.level !== "none";
  if (access === null) return false;
  return requires.every((permission) => access.permissions.has(permission));
}

const SCOPE_RANK = { national: 3, province: 2, district: 1, none: 0 } as const;

/** A module whose `minScope` is above the user's scope is not registered. */
export function meetsScope(access: Access | null, minScope: ModuleManifest["minScope"]): boolean {
  if (!minScope) return true;
  if (access === null) return false;
  return SCOPE_RANK[access.scope.level] >= SCOPE_RANK[minScope];
}
