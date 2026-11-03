import { useState, useMemo } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GlowCard from "@/components/aceternity/GlowCard";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, HeartPulse, Flag, ArrowRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_DISTRICT,
  getVcaServicesByDistrict,
  getCaregiverServicesByDistrict,
  getFlaggedRecords,
} from "@/lib/api";
import { cn, toTitleCase } from "@/lib/utils";

type FeedItem = {
  type: "vca-service" | "caregiver-service" | "flag";
  id: string;
  title: string;
  subtitle: string;
  date: string;
  status: string;
  linkId?: string;
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

const parseDate = (raw: string): Date => {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

const formatDate = (raw: string): string => {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const tabs = [
  { key: "all", label: "All" },
  { key: "vca-service", label: "VCA Services" },
  { key: "caregiver-service", label: "Caregiver" },
  { key: "flag", label: "Flags" },
] as const;

const typeConfig = {
  "vca-service": {
    icon: Users,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    badge: "bg-emerald-50 text-emerald-700",
    route: "/vca-services",
  },
  "caregiver-service": {
    icon: HeartPulse,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    badge: "bg-emerald-50 text-emerald-700",
    route: "/household-services",
  },
  flag: {
    icon: Flag,
    color: "text-amber-600",
    bg: "bg-amber-50",
    badge: "bg-amber-50 text-amber-700",
    route: "/flags",
  },
};

const FEED_LIMIT = 15;

const RecentActivity = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "incomplete" | "draft">("all");

  const flagsQuery = useQuery({
    queryKey: ["recent-flags"],
    queryFn: getFlaggedRecords,
  });

  const isLoading = flagsQuery.isLoading;

  const { feed, counts } = useMemo(() => {
    const items: FeedItem[] = [];
    const stats = { all: 0, pending: 0, incomplete: 0, draft: 0 };

    // Flags — exclude resolved records
    const flagsData = (flagsQuery.data ?? []).filter(
      (r: any) => r.status?.toLowerCase() !== "resolved"
    );
    stats.all = flagsData.length;

    for (const raw of flagsData) {
      const record = raw as Record<string, unknown>;
      const status = String(pickValue(record, ["status"])).toLowerCase();

      if (status.includes("pending")) stats.pending++;
      else if (status.includes("incomplete")) stats.incomplete++;
      else if (status.includes("draft")) stats.draft++;

      items.push({
        type: "flag",
        id: pickValue(record, ["id"]),
        title: pickValue(record, ["comment", "reason"]),
        subtitle: `HH ${pickValue(record, ["household_id"])} - ${pickValue(record, ["caregiver_name"])}`,
        date: pickValue(record, ["date_created"]),
        status: pickValue(record, ["status"]),
        linkId: pickValue(record, ["household_id"]),
      });
    }

    // Sort by date descending
    items.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

    return { feed: items, counts: stats };
  }, [flagsQuery.data]);

  const filtered = useMemo(() => {
    let result = feed;

    // Apply Status Filter
    if (activeFilter !== "all") {
      result = result.filter(item => item.status?.toLowerCase().includes(activeFilter));
    }

    // Apply Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
      );
    }

    // Apply Casing and Limit
    return result.map(item => ({
      ...item,
      title: toTitleCase(item.title),
      subtitle: toTitleCase(item.subtitle),
      status: toTitleCase(item.status || "Pending review")
    })).slice(0, FEED_LIMIT);
  }, [feed, searchQuery, activeFilter]);

  return (
    <GlowCard className="h-full">
      <CardHeader className="pb-3 border-b border-slate-50">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Flag className="h-4 w-4" />
                </div>
                <CardTitle className="text-lg font-bold">Flagged Records</CardTitle>
              </div>
              <p className="mt-1 text-xs text-muted-foreground font-medium">
                Review records requiring administrative attention
              </p>
            </div>

            {/* Status Counts Strip */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100">
              <button
                onClick={() => setActiveFilter("all")}
                className={cn(
                  "px-3 py-1 rounded-lg shadow-sm border flex items-center gap-2 transition-all",
                  activeFilter === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-900 border-slate-100 hover:bg-slate-50"
                )}
              >
                <span className={cn("text-[10px] font-black tracking-wider", activeFilter === "all" ? "text-slate-400" : "text-slate-400")}>All</span>
                <span className="text-xs font-bold">{counts.all}</span>
              </button>

              <button
                onClick={() => setActiveFilter("pending")}
                className={cn(
                  "px-3 py-1 rounded-lg shadow-sm border flex items-center gap-2 transition-all",
                  activeFilter === "pending" ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-900 border-slate-100 hover:bg-slate-50"
                )}
              >
                <span className={cn("text-[10px] font-black tracking-wider", activeFilter === "pending" ? "text-amber-100" : "text-amber-500")}>Pending</span>
                <span className="text-xs font-bold">{counts.pending}</span>
              </button>

              <button
                onClick={() => setActiveFilter("incomplete")}
                className={cn(
                  "px-3 py-1 rounded-lg shadow-sm border flex items-center gap-2 transition-all",
                  activeFilter === "incomplete" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-900 border-slate-100 hover:bg-slate-50"
                )}
              >
                <span className={cn("text-[10px] font-black tracking-wider", activeFilter === "incomplete" ? "text-emerald-100" : "text-emerald-500")}>Incomplete</span>
                <span className="text-xs font-bold">{counts.incomplete}</span>
              </button>

              <button
                onClick={() => setActiveFilter("draft")}
                className={cn(
                  "px-3 py-1 rounded-lg shadow-sm border flex items-center gap-2 transition-all",
                  activeFilter === "draft" ? "bg-slate-500 text-white border-slate-500" : "bg-white text-slate-900 border-slate-100 hover:bg-slate-50"
                )}
              >
                <span className={cn("text-[10px] font-black tracking-wider", activeFilter === "draft" ? "text-slate-200" : "text-slate-500")}>Draft</span>
                <span className="text-xs font-bold">{counts.draft}</span>
              </button>
            </div>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Filter flags by name, ID or reason..."
              className="pl-9 h-9 bg-slate-50 border-none text-xs font-semibold focus-visible:ring-amber-500/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingDots />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-[380px] flex-col items-center justify-center text-sm text-slate-400">
            <div className="p-6 rounded-full bg-slate-50 border border-slate-100 mb-4 opacity-40">
              <Flag className="h-10 w-10" />
            </div>
            <p className="font-bold text-slate-500">No flags requiring attention</p>
            <p className="text-xs mt-1 font-medium">Excellent! All records are clean.</p>
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-2">
              {filtered.map((item, i) => {
                const config = typeConfig.flag;
                const Icon = config.icon;

                return (
                  <div
                    key={`${item.id}-${i}`}
                    className="group flex items-start gap-4 rounded-xl p-4 transition-all hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer active:scale-[0.98]"
                    onClick={() => {
                      navigate(`/flags`);
                    }}
                  >
                    <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm font-bold text-slate-900 leading-tight">
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[10px] font-semibold text-slate-400 tracking-tight">
                          {formatDate(item.date)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500 truncate">{item.subtitle}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="text-[9px] font-bold px-2 py-0.5 h-auto bg-amber-50 text-amber-700 border-amber-100 tracking-widest">
                          {item.status || "Pending review"}
                        </Badge>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          View details <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </GlowCard>
  );
};

export default RecentActivity;
