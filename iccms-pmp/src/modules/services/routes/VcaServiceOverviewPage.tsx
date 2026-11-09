import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/core/auth";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { districtsForServicesScope, serviceDistrictsForFilter } from "../api/client";
import {
  serviceDistributionQuery,
  serviceSummaryQuery,
  serviceTimeseriesQuery,
} from "../api/queries";

function count(value: unknown): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "—";
}

export function VcaServiceOverviewPage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const { state } = useAuth();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const window = useFyWindow();
  const district =
    scope.level === "district" ? scope.district : (params.get("district") ?? undefined);
  const districts = districtsForServicesScope(scope);
  const safeDistrict =
    district && serviceDistrictsForFilter(scope, district).length ? district : undefined;
  const summary = useQuery(serviceSummaryQuery("vca", scope, window, safeDistrict));
  const timeseries = useQuery(serviceTimeseriesQuery("vca", scope, safeDistrict));
  const distribution = useQuery(serviceDistributionQuery("vca", scope, safeDistrict));
  const data = summary.data?.data ?? {};
  const seriesByMonth = new Map((timeseries.data ?? []).map((point) => [point.month, point]));
  const now = new Date();
  const series = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const existing = seriesByMonth.get(month);
    return (
      existing ?? {
        month,
        label: new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(monthDate),
        count: 0,
      }
    );
  });
  const max = Math.max(1, ...series.map((point) => point.count));

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Read-only dashboard · VCA services
          </p>
          <h1 className="mt-1 text-2xl font-semibold">VCA service overview</h1>
          <p className="mt-1 text-sm text-slate-600">Cohort summary window: {window.label}</p>
        </div>
        <Link to="/services/vca" className="rounded-md border bg-white px-3 py-2 text-sm">
          Open VCA register
        </Link>
      </header>
      {scope.level === "district" ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm">
          District scope is fixed: <strong>{scope.district}</strong>
        </p>
      ) : (
        <label className="flex w-fit flex-col gap-1 text-sm">
          District filter
          <select
            value={safeDistrict ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) next.set("district", event.target.value);
              else next.delete("district");
              setParams(next, { replace: true });
            }}
            className="rounded-md border bg-white px-3 py-2"
          >
            <option value="">All permitted districts</option>
            {districts.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        The FY/custom window ({window.label}) applies to the cohort summary. The time series always
        covers the backend’s last 12 calendar months, and the domain distribution always covers its
        last 90 days.
      </p>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Enrolled", data.enrolled],
          ["Active", data.active],
          ["CLHIV", data.clhiv],
          ["Services this month", data.services_this_month],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">{String(label)}</p>
            <p className="mt-1 text-2xl font-semibold">{count(value)}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Monthly service volume · last 12 months</h2>
          <div className="mt-4 space-y-3">
            {series.map((point) => (
              <div
                key={point.month}
                className="grid grid-cols-[4rem_1fr_4rem] items-center gap-2 text-sm"
              >
                <span>{point.label}</span>
                <div className="h-3 overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded bg-brand-600"
                    style={{ width: `${Math.max(2, (point.count / max) * 100)}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{count(point.count)}</span>
              </div>
            ))}
            {timeseries.isError ? (
              <p className="text-sm text-slate-500">Monthly data is temporarily unavailable.</p>
            ) : null}
          </div>
        </article>
        <article className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Service domains · last 90 days</h2>
          <div className="mt-4 space-y-3">
            {(distribution.data ?? []).map((item) => (
              <div
                key={item.service}
                className="flex items-center justify-between border-b pb-2 text-sm"
              >
                <span>{item.service}</span>
                <span className="font-medium tabular-nums">{count(item.count)}</span>
              </div>
            ))}
            {(distribution.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No domain distribution is available.</p>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Domain counts can overlap; percentages are not additive.
          </p>
        </article>
      </section>
      {summary.isError || timeseries.isError || distribution.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          Some overview data could not be loaded. Retry after checking connectivity.
        </p>
      ) : null}
      <p className="text-xs text-slate-500">
        This dashboard is read-only. Duplicate-review writes are intentionally unavailable until
        backend permission and scope enforcement are implemented.
      </p>
    </main>
  );
}
