import AuroraBackground from "@/components/aceternity/AuroraBackground";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";

type LoadingScreenProps = {
  label?: string;
};

const LoadingScreen = ({ label = "ECAP Plus PMP" }: LoadingScreenProps) => {
  return (
    <AuroraBackground>
      <div className="relative min-h-screen flex items-center justify-center px-6">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/50 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-green-200/40 blur-[110px]" />
        <GlowCard className="px-8 py-6">
          <div className="flex flex-col items-center text-center gap-3">
            <img src="/ecap-logo.png" alt="ECAP+ logo" className="h-14 w-auto" />
            <p className="text-sm font-semibold tracking-[0.3em] text-slate-500">
              {label}
            </p>
            <div className="flex items-center gap-2">
              Preparing your workspace <LoadingDots className="text-slate-700" />
            </div>
            <div className="mt-2 h-1 w-56 overflow-hidden rounded-full bg-slate-200/70">
              <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-emerald-400/90 to-transparent" />
            </div>
          </div>
        </GlowCard>
      </div>
    </AuroraBackground>
  );
};

export default LoadingScreen;
