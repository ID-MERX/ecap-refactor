import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import {
  Activity, Sparkles, UserPlus, ArrowLeft,
  AtSign, User as UserIcon, Shield, Globe, MapPin, Building2,
  KeyRound, Eye, EyeOff, Wand2, Check, AlertCircle,
  Command, Send, LifeBuoy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LoadingDots from "@/components/aceternity/LoadingDots";
import MultiFacilityPicker, { parseFacilitiesCsv } from "@/components/MultiFacilityPicker";
import { createUser, getUserByEmail, listRoles, requestPasswordReset, updateUser, type DirectusRole } from "@/lib/directus";
import { getHouseholdsByDistrict, getFacilityList } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn, normalizePlaceName } from "@/lib/utils";

type RoleLevel = "administrator" | "province" | "district" | "facility" | "support";
type ActivationMode = "invite";

const ROLE_LABEL: Record<RoleLevel, string> = {
  administrator: "Administrator",
  province: "Provincial User",
  district: "District User",
  facility: "Facility User",
  support: "Support User",
};

type UserFormState = {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  province: string;
  district: string;
  facility: string;
};

const emptyForm: UserFormState = {
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  confirm_password: "",
  province: "",
  district: "",
  facility: "",
};

type CreateUserProfilePayload = {
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  description: string;
  title: string;
  location: string;
  facility?: string;
};

const ROLE_CARDS: Array<{
  id: RoleLevel;
  label: string;
  scope: string;
  description: string;
  icon: typeof Shield;
  iconBg: string;
  glow: string;
  ringActive: string;
}> = [
  {
    id: "administrator",
    label: "Administrator",
    scope: "All regions · Global",
    description: "Full access to every district, user, and report.",
    icon: Shield,
    iconBg: "from-emerald-100 to-teal-100 text-emerald-700",
    glow: "from-emerald-200/70 via-teal-200/40",
    ringActive: "ring-emerald-300 border-emerald-300 bg-emerald-50/40",
  },
  {
    id: "province",
    label: "Provincial User",
    scope: "Single province",
    description: "Access to all districts within one province.",
    icon: Globe,
    iconBg: "from-sky-100 to-cyan-100 text-sky-700",
    glow: "from-sky-200/70 via-cyan-200/40",
    ringActive: "ring-sky-300 border-sky-300 bg-sky-50/40",
  },
  {
    id: "district",
    label: "District User",
    scope: "Single district",
    description: "Access limited to one district's data.",
    icon: MapPin,
    iconBg: "from-violet-100 to-fuchsia-100 text-violet-700",
    glow: "from-violet-200/70 via-fuchsia-200/40",
    ringActive: "ring-violet-300 border-violet-300 bg-violet-50/40",
  },
  {
    id: "facility",
    label: "Facility User",
    scope: "One or more facilities",
    description: "Access scoped to the facilities they're attached to.",
    icon: Building2,
    iconBg: "from-amber-100 to-orange-100 text-amber-700",
    glow: "from-amber-200/70 via-orange-200/40",
    ringActive: "ring-amber-300 border-amber-300 bg-amber-50/40",
  },
  {
    id: "support",
    label: "Support User",
    scope: "Help desk · Global",
    description: "Read-only support staff for chat and tickets.",
    icon: LifeBuoy,
    iconBg: "from-rose-100 to-pink-100 text-rose-700",
    glow: "from-rose-200/70 via-pink-200/40",
    ringActive: "ring-rose-300 border-rose-300 bg-rose-50/40",
  },
];

const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

type PwStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; barCls: string; textCls: string };
const scorePassword = (pw: string): PwStrength => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 14) score++;
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const meta: Record<number, Omit<PwStrength, "score">> = {
    0: { label: "Too weak", barCls: "bg-rose-500 w-[10%]", textCls: "text-rose-600" },
    1: { label: "Weak", barCls: "bg-rose-400 w-1/4", textCls: "text-rose-600" },
    2: { label: "Fair", barCls: "bg-amber-400 w-2/4", textCls: "text-amber-700" },
    3: { label: "Strong", barCls: "bg-emerald-500 w-3/4", textCls: "text-emerald-700" },
    4: { label: "Very strong", barCls: "bg-emerald-600 w-full", textCls: "text-emerald-700" },
  };
  return { score: clamped, ...meta[clamped] };
};

const generatePassword = () => {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lower + upper + digits + symbols;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = rand(upper) + rand(lower) + rand(digits) + rand(symbols);
  for (let i = 0; i < 10; i++) pw += rand(all);
  return pw.split("").sort(() => Math.random() - 0.5).join("");
};

const AddUser = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formState, setFormState] = useState<UserFormState>(emptyForm);
  const [selectedLevel, setSelectedLevel] = useState<RoleLevel | "">("");
  const [activationMode] = useState<ActivationMode>("invite");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Discovery for provinces + districts
  const householdsListQuery = useQuery({
    queryKey: ["districts-discovery", "All"],
    queryFn: () => getHouseholdsByDistrict(""),
    staleTime: 1000 * 60 * 60,
  });

  // Drop lowercase typo duplicates (e.g. "central", "mkushi", "kapiri mposhi")
  // — canonical Zambian names are Title Case. If the first letter isn't
  // uppercase, treat the value as a data-entry mistake and skip it.
  const isCanonicalName = (s: string | undefined | null) => {
    if (!s) return false;
    const trimmed = s.trim();
    if (!trimmed) return false;
    return /^[A-Z]/.test(trimmed);
  };

  const { provinces, districtsByProvince } = useMemo(() => {
    const mapping = new Map<string, Set<string>>();
    if (householdsListQuery.data) {
      householdsListQuery.data.forEach((h: any) => {
        const prov = h.province;
        const dist = h.district;
        if (!isCanonicalName(prov)) return;
        if (!mapping.has(prov)) mapping.set(prov, new Set());
        if (isCanonicalName(dist)) mapping.get(prov)?.add(dist);
      });
    }
    const sortedProvinces = Array.from(mapping.keys()).sort();
    const sortedMapping: Record<string, string[]> = {};
    sortedProvinces.forEach((p) => {
      sortedMapping[p] = Array.from(mapping.get(p)!).sort();
    });
    return { provinces: sortedProvinces, districtsByProvince: sortedMapping };
  }, [householdsListQuery.data]);

  const availableDistricts = useMemo(() => {
    if (!formState.province) return [];
    return districtsByProvince[formState.province] || [];
  }, [formState.province, districtsByProvince]);

  const wardsByDistrict = useMemo(() => {
    const mapping = new Map<string, Set<string>>();
    if (householdsListQuery.data) {
      householdsListQuery.data.forEach((h: any) => {
        const dist = normalizePlaceName(h.district);
        const ward = normalizePlaceName(h.ward);
        if (dist && ward) {
          if (!mapping.has(dist)) mapping.set(dist, new Set());
          mapping.get(dist)?.add(ward);
        }
      });
    }
    return mapping;
  }, [householdsListQuery.data]);

  const rolesQuery = useQuery({
    queryKey: ["directus", "roles"],
    queryFn: listRoles,
  });

  const wardsQuery = useQuery<string[]>({
    queryKey: ["etl", "ward-list"],
    queryFn: getFacilityList,
    enabled: selectedLevel === "facility",
    staleTime: 10 * 60 * 1000,
  });

  const availableWards = useMemo(() => {
    if (!formState.district) return [];
    const districtWards = wardsByDistrict.get(formState.district);
    if (!districtWards || districtWards.size === 0) return [];
    const lc = new Set([...districtWards].map((s) => s.toLowerCase()));
    return (wardsQuery.data ?? [])
      .filter((w) => lc.has(w.toLowerCase()))
      .map((w) => normalizePlaceName(w));
  }, [formState.district, wardsByDistrict, wardsQuery.data]);

  // Auto-detect ECAP+ role IDs
  const [ecapUserRoleId, setEcapUserRoleId] = useState<string>("");
  const [ecapSupportRoleId, setEcapSupportRoleId] = useState<string>("");

  useEffect(() => {
    if (rolesQuery.data) {
      const ecapRole = rolesQuery.data.find(
        (r: DirectusRole) =>
          r.name.toLowerCase().includes("ecap+") &&
          !r.name.toLowerCase().includes("support")
      );
      const supportRole = rolesQuery.data.find(
        (r: DirectusRole) =>
          r.name.toLowerCase().includes("ecap+") &&
          r.name.toLowerCase().includes("support")
      );
      if (ecapRole) setEcapUserRoleId(ecapRole.id);
      if (supportRole) setEcapSupportRoleId(supportRole.id);
    }
  }, [rolesQuery.data]);

  const emailValid = formState.email.length === 0 ? null : isValidEmail(formState.email);
  const pwStrength = scorePassword(formState.password);
  const pwMatch = formState.confirm_password.length > 0 ? formState.password === formState.confirm_password : null;

  const fullName = `${formState.first_name} ${formState.last_name}`.trim();
  const initials = ((formState.first_name[0] || "") + (formState.last_name[0] || "")).toUpperCase();
  const selectedRoleCard = ROLE_CARDS.find((r) => r.id === selectedLevel);

  const scopeLabel = useMemo(() => {
    if (selectedLevel === "administrator") return "All regions";
    if (selectedLevel === "support") return "Help desk · Global";
    if (selectedLevel === "province" && formState.province) return formState.province;
    if (selectedLevel === "district" && formState.district) return `${formState.district}, ${formState.province}`;
    if (selectedLevel === "facility" && formState.facility) {
      const list = parseFacilitiesCsv(formState.facility);
      const label = list.length > 1 ? `${list.length} facilities` : list[0] ?? "";
      return label ? `${label} · ${formState.district}` : "Not configured";
    }
    return "Not configured";
  }, [selectedLevel, formState.province, formState.district, formState.facility]);

  const createMutation = useMutation({
    mutationFn: async ({
      mode,
      profilePayload,
      resetUrl,
    }: {
      mode: ActivationMode;
      profilePayload: CreateUserProfilePayload;
      resetUrl: string;
    }) => {
      const existingUser = await getUserByEmail(profilePayload.email);
      const payload = {
        ...profilePayload,
        status: "active",
        password_change_required: false,
      };

      if (existingUser?.id) {
        await updateUser(existingUser.id, payload);
      } else {
        await createUser(payload);
      }

      if (mode === "invite") {
        await requestPasswordReset(profilePayload.email, resetUrl);
      }

      return { mode, existed: Boolean(existingUser?.id) };
    },
    onSuccess: ({ mode, existed }) => {
      queryClient.invalidateQueries({ queryKey: ["directus", "users"] });
      toast.success(
        mode === "invite"
          ? "Setup email sent"
          : existed
            ? "Existing user updated"
            : "User created successfully",
        {
          description:
            mode === "invite"
              ? "The user can set a password from the email link."
              : "The user must change the temporary password at first login.",
        },
      );
      navigate("/users");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create user");
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.email.trim() || !selectedLevel) {
      toast.error("Email and role type are required");
      return;
    }

    if (!isValidEmail(formState.email)) {
      toast.error("Enter a valid email address");
      return;
    }

    const roles = rolesQuery.data ?? [];
    let finalRoleId = ecapUserRoleId;
    let description = ROLE_LABEL[selectedLevel];
    let title = "All";
    let location = "All";
    let facility: string | undefined;

    if (selectedLevel === "support") {
      description = "ECAP+ Support";
      finalRoleId = ecapSupportRoleId || ecapUserRoleId;
    }

    if (!finalRoleId) {
      toast.error("Could not find a matching role in Directus.");
      return;
    }

    if (selectedLevel === "province") {
      if (!formState.province) return toast.error("Please select a Province");
      title = formState.province;
      location = "All";
    } else if (selectedLevel === "district") {
      if (!formState.province) return toast.error("Please select a Province");
      if (!formState.district) return toast.error("Please select a District");
      title = formState.province;
      location = formState.district;
    } else if (selectedLevel === "facility") {
      if (!formState.province) return toast.error("Please select a Province");
      if (!formState.district) return toast.error("Please select a District");
      if (parseFacilitiesCsv(formState.facility).length === 0) return toast.error("Please select at least one facility");
      title = formState.province;
      location = formState.district;
      facility = formState.facility;
    }

    const profilePayload = {
      email: formState.email.trim(),
      first_name: formState.first_name.trim() || undefined,
      last_name: formState.last_name.trim() || undefined,
      role: finalRoleId,
      description,
      title,
      location,
      facility: facility || undefined,
    };

    const baseUrl = import.meta.env.VITE_RESET_PASSWORD_URL || window.location.origin;
    createMutation.mutate({
      mode: activationMode,
      profilePayload,
      resetUrl: `${baseUrl}/reset-password`,
    });
  };

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout subtitle="Add User">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">User management</span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                <Activity className="h-3 w-3" /> New user
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                Add a new Directus account
              </span>
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                <Sparkles className="h-3 w-3" /> Roles · Districts · Facilities
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">Create a secure login and assign the correct access level for program reporting.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => navigate("/users")}
              className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Users
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 max-w-6xl">
        {/* ── Form column ───────────────────────────────────────── */}
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md" />
          <GlowCard>
            <form onSubmit={onSubmit} className="space-y-8 p-8">
              <div className="flex items-center justify-between border-b border-emerald-50/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Create New Account</h2>
                    <p className="text-[11px] text-slate-500">Three quick sections — personal, access, login</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" className="text-slate-500 hover:text-rose-600 hover:bg-rose-50/60" onClick={() => navigate("/users")}>
                  Cancel
                </Button>
              </div>

              {/* ── 1 · Personal Information ─────────────────────────── */}
              <section className="space-y-4">
                <header className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-sm shadow-emerald-700/20">1</span>
                  <h3 className="text-sm font-bold text-slate-900">Personal information</h3>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Identity</span>
                </header>

                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                    <AtSign className="h-3 w-3 text-slate-400" />
                    Email address
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="email@example.com"
                      type="email"
                      value={formState.email}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, email: event.target.value }))
                      }
                      className={cn(
                        "h-10 pr-9 bg-white/80 backdrop-blur-md focus-visible:ring-emerald-500/30",
                        emailValid === true && "border-emerald-300 focus-visible:ring-emerald-500/40",
                        emailValid === false && "border-rose-300 focus-visible:ring-rose-500/40"
                      )}
                      required
                    />
                    {emailValid === true && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                    )}
                    {emailValid === false && (
                      <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-500" />
                    )}
                  </div>
                  <p className={cn(
                    "text-[10px]",
                    emailValid === false ? "text-rose-600" : "text-slate-400"
                  )}>
                    {emailValid === false ? "Doesn't look like a valid email yet." : "Used for login. Must be unique across all users."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <UserIcon className="h-3 w-3 text-slate-400" />
                      First name
                    </label>
                    <Input
                      placeholder="Jane"
                      value={formState.first_name}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, first_name: event.target.value }))
                      }
                      className="h-10 bg-white/80 backdrop-blur-md focus-visible:ring-emerald-500/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <UserIcon className="h-3 w-3 text-slate-400" />
                      Last name
                    </label>
                    <Input
                      placeholder="Banda"
                      value={formState.last_name}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, last_name: event.target.value }))
                      }
                      className="h-10 bg-white/80 backdrop-blur-md focus-visible:ring-emerald-500/30"
                    />
                  </div>
                </div>
              </section>

              {/* ── 2 · Access Level ─────────────────────────────────── */}
              <section className="space-y-4">
                <header className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-sm shadow-emerald-700/20">2</span>
                  <h3 className="text-sm font-bold text-slate-900">Access level</h3>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Scope &amp; permissions</span>
                  <span className="text-rose-500 ml-auto text-[11px] font-semibold">Required</span>
                </header>

                <div className="grid gap-3 sm:grid-cols-2">
                  {ROLE_CARDS.map((role) => {
                    const Icon = role.icon;
                    const active = selectedLevel === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setSelectedLevel(role.id);
                          if (role.id === "administrator" || role.id === "support") {
                            setFormState((prev) => ({ ...prev, province: "", district: "", facility: "" }));
                          } else {
                            setFormState((prev) => ({ ...prev, facility: role.id === "facility" ? prev.facility : "" }));
                          }
                        }}
                        className={cn(
                          "group relative text-left rounded-xl border p-4 transition-all duration-200 backdrop-blur-md",
                          active
                            ? `${role.ringActive} ring-2 shadow-md`
                            : "border-slate-200 bg-white/70 hover:border-emerald-200 hover:bg-white hover:-translate-y-0.5 hover:shadow-sm"
                        )}
                      >
                        <div className={cn("absolute -inset-[1px] -z-10 rounded-xl bg-gradient-to-br to-transparent blur-md transition-opacity duration-500", role.glow, active ? "opacity-60" : "opacity-0 group-hover:opacity-40")} />
                        <div className="flex items-start justify-between">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${role.iconBg} ring-1 ring-white/60 shadow-sm`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          {active && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <div className="mt-3 text-sm font-bold text-slate-900">{role.label}</div>
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{role.scope}</div>
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{role.description}</p>
                      </button>
                    );
                  })}
                </div>

                {selectedLevel && selectedLevel !== "administrator" && selectedLevel !== "support" && (
                  <div className="rounded-xl border border-emerald-100/60 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-transparent p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Configure scope</span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                          <Globe className="h-3 w-3 text-slate-400" />
                          Province
                          <span className="text-rose-500">*</span>
                        </label>
                        <Select
                          value={formState.province}
                          onValueChange={(value) =>
                            setFormState((prev) => ({ ...prev, province: value, district: "" }))
                          }
                          disabled={householdsListQuery.isLoading}
                        >
                          <SelectTrigger className="h-10 bg-white/80 backdrop-blur-md border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-300 text-left">
                            <div className="flex items-center gap-2 min-w-0">
                              <Globe className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <SelectValue placeholder={householdsListQuery.isLoading ? "Loading…" : "Select province"} />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-emerald-100/60 backdrop-blur-xl">
                            {provinces.map((p) => (
                              <SelectItem key={p} value={p} className="text-xs font-medium focus:bg-emerald-50/60 focus:text-emerald-700">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {(selectedLevel === "district" || selectedLevel === "facility") && (
                        <div className="space-y-2">
                          <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            District
                            <span className="text-rose-500">*</span>
                          </label>
                          <Select
                            value={formState.district}
                            onValueChange={(value) => setFormState((prev) => ({ ...prev, district: value, facility: "" }))}
                            disabled={householdsListQuery.isLoading || !formState.province}
                          >
                            <SelectTrigger className="h-10 bg-white/80 backdrop-blur-md border-slate-200 focus:ring-emerald-500/30 focus:border-emerald-300 text-left">
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <SelectValue placeholder={
                                  householdsListQuery.isLoading ? "Loading…"
                                    : !formState.province ? "Pick a province first"
                                      : "Select district"
                                } />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-emerald-100/60 backdrop-blur-xl">
                              {availableDistricts.length === 0 ? (
                                <SelectItem value="no-districts" disabled className="text-xs italic text-slate-400">No districts found</SelectItem>
                              ) : (
                                availableDistricts.map((d) => (
                                  <SelectItem key={d} value={d} className="text-xs font-medium focus:bg-emerald-50/60 focus:text-emerald-700">{d}</SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedLevel === "facility" && (
                        <div className="space-y-2 sm:col-span-2">
                          <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            Ward
                            <span className="text-rose-500">*</span>
                            <span className="ml-2 text-[10px] font-normal text-slate-400">User will only see data from the wards below</span>
                          </label>
                          <MultiFacilityPicker
                            options={availableWards}
                            value={formState.facility}
                            onChange={(csv) => setFormState((prev) => ({ ...prev, facility: csv }))}
                            loading={wardsQuery.isLoading}
                            placeholder={!formState.district ? "Select a district first" : "Select one or more wards"}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* ── 3 · Account Activation ──────────────────────────── */}
              <section className="space-y-4">
                <header className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-sm shadow-emerald-700/20">3</span>
                  <h3 className="text-sm font-bold text-slate-900">Account activation</h3>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Invite or temporary password</span>
                </header>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {}}
                    className="rounded-xl border border-emerald-300 bg-emerald-50/60 ring-2 ring-emerald-200 p-4 text-left transition-all"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Send className="h-4 w-4 text-emerald-600" />
                      Send setup email
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                      The user receives an ECAP+ password setup link before first sign-in.
                    </span>
                  </button>
                </div>

                <div className="rounded-lg border border-emerald-100/60 bg-gradient-to-r from-emerald-50/70 via-teal-50/30 to-transparent p-3">
                  <div className="flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      The email link opens the ECAP+ password setup screen. No password is shared by the administrator.
                    </p>
                  </div>
                </div>
              </section>

              {/* ── Submit ──────────────────────────────────────────── */}
              <div className="border-t border-emerald-50/60 pt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                  <Command className="h-3 w-3" /> + Enter to save
                </span>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="group inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-700/20 transition-all hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 disabled:cursor-not-allowed sm:w-auto w-full"
                  >
                    {createMutation.isPending ? (
                      <>Sending setup email <LoadingDots /></>
                    ) : (
                      <>
                        <Send className="h-4 w-4" strokeWidth={2.5} />
                        Send setup email
                      </>
                    )}
                  </button>
              </div>

              {rolesQuery.isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <LoadingDots className="text-slate-400" />
                </div>
              )}
            </form>
          </GlowCard>
        </div>

        {/* ── Live preview column (sticky on md+) ───────────────── */}
        <aside className="md:sticky md:top-6 self-start h-fit">
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md" />
            <div className="relative rounded-2xl border border-emerald-100/60 bg-white/75 backdrop-blur-xl p-5 shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Live preview</h3>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl text-sm font-extrabold shadow-sm ring-1",
                  initials
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-emerald-200/60"
                    : "bg-slate-100 text-slate-400 ring-slate-200"
                )}>
                  {initials || <UserIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">
                    {fullName || <span className="text-slate-400 font-normal">Full name</span>}
                  </div>
                  <div className="truncate text-[11px] text-slate-500">
                    {formState.email || "email@example.com"}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Role</span>
                  {selectedRoleCard ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800">
                      <selectedRoleCard.icon className="h-3 w-3 text-emerald-600" />
                      {selectedRoleCard.label}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Not selected</span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Scope</span>
                  <span className={cn("text-[11px] font-medium", scopeLabel === "Not configured" ? "text-slate-400" : "text-slate-700")}>
                    {scopeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</span>
                  {emailValid === null ? (
                    <span className="text-[11px] text-slate-400">—</span>
                  ) : emailValid ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <Check className="h-3 w-3" /> Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                      <AlertCircle className="h-3 w-3" /> Invalid
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-white/60 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Activation</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <Send className="h-3 w-3" /> Setup email
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-emerald-100/60 bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-transparent p-3">
                <div className="flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    ECAP+ sends the setup email. No password is shared by the administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
};

export default AddUser;
