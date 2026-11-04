/**
 * Manifest *types* live in `core` so a module can describe itself without importing `app`.
 *
 * `CLAUDE.md`: no layer imports `app`. A module that had to import `app/manifest` for its type would be
 * a circular dependency the boundary rules correctly reject. The *registry* that consumes these types
 * still lives in `app`, because only the shell assembles routes.
 */
export type { ModuleManifest, NavItem, RouteDefinition } from "./manifest";

/** Does this user hold every permission the requirement lists? */
export { satisfies, meetsScope } from "./manifest";
