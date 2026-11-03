import { useMemo, useState } from "react";
import { Building2, X, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Parses the CSV string stored on Directus user.facility into a string[].
// Whitespace-tolerant; drops empties.
export const parseFacilitiesCsv = (raw: string | undefined | null): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

export const serializeFacilitiesCsv = (list: string[]): string => {
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean))).join(", ");
};

type Props = {
  options: string[];                  // full facility list
  value: string;                      // CSV string from form state
  onChange: (csv: string) => void;    // emits CSV back to form
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

const MultiFacilityPicker = ({ options, value, onChange, loading, disabled, placeholder }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(() => parseFacilitiesCsv(value), [value]);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (name: string) => {
    const next = selected.includes(name)
      ? selected.filter((s) => s !== name)
      : [...selected, name];
    onChange(serializeFacilitiesCsv(next));
  };

  const remove = (name: string) => {
    onChange(serializeFacilitiesCsv(selected.filter((s) => s !== name)));
  };

  const clearAll = () => onChange("");

  return (
    <div className="space-y-2">
      {/* Selected chips + trigger */}
      <div
        className={cn(
          "min-h-[44px] rounded-md border border-slate-200 bg-white/80 backdrop-blur-md px-2 py-1.5 transition-colors",
          "focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-500/20",
          disabled && "opacity-50",
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.length === 0 ? (
            <button
              type="button"
              onClick={() => !disabled && setOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-1 py-1 text-left text-sm text-slate-500"
            >
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{loading ? "Loading facilities…" : placeholder ?? "Select one or more facilities"}</span>
            </button>
          ) : (
            <>
              {selected.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/60"
                >
                  <Building2 className="h-3 w-3" />
                  {name}
                  <button
                    type="button"
                    onClick={() => !disabled && remove(name)}
                    className="ml-1 rounded-full text-emerald-700 hover:bg-emerald-200/80"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => !disabled && setOpen((v) => !v)}
                className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
              >
                + Add more
              </button>
              <button
                type="button"
                onClick={() => !disabled && clearAll()}
                className="ml-auto inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dropdown panel */}
      {open && !disabled && (
        <div className="rounded-md border border-emerald-100/70 bg-white/95 backdrop-blur-xl shadow-lg">
          <div className="relative border-b border-slate-100 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search facilities…"
              className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
              autoFocus
            />
          </div>
          <ul className="max-h-[220px] overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-2 text-xs text-slate-500">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500">No matches</li>
            ) : (
              filtered.map((name) => {
                const isSelected = selected.includes(name);
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors",
                        isSelected
                          ? "bg-emerald-50/80 text-emerald-800 font-semibold"
                          : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span className="truncate">{name}</span>
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5">
            <span className="text-[10px] text-slate-500">
              {selected.length} selected
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiFacilityPicker;
