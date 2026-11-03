import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, MailCheck } from "lucide-react";
import AuroraBackground from "@/components/aceternity/AuroraBackground";
import VersionFooter from "@/components/VersionFooter";
import RightImageSlider from "@/components/RightImageSlider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { acceptUserInvite } from "@/lib/directus";

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error("Invalid invitation link", {
        description:
          "No token was provided. Ask an administrator to resend the invite.",
      });
      navigate("/", { replace: true });
    }
  }, [navigate, token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password too short", {
        description: "Password must be at least 8 characters long.",
      });
      return;
    }

    setIsLoading(true);
    try {
      await acceptUserInvite(token ?? "", password);
      toast.success("Invitation accepted", {
        description: "You can now sign in with your new password.",
      });
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (error) {
      toast.error("Invite failed", {
        description:
          error instanceof Error
            ? error.message
            : "Unable to accept invitation",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuroraBackground>
      <main className="relative z-10 min-h-screen">
        <div className="grid min-h-screen md:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center bg-white/95 px-6 py-12 sm:px-12 lg:px-16">
            <div className="w-full max-w-md">
              <img
                src="/ecap-logo.png"
                alt="ECAP Plus logo"
                className="w-auto"
              />
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                ECAP+
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Accept your invite
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Create your password to activate this account.
              </p>

              <div className="mt-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This invitation can only be used once. After setting your
                  password, sign in from the main login page.
                </span>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="New password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 border-slate-200 bg-white pl-11 pr-10 font-mono text-slate-900 placeholder:text-slate-400 transition-all duration-300 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:ring-emerald-300/80"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 border-slate-200 bg-white pl-11 text-slate-900 placeholder:text-slate-400 transition-all duration-300 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:ring-emerald-300/80"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full bg-emerald-700 text-white transition-transform duration-300 hover:-translate-y-0.5 hover:bg-emerald-800"
                  disabled={isLoading}
                >
                  {isLoading ? "Activating..." : "Activate account"}
                </Button>
              </form>

              <p className="mt-6 text-sm text-slate-600">
                Already activated?{" "}
                <Link
                  to="/"
                  className="font-semibold text-slate-900 hover:text-slate-700"
                >
                  Back to sign in
                </Link>
              </p>
            </div>
          </section>
          <aside className="relative min-h-[320px] md:min-h-0">
            <RightImageSlider
              images={[
                {
                  src: "/pic-1.jpg",
                  alt: "ECAP Plus Program Image 1",
                  credit: {
                    label: "Sourced from Pexels - Under Pexels Free License",
                    url: "https://www.pexels.com/photo",
                  },
                },
                {
                  src: "/pic-3.jpg",
                  alt: "ECAP Plus Program Image 3",
                  credit: {
                    label: "Sourced from Pexels - Under Pexels Free License",
                    url: "https://www.pexels.com/photo",
                  },
                },
                {
                  src: "/pic-4.jpg",
                  alt: "ECAP Plus Program Image 4",
                  credit: {
                    label: "Sourced from Pexels - Under Pexels Free License",
                    url: "https://www.pexels.com/photo",
                  },
                },
              ]}
            />
            <div className="absolute bottom-10 left-10 right-10 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
                ECAP+ Platform
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Activate access for secure reporting.
              </h2>
            </div>
          </aside>
        </div>
      </main>
      <VersionFooter />
    </AuroraBackground>
  );
};

export default AcceptInvite;
