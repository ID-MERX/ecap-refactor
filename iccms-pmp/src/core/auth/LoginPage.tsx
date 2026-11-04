/**
 * Sign-in page.
 *
 * Behaviour ported from `legacy:src/components/LoginCard.tsx` + `AuthContext.login`, minus the parts
 * the audit flagged: no `known_users` list written to storage in plain text
 * (`docs/audit/auth.md` question 1), no `returning_user` flag that nothing reads.
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { siteConfig } from "@/config";
import { userMessage } from "@/core/api";

import { useAuth } from "./useAuth";

export function LoginPage(): ReactNode {
  const { state, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Email is sent exactly as typed: the audit records that some accounts depend on the exact
      // string, and trimming/changing case here would silently break them.
      await signIn(email, password);
    } catch (cause) {
      setError(userMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <img src={siteConfig.brand.logoMark} alt="" className="size-9" />
          <div>
            <h1 className="font-semibold tracking-tight">{siteConfig.appName}</h1>
            <p className="text-xs text-slate-500">{siteConfig.organization.name}</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Need help?{" "}
          <a className="underline" href={`mailto:${siteConfig.organization.supportEmail}`}>
            {siteConfig.organization.supportEmail}
          </a>
        </p>
      </div>
    </main>
  );
}
