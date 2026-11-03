import {
  Database,
  Clock,
  Activity,
  Sparkles,
  Home,
  ClipboardList,
  HeartPulse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ServiceType } from "./service-records";

interface Props {
  type?: ServiceType;
  title: string;
  subtitle?: string;
  source?: string;
  generatedAt?: string;
}

const formatTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// Unified emerald palette across all service types — only chip icon/label varies
const SHARED_PALETTE = {
  eyebrow: "Service delivery",
  gradientText: "from-emerald-700 via-teal-600 to-sky-700",
  blob1: "bg-emerald-300/40",
  blob2: "bg-teal-300/35",
  radialA: "rgba(16,185,129,0.18)",
  radialB: "rgba(14,165,233,0.15)",
  chip: "border-emerald-200 bg-white/70 text-emerald-700",
  chipText: "text-emerald-700",
} as const;

const PALETTES: Record<
  ServiceType,
  {
    chipIcon: typeof Sparkles;
    chipLabel: string;
  }
> = {
  household: {
    chipIcon: Home,
    chipLabel: "Household level",
  },
  vca: {
    chipIcon: ClipboardList,
    chipLabel: "Children & adolescents",
  },
  caregiver: {
    chipIcon: HeartPulse,
    chipLabel: "Caregivers",
  },
};

const ServicesPageHeader = ({
  type = "household",
  title,
  subtitle,
  source,
  generatedAt,
}: Props) => {
  const meta = PALETTES[type];
  const ChipIcon = meta.chipIcon;
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.45)]">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 10% 20%, ${SHARED_PALETTE.radialA}, transparent 55%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 90% 30%, ${SHARED_PALETTE.radialB}, transparent 45%)`,
        }}
      />
      <div
        className={`pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full ${SHARED_PALETTE.blob1} blur-[110px] animate-pulse [animation-duration:6s]`}
      />
      <div
        className={`pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full ${SHARED_PALETTE.blob2} blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]`}
      />

      <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-[0.2em] ${SHARED_PALETTE.chipText}`}
            >
              {SHARED_PALETTE.eyebrow}
            </span>
            <span className="text-slate-400 text-[11px]">·</span>
            <span className="text-[11px] text-slate-600">{dateStr}</span>
            <Badge
              variant="outline"
              className={`ml-1 gap-1 ${SHARED_PALETTE.chip} text-[10px]`}
            >
              <Activity className="h-3 w-3" /> Live
            </Badge>
          </div>
          <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
            <span
              className={`bg-gradient-to-r ${SHARED_PALETTE.gradientText} bg-clip-text text-transparent`}
            >
              {title}
            </span>
            <Badge
              variant="outline"
              className={`ml-2 gap-1 h-6 w-fit ${SHARED_PALETTE.chip} align-middle text-[11px] shadow-sm`}
            >
              <ChipIcon className="h-3 w-3" /> {meta.chipLabel}
            </Badge>
          </h1>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-600 max-w-2xl">{subtitle}</p>
          )}
        </div>
        {(source || generatedAt) && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            {source && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
              >
                <Database className="h-3 w-3" /> Live database
              </Badge>
            )}
            {generatedAt && (
              <Badge
                variant="outline"
                className="gap-1 border-slate-200 bg-white/70 text-[10px] text-slate-600 backdrop-blur-md"
              >
                <Clock className="h-3 w-3" /> {formatTime(generatedAt)}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServicesPageHeader;
