import type { ReactNode } from "react";

import { subPopulationsFor } from "@/config";
import { isTrue } from "@/core/lib/values";

import type { Vca } from "../api/schemas";
import { vcaValue } from "./VcaRecordList";

const PII_FIELDS = new Set([
  "first_name",
  "firstname",
  "last_name",
  "lastname",
  "name",
  "caseworker_name",
  "cwac_member_name",
  "caregiver_name",
  "caseworker_phone",
  "phone",
  "phone_number",
  "mobile",
]);

export function VcaProfileSummary({ vca }: { vca: Vca }): ReactNode {
  const fields: ReadonlyArray<readonly [string, ...string[]]> = [
    ["Date of birth", "birthdate"],
    ["Gender", "vca_gender", "gender"],
    ["Age", "age"],
    ["Age group", "age_group"],
    ["School", "school_name", "school"],
    ["Caregiver relationship", "relation"],
    ["Province", "province"],
    ["District", "district"],
    ["Ward", "ward"],
    ["Case status", "case_status"],
    ["Member type", "member_type"],
    ["Date enrolled", "date_enrolled"],
    ["Date referred", "date_referred"],
    ["Date screened", "date_screened"],
    ["Last service date", "last_service_date"],
    ["Screening location", "screening_location"],
    ["Caseworker", "caseworker_name", "cwac_member_name"],
    ["Caseworker phone", "caseworker_phone"],
    ["HIV status", "is_hiv_positive"],
    ["On HIV treatment", "receiving_art"],
    ["ART number", "art_number"],
    ["HIV test date", "hiv_test_date"],
    ["Date started ART", "date_started_art"],
    ["MMD level", "level_mmd", "child_mmd"],
    ["Last viral-load date", "date_last_vl"],
    ["Next viral-load date", "date_next_vl"],
    ["Last viral-load result", "vl_last_result"],
    ["Next viral-load result", "vl_next_result"],
    ["Virally suppressed", "vl_suppressed", "virally_suppressed"],
    ["TB screening", "tb_screening"],
    ["TB preventive therapy", "takes_tb_preventive_therapy"],
    ["Birth certificate", "received_birth_certificate"],
    ["Pregnant / breastfeeding", "is_pregnant_breastfeeding"],
    ["Living with disability", "child_adolescent_living_with_disability"],
  ];
  const active = subPopulationsFor("vca").filter((item) => isTrue(vca[item.dataKey ?? item.key]));

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, ...keys]) => {
          const value = vcaValue(vca, keys);
          const privateValue = keys.some((key) => PII_FIELDS.has(key)) && value !== "—";
          return (
            <article key={label} className="rounded-lg border bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 break-words text-sm font-medium">
                {privateValue ? "Hidden for privacy" : value}
              </p>
            </article>
          );
        })}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Sub-population details</h2>
        {active.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {active.map((item) => (
              <span
                key={item.key}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800"
              >
                {item.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No configured sub-population flags recorded.
          </p>
        )}
      </section>
    </div>
  );
}
