import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Activity, Sparkles, UserCog, ArrowLeft } from "lucide-react";
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
import {
  deleteUser,
  getUser,
  listRoles,
  updateUser,
  type DirectusRole,
} from "@/lib/directus";
import { getHouseholdsByDistrict, getFacilityList } from "@/lib/api";
import MultiFacilityPicker, { parseFacilitiesCsv } from "@/components/MultiFacilityPicker";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import { normalizePlaceName } from "@/lib/utils";

type UserFormState = {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  password: string;
  custom_role: string;
  province: string;
  district: string;
  facility: string;
};

const EditUser = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const [formState, setFormState] = useState<UserFormState>({
    email: "",
    first_name: "",
    last_name: "",
    role: "",
    password: "",
    custom_role: "",
    province: "",
    district: "",
    facility: "",
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // --- Discovery Logic for Provinces and Districts ---
  const householdsListQuery = useQuery({
    queryKey: ["districts-discovery", "All"],
    queryFn: () => getHouseholdsByDistrict(""),
    staleTime: 1000 * 60 * 60,
  });

  // Drop lowercase typo duplicates (e.g. "central", "mkushi", "kapiri mposhi")
  // — canonical Zambian names are Title Case.
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
        if (!mapping.has(prov)) {
          mapping.set(prov, new Set());
        }
        if (isCanonicalName(dist)) {
          mapping.get(prov)?.add(dist);
        }
      });
    }

    const sortedProvinces = Array.from(mapping.keys()).sort();
    const sortedMapping: Record<string, string[]> = {};

    sortedProvinces.forEach(p => {
      sortedMapping[p] = Array.from(mapping.get(p)!).sort();
    });

    return {
      provinces: sortedProvinces,
      districtsByProvince: sortedMapping,
    };
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
    enabled: formState.custom_role === "Facility User",
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

  // Identify ECAP+ User and Support role IDs
  const [ecapUserRoleId, setEcapUserRoleId] = useState<string>("");
  const [ecapSupportRoleId, setEcapSupportRoleId] = useState<string>("");

  useEffect(() => {
    if (rolesQuery.data) {
      const ecapRole = rolesQuery.data.find(
        (r: DirectusRole) => r.name.toLowerCase().includes("ecap+") && !r.name.toLowerCase().includes("support")
      );
      const supportRole = rolesQuery.data.find(
        (r: DirectusRole) => r.name.toLowerCase().includes("ecap+") && r.name.toLowerCase().includes("support")
      );

      if (ecapRole) setEcapUserRoleId(ecapRole.id);
      if (supportRole) setEcapSupportRoleId(supportRole.id);
    }
  }, [rolesQuery.data]);

  const userQuery = useQuery({
    queryKey: ["directus", "user", id],
    queryFn: () => getUser(id ?? ""),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (userQuery.data) {
      const data = userQuery.data;
      const roleId = typeof data.role === "string" ? data.role : data.role?.id ?? "";

      // Determine the best initial role/province/district from loaded data
      let pseudoRole = data.description || "";

      // Map "ECAP+ Support" description to "Support User" pseudo-role
      if (pseudoRole === "ECAP+ Support") {
        pseudoRole = "Support User";
      }

      let prov = data.title || "";
      if (prov === "All") prov = "";

      let dist = data.location || "";
      if (dist === "All") dist = "";

      const storedFacility = (data as unknown as { facility?: string }).facility ?? "";
      // Infer facility-user pseudo-role when a facility value is stored
      if (storedFacility && pseudoRole !== "Administrator" && pseudoRole !== "Support User") {
        pseudoRole = "Facility User";
      }

      setFormState({
        email: data.email ?? "",
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        role: roleId,
        password: "",
        custom_role: pseudoRole,
        province: prov,
        district: dist,
        facility: storedFacility,
      });
    }
  }, [userQuery.data]);

  const rolesById = useMemo(() => {
    const entries: [string, string][] = (rolesQuery.data ?? []).map((role: DirectusRole) => [
      role.id,
      role.name,
    ]);
    return new Map<string, string>(entries);
  }, [rolesQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<UserFormState> & { description?: string, title?: string, location?: string }) => updateUser(id ?? "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directus", "users"] });
      queryClient.invalidateQueries({ queryKey: ["directus", "user", id] });
      toast.success("User updated successfully");
      navigate("/users");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    },
  });

  const trashMutation = useMutation({
    mutationFn: () => updateUser(id ?? "", { status: "suspended" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directus", "users"] });
      toast.success("User moved to trash");
      navigate("/users");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to move user to trash");
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.email.trim()) {
      return;
    }

    // Determine title (Province) and location (District) based on Custom Role
    let title = "All";
    let location = "All";
    let description = formState.custom_role;
    let finalRoleId = ecapUserRoleId || formState.role; // Default to ECAP+ User or current
    let facility: string = "";

    if (formState.custom_role === "Provincial User") {
      title = formState.province || "All";
      location = "All";
    } else if (formState.custom_role === "District User") {
      title = formState.province || "All";
      location = formState.district || "All";
    } else if (formState.custom_role === "Facility User") {
      if (!formState.province) { toast.error("Please select a Province"); return; }
      if (!formState.district) { toast.error("Please select a District"); return; }
      if (parseFacilitiesCsv(formState.facility).length === 0) { toast.error("Please select at least one facility"); return; }
      title = formState.province;
      location = formState.district;
      facility = formState.facility;
    } else if (formState.custom_role === "Support User") {
      title = "All";
      location = "All";
      description = "ECAP+ Support";
      finalRoleId = ecapSupportRoleId || formState.role;
    }

    const payload: any = {
      email: formState.email.trim(),
      first_name: formState.first_name.trim() || undefined,
      last_name: formState.last_name.trim() || undefined,
      role: finalRoleId || undefined,
      description: description || undefined,
      title: title,
      location: location,
      facility: facility,
    };

    if (formState.password.trim()) {
      payload.password = formState.password.trim();
    }

    updateMutation.mutate(payload);
  };

  const roleLabel = formState.custom_role || "Unassigned Role";

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout subtitle="Edit User">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(245,158,11,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-amber-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">User management</span>
              <span className="text-slate-400 text-[11px]">·</span>
              <span className="text-[11px] text-slate-600">{dateStr}</span>
              <Badge variant="outline" className="ml-1 gap-1 border-amber-200 bg-amber-50/80 text-[10px] text-amber-700">
                <Activity className="h-3 w-3" /> {roleLabel}
              </Badge>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-amber-700 bg-clip-text text-transparent">
                Edit Directus account
              </span>
              <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                <Sparkles className="h-3 w-3" /> Profile · Access · Credentials
              </Badge>
            </h1>
            <p className="mt-1 text-xs text-slate-600">Update profile details, adjust access, and manage credentials.</p>
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

      <div className="relative max-w-2xl">
        <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-amber-200/20 opacity-50 blur-md" />
        <GlowCard>
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <div className="flex items-center justify-between border-b border-emerald-50/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Account</h2>
                <p className="text-[11px] text-slate-500">Update details and access scope</p>
              </div>
            </div>
          </div>
          {userQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              Loading user <LoadingDots className="text-slate-400" />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              placeholder="Email"
              type="email"
              value={formState.email}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, email: event.target.value }))
              }
              required
              className="sm:col-span-2"
            />
            <Input
              placeholder="First name"
              value={formState.first_name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, first_name: event.target.value }))
              }
            />
            <Input
              placeholder="Last name"
              value={formState.last_name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, last_name: event.target.value }))
              }
            />
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <Select
                value={formState.custom_role}
                onValueChange={(value) => {
                  setFormState((prev) => ({
                    ...prev,
                    custom_role: value,
                    // Reset subordinate fields on role change
                    province: (value === "Administrator" || value === "Support User") ? "" : prev.province,
                    district: (value === "Administrator" || value === "Provincial User" || value === "Support User") ? "" : prev.district,
                    facility: value === "Facility User" ? prev.facility : "",
                  }));
                }}
              >
                <SelectTrigger className="h-10 border-slate-200 bg-white/90 text-sm text-slate-700">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrator">Administrator</SelectItem>
                  <SelectItem value="Provincial User">Provincial User</SelectItem>
                  <SelectItem value="District User">District User</SelectItem>
                  <SelectItem value="Facility User">Facility Level User</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Province Selector */}
            {(formState.custom_role === "Provincial User" || formState.custom_role === "District User" || formState.custom_role === "Facility User") && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">Province</label>
                <Select
                  value={formState.province}
                  onValueChange={(value) => setFormState((prev) => ({
                    ...prev,
                    province: value,
                    district: "" // Reset district when province changes
                  }))}
                  disabled={householdsListQuery.isLoading}
                >
                  <SelectTrigger className="h-10 border-slate-200 bg-white/90 text-sm text-slate-700">
                    <SelectValue placeholder={householdsListQuery.isLoading ? "Loading" : "Select province"} />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((prov) => (
                      <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* District Selector */}
            {(formState.custom_role === "District User" || formState.custom_role === "Facility User") && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">District</label>
                <Select
                  value={formState.district}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, district: value, facility: "" }))}
                  disabled={householdsListQuery.isLoading || !formState.province}
                >
                  <SelectTrigger className="h-10 border-slate-200 bg-white/90 text-sm text-slate-700">
                    <SelectValue placeholder={
                      householdsListQuery.isLoading ? "Loading" :
                        !formState.province ? "Select a province first" : "Select district"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDistricts.length === 0 ? (
                      <SelectItem value="no-districts" disabled>No districts found</SelectItem>
                    ) : (
                      availableDistricts.map((dist) => (
                        <SelectItem key={dist} value={dist}>{dist}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Ward Selector — multi */}
            {formState.custom_role === "Facility User" && (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  Ward <span className="ml-2 text-[10px] font-normal text-slate-400">User will only see data from the wards below</span>
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

            {/* Status management is handled via list actions (suspend/restore) */}

            <Input
              placeholder="New password (optional)"
              type="password"
              value={formState.password}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, password: event.target.value }))
              }
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={updateMutation.isPending || userQuery.isLoading}>
              {updateMutation.isPending ? (
                <span className="flex items-center gap-2">
                  Saving <LoadingDots />
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 font-medium"
              onClick={() => setIsConfirmOpen(true)}
              disabled={trashMutation.isPending}
            >
              Move to Trash
            </Button>
          </div>

          {(updateMutation.error || trashMutation.error) && (
            <p className="text-sm text-destructive">
              {(updateMutation.error as Error)?.message ||
                (trashMutation.error as Error)?.message}
            </p>
          )}
        </form>
      </GlowCard>
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          trashMutation.mutate();
          setIsConfirmOpen(false);
        }}
        title="Move User to Trash?"
        description="This user will be suspended and unable to log in. You can restore them later from the Archived Users tab."
        confirmText="Move to Trash"
        variant="destructive"
      />
    </DashboardLayout>
  );
};

export default EditUser;
