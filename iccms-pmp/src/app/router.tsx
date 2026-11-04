/**
 * Router assembly.
 *
 * The legacy app declared every route by hand in `App.tsx` and gated them with a single
 * "authenticated?" check, so any signed-in user could reach the admin pages by URL
 * (`docs/AUDIT.md` §4.4 item 6). Here each route carries its own requirement and the shell applies
 * it, so a route that is not in the nav is also not reachable.
 */

import { Navigate, createBrowserRouter, type RouteObject } from "react-router";

import { LoginPage } from "@/core/auth/LoginPage";

import { RequireAuth, RequirePermission, RequireScope } from "./components/RouteGuards";
import { RedirectIfAuthenticated } from "./components/RedirectIfAuthenticated";
import { NotFoundScreen } from "./components/NotFoundScreen";
import { AppShell } from "./layouts/AppShell";
import { buildRoutes } from "./registry";
import type { ModuleManifest } from "./manifest";
import { HomePage } from "./routes/HomePage";

export function createAppRouter(
  manifests: ReadonlyArray<ModuleManifest>,
  access: Parameters<typeof buildRoutes>[1],
) {
  const { routes, redirects } = buildRoutes(manifests, access);

  const children: RouteObject[] = [
    { index: true, element: <HomePage /> },
    ...routes.map((route) => ({
      path: route.path.replace(/^\//, ""),
      element:
        route.requires && route.requires.length > 0 ? (
          <RequirePermission permissions={route.requires}>
            <route.component />
          </RequirePermission>
        ) : (
          <route.component />
        ),
    })),
    ...redirects.map(({ from, to }) => ({ path: from, element: <Navigate to={to} replace /> })),
    { path: "*", element: <NotFoundScreen /> },
  ];

  return createBrowserRouter([
    {
      path: "/login",
      element: (
        <RedirectIfAuthenticated>
          <LoginPage />
        </RedirectIfAuthenticated>
      ),
    },
    {
      path: "/",
      element: (
        <RequireAuth>
          <RequireScope>
            <AppShell manifests={manifests} />
          </RequireScope>
        </RequireAuth>
      ),
      children,
    },
  ]);
}
