import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import EmbeddedDashboard from "@/components/dashboard/EmbeddedDashboard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Sparkles, BarChart3 } from "lucide-react";

/**
 * Dashboard IDs are set via environment variables so they can differ
 * between staging and production without a code change.
 */
const DASHBOARDS = [
  {
    key: "main",
    label: "ECAP+ Dashboard",
    id: import.meta.env.VITE_SUPERSET_DASHBOARD_ID_1 as string,
  },
  {
    key: "services",
    label: "Services",
    id: import.meta.env.VITE_SUPERSET_DASHBOARD_ID_2 as string,
  },
  {
    key: "performance",
    label: "Performance",
    id: import.meta.env.VITE_SUPERSET_DASHBOARD_ID_3 as string,
  },
].filter((d) => d.id); // only show tabs whose env var is set

const Charts = () => {
  const [activeTab, setActiveTab] = useState(DASHBOARDS[0]?.key ?? "main");
  const activeDashboard = DASHBOARDS.find((d) => d.key === activeTab);

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout subtitle="Charts">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Program dashboard</span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                <Activity className="h-3 w-3" /> Live
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                Program insights &amp; trends
              </span>
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                <Sparkles className="h-3 w-3" /> Superset · {DASHBOARDS.length} dashboards
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">Embedded analytics across coverage, services, and performance.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Tabs */}
        {DASHBOARDS.length > 1 && (
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl backdrop-blur-sm border border-slate-200/50">
            {DASHBOARDS.map((d) => {
              const isActive = activeTab === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setActiveTab(d.key)}
                  className={cn(
                    "rounded-lg px-4 h-8 text-xs font-bold uppercase tracking-wider transition-all",
                    isActive
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Embedded dashboard */}
        {activeDashboard ? (
          <EmbeddedDashboard
            key={activeDashboard.key}
            dashboardId={activeDashboard.id}
            title={activeDashboard.label}
          />
        ) : (
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md" />
            <div className="rounded-2xl border border-emerald-100/60 bg-white/80 backdrop-blur-xl p-12 text-center shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)]">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm">
                <BarChart3 className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-slate-900">No dashboards configured</p>
              <p className="mt-1 text-xs text-slate-500">
                Set <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">VITE_SUPERSET_DASHBOARD_ID_1</code> (and optionally _2, _3) in your environment variables, then restart the dev server.
              </p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Charts;
