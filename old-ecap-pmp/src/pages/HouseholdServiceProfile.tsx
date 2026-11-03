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
  ClipboardList,
  HeartPulse,
  Activity,
  Home,
  Briefcase
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

const HouseholdServiceProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const record: Record<string, unknown> = useMemo(() => {
    const r = location.state?.record;
    if (r) {
      sessionStorage.setItem("ecap_last_household_service_event", JSON.stringify(r));
      return r;
    }
    try {
      const stored = sessionStorage.getItem("ecap_last_household_service_event");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [location.state?.record]);

  if (!record) {
    return (
      <DashboardLayout subtitle="Household Service Profile">
        <EmptyState
          icon={<ClipboardList className="h-7 w-7" />}
          title="Service Record Not Found"
          description="The household service record could not be loaded."
          action={{ label: "Back to Household Services", onClick: () => navigate("/household-services") }}
          className="h-[50vh]"
        />
      </DashboardLayout>
    );
  }

  const householdId = p(record, ["household_id", "hh_id", "householdId", "unique_id"]);
  const serviceName = p(record, ["service", "service_name", "form_name"]);
  const status = p(record, ["status", "state", "outcome"]);
  const district = p(record, ["district"]);
  const dateStr = p(record, ["service_date", "visit_date", "date", "created_at"]);

  return (
    <DashboardLayout subtitle={`Household Service — ${householdId}`}>
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
                    Household Service
                  </Badge>
                  <Badge className="text-xs border-0 bg-white/20 text-white">
                    {status}
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold text-white lg:text-4xl leading-tight">
                  {serviceName}
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
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-emerald-500" />
                Caseworker: {p(record, ["caseworker_name"])}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 h-auto flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/50 p-2">
            <TabsTrigger value="overview" className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Overview
            </TabsTrigger>
            <TabsTrigger value="details" className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Full record
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm font-bold tracking-wider text-slate-500">Service branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="Service Item" value={serviceName} icon={<ClipboardList className="h-3.5 w-3.5" />} />
                  <InfoItem label="Status" value={status} />
                  <InfoItem label="Service Date" value={dateStr} icon={<Calendar className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm font-bold tracking-wider text-slate-500">Entity details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="Household ID" value={householdId} icon={<Home className="h-3.5 w-3.5" />} />
                  <InfoItem label="Caseworker" value={p(record, ["caseworker_name"])} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoItem label="Caseworker ID" value={p(record, ["caseworker_id", "staff_id"])} />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm font-bold tracking-wider text-slate-500">Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoItem label="District" value={district} icon={<MapPin className="h-3.5 w-3.5" />} />
                  <InfoItem label="Province" value={p(record, ["province"])} />
                  <InfoItem label="Facility" value={p(record, ["health_facility", "facility"])} icon={<HeartPulse className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="details">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Activity className="h-5 w-5 text-slate-600" /> System audit fields
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

export default HouseholdServiceProfile;
