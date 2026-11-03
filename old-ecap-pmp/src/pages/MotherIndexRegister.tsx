import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, Search, Download, Plus, Minus, Eye, Users, MapPin, Sparkles, Activity, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import PageIntro from "@/components/dashboard/PageIntro";
import GlowCard from "@/components/aceternity/GlowCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffectiveDistrict } from "@/hooks/useEffectiveDistrict";
import { useFyFilter } from "@/context/FyFilterContext";
import { ALL_DISTRICTS } from "@/constants/districts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clearApiCache, getMothersByDistrict, getTotalMothersCount } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { keepPreviousData } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 50;

const subPopulationFilterLabels: Record<string, string> = {
  hei: "HEI Status",
  hiv_pos: "HIV Positive",
  on_art: "On ART",
  linked: "Linked",
};

const pickValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "" && value !== 0) return String(value);
  }
  return "N/A";
};

const formatDate = (value: string) => {
  if (!value || value === "N/A") return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date).replace(/\//g, "-");
};

const MotherIndexRegister = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { district: initialDistrict, isRestrictedToDistrict, availableDistricts, isAdmin } = useEffectiveDistrict();
  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;

  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict || (isAdmin ? "All Districts" : ""));
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [subPopulationFilters, setSubPopulationFilters] = useState<Record<string, string>>(
    Object.keys(subPopulationFilterLabels).reduce((acc, key) => ({ ...acc, [key]: "all" }), {})
  );
  const [dateFilter, setDateFilter] = useState("any");
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    if (initialDistrict) setSelectedDistrict(initialDistrict);
    else if (isAdmin && !selectedDistrict) setSelectedDistrict("All Districts");
  }, [initialDistrict, isAdmin, selectedDistrict]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, subPopulationFilters, dateFilter]);

  const allDistrictQuery = useQuery({
    queryKey: ["mothers", "district", selectedDistrict, fy.mode, fy.fromDate, fy.toDate],
    queryFn: () => getMothersByDistrict(selectedDistrict, fyArg),
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const countQuery = useQuery({
    queryKey: ["mothers", "count", selectedDistrict, fy.mode, fy.fromDate, fy.toDate],
    queryFn: () => {
      if (selectedDistrict === "All Districts") return getTotalMothersCount();
      return getMothersByDistrict(selectedDistrict, fyArg).then((data) => data.length);
    },
    placeholderData: keepPreviousData,
  });

  const rawMothers = useMemo(() => {
    const data = allDistrictQuery.data || [];

    const unique = new Map<string, any>();
    data.forEach((record) => {
      const mId = pickValue(record, ["mother_id", "household_id", "ecap_id", "id", "unique_id"]);
      if (!mId || mId === "N/A") return;
      if (!unique.has(mId)) unique.set(mId, record);
    });

    let filtered = Array.from(unique.values()).filter((record) => {
      const rec = record as Record<string, unknown>;
      for (const [key, value] of Object.entries(subPopulationFilters)) {
        if (value === "all") continue;
        const fieldMap: Record<string, string[]> = {
          hei: ["hei", "hei_status"],
          hiv_pos: ["art_status", "caregiver_hiv_status", "hiv_status"],
          on_art: ["on_art", "art_linkage"],
          linked: ["linked", "linkage_status"],
        };
        const v = pickValue(rec, fieldMap[key] || []);
        const normalized = v.toLowerCase();
        if (value === "yes" && !["yes", "true", "1", "active", "positive"].includes(normalized)) return false;
        if (value === "no" && !["no", "false", "0", "", "n/a", "negative"].includes(normalized)) return false;
      }
      if (dateFilter !== "any") {
        const dateStr = pickValue(rec, ["updated_at", "last_service_date", "last_edited", "anc_date", "registration_date"]);
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return false;
        const diffDays = Math.ceil(Math.abs(Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (dateFilter === "30_days" && diffDays > 30) return false;
        if (dateFilter === "90_days" && diffDays > 90) return false;
        if (dateFilter === "this_year" && d.getFullYear() !== new Date().getFullYear()) return false;
      }
      return true;
    });

    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();
      filtered = filtered.filter((record) => {
        const id = pickValue(record, ["mother_id", "household_id", "ecap_id", "id", "unique_id"]).toLowerCase();
        const facility = pickValue(record, ["facility", "facility_name"]).toLowerCase();
        return id.includes(q) || facility.includes(q);
      });
    }

    filtered.sort((a, b) => {
      const getDate = (rec: any) => {
        const d = rec.updated_at || rec.date_created || rec.created_at || rec.anc_date;
        return d ? new Date(d).getTime() : 0;
      };
      return getDate(b) - getDate(a);
    });
    return filtered;
  }, [allDistrictQuery.data, subPopulationFilters, dateFilter, deferredSearch]);

  const totalPages = Math.ceil(rawMothers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMothers = rawMothers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const totalMothers = rawMothers.length;
  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const handleSync = async () => {
    await clearApiCache();
    await queryClient.invalidateQueries({ queryKey: ["mothers"] });
    toast.success("Mother index data refreshed.");
  };

  const handleExportCsv = () => {
    if (!rawMothers.length) return;
    const headers = ["No.", "Mother ID", "District", "Facility", "ART Status"];
    const rows = rawMothers.map((m, index) => {
      const rec = m as Record<string, unknown>;
      return [
        index + 1,
        pickValue(rec, ["mother_id", "household_id", "ecap_id", "id", "unique_id"]),
        pickValue(rec, ["district", "district_name"]),
        pickValue(rec, ["facility", "facility_name"]),
        pickValue(rec, ["art_status", "caregiver_hiv_status", "hiv_status"]),
      ];
    });
    downloadCsv(`index-mothers-${selectedDistrict.toLowerCase().replace(/\s+/g, "-")}.csv`, headers, rows);
    toast.success("Register exported.");
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSubPopulationFilters(Object.keys(subPopulationFilterLabels).reduce((acc, key) => ({ ...acc, [key]: "all" }), {}));
    setDateFilter("any");
    setCurrentPage(1);
  };

  const toggleRow = (rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
      return next;
    });
  };

  return (
    <DashboardLayout subtitle="Mother Index Register">
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
          <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Mother index register</span>
                <span className="text-slate-400 text-[11px]">·</span>
                <span className="text-[11px] text-slate-600">{dateStr}</span>
                <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"><Activity className="h-3 w-3" /> {countQuery.data ?? 0} records</Badge>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">All registered mothers</span>
                <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm"><Sparkles className="h-3 w-3" /> Active mothers only</Badge>
              </h1>
              <p className="mt-1 text-xs text-slate-600">Index mother records with sub-population filters and CSV export.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <Button variant="outline" onClick={handleSync}><RefreshCw className="mr-2 h-4 w-4" /> Sync</Button>
              <Button onClick={handleExportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
              {!isRestrictedToDistrict && (
                <Select value={selectedDistrict} onValueChange={(val) => setSelectedDistrict(val)}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Districts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Districts">All Districts</SelectItem>
                    {availableDistricts.filter((d) => d !== "All Districts").map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <GlowCard noHover>
          <CardHeader className="py-6 px-8 border-b border-slate-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search by ID or facility..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 bg-white border-slate-200 focus-visible:ring-emerald-500/30" />
              </div>
              <Button variant="outline" onClick={handleClearFilters} className="h-10 rounded-xl px-4 text-xs font-bold text-slate-600 border-slate-200">Clear Filters</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Mother category</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {Object.entries(subPopulationFilterLabels).map(([key, label]) => {
                  const value = subPopulationFilters[key] ?? "all";
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 truncate" title={label}>{label}</span>
                      <div className="flex shrink-0 rounded-md bg-slate-100 p-0.5">
                        {(["all", "yes", "no"] as const).map((option) => (
                          <button key={option} onClick={() => setSubPopulationFilters((prev) => ({ ...prev, [key]: option }))} className={cn("px-2 py-1 text-[10px] uppercase tracking-wide font-bold rounded", value === option ? option === "yes" ? "bg-emerald-600 text-white" : option === "no" ? "bg-rose-500 text-white" : "bg-white text-slate-700" : "text-slate-500")}>{option}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-100/60 overflow-hidden">
              <Table>
                <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40">
                  <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                    <TableHead className="w-[40px]" />
                    <TableHead className="w-[140px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">Mother ID</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">District</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Facility</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">HIV Status</TableHead>
                    <TableHead className="text-right w-[60px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countQuery.isLoading || allDistrictQuery.isLoading ? (
                    <TableRow><TableCell colSpan={6} className="py-24 text-center"><LoadingDots /></TableCell></TableRow>
                  ) : paginatedMothers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="rounded-full bg-slate-50 p-4 shadow-inner"><HeartPulse className="h-8 w-8 text-slate-300" /></div>
                          <p className="mt-4 text-sm text-slate-500 font-medium max-w-[280px]">No records found for the current filters.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedMothers.map((mother, index) => {
                      const record = mother as Record<string, unknown>;
                      const rowId = `${pickValue(record, ["mother_id", "household_id", "ecap_id", "id", "unique_id"])}-${index}`;
                      const isExpanded = expandedRows.has(rowId);
                      const artStatus = pickValue(record, ["art_status", "caregiver_hiv_status", "hiv_status"]);
                      return (
                        <Fragment key={rowId}>
                          <TableRow className="group border-b border-emerald-50/60 transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent">
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-slate-100" onClick={() => toggleRow(rowId)}>
                                {isExpanded ? <Minus className="h-4 w-4 text-slate-500" /> : <Plus className="h-4 w-4 text-slate-500" />}
                              </Button>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-rose-600">{pickValue(record, ["mother_id", "household_id", "ecap_id", "id", "unique_id"])}</TableCell>
                            <TableCell className="text-slate-600">{pickValue(record, ["district", "district_name"])}</TableCell>
                            <TableCell className="text-slate-600">{pickValue(record, ["facility", "facility_name"])}</TableCell>
                            <TableCell>
                              <Badge className={cn("border-none px-2 py-0.5 text-[10px] font-bold uppercase", artStatus.toLowerCase().includes("positive") ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")}>{artStatus}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] sm:h-8 sm:px-3 sm:text-xs" onClick={() => navigate("/profile/mother-index-details", { state: { record } })}><Eye className="mr-1 h-3.5 w-3.5" />View</Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-slate-50/40">
                              <TableCell colSpan={6} className="p-0">
                                <div className="px-8 py-4 text-xs text-slate-600">Updated: {formatDate(pickValue(record, ["updated_at", "last_edited", "date_updated", "registration_date"]))}</div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </GlowCard>
      </div>
    </DashboardLayout>
  );
};

export default MotherIndexRegister;
