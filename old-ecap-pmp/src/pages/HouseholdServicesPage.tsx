import { useState, useMemo } from "react";
import {
  Search,
  FileText,
  TrendingUp,
  Activity,
  MapPin,
  ChevronRight,
  ClipboardList,
  Home,
  Briefcase,
  Zap,
  RefreshCcw
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { useQuery } from "@tanstack/react-query";
import { getHouseholdServicesByDistrict, getHouseholdsByDistrict, DEFAULT_DISTRICT } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useFyFilter } from "@/context/FyFilterContext";

const HouseholdServicesPage = () => {
  const navigate = useNavigate();
  const [selectedDistrict, setSelectedDistrict] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // Discover districts
  const hhListQuery = useQuery({
    queryKey: ["hh-districts-discovery-services", fyKey],
    queryFn: () => getHouseholdsByDistrict("", fyArg),
    staleTime: 1000 * 60 * 30,
  });

  const districts = useMemo(() => {
    const distSet = new Set<string>();
    if (hhListQuery.data) {
      hhListQuery.data.forEach((h: any) => {
        if (h.district) distSet.add(h.district);
      });
    }
    return Array.from(distSet).sort();
  }, [hhListQuery.data]);

  // 1. PERFORMANCE: Enhanced query configuration with aggressive caching
  const servicesQuery = useQuery({
    queryKey: ["household-services-all", selectedDistrict, fyKey],
    queryFn: () => getHouseholdServicesByDistrict(selectedDistrict === "All" ? "*" : selectedDistrict),
    enabled: Boolean(selectedDistrict),
    staleTime: selectedDistrict === "All" ? 1000 * 60 * 30 : 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });

  // 2. PERSISTENCE: Restore previous nationwide data for instant-load
  const [cachedNationwideStats, setCachedNationwideStats] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("ecap_cache_nationwide_household_list");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing nationwide cache", e);
      return null;
    }
  });

  const allServices = useMemo(() => {
    return (servicesQuery.data ?? []) as any[];
  }, [servicesQuery.data]);

  const filteredServices = useMemo(() => {
    return allServices.filter((service: any) => {
      const hhId = String(service.household_id || service.hh_id || "").toLowerCase();
      const serviceName = String(service.service || service.form_name || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      return hhId.includes(query) || serviceName.includes(query);
    });
  }, [allServices, searchQuery]);

  const pickValue = (record: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined && value !== "") return String(value);
    }
    return "N/A";
  };

  const dashboardStats = useMemo(() => {
    if (!allServices.length) return null;
    const uniqueHhs = new Set(allServices.map(s => s.household_id)).size;
    const result = {
      total: allServices.length,
      uniqueHhs: uniqueHhs || 0,
      engagement: (allServices.length / (uniqueHhs || 1)).toFixed(1)
    };

    // PERSISTENCE: Save result for future instant boots (only if nationwide)
    if (selectedDistrict === "All" && result.total > 0) {
      localStorage.setItem("ecap_cache_nationwide_household_list", JSON.stringify(result));
    }

    return result;
  }, [allServices, selectedDistrict]);

  // UI STATE: Determine if we should show cached data while refreshing
  const displayStats = selectedDistrict === "All" ? (dashboardStats || cachedNationwideStats) : dashboardStats;
  const isRefreshing = servicesQuery.isFetching && (displayStats?.total > 0 || displayStats?.totalServices > 0);

  return (
    <DashboardLayout subtitle="Household services intelligence">
      {/* ── Premium Green Banner ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg mb-8">
        <div className="relative bg-gradient-to-r from-green-700 via-emerald-600 to-teal-600 p-6 lg:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] bg-[length:200px_100%]" />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge className="text-xs border-0 bg-white/20 text-white font-bold">
                  Operational dashboard
                </Badge>
                <Badge className="text-xs border-0 bg-white/20 text-white">
                  Household support
                </Badge>
              </div>
              <h1 className="text-3xl font-bold text-white lg:text-4xl leading-tight">
                Household services insights
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-white/70 text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  Tracking {allServices.length} household interactions
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  District: {selectedDistrict}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white font-bold h-10 backdrop-blur-sm">
                  <SelectValue placeholder="Select District" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Districts</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => servicesQuery.refetch()}
                className="bg-white text-emerald-700 hover:bg-white/90 shadow-xl h-10 font-bold px-6"
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${servicesQuery.isFetching ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </div>
          </div>
        </div>

        {/* Banner Metadata Strip */}
        <div className="bg-white border border-slate-200 border-t-0 rounded-b-2xl px-6 py-4 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[11px] font-black tracking-widest text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              Total services: <span className="text-slate-900 ml-1">{displayStats?.total || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              Unique households: <span className="text-slate-900 ml-1">{displayStats?.uniqueHhs || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              Engagement depth: <span className="text-slate-900 ml-1">{displayStats?.engagement || 0} services/HH</span>
            </div>
            {isRefreshing && (
              <div className="ml-auto flex items-center gap-2 text-emerald-600 animate-pulse">
                <RefreshCcw className="h-3 w-3 animate-spin" />
                <span>Syncing nationwide records...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {[
          { label: "Total operations", value: displayStats?.total || 0, icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Target entities", value: displayStats?.uniqueHhs || 0, icon: Home, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Interaction density", value: displayStats?.engagement || 0, icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((kpi, idx) => (
          <GlowCard key={idx} className="p-0 border-0 overflow-hidden group">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] text-slate-400 mb-1">{kpi.label}</p>
                <p className="text-3xl font-black text-slate-900">
                  {servicesQuery.isLoading && !displayStats ? <LoadingDots className="h-2 w-2" /> : kpi.value}
                </p>
              </div>
              <div className={`${kpi.bg} ${kpi.color} p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <kpi.icon className="h-6 w-6" />
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      <GlowCard className="overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Household operations audit</h3>
              <p className="text-xs text-slate-500 font-medium">Service interactions logged in {selectedDistrict}</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search Household ID or Service..."
                className="pl-9 bg-white border-slate-200 h-9 text-sm font-medium focus-visible:ring-emerald-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-black text-[10px] tracking-widest text-slate-400 pl-6 h-12">Household focus</TableHead>
                <TableHead className="font-black text-[10px] tracking-widest text-slate-400 h-12">Service item</TableHead>
                <TableHead className="font-black text-[10px] tracking-widest text-slate-400 h-12">Caseworker</TableHead>
                <TableHead className="font-black text-[10px] tracking-widest text-slate-400 h-12">Service date</TableHead>
                <TableHead className="font-black text-[10px] tracking-widest text-slate-400 text-right pr-6 h-12">Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicesQuery.isLoading || servicesQuery.isFetching ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex items-center justify-center py-12">
                      <LoadingDots />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <div className="p-4 rounded-full bg-slate-50 border border-slate-100">
                        <FileText className="h-8 w-8 opacity-20" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-600">No operational data found</p>
                        <p className="text-xs text-slate-400">No services have been logged for this district.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.slice(0, 15).map((service: any, index: number) => (
                  <TableRow key={`${index}-${service.household_id}`} className="hover:bg-slate-50/30 transition-colors group">
                    <TableCell
                      className="font-bold text-slate-900 cursor-pointer hover:text-emerald-600 pl-6 py-4"
                      onClick={() => {
                        navigate(`/profile/household-service-details`, { state: { record: service } });
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-white px-2 py-1 rounded-md border border-slate-200/60 shadow-sm text-slate-600 tracking-tighter group-hover:bg-emerald-50 transition-colors">
                          {service.household_id || service.hh_id || "N/A"}
                        </span>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-black text-slate-800">
                        {pickValue(service, ["service", "service_name", "form_name"])}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] font-bold text-slate-500">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Briefcase className="h-3 w-3" />
                        {pickValue(service, ["caseworker_name"])}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] font-bold text-slate-500">
                      {pickValue(service, ["service_date", "visit_date", "date"])}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge variant="outline" className="text-[10px] h-6 px-2 font-black border-slate-200 bg-slate-50 text-slate-600 shadow-sm tracking-tighter">
                        {pickValue(service, ["status", "state", "outcome"])}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlowCard>
    </DashboardLayout>
  );
};

export default HouseholdServicesPage;
