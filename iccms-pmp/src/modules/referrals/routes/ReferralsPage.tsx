import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/core/auth";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { allowedReferralDistricts } from "../api/client";
import { caregiverReferralMonthsQuery, vcaReferralMonthsQuery } from "../api/queries";
import { combineReferralMonths } from "../model/monthly";

function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

export function ReferralsPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const selectedDistrict =
    scope.level === "district" ? scope.district : (params.get("district") ?? undefined);
  const caregiverQuery = useQuery(caregiverReferralMonthsQuery(scope, window, selectedDistrict));
  const vcaQuery = useQuery(vcaReferralMonthsQuery(scope, window, selectedDistrict));
  const allowedDistricts = allowedReferralDistricts(scope);
  const monthly = combineReferralMonths(caregiverQuery.data?.rows ?? [], vcaQuery.data?.rows ?? []);
  const max = Math.max(1, ...monthly.map((row) => Math.max(row.caregivers, row.children)));

  function changeDistrict(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("district", value);
    else next.delete("district");
    setParams(next, { replace: true });
  }

  if (scope.level === "none")
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">
          Referrals are not available in your current access scope.
        </h1>
      </main>
    );

  return (
    <main className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Referrals &amp; Linkages
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Referrals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monthly aggregate snapshots by beneficiary group.
        </p>
      </header>
      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District scope is fixed: <strong>{scope.district}</strong>
        </p>
      ) : (
        <label className="flex w-fit flex-col gap-1 text-sm">
          District
          <select
            value={selectedDistrict ?? ""}
            onChange={(event) => changeDistrict(event.target.value)}
            className="rounded-md border bg-white px-3 py-2"
          >
            <option value="">All permitted districts</option>
            {allowedDistricts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </label>
      )}
      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <h2 className="font-semibold">Referral register unavailable</h2>
        <p className="mt-1">
          The backend has no working district-level referral-list endpoint. The legacy list requests
          404 and its service fallback is not a reliable referral source. This module stays disabled
          by default until a scoped list endpoint is available; this scaffold shows only the
          existing monthly aggregates.
        </p>
      </section>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Platform window: {window.label}. Date bounds are sent to the monthly endpoints for future
        backend support, but those handlers currently ignore them. Monthly counts are all-time;
        caregiver and child totals may overlap and must not be added as a combined total.
      </p>
      {caregiverQuery.isError || vcaQuery.isError ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>One or more monthly referral summaries could not be loaded.</span>
          <button
            type="button"
            onClick={() => {
              void caregiverQuery.refetch();
              void vcaQuery.refetch();
            }}
            className="rounded-md border border-red-300 px-3 py-1"
          >
            Retry
          </button>
        </div>
      ) : null}
      <section className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <article>
          <p className="text-sm text-slate-500">Caregiver monthly aggregate</p>
          <p className="mt-1 text-2xl font-semibold">
            {(caregiverQuery.data?.rows ?? [])
              .reduce((sum, row) => sum + row.count, 0)
              .toLocaleString()}
          </p>
        </article>
        <article>
          <p className="text-sm text-slate-500">VCA monthly aggregate</p>
          <p className="mt-1 text-2xl font-semibold">
            {(vcaQuery.data?.rows ?? []).reduce((sum, row) => sum + row.count, 0).toLocaleString()}
          </p>
        </article>
      </section>
      <section className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold">Monthly referral counts</h2>
        <p className="mt-1 text-xs text-slate-500">
          Caregiver and VCA series are shown separately because source records may overlap.
        </p>
        <div className="mt-5 space-y-4">
          {monthly.map((row) => (
            <div key={row.month} className="grid grid-cols-[4rem_1fr] items-center gap-3">
              <span className="text-sm tabular-nums">{formatMonth(row.month)}</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-slate-600">Caregiver</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-brand-600"
                      style={{ width: `${(row.caregivers / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums">{row.caregivers}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-xs text-slate-600">VCA</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-indigo-500"
                      style={{ width: `${(row.children / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums">{row.children}</span>
                </div>
              </div>
            </div>
          ))}
          {monthly.length === 0 && !caregiverQuery.isLoading && !vcaQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No monthly referral aggregates are available for this scope.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
