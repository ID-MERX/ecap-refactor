import { useMemo, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { useAuth } from "@/core/auth";
import { displayName } from "@/core/auth/me";
import { ErrorState } from "@/platform/data-table/states";

import {
  vcaActiveQuery,
  vcaArchivedQuery,
  vcaProfileQueries,
  vcaScopeKey,
  type VcaIdentifiers,
} from "../api/queries";
import type { Vca } from "../api/schemas";
import { vcaMatchesId } from "../api/schemas";
import { VcaCasePlans } from "../components/VcaCasePlans";
import { VcaFlagPanel } from "../components/VcaFlagPanel";
import { VcaProfileSummary } from "../components/VcaProfileSummary";
import { VcaRecordList, vcaValue } from "../components/VcaRecordList";
import { sortVcaRowsByDate } from "../model/table";

const PROFILE_WINDOW = { from: null, to: null, label: "All time", slug: "all_time" } as const;
const TABS = ["Summary", "Case plans", "Services", "Referrals", "Flags"] as const;
type Tab = (typeof TABS)[number];
function identifiers(vca: Vca): VcaIdentifiers {
  const routeId = vca.vcaId;
  return {
    routeId,
    serviceId: vca.vcaid ?? vca.uid ?? vca.uniqueId ?? routeId,
    uniqueId: vca.uniqueId ?? vca.uid ?? routeId,
    flagId: vca.vcaid ?? vca.uid ?? vca.uniqueId ?? routeId,
    flagIds: [
      ...new Set(
        [vca.vcaid, vca.uid, vca.uniqueId, routeId].filter((value): value is string =>
          Boolean(value),
        ),
      ),
    ],
  };
}

export function VcaProfilePage(): ReactNode {
  const { vcaId = "" } = useParams();
  const { state } = useAuth();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const scopeKey = vcaScopeKey(scope);
  const [tab, setTab] = useState<Tab>("Summary");
  const activeQuery = useQuery(vcaActiveQuery(scope, PROFILE_WINDOW));
  const archivedQuery = useQuery(vcaArchivedQuery(scope, PROFILE_WINDOW, "all"));
  const match = useMemo(() => {
    const active = (activeQuery.data?.rows ?? []).find((row) => vcaMatchesId(row, vcaId));
    if (active) return { vca: active, archived: false };
    const archived = (archivedQuery.data?.rows ?? []).find((row) => vcaMatchesId(row, vcaId));
    return archived ? { vca: archived, archived: true } : null;
  }, [activeQuery.data, archivedQuery.data, vcaId]);
  const matchedVca = match?.vca ?? null;
  const recordIds = useMemo(() => (matchedVca ? identifiers(matchedVca) : null), [matchedVca]);
  const detailQueries = useQueries({ queries: vcaProfileQueries(scopeKey, recordIds) });

  if ((activeQuery.isLoading || archivedQuery.isLoading) && !matchedVca)
    return (
      <p
        role="status"
        className="rounded-lg border bg-white p-8 text-center text-sm text-slate-600"
      >
        Loading scoped VCA records…
      </p>
    );
  if (!matchedVca && activeQuery.error && archivedQuery.error)
    return (
      <ErrorState
        error={activeQuery.error}
        onRetry={() => {
          void activeQuery.refetch();
          void archivedQuery.refetch();
        }}
      />
    );
  if (!matchedVca)
    return (
      <section className="rounded-xl border bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">VCA not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This record is not available in your assigned data scope.
        </p>
        {activeQuery.data?.truncated ||
        archivedQuery.data?.truncated ||
        activeQuery.error ||
        archivedQuery.error ? (
          <p role="status" className="mt-2 text-sm text-amber-800">
            A scoped register could not be fully searched. Retry or contact your administrator.
          </p>
        ) : null}
        <Link to="/vcas" className="mt-4 inline-block text-sm font-medium text-brand-700">
          Back to VCA register
        </Link>
      </section>
    );

  const services = sortVcaRowsByDate(detailQueries[0]?.data ?? [], [
    "service_date",
    "visit_date",
    "date",
  ]);
  const casePlans = detailQueries[1]?.data ?? [];
  const referrals = sortVcaRowsByDate(detailQueries[2]?.data ?? [], [
    "service_date",
    "visit_date",
    "date",
  ]);
  const detailError = detailQueries.find((query) => query.error)?.error;
  const archived = match?.archived ?? false;
  const lastService = services[0]
    ? vcaValue(services[0], ["service_date", "visit_date", "date"])
    : vcaValue(matchedVca, ["last_service_date"]);

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-xl border bg-white p-5">
        <Link to={archived ? "/vcas/archived" : "/vcas"} className="text-sm text-brand-700">
          ← Back to {archived ? "archived VCAs" : "VCAs"}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs ${archived ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}
          >
            {archived ? "Deregistered" : "Active"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">ID {matchedVca.vcaId}</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">VCA profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          {matchedVca.district ?? "District unavailable"} ·{" "}
          {matchedVca.province ?? "Province unavailable"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          VCA/caregiver/member names and phone numbers are hidden for privacy.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <article className="rounded-lg border p-3">
            <p className="text-xs text-slate-500">Household</p>
            {matchedVca.householdId ? (
              <Link
                className="text-sm text-brand-700"
                to={`/households/${encodeURIComponent(matchedVca.householdId)}`}
              >
                {matchedVca.householdId}
              </Link>
            ) : (
              <p className="text-sm">—</p>
            )}
          </article>
          <article className="rounded-lg border p-3">
            <p className="text-xs text-slate-500">Facility</p>
            <p className="text-sm">{vcaValue(matchedVca, ["facility", "health_facility"])}</p>
          </article>
          <article className="rounded-lg border p-3">
            <p className="text-xs text-slate-500">Last service</p>
            <p className="text-sm">{lastService}</p>
          </article>
        </div>
      </header>
      <nav aria-label="VCA profile sections" className="flex flex-wrap gap-2 border-b">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
            className={`border-b-2 px-3 py-2 text-sm ${tab === item ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-slate-600"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      {detailError ? (
        <ErrorState
          error={detailError}
          onRetry={() => detailQueries.forEach((query) => void query.refetch())}
        />
      ) : null}
      {tab === "Summary" ? <VcaProfileSummary vca={matchedVca} /> : null}
      {tab === "Case plans" ? (
        <VcaCasePlans scope={scopeKey} uniqueId={recordIds?.uniqueId ?? ""} rows={casePlans} />
      ) : null}
      {tab === "Services" ? (
        <VcaRecordList
          title="Services"
          rows={services}
          fields={[
            ["Date", "service_date", "visit_date", "date"],
            ["Health", "health_services"],
            ["HIV", "hiv_services"],
            ["Schooled", "schooled_services"],
            ["Safe", "safe_services"],
            ["Stable", "stable_services"],
          ]}
          empty="No service records found."
        />
      ) : null}
      {tab === "Referrals" ? (
        <VcaRecordList
          title="Referrals"
          rows={referrals}
          fields={[
            ["Service", "service", "service_name", "form_name", "referral_type"],
            ["Date", "service_date", "visit_date", "date"],
            ["Status", "status", "state"],
          ]}
          empty="No referral records found."
        />
      ) : null}
      {tab === "Flags" ? (
        <VcaFlagPanel
          scope={scopeKey}
          vcaId={recordIds?.flagId ?? ""}
          flagIds={recordIds?.flagIds ?? []}
          householdId={matchedVca.householdId}
          facility={typeof matchedVca.facility === "string" ? matchedVca.facility : null}
          verifier={state.status === "authenticated" ? displayName(state.me) : "Unknown Verifier"}
        />
      ) : null}
      <p className="text-xs text-slate-500">
        Profile access requires a match in your scoped active/archive registers; by-ID backend scope
        enforcement is still a follow-up.
      </p>
    </div>
  );
}
