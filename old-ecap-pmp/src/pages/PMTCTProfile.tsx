import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { ArrowLeft, Activity, HeartPulse } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const pick = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "N/A";
};

const pickPmctctId = (record: Record<string, unknown>) =>
  pick(record, [
    "pmtct_id",
    "pmtctid",
    "ecap_id",
    "ecapid",
    "mother_id",
    "motherid",
    "client_number",
    "client_no",
    "ca_id",
    "caid",
    "household_id",
    "householdId",
    "unique_id",
    "uid",
    "id",
  ]);

const PMTCTProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const record = useMemo(() => {
    const fromState = ((location.state as { record?: Record<string, unknown> } | null)?.record ?? null) as Record<string, unknown> | null;
    if (fromState && Object.keys(fromState).length > 0) return fromState;

    try {
      const saved = sessionStorage.getItem("pmtct_profile_record");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        if (parsed && Object.keys(parsed).length > 0) return parsed;
      }
    } catch {
      // ignore storage / parse failures
    }

    return {} as Record<string, unknown>;
  }, [location.state]);

  const id = pickPmctctId(record);
  const facility = pick(record, ["facility", "facility_name", "health_facility"]);
  const district = pick(record, ["district", "district_name"]);
  const hiv = pick(record, ["result_of_hiv_test", "result_r_nr", "test_result_at_birth", "infant_hiv_status", "hiv_status"]);
  const date = pick(record, ["date_enrolled_pmtct", "date_1st_visit", "dbs_at_birth_actual_date", "date_tested"]);
  const beneficiaryType = pick(record, ["beneficiary_type", "type", "record_type", "client_type"]);
  const recordKeyFields = [
    ["PMTCT ID", id],
    ["ECAP ID", pick(record, ["ecap_id", "ecapid"])],
    ["ECAP Question", pick(record, ["ecap_id_question"])],
  ];
  const caregiver = pick(record, ["mother_name", "client_name", "beneficiary_name", "child_name"]);
  const phone = pick(record, ["mothers_phone", "phone_number", "contact", "telephone"]);
  const partner = pick(record, ["partner", "male_partner_name", "spouse_name"]);
  const address = pick(record, ["home_address", "homeaddress", "address"]);
  const landmark = pick(record, ["nearest_landmark", "landmark"]);
  const age = pick(record, ["mothers_birthdate", "caregiver_age", "age"]);

  const isPositive = /positive|reactive|yes/i.test(hiv);

  return (
    <DashboardLayout subtitle={`PMTCT Profile: ${id}`}>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.14),transparent_45%)]" />
          <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">PMTCT profile</span>
                <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                  <Activity className="h-3 w-3" />
                  Record details
                </Badge>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                  {id}
                </span>
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                {beneficiaryType || "PMTCT beneficiary"} · {district || "Unknown district"} · {facility || "Unknown facility"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => navigate(-1)} className="border-slate-200 bg-white/80">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        </div>

        <GlowCard className="overflow-hidden border border-slate-100 bg-white">
          <CardHeader className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <CardTitle className="text-sm font-bold text-slate-900">Record Details</CardTitle>
                <p className="mt-1 text-[10px] font-medium text-slate-400">Structured PMTCT profile summary</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50/80 text-emerald-700">PMTCT</Badge>
                <Badge variant="outline" className={isPositive ? "border-rose-200 bg-rose-50/80 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
                  {hiv}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ...recordKeyFields,
                ["Beneficiary Type", beneficiaryType],
                ["Caregiver", caregiver],
                ["Sex", pick(record, ["caregiver_sex", "sex"])],
                ["Birthdate / Age", age],
                ["Province", pick(record, ["province"])],
                ["District", district],
                ["Ward", pick(record, ["ward"])],
                ["Facility", facility],
                ["Home Address", address],
                ["Landmark", landmark],
                ["Phone", phone],
                ["Partner", partner],
                ["Relation", pick(record, ["relation"])],
                ["Caseworker", pick(record, ["caseworker_name"])],
                ["Date Enrolled PMTCT", pick(record, ["date_enrolled_pmtct"])],
                ["Date Enrolled ECAP", pick(record, ["date_enrolled_ecap"])],
                ["Date Initiated ART", pick(record, ["date_initiated_art", "date_initiated_on_art", "date_initiated_on_treatment"])],
                ["Date Tested", pick(record, ["date_tested"])],
                ["Recency Result", pick(record, ["recency_test_result", "recency_test_result_if_applicable", "applicable_recency_result"])],
                ["TB Screening", pick(record, ["tb_screening"])],
                ["Syphilis Testing", pick(record, ["syphilis_testing"])],
                ["1st Visit", pick(record, ["date_1st_visit"])],
                ["6 Weeks", pick(record, ["hiv_test_result_r_nr_at_6_weeks", "art_initiated_at_6_weeks", "family_planning_counselling_at_6_weeks"])],
                ["6 Months", pick(record, ["hiv_test_result_r_nr_at_6_months", "art_initiated_at_6_months", "family_planning_counselling_at_6_months"])],
                ["9 Months", pick(record, ["hiv_test_result_r_nr_at_9_months", "art_initiated_at_9_months", "family_planning_counselling_at_9_months"])],
                ["12 Months", pick(record, ["hiv_test_result_r_nr_at_12_months", "art_initiated_at_12_months", "family_planning_counselling_at_12_months"])],
                ["18 Months", pick(record, ["hiv_test_result_r_nr_at_18_months", "art_initiated_at_18_months", "family_planning_counselling_at_18_months"])],
              ].map(([label, value]) => {
                const empty = value === "N/A";
                return (
                  <div key={label} className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 sm:p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
                    <div className={`mt-1.5 break-words text-sm font-semibold leading-5 ${empty ? "text-slate-400" : "text-slate-900"}`}>
                      {value}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </GlowCard>
      </div>
    </DashboardLayout>
  );
};

export default PMTCTProfile;
