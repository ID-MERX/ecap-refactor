import { useMemo, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { useAuth } from "@/core/auth";
import { displayName } from "@/core/auth/me";
import { ErrorState } from "@/platform/data-table/states";
import type { FyWindow } from "@/platform/scope/fy";

import { archivedHouseholdQuery, householdProfileQueries } from "../api/extended";
import type { Household } from "../api/schemas";
import { householdRegisterQuery, scopeKey } from "../api/queries";
import { HouseholdCasePlans } from "../components/HouseholdCasePlans";
import { HouseholdFlagPanel } from "../components/HouseholdFlagPanel";
import { ProfileDataList } from "../components/ProfileDataList";

const PROFILE_TABS = [
  "Summary",
  "Family members",
  "Case plans",
  "Caregiver services",
  "Referrals",
  "Flags",
] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];
const PROFILE_WINDOW: FyWindow = { from: null, to: null, label: "All time", slug: "all_time" };

function comparableId(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim().toLowerCase();
}

function findHousehold(rows: ReadonlyArray<Household>, id: string): Household | undefined {
  const wanted = comparableId(id);
  for (const row of rows) {
    const candidates = [
      row.householdId,
      ...["uid", "unique_id", "household_code", "household_id", "id"].map((key) => row.flags[key]),
    ];
    if (!candidates.some((candidate) => comparableId(candidate) === wanted)) continue;
    const canonical = [
      row.flags.household_id,
      row.flags.householdId,
      row.flags.hh_id,
      row.flags.id,
      row.householdId,
    ].find((value) => comparableId(value));
    return { ...row, householdId: String(canonical ?? id) };
  }
  return undefined;
}

export function HouseholdProfilePage(): ReactNode {
  const { householdId = "" } = useParams();
  const { state } = useAuth();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const profileScopeKey = scopeKey(scope);
  const [tab, setTab] = useState<ProfileTab>("Summary");

  // Search only the records fetched for this user's assigned scope. No by-ID detail request is made
  // until this lookup succeeds; this also avoids the old `location.state` scope bypass.
  const activeQuery = useQuery(householdRegisterQuery(scope, PROFILE_WINDOW));
  const archivedQuery = useQuery(archivedHouseholdQuery(scope, PROFILE_WINDOW, "all"));
  const household = useMemo(
    () =>
      findHousehold(
        [...(activeQuery.data?.rows ?? []), ...(archivedQuery.data?.rows ?? [])],
        householdId,
      ),
    [activeQuery.data, archivedQuery.data, householdId],
  );
  const detailQueries = useQueries({
    queries: householdProfileQueries(profileScopeKey, household?.householdId ?? ""),
  });

  if (activeQuery.isLoading || archivedQuery.isLoading) {
    if (!household) {
      return (
        <p
          role="status"
          className="rounded-lg border bg-white p-8 text-center text-sm text-slate-600"
        >
          Loading household profile…
        </p>
      );
    }
  }
  if (!household && activeQuery.error && archivedQuery.error) {
    return (
      <ErrorState
        error={activeQuery.error}
        onRetry={() => {
          void activeQuery.refetch();
          void archivedQuery.refetch();
        }}
      />
    );
  }
  if (!household) {
    const incomplete = Boolean(
      activeQuery.error ||
      archivedQuery.error ||
      activeQuery.data?.truncated ||
      archivedQuery.data?.truncated,
    );
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Household not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This record is not available in your assigned data scope.
        </p>
        {incomplete ? (
          <p role="status" className="mt-2 text-sm text-amber-800">
            One or more scoped registers could not be fully searched. Try again or contact your
            administrator.
          </p>
        ) : null}
        <Link to="/households" className="mt-4 inline-block text-sm font-medium text-brand-700">
          Back to households
        </Link>
      </section>
    );
  }

  const members = detailQueries[0]?.data ?? [];
  const services = detailQueries[1]?.data ?? [];
  const casePlans = detailQueries[2]?.data ?? [];
  const referrals = detailQueries[3]?.data ?? [];
  const detailError = detailQueries.find((query) => query.error)?.error;
  const isArchived = (archivedQuery.data?.rows ?? []).some(
    (row) => comparableId(row.householdId) === comparableId(household.householdId),
  );
  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <Link
          to={isArchived ? "/households/archived" : "/households"}
          className="text-sm text-brand-700"
        >
          ← Back to {isArchived ? "archived households" : "households"}
        </Link>
        <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
          {isArchived ? "Archived household" : "Household profile"}
        </p>
        <h1 className="text-2xl font-semibold">{household.householdId}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {household.facility ?? "Facility unavailable"} ·{" "}
          {household.district ?? "District unavailable"} ·{" "}
          {household.province ?? "Province unavailable"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Caregiver and family names and phone numbers are hidden for privacy.
        </p>
      </header>

      <nav
        aria-label="Household profile sections"
        className="flex flex-wrap gap-2 border-b border-slate-200"
      >
        {PROFILE_TABS.map((item) => (
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

      {tab === "Summary" ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Home address", household.homeAddress],
            ["Facility", household.facility],
            ["Province", household.province],
            ["District", household.district],
            ["Ward", household.ward],
            ["Caseworker", household.caseworkerName ? "Hidden for privacy" : null],
            ["Caseworker phone", household.flags.caseworker_phone ? "Hidden for privacy" : null],
            ["Status", isArchived ? household.reason : "Active"],
            ["Archived on", household.archivedOn],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</p>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "Family members" ? (
        <ProfileDataList
          title="Family members"
          rows={members}
          fields={[
            ["Member", "name", "child_name"],
            ["Relationship", "relationship", "relationship_to_caregiver"],
            ["Age", "age"],
            ["Sex", "sex"],
            ["Status", "status"],
          ]}
          maskFields={new Set(["name", "child_name"])}
          empty="No family member records found."
        />
      ) : null}
      {tab === "Case plans" ? (
        <HouseholdCasePlans
          householdId={household.householdId}
          scopeKey={profileScopeKey}
          rows={casePlans}
        />
      ) : null}
      {tab === "Caregiver services" ? (
        <ProfileDataList
          title="Caregiver services"
          rows={services}
          fields={[
            ["Service date", "service_date", "visit_date", "date"],
            ["Service", "service", "form_name", "type"],
            ["Facility", "facility"],
            ["Provider", "provider"],
          ]}
          empty="No caregiver services found."
        />
      ) : null}
      {tab === "Referrals" ? (
        <ProfileDataList
          title="Referrals"
          rows={referrals}
          fields={[
            ["Referral date", "referred_date", "referral_date", "service_date"],
            ["Service", "service", "referral_type", "type"],
            ["Facility", "facility"],
            ["Status", "status"],
          ]}
          empty="No referrals found."
        />
      ) : null}
      {tab === "Flags" ? (
        <HouseholdFlagPanel
          householdId={household.householdId}
          scopeKey={profileScopeKey}
          verifier={state.status === "authenticated" ? displayName(state.me) : "Unknown Verifier"}
        />
      ) : null}
      <p className="text-xs text-slate-500">
        Profile lookup uses the full active/archive registers in your assigned scope.
        Caregiver/member names and phone numbers are masked.
      </p>
    </div>
  );
}
