import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const VCA = {
  uid: "VCA-1",
  unique_id: "UNIQUE-1",
  vcaid: "SERVICE-1",
  district: "Kabwe",
  province: "Central Province",
  household_id: "HH-1",
  facility: "Kabwe GH",
  firstname: "Sensitive Child",
  lastname: "Private",
  caregiver_name: "Sensitive Caregiver",
  caseworker_name: "Sensitive Worker",
  caseworker_phone: "+260999000000",
  birthdate: "2010-04-12",
  vca_gender: "Female",
  case_status: "Active",
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
    if (parsed.pathname.includes("/child/vcas-assessed-register/"))
      return response({ data: [VCA] });
    if (parsed.pathname.includes("/child/vcas-archived-register/")) return response({ data: [] });
    if (parsed.pathname.includes("/child/vca-services-by-district/"))
      return response({
        data: [
          {
            vcaid: "VCA-1",
            district: "Kabwe",
            service_date: "2026-07-10",
            health_services: "Clinic",
          },
        ],
      });
    if (parsed.pathname.includes("/child/vca-services/"))
      return response({
        data: [
          {
            id: 4,
            service_date: "2026-07-10",
            health_services: "Clinic",
            caseworker_name: "Sensitive Worker",
            caseworker_phone: "+260999000000",
          },
        ],
      });
    if (parsed.pathname.includes("/child/vca-caseplans/"))
      return response({
        data: [{ id: 5, case_plan_date: "2026-07-01", case_plan_status: "Active" }],
      });
    if (parsed.pathname.includes("/child/vca-caseplan-domains/"))
      return response({
        data: [
          {
            id: 6,
            case_plan_date: "2026-07-01",
            vulnerability_type: "Health",
            vulnerability: "Review needed",
          },
        ],
      });
    if (parsed.pathname.includes("/child/vca-referrals/"))
      return response({
        data: [{ id: 7, service: "Clinic", service_date: "2026-07-02", status: "Open" }],
      });
    if (parsed.pathname.endsWith("/items/flagged_forms_ecapplus_pmp"))
      return init?.method === "POST" ? response({ data: { id: 11 } }) : response({ data: [] });
    if (parsed.pathname.includes("/items/flagged_forms_ecapplus_pmp/"))
      return response({ data: { id: 11, status: "resolved" } });
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

describe("VCA module routes", () => {
  it("uses only the assigned district for the active register and links by normalized ID", async () => {
    const requests = setup("/vcas", (url) => {
      if (url.pathname.endsWith("/users/me")) return response({ data: ME });
      if (url.pathname.includes("/child/vcas-assessed-register/"))
        return response({ data: [VCA, { uid: "OUTSIDE-LEAK", district: "Choma" }] });
      return response({ data: [] });
    });
    render(<App />);
    const link = await screen.findByRole("link", { name: "VCA-1" });
    expect(link.getAttribute("href")).toBe("/vcas/VCA-1");
    expect(screen.queryByRole("link", { name: "OUTSIDE-LEAK" })).toBeNull();
    expect(
      requests.some(({ url }) => url.pathname.endsWith("/child/vcas-assessed-register/Kabwe")),
    ).toBe(true);
    expect(
      requests.some(({ url }) => url.pathname.endsWith("/child/vcas-assessed-register/")),
    ).toBe(false);
  });

  it("masks profile PII and enables detail reads only after a scoped register match", async () => {
    const requests = setup("/profile/vca-details?id=VCA-1");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "VCA profile" })).toBeTruthy();
    expect((await screen.findAllByText("Hidden for privacy")).length).toBeGreaterThan(1);
    expect(screen.queryByText("Sensitive Child")).toBeNull();
    expect(screen.queryByText("Sensitive Caregiver")).toBeNull();
    expect(screen.queryByText("Sensitive Worker")).toBeNull();
    expect(screen.queryByText("+260999000000")).toBeNull();
    await waitFor(() =>
      expect(
        requests.some(({ url }) => url.pathname.endsWith("/child/vca-services/SERVICE-1")),
      ).toBe(true),
    );
    expect(requests.some(({ url }) => url.pathname.endsWith("/child/vca-caseplans/UNIQUE-1"))).toBe(
      true,
    );
  });

  it("does not fetch by-ID details or flags when the profile ID is outside the scoped lists", async () => {
    const requests = setup("/vcas/OUTSIDE", (url) => {
      if (url.pathname.endsWith("/users/me")) return response({ data: ME });
      if (url.pathname.includes("/child/vcas-assessed-register/")) return response({ data: [VCA] });
      if (url.pathname.includes("/child/vcas-archived-register/")) return response({ data: [] });
      return response({ data: [] });
    });
    render(<App />);
    expect(
      await screen.findByText("This record is not available in your assigned data scope."),
    ).toBeTruthy();
    expect(requests.some(({ url }) => url.pathname.includes("/child/vca-services/"))).toBe(false);
    expect(requests.some(({ url }) => url.pathname.includes("/items/flagged_forms"))).toBe(false);
  });

  it("filters VCA risk services to the selected fiscal year", async () => {
    const requests = setup(
      "/registers/vca-risk?fy=custom&from=2026-04-01&to=2027-03-31&type=health_domain&district=Kabwe",
      (url) => {
        if (url.pathname.endsWith("/users/me")) return response({ data: ME });
        if (url.pathname.includes("/child/vcas-assessed-register/"))
          return response({
            data: [
              { ...VCA, uid: "OLD-SERVICE", unique_id: "OLD-SERVICE", vcaid: "OLD-SERVICE" },
              { ...VCA, uid: "FY-SERVICE", unique_id: "FY-SERVICE", vcaid: "FY-SERVICE" },
            ],
          });
        if (url.pathname.includes("/child/vca-services-by-district/"))
          return response({
            data: [
              {
                vcaid: "OLD-SERVICE",
                district: "Kabwe",
                service_date: "2025-03-31",
                health_services: "Clinic",
              },
              {
                vcaid: "FY-SERVICE",
                district: "Kabwe",
                service_date: "2026-07-10",
                health_services: "Clinic",
              },
            ],
          });
        return response({ data: [] });
      },
    );
    render(<App />);
    expect(await screen.findByRole("link", { name: "OLD-SERVICE" })).toBeTruthy();
    expect(window.location.search).toContain("type=health_domain");
    expect(window.location.search).toContain("district=Kabwe");
    expect(screen.queryByRole("link", { name: "FY-SERVICE" })).toBeNull();
    expect(
      requests.some(({ url }) => url.pathname.endsWith("/child/vca-services-by-district/Kabwe")),
    ).toBe(true);
  });

  it("creates a scoped flag without sending masked PII", async () => {
    const requests = setup("/vcas/VCA-1");
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "VCA profile" });
    await user.click(screen.getByRole("button", { name: "Flags" }));
    await waitFor(() =>
      expect(
        requests.some(
          ({ url }) => url.searchParams.get("filter[_or][0][vca_id][_eq]") === "SERVICE-1",
        ),
      ).toBe(true),
    );
    await user.type(screen.getByLabelText("Flag observations"), "Please verify the service entry.");
    await user.click(screen.getByRole("button", { name: "Submit flag record" }));
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
      vca_id: "SERVICE-1",
      household_id: "HH-1",
      status: "pending",
      comment: "Please verify the service entry.",
    });
    for (const field of [
      "caregiver_name",
      "caseworker_name",
      "caseworker_phone",
      "firstname",
      "lastname",
    ])
      expect(payload).not.toHaveProperty(field);
  });
});
