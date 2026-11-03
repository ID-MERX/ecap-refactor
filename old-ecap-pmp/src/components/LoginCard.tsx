import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Sparkles, Activity, ArrowRight, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import LoadingDots from "@/components/aceternity/LoadingDots";

const LoginCard = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [knownUsers] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("ecap.known_users") || "[]");
    } catch {
      return [];
    }
  });

  const isReturningUser = useMemo(() => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return knownUsers.length > 0;
    return knownUsers.includes(trimmedEmail);
  }, [email, knownUsers]);

  const handleSubmit = (e: React.FormEvent) => {
    setError(null);
    e.preventDefault();
    login(email, password)
      .then((profile) => {
        const trimmedEmail = email.trim().toLowerCase();
        const isFirstLogin = !knownUsers.includes(trimmedEmail);
        sessionStorage.setItem("ecap.first_login", isFirstLogin ? "true" : "false");
        const updatedUsers = Array.from(new Set([...knownUsers, trimmedEmail]));
        localStorage.setItem("ecap.known_users", JSON.stringify(updatedUsers));
        localStorage.setItem("ecap.returning_user", "true");
        navigate(profile?.password_change_required ? "/change-password" : "/dashboard");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Login failed");
      });
  };

  return (
    <div className="animate-fade-in w-full max-w-md">
      {/* ── Glass card ────────────────────────────────────────── */}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-br from-emerald-300/40 via-teal-300/30 to-sky-300/30 blur-md opacity-60" />

        <div className="relative rounded-3xl border border-emerald-200/60 bg-white/80 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)] p-8">
          {/* Logo + brand */}
          <div className="flex flex-col items-center gap-2 text-center">
            <img
              src="/ecap-logo.png"
              alt="ECAP+ logo"
              className="h-12 w-auto"
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Program Management Platform
            </span>
          </div>

          {/* Greeting */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                <Activity className="h-3 w-3" /> {isReturningUser ? "Welcome back" : "First time here"}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                {isReturningUser ? "Sign in to continue" : "Welcome to the platform"}
              </span>
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Sign in to continue data reporting and monitoring.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Mail className="h-3 w-3 text-slate-400" />
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-9 bg-white/80 backdrop-blur-md border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-300 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <Lock className="h-3 w-3 text-slate-400" />
                Password
              </label>
              <div className="relative group/password">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within/password:text-emerald-500 transition-colors" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-9 pr-11 bg-white/80 backdrop-blur-md border-slate-200 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-300 transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full h-11 rounded-lg overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div aria-hidden className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 blur-sm opacity-50 group-hover:opacity-80 transition-opacity" />
              <div className="relative h-full w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 text-sm font-semibold text-white shadow-md shadow-emerald-700/30 transition-all hover:from-emerald-700 hover:via-teal-700 hover:to-sky-700">
                {isLoading ? (
                  <>Signing in <LoadingDots /></>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginCard;
