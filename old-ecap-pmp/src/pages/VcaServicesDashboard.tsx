import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFyFilter } from "@/context/FyFilterContext";
import {
  Search,
  FileText,
  MapPin,
  ChevronRight,
  Home,
  Activity,
  Target,
  Zap,
  ClipboardList,
  Flag,
  AlertCircle,
  RefreshCcw,
  ShieldAlert,
  AlertTriangle,
  Stethoscope,
  HeartPulse,
  BookOpen,
  Shield,
  Landmark,
  GraduationCap,
  Users,
} from "lucide-react";
import { format, isAfter, parseISO, parse, getMonth, getYear } from "date-fns";
import { cn, toTitleCase } from "@/lib/utils";
import { isCategoryProvided } from "@/lib/data-validation";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DuplicateDetectionCard from "@/components/dashboard/DuplicateDetectionCard";
import PageIntro from "@/components/dashboard/PageIntro";
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
import {
  getVcaServicesByDistrict,
  getChildrenByDistrict,
} from "@/lib/api";
import { useNavigate, Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// Full list of 14 filters from legacy TreeTable.tsx


// Mapping for filters where the data key differs from the filter key
const NOT_APPLICABLE = ["not applicable", "n/a", "na", "none", "no", "false", "0", "[]", "{}"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const YEARS = ["2024", "2025", "2026"];


const parseHealthServices = (services: any): string[] => {
  if (!services) return [];
  if (Array.isArray(services)) return services.map(s => String(s));
  try {
    const parsed = typeof services === "string" && (services.startsWith("[") || services.startsWith("{")) ? JSON.parse(services) : services;
    if (Array.isArray(parsed)) return parsed.map(s => String(s));
  } catch (e) {
  }
  return String(services).split(",").map(s => s.trim().replace(/[\[\]"]/g, "")).filter(s => s && !NOT_APPLICABLE.includes(s.toLowerCase()));
};

const parseServiceRecordDate = (record: Record<string, unknown>): Date | null => {
  const raw =
    record.service_date ||
    record.visit_date ||
    record.date ||
    record.created_at ||
    record.service_month ||
    record.referral_month;

  if (!raw) return null;

  const rawStr = String(raw).trim();
  let dateObj: Date;

  if (/^\d{4}-\d{2}-\d{2}/.test(rawStr) || rawStr.includes("T")) {
    dateObj = parseISO(rawStr);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(rawStr)) {
    dateObj = parse(rawStr, "dd-MM-yyyy", new Date());
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawStr)) {
    dateObj = parse(rawStr, "dd/MM/yyyy", new Date());
  } else {
    dateObj = new Date(rawStr);
  }

  return isNaN(dateObj.getTime()) ? null : dateObj;
};

const getJuneReportingYear = (referenceDate: Date): number => {
  return referenceDate.getMonth() >= 5 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
};

const SERVICE_CATEGORIES = [
  "health_services",
  "hiv_services",
  "schooled_services",
  "safe_services",
  "stable_services",
  "other_hiv_services",
  "other_health_services",
  "other_schooled_services",
  "other_safe_services",
  "other_stable_services",
] as const;

const filterKeyToDataKey: Record<string, string> = {
  caahh: 'child_adolescent_in_aged_headed_household',
  caichh: 'child_adolescent_in_chronically_ill_headed_household',
  caich: 'child_adolescent_in_child_headed_household',
  calwd: 'child_adolescent_living_with_disability',
  caifhh: 'child_adolescent_in_female_headed_household',
  muc: 'under_5_malnourished',
  pbfw: 'pbfw'
};

const isNotApplicable = (val: any) => {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  return s === "" || ["not applicable", "n/a", "na", "null", "none", "no", "0", "false", "[]", "{}", "null"].includes(s);
};

const RiskKpiCard = ({ label, count, percent, thresholds, icon: Icon, description, isAbsoluteOnly = false, to }: any) => {

  const isPercentValid = typeof percent === "number" && !isNaN(percent);
  const isCountValid = count !== null && count !== undefined;
  const value = isCountValid ? count.toLocaleString() : "0";
  const percentageText = isPercentValid ? ` (${percent.toFixed(1)}%)` : "";

  const getStyle = () => {
    if (!isPercentValid || !thresholds) return { bg: "bg-slate-50", text: "text-slate-600" };
    if (thresholds.inverse) {
      if (percent <= thresholds.red) return { bg: "bg-rose-50", text: "text-rose-600" };
      if (percent <= thresholds.yellow) return { bg: "bg-amber-50", text: "text-amber-600" };
      return { bg: "bg-emerald-50", text: "text-emerald-600" };
    }
    if (percent >= thresholds.red) return { bg: "bg-rose-50", text: "text-rose-600" };
    if (percent >= thresholds.yellow) return { bg: "bg-amber-50", text: "text-amber-600" };
    return { bg: "bg-emerald-50", text: "text-emerald-600" };
  };

  const style = getStyle();

  const content = (
    <div
      className={cn(
        "p-4 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md active:scale-95 border-slate-100 h-full flex flex-col justify-between",
        to && "cursor-pointer"
      )}
    >
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className={cn("p-2 rounded-lg", style.bg, style.text)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold tracking-wider text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900">{value}</span>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-1">
        {to ? "Click to view" : description}{!isAbsoluteOnly && percentageText}
      </p>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block group h-full">
        {content}
      </Link>
    );
  }

  return content;
};


const VcaServicesDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDistrictUser = user?.description === "District User";
  const isProvincialUser = user?.description === "Provincial User";
  const userProvince = user?.title;

  // Initial state logic for district security
  const initialDistrict = (isDistrictUser && user?.location)
    ? user.location
    : "All";

  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialDistrict);
  const [searchQuery, setSearchQuery] = useState("");
  const [dqFilter, setDqFilter] = useState<string | null>(null);
  const [selectedJuneYear, setSelectedJuneYear] = useState<string>(() => String(getJuneReportingYear(new Date())));


  // SECURITY: Enforce district lock for District Users
  useEffect(() => {
    if (isDistrictUser && user?.location && selectedDistrict !== user.location) {
      setSelectedDistrict(user.location);
    }
  }, [user, selectedDistrict, isDistrictUser]);

  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // Discover districts
  const vcaListQuery = useQuery({
    queryKey: ["vca-districts-discovery", fyKey],
    queryFn: () => getChildrenByDistrict("", fyArg),
    staleTime: 1000 * 60 * 30,
  });

  const discoveredDistrictsMap = useMemo(() => {
    const groups = new Map<string, string[]>();
    if (vcaListQuery.data) {
      (vcaListQuery.data as any[]).forEach((v: any) => {
        if (isProvincialUser && userProvince && v.province !== userProvince) return;
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
  }, [vcaListQuery.data, isProvincialUser, userProvince]);

  const districts = useMemo(() => {
    return Array.from(discoveredDistrictsMap.keys()).sort();
  }, [discoveredDistrictsMap]);

  const vcasQuery = useQuery({
    queryKey: ["vca-vcas-all", "All", fyKey],
    queryFn: () => getChildrenByDistrict("", fyArg),
    staleTime: 1000 * 60 * 30,
  });

  // 1. PERFORMANCE: Enhanced query configuration with aggressive caching
  const servicesQuery = useQuery({
    queryKey: ["vca-services-all", "All", fyKey],
    queryFn: () => getVcaServicesByDistrict(""),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: false,
  });

  const [cachedNationwideStats, setCachedNationwideStats] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("ecap_cache_nationwide_vca");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing nationwide cache", e);
      return null;
    }
  });

  const allServices = useMemo(() => {
    return (servicesQuery.data ?? []) as any[];
  }, [servicesQuery.data]);

  // DEBUG: Log first 3 records to inspect API fields
  if (allServices.length > 0) {
    console.log("VcaServicesDashboard API fields:", Object.keys(allServices[0]));
    console.log("VcaServicesDashboard sample records:", allServices.slice(0, 3));
  }

  const availableJuneYears = useMemo(() => {
    const years = new Set<number>();
    allServices.forEach((service) => {
      const d = parseServiceRecordDate(service);
      if (!d) return;
      years.add(getJuneReportingYear(d));
    });
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    if (sortedYears.length === 0) {
      sortedYears.push(getJuneReportingYear(new Date()));
    }
    return sortedYears;
  }, [allServices]);

  useEffect(() => {
    const selected = Number(selectedJuneYear);
    if (availableJuneYears.includes(selected)) return;

    const currentJuneYear = getJuneReportingYear(new Date());
    const fallbackYear = availableJuneYears.includes(currentJuneYear)
      ? currentJuneYear
      : availableJuneYears[0];
    setSelectedJuneYear(String(fallbackYear));
  }, [availableJuneYears, selectedJuneYear]);

  const juneWindowServices = useMemo(() => {
    const selectedYear = Number(selectedJuneYear);
    const reportingYear = Number.isFinite(selectedYear) ? selectedYear : getJuneReportingYear(new Date());
    const juneStart = new Date(reportingYear, 5, 1);
    const nextJuneStart = new Date(reportingYear + 1, 5, 1);

    return allServices.filter((service) => {
      const d = parseServiceRecordDate(service);
      return !!d && d >= juneStart && d < nextJuneStart;
    });
  }, [allServices, selectedJuneYear]);

  const filteredServices = useMemo(() => {
    const vcas = (vcasQuery.data ?? []) as any[];
    const selectedVariants = selectedDistrict === "All" ? [] : (discoveredDistrictsMap.get(selectedDistrict) || [selectedDistrict]);

    const vcaMap = new Map();
    vcas.forEach((v: any) => {
      const id = String(v.uid || v.unique_id || v.vca_id || v.child_id || v.id).trim();
      vcaMap.set(id, v);
    });

    const base = juneWindowServices.filter((service: any) => {
      if (isProvincialUser && userProvince && service.province !== userProvince) return false;
      const vId = String(service.vca_id || service.vcaid || service.child_id || "").trim();
      const sDistrict = String(service.district || "");

      // Filter by district (handling variants)
      if (selectedDistrict !== "All" && !selectedVariants.includes(sDistrict)) return false;
      if (!vcaMap.has(vId)) return false;


      // Filter by search query
      const serviceName = String(service.service || service.service_name || service.form_name || "").toLowerCase();
      const query = searchQuery.toLowerCase();
      const vcaData = vcaMap.get(vId);
      const cw = String(vcaData?.caseworker_name || vcaData?.cwac_member_name || vcaData?.caseworker || "").toLowerCase();

      return vId.toLowerCase().includes(query) ||
        serviceName.includes(query) ||
        cw.includes(query) ||
        sDistrict.toLowerCase().includes(query);
    });

    // Sort by latest service date (newest first)
    const getTimestamp = (record: any) => {
      const raw =
        record.service_date ||
        record.visit_date ||
        record.date ||
        record.created_at ||
        record.service_month ||
        record.referral_month;

      if (!raw) return 0;

      const rawStr = String(raw).trim();
      let dateObj: Date | null = null;

      // ISO-like formats (e.g. 2025-02-19 or with time)
      if (/^\d{4}-\d{2}-\d{2}/.test(rawStr) || rawStr.includes("T")) {
        dateObj = parseISO(rawStr);
      }
      // Day-first format (e.g. 19-02-2024)
      else if (/^\d{2}-\d{2}-\d{4}$/.test(rawStr)) {
        dateObj = parse(rawStr, "dd-MM-yyyy", new Date());
      }
      // Common alternative with slashes
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawStr)) {
        dateObj = parse(rawStr, "dd/MM/yyyy", new Date());
      } else {
        // Fallback – let JS try to parse
        dateObj = new Date(rawStr);
      }

      const time = dateObj.getTime();
      return isNaN(time) ? 0 : time;
    };

    return [...base].sort((a, b) => getTimestamp(b) - getTimestamp(a));
  }, [juneWindowServices, selectedDistrict, searchQuery, discoveredDistrictsMap, vcasQuery.data, isProvincialUser, userProvince]);

  const pickValue = (record: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
      const value = record[key];
      if (value !== null && value !== undefined && value !== "") return String(value);
    }
    return "N/A";
  };

  const dashboardStats = useMemo(() => {
    const selectedVariants = selectedDistrict === "All" ? [] : (discoveredDistrictsMap.get(selectedDistrict) || [selectedDistrict]);
    const vcas = ((vcasQuery.data ?? []) as any[]).filter(v => {
      const vDist = String(v.district || "");
      return selectedDistrict === "All" || selectedVariants.includes(vDist);
    });

    const services = juneWindowServices.filter(s => {
      const sDist = String(s.district || "");
      if (selectedDistrict !== "All" && !selectedVariants.includes(sDist)) return false;
      return true;
    });

    if (!vcas.length && !services.length) return null;

    const serviceMap = new Map<string, any[]>();
    services.forEach(s => {
      const vId = String(s.vca_id || s.vcaid || s.child_id || s.uid || s.id || "").trim();
      if (!serviceMap.has(vId)) serviceMap.set(vId, []);
      serviceMap.get(vId)?.push(s);
    });

    let healthDomainCount = 0;
    let schooledDomainCount = 0;
    let safeDomainCount = 0;
    let stableDomainCount = 0;
    let allFourDomainsCount = 0;

    vcas.forEach((v: any) => {
      const vId = String(v.uid || v.unique_id || v.vca_id || v.child_id || v.id || "").trim();
      const vServices = serviceMap.get(vId) || [];
      let hasHealth = false;
      let hasSchooled = false;
      let hasSafe = false;
      let hasStable = false;

      vServices.forEach(s => {
        if (isCategoryProvided(s, "health_services")) hasHealth = true;
        if (isCategoryProvided(s, "schooled_services")) hasSchooled = true;
        if (isCategoryProvided(s, "safe_services")) hasSafe = true;
        if (isCategoryProvided(s, "stable_services")) hasStable = true;
      });

      if (hasHealth) healthDomainCount++;
      if (hasSchooled) schooledDomainCount++;
      if (hasSafe) safeDomainCount++;
      if (hasStable) stableDomainCount++;
      if (hasHealth && hasSchooled && hasSafe && hasStable) allFourDomainsCount++;
    });

    const healthServiceCounts: Record<string, number> = {};
    const parseServices = (val: any) => {
      if (!val) return [];
      try {
        if (typeof val === "string") return JSON.parse(val);
        return Array.isArray(val) ? val : [];
      } catch {
        return [];
      }
    };

    services.forEach(s => {
      const hSvc = parseServices(s.health_services);
      const hivSvc = parseServices(s.hiv_services);
      const otherSvc = parseServices(s.other_health_services);
      [...hSvc, ...hivSvc, ...otherSvc].forEach(svc => {
        if (!svc || svc === "None") return;
        const name = String(svc).trim();
        healthServiceCounts[name] = (healthServiceCounts[name] || 0) + 1;
      });
    });

    const healthServiceStats = Object.entries(healthServiceCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const totalVcas = vcas.length;
    return {
      totalVcas,
      totalServices: services.length,
      healthDomainCount,
      healthDomainRate: totalVcas > 0 ? (healthDomainCount / totalVcas) * 100 : 0,
      schooledDomainCount,
      schooledDomainRate: totalVcas > 0 ? (schooledDomainCount / totalVcas) * 100 : 0,
      safeDomainCount,
      safeDomainRate: totalVcas > 0 ? (safeDomainCount / totalVcas) * 100 : 0,
      stableDomainCount,
      stableDomainRate: totalVcas > 0 ? (stableDomainCount / totalVcas) * 100 : 0,
      allFourDomainsCount,
      allFourDomainsRate: totalVcas > 0 ? (allFourDomainsCount / totalVcas) * 100 : 0,
      healthServiceStats,
    };
  }, [vcasQuery.data, juneWindowServices, selectedDistrict, discoveredDistrictsMap]);

  const insights = useMemo(() => {
    const base = juneWindowServices;
    const now = new Date();
    const isEmpty = (v: any) => !v || v === "" || v === "not applicable" || v === "N/A" || v === "[]" || v === "none";

    const noServiceDate = base.filter(r => isEmpty(r.service_date));
    const noHealth = base.filter(r => isEmpty(r.health_services) && isEmpty(r.other_health_services));
    const noHiv = base.filter(r => isEmpty(r.hiv_services) && isEmpty(r.other_hiv_services));
    const noSchooled = base.filter(r => isEmpty(r.schooled_services) && isEmpty(r.other_schooled_services));
    const noSafe = base.filter(r => isEmpty(r.safe_services) && isEmpty(r.other_safe_services));
    const noStable = base.filter(r => isEmpty(r.stable_services) && isEmpty(r.other_stable_services));
    const incomplete = base.filter(r =>
      (isEmpty(r.health_services) && isEmpty(r.other_health_services)) ||
      (isEmpty(r.schooled_services) && isEmpty(r.other_schooled_services)) ||
      (isEmpty(r.safe_services) && isEmpty(r.other_safe_services)) ||
      (isEmpty(r.stable_services) && isEmpty(r.other_stable_services))
    );

    const hivPositive = base.filter(r => r.is_hiv_positive === "1" || r.is_hiv_positive === true);
    const hivNoVl = hivPositive.filter(r => isEmpty(r.date_last_vl) || isEmpty(r.vl_last_result));
    const vlSuppressed = hivPositive.filter(r => {
      const val = String(r.vl_last_result || "").toLowerCase();
      return val.includes("suppress") || val.includes("undetect") || val === "ldl" || (Number(r.vl_last_result) > 0 && Number(r.vl_last_result) < 1000);
    });

    const noMmd = base.filter(r => isEmpty(r.level_mmd));
    const futureDated = base.filter(r => { const d = new Date(r.service_date); return !isNaN(d.getTime()) && d > now; });
    const seen = new Set<string>();
    const duplicates: any[] = [];
    base.forEach(r => { const key = `${r.vcaid || r.vca_id}|${r.service_date}|${r.health_services}`; if (seen.has(key)) duplicates.push(r); else seen.add(key); });

    return [
      { key: "no_date", label: "Missing service date", count: noServiceDate.length, records: noServiceDate },
      { key: "no_health", label: "No health services", count: noHealth.length, records: noHealth },
      { key: "no_hiv", label: "No HIV services", count: noHiv.length, records: noHiv },
      { key: "no_schooled", label: "No education services", count: noSchooled.length, records: noSchooled },
      { key: "no_safe", label: "No safety services", count: noSafe.length, records: noSafe },
      { key: "no_stable", label: "No stability services", count: noStable.length, records: noStable },
      { key: "incomplete", label: "Incomplete coverage", count: incomplete.length, records: incomplete },
      { key: "hiv_no_vl", label: "HIV+ missing VL", count: hivNoVl.length, records: hivNoVl },
      { key: "vl_suppressed", label: "VL suppressed", count: vlSuppressed.length, records: vlSuppressed },
      { key: "no_mmd", label: "No MMD level", count: noMmd.length, records: noMmd },
      { key: "future", label: "Future-dated", count: futureDated.length, records: futureDated },
      { key: "duplicates", label: "Duplicate records", count: duplicates.length, records: duplicates },
    ];
  }, [juneWindowServices]);

  const displayedServices = useMemo(() => {
    if (!dqFilter) return filteredServices;
    const insight = insights.find(i => i.key === dqFilter);
    if (!insight) return filteredServices;
    const dqSet = new Set(insight.records);
    return filteredServices.filter(r => dqSet.has(r));
  }, [filteredServices, dqFilter, insights]);

  const displayStats = selectedDistrict === "All" ? (dashboardStats || cachedNationwideStats) : dashboardStats;
  const isRefreshing = servicesQuery.isFetching && (displayStats?.totalVcas > 0);

  const CHART_COLORS = [
    "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd",
    "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"
  ];

  return (
    <DashboardLayout subtitle="Vca services intelligence">
      {/* ── Banner ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg mb-8">
        <div className="relative bg-gradient-to-r from-green-800 via-emerald-600 to-teal-500 px-4 py-12 sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>

              <span className="inline-block text-[10px] font-bold tracking-widest text-emerald-200 bg-white/10 px-3 py-1 rounded-full mb-2 uppercase">Registry overview</span>
              <h1 className="text-3xl font-black text-white lg:text-4xl leading-tight">
                VCA Services
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-white/70 text-sm font-medium">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {(displayStats?.totalVcas || 0).toLocaleString()} VCAs
                </span>
                <span className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  {(displayStats?.totalServices || 0).toLocaleString()} Service events
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {selectedDistrict === "All" ? "All districts" : selectedDistrict}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedJuneYear}
                onValueChange={setSelectedJuneYear}
              >
                <SelectTrigger className="w-[220px] bg-emerald-800/40 border-emerald-400/30 text-white h-12 rounded-2xl font-bold focus:ring-white/20">
                  <SelectValue placeholder="Select June year" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-emerald-100 shadow-2xl">
                  {availableJuneYears.map((year) => (
                    <SelectItem key={year} value={String(year)} className="rounded-xl focus:bg-emerald-50">
                      June {year} - May {year + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isDistrictUser ? (
                <div className="h-12 px-5 rounded-2xl bg-white/10 border border-white/20 text-white/70 flex items-center text-sm font-medium">
                  {selectedDistrict}
                </div>
              ) : (
                <Select
                  value={selectedDistrict}
                  onValueChange={setSelectedDistrict}
                >
                  <SelectTrigger className="w-[180px] bg-emerald-800/40 border-emerald-400/30 text-white h-12 rounded-2xl font-bold focus:ring-white/20">
                    <SelectValue placeholder="Select district" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-emerald-100 shadow-2xl">
                    <SelectItem value="All" className="rounded-xl focus:bg-emerald-50">All districts</SelectItem>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d} className="rounded-xl focus:bg-emerald-50">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={() => servicesQuery.refetch()}
                className="h-12 px-6 rounded-2xl bg-white text-[#00a67e] hover:bg-emerald-50 font-bold transition-all active:scale-95 shadow-lg shadow-black/5"
              >
                <RefreshCcw className={`h-4 w-4 mr-2 ${servicesQuery.isFetching ? "animate-spin" : ""}`} />
                Sync
              </Button>
            </div>
          </div>
        </div>


      </div>



      <div className="space-y-8 pb-20">
        {/* ── Coverage KPIs + Health Services Chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
          {/* Left: Coverage KPI Cards */}
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 grid-cols-2">
              <RiskKpiCard
                label="Health"
                count={displayStats?.healthDomainCount}
                percent={displayStats?.healthDomainRate}
                thresholds={{ yellow: 60, red: 40, inverse: true }}
                icon={HeartPulse}
                description="Click to view VCAs missing health services"
                to={`/registers/vca-risk?type=health_domain&district=${selectedDistrict}`}
              />
              <RiskKpiCard
                label="Schooled"
                count={displayStats?.schooledDomainCount}
                percent={displayStats?.schooledDomainRate}
                thresholds={{ yellow: 60, red: 40, inverse: true }}
                icon={BookOpen}
                description="Click to view VCAs missing school services"
                to={`/registers/vca-risk?type=schooled_domain&district=${selectedDistrict}`}
              />
              <RiskKpiCard
                label="Safe"
                count={displayStats?.safeDomainCount}
                percent={displayStats?.safeDomainRate}
                thresholds={{ yellow: 60, red: 40, inverse: true }}
                icon={Shield}
                description="Click to view VCAs missing safety services"
                to={`/registers/vca-risk?type=safe_domain&district=${selectedDistrict}`}
              />
              <RiskKpiCard
                label="Stable"
                count={displayStats?.stableDomainCount}
                percent={displayStats?.stableDomainRate}
                thresholds={{ yellow: 60, red: 40, inverse: true }}
                icon={Landmark}
                description="Click to view VCAs missing stability services"
                to={`/registers/vca-risk?type=stable_domain&district=${selectedDistrict}`}
              />
            </div>
            <RiskKpiCard
              label="Graduation readiness (all 4 domains)"
              count={displayStats?.allFourDomainsCount}
              percent={displayStats?.allFourDomainsRate}
              thresholds={{ yellow: 15, red: 5, inverse: true }}
              icon={GraduationCap}
              description="VCAs covered across Health, Schooled, Safe & Stable"
              to={`/registers/vca-risk?type=graduation_path&district=${selectedDistrict}`}
            />
          </div>

          {/* Right: Most common health services chart */}
          <GlowCard className="overflow-hidden border-slate-200 shadow-sm h-full">
            <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-emerald-600" />
                  Most common health services
                </CardTitle>
                <Badge variant="outline" className="h-6 px-3 border-emerald-200 bg-emerald-50 text-emerald-700 font-black text-[10px]">
                  {displayStats?.totalServices || 0} service events
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {servicesQuery.isLoading ? (
                <div className="h-[300px] flex items-center justify-center">
                  <LoadingDots />
                </div>
              ) : !displayStats?.healthServiceStats || displayStats.healthServiceStats.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-2xl">
                  <Target className="h-10 w-10 opacity-20" />
                  <p className="text-sm font-bold">No health services found</p>
                </div>
              ) : (
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayStats.healthServiceStats} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={150} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 800 }} />
                      <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {displayStats.healthServiceStats.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </GlowCard>
        </div>

        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-500 mb-3 tracking-wide">Data quality & insights</h3>
          <p className="text-xs text-slate-400 mb-4">Click a card to filter records</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {insights.map((item) => (
              <div
                key={item.key}
                onClick={() => { setDqFilter(dqFilter === item.key ? null : item.key); }}
                className={cn(
                  "cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-md",
                  dqFilter === item.key
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-100 bg-white hover:border-slate-200"
                )}
              >
                <p className="text-2xl font-extrabold text-slate-900">{item.count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
          {dqFilter && (
            <div className="mt-3 flex items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs font-bold">
                Filtered: {insights.find(i => i.key === dqFilter)?.label}
              </Badge>
              <button onClick={() => setDqFilter(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold">
                Clear filter
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Module Navigation & Audit Trail */}
      <div className="grid gap-6">
        <GlowCard className="overflow-hidden border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Vca Services</h3>
                <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">Audited operations in {selectedDistrict}</p>
              </div>
              <div className="relative w-full md:w-[400px] group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <Input
                  placeholder="Search by beneficiary id, caseworker or district..."
                  className="pl-11 bg-white border-slate-200 h-11 text-sm font-bold rounded-xl focus-visible:ring-emerald-500/20 shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                <TableRow>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 pl-8 h-14">Beneficiary id</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 h-14">District</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 h-14">Date of service</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 h-14">Service provided</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 h-14">HIV status</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 h-14">Last VL date</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 h-14">VL result</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 h-14">Level MMD</TableHead>
                  <TableHead className="font-black text-[10px] tracking-[0.2em] text-slate-400 text-right pr-8 h-14">Caseworker</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="flex items-center justify-center py-12">
                        <LoadingDots />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                        <FileText className="h-10 w-10 opacity-20" />
                        <p className="text-xs font-bold tracking-widest opacity-50">No service logs available</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedServices.slice(0, 50).map((service, index) => {
                    const record = service as Record<string, unknown>;
                    const vcaId = String(pickValue(record, ["vca_id", "vcaid", "child_id", "unique_id"])).trim();

                    const vcas = (vcasQuery.data ?? []) as any[];
                    const vcaData = vcas.find(v => String(v.uid || v.unique_id || v.vca_id || v.child_id || v.id).trim() === vcaId);

                    const caseworker = vcaData?.caseworker_name ||
                      vcaData?.cwac_member_name ||
                      vcaData?.caseworker ||
                      (service as any).caseworker_name ||
                      "N/A";

                    const providedServices: string[] = [];
                    const primaryService = String(pickValue(record, ["service", "service_name", "form_name"]));
                    if (primaryService !== "N/A") providedServices.push(primaryService);

                    SERVICE_CATEGORIES.forEach(cat => {
                      if (record[cat]) {
                        const parsed = parseHealthServices(record[cat]);
                        parsed.forEach(s => {
                          if (s && !providedServices.includes(s)) providedServices.push(s);
                        });
                      }
                    });

                    return (
                      <TableRow key={index} className="hover:bg-slate-50/50 transition-colors group text-sm">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200/40 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-100 transition-all">
                              {vcaId}
                            </span>
                            <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-emerald-600" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600 tracking-tighter">
                          {String(record.district || "N/A")}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-500">
                          {String(pickValue(record, ["service_date", "visit_date", "date"]))}
                        </TableCell>
                        <TableCell className="max-w-[250px] lg:max-w-[350px]">
                          <div className="flex flex-wrap gap-1 overflow-hidden">
                            {providedServices.length > 0 ? (
                              providedServices.slice(0, 3).map((s, i) => (
                                <Badge key={i} variant="outline" className="text-[8px] sm:text-[9px] font-bold border-slate-200 bg-white h-5 sm:h-6 px-1.5 sm:px-2.5 rounded-md truncate max-w-[120px] sm:max-w-[160px]" title={s}>
                                  {s}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-300 font-bold italic">No service logged</span>
                            )}
                            {providedServices.length > 3 && (
                              <Badge variant="outline" className="text-[8px] sm:text-[9px] font-bold border-emerald-100 bg-emerald-50 text-emerald-700 h-5 sm:h-6 px-1.5 sm:px-2.5 rounded-md shrink-0">
                                +{providedServices.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600">
                          {service.is_hiv_positive === "1" || service.is_hiv_positive === true
                            ? <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[9px] font-black">Positive</Badge>
                            : service.is_hiv_positive === "0" || service.is_hiv_positive === false
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] font-black">Negative</Badge>
                              : <span className="text-slate-400">N/A</span>}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-500">
                          {service.date_last_vl || "N/A"}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-500">
                          {service.vl_last_result || "N/A"}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-500">
                          {service.level_mmd || "N/A"}
                        </TableCell>
                        <TableCell className="text-right pr-6 py-4">
                          <div className="flex flex-col items-end">
                            <span className="font-black text-slate-900 text-[11px] truncate max-w-[150px]">
                              {caseworker}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold tracking-widest">Case worker</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </GlowCard>
      </div>

      <div className="mt-8 px-1">
        <DuplicateDetectionCard type="vca" />
      </div>

    </DashboardLayout >
  );
};

export default VcaServicesDashboard;
