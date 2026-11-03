import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFyFilter } from "@/context/FyFilterContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Activity, Sparkles, ClipboardCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import LoadingDots from "@/components/aceternity/LoadingDots";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFlaggedRecords, updateFlagStatus } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { notifyUsersOfFlagResolution } from "@/lib/directus";
import { Flag, Search, CheckCircle, CheckCircle2, XCircle, Download, AlertTriangle, RefreshCw } from "lucide-react";

const Flags = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isResolving, setIsResolving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "resolved">("all");

  const isDistrictUser = user?.description === "District User";
  const isProvincialUser = user?.description === "Provincial User";
  const userProvince = user?.title;
  const userDistrict = user?.location;

  const flagsQuery = useQuery({
    queryKey: ["flagged-records"],
    queryFn: getFlaggedRecords,
  });

  const isResolvedStatus = (r: any) => {
    const s = String(r?.status || r?.flag_status || r?.state || "").toLowerCase();
    return s.includes("resolved") || s.includes("closed") || s.includes("done");
  };

  // Geographic filtering — applied to every tab.
  const geoScoped = useMemo(() => {
    return (flagsQuery.data ?? []).filter((r: any) => {
      if (isDistrictUser && userDistrict && userDistrict !== "All") {
        return r.district === userDistrict;
      }
      if (isProvincialUser && userProvince && userProvince !== "All") {
        return r.province === userProvince;
      }
      return true;
    });
  }, [flagsQuery.data, isDistrictUser, isProvincialUser, userDistrict, userProvince]);

  // FY filter applied to date_created on the flag itself.
  const { resolved: fy } = useFyFilter();
  const fyScoped = useMemo(() => {
    if (!fy.fromDate || !fy.toDate) return geoScoped;
    const from = new Date(fy.fromDate).getTime();
    const to = new Date(`${fy.toDate}T23:59:59Z`).getTime();
    return geoScoped.filter((r: any) => {
      const raw = r.date_created || r.created_at || r.flagged_date || r.date;
      if (!raw) return false;
      const t = new Date(raw).getTime();
      return Number.isFinite(t) && t >= from && t <= to;
    });
  }, [geoScoped, fy.fromDate, fy.toDate]);

  const counts = useMemo(
    () => ({
      all: fyScoped.length,
      active: fyScoped.filter((r: any) => !isResolvedStatus(r)).length,
      resolved: fyScoped.filter((r: any) => isResolvedStatus(r)).length,
    }),
    [fyScoped],
  );

  const records = useMemo(() => {
    if (activeTab === "all") return fyScoped;
    if (activeTab === "resolved") return fyScoped.filter((r: any) => isResolvedStatus(r));
    return fyScoped.filter((r: any) => !isResolvedStatus(r));
  }, [fyScoped, activeTab]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery) return records;
    const lowerQuery = searchQuery.toLowerCase();
    return records.filter((record: any) =>
      Object.values(record).some((val) =>
        String(val).toLowerCase().includes(lowerQuery)
      )
    ).sort((a: any, b: any) => {
      return new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime();
    });
  }, [records, searchQuery]);

  const pickValue = (record: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
      const value = record[key];
      if (value === null || value === undefined || value === "") continue;
      // Directus user reference — extract first_name + last_name when present.
      if (typeof value === "object") {
        const v = value as { first_name?: string; last_name?: string };
        const full = `${v.first_name ?? ""} ${v.last_name ?? ""}`.trim();
        if (full) return full;
        continue;
      }
      const s = String(value);
      // A raw UUID is not useful to display — keep looking.
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) continue;
      return s;
    }
    return "N/A";
  };

  const handleExport = () => {
    try {
      const headers = [
        "Household ID",
        "Caseworker Name",
        "Caregiver Name",
        "Facility",
        "Comment",
        "Verifier",
        "Status",
        "Created At",
      ];
      const csvContent =
        "data:text/csv;charset=utf-8," +
        [
          headers.join(","),
          ...filteredRecords.map((record: any) =>
            [
              record.household_id,
              record.caseworker_name,
              record.caregiver_name,
              record.facility,
              `"${(record.comment || "").replace(/"/g, '""')}"`, // Escape quotes in comments
              record.verifier,
              record.status,
              record.date_created,
            ].join(",")
          ),
        ].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `district_flagged_records_${user?.location || "all"}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting data:", error);
    }
  };

  const handleRowClick = (householdId: string) => {
    navigate(`/profile/household-details`, { state: { id: householdId } });
  };

  const resolveMutation = useMutation({
    mutationFn: async ({ id, household_id, vca_id }: { id: string; household_id: string; vca_id: string }) => {
      await updateFlagStatus(id, "resolved");
      const resolver = user ? `${user.first_name} ${user.last_name}` : "Unknown Resolver";
      await notifyUsersOfFlagResolution(household_id, resolver, "Issue marked as resolved via Flags dashboard.", vca_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-records"] });
      queryClient.invalidateQueries({ queryKey: ["recent-flags"] });
      toast.success("Flag resolved successfully", {
        description: "All users have been notified of the resolution.",
      });
      setIsResolving(null);
    },
    onError: (error) => {
      console.error("Error resolving flag:", error);
      toast.error("Failed to resolve flag", {
        description: "An error occurred while updating the status.",
      });
      setIsResolving(null);
    }
  });

  const handleResolve = (e: React.MouseEvent, record: any) => {
    e.stopPropagation();
    setIsResolving(record.id);
    resolveMutation.mutate({
      id: record.id,
      household_id: record.household_id,
      vca_id: record.vca_id
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "bg-amber-100 text-amber-700 hover:bg-amber-100";
      case "approved":
        return "bg-green-100 text-green-700 hover:bg-green-100";
      case "rejected":
        return "bg-red-100 text-red-700 hover:bg-red-100";
      case "resolved":
        return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
      default:
        return "bg-rose-100 text-rose-700 hover:bg-rose-100";
    }
  };

  const getPriority = (rec: any): "HIGH" | "MEDIUM" | "LOW" => {
    const p = String(rec?.priority || rec?.severity || rec?.risk_level || "").toLowerCase();
    if (p.includes("high") || p.includes("critical")) return "HIGH";
    if (p.includes("low")) return "LOW";
    return "MEDIUM";
  };

  const formatFlagDate = (d: any) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return String(d);
    }
  };

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout subtitle="Flags">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(244,63,94,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(16,185,129,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-rose-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-emerald-300/35 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-700">Data quality flags</span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge variant="outline" className="ml-1 gap-1 border-rose-200 bg-rose-50/80 text-[10px] text-rose-700">
                <Flag className="h-3 w-3" /> {user?.location ?? "All"}
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-rose-700 via-amber-600 to-emerald-700 bg-clip-text text-transparent">
                Flagged forms from the ECAP Plus
              </span>
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                <ClipboardCheck className="h-3 w-3" /> Review queue
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">Flagged forms requiring review and resolution.</p>
          </div>
        </div>
      </div>

      {/* Tab Filter */}
      <div className="mb-4 inline-flex rounded-xl bg-slate-100/80 p-1 backdrop-blur-sm">
        {(["all", "active", "resolved"] as const).map((tab) => {
          const count = tab === "all" ? counts.all : tab === "active" ? counts.active : counts.resolved;
          const activeCls = tab === "active"
            ? "bg-white text-rose-700 shadow-sm"
            : tab === "resolved"
              ? "bg-white text-emerald-700 shadow-sm"
              : "bg-white text-slate-800 shadow-sm";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                activeTab === tab ? activeCls : "text-slate-500 hover:text-slate-800",
              )}
            >
              {tab} <span className="ml-1 text-[10px] font-mono opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Resolution policy note (shown only on Resolved tab) */}
      {activeTab === "resolved" && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50/90 via-amber-50/60 to-emerald-50/40 px-4 py-3 shadow-[0_8px_24px_-18px_rgba(244,63,94,0.6)]">
          <div className="rounded-lg bg-rose-100 p-1.5 text-rose-700">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 text-xs text-slate-700 leading-relaxed">
            <strong className="text-rose-700">Resolution policy:</strong> Only tick a flag as resolved <strong>if and only if the caseworker has fixed the underlying issue</strong> on the actual record. Marking a flag as resolved without verifying the fix will hide real data-quality problems from this queue.
          </div>
        </div>
      )}

      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-rose-200/40 via-amber-200/25 to-emerald-200/20 opacity-50 blur-md" />
        <GlowCard>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-emerald-100/40 bg-gradient-to-r from-rose-50/30 via-amber-50/15 to-transparent">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-100 to-pink-100 text-rose-700 ring-1 ring-white/60 shadow-sm">
              <Flag className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-rose-800">
              {user?.location || "All districts"} flagged records
            </CardTitle>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search records…"
                className="pl-9 h-10 border-slate-200 bg-white focus-visible:ring-emerald-500/30"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-emerald-100/60">
            <Table>
              <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-rose-50/40">
                <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Subject</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 hidden lg:table-cell">Caseworker</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 hidden lg:table-cell">Flagged by</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 hidden md:table-cell">Comment</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 hidden lg:table-cell w-[120px]">Date</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 w-[90px]">Priority</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 w-[90px]">Status</TableHead>
                  <TableHead className="text-right w-[100px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flagsQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="flex items-center justify-center py-12">
                        <LoadingDots className="text-rose-500" />
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!flagsQuery.isLoading && filteredRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <div className="py-16 text-center">
                        <Flag className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-700">No flagged records found</p>
                        <p className="text-xs text-slate-400 mt-1">All records are clean or no data available.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {filteredRecords.map((record: any, index: number) => {
                  const status = String(record.status || "").toLowerCase();
                  const isResolved = status.includes("resolved") || status.includes("closed");
                  const priority = getPriority(record);
                  const formName = record.form_name || record.form_type || record.title || "Flagged form";
                  // Subject = household_id only (no caregiver name). Ward/facility
                  // shows beneath as the secondary line.
                  const subject = record.household_id
                    ? `HH ${record.household_id}`
                    : record.vca_id
                      ? `CA ${record.vca_id}`
                      : "—";
                  const wardOrFacility = record.facility || record.ward || record.district || "";

                  return (
                    <TableRow
                      key={record.id || index}
                      className="cursor-pointer transition-colors border-b border-emerald-50/60 hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                      onClick={() => handleRowClick(record.household_id)}
                    >
                      <TableCell className="align-top">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 leading-tight">{subject}</span>
                          {wardOrFacility && (
                            <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
                              {wardOrFacility}
                            </span>
                          )}
                          <div className="mt-1 flex flex-wrap gap-2 lg:hidden">
                            {record.caseworker_name && (
                              <span className="text-[10px] text-slate-500">CW: {record.caseworker_name}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell align-top text-xs text-slate-600">
                        {record.caseworker_name || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell align-top text-xs text-slate-600">
                        {pickValue(record, ["flagged_by", "user_created", "created_by", "verifier", "supervisor"])}
                      </TableCell>
                      <TableCell className="hidden md:table-cell align-top">
                        <p className="text-xs text-slate-600 leading-snug max-w-[260px] line-clamp-2" title={record.comment}>
                          {record.comment || <span className="text-slate-400 italic">No comment</span>}
                        </p>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell align-top">
                        <span className="font-mono text-[10px] text-slate-500">{formatFlagDate(record.date_created)}</span>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge className={cn(
                          "border-none text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full",
                          priority === "HIGH" ? "bg-rose-100 text-rose-700"
                            : priority === "MEDIUM" ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        )}>
                          {priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge className={cn(
                          "border-none text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full",
                          isResolved ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        )}>
                          {isResolved ? "Resolved" : (record.status?.toUpperCase() || "Active")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right align-top" onClick={(e) => e.stopPropagation()}>
                        {!isResolved && (
                          <button
                            type="button"
                            onClick={(e) => handleResolve(e, record)}
                            disabled={isResolving === record.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                          >
                            {isResolving === record.id ? <LoadingDots className="h-3" /> : (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Resolve
                              </>
                            )}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-xs text-slate-400 text-right">
            Showing {filteredRecords.length} records
          </div>
        </CardContent>
      </GlowCard>
      </div>
    </DashboardLayout>
  );
};

export default Flags;
