import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/app/App";
import { resetTokenCache, setToken } from "@/core/auth/session";
import { storage } from "@/core/lib/storage";

const ME = {
  id: "user-1",
  email: "district.user@invalid.test",
  first_name: "District",
  last_name: "User",
  description: "District User",
  title: null,
  location: "Kabwe",
  avatar: null,
  password_change_required: false,
  role: { id: "role-1", name: "ECAP II" },
};
const HOUSEHOLDS = [
  {
    household_id: "HH-1",
    district: "Kabwe",
    province: "Central Province",
    caregiver_name: "Private Caregiver",
  },
  {
    household_id: "HH-OUTSIDE",
    district: "Choma",
    province: "Southern Province",
    caregiver_name: "Other Caregiver",
  },
];

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(url: string) {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const parsed = new URL(String(input));
    requests.push({ url: parsed, init });
    if (parsed.pathname.endsWith("/users/me")) return response({ data: ME });
    if (parsed.pathname.includes("/household/all-households/"))
      return response({ data: HOUSEHOLDS });
    if (parsed.pathname.includes("/household/caregiver-services-by-district/"))
      return response({
        data: [
          {
            household_id: "HH-1",
            district: "Kabwe",
            service_date: "15-06-2026",
            health_services: "Clinic",
          },
          {
            household_id: "HH-1",
            district: "Choma",
            service_date: "15-06-2026",
            safe_services: "Leak must not join across district",
          },
          {
            household_id: "HH-1",
            district: "Kabwe",
            service_date: "15-06-2025",
            stable_services: "Outside selected FY",
          },
        ],
      });
    return response({ message: `Unexpected ${parsed.pathname}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  setToken("token-test");
  window.history.pushState({}, "", url);
  return requests;
}

beforeEach(() => {
  storage.wipeNamespace();
  resetTokenCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("caregiver risk routes", () => {
  it("scopes requests and rows, masks caregiver names, and opens the scoped household profile", async () => {
    const requests = setup(
      "/caregivers/risk?type=safe_domain&fy=custom&from=2026-04-01&to=2027-03-31",
    );
    render(<App />);

    const link = await screen.findByRole("link", { name: "HH-1" });
    expect(link.getAttribute("href")).toBe("/households/HH-1");
    expect(screen.queryByText("HH-OUTSIDE")).toBeNull();
    expect(screen.queryByText("Private Caregiver")).toBeNull();
    expect(await screen.findByText("Hidden for privacy")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect((await screen.findAllByText("No")).length).toBeGreaterThan(0);

    expect(
      requests.some(({ url }) => url.pathname.endsWith("/household/all-households/Kabwe")),
    ).toBe(true);
    expect(
      requests.some(({ url }) =>
        url.pathname.endsWith("/household/caregiver-services-by-district/Kabwe"),
      ),
    ).toBe(true);
    expect(
      requests.some(({ url }) =>
        url.pathname.endsWith("/household/caregiver-services-by-district/"),
      ),
    ).toBe(false);
  });

  it("redirects the legacy URL while retaining risk and fiscal-year query parameters", async () => {
    setup(
      "/registers/caregiver-risk?type=safe_domain&district=Kabwe&fy=custom&from=2026-04-01&to=2027-03-31",
    );
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Missing safe services registry" }),
    ).toBeTruthy();
    expect(window.location.pathname).toBe("/caregivers/risk");
    expect(window.location.search).toContain("type=safe_domain");
    expect(window.location.search).toContain("district=Kabwe");
    expect(window.location.search).toContain("from=2026-04-01");
    expect(window.location.search).toContain("to=2027-03-31");
  });
});
