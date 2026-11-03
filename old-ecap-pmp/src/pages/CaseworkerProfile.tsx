import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  MapPin,
  Briefcase,
  Activity,
  Calendar,
  Home,
  Baby,
  HeartPulse,
  BookOpen,
  Shield,
  Landmark,
  TrendingUp,
} from "lucide-react";
import {
  getCaregiverServicesByDistrict,
  getVcaServicesByDistrict,
  getHouseholdServicesByDistrict,
  getHouseholdsByDistrict,
} from "@/lib/api";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LoadingDots from "@/components/aceternity/LoadingDots";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { isCategoryProvided } from "@/lib/data-validation";

const safeDate = (s: any): string => {
  const d = s?.service_date || s?.visit_date || s?.date || "";
  return d ? String(d) : "N/A";
};



const DomainBadge = ({ label, has, icon: Icon, color }: { label: string; has: boolean; icon: any; color: string }) => (
  <div className={cn("flex items-center gap-2 p-3 rounded-xl border text-xs font-bold", has ? `${color} border-current/20` : "text-slate-300 border-slate-100 bg-slate-50/50")}>
    <Icon className="h-3.5 w-3.5 shrink-0" />
    <span>{label}</span>
    {has ? (
      <span className="ml-auto text-[9px] font-black tracking-wider uppercase bg-current/10 px-1.5 py-0.5 rounded">✓ Yes</span>
    ) : (
      <span className="ml-auto text-[9px] font-black tracking-wider uppercase bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">✗ No</span>
    )}
  </div>
);

const CaseworkerProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Read caseworker name from navigation state or sessionStorage fallback
  const cwName: string = useMemo(() => {
    const stateName = location.state?.name;
    if (stateName) {
      sessionStorage.setItem("ecap_last_cw_name", stateName);
      return stateName;
    }
    return sessionStorage.getItem("ecap_last_cw_name") || "";
  }, [location.state?.name]);

  // ── Data
  const hhListQuery = useQuery({
    queryKey: ["cw-profile-hh-list"],
    queryFn: () => getHouseholdsByDistrict(""),
    staleTime: 1000 * 60 * 30,
  });

  const cgServicesQuery = useQuery({
    queryKey: ["cw-profile-cg-services"],
    queryFn: () => getCaregiverServicesByDistrict(""),
    staleTime: 1000 * 60 * 10,
  });

  const vcaServicesQuery = useQuery({
    queryKey: ["cw-profile-vca-services"],
    queryFn: () => getVcaServicesByDistrict(""),
    staleTime: 1000 * 60 * 10,
  });

  const hhServicesQuery = useQuery({
    queryKey: ["cw-profile-hh-services"],
    queryFn: () => getHouseholdServicesByDistrict(""),
    staleTime: 1000 * 60 * 10,
  });

  const isLoading =
    cgServicesQuery.isLoading ||
    vcaServicesQuery.isLoading ||
    hhServicesQuery.isLoading ||
    hhListQuery.isLoading;

  // ── HH → caseworker map
  const householdCwMap = useMemo(() => {
    const map: Record<string, string> = {};
    (hhListQuery.data as any[] ?? []).forEach((h: any) => {
      const id = String(h.household_id || h.hh_id || "");
      const cw = h.caseworker_name || h.cwac_member_name || h.caseworker || "";
      if (id && cw) map[id] = cw;
    });
    return map;
  }, [hhListQuery.data]);

  // ── Resolve caseworker name from a service record
  const resolveCw = (s: any) => {
    const hhId = String(s.household_id || s.hh_id || "");
    return (
      s.caseworker_name ||
      s.caseworkerName ||
      s.cwac_member_name ||
      s.caseworker ||
      householdCwMap[hhId] ||
      ""
    );
  };

  // ── All services belonging to this caseworker
  const cwServices = useMemo(() => {
    if (!cwName) return [];
    const cg = (cgServicesQuery.data ?? []) as any[];
    const vca = (vcaServicesQuery.data ?? []) as any[];
    const hh = (hhServicesQuery.data ?? []) as any[];
    return [...cg, ...vca, ...hh].filter(
      s => resolveCw(s).toLowerCase() === cwName.toLowerCase()
    );
  }, [cwName, cgServicesQuery.data, vcaServicesQuery.data, hhServicesQuery.data, householdCwMap]);

  // ── Stats
  const stats = useMemo(() => {
    const districtCounts: Record<string, number> = {};
    const hhIds = new Set<string>();
    let health = 0, schooled = 0, safe = 0, stable = 0;

    cwServices.forEach(s => {
      const d = String(s.district || "Unknown");
      districtCounts[d] = (districtCounts[d] || 0) + 1;

      const hhId = String(s.household_id || s.hh_id || "");
      if (hhId) hhIds.add(hhId);

      if (isCategoryProvided(s, "health_services")) health++;
      if (isCategoryProvided(s, "schooled_services")) schooled++;
      if (isCategoryProvided(s, "safe_services")) safe++;
      if (isCategoryProvided(s, "stable_services")) stable++;
    });

    const primaryDistrict = Object.entries(districtCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      totalServices: cwServices.length,
      uniqueHouseholds: hhIds.size,
      primaryDistrict,
      districtCounts,
      health,
      schooled,
      safe,
      stable,
    };
  }, [cwServices]);

  // ── Recent services sorted desc
  const recentServices = useMemo(() => {
    return [...cwServices]
      .sort((a, b) => {
        const dA = Date.parse(safeDate(a)) || 0;
        const dB = Date.parse(safeDate(b)) || 0;
        return dB - dA;
      })
      .slice(0, 50);
  }, [cwServices]);

  // ── Household summary
  const householdSummary = useMemo(() => {
    const map: Record<string, { id: string; district: string; count: number; lastDate: string; hasHealth: boolean; hasSchooled: boolean; hasSafe: boolean; hasStable: boolean }> = {};
    cwServices.forEach(s => {
      const hhId = String(s.household_id || s.hh_id || "");
      if (!hhId) return;
      if (!map[hhId]) map[hhId] = { id: hhId, district: s.district || "N/A", count: 0, lastDate: "", hasHealth: false, hasSchooled: false, hasSafe: false, hasStable: false };
      map[hhId].count++;
      const d = safeDate(s);
      if (!map[hhId].lastDate || d > map[hhId].lastDate) map[hhId].lastDate = d;
      if (isCategoryProvided(s, "health_services")) map[hhId].hasHealth = true;
      if (isCategoryProvided(s, "schooled_services")) map[hhId].hasSchooled = true;
      if (isCategoryProvided(s, "safe_services")) map[hhId].hasSafe = true;
      if (isCategoryProvided(s, "stable_services")) map[hhId].hasStable = true;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [cwServices]);

  if (isLoading) {
    return (
      <DashboardLayout subtitle="Caseworker Profile">
        <div className="flex h-[50vh] items-center justify-center">
          <LoadingDots />
        </div>
      </DashboardLayout>
    );
  }

  if (!cwName) {
    return (
      <DashboardLayout subtitle="Caseworker not found">
        <EmptyState
          icon={<User className="h-7 w-7" />}
          title="No caseworker selected"
          description="Navigate to a caseworker from the Caseworker Journeys page."
          action={{ label: "Back", onClick: () => navigate(-1) }}
          className="h-[50vh]"
        />
      </DashboardLayout>
    );
  }

  const initials = cwName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DashboardLayout subtitle={`Caseworker: ${cwName}`}>
      <div className="space-y-6 pb-20">

        {/* ── Banner ── */}
        <div className="relative overflow-hidden rounded-xl">
          <div className="relative bg-gradient-to-r from-green-800 via-emerald-600 to-teal-500 p-6 lg:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-white font-black text-xl shrink-0">
                  {initials}
                </div>
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge className="text-xs border-0 bg-white/20 text-white">
                      Caseworker
                    </Badge>
                    <Badge className="text-xs border-0 bg-white/20 text-white">
                      {stats.primaryDistrict}
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-black text-white lg:text-4xl leading-tight">
                    {cwName}
                  </h1>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-white/70 text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-4 w-4" />
                      {stats.totalServices.toLocaleString()} services recorded
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Home className="h-4 w-4" />
                      {stats.uniqueHouseholds.toLocaleString()} households served
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      Primary district: {stats.primaryDistrict}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                size="sm"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
              </Button>
            </div>
          </div>

          {/* White metadata strip */}
          <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl px-6 py-4 lg:px-8">
            <div className="flex flex-wrap gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                Role: Community Caseworker
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                {stats.totalServices.toLocaleString()} total interventions
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Last service: {recentServices[0] ? safeDate(recentServices[0]) : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Services", value: stats.totalServices, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Households Served", value: stats.uniqueHouseholds, icon: Home, color: "text-teal-600", bg: "bg-teal-50" },
            { label: "Health Services", value: stats.health, icon: HeartPulse, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "Safe Services", value: stats.safe, icon: Shield, color: "text-orange-600", bg: "bg-orange-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="border-slate-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("p-2 rounded-lg", bg, color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">{label}</span>
                </div>
                <p className="text-2xl font-black text-slate-900">{value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Domain Coverage ── */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Activity className="h-5 w-5 text-slate-500" />
              Service Domain Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DomainBadge label="Health" has={stats.health > 0} icon={HeartPulse} color="text-rose-600" />
            <DomainBadge label="Schooled" has={stats.schooled > 0} icon={BookOpen} color="text-emerald-600" />
            <DomainBadge label="Safe" has={stats.safe > 0} icon={Shield} color="text-orange-600" />
            <DomainBadge label="Stable" has={stats.stable > 0} icon={Landmark} color="text-amber-600" />
          </CardContent>
        </Card>

        {/* ── Households Served ── */}
        <GlowCard className="overflow-hidden border-slate-200">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Households Served</h3>
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">
                {householdSummary.length} unique households
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-black border-emerald-100 bg-emerald-50 text-emerald-700">
              {householdSummary.length} total
            </Badge>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 border-b sticky top-0">
                <TableRow>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 pl-8 h-12 uppercase">Household ID</TableHead>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 h-12 uppercase">District</TableHead>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 h-12 uppercase">Domains</TableHead>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 h-12 uppercase">Last Service</TableHead>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 text-right pr-8 h-12 uppercase">Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {householdSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      No household data found
                    </TableCell>
                  </TableRow>
                ) : householdSummary.map((hh, i) => (
                  <TableRow
                    key={i}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    onClick={() => navigate("/profile/household-details", { state: { id: hh.id } })}
                  >
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-emerald-50 transition-colors">
                          <Home className="h-3 w-3 text-slate-500 group-hover:text-emerald-600" />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-700">{hh.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 font-medium">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {hh.district}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {hh.hasHealth && <span title="Health" className="h-2 w-2 rounded-full bg-rose-400" />}
                        {hh.hasSchooled && <span title="Schooled" className="h-2 w-2 rounded-full bg-emerald-400" />}
                        {hh.hasSafe && <span title="Safe" className="h-2 w-2 rounded-full bg-orange-400" />}
                        {hh.hasStable && <span title="Stable" className="h-2 w-2 rounded-full bg-amber-400" />}
                        <span className="ml-1 text-[10px] text-slate-400 font-bold">
                          {[hh.hasHealth, hh.hasSchooled, hh.hasSafe, hh.hasStable].filter(Boolean).length}/4
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-500">{hh.lastDate}</TableCell>
                    <TableCell className="text-right pr-8">
                      <Badge variant="outline" className="text-[10px] font-black border-slate-200">
                        {hh.count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlowCard>

        {/* ── Recent Service History ── */}
        <GlowCard className="overflow-hidden border-slate-200">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Service History</h3>
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">
                Latest 50 service records
              </p>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 border-b sticky top-0">
                <TableRow>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 pl-8 h-12 uppercase">Household ID</TableHead>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 h-12 uppercase">Service Date</TableHead>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 h-12 uppercase">Services Provided</TableHead>
                  <TableHead className="font-bold text-[10px] tracking-widest text-slate-400 text-right pr-8 h-12 uppercase">District</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                      No service records found
                    </TableCell>
                  </TableRow>
                ) : recentServices.map((s, i) => {
                  const hhId = String(s.household_id || s.hh_id || "N/A");
                  const domains = [
                    isCategoryProvided(s, "health_services") && "Health",
                    isCategoryProvided(s, "schooled_services") && "Schooled",
                    isCategoryProvided(s, "safe_services") && "Safe",
                    isCategoryProvided(s, "stable_services") && "Stable",
                  ].filter(Boolean) as string[];

                  return (
                    <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="pl-8 py-4 font-mono text-xs font-bold text-slate-700">{hhId}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-500">{safeDate(s)}</TableCell>
                      <TableCell>
                        {domains.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {domains.map(d => (
                              <Badge key={d} variant="outline" className="text-[9px] font-black border-slate-200 bg-slate-50 text-slate-600">
                                {d}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Badge variant="outline" className="text-[10px] font-bold border-slate-200 bg-white">
                          {s.district || "N/A"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </GlowCard>

      </div>
    </DashboardLayout>
  );
};

export default CaseworkerProfile;
