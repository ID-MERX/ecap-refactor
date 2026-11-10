import type { ReactNode } from "react";

import { displayName, roleName, useAuth } from "@/core/auth";

/** Uses only the current profile already loaded by AuthProvider; it never fetches a user by ID. */
export function AccountPage(): ReactNode {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;

  const name = displayName(state.me);
  const role = roleName(state.me) ?? "No role assigned";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</p>
        <h1 className="mt-1 text-2xl font-semibold">My account</h1>
        <p className="mt-1 text-sm text-slate-600">Your identity and access information.</p>
      </header>
      <section className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-semibold text-brand-700"
        >
          {initials || "U"}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          <p className="truncate text-sm text-slate-600">{state.me.email}</p>
          <p className="mt-1 text-xs text-slate-500">{role}</p>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Access information</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your permissions are synced from the server. Contact an administrator if your role needs
          to be updated.
        </p>
      </section>
      <section
        role="status"
        className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950"
      >
        <h2 className="font-semibold">Profile changes unavailable</h2>
        <p className="mt-2">
          Avatar and password actions are not available here until their self-service permissions
          and file access are verified. This page makes no additional profile requests or changes.
        </p>
      </section>
    </main>
  );
}
