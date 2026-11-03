import DashboardLayout from "@/components/dashboard/DashboardLayout";
import MetricsGrid from "@/components/dashboard/MetricsGrid";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  Home,
  ClipboardList,
  HeartPulse,
  Workflow,
  MapPin,
  Gauge,
  ClipboardCheck,
  LifeBuoy,
} from "lucide-react";

const QUICK_ACTIONS = [
  {
    icon: Activity,
    label: "VCA services",
    desc: "Service activity, pillar coverage, and audit log.",
    to: "/vca-services",
    iconBg: "from-violet-100 to-fuchsia-100 text-violet-700",
    glow: "from-violet-200/70 via-fuchsia-200/40",
  },
  {
    icon: HeartPulse,
    label: "Caregiver services",
    desc: "HIV monitoring, services, and graduation tracking.",
    to: "/caregiver-services",
    iconBg: "from-rose-100 to-pink-100 text-rose-700",
    glow: "from-rose-200/70 via-pink-200/40",
  },
  {
    icon: Home,
    label: "Household services",
    desc: "Service activity at the household level.",
    to: "/household-services",
    iconBg: "from-emerald-100 to-teal-100 text-emerald-700",
    glow: "from-emerald-200/70 via-teal-200/40",
  },
  {
    icon: LifeBuoy,
    label: "Help & support",
    desc: "Support center — guides, tickets, and assistance.",
    to: "/support",
    iconBg: "from-yellow-100 to-amber-100 text-amber-700",
    glow: "from-yellow-200/70 via-amber-200/40",
  },
  {
    icon: MapPin,
    label: "Caseworker journeys",
    desc: "GPS visit map, heatmap, and playback by caseworker.",
    to: "/caseworker-journeys",
    iconBg: "from-indigo-100 to-blue-100 text-indigo-700",
    glow: "from-indigo-200/70 via-blue-200/40",
  },
  {
    icon: Workflow,
    label: "Data pipeline",
    desc: "Pipeline runs, downloads, and tablet sync status.",
    to: "/data-pipeline",
    iconBg: "from-amber-100 to-orange-100 text-amber-700",
    glow: "from-amber-200/70 via-orange-200/40",
  },
  {
    icon: Gauge,
    label: "Performance",
    desc: "Facility, caseworker, and service-type benchmarks.",
    to: "/performance",
    iconBg: "from-cyan-100 to-teal-100 text-cyan-700",
    glow: "from-cyan-200/70 via-teal-200/40",
  },
  {
    icon: ClipboardCheck,
    label: "DQA review",
    desc: "Flagged records and data-quality remediation queue.",
    to: "/flags",
    iconBg: "from-emerald-100 to-green-100 text-emerald-700",
    glow: "from-emerald-200/70 via-green-200/40",
  },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout subtitle="Home">
      <WelcomeBanner />

      {/* ── Programme metrics ─────────────────────────────────────────── */}
      <div className="mb-8">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Programme metrics</h3>
        <MetricsGrid />
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Quick actions</h3>
          <span className="text-[11px] text-slate-400">Jump to any module</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="group relative w-full text-left"
                aria-label={a.label}
              >
                <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-br ${a.glow} to-transparent opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-100`} />
                <div className="relative h-full rounded-2xl border border-slate-200/70 bg-white/75 p-5 backdrop-blur-xl shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${a.iconBg} ring-1 ring-white/60 shadow-sm`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-slate-700" />
                  </div>
                  <div className="mt-4 text-sm font-bold text-slate-900">{a.label}</div>
                  <div className="mt-1 text-xs text-slate-500 leading-relaxed">{a.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </DashboardLayout>
  );
};

export default Dashboard;
