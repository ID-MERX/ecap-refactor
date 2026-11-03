import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import AuroraBackground from "@/components/aceternity/AuroraBackground";
import VersionFooter from "@/components/VersionFooter";
import RightImageSlider from "@/components/RightImageSlider";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/context/AuthContext";
import { updateCurrentUserPassword } from "@/lib/directus";
import { cn } from "@/lib/utils";

const scorePassword = (password: string) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, refreshProfile, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const passwordScore = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = confirmPassword.length > 0 ? password === confirmPassword : null;
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email;

  useEffect(() => {
    if (user && !user.password_change_required) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("Password too short", {
        description: "Use at least 8 characters.",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSaving(true);
    try {
      await updateCurrentUserPassword(password);
      await refreshProfile();
      toast.success("Password updated", {
        description: "You can now continue to ECAP+ PMP.",
      });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error("Password change failed", {
        description:
          error instanceof Error
            ? error.message
            : "Unable to update your password. Contact an administrator if this continues.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuroraBackground>
      <main className="relative z-10 min-h-screen">
        <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative flex flex-col justify-center bg-white/95 px-6 py-12 sm:px-12 lg:px-16">
            <div className="mx-auto w-full max-w-md">
              <img src="/ecap-logo.png" alt="ECAP+ logo" className="w-auto" />
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                Account security
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Set your password
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {fullName
                  ? `${fullName}, choose a new password before continuing.`
                  : "Choose a new password before continuing."}
              </p>

              <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This account was created with a temporary password. A new password is required before platform access is enabled.
                </span>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 border-slate-200 bg-white pl-11 pr-10 font-mono text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-300/80"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="space-y-1">
                      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            passwordScore <= 1 && "w-1/4 bg-rose-400",
                            passwordScore === 2 && "w-1/2 bg-amber-400",
                            passwordScore === 3 && "w-3/4 bg-emerald-500",
                            passwordScore >= 4 && "w-full bg-emerald-600",
                          )}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Use a mix of upper and lower case letters, numbers, and symbols.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Confirm password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className={cn(
                        "h-12 border-slate-200 bg-white pl-11 pr-10 font-mono text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-300/80",
                        passwordsMatch === true && "border-emerald-300",
                        passwordsMatch === false && "border-rose-300",
                      )}
                      required
                    />
                    {passwordsMatch !== null && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {passwordsMatch ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full bg-emerald-700 text-white transition-transform duration-300 hover:-translate-y-0.5 hover:bg-emerald-800"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      Updating <LoadingDots />
                    </span>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>

              <button
                type="button"
                onClick={logout}
                className="mt-6 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-950"
              >
                Sign out instead
              </button>
            </div>
          </section>

          <aside className="relative hidden min-h-0 lg:block">
            <RightImageSlider
              images={[
                { src: "/pic-1.jpg", alt: "Program fieldwork photo" },
                { src: "/pic-3.jpg", alt: "Community program photo" },
              ]}
            />
            <div className="absolute bottom-10 left-10 right-10 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
                ECAP+ platform
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Secure access for program reporting.
              </h2>
            </div>
          </aside>
        </div>
      </main>
      <VersionFooter />
    </AuroraBackground>
  );
};

export default ChangePassword;
