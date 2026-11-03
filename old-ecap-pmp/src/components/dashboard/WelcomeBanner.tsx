import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Calendar, Sparkles, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const WelcomeBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.first_name || "there";

  const isFirstLogin = sessionStorage.getItem("ecap.first_login") === "true";

  const getLocationLabel = () => {
    const desc = user?.description;
    if (desc === "District User" && user?.location) return user.location + " District";
    if (desc === "Provincial User" && user?.title) return user.title + " Province";
    return "All Districts";
  };

  const getRoleLabel = () => {
    const desc = user?.description;
    if (desc === "District User") return "District User";
    if (desc === "Provincial User") return "Provincial User";
    if (desc === "Administrator") return "Administrator";
    return "Staff";
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
      <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
      <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-teal-300/35 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

      <div className="relative z-10 flex flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">{getGreeting()}</span>
            <span className="text-slate-400 text-[11px]">·</span>
            <span className="text-[11px] text-slate-600">{dateStr}</span>
            <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
              <Activity className="h-3 w-3" /> Live data
            </Badge>
          </div>

          <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
              {isFirstLogin ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`}
            </span>
            <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
              <Sparkles className="h-3 w-3" /> {getLocationLabel()}
            </Badge>
          </h1>

          <p className="mt-1 text-xs text-slate-600">
            <strong className="text-slate-800">{getRoleLabel()}</strong> portal — monitor screening coverage, validate data quality, and coordinate fieldwork.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button
            onClick={() => navigate("/calendar")}
            className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-600" />
            Calendar
          </button>

          <button
            onClick={() => navigate("/flags")}
            className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-200 animate-pulse shadow-[0_0_8px_2px_rgba(167,243,208,0.8)]" />
            Start DQA Review
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeBanner;
