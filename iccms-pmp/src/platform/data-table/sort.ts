/**
 * Client-mode sorting.
 *
 * Kept separate from the table so the same comparison can be reused by the export (which must emit
 * rows in the order the user sees) and unit-tested without a DOM.
 */

import { compareIds } from "@/core/lib/values";

export type SortSpec<T> = {
  field: string;
  direction: "asc" | "desc";
  /** Transform the raw value before comparing. */
  value?: (row: T) => string | number | null;
};

/** Case-insensitive, number-aware, nulls last in both directions. */
export function sortRows<T>(rows: ReadonlyArray<T>, spec: SortSpec<T>): ReadonlyArray<T> {
  const { field, direction, value } = spec;
  const pickValue =
    value ?? ((row: T) => (row as Record<string, unknown>)[field] as string | number | null);

  const factor = direction === "asc" ? 1 : -1;

  // The direction is applied to the *comparison*, not by reversing the result. Reversing also reverses
  // the null placement, which put empty cells at the top of every descending sort.
  return [...rows].sort((a, b) => {
    const left = pickValue(a);
    const right = pickValue(b);

    const leftEmpty = left === null || left === undefined || left === "";
    const rightEmpty = right === null || right === undefined || right === "";
    // Nulls last in both directions: an empty cell at the top of a descending sort is noise.
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1;
    if (rightEmpty) return -1;

    return factor * compareIds(left, right);
  });
}
