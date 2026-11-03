import {
  Database,
  RefreshCw,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Server,
  Timer,
  Workflow,
  BarChart3,
  RotateCcw,
  Download,
  FileSpreadsheet,
  XCircle,
  TestTubes,
  Mail,
  Smartphone,
  Sparkles,
  Users,
  ShieldCheck,
} from "lucide-react";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEtlRuns,
  getEtlRunById,
  getEtlPipelines,
  getEtlFiles,
  getEtlDownloadUrl,
  sendEtlReport,
  getTabletSyncStatus,
  getTabletSyncStreamUrl,
  type EtlRun,
  type EtlFile,
  type TabletSyncStatus,
} from "@/lib/api";
import LoadingDots from "@/components/aceternity/LoadingDots";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  listUserActivity,
  listPmpUsers,
  listFlaggedFormFacilities,
  broadcastAnnouncement,
  type DirectusActivityEntry,
  type PmpUser,
} from "@/lib/directus";

import { cn } from "@/lib/utils";

const PIPELINE_META: Record<
  string,
  { icon: typeof Database; color: string; description: string }
> = {
  ecap_plus: {
    icon: Database,
    color: "emerald",
    description:
      "Full monthly aggregation: extract from ECAP Plus, transform, generate reports, and export caregiver + VCA service CSVs.",
  },
  hts_register: {
    icon: TestTubes,
    color: "amber",
    description:
      "Extract HTS register data: HIV testing service records and index contact tracing from ECAP Plus.",
  },
  pmtct: {
    icon: ShieldCheck,
    color: "rose",
    description:
      "Downstream Prevention of Mother-to-Child Transmission extract for ECAP Plus. Runs after HTS register and provides mother and child download files.",
  },
  ecap_plus_tablet_sync: {
    icon: Smartphone,
    color: "teal",
    description:
      "Always-on Mage AI refresh of ECAP+ provider tablet-sync status from OpenSRP into the dashboard summary table.",
  },
};

const PIPELINE_KEYS = ["ecap_plus", "hts_register", "pmtct"];

const currentFileStamp = () => {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lusaka",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
    .format(new Date())
    .replace(/\D/g, "");
};

const CURRENT_FILE_STAMP = currentFileStamp();
const DEFAULT_PIPELINE_FILES: Record<string, string[]> = {
  ecap_plus: [
    `monthly_caregiver_ecapplus_services_${CURRENT_FILE_STAMP}.csv`,
    `monthly_vca_ecapplus_services_${CURRENT_FILE_STAMP}.csv`,
  ],
  hts_register: [`hts_register_ecapplus_${CURRENT_FILE_STAMP}.csv`],
  pmtct: [
    `pmtct_mother_ecapplus_register_${CURRENT_FILE_STAMP}.csv`,
    `pmtct_child_ecapplus_register_${CURRENT_FILE_STAMP}.csv`,
  ],
};
const TABLET_SYNC_PIPELINE_KEY = "ecap_plus_tablet_sync";
const TABLET_PAGE_SIZE = 20;

const tabletSyncSourceLabel = (source?: string) => {
  if (source === "ecap_plus_superset_db.tablet_sync_status")
    return "ECAP+ tablet sync pipeline";
  if (source === "ecap_plus_superset_db.children")
    return "ECAP+ pipeline seed snapshot";
  if (source === "ecap_plus_source.children") return "ECAP+ source snapshot";
  if (source === "opensrp.core.event") return "Live OpenSRP sync";
  return "Processed ECAP+ tablet snapshot";
};

const DataPipelinePage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "pipelines" | "runs" | "tablets" | "activity"
  >("pipelines");
  const [runningPipelines, setRunningPipelines] = useState<
    Record<string, string>
  >({});
  const [selectedRun, setSelectedRun] = useState<EtlRun | null>(null);
  const [filesByPipeline, setFilesByPipeline] = useState<
    Record<string, EtlFile[]>
  >({});
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [tabletFilter, setTabletFilter] = useState<
    "all" | "active" | "stale" | "inactive"
  >("all");
  const [tabletSyncStreamStatus, setTabletSyncStreamStatus] = useState<
    "idle" | "connecting" | "live" | "reconnecting"
  >("idle");
  const [tabletSyncStreamContactAt, setTabletSyncStreamContactAt] = useState<
    number | null
  >(null);
  const [tabletPage, setTabletPage] = useState(1);

  const { user: authUser } = useAuth();
  const isAdminUser = (authUser?.description ?? "").trim() === "Administrator";
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceSubject, setAnnounceSubject] = useState("");
  const [announceMessage, setAnnounceMessage] = useState("");
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<
    "all" | "active" | "stale" | "inactive" | "never"
  >("all");
  const [activityRole, setActivityRole] = useState("all");
  const [activityProvince, setActivityProvince] = useState("all");
  const [activityDistrict, setActivityDistrict] = useState("all");
  const [activityFacility, setActivityFacility] = useState("all");
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 20;

  const pipelinesQuery = useQuery({
    queryKey: ["etl", "pipelines"],
    queryFn: getEtlPipelines,
    staleTime: 60_000,
  });

  const runsQuery = useQuery({
    queryKey: ["etl", "runs"],
    queryFn: () => getEtlRuns({ limit: 30 }),
    refetchInterval: 10_000,
  });

  const tabletSyncQuery = useQuery({
    queryKey: ["etl", "tablet-sync"],
    queryFn: getTabletSyncStatus,
    staleTime: 60_000,
    refetchInterval: 15 * 60 * 1000, // auto-refresh every 15 minutes
  });
  const tabletSync = tabletSyncQuery.data;

  const runs = runsQuery.data ?? [];
  const latestRun = runs[0];
  const successRuns = runs.filter((r) => r.status === "success");
  const failedRuns = runs.filter((r) => r.status === "failed");
  const runningRuns = runs.filter((r) => r.status === "running");

  useEffect(() => {
    setActivityPage(1);
  }, [
    activityFilter,
    activityRole,
    activityProvince,
    activityDistrict,
    activityFacility,
  ]);

  useEffect(() => {
    setActivityDistrict("all");
    setActivityFacility("all");
  }, [activityProvince]);

  useEffect(() => {
    setActivityFacility("all");
  }, [activityDistrict]);

  useEffect(() => {
    const active: Record<string, string> = {};
    for (const r of runningRuns) {
      active[r.pipeline] = r.run_id;
    }
    setRunningPipelines(active);
  }, [runningRuns.length]);

  const loadFiles = useCallback(async () => {
    const results: Record<string, EtlFile[]> = {};
    for (const key of PIPELINE_KEYS) {
      try {
        results[key] = await getEtlFiles(key);
      } catch {
        results[key] = [];
      }
    }
    setFilesByPipeline(results);
  }, []);

  const activityQuery = useQuery({
    queryKey: ["directus", "user-activity"],
    queryFn: () => listUserActivity(500),
    enabled: activeTab === "activity",
    staleTime: 60_000,
  });
  const activityEntries = activityQuery.data;

  const pmpUsersQuery = useQuery({
    queryKey: ["directus", "pmp-users"],
    queryFn: listPmpUsers,
    enabled: activeTab === "activity",
    staleTime: 60_000,
  });
  const pmpUsers = pmpUsersQuery.data;

  const flaggedFormsQuery = useQuery({
    queryKey: ["directus", "flagged-form-facilities"],
    queryFn: listFlaggedFormFacilities,
    enabled: activeTab === "activity",
    staleTime: 60_000,
  });
  const flaggedFormRefs = flaggedFormsQuery.data;

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    setTabletPage(1);
  }, [tabletFilter]);

  useEffect(() => {
    if (activeTab !== "tablets") {
      setTabletSyncStreamStatus("idle");
      return;
    }

    if (typeof EventSource === "undefined") {
      setTabletSyncStreamStatus("idle");
      return;
    }

    let closed = false;
    setTabletSyncStreamStatus("connecting");

    const source = new EventSource(getTabletSyncStreamUrl());

    source.onopen = () => {
      if (!closed) setTabletSyncStreamStatus("live");
    };

    source.addEventListener("tablet-sync", (event) => {
      if (closed) return;
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          data?: TabletSyncStatus;
          emitted_at?: string;
        };
        if (payload.data) {
          queryClient.setQueryData(["etl", "tablet-sync"], payload.data);
        }
        setTabletSyncStreamContactAt(
          payload.emitted_at
            ? new Date(payload.emitted_at).getTime()
            : Date.now(),
        );
        setTabletSyncStreamStatus("live");
      } catch (err) {
        console.error("Failed to parse tablet sync stream payload:", err);
        setTabletSyncStreamStatus("reconnecting");
      }
    });

    source.addEventListener("heartbeat", (event) => {
      if (closed) return;
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          emitted_at?: string;
        };
        setTabletSyncStreamContactAt(
          payload.emitted_at
            ? new Date(payload.emitted_at).getTime()
            : Date.now(),
        );
      } catch {
        setTabletSyncStreamContactAt(Date.now());
      }
      setTabletSyncStreamStatus("live");
    });

    source.addEventListener("tablet-sync-error", (event) => {
      if (closed) return;
      console.error("Tablet sync stream error:", (event as MessageEvent).data);
      setTabletSyncStreamStatus("reconnecting");
    });

    source.onerror = () => {
      if (!closed) setTabletSyncStreamStatus("reconnecting");
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [activeTab, queryClient]);

  useEffect(() => {
    if (
      latestRun &&
      (latestRun.status === "success" || latestRun.status === "failed")
    ) {
      loadFiles();
    }
  }, [latestRun?.status, latestRun?.run_id, loadFiles]);

  const handleViewLogs = async (runId: string) => {
    try {
      const run = await getEtlRunById(runId);
      setSelectedRun(run);
    } catch {
      toast.error("Failed to load run details");
    }
  };

  // Auto-poll logs every 3s when viewing a running pipeline
  useEffect(() => {
    if (
      !selectedRun ||
      (selectedRun.status !== "running" && selectedRun.status !== "pending")
    )
      return;
    const interval = setInterval(async () => {
      try {
        const updated = await getEtlRunById(selectedRun.run_id);
        setSelectedRun(updated);
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedRun?.run_id, selectedRun?.status]);

  const handleDownload = (pipeline: string, fileName: string) => {
    const url = getEtlDownloadUrl(pipeline, fileName);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const data = await sendEtlReport();
      toast.success(data?.message || "Email report sent to the team");
    } catch (err: any) {
      toast.error("Failed to send email", { description: err.message });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusConfig: Record<
    string,
    { color: string; bg: string; icon: typeof CheckCircle2 }
  > = {
    success: {
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      icon: CheckCircle2,
    },
    running: { color: "text-blue-600", bg: "bg-blue-50", icon: RefreshCw },
    pending: { color: "text-slate-500", bg: "bg-slate-50", icon: Clock },
    failed: { color: "text-red-600", bg: "bg-red-50", icon: XCircle },
    cancelled: {
      color: "text-amber-600",
      bg: "bg-amber-50",
      icon: AlertCircle,
    },
  };

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const renderTabletSyncPipelineCard = () => {
    const meta = PIPELINE_META[TABLET_SYNC_PIPELINE_KEY];
    const Icon = meta.icon;
    const pipelineInfo = pipelinesQuery.data?.find(
      (p) => p.id === TABLET_SYNC_PIPELINE_KEY,
    );
    const lastRefreshAt =
      tabletSync?.refreshed_at ||
      (tabletSyncQuery.dataUpdatedAt > 0
        ? new Date(tabletSyncQuery.dataUpdatedAt).toISOString()
        : null);

    return (
      <div className="group relative h-full">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-200/70 via-teal-200/40 to-transparent opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-100" />
        <div className="relative h-full flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-slate-300">
          <div className="border-b border-emerald-50/60 bg-gradient-to-r from-emerald-50/30 via-teal-50/15 to-transparent p-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Always on
              </Badge>
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">
              {pipelineInfo?.name ?? "ECAP+ Tablet Sync Status Refresh"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {meta.description}
            </p>
          </div>

          <div className="flex flex-1 flex-col space-y-4 p-5">
            <div className="rounded-xl border border-emerald-100/60 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-transparent p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Last refresh
                </span>
                <Badge
                  variant="secondary"
                  className="h-4 bg-emerald-50 text-[10px] text-emerald-700"
                >
                  {tabletSyncStreamStatus === "live" ? "live" : "polling"}
                </Badge>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-700">
                {formatDate(lastRefreshAt)}
              </p>
              <p className="text-[10px] text-slate-500">
                Source: {tabletSyncSourceLabel(tabletSync?.source)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-100 bg-white/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {tabletSync?.total ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Active
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {tabletSync?.active_7d ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Stale
                </p>
                <p className="mt-1 text-lg font-bold text-amber-700">
                  {tabletSync?.stale ?? "-"}
                </p>
              </div>
            </div>

            <div className="space-y-2 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Pipeline output
              </span>
              <div className="flex items-center justify-between rounded-xl border border-emerald-100/60 bg-white/80 p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">
                      tablet_sync_status
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Updated by Mage AI always-on pipeline
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => tabletSyncQuery.refetch()}
              disabled={tabletSyncQuery.isFetching}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  tabletSyncQuery.isFetching && "animate-spin",
                )}
              />
              Refresh status
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout subtitle="Data Pipeline">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(245,158,11,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-amber-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                ETL infrastructure
              </span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge
                variant="outline"
                className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
              >
                <Activity className="h-3 w-3" />{" "}
                {runningRuns.length > 0
                  ? `${runningRuns.length} running`
                  : "Idle"}
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-amber-700 bg-clip-text text-transparent">
                Data Pipeline
              </span>
              <Badge
                variant="outline"
                className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm"
              >
                <Sparkles className="h-3 w-3" /> Extract · Transform · Load
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Run and monitor ETL processes. Trigger pipelines, download output
              CSVs, and track run history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white disabled:opacity-50"
            >
              {isSendingEmail ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              Email Report
            </button>
            <button
              type="button"
              onClick={() => {
                queryClient.invalidateQueries();
                loadFiles();
                toast.info("Refreshed");
              }}
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <GlowCard wrapperClassName="h-full" className="h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Running Now
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                runningRuns.length > 0 ? "text-blue-600" : "text-emerald-600",
              )}
            >
              {runningRuns.length > 0 ? `${runningRuns.length} Active` : "Idle"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {runningRuns.length > 0
                ? runningRuns.map((r) => r.pipeline_name).join(", ")
                : "No pipelines running"}
            </p>
          </CardContent>
        </GlowCard>

        <GlowCard wrapperClassName="h-full" className="h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Run
            </CardTitle>
            <Clock className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {latestRun
                ? formatDate(latestRun.started_at).split(",")[0]
                : "No runs yet"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {latestRun
                ? `${latestRun.pipeline_name} - ${formatDuration(latestRun.duration_sec)}`
                : "-"}
            </p>
          </CardContent>
        </GlowCard>

        <GlowCard wrapperClassName="h-full" className="h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Run History
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {runs.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total recorded runs
            </p>
            <div className="mt-3 flex items-center gap-3 text-[10px]">
              <span className="text-emerald-600 font-medium">
                {successRuns.length} passed
              </span>
              <span className="text-red-500 font-medium">
                {failedRuns.length} failed
              </span>
            </div>
          </CardContent>
        </GlowCard>

        <GlowCard wrapperClassName="h-full" className="h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipelines
            </CardTitle>
            <Server className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">2</div>
            <p className="text-xs text-muted-foreground mt-1">
              ECAP Plus + HTS Register
            </p>
          </CardContent>
        </GlowCard>

        <GlowCard wrapperClassName="h-full" className="h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tablet Sync
            </CardTitle>
            <Smartphone className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {tabletSync ? (
                `${tabletSync.active_7d}/${tabletSync.total}`
              ) : (
                <LoadingDots />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active in last 7 days
            </p>
            {tabletSync && tabletSync.stale > 0 && (
              <p className="text-xs text-orange-600 font-medium mt-3">
                {tabletSync.stale} stale ({">"}30 days)
              </p>
            )}
          </CardContent>
        </GlowCard>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: "pipelines" as const, label: "Pipelines", icon: Workflow },
          { id: "runs" as const, label: "Run History", icon: Timer },
          { id: "tablets" as const, label: "Tablet Sync", icon: Smartphone },
          { id: "activity" as const, label: "User Activity", icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedRun(null);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === "runs" && runningRuns.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Pipelines Tab */}
      {activeTab === "pipelines" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {PIPELINE_KEYS.map((key) => {
            const meta = PIPELINE_META[key];
            const Icon = meta.icon;
            const isRunning = !!runningPipelines[key];
            const runId = runningPipelines[key];
            const files = filesByPipeline[key] ?? [];
            const lastPipelineRun = runs.find((r) => r.pipeline === key);
            const pipelineInfo = pipelinesQuery.data?.find((p) => p.id === key);
            const displayName =
              key === "pmtct"
                ? "Prevention of Mother-to-Child Transmission"
                : (pipelineInfo?.name ?? key);
            const expectedFiles = pipelineInfo?.downloadFiles?.length
              ? pipelineInfo.downloadFiles
              : (DEFAULT_PIPELINE_FILES[key] ?? []);
            const iconStyle =
              meta.color === "emerald"
                ? { backgroundColor: "#ecfdf5", color: "#059669" }
                : meta.color === "rose"
                  ? { backgroundColor: "#fff1f2", color: "#e11d48" }
                  : { backgroundColor: "#fffbeb", color: "#d97706" };
            const outputFiles =
              files.length > 0
                ? files
                : expectedFiles.map((name) => ({
                    name,
                    exists: false,
                    size: null,
                    sizeFormatted: null,
                    lastModified: null,
                  }));

            return (
              <GlowCard key={key} wrapperClassName="h-full" className="h-full">
                <div className="flex flex-col h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl" style={iconStyle}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {displayName}
                        </CardTitle>
                        {isRunning && (
                          <Badge className="bg-blue-50 text-blue-700 text-[10px] mt-1 gap-1">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Running ({runId})
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {meta.description}
                    </p>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                      {lastPipelineRun ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                              Last Run
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] h-4",
                                (
                                  statusConfig[lastPipelineRun.status] ??
                                  statusConfig.pending
                                ).bg,
                                (
                                  statusConfig[lastPipelineRun.status] ??
                                  statusConfig.pending
                                ).color,
                              )}
                            >
                              {lastPipelineRun.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600">
                            {formatDate(lastPipelineRun.started_at)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Duration:{" "}
                            {formatDuration(lastPipelineRun.duration_sec)} | By:{" "}
                            {lastPipelineRun.triggered_by}
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            Last Run
                          </span>
                          <span className="text-xs text-slate-400">
                            No runs yet
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Output Files
                      </span>
                      {outputFiles.length > 0 ? (
                        outputFiles.map((f) => (
                          <div
                            key={f.name}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-white"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <FileSpreadsheet
                                className={cn(
                                  "h-4 w-4 flex-shrink-0",
                                  key === "pmtct"
                                    ? "text-rose-500"
                                    : "text-emerald-500",
                                )}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">
                                  {f.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {f.exists
                                    ? `${f.sizeFormatted} | ${formatDate(f.lastModified)}`
                                    : "Not generated yet"}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-primary hover:bg-primary/5"
                              disabled={!f.exists}
                              onClick={() => handleDownload(key, f.name)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">
                          Run the pipeline to generate files
                        </p>
                      )}
                    </div>

                    {/* Monitoring actions only. Mage AI owns ETL execution. */}
                    <div className="flex gap-2 pt-2 mt-auto">
                      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-500">
                        Mage AI controlled
                      </div>
                      {lastPipelineRun && (
                        <button
                          type="button"
                          onClick={() => {
                            handleViewLogs(lastPipelineRun.run_id);
                            setActiveTab("runs");
                          }}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all hover:border-emerald-300 hover:bg-white"
                        >
                          Logs
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </CardContent>
                </div>
              </GlowCard>
            );
          })}
        </div>
      )}

      {/* Runs Tab */}
      {activeTab === "runs" && !selectedRun && (
        <GlowCard>
          <CardHeader className="border-b border-slate-50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" /> Pipeline Run History
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {runs.length} runs
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Workflow className="h-10 w-10 mb-3 text-slate-200" />
                <p className="font-medium">No pipeline runs yet</p>
                <p className="text-xs mt-1">
                  Trigger a pipeline from the Pipelines tab to get started.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="px-6 py-4">Run ID</th>
                      <th className="px-6 py-4">Pipeline</th>
                      <th className="px-6 py-4">Started</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4">Triggered By</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {runs.map((run) => {
                      const sc =
                        statusConfig[run.status] ?? statusConfig.pending;
                      const StatusIcon = sc.icon;
                      return (
                        <tr
                          key={run.run_id}
                          className="group hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold font-mono text-slate-700">
                              {run.run_id}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-slate-600">
                              {run.pipeline_name || run.pipeline}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Clock className="h-3 w-3" />
                              {formatDate(run.started_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-slate-600 font-mono">
                              {run.status === "running" ? (
                                <span className="text-blue-600 flex items-center gap-1">
                                  <RefreshCw className="h-3 w-3 animate-spin" />{" "}
                                  In progress
                                </span>
                              ) : (
                                formatDuration(run.duration_sec)
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-500">
                              {run.triggered_by}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] gap-1",
                                sc.bg,
                                sc.color,
                              )}
                            >
                              <StatusIcon
                                className={cn(
                                  "h-3 w-3",
                                  run.status === "running" && "animate-spin",
                                )}
                              />{" "}
                              {run.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-primary hover:bg-primary/5 font-semibold"
                                onClick={() => handleViewLogs(run.run_id)}
                              >
                                Logs <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </GlowCard>
      )}

      {/* Log Viewer */}
      {activeTab === "runs" && selectedRun && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRun(null)}
              className="text-slate-500"
            >
              <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Back to Runs
            </Button>
            <span className="font-mono font-bold text-slate-700">
              {selectedRun.run_id}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px]",
                (statusConfig[selectedRun.status] ?? statusConfig.pending).bg,
                (statusConfig[selectedRun.status] ?? statusConfig.pending)
                  .color,
              )}
            >
              {selectedRun.status}
            </Badge>
            {selectedRun.status === "running" && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto border-slate-200"
                onClick={() => handleViewLogs(selectedRun.run_id)}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Refresh Logs
              </Button>
            )}
          </div>
          <GlowCard>
            <CardHeader className="border-b border-slate-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Pipeline
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedRun.pipeline_name || selectedRun.pipeline}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Started
                  </span>
                  <span className="font-medium text-slate-700">
                    {formatDate(selectedRun.started_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Duration
                  </span>
                  <span className="font-medium text-slate-700">
                    {formatDuration(selectedRun.duration_sec)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Triggered By
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedRun.triggered_by}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedRun.error && (
                <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                  <strong>Error:</strong> {selectedRun.error}
                </div>
              )}
              <div className="p-6">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
                  Output Logs
                </span>
                <pre className="bg-slate-900 text-slate-200 rounded-xl p-4 text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed whitespace-pre-wrap">
                  {selectedRun.logs || "(no output yet)"}
                </pre>
              </div>
            </CardContent>
          </GlowCard>
        </div>
      )}

      {/* ── Tablet Sync Tab ── */}
      {activeTab === "tablets" &&
        (() => {
          const filtered =
            tabletSync?.providers.filter(
              (p) => tabletFilter === "all" || p.status === tabletFilter,
            ) ?? [];
          const totalPages = Math.max(
            1,
            Math.ceil(filtered.length / TABLET_PAGE_SIZE),
          );
          const currentPage = Math.min(tabletPage, totalPages);
          const paginated = filtered.slice(
            (currentPage - 1) * TABLET_PAGE_SIZE,
            currentPage * TABLET_PAGE_SIZE,
          );
          const startIndex =
            filtered.length === 0
              ? 0
              : (currentPage - 1) * TABLET_PAGE_SIZE + 1;
          const endIndex = Math.min(
            currentPage * TABLET_PAGE_SIZE,
            filtered.length,
          );
          const exportCsv = () => {
            const rows = filtered.map((p) => [
              p.provider,
              p.district ?? "",
              p.facility ?? p.location_id ?? "",
              p.last_activity
                ? new Date(p.last_activity).toLocaleString("en-GB")
                : "",
              String(p.total_events),
              p.status,
            ]);
            const header =
              "Provider,District,Facility,Last Activity,Events,Status\n";
            const csv =
              header +
              rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `pmp_user_activity_${activityFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
          };

          return (
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
              <div className="xl:col-span-1">
                {renderTabletSyncPipelineCard()}
              </div>
              <div className="relative xl:col-span-2">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-transparent opacity-50 blur-md"
                />
                <GlowCard>
                  <div className="relative max-h-[70vh] overflow-y-auto rounded-2xl">
                    <div className="sticky top-0 z-30 bg-white/95 shadow-sm backdrop-blur-md">
                      <CardHeader className="border-b border-emerald-50/60 bg-gradient-to-r from-emerald-50/95 via-teal-50/90 to-transparent">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                            <Smartphone className="h-4 w-4 text-emerald-600" />
                            Tablet / Provider Sync Status
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-2">
                            {tabletSync && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setTabletFilter("all")}
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                    tabletFilter === "all"
                                      ? "border-slate-800 bg-slate-800 text-white"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400",
                                  )}
                                >
                                  All ({tabletSync.total})
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTabletFilter(
                                      tabletFilter === "active"
                                        ? "all"
                                        : "active",
                                    )
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                    tabletFilter === "active"
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400",
                                  )}
                                >
                                  Active ({tabletSync.active_7d})
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTabletFilter(
                                      tabletFilter === "stale"
                                        ? "all"
                                        : "stale",
                                    )
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                    tabletFilter === "stale"
                                      ? "border-amber-600 bg-amber-600 text-white"
                                      : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400",
                                  )}
                                >
                                  Stale ({tabletSync.stale})
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTabletFilter(
                                      tabletFilter === "inactive"
                                        ? "all"
                                        : "inactive",
                                    )
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                                    tabletFilter === "inactive"
                                      ? "border-red-600 bg-red-600 text-white"
                                      : "border-red-200 bg-red-50 text-red-700 hover:border-red-400",
                                  )}
                                >
                                  Inactive (
                                  {tabletSync.total - tabletSync.active_30d})
                                </button>
                              </>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-slate-200 text-xs"
                              onClick={exportCsv}
                              disabled={filtered.length === 0}
                            >
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                              Export CSV
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-emerald-200 bg-white/90 text-xs text-emerald-700 hover:bg-emerald-50"
                              onClick={() => tabletSyncQuery.refetch()}
                              disabled={tabletSyncQuery.isFetching}
                            >
                              <RefreshCw
                                className={cn(
                                  "mr-1.5 h-3.5 w-3.5",
                                  tabletSyncQuery.isFetching && "animate-spin",
                                )}
                              />
                              Refresh
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <div className="mx-6 mb-8 mt-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 pb-6 text-xs text-blue-700 backdrop-blur-md">
                        <Activity
                          className={cn(
                            "h-3.5 w-3.5 flex-shrink-0",
                            tabletSyncStreamStatus === "live" &&
                              "text-emerald-600",
                          )}
                        />
                        <span>
                          {tabletSyncStreamStatus === "live" ? (
                            <>Live sync is connected. </>
                          ) : tabletSyncStreamStatus === "connecting" ? (
                            <>Connecting to live sync. </>
                          ) : tabletSyncStreamStatus === "reconnecting" ? (
                            <>Live sync is reconnecting. </>
                          ) : (
                            <>Live sync starts when this tab is open. </>
                          )}
                          Tablet sync updates as soon as the server receives
                          fresh activity.
                          {tabletSyncStreamContactAt ? (
                            <>
                              {" "}
                              Last updated:{" "}
                              <strong>
                                {new Date(
                                  tabletSyncStreamContactAt,
                                ).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </strong>
                            </>
                          ) : tabletSyncQuery.dataUpdatedAt > 0 ? (
                            <>
                              {" "}
                              Last updated:{" "}
                              <strong>
                                {new Date(
                                  tabletSyncQuery.dataUpdatedAt,
                                ).toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </strong>
                            </>
                          ) : null}
                          {tabletSync?.source ? (
                            <>
                              {" "}
                              · Source:{" "}
                              <strong>
                                {tabletSyncSourceLabel(tabletSync.source)}
                              </strong>
                            </>
                          ) : null}
                        </span>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      {!tabletSync ? (
                        <div className="flex justify-center py-16">
                          <LoadingDots />
                        </div>
                      ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <Smartphone className="mb-3 h-10 w-10 text-slate-200" />
                          <p className="font-medium">
                            No providers match this filter
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                              <thead>
                                <tr className="border-b border-emerald-100/60 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-amber-50/40 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                                  <th className="px-6 py-4">#</th>
                                  <th className="px-6 py-4">Provider</th>
                                  <th className="px-6 py-4">District</th>
                                  <th className="px-6 py-4">Facility</th>
                                  <th className="px-6 py-4">Last Activity</th>
                                  <th className="px-6 py-4">Events</th>
                                  <th className="px-6 py-4">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-50/60">
                                {paginated.map((p, i) => (
                                  <tr
                                    key={`${p.provider}-${p.location_id}-${p.last_activity}`}
                                    className="transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                                  >
                                    <td className="px-6 py-3 text-xs text-slate-400">
                                      {(currentPage - 1) * TABLET_PAGE_SIZE +
                                        i +
                                        1}
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className="text-sm font-medium text-slate-700">
                                        {p.provider}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className="text-sm text-slate-600">
                                        {p.district || "Unknown"}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className="text-sm text-slate-600">
                                        {p.facility ||
                                          p.location_id ||
                                          "Unknown"}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Clock className="h-3 w-3" />
                                        {new Date(
                                          p.last_activity,
                                        ).toLocaleString("en-GB", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </div>
                                    </td>
                                    <td className="px-6 py-3">
                                      <span className="font-mono text-sm text-slate-600">
                                        {p.total_events.toLocaleString()}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "text-[10px]",
                                          p.status === "active"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : p.status === "stale"
                                              ? "bg-amber-50 text-amber-700"
                                              : "bg-red-50 text-red-700",
                                        )}
                                      >
                                        {p.status === "active"
                                          ? "Active"
                                          : p.status === "stale"
                                            ? "Stale (7-30d)"
                                            : "Inactive (>30d)"}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-emerald-50 bg-white/80 px-6 py-4">
                            <p className="text-xs text-slate-500">
                              Showing {startIndex}-{endIndex} of{" "}
                              {filtered.length}
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-slate-200 text-xs"
                                onClick={() =>
                                  setTabletPage((p) => Math.max(1, p - 1))
                                }
                                disabled={currentPage <= 1}
                              >
                                Previous
                              </Button>
                              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs shadow-sm">
                                Page {currentPage} / {totalPages}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-slate-200 text-xs"
                                onClick={() =>
                                  setTabletPage((p) =>
                                    Math.min(totalPages, p + 1),
                                  )
                                }
                                disabled={currentPage >= totalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </div>
                </GlowCard>
              </div>
            </div>
          );
        })()}
      {/* ── PMP User Activity Tab ── */}
      {activeTab === "activity" &&
        (() => {
          const entries = activityEntries ?? [];
          const users = pmpUsers ?? [];
          const norm = (v?: string | null) => (v ?? "").trim();

          const userProvince = (u: PmpUser) => norm(u.title);
          const userDistricts = (u: PmpUser) =>
            (norm(u.district) || norm(u.location))
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          const userFacilities = (u: PmpUser) =>
            norm(u.facility)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          const userName = (u: PmpUser) => {
            const full = [u.first_name, u.last_name].filter(Boolean).join(" ");
            return full || u.email || "Unknown user";
          };

          const summary = new Map<
            string,
            { events: number; lastEvent: number }
          >();
          for (const e of entries) {
            const uid = e.user?.id;
            if (!uid) continue;
            const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
            const s = summary.get(uid) ?? { events: 0, lastEvent: 0 };
            s.events += 1;
            if (ts > s.lastEvent) s.lastEvent = ts;
            summary.set(uid, s);
          }

          const lastActiveOf = (u: PmpUser) => {
            const access = u.last_access
              ? new Date(u.last_access).getTime()
              : 0;
            return Math.max(access, summary.get(u.id)?.lastEvent ?? 0);
          };

          const flagsByFacility = new Map<string, number>();
          for (const f of flaggedFormRefs ?? []) {
            const key = norm(f.facility).toLowerCase();
            if (!key) continue;
            flagsByFacility.set(key, (flagsByFacility.get(key) ?? 0) + 1);
          }

          const flagEventsOf = (u: PmpUser) =>
            norm(u.description) === "Facility User"
              ? userFacilities(u).reduce(
                  (sum, f) => sum + (flagsByFacility.get(f.toLowerCase()) ?? 0),
                  0,
                )
              : 0;

          const eventsOf = (u: PmpUser) =>
            (summary.get(u.id)?.events ?? 0) + flagEventsOf(u);

          const DAY = 24 * 60 * 60 * 1000;
          const statusOf = (
            u: PmpUser,
          ): "active" | "stale" | "inactive" | "never" => {
            const last = lastActiveOf(u);
            if (!last) return "never";
            const age = Date.now() - last;
            if (age <= 7 * DAY) return "active";
            if (age <= 30 * DAY) return "stale";
            return "inactive";
          };

          const locFiltered = users.filter((u) => {
            if (activityRole !== "all" && norm(u.description) !== activityRole)
              return false;
            if (
              activityProvince !== "all" &&
              userProvince(u) !== activityProvince
            )
              return false;
            if (
              activityDistrict !== "all" &&
              !userDistricts(u).includes(activityDistrict)
            )
              return false;
            if (
              activityFacility !== "all" &&
              !userFacilities(u).includes(activityFacility)
            )
              return false;
            return true;
          });

          const uniqueSorted = (vals: string[]) =>
            Array.from(new Set(vals.filter(Boolean))).sort();

          const roleOptions = uniqueSorted([
            "Administrator",
            "Provincial User",
            "District User",
            "Facility User",
            ...users.map((u) => norm(u.description)),
          ]);
          const provinceOptions = uniqueSorted(users.map(userProvince));
          const districtOptions = uniqueSorted(
            users
              .filter(
                (u) =>
                  activityProvince === "all" ||
                  userProvince(u) === activityProvince,
              )
              .flatMap(userDistricts),
          );
          const facilityOptions = uniqueSorted(
            users
              .filter(
                (u) =>
                  (activityProvince === "all" ||
                    userProvince(u) === activityProvince) &&
                  (activityDistrict === "all" ||
                    userDistricts(u).includes(activityDistrict)),
              )
              .flatMap(userFacilities),
          );

          const countFor = (
            status: "active" | "stale" | "inactive" | "never",
          ) => locFiltered.filter((u) => statusOf(u) === status).length;

          const filtered = locFiltered
            .filter(
              (u) => activityFilter === "all" || statusOf(u) === activityFilter,
            )
            .sort((a, b) => {
              // "never" users sink to the bottom regardless of sort
              const aNever = statusOf(a) === "never";
              const bNever = statusOf(b) === "never";
              if (aNever && !bNever) return 1;
              if (!aNever && bNever) return -1;
              const diff = lastActiveOf(b) - lastActiveOf(a);
              return diff !== 0 ? diff : userName(a).localeCompare(userName(b));
            });

          const totalPages = Math.max(
            1,
            Math.ceil(filtered.length / ACTIVITY_PAGE_SIZE),
          );
          const paginated = filtered.slice(
            (activityPage - 1) * ACTIVITY_PAGE_SIZE,
            activityPage * ACTIVITY_PAGE_SIZE,
          );
          const startIndex =
            filtered.length === 0
              ? 0
              : (activityPage - 1) * ACTIVITY_PAGE_SIZE + 1;
          const endIndex = Math.min(
            activityPage * ACTIVITY_PAGE_SIZE,
            filtered.length,
          );

          const statusBadge = (
            status: "active" | "stale" | "inactive" | "never",
          ) =>
            status === "active"
              ? "bg-emerald-50 text-emerald-700"
              : status === "stale"
                ? "bg-amber-50 text-amber-700"
                : status === "never"
                  ? "bg-slate-100 text-slate-500"
                  : "bg-red-50 text-red-700";

          const statusLabel = (u: PmpUser) => {
            const s = statusOf(u);
            if (s === "never") return "Never logged in";
            return s === "active"
              ? "Active"
              : s === "stale"
                ? "Stale (7-30d)"
                : "Inactive (>30d)";
          };

          const exportCsv = () => {
            const rows = filtered.map((u) => [
              userName(u),
              u.email ?? "",
              u.description ?? "",
              userProvince(u),
              userDistricts(u).join("; "),
              userFacilities(u).join("; "),
              String(eventsOf(u)),
              lastActiveOf(u)
                ? new Date(lastActiveOf(u)).toLocaleString("en-GB")
                : "Never",
              statusLabel(u),
            ]);
            const header =
              "User,Email,User Role,Province,District,Facility,Events,Last Active,Status\n";
            const csv =
              header +
              rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `pmp_user_activity_${activityFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
          };

          return (
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-transparent opacity-50 blur-md"
              />
              <GlowCard>
                <CardHeader className="border-b border-emerald-50/60 bg-gradient-to-r from-emerald-50/95 via-teal-50/90 to-transparent">
                  <div className="flex flex-col gap-3">
                    {/* Title row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wider text-emerald-800">
                        <Users className="h-4 w-4 text-emerald-600" />
                        PMP User Activity
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {/*{isAdminUser && (*/}
                        {/*  <Button*/}
                        {/*    size="sm"*/}
                        {/*    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-xs text-white hover:from-emerald-700 hover:to-teal-700"*/}
                        {/*    onClick={() => setAnnounceOpen(true)}*/}
                        {/*    disabled={filtered.length === 0}*/}
                        {/*  >*/}
                        {/*    <Sparkles className="h-3.5 w-3.5 mr-1.5" />*/}
                        {/*    Announce New Update*/}
                        {/*  </Button>*/}
                        {/*)}*/}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 text-xs"
                          onClick={exportCsv}
                          disabled={filtered.length === 0}
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Export CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 bg-white/90 text-xs text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            activityQuery.refetch();
                            pmpUsersQuery.refetch();
                            flaggedFormsQuery.refetch();
                          }}
                          disabled={
                            activityQuery.isFetching ||
                            pmpUsersQuery.isFetching ||
                            flaggedFormsQuery.isFetching
                          }
                        >
                          <RefreshCw
                            className={cn(
                              "mr-1.5 h-3.5 w-3.5",
                              (activityQuery.isFetching ||
                                pmpUsersQuery.isFetching) &&
                                "animate-spin",
                            )}
                          />
                          Refresh
                        </Button>
                      </div>
                    </div>

                    {/* Status filter pills */}
                    {pmpUsers && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setActivityFilter("all")}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                            activityFilter === "all"
                              ? "bg-slate-800 text-white border-slate-800"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                          )}
                        >
                          All ({locFiltered.length})
                        </button>
                        <button
                          onClick={() =>
                            setActivityFilter(
                              activityFilter === "active" ? "all" : "active",
                            )
                          }
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                            activityFilter === "active"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400",
                          )}
                        >
                          Active ({countFor("active")})
                        </button>
                        <button
                          onClick={() =>
                            setActivityFilter(
                              activityFilter === "stale" ? "all" : "stale",
                            )
                          }
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                            activityFilter === "stale"
                              ? "bg-amber-600 text-white border-amber-600"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400",
                          )}
                        >
                          Stale ({countFor("stale")})
                        </button>
                        <button
                          onClick={() =>
                            setActivityFilter(
                              activityFilter === "inactive"
                                ? "all"
                                : "inactive",
                            )
                          }
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                            activityFilter === "inactive"
                              ? "bg-red-600 text-white border-red-600"
                              : "bg-red-50 text-red-700 border-red-200 hover:border-red-400",
                          )}
                        >
                          Inactive ({countFor("inactive")})
                        </button>
                        <button
                          onClick={() =>
                            setActivityFilter(
                              activityFilter === "never" ? "all" : "never",
                            )
                          }
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                            activityFilter === "never"
                              ? "bg-slate-700 text-white border-slate-700"
                              : "bg-slate-100 text-slate-600 border-slate-300 hover:border-slate-500",
                          )}
                        >
                          Never logged in ({countFor("never")})
                        </button>
                      </div>
                    )}

                    {/* Dropdown filters */}
                    {pmpUsers && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={activityRole}
                          onValueChange={setActivityRole}
                        >
                          <SelectTrigger className="h-8 w-[170px] rounded-lg border-emerald-200/70 bg-white/90 text-xs text-slate-600 shadow-sm">
                            <SelectValue placeholder="User role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs">
                              All user roles
                            </SelectItem>
                            {roleOptions.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={activityProvince}
                          onValueChange={setActivityProvince}
                        >
                          <SelectTrigger className="h-8 w-[170px] rounded-lg border-emerald-200/70 bg-white/90 text-xs text-slate-600 shadow-sm">
                            <SelectValue placeholder="All provinces" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs">
                              All provinces
                            </SelectItem>
                            {provinceOptions.map((p) => (
                              <SelectItem key={p} value={p} className="text-xs">
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={activityDistrict}
                          onValueChange={setActivityDistrict}
                        >
                          <SelectTrigger className="h-8 w-[170px] rounded-lg border-emerald-200/70 bg-white/90 text-xs text-slate-600 shadow-sm">
                            <SelectValue placeholder="All districts" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs">
                              All districts
                            </SelectItem>
                            {districtOptions.map((d) => (
                              <SelectItem key={d} value={d} className="text-xs">
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={activityFacility}
                          onValueChange={setActivityFacility}
                        >
                          <SelectTrigger className="h-8 w-[170px] rounded-lg border-emerald-200/70 bg-white/90 text-xs text-slate-600 shadow-sm">
                            <SelectValue placeholder="All facilities" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs">
                              All facilities
                            </SelectItem>
                            {facilityOptions.map((f) => (
                              <SelectItem key={f} value={f} className="text-xs">
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {(activityRole !== "all" ||
                          activityProvince !== "all" ||
                          activityDistrict !== "all" ||
                          activityFacility !== "all") && (
                          <button
                            onClick={() => {
                              setActivityRole("all");
                              setActivityProvince("all");
                              setActivityDistrict("all");
                              setActivityFacility("all");
                            }}
                            className="px-3 py-1 rounded-full text-xs font-medium border bg-white text-slate-500 border-slate-200 hover:border-slate-400 transition-all"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>

                {/* Info banner */}
                <div className="mx-6 mt-4 mb-6 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-700">
                  <Activity className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    Every PMP dashboard user with their latest recorded activity
                    — users who have never logged in appear as "Never logged
                    in". <br />
                    {pmpUsersQuery.dataUpdatedAt > 0 ? (
                      <>
                        {" "}
                        Last updated:{" "}
                        <strong>
                          {new Date(
                            pmpUsersQuery.dataUpdatedAt,
                          ).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </strong>
                      </>
                    ) : null}{" "}
                    · Source: <strong>ECAP+ Users &amp; Activity Log</strong>
                  </span>
                </div>

                <CardContent className="p-0">
                  {pmpUsersQuery.isError || activityQuery.isError ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <AlertCircle className="h-10 w-10 mb-3 text-red-300" />
                      <p className="font-medium text-slate-500">
                        Failed to load user activity
                      </p>
                      <p className="mt-1 text-xs">
                        {(pmpUsersQuery.error ?? activityQuery.error) instanceof
                        Error
                          ? (
                              (pmpUsersQuery.error ??
                                activityQuery.error) as Error
                            ).message
                          : "Unknown error"}
                      </p>
                    </div>
                  ) : !pmpUsers ? (
                    <div className="flex justify-center py-16">
                      <LoadingDots />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Users className="h-10 w-10 mb-3 text-slate-200" />
                      <p className="font-medium">No users match this filter</p>
                    </div>
                  ) : (
                    <div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px] text-left border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-amber-50/40 text-[11px] uppercase tracking-wider text-emerald-800 font-bold border-b border-emerald-100/60">
                              <th className="px-4 py-4">#</th>
                              <th className="px-4 py-4">User</th>
                              <th className="px-4 py-4">Role / Province</th>
                              <th className="px-4 py-4">District</th>
                              <th className="px-4 py-4">Facility</th>
                              <th className="px-4 py-4">Last Active</th>
                              <th className="px-4 py-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-50/60">
                            {paginated.map((u, i) => (
                              <tr
                                key={u.id}
                                className="transition-colors hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                              >
                                <td className="px-4 py-3 text-xs text-slate-400">
                                  {(activityPage - 1) * ACTIVITY_PAGE_SIZE +
                                    i +
                                    1}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-medium text-slate-700">
                                    {userName(u)}
                                  </span>
                                  {u.email && (
                                    <p className="text-[10px] text-slate-400">
                                      {u.email}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm text-slate-600">
                                    {norm(u.title) || "—"}
                                  </span>
                                  {norm(u.description) && (
                                    <p className="text-[10px] text-slate-400">
                                      {u.description}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm text-slate-600">
                                    {userDistricts(u).join(", ") || "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm text-slate-600">
                                    {userFacilities(u).join(", ") || "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                                    <Clock className="h-3 w-3" />
                                    {lastActiveOf(u)
                                      ? new Date(
                                          lastActiveOf(u),
                                        ).toLocaleString("en-GB", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "Never"}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "text-[10px]",
                                      statusBadge(statusOf(u)),
                                    )}
                                  >
                                    {statusLabel(u)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-emerald-50 bg-white/80">
                        <p className="text-xs text-slate-500">
                          Showing {startIndex}–{endIndex} of {filtered.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-200 text-xs"
                            onClick={() =>
                              setActivityPage((p) => Math.max(1, p - 1))
                            }
                            disabled={activityPage <= 1}
                          >
                            Previous
                          </Button>
                          <div className="flex items-center gap-1.5 px-3 h-8 bg-white rounded-lg border border-slate-200 shadow-sm font-mono text-xs">
                            Page {activityPage} / {totalPages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-200 text-xs"
                            onClick={() =>
                              setActivityPage((p) =>
                                Math.min(totalPages, p + 1),
                              )
                            }
                            disabled={activityPage >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </GlowCard>

              {/* Announce dialog */}
              {/*<Dialog open={announceOpen} onOpenChange={setAnnounceOpen}>*/}
              {/*  <DialogContent className="sm:max-w-lg">*/}
              {/*    <DialogHeader>*/}
              {/*      <DialogTitle className="flex items-center gap-2">*/}
              {/*        <Sparkles className="h-4 w-4 text-emerald-600" />*/}
              {/*        Announce New Update*/}
              {/*      </DialogTitle>*/}
              {/*      <DialogDescription>*/}
              {/*        Delivers to the notification bell of the{" "}*/}
              {/*        <strong>{filtered.length}</strong> user*/}
              {/*        {filtered.length === 1 ? "" : "s"} currently listed*/}
              {/*        (respects the filters above).*/}
              {/*      </DialogDescription>*/}
              {/*    </DialogHeader>*/}
              {/*    <div className="space-y-3">*/}
              {/*      <Input*/}
              {/*        placeholder="Subject — e.g. New feature: User Activity tab"*/}
              {/*        value={announceSubject}*/}
              {/*        onChange={(ev) => setAnnounceSubject(ev.target.value)}*/}
              {/*      />*/}
              {/*      <Textarea*/}
              {/*        placeholder="Message — what's new and where to find it…"*/}
              {/*        rows={5}*/}
              {/*        value={announceMessage}*/}
              {/*        onChange={(ev) => setAnnounceMessage(ev.target.value)}*/}
              {/*      />*/}
              {/*    </div>*/}
              {/*    <DialogFooter className="gap-2 sm:gap-0">*/}
              {/*      <Button*/}
              {/*        variant="outline"*/}
              {/*        size="sm"*/}
              {/*        className="text-xs"*/}
              {/*        onClick={() => {*/}
              {/*          const emails = filtered*/}
              {/*            .map((u) => u.email)*/}
              {/*            .filter(Boolean)*/}
              {/*            .join(", ");*/}
              {/*          navigator.clipboard.writeText(emails).then(*/}
              {/*            () =>*/}
              {/*              toast.success(*/}
              {/*                `Copied ${filtered.length} email addresses`,*/}
              {/*              ),*/}
              {/*            () => toast.error("Could not copy to clipboard"),*/}
              {/*          );*/}
              {/*        }}*/}
              {/*      >*/}
              {/*        <Mail className="h-3.5 w-3.5 mr-1.5" />*/}
              {/*        Copy recipient emails*/}
              {/*      </Button>*/}
              {/*      <Button*/}
              {/*        size="sm"*/}
              {/*        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-xs text-white hover:from-emerald-700 hover:to-teal-700"*/}
              {/*        disabled={*/}
              {/*          isAnnouncing ||*/}
              {/*          !announceSubject.trim() ||*/}
              {/*          !announceMessage.trim()*/}
              {/*        }*/}
              {/*        onClick={async () => {*/}
              {/*          setIsAnnouncing(true);*/}
              {/*          try {*/}
              {/*            const { sent, failed } = await broadcastAnnouncement(*/}
              {/*              filtered.map((u) => u.id),*/}
              {/*              announceSubject.trim(),*/}
              {/*              announceMessage.trim(),*/}
              {/*            );*/}
              {/*            if (failed > 0)*/}
              {/*              toast.warning(*/}
              {/*                `Sent to ${sent} users, ${failed} failed`,*/}
              {/*              );*/}
              {/*            else*/}
              {/*              toast.success(`Announcement sent to ${sent} users`);*/}
              {/*            setAnnounceOpen(false);*/}
              {/*            setAnnounceSubject("");*/}
              {/*            setAnnounceMessage("");*/}
              {/*          } catch (err) {*/}
              {/*            toast.error(*/}
              {/*              err instanceof Error*/}
              {/*                ? err.message*/}
              {/*                : "Failed to send announcement",*/}
              {/*            );*/}
              {/*          } finally {*/}
              {/*            setIsAnnouncing(false);*/}
              {/*          }*/}
              {/*        }}*/}
              {/*      >*/}
              {/*        {isAnnouncing ? (*/}
              {/*          <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />*/}
              {/*        ) : (*/}
              {/*          <Sparkles className="h-3.5 w-3.5 mr-1.5" />*/}
              {/*        )}*/}
              {/*        Send to notification bell*/}
              {/*      </Button>*/}
              {/*    </DialogFooter>*/}
              {/*  </DialogContent>*/}
              {/*</Dialog>*/}
            </div>
          );
        })()}
    </DashboardLayout>
  );
};

export default DataPipelinePage;
