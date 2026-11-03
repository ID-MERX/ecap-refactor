import {
  Share2,
  Search,
  Download,
  Activity,
  CheckCircle2,
  TrendingUp,
  Building2,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
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
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GlowCard from "@/components/aceternity/GlowCard";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import {
  getCaregiverReferralsByDistrict,
  getVcaReferralsByDistrict,
} from "@/lib/api";
import { useEffectiveDistrict } from "@/hooks/useEffectiveDistrict";
import { useFyFilter } from "@/context/FyFilterContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { downloadCsv } from "@/lib/csv";
import { anonymizeCaregiverName } from "@/lib/utils";

const ITEMS_PER_PAGE = 50;

const pickValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "")
      return String(value);
  }
  return "N/A";
};

// A row counts as "provided" (linkage completed) if any service was provided.
const hasProvided = (servicesProvided: string) =>
  Boolean(
    servicesProvided && servicesProvided.trim() && servicesProvided !== "N/A",
  );

type ReferralRow = {
  beneficiaryType: "Caregiver" | "Child";
  entityId: string;
  householdId: string;
  district: string;
  facility: string;
  name: string;
  caseworker: string;
  referredDate: string;
  receivingOrg: string;
  servicesReferred: string;
  servicesProvided: string;
  provided: boolean;
};

const normalizeRow = (
  r: Record<string, any>,
  beneficiaryType: "Caregiver" | "Child",
): ReferralRow => {
  const servicesReferred = pickValue(r, ["services_referred"]);
  const servicesProvided = pickValue(r, ["services_provided"]);
  return {
    beneficiaryType,
    entityId: pickValue(
      r,
      beneficiaryType === "Child"
        ? ["unique_id", "household_id"]
        : ["household_id", "unique_id"],
    ),
    householdId: pickValue(r, ["household_id"]),
    district: pickValue(r, ["district"]),
    facility: pickValue(r, ["facility"]),
    name:
      beneficiaryType === "Child"
        ? `${pickValue(r, ["firstname"])} ${pickValue(r, ["lastname"])}`
            .replace(/N\/A/g, "")
            .trim() || "N/A"
        : anonymizeCaregiverName(
            pickValue(r, [
              "caregiver_name",
              "full_name",
              "name",
              "mother_name",
              "guardian_name",
            ]),
          ),
    caseworker: pickValue(r, ["caseworker_name"]),
    referredDate: pickValue(r, ["referred_date", "date_referred"]),
    receivingOrg: pickValue(r, ["receiving_organization"]),
    servicesReferred: servicesReferred === "N/A" ? "" : servicesReferred,
    servicesProvided: servicesProvided === "N/A" ? "" : servicesProvided,
    provided: hasProvided(servicesProvided),
  };
};

const Referrals = () => {
  const {
    district: initialDistrict,
    availableDistricts,
    isAdmin,
  } = useEffectiveDistrict();

  const [selectedDistrict, setSelectedDistrict] = useState(
    initialDistrict || (isAdmin ? "All Districts" : ""),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const deferredSearch = useDeferredValue(searchQuery);

  useEffect(() => {
    if (initialDistrict) setSelectedDistrict(initialDistrict);
    else if (isAdmin && !selectedDistrict) setSelectedDistrict("All Districts");
  }, [initialDistrict, isAdmin, selectedDistrict]);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, selectedDistrict, activeTab]);

  const { resolved: fy } = useFyFilter();
  const fyKey =
    fy.mode === "all" ? "all" : `${fy.fromDate ?? ""}_${fy.toDate ?? ""}`;

  const districtParam =
    selectedDistrict === "All Districts" ? undefined : selectedDistrict;

  const caregiverQuery = useQuery({
    queryKey: ["caregiver-referrals", districtParam ?? "all", fyKey],
    queryFn: () => getCaregiverReferralsByDistrict(districtParam),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
  const vcaQuery = useQuery({
    queryKey: ["vca-referrals", districtParam ?? "all", fyKey],
    queryFn: () => getVcaReferralsByDistrict(districtParam),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = caregiverQuery.isLoading || vcaQuery.isLoading;

  const allRows = useMemo<ReferralRow[]>(() => {
    const caregiver = (
      (caregiverQuery.data ?? []) as Record<string, any>[]
    ).map((r) => normalizeRow(r, "Caregiver"));
    const vca = ((vcaQuery.data ?? []) as Record<string, any>[]).map((r) =>
      normalizeRow(r, "Child"),
    );
    return [...caregiver, ...vca];
  }, [caregiverQuery.data, vcaQuery.data]);

  const filteredRows = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      [
        r.entityId,
        r.householdId,
        r.name,
        r.facility,
        r.receivingOrg,
        r.servicesReferred,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [allRows, deferredSearch]);

  // KPIs: referred = every referral row; provided = subset that was delivered.
  const referredCount = filteredRows.length;
  const providedCount = filteredRows.filter((r) => r.provided).length;
  const completionRate =
    referredCount > 0 ? (providedCount / referredCount) * 100 : 0;
  const withFeedback = filteredRows.filter(
    (r) => r.provided && r.receivingOrg !== "N/A",
  ).length;

  // Referred vs Provided split by beneficiary type for the chart.
  const chartData = useMemo(() => {
    const groups: Record<
      string,
      { type: string; referred: number; provided: number }
    > = {
      Caregiver: { type: "Caregiver", referred: 0, provided: 0 },
      Child: { type: "Child", referred: 0, provided: 0 },
    };
    for (const r of filteredRows) {
      groups[r.beneficiaryType].referred += 1;
      if (r.provided) groups[r.beneficiaryType].provided += 1;
    }
    return Object.values(groups);
  }, [filteredRows]);

  const linkageRows = useMemo(
    () => filteredRows.filter((r) => r.provided),
    [filteredRows],
  );

  const tableRows = activeTab === "linkages" ? linkageRows : filteredRows;
  const totalPages = Math.max(1, Math.ceil(tableRows.length / ITEMS_PER_PAGE));
  const pageRows = tableRows.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleExport = () => {
    const headers = [
      "Beneficiary Type",
      "ID",
      "Household ID",
      "Name",
      "District",
      "Facility",
      "Caseworker",
      "Referred Date",
      "Receiving Organization",
      "Services Referred",
      "Services Provided",
      "Status",
    ];
    const rows = tableRows.map((r) => [
      r.beneficiaryType,
      r.entityId,
      r.householdId,
      r.name,
      r.district,
      r.facility,
      r.caseworker,
      r.referredDate,
      r.receivingOrg,
      r.servicesReferred,
      r.servicesProvided,
      r.provided ? "Provided" : "Referred",
    ]);
    downloadCsv(
      `referrals-${selectedDistrict || "all"}-${activeTab}.csv`,
      headers,
      rows,
    );
  };

  const kpis = [
    {
      label: "Referrals Made",
      value: referredCount,
      icon: Share2,
      color: "text-emerald-600",
    },
    {
      label: "Referrals Provided",
      value: providedCount,
      icon: CheckCircle2,
      color: "text-teal-600",
    },
    {
      label: "Completion Rate",
      value: `${completionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      label: "Linked w/ Feedback",
      value: withFeedback,
      icon: Building2,
      color: "text-violet-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <Share2 className="h-6 w-6 text-emerald-600" /> Referrals &
              Linkages
            </h1>
            <p className="text-sm text-slate-500">
              Referrals made vs services provided — completion rate and linkage
              feedback.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedDistrict}
              onValueChange={setSelectedDistrict}
            >
              <SelectTrigger className="h-9 w-[180px] bg-white">
                <SelectValue placeholder="District" />
              </SelectTrigger>
              <SelectContent>
                {availableDistricts.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={handleExport}
              disabled={tableRows.length === 0}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlowCard className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {k.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {isLoading ? <LoadingDots /> : k.value}
                    </p>
                  </div>
                  <k.icon className={`h-8 w-8 ${k.color}`} />
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-600" /> Referred vs
              Provided
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="referred"
                  name="Referred"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="provided"
                  name="Provided"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="overview">All Referrals</TabsTrigger>
              <TabsTrigger value="linkages" className="gap-1.5">
                Linkages <ArrowRight className="h-3 w-3" /> Provided
              </TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search ID, name, facility, organization…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full pl-8 sm:w-[320px]"
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-3">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Household ID</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Referred Date</TableHead>
                      <TableHead>Services Referred</TableHead>
                      <TableHead>Receiving Org</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center">
                          <LoadingDots />
                        </TableCell>
                      </TableRow>
                    ) : pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-10 text-center text-sm text-slate-500"
                        >
                          No referrals found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((r, idx) => (
                        <TableRow
                          key={`${r.beneficiaryType}-${r.entityId}-${idx}`}
                        >
                          <TableCell className="text-xs">
                            {r.beneficiaryType}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.entityId}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.householdId}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.facility}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.referredDate}
                          </TableCell>
                          <TableCell
                            className="max-w-[220px] truncate text-xs"
                            title={r.servicesReferred}
                          >
                            {r.servicesReferred || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.receivingOrg}
                          </TableCell>
                          <TableCell>
                            {r.provided ? (
                              <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100">
                                Provided
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-slate-500"
                              >
                                Referred
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {totalPages > 1 && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive>
                      {currentPage} / {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Referrals;
