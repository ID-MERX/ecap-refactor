import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { dashboardManifest } from "../manifest";
import { DashboardPage } from "../routes/DashboardPage";
import { dashboardQuickLinks, type DashboardNavGroup } from "../model/quickLinks";

afterEach(() => vi.unstubAllGlobals());

const NAV: ReadonlyArray<DashboardNavGroup> = [
  {
    group: "Registers",
    items: [
      { moduleId: "households", label: "Households", to: "/households" },
      { moduleId: "districts", label: "Districts", to: "/districts" },
      { moduleId: "dashboard", label: "Dashboard", to: "/dashboard" },
    ],
  },
  { group: null, items: [{ moduleId: "home", label: "Home", to: "/" }] },
];

describe("Dashboard scaffold", () => {
  it("is off by default and declares a scoped read route", () => {
    expect(defaultFeatures["module.dashboard"]).toBe(false);
    expect(dashboardManifest.minScope).toBe("district");
    expect(dashboardManifest.routes).toEqual([
      expect.objectContaining({ path: "/dashboard", requires: ["records.view"] }),
    ]);
    expect(
      buildRoutes([dashboardManifest], deriveAccess({ description: "Administrator" })).routes,
    ).toEqual([]);
  });

  it("derives quick links only from already-visible navigation entries", () => {
    expect(dashboardQuickLinks(NAV)).toEqual([
      { moduleId: "households", label: "Households", to: "/households" },
      { moduleId: "districts", label: "Districts", to: "/districts" },
    ]);
  });

  it("renders without widget requests and only links to provided modules", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<Outlet context={NAV} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Dashboard metrics unavailable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Households" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
