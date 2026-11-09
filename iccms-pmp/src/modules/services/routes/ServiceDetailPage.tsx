import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/core/auth";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { serviceDetailQuery } from "../api/queries";
import { isServiceType, type ServiceType } from "../api/schemas";

export function ServiceDetailPage(): ReactNode {
  const { type: typeParam, entityId: encodedId = "" } = useParams();
  const [params] = useSearchParams();
  const { state } = useAuth();
  const fyWindow = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const validType = isServiceType(typeParam);
  const type: ServiceType = validType ? (typeParam as ServiceType) : "vca";
  let entityId = encodedId;
  try {
    entityId = decodeURIComponent(encodedId);
  } catch {
    /* use the route's literal id */
  }
  const selectedDate = params.get("date") ?? "";
  const detailOptions = serviceDetailQuery(type, entityId, selectedDate, scope);
  const detail = useQuery({ ...detailOptions, enabled: validType && detailOptions.enabled });
  const selected = detail.data?.selected;
  const latest = detail.data?.latest;

  if (!validType) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Unknown service register</h1>
        <Link className="mt-3 inline-block text-brand-700 underline" to="/services/vca">
          Return to services
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link to={`/services/${type}`} className="w-fit text-sm text-brand-700 underline">
        ← Back to {type} services
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Service record · FY/custom context {fyWindow.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Entity {entityId}</h1>
      </header>
      {detail.isLoading ? (
        <p role="status" className="rounded-lg border bg-white p-4">
          Loading scoped service detail…
        </p>
      ) : null}
      {detail.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          This service record could not be loaded in your permitted scope.
        </p>
      ) : null}
      {selected && latest ? (
        <>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold">Visit selected from the register</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-slate-500">Selected visit date</dt>
                <dd className="mt-1">{selected.serviceDate}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">District</dt>
                <dd className="mt-1">{selected.district}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Facility</dt>
                <dd className="mt-1">{selected.facility}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Recorded domains</dt>
                <dd className="mt-1">{selected.pillars.join(", ") || "None recorded"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-slate-500">Recorded services</dt>
                <dd className="mt-1">{selected.serviceNames.join(", ") || "None recorded"}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold">Latest service detail</h2>
            {!detail.data?.isLatestVisit ? (
              <p
                role="status"
                className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                The backend detail endpoint returns the entity’s latest service, not the historical
                visit selected above. The detail below belongs to the latest service dated{" "}
                {latest.serviceDate}; it is not an exact-date lookup for {selected.serviceDate}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                This is the latest service on record for this entity.
              </p>
            )}
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase text-slate-500">Latest service date</dt>
                <dd className="mt-1">{latest.serviceDate}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">District</dt>
                <dd className="mt-1">{latest.district}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Facility</dt>
                <dd className="mt-1">{latest.facility}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Status</dt>
                <dd className="mt-1">{latest.status}</dd>
              </div>
            </dl>
            <div className="mt-5 space-y-3">
              {latest.servicesByDomain.map(({ domain, values }) => (
                <div key={domain} className="rounded-lg bg-slate-50 p-3">
                  <h3 className="font-medium">{domain}</h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {values.join(", ") || "No details recorded"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
      <p className="text-xs text-slate-500">
        Names, phone numbers, caseworker details, and raw joined backend fields are intentionally
        not displayed.
      </p>
    </main>
  );
}
