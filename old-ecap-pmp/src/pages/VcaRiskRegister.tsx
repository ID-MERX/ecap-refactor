import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFyFilter } from "@/context/FyFilterContext";
import {
  ArrowLeft,
  Download,
  Search,
  HeartPulse,
  BookOpen,
  Shield,
  Landmark,
  GraduationCap,
  ChevronRight,
  Home,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getChildrenByDistrict,
  getVcaServicesByDistrict,
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
  health_domain: { label: "Missing Health Services", icon: HeartPulse, color: "text-rose-600", bg: "bg-rose-50" },
  schooled_domain: { label: "Missing Schooled Services", icon: BookOpen, color: "text-emerald-600", bg: "bg-emerald-50" },
  safe_domain: { label: "Missing Safe Services", icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50" },
  stable_domain: { label: "Missing Stable Services", icon: Landmark, color: "text-amber-600", bg: "bg-amber-50" },
  graduation_path: { label: "Graduation Ready (All 4)", icon: GraduationCap, color: "text-emerald-600", bg: "bg-emerald-50" },
};

const VcaRiskRegister = () => {
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

  // Discover districts
  const vcaListQuery = useQuery({
    queryKey: ["vca-districts-discovery-reg"],
    queryFn: () => getChildrenByDistrict(""),
    staleTime: 1000 * 60 * 30,
  });

  const discoveredDistrictsMap = useMemo(() => {
    const groups = new Map<string, string[]>();
    if (vcaListQuery.data) {
      (vcaListQuery.data as any[]).forEach((v: any) => {
        const raw = v.district;
        if (raw) {
          const normalized = toTitleCase(raw.trim());
          if (!groups.has(normalized)) groups.set(normalized, []);
          const variants = groups.get(normalized)!;
          if (!variants.includes(raw)) variants.push(raw);
        }
      });
    }
    return groups;
  }, [vcaListQuery.data]);

  const districts = useMemo(() => {
    return Array.from(discoveredDistrictsMap.keys()).sort();
  }, [discoveredDistrictsMap]);

  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // Data queries
  const vcasQuery = useQuery({
    queryKey: ["vca-vcas-risk-reg", "All", fyKey],
    queryFn: () => getChildrenByDistrict("", fyArg),
    staleTime: 1000 * 60 * 10,
  });

  const servicesQuery = useQuery({
    queryKey: ["vca-services-risk-reg", "All", fyKey],
    queryFn: () => getVcaServicesByDistrict(""),
    staleTime: 1000 * 60 * 10,
  });

  const isLoading = vcasQuery.isLoading || servicesQuery.isLoading;

  const filteredData = useMemo(() => {
    if (!servicesQuery.data || !vcasQuery.data) return [];

    const vcas = vcasQuery.data as any[];
    const services = servicesQuery.data as any[];
    const selectedVariants = selectedDistrict === "All" ? [] : (discoveredDistrictsMap.get(selectedDistrict) || [selectedDistrict]);

    const getVcaId = (v: any) => String(v.uid || v.unique_id || v.vca_id || v.child_id || v.id || "").trim();



    // Build per-VCA service map
    const serviceMap = new Map<string, any[]>();
    services.forEach(s => {
      const vId = String(s.vca_id || s.vcaid || s.child_id || s.uid || s.id || "").trim();
      if (!serviceMap.has(vId)) serviceMap.set(vId, []);
      serviceMap.get(vId)?.push(s);
    });

    // Determine which VCAs to include based on domain gap type
    let baseList: any[] = vcas.filter(v => {
      const vDist = String(v.district || "");
      if (selectedDistrict !== "All" && !selectedVariants.includes(vDist)) return false;
      return true;
    }).map((v: any) => {
      const vId = getVcaId(v);
      const vServices = serviceMap.get(vId) || [];
      let hasHealth = false, hasSchooled = false, hasSafe = false, hasStable = false;
      vServices.forEach(s => {
        if (isCategoryProvided(s, "health_services")) hasHealth = true;
        if (isCategoryProvided(s, "schooled_services")) hasSchooled = true;
        if (isCategoryProvided(s, "safe_services")) hasSafe = true;
        if (isCategoryProvided(s, "stable_services")) hasStable = true;
      });
      const allFour = hasHealth && hasSchooled && hasSafe && hasStable;

      let include = false;
      if (type === "health_domain" && !hasHealth) include = true;
      else if (type === "schooled_domain" && !hasSchooled) include = true;
      else if (type === "safe_domain" && !hasSafe) include = true;
      else if (type === "stable_domain" && !hasStable) include = true;
      else if (type === "graduation_path" && allFour) include = true;

      if (!include) return null;

      return {
        ...v,
        displayId: vId || "N/A",
        has_health: hasHealth,
        has_schooled: hasSchooled,
        has_safe: hasSafe,
        has_stable: hasStable,
        domain_count: [hasHealth, hasSchooled, hasSafe, hasStable].filter(Boolean).length,
      };
    }).filter(Boolean);

    // Apply search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      baseList = baseList.filter(item =>
        item.displayId.toLowerCase().includes(q) ||
        String(item.district || "").toLowerCase().includes(q) ||
        String(item.name || item.first_name || "").toLowerCase().includes(q)
      );
    }

    return baseList;
  }, [type, vcasQuery.data, servicesQuery.data, searchQuery]);

  const handleExport = () => {
    if (!filteredData.length) return;

    const headers = ["VCA ID", "VCA Name", "District", "Age", "Health", "Schooled", "Safe", "Stable", "Domains Covered"];
    const rows = filteredData.map(item => [
      item.displayId || "N/A",
      item.name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || "N/A",
      item.district || "N/A",
      item.age || "N/A",
      item.has_health ? "Yes" : "No",
      item.has_schooled ? "Yes" : "No",
      item.has_safe ? "Yes" : "No",
      item.has_stable ? "Yes" : "No",
      `${item.domain_count || 0}/4`,
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `vca_domain_gap_${type}_${selectedDistrict}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const RiskIcon = RISK_TYPES[type].icon;

  return (
    <DashboardLayout subtitle="Vca high-risk registry">
      <div className="flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/vca-services")}
              className="rounded-full h-10 w-10 border-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <RiskIcon className={cn("h-6 w-6", RISK_TYPES[type].color)} />
                {toSentenceCase(RISK_TYPES[type].label)} registry
              </h1>
              <p className="text-xs font-bold text-slate-400 tracking-widest mt-1">
                {filteredData.length} children found{selectedDistrict !== "All" ? ` in ${selectedDistrict}` : ""}
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
              <SelectTrigger className="w-[200px] h-10 font-bold border-slate-200">
                <SelectValue placeholder="Risk category" />
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
              The dashboard shows overall coverage, but this register lists VCAs specifically <strong>MISSING</strong> {type.replace("_domain", "").charAt(0).toUpperCase() + type.replace("_domain", "").slice(1)} services so you can prioritize them.
            </AlertDescription>
          </Alert>
        )}

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by Child ID, Name or District..."
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
                    <TableHead className="text-[11px] font-black text-slate-500">Child ID</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Vca name</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">District</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Age</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Domain status</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 100).map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-900 text-xs text-nowrap">
                        {item.displayId}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">
                        {item.name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">
                        <Badge variant="outline" className="bg-slate-50 text-[10px] font-bold">{item.district}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-500">
                        {item.age || "N/A"}
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
                          onClick={() => {
                            const id = item.displayId;
                            if (id !== "N/A") navigate(`/profile/vca-details?id=${id}`);
                          }}
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
                <p className="text-slate-400 max-w-xs mt-1">Adjust your filters or select a different domain type.</p>
              </div>
            )}
          </div>
        </GlowCard>
      </div>
    </DashboardLayout>
  );
};

export default VcaRiskRegister;
