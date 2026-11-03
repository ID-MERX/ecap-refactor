import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Download,
  Activity,
  Calendar,
  MapPin,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  HeartPulse,
  Baby,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import LoadingDots from "@/components/aceternity/LoadingDots";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlowCard from "@/components/aceternity/GlowCard";
import { useFyFilter } from "@/context/FyFilterContext";
import { useEffectiveDistrict } from "@/hooks/useEffectiveDistrict";
import {
  getPmtctChildRegisterByDistrict,
  getPmtctMotherRegisterByDistrict,
  clearApiCache,
} from "@/lib/api";
import { ALL_DISTRICTS } from "@/constants/districts";
import { keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS_PER_PAGE = 50;

const pickValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "")
      return String(value);
  }
  return "N/A";
};

const pickPmctctId = (record: Record<string, unknown>) =>
  pickValue(record, [
    "pmtct_id",
    "pmtctid",
    "ecap_id",
    "ecapid",
    "mother_id",
    "motherid",
    "client_number",
    "client_no",
    "ca_id",
    "caid",
    "household_id",
    "householdId",
    "unique_id",
    "uid",
    "id",
  ]);

const formatDate = (date: any) => {
  if (!date || date === "N/A") return "N/A";
  try {
    let d = new Date(date);
    if (isNaN(d.getTime()) && typeof date === "string") {
      const parts = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (parts) d = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
    }
    if (isNaN(d.getTime())) return String(date);
    return d
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, "-");
  } catch {
    return String(date);
  }
};

const dateToTime = (date: any) => {
  if (!date || date === "N/A") return 0;
  const d = new Date(date);
  if (!Number.isNaN(d.getTime())) return d.getTime();
  const parts = String(date).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return parts ? new Date(`${parts[3]}-${parts[2]}-${parts[1]}`).getTime() : 0;
};

const PmtctRegister = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    district: initialDistrict,
    isRestrictedToDistrict,
    availableDistricts,
    isAdmin,
  } = useEffectiveDistrict();
  const { resolved: fy } = useFyFilter();
  const fyArg =
    fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;

  const [selectedDistrict, setSelectedDistrict] = useState(
    initialDistrict || (isAdmin ? "All Districts" : ""),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("register");
  const [isSyncing, setIsSyncing] = useState(false);
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    if (initialDistrict) setSelectedDistrict(initialDistrict);
    else if (isAdmin && !selectedDistrict) setSelectedDistrict("All Districts");
  }, [initialDistrict, isAdmin, selectedDistrict]);

  const districtsToFetch = useMemo(() => {
    if (selectedDistrict !== "All Districts") return [selectedDistrict];
    const actual = availableDistricts.filter((d) => d !== "All Districts");
    return actual.length > 0 ? actual : ALL_DISTRICTS;
  }, [selectedDistrict, availableDistricts]);

  // Server-side FY filtering — both endpoints accept a `fy` window, so there's
  // no need to also re-filter by date client-side (that used to be done here
  // and risked drifting out of sync with the backend's own date parsing).
  const childQueries = useQueries({
    queries: districtsToFetch.map((d) => ({
      queryKey: ["pmtct", "child-register", d, fy.mode, fy.fromDate, fy.toDate],
      queryFn: () => getPmtctChildRegisterByDistrict(d, fyArg),
      placeholderData: keepPreviousData,
      retry: 1,
    })),
  });

  const motherQueries = useQueries({
    queries: districtsToFetch.map((d) => ({
      queryKey: [
        "pmtct",
        "mother-register",
        d,
        fy.mode,
        fy.fromDate,
        fy.toDate,
      ],
      queryFn: () => getPmtctMotherRegisterByDistrict(d, fyArg),
      placeholderData: keepPreviousData,
      retry: 1,
    })),
  });

  const isLoading =
    childQueries.some((q) => q.isLoading) ||
    motherQueries.some((q) => q.isLoading);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await clearApiCache();
      await queryClient.invalidateQueries({ queryKey: ["pmtct"] });
      toast.success("Data synced successfully");
    } catch {
      toast.error("Sync failed");
    }
    setIsSyncing(false);
  };

  // HEI/infant records — used only for the DBS-per-district chart and the
  // "Infants (HEI)" count. NOT shown in the register table: a mother's linked
  // HEI(s) belong on her own profile page (PmtctProfile.tsx), joined by the
  // shared pmtct_id, not interleaved as separate rows here.
  const allInfants = useMemo(() => {
    return childQueries
      .flatMap((q) => (q.data ?? []) as Array<Record<string, unknown>>)
      .map((v) => ({
        id: pickPmctctId(v),
        householdId: pickValue(v, ["ca_id", "child_id", "unique_id"]),
        hivStatus: pickValue(v, [
          "test_result_at_birth",
          "infant_hiv_status",
          "hiv_status",
        ]),
        facility: pickValue(v, ["facility", "facility_name"]),
        district: pickValue(v, ["district", "district_name"]),
        type: "Infant (HEI)" as const,
        ancDate: pickValue(v, [
          "dbs_at_birth_actual_date",
          "dbs_at_birth_due_date",
          "date_tested",
        ]),
        raw: v,
      }));
  }, [childQueries]);

  // Register list — MOTHERS ONLY.
  const pmtctData = useMemo(() => {
    let result = motherQueries
      .flatMap((q) => (q.data ?? []) as Array<Record<string, unknown>>)
      .map((m) => ({
        id: pickPmctctId(m),
        householdId: pickValue(m, ["ecap_id", "household_id", "hh_id"]),
        // Every enrolled PMTCT mother is HIV+ by the program's own enrolment
        // criteria — a real, definitional fact, not a guess at a status field
        // that may not even exist on this table.
        hivStatus: "HIV Positive",
        facility: pickValue(m, ["facility", "facility_name"]),
        district: pickValue(m, ["district", "district_name"]),
        type: "Mother" as const,
        ancDate: pickValue(m, [
          "date_enrolled_pmtct",
          "date_1st_visit",
          "date_tested",
        ]),
        raw: m,
      }));

    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase();
      result = result.filter(
        (item) =>
          item.id.toLowerCase().includes(query) ||
          item.householdId.toLowerCase().includes(query) ||
          item.facility.toLowerCase().includes(query) ||
          item.district.toLowerCase().includes(query),
      );
    }

    result.sort((a, b) => dateToTime(b.ancDate) - dateToTime(a.ancDate));
    return result;
  }, [motherQueries, deferredSearch]);

  // Stats
  const stats = useMemo(() => {
    const motherCount = pmtctData.length;
    const infantCount = allInfants.length;
    const total = motherCount;
    // Every enrolled PMTCT mother is HIV+ by definition — a real fact about
    // the cohort, not a fabricated/derived number.
    const hivPositive = motherCount;

    // Final Outcomes (DBS) for HEIs per district — replaces "HIV Status by
    // Beneficiary Type", which told users nothing (every PMTCT mother is
    // HIV+ by definition, so a mother-vs-infant positive split isn't
    // informative). Uses the real pmtct_child_register.test_result_at_birth
    // field (surfaced above as hivStatus via pickValue) — values are exactly
    // "D" (detected) or "ND" (not detected) in the live data; anything else
    // (blank, or placeholder junk some rows have) is counted as pending, not
    // invented as a third real outcome.
    const dbsDistrictMap = new Map<
      string,
      {
        district: string;
        detected: number;
        notDetected: number;
        pending: number;
      }
    >();
    allInfants.forEach((d) => {
      const dist = d.district === "N/A" ? "Unknown" : d.district;
      if (!dbsDistrictMap.has(dist)) {
        dbsDistrictMap.set(dist, {
          district: dist,
          detected: 0,
          notDetected: 0,
          pending: 0,
        });
      }
      const entry = dbsDistrictMap.get(dist)!;
      const result = d.hivStatus.trim().toUpperCase();
      if (result === "D") entry.detected++;
      else if (result === "ND") entry.notDetected++;
      else entry.pending++;
    });
    const dbsOutcomesByDistrict = Array.from(dbsDistrictMap.values()).sort(
      (a, b) =>
        b.detected +
        b.notDetected +
        b.pending -
        (a.detected + a.notDetected + a.pending),
    );

    // By facility (top 8) — mothers, matching the register list.
    const facilityMap = new Map<string, number>();
    pmtctData.forEach((d) => {
      const f = d.facility === "N/A" ? "Unknown" : d.facility;
      facilityMap.set(f, (facilityMap.get(f) || 0) + 1);
    });
    const byFacility = Array.from(facilityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([facility, count]) => ({
        facility:
          facility.length > 18 ? facility.slice(0, 16) + "..." : facility,
        count,
      }));

    // Pie data for type distribution
    const typeDistribution = [
      { name: "Mothers", value: motherCount, color: "#ec4899" },
      { name: "Infants (HEI)", value: infantCount, color: "#0ea5e9" },
    ].filter((d) => d.value > 0);

    // Enrolment trend by month (last 6 months) — mothers, matching the
    // register list.
    const monthMap = new Map<string, number>();
    pmtctData.forEach((d) => {
      const t = dateToTime(d.ancDate);
      if (t) {
        const dt = new Date(t);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }
    });
    const enrolmentTrend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => {
        const [y, m] = month.split("-");
        const label = new Date(Number(y), Number(m) - 1).toLocaleString("en", {
          month: "short",
          year: "2-digit",
        });
        return { month: label, enrolments: count };
      });

    return {
      total,
      infantCount,
      motherCount,
      hivPositive,
      dbsOutcomesByDistrict,
      byFacility,
      typeDistribution,
      enrolmentTrend,
    };
  }, [pmtctData, allInfants]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return pmtctData.slice(start, start + ITEMS_PER_PAGE);
  }, [pmtctData, currentPage]);

  const totalPages = Math.ceil(pmtctData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      )
        pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const handleExportCsv = () => {
    if (pmtctData.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    const headers = [
      "PMTCT ID",
      "Type",
      "HIV Status",
      "Enrolment Date",
      "Facility",
      "District",
    ];
    const rows = pmtctData.map((item) => [
      item.id,
      item.type,
      item.hivStatus,
      formatDate(item.ancDate),
      item.facility,
      item.district,
    ]);
    downloadCsv(
      `pmtct-register-${selectedDistrict.toLowerCase().replace(/\s+/g, "-")}.csv`,
      headers,
      rows,
    );
    toast.success("Register exported successfully.");
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setCurrentPage(1);
    toast.info("All filters have been reset.");
  };

  return (
    <DashboardLayout
      subtitle={activeTab === "charts" ? "PMTCT Charts" : "PMTCT Register"}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* ── Aurora hero ──────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
          <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
          <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-teal-300/35 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

          <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                  PMTCT register
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
                >
                  <Activity className="h-3 w-3" />{" "}
                  {isLoading ? "—" : stats.total.toLocaleString()} records
                </Badge>
                <Badge
                  variant="outline"
                  className="gap-1 border-slate-200 bg-white/70 text-[10px] text-slate-600"
                >
                  <MapPin className="h-3 w-3" /> {selectedDistrict}
                </Badge>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                  Prevention of mother-to-child transmission
                </span>
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Mother &amp; infant pairs, HIV exposure, and follow-up status.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <button
                onClick={handleSync}
                className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5",
                    (isLoading || isSyncing) && "animate-spin",
                  )}
                />
                Sync data
              </button>
              {!isRestrictedToDistrict && (
                <Select
                  value={selectedDistrict}
                  onValueChange={(val) => {
                    setSelectedDistrict(val);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[180px] h-9 bg-white/80 border-slate-200 backdrop-blur-md text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <SelectValue placeholder="All Districts" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All Districts">All Districts</SelectItem>
                    {availableDistricts
                      .filter((d) => d !== "All Districts")
                      .map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-6">
            <TabsList className="bg-slate-100/50 p-1 rounded-xl h-11 w-full max-w-md border border-slate-200">
              <TabsTrigger
                value="register"
                className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wider transition-all"
              >
                <Users className="h-3.5 w-3.5 mr-2" />
                Register
              </TabsTrigger>
              <TabsTrigger
                value="charts"
                className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm font-bold text-xs uppercase tracking-wider transition-all"
              >
                <TrendingUp className="h-3.5 w-3.5 mr-2" />
                Charts
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Charts Tab */}
          <TabsContent
            value="charts"
            className="space-y-6 animate-in slide-in-from-left-4 duration-500"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  title: "Total Records",
                  value: stats.total,
                  icon: Users,
                  color: "bg-emerald-500",
                },
                {
                  title: "Infants (HEI)",
                  value: stats.infantCount,
                  icon: Baby,
                  color: "bg-sky-500",
                },
                {
                  title: "Mothers",
                  value: stats.motherCount,
                  icon: HeartPulse,
                  color: "bg-pink-500",
                },
                {
                  title: "HIV Positive",
                  value: stats.hivPositive,
                  icon: AlertCircle,
                  color: "bg-rose-500",
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -2 }}
                  className="cursor-pointer"
                  onClick={() => setActiveTab("register")}
                >
                  <Card className="rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {card.title}
                        </span>
                        <div
                          className={cn(
                            "p-2 rounded-lg bg-opacity-10",
                            card.color,
                            card.color.replace("bg-", "text-"),
                          )}
                        >
                          <card.icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-slate-900">
                          {isLoading ? (
                            <LoadingDots />
                          ) : (
                            card.value.toLocaleString()
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Click to view register
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Final Outcomes (DBS) for HEIs per District */}
              <Card className="rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Final Outcomes (DBS) for HEIs per District
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Dried Blood Spot test result at birth, by district
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 h-[300px]">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <LoadingDots />
                    </div>
                  ) : stats.dbsOutcomesByDistrict.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.dbsOutcomesByDistrict}
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          dataKey="district"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 10,
                            fontWeight: 600,
                            fill: "#64748b",
                          }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          }}
                          cursor={{ fill: "#f8fafc" }}
                        />
                        <Bar
                          dataKey="detected"
                          name="Detected"
                          fill="#f43f5e"
                          radius={[4, 4, 0, 0]}
                          barSize={16}
                        />
                        <Bar
                          dataKey="notDetected"
                          name="Not Detected"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          barSize={16}
                        />
                        <Bar
                          dataKey="pending"
                          name="Pending/Unrecorded"
                          fill="#94a3b8"
                          radius={[4, 4, 0, 0]}
                          barSize={16}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">
                      No HEI DBS records available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Records by Facility */}
              <Card className="rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Records by Facility
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Top 8 facilities by caseload
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 h-[300px]">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <LoadingDots />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={stats.byFacility}
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis type="number" hide />
                        <YAxis
                          dataKey="facility"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 10,
                            fontWeight: 600,
                            fill: "#64748b",
                          }}
                          width={120}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Bar
                          dataKey="count"
                          name="Records"
                          fill="#0d9488"
                          radius={[0, 4, 4, 0]}
                          barSize={14}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row: Enrolment Trend + Type Distribution */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Enrolment Trend */}
              <Card className="rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Enrolment Trend
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Monthly enrolments over last 6 months
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 h-[300px]">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <LoadingDots />
                    </div>
                  ) : stats.enrolmentTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={stats.enrolmentTrend}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="enrolmentGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#0d9488"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0d9488"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 11,
                            fontWeight: 600,
                            fill: "#64748b",
                          }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="enrolments"
                          name="Enrolments"
                          stroke="#0d9488"
                          strokeWidth={2}
                          fill="url(#enrolmentGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">
                      No enrolment date data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Type Distribution Pie */}
              <Card className="rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Beneficiary Type Distribution
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Mothers vs Infants breakdown
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 h-[300px] flex flex-col">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <LoadingDots />
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.typeDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius="40%"
                              outerRadius="70%"
                              paddingAngle={4}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {stats.typeDistribution.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                borderRadius: "12px",
                                border: "none",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center gap-6 pt-2">
                        {stats.typeDistribution.map((entry, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-xs font-bold text-slate-600">
                              {entry.name}
                            </span>
                            <span className="text-xs font-bold text-slate-900">
                              {entry.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent
            value="register"
            className="space-y-4 animate-in slide-in-from-right-4 duration-500"
          >
            <GlowCard noHover>
              <CardHeader className="py-6 px-8 border-b border-slate-50">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by ID, HHID or facility..."
                      className="pl-10 h-11 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-[#00a67e] transition-all font-medium"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={handleClearFilters}
                      className="h-10 rounded-xl px-4 text-xs font-bold text-slate-600 border-slate-200"
                    >
                      Clear Filters
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-all shadow-sm px-4 text-xs uppercase tracking-wider"
                      onClick={handleExportCsv}
                      disabled={isLoading || pmtctData.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2 text-slate-400" />
                      EXPORT CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40">
                      <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                        <TableHead className="py-4 pl-8 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          PMTCT ID
                        </TableHead>
                        <TableHead className="py-4 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          HIV Status
                        </TableHead>
                        <TableHead className="py-4 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Enrolment Date
                        </TableHead>
                        <TableHead className="py-4 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Facility
                        </TableHead>
                        <TableHead className="py-4 text-right pr-8 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-24 text-center">
                            <LoadingDots className="text-[#00a67e] font-bold" />
                          </TableCell>
                        </TableRow>
                      ) : paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-24 text-center">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="rounded-full bg-slate-50 p-4 shadow-inner">
                                <Activity className="h-8 w-8 text-slate-300" />
                              </div>
                              <p className="mt-4 text-sm text-slate-500 font-medium">
                                No PMTCT records found
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedData.map((item, i) => (
                          <TableRow
                            key={`${item.id}-${i}`}
                            className="group border-b border-emerald-50/60 last:border-0 transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                          >
                            <TableCell className="py-4 pl-8 font-mono text-xs font-semibold text-[#00a67e]">
                              {item.id}
                            </TableCell>
                            <TableCell>
                              <Badge className="font-bold text-[10px] tracking-wide px-2 py-0.5 border-none bg-rose-100 text-rose-700">
                                {item.hivStatus.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <span className="text-sm text-slate-700">
                                  {formatDate(item.ancDate)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-700">
                                  {item.facility}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                  {item.district}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right pr-8">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-50"
                                onClick={() => {
                                  const record = {
                                    ...item.raw,
                                    hivStatus: item.hivStatus,
                                    district: item.district,
                                    category: item.type,
                                  };
                                  try {
                                    sessionStorage.setItem(
                                      "pmtct_profile_record",
                                      JSON.stringify(record),
                                    );
                                  } catch {
                                    // ignore storage failures
                                  }
                                  navigate("/profile/pmtct-details", {
                                    state: { record },
                                  });
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-8 px-8 border-t border-slate-50 bg-slate-50/30">
                  <div className="text-xs text-slate-500 font-medium">
                    Showing {pmtctData.length > 0 ? startIndex + 1 : 0} to{" "}
                    {Math.min(startIndex + ITEMS_PER_PAGE, pmtctData.length)} of{" "}
                    {pmtctData.length} entries
                  </div>

                  {totalPages > 1 && (
                    <Pagination className="justify-end w-auto mx-0">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            className={cn(
                              "cursor-pointer h-8 w-8 p-0 rounded-lg border-slate-200 bg-white hover:bg-slate-50",
                              currentPage === 1 &&
                                "pointer-events-none opacity-50",
                            )}
                          />
                        </PaginationItem>
                        {getPageNumbers().map((page, i) => (
                          <PaginationItem key={i}>
                            {page === "..." ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                isActive={currentPage === page}
                                onClick={() => setCurrentPage(page as number)}
                                className="cursor-pointer h-8 w-8 text-xs font-bold rounded-lg border-slate-200"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            className={cn(
                              "cursor-pointer h-8 w-8 p-0 rounded-lg border-slate-200 bg-white hover:bg-slate-50",
                              currentPage === totalPages &&
                                "pointer-events-none opacity-50",
                            )}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              </CardContent>
            </GlowCard>
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
};

export default PmtctRegister;
