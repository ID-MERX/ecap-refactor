/**
 * Register page behaviour in jsdom: the Phase 4 pilot end to end.
 *
 * `fetch` is stubbed with a small, representative register — including a whitespace-padded district and a
 * `"Yes"` sub-population value, because both are the shapes the legacy page silently mishandled
 * (`docs/audit/households.md`, "Bugs and quirks").
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";
import { resetTokenCache, setToken } from "@/core/auth/session";
import { storage } from "@/core/lib/storage";

const ME = {
  id: "user-1",
  email: "district.user@example.org",
  first_name: "District",
  last_name: "User",
  description: "District User",
  title: null,
  location: "Kabwe",
  avatar: null,
  password_change_required: false,
  role: { id: "role-1", name: "ECAP II" },
};

const ROWS = [
  {
    household_id: "HH2",
    homeaddress: "12 Main St",
    facility: "Kabwe GH",
    province: "Central Province",
    district: "Kabwe",
    ward: "Ward 1",
    caseworker_name: "A. Banda",
    calhiv: "1",
    hei: "0",
  },
  {
    household_id: "HH10",
    homeaddress: "9 Side Rd",
    facility: "Mumbwa Clinic",
    province: "Central Province",
    district: "  kabwe  ",
    ward: "Ward 4",
    caseworker_name: "C. Zulu",
    calhiv: "Yes",
    hei: null,
  },
];

function stubFetch(rows = ROWS) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/users/me")) {
        return new Response(JSON.stringify({ data: ME }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (String(url).includes("/household/all-households")) {
        return new Response(JSON.stringify({ data: rows }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    }),
  );
}

beforeEach(() => {
  storage.wipeNamespace();
  resetTokenCache();
  window.history.pushState({}, "", "/households");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("household register", () => {
  it("renders the rows and an ID link", async () => {
    stubFetch();
    setToken("token-a");
    render(<App />);

    await waitFor(() => expect(screen.getByText("HH2")).toBeTruthy());
    expect(screen.getByText("HH10")).toBeTruthy();

    // A real anchor, so middle-click and "open in new tab" work.
    const link = screen.getByRole("link", { name: "HH2" });
    expect(link.getAttribute("href")).toBe("/households/HH2");
  });

  it("shows the record count for the filtered set", async () => {
    stubFetch();
    setToken("token-a");
    render(<App />);
    await waitFor(() => expect(screen.getByText(/2 records/)).toBeTruthy());
  });

  it("matches a district stored with padding and different case", async () => {
    // The legacy register compared a trimmed row value against untrimmed variants, so "  kabwe  " never
    // matched the district select.
    stubFetch();
    setToken("token-a");
    render(<App />);
    await waitFor(() => expect(screen.getByText("HH2")).toBeTruthy());

    const districtSelect = screen.getByRole("combobox", { name: /district/i });
    await userEvent.selectOptions(districtSelect, "Kabwe");

    await waitFor(() => expect(screen.getByText(/2 records/)).toBeTruthy());
  });

  it("counts 'Yes' as yes in the sub-population filter", async () => {
    // "Yes" matched NEITHER button in the legacy registers. Here it counts as yes, matching the
    // backend's own ILIKE 'yes' counts.
    stubFetch();
    setToken("token-a");
    render(<App />);
    await waitFor(() => expect(screen.getByText("HH2")).toBeTruthy());

    // One `yes` button per sub-population chip, in column order. CALHIV is the first.
    const calhivYes = screen.getAllByRole("button", { name: "yes" })[0];
    await userEvent.click(calhivYes!);

    // Both rows are calhiv-positive once "Yes" counts as yes; before the fix this filter returned only
    // the row storing "1".
    await waitFor(() => expect(screen.getAllByText(/records/)[0]?.textContent).toContain("2"));
  });

  it("says so when there are no matching records", async () => {
    stubFetch([]);
    setToken("token-a");
    render(<App />);

    await waitFor(() =>
      expect(screen.getByText(/No households found matching criteria/i)).toBeTruthy(),
    );
  });

  it("shows an error state, not an empty table, when the request fails", async () => {
    // The legacy page rendered a failed query as "No households found".
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/users/me")) {
          return new Response(JSON.stringify({ data: ME }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ message: "boom" }), { status: 500 });
      }),
    );
    setToken("token-a");
    render(<App />);

    // Retries are on for 5xx, so give them time to exhaust before asserting.
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy(), { timeout: 8000 });
  });
});
