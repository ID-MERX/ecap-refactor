/**
 * Collects the module manifests into the route and navigation data the shell renders.
 *
 * Kept pure (no React, no router) so it can be unit-tested and so "is this route visible?" is
 * answered by one function rather than by `if` statements scattered through the layout. The legacy
 * app's sidebar hid links it could not protect, which left `/users`, `/data-pipeline` and `/districts`
 * reachable by anyone who typed the URL (`docs/AUDIT.md` §4.4 item 6, finding S2/S3).
 */

import { features } from "@/config";

import {
  meetsScope,
  satisfies,
  type ModuleManifest,
  type NavItem,
  type RouteDefinition,
} from "./manifest";

export type ResolvedNavItem = NavItem & { moduleId: string };

export type ResolvedNavGroup = {
  group: string | null;
  items: ReadonlyArray<ResolvedNavItem>;
};

export type ResolvedRoutes = {
  routes: ReadonlyArray<RouteDefinition & { moduleId: string }>;
  redirects: ReadonlyArray<{ from: string; to: string }>;
};

/**
 * Filter the manifests down to what this build and this user may see.
 *
 * A disabled feature flag removes the module entirely — route *and* nav — so a "hidden" module is
 * unreachable, which is the point. `minScope` removes modules that cannot show anything meaningful to
 * a narrower user (e.g. a district user on the districts comparison page, decision 26).
 */
export function visibleModules(
  manifests: ReadonlyArray<ModuleManifest>,
  access: Parameters<typeof satisfies>[0],
): ReadonlyArray<ModuleManifest> {
  return manifests.filter(
    (manifest) => features[manifest.feature] && meetsScope(access, manifest.minScope),
  );
}

export function buildRoutes(
  manifests: ReadonlyArray<ModuleManifest>,
  access: Parameters<typeof satisfies>[0],
): ResolvedRoutes {
  const routes: Array<RouteDefinition & { moduleId: string }> = [];
  const redirects: Array<{ from: string; to: string }> = [];

  for (const manifest of visibleModules(manifests, access)) {
    for (const route of manifest.routes) {
      if (!satisfies(access, route.requires)) continue;
      routes.push({ ...route, moduleId: manifest.id });
      for (const from of route.redirects ?? []) redirects.push({ from, to: route.path });
    }
  }

  return { routes, redirects };
}

/**
 * Group nav items in first-seen order. A group whose every item is hidden disappears with them —
 * the legacy sidebar compared `section.label === "Data Pipeline"` against a section labelled
 * `"Data pipeline"` and never matched, so the filter did nothing and the section showed for everyone
 * (`docs/AUDIT.md` §4.4 item 7, finding S3).
 */
export function buildNav(
  manifests: ReadonlyArray<ModuleManifest>,
  access: Parameters<typeof satisfies>[0],
): ReadonlyArray<ResolvedNavGroup> {
  const order: string[] = [];
  const grouped = new Map<string, ResolvedNavItem[]>();

  for (const manifest of visibleModules(manifests, access)) {
    for (const item of manifest.nav ?? []) {
      if (!satisfies(access, item.requires)) continue;
      const key = item.group ?? manifest.navGroup ?? "";
      if (!grouped.has(key)) {
        grouped.set(key, []);
        order.push(key);
      }
      grouped.get(key)?.push({ ...item, moduleId: manifest.id });
    }
  }

  return order
    .map((key) => ({ group: key === "" ? null : key, items: grouped.get(key) ?? [] }))
    .filter((section) => section.items.length > 0);
}
