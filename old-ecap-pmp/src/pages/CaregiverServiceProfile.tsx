import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  Heart,
  ShieldCheck,
  Activity,
  Home,
  Briefcase,
  HeartPulse,
  Stethoscope,
  School,
  Lock,
  Wallet,
  Zap
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useMemo } from "react";
import { toSentenceCase } from "@/lib/utils";

const p = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const val = record[key];
    if (val !== null && val !== undefined && val !== "") return String(val);
  }
  return "N/A";
};

const cleanArrayString = (str: string | null | undefined) => {
  if (!str) return "None";
  try {
    return String(str).replace(/[\[\]"]/g, "").replace(/,/g, ", ");
  } catch (e) {
    return String(str);
  }
};

const InfoItem = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) => (
  <div className="space-y-1 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
    <p className="text-[10px] font-bold tracking-wider text-slate-400">{label}</p>
    <div className="flex items-center gap-2">
      {icon && <span className="text-slate-400">{icon}</span>}
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  </div>
);

const CaregiverServiceProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const record: Record<string, unknown> = useMemo(() => {
    const r = location.state?.record;
    if (r) {
      sessionStorage.setItem("ecap_last_caregiver_service_event", JSON.stringify(r));
      return r;
    }
    try {
      const stored = sessionStorage.getItem("ecap_last_caregiver_service_event");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [location.state?.record]);

  if (!record) {
    return (
      <DashboardLayout subtitle="Caregiver Service Profile">
        <EmptyState
          icon={<Heart className="h-7 w-7" />}
          title="Service Record Not Found"
          description="The caregiver service record could not be loaded."
          action={{ label: "Back to Caregiver Services", onClick: () => navigate("/caregiver-services") }}
          className="h-[50vh]"
        />
      </DashboardLayout>
    );
  }

  const householdId = p(record, ["household_id", "hh_id", "householdId"]);
  const isPositive = String(record.is_hiv_positive || "").toLowerCase().includes("yes") || String(record.is_hiv_positive) === "1";
  const dateStr = p(record, ["service_date", "visit_date", "date"]);
  const district = p(record, ["district"]);

  return (
    <DashboardLayout subtitle={`Caregiver Service — ${householdId}`}>
      <div className="space-y-6 pb-20">
        {/* ── Banner ── */}
        <div className="relative overflow-hidden rounded-xl">
          <div className="relative bg-gradient-to-r from-green-700 via-emerald-600 to-teal-600 p-6 lg:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] bg-[length:200px_100%]" />

            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className="text-xs border-0 bg-white/20 text-white font-bold">
                    Caregiver Service
                  </Badge>
                  <Badge className={isPositive ? "bg-rose-500/30 text-rose-100 border-0" : "bg-white/20 text-white border-0"}>
                    {isPositive ? "HIV Positive" : "HIV Negative"}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold text-white lg:text-4xl leading-tight text-white shadow-sm">
                  Service Interaction Log
                </h1>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-white/70 text-sm">
                  <span className="flex items-center gap-1.5">
                    <Home className="h-3.5 w-3.5" />
                    Household ID: {householdId}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {district}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm shrink-0"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl px-6 py-4 lg:px-8">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-500" />
                Service Date: {dateStr}
              </span>
              <span className="flex items-center gap-1.5 font-bold text-slate-900">
                <Zap className="h-4 w-4 text-amber-500" />
                Latest VL: {p(record, ["vl_last_result"])}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="domains" className="w-full">
          <TabsList className="mb-6 h-auto flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/50 p-2">
            <TabsTrigger value="domains" className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Service domains
            </TabsTrigger>
            <TabsTrigger value="clinical" className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Clinical data
            </TabsTrigger>
            <TabsTrigger value="raw" className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              System audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="domains">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Stethoscope className="h-5 w-5 text-emerald-600" /> Health & hiv
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="Health Services" value={cleanArrayString(String(record.health_services || ""))} />
                  <InfoItem label="Other Health" value={cleanArrayString(String(record.other_health_services || ""))} />
                  <InfoItem label="HIV Services" value={cleanArrayString(String(record.hiv_services || ""))} />
                  <InfoItem label="Other HIV" value={cleanArrayString(String(record.other_hiv_services || ""))} />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <School className="h-5 w-5 text-emerald-600" /> Schooled
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="Schooled Services" value={cleanArrayString(String(record.schooled_services || ""))} />
                  <InfoItem label="Other Schooled" value={cleanArrayString(String(record.other_schooled_services || ""))} />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Lock className="h-5 w-5 text-amber-600" /> Safe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="Safe Services" value={cleanArrayString(String(record.safe_services || ""))} />
                  <InfoItem label="Other Safe" value={cleanArrayString(String(record.other_safe_services || ""))} />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Wallet className="h-5 w-5 text-emerald-600" /> Stable
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="Stable Services" value={cleanArrayString(String(record.stable_services || ""))} />
                  <InfoItem label="Other Stable" value={cleanArrayString(String(record.other_stable_services || ""))} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clinical">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <HeartPulse className="h-5 w-5 text-rose-600" /> Clinical profile
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <InfoItem label="Is HIV Positive?" value={p(record, ["is_hiv_positive"])} />
                <InfoItem label="Recent Viral Load" value={p(record, ["vl_last_result"])} icon={<Activity className="h-3.5 w-3.5" />} />
                <InfoItem label="Date of Last VL" value={p(record, ["date_last_vl"])} icon={<Calendar className="h-3.5 w-3.5" />} />
                <InfoItem label="TB Screened?" value={p(record, ["is_tb_screened", "tb_screened"])} />
                <InfoItem label="Nutrition Screened?" value={p(record, ["is_nutrition_screened", "nutrition_screened"])} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <ShieldCheck className="h-5 w-5 text-slate-600" /> System audit log
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(record).map(([key, value]) => {
                  if (typeof value === "string" && value !== "N/A" && value !== "" && value !== "null") {
                    return <InfoItem key={key} label={toSentenceCase(key.replace(/_/g, " "))} value={String(value)} />;
                  }
                  return null;
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default CaregiverServiceProfile;
