import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { getActionQueue, type ActionItem } from "@/lib/api";
import GlowCard from "@/components/aceternity/GlowCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { cn } from "@/lib/utils";

interface Props {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
  onAction?: (item: ActionItem) => void;
}

const SEVERITY_STYLES: Record<ActionItem["severity"], { card: string; count: string; badge: string; icon: string }> = {
  red:    { card: "border-rose-100 bg-rose-50/40 hover:bg-rose-50",      count: "text-rose-700",    badge: "bg-rose-100 text-rose-700 border-rose-200",    icon: "text-rose-500" },
  orange: { card: "border-amber-100 bg-amber-50/40 hover:bg-amber-50",  count: "text-amber-700",   badge: "bg-amber-100 text-amber-700 border-amber-200", icon: "text-amber-500" },
  yellow: { card: "border-yellow-100 bg-yellow-50/40 hover:bg-yellow-50", count: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: "text-yellow-500" },
  slate:  { card: "border-slate-100 bg-slate-50/40 hover:bg-slate-50",   count: "text-slate-600",   badge: "bg-slate-100 text-slate-600 border-slate-200",   icon: "text-emerald-500" },
};

const ActionQueueBanner = ({ type, district, facility, onAction }: Props) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["action-queue", type, district, facility],
    queryFn: () => getActionQueue({ type, district, facility }),
    staleTime: 5 * 60 * 1000,
  });

  if (isError) return null;

  const items = data?.data ?? [];
  const totalCount = items.reduce((sum, i) => sum + i.count, 0);
  const allClear = !isLoading && totalCount === 0;

  return (
    <GlowCard className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-primary" />
            Action Queue
            {!isLoading && (
              <Badge variant="outline" className={cn("ml-1 text-[10px]", allClear ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                {allClear ? "All clear" : `${totalCount.toLocaleString()} item${totalCount === 1 ? "" : "s"} need attention`}
              </Badge>
            )}
          </CardTitle>
          {data?.generated_at && (
            <span className="text-[10px] text-slate-400">
              Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center"><LoadingDots className="text-slate-400" /></div>
        ) : allClear ? (
          <div className="py-4 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            No pending actions for the current filter. Nice work.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => {
              const s = SEVERITY_STYLES[item.severity];
              const clickable = item.count > 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => clickable && onAction?.(item)}
                  disabled={!clickable}
                  className={cn(
                    "text-left rounded-lg border p-3 transition-colors",
                    s.card,
                    clickable ? "cursor-pointer" : "cursor-default opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {item.count > 0 ? <AlertTriangle className={cn("h-3.5 w-3.5", s.icon)} /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{item.label}</span>
                      </div>
                      <div className={cn("font-mono text-2xl font-bold", s.count)}>{item.count.toLocaleString()}</div>
                      <p className="mt-1 text-[11px] text-slate-500 leading-snug">{item.description}</p>
                    </div>
                    {clickable && <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </GlowCard>
  );
};

export default ActionQueueBanner;
