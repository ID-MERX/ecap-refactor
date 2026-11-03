import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AuroraBackgroundProps = {
  children: ReactNode;
  className?: string;
};

const AuroraBackground = ({ children, className }: AuroraBackgroundProps) => {
  return (
    <div className={cn("relative min-h-screen overflow-hidden bg-[#f8fafc] text-slate-900", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(34,197,94,0.16),_transparent_35%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,_rgba(20,184,166,0.18),_transparent_45%)]" />

      <div className="absolute inset-0 opacity-70">
        <div className="absolute -left-48 top-10 h-[22rem] w-[22rem] rounded-full bg-emerald-300/45 blur-[100px] animate-aurora" />
        <div className="absolute right-[-8rem] top-32 h-[26rem] w-[26rem] rounded-full bg-green-300/40 blur-[120px] animate-aurora [animation-delay:-6s]" />
        <div className="absolute bottom-[-10rem] left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-teal-300/35 blur-[140px] animate-aurora [animation-delay:-12s]" />
      </div>

      <div className="absolute inset-0 bg-grid-slate opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white/90" />

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default AuroraBackground;
