import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { accountManifest } from "../manifest";
import { AccountPage } from "../routes/AccountPage";

vi.mock("@/core/auth", () => ({
  displayName: (me: { first_name?: string | null; last_name?: string | null; email: string }) =>
    [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email,
  roleName: (me: { role?: { name?: string } | string | null }) =>
    typeof me.role === "string" ? me.role : (me.role?.name ?? null),
  useAuth: () => ({
    state: {
      status: "authenticated",
      me: {
        id: "user-1",
        email: "person@example.org",
        first_name: "Example",
        last_name: "Person",
        role: { id: "role-1", name: "ECAP II" },
      },
    },
  }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("Account module", () => {
  it("uses the existing enabled account feature with only a self route and legacy redirect", () => {
    expect(defaultFeatures["module.account"]).toBe(true);
    expect(accountManifest.routes).toEqual([
      expect.objectContaining({ path: "/account", redirects: ["/profile"] }),
    ]);
    expect(accountManifest.routes.map(({ path }) => path)).toEqual(["/account"]);
    expect(accountManifest.nav?.[0]).toMatchObject({
      label: "My account",
      to: "/account",
    });
    expect(
      buildRoutes(
        [accountManifest],
        deriveAccess({ description: "District User", location: "Kabwe" }),
      ),
    ).toMatchObject({
      routes: [expect.objectContaining({ path: "/account" })],
      redirects: [{ from: "/profile", to: "/account" }],
    });
  });

  it("renders only the session profile and makes no additional request or mutation", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountPage />);
    expect(screen.getByRole("heading", { name: "My account" })).toBeTruthy();
    expect(screen.getByText("Example Person")).toBeTruthy();
    expect(screen.getByText("person@example.org")).toBeTruthy();
    expect(screen.getByText("ECAP II")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Profile changes unavailable" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
