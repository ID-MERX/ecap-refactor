import { cn } from "@/lib/utils";

interface SubPopulationFilterProps {
  filters: Record<string, string>;
  labels: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear?: () => void;
  className?: string;
}

export const SubPopulationFilter = ({
  filters,
  labels,
  onChange,
  className,
}: SubPopulationFilterProps) => {
  return (
    <div className={cn("rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-3", className)}>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        Sub-population
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Object.entries(labels).map(([key, label]) => {
          const value = filters[key] ?? "all";
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-100"
            >
              <span
                className="text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate"
                title={label}
              >
                {label}
              </span>
              <div className="flex shrink-0 rounded-md bg-slate-100 p-0.5">
                {(["all", "yes", "no"] as const).map((option) => {
                  const isActive = value === option;
                  const cls = isActive
                    ? option === "yes"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : option === "no"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "bg-white text-slate-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800";
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onChange(key, option)}
                      className={cn(
                        "px-2 py-1 text-[10px] uppercase tracking-wide font-bold rounded transition-colors",
                        cls,
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
