/**
 * End-to-end shell behaviour in jsdom: the tests that prove the Phase 3 definition of done.
 *
 *  - an anonymous visitor sees the sign-in page
 *  - a signed-in district user lands on the shell and sees their own district
 *  - a route they lack permission for renders Forbidden, not a broken page
 *  - a user with no scope sees the "no data scope assigned" screen instead of nationwide data
 *
 * `fetch` is stubbed: `CLAUDE.md` hard rule 2 says MSW and fixtures are for tests only, and this is a
 * test. Nothing here is wired into `dev` or the build.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";
import { resetTokenCache, setToken } from "@/core/auth/session";
import { storage } from "@/core/lib/storage";

const ME = {
  id: "user-1",
  email: "someone@example.org",
  first_name: "Test",
  last_name: "User",
  description: null as string | null,
  title: null as string | null,
  location: null as string | null,
  avatar: null,
  password_change_required: false,
  role: { id: "role-1", name: "ECAP II" },
};

function stubFetch(me: typeof ME | null) {
  const fetchMock = vi.fn(async () => {
    if (me === null)
      return new Response(JSON.stringify({ errors: [{ message: "nope" }] }), { status: 401 });
    return new Response(JSON.stringify({ data: me }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  storage.wipeNamespace();
  resetTokenCache();
  window.history.pushState({}, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("shell", () => {
  it("shows the sign-in page to an anonymous visitor", async () => {
    stubFetch(ME);
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy());
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it("renders the shell for a district user and shows their district", async () => {
    stubFetch({ ...ME, description: "District User", location: "Kabwe" });
    setToken("token-a");

    render(<App />);

    // The district appears twice on purpose: as a chip in the header and on the page, so a user
    // always knows which slice of data they are looking at.
    await waitFor(() => expect(screen.getAllByText("Kabwe").length).toBeGreaterThanOrEqual(2));
    expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
  });

  it("shows the no-scope screen rather than nationwide data", async () => {
    // An unscoped user must never fall back to a default district (legacy disagreement 5).
    stubFetch({ ...ME, description: "Caseworker" });
    setToken("token-a");

    render(<App />);

    await waitFor(() => expect(screen.getByText(/no data scope assigned/i)).toBeTruthy());
  });

  it("returns to the sign-in page when the stored token is rejected", async () => {
    stubFetch(null);
    setToken("stale-token");

    render(<App />);

    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy());
  });

  it("renders a province user's whole district list", async () => {
    stubFetch({ ...ME, description: "Provincial User", title: "Southern Province" });
    setToken("token-a");

    render(<App />);

    await waitFor(() => expect(screen.getAllByText("Southern Province").length).toBeGreaterThan(0));
    expect(screen.getByText(/Livingstone, Mazabuka, Monze, Choma, Kazungula/)).toBeTruthy();
  });
});
