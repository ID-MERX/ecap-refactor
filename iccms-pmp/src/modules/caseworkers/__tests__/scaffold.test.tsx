import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { CaseworkerJourneysPage } from "../routes/CaseworkerJourneysPage";
import { CaseworkerProfilePage } from "../routes/CaseworkerProfilePage";
import { caseworkersManifest } from "../manifest";

afterEach(() => vi.unstubAllGlobals());

describe("Caseworkers scaffold", () => {
  it("is disabled by default and declares scoped journeys/profile routes", () => {
    expect(defaultFeatures["module.caseworkers"]).toBe(false);
    expect(caseworkersManifest.minScope).toBe("district");
    expect(caseworkersManifest.routes).toEqual([
      expect.objectContaining({
        path: "/caseworkers/journeys",
        requires: ["records.view"],
        redirects: ["/caseworker-journeys", "/profile/caseworker-details"],
      }),
      expect.objectContaining({
        path: "/caseworkers/:caseworkerId",
        requires: ["records.view"],
      }),
    ]);
    expect(
      buildRoutes([caseworkersManifest], deriveAccess({ description: "Administrator" })).routes,
    ).toEqual([]);
  });

  it("renders an unavailable GPS state without making network requests", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CaseworkerJourneysPage />);
    expect(screen.getByRole("heading", { name: "Journey data unavailable" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the route ID but does not resolve it through an unsafe lookup", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter initialEntries={["/caseworkers/provider-123"]}>
        <Routes>
          <Route path="/caseworkers/:caseworkerId" element={<CaseworkerProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Caseworker profile unavailable" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
