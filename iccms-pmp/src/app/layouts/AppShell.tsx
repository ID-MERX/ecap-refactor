/**
 * The application shell: sidebar + header + outlet.
 *
 * Built from the module manifests, so a new module appears in the navigation by existing — the legacy
 * app required edits in `AppSidebar.tsx`, `MobileBottomNav.tsx` and `GlobalSearch.tsx` for every new
 * page, which is why the three drifted apart.
 */

import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { LogOut, Menu, X } from "lucide-react";

import { siteConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { buildNav } from "@/app/registry";
import { FyChip } from "@/platform/scope/FyChip";
import type { ModuleManifest } from "@/core/modules";

import { LoadingScreen } from "../components/LoadingScreen";

export function AppShell({
  manifests,
}: {
  manifests: ReadonlyArray<ModuleManifest>;
}): React.ReactNode {
  const { state, access, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const groups = useMemo(() => buildNav(manifests, access), [manifests, access]);

  if (state.status === "loading") return <LoadingScreen />;
  if (state.status !== "authenticated") return null;

  const scope = state.access.scope;
  const scopeLabel =
    scope.level === "national"
      ? "All districts"
      : scope.level === "province"
        ? scope.province
        : scope.level === "district"
          ? scope.district
          : "";

  async function handleSignOut() {
    await signOut();
    void navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <img src={siteConfig.brand.logoMark} alt="" className="size-8" />
          <span className="font-semibold tracking-tight">{siteConfig.appShortName}</span>
          <button
            type="button"
            className="ml-auto md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-6 px-2 pb-6">
          {groups.map((section) => (
            <div key={section.group ?? "_"}>
              {section.group ? (
                <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.group}
                </h2>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <li key={`${item.moduleId}:${item.to}`}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                          isActive
                            ? "bg-brand-50 font-medium text-brand-600"
                            : "text-slate-700 hover:bg-slate-100"
                        }`
                      }
                    >
                      {item.icon ? <item.icon className="size-4" /> : null}
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-20 bg-slate-900/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            {siteConfig.appName}
          </Link>

          {scopeLabel ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {scopeLabel}
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <FyChip />
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
