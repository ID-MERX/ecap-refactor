import {
  MapPin,
  Home,
  Users,
  Download,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  Activity,
  Sparkles,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingDots from "@/components/aceternity/LoadingDots";

import AnimatedCounter from "@/components/AnimatedCounter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  getTotalHouseholdsCount,
  getTotalVcasCount,
  getTotalMothersCount,
  getHouseholdsByDistrict,
  getChildrenByDistrict,
  getHouseholdMembers,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useFyFilter } from "@/context/FyFilterContext";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { cn, toTitleCase } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import { downloadCsv } from "@/lib/exportUtils";
import { toast } from "sonner";

const Districts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ... (Keep existing queries and logic: dashboardDistrict, kpi queries, discovery logic, etc.) ...
  const dashboardDistrict = user?.location || "All";

  const { resolved: fy } = useFyFilter();
  const fyArg =
    fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey =
    fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // --- KPI Queries ---
  const householdCountQuery = useQuery({
    queryKey: ["kpi", "households", dashboardDistrict, fyKey],
    queryFn: () => getTotalHouseholdsCount(dashboardDistrict, fyArg),
  });

  const vcaCountQuery = useQuery({
    queryKey: ["kpi", "vcas", dashboardDistrict, fyKey],
    queryFn: () => getTotalVcasCount(dashboardDistrict, fyArg),
  });

  // --- District List Discovery ---
  const householdsListQuery = useQuery({
    queryKey: ["districts-discovery", dashboardDistrict, fyKey],
    queryFn: () =>
      getHouseholdsByDistrict(
        dashboardDistrict === "All" ? "" : dashboardDistrict,
        fyArg,
      ),
    staleTime: 1000 * 60 * 5,
  });

  const discoveredDistrictsMap = useMemo(() => {
    if (!householdsListQuery.data) return new Map<string, string[]>();

    const groups = new Map<string, string[]>();
    householdsListQuery.data.forEach((household: any) => {
      const raw = household.district;
      if (raw) {
        const normalized = toTitleCase(raw.trim());
        if (!groups.has(normalized)) {
          groups.set(normalized, []);
        }
        const variants = groups.get(normalized)!;
        if (!variants.includes(raw)) {
          variants.push(raw);
        }
      }
    });
    return groups;
  }, [householdsListQuery.data]);

  const targetDistrictsNormalized = useMemo(() => {
    const sorted = Array.from(discoveredDistrictsMap.keys()).sort();
    if (sorted.length > 0) return sorted;
    if (dashboardDistrict !== "All") return [dashboardDistrict];
    return [];
  }, [discoveredDistrictsMap, dashboardDistrict]);

  // --- District Stats Queries ---
  const districtQueries = useQueries({
    queries: targetDistrictsNormalized.map((normalizedName) => ({
      queryKey: ["district-stats-v3", normalizedName, fyKey],
      queryFn: async () => {
        const variants = discoveredDistrictsMap.get(normalizedName) || [
          normalizedName,
        ];

        // Filter the already-fetched householdsListQuery data by district variants
        // This guarantees the count matches exactly what HouseholdRegister shows
        const allHouseholds: any[] = householdsListQuery.data ?? [];

        const districtHouseholds = allHouseholds.filter((h: any) => {
          const raw = String(h.district ?? "").trim();
          return variants.includes(raw);
        });

        // Count unique households by household_id (same dedup logic as register)
        const uniqueHouseholdIds = new Set(
          districtHouseholds
            .map((h: any) =>
              String(h.household_id ?? h.householdId ?? h.hh_id ?? h.id ?? ""),
            )
            .filter(Boolean),
        );

        const householdCount =
          uniqueHouseholdIds.size > 0
            ? uniqueHouseholdIds.size
            : districtHouseholds.length;

        // Count VCAs from the children query data or fall back to API
        // For now derive from the same dataset using a vca/child flag if present
        // Fall back to API call only for VCAs since they come from a different endpoint
        let vcaCount = 0;
        try {
          const vcaResults = await Promise.all(
            variants.map((v) => getTotalVcasCount(v, fyArg)),
          );
          vcaCount = vcaResults.reduce((sum, r) => sum + (Number(r) || 0), 0);
        } catch {
          vcaCount = 0;
        }

        return {
          district: normalizedName,
          households: householdCount,
          vcas: vcaCount,
          variants,
        };
      },
      // Only run once the discovery query has resolved
      enabled: !householdsListQuery.isLoading && householdsListQuery.isFetched,
      staleTime: 1000 * 60 * 5,
    })),
  });

  const isDiscoveryLoading = householdsListQuery.isLoading;

  // Determine if any query is currently fetching (even if it has data)
  const isSyncing =
    householdCountQuery.isFetching ||
    vcaCountQuery.isFetching ||
    householdsListQuery.isFetching ||
    districtQueries.some((q) => q.isFetching);

  const areDistrictsLoading =
    householdsListQuery.isLoading ||
    householdsListQuery.isFetching ||
    districtQueries.some((q) => q.isLoading);

  const districtData = districtQueries
    .map((q) => q.data)
    .filter(Boolean)
    // Extra guard to ensure final list is unique by name just in case
    .filter((v, i, a) => a.findIndex((t) => t?.district === v?.district) === i);

  const formatCount = (value: unknown) => {
    if (value === null || value === undefined) return "0";
    const num = Number(value);
    if (isNaN(num)) return "0";
    return new Intl.NumberFormat("en-GB").format(num);
  };

  const handleExportSummary = () => {
    try {
      if (districtData.length === 0) {
        toast.error("No data available to export");
        return;
      }

      // Vulnerability Status removed per feedback
      const headers = ["District", "Households", "VCAs"];
      const rows = districtData.map((data: any) => [
        data.district,
        String(data.households || 0),
        String(data.vcas || 0),
      ]);

      const dateStr = new Date().toISOString().slice(0, 10);
      downloadCsv(headers, rows, `districts_summary_${dateStr}.csv`);
      toast.success("Summary exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export summary");
    }
  };

  const [exportingDistrict, setExportingDistrict] = useState<string | null>(
    null,
  );

  const handleExportDistrictDetails = async (districtName: string) => {
    try {
      setExportingDistrict(districtName);
      toast.info(`Preparing export for ${districtName}…`);

      const normalizedData = districtData.find(
        (d) => d?.district === districtName,
      );
      const variants = normalizedData?.variants || [districtName];

      // Fetch all household lists in parallel
      const allHouseholdsResults = await Promise.all(
        variants.map((v) => getHouseholdsByDistrict(v)),
      );
      const households = allHouseholdsResults.flat();

      if (!households || households.length === 0) {
        toast.error(`No household data found for ${districtName}`);
        return;
      }

      // Fetch ALL member counts simultaneously — no batching, no sequential delays
      const memberCounts = await Promise.all(
        households.map(async (h: any) => {
          const hhId = String(h.household_id ?? h.householdId ?? h.hh_id ?? "");
          if (!hhId) return 0;
          try {
            const members = await getHouseholdMembers(hhId);
            return Array.isArray(members) ? members.length : 0;
          } catch {
            return 0;
          }
        }),
      );

      const headers = [
        "Household ID",
        "Caregiver Name",
        "District",
        "Ward",
        "Community",
        "Date Enrolled",
        "Case Status",
        "Total Members",
        "Last Service Date",
      ];

      const rows = households.map((h: any, i: number) => [
        String(h.household_id ?? h.householdId ?? h.hh_id ?? ""),
        String(h.caregiver_name ?? h.name ?? ""),
        String(h.district ?? ""),
        String(h.ward ?? ""),
        String(h.community ?? h.village ?? ""),
        String(h.date_enrolled ?? h.enrollment_date ?? ""),
        String(h.case_status ?? h.status ?? "Active"),
        String(memberCounts[i]),
        String(h.last_service_date ?? ""),
      ]);

      const dateStr = new Date().toISOString().slice(0, 10);
      downloadCsv(
        headers,
        rows,
        `${districtName}_detailed_report_${dateStr}.csv`,
      );
      toast.success(`${districtName} exported — ${households.length} records`);
    } catch (error) {
      console.error("Detailed export error:", error);
      toast.error(`Failed to export data for ${districtName}`);
    } finally {
      setExportingDistrict(null);
    }
  };

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const totalHouseholds = districtData.reduce(
    (sum: number, d: any) => sum + (d?.households || 0),
    0,
  );

  return (
    <DashboardLayout subtitle="Districts">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                District coverage
              </span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge
                variant="outline"
                className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
              >
                <Activity className="h-3 w-3" /> {districtData.length} districts
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                Geographic coverage &amp; reach
              </span>
              <Badge
                variant="outline"
                className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm"
              >
                <Sparkles className="h-3 w-3" />{" "}
                {totalHouseholds.toLocaleString()} households
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Programme reach by district. Drill into any row to see records or
              export a detailed report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["kpi"] });
                queryClient.invalidateQueries({
                  queryKey: ["districts-discovery"],
                });
                queryClient.invalidateQueries({ queryKey: ["district-stats"] });
              }}
              disabled={isSyncing}
              className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white disabled:opacity-50"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")}
              />
              {isSyncing ? "Syncing…" : "Sync"}
            </button>
            <button
              onClick={handleExportSummary}
              disabled={districtData.length === 0}
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Export Summary
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md"
        />
        <GlowCard className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-emerald-100/40 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-transparent py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm">
                <MapPin className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                District Coverage
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
            >
              {districtData.length}{" "}
              {districtData.length === 1 ? "district" : "districts"}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40">
                <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                  <TableHead className="w-[80px] hidden md:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    No.
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    District
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Households
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    VCAs
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areDistrictsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex items-center justify-center py-12">
                        <LoadingDots />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : districtData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        icon={<MapPin className="h-7 w-7" />}
                        title="No District Data"
                        description="No district data is available yet. Try syncing."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  districtData.map((data: any, index) => (
                    <TableRow
                      key={data.district}
                      className="group transition-colors border-b border-emerald-50/60 hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                    >
                      <TableCell className="font-mono font-semibold text-emerald-700 hidden md:table-cell">
                        {String(index + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm">
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col">
                            <span>{data.district}</span>
                            <div className="flex gap-2 mt-0.5 sm:hidden">
                              <span className="text-[10px] text-slate-500">
                                HH: {formatCount(data.households)}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                VCAs: {formatCount(data.vcas)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <Home className="h-3 w-3 text-emerald-600" />
                          {formatCount(data.households)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <Users className="h-3 w-3 text-violet-600" />
                          {formatCount(data.vcas)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-100/60 bg-white/80 text-emerald-600 transition-all hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                            onClick={() =>
                              handleExportDistrictDetails(data.district)
                            }
                            disabled={exportingDistrict === data.district}
                            title="Export Detailed Report"
                          >
                            {exportingDistrict === data.district ? (
                              <LoadingDots className="text-emerald-500 scale-50" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700"
                            onClick={() =>
                              navigate(
                                `/households?district=${encodeURIComponent(data.district)}`,
                              )
                            }
                          >
                            View
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </GlowCard>
      </div>
    </DashboardLayout>
  );
};

// ... KpiCard component ...

// Internal Component for KPI Cards
const KpiCard = ({
  title,
  value,
  caption,
  isLoading,
  delay = 0,
  icon,
  iconBg,
  iconText,
  borderAccent,
  hoverable,
}: {
  title: string;
  value: string;
  caption: string;
  isLoading: boolean;
  delay?: number;
  icon?: React.ReactNode;
  iconBg?: string;
  iconText?: string;
  borderAccent?: string;
  hoverable?: boolean;
}) => {
  return (
    <div style={{ animationDelay: `${delay}s` }} className="h-full">
      <GlowCard
        hoverable={hoverable}
        className={cn(
          "flex flex-col justify-between py-6 px-6 h-full",
          borderAccent,
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              {title}
            </h3>
            <div className="text-3xl font-bold text-foreground tracking-tight">
              {isLoading ? (
                <LoadingDots className="text-slate-400" />
              ) : (
                <AnimatedCounter value={value} />
              )}
            </div>
          </div>
          {icon && (
            <div className={cn("rounded-lg p-2", iconBg, iconText)}>{icon}</div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/50" />
            {caption}
          </p>
        </div>
      </GlowCard>
    </div>
  );
};

export default Districts;
