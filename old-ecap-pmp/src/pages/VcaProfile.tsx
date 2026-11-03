import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getChildrenByDistrict,
  getChildrenArchivedRegister,
  DEFAULT_DISTRICT,
  getVcaServicesByDistrict,
  getVcaReferralsById,
  getVcaCasePlansById,
  getVcaCasePlanDomainsById,
  getFlaggedRecords,
  getVcaServicesByChildId,
  createFlaggedRecord,
  updateFlagStatus,
} from "@/lib/api";
import { Fragment, useMemo, useState } from "react";
import moment from "moment";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { notifyUsersOfFlag, notifyUsersOfFlagResolution } from "@/lib/directus";
import { format } from "date-fns";

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
  Baby,
  HeartPulse,
  FileText,
  Activity,
  Link2,
  ShieldCheck,
  Flag,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Archive,
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
import { cn, toTitleCase } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
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

// PBFW removed; the three derived PBFW sub-populations are computed per-VCA
// at render time (see below). Other generic subpop labels remain.
const subPopulationFilterLabels: Record<string, string> = {
  calhiv: "C/ALHIV",
  hei: "HEI",
  cwlhiv: "C/WLHIV",
  agyw: "AGYW",
  csv: "C/SV",
  cfsw: "CFSW",
  abym: "ABYM",
  caahh: "CAAHH",
  caichh: "CAICHH",
  caich: "CAICH",
  calwd: "CALWD",
  caifhh: "CAIFHH",
  muc: "MUC",
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
        parsedDate = new Date(
          parseInt(parts[3]),
          parseInt(parts[2]) - 1,
          parseInt(parts[1]),
        );
      } else if (format === formats[1]) {
        parsedDate = new Date(
          parseInt(parts[1]),
          parseInt(parts[2]) - 1,
          parseInt(parts[3]),
        );
      } else {
        parsedDate = new Date(
          parseInt(parts[3]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
        );
      }
      break;
    }
  }
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

const flagSchema = z.object({
  category: z.string().optional(),
  severity: z.string().optional(),
  comment: z
    .string()
    .min(10, { message: "Observation details must be at least 10 characters" }),
});

const VcaProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Retrieve ID from location state or sessionStorage fallback
  const id = useMemo(() => {
    const stateId = location.state?.id;
    if (stateId) {
      sessionStorage.setItem("ecap_last_vca_id", stateId);
      return stateId;
    }
    return sessionStorage.getItem("ecap_last_vca_id");
  }, [location.state?.id]);

  const { user } = useAuth();
  const isDistrictUser = user?.description === "District User";
  // Admins and Provincial Users have global view access at the profile level
  const district = isDistrictUser ? user?.location || "None" : "";

  const { data: vcas, isLoading: isLoadingActive } = useQuery({
    queryKey: ["vcas", "district", district],
    queryFn: () => getChildrenByDistrict(district),
    enabled: true,
  });

  const { data: archivedVcas, isLoading: isLoadingArchived } = useQuery({
    queryKey: ["vcas", "archived", "district", district],
    queryFn: () => getChildrenArchivedRegister(district),
    enabled: true,
  });

  const { data: vcaServices, isLoading: isLoadingVcaServices } = useQuery({
    queryKey: ["vca-services", "vca", id],
    queryFn: () => getVcaServicesByChildId(id ?? ""),
    enabled: Boolean(id),
  });

  const { data: vcaReferrals = [], isLoading: isLoadingReferrals } = useQuery({
    queryKey: ["vca-referrals", id],
    queryFn: () => getVcaReferralsById(id ?? ""),
    enabled: Boolean(id),
  });

  const { data: vcaCasePlans = [], isLoading: isLoadingCasePlans } = useQuery({
    queryKey: ["vca-caseplans", "vca", id],
    queryFn: () => getVcaCasePlansById(id ?? ""),
    enabled: Boolean(id),
  });

  // Vulnerabilities/domains for this VCA's case plans (ec_vca_case_plan_domain),
  // keyed by the VCA's own unique_id. Fetched lazily when "View
  // Vulnerabilities" is first clicked on a case plan row; the table expands
  // inline under that row (clicking again collapses it).
  const [expandedVulnPlanDate, setExpandedVulnPlanDate] = useState<
    string | null
  >(null);
  const { data: vcaVulnerabilities = [], isLoading: isLoadingVulnerabilities } =
    useQuery({
      queryKey: ["vca-caseplan-domains", id],
      queryFn: () => getVcaCasePlanDomainsById(id ?? ""),
      enabled: Boolean(id) && expandedVulnPlanDate !== null,
    });
  const expandedVulnerabilities = useMemo(() => {
    if (expandedVulnPlanDate === null) return [];
    const matched = vcaVulnerabilities.filter(
      (v: any) => String(v.case_plan_date ?? "") === expandedVulnPlanDate,
    );
    // A case plan whose date doesn't match any domain row (date drift in the
    // source data) still gets the VCA's full domain list rather than a
    // silently empty table.
    return matched.length > 0 ? matched : vcaVulnerabilities;
  }, [vcaVulnerabilities, expandedVulnPlanDate]);

  const { data: allFlags = [], isLoading: isLoadingFlags } = useQuery({
    queryKey: ["flagged-records"],
    queryFn: getFlaggedRecords,
  });

  const vcaFlags = useMemo(() => {
    if (!allFlags || !id) return [];
    return allFlags.filter((f: any) => {
      const vId = id.toLowerCase();
      const matchId =
        String(f.vca_id || f.child_id || "").toLowerCase() === vId;
      return matchId && f.status !== "resolved";
    });
  }, [allFlags, id]);

  const sortedCasePlans = useMemo(() => {
    return [...vcaCasePlans].sort((a: any, b: any) => {
      const dateA = safeParseDate(
        a.case_plan_date || a.date_of_caseplan || a.date,
      );
      const dateB = safeParseDate(
        b.case_plan_date || b.date_of_caseplan || b.date,
      );
      return dateB - dateA;
    });
  }, [vcaCasePlans]);

  const sortedVcaServices = useMemo(() => {
    if (!vcaServices) return [];
    return [...vcaServices].sort((a: any, b: any) => {
      const dateA = safeParseDate(a.service_date || a.visit_date || a.date);
      const dateB = safeParseDate(b.service_date || b.visit_date || b.date);
      return dateB - dateA;
    });
  }, [vcaServices]);

  const vca = useMemo(() => {
    return [...(vcas || []), ...(archivedVcas || [])].find((v: any) => {
      const vId = id?.toLowerCase();
      return (
        String(v.uid || "").toLowerCase() === vId ||
        String(v.unique_id || "").toLowerCase() === vId ||
        String(v.vca_id || "").toLowerCase() === vId ||
        String(v.id || "").toLowerCase() === vId
      );
    });
  }, [vcas, archivedVcas, id]);

  const sortedReferrals = useMemo(() => {
    return [...vcaReferrals].sort((a: any, b: any) => {
      const dateA = safeParseDate(
        a.service_date || a.visit_date || a.date || a.referral_date,
      );
      const dateB = safeParseDate(
        b.service_date || b.visit_date || b.date || b.referral_date,
      );
      return dateB - dateA;
    });
  }, [vcaReferrals]);

  const form = useForm<z.infer<typeof flagSchema>>({
    resolver: zodResolver(flagSchema),
    defaultValues: {
      category: "",
      severity: "",
      comment: "",
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (flagId: string) => {
      await updateFlagStatus(flagId, "resolved");
      const resolver = user
        ? `${user.first_name} ${user.last_name}`
        : "Unknown Resolver";
      const record = vcaFlags.find((f: any) => f.id === flagId);
      if (record) {
        await notifyUsersOfFlagResolution(
          String(record.household_id ?? ""),
          resolver,
          "Resolved from VCA profile.",
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

  const mutation = useMutation({
    mutationFn: createFlaggedRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flagged-records"] });
      const verifier = user
        ? `${user.first_name} ${user.last_name}`
        : "Unknown Verifier";
      notifyUsersOfFlag(
        (vca as any).household_id || "N/A",
        verifier,
        form.getValues("comment") as string,
        id || "N/A",
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

  const onFlagSubmit = (values: z.infer<typeof flagSchema>) => {
    const verifier = user
      ? `${user.first_name} ${user.last_name}`
      : "Unknown Verifier";
    const payload = {
      household_id: vca.household_id || "N/A",
      vca_id: id,
      caseworker_phone: vca.caseworker_phone || "N/A",
      caseworker_name: vca.caseworker_name || vca.cwac_member_name || "N/A",
      caregiver_name: vca.caregiver_name || "N/A",
      facility: vca.facility || vca.health_facility || "N/A",
      comment: values.comment,
      category: values.category,
      severity: values.severity,
      verifier,
      status: "pending",
    };
    mutation.mutate(payload);
  };

  if (isLoadingActive || isLoadingArchived) {
    return (
      <DashboardLayout subtitle="Vca profile">
        <div className="flex h-[50vh] items-center justify-center">
          <LoadingDots />
        </div>
      </DashboardLayout>
    );
  }

  if (!vca) {
    return (
      <DashboardLayout subtitle="Vca not found">
        <EmptyState
          icon={<User className="h-7 w-7" />}
          title="Vca not found"
          description="The VCA record you're looking for doesn't exist or has been moved."
          action={{
            label: "Back to Register",
            onClick: () => navigate("/vcas"),
          }}
          className="h-[50vh]"
        />
      </DashboardLayout>
    );
  }

  const age = calculateAge(vca.birthdate);
  const isArchived = Boolean(vca.de_registration_date || vca.reason);
  const gender = String(vca.vca_gender || vca.gender || "").toLowerCase();

  // Pick the latest service date dynamically from the sorted services list
  const lastServiceDate = formatServiceDate(
    sortedVcaServices[0]?.service_date || vca.last_service_date,
  );

  return (
    <DashboardLayout subtitle={`Vca: ${id}`}>
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        {/* ── Hero (aurora frosted-glass) ──────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
          <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
          <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-teal-300/35 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

          <div className="relative z-10 flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-5 md:flex-row md:items-center min-w-0">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 text-sky-700 ring-1 ring-white/60 shadow-md">
                <User className="h-7 w-7" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                    VCA profile
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
                    {isArchived ? "Deregistered" : "Active"}
                  </Badge>
                  {vca.virally_suppressed === "YES" && (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
                    >
                      <ShieldCheck className="h-3 w-3" /> Suppressed
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="gap-1 border-slate-200 bg-white/70 text-[10px] font-mono text-slate-500"
                  >
                    #{id}
                  </Badge>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                    VCA Name – Confidential
                  </span>
                  <Badge
                    variant="outline"
                    className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm"
                  >
                    <Sparkles className="h-3 w-3" /> Caseplans · Referrals ·
                    Services
                  </Badge>
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-emerald-600" />
                    {String(vca.vca_gender || vca.gender || "N/A")} · {age}{" "}
                    years
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    {String(vca.ward || vca.district || "N/A")}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to register
            </button>
          </div>
        </div>

        <div className="relative rounded-[28px] border border-emerald-100/60 bg-white/85 backdrop-blur-xl p-6 shadow-[0_15px_50px_-30px_rgba(15,118,110,0.45)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-[1px] -z-10 rounded-[28px] bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-transparent opacity-50 blur-md"
          />

          {/* ── Quick stat cards ──────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(() => {
              const hhId =
                vca.household_id ||
                vca.household_code ||
                vca.householdid ||
                vca.hh_id;
              const cards = [
                {
                  icon: Link2,
                  label: "Household ID",
                  value: String(hhId || "N/A"),
                  iconBg: "from-emerald-100 to-teal-100 text-emerald-700",
                  glow: "from-emerald-200/70 via-teal-200/40",
                  onClick: hhId
                    ? () =>
                        navigate(`/profile/household-details`, {
                          state: { id: String(hhId) },
                        })
                    : undefined,
                },
                {
                  icon: HeartPulse,
                  label: "Facility",
                  value: String(vca.facility || "N/A"),
                  iconBg: "from-rose-100 to-pink-100 text-rose-700",
                  glow: "from-rose-200/70 via-pink-200/40",
                  onClick: undefined as undefined | (() => void),
                },
                {
                  icon: ClipboardCheck,
                  label: "Last service date",
                  value: String(lastServiceDate),
                  iconBg: "from-sky-100 to-cyan-100 text-sky-700",
                  glow: "from-sky-200/70 via-cyan-200/40",
                  onClick: undefined as undefined | (() => void),
                },
              ];
              return cards.map((card) => {
                const Icon = card.icon;
                const Wrapper = card.onClick ? "button" : "div";
                return (
                  <Wrapper
                    key={card.label}
                    onClick={card.onClick}
                    className={cn(
                      "group relative text-left",
                      card.onClick && "cursor-pointer",
                    )}
                    type={card.onClick ? "button" : undefined}
                  >
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
                  </Wrapper>
                );
              });
            })()}
          </div>

          {/* ── Tabs ──────────────────────────────────────────────── */}
          <Tabs defaultValue="overview" className="mt-8 sm:mt-10">
            <div className="flex flex-col gap-3 border-b border-emerald-100/60 lg:flex-row lg:items-center lg:justify-between">
              <div className="-mx-2 overflow-x-auto px-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-emerald-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <TabsList className="h-auto bg-transparent p-0 inline-flex gap-3 sm:gap-6 lg:gap-8 whitespace-nowrap">
                  {[
                    { id: "overview", label: "SUMMARY" },
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
                <InfoCard title="VCA Details" icon={Baby}>
                  <InfoItem
                    label="Date of birth"
                    value={formatBirthDate(vca.birthdate)}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Gender"
                    value={String(vca.vca_gender || vca.gender || "N/A")}
                  />
                  <InfoItem
                    label="Age"
                    value={String(vca.age || `${age} Years`)}
                  />
                  <InfoItem
                    label="Age Group"
                    value={String(vca.age_group || "N/A")}
                  />
                </InfoCard>

                <InfoCard title="Other Details" icon={ClipboardList}>
                  <InfoItem
                    label="School"
                    value={String(vca.school_name || vca.school || "N/A")}
                  />
                  <InfoItem
                    label="Caregiver Relationship"
                    value={String(vca.relation || "N/A")}
                  />
                  <InfoItem
                    label="Household ID"
                    value={String(vca.household_id || "N/A")}
                  />
                  <InfoItem
                    label="Province"
                    value={String(vca.province || "N/A")}
                    icon={<MapPin className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="District"
                    value={String(vca.district || "N/A")}
                    icon={<MapPin className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Ward"
                    value={String(vca.ward || "N/A")}
                    icon={<MapPin className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Facility"
                    value={String(vca.facility || "N/A")}
                    icon={<HeartPulse className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Partner"
                    value={String(vca.partner || "N/A")}
                  />
                  <InfoItem
                    label="Case Status"
                    value={String(vca.case_status || "N/A")}
                  />
                  <InfoItem
                    label="Member Type"
                    value={String(vca.member_type || "N/A")}
                  />
                  <InfoItem
                    label="Date Enrolled"
                    value={String(vca.date_enrolled || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Date Referred"
                    value={String(vca.date_referred || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Date Screened"
                    value={String(vca.date_screened || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Last Service Date"
                    value={String(vca.last_service_date || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Screening Location"
                    value={String(vca.screening_location || "N/A")}
                  />
                  <InfoItem
                    label="Caseworker Name"
                    value={String(vca.caseworker_name || "N/A")}
                  />
                  <InfoItem
                    label="Caseworker Phone"
                    value={String(vca.caseworker_phone || "N/A")}
                  />
                  <InfoItem
                    label="HIV Status"
                    value={String(vca.is_hiv_positive || "N/A")}
                    icon={<HeartPulse className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="On HIV Treatment?"
                    value={String(vca.receiving_art || "N/A")}
                  />
                  <InfoItem
                    label="ART Number"
                    value={String(vca.art_number || "N/A")}
                  />
                  <InfoItem
                    label="Date HIV Known"
                    value={String(vca.hiv_test_date || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Date Started ART"
                    value={String(vca.date_started_art || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="MMD Level"
                    value={String(vca.level_mmd || vca.child_mmd || "N/A")}
                  />
                  <InfoItem
                    label="Last VL Date"
                    value={String(vca.date_last_vl || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Next VL Date"
                    value={String(vca.date_next_vl || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="VL Last Result"
                    value={String(vca.vl_last_result || "N/A")}
                  />
                  <InfoItem
                    label="VL Next Result"
                    value={String(vca.vl_next_result || "N/A")}
                  />
                  <InfoItem
                    label="Virally Suppressed?"
                    value={String(
                      vca.vl_suppressed || vca.virally_suppressed || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Child Tested for HIV?"
                    value={String(vca.child_been_tested_for_hiv || "N/A")}
                  />
                  <InfoItem
                    label="Tested Last Year?"
                    value={String(vca.been_tested_last_year || "N/A")}
                  />
                  <InfoItem
                    label="Received Results (Last HIV Test)?"
                    value={String(vca.received_results_last_hiv_test || "N/A")}
                  />
                  <InfoItem
                    label="TB Screening"
                    value={String(vca.tb_screening || "N/A")}
                  />
                  <InfoItem
                    label="Takes TB Preventive Therapy?"
                    value={String(vca.takes_tb_preventive_therapy || "N/A")}
                  />
                  <InfoItem
                    label="Takes Drugs to Prevent Other Diseases?"
                    value={String(
                      vca.takes_drugs_to_prevent_other_diseases || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Received Birth Certificate?"
                    value={String(vca.received_birth_certificate || "N/A")}
                  />
                  <InfoItem
                    label="Pregnant / Breastfeeding?"
                    value={String(vca.is_pregnant_breastfeeding || "N/A")}
                  />
                  <InfoItem
                    label="Under-5 Malnourished?"
                    value={String(vca.under_5_malnourished || "N/A")}
                  />
                  <InfoItem
                    label="Is Biological Child?"
                    value={String(
                      vca.is_biological_child || vca.is_biological || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Is Index Case?"
                    value={String(vca.is_index || "N/A")}
                  />
                  <InfoItem
                    label="Caregiver an FSW?"
                    value={String(
                      vca.is_the_child_caregiver_an_fsw || vca.cfsw || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Mother Currently on Treatment?"
                    value={String(
                      vca.is_mother_currently_on_treatment_wlhiv || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Mother Adhering to Treatment?"
                    value={String(
                      vca.is_mother_adhering_to_treatment_wlhiv || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Mother Virally Suppressed?"
                    value={String(
                      vca.is_mother_virally_suppressed_wlhiv || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Mother ART Number (WLHIV)"
                    value={String(vca.mother_art_number_wlhiv || "N/A")}
                  />
                  <InfoItem
                    label="Child Experienced Sexual Violence?"
                    value={String(
                      vca.child_ever_experienced_sexual_violence || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Survivor of Other Form of Violence?"
                    value={String(
                      vca.survivors_of_other_form_of_violence || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Living with Disability?"
                    value={String(
                      vca.child_adolescent_living_with_disability || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Aged-Headed Household?"
                    value={String(
                      vca.child_adolescent_in_aged_headed_household || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Child-Headed Household?"
                    value={String(
                      vca.child_adolescent_in_child_headed_household || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Chronically-Ill-Headed Household?"
                    value={String(
                      vca.child_adolescent_in_chronically_ill_headed_household ||
                        "N/A",
                    )}
                  />
                  <InfoItem
                    label="Female-Headed Household?"
                    value={String(
                      vca.child_adolescent_in_female_headed_household || "N/A",
                    )}
                  />
                  <InfoItem
                    label="Service"
                    value={String(vca.service || "N/A")}
                  />
                  <InfoItem
                    label="Quarter"
                    value={String(vca.quarter || "N/A")}
                  />
                  <InfoItem
                    label="Updated Status"
                    value={String(vca.updated_status || "N/A")}
                  />
                  <InfoItem
                    label="Date Edited"
                    value={String(vca.date_edited || vca.dateedited || "N/A")}
                    icon={<Calendar className="h-3.5 w-3.5" />}
                  />
                  <InfoItem
                    label="Time on ART"
                    value={String(vca.time_art || "N/A")}
                  />
                  <InfoItem
                    label="Time since Last VL"
                    value={String(vca.time_vl || "N/A")}
                  />
                  <InfoItem
                    label="Time since Last Result"
                    value={String(vca.time_result || "N/A")}
                  />
                </InfoCard>

                {(() => {
                  const isTrue = (v: any) =>
                    v === "1" ||
                    v === "true" ||
                    v === 1 ||
                    v === true ||
                    String(v).toLowerCase() === "yes";
                  const pbfwFlag =
                    isTrue((vca as any).pbfw) || isTrue((vca as any).agyw);
                  const hivPos =
                    isTrue((vca as any).is_hiv_positive) ||
                    isTrue((vca as any).calhiv);
                  const motherPbfw =
                    isTrue(
                      (vca as any)
                        .is_biological_mother_of_child_living_with_hiv,
                    ) ||
                    isTrue((vca as any).mother_pbfw) ||
                    isTrue((vca as any).caregiver_pbfw);

                  const generic = Object.entries(vca)
                    .filter(
                      ([key, value]) =>
                        isTrue(value) && subPopulationFilterLabels[key],
                    )
                    .map(([key]) => subPopulationFilterLabels[key]);

                  const derived: string[] = [];
                  if (pbfwFlag && hivPos) derived.push("HIV+ PBFW");
                  if (pbfwFlag && !hivPos) derived.push("HIV- PBFW");
                  if (motherPbfw) derived.push("Children of PBFW");

                  const all = [...generic, ...derived];
                  if (all.length === 0) return null;

                  return (
                    <InfoCard title="Sub Population Details" icon={ShieldCheck}>
                      {all.map((label) => (
                        <InfoItem key={label} label={label} value="True" />
                      ))}
                    </InfoCard>
                  );
                })()}
              </TabsContent>

              <TabsContent value="history" className="mt-0 space-y-6">
                <h2 className="text-lg font-bold text-slate-900">
                  VCA Caseplans
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
                                  {formatServiceDate(
                                    plan.date_edited || plan.dateedited,
                                  )}
                                </TableCell>
                                <TableCell className="pr-6 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-3 text-xs hover:text-ink font-bold rounded-xl border-slate-200 hover:bg-slate-50"
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
                                      {isLoadingVulnerabilities ? (
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
                              <FileText className="h-8 w-8 text-slate-200" />
                              <span className="text-sm text-slate-400 font-medium">
                                No case plans have been created for this VCA
                                yet.
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
                      VCA Services
                    </h2>
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 text-slate-700"
                    >
                      {sortedVcaServices.length} Records
                    </Badge>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                    <VcaServicesDetailTable
                      data={sortedVcaServices}
                      isLoading={isLoadingVcaServices}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audit" className="mt-0">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">
                      Referrals
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
                        emptyMessage="No referral tracking for this VCA."
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

                {vcaFlags.length > 0 && (
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-6 space-y-3">
                    <p className="text-[10px] font-black tracking-widest text-orange-500 uppercase">
                      Active attention required
                    </p>
                    {vcaFlags.map((flag: any) => (
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
                      {vcaFlags.length} records
                    </Badge>
                  </div>
                  {vcaFlags.length > 0 ? (
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
                          {vcaFlags.map((item: any, idx: number) => (
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
                                {(String(
                                  item.date_created || item.created_at || "N/A",
                                ) &&
                                  format(
                                    new Date(
                                      item.date_created || item.created_at,
                                    ),
                                    "dd MMM yyyy",
                                  )) ||
                                  "N/A"}
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
                      icon={<ClipboardCheck className="h-7 w-7" />}
                      title="No flagged records"
                      description="This child has no documented data quality issues."
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
                  item.referral_type ||
                  "N/A",
              )}
            </TableCell>
            <TableCell className="text-sm text-slate-600">
              {formatServiceDate(
                item.service_date || item.visit_date || item.date,
              )}
            </TableCell>
            <TableCell className="pr-6">
              <Badge variant="outline" className="text-[10px] font-bold">
                {String(item.status || item.state || "N/A")}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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

const VcaServicesDetailTable = ({
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
            No VCA services found.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[1200px] table-fixed">
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-sky-50/40 hover:bg-gradient-to-r hover:from-emerald-50/80 hover:via-teal-50/60 hover:to-sky-50/40 border-b border-emerald-100/60">
            <TableHead className="w-36 text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4 border-r border-emerald-100/60">
              Service Date
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
              School Services
            </TableHead>
            <TableHead className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider py-4">
              Stable
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
                {cleanArrayString(svc.schooled_services)}
              </TableCell>
              <TableCell className="py-4 whitespace-normal text-sm text-slate-700 leading-relaxed">
                {cleanArrayString(svc.stable_services)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
    <div className="flex items-center gap-3 mb-5">
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
    <div className="flex items-center gap-2">
      {icon && <div className="text-slate-400 flex-shrink-0">{icon}</div>}
      <span
        className="text-xs font-bold text-slate-700 leading-tight truncate"
        title={value}
      >
        {value || "Not Provided"}
      </span>
    </div>
  </div>
);

export default VcaProfile;
