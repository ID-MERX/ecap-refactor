import { describe, expect, it } from "vitest";

import { pageWindow } from "../Pagination";
import { sortRows } from "../sort";

describe("pageWindow", () => {
  it("lists every page when they all fit", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
  });

  it("puts an ellipsis on both sides when the window sits in the middle", () => {
    // Pages 2–7 and 13–19 are hidden, so both gaps are real.
    expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
  });

  it("puts a single ellipsis after the window when near the start", () => {
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, 4, 5, null, 20]);
  });

  it("shows the neighbouring page instead of an ellipsis for a single-page gap", () => {
    // A `…` standing for exactly one page is worse than showing that page. At page 5 of 20 the window
    // starts at 3, so page 2 is emitted directly instead of an ellipsis.
    expect(pageWindow(5, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, null, 20]);
  });

  it("lists every page when they all fit", () => {
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("handles a single page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe("sortRows", () => {
  const rows = [
    { id: "HH2", name: "beta", n: 2 },
    { id: "HH10", name: "Alpha", n: null },
    { id: "HH1", name: "gamma", n: 1 },
  ];

  it("sorts identifiers numerically, not alphabetically", () => {
    // "HH10" sorts before "HH2" alphabetically, which is wrong for an identifier column.
    expect(sortRows(rows, { field: "id", direction: "asc" }).map((r) => r.id)).toEqual([
      "HH1",
      "HH2",
      "HH10",
    ]);
  });

  it("sorts text case-insensitively", () => {
    expect(sortRows(rows, { field: "name", direction: "asc" }).map((r) => r.name)).toEqual([
      "Alpha",
      "beta",
      "gamma",
    ]);
  });

  it("keeps nulls last in both directions", () => {
    expect(sortRows(rows, { field: "n", direction: "asc" }).at(-1)?.id).toBe("HH10");
    expect(sortRows(rows, { field: "n", direction: "desc" }).at(-1)?.id).toBe("HH10");
  });

  it("does not mutate the input", () => {
    const original = [...rows];
    sortRows(rows, { field: "id", direction: "desc" });
    expect(rows).toEqual(original);
  });
});
