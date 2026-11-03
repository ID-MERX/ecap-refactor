import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
};

const SpotlightCard = ({ children, className }: SpotlightCardProps) => {
  return (
    <div className={cn("group relative w-full", className)}>
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-emerald-300/45 via-green-200/35 to-transparent opacity-70 blur-lg transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative rounded-2xl border border-slate-200/70 bg-white/70 p-8 backdrop-blur-xl shadow-[0_24px_70px_-50px_rgba(15,23,42,0.4)]">
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/70" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-emerald-200/60 blur-3xl" />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
};

export default SpotlightCard;
