import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
  TestTube2,
  HeartPulse,
  Briefcase,
  Phone,
  Activity,
  Link2,
  ShieldCheck,
  FileText,
  RefreshCcw,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHTSRegisterByDistrict } from "@/lib/api";
import LoadingDots from "@/components/aceternity/LoadingDots";

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
  highlight,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  highlight?: "positive" | "negative" | "neutral";
}) => {
  const isPositive =
    highlight === "positive" ||
    value.toLowerCase().includes("positive") ||
    value.toLowerCase().includes("reactive");
  const isNegative =
    highlight === "negative" ||
    value.toLowerCase().includes("negative") ||
    value.toLowerCase().includes("non-reactive");

  return (
    <div className="space-y-1 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
      <p className="text-[10px] font-bold tracking-wider text-slate-400">{label}</p>
      <div className="flex items-center gap-2">
        {icon && <span className="text-slate-400">{icon}</span>}
        {(isPositive || isNegative) && value !== "N/A" ? (
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded-md ${isPositive
              ? "bg-rose-100 text-rose-700"
              : "bg-emerald-100 text-emerald-700"
              }`}
          >
            {value}
          </span>
        ) : (
          <p className="text-sm font-semibold text-slate-800">{value}</p>
        )}
      </div>
    </div>
  );
};

const HTSProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const idFromUrl = searchParams.get("id");

  // Fallback: Fetch all HTS records if state is missing
  const htsQuery = useQuery({
    queryKey: ["hts-register", "All"],
    queryFn: () => getHTSRegisterByDistrict("*"),
    staleTime: 1000 * 60 * 10,
    enabled: !location.state?.record && !!idFromUrl,
  });

  // Record passed via navigation state from HTSRegister or found via fallback
  const record: Record<string, unknown> | null = useMemo(() => {
    // 1. Try state
    const stateRecord = location.state?.record;
    if (stateRecord) {
      sessionStorage.setItem("ecap_last_hts_record", JSON.stringify(stateRecord));
      return stateRecord;
    }

    // 2. Try Fallback Query
    if (idFromUrl && htsQuery.data) {
      const found = (htsQuery.data as any[]).find(
        r => String(r.ecap_id || r.client_number) === idFromUrl
      );
      if (found) {
        sessionStorage.setItem("ecap_last_hts_record", JSON.stringify(found));
        return found;
      }
    }

    // 3. Last resort: Session Storage
    try {
      const stored = sessionStorage.getItem("ecap_last_hts_record");
      const r = stored ? JSON.parse(stored) : null;
      // Basic validation that it's the right ID profile
      if (r && idFromUrl && String(r.ecap_id || r.client_number) === idFromUrl) {
        return r;
      }
      return null;
    } catch {
      return null;
    }
  }, [location.state?.record, htsQuery.data, idFromUrl]);

  if (htsQuery.isLoading && !record) {
    return (
      <DashboardLayout subtitle="Loading profile">
        <div className="flex h-[50vh] items-center justify-center">
          <LoadingDots />
        </div>
      </DashboardLayout>
    );
  }

  if (!record) {
    return (
      <DashboardLayout subtitle="Hts profile">
        <EmptyState
          icon={<TestTube2 className="h-7 w-7" />}
          title="Record not found"
          description={idFromUrl ? `Profile with ID ${idFromUrl} could not be loaded.` : "The HTS record you're looking for could not be loaded."}
          action={{ label: "Back to HTS Register", onClick: () => navigate("/registers/hts") }}
          className="h-[50vh]"
        />
      </DashboardLayout>
    );
  }

  const hivResult = p(record, ["hiv_result"]);
  const artNumber = p(record, ["case_art_number"]);
  const ecapId = p(record, ["ecap_id", "client_number"]);
  const district = p(record, ["district"]);
  const caseworker = p(record, ["caseworker_name"]);

  const isPositive =
    hivResult.toLowerCase().includes("positive") ||
    hivResult.toLowerCase().includes("reactive");

  return (
    <DashboardLayout subtitle={`Hts profile — ${ecapId}`}>
      <div className="space-y-6 pb-20">

        {/* ── Banner ── */}
        <div className="relative overflow-hidden rounded-xl">
          {/* Gradient Header */}
          <div className="relative bg-gradient-to-r from-green-700 via-emerald-600 to-teal-600 p-6 lg:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] bg-[length:200px_100%]" />

            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge
                    className={`text-xs border-0 ${isPositive
                      ? "bg-rose-500/30 text-rose-100"
                      : "bg-white/20 text-white"
                      }`}
                  >
                    {isPositive ? "HIV Positive" : hivResult !== "N/A" ? "HIV Negative" : "Result Unknown"}
                  </Badge>
                  <Badge className="text-xs border-0 bg-white/20 text-white tracking-wider">
                    Hts record
                  </Badge>
                  {artNumber !== "N/A" && (
                    <Badge className="text-xs border-0 bg-white/20 text-white font-bold">
                      ART: {artNumber}
                    </Badge>
                  )}
                </div>

                {/* Name + ID */}
                <h1 className="text-3xl font-bold text-white lg:text-4xl">Caregiver Name – Confidential</h1>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-white/70 text-sm">
                  {ecapId !== "N/A" && (
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      ID: {ecapId}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {district}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    {caseworker}
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

          {/* White metadata strip */}
          <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl px-6 py-4 lg:px-8">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">


              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-500" />
                Date Created: {p(record, ["date_created"])}
              </span>
              <span className="flex items-center gap-1.5">
                <HeartPulse className="h-4 w-4 text-emerald-500" />
                Facility: {p(record, ["health_facility"])}
              </span>
            </div>
          </div>
        </div>

        {/* ── Quick-info Cards ── */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <TestTube2 className="h-4 w-4 text-slate-600" />,
              label: "Date tested (contact)",
              value: p(record, ["date_tested_contact"]),
            },
            {
              icon: <Calendar className="h-4 w-4 text-slate-600" />,
              label: "Date tested (link)",
              value: p(record, ["date_tested_link"]),
            },
            {
              icon: <Link2 className="h-4 w-4 text-slate-600" />,
              label: "Link event id",
              value: p(record, ["link_event_id"]),
            },
          ].map((item, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">{item.icon}</div>
                  <div>
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-sm font-medium text-slate-900">{item.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="clinical" className="w-full">
          <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <TabsList className="h-auto flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/50 p-2">
              <TabsTrigger
                value="clinical"
                className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Clinical info
              </TabsTrigger>
              <TabsTrigger
                value="individual"
                className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Individual
              </TabsTrigger>
              <TabsTrigger
                value="contact"
                className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Contact & location
              </TabsTrigger>
              <TabsTrigger
                value="system"
                className="rounded-full px-5 py-2 text-xs font-black tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                System & case
              </TabsTrigger>
            </TabsList>
            <div className="hidden text-xs font-bold text-slate-400 md:block">
              ID: <span className="text-slate-900">{ecapId}</span>
            </div>
          </div>

          {/* ── TAB 1: Clinical Info ── */}
          <TabsContent value="clinical">
            <div className="space-y-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <HeartPulse className="h-5 w-5 text-slate-600" /> Hiv testing results
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Hiv result" value={p(record, ["hiv_result"])} icon={<Activity className="h-3.5 w-3.5" />} />
                  <InfoItem label="Hiv status" value={p(record, ["hiv_status"])} />
                  <InfoItem label="Recent hiv test" value={p(record, ["hiv_recent_test"])} />
                  <InfoItem label="Date tested (contact)" value={p(record, ["date_tested_contact"])} icon={<Calendar className="h-3.5 w-3.5" />} />
                  <InfoItem label="Date tested (link)" value={p(record, ["date_tested_link"])} icon={<Calendar className="h-3.5 w-3.5" />} />
                  <InfoItem label="Art date" value={p(record, ["art_date"])} icon={<Calendar className="h-3.5 w-3.5" />} />
                  <InfoItem label="Art date initiated" value={p(record, ["art_date_initiated"])} icon={<Calendar className="h-3.5 w-3.5" />} />
                  <InfoItem label="Art number" value={p(record, ["case_art_number"])} />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <TestTube2 className="h-5 w-5 text-slate-600" /> Testing details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Testing Modality" value={p(record, ["testing_modality"])} />
                  <InfoItem label="Entry Point" value={p(record, ["entry_point"])} />
                  <InfoItem label="Test Done at Facility" value={p(record, ["test_done_hf"])} />
                  <InfoItem label="Health Facility" value={p(record, ["health_facility"])} icon={<HeartPulse className="h-3.5 w-3.5" />} />
                  <InfoItem label="Link Event ID" value={p(record, ["link_event_id"])} icon={<Link2 className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── TAB 2: Individual ── */}
          <TabsContent value="individual">
            <div className="space-y-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <User className="h-5 w-5 text-slate-600" /> Individual being tested
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Individual Tested" value="Caregiver Name – Confidential" icon={<User className="h-3.5 w-3.5" />} />
                  <InfoItem label="Age (Index/SNS)" value={p(record, ["age_index_sns"])} />
                  <InfoItem label="Individual Age" value={p(record, ["individual_age"])} />
                  <InfoItem label="Gender (case)" value={p(record, ["gender_case"])} />
                  <InfoItem label="Gender (linked)" value={p(record, ["gender_link"])} />
                  <InfoItem label="Relationship" value={p(record, ["relationship"])} />
                  <InfoItem label="Other relationship" value={p(record, ["other_relationship"])} />
                  <InfoItem label="Sub population" value={p(record, ["sub_population"])} />
                  <InfoItem label="Case sub-population" value={p(record, ["case_suppopulation"])} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── TAB 3: Contact & Location ── */}
          <TabsContent value="contact">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Phone className="h-5 w-5 text-slate-600" /> Contact details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InfoItem label="Phone" value="Phone – Confidential" icon={<Phone className="h-3.5 w-3.5" />} />
                  <InfoItem label="Contact Phone" value="Phone – Confidential" />
                  <InfoItem label="Address" value="Address – Confidential" icon={<MapPin className="h-3.5 w-3.5" />} />
                  <InfoItem label="Landmark" value={p(record, ["landmark"])} />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <MapPin className="h-5 w-5 text-slate-600" /> Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <InfoItem label="Province" value={p(record, ["province"])} />
                  <InfoItem label="District" value={p(record, ["district"])} />
                  <InfoItem label="Health Facility" value={p(record, ["health_facility"])} icon={<HeartPulse className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── TAB 4: System & Case ── */}
          <TabsContent value="system">
            <div className="space-y-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <Briefcase className="h-5 w-5 text-slate-600" /> Case & system information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoItem label="Case uid" value={ecapId} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoItem label="Client number" value={p(record, ["client_number"])} />
                  <InfoItem label="id" value={p(record, ["ecap_id"])} />
                  <InfoItem label="Caseworker" value={p(record, ["caseworker_name"])} icon={<User className="h-3.5 w-3.5" />} />
                  <InfoItem label="Date created" value={p(record, ["date_created"])} icon={<Calendar className="h-3.5 w-3.5" />} />
                </CardContent>
              </Card>

              {p(record, ["comment"]) !== "N/A" && (
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                      <ShieldCheck className="h-5 w-5 text-slate-600" /> Notes & comments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <p className="text-[10px] font-bold tracking-wider text-slate-400 mb-2">Comment</p>
                      <p className="text-sm text-slate-800 leading-relaxed">{p(record, ["comment"])}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default HTSProfile;
