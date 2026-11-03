import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Activity, MapPin, User, Users, HeartPulse, ExternalLink, Home } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { useQuery } from "@tanstack/react-query";
import { getChildrenByDistrict } from "@/lib/api";
import { anonymizeCaregiverName, cn } from "@/lib/utils";

const pick = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "N/A";
};

const formatDate = (value: string) => {
  if (!value || value === "N/A") return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date).replace(/\//g, "-");
};

const MotherIndexDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mother = ((location.state as { record?: Record<string, unknown> } | null)?.record ?? location.state ?? {}) as Record<string, unknown>;

  const householdId = pick(mother, ["household_id", "hh_id", "id", "unique_id"]);
  const rawName = pick(mother, ["caregiver_name", "full_name", "name", "mother_name"]);
  const name = anonymizeCaregiverName(rawName);
  const district = pick(mother, ["district", "district_name"]) || "Unknown District";
  const facility = pick(mother, ["facility", "facility_name", "health_facility"]) || "Unknown Facility";
  const ward = pick(mother, ["ward"]);
  const province = pick(mother, ["province"]);
  const partner = pick(mother, ["partner", "partner_name"]);
  const homeAddress = pick(mother, ["homeaddress", "home_address", "address"]);
  const landmark = pick(mother, ["landmark"]);
  const hivStatus = pick(mother, ["caregiver_hiv_status", "hiv_status", "user_select_hiv"]);
  const sex = pick(mother, ["caregiver_sex", "sex", "gender"]);
  const dob = pick(mother, ["caregiver_birth_date", "caregiver_birthdate", "dob", "date_of_birth"]);
  const enrolledDate = pick(mother, ["mother_screening_date", "anc_date", "date_enrolled", "registration_date", "created_at"]);
  const lastInteractedRaw = pick(mother, ["last_interacted_with", "last_service_date", "visit_date", "date_updated", "updated_at", "modified"]);
  const phone = pick(mother, ["caregiver_phone", "phone", "phone_number", "contact", "contact_number", "mobile", "mother_phone"]);

  const lastService = (() => {
    if (!lastInteractedRaw || lastInteractedRaw === "N/A") return "N/A";
    const asNum = Number(lastInteractedRaw);
    if (Number.isFinite(asNum) && asNum > 1e12) {
      const d = new Date(asNum);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB").replace(/\//g, "-");
    }
    return String(lastInteractedRaw).split("T")[0];
  })();

  const hhKey = String(householdId || "").trim().toLowerCase();
  const motherName = String(rawName || "").trim().toLowerCase();
  const motherPhone = String(phone || "").trim();

  const { data: cas = [], isLoading: isLoadingCas } = useQuery({
    queryKey: ["mother-cas", district, hhKey, motherName, motherPhone],
    queryFn: async () => {
      if (!hhKey && !motherName && !motherPhone) return [];

      const matchesHousehold = (v: any) => {
        const vHh = String(v.household_id || v.hh_id || v.household || v.householdId || v.hhid || v.household_unique_id || v.household_uid || v.hhId || v.HH_ID || v.HHID || v.caregiverId || v.caregiver_id || "").trim().toLowerCase();
        if (!vHh || !hhKey) return false;
        const targetNum = hhKey.replace(/^\D+/g, "");
        const vcaNum = vHh.replace(/^\D+/g, "");
        return vHh === hhKey || vHh.includes(hhKey) || hhKey.includes(vHh) || (targetNum && vcaNum && targetNum === vcaNum);
      };

      const matchesCaregiver = (v: any) => {
        const vName = String(v.caregiver_name || v.caregiver || v.full_name || "").trim().toLowerCase();
        const vPhone = String(v.caregiver_phone || v.phone || v.contact_number || "").trim();
        return (motherName && vName && vName === motherName) || (motherPhone && vPhone && vPhone === motherPhone && vPhone !== "Not Provided");
      };

      if (district && district !== "Unknown District") {
        const districtChildren = await getChildrenByDistrict(district);
        const byId = districtChildren.filter(matchesHousehold);
        if (byId.length > 0) return byId;
        if (motherName || motherPhone) {
          const byCg = districtChildren.filter(matchesCaregiver);
          if (byCg.length > 0) return byCg;
        }
      }

      return [];
    },
    enabled: !!hhKey || !!motherName || !!motherPhone,
  });

  return (
    <DashboardLayout subtitle="Mother Details">
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(244,114,182,0.15),transparent_45%)]" />
          <div className="relative z-10 flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-5 md:flex-row md:items-center min-w-0">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 text-pink-700 ring-1 ring-white/60 shadow-md text-xl font-bold">
                {name && name !== "N/A" ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "MI"}
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Mother profile</span>
                  <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                    Active
                  </Badge>
                  <Badge variant="outline" className="gap-1 border-slate-200 bg-white/70 text-[10px] font-mono text-slate-500">#{householdId || "N/A"}</Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-pink-700 bg-clip-text text-transparent">Mother Index Name — Confidential</span>
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-emerald-600" />{district} · {facility}</div>
                  <div className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-600" />Last updated: {lastService}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {householdId && householdId !== "N/A" && (
                <button
                  onClick={() => navigate("/profile/household-details", { state: { id: householdId, household_id: householdId, district, ...(mother || {}) } })}
                  className="group inline-flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50/80 px-3 py-1.5 text-xs font-semibold text-pink-700 backdrop-blur-md transition-all hover:border-pink-300 hover:bg-pink-100"
                >
                  View Household Profile
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
              <button
                onClick={() => navigate(-1)}
                className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back to register
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-pink-600" />
                <CardTitle className="text-lg font-semibold text-slate-900">Mother Index Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Household ID</p>
                  <p className="mt-1 font-mono font-semibold text-slate-900">{householdId || "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Screening Date</p>
                  <div className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {formatDate(enrolledDate)}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Date of Birth</p>
                  <p className="mt-1 font-semibold text-slate-900">{dob !== "N/A" ? dob : "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gender</p>
                  <p className="mt-1 font-semibold text-slate-900 capitalize">{sex || "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Facility</p>
                  <p className="mt-1 font-semibold text-slate-900">{facility !== "Unknown Facility" ? facility : "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">HIV Status</p>
                  <p className={cn("mt-1 font-semibold capitalize", hivStatus.toLowerCase().includes("positive") ? "text-rose-700" : hivStatus.toLowerCase().includes("negative") ? "text-emerald-700" : "text-slate-700")}>{hivStatus || "Unknown"}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Implementing Partner</p>
                  <p className="mt-1 font-semibold text-slate-900">{partner || "N/A"}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-white sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Home Address</p>
                  <p className="mt-1 font-semibold text-slate-900">{homeAddress || "N/A"}{landmark ? ` · ${landmark}` : ""}</p>
                </div>
                {province && (
                  <div className="p-4 rounded-xl border border-slate-100 bg-white sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Province</p>
                    <p className="mt-1 font-semibold text-slate-900">{province}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-pink-600" />
                  <CardTitle className="text-lg font-semibold text-slate-900">CAs in this Household</CardTitle>
                </div>
                <Badge variant="secondary" className="bg-pink-50 text-pink-700 border-pink-100">
                  {isLoadingCas ? "…" : `${cas.length} ${cas.length === 1 ? "child" : "children"}`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCas ? (
                <div className="py-8 flex justify-center">
                  <LoadingDots className="text-pink-600" />
                </div>
              ) : cas.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center gap-2">
                  <Users className="h-7 w-7 text-slate-200" />
                  <p className="text-xs font-medium text-slate-400">No CAs linked to this household.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cas.slice(0, 8).map((child: any, idx: number) => {
                    const cid = child.uid || child.vca_id || child.unique_id || child.id || "N/A";
                    const isIndex = String(child.is_index || "").toLowerCase() === "1" || String(child.is_index || "").toLowerCase() === "true";
                    const hivPos = String(child.is_hiv_positive || child.hiv_status || "").toLowerCase().includes("positive") || String(child.is_hiv_positive || "").toLowerCase() === "yes";
                    return (
                      <div key={cid + "-" + idx} className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-100 bg-white hover:bg-pink-50/40 hover:border-pink-200 transition-all group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                            <User size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">CA ID</p>
                            <p className="font-mono text-xs font-semibold text-slate-900 truncate">{cid}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isIndex && <Badge className="border-none bg-amber-50 text-amber-700 px-2 uppercase text-[9px] font-black tracking-widest">Primary CA</Badge>}
                          <Badge className={cn("border-none px-2 uppercase text-[9px] font-black tracking-widest", hivPos ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600")}>{hivPos ? "Positive" : "Negative"}</Badge>
                          <button type="button" disabled={cid === "N/A"} onClick={(e) => { e.stopPropagation(); if (cid === "N/A") return; navigate("/profile/vca-details", { state: { id: String(cid), district: child.district || district } }); }} className="inline-flex items-center gap-1 rounded-md border border-pink-200 bg-pink-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-pink-700 transition-colors hover:bg-pink-100 hover:border-pink-300 disabled:opacity-40 disabled:cursor-not-allowed">
                            View
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {cas.length > 8 && <p className="text-[10px] text-slate-400 text-center pt-2">+ {cas.length - 8} more</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MotherIndexDetails;
