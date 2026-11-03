import { useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, Check, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFyFilter } from "@/context/FyFilterContext";
import { getCurrentFy, getFyOptions, type FyState } from "@/lib/fiscalYear";

const toIso = (d: Date | undefined) => (d ? format(d, "yyyy-MM-dd") : "");
const fromIso = (s: string | undefined) => {
  if (!s) return undefined;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const FyFilter = () => {
  const { state, setState, clearFilter, resolved } = useFyFilter();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(state.mode === "custom");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(fromIso(state.from));
  const [customTo, setCustomTo] = useState<Date | undefined>(fromIso(state.to));

  const currentFy = getCurrentFy();
  const previousFy = currentFy - 1;
  const fyOptions = getFyOptions(3);

  const pick = (next: FyState) => {
    setState(next);
    setOpen(false);
    setShowCustom(false);
  };

  const onClear = () => {
    clearFilter();
    setShowCustom(false);
    setCustomFrom(undefined);
    setCustomTo(undefined);
    setOpen(false);
  };

  // Hide the Clear button when the filter is already at default (mode=all
  // AND no URL params) — nothing to clear in that state.
  const hasActiveFilter = resolved.mode !== "all" ||
    (typeof window !== "undefined" && /[?&](fy|from|to)=/.test(window.location.search));

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    setState({ mode: "custom", from: toIso(customFrom), to: toIso(customTo) });
    setOpen(false);
  };

  const isActive = (predicate: boolean) =>
    predicate ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-700 hover:bg-slate-50";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
        >
          <CalendarIcon className="h-3.5 w-3.5 text-emerald-600" />
          <span>{resolved.label}</span>
          <ChevronDown className={cn("h-3 w-3 text-slate-400 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-[100] w-[20rem] rounded-xl border border-emerald-100/70 bg-white/95 p-1 shadow-xl backdrop-blur-xl"
      >
        {hasActiveFilter && (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Active: {resolved.label}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 transition-colors hover:bg-rose-100"
            >
              <X className="h-3 w-3" />
              Clear filter
            </button>
          </div>
        )}
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick toggle</div>
        <button
          type="button"
          onClick={() => pick({ mode: "fy", fy: currentFy })}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors",
            isActive(resolved.mode === "fy" && resolved.fy === currentFy),
          )}
        >
          <span>Current FY (FY{currentFy})</span>
          {resolved.mode === "fy" && resolved.fy === currentFy && <Check className="h-3.5 w-3.5 text-emerald-600" />}
        </button>
        <button
          type="button"
          onClick={() => pick({ mode: "fy", fy: previousFy })}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors",
            isActive(resolved.mode === "fy" && resolved.fy === previousFy),
          )}
        >
          <span>Previous FY (FY{previousFy})</span>
          {resolved.mode === "fy" && resolved.fy === previousFy && <Check className="h-3.5 w-3.5 text-emerald-600" />}
        </button>

        <div className="my-1 border-t border-slate-100" />
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">All fiscal years</div>
        {fyOptions.map((fy) => (
          <button
            key={fy}
            type="button"
            onClick={() => pick({ mode: "fy", fy })}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors",
              isActive(resolved.mode === "fy" && resolved.fy === fy),
            )}
          >
            <span>
              FY{fy} <span className="ml-1 text-slate-400">{fy - 1}-10-01 → {fy}-09-30</span>
            </span>
            {resolved.mode === "fy" && resolved.fy === fy && <Check className="h-3.5 w-3.5 text-emerald-600" />}
          </button>
        ))}

        <div className="my-1 border-t border-slate-100" />
        <button
          type="button"
          onClick={() => pick({ mode: "all" })}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors",
            isActive(resolved.mode === "all"),
          )}
        >
          <span>All time</span>
          {resolved.mode === "all" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
        </button>

        <div className="my-1 border-t border-slate-100" />
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-slate-400" /> Custom range
          </span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", showCustom && "rotate-180")} />
        </button>
        {showCustom && (
          <div className="px-3 py-2 space-y-2">
            <DateField label="From" value={customFrom} onChange={setCustomFrom} />
            <DateField label="To" value={customTo} onChange={setCustomTo} minDate={customFrom} />
            <button
              type="button"
              onClick={applyCustom}
              disabled={!customFrom || !customTo}
              className="w-full rounded-md bg-gradient-to-r from-emerald-600 to-teal-600 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition-opacity disabled:opacity-40"
            >
              Apply custom range
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Aceternity-styled inline date field (shadcn Calendar in a Popover)
// ─────────────────────────────────────────────────────────────────────
const DateField = ({
  label,
  value,
  onChange,
  minDate,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  minDate?: Date;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "mt-1 flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-left",
              "transition-all hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300",
              !value && "text-slate-400",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-emerald-600" />
              {value ? format(value, "dd MMM yyyy") : "Pick a date"}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[110] w-auto rounded-xl border border-emerald-100/70 bg-white/95 p-0 shadow-xl backdrop-blur-xl"
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d ?? undefined);
              if (d) setOpen(false);
            }}
            disabled={minDate ? { before: minDate } : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </label>
  );
};

export default FyFilter;
