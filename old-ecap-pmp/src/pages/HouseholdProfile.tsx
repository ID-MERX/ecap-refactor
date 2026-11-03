import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getHouseholdsByDistrict,
  getHouseholdArchivedRegister,
  DEFAULT_DISTRICT,
  getCaregiverServicesByHousehold,
  getCaregiverReferralsByMonth,
  getFlaggedRecords,
  getChildrenByDistrict,
  getCaregiverCasePlansByDistrict,
  getCaregiverCasePlansByHousehold,
  getCaregiverCasePlanDomainsByHousehold,
  getHouseholdReferralsById,
  getHouseholdMembers,
  updateFlagStatus,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  MapPin,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  Briefcase,
  Layers,
  ShieldCheck,
  HeartPulse,
  FileText,
  Activity,
  Link2,
  Home,
  Flag,
  AlertTriangle,
  Archive,
  Users,
  ChevronRight,
} from "lucide-react";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Fragment, useMemo, useState } from "react";
import moment from "moment";
import { cn, toTitleCase } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFlaggedRecord } from "@/lib/api";
import { notifyUsersOfFlag, notifyUsersOfFlagResolution } from "@/lib/directus";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

const subPopulationFilterLabels: Record<string, string> = {
  calhiv: "CALHIV",
  hei: "HEI",
  cwlhiv: "CWLHIV",
  agyw: "AGYW",
  csv: "C/SV",
  cfsw: "CFSW",
  abym: "ABYM",
};

const flagSchema = z.object({
  category: z.string().optional(),
  severity: z.string().optional(),
  comment: z
    .string()
    .min(10, "Flag observations must be at least 10 characters long."),
});

const parseMomentDate = (value: any) => {
  if (!value || value === "N/A") return null;
  const parsed = moment(
    String(value),
    [
      moment.ISO_8601,
      "YYYY-MM-DD",
      "DD-MM-YYYY",
      "DD/MM/YYYY",
      "MM/DD/YYYY",
      "YYYY/MM/DD",
    ],
    true,
  );
  return parsed.isValid() ? parsed : moment(String(value));
};

const safeParseDate = (dateStr: any) => {
  const parsed = parseMomentDate(dateStr);
  return parsed ? parsed.valueOf() : 0;
};

const formatServiceDate = (value: any) => {
  const parsed = parseMomentDate(value);
  return parsed ? parsed.format("DD MMM YYYY") : "N/A";
};

const formatBirthDate = (value: any) => {
  const parsed = parseMomentDate(value);
  return parsed ? parsed.format("DD MMM YYYY") : "N/A";
};

const HouseholdProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const routeState = (location.state as Record<string, unknown> | null) ?? null;

  // Retrieve ID from location state or search params or sessionStorage fallback
  const id = useMemo(() => {
    const stateId = location.state?.id || searchParams.get("id");
    if (stateId) {
      sessionStorage.setItem("ecap_last_household_id", stateId);
      return stateId;
    }
    return sessionStorage.getItem("ecap_last_household_id");
  }, [location.state?.id, searchParams]);

  const { user } = useAuth();
  const isDistrictUser = user?.description === "District User";
  // Admins and Provincial Users have global view access at the profile level
  const district = isDistrictUser ? user?.location || "None" : "";

  const { data: households, isLoading: isLoadingActive } = useQuery({
    queryKey: ["households", "district", district],
    queryFn: () => getHouseholdsByDistrict(district),
    enabled: true,
  });

  const { data: archivedHouseholds, isLoading: isLoadingArchived } = useQuery({
    queryKey: ["households", "archived", "district", district],
    queryFn: () => getHouseholdArchivedRegister(district),
    enabled: true,
  });

  const { data: allServices, isLoading: isLoadingServices } = useQuery({
    queryKey: ["caregiver-services", "household", id],
    queryFn: () => getCaregiverServicesByHousehold(id ?? ""),
    enabled: Boolean(id),
  });

  const { data: householdCasePlans = [], isLoading: isLoadingCasePlans } =
    useQuery({
      queryKey: ["caregiver-caseplans", "household", id],
      queryFn: () => getCaregiverCasePlansByHousehold(id ?? ""),
      enabled: Boolean(id),
    });

  // Vulnerabilities/domains for this household's case plans
  // (ec_caregiver_case_plan_domain), keyed by household_id — which is the
  // same `id` this whole page is keyed on. Fetched lazily when "View
  // Vulnerabilities" is first clicked on a case plan row; the table expands
  // inline under that row (clicking again collapses it).
  const [expandedVulnPlanDate, setExpandedVulnPlanDate] = useState<
    string | null
  >(null);
  const {
    data: householdCasePlanDomains = [],
    isLoading: isLoadingCasePlanDomains,
  } = useQuery({
    queryKey: ["caregiver-caseplan-domains", "household", id],
    queryFn: () => getCaregiverCasePlanDomainsByHousehold(id ?? ""),
    enabled: Boolean(id) && expandedVulnPlanDate !== null,
  });
  const expandedVulnerabilities = useMemo(() => {
    if (expandedVulnPlanDate === null) return [];
    const matched = householdCasePlanDomains.filter(
      (v: any) => String(v.case_plan_date ?? "") === expandedVulnPlanDate,
    );
    // A case plan whose date doesn't match any domain row (date drift in the
    // source data) still gets the household's full domain list rather than a
    // silently empty table.
    return matched.length > 0 ? matched : householdCasePlanDomains;
  }, [householdCasePlanDomains, expandedVulnPlanDate]);

  const { data: vcas } = useQuery({
    queryKey: ["vcas", "district", district],
    queryFn: () => getChildrenByDistrict(district),
    enabled: true,
  });

  const { data: flaggedRecords } = useQuery({
    queryKey: ["flagged-records"],
    queryFn: () => getFlaggedRecords(),
  });

  const { data: householdMembers = [], isLoading: isLoadingMembers } = useQuery(
    {
      queryKey: ["household-members", id],
      queryFn: () => getHouseholdMembers(id ?? ""),
      enabled: Boolean(id),
    },
  );

  const queryClient = useQueryClient();

  const household = useMemo(() => {
    const matched = [...(households || []), ...(archivedHouseholds || [])].find(
      (h: any) => {
        const hId = id?.toLowerCase();
        return (
          String(h.uid || "").toLowerCase() === hId ||
          String(h.unique_id || "").toLowerCase() === hId ||
          String(h.household_code || "").toLowerCase() === hId ||
          String(h.household_id || "").toLowerCase() === hId ||
          String(h.id || "").toLowerCase() === hId
        );
      },
    );

    if (matched) return matched;

    if (routeState && id) {
      const stateId = String(
        routeState.id || routeState.household_id || routeState.unique_id || "",
      ).toLowerCase();
      if (
        stateId === String(id).toLowerCase() ||
        String(routeState.household_id || "").toLowerCase() ===
          String(id).toLowerCase()
      ) {
        return {
          ...routeState,
          id,
          household_id: routeState.household_id || id,
          unique_id: routeState.unique_id || id,
          household_code:
            routeState.household_code || routeState.household_id || id,
        } as Record<string, unknown>;
      }
    }

    return undefined;
  }, [households, archivedHouseholds, id, routeState]);

  const form = useForm<z.infer<typeof flagSchema>>({
    resolver: zodResolver(flagSchema),
    defaultValues: {
      category: "",
      severity: "",
      comment: "",
    },
  });

  const mutation = useMutation({
    mutationFn: createFlaggedRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-records"] });
      const verifier = user
        ? `${user.first_name} ${user.last_name}`
        : "Unknown Verifier";
      notifyUsersOfFlag(
        id || "N/A",
        verifier,
        form.getValues("comment") as string,
      );

      toast.success("Flag submitted successfully", {
        description: "The record has been flagged for review.",
      });
      form.reset();
    },
    onError: (err: Error) => {
      toast.error("Submission failed", {
        description: err.message || "Please try again later.",
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (flagId: string) => {
      await updateFlagStatus(flagId, "resolved");
      const resolver = user
        ? `${user.first_name} ${user.last_name}`
        : "Unknown Resolver";
      const record = householdFlags.find((f: any) => f.id === flagId);
      if (record) {
        await notifyUsersOfFlagResolution(
          String(record.household_id ?? ""),
          resolver,
          "Resolved from Household profile.",
          String(record.vca_id ?? ""),
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-records"] });
      toast.success("Flag resolved", {
        description: "Caseworker and admins have been notified.",
      });
    },
    onError: (err: any) => {
      toast.error("Failed to resolve flag", { description: err.message });
    },
  });

  const handleResolve = (flagId: string) => {
    resolveMutation.mutate(flagId);
  };

  const onFlagSubmit = (values: z.infer<typeof flagSchema>) => {
    const verifier = user
      ? `${user.first_name} ${user.last_name}`
      : "Unknown Verifier";
    const payload = {
      household_id: id,
      caseworker_phone: household?.caseworker_phone || "N/A",
      caseworker_name:
        household?.caseworker_name || household?.cwac_member_name || "N/A",
      caregiver_name: household?.caregiver_name || "N/A",
      facility: household?.facility || household?.health_facility || "N/A",
      comment: values.comment,
      category: values.category,
      severity: values.severity,
      verifier,
      status: "pending",
    };
    mutation.mutate(payload);
  };

  const householdServices = useMemo(() => {
    if (!allServices || !id) return [];
    const hhId = String(household?.household_id || id).toLowerCase();
    const filtered = allServices.filter((s: any) => {
      return (
        String(
          s.household_id || s.householdId || s.hh_id || "",
        ).toLowerCase() === hhId
      );
    });

    return filtered.sort((a: any, b: any) => {
      const dateA = safeParseDate(a.service_date || a.visit_date || a.date);
      const dateB = safeParseDate(b.service_date || b.visit_date || b.date);
      return dateB - dateA;
    });
  }, [allServices, id, household?.household_id]);

  const sortedCasePlans = useMemo(() => {
    return [...householdCasePlans].sort((a: any, b: any) => {
      const dateA = safeParseDate(
        a.case_plan_date || a.date_of_caseplan || a.date,
      );
      const dateB = safeParseDate(
        b.case_plan_date || b.date_of_caseplan || b.date,
      );
      return dateB - dateA;
    });
  }, [householdCasePlans]);

  const householdFlags = useMemo(() => {
    if (!flaggedRecords || !id) return [];
    const hhId = String(household?.household_id || id).toLowerCase();
    return (flaggedRecords || []).filter((f: any) => {
      const matchId =
        String(f.household_id || f.hh_id || "").toLowerCase() === hhId;
      return matchId && f.status !== "resolved";
    });
  }, [flaggedRecords, id, household?.household_id]);

  const householdVcas = useMemo(() => {
    if (!vcas || !id) return [];
    return vcas.filter((v: any) => {
      const hhId = id.toLowerCase();
      return (
        String(v.household_code || v.household_id || "").toLowerCase() === hhId
      );
    });
  }, [vcas, id]);

  const { data: householdReferrals = [], isLoading: isLoadingReferrals } =
    useQuery({
      queryKey: ["caregiver-referrals", id],
      queryFn: () => getHouseholdReferralsById(id ?? ""),
      enabled: Boolean(id),
    });

  const sortedReferrals = useMemo(() => {
    return [...householdReferrals].sort((a: any, b: any) => {
      const dateA = safeParseDate(
        a.service_date || a.visit_date || a.date || a.referral_date,
      );
      const dateB = safeParseDate(
        b.service_date || b.visit_date || b.date || b.referral_date,
      );
      return dateB - dateA;
    });
  }, [householdReferrals]);

  if (isLoadingActive || isLoadingArchived) {
    return (
      <DashboardLayout subtitle="Household profile">
        <div className="flex h-[50vh] items-center justify-center">
          <LoadingDots />
        </div>
      </DashboardLayout>
    );
  }

  if (!household) {
    return (
      <DashboardLayout subtitle="Household not found">
        <EmptyState
          icon={<Home className="h-7 w-7" />}
          title="Household not found"
          description="The household record you're looking for doesn't exist or has been moved."
          action={{
            label: "Back to Register",
            onClick: () => navigate("/households"),
          }}
          className="h-[50vh]"
        />
      </DashboardLayout>
    );
  }

  // Add this helper near your other utility functions
  const normalizeRelationship = (value: any): string => {
    if (!value) return "N/A";

    const normalized = String(value).toLowerCase().trim();

    if (normalized === "guardian" || normalized === "gardian")
      return "Guardian";
    if (normalized === "parent") return "Parent";

    return "N/A";
  };

  const caregiverName = String(
    household.caregiver_name || household.name || "N/A",
  );
  const isArchived = Boolean(household.de_registration_date);
  const primaryStatus = isArchived ? "Archived" : "Active";

  // Pick the latest service date dynamically from the sorted services list
  const lastServiceDate = formatServiceDate(
    householdServices[0]?.service_date || household.last_service_date,
  );

  return (
    <DashboardLayout subtitle={`Household: ${id}`}>
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        {/* ── Hero (aurora frosted-glass) ──────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
          <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
          <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-teal-300/35 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

          <div className="relative z-10 flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-5 md:flex-row md:items-center min-w-0">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-md">
                <Home className="h-7 w-7" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                    Household profile
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1 text-[10px]",
                      isArchived
                        ? "border-amber-200 bg-amber-50/80 text-amber-700"
                        : "border-emerald-200 bg-emerald-50/80 text-emerald-700",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isArchived
                          ? "bg-amber-400"
                          : "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]",
                      )}
                    />
                    {primaryStatus}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1 border-slate-200 bg-white/70 text-[10px] font-mono text-slate-500"
                  >
                    #{id || "N/A"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1 border-violet-200 bg-violet-50/80 text-[10px] text-violet-700"
                  >
                    <Users className="h-3 w-3" /> {householdVcas.length} VCAs
                  </Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                    Caregiver Name – Confidential
                  </span>
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    {String(household.district || "N/A")} ·{" "}
                    {String(household.facility || "N/A")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-emerald-600" />
                    Last updated: {String(lastServiceDate || "N/A")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    {String(household.caseworker_name || "N/A")}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  navigate("/profile/household-details", {
                    state: { id, household_id: id, ...(household || {}) },
                  })
                }
                className="group inline-flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50/80 px-3 py-1.5 text-xs font-semibold text-pink-700 backdrop-blur-md transition-all hover:border-pink-300 hover:bg-pink-100"
              >
                View Household Profile
                <ArrowLeft className="h-3.5 w-3.5 rotate-180 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back to register
              </button>
            </div>
          </div>
        </div>

        <div className="relative rounded-[28px] border border-emerald-100/60 bg-white/85 backdrop-blur-xl p-6 shadow-[0_15px_50px_-30px_rgba(15,118,110,0.45)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[1px] -z-10 rounded-[28px] bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-transparent opacity-50 blur-md"
          />

          {/* ── Quick stat cards ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(
              [
                {
                  icon: MapPin,
                  label: "Ward",
                  value: String(household.ward || "N/A"),
                  iconBg: "from-emerald-100 to-teal-100 text-emerald-700",
                  glow: "from-emerald-200/70 via-teal-200/40",
                },
                {
                  icon: HeartPulse,
                  label: "Facility",
                  value: String(household.facility || "N/A"),
                  iconBg: "from-rose-100 to-pink-100 text-rose-700",
                  glow: "from-rose-200/70 via-pink-200/40",
                },
                {
                  icon: Calendar,
                  label: "Last service date",
                  value: String(lastServiceDate),
                  iconBg: "from-sky-100 to-cyan-100 text-sky-700",
                  glow: "from-sky-200/70 via-cyan-200/40",
                },
              ] as const
            ).map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="group relative">
                  <div
                    className={cn(
                      "absolute -inset-[1px] rounded-2xl bg-gradient-to-br to-transparent opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-100",
                      card.glow,
                    )}
                  />
                  <div className="relative flex h-full items-center gap-4 rounded-2xl border border-slate-200/70 bg-white/75 p-4 backdrop-blur-xl shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)] transition-all duration-300 group-hover:-translate-y-0.5">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-white/60 shadow-sm",
                        card.iconBg,
                      )}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {card.label}
                      </p>
                      <p
                        className="text-sm font-bold text-slate-900 truncate"
                        title={card.value}
                      >
                        {card.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Tabs ──────────────────────────────────────────────── */}
          <Tabs defaultValue="overview" className="mt-8 sm:mt-10">
            <div className="flex flex-col gap-3 border-b border-emerald-100/60 lg:flex-row lg:items-center lg:justify-between">
              <div className="-mx-2 overflow-x-auto px-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-emerald-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <TabsList className="h-auto bg-transparent p-0 inline-flex gap-3 sm:gap-6 lg:gap-8 whitespace-nowrap">
                  {[
                    { id: "overview", label: "SUMMARY" },
                    { id: "family", label: "FAMILY MEMBERS" },
                    { id: "history", label: "CASEPLANS" },
                    { id: "services", label: "SERVICES" },
                    { id: "audit", label: "REFERRALS" },
                    { id: "flags", label: "FLAG RECORD FORM" },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="relative h-10 sm:h-12 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-1 pb-3 sm:pb-4 pt-0 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 transition-all data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            <div className="mt-8">
              <TabsContent value="overview" className="mt-0 space-y-6">
                <InfoCard title="Caregiver Personal Information" icon={User}>
                  <InfoItem
                    label="Caregiver name"
                    value="Caregiver Name – Confidential"
                    icon={<User className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Caregiver sex"
                    value={String(
                      household.caregiver_sex ||
                        household.sex ||
                        household.gender ||
                        "N/A",
                    )}
                  />
                  <InfoItem
                    label="Date of birth"
                    value={formatBirthDate(
                      household.caregiver_birthdate ||
                        household.caregiver_birth_date ||
                        household.dob,
                    )}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="HIV status"
                    value={String(
                      household.caregiver_hiv_status ||
                        household.hiv_status ||
                        "N/A",
                    )}
                    icon={<Activity className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="ART Number"
                    value={String(
                      household.caregiver_art_number ||
                        household.art_number ||
                        "N/A",
                    )}
                  />
                  <InfoItem
                    label="On HIV Treatment?"
                    value={String(
                      household.is_on_hiv_treatment ||
                        household.active_on_treatment ||
                        "N/A",
                    )}
                  />
                  <InfoItem
                    label="Date Started ART"
                    value={String(household.date_started_art || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Date HIV Known"
                    value={String(household.date_hiv_known || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Marital status"
                    value={String(household.marital_status || "N/A")}
                  />
                  <InfoItem
                    label="Education"
                    value={String(household.education || "N/A")}
                  />
                  <InfoItem
                    label="Relation"
                    value={String(
                      household.relation || household.relationship || "N/A",
                    )}
                  />
                  <InfoItem label="Phone number" value="Phone – Confidential" />
                </InfoCard>

                <InfoCard title="Household Information" icon={Home}>
                  <InfoItem
                    label="Home Address"
                    value={String(
                      household.homeaddress || household.home_address || "N/A",
                    )}
                    icon={<MapPin className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Family Source of Income"
                    value={String(household.fam_source_income || "N/A")}
                  />
                  <InfoItem
                    label="Monthly Expenses"
                    value={String(household.monthlyexpenses || "N/A")}
                  />
                  <InfoItem
                    label="Number of Beds"
                    value={String(household.beds || "N/A")}
                  />
                  <InfoItem
                    label="Malaria ITNs"
                    value={String(household.malaria_itns || "N/A")}
                  />
                  <InfoItem
                    label="Number of Pregnant Women"
                    value={String(
                      household.number_of_pregnant_women ||
                        household.pregnant_woment ||
                        "N/A",
                    )}
                  />
                  <InfoItem
                    label="Biological Children"
                    value={String(household.biological_children || "N/A")}
                  />
                  <InfoItem
                    label="Approved Family?"
                    value={String(household.approved_family || "N/A")}
                  />
                  <InfoItem
                    label="Acceptance"
                    value={String(household.acceptance || "N/A")}
                  />
                  <InfoItem
                    label="Screening Location"
                    value={String(
                      household.screening_location ||
                        household.screening_location_home ||
                        "N/A",
                    )}
                  />
                  <InfoItem
                    label="Screening Date"
                    value={String(household.screening_date || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Enrolled Date"
                    value={String(household.enrolled_date || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Date Offered Enrollment"
                    value={String(household.date_offered_enrollment || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Date Referred"
                    value={String(household.date_referred || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Last Service Date"
                    value={String(household.last_service_date || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Client Screened"
                    value={String(
                      household.client_screened || household.screened || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Client Result"
                    value={String(household.client_result || "N/A")}
                  />
                  <InfoItem
                    label="HEI"
                    value={String(household.hei || "N/A")}
                  />
                  <InfoItem
                    label="CALHIV"
                    value={String(household.calhiv || "N/A")}
                  />
                  <InfoItem
                    label="Child MMD"
                    value={String(household.child_mmd || "N/A")}
                  />
                  <InfoItem
                    label="VL Results on File?"
                    value={String(
                      household.viral_load_results_on_file || "N/A",
                    )}
                  />
                  <InfoItem
                    label="TPT Client Eligibility"
                    value={String(household.tpt_client_eligibility || "N/A")}
                  />
                  <InfoItem
                    label="TPT Client Initiated"
                    value={String(household.tpt_client_initiated || "N/A")}
                  />
                  <InfoItem
                    label="Takes Drugs to Prevent Other Diseases?"
                    value={String(
                      household.takes_drugs_to_prevent_other_diseases || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Is Child's Caregiver an FSW?"
                    value={String(
                      household.is_the_child_caregiver_an_fsw || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Is Biological Mother of Child Living with HIV?"
                    value={String(
                      household.is_biological_mother_of_child_living_with_hiv ||
                        "N/A",
                    )}
                  />
                  <InfoItem
                    label="Child Experienced Sexual Violence?"
                    value={String(
                      household.child_ever_experienced_sexual_violence || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Violence in Last 6 Months?"
                    value={String(household.violence_six_months || "N/A")}
                  />
                  <InfoItem
                    label="Children with Violence (6 Months)?"
                    value={String(
                      household.children_violence_six_months || "N/A",
                    )}
                  />
                  <InfoItem
                    label="VCA Gender"
                    value={String(household.vca_gender || "N/A")}
                  />
                  <InfoItem
                    label="Adolescent Birthdate"
                    value={String(household.adolescent_birthdate || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Emergency Contact"
                    value={String(household.emergency_name || "N/A")}
                  />
                  <InfoItem
                    label="School"
                    value={String(household.school || "N/A")}
                  />
                  <InfoItem
                    label="Service"
                    value={String(household.service || "N/A")}
                  />
                  <InfoItem
                    label="Quarter"
                    value={String(household.quarter || "N/A")}
                  />
                  <InfoItem
                    label="Index Check Box"
                    value={String(household.index_check_box || "N/A")}
                  />
                  <InfoItem
                    label="Consent Check Box"
                    value={String(household.consent_check_box || "N/A")}
                  />
                  <InfoItem
                    label="ART Check Box"
                    value={String(household.art_check_box || "N/A")}
                  />
                  <InfoItem
                    label="VL Check Box"
                    value={String(household.vl_check_box || "N/A")}
                  />
                  <InfoItem
                    label="De-Registration Date"
                    value={String(household.de_registration_date || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="De-Registration Reason"
                    value={String(household.de_registration_reason || "N/A")}
                  />
                  <InfoItem
                    label="Exited / Graduation Reason"
                    value={String(household.exited_graduation_reason || "N/A")}
                  />
                  <InfoItem
                    label="Active on Treatment?"
                    value={String(household.active_on_treatment || "N/A")}
                  />
                </InfoCard>

                <div className="grid gap-6 lg:grid-cols-2">
                  <InfoCard title="Location & Facility" icon={MapPin}>
                    <InfoItem
                      label="Province"
                      value={String(household.province || "N/A")}
                    />
                    <InfoItem
                      label="District"
                      value={String(household.district || "N/A")}
                    />
                    <InfoItem
                      label="Ward"
                      value={String(household.ward || "N/A")}
                    />
                    <InfoItem
                      label="Health facility"
                      value={String(household.facility || "N/A")}
                      icon={<HeartPulse className="h-3.5 w-3.5" />}
                    />
                    <InfoItem
                      label="Community entry"
                      value={String(household.entry_type || "N/A")}
                    />
                    <InfoItem
                      label="Partner"
                      value={String(household.partner || "PCZ")}
                    />
                  </InfoCard>

                  <InfoCard title="Caseworker Details" icon={Briefcase}>
                    <InfoItem
                      label="Caseworker Name"
                      value={String(household.caseworker_name || "N/A")}
                      icon={<User className="h-3.5 w-3.5" />}
                    />
                    <InfoItem
                      label="Caseworker Phone"
                      value={String(household.caseworker_phone || "N/A")}
                    />
                    <InfoItem
                      label="Caseworker Username"
                      value={String(household.provider_id || "N/A")}
                    />
                    <InfoItem
                      label="Case Status"
                      value={String(
                        household.case_status || household.status || "Active",
                      )}
                    />
                  </InfoCard>
                </div>
              </TabsContent>

              <TabsContent value="family" className="mt-0">
                <div className="space-y-6">
                  <h2 className="text-lg font-bold text-slate-900">
                    Family Members
                  </h2>
                  <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40 hover:bg-gradient-to-r hover:from-emerald-50/80 hover:via-teal-50/60 hover:to-sky-50/40 border-b border-emerald-100/60">
                          <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 pl-6">
                            Member Details
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4">
                            Birthdate
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4">
                            Gender
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4">
                            Disability
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4">
                            Relationship
                          </TableHead>
                          <TableHead className="text-right pr-6 text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingMembers ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="py-20 text-center"
                            >
                              <LoadingDots />
                            </TableCell>
                          </TableRow>
                        ) : householdMembers.length > 0 ? (
                          householdMembers.map((m: any, idx: number) => (
                            <TableRow
                              key={idx}
                              className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors"
                            >
                              <TableCell className="py-5 pl-6 align-top">
                                <span className="text-sm font-bold bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                  {String(m.uid || m.vca_id || "N/A")}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {formatBirthDate(m.birthdate || "N/A")}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {String(m.vca_gender || m.gender || "N/A")}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {String(m.disability || "None")}
                              </TableCell>
                              <TableCell className="text-sm">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold tracking-wider text-slate-500"
                                >
                                  {normalizeRelationship(
                                    m.relation || m.relationship,
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(`/profile/vca-details`, {
                                      state: {
                                        id: String(
                                          m.uid || m.vca_id || m.unique_id,
                                        ),
                                      },
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700"
                                >
                                  View profile
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="py-20 text-center"
                            >
                              <div className="flex flex-col items-center gap-3">
                                <Users className="h-8 w-8 text-slate-200" />
                                <span className="text-sm text-slate-400 font-medium">
                                  No family members have been registered for
                                  this household.
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-0 space-y-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Caregiver Caseplans
                </h2>
                <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4 pl-6">
                          Case Plan Date
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
                          Date Created
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
                          Date Edited
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4 pr-6 text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingCasePlans ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-20 text-center">
                            <LoadingDots />
                          </TableCell>
                        </TableRow>
                      ) : sortedCasePlans.length > 0 ? (
                        sortedCasePlans.map((plan: any, idx: number) => {
                          const planDate = String(
                            plan.case_plan_date ??
                              plan.date_of_caseplan ??
                              plan.date ??
                              "",
                          );
                          const isExpanded = expandedVulnPlanDate === planDate;
                          const status =
                            plan.case_plan_status ?? plan.status ?? "N/A";
                          return (
                            <Fragment key={idx}>
                              <TableRow className="border-b border-slate-50 group hover:bg-slate-50/30 transition-colors">
                                <TableCell className="py-5 pl-6 font-mono font-bold text-slate-900 text-sm">
                                  {formatServiceDate(planDate)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "border-none font-bold text-[10px] px-2 py-0.5",
                                      String(status).toLowerCase() ===
                                        "active" || status === 1
                                        ? "bg-emerald-50 text-emerald-700"
                                        : String(status).toLowerCase() ===
                                              "closed" || status === 0
                                          ? "bg-slate-100 text-slate-600"
                                          : "bg-sky-50 text-sky-700",
                                    )}
                                  >
                                    {status === 1
                                      ? "Active"
                                      : status === 0
                                        ? "Closed"
                                        : String(status || "N/A")}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-500">
                                  {formatServiceDate(
                                    plan.date_created || plan.created_at,
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-slate-500">
                                  {formatServiceDate(plan.date_edited)}
                                </TableCell>
                                <TableCell className="pr-6 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200 hover:text-ink hover:bg-slate-50"
                                    onClick={() =>
                                      setExpandedVulnPlanDate(
                                        isExpanded ? null : planDate,
                                      )
                                    }
                                  >
                                    {isExpanded
                                      ? "Hide Vulnerabilities"
                                      : "View Vulnerabilities"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow className="bg-slate-50/40 hover:bg-slate-50/40">
                                  <TableCell colSpan={5} className="p-0">
                                    <div className="px-6 py-5 border-b border-slate-100">
                                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                                        Vulnerabilities recorded against the
                                        case plan dated{" "}
                                        {formatServiceDate(planDate)}
                                      </p>
                                      {isLoadingCasePlanDomains ? (
                                        <div className="py-8 text-center">
                                          <LoadingDots />
                                        </div>
                                      ) : expandedVulnerabilities.length ===
                                        0 ? (
                                        <div className="py-8 text-center text-sm text-slate-500">
                                          No vulnerabilities recorded for this
                                          case plan.
                                        </div>
                                      ) : (
                                        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Domain
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Vulnerability
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Goal
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Services
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Service Referred
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Institution
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Due Date
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Status
                                                </TableHead>
                                                <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-3">
                                                  Comment
                                                </TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {expandedVulnerabilities.map(
                                                (v: any, i: number) => (
                                                  <TableRow
                                                    key={i}
                                                    className="border-b border-slate-50"
                                                  >
                                                    <TableCell className="text-xs font-semibold text-slate-700 capitalize">
                                                      {cleanArrayString(
                                                        v.vulnerability_type,
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-700">
                                                      {cleanArrayString(
                                                        v.vulnerability,
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600">
                                                      {cleanArrayString(v.goal)}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600">
                                                      {cleanArrayString(
                                                        v.services,
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600">
                                                      {cleanArrayString(
                                                        v.service_referred,
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600">
                                                      {cleanArrayString(
                                                        v.institution,
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                                                      {formatServiceDate(
                                                        v.due_date,
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600">
                                                      {cleanArrayString(
                                                        v.status,
                                                      )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600">
                                                      {cleanArrayString(
                                                        v.vulnerability_comment,
                                                      )}
                                                    </TableCell>
                                                  </TableRow>
                                                ),
                                              )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <ClipboardCheck className="h-8 w-8 text-slate-200" />
                              <span className="text-sm text-slate-400 font-medium">
                                No case plans have been created for this
                                household yet.
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="services" className="mt-0">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                      Caregiver Services
                    </h2>
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-700"
                    >
                      {householdServices.length} Records
                    </Badge>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                    <HouseholdServicesDetailTable
                      data={householdServices}
                      isLoading={isLoadingServices}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audit" className="mt-0">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                      Household Referrals
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold rounded-xl border-slate-200"
                    >
                      Export
                    </Button>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                    <ScrollArea className="h-[500px]">
                      <ActivityTable
                        data={sortedReferrals}
                        isLoading={isLoadingReferrals}
                        type="referral"
                        emptyMessage="No referral tracking found"
                      />
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="flags" className="mt-0 space-y-6">
                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-6 lg:p-8">
                  <div className="space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 shadow-sm">
                        <Flag size={20} />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-slate-900">
                          Record New Flag
                        </h3>
                      </div>
                    </div>

                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onFlagSubmit)}
                        className="space-y-6"
                      >
                        <div className="grid md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                                  Flag category
                                </FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm font-medium">
                                      <SelectValue placeholder="Choose category...(optional)" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                    <SelectItem value="Missing Data">
                                      Missing data
                                    </SelectItem>
                                    <SelectItem value="Invalid Data">
                                      Invalid data
                                    </SelectItem>
                                    <SelectItem value="Duplicate Record">
                                      Duplicate record
                                    </SelectItem>
                                    <SelectItem value="Incorrect Service">
                                      Incorrect service logging
                                    </SelectItem>
                                    <SelectItem value="Case Plan Mismatch">
                                      Case plan mismatch
                                    </SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="severity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                                  Priority severity
                                </FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm font-medium">
                                      <SelectValue placeholder="Select severity... (optional)" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                    <SelectItem value="Low">
                                      Low severity
                                    </SelectItem>
                                    <SelectItem value="Medium">
                                      Medium severity
                                    </SelectItem>
                                    <SelectItem value="High">
                                      High severity
                                    </SelectItem>
                                    <SelectItem value="Critical">
                                      Critical issue
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="comment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                                Flag observations & action details
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Provide detailed observations about the data quality issue, any suspected causes, and recommended immediate actions..."
                                  className="min-h-[120px] rounded-xl border-slate-200 bg-slate-50/30 resize-none text-sm italic font-medium"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium italic">
                            <AlertCircle size={14} />
                            Submitted flags will be reviewed by district
                            monitors within 24 hours.
                          </div>
                          <Button
                            type="submit"
                            disabled={mutation.isPending}
                            className="w-full sm:w-auto bg-slate-950 hover:bg-slate-800 text-white rounded-xl h-12 px-10 gap-2 font-bold transition-all shadow-lg shadow-slate-200 active:scale-95"
                          >
                            {mutation.isPending ? (
                              <LoadingDots className="h-4" />
                            ) : (
                              <CheckCircle2 size={18} />
                            )}
                            {mutation.isPending
                              ? "Submitting..."
                              : "Submit flag record"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                </div>

                {householdFlags.length > 0 && (
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-6 space-y-3">
                    <p className="text-[10px] font-black tracking-widest text-orange-500 uppercase">
                      Active attention required
                    </p>
                    {householdFlags.map((flag: any) => (
                      <div
                        key={flag.id}
                        className="p-4 rounded-2xl bg-white border border-orange-100 flex items-start justify-between gap-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-orange-50 rounded-xl border border-orange-100 flex-shrink-0">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {toTitleCase(
                                flag.comment || "Suspicious data entry",
                              )}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">
                              Flagged by {flag.verifier} •{" "}
                              {format(
                                new Date(flag.date_created),
                                "MMM d, yyyy",
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleResolve(flag.id)}
                          disabled={resolveMutation.isPending}
                          size="sm"
                          variant="ghost"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] rounded-lg h-8 px-3 transition-all"
                        >
                          Resolve
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                  <div className="p-6 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40">
                    <h3 className="text-lg font-bold text-slate-900">
                      Flagging history
                    </h3>
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-700"
                    >
                      {householdFlags.length} records
                    </Badge>
                  </div>
                  {householdFlags.length > 0 ? (
                    <div className="w-full overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="pl-6 text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
                              Category
                            </TableHead>
                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
                              Date flagged
                            </TableHead>
                            <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
                              Observations
                            </TableHead>
                            <TableHead className="text-right pr-6 text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
                              Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {householdFlags.map((item: any, idx: number) => (
                            <TableRow
                              key={idx}
                              className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors"
                            >
                              <TableCell className="pl-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {String(
                                      item.category ||
                                        item.form_type ||
                                        "General",
                                    )}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[9px] font-black uppercase tracking-tighter",
                                      item.severity === "Critical"
                                        ? "text-red-600"
                                        : "text-slate-400",
                                    )}
                                  >
                                    {item.severity || "Normal"} priority
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-medium text-slate-500">
                                {item.date_created || item.created_at
                                  ? format(
                                      new Date(
                                        item.date_created || item.created_at,
                                      ),
                                      "dd MMM yyyy",
                                    )
                                  : "N/A"}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 max-w-md italic leading-relaxed">
                                {String(
                                  item.comment ||
                                    item.description ||
                                    item.reason ||
                                    "No description provided",
                                )}
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <Badge
                                  variant="outline"
                                  className="text-[9px] font-black text-rose-600 border-rose-100 bg-rose-50 px-2 rounded-md uppercase tracking-tighter"
                                >
                                  Flagged
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Flag className="h-7 w-7" />}
                      title="No flagged records"
                      description="This household has no documented data quality issues."
                    />
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

const cleanArrayString = (str: string | null | undefined) => {
  if (!str) return "N/A";
  try {
    return String(str)
      .replace(/[\[\]"]/g, "")
      .replace(/,/g, ", ");
  } catch (e) {
    return String(str);
  }
};

const HouseholdServicesDetailTable = ({
  data,
  isLoading,
}: {
  data: any[];
  isLoading: boolean;
}) => {
  if (isLoading)
    return (
      <div className="py-20 text-center">
        <LoadingDots />
      </div>
    );
  if (data.length === 0) {
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-50 rounded-[28px]">
        <div className="flex flex-col items-center gap-3">
          <FileText className="h-8 w-8 text-slate-200" />
          <span className="text-sm text-slate-400 font-medium">
            No caregiver services found.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1800px] table-fixed">
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40 hover:bg-gradient-to-r hover:from-emerald-50/80 hover:via-teal-50/60 hover:to-sky-50/40 border-b border-emerald-100/60">
            <TableHead className="w-36 text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Service Date
            </TableHead>
            <TableHead className="w-32 text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              HIV status
            </TableHead>
            <TableHead className="w-32 text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Viral Load
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Health Services
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              HIV Services
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Other Health
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Safe
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Other Safe
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Schooled
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Other Schooled
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Stable
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4">
              Other Stable
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((svc: any, i: number) => (
            <TableRow
              key={
                svc.id ||
                svc.unique_id ||
                `${svc.service_date || svc.visit_date || "service"}-${i}`
              }
              className="border-b border-emerald-50/60 hover:bg-slate-50/30 transition-colors"
            >
              <TableCell className="py-4 font-bold text-slate-900 text-sm border-r border-slate-100">
                {formatServiceDate(
                  svc.service_date || svc.visit_date || svc.date,
                )}
              </TableCell>
              <TableCell className="py-4 text-sm text-slate-700 border-r border-slate-100">
                {svc.is_hiv_positive || "N/A"}
              </TableCell>
              <TableCell className="py-4 text-sm text-slate-700 border-r border-slate-100">
                {svc.vl_last_result || "N/A"}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.health_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.hiv_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.other_health_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.safe_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.other_safe_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.schooled_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.other_schooled_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed border-r border-slate-100">
                {cleanArrayString(svc.stable_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed">
                {cleanArrayString(svc.other_stable_services)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const ActivityTable = ({
  data,
  isLoading,
  type,
  emptyMessage,
}: {
  data: any[];
  isLoading: boolean;
  type: "service" | "case-plan" | "referral";
  emptyMessage: string;
}) => {
  if (isLoading)
    return (
      <div className="py-20 text-center">
        <LoadingDots />
      </div>
    );
  if (data.length === 0)
    return (
      <div className="py-20 text-center border-2 border-dashed border-slate-50 rounded-[28px]">
        <div className="flex flex-col items-center gap-3">
          <FileText className="h-8 w-8 text-slate-200" />
          <span className="text-sm text-slate-400 font-medium">
            {emptyMessage}
          </span>
        </div>
      </div>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
          <TableHead className="pl-6 text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
            Record Name
          </TableHead>
          <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
            Date
          </TableHead>
          <TableHead className="pr-6 text-xs font-bold text-slate-500 uppercase tracking-widest py-4">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, idx) => (
          <TableRow
            key={idx}
            className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors"
          >
            <TableCell className="pl-6 py-4 font-bold text-slate-900 text-sm">
              {String(
                item.service ||
                  item.service_name ||
                  item.form_name ||
                  item.referral ||
                  item.referral_type ||
                  item.referral_name ||
                  "N/A",
              )}
            </TableCell>
            <TableCell className="text-sm text-slate-600">
              {formatServiceDate(
                item.service_date ||
                  item.visit_date ||
                  item.date ||
                  item.referral_date ||
                  item.date_created ||
                  item.created_at,
              )}
            </TableCell>
            <TableCell className="pr-6">
              <Badge
                variant="outline"
                className="text-[10px] font-bold text-emerald-600"
              >
                {String(item.status || item.state || "N/A")}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

/** Set-1-style grouped info section: title + icon header, grid of boxed items. */
const InfoCard = ({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-xl p-6 shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)]",
      className,
    )}
  >
    <div className="flex items-center flex gap-3 mb-5">
      <div className="text-slate-400">
        <Icon size={18} />
      </div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
        {title}
      </h3>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {children}
    </div>
  </div>
);

/** Set-1-style item box: label above, icon + value below. */
const InfoItem = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) => (
  <div className="bg-slate-50/50 border border-slate-100/30 rounded-xl p-3 flex flex-col justify-center min-h-[68px] transition-colors hover:bg-slate-100/50">
    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block px-0.5">
      {label}
    </label>
    <div className="flex items-start gap-2">
      {icon && (
        <div className="text-slate-400 flex-shrink-0 mt-0.5">{icon}</div>
      )}
      <span className="text-xs font-bold text-slate-700 leading-snug break-words whitespace-normal">
        {value || "Not Provided"}
      </span>
    </div>
  </div>
);

export default HouseholdProfile;
