import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFyFilter } from "@/context/FyFilterContext";
import {
  ArrowLeft,
  Download,
  Search,
  GraduationCap,
  ChevronRight,
  Home,
  HeartPulse,
  BookOpen,
  Shield,
  Landmark,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getHouseholdsByDistrict,
  getHouseholdServicesByDistrict
} from "@/lib/api";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  SelectValue
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { format, subDays, parseISO, isAfter } from "date-fns";
import { cn, toTitleCase, toSentenceCase } from "@/lib/utils";
import { isCategoryProvided } from "@/lib/data-validation";

const RISK_TYPES = {
  health_domain: { label: "Missing Health Services", icon: HeartPulse, color: "text-rose-600", bg: "bg-rose-50", domain: "health_services", domainLabel: "Health" },
  schooled_domain: { label: "Missing Schooled Services", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50", domain: "schooled_services", domainLabel: "Schooled" },
  safe_domain: { label: "Missing Safe Services", icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50", domain: "safe_services", domainLabel: "Safe" },
  stable_domain: { label: "Missing Stable Services", icon: Landmark, color: "text-amber-600", bg: "bg-amber-50", domain: "stable_services", domainLabel: "Stable" },
  graduation_path: { label: "Graduation Ready (All 4)", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50", domain: null, domainLabel: "All" },
};

const HouseholdRiskRegister = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = (searchParams.get("type") || "health_domain") as keyof typeof RISK_TYPES;

  // Initial state logic for district security
  const initialDistrict = (user?.description === "District User" && user?.location)
    ? user.location
    : (searchParams.get("district") || "All");

  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [searchQuery, setSearchQuery] = useState("");

  const handleClearFilters = () => {
    setSearchQuery("");
  };

  // SECURITY: Enforce district lock for District Users
  useEffect(() => {
    if (user?.description === "District User" && user?.location && selectedDistrict !== user.location) {
      setSelectedDistrict(user.location);
    }
  }, [user, selectedDistrict]);

  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // Discover districts — list is FY-cohort-scoped so available districts
  // narrow to those with households actually present in the window.
  const hhListQuery = useQuery({
    queryKey: ["hh-districts-discovery-reg", fyKey],
    queryFn: () => getHouseholdsByDistrict("", fyArg),
    staleTime: 1000 * 60 * 30,
  });

  const discoveredDistrictsMap = useMemo(() => {
    const groups = new Map<string, string[]>();
    if (hhListQuery.data) {
      (hhListQuery.data as any[]).forEach((h: any) => {
        const raw = h.district;
        if (raw) {
          const normalized = toTitleCase(raw.trim());
          if (!groups.has(normalized)) groups.set(normalized, []);
          const variants = groups.get(normalized)!;
          if (!variants.includes(raw)) variants.push(raw);
        }
      });
    }
    return groups;
  }, [hhListQuery.data]);

  const districts = useMemo(() => {
    return Array.from(discoveredDistrictsMap.keys()).sort();
  }, [discoveredDistrictsMap]);

  // Data queries — services aren't FY-aware yet, but the FY key still rebinds.
  const servicesQuery = useQuery({
    queryKey: ["hh-services-risk-reg", "All", fyKey],
    queryFn: () => getHouseholdServicesByDistrict(""),
    staleTime: 1000 * 60 * 10,
  });

  const isLoading = servicesQuery.isLoading || hhListQuery.isLoading;



  const filteredData = useMemo(() => {
    const services = (servicesQuery.data ?? []) as any[];
    const householdsList = (hhListQuery.data ?? []) as any[];
    const now = new Date();
    const NINETY_DAYS_AGO = subDays(now, 90);
    const selectedVariants = selectedDistrict === "All" ? [] : (discoveredDistrictsMap.get(selectedDistrict) || [selectedDistrict]);

    // 1. Group services by household
    const hhServiceMap = new Map<string, any[]>();
    services.forEach(s => {
      const hhId = String(s.household_id || s.hh_id || s.hhid || s.id || "unknown").trim();
      const sDist = String(s.district || "");
      if (selectedDistrict !== "All" && !selectedVariants.includes(sDist)) return;

      if (!hhServiceMap.has(hhId)) hhServiceMap.set(hhId, []);
      hhServiceMap.get(hhId)?.push(s);
    });

    // 2. Filter registered households for the selected district
    const registeredHhs = householdsList.filter(h => {
      const hDist = String(h.district || "");
      return selectedDistrict === "All" || selectedVariants.includes(hDist);
    });

    let resultList: any[] = [];

    // 3. Evaluate each registered household for gaps
    registeredHhs.forEach((h) => {
      const hhId = String(h.household_id || h.hh_id || h.hhid || h.id).trim();
      const hhServices = hhServiceMap.get(hhId) || [];

      let hasHealth = false;
      let hasSchooled = false;
      let hasSafe = false;
      let hasStable = false;
      let isActive = false;

      hhServices.forEach(s => {
        if (isCategoryProvided(s, "health_services")) hasHealth = true;
        if (isCategoryProvided(s, "schooled_services")) hasSchooled = true;
        if (isCategoryProvided(s, "safe_services")) hasSafe = true;
        if (isCategoryProvided(s, "stable_services")) hasStable = true;

        const sDate = s.service_date ? parseISO(String(s.service_date)) : null;
        if (sDate && isAfter(sDate, NINETY_DAYS_AGO)) isActive = true;
      });

      const allFour = hasHealth && hasSchooled && hasSafe && hasStable;

      let include = false;
      if (type === "health_domain" && !hasHealth) include = true;
      else if (type === "schooled_domain" && !hasSchooled) include = true;
      else if (type === "safe_domain" && !hasSafe) include = true;
      else if (type === "stable_domain" && !hasStable) include = true;
      else if (type === "graduation_path" && allFour) include = true;

      if (include) {
        resultList.push({
          household_id: hhId,
          district: h.district || "Unknown",
          last_service_date: h.last_service_date || "N/A",
          domain_count: [hasHealth, hasSchooled, hasSafe, hasStable].filter(Boolean).length,
          has_health: hasHealth,
          has_schooled: hasSchooled,
          has_safe: hasSafe,
          has_stable: hasStable,
          is_active: isActive,
          raw_household: h // Store for sub-population filtering
        });
      }
    });

    // Apply search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return resultList.filter(item =>
        item.household_id.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q)
      );
    }

    return resultList;
  }, [type, servicesQuery.data, searchQuery, hhListQuery.data]);

  const handleExport = () => {
    if (!filteredData.length) return;

    const headers = ["Household ID", "District", "Last Service Date", "Domains Covered", "Health", "Schooled", "Safe", "Stable", "Active (90d)"];
    const rows = filteredData.map(item => [
      item.household_id,
      item.district,
      item.last_service_date,
      `${item.domain_count}/4`,
      item.has_health ? "Yes" : "No",
      item.has_schooled ? "Yes" : "No",
      item.has_safe ? "Yes" : "No",
      item.has_stable ? "Yes" : "No",
      item.is_active ? "Yes" : "No",
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `household_domain_gap_${type}_${selectedDistrict}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const RiskIcon = RISK_TYPES[type].icon;

  return (
    <DashboardLayout subtitle="Household stability registry">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/household-services")}
              className="rounded-full h-10 w-10 border-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <RiskIcon className={cn("h-6 w-6", RISK_TYPES[type].color)} />
                {toSentenceCase(RISK_TYPES[type].label)}
              </h1>
              <p className="text-xs font-bold text-slate-400 tracking-widest mt-1">
                {filteredData.length} households found{selectedDistrict !== "All" ? ` in ${selectedDistrict}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={type}
              onValueChange={(val) => {
                setSearchParams({ type: val, district: selectedDistrict });
              }}
            >
              <SelectTrigger className="w-[220px] h-10 font-bold border-slate-200">
                <SelectValue placeholder="Metric category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RISK_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{toSentenceCase(value.label)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedDistrict}
              onValueChange={(val) => {
                setSelectedDistrict(val);
                setSearchParams({ type, district: val });
              }}
              disabled={user?.description === "District User"}
            >
              <SelectTrigger className="w-[180px] h-10 font-bold border-slate-200">
                <SelectValue placeholder="District" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All districts</SelectItem>
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4"
              onClick={handleExport}
              disabled={filteredData.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export csv
            </Button>
          </div>
        </div>

        {/* Metric Context Alert */}
        {type !== "graduation_path" && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <HeartPulse className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-xs font-black tracking-wider">Gap analysis mode</AlertTitle>
            <AlertDescription className="text-sm font-medium opacity-90">
              The dashboard shows overall coverage, but this register lists households specifically <strong>MISSING</strong> {RISK_TYPES[type].domainLabel} services so you can prioritize them.
            </AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by Household ID or District..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 border-slate-200 bg-white"
          />
        </div>

        {/* Main Table Content */}
        <GlowCard className="border-slate-200 overflow-hidden">
          <div className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingDots />
              </div>
            ) : filteredData.length > 0 ? (
              <Table>
                <TableHeader className="bg-slate-50 border-b">
                  <TableRow>
                    <TableHead className="text-[11px] font-black text-slate-500">Household ID</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">District</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Last service</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Domain count</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Status tags</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 100).map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-900 text-xs">
                        {item.household_id}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">
                        <Badge variant="outline" className="bg-slate-50 text-[10px] font-bold">{item.district}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">
                        {item.last_service_date}
                      </TableCell>
                      <TableCell className="text-xs font-black text-slate-900">
                        {item.domain_count} / 4
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {item.has_health && <Badge className="bg-rose-100 text-rose-700 border-0 text-[9px] font-black">Health</Badge>}
                          {item.has_schooled && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] font-black">Schooled</Badge>}
                          {item.has_safe && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] font-black">Safe</Badge>}
                          {item.has_stable && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] font-black">Stable</Badge>}
                          {item.domain_count === 4 && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] font-black">Grad-ready</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary font-bold text-xs"
                          onClick={() => navigate(`/profile/household-details?id=${item.household_id}`)}
                        >
                          View profile
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center p-20 text-center">
                <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Home className="h-10 w-10 text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No records found</h3>
                <p className="text-slate-400 max-w-xs mt-1">Adjust your filters to see households in different stability phases.</p>
              </div>
            )}
          </div>
        </GlowCard>
      </div>
    </DashboardLayout>
  );
};

export default HouseholdRiskRegister;
