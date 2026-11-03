import { useState, useMemo, useEffect } from "react";
import {  Search, Download, Activity, MapPin, Home, X, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { getHouseholdsByDistrict } from "@/lib/api";
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

const subPopulationFilterLabels: Record<string, string> = {
  calhiv: 'CALHIV',
  hei: 'HEI',
  cwlhiv: 'CWLHIV',
  agyw: 'AGYW',
  csv: 'C/SV',
  cfsw: 'CFSW',
  abym: 'ABYM'
};

// Map filter keys to actual data keys if they differ
// Extend map here if API uses different field names
const filterKeyToDataKey: Record<string, string> = {
  // e.g. csv: 'child_sv' — add mappings here
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

const HouseholdRegister = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [currentPage, setCurrentPage] = useState(1);
  const [subPopulationFilters, setSubPopulationFilters] = useState<Record<string, string>>(
    Object.keys(subPopulationFilterLabels).reduce((acc, key) => ({ ...acc, [key]: "all" }), {})
  );

  // Initial state logic for district security
  const isDistrictUser = user?.description === "District User";
  const isProvincialUser = user?.description === "Provincial User";
  const userProvince = user?.title;

  // District Users are locked to their own district; everyone else defaults to "All"
  const lockedDistrict = isDistrictUser && user?.location ? user.location : null;

  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    lockedDistrict ?? (searchParams.get("district") || "All")
  );

  // SECURITY: Re-enforce district lock whenever user changes
  useEffect(() => {
    if (lockedDistrict && selectedDistrict !== lockedDistrict) {
      setSelectedDistrict(lockedDistrict);
    }
  }, [lockedDistrict]);

  // ── FY filter
  const { resolved: fy } = useFyFilter();
  const fyArg = fy.fromDate && fy.toDate ? { from: fy.fromDate, to: fy.toDate } : undefined;
  const fyKey = fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  // ── Fetch ALL households (single source of truth)
  // Fetch everything once and filter client-side so the district dropdown
  // and the table always stay in sync without extra round-trips.
  const householdsQuery = useQuery({
    queryKey: ["households", "All", fyKey],
    queryFn: () => getHouseholdsByDistrict("", fyArg),
    staleTime: 1000 * 60 * 10,
  });

  // ── Build district list from the same dataset
  const discoveredDistrictsMap = useMemo(() => {
    const groups = new Map<string, string[]>();
    if (!householdsQuery.data) return groups;

    (householdsQuery.data as any[]).forEach((h: any) => {
      const raw: string | undefined = h.district;
      // Provincial Users: only show districts in their province
      if (isProvincialUser && userProvince && h.province !== userProvince) return;
      if (!raw) return;

      const normalized = toTitleCase(raw.trim());
      if (!groups.has(normalized)) groups.set(normalized, []);
      const variants = groups.get(normalized)!;
      if (!variants.includes(raw)) variants.push(raw);
    });

    return groups;
  }, [householdsQuery.data, isProvincialUser, userProvince]);

  const districts = useMemo(
    () => Array.from(discoveredDistrictsMap.keys()).sort(),
    [discoveredDistrictsMap]
  );

  // ── Core filter logic
  const filteredHouseholds = useMemo(() => {
    const allHouseholds: any[] = householdsQuery.data ?? [];

    // Resolve the raw district variants that match the selected display name
    // e.g. "Lusaka" might exist in the API as "lusaka", "LUSAKA", "Lusaka"
    const selectedVariants: string[] =
      selectedDistrict === "All"
        ? []
        : discoveredDistrictsMap.get(selectedDistrict) ?? [selectedDistrict];

    return allHouseholds
      .filter((household: any) => {
        // ── Province guard (Provincial Users)
        if (isProvincialUser && userProvince && household.province !== userProvince) {
          return false;
        }

        // ── District filter ────────────────────────────────────────────────
        // Only skip "All" check; otherwise the raw district value must be in
        // the resolved variants list (handles case/whitespace differences).
        if (selectedDistrict !== "All") {
          const raw = String(household.district ?? "").trim();
          if (!selectedVariants.includes(raw)) return false;
        }

        // ── Global search
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const searchableFields = [
            "household_id", "householdId", "hh_id", "id",
            "homeaddress", "facility", "district", "ward",
            "caseworker_name",
          ];
          const matches = searchableFields.some((key) =>
            household[key]?.toString().toLowerCase().includes(q)
          );
          if (!matches) return false;
        }

        // ── Sub-population filters
        const matchesFilters = Object.entries(subPopulationFilters).every(([key, value]) => {
          if (value === "all") return true;

          const dataKey = filterKeyToDataKey[key] ?? key;
          const recordValue = household[dataKey];

          return value === "yes"
            ? recordValue === "1" || recordValue === "true" || recordValue === 1 || recordValue === true
            : recordValue === "0" || recordValue === "false" || recordValue === 0 || recordValue === false || recordValue === null || recordValue === undefined;
        });

        return matchesFilters;
      })
      .sort((a: any, b: any) => {
        const idA = String(a.household_id || a.householdId || a.id || "");
        const idB = String(b.household_id || b.householdId || b.id || "");
        return idB.localeCompare(idA);
      });
  }, [
    householdsQuery.data,
    selectedDistrict,
    discoveredDistrictsMap,
    searchQuery,
    subPopulationFilters,
    isProvincialUser,
    userProvince,
  ]);

  // ── Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, subPopulationFilters, selectedDistrict]);

  // ── Pagination
  const totalPages = Math.ceil(filteredHouseholds.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedHouseholds = filteredHouseholds.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getPageNumbers = () => {
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

  // ── Filter helpers
  const handleFilterChange = (key: string, value: string) => {
    setSubPopulationFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSubPopulationFilters(
      Object.keys(subPopulationFilterLabels).reduce((acc, key) => ({ ...acc, [key]: "all" }), {})
    );
  };

  // ── CSV Export
  // Exports exactly what is currently visible after all active filters,
  // including the district filter, so the file is always accurate.
  const exportToCSV = () => {
    if (filteredHouseholds.length === 0) return;

    try {
      const columnDefs: { header: string; key: string }[] = [
        { header: "Household ID",     key: "household_id" },
        { header: "Home Address",     key: "homeaddress" },
        { header: "Facility",         key: "facility" },
        { header: "Province",         key: "province" },
        { header: "District",         key: "district" },
        { header: "Ward",             key: "ward" },
        { header: "Case Worker",      key: "caseworker_name" },
        { header: "Screened",         key: "screened" },
        { header: "Last Service Date",key: "last_service_date" },
      ];

      const escape = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;

      const csvContent = [
        columnDefs.map((c) => escape(c.header)).join(","),
        ...filteredHouseholds.map((row: any) =>
          columnDefs.map((c) => escape(row[c.key])).join(",")
        ),
      ].join("\n");

      // Filename reflects the active district selection for traceability
      const districtLabel =
        selectedDistrict === "All" ? "all_districts" : selectedDistrict.replace(/\s+/g, "_");
      const dateLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const filename = `households_${districtLabel}_${dateLabel}.csv`;

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
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
  const getAddressString = (record: any) => {
    return [
      record.homeaddress && `Address: ${record.homeaddress}`,
      record.facility    && `Facility: ${record.facility}`,
      record.province    && `Province: ${record.province}`,
      record.district    && `District: ${record.district}`,
      record.ward        && `Ward: ${record.ward}`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <DashboardLayout subtitle="Household Register">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                Household register
              </span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                <Activity className="h-3 w-3" /> {filteredHouseholds.length.toLocaleString()} records
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                Active households
              </span>
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                <Home className="h-3 w-3" /> Caregivers · Members · Services
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Only active caregivers shown. Use the filters to drill down by sub-population, facility, or caseworker.
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
                {/* Only non-district users see "All Districts" */}
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
              disabled={filteredHouseholds.length === 0}
              className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md" />
        <GlowCard>
          <CardContent className="space-y-6 pt-6">
            {/* Filters Section */}
            {/* Primary toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <div className="relative flex-1 min-w-0 sm:min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by ID, facility, or caseworker…"
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

            {/* Sub-population filters */}
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
                  key: "district",
                  label: `District: ${selectedDistrict}`,
                  onClear: () => setSelectedDistrict("All"),
                });
              }

              Object.entries(subPopulationFilters).forEach(([k, v]) => {
                if (v !== "all") {
                  chips.push({
                    key: `sp-${k}`,
                    label: `${subPopulationFilterLabels[k]}: ${v}`,
                    onClear: () => handleFilterChange(k, "all"),
                  });
                }
              });

              if (searchQuery) {
                chips.push({
                  key: "search",
                  label: `Search: "${searchQuery}"`,
                  onClear: () => setSearchQuery(""),
                });
              }

              if (chips.length === 0) return null;

              return (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Active</span>
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
                <TableHeader className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40">
                  <TableRow className="hover:bg-transparent border-b border-emerald-100/60">
                    <TableHead className="w-[120px] hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">HH ID</TableHead>
                    <TableHead className="w-[220px] hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">Household details</TableHead>
                    <TableHead className="w-[140px] hidden lg:table-cell text-[11px] font-bold uppercase tracking-wider text-emerald-800">Case worker</TableHead>
                    <TableHead className="text-right w-[70px] text-[11px] font-bold uppercase tracking-wider text-emerald-800">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {householdsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="flex items-center justify-center py-12">
                          <LoadingDots />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredHouseholds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                        No households found matching criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedHouseholds.map((household: any, index: number) => {
                      const id = pickValue(household, ["household_id", "householdId"]);
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
                          <TableCell className="sm:hidden">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1 rounded w-fit">{String(id)}</span>
                              <span className="text-[10px] text-slate-500 italic truncate max-w-[140px]">
                                {household.facility || "No Facility"}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                CW: {String(pickValue(household, ["caseworker_name", "cwac_member_name"]))}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell w-[220px] max-w-[220px]">
                            <div className="text-xs text-slate-600 leading-snug line-clamp-2 break-words">
                              {getAddressString(household)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell align-top text-xs">
                            {String(pickValue(household, ["caseworker_name", "cwac_member_name"]))}
                          </TableCell>
                          <TableCell className="text-right align-top px-2 sm:px-4">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/60 bg-white/80 px-2.5 py-1 text-[10px] sm:text-xs font-bold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm"
                              onClick={() =>
                                navigate(`/profile/household-details`, { state: { id: String(id) } })
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
                Showing {filteredHouseholds.length > 0 ? startIndex + 1 : 0} to{" "}
                {Math.min(startIndex + ITEMS_PER_PAGE, filteredHouseholds.length)} of{" "}
                {filteredHouseholds.length} entries
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

export default HouseholdRegister;