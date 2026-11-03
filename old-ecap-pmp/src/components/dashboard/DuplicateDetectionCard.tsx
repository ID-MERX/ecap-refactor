import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, AlertTriangle, CheckCircle2, ChevronRight, Users, Building2, MapPin, UserCheck, FileText, RotateCcw, CalendarDays, Info, HelpCircle } from "lucide-react";
import GlowCard from "@/components/aceternity/GlowCard";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { getDuplicates, listDuplicateReviews, upsertDuplicateReview, deleteDuplicateReview, type DuplicateGroup } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
}

// Normalize mixed date formats from backend to ISO YYYY-MM-DD.
// Handles: "2024-11-15T00:00:00.000Z", "2024-11-15", "29-07-2025" (DD-MM-YYYY).
const normalizeDate = (d: string | null | undefined): string => {
  if (!d) return "";
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const dmy2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy2) return `${dmy2[3]}-${dmy2[2]}-${dmy2[1]}`;
  return s;
};

const formatDate = (d: string | null | undefined): string => {
  if (!d) return "Unknown";
  const iso = normalizeDate(d);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || String(d);
  const [y, m, day] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const SEVERITY = (count: number) => {
  if (count >= 10) return { label: "Critical", cls: "bg-red-50 text-red-700 border-red-200" };
  if (count >= 5) return { label: "High", cls: "bg-orange-50 text-orange-700 border-orange-200" };
  if (count >= 3) return { label: "Medium", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "Low", cls: "bg-yellow-50 text-yellow-700 border-yellow-200" };
};

const LOCATION_LABEL = "Ward";
const getLocation = (g: DuplicateGroup) => g.ward || g.facility || "-";

type DateSummary = {
  date: string;
  groups: DuplicateGroup[];
  totalGroups: number;
  redundantRecords: number;
  topCaseworker: string;
  topCaseworkerLocation: string;
  topCaseworkerCount: number;
  reviewedCount: number;
};

type MonthGroup = {
  month: string; // YYYY-MM
  dates: DateSummary[];
  totalGroups: number;
  redundantRecords: number;
  reviewedCount: number;
};

const formatMonth = (ym: string): string => {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  if (isNaN(date.getTime())) return ym;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
};

const DuplicateDetectionCard = ({ type, district, facility }: Props) => {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["duplicates", type, district, facility],
    queryFn: () => getDuplicates({ type, district, facility }),
    staleTime: 5 * 60 * 1000,
  });

  const reviewsQuery = useQuery({
    queryKey: ["duplicate-reviews"],
    queryFn: listDuplicateReviews,
    staleTime: 60 * 1000,
  });
  useEffect(() => {
    if (reviewsQuery.data) {
      const keys = reviewsQuery.data
        .filter((r) => !r.service_type || r.service_type === type)
        .map((r) => r.run_key);
      setReviewed(new Set(keys));
    }
  }, [reviewsQuery.data, type]);

  const groups = data?.groups || [];
  const summary = data?.summary;
  const entityLabel = data?.entity_label || "Entity";

  const dateSummaries = useMemo<DateSummary[]>(() => {
    const byDate = new Map<string, DuplicateGroup[]>();
    groups.forEach((g) => {
      const d = normalizeDate(g.service_date) || "Unknown";
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(g);
    });
    return Array.from(byDate.entries()).map(([date, grp]) => {
      // Aggregate by (caseworker, location) pair so we pick the caseworker's primary location
      const pairCounts: Record<string, number> = {};
      grp.forEach((g) => {
        const key = `${g.caseworker_name || "Unknown"}||${getLocation(g)}`;
        pairCounts[key] = (pairCounts[key] || 0) + Number(g.duplicate_count);
      });
      const topPair = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0] || ["Unknown||-", 0];
      const [topCaseworker, topCaseworkerLocation] = topPair[0].split("||");
      const reviewedCount = grp.filter((g) => reviewed.has(`${g.entity_id}|${g.service_date}|${g.services}`)).length;
      return {
        date,
        groups: grp,
        totalGroups: grp.length,
        redundantRecords: grp.reduce((a, g) => a + (Number(g.duplicate_count) - 1), 0),
        topCaseworker,
        topCaseworkerLocation,
        topCaseworkerCount: topPair[1],
        reviewedCount,
      };
    }).sort((a, b) => b.date.localeCompare(a.date)); // dates DESC within month
  }, [groups, reviewed]);

  // Group dates by year-month (YYYY-MM), months sorted DESC
  const monthGroups = useMemo<MonthGroup[]>(() => {
    const byMonth = new Map<string, DateSummary[]>();
    dateSummaries.forEach((d) => {
      const ym = d.date.length >= 7 ? d.date.slice(0, 7) : "Unknown";
      if (!byMonth.has(ym)) byMonth.set(ym, []);
      byMonth.get(ym)!.push(d);
    });
    return Array.from(byMonth.entries()).map(([month, dates]) => ({
      month,
      dates,
      totalGroups: dates.reduce((a, d) => a + d.totalGroups, 0),
      redundantRecords: dates.reduce((a, d) => a + d.redundantRecords, 0),
      reviewedCount: dates.reduce((a, d) => a + d.reviewedCount, 0),
    })).sort((a, b) => b.month.localeCompare(a.month));
  }, [dateSummaries]);

  const activeDateGroups = useMemo(() => {
    if (!openDate) return [];
    const match = dateSummaries.find((d) => d.date === openDate);
    if (!match) return [];
    return [...match.groups].sort((a, b) => {
      const ka = `${a.entity_id}|${a.service_date}|${a.services}`;
      const kb = `${b.entity_id}|${b.service_date}|${b.services}`;
      const ra = reviewed.has(ka) ? 1 : 0;
      const rb = reviewed.has(kb) ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return Number(b.duplicate_count) - Number(a.duplicate_count);
    });
  }, [openDate, dateSummaries, reviewed]);

  const handleToggleReviewed = async (key: string) => {
    const wasReviewed = reviewed.has(key);
    setReviewed((prev) => {
      const next = new Set(prev);
      if (wasReviewed) next.delete(key);
      else next.add(key);
      return next;
    });
    try {
      if (wasReviewed) {
        await deleteDuplicateReview(key);
        toast.success("Unmarked — record restored to review queue");
      } else {
        await upsertDuplicateReview({ run_key: key, service_type: type });
        toast.success("Marked as reviewed");
      }
    } catch (err) {
      setReviewed((prev) => {
        const next = new Set(prev);
        if (wasReviewed) next.add(key);
        else next.delete(key);
        return next;
      });
      toast.error("Failed to save review — try again");
    }
  };

  const handleFlagCaseworker = (g: DuplicateGroup) => {
    toast.info(`Flagged: ${g.caseworker_name || "Unknown"} - ${entityLabel} ${g.entity_id}`, {
      description: "Caseworker will be notified for correction.",
    });
  };

  const handleExportCsv = () => {
    if (groups.length === 0) return;
    const headers = [`${entityLabel} ID`, "Service Date", "Services", "Duplicate Count", "Caseworker", "Facility", "District", "Severity"];
    const rows = groups.map((g) => [
      g.entity_id, g.service_date, (g.services || "").replace(/,/g, ";"), g.duplicate_count,
      g.caseworker_name || "", g.facility || "", g.district || "", SEVERITY(g.duplicate_count).label,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `duplicates-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <GlowCard>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500">Analyzing duplicates...</p>
        </CardContent>
      </GlowCard>
    );
  }

  if (isError || !data) {
    return (
      <GlowCard>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-600 font-medium">Failed to load duplicate detection data</p>
        </CardContent>
      </GlowCard>
    );
  }

  if (groups.length === 0) {
    return (
      <GlowCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4 text-primary" />
            Duplicate Detection
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">No duplicates found</p>
          <p className="text-xs text-slate-400 mt-1">Data integrity is clean for the selected filters.</p>
        </CardContent>
      </GlowCard>
    );
  }

  return (
    <>
      <GlowCard>
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Copy className="h-4 w-4 text-amber-600" />
                Duplicate Detection
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 ml-2">
                  {summary?.total_groups || 0} groups • {summary?.total_redundant_records || 0} redundant records
                </Badge>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Grouped by service date. Pick a day to see which {entityLabel.toLowerCase()}s were logged in duplicate on that day.
              </p>
              <div className="mt-2 flex items-start gap-2 p-2.5 rounded-md bg-blue-50/60 border border-blue-100 text-[11px] text-blue-900 max-w-3xl">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-600" />
                <div className="leading-relaxed">
                  <span className="font-semibold">Why these are flagged:</span> a record counts as a duplicate when the same <span className="font-semibold">{entityLabel.toLowerCase()} ID</span>, <span className="font-semibold">service date</span>, and <span className="font-semibold">services logged</span> appear more than once in the source table. A "duplicate group" is one such combination; "redundant records" is the count minus one (the first entry is kept, the rest are the extras that shouldn't exist).
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="px-4 py-3">Service Date</th>
                  <th className="px-4 py-3 text-center" title="Distinct combinations of entity + date + services that appear more than once">Duplicate Groups</th>
                  <th className="px-4 py-3 text-center" title="Extra records beyond the first one in each group (count − 1)">Redundant Records</th>
                  <th className="px-4 py-3">Top Caseworker</th>
                  <th className="px-4 py-3">Review Progress</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthGroups.map((m) => (
                  <>
                    <tr key={`month-${m.month}`} className="bg-slate-100 border-t-2 border-slate-300">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <CalendarDays className="h-4 w-4 text-slate-600" />
                          <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">{formatMonth(m.month)}</span>
                          <Badge variant="outline" className="text-[10px] bg-white border-slate-300 text-slate-700">
                            {m.totalGroups} group{m.totalGroups === 1 ? "" : "s"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">
                            {m.redundantRecords} redundant
                          </Badge>
                          {m.reviewedCount > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> {m.reviewedCount} reviewed
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                    {m.dates.map((d) => {
                  const allReviewed = d.reviewedCount === d.totalGroups;
                  const pct = d.totalGroups > 0 ? Math.round((d.reviewedCount / d.totalGroups) * 100) : 0;
                  return (
                    <tr
                      key={d.date}
                      className={cn(
                        "hover:bg-slate-50 cursor-pointer transition-colors",
                        allReviewed && "bg-emerald-50/30"
                      )}
                      onClick={() => setOpenDate(d.date)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CalendarDays className={cn("h-4 w-4", allReviewed ? "text-emerald-600" : "text-slate-500")} />
                          <span className="font-semibold text-sm text-slate-800">{formatDate(d.date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono font-bold text-slate-700">{d.totalGroups}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="text-[11px] bg-amber-50 border-amber-200 text-amber-700 font-mono">
                          {d.redundantRecords}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="truncate max-w-[220px] font-medium text-slate-700">{d.topCaseworker}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate max-w-[220px]">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{d.topCaseworkerLocation || "-"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{d.topCaseworkerCount} record{d.topCaseworkerCount === 1 ? "" : "s"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full", allReviewed ? "bg-emerald-500" : "bg-blue-500")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                            {d.reviewedCount}/{d.totalGroups}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-600 hover:bg-slate-100">
                          View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </GlowCard>

      <Sheet open={!!openDate} onOpenChange={(o) => !o && setOpenDate(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openDate && (() => {
            const d = dateSummaries.find((x) => x.date === openDate);
            if (!d) return null;
            return (
              <>
                <SheetHeader className="pb-4 border-b border-slate-100">
                  <SheetTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    {formatDate(d.date)}
                  </SheetTitle>
                  <SheetDescription>
                    <span className="inline-flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="bg-white text-slate-700">{d.totalGroups} duplicate group{d.totalGroups === 1 ? "" : "s"}</Badge>
                      <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">{d.redundantRecords} redundant record{d.redundantRecords === 1 ? "" : "s"}</Badge>
                      {d.reviewedCount > 0 && (
                        <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> {d.reviewedCount} reviewed
                        </Badge>
                      )}
                    </span>
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-3 py-4">
                  {activeDateGroups.map((g) => {
                    const key = `${g.entity_id}|${g.service_date}|${g.services}`;
                    const isReviewed = reviewed.has(key);
                    const sev = SEVERITY(Number(g.duplicate_count));
                    return (
                      <div
                        key={key}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          isReviewed ? "bg-emerald-50/40 border-emerald-100" : "bg-white border-slate-200"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("font-mono text-sm font-semibold", isReviewed ? "text-slate-400 line-through" : "text-slate-800")}>
                                {g.entity_id}
                              </span>
                              <span className={cn("font-mono text-xs font-bold", isReviewed ? "text-slate-400" : "text-slate-600")}>
                                {g.duplicate_count}× logged
                              </span>
                              {isReviewed ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Reviewed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className={cn("text-[10px]", sev.cls)}>{sev.label}</Badge>
                              )}
                            </div>
                            <div className="mt-2 text-xs text-slate-600 space-y-1">
                              <div className="flex items-center gap-1.5"><UserCheck className="h-3 w-3 text-slate-400" /> {g.caseworker_name || "Unknown caseworker"}</div>
                              <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3 text-slate-400" /> {g.facility || "-"}</div>
                              <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" /> {g.province} / {g.district}</div>
                            </div>
                            <div className="mt-2">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Services</p>
                              <div className="p-2 bg-slate-50 rounded text-[11px] font-mono text-slate-700">{g.services || "(empty)"}</div>
                            </div>
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded">
                              <div className="flex items-start gap-1.5">
                                <HelpCircle className="h-3 w-3 mt-0.5 text-amber-600 shrink-0" />
                                <div className="text-[11px] text-amber-900 leading-relaxed">
                                  <span className="font-semibold">Why flagged:</span> {entityLabel} <span className="font-mono font-semibold">{g.entity_id}</span> has <span className="font-semibold">{g.duplicate_count} records</span> with an identical service date (<span className="font-mono">{formatDate(g.service_date)}</span>) and identical services. Only one entry should exist — the other <span className="font-semibold">{Number(g.duplicate_count) - 1}</span> {Number(g.duplicate_count) - 1 === 1 ? "is" : "are"} redundant and should be removed after verifying with the caseworker.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          {!isReviewed && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600 hover:bg-rose-50"
                              onClick={() => handleFlagCaseworker(g)}>
                              Flag caseworker
                            </Button>
                          )}
                          {isReviewed ? (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-600 hover:bg-slate-100"
                              onClick={() => handleToggleReviewed(key)}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Unmark
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                              onClick={() => handleToggleReviewed(key)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark reviewed
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default DuplicateDetectionCard;
