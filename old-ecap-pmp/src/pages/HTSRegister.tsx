import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Download,
  HeartPulse,
  Baby,
  Activity,
  Info,
  MapPin,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHtsRegisterByDistrict, clearApiCache } from "@/lib/api";
import { useEffectiveDistrict } from "@/hooks/useEffectiveDistrict";
import { useFyFilter } from "@/context/FyFilterContext";
import { useAuth } from "@/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 50;

const pickValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "N/A";
};

const HtsRegister = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    district: initialDistrict,
    isRestrictedToDistrict,
    availableDistricts,
    isAdmin,
    isProvinceUser,
    province: userProvince,
  } = useEffectiveDistrict();

  const ALL = "All Districts";
  // District Users are hard-locked to their own district — re-enforced
  // below on every user change (e.g. token refresh) so a stale unlocked
  // selection can never survive that.
  const lockedDistrict =
    isRestrictedToDistrict && user?.location ? user.location : null;

  const [selectedDistrict, setSelectedDistrict] = useState(
    lockedDistrict ?? (initialDistrict || (isAdmin ? ALL : "")),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("register");
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    if (lockedDistrict) {
      if (selectedDistrict !== lockedDistrict)
        setSelectedDistrict(lockedDistrict);
    } else if (initialDistrict) {
      setSelectedDistrict(initialDistrict);
    } else if (isAdmin && !selectedDistrict) {
      setSelectedDistrict(ALL);
    }
    // Intentionally omit selectedDistrict from deps for the locked branch
    // to avoid a set-state loop; the locked branch re-checks on every
    // run anyway since lockedDistrict is derived fresh from `user`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedDistrict, initialDistrict, isAdmin]);

  const { resolved: fy } = useFyFilter();
  const fyArg =
    fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;

  // Single fetch, filtered client-side — the backend's
  // /hts-register-by-district/:district(*) route IGNORES the district (and
  // province) path segment entirely and always returns the full national
  // register (see the route's own doc comment in lib/api.ts). Fetching
  // per-district here would fire N redundant identical requests and, if
  // the result were trusted as pre-scoped, would silently show nationwide
  // data mislabeled as a single district. FY filtering is similarly
  // undocumented/unreliable server-side, so it's re-applied client-side
  // below regardless of whether fyArg was honoured.
  const htsQuery = useQuery({
    queryKey: ["hts-register", "all", fy.mode, fy.fromDate, fy.toDate],
    queryFn: () => getHtsRegisterByDistrict(ALL, fyArg),
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const isLoading = htsQuery.isLoading;
  const isSyncing = htsQuery.isFetching;

  const handleSync = async () => {
    try {
      await clearApiCache();
      await queryClient.invalidateQueries({ queryKey: ["hts-register"] });
      toast.success("HTS Register data synced successfully");
    } catch {
      toast.error("Sync failed");
    }
  };

  const baseHtsData = useMemo(() => {
    const allHtsRecords: any[] = (htsQuery.data as any[]) ?? [];

    return allHtsRecords
      .filter((record) => {
        // Provincial users are scoped to their own province.
        if (
          isProvinceUser &&
          userProvince &&
          record.province !== userProvince
        ) {
          return false;
        }
        // Client-side district match (case/whitespace-insensitive) —
        // the server never actually filters by district, see comment
        // on htsQuery above.
        if (selectedDistrict !== ALL) {
          const recordDistrict = String(record.district ?? "")
            .trim()
            .toLowerCase();
          if (recordDistrict !== selectedDistrict.trim().toLowerCase())
            return false;
        }
        return true;
      })
      .map((record) => {
        const age = parseInt(String(record.individual_age || record.age || 0));
        const inferredType = age < 20 ? "CA (Child)" : "Mother/Adult";

        return {
          id: pickValue(record, [
            "client_number",
            "unique_id",
            "uid",
            "vca_id",
            "mother_id",
            "id",
            "hts_id",
          ]),
          caseworker: pickValue(record, [
            "caseworker_name",
            "caseworker",
            "cw_name",
            "assigned_to",
            "provider",
          ]),
          type:
            pickValue(record, ["type", "record_type"]).toLowerCase() !== "n/a"
              ? pickValue(record, ["type", "record_type"])
                  .toLowerCase()
                  .includes("child")
                ? "CA (Child)"
                : "Mother"
              : inferredType,
          status: pickValue(record, [
            "hiv_result",
            "hiv_status",
            "status",
            "art_status",
            "current_hiv_status",
          ]),
          facility: pickValue(record, [
            "health_facility",
            "facility",
            "facility_name",
          ]),
          district: pickValue(record, ["district", "district_name"]),
          raw: record,
        };
      })
      .filter((item) => {
        const s = item.status.toLowerCase();
        return s !== "n/a" && s !== "" && s !== "unknown";
      });
  }, [htsQuery.data, selectedDistrict, isProvinceUser, userProvince]);

  // ── Time period filter ─────────────────────────────────────────────────
  // Filters the dataset by HIV test date before computing all stats / charts.
  // Defaults to "All time" so first-paint numbers match the lifetime totals.
  const [timePeriod, setTimePeriod] = useState<
    "all" | "fy" | "quarter" | "month" | "30d" | "90d"
  >("all");

  // Robust date parser. OpenSRP / ECAP stores HTS dates as DD-MM-YYYY
  // (e.g. "30-10-2025") which `new Date()` parses as Invalid Date.
  // Try ISO first, then fall back to a DD-MM-YYYY / DD/MM/YYYY regex.
  const parseHtsDate = (raw: any): Date | null => {
    if (raw === null || raw === undefined || raw === "") return null;
    const s = String(raw).trim();
    if (!s) return null;
    const iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;
    const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2}|\d{4})$/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    let year = Number(m[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  };

  const getRecordDate = (item: any): Date | null => {
    const r = item.raw || {};
    // Prefer `date_created` — the timestamp of when the record was
    // entered into OpenSRP. `date_tested` is often backdated by months
    // (field workers entering historical paper records), which made
    // time-period filters return zero recent rows. date_created stays
    // in step with calendar time.
    const candidates = [
      r.date_created,
      r.datecreated,
      r.date_client_created,
      r.created_at,
      r.date_tested,
      r.test_date,
      r.hiv_test_date,
      r.date_edited,
      r.date_screened,
      r.art_date_initiated,
    ];
    for (const c of candidates) {
      const d = parseHtsDate(c);
      if (d) return d;
    }
    return null;
  };

  // Global quick FY toggle (header-level, shared with PmtctRegister.tsx)
  // applied client-side against each record's resolved date, since the
  // server-side ?from=&to= for this endpoint isn't reliable either (see
  // the comment on htsQuery above). Runs before the local "Time period"
  // dropdown below so the two filters stack (FY narrows the pool, the
  // dropdown narrows further within it).
  const fyFilteredHts = useMemo(() => {
    if (!fy.fromDate || !fy.toDate) return baseHtsData;
    const from = new Date(fy.fromDate).getTime();
    const to = new Date(`${fy.toDate}T23:59:59Z`).getTime();
    return baseHtsData.filter((item) => {
      const d = getRecordDate(item);
      if (!d) return false;
      const t = d.getTime();
      return t >= from && t <= to;
    });
  }, [baseHtsData, fy.fromDate, fy.toDate]);

  // Latest test date in the loaded dataset. Used as the reference point for
  // the relative time-period filters. This way "Last 30 days" actually
  // means "30 days ending on the most recent test on file" — useful even
  // when the source data hasn't been refreshed in a while.
  const dataMaxDate = useMemo(() => {
    let max: Date | null = null;
    fyFilteredHts.forEach((item) => {
      const d = getRecordDate(item);
      if (d && (!max || d > max)) max = d;
    });
    return max ?? new Date();
  }, [fyFilteredHts]);

  const periodFilteredHts = useMemo(() => {
    if (timePeriod === "all") return fyFilteredHts;

    // Reference point is the latest record on file, NOT today's calendar
    // date. The HTS data can lag months behind the dashboard build, and
    // anchoring to "today" would silently return zero records for every
    // recent-window filter. Using max-date keeps the filters useful and
    // is signposted to the user via a "Relative to ..." tooltip.
    const ref = dataMaxDate;
    let from: Date;
    if (timePeriod === "fy") {
      // PEPFAR FY: the fiscal year containing the reference date.
      const yr =
        ref.getMonth() >= 9 ? ref.getFullYear() : ref.getFullYear() - 1;
      from = new Date(yr, 9, 1);
    } else if (timePeriod === "quarter") {
      from = new Date(ref.getFullYear(), Math.floor(ref.getMonth() / 3) * 3, 1);
    } else if (timePeriod === "month") {
      from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    } else if (timePeriod === "30d") {
      from = new Date(ref.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      from = new Date(ref.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    return fyFilteredHts.filter((item) => {
      const d = getRecordDate(item);
      if (!d) return false;
      return d >= from && d <= ref;
    });
  }, [fyFilteredHts, timePeriod, dataMaxDate]);

  const stats = useMemo(() => {
    const counts = {
      total: periodFilteredHts.length,
      newPositives: 0,
      unlinkedPositives: 0,
      pendingOutcomes: 0,
    };

    // Group by DISTRICT — each district keeps a running total of tested
    // and positives so we can render both "Testing Volume and Positives"
    // and "Yield" from the same map.
    const districtDataMap = new Map<
      string,
      { district: string; total: number; positives: number }
    >();

    periodFilteredHts.forEach((item) => {
      // Real hts_register values (from hiv_result / hiv_status, whichever
      // is populated — see pickValue above) are "Newly Tested HIV+" /
      // "Newly Tested HIV-" or "Known Positive" / "Known Negative". A
      // plain substring match on "positive"/"reactive"/"pending" alone
      // silently undercounted positives by ~86% (only "Known Positive"
      // matches "positive" as a substring; the majority-format "Newly
      // Tested HIV+" rows do not, and need the "hiv+" check).
      const status = (item.status || "").toLowerCase();
      const isPositive =
        status.includes("hiv+") || status.includes("known positive");
      const isNegative =
        status.includes("hiv-") || status.includes("known negative");
      const isPending = !isPositive && !isNegative;

      const raw = item.raw || {};
      const artNo = pickValue(raw, [
        "case_art_number",
        "art_number",
        "art_no",
        "vca_art_number",
        "art_status",
      ]);
      const isLinked =
        artNo !== "N/A" && artNo !== "" && !artNo.toLowerCase().includes("not");

      if (isPositive) {
        counts.newPositives++;
        if (!isLinked) counts.unlinkedPositives++;
      }
      if (isPending) counts.pendingOutcomes++;

      const dist = (item.district || "Unknown").trim() || "Unknown";
      if (!districtDataMap.has(dist)) {
        districtDataMap.set(dist, { district: dist, total: 0, positives: 0 });
      }
      const dData = districtDataMap.get(dist)!;
      dData.total++;
      if (isPositive) dData.positives++;
    });

    const districtRows = Array.from(districtDataMap.values()).filter(
      (d) => d.total > 0,
    );

    const testingByDistrict = [...districtRows].sort(
      (a, b) => b.total - a.total,
    );

    const yieldByDistrict = districtRows
      .map((d) => ({
        district: d.district,
        yield:
          d.total > 0 ? Number(((d.positives / d.total) * 100).toFixed(1)) : 0,
        positives: d.positives,
        total: d.total,
      }))
      .sort((a, b) => b.yield - a.yield);

    return {
      ...counts,
      testingByDistrict,
      yieldByDistrict,
    };
  }, [periodFilteredHts]);

  const htsData = useMemo(() => {
    // Use the time-period-filtered set so cards + register stay in sync.
    let result = [...periodFilteredHts];

    // Apply KPI Filter — same classification as the stats useMemo above.
    // Keeping these in sync matters: this is what actually populates the
    // register table when a user clicks through from a KPI card, so it
    // must agree with the card's own count.
    if (kpiFilter === "unlinked") {
      result = result.filter((item) => {
        const status = (item.status || "").toLowerCase();
        const isPositive =
          status.includes("hiv+") || status.includes("known positive");
        const raw = item.raw || {};
        const artNo = pickValue(raw, [
          "case_art_number",
          "art_number",
          "art_no",
          "vca_art_number",
          "art_status",
        ]);
        const isLinked =
          artNo !== "N/A" &&
          artNo !== "" &&
          !artNo.toLowerCase().includes("not");
        return isPositive && !isLinked;
      });
    } else if (kpiFilter === "pending") {
      result = result.filter((item) => {
        const status = (item.status || "").toLowerCase();
        const isPositive =
          status.includes("hiv+") || status.includes("known positive");
        const isNegative =
          status.includes("hiv-") || status.includes("known negative");
        return !isPositive && !isNegative;
      });
    } else if (kpiFilter === "positives") {
      result = result.filter((item) => {
        const status = (item.status || "").toLowerCase();
        return status.includes("hiv+") || status.includes("known positive");
      });
    }

    // Apply Search
    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase();
      result = result.filter(
        (item) =>
          item.id.toLowerCase().includes(query) ||
          item.caseworker.toLowerCase().includes(query) ||
          item.facility.toLowerCase().includes(query),
      );
    }

    // Sort by most recent date descending
    result.sort((a, b) => {
      const getDate = (rec: any) => {
        const raw = rec.raw || rec;
        const d =
          raw.service_date ||
          raw.visit_date ||
          raw.date_created ||
          raw.created_at;
        return d ? new Date(d).getTime() : 0;
      };
      return getDate(b) - getDate(a);
    });

    return result;
  }, [periodFilteredHts, deferredSearch, kpiFilter]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return htsData.slice(start, start + ITEMS_PER_PAGE);
  }, [htsData, currentPage]);

  const totalPages = Math.ceil(htsData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages,
        );
      }
    }
    return pages;
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setKpiFilter(null);
    setCurrentPage(1);
    toast.info("Filter reset.");
  };

  const handleExportCsv = () => {
    if (htsData.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    const headers = [
      "ID",
      "Caseworker",
      "Type",
      "Status",
      "Facility",
      "District",
    ];
    const rows = htsData.map((item) => [
      item.id,
      item.caseworker,
      item.type,
      item.status,
      item.facility,
      item.district,
    ]);

    downloadCsv(
      `hts-register-${selectedDistrict.toLowerCase().replace(/\s+/g, "-")}.csv`,
      headers,
      rows,
    );
    toast.success("Register exported successfully.");
  };

  return (
    <DashboardLayout
      subtitle={activeTab === "charts" ? "HTS Charts" : "HTS Register"}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="space-y-4 pb-6"
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
                  HTS register
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
                >
                  <Activity className="h-3 w-3" />{" "}
                  {isLoading ? "—" : stats.total.toLocaleString()} tests
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
                  HIV testing services
                </span>
                <Badge
                  variant="outline"
                  className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm"
                >
                  Testing &amp; linkage
                </Badge>
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Track tests, results, and ART linkage outcomes across the
                programme.
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
              <Select
                value={selectedDistrict}
                onValueChange={(val) => {
                  if (lockedDistrict) return; // District Users cannot change
                  setSelectedDistrict(val);
                  setCurrentPage(1);
                }}
                disabled={!!lockedDistrict}
              >
                <SelectTrigger className="w-full sm:w-[180px] h-9 bg-white/80 border-slate-200 backdrop-blur-md text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <SelectValue placeholder="All Districts" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {!lockedDistrict && (
                    <SelectItem value={ALL}>All Districts</SelectItem>
                  )}
                  {availableDistricts
                    .filter((d) => d !== ALL)
                    .map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tabs for Navigation */}
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

          <TabsContent
            value="charts"
            className="space-y-6 animate-in slide-in-from-left-4 duration-500"
          >
            {/* Time period filter — applies to all cards, charts,
                            and the register table below. Reference point is
                            the latest test date in the loaded data (shown
                            beside the dropdown) so the filters stay useful
                            even when the HTS source hasn't been refreshed
                            in a while. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Time period
                </span>
                <Select
                  value={timePeriod}
                  onValueChange={(v) => setTimePeriod(v as typeof timePeriod)}
                >
                  <SelectTrigger className="h-9 w-[200px] text-xs font-bold rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="fy">
                      This Fiscal Year (Oct–Sep)
                    </SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                {timePeriod !== "all" && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Relative to latest test on file:{" "}
                    <span className="font-bold text-slate-600">
                      {dataMaxDate.toLocaleDateString("en-GB")}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                {
                  title: "Total Tested",
                  value: stats.total,
                  display: stats.total.toLocaleString(),
                  icon: Users,
                  color: "bg-emerald-500",
                  detail: "Everyone with a recorded HIV test",
                  filter: null,
                },
                {
                  title: "Total HIV Positive",
                  value: stats.newPositives,
                  display: stats.newPositives.toLocaleString(),
                  icon: TrendingUp,
                  color: "bg-rose-500",
                  detail: "Click to filter to positives",
                  filter: "positives",
                },
                {
                  title: "Overall Yield",
                  // Positives ÷ tested, expressed as % with one decimal place.
                  value:
                    stats.total > 0
                      ? (stats.newPositives / stats.total) * 100
                      : 0,
                  display:
                    stats.total > 0
                      ? `${((stats.newPositives / stats.total) * 100).toFixed(1)}%`
                      : "0%",
                  icon: Activity,
                  color: "bg-sky-500",
                  detail: "% of tested that are HIV positive",
                  filter: null,
                },
                {
                  title: "Positives Not on ART",
                  value: stats.unlinkedPositives,
                  display: stats.unlinkedPositives.toLocaleString(),
                  icon: AlertCircle,
                  color: "bg-amber-500",
                  detail: "Click to filter to unlinked positives",
                  filter: "unlinked",
                },
                {
                  title: "Pending Outcomes",
                  value: stats.pendingOutcomes,
                  display: stats.pendingOutcomes.toLocaleString(),
                  icon: Info,
                  color: "bg-indigo-500",
                  detail: "Click to filter to pending results",
                  filter: "pending",
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -2 }}
                  className="cursor-pointer"
                  onClick={() => {
                    setKpiFilter(card.filter);
                    setActiveTab("register");
                    setCurrentPage(1);
                  }}
                >
                  <Card
                    className={cn(
                      "rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all",
                      kpiFilter === card.filter && card.filter !== null
                        ? "ring-2 ring-emerald-500 ring-offset-2"
                        : "",
                    )}
                  >
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
                          {isLoading ? <LoadingDots /> : card.display}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {card.detail}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card className="rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Testing Volume and Positives by District
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Tests run vs HIV positives, per district
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-xl"
                    onClick={handleExportCsv}
                  >
                    <Download className="h-3 w-3 mr-1.5" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="p-4 h-[300px]">
                  {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <LoadingDots />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.testingByDistrict}
                        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
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
                            fontSize: 9,
                            fontWeight: 600,
                            fill: "#64748b",
                          }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
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
                          dataKey="total"
                          name="Tested"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                        <Bar
                          dataKey="positives"
                          name="Positives"
                          fill="#f43f5e"
                          radius={[4, 4, 0, 0]}
                          barSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-slate-50">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Yield by District
                    </CardTitle>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Positivity rate per district (positives ÷ tested)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-xl"
                    onClick={handleExportCsv}
                  >
                    <Download className="h-3 w-3 mr-1.5" />
                    Export CSV
                  </Button>
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
                        data={stats.yieldByDistrict}
                        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke="#f1f5f9"
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                          dataKey="district"
                          type="category"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 10,
                            fontWeight: 600,
                            fill: "#64748b",
                          }}
                          width={100}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          }}
                          formatter={(v: any) => [`${v}%`, "Yield"]}
                        />
                        <Bar
                          dataKey="yield"
                          name="Yield"
                          fill="#6366f1"
                          radius={[0, 4, 4, 0]}
                          barSize={12}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="register"
            className="space-y-4 animate-in slide-in-from-right-4 duration-500"
          >
            {kpiFilter && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 mb-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100"
              >
                <div className="p-1.5 bg-emerald-500 rounded-lg text-white">
                  <Filter className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest">
                    Active Filter
                  </p>
                  <p className="text-xs font-bold text-emerald-900">
                    Showing only:{" "}
                    <span className="capitalize">
                      {kpiFilter
                        .replace("unlinked", "Positives Not Linked To ART")
                        .replace("pending", "Pending Outcomes")
                        .replace("positives", "New Positives")}
                    </span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setKpiFilter(null)}
                  className="h-8 text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50 rounded-lg"
                >
                  Clear Filter
                </Button>
              </motion.div>
            )}
            <GlowCard noHover>
              <CardHeader className="py-6 px-8 border-b border-slate-50">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by ID, caseworker or facility..."
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
                      disabled={isLoading || htsData.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2 text-slate-400" />
                      EXPORT CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40">
                      <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                        <TableHead className="py-4 pl-8 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Case ID
                        </TableHead>
                        <TableHead className="py-4 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Caseworker Name
                        </TableHead>
                        <TableHead className="py-4 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          Type
                        </TableHead>
                        <TableHead className="py-4 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                          HIV Status
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
                          <TableCell colSpan={6} className="py-24 text-center">
                            <div className="flex flex-col items-center justify-center gap-4">
                              <LoadingDots className="text-[#00a67e] font-bold" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-24 text-center">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="rounded-full bg-slate-50 p-4 shadow-inner">
                                <Activity className="h-8 w-8 text-slate-300" />
                              </div>
                              <p className="mt-4 text-sm text-slate-500 font-medium max-w-[280px]">
                                NO RECORDS FOUND
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedData.map((item, i) => (
                          <TableRow
                            key={i}
                            className="group border-b border-emerald-50/60 last:border-0 transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                          >
                            <TableCell className="py-4 pl-8 font-mono text-xs font-semibold text-[#00a67e]">
                              {item.id}
                            </TableCell>
                            <TableCell className="text-slate-600 font-medium">
                              {item.caseworker}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.type === "Mother" ? (
                                  <HeartPulse className="h-3.5 w-3.5 text-[#00a67e]" />
                                ) : (
                                  <Baby className="h-3.5 w-3.5 text-emerald-500" />
                                )}
                                <span className="text-xs font-semibold text-slate-600">
                                  {item.type}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={cn(
                                  "font-bold text-[10px] tracking-wide px-2 py-0.5 border-none",
                                  item.status?.toLowerCase().includes("hiv+") ||
                                    item.status
                                      ?.toLowerCase()
                                      .includes("known positive")
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-emerald-100 text-emerald-700",
                                )}
                              >
                                {item.status.toUpperCase()}
                              </Badge>
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
                                  navigate("/hts/view", {
                                    state: item.raw
                                      ? {
                                          ...item.raw,
                                          type: item.type,
                                          district: item.district,
                                        }
                                      : item,
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
                    Showing {htsData.length > 0 ? startIndex + 1 : 0} to{" "}
                    {Math.min(startIndex + ITEMS_PER_PAGE, htsData.length)} of{" "}
                    {htsData.length} entries
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

export default HtsRegister;
