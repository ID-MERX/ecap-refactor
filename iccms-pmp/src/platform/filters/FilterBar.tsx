/**
 * The filter bar: a search box, one control per declared filter, "active" chips and a clear button.
 *
 * Driven entirely by `FilterDef[]`, so a module declares its filters once and gets the control, the URL
 * state, the chips and the export selection. The legacy registers hard-coded a district select, a
 * sub-population grid and a search input separately on each page, which is why "Clear" reset the search
 * but not the district.
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { subPopulations } from "@/config";

import type { FilterDef, FilterState } from "./types";

type Props = {
  defs: ReadonlyArray<FilterDef>;
  state: FilterState;
  onFilterChange: (id: string, value: string) => void;
  onClear: () => void;
  activeCount: number;
  /** Options derived from the loaded data, per filter id, when the def has none. */
  dynamicOptions?: Record<string, ReadonlyArray<string>>;
  /** Extra controls rendered on the right (export button, etc.). */
  children?: ReactNode;
};

const ALL = "All";

function labelFor(def: FilterDef): string {
  if (def.type !== "subPopulation") return def.label;
  return subPopulations.find((sp) => sp.key === def.key)?.label ?? def.key;
}

export function FilterBar({
  defs,
  state,
  onFilterChange,
  onClear,
  activeCount,
  dynamicOptions,
  children,
}: Props): ReactNode {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        {defs.map((def) => {
          const value = state[def.id] ?? "";

          if (def.type === "text") {
            return (
              <input
                key={def.id}
                type="search"
                value={value}
                placeholder={def.placeholder ?? `Search ${def.label.toLowerCase()}…`}
                aria-label={def.label}
                onChange={(event) => onFilterChange(def.id, event.target.value)}
                className="min-w-56 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            );
          }

          if (def.type === "select") {
            const options =
              def.options?.map((option) => option.value) ?? dynamicOptions?.[def.id] ?? [];
            return (
              <label key={def.id} className="flex items-center gap-1.5 text-sm">
                <span className="sr-only">{def.label}</span>
                <select
                  value={value === "" ? (def.allValue ?? ALL) : value}
                  onChange={(event) => onFilterChange(def.id, event.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5"
                >
                  <option value={def.allValue ?? ALL}>{def.allLabel ?? "All"}</option>
                  {options
                    .filter((option) => option !== (def.allValue ?? ALL))
                    .map((option) => (
                      <option key={option} value={option}>
                        {def.options?.find((o) => o.value === option)?.label ?? option}
                      </option>
                    ))}
                </select>
              </label>
            );
          }

          return null;
        })}

        <button
          type="button"
          onClick={onClear}
          disabled={activeCount === 0}
          className="ml-auto flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
        >
          Clear
          {activeCount > 0 ? (
            <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">
              {activeCount}
            </span>
          ) : null}
        </button>

        {children}
      </div>

      <SubPopulationGrid defs={defs} state={state} onFilterChange={onFilterChange} />

      <ActiveChips defs={defs} state={state} onFilterChange={onFilterChange} />
    </div>
  );
}

/** The three-way `all | yes | no` toggles per sub-population. */
function SubPopulationGrid({
  defs,
  state,
  onFilterChange,
}: {
  defs: ReadonlyArray<FilterDef>;
  state: FilterState;
  onFilterChange: Props["onFilterChange"];
}): ReactNode {
  const subDefs = defs.filter((def) => def.type === "subPopulation");
  if (subDefs.length === 0) return null;

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Sub-population
      </h3>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {subDefs.map((def) => {
          const value = state[def.id] === "yes" || state[def.id] === "no" ? state[def.id] : "all";
          return (
            <div key={def.id} className="flex items-center gap-1">
              <span className="w-24 text-xs text-slate-600">{labelFor(def)}</span>
              {(["all", "yes", "no"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onFilterChange(def.id, option)}
                  aria-pressed={value === option}
                  className={`rounded px-1.5 py-0.5 text-[11px] uppercase ${
                    value === option
                      ? option === "yes"
                        ? "bg-emerald-600 text-white"
                        : option === "no"
                          ? "bg-red-600 text-white"
                          : "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One chip per active filter; each clears only itself. */
function ActiveChips({
  defs,
  state,
  onFilterChange,
}: {
  defs: ReadonlyArray<FilterDef>;
  state: FilterState;
  onFilterChange: Props["onFilterChange"];
}): ReactNode {
  const active = defs.filter((def) => {
    const value = state[def.id];
    if (value === undefined || value === "") return false;
    if (def.type === "select") return value !== (def.allValue ?? ALL);
    if (def.type === "subPopulation") return value !== "all";
    return true;
  });

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
      <span className="text-xs font-medium text-slate-500">Active</span>
      {active.map((def) => {
        const value = state[def.id] ?? "";
        const resetValue =
          def.type === "subPopulation" ? "all" : def.type === "select" ? (def.allValue ?? ALL) : "";
        return (
          <button
            key={def.id}
            type="button"
            onClick={() => onFilterChange(def.id, resetValue)}
            className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
          >
            {labelFor(def)}: {def.type === "text" ? `"${value}"` : value}
            <X className="size-3" />
          </button>
        );
      })}
    </div>
  );
}
