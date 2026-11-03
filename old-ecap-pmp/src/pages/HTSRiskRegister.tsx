import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFyFilter } from "@/context/FyFilterContext";
import {
  ArrowLeft,
  Download,
  Search,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Info,
  Clock,
  Briefcase
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getHTSRegisterByDistrict, getHouseholdsByDistrict } from "@/lib/api";
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
import { format, parseISO, isAfter, subDays } from "date-fns";
import { cn, toTitleCase } from "@/lib/utils";
import { downloadCsv } from "@/lib/exportUtils";

const RISK_TYPES = {
  unlinked: { label: "Positives Not On ART  ", icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50", description: "Positive cases not yet linked to ART" },
  pending: { label: "Pending Outcomes", icon: Clock, color: "text-amber-600", bg: "bg-amber-50", description: "Tests with unknown results" },
  new: { label: "New Positives", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", description: "Positive results found in the last 7 days" },
  all: { label: "All Records", icon: Briefcase, color: "text-emerald-600", bg: "bg-emerald-50", description: "Full HTS Register" }
};

const PROFILE_FIELDS: { label: string; keys: string[] }[] = [
  { label: "Case ID", keys: ["client_number", "ecap_id"] },
  { label: "ART Number", keys: ["case_art_number"] },
  { label: "HIV Status", keys: ["hiv_status", "hiv_result"] },
  { label: "ART Date", keys: ["art_date", "art_date_initiated"] },
  { label: "Testing Modality", keys: ["testing_modality"] },
  { label: "Health Facility", keys: ["health_facility"] },
  { label: "Caseworker", keys: ["caseworker_name"] },
  { label: "District", keys: ["district"] },
  { label: "Date Created", keys: ["date_created"] },
];

const pickVal = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const val = record[key];
    if (val !== null && val !== undefined && val !== "") return String(val);
  }
  return "—";
};

const HTSRiskRegister = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const type = (searchParams.get("type") || "all") as keyof typeof RISK_TYPES;

  // Initial state logic for district security
  const initialDistrict = (user?.description === "District User" && user?.location)
    ? user.location
    : (searchParams.get("district") || "All");

  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [searchQuery, setSearchQuery] = useState("");

  // SECURITY: Enforce district lock for District Users
  useEffect(() => {
    if (user?.description === "District User" && user?.location && selectedDistrict !== user.location) {
      setSelectedDistrict(user.location);
    }
  }, [user, selectedDistrict]);

  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // Discover districts
  const householdsListQuery = useQuery({
    queryKey: ["districts-discovery", selectedDistrict === "All" ? "All" : selectedDistrict, fyKey],
    queryFn: () => getHouseholdsByDistrict(selectedDistrict === "All" ? "" : selectedDistrict, fyArg),
    staleTime: 1000 * 60 * 30,
  });

  const discoveredDistrictsMap = useMemo(() => {
    const groups = new Map<string, string[]>();
    if (householdsListQuery.data) {
      (householdsListQuery.data as any[]).forEach((h: any) => {
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
  }, [householdsListQuery.data]);

  const discoveredDistricts = useMemo(() => {
    return Array.from(discoveredDistrictsMap.keys()).sort();
  }, [discoveredDistrictsMap]);

  const htsQuery = useQuery({
    queryKey: ["hts-register", "All", fyKey],
    queryFn: () => getHTSRegisterByDistrict("*"),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });

  const allRecords = useMemo(() => {
    const rawData = (htsQuery.data ?? []) as any[];
    if (selectedDistrict === "All") return rawData;

    const selectedVariants = discoveredDistrictsMap.get(selectedDistrict) || [selectedDistrict];
    return rawData.filter(r => {
      const rDist = String(r.district || "");
      return selectedVariants.includes(rDist);
    });
  }, [htsQuery.data, selectedDistrict, discoveredDistrictsMap]);


  const filteredData = useMemo(() => {
    let base = allRecords;

    if (type === "unlinked") {
      base = base.filter(r => {
        const res = String(r.hiv_result || r.hiv_status || "").toLowerCase();
        const isPos = res.includes("positive") || res.includes("reactive");
        const hasArt = r.art_date || r.art_date_initiated;
        return isPos && !hasArt;
      });
    } else if (type === "pending") {
      base = base.filter(r => {
        const res = String(r.hiv_result || r.hiv_status || "").toLowerCase();
        return !res || res === "unknown" || res === "—";
      });
    } else if (type === "new") {
      const weekAgo = subDays(new Date(), 7);
      base = base.filter(r => {
        const dateCreated = r.date_created ? parseISO(r.date_created) : null;
        const res = String(r.hiv_result || r.hiv_status || "").toLowerCase();
        const isPos = res.includes("positive") || res.includes("reactive");
        return isPos && dateCreated && isAfter(dateCreated, weekAgo);
      });
    }

    if (!searchQuery) return base;
    const q = searchQuery.toLowerCase();
    const searchableFields = ["client_number", "ecap_id", "case_art_number", "district", "health_facility", "caseworker_name"];
    return base.filter((r: any) =>
      searchableFields.some((key) => r[key] != null && String(r[key]).toLowerCase().includes(q))
    );
  }, [allRecords, searchQuery, type]);

  const handleExport = () => {
    if (!filteredData.length) return;
    const headers = PROFILE_FIELDS.map(f => f.label);
    const rows = filteredData.map(r => PROFILE_FIELDS.map(f => pickVal(r, f.keys)));
    const dateStr = format(new Date(), "yyyy-MM-dd");
    downloadCsv(headers, rows, `hts_register_${type}_${selectedDistrict}_${dateStr}.csv`);
  };

  const getHIVResultBadge = (record: any) => {
    const result = String(record.hiv_result || record.hiv_status || "").toLowerCase();
    if (result.includes("positive") || result.includes("reactive")) {
      return <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">Positive</Badge>;
    }
    if (result.includes("negative") || result.includes("non-reactive")) {
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Negative</Badge>;
    }
    return <Badge variant="outline" className="text-slate-400 text-[10px]">{record.hiv_result || "Unknown"}</Badge>;
  };

  const currentRisk = RISK_TYPES[type];
  const RiskIcon = currentRisk.icon;

  return (
    <DashboardLayout subtitle="Hts testing registry">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/registers/hts")}
              className="rounded-full h-10 w-10 border-slate-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <RiskIcon className={cn("h-6 w-6", currentRisk.color)} />
                {currentRisk.label} Registry
              </h1>
              <p className="text-xs font-bold tracking-wider text-muted-foreground mt-1">
                {filteredData.length} records found{selectedDistrict !== "All" ? ` in ${selectedDistrict}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={type}
              onValueChange={(val) => setSearchParams({ type: val, district: selectedDistrict })}
            >
              <SelectTrigger className="w-[200px] h-10 font-bold border-slate-200">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RISK_TYPES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value.label}</SelectItem>
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
                <SelectItem value="All">All Districts</SelectItem>
                {discoveredDistricts.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-bold h-10 px-4 shadow-sm transition-all"
              onClick={handleExport}
              disabled={filteredData.length === 0}
            >
              <Download className="h-4 w-4 mr-2 text-slate-900" />
              Export CSV
            </Button>

          </div>
        </div>

        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm">
          <Info className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-xs font-black tracking-wider uppercase">HTS Filter Active</AlertTitle>
          <AlertDescription className="text-sm font-medium opacity-90">
            {currentRisk.description}. Use the search bar for granular lookups.
          </AlertDescription>
        </Alert>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by ID, Facility or Worker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 border-slate-200 bg-white"
          />
        </div>

        <GlowCard className="border-slate-200 overflow-hidden">
          <div className="p-0 overflow-x-auto">
            {htsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingDots />
              </div>
            ) : filteredData.length > 0 ? (
              <Table>
                <TableHeader className="bg-slate-50 border-b">
                  <TableRow>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase">Case ID</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase">Status</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase">Facility</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase">Modality</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase">Caseworker</TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 100).map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-900 text-xs truncate max-w-[120px]">
                        {pickVal(item, ["client_number", "ecap_id"])}
                      </TableCell>
                      <TableCell>{getHIVResultBadge(item)}</TableCell>
                      <TableCell className="text-xs font-medium text-slate-600 truncate max-w-[150px]">
                        {item.health_facility || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="bg-slate-50 text-[10px] font-bold">{item.testing_modality || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600">
                        {item.caseworker_name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary font-bold text-xs"
                          onClick={() => {
                            const id = item.ecap_id || item.client_number;
                            if (id) navigate(`/profile/hts-details?id=${id}`, { state: { record: item } });
                          }}
                        >
                          Details
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
                  <Info className="h-10 w-10 text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No records found</h3>
                <p className="text-slate-400 max-w-xs mt-1">Adjust your filters or district selection.</p>
              </div>
            )}
          </div>
        </GlowCard>
      </div>
    </DashboardLayout>
  );
};

export default HTSRiskRegister;
