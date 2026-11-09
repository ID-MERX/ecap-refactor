import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/platform/data-table/states";

import { vcaCasePlanDomainsQuery } from "../api/queries";
import { sortVcaRowsByDate } from "../model/table";
import { VcaRecordList, vcaValue } from "./VcaRecordList";

export function VcaCasePlans({
  scope,
  uniqueId,
  rows,
}: {
  scope: string;
  uniqueId: string;
  rows: ReadonlyArray<Record<string, unknown>>;
}): ReactNode {
  const [expanded, setExpanded] = useState<string | null>(null);
  const domainsQuery = useQuery(vcaCasePlanDomainsQuery(scope, uniqueId, expanded !== null));
  const domains = domainsQuery.data ?? [];
  const sortedRows = sortVcaRowsByDate(rows, ["case_plan_date", "date_of_caseplan", "date"]);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Case plans</h2>
      {sortedRows.length === 0 ? (
        <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">
          No case plans found.
        </p>
      ) : (
        sortedRows.map((row, index) => {
          const date = vcaValue(row, ["case_plan_date", "date_of_caseplan", "date"]);
          const isOpen = expanded === date;
          const matching = domains.filter(
            (domain) => vcaValue(domain, ["case_plan_date"]) === date,
          );
          const visible = matching.length ? matching : domains;
          return (
            <article
              key={String(row.id ?? date ?? index)}
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
                  {vcaValue(row, ["case_plan_status", "status"])}
                </p>
                <p>
                  <span className="text-xs text-slate-500">Created</span>
                  <br />
                  {vcaValue(row, ["date_created", "created_at"])}
                </p>
                <p>
                  <span className="text-xs text-slate-500">Edited</span>
                  <br />
                  {vcaValue(row, ["date_edited", "dateedited"])}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : date)}
                className="mt-3 rounded border px-2 py-1 text-xs"
              >
                {isOpen ? "Hide vulnerabilities" : "Show vulnerabilities"}
              </button>
              {isOpen ? (
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
                    {matching.length === 0 && domains.length ? (
                      <p className="mb-2 text-xs text-amber-800">
                        No exact date match in source data; showing all case-plan domains.
                      </p>
                    ) : null}
                    <VcaRecordList
                      title="Case-plan vulnerabilities"
                      rows={visible}
                      fields={[
                        ["Domain", "vulnerability_type"],
                        ["Vulnerability", "vulnerability"],
                        ["Goal", "goal"],
                        ["Services", "services"],
                        ["Due date", "due_date"],
                        ["Status", "status"],
                        ["Comment", "vulnerability_comment"],
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
