import { useQuery } from "@tanstack/react-query";
import { Database, Info, TrendingUp, TrendingDown, Minus, HelpCircle } from "lucide-react";
import { getServiceSummary } from "@/lib/api";
import { useFyFilter } from "@/context/FyFilterContext";
import GlowCard from "@/components/aceternity/GlowCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
}

interface Stat { key: string; label: string; tooltip?: string; format?: (n: number) => string }

// Strictly the values that are NOT already shown in KPICards / Action Queue / DQ
// insights — keeps the strip focused on "DB-canonical totals + this month".
const STATS_BY_TYPE: Record<Props["type"], Stat[]> = {
  vca: [
    {
      key: "enrolled",
      label: "VCAs ever enrolled",
      tooltip:
        "Cumulative total of every VCA ever enrolled into the programme — active, exited, graduated, and transferred. This is the all-time number.\n\nThe VCA card on the Home page shows the same all-time enrolment number for the current district scope, so the two should match. If they look different, check the District filter at the top of each page.",
    },
    {
      key: "active",
      label: "Active VCAs",
      tooltip:
        "VCAs whose case is currently open (case_status = 'Active'). Excludes exited, graduated, and transferred cases. The difference between 'VCAs ever enrolled' and 'Active VCAs' is the count of closed cases.\n\nThe Home page VCA card shows the cumulative enrolment number; this card shows the currently-open subset.",
    },
  ],
  caregiver: [
    {
      key: "enrolled",
      label: "Caregivers ever enrolled",
      tooltip:
        "Cumulative count of caregivers (one per household) ever enrolled — including exited and graduated households. The Home page Caregivers card shows the same lifetime number for the current district scope.",
    },
    {
      key: "active",
      label: "Active caregivers",
      tooltip:
        "Caregivers in households whose case is currently open. Excludes exited, graduated, and transferred. 'Ever enrolled' minus 'Active' = closed cases.\n\nThe Home page card shows ever-enrolled; this card shows the currently-open subset.",
    },
  ],
  household: [
    {
      key: "enrolled",
      label: "Households ever enrolled",
      tooltip:
        "Cumulative total of every household ever enrolled — including those that have since exited, graduated, or been transferred. Use this for lifetime reach. The Home page Households card shows the same lifetime number.",
    },
    {
      key: "active",
      label: "Active households",
      tooltip:
        "Households whose case is currently open (case_status = 'Active'). Excludes exited, graduated, and transferred. 'Ever enrolled' minus 'Active' = households closed since enrolment.\n\nThe Home page card shows ever-enrolled; this card shows the currently-open subset.",
    },
  ],
};

const TrendBadge = ({ pct }: { pct: number }) => {
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const cls = pct > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : pct < 0 ? "text-rose-600 bg-rose-50 border-rose-200" : "text-slate-500 bg-slate-50 border-slate-200";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn("text-[10px] gap-1 cursor-help", cls)}>
          <Icon className="h-3 w-3" /> {pct > 0 ? "+" : ""}{pct}% vs last month
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        Month-over-month change: how this month's services compare to last calendar month so far.
      </TooltipContent>
    </Tooltip>
  );
};

const CanonicalKpiStrip = ({ type, district, facility }: Props) => {
  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["service-summary", type, district, facility, fyKey],
    queryFn: () => getServiceSummary({ type, district, facility, fy: fyArg }),
    staleTime: 5 * 60 * 1000,
  });

  if (isError) return null;
  const stats = STATS_BY_TYPE[type];
  const d = data?.data ?? {};
  const trend = Number(d.mom_trend_pct ?? 0);

  return (
    <TooltipProvider delayDuration={150}>
    <GlowCard className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-primary" />
            Headline numbers
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 cursor-help">
                  <Info className="h-3 w-3" /> Live database
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                Numbers pulled live from the same database that powers the Home page and Superset dashboards. Refreshed every time you open this page.
              </TooltipContent>
            </Tooltip>
            {!isLoading && data?.data && <TrendBadge pct={trend} />}
          </CardTitle>
          {data?.generated_at && (
            <span className="text-[10px] text-slate-400">
              {new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="py-4 flex items-center justify-center"><LoadingDots className="text-slate-400" /></div>
        ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {stats.map((s) => (
                <div key={s.key} className="rounded-md border border-slate-100 bg-slate-50/30 p-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="truncate" title={s.label}>{s.label}</span>
                    {s.tooltip && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="shrink-0 text-slate-400 hover:text-slate-600" aria-label={`What is ${s.label}?`}>
                            <HelpCircle className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                          {s.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-slate-800">
                    {(s.format ?? ((n) => n.toLocaleString()))(Number(d[s.key] ?? 0))}
                  </div>
                </div>
              ))}
            </div>
        )}
      </CardContent>
    </GlowCard>
    </TooltipProvider>
  );
};

export default CanonicalKpiStrip;
