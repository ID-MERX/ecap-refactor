import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { getServiceSummary } from "@/lib/api";
import { useFyFilter } from "@/context/FyFilterContext";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
}

const COHORTS_BY_TYPE: Record<Props["type"], { key: string; label: string; tone: string; tooltip: string }[]> = {
  vca: [
    { key: "clhiv",  label: "CLHIV",  tone: "bg-rose-50 text-rose-700 border-rose-200",        tooltip: "Children Living with HIV — VCAs with a positive HIV status on file." },
    { key: "cwlhiv", label: "CWLHIV", tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", tooltip: "Children/Caregivers Whose Mother is Living with HIV — VCAs whose caregiver has HIV+." },
    { key: "hei",    label: "HEI",    tone: "bg-amber-50 text-amber-700 border-amber-200",      tooltip: "HIV-Exposed Infant — children under 24 months born to an HIV+ mother and not yet final-tested." },
    { key: "active_this_month", label: "Received a service this month", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", tooltip: "VCAs who had at least one service event recorded in the current calendar month." },
    { key: "stale_90d", label: "No service in 90+ days", tone: "bg-slate-50 text-slate-700 border-slate-200", tooltip: "VCAs whose most recent service is older than 90 days — likely overdue for follow-up." },
  ],
  caregiver: [
    { key: "cwlhiv",   label: "Living with HIV",   tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", tooltip: "Caregivers with a positive HIV status on file." },
    { key: "pregnant", label: "Pregnant",          tone: "bg-rose-50 text-rose-700 border-rose-200",          tooltip: "Caregivers currently flagged as pregnant in their most recent assessment." },
  ],
  household: [
    { key: "screened",   label: "Screened for vulnerabilities",   tone: "bg-emerald-50 text-emerald-700 border-emerald-200", tooltip: "Households that have completed at least one vulnerability assessment." },
    { key: "unscreened", label: "Not yet screened",                tone: "bg-amber-50 text-amber-700 border-amber-200",       tooltip: "Enrolled households with no vulnerability assessment recorded yet — pending screening." },
  ],
};

const CohortStrip = ({ type, district, facility }: Props) => {
  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["service-summary", type, district, facility, fyKey],
    queryFn: () => getServiceSummary({ type, district, facility, fy: fyArg }),
    staleTime: 5 * 60 * 1000,
  });

  if (isError) return null;
  const cohorts = COHORTS_BY_TYPE[type];
  const d = data?.data ?? {};

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Users className="h-3.5 w-3.5" /> Population breakdown
        </span>
        {isLoading ? (
          <div className="flex gap-2">
            {cohorts.map((c) => (
              <div key={c.key} className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
            ))}
          </div>
        ) : (
          cohorts.map((c) => (
            <Tooltip key={c.key}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={cn("gap-1.5 px-2.5 py-1 text-xs font-medium cursor-help", c.tone)}
                >
                  {c.label}
                  <span className="font-mono font-bold">{Number(d[c.key] ?? 0).toLocaleString()}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {c.tooltip}
              </TooltipContent>
            </Tooltip>
          ))
        )}
      </div>
    </TooltipProvider>
  );
};

export default CohortStrip;
