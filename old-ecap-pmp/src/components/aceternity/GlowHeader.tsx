import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type GlowHeaderProps = {
  children: ReactNode;
  className?: string;
};

const GlowHeader = ({ children, className }: GlowHeaderProps) => {
  return (
    <header
      className={cn(
        "relative flex h-16 items-center border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-xl",
        className,
      )}
      style={{ backgroundColor: 'var(--header-color)' } as any}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-100/40 via-transparent to-green-100/40 opacity-70" />
      <div className="relative z-10 flex w-full items-center gap-4">{children}</div>
    </header>
  );
};

export default GlowHeader;
