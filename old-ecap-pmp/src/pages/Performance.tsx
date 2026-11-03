import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  UserCheck,
  ClipboardList,
  Trophy,
  AlertTriangle,
  Download,
  Info,
  ChevronDown,
  ChevronRight,
  Activity,
  Users,
  Percent,
  BarChart3,
  MapPin,
  X,
  Gauge,
  Sparkles,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCaseworkerPerformance,
  getFacilityPerformance,
  getServicePerformance,
  getFacilityList,
  getHouseholdsByDistrict,
  type CaseworkerPerformance,
  type FacilityPerformance,
  type ServicePerformance,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { useFyFilter } from "@/context/FyFilterContext";

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  top:      { label: "High performer",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  mid:      { label: "Average",         cls: "bg-slate-50 text-slate-600 border-slate-200" },
  bottom:   { label: "Under-performing",cls: "bg-rose-50 text-rose-700 border-rose-200" },
  inactive: { label: "No activity",     cls: "bg-slate-100 text-slate-400 border-slate-200" },
};

const BAR_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-orange-500", "bg-rose-500",
  "bg-purple-500",  "bg-pink-500", "bg-cyan-500",   "bg-amber-500",
  "bg-teal-500",    "bg-indigo-500",
];

const TrendPill = ({ pct }: { pct: number }) => {
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const cls = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-rose-600" : "text-slate-400";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", cls)}>
      <Icon className="h-3.5 w-3.5" /> {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
};

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "emerald" | "rose" | "slate" | "blue";
}
const toneCls: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  emerald: "text-emerald-600",
  rose:    "text-rose-600",
  slate:   "text-slate-800",
  blue:    "text-blue-600",
};
const KpiCard = ({ icon, label, value, sub, tone = "slate" }: KpiCardProps) => (
  <GlowCard>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-bold", toneCls[tone])}>{value}</div>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </CardContent>
  </GlowCard>
);

interface BarRow { label: string; value: number; sub?: string; trend?: number }
const HorizontalBarChart = ({
  title,
  icon,
  rows,
  tone = "emerald",
  emptyText = "No data",
}: {
  title: string;
  icon: ReactNode;
  rows: BarRow[];
  tone?: "emerald" | "rose";
  emptyText?: string;
}) => {
  const max = Math.max(0, ...rows.map((r) => r.value));
  return (
    <GlowCard>
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 ml-auto">
            Top {rows.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">{emptyText}</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={`${r.label}-${i}`} className="group">
                <div className="flex items-baseline justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[75%]" title={r.label}>
                    {i + 1}. {r.label}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-slate-800">
                    {r.value.toLocaleString()}
                    {r.trend !== undefined && <span className="ml-2 font-normal"><TrendPill pct={r.trend} /></span>}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", tone === "rose" ? BAR_COLORS[3] : BAR_COLORS[i % BAR_COLORS.length])}
                    style={{ width: max > 0 ? `${(r.value / max) * 100}%` : "0%" }}
                  />
                </div>
                {r.sub && <div className="mt-0.5 text-[10px] text-slate-400 truncate">{r.sub}</div>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </GlowCard>
  );
};

const exportCsv = <T extends Record<string, unknown>>(rows: T[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push(headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

const FacilitySection = ({ data }: { data: FacilityPerformance[] }) => {
  const [q, setQ] = useState("");
  const [showTable, setShowTable] = useState(false);

  const filtered = useMemo(() => {
    const base = q
      ? data.filter((r) =>
          (r.facility || "").toLowerCase().includes(q.toLowerCase()) ||
          (r.district || "").toLowerCase().includes(q.toLowerCase()) ||
          (r.ward || "").toLowerCase().includes(q.toLowerCase())
        )
      : data;
    return [...base].sort((a, b) => b.services_this_month - a.services_this_month || b.total_vcas - a.total_vcas);
  }, [data, q]);

  const totalThis = data.reduce((a, r) => a + r.services_this_month, 0);
  const totalLast = data.reduce((a, r) => a + r.services_last_month, 0);
  const totalMoM = totalLast > 0 ? Math.round(((totalThis - totalLast) / totalLast) * 100) : 0;
  const trendingUp = data.filter((r) => r.trend_pct > 0 && r.services_this_month > 0).length;
  const trendingDown = data.filter((r) => r.trend_pct < 0).length;

  const top10 = useMemo(
    () => [...filtered].sort((a, b) => b.services_this_month - a.services_this_month).slice(0, 10),
    [filtered],
  );
  const bottom10 = useMemo(
    () => [...filtered]
      .filter((r) => r.services_this_month > 0 && r.trend_pct < 0)
      .sort((a, b) => a.trend_pct - b.trend_pct)
      .slice(0, 10),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Activity className="h-3 w-3 text-slate-500" />} label="Services this month" value={totalThis.toLocaleString()} sub={`${totalLast.toLocaleString()} last month`} tone="slate" />
        <KpiCard icon={<TrendingUp className="h-3 w-3 text-slate-500" />} label="Month-over-month" value={`${totalMoM > 0 ? "+" : ""}${totalMoM}%`} sub="All facilities combined" tone={totalMoM > 0 ? "emerald" : totalMoM < 0 ? "rose" : "slate"} />
        <KpiCard icon={<Trophy className="h-3 w-3 text-emerald-500" />} label="Trending up" value={trendingUp} sub="Facilities growing MoM" tone="emerald" />
        <KpiCard icon={<AlertTriangle className="h-3 w-3 text-rose-500" />} label="Trending down" value={trendingDown} sub="Facilities declining MoM" tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart
          title="Top facilities by volume"
          icon={<Trophy className="h-4 w-4 text-emerald-500" />}
          rows={top10.map((r) => ({ label: r.facility, value: r.services_this_month, sub: `${r.ward ? r.ward + " · " : ""}${r.district}`, trend: r.trend_pct }))}
        />
        <HorizontalBarChart
          title="Biggest month-over-month drops"
          icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          rows={bottom10.map((r) => ({ label: r.facility, value: Math.abs(r.trend_pct), sub: `${r.district} · ${r.services_this_month.toLocaleString()} this month`, trend: r.trend_pct }))}
          tone="rose"
          emptyText="No facilities declining MoM"
        />
      </div>

      <GlowCard>
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-2 text-left">
              {showTable ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" /> Full facility breakdown
                <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 ml-2">
                  {filtered.length} facilit{filtered.length === 1 ? "y" : "ies"}
                </Badge>
              </CardTitle>
            </button>
            <div className="flex gap-2">
              <Input placeholder="Search facility / ward / district…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 max-w-xs" />
              <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, "facility-performance")} className="gap-2">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        {showTable && (
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-cyan-50/40 text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                <tr>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Ward</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3 text-right">Enrolled VCAs</th>
                  <th className="px-4 py-3 text-right">Households</th>
                  <th className="px-4 py-3 text-right">Services (this month)</th>
                  <th className="px-4 py-3 text-right">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50/60">
                {filtered.map((r) => (
                  <tr key={`${r.facility}-${r.ward || ""}`} className="transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[260px] truncate">{r.facility}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.ward || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.district}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{r.total_vcas.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{r.households.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{r.services_this_month.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right"><TrendPill pct={r.trend_pct} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}
      </GlowCard>
    </div>
  );
};

const CaseworkerSection = ({ data }: { data: CaseworkerPerformance[] }) => {
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<string>("all");
  const [showTable, setShowTable] = useState(false);

  const filtered = useMemo(() => {
    let rows = data;
    if (tier !== "all") rows = rows.filter((r) => r.tier === tier);
    if (q) {
      const n = q.toLowerCase();
      rows = rows.filter((r) =>
        r.caseworker_name.toLowerCase().includes(n) ||
        (r.ward || "").toLowerCase().includes(n) ||
        (r.facility || "").toLowerCase().includes(n)
      );
    }
    return [...rows].sort((a, b) => b.services_this_month - a.services_this_month);
  }, [data, q, tier]);

  const active = data.filter((r) => r.tier !== "inactive");
  const topCount = data.filter((r) => r.tier === "top").length;
  const bottomCount = data.filter((r) => r.tier === "bottom").length;
  const avgServices = active.length > 0
    ? Math.round(active.reduce((a, r) => a + r.services_this_month, 0) / active.length)
    : 0;

  const top10 = useMemo(() => filtered.slice(0, 10), [filtered]);
  const bottom10 = useMemo(
    () => [...filtered].filter((r) => r.services_this_month > 0).sort((a, b) => a.services_this_month - b.services_this_month).slice(0, 10),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="h-3 w-3 text-slate-500" />} label="Active caseworkers" value={active.length} sub="Delivered ≥1 this month" tone="slate" />
        <KpiCard icon={<Trophy className="h-3 w-3 text-emerald-500" />} label="Top performers" value={topCount} sub="Top 20% by volume" tone="emerald" />
        <KpiCard icon={<AlertTriangle className="h-3 w-3 text-rose-500" />} label="Under-performing" value={bottomCount} sub="Bottom 20% by volume" tone="rose" />
        <KpiCard icon={<BarChart3 className="h-3 w-3 text-blue-500" />} label="Avg services / caseworker" value={avgServices.toLocaleString()} sub="Among active only" tone="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart
          title="Top 10 caseworkers"
          icon={<Trophy className="h-4 w-4 text-emerald-500" />}
          rows={top10.map((r) => ({ label: r.caseworker_name, value: r.services_this_month, sub: r.ward || r.facility || r.district || "", trend: r.trend_pct }))}
        />
        <HorizontalBarChart
          title="Lowest-volume active caseworkers"
          icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          rows={bottom10.map((r) => ({ label: r.caseworker_name, value: r.services_this_month, sub: r.ward || r.facility || r.district || "", trend: r.trend_pct }))}
          tone="rose"
        />
      </div>

      <GlowCard>
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-2 text-left">
              {showTable ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4 text-primary" /> Full caseworker breakdown
                <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 ml-2">
                  {filtered.length} caseworker{filtered.length === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
            </button>
            <div className="flex flex-wrap gap-2">
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tiers</SelectItem>
                  <SelectItem value="top">Top performers</SelectItem>
                  <SelectItem value="mid">Average</SelectItem>
                  <SelectItem value="bottom">Under-performing</SelectItem>
                  <SelectItem value="inactive">No activity</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Search name / ward…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 max-w-xs" />
              <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, "caseworker-performance")} className="gap-2">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        {showTable && (
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-cyan-50/40 text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                <tr>
                  <th className="px-4 py-3">Caseworker</th>
                  <th className="px-4 py-3">Ward</th>
                  <th className="px-4 py-3">District</th>
                  <th className="px-4 py-3 text-right">Services</th>
                  <th className="px-4 py-3 text-right">Unique</th>
                  <th className="px-4 py-3 text-right">Days</th>
                  <th className="px-4 py-3 text-right">Per-day</th>
                  <th className="px-4 py-3 text-right">Trend</th>
                  <th className="px-4 py-3">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50/60">
                {filtered.map((r) => (
                  <tr key={`${r.caseworker_name}-${r.ward}`} className="transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{r.caseworker_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] truncate">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {r.ward || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.district || "-"}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{r.services_this_month.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{r.unique_entities_this_month.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{r.active_days_this_month}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{r.services_per_active_day}</td>
                    <td className="px-4 py-3 text-right"><TrendPill pct={r.trend_pct} /></td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-[10px]", TIER_BADGE[r.tier].cls)}>
                        {TIER_BADGE[r.tier].label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}
      </GlowCard>
    </div>
  );
};

const ServiceSection = ({ data, meta }: { data: ServicePerformance[]; meta: { total_vcas: number; total_households: number } }) => {
  const [tier, setTier] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [showTable, setShowTable] = useState(false);

  const filtered = useMemo(() => {
    let rows = data;
    if (tier !== "all") rows = rows.filter((r) => r.tier === tier);
    if (type !== "all") rows = rows.filter((r) => r.type === type);
    return [...rows].sort((a, b) => b.this_month - a.this_month);
  }, [data, tier, type]);

  const totalThis = data.reduce((a, r) => a + r.this_month, 0);
  const totalLast = data.reduce((a, r) => a + r.last_month, 0);
  const totalMoM = totalLast > 0 ? Math.round(((totalThis - totalLast) / totalLast) * 100) : 0;
  const avgCoverage = data.length > 0
    ? Math.round((data.reduce((a, r) => a + r.coverage_pct, 0) / data.length) * 10) / 10
    : 0;
  const decliningBad = data.filter((r) => r.trend_pct < -20 && r.this_month > 0).length;

  const top10 = useMemo(
    () => [...filtered].sort((a, b) => b.this_month - a.this_month).slice(0, 10),
    [filtered],
  );
  const bottom10 = useMemo(
    () => [...filtered]
      .filter((r) => r.this_month > 0 && r.trend_pct < 0)
      .sort((a, b) => a.trend_pct - b.trend_pct)
      .slice(0, 10),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Activity className="h-3 w-3 text-slate-500" />} label="Services delivered" value={totalThis.toLocaleString()} sub={`${totalLast.toLocaleString()} last month`} tone="slate" />
        <KpiCard icon={<TrendingUp className="h-3 w-3 text-slate-500" />} label="Month-over-month" value={`${totalMoM > 0 ? "+" : ""}${totalMoM}%`} sub="All service types" tone={totalMoM > 0 ? "emerald" : totalMoM < 0 ? "rose" : "slate"} />
        <KpiCard icon={<Percent className="h-3 w-3 text-blue-500" />} label="Avg coverage" value={`${avgCoverage}%`} sub={`${meta.total_vcas.toLocaleString()} VCAs · ${meta.total_households.toLocaleString()} HH`} tone="blue" />
        <KpiCard icon={<AlertTriangle className="h-3 w-3 text-rose-500" />} label="Declining sharply" value={decliningBad} sub="Down >20% MoM" tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HorizontalBarChart
          title="Top services by volume"
          icon={<Trophy className="h-4 w-4 text-emerald-500" />}
          rows={top10.map((r) => ({ label: r.service, value: r.this_month, sub: `${r.type} · ${r.coverage_pct}% coverage`, trend: r.trend_pct }))}
        />
        <HorizontalBarChart
          title="Biggest month-over-month drops"
          icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          rows={bottom10.map((r) => ({ label: r.service, value: Math.abs(r.trend_pct), sub: `${r.type} · ${r.this_month.toLocaleString()} this month`, trend: r.trend_pct }))}
          tone="rose"
          emptyText="No services declining MoM"
        />
      </div>

      <GlowCard>
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <button onClick={() => setShowTable((v) => !v)} className="flex items-center gap-2 text-left">
              {showTable ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-primary" /> Full service breakdown
                <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 ml-2">
                  {filtered.length} service type{filtered.length === 1 ? "" : "s"}
                </Badge>
              </CardTitle>
            </button>
            <div className="flex flex-wrap gap-2">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="vca">VCA</SelectItem>
                  <SelectItem value="caregiver">Caregiver</SelectItem>
                  <SelectItem value="household">Household</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tiers</SelectItem>
                  <SelectItem value="top">Well-performing</SelectItem>
                  <SelectItem value="mid">Average</SelectItem>
                  <SelectItem value="bottom">Under-performing</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => exportCsv(filtered, "service-performance")} className="gap-2">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        {showTable && (
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-cyan-50/40 text-[11px] uppercase tracking-wider text-emerald-800 font-bold">
                <tr>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Volume (this month)</th>
                  <th className="px-4 py-3 text-right">Trend</th>
                  <th className="px-4 py-3 text-right">Unique entities</th>
                  <th className="px-4 py-3 text-right">Coverage</th>
                  <th className="px-4 py-3">Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50/60">
                {filtered.map((r, i) => (
                  <tr key={`${r.service}-${r.type}-${i}`} className="transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[280px] truncate">{r.service}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 capitalize">{r.type}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{r.this_month.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right"><TrendPill pct={r.trend_pct} /></td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{r.unique_entities_this_month.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{r.coverage_pct}%</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-[10px]", TIER_BADGE[r.tier].cls)}>
                        {TIER_BADGE[r.tier].label}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        )}
      </GlowCard>
    </div>
  );
};

const Performance = () => {
  const [district, setDistrict] = useState<string>("all");
  const [ward, setWard] = useState<string>("all");

  const householdsListQuery = useQuery({
    queryKey: ["districts-discovery", "All"],
    queryFn: () => getHouseholdsByDistrict(""),
    staleTime: 60 * 60 * 1000,
  });
  const districts = useMemo(() => {
    const s = new Set<string>();
    (householdsListQuery.data ?? []).forEach((h: any) => {
      if (h?.district) s.add(h.district);
    });
    return Array.from(s).sort();
  }, [householdsListQuery.data]);

  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // In ECAP Plus, /etl/facility-list actually returns ward names.
  const wardList = useQuery({ queryKey: ["ward-list"], queryFn: getFacilityList, staleTime: 10 * 60 * 1000 });
  const facilityPerf = useQuery({
    queryKey: ["facility-performance", district, ward, fyKey],
    queryFn: () => getFacilityPerformance({ district, ward, fy: fyArg }),
    staleTime: 5 * 60 * 1000,
  });
  const caseworkerPerf = useQuery({
    queryKey: ["caseworker-performance", district, ward, fyKey],
    queryFn: () => getCaseworkerPerformance({ district, ward, fy: fyArg }),
    staleTime: 5 * 60 * 1000,
  });
  const servicePerf = useQuery({
    queryKey: ["service-performance", district, ward, fyKey],
    queryFn: () => getServicePerformance({ district, ward, fy: fyArg }),
    staleTime: 5 * 60 * 1000,
  });

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout subtitle="Performance">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(6,182,212,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-cyan-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Analytics</span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                <Activity className="h-3 w-3" /> MoM benchmarks
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-700 bg-clip-text text-transparent">
                Performance overview
              </span>
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                <Gauge className="h-3 w-3" /> Facility · Caseworker · Service
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">Monitor delivery this month vs last. Rankings use top-20% / bottom-20% thresholds by volume.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="facility" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <TabsList className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-100/80 p-1 backdrop-blur-sm border border-slate-200/50">
            <TabsTrigger value="facility" className="h-7 px-4 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> Facility
            </TabsTrigger>
            <TabsTrigger value="caseworker" className="h-7 px-4 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
              <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Caseworker
            </TabsTrigger>
            <TabsTrigger value="service" className="h-7 px-4 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Service
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2 items-center ml-auto">
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger className="h-9 w-[180px] bg-white/80 backdrop-blur-md border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <SelectValue placeholder="All districts" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All districts</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ward} onValueChange={setWard}>
              <SelectTrigger className="h-9 w-[200px] bg-white/80 backdrop-blur-md border-slate-200 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">Ward</span>
                  <SelectValue placeholder="All wards" />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">All wards</SelectItem>
                {(wardList.data ?? []).map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(district !== "all" || ward !== "all") && (
              <button
                type="button"
                onClick={() => { setDistrict("all"); setWard("all"); }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white/80 px-3 h-9 text-xs font-medium text-slate-600 transition-all hover:border-rose-300 hover:bg-rose-50/60 hover:text-rose-700"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>

        <TabsContent value="facility">
          {facilityPerf.isLoading ? (
            <div className="py-12 flex items-center justify-center"><LoadingDots className="text-slate-400" /></div>
          ) : (
            <FacilitySection data={facilityPerf.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="caseworker">
          {caseworkerPerf.isLoading ? (
            <div className="py-12 flex items-center justify-center"><LoadingDots className="text-slate-400" /></div>
          ) : (
            <CaseworkerSection data={caseworkerPerf.data ?? []} />
          )}
        </TabsContent>

        <TabsContent value="service">
          {servicePerf.isLoading ? (
            <div className="py-12 flex items-center justify-center"><LoadingDots className="text-slate-400" /></div>
          ) : (
            <ServiceSection data={servicePerf.data?.data ?? []} meta={servicePerf.data?.meta ?? { total_vcas: 0, total_households: 0 }} />
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Performance;
