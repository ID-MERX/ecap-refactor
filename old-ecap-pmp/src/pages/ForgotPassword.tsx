import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import AuroraBackground from "@/components/aceternity/AuroraBackground";
import VersionFooter from "@/components/VersionFooter";
import RightImageSlider from "@/components/RightImageSlider";
import { getDirectusBaseUrl } from "@/lib/env";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const emailToRequest = email.trim().toLowerCase();
      if (!emailToRequest) {
        toast.error("Please enter a valid email address.");
        setIsLoading(false);
        return;
      }

      const resetUrlBase = (import.meta.env.VITE_RESET_PASSWORD_URL || window.location.origin).replace(/\/$/, "");
      const resetUrl = `${resetUrlBase}/reset-password`;
      const directusUrl = getDirectusBaseUrl();

      const response = await fetch(`${directusUrl}/auth/password/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailToRequest, reset_url: resetUrl }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.error("Password Request Error:", data);

        // Internal logging for dev
        if (import.meta.env.DEV) {
          const firstError = data?.errors?.[0];
          const errorMessage = firstError?.message || "Request failed";
          throw new Error(`[DEV-ONLY] ${errorMessage}`);
        }
        // In prod, falling through to success message is safer
      }

      toast.success("If an account exists with this email, you will receive a password reset link shortly.");
      setEmail("");
    } catch (error) {
      if (import.meta.env.DEV) {
        toast.error(error instanceof Error ? error.message : "Unable to request reset");
      } else {
        // Prod fallback
        toast.success("If an account exists with this email, you will receive a password reset link shortly.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuroraBackground>
      <main className="relative z-10 min-h-screen">
        <div className="grid min-h-screen md:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center bg-white/95 px-6 py-12 sm:px-12 lg:px-16">
            <div className="max-w-md w-full">
              <img
                src="/ecap-logo.png"
                alt="ECAP+ logo"
                className="w-auto"
              />
              <p className="text-xs font-semibold tracking-[0.3em] text-slate-500">
                ECAP+
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Forgot your password?
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Enter your email and we will send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-11 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-300 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:ring-primary/30"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full bg-primary text-primary-foreground transition-transform duration-300 hover:-translate-y-0.5 hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending" : "Send reset link"}
                </Button>
              </form>

              <p className="mt-6 text-sm text-slate-600">
                Remembered it?{" "}
                <Link to="/" className="font-semibold text-slate-900 hover:text-slate-700">
                  Back to sign in
                </Link>
              </p>
            </div>
          </section>
          <aside className="relative min-h-[320px] md:min-h-0">
            <RightImageSlider
              images={[

                { src: "/pic-1.jpg", alt: " school lunch break" },
                // { src: "/pic-2.jpg", alt: "two kids smiling" },
                { src: "/pic-3.jpg", alt: "community member" }
              ]}
            />
            <div className="absolute bottom-10 left-10 right-10 text-white">
              <p className="text-xs font-semibold tracking-[0.4em] text-white/70">
                ECAP+ platform
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Track progress across communities with confidence.
              </h2>
              <p className="mt-2 text-sm text-white/80">
                Secure reporting, real-time insights, and streamlined monitoring in one place.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <VersionFooter />
    </AuroraBackground>
  );
};

export default ForgotPassword;
