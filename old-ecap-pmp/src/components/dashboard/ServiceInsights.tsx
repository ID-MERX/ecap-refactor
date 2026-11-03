import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import LoadingDots from "@/components/aceternity/LoadingDots";
import GlowCard from "@/components/aceternity/GlowCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  FileX,
  Copy,
  MapPinOff,
  CalendarX,
  TrendingUp,
  GraduationCap,
  Activity,
  Pill,
  UserX,
  Download,
  Search,
  ChevronRight,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightItem = {
  id: string;
  label: string;
  description: string;
  count: number;
  total: number;
  severity: "critical" | "warning" | "info" | "success";
  icon: React.ElementType;
  records: any[];
};

type ServiceInsightsProps = {
  insights: InsightItem[];
  title?: string;
  isLoading?: boolean;
};

// ─── Severity config ──────────────────────────────────────────────────────────

const severityConfig = {
  critical: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    icon: "text-rose-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: "text-amber-500",
  },
  info: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: "text-emerald-500",
  },
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: "text-emerald-500",
  },
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

const exportToCSV = (records: any[], filename: string) => {
  if (records.length === 0) return;
  const headers = Object.keys(records[0]);
  const csvRows = [
    headers.join(","),
    ...records.map(r =>
      headers.map(h => {
        const val = r[h];
        const str = val === null || val === undefined ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ─── Records Dialog ───────────────────────────────────────────────────────────

const InsightRecordsDialog = ({
  insight,
  open,
  onClose,
}: {
  insight: InsightItem | null;
  open: boolean;
  onClose: () => void;
}) => {
  const [search, setSearch] = useState("");

  const columns = useMemo(() => {
    if (!insight || insight.records.length === 0) return [];
    return Object.keys(insight.records[0]).slice(0, 8);
  }, [insight]);

  const filtered = useMemo(() => {
    if (!insight) return [];
    if (!search) return insight.records;
    const q = search.toLowerCase();
    return insight.records.filter(r =>
      Object.values(r).some(v => String(v ?? "").toLowerCase().includes(q))
    );
  }, [insight, search]);

  if (!insight) return null;

  const config = severityConfig[insight.severity];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className={cn("p-6 border-b", config.bg, config.border)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <insight.icon className={cn("h-5 w-5", config.icon)} />
              <div>
                <DialogTitle className={cn("text-lg font-bold", config.text)}>
                  {insight.label}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">{insight.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px] font-black", config.badge)}>
                {insight.count.toLocaleString()} records
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search records..."
              className="pl-9 bg-white border-slate-200 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-slate-200 text-slate-600 hover:text-primary font-bold text-xs h-9"
            onClick={() => exportToCSV(insight.records, `insight_${insight.id}_${new Date().toISOString().slice(0, 10)}`)}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        <div className="overflow-auto max-h-[55vh]">
          <Table>
            <TableHeader className="bg-slate-50/80 sticky top-0">
              <TableRow>
                <TableHead className="font-black text-[10px] tracking-[0.15em] text-slate-400 w-10">#</TableHead>
                {columns.map(col => (
                  <TableHead key={col} className="font-black text-[10px] tracking-[0.15em] text-slate-400">
                    {col.replace(/_/g, " ")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="py-12 text-center text-slate-400 text-sm">
                    No matching records
                  </TableCell>
                </TableRow>
              ) : (
                filtered.slice(0, 200).map((record, idx) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50 text-sm">
                    <TableCell className="text-xs text-slate-400 font-mono">{idx + 1}</TableCell>
                    {columns.map(col => (
                      <TableCell key={col} className="text-xs text-slate-600 max-w-[200px] truncate">
                        {String(record[col] ?? "N/A")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filtered.length > 200 && (
            <div className="p-3 text-center text-xs text-slate-400 border-t">
              Showing 200 of {filtered.length.toLocaleString()} records. Export CSV to view all.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {filtered.length.toLocaleString()} of {insight.records.length.toLocaleString()} records shown
          </span>
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ServiceInsights = ({ insights, title = "Data quality & insights", isLoading }: ServiceInsightsProps) => {
  const [selectedInsight, setSelectedInsight] = useState<InsightItem | null>(null);

  const sortedInsights = useMemo(() => {
    const order = { critical: 0, warning: 1, info: 2, success: 3 };
    return [...insights].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [insights]);

  const criticalCount = insights.filter(i => i.severity === "critical" && i.count > 0).length;
  const warningCount = insights.filter(i => i.severity === "warning" && i.count > 0).length;

  if (isLoading) {
    return (
      <GlowCard>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingDots />
          </div>
        </CardContent>
      </GlowCard>
    );
  }

  return (
    <>
      <GlowCard>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg font-bold">{title}</CardTitle>
            </div>
            <div className="flex gap-2">
              {criticalCount > 0 && (
                <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px] font-black">
                  {criticalCount} critical
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black">
                  {warningCount} warnings
                </Badge>
              )}
              {criticalCount === 0 && warningCount === 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black">
                  All clear
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedInsights.map((insight) => {
              const config = severityConfig[insight.severity];
              const Icon = insight.icon;
              const percent = insight.total > 0 ? ((insight.count / insight.total) * 100).toFixed(1) : "0";
              const hasRecords = insight.records.length > 0;

              return (
                <div
                  key={insight.id}
                  onClick={() => hasRecords ? setSelectedInsight(insight) : undefined}
                  className={cn(
                    "rounded-xl border p-4 transition-all hover:shadow-md",
                    hasRecords && "cursor-pointer",
                    insight.count > 0 ? `${config.bg} ${config.border}` : "bg-slate-50/50 border-slate-200/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 shrink-0", insight.count > 0 ? config.icon : "text-slate-300")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-bold leading-tight",
                        insight.count > 0 ? config.text : "text-slate-400"
                      )}>
                        {insight.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                        {insight.description}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-lg font-black",
                            insight.count > 0 ? config.text : "text-slate-300"
                          )}>
                            {insight.count.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            / {insight.total.toLocaleString()} ({percent}%)
                          </span>
                        </div>
                        {hasRecords && (
                          <ChevronRight className={cn("h-4 w-4", insight.count > 0 ? config.icon : "text-slate-300")} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </GlowCard>

      <InsightRecordsDialog
        insight={selectedInsight}
        open={!!selectedInsight}
        onClose={() => setSelectedInsight(null)}
      />
    </>
  );
};

export default ServiceInsights;

// ─── Shared computation helpers ───────────────────────────────────────────────

const NOT_APPLICABLE = ["not applicable", "n/a", "na", "none", "no", "false", "0", "[]", "{}", "null", ""];

const isFieldEmpty = (val: any): boolean => {
  if (!val) return true;
  const s = String(val).trim().toLowerCase();
  return NOT_APPLICABLE.includes(s);
};

const isFieldProvided = (val: any): boolean => !isFieldEmpty(val);

const parseDate = (val: any): Date | null => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Find the latest service date in the dataset to use as reference point.
 */
const getLatestServiceDate = (services: any[]): Date => {
  let latest = new Date();
  services.forEach(s => {
    const d = parseDate(s.service_date);
    if (d && d > latest) latest = d;
  });
  return latest;
};

/**
 * Check if a record has ANY service across all fields (including other_* fields).
 */
const hasAnyService = (s: any): boolean => {
  const fields = [
    "health_services", "hiv_services", "schooled_services", "safe_services", "stable_services",
    "other_health_services", "other_hiv_services", "other_schooled_services", "other_safe_services", "other_stable_services",
    "hh_level_services", "other_hh_level_services",
  ];
  return fields.some(f => isFieldProvided(s[f]));
};

/**
 * Check if a domain is covered across all records (including other_* fields).
 */
const isDomainCovered = (records: any[], mainField: string, otherField: string): boolean => {
  return records.some(s => isFieldProvided(s[mainField]) || isFieldProvided(s[otherField]));
};

/**
 * Compute data quality and efficiency insights for Caregiver Services.
 */
export function computeCaregiverInsights(
  services: any[],
  filteredServices: any[],
  allHouseholds: any[],
  filteredHouseholds: any[],
): InsightItem[] {
  const now = new Date();
  const refDate = getLatestServiceDate(filteredServices);
  const sixMonthsBefore = new Date(refDate);
  sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);
  const threeMonthsBefore = new Date(refDate);
  threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);

  const total = filteredServices.length;
  const totalHH = filteredHouseholds.length;

  // Group services by household
  const hhServiceMap = new Map<string, any[]>();
  filteredServices.forEach(s => {
    const id = String(s.household_id || "");
    if (!hhServiceMap.has(id)) hhServiceMap.set(id, []);
    hhServiceMap.get(id)!.push(s);
  });

  // 1. HIV+ without VL — unique per household
  const hivPositive = filteredServices.filter(s => s.is_hiv_positive === "1" || s.is_hiv_positive === true);
  const hivNoVl = hivPositive.filter(s => isFieldEmpty(s.date_last_vl) || isFieldEmpty(s.vl_last_result));

  // 2. Stale VL — compared to latest service date in dataset, not today
  const staleVl = hivPositive.filter(s => {
    const d = parseDate(s.date_last_vl);
    return d && d < sixMonthsBefore;
  });

  // 3. Incomplete coverage — per household across ALL their visits (not per record)
  const incompleteCoverageRecords: any[] = [];
  hhServiceMap.forEach((svcs, hhId) => {
    const hasHealth = isDomainCovered(svcs, "health_services", "other_health_services");
    const hasSchooled = isDomainCovered(svcs, "schooled_services", "other_schooled_services");
    const hasSafe = isDomainCovered(svcs, "safe_services", "other_safe_services");
    const hasStable = isDomainCovered(svcs, "stable_services", "other_stable_services");
    if (!hasHealth || !hasSchooled || !hasSafe || !hasStable) {
      incompleteCoverageRecords.push({ household_id: hhId, health: hasHealth ? "Yes" : "Missing", schooled: hasSchooled ? "Yes" : "Missing", safe: hasSafe ? "Yes" : "Missing", stable: hasStable ? "Yes" : "Missing", total_visits: svcs.length });
    }
  });

  // 4. Duplicate entries
  const seen = new Set<string>();
  const dupeRecords: any[] = [];
  filteredServices.forEach(s => {
    const key = `${s.household_id}|${s.service_date}|${s.health_services}`;
    if (seen.has(key)) dupeRecords.push(s);
    else seen.add(key);
  });

  // 5. Empty records — check ALL service fields including other_*
  const emptyRecords = filteredServices.filter(s => !hasAnyService(s));

  // 6. Missing district
  const noDistrict = filteredServices.filter(s => isFieldEmpty(s.district));

  // 7. Future-dated (compared to today — this is always valid)
  const futureDated = filteredServices.filter(s => {
    const d = parseDate(s.service_date);
    return d && d > now;
  });

  // 10. Graduation pipeline — households with exactly 3 of 4 domains
  const almostReadyRecords: any[] = [];
  hhServiceMap.forEach((svcs, hhId) => {
    let domains = 0;
    if (isDomainCovered(svcs, "health_services", "other_health_services")) domains++;
    if (isDomainCovered(svcs, "schooled_services", "other_schooled_services")) domains++;
    if (isDomainCovered(svcs, "safe_services", "other_safe_services")) domains++;
    if (isDomainCovered(svcs, "stable_services", "other_stable_services")) domains++;
    if (domains === 3) {
      const missingDomain = !isDomainCovered(svcs, "health_services", "other_health_services") ? "Health" :
        !isDomainCovered(svcs, "schooled_services", "other_schooled_services") ? "Schooled" :
        !isDomainCovered(svcs, "safe_services", "other_safe_services") ? "Safe" : "Stable";
      almostReadyRecords.push({ household_id: hhId, domains_covered: 3, missing_domain: missingDomain, total_visits: svcs.length });
    }
  });

  // 12. VL suppression rate
  const withVl = hivPositive.filter(s => isFieldProvided(s.vl_last_result));
  const suppressed = withVl.filter(s => {
    const val = String(s.vl_last_result).toLowerCase();
    return val.includes("suppress") || val.includes("undetect") || val === "ldl" ||
      (Number(s.vl_last_result) > 0 && Number(s.vl_last_result) < 1000);
  });

  // 14. Inactive clients — relative to latest date in dataset
  const lastServiceByHH = new Map<string, { date: Date; record: any }>();
  filteredServices.forEach(s => {
    const id = String(s.household_id || "");
    const d = parseDate(s.service_date);
    if (d) {
      const existing = lastServiceByHH.get(id);
      if (!existing || d > existing.date) lastServiceByHH.set(id, { date: d, record: s });
    }
  });
  const inactiveRecords: any[] = [];
  lastServiceByHH.forEach(({ date, record }) => { if (date < threeMonthsBefore) inactiveRecords.push(record); });

  return [
    { id: "hiv-no-vl", label: "HIV+ missing viral load", description: "Clients positive but no VL test recorded", count: hivNoVl.length, total: hivPositive.length || total, severity: hivNoVl.length > 0 ? "critical" : "success", icon: ShieldAlert, records: hivNoVl },
    { id: "stale-vl", label: "Overdue viral load tests", description: "Last VL older than 6 months from latest service", count: staleVl.length, total: hivPositive.length || total, severity: staleVl.length > 0 ? "critical" : "success", icon: Clock, records: staleVl },
    { id: "missing-domains", label: "Incomplete service coverage", description: "Households missing at least one domain across all visits", count: incompleteCoverageRecords.length, total: hhServiceMap.size, severity: incompleteCoverageRecords.length > 0 ? "warning" : "success", icon: AlertTriangle, records: incompleteCoverageRecords },
    { id: "duplicates", label: "Possible duplicate records", description: "Same household, date and services entered twice", count: dupeRecords.length, total, severity: dupeRecords.length > 0 ? "warning" : "success", icon: Copy, records: dupeRecords },
    { id: "empty-records", label: "Blank service records", description: "No service data in any field", count: emptyRecords.length, total, severity: emptyRecords.length > 0 ? "warning" : "success", icon: FileX, records: emptyRecords },
    { id: "no-district", label: "Records without district", description: "Missing district breaks geographic filtering", count: noDistrict.length, total, severity: noDistrict.length > 0 ? "warning" : "success", icon: MapPinOff, records: noDistrict },
    { id: "future-dated", label: "Future-dated records", description: "Service date is after today", count: futureDated.length, total, severity: futureDated.length > 0 ? "critical" : "success", icon: CalendarX, records: futureDated },
    { id: "almost-ready", label: "Almost graduation-ready", description: "Households with 3 of 4 domains — one more to go", count: almostReadyRecords.length, total: hhServiceMap.size, severity: almostReadyRecords.length > 0 ? "info" : "success", icon: GraduationCap, records: almostReadyRecords },
    { id: "vl-suppression", label: "Viral load suppressed", description: "HIV+ clients with suppressed viral load", count: suppressed.length, total: withVl.length || hivPositive.length, severity: suppressed.length > 0 ? "success" : "info", icon: Pill, records: suppressed },
    { id: "inactive", label: "Clients without recent services", description: "Last visit over 3 months before latest service in period", count: inactiveRecords.length, total: lastServiceByHH.size || totalHH, severity: inactiveRecords.length > 0 ? "warning" : "success", icon: UserX, records: inactiveRecords },
  ];
}

/**
 * Compute data quality insights for Household Services.
 */
export function computeHouseholdInsights(
  services: any[],
  filteredServices: any[],
  allHouseholds: any[],
  filteredHouseholds: any[],
): InsightItem[] {
  const now = new Date();
  const refDate = getLatestServiceDate(filteredServices);
  const threeMonthsBefore = new Date(refDate);
  threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);

  const total = filteredServices.length;
  const totalHH = filteredHouseholds.length;

  // Group by household
  const hhServiceMap = new Map<string, any[]>();
  filteredServices.forEach(s => {
    const id = String(s.household_id || "");
    if (!hhServiceMap.has(id)) hhServiceMap.set(id, []);
    hhServiceMap.get(id)!.push(s);
  });

  // 3. Incomplete coverage — per household across ALL visits
  const incompleteCoverageRecords: any[] = [];
  hhServiceMap.forEach((svcs, hhId) => {
    const hasHealth = isDomainCovered(svcs, "health_services", "other_health_services");
    const hasSchooled = isDomainCovered(svcs, "schooled_services", "other_schooled_services");
    const hasSafe = isDomainCovered(svcs, "safe_services", "other_safe_services");
    const hasStable = isDomainCovered(svcs, "stable_services", "other_stable_services");
    if (!hasHealth || !hasSchooled || !hasSafe || !hasStable) {
      incompleteCoverageRecords.push({ household_id: hhId, health: hasHealth ? "Yes" : "Missing", schooled: hasSchooled ? "Yes" : "Missing", safe: hasSafe ? "Yes" : "Missing", stable: hasStable ? "Yes" : "Missing", total_visits: svcs.length });
    }
  });

  // 4. Duplicates
  const seen = new Set<string>();
  const dupeRecords: any[] = [];
  filteredServices.forEach(s => {
    const key = `${s.household_id}|${s.service_date}|${s.health_services}`;
    if (seen.has(key)) dupeRecords.push(s);
    else seen.add(key);
  });

  // 5. Empty records — check ALL fields including other_*
  const emptyRecords = filteredServices.filter(s => !hasAnyService(s));

  // 6. Missing district
  const noDistrict = filteredServices.filter(s => isFieldEmpty(s.district));

  // 7. Future-dated
  const futureDated = filteredServices.filter(s => {
    const d = parseDate(s.service_date);
    return d && d > now;
  });

  // 10. Graduation pipeline
  const almostReadyRecords: any[] = [];
  hhServiceMap.forEach((svcs, hhId) => {
    let domains = 0;
    if (isDomainCovered(svcs, "health_services", "other_health_services")) domains++;
    if (isDomainCovered(svcs, "schooled_services", "other_schooled_services")) domains++;
    if (isDomainCovered(svcs, "safe_services", "other_safe_services")) domains++;
    if (isDomainCovered(svcs, "stable_services", "other_stable_services")) domains++;
    if (domains === 3) {
      const missingDomain = !isDomainCovered(svcs, "health_services", "other_health_services") ? "Health" :
        !isDomainCovered(svcs, "schooled_services", "other_schooled_services") ? "Schooled" :
        !isDomainCovered(svcs, "safe_services", "other_safe_services") ? "Safe" : "Stable";
      almostReadyRecords.push({ household_id: hhId, domains_covered: 3, missing_domain: missingDomain, total_visits: svcs.length });
    }
  });

  // 14. Inactive — relative to latest date in dataset
  const lastServiceByHH = new Map<string, { date: Date; record: any }>();
  filteredServices.forEach(s => {
    const id = String(s.household_id || "");
    const d = parseDate(s.service_date);
    if (d) {
      const existing = lastServiceByHH.get(id);
      if (!existing || d > existing.date) lastServiceByHH.set(id, { date: d, record: s });
    }
  });
  const inactiveRecords: any[] = [];
  lastServiceByHH.forEach(({ date, record }) => { if (date < threeMonthsBefore) inactiveRecords.push(record); });

  return [
    { id: "missing-domains", label: "Incomplete service coverage", description: "Households missing at least one domain across all visits", count: incompleteCoverageRecords.length, total: hhServiceMap.size, severity: incompleteCoverageRecords.length > 0 ? "warning" : "success", icon: AlertTriangle, records: incompleteCoverageRecords },
    { id: "duplicates", label: "Possible duplicate records", description: "Same household, date and services entered twice", count: dupeRecords.length, total, severity: dupeRecords.length > 0 ? "warning" : "success", icon: Copy, records: dupeRecords },
    { id: "empty-records", label: "Blank service records", description: "No service data in any field", count: emptyRecords.length, total, severity: emptyRecords.length > 0 ? "warning" : "success", icon: FileX, records: emptyRecords },
    { id: "no-district", label: "Records without district", description: "Missing district breaks geographic filtering", count: noDistrict.length, total, severity: noDistrict.length > 0 ? "warning" : "success", icon: MapPinOff, records: noDistrict },
    { id: "future-dated", label: "Future-dated records", description: "Service date is after today", count: futureDated.length, total, severity: futureDated.length > 0 ? "critical" : "success", icon: CalendarX, records: futureDated },
    { id: "almost-ready", label: "Almost graduation-ready", description: "Households with 3 of 4 domains — one more to go", count: almostReadyRecords.length, total: hhServiceMap.size, severity: almostReadyRecords.length > 0 ? "info" : "success", icon: GraduationCap, records: almostReadyRecords },
    { id: "inactive", label: "Clients without recent services", description: "Last visit over 3 months before latest service in period", count: inactiveRecords.length, total: lastServiceByHH.size || totalHH, severity: inactiveRecords.length > 0 ? "warning" : "success", icon: UserX, records: inactiveRecords },
  ];
}

/**
 * Compute data quality insights for VCA Services.
 */
export function computeVcaInsights(
  services: any[],
  filteredServices: any[],
): InsightItem[] {
  const now = new Date();
  const refDate = getLatestServiceDate(filteredServices);
  const sixMonthsBefore = new Date(refDate);
  sixMonthsBefore.setMonth(sixMonthsBefore.getMonth() - 6);
  const threeMonthsBefore = new Date(refDate);
  threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);

  const total = filteredServices.length;

  // Group by VCA
  const vcaServiceMap = new Map<string, any[]>();
  filteredServices.forEach(s => {
    const id = String(s.vcaid || s.vca_id || "");
    if (!vcaServiceMap.has(id)) vcaServiceMap.set(id, []);
    vcaServiceMap.get(id)!.push(s);
  });

  // 1. HIV+ without VL
  const hivPositive = filteredServices.filter(s => s.is_hiv_positive === "1" || s.is_hiv_positive === true);
  const hivNoVl = hivPositive.filter(s => isFieldEmpty(s.date_last_vl) || isFieldEmpty(s.vl_last_result));

  // 2. Stale VL — relative to latest service date
  const staleVl = hivPositive.filter(s => {
    const d = parseDate(s.date_last_vl);
    return d && d < sixMonthsBefore;
  });

  // 3. Incomplete coverage — per VCA across ALL visits
  const incompleteCoverageRecords: any[] = [];
  vcaServiceMap.forEach((svcs, vcaId) => {
    const hasHealth = isDomainCovered(svcs, "health_services", "other_health_services");
    const hasSchooled = isDomainCovered(svcs, "schooled_services", "other_schooled_services");
    const hasSafe = isDomainCovered(svcs, "safe_services", "other_safe_services");
    const hasStable = isDomainCovered(svcs, "stable_services", "other_stable_services");
    if (!hasHealth || !hasSchooled || !hasSafe || !hasStable) {
      incompleteCoverageRecords.push({ vcaid: vcaId, health: hasHealth ? "Yes" : "Missing", schooled: hasSchooled ? "Yes" : "Missing", safe: hasSafe ? "Yes" : "Missing", stable: hasStable ? "Yes" : "Missing", total_visits: svcs.length });
    }
  });

  // 4. Duplicates
  const seen = new Set<string>();
  const dupeRecords: any[] = [];
  filteredServices.forEach(s => {
    const key = `${s.vcaid || s.vca_id}|${s.service_date}|${s.health_services}`;
    if (seen.has(key)) dupeRecords.push(s);
    else seen.add(key);
  });

  // 5. Empty records — check ALL fields
  const emptyRecords = filteredServices.filter(s => !hasAnyService(s));

  // 6. Missing district
  const noDistrict = filteredServices.filter(s => isFieldEmpty(s.district));

  // 7. Future-dated
  const futureDated = filteredServices.filter(s => {
    const d = parseDate(s.service_date);
    return d && d > now;
  });

  // 10. Graduation pipeline — per VCA, exactly 3 of 4 domains
  const almostReadyRecords: any[] = [];
  vcaServiceMap.forEach((svcs, vcaId) => {
    let domains = 0;
    if (isDomainCovered(svcs, "health_services", "other_health_services")) domains++;
    if (isDomainCovered(svcs, "schooled_services", "other_schooled_services")) domains++;
    if (isDomainCovered(svcs, "safe_services", "other_safe_services")) domains++;
    if (isDomainCovered(svcs, "stable_services", "other_stable_services")) domains++;
    if (domains === 3) {
      const missingDomain = !isDomainCovered(svcs, "health_services", "other_health_services") ? "Health" :
        !isDomainCovered(svcs, "schooled_services", "other_schooled_services") ? "Schooled" :
        !isDomainCovered(svcs, "safe_services", "other_safe_services") ? "Safe" : "Stable";
      almostReadyRecords.push({ vcaid: vcaId, domains_covered: 3, missing_domain: missingDomain, total_visits: svcs.length });
    }
  });

  // 12. VL suppression
  const withVl = hivPositive.filter(s => isFieldProvided(s.vl_last_result));
  const suppressed = withVl.filter(s => {
    const val = String(s.vl_last_result).toLowerCase();
    return val.includes("suppress") || val.includes("undetect") || val === "ldl" ||
      (Number(s.vl_last_result) > 0 && Number(s.vl_last_result) < 1000);
  });

  // 13. MMD coverage
  const withMmd = filteredServices.filter(s => isFieldProvided(s.level_mmd));

  // 14. Inactive — relative to latest date in dataset
  const lastServiceByVca = new Map<string, { date: Date; record: any }>();
  filteredServices.forEach(s => {
    const id = String(s.vcaid || s.vca_id || "");
    const d = parseDate(s.service_date);
    if (d) {
      const existing = lastServiceByVca.get(id);
      if (!existing || d > existing.date) lastServiceByVca.set(id, { date: d, record: s });
    }
  });
  const inactiveRecords: any[] = [];
  lastServiceByVca.forEach(({ date, record }) => { if (date < threeMonthsBefore) inactiveRecords.push(record); });

  return [
    { id: "hiv-no-vl", label: "HIV+ missing viral load", description: "Children positive but no VL test recorded", count: hivNoVl.length, total: hivPositive.length || total, severity: hivNoVl.length > 0 ? "critical" : "success", icon: ShieldAlert, records: hivNoVl },
    { id: "stale-vl", label: "Overdue viral load tests", description: "Last VL older than 6 months from latest service", count: staleVl.length, total: hivPositive.length || total, severity: staleVl.length > 0 ? "critical" : "success", icon: Clock, records: staleVl },
    { id: "missing-domains", label: "Incomplete service coverage", description: "VCAs missing at least one domain across all visits", count: incompleteCoverageRecords.length, total: vcaServiceMap.size, severity: incompleteCoverageRecords.length > 0 ? "warning" : "success", icon: AlertTriangle, records: incompleteCoverageRecords },
    { id: "duplicates", label: "Possible duplicate records", description: "Same VCA, date and services entered twice", count: dupeRecords.length, total, severity: dupeRecords.length > 0 ? "warning" : "success", icon: Copy, records: dupeRecords },
    { id: "empty-records", label: "Blank service records", description: "No service data in any field", count: emptyRecords.length, total, severity: emptyRecords.length > 0 ? "warning" : "success", icon: FileX, records: emptyRecords },
    { id: "no-district", label: "Records without district", description: "Missing district breaks geographic filtering", count: noDistrict.length, total, severity: noDistrict.length > 0 ? "warning" : "success", icon: MapPinOff, records: noDistrict },
    { id: "future-dated", label: "Future-dated records", description: "Service date is after today", count: futureDated.length, total, severity: futureDated.length > 0 ? "critical" : "success", icon: CalendarX, records: futureDated },
    { id: "almost-ready", label: "Almost graduation-ready", description: "VCAs with 3 of 4 domains — one more to go", count: almostReadyRecords.length, total: vcaServiceMap.size, severity: almostReadyRecords.length > 0 ? "info" : "success", icon: GraduationCap, records: almostReadyRecords },
    { id: "vl-suppression", label: "Viral load suppressed", description: "HIV+ children with suppressed viral load", count: suppressed.length, total: withVl.length || hivPositive.length, severity: suppressed.length > 0 ? "success" : "info", icon: Pill, records: suppressed },
    { id: "mmd-coverage", label: "Multi-month dispensing", description: "VCAs with MMD level recorded", count: withMmd.length, total, severity: withMmd.length < total * 0.5 ? "warning" : "success", icon: TrendingUp, records: withMmd },
    { id: "inactive", label: "Clients without recent services", description: "Last visit over 3 months before latest service in period", count: inactiveRecords.length, total: lastServiceByVca.size, severity: inactiveRecords.length > 0 ? "warning" : "success", icon: UserX, records: inactiveRecords },
  ];
}
