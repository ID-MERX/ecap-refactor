import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { usersManifest } from "../manifest";
import { UsersPage } from "../routes/UsersPage";

afterEach(() => vi.unstubAllGlobals());

describe("Users scaffold", () => {
  it("is off by default and declares only a national manage-users route", () => {
    expect(defaultFeatures["module.users"]).toBe(false);
    expect(usersManifest.minScope).toBe("national");
    expect(usersManifest.routes).toEqual([
      expect.objectContaining({ path: "/users", requires: ["users.manage"] }),
    ]);
    expect(usersManifest.routes.map(({ path }) => path)).toEqual(["/users"]);
    expect(usersManifest.nav?.[0]).toMatchObject({
      to: "/users",
      requires: ["users.manage"],
    });
    expect(
      buildRoutes([usersManifest], deriveAccess({ description: "Administrator" })).routes,
    ).toEqual([]);
    expect(
      buildRoutes(
        [usersManifest],
        deriveAccess({ description: "Provincial User", title: "Central Province" }),
      ).routes,
    ).toEqual([]);
  });

  it("explains the authorization blocker without fetching or exposing account actions", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<UsersPage />);
    expect(screen.getByRole("heading", { name: "User directory unavailable" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
