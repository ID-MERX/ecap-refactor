import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/platform/data-table/states";

import { casePlanDomainsQuery } from "../api/extended";
import { ProfileDataList, profileValue } from "./ProfileDataList";

type Props = {
  householdId: string;
  scopeKey: string;
  rows: ReadonlyArray<Record<string, unknown>>;
};

export function HouseholdCasePlans({ householdId, scopeKey, rows }: Props): ReactNode {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const domainsQuery = useQuery(casePlanDomainsQuery(scopeKey, householdId, expandedDate !== null));
  const domains = domainsQuery.data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Case plans</h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">
          No case plans found.
        </p>
      ) : (
        rows.map((plan, index) => {
          const date = profileValue(plan, ["case_plan_date", "date_of_caseplan", "date"]);
          const expanded = expandedDate === date;
          const exactDomains = domains.filter(
            (domain) => profileValue(domain, ["case_plan_date"]) === date,
          );
          const visibleDomains = exactDomains.length > 0 ? exactDomains : domains;

          return (
            <article
              key={String(plan.id ?? date ?? index)}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="grid gap-2 sm:grid-cols-4">
                <p>
                  <span className="text-xs text-slate-500">Plan date</span>
                  <br />
                  {date}
                </p>
                <p>
                  <span className="text-xs text-slate-500">Status</span>
                  <br />
                  {profileValue(plan, ["status"])}
                </p>
                <p>
                  <span className="text-xs text-slate-500">Review date</span>
                  <br />
                  {profileValue(plan, ["review_date"])}
                </p>
                <p>
                  <span className="text-xs text-slate-500">Next steps</span>
                  <br />
                  {profileValue(plan, ["next_steps", "action_plan"])}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedDate(expanded ? null : date)}
                className="mt-3 rounded border px-2 py-1 text-xs"
              >
                {expanded ? "Hide vulnerabilities" : "Show vulnerabilities"}
              </button>
              {expanded ? (
                domainsQuery.error ? (
                  <ErrorState
                    error={domainsQuery.error}
                    onRetry={() => void domainsQuery.refetch()}
                  />
                ) : domainsQuery.isLoading ? (
                  <p role="status" className="mt-3 text-sm text-slate-500">
                    Loading vulnerabilities…
                  </p>
                ) : (
                  <div className="mt-3">
                    {exactDomains.length === 0 && domains.length > 0 ? (
                      <p className="mb-2 text-xs text-amber-800">
                        No exact date match in source data; showing all case-plan domains.
                      </p>
                    ) : null}
                    <ProfileDataList
                      title="Case plan vulnerabilities"
                      rows={visibleDomains}
                      fields={[
                        ["Domain", "domain", "category", "vulnerability"],
                        ["Details", "description", "details"],
                        ["Action", "action", "action_plan"],
                      ]}
                      empty="No case-plan domains found."
                    />
                  </div>
                )
              ) : null}
            </article>
          );
        })
      )}
    </section>
  );
}
