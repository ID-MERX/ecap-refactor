import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  ExternalLink,
  Eye,
  Gauge,
  MapPin,
  Search,
  TableProperties,
  Users,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CanonicalKpiStrip from "@/components/dashboard/CanonicalKpiStrip";
import ServicesPageHeader from "./ServicesPageHeader";
import CohortStrip from "./CohortStrip";
import ServicesTimeSeriesChart from "./ServicesTimeSeriesChart";
import ServicesDistributionChart from "./ServicesDistributionChart";
import QualityReviewPanel from "./QualityReviewPanel";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { useFyFilter } from "@/context/FyFilterContext";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ISSUE_META,
  parseDateValue,
  SERVICE_TYPE_META,
  type ServicePillar,
  type ServiceType,
} from "./service-records";

interface Props {
  type: ServiceType;
  title: string;
  subtitle?: string;
}

import {
  getHouseholdsByDistrict,
  getServiceSummary,
  getServiceRecords,
  getServiceRecordDetail,
  triggerServiceExport,
  type ServiceRecordRow,
} from "@/lib/api";

type ExportState = "idle" | "preparing" | "downloading" | "done" | "error";

const ITEMS_PER_PAGE = 12;

const DOMAIN_OPTIONS: Array<{ value: "all" | ServicePillar; label: string }> = [
  { value: "all", label: "All domains" },
  { value: "HIV", label: "HIV" },
  { value: "Health", label: "Health" },
  { value: "Education", label: "Education" },
  { value: "Safety", label: "Safety" },
  { value: "Stability", label: "Stability" },
  { value: "Household", label: "Household" },
];

const DATE_WINDOWS = [
  { value: "all", label: "All dates", days: null },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "365", label: "Last 12 months", days: 365 },
];

const PILLAR_CLASS: Record<string, string> = {
  HIV: "border-rose-200 bg-rose-50 text-rose-700",
  Health: "border-sky-200 bg-sky-50 text-sky-700",
  Education: "border-violet-200 bg-violet-50 text-violet-700",
  Safety: "border-amber-200 bg-amber-50 text-amber-700",
  Stability: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Household: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const ISSUE_CLASS: Record<string, string> = {
  missing_date: "border-rose-200 bg-rose-50 text-rose-700",
  no_service_details: "border-rose-200 bg-rose-50 text-rose-700",
  missing_caseworker: "border-amber-200 bg-amber-50 text-amber-700",
  missing_district: "border-amber-200 bg-amber-50 text-amber-700",
  stale_90d: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("missing") ||
    normalized.includes("error") ||
    normalized.includes("fail")
  )
    return "border-rose-200 bg-rose-50 text-rose-700";
  if (
    normalized.includes("pending") ||
    normalized.includes("draft") ||
    normalized.includes("process")
  )
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const formatDate = (value: string) => {
  const date = parseDateValue(value);
  if (!date) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const formatRawValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

// ── Debounce hook so search only fires a new network request after the user
//    stops typing for 350 ms — eliminates per-keystroke fetches. ───────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const ServicesPage = ({ type, title, subtitle }: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();

  const isDistrictUser = user?.description === "District User";
  const isProvincialUser = user?.description === "Provincial User";
  const userProvince = user?.title;

  const initialDistrict =
    params.get("district") ??
    (isDistrictUser && user?.location ? user.location : "All");

  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<"all" | ServicePillar>(
    "all",
  );
  const [dateWindow, setDateWindow] = useState("all");
  const [issueFilter, setIssueFilter] = useState<string | null>(null);
  const [focusedEntityId, setFocusedEntityId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Detail sheet state — record row for display + full raw payload fetched on demand
  const [selectedRecord, setSelectedRecord] = useState<ServiceRecordRow | null>(
    null,
  );
  const [detailRaw, setDetailRaw] = useState<Record<string, unknown> | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [exportState, setExportState] = useState<ExportState>("idle");

  // Debounce search — only triggers a new query after 350 ms of no typing
  const debouncedSearch = useDebounce(searchQuery, 350);

  const meta = SERVICE_TYPE_META[type];

  // Lock for District User
  useEffect(() => {
    if (
      isDistrictUser &&
      user?.location &&
      selectedDistrict !== user.location
    ) {
      setSelectedDistrict(user.location);
    }
  }, [user, isDistrictUser, selectedDistrict]);

  // Sync district to URL
  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedDistrict && selectedDistrict !== "All")
      next.set("district", selectedDistrict);
    setParams(next, { replace: true });
  }, [selectedDistrict, setParams]);

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    type,
    selectedDistrict,
    domainFilter,
    dateWindow,
    debouncedSearch,
    issueFilter,
    focusedEntityId,
  ]);

  // Clear focus when switching service type
  useEffect(() => {
    setFocusedEntityId(null);
    setIssueFilter(null);
    setSelectedRecord(null);
    setDetailRaw(null);
  }, [type]);

  // ── District discovery (for the dropdown) — unchanged from before ────────
  const hhListQuery = useQuery({
    queryKey: ["districts-discovery-services", "All"],
    queryFn: () => getHouseholdsByDistrict(""),
    staleTime: 30 * 60 * 1000,
  });

  const districtOptions = useMemo(() => {
    const set = new Set<string>();
    if (hhListQuery.data) {
      (
        hhListQuery.data as Array<{ district?: string; province?: string }>
      ).forEach((h) => {
        if (isProvincialUser && userProvince && h.province !== userProvince)
          return;
        if (h.district) set.add(String(h.district));
      });
    }
    return ["All", ...Array.from(set).sort()];
  }, [hhListQuery.data, isProvincialUser, userProvince]);

  const districtParam =
    selectedDistrict !== "All" ? selectedDistrict : undefined;

  const { resolved: fy } = useFyFilter();
  const fyKey =
    fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // ── Summary KPIs (unchanged) ─────────────────────────────────────────────
  const { data: summary } = useQuery({
    queryKey: [
      "service-summary",
      type,
      districtParam,
      undefined,
      undefined,
      fyKey,
    ],
    queryFn: () => getServiceSummary({ type, district: districtParam }),
    staleTime: 5 * 60 * 1000,
  });

  // ── PRIMARY DATA QUERY — server-side paginated records ───────────────────
  // Every filter change triggers a new fetch, but only 12 rows come back.
  const recordsQuery = useQuery({
    queryKey: [
      "service-records-paged",
      type,
      districtParam ?? "all",
      debouncedSearch,
      domainFilter,
      issueFilter ?? "",
      dateWindow,
      focusedEntityId ?? "",
      currentPage,
    ],
    queryFn: () =>
      getServiceRecords({
        type,
        district: districtParam,
        search: debouncedSearch || undefined,
        domain: domainFilter !== "all" ? domainFilter : undefined,
        issue: issueFilter || undefined,
        dateWindow: dateWindow !== "all" ? dateWindow : undefined,
        entityId: focusedEntityId || undefined,
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
      }),
    staleTime: 60 * 1000, // 1 min — re-validate in background
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // keep stale data visible while loading
  });

  const response = recordsQuery.data;
  const records = response?.data ?? [];
  const totalRecords = response?.totalRecords ?? 0;
  const totalPages = response?.totalPages ?? 1;
  const serverStats = response?.stats;
  const issueCounts = serverStats?.issueCounts ?? {};

  const isInitialLoading = recordsQuery.isLoading && records.length === 0;
  const isRefreshing = recordsQuery.isFetching;
  const hasHardError = recordsQuery.isError;

  // After data settles with a focused entity, report if nothing was found
  useEffect(() => {
    if (!focusedEntityId) return;
    if (recordsQuery.isFetching) return;
    if (totalRecords === 0 && !isInitialLoading) {
      toast.error(
        `No service records for ${focusedEntityId} in the current scope. ` +
          `The record may belong to a different service type or district.`,
      );
      setFocusedEntityId(null);
    }
  }, [
    focusedEntityId,
    totalRecords,
    isInitialLoading,
    recordsQuery.isFetching,
  ]);

  // Guard page out of range
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // ── Operational stat cards (now from server-computed stats) ─────────────
  const operationalStats = useMemo(() => {
    const issueBreakdown = Object.entries(issueCounts)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([key, count]) => ({
        key,
        count,
        label: ISSUE_META[key]?.label ?? key,
        hint: (
          ISSUE_META[key] as { label: string; tone: string; hint?: string }
        )?.hint,
      }));

    const noun = meta.shortLabel.toLowerCase();
    return [
      {
        key: "loaded",
        label: `${meta.shortLabel} records on this page`,
        value: serverStats?.loaded ?? 0,
        icon: Database,
        tone: "text-slate-600 bg-slate-50 border-slate-100",
        tooltip: `How many ${noun} service records match the current filters in the database.`,
      },
      {
        key: "monthly",
        label: `This month's ${noun} services`,
        value: serverStats?.monthly ?? 0,
        icon: Activity,
        tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
        tooltip: `${noun.charAt(0).toUpperCase() + noun.slice(1)} service records whose service_date falls in the current calendar month.`,
      },
      {
        key: "issues",
        label: "Records flagged with issues",
        value: serverStats?.recordsWithIssues ?? 0,
        icon: AlertTriangle,
        tone: "text-amber-700 bg-amber-50 border-amber-100",
        tooltip: "Records that hit at least one data-quality check.",
        breakdown: issueBreakdown,
      },
    ];
  }, [serverStats, issueCounts, meta.shortLabel]);

  // ── Open detail sheet — fetch full raw payload on demand ─────────────────
  const openDetailSheet = async (record: ServiceRecordRow) => {
    setSelectedRecord(record);
    setDetailRaw(null);
    setDetailLoading(true);
    try {
      const raw = await getServiceRecordDetail({
        type,
        entityId: record.entityId,
        district: record.district !== "N/A" ? record.district : undefined,
      });
      setDetailRaw(raw);
    } catch {
      // Non-fatal — sheet still shows the summary fields
    } finally {
      setDetailLoading(false);
    }
  };

  // ── CSV export — fetch all matching records for the current filters ───────
  const handleExportCsv = async () => {
    if (!type || exportState !== "idle") return;

    try {
      await triggerServiceExport(
        {
          type,
          district: districtParam,
          search: debouncedSearch || undefined,
          domain: domainFilter !== "all" ? domainFilter : undefined,
          issue: issueFilter || undefined,
          dateWindow: dateWindow !== "all" ? dateWindow : undefined,
          entityId: focusedEntityId || undefined,
        },
        (state) => {
          setExportState(state);
          if (state === "preparing") {
            toast.info(
              "Preparing your export — this may take a moment for large datasets.",
            );
          }
          if (state === "done") {
            toast.success("Export downloaded successfully.");
            setTimeout(() => setExportState("idle"), 3000);
          }
          if (state === "error") {
            toast.error("Export failed. Please try again.");
            setTimeout(() => setExportState("idle"), 3000);
          }
        },
      );
    } catch {
      toast.error("Export failed. Please try again.");
      setExportState("idle");
    }
  };

  // ── Navigation to individual record view ─────────────────────────────────
  const openRecordRoute = (record: ServiceRecordRow) => {
    const raw = detailRaw ?? record.raw;
    const state = {
      ...raw,
      district: record.district,
      district_name: record.district,
      facility: record.facility,
      facility_name: record.facility,
      caseworker_name: record.caseworker,
      service_date: record.serviceDate,
      vca_id: record.type === "vca" ? record.entityId : raw.vca_id,
      vcaid: record.type === "vca" ? record.entityId : raw.vcaid,
      household_id: record.type !== "vca" ? record.entityId : raw.household_id,
    };
    if (record.type === "vca") {
      navigate("/profile/vca-service-details", { state });
      return;
    }
    if (record.type === "caregiver") {
      navigate("/profile/caregiver-service-details", { state });
      return;
    }
    navigate("/profile/household-service-details", { state });
  };

  // ── Duplicate focus handler ───────────────────────────────────────────────
  const handleDuplicateFocus = (entityId: string) => {
    setSearchQuery("");
    setIssueFilter(null);
    setDomainFilter("all");
    setDateWindow("all");
    setFocusedEntityId(entityId);
    if (!isDistrictUser && selectedDistrict !== "All") {
      setSelectedDistrict("All");
    }
    setCurrentPage(1);
    setTimeout(() => {
      document
        .getElementById("services-records-table")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    toast.info(`Searching for ${entityId}…`);
  };

  // ── Raw entries for detail sheet (prefer server-fetched full payload) ─────
  const rawEntries = useMemo(() => {
    const source = detailRaw ?? selectedRecord?.raw ?? {};
    return Object.entries(source)
      .filter(([k]) => !k.startsWith("_"))
      .slice(0, 80);
  }, [detailRaw, selectedRecord]);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <ServicesPageHeader
        type={type}
        title={title}
        subtitle={subtitle}
        source={summary?.source}
        generatedAt={summary?.generated_at}
      />

      {/* ── Tab bar + action buttons ── */}
      <div className="mb-4 flex flex-col gap-3 px-1 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={type}
          onValueChange={(next) =>
            navigate(SERVICE_TYPE_META[next as ServiceType].route)
          }
        >
          <TabsList className="h-9 w-full justify-start bg-slate-100/80 p-1 sm:w-auto backdrop-blur-sm border border-slate-200/50">
            {(Object.keys(SERVICE_TYPE_META) as ServiceType[]).map((st) => (
              <TabsTrigger
                key={st}
                value={st}
                className="h-7 px-3 text-xs font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm"
              >
                {SERVICE_TYPE_META[st].shortLabel}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate("/")}
          >
            <Gauge className="h-3.5 w-3.5" />
            Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleExportCsv}
            disabled={exportState !== "idle"}
          >
            <Download
              className={cn(
                "h-3.5 w-3.5",
                exportState === "preparing" || exportState === "downloading"
                  ? "animate-pulse"
                  : "",
              )}
            />
            {exportState === "idle" && "Export"}
            {exportState === "preparing" && "Preparing…"}
            {exportState === "downloading" && "Downloading…"}
            {exportState === "done" && "Downloaded ✓"}
            {exportState === "error" && "Failed — retry"}
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="mb-4 grid grid-cols-1 gap-2 px-1 xl:grid-cols-[minmax(260px,1fr)_190px_170px_170px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
            placeholder="Search ID, name, facility, caseworker, service"
          />
        </div>

        <Select
          value={selectedDistrict}
          onValueChange={setSelectedDistrict}
          disabled={isDistrictUser}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="District" />
          </SelectTrigger>
          <SelectContent>
            {districtOptions.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={domainFilter}
          onValueChange={(v) => setDomainFilter(v as "all" | ServicePillar)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            {DOMAIN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateWindow} onValueChange={setDateWindow}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_WINDOWS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Stat cards ── */}
      <TooltipProvider delayDuration={150}>
        <div className="mb-4 grid grid-cols-1 gap-3 px-1 sm:grid-cols-3">
          {operationalStats.map((stat) => {
            const Icon = stat.icon;
            const breakdown = (
              stat as {
                breakdown?: Array<{
                  key: string;
                  count: number;
                  label: string;
                  hint?: string;
                }>;
              }
            ).breakdown;

            const card = (
              <div className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 cursor-help">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </span>
                  <span className={cn("rounded-md border p-1.5", stat.tone)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
                  {stat.value.toLocaleString()}
                </div>
              </div>
            );

            if (breakdown && breakdown.length > 0) {
              return (
                <Popover key={stat.key}>
                  <PopoverTrigger asChild>{card}</PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-72 p-3"
                  >
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Top issues in the loaded records
                    </div>
                    <ul className="space-y-2">
                      {breakdown.map((row) => (
                        <li
                          key={row.key}
                          className="flex items-start justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIssueFilter(row.key);
                              setCurrentPage(1);
                              document
                                .getElementById("services-records-table")
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                });
                            }}
                            className="text-left text-xs text-slate-700 hover:text-emerald-700"
                          >
                            <div className="font-semibold">{row.label}</div>
                            {row.hint && (
                              <div className="mt-0.5 text-[10px] text-slate-500">
                                {row.hint}
                              </div>
                            )}
                          </button>
                          <Badge
                            variant="outline"
                            className="shrink-0 font-mono text-[10px]"
                          >
                            {row.count.toLocaleString()}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                      Click a row to filter the table to records with that
                      issue.
                    </p>
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <Tooltip key={stat.key}>
                <TooltipTrigger asChild>{card}</TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-xs text-xs leading-relaxed"
                >
                  {stat.tooltip}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* ── Charts and panels (unchanged) ── */}
      <div className="px-1">
        <CanonicalKpiStrip type={type} district={districtParam} />
      </div>

      <CohortStrip type={type} district={districtParam} />

      <div className="grid grid-cols-1 gap-4 px-1 lg:grid-cols-2">
        <ServicesTimeSeriesChart type={type} district={districtParam} />
        <ServicesDistributionChart type={type} district={districtParam} />
      </div>

      <div className="mt-4 px-1">
        <QualityReviewPanel
          type={type}
          district={districtParam}
          issueCounts={issueCounts}
          activeIssue={issueFilter}
          onIssueChange={(key) => {
            setIssueFilter(key);
            setCurrentPage(1);
          }}
          onDuplicateFocus={handleDuplicateFocus}
        />
      </div>

      {/* ── Records table ── */}
      <div id="services-records-table" className="mt-4 px-1 scroll-mt-24">
        <GlowCard className="min-w-0">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <TableProperties className="h-4 w-4 text-primary" />
                Service Records
                <Badge variant="outline" className="font-mono text-[10px]">
                  {totalRecords.toLocaleString()} shown
                </Badge>
                {isRefreshing && (
                  <Badge
                    variant="outline"
                    className="border-sky-200 bg-sky-50 text-[10px] text-sky-700"
                  >
                    Syncing
                  </Badge>
                )}
                {focusedEntityId && (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 gap-1.5"
                  >
                    Focused on{" "}
                    <span className="font-mono font-bold">
                      {focusedEntityId}
                    </span>
                    <button
                      type="button"
                      className="ml-1 rounded-sm px-1 text-emerald-700 hover:bg-emerald-100"
                      onClick={() => setFocusedEntityId(null)}
                      aria-label="Clear focused entity filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
                {issueFilter && (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-[10px] text-amber-700 gap-1.5"
                  >
                    Issue: {ISSUE_META[issueFilter]?.label ?? issueFilter}
                    <button
                      type="button"
                      className="ml-1 rounded-sm px-1 text-amber-700 hover:bg-amber-100"
                      onClick={() => {
                        setIssueFilter(null);
                        setCurrentPage(1);
                      }}
                      aria-label="Clear issue filter"
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                Page {currentPage} of {totalPages}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isRefreshing}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages || isRefreshing}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {isInitialLoading ? (
              <div className="flex h-56 flex-col items-center justify-center">
                <LoadingDots className="text-slate-400" />
                {focusedEntityId && (
                  <p className="mt-3 text-xs text-slate-500">
                    Searching for{" "}
                    <span className="font-mono font-semibold text-slate-700">
                      {focusedEntityId}
                    </span>{" "}
                    across districts…
                  </p>
                )}
              </div>
            ) : hasHardError ? (
              <div className="flex h-56 flex-col items-center justify-center text-center text-sm text-rose-600">
                <AlertTriangle className="mb-2 h-6 w-6" />
                Service records could not be loaded for the selected scope.
              </div>
            ) : records.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center text-center text-sm text-slate-500">
                <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-500" />
                No service records match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40">
                    <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                      <TableHead className="min-w-[170px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Entity
                      </TableHead>
                      <TableHead className="min-w-[150px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        District
                      </TableHead>
                      <TableHead className="min-w-[170px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Facility
                      </TableHead>
                      <TableHead className="min-w-[170px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Caseworker
                      </TableHead>
                      <TableHead className="min-w-[130px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Service Date
                      </TableHead>
                      <TableHead className="min-w-[190px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Domains
                      </TableHead>
                      <TableHead className="min-w-[140px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Issues
                      </TableHead>
                      <TableHead className="w-[92px] text-right text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow
                        key={record.id}
                        className="align-top transition-colors border-b border-emerald-50/60 hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                      >
                        <TableCell>
                          <div className="font-mono text-sm font-semibold text-slate-900">
                            {record.entityId}
                          </div>
                          <div className="mt-1 max-w-[190px] truncate text-xs text-slate-500">
                            {record.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {record.district}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="max-w-[180px] truncate">
                              {record.facility}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-slate-700">
                            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                            <span className="max-w-[180px] truncate">
                              {record.caseworker}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-slate-800">
                            <CalendarRange className="h-3.5 w-3.5 text-slate-400" />
                            {formatDate(record.serviceDate)}
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "mt-1 text-[10px]",
                              statusClass(record.status),
                            )}
                          >
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[240px] flex-wrap gap-1">
                            {record.pillars.length > 0 ? (
                              record.pillars.map((pillar) => (
                                <Badge
                                  key={pillar}
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    PILLAR_CLASS[pillar] ??
                                      "border-slate-200 bg-slate-50 text-slate-600",
                                  )}
                                >
                                  {pillar}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">
                                No domain captured
                              </span>
                            )}
                          </div>
                          {record.serviceNames.length > 0 && (
                            <div className="mt-1 max-w-[240px] truncate text-xs text-slate-500">
                              {record.serviceNames.slice(0, 3).join(", ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {record.issueKeys.length > 0 ? (
                              record.issueKeys.slice(0, 2).map((key) => (
                                <Badge
                                  key={key}
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    ISSUE_CLASS[key],
                                  )}
                                >
                                  {ISSUE_META[key]?.label ?? key}
                                </Badge>
                              ))
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                              >
                                Clear
                              </Badge>
                            )}
                            {record.issueKeys.length > 2 && (
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-[10px] text-slate-600"
                              >
                                +{record.issueKeys.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => openDetailSheet(record)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </GlowCard>
      </div>

      {/* ── Detail sheet ── */}
      <Sheet
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRecord(null);
            setDetailRaw(null);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedRecord && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedRecord.entityLabel} {selectedRecord.entityId}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      statusClass(selectedRecord.status),
                    )}
                  >
                    {selectedRecord.status}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {selectedRecord.district} ·{" "}
                  {formatDate(selectedRecord.serviceDate)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoLine
                    icon={Users}
                    label="Name"
                    value={selectedRecord.name}
                  />
                  <InfoLine
                    icon={Building2}
                    label="Facility"
                    value={selectedRecord.facility}
                  />
                  <InfoLine
                    icon={Briefcase}
                    label="Caseworker"
                    value={selectedRecord.caseworker}
                  />
                  <InfoLine
                    icon={Clock}
                    label="Record age"
                    value={
                      selectedRecord.ageDays === null
                        ? "N/A"
                        : `${selectedRecord.ageDays} days`
                    }
                  />
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Service Domains
                  </div>
                  <div className="space-y-2">
                    {Object.entries(selectedRecord.servicesByPillar).length >
                    0 ? (
                      (
                        Object.entries(
                          selectedRecord.servicesByPillar,
                        ) as Array<[ServicePillar, string[]]>
                      ).map(([pillar, services]) => (
                        <div
                          key={pillar}
                          className="rounded-lg border border-slate-200 bg-white p-3"
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              "mb-2 text-[10px]",
                              PILLAR_CLASS[pillar] ??
                                "border-slate-200 bg-slate-50 text-slate-600",
                            )}
                          >
                            {pillar}
                          </Badge>
                          <div className="flex flex-wrap gap-1.5">
                            {services.map((service) => (
                              <Badge
                                key={service}
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-[10px] text-slate-700"
                              >
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                        No service domains captured.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Issues
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRecord.issueKeys.length > 0 ? (
                      selectedRecord.issueKeys.map((key) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className={cn("text-[10px]", ISSUE_CLASS[key])}
                        >
                          {ISSUE_META[key]?.label ?? key}
                        </Badge>
                      ))
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        Clear
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Source Payload
                  </div>
                  {detailLoading ? (
                    <div className="flex h-24 items-center justify-center">
                      <LoadingDots className="text-slate-400" />
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-200">
                      <Table>
                        <TableBody>
                          {rawEntries.map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell className="w-[190px] align-top font-mono text-xs font-semibold text-slate-600">
                                {key}
                              </TableCell>
                              <TableCell className="break-words text-xs text-slate-700">
                                {formatRawValue(value)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    className="gap-2"
                    onClick={() => openRecordRoute(selectedRecord)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Record
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

const InfoLine = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="truncate text-sm font-medium text-slate-800" title={value}>
      {value}
    </div>
  </div>
);

export default ServicesPage;
