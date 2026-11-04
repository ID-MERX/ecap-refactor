/**
 * Table state in the URL: filters, sort and page.
 *
 * Every filtered view must be bookmarkable and sendable to a colleague, and a refresh must not lose the
 * user's place. The legacy registers read `district` and `search` from the URL **once on mount** and
 * never wrote back, so the address bar lied about what was on screen and a refresh reset the page.
 *
 * This hook is the single writer. `nuqs` handles the encoding; the FY window is handled separately by
 * `platform/scope` because it is global rather than per-table.
 */

import { useCallback, useMemo } from "react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
// The React Router v8 adapter is required: without a <NuqsAdapter> in the tree, `useQueryStates`
// falls back to the plain-history adapter and the URL stops matching the router's location.

import { toQueryParams } from "./applyFilters";
import type { FilterDef, FilterState, PageState, SortState } from "./types";

const PAGE_SIZES = [50, 100, 500];

export type TableUrlState = {
  filters: FilterState;
  sort: SortState;
  page: PageState;
  /** Set one filter. Always resets to page 1 — staying on page 7 of a narrower result set shows nothing. */
  setFilter: (id: string, value: string) => void;
  setFilters: (next: Record<string, string>) => void;
  clearFilters: () => void;
  setSort: (sort: SortState) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  /** Filter state → query params, ready for a paginated endpoint. */
  queryParams: Record<string, string>;
  /** Which filters are switched on, for the "Clear (n)" badge. */
  activeCount: number;
};

/**
 * URL keys. Filter ids are used directly so a link reads `?district=Kabwe&calhiv=yes`; sort and page
 * use names that cannot collide with a filter id.
 */
const RESERVED = new Set(["sort", "order", "page", "pageSize"]);

export function useTableUrlState(
  defs: ReadonlyArray<FilterDef>,
  defaults: { sort: SortState; pageSize?: number },
): TableUrlState {
  const ids = useMemo(() => defs.map((def) => def.id).filter((id) => !RESERVED.has(id)), [defs]);

  // A static parser set: nuqs needs the same shape every render, and filter ids are module-level
  // constants, so building it once per module is correct.
  const parser = useMemo(() => {
    const shape: Record<string, ReturnType<typeof parseAsString.withDefault>> = {};
    for (const id of ids) shape[id] = parseAsString.withDefault("");
    shape.sort = parseAsString.withDefault(defaults.sort.field);
    shape.order = parseAsString.withDefault(defaults.sort.direction);
    shape.page = parseAsInteger.withDefault(1) as never;
    shape.pageSize = parseAsInteger.withDefault(defaults.pageSize ?? 50) as never;
    return shape;
  }, [ids, defaults.sort.field, defaults.sort.direction, defaults.pageSize]);

  const [state, setState] = useQueryStates(parser as never, {
    history: "replace",
    // Not `shallow`: React Router's data router revalidates loaders, and a filter change should not
    // refetch the whole route. The queries key off the params instead.
    shallow: true,
  });

  const raw = state as unknown as Record<string, string | number>;

  const filters = useMemo<FilterState>(() => {
    const next: FilterState = {};
    for (const def of defs) {
      const value = raw[def.id];
      next[def.id] = value === undefined ? "" : String(value);
    }
    return next;
  }, [defs, raw]);

  const pageSize = Number(raw.pageSize ?? defaults.pageSize ?? 50);

  const setFilter = useCallback(
    (id: string, value: string) => {
      void setState({ [id]: value === "" ? null : value, page: 1 } as never);
    },
    [setState],
  );

  const setFilters = useCallback(
    (next: Record<string, string>) => {
      const patch: Record<string, string | null> = { page: "1" };
      for (const [key, value] of Object.entries(next)) patch[key] = value === "" ? null : value;
      void setState(patch as never);
    },
    [setState],
  );

  const clearFilters = useCallback(() => {
    const patch: Record<string, string | null> = { page: "1" };
    for (const def of defs) patch[def.id] = null;
    void setState(patch as never);
  }, [defs, setState]);

  const setSort = useCallback(
    (sort: SortState) => {
      void setState({ sort: sort.field, order: sort.direction, page: "1" } as never);
    },
    [setState],
  );

  const setPage = useCallback(
    (page: number) => {
      void setState({ page: String(Math.max(1, page)) } as never);
    },
    [setState],
  );

  const setPageSize = useCallback(
    (size: number) => {
      const safe = PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0]!;
      void setState({ pageSize: String(safe), page: "1" } as never);
    },
    [setState],
  );

  const sort = useMemo<SortState>(
    () => ({
      field: String(raw.sort ?? defaults.sort.field),
      direction: raw.order === "desc" ? "desc" : "asc",
    }),
    [raw.sort, raw.order, defaults.sort.field],
  );

  const page = useMemo<PageState>(
    () => ({ page: Math.max(1, Number(raw.page ?? 1)), pageSize }),
    [raw.page, pageSize],
  );

  return {
    filters,
    sort,
    page,
    setFilter,
    setFilters,
    clearFilters,
    setSort,
    setPage,
    setPageSize,
    queryParams: toQueryParams(defs, filters, sort, page),
    activeCount: defs.filter((def) => {
      const value = filters[def.id];
      if (value === undefined || value === "") return false;
      if (def.type === "select") return value !== (def.allValue ?? "All");
      if (def.type === "subPopulation") return value !== "all";
      return true;
    }).length,
  };
}
