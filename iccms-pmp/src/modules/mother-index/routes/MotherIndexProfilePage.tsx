import type { ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { programConfig } from "@/config";
import { useAuth } from "@/core/auth";
import { useFyWindow } from "@/platform/scope/FyProvider";

import { motherProfileQuery } from "../api/queries";
import type { HouseholdChild, MotherRecord } from "../api/schemas";

function Field({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function answerClass(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("positive") || normalized === "yes" || normalized === "linked")
    return "bg-rose-100 text-rose-800";
  if (normalized.includes("negative") || normalized === "no" || normalized === "not linked")
    return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

function childHivLabel(value: boolean | null): string {
  return value === null ? "Unknown" : value ? "Positive" : "Negative";
}

function ChildRow({ child }: { child: HouseholdChild }): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <div>
        <p className="font-medium">
          {programConfig.terms.child} ID: {child.id}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {child.age} years · {child.sex}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-xs ${child.isIndex ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}
        >
          {child.isIndex ? programConfig.terms.primaryChild : "Household member"}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-xs ${child.hivPositive === true ? "bg-rose-100 text-rose-800" : child.hivPositive === false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
        >
          {childHivLabel(child.hivPositive)}
        </span>
      </div>
    </div>
  );
}

export function MotherIndexProfilePage(): ReactNode {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const selectedDistrict = params.get("district") ?? undefined;
  const { state } = useAuth();
  const window = useFyWindow();
  const scope = state.status === "authenticated" ? state.access.scope : { level: "none" as const };
  const query = useQuery(motherProfileQuery(scope, window, id, selectedDistrict));
  const mother: MotherRecord | null = query.data?.mother ?? null;
  const children = query.data?.children ?? [];
  const visibleChildren = children.slice(0, 8);

  if (scope.level === "none")
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">
          This mother record is not available in your access scope.
        </h1>
      </main>
    );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link to="/mother-index" className="w-fit text-sm text-brand-700 underline">
        ← Back to Mother Index
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {programConfig.terms.motherIndex} profile · {window.label}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Mother Index Name — Confidential</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
            #{mother?.householdId ?? "N/A"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {mother?.district ?? "Unknown district"} · {mother?.facility ?? "Unknown facility"}
        </p>
        {mother?.updatedAt ? (
          <p className="mt-1 text-xs text-slate-500">Last updated: {mother.updatedAt}</p>
        ) : null}
      </header>
      {query.isLoading ? (
        <p role="status" className="rounded-lg border bg-white p-4">
          Loading scoped mother profile…
        </p>
      ) : null}
      {query.isError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          Mother profile details could not be loaded. Please retry.
        </p>
      ) : null}
      {!query.isLoading && !query.isError && !mother ? (
        <section className="rounded-xl border bg-white p-6">
          <h2 className="font-semibold">Record not found</h2>
          <p className="mt-2 text-sm text-slate-600">
            No mother record with this ID was found within your permitted districts.
          </p>
        </section>
      ) : null}
      {mother ? (
        <>
          <section className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Mother Index Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Confidential profile · record ID {mother.motherId}
                </p>
              </div>
              {mother.householdId !== "N/A" ? (
                <Link
                  to={`/households/${encodeURIComponent(mother.householdId)}`}
                  className="rounded-md border px-3 py-2 text-sm text-brand-700"
                >
                  View household profile
                </Link>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Household ID" value={mother.householdId} />
              <Field label="Screening date" value={mother.enrolledDate ?? "N/A"} />
              <Field label="Date of birth" value={mother.dateOfBirth} />
              <Field label="Gender" value={mother.sex} />
              <Field label="Facility" value={mother.facility} />
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">HIV status</dt>
                <dd className="mt-1">
                  <span
                    className={`rounded-full px-2 py-1 text-sm ${answerClass(mother.hivStatus)}`}
                  >
                    {mother.hivStatus}
                  </span>
                </dd>
              </div>
              <Field label={programConfig.terms.implementingPartner} value={mother.partner} />
              <Field
                label="Home address"
                value={`${mother.homeAddress}${mother.landmark !== "N/A" ? ` · ${mother.landmark}` : ""}`}
              />
              <Field label="Province" value={mother.province} />
              <Field label="ART status" value={mother.artStatus} />
              <Field label="HEI status" value={mother.heiStatus} />
              <Field label="Linkage status" value={mother.linkageStatus} />
            </dl>
          </section>
          <section className="overflow-hidden rounded-xl border bg-white">
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <h2 className="font-semibold">{programConfig.terms.children} in this household</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Exact household and district match; names and contact fields are not shown.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{children.length}</span>
            </div>
            {visibleChildren.map((child) => (
              <ChildRow key={child.id} child={child} />
            ))}
            {children.length > 8 ? (
              <p className="border-t px-4 py-3 text-sm text-slate-500">
                + {children.length - 8} more household members
              </p>
            ) : null}
            {children.length === 0 ? (
              <p className="border-t px-4 py-8 text-center text-sm text-slate-500">
                No verified household members were returned.
              </p>
            ) : null}
          </section>
          {query.data?.truncatedDistricts.length ? (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              The scoped mother list exceeded its retained-row cap; some profile records may not be
              discoverable until the backend provides pagination or by-ID lookup.
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
