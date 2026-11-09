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
const HOUSEHOLD = {
  household_id: "HH-P",
  caregiver_name: "Sensitive Caregiver",
  caregiver_phone: "+260999000000",
  caseworker_name: "Sensitive Worker",
  caseworker_phone: "+260888000000",
  homeaddress: "12 Main St",
  facility: "Kabwe GH",
  province: "Central Province",
  district: "Kabwe",
  ward: "Ward 1",
};

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(url: string, override?: (url: URL, init?: RequestInit) => Response) {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const parsed = new URL(String(input));
    requests.push({ url: parsed, init });
    if (override) return override(parsed, init);
    if (parsed.pathname.endsWith("/users/me")) return response({ data: ME });
    if (parsed.pathname.includes("/household/all-households-archived/"))
      return response({
        data: [
          {
            ...HOUSEHOLD,
            household_id: "HH-A",
            de_registration_reason: "Other",
            de_registration_date: "2026-10-01",
          },
        ],
      });
    if (parsed.pathname.includes("/household/all-households/"))
      return response({ data: [HOUSEHOLD] });
    if (parsed.pathname.includes("/household/household-services-by-district/"))
      return response({
        data: [
          {
            household_id: "HH-P",
            service_date: "2026-11-01",
            health_services: "N/A",
            schooled_services: "School supplies",
          },
        ],
      });
    if (parsed.pathname.endsWith("/household/members/HH-P"))
      return response({
        data: [{ id: 1, name: "Sensitive Child", relationship: "Child", age: 10 }],
      });
    if (parsed.pathname.includes("/household/caregiver-services/"))
      return response({ data: [{ id: 1, service_date: "2026-11-01", service: "Home visit" }] });
    if (parsed.pathname.includes("/household/caregiver-caseplans/"))
      return response({ data: [{ id: 1, case_plan_date: "2026-10-01", status: "Open" }] });
    if (parsed.pathname.includes("/household/caregiver-caseplan-domains/"))
      return response({
        data: [
          { id: 1, case_plan_date: "2026-10-01", domain: "Health", description: "Domain detail" },
        ],
      });
    if (parsed.pathname.includes("/household/caregiver-referrals/"))
      return response({ data: [{ id: 1, referred_date: "2026-10-02", referral_type: "Health" }] });
    if (parsed.pathname.endsWith("/items/flagged_forms_ecapplus_pmp"))
      return response({
        data: [
          {
            id: 9,
            household_id: "HH-P",
            status: "open",
            comment: "Review the record",
            category: "Missing Data",
            severity: "Low",
            date_created: "2026-11-02",
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

describe("household module routes", () => {
  it("renders the archived register, scopes its request, and links to the profile route", async () => {
    const requests = setup("/households/archived");
    render(<App />);
    const link = await screen.findByRole("link", { name: "HH-A" });
    expect(link.getAttribute("href")).toBe("/households/HH-A");
    expect(screen.getByText("Graduated & exited households")).toBeTruthy();
    expect(
      requests.some(({ url }) => url.pathname.endsWith("/household/all-households-archived/Kabwe")),
    ).toBe(true);
  });

  it("computes domain gaps from the scoped household and service data", async () => {
    setup("/households/risk?type=health_domain");
    render(<App />);
    expect(await screen.findByRole("link", { name: "HH-P" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Missing health services" })).toBeTruthy();
  });

  it("redirects legacy profile query links and masks names and phone numbers", async () => {
    setup("/profile/household-details?id=HH-P");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "HH-P" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Family members" }));
    expect(await screen.findByText("Hidden for privacy")).toBeTruthy();
    expect(screen.queryByText("Sensitive Child")).toBeNull();
    expect(screen.queryByText("Sensitive Caregiver")).toBeNull();
    expect(screen.queryByText("+260999000000")).toBeNull();
  });

  it("loads case-plan domains only when a plan is expanded", async () => {
    const requests = setup("/households/HH-P");
    render(<App />);
    await screen.findByRole("heading", { name: "HH-P" });
    await userEvent.click(screen.getByRole("button", { name: "Case plans" }));
    expect(await screen.findByText("Open")).toBeTruthy();
    expect(requests.some(({ url }) => url.pathname.includes("caregiver-caseplan-domains"))).toBe(
      false,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show vulnerabilities" }));
    expect(await screen.findByText("Domain detail")).toBeTruthy();
  });

  it("filters Directus flags by the matched household id", async () => {
    const requests = setup("/households/HH-P");
    render(<App />);
    await screen.findByRole("heading", { name: "HH-P" });
    await userEvent.click(screen.getByRole("button", { name: "Flags" }));
    expect(await screen.findByText("Review the record")).toBeTruthy();
    await waitFor(() =>
      expect(
        requests.some(({ url }) => url.searchParams.get("filter[household_id][_eq]") === "HH-P"),
      ).toBe(true),
    );
  });

  it("lets an assigned-scope user create a flag without putting masked PII in its payload", async () => {
    const requests = setup("/households/HH-P");
    render(<App />);
    await screen.findByRole("heading", { name: "HH-P" });
    await userEvent.click(screen.getByRole("button", { name: "Flags" }));
    await userEvent.type(
      screen.getByLabelText("Flag observations"),
      "The address needs verification.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit flag record" }));
    await waitFor(() =>
      expect(
        requests.some(
          ({ url, init }) =>
            url.pathname.endsWith("/items/flagged_forms_ecapplus_pmp") && init?.method === "POST",
        ),
      ).toBe(true),
    );
    const sent = requests.find(
      ({ url, init }) =>
        url.pathname.endsWith("/items/flagged_forms_ecapplus_pmp") && init?.method === "POST",
    );
    const payload = JSON.parse(String(sent?.init?.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      household_id: "HH-P",
      status: "pending",
      comment: "The address needs verification.",
    });
    expect(payload).not.toHaveProperty("caregiver_name");
    expect(payload).not.toHaveProperty("caseworker_phone");
  });

  it("does not issue profile detail requests when the URL id is outside the scoped registers", async () => {
    const requests = setup("/households/HH-OUT", (url) => {
      if (url.pathname.endsWith("/users/me")) return response({ data: ME });
      if (url.pathname.includes("/household/all-households"))
        return response({ data: [HOUSEHOLD] });
      return response({ data: [] });
    });
    render(<App />);
    expect(
      await screen.findByText("This record is not available in your assigned data scope."),
    ).toBeTruthy();
    expect(requests.some(({ url }) => url.pathname.includes("/household/members/"))).toBe(false);
    expect(requests.some(({ url }) => url.pathname.includes("/items/flagged_forms"))).toBe(false);
  });
});
