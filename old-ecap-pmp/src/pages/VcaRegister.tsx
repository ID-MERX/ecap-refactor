import { useState, useMemo, useEffect } from "react";
import { Search, Download, X, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Activity, MapPin, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import LoadingDots from "@/components/aceternity/LoadingDots";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CardContent } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toTitleCase } from "@/lib/utils";
import { getChildrenByDistrict } from "@/lib/api";
import { useFyFilter } from "@/context/FyFilterContext";
import { useAuth } from "@/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubPopulationFilter } from "@/components/dashboard/SubPopulationFilter";


const ITEMS_PER_PAGE = 50;

// Full list of 14 filters from legacy TreeTable.tsx
const subPopulationFilterLabels: Record<string, string> = {
  calhiv: 'C/ALHIV',
  hei: 'HEI',
  cwlhiv: 'C/WLHIV',
  agyw: 'AGYW',
  csv: 'C/SV',
  cfsw: 'CFSW',
  abym: 'ABYM',
  caahh: 'CAAHH',
  caichh: 'CAICHH',
  caich: 'CAICH',
  calwd: 'CALWD',
  caifhh: 'CAIFHH',
  muc: 'MUC',
  pbfw: 'PBFW',
};

// Mapping for filters where the data key differs from the filter key
const filterKeyToDataKey: Record<string, string> = {
  caahh:  'child_adolescent_in_aged_headed_household',
  caichh: 'child_adolescent_in_chronically_ill_headed_household',
  caich:  'child_adolescent_in_child_headed_household',
  calwd:  'child_adolescent_living_with_disability',
  caifhh: 'child_adolescent_in_female_headed_household',
  muc:    'under_5_malnourished',
  pbfw:   'pbfw',
};

const pickValue = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      return String(value);
    }
  }
  return "N/A";
};

const calculateAge = (birthdate: any): number => {
  if (!birthdate) return 0;
  const dateStr = String(birthdate);

  const formats = [
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  ];

  let parsedDate: Date | null = null;

  for (const format of formats) {
    const parts = dateStr.match(format);
    if (parts) {
      if (format === formats[0]) {
        parsedDate = new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
      } else if (format === formats[1]) {
        parsedDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
      } else {
        parsedDate = new Date(parseInt(parts[3]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      break;
    }
  }

  // Try standard date parsing if regex failed but it's a valid ISO string
  if (!parsedDate && !isNaN(Date.parse(dateStr))) {
    parsedDate = new Date(dateStr);
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - parsedDate.getFullYear();
  const m = today.getMonth() - parsedDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < parsedDate.getDate())) age--;
  return age;
};


const VcaRegister = () => {
  const { user } = useAuth();
  const isDistrictUser  = user?.description === "District User";
  const isProvincialUser = user?.description === "Provincial User";
  const userProvince    = user?.title;
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();

  // Role flags
  const lockedDistrict = isDistrictUser && user?.location ? user.location : null;

  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    lockedDistrict ?? (searchParams.get("district") || "All")
  );
  const [searchQuery, setSearchQuery]           = useState("");
  const [currentPage, setCurrentPage]           = useState(1);
  const [subPopulationFilters, setSubPopulationFilters] = useState<Record<string, string>>(
    Object.keys(subPopulationFilterLabels).reduce((acc, key) => ({ ...acc, [key]: "all" }), {})
  );

  // SECURITY: Re-enforce district lock whenever user changes
  // Omitted selectedDistrict from deps to avoid infinite loops
  useEffect(() => {
    if (lockedDistrict && selectedDistrict !== lockedDistrict) {
      setSelectedDistrict(lockedDistrict);
    }
  }, [lockedDistrict]);

  // FY filter
  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // Single fetch — all VCAs (filtered client-side)
  // Deriving districts from the same dataset so the dropdown and table are always in sync.
  const vcasQuery = useQuery({
    queryKey: ["vcas", "All", fyKey],
    queryFn:  () => getChildrenByDistrict("", fyArg),
    staleTime: 1000 * 60 * 10,
  });

  // Build district list from VCA data
  const discoveredDistrictsMap = useMemo(() => {
    const groups = new Map<string, string[]>();
    if (!vcasQuery.data) return groups;

    (vcasQuery.data as any[]).forEach((v: any) => {
      // Provincial Users: only show districts in their province
      if (isProvincialUser && userProvince && v.province !== userProvince) return;
      const raw: string | undefined = v.district;
      if (!raw) return;

      const normalized = toTitleCase(raw.trim());
      if (!groups.has(normalized)) groups.set(normalized, []);
      const variants = groups.get(normalized)!;
      if (!variants.includes(raw)) variants.push(raw);
    });

    return groups;
  }, [vcasQuery.data, isProvincialUser, userProvince]);

  const districts = useMemo(
    () => Array.from(discoveredDistrictsMap.keys()).sort(),
    [discoveredDistrictsMap]
  );

  // Core filter logic
  const filteredVcas = useMemo(() => {
    const allVcas: any[] = vcasQuery.data ?? [];

    // Resolve raw district variants for the selected display name
    const selectedVariants: string[] =
      selectedDistrict === "All"
        ? []
        : discoveredDistrictsMap.get(selectedDistrict) ?? [selectedDistrict];

    return allVcas
      .filter((vca: any) => {
        // Province guard (Provincial Users)
        if (isProvincialUser && userProvince && vca.province !== userProvince) {
          return false;
        }

        // District filter
        if (selectedDistrict !== "All") {
          const raw = String(vca.district ?? "").trim();
          if (!selectedVariants.includes(raw)) return false;
        }

        // Global search
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const addressString = [
            vca.homeaddress,
            vca.facility,
            vca.province,
            vca.district,
            vca.ward,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matches =
            (vca.uid?.toLowerCase() || "").includes(q) ||
            addressString.includes(q) ||
            (vca.vca_gender?.toLowerCase() || "").includes(q);

          if (!matches) return false;
        }

        // Sub-population filters
        const matchesFilters = Object.entries(subPopulationFilters).every(([key, value]) => {
          if (value === "all") return true;

          const dataKey    = filterKeyToDataKey[key] ?? key;
          const recordValue = vca[dataKey];

          // Check for '1', 'true', '0', 'false' string or boolean values
          return value === "yes"
            ? recordValue === "1" || recordValue === "true" || recordValue === 1 || recordValue === true
            : recordValue === "0" || recordValue === "false" || recordValue === 0 || recordValue === false || recordValue === null || recordValue === undefined;
        });

        return matchesFilters;
      })
      .sort((a: any, b: any) => {
        const idA = String(a.household_id || a.vca_id || a.id || "");
        const idB = String(b.household_id || b.vca_id || b.id || "");
        return idB.localeCompare(idA);
      });
  }, [
    vcasQuery.data,
    selectedDistrict,
    discoveredDistrictsMap,
    searchQuery,
    subPopulationFilters,
    isProvincialUser,
    userProvince,
  ]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, subPopulationFilters, selectedDistrict]);

  // Pagination
  const totalPages       = Math.ceil(filteredVcas.length / ITEMS_PER_PAGE);
  const startIndex       = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedVcas    = filteredVcas.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }

    return pages;
  };

  // Filter helpers
  const handleFilterChange = (key: string, value: string) => {
    setSubPopulationFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSubPopulationFilters(
      Object.keys(subPopulationFilterLabels).reduce((acc, key) => ({ ...acc, [key]: "all" }), {})
    );
    // District is not cleared by "Clear filters"
  };

  // CSV Export
  // Always exports exactly what is currently visible after ALL active filters
  // (district + search). Filename reflects active district.
  const exportToCSV = () => {
    if (filteredVcas.length === 0) return;

    try {
      const columnDefs: { header: string; key: string }[] = [
        { header: "Unique ID",          key: "uid" },
        { header: "Gender",             key: "vca_gender" },
        { header: "Birth Date",         key: "birthdate" },
        { header: "Home Address",       key: "homeaddress" },
        { header: "Facility",           key: "facility" },
        { header: "Province",           key: "province" },
        { header: "District",           key: "district" },
        { header: "Ward",               key: "ward" },
        { header: "Last Service Date",  key: "last_service_date" },
        { header: "Virally Suppressed", key: "virally_suppressed" },
      ];

      const escape = (val: unknown) =>
        `"${String(val ?? "").replace(/"/g, '""')}"`;

      const csvContent = [
        columnDefs.map((c) => escape(c.header)).join(","),
        ...filteredVcas.map((row: any) =>
          columnDefs.map((c) => escape(row[c.key])).join(",")
        ),
      ].join("\n");

      // Filename reflects active district + date for traceability
      const districtLabel =
        selectedDistrict === "All"
          ? "all_districts"
          : selectedDistrict.replace(/\s+/g, "_");
      const dateLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const filename  = `vcas_${districtLabel}_${dateLabel}.csv`;

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
      const link = document.createElement("a");
      link.href  = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getAddressString = (record: any) =>
    [
      record.homeaddress && `Address: ${record.homeaddress}`,
      record.facility    && `Facility: ${record.facility}`,
      record.province    && `Province: ${record.province}`,
      record.district    && `District: ${record.district}`,
      record.ward        && `Ward: ${record.ward}`,
    ]
      .filter(Boolean)
      .join("\n");

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Render
  return (
    <DashboardLayout subtitle="VCA Register">
      {/* Hero */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(139,92,246,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-violet-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                VCA register
              </span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                <Activity className="h-3 w-3" /> Active VCAs ─ {filteredVcas.length.toLocaleString()} records
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-violet-700 bg-clip-text text-transparent">
                Children &amp; adolescents
              </span>
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                <Users className="h-3 w-3" /> Demographics · Services · Status
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Only active VCAs are shown. Use the filters to drill down by sub-population.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <Select
              value={selectedDistrict}
              onValueChange={(val) => {
                if (lockedDistrict) return; // District Users cannot change
                setSelectedDistrict(val);
              }}
              disabled={!!lockedDistrict}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-9 bg-white/80 border-slate-200 backdrop-blur-md text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <SelectValue placeholder="Select District" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {!lockedDistrict && (
                  <SelectItem value="All">All Districts</SelectItem>
                )}
                {districts.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              onClick={exportToCSV}
              disabled={filteredVcas.length === 0}
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-violet-200/20 opacity-50 blur-md" />
        <GlowCard>
          <CardContent className="space-y-6 pt-6">

            {/* Primary toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="relative flex-1 min-w-0 sm:min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by ID, name, or facility…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-white border-slate-200 focus-visible:ring-emerald-500/30"
                />
              </div>
              {(() => {
                const activeCount =
                  Object.values(subPopulationFilters).filter((v) => v !== "all").length +
                  (searchQuery ? 1 : 0);
                return (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    disabled={activeCount === 0}
                    className="group inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 h-10 text-xs font-medium text-slate-600 transition-all hover:border-rose-300 hover:bg-rose-50/60 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear
                    {activeCount > 0 && (
                      <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-100 px-1 text-[10px] font-bold text-rose-700">
                        {activeCount}
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>

            {/* Sub-population tri-state filters */}
            <SubPopulationFilter
              filters={subPopulationFilters}
              labels={subPopulationFilterLabels}
              onChange={handleFilterChange}
              onClear={handleClearFilters}
            />

            {/* Active filter chips */}
            {(() => {
              const chips: Array<{ key: string; label: string; onClear: () => void }> = [];

              // District chip (only when not "All" and not locked)
              if (selectedDistrict !== "All" && !lockedDistrict) {
                chips.push({
                  key:   "district",
                  label: `District: ${selectedDistrict}`,
                  onClear: () => setSelectedDistrict("All"),
                });
              }

              Object.entries(subPopulationFilters).forEach(([k, v]) => {
                if (v !== "all") {
                  chips.push({
                    key:   `sp-${k}`,
                    label: `${subPopulationFilterLabels[k]}: ${v}`,
                    onClear: () => handleFilterChange(k, "all"),
                  });
                }
              });

              if (searchQuery) {
                chips.push({
                  key:   "search",
                  label: `Search: "${searchQuery}"`,
                  onClear: () => setSearchQuery(""),
                });
              }

              if (chips.length === 0) return null;

              return (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Active
                  </span>
                  {chips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={c.onClear}
                      className="group inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 transition-all hover:border-emerald-400 hover:bg-emerald-100"
                    >
                      {c.label}
                      <X className="h-2.5 w-2.5 opacity-60 transition-opacity group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Table */}
            <div className="rounded-xl border border-emerald-100/60 overflow-hidden">
              <Table>
                <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-violet-50/40">
                  <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                    <TableHead className="w-[120px] hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">Unique ID</TableHead>
                    <TableHead className="w-[80px]  hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">Gender</TableHead>
                    <TableHead className="w-[60px]  hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">Age</TableHead>
                    <TableHead className="w-[220px] hidden lg:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">Household details</TableHead>
                    <TableHead className="text-right w-[70px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vcasQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex items-center justify-center py-12">
                          <LoadingDots />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredVcas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                        No VCAs found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedVcas.map((vca: any, index: number) => {
                      const id = pickValue(vca, ["uid", "unique_id", "vca_id"]);
                      return (
                        <TableRow
                          key={`${id}-${index}`}
                          className="group transition-colors border-b border-emerald-50/60 hover:bg-gradient-to-r hover:from-emerald-50/40 hover:via-teal-50/20 hover:to-transparent"
                        >
                          <TableCell className="font-medium align-top hidden sm:table-cell">
                            <span className="text-sm font-bold bg-slate-50 px-2 py-1 rounded border border-slate-100">
                              {String(id)}
                            </span>
                          </TableCell>
                          {/* Mobile-only combined cell */}
                          <TableCell className="sm:hidden">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1 rounded w-fit">
                                {String(id)}
                              </span>
                              <div className="flex gap-2">
                                <span className="text-[10px] bg-slate-50 border border-slate-100 px-1.5 rounded text-slate-600">
                                  {String(pickValue(vca, ["vca_gender", "gender"]))?.charAt(0)} •{" "}
                                  {calculateAge(vca.birthdate)}y
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 italic truncate max-w-[140px]">
                                {vca.facility || "No Facility"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell align-top">
                            {String(pickValue(vca, ["vca_gender", "gender"]))}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell align-top">
                            {calculateAge(vca.birthdate)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell w-[220px] max-w-[220px]">
                            <div className="text-xs text-slate-600 leading-snug line-clamp-2 break-words">
                              {getAddressString(vca)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right align-top px-2 sm:px-4">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/60 bg-white/80 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm"
                              onClick={() =>
                                navigate(`/profile/vca-details`, { state: { id: String(id) } })
                              }
                            >
                              View
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t">
              <div className="text-sm text-slate-500">
                Showing {filteredVcas.length > 0 ? startIndex + 1 : 0} to{" "}
                {Math.min(startIndex + ITEMS_PER_PAGE, filteredVcas.length)} of{" "}
                {filteredVcas.length} entries
              </div>

              {totalPages > 1 && (
                <Pagination className="justify-end w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {getPageNumbers().map((page, i) => (
                      <PaginationItem key={i}>
                        {page === "..." ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            isActive={currentPage === page}
                            onClick={() => setCurrentPage(page as number)}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>

          </CardContent>
        </GlowCard>
      </div>
    </DashboardLayout>
  );
};

export default VcaRegister;