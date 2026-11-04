/**
 * Declarative filter definitions.
 *
 * One `FilterDef` per filterable concern, and **one** `applyFilters` implementation used by the table,
 * the record count and the export. The legacy registers each re-derived their own predicate (table
 * filter, count badge and CSV export were three separate implementations of the same idea, and they
 * drifted), which is how a CSV could contain rows the table did not show.
 */

import type { SubPopulationKey } from "@/config";

/** A filter as it appears in the URL and in component state. */
export type FilterState = Record<string, string>;

export type FilterValue =
  | { kind: "text"; value: string }
  | { kind: "select"; value: string }
  | { kind: "multiSelect"; value: ReadonlyArray<string> }
  | { kind: "boolean"; value: boolean | null }
  | { kind: "dateRange"; from: string | null; to: string | null }
  | { kind: "subPopulation"; value: "all" | "yes" | "no" };

type Base = {
  /** URL param and state key. Must be stable — it appears in shared links. */
  id: string;
  label: string;
};

export type TextFilter = Base & {
  type: "text";
  placeholder?: string;
  /** Fields this filter searches. Empty means "provide your own `predicate`". */
  fields?: ReadonlyArray<string>;
  predicate?: (row: Record<string, unknown>, value: string) => boolean;
};

export type SelectFilter = Base & {
  type: "select";
  field: string;
  /** Static options. Omit to derive them from the loaded data (see `options` in the filter bar). */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Allow "no selection" to mean "everything". */
  allLabel?: string;
  /** Value that means "no filter". Default `"All"`. */
  allValue?: string;
  compare?: (rowValue: unknown, filterValue: string) => boolean;
};

export type MultiSelectFilter = Base & {
  type: "multiSelect";
  field: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
  compare?: (rowValue: unknown, filterValue: ReadonlyArray<string>) => boolean;
};

export type BooleanFilter = Base & {
  type: "boolean";
  field: string;
  trueLabel?: string;
  falseLabel?: string;
};

export type DateRangeFilter = Base & {
  type: "dateRange";
  field: string;
};

/**
 * A sub-population toggle. `key` is a `program.config` key, so the label and the column come from
 * config rather than being retyped here.
 */
export type SubPopulationFilter = Base & {
  type: "subPopulation";
  key: SubPopulationKey;
};

export type FilterDef =
  | TextFilter
  | SelectFilter
  | MultiSelectFilter
  | BooleanFilter
  | DateRangeFilter
  | SubPopulationFilter;

/** How the sort is expressed. Server mode needs a column the backend can order by. */
export type SortState = {
  /** Column field id. */
  field: string;
  direction: "asc" | "desc";
};

/** A page request, in the shape a paginated endpoint would take. */
export type PageState = {
  /** 1-based. */
  page: number;
  pageSize: number;
};
