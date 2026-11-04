/**
 * The single implementation of "does this row pass the filters?".
 *
 * Used by the client-mode table, the record count, and the export. Server mode does not use it — the
 * backend filters — but its `toQueryParams` output is what server mode sends, so both modes agree on
 * what a filter *means* even though only one of them evaluates it.
 */

import { subPopulationDataKey, type SubPopulationKey } from "@/config";
import { normalizeDistrict, normalizeText, toBoolean } from "@/core/lib/values";

import type { FilterDef, FilterState, FilterValue } from "./types";

/** `all` / empty / absent all mean "this filter is not constraining anything". */
export function isFilterActive(def: FilterDef, state: FilterState): boolean {
  const raw = state[def.id];
  if (raw === undefined || raw === "") return false;
  if (def.type === "select") return raw !== (def.allValue ?? "All");
  if (def.type === "subPopulation") return raw !== "all";
  return true;
}

function textMatches(
  row: Record<string, unknown>,
  fields: ReadonlyArray<string>,
  query: string,
): boolean {
  const needle = query.toLowerCase();
  return fields.some((field) => {
    const value = row[field];
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(needle);
  });
}

function matches(def: FilterDef, value: FilterValue, row: Record<string, unknown>): boolean {
  switch (value.kind) {
    case "text": {
      const needle = value.value.trim();
      if (needle === "") return true;
      if (def.type === "text" && def.predicate) return def.predicate(row, needle);
      const fields = def.type === "text" ? (def.fields ?? []) : [];
      return textMatches(row, fields, needle);
    }

    case "select": {
      if (value.value === "" || value.value === "All") return true;
      if (def.type !== "select") return true;
      if (def.compare) return def.compare(row[def.field], value.value);
      // Default: district-aware, because that is the overwhelmingly common select and the legacy
      // comparison was case- and whitespace-sensitive in a way that silently dropped rows.
      return normalizeDistrict(row[def.field]) === normalizeDistrict(value.value);
    }

    case "multiSelect": {
      if (value.value.length === 0) return true;
      if (def.type !== "multiSelect") return true;
      if (def.compare) return def.compare(row[def.field], value.value);
      const rowValue = normalizeDistrict(row[def.field]);
      return value.value.some((candidate) => normalizeDistrict(candidate) === rowValue);
    }

    case "boolean": {
      if (value.value === null) return true;
      if (def.type !== "boolean") return true;
      return toBoolean(row[def.field]) === value.value;
    }

    case "dateRange": {
      const raw = row[def.type === "dateRange" ? def.field : ""];
      const text = normalizeText(raw);
      if (text === null) return value.from === null && value.to === null;
      // ISO strings compare correctly as text; anything else is ambiguous and is left to the server.
      const day = text.slice(0, 10);
      if (value.from !== null && day < value.from) return false;
      if (value.to !== null && day > value.to) return false;
      return true;
    }

    case "subPopulation": {
      if (value.value === "all") return true;
      if (def.type !== "subPopulation") return true;
      const column = subPopulationDataKey(def.key);
      const actual = toBoolean(row[column]);
      // An unrecognised value is *neither* yes nor no. Folding it into "no" is what made the legacy
      // registers overstate their negatives.
      return value.value === "yes" ? actual === true : actual === false;
    }
  }
}

/** Parse URL state into typed filter values, given the definitions. */
export function parseFilterState(
  defs: ReadonlyArray<FilterDef>,
  state: FilterState,
): ReadonlyArray<{ def: FilterDef; value: FilterValue }> {
  return defs.map((def) => {
    const raw = state[def.id] ?? "";

    switch (def.type) {
      case "multiSelect":
        return {
          def,
          value: { kind: "multiSelect", value: raw === "" ? [] : raw.split(",").filter(Boolean) },
        } satisfies { def: FilterDef; value: FilterValue };

      case "boolean":
        return {
          def,
          value: { kind: "boolean", value: raw === "" ? null : raw === "true" },
        } satisfies { def: FilterDef; value: FilterValue };

      case "dateRange": {
        const [from = "", to = ""] = raw.split("..");
        return {
          def,
          value: { kind: "dateRange", from: from || null, to: to || null },
        } satisfies { def: FilterDef; value: FilterValue };
      }

      case "subPopulation":
        return {
          def,
          value: { kind: "subPopulation", value: raw === "yes" || raw === "no" ? raw : "all" },
        } satisfies { def: FilterDef; value: FilterValue };

      default:
        return {
          def,
          value: { kind: def.type, value: raw },
        } as { def: FilterDef; value: FilterValue };
    }
  });
}

/** The rows that pass every active filter. Filters are ANDed — the legacy registers did the same. */
export function applyFilters<T extends Record<string, unknown>>(
  rows: ReadonlyArray<T>,
  defs: ReadonlyArray<FilterDef>,
  state: FilterState,
): ReadonlyArray<T> {
  const active = parseFilterState(defs, state).filter(({ def }) => isFilterActive(def, state));
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every(({ def, value }) => matches(def, value, row)));
}

/** How many things the user has switched on. Drives the "Clear (3)" badge. */
export function countActiveFilters(defs: ReadonlyArray<FilterDef>, state: FilterState): number {
  return defs.filter((def) => isFilterActive(def, state)).length;
}

/**
 * Filter state → query parameters, for server-side filtering.
 *
 * This is the contract for backend ask #8. It is a pure function so the front end is ready the day the
 * endpoints accept it, and so the same meaning is used in both modes.
 */
export function toQueryParams(
  defs: ReadonlyArray<FilterDef>,
  state: FilterState,
  sort: { field: string; direction: "asc" | "desc" },
  page: { page: number; pageSize: number },
): Record<string, string> {
  const params: Record<string, string> = {
    sort: sort.field,
    order: sort.direction,
    page: String(page.page),
    pageSize: String(page.pageSize),
  };

  for (const def of defs) {
    if (!isFilterActive(def, state)) continue;
    const raw = state[def.id];
    if (raw === undefined) continue;

    if (def.type === "subPopulation") {
      // The backend filters sub-populations by column, and the column is not always the key.
      params[subPopulationDataKey(def.key)] = raw === "yes" ? "true" : "false";
    } else if (def.type === "dateRange") {
      const [from = "", to = ""] = raw.split("..");
      if (from) params.from = from;
      if (to) params.to = to;
    } else {
      params[def.id] = raw;
    }
  }

  return params;
}

/** The sub-population keys a set of defs covers — used to build the filter chips. */
export function subPopulationFilters(
  defs: ReadonlyArray<FilterDef>,
): ReadonlyArray<Extract<FilterDef, { type: "subPopulation" }>> {
  return defs.filter(
    (def): def is Extract<FilterDef, { type: "subPopulation" }> => def.type === "subPopulation",
  );
}

export type { SubPopulationKey };
