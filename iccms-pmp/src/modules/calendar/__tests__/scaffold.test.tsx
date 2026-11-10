import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultFeatures } from "@/config";
import { deriveAccess } from "@/core/access/deriveAccess";
import { buildRoutes } from "@/app/registry";

import { calendarManifest } from "../manifest";
import { CalendarPage } from "../routes/CalendarPage";

afterEach(() => vi.unstubAllGlobals());

describe("Calendar scaffold", () => {
  it("is off by default and declares a district-or-higher read route", () => {
    expect(defaultFeatures["module.calendar"]).toBe(false);
    expect(calendarManifest.minScope).toBe("district");
    expect(calendarManifest.routes).toEqual([
      expect.objectContaining({ path: "/calendar", requires: ["records.view"] }),
    ]);
    expect(calendarManifest.nav?.[0]).toMatchObject({
      to: "/calendar",
      requires: ["records.view"],
    });
    expect(
      buildRoutes([calendarManifest], deriveAccess({ description: "Administrator" })).routes,
    ).toEqual([]);
    expect(
      buildRoutes(
        [calendarManifest],
        deriveAccess({ description: "District User", location: "Kabwe" }),
      ).routes,
    ).toEqual([]);
  });

  it("explains the ownership blocker without making requests or showing actions", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CalendarPage />);
    expect(screen.getByRole("heading", { name: "Calendar unavailable" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
