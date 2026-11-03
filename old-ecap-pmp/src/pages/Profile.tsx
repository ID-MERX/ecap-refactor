import { Mail, ShieldCheck, UserCircle2, Camera, Upload, Trash2, Sparkles, Activity, ArrowLeft, KeyRound, MapPin, Globe } from "lucide-react";
import GlowCard from "@/components/aceternity/GlowCard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useState, useRef } from "react";
import { uploadFile, updateUserAvatar, getFileUrl, requestPasswordReset } from "@/lib/directus";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Profile = () => {
  const { user, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  if (!user) {
    return null;
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    try {
      const uploadedFile = await uploadFile(file);
      await updateUserAvatar(user.id, uploadedFile.id);

      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["users-list-chat"] });

      toast.success("Profile picture updated!");
      await refreshProfile();
    } catch (error) {
      toast.error("Failed to update profile picture");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm("Are you sure you want to remove your profile picture?")) return;

    setUploading(true);
    try {
      await updateUserAvatar(user.id, null);
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["users-list-chat"] });
      toast.success("Profile picture removed");
      await refreshProfile();
    } catch (error) {
      toast.error("Failed to remove profile picture");
    } finally {
      setUploading(false);
    }
  };

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const initials = (displayName || user.email || "U")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const roleLabel = typeof user.role === "object" ? user.role?.name : user.role || "N/A";
  const avatarUrl = user.avatar ? getFileUrl(user.avatar) : null;

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout subtitle="Profile">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
        <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

        <div className="relative z-10 flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Avatar */}
            <div className="relative group">
              <div aria-hidden className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-emerald-300/60 via-teal-300/40 to-sky-300/40 blur-md opacity-70" />
              <Avatar className="relative h-24 w-24 rounded-2xl ring-2 ring-white shadow-lg shadow-emerald-500/30">
                <AvatarImage src={avatarUrl || undefined} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 text-white text-2xl font-extrabold rounded-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div
                className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-[2px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-6 w-6 text-white drop-shadow-md" />
              </div>
            </div>

            {/* User info */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Profile</span>
                <span className="text-slate-400 text-[11px]">·</span>
                <span className="text-[11px] text-slate-600">{dateStr}</span>
                <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                  <Activity className="h-3 w-3" /> Active
                </Badge>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                  {displayName || "Your account"}
                </span>
                <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                  <Sparkles className="h-3 w-3" /> {roleLabel}
                </Badge>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {user.email}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5 text-emerald-600" />
              {uploading ? "Updating…" : "Change photo"}
            </button>
            {user.avatar && (
              <button
                type="button"
                onClick={handleDeleteAvatar}
                disabled={uploading}
                className="group inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-rose-600 backdrop-blur-md transition-all hover:border-rose-300 hover:bg-rose-50/60"
                title="Remove photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileSelect}
      />

      {/* ── Account summary (Quick Actions style) ─────────────── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Account summary</h3>
          <span className="text-[11px] text-slate-400">Identity &amp; access</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {([
            {
              icon: UserCircle2,
              label: "Display name",
              value: displayName || "N/A",
              iconBg: "from-emerald-100 to-teal-100 text-emerald-700",
              glow: "from-emerald-200/70 via-teal-200/40",
            },
            {
              icon: Mail,
              label: "Email address",
              value: user.email,
              iconBg: "from-sky-100 to-cyan-100 text-sky-700",
              glow: "from-sky-200/70 via-cyan-200/40",
            },
            {
              icon: ShieldCheck,
              label: "Role access",
              value: roleLabel,
              iconBg: "from-violet-100 to-fuchsia-100 text-violet-700",
              glow: "from-violet-200/70 via-fuchsia-200/40",
            },
          ] as const).map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="group relative">
                <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-br ${card.glow} to-transparent opacity-40 blur-md transition-opacity duration-500 group-hover:opacity-100`} />
                <div className="relative h-full rounded-2xl border border-slate-200/70 bg-white/75 p-5 backdrop-blur-xl shadow-[0_15px_40px_-25px_rgba(15,23,42,0.35)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${card.iconBg} ring-1 ring-white/60 shadow-sm`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 text-base font-extrabold text-slate-900 truncate" title={String(card.value)}>{String(card.value)}</div>
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Manage identity panel ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-emerald-200/40 via-teal-200/25 to-sky-200/20 opacity-50 blur-md" />
          <GlowCard className="p-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-emerald-100/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Security</h3>
                <p className="text-[11px] text-slate-500">Password and account controls</p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  const resetUrlBase = (import.meta.env.VITE_RESET_PASSWORD_URL || window.location.origin).replace(/\/$/, "");
                  const resetUrl = `${resetUrlBase}/reset-password`;
                  try {
                    await requestPasswordReset(user.email, resetUrl);
                    toast.success("Password reset email sent to your inbox");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Failed to send reset email");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 h-11 text-xs font-medium text-slate-700 backdrop-blur-md transition-all hover:border-emerald-300 hover:bg-white"
              >
                <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                Reset password
              </button>
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 h-10 text-[11px] font-semibold text-slate-500 transition-all hover:bg-emerald-50/40 hover:text-emerald-700"
              >
                Request role review
              </button>
            </div>
          </GlowCard>
        </div>

        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl bg-gradient-to-br from-amber-200/40 via-orange-200/25 to-rose-200/20 opacity-50 blur-md" />
          <GlowCard className="p-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-amber-100/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 ring-1 ring-white/60 shadow-sm">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Access notes</h3>
                <p className="text-[11px] text-slate-500">Permissions are synced from the server</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your permissions are synced from server. Contact an admin if role updates are required.
            </p>
            <div className="mt-4 rounded-lg border border-emerald-100/60 bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-transparent p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">Tip:</strong> Your profile picture is visible to teammates in support chat and on the org dashboard.
                </p>
              </div>
            </div>
          </GlowCard>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
