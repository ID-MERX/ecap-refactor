import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Download, Filter, Navigation, CalendarIcon, Flame, Play, Pause, SkipBack, SkipForward, Check, ChevronsUpDown, Maximize2, Minimize2, Layers, Satellite } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import { format } from "date-fns";

import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import { Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, normalizePlaceName, dedupePlaceNames } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getCaseworkerJourneys, getCaseworkerList, getFacilityList } from "@/lib/api";
import type { JourneyPoint } from "@/lib/api";

const ZAMBIA_CENTER: [number, number] = [-13.1339, 27.8493];
const DEFAULT_ZOOM = 6;

// Tile-provider config. We default to CartoDB Positron because the muted
// grey base makes the emerald journey line + heatmap pop, and it's
// hosted on a real CDN (the public OSM tile server is technically
// volunteer-only). Satellite uses Esri WorldImagery — free with
// attribution and high-res over Zambia.
//
// `maxNativeZoom` is the deepest zoom level the provider actually has
// tiles for. Beyond it, Leaflet upscales the last tile (slightly blurry
// but visible) instead of giving up with blank slots.
const TILE_LAYERS = {
  map: {
    label: "Map",
    icon: Layers,
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxNativeZoom: 19,
    maxZoom: 20,
  },
  satellite: {
    label: "Satellite",
    icon: Satellite,
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    // Esri WorldImagery has reliable coverage up to z17 worldwide and
    // typically z18 in urban areas. Rural Zambia often tops out at z17,
    // so we cap native imagery there and let Leaflet upscale further.
    maxNativeZoom: 17,
    maxZoom: 20,
  },
} as const;
type TileMode = keyof typeof TILE_LAYERS;
const MAP_MAX_ZOOM = 20;

// Map raw OpenSRP entityType values ("ec_household_service_report",
// "ec_vca_case_plan", etc.) to human-friendly visit categories. The exposed
// usernames-on-pin work is paired with this: we surface *what* happened at a
// stop rather than the internal form name.
function categorizeVisit(formType: unknown): string {
  const t = String(formType ?? "").toLowerCase();
  if (!t) return "Visit";
  if (
    t.includes("household") ||
    t.includes("caregiver") ||
    t.includes("mother") ||
    t.includes("pmtct_mother") ||
    t.includes("hh_")
  ) return "Household Visit";
  if (
    t.includes("vca") ||
    t.includes("child") ||
    t.includes("client") ||
    t.includes("hiv_assessment") ||
    t.includes("hiv_testing") ||
    t.includes("muac") ||
    t.includes("grad") ||
    t.includes("pmtct_child")
  ) return "Child Visit";
  return "Visit";
}

function visitLabel(types: Array<string | undefined | null>): string {
  const cats = new Set<string>();
  for (const t of types) {
    const c = categorizeVisit(t);
    if (c) cats.add(c);
  }
  if (cats.size === 0) return "Visit";
  if (cats.size === 1) return [...cats][0];
  if (cats.has("Household Visit") && cats.has("Child Visit")) return "Household & Child Visit";
  return [...cats].join(", ");
}

// Heatmap layer component (uses leaflet.heat via useMap)
function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const heat = (L as any).heatLayer(points, {
      radius: 20,
      blur: 15,
      maxZoom: 17,
      gradient: { 0.2: "#3b82f6", 0.4: "#10b981", 0.6: "#f59e0b", 0.8: "#ef4444", 1.0: "#dc2626" },
    }).addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, points]);
  return null;
}

// Playback marker that moves along the path
function PlaybackMarker({ position, point }: { position: [number, number]; point: any }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(position, { animate: true, duration: 0.3 });
  }, [map, position]);

  return (
    <CircleMarker
      center={position}
      radius={10}
      pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }}
    >
      <Popup>
        <div className="text-sm space-y-0.5">
          <p className="font-semibold text-red-600">Current Position</p>
          {point?.facility && <p className="text-blue-600 font-medium">{normalizePlaceName(point.facility)}</p>}
          <p className="text-slate-500">
            {point?.visit_date ? new Date(point.visit_date).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
          </p>
          <p className="text-slate-400 text-xs">{categorizeVisit(point?.form_type)}</p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

const TIME_PRESETS = [
  { label: "This Week", days: 7 },
  { label: "This Month", days: 30 },
  { label: "This Quarter", days: 90 },
  { label: "All Time", days: 0 },
];

// Robust GPS-availability check for the caseworker dropdown badge. The backend
// has_gps flag is the primary signal, but it may arrive as a boolean, a number
// (event count), or a string ("true"/"1"); we also fall back to any count field
// so the badge stays truthful regardless of how the API serializes it.
const hasGpsData = (cw: any) => {
  const raw = cw?.has_gps ?? cw?.hasGps ?? cw?.gps_available ?? cw?.has_gps_data;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw > 0;
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(v)) return true;
    if (["false", "0", "no", "n", ""].includes(v)) return false;
  }

  const count = Number(cw?.gps_count ?? cw?.gps_points ?? cw?.gps_events ?? cw?.journey_points ?? 0);
  return Number.isFinite(count) && count > 0;
};

const CaseworkerJourneys = () => {
  const [selectedCaseworker, setSelectedCaseworker] = useState<string>("");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<string>("All Time");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedFacility, setSelectedFacility] = useState<string>("all");
  const [caseworkerComboboxOpen, setCaseworkerComboboxOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<{
    caseworker: string;
    from: string;
    to: string;
    facility: string;
  }>({ caseworker: "", from: "", to: "", facility: "" });

  // View mode: journey (default), heatmap, playback
  const [viewMode, setViewMode] = useState<"journey" | "heatmap" | "playback">("journey");

  // Fullscreen toggle for the Journey Map card
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // Tile-layer toggle: map (Positron streets) vs satellite (Esri imagery).
  const [tileMode, setTileMode] = useState<TileMode>("map");
  useEffect(() => {
    if (!isMapFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMapFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isMapFullscreen]);

  // Playback state
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restrict caseworker list by user's jurisdiction:
  //   District User  -> only their district
  //   Provincial User -> only their province
  //   Admin / others  -> full list
  const { user } = useAuth();
  const isDistrictUser = user?.description === "District User";
  const isProvincialUser = user?.description === "Provincial User";
  const userDistrict = isDistrictUser ? (user?.location ?? undefined) : undefined;
  const userProvince = isProvincialUser ? (user?.title ?? undefined) : undefined;

  // Always fetch the FULL caseworker list, then restrict client-side by the
  // user's jurisdiction. Passing district/province as server-side scope params
  // made the dropdown collapse to just "All Caseworkers" whenever the backend's
  // ETL values didn't match the user's location/title exactly, so we filter
  // here instead — matching how the register pages enforce role scope.
  const { data: fullCaseworkerList = [] } = useQuery({
    queryKey: ["caseworker-list", "full", "v2"],
    queryFn: () => getCaseworkerList(),
    staleTime: 10 * 60 * 1000,
  });

  const caseworkerList = useMemo(() => {
    const list = fullCaseworkerList as any[];
    if (!isDistrictUser && !isProvincialUser) return list;
    const target = (isDistrictUser ? userDistrict : userProvince)?.trim().toLowerCase();
    if (!target) return list;
    const field = isDistrictUser ? "district" : "province";
    const scoped = list.filter((cw) => String(cw?.[field] ?? "").trim().toLowerCase() === target);
    // Never collapse to an empty dropdown: if the records don't carry the
    // jurisdiction field (or none match), fall back to the full list.
    return scoped.length > 0 ? scoped : list;
  }, [fullCaseworkerList, isDistrictUser, isProvincialUser, userDistrict, userProvince]);

  const hasCaseworker = appliedFilters.caseworker && appliedFilters.caseworker !== "all";
  const hasFacility = appliedFilters.facility && appliedFilters.facility !== "all";
  const hasServerFilter = hasCaseworker || appliedFilters.from || appliedFilters.to || hasFacility;
  const {
    data: journeyPoints = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["caseworker-journeys", appliedFilters.caseworker, appliedFilters.from, appliedFilters.to, appliedFilters.facility],
    queryFn: () =>
      getCaseworkerJourneys({
        caseworker: appliedFilters.caseworker || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
        facility: appliedFilters.facility || undefined,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!hasServerFilter,
  });

  const allValidPoints = useMemo(
    () => journeyPoints.filter((p) => p.lat !== null && p.lng !== null && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng))),
    [journeyPoints]
  );

  // Fetch all facilities from the database
  const { data: allFacilities = [] } = useQuery({
    queryKey: ["facility-list"],
    queryFn: getFacilityList,
    staleTime: 10 * 60 * 1000,
  });

  // Restrict facility/ward list by user role:
  //   District User  -> only facilities in their district (derived from caseworkerList)
  //   Provincial User -> only facilities in their province (derived from caseworkerList)
  //   Admin / others  -> full list
  const facilities = useMemo(() => {
    const baseList = (() => {
      if (!isDistrictUser && !isProvincialUser) return allFacilities;
      const allowed = new Set<string>();
      (caseworkerList as any[]).forEach((cw) => {
        const f = String(cw?.facility ?? "").trim();
        if (f) allowed.add(f);
      });
      if (allowed.size === 0) return [];
      const lc = new Set([...allowed].map((s) => s.toLowerCase()));
      return allFacilities.filter((f: string) => lc.has(String(f).toLowerCase()));
    })();
    // Title-case ward names ("chibale" → "Chibale") and collapse duplicates
    // that differ only by case so the dropdown never lists "chibale" + "Chibale".
    return dedupePlaceNames(baseList as string[]).sort((a, b) => a.localeCompare(b));
  }, [allFacilities, caseworkerList, isDistrictUser, isProvincialUser]);

  // Facility/ward filtering is client-side (applies live on selection, no Apply needed)
  const filteredPoints = useMemo(() => {
    if (selectedFacility && selectedFacility !== "all") {
      const filter = selectedFacility.toLowerCase();
      return allValidPoints.filter((p: any) => {
        const f = (p.facility || "").toLowerCase();
        return f === filter || f.includes(filter) || filter.includes(f);
      });
    }
    return allValidPoints;
  }, [allValidPoints, selectedFacility]);

  // Collapse same (entity, date) into a single GPS marker so a caseworker who
  // logged multiple services for the same household / VCA in one day shows
  // as one dot, not a stack of overlapping markers. We attach the visit
  // count and the unique form types so the popup can still surface that
  // multiple things happened at that stop.
  const validPoints = useMemo(() => {
    const groups = new Map<string, { rep: any; visits: any[] }>();
    for (const p of filteredPoints as any[]) {
      const dateOnly = String(p.visit_date || "").slice(0, 10);
      const idKey =
        p.entity_id ||
        p.household_id ||
        `${Math.round(Number(p.lat) * 10000)},${Math.round(Number(p.lng) * 10000)}`;
      const key = `${idKey}::${dateOnly}`;
      const existing = groups.get(key);
      if (existing) {
        existing.visits.push(p);
      } else {
        groups.set(key, { rep: p, visits: [p] });
      }
    }
    return Array.from(groups.values()).map(({ rep, visits }) => ({
      ...rep,
      visit_count: visits.length,
      visit_form_types: Array.from(new Set(visits.map((v: any) => v.form_type).filter(Boolean))),
    }));
  }, [filteredPoints]);

  const sortedPoints = useMemo(
    () => [...validPoints].sort((a, b) => new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime()),
    [validPoints]
  );

  const polylinePositions = useMemo(
    () => sortedPoints.map((p) => [Number(p.lat), Number(p.lng)] as [number, number]),
    [sortedPoints]
  );

  const heatmapData = useMemo(
    () => validPoints.map((p: any) => {
      const weight = Math.min(0.3 + 0.15 * Number(p.visit_count || 1), 1);
      return [Number(p.lat), Number(p.lng), weight] as [number, number, number];
    }),
    [validPoints]
  );

  const mapCenter = useMemo<[number, number]>(() => {
    if (polylinePositions.length > 0) return polylinePositions[0];
    return ZAMBIA_CENTER;
  }, [polylinePositions]);

  const mapZoom = polylinePositions.length > 0 ? 13 : DEFAULT_ZOOM;

  const dateRange = useMemo(() => {
    if (validPoints.length === 0) return null;
    const dates = validPoints.map((p) => p.visit_date).filter(Boolean).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [validPoints]);

  const handleTimePeriod = (label: string) => {
    setSelectedTimePeriod(label);
    const preset = TIME_PRESETS.find((p) => p.label === label);
    if (!preset || preset.days === 0) {
      setFromDate(undefined);
      setToDate(undefined);
    } else {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - preset.days);
      setFromDate(from);
      setToDate(to);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      caseworker: selectedCaseworker,
      from: fromDate ? format(fromDate, "yyyy-MM-dd") : "",
      to: toDate ? format(toDate, "yyyy-MM-dd") : "",
      facility: selectedFacility,
    });
    setPlaybackIndex(0);
    setIsPlaying(false);
  };

  // Strip the upstream "ec-" prefix (and chained variants like "ec-pmp-") from
  // form types so the exported CSV shows readable values like "household" /
  // "vca" instead of "ec-household" or "ec-pmp-vca-monitoring".
  const cleanFormType = (raw: unknown) =>
    String(raw ?? "")
      .replace(/^(ec[-_]?(pmp|app|plus)?[-_]?)+/i, "")
      .trim();

  const handleExportCsv = () => {
    if (validPoints.length === 0) return;
    const headers = ["Caseworker", "Facility", "Visit Date", "Form Type", "Latitude", "Longitude"];
    const rows = validPoints.map((p: any) => [
      `"${p.caseworker}"`, `"${p.facility || ""}"`, `"${p.visit_date}"`, `"${cleanFormType(p.form_type)}"`, p.lat ?? "", p.lng ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `caseworker-journeys-${appliedFilters.caseworker}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Playback controls
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playbackRef.current) clearInterval(playbackRef.current);
    } else {
      setIsPlaying(true);
      if (playbackIndex >= sortedPoints.length - 1) setPlaybackIndex(0);
    }
  }, [isPlaying, playbackIndex, sortedPoints.length]);

  useEffect(() => {
    if (isPlaying && sortedPoints.length > 0) {
      playbackRef.current = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= sortedPoints.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
    }
    return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [isPlaying, sortedPoints.length]);

  const playbackPoint = sortedPoints[playbackIndex];
  const playbackPosition = playbackPoint ? [Number(playbackPoint.lat), Number(playbackPoint.lng)] as [number, number] : null;
  const playbackTrail = polylinePositions.slice(0, playbackIndex + 1);

  const dateStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <DashboardLayout subtitle="Caseworker Journeys">
      <div className="space-y-6">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(99,102,241,0.15),transparent_45%)]" />
          <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
          <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-indigo-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

          <div className="relative z-10 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Global positioning system</span>
                <span className="text-slate-400 text-[11px]">·</span>
                <span className="text-[11px] text-slate-600">{dateStr}</span>
                <Badge variant="outline" className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700">
                  <Activity className="h-3 w-3" /> Live GPS
                </Badge>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-indigo-700 bg-clip-text text-transparent">
                  Caseworker journeys
                </span>
                <Badge variant="outline" className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm">
                  <Sparkles className="h-3 w-3" /> Map · Heatmap · Playback
                </Badge>
              </h1>
              <p className="mt-1 text-xs text-slate-600">Track and visualize field visits, movement patterns, and GPS-tagged form submissions.</p>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <GlowCard>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Time period presets */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Time Period</label>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleTimePeriod(preset.label)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      selectedTimePeriod === preset.label ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[260px] flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Caseworker</label>
                <Popover open={caseworkerComboboxOpen} onOpenChange={setCaseworkerComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={caseworkerComboboxOpen}
                      className="w-full justify-between h-10 font-normal"
                    >
                      <span className="truncate">
                        {(() => {
                          if (!selectedCaseworker || selectedCaseworker === "all") return "All Caseworkers";
                          const cw = (caseworkerList as any[]).find((c) => c.caseworker === selectedCaseworker);
                          return cw?.display_name || cw?.caseworker || "Select Caseworker";
                        })()}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        // value contains "<caseworker_id>::<haystack>" so search hits
                        // both name and facility/ward.
                        return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                      }}
                    >
                      <CommandInput placeholder="Search caseworker, ward, facility…" />
                      <CommandList>
                        <CommandEmpty>No caseworker found.</CommandEmpty>
                        <CommandGroup heading="Quick">
                          <CommandItem
                            value="all-caseworkers"
                            onSelect={() => {
                              setSelectedCaseworker("all");
                              setCaseworkerComboboxOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedCaseworker === "all" || !selectedCaseworker ? "opacity-100" : "opacity-0")} />
                            All Caseworkers
                          </CommandItem>
                        </CommandGroup>
                        {(() => {
                          const sorted = [...(caseworkerList as any[])].sort((a, b) => {
                            const fa = (a.facility || "zzz").toLowerCase();
                            const fb = (b.facility || "zzz").toLowerCase();
                            if (fa !== fb) return fa.localeCompare(fb);
                            return (a.display_name || a.caseworker || "").localeCompare(b.display_name || b.caseworker || "");
                          });
                          const groups: Record<string, any[]> = {};
                          sorted.forEach((cw) => {
                            const facility = cw.facility || "Unassigned";
                            (groups[facility] ||= []).push(cw);
                          });
                          return Object.entries(groups).map(([facility, members]) => (
                            <CommandGroup key={facility} heading={normalizePlaceName(facility)}>
                              {members.map((cw) => {
                                const label = cw.display_name || cw.caseworker;
                                const haystack = `${label} ${cw.facility || ""}`;
                                return (
                                  <CommandItem
                                    key={cw.caseworker}
                                    value={`${cw.caseworker}::${haystack}`}
                                    onSelect={() => {
                                      setSelectedCaseworker(cw.caseworker);
                                      // Auto-populate ward/facility filter to match this caseworker
                                      if (cw.facility) setSelectedFacility(cw.facility);
                                      setCaseworkerComboboxOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", selectedCaseworker === cw.caseworker ? "opacity-100" : "opacity-0")} />
                                    <span className="flex flex-1 items-center gap-2 truncate">
                                      <span className="truncate">{label}</span>
                                      {hasGpsData(cw) ? (
                                        <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">GPS</span>
                                      ) : (
                                        <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-400">No GPS</span>
                                      )}
                                    </span>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          ));
                        })()}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">From</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !fromDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "dd MMM yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">To</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !toDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "dd MMM yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="min-w-[200px]">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Ward</label>
                <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                  <SelectTrigger><SelectValue placeholder="All Wards" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wards</SelectItem>
                    {facilities.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleApplyFilters} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Loading...</>
                ) : (
                  <><Navigation className="h-4 w-4" /> Apply</>
                )}
              </Button>
              <Button variant="outline" onClick={handleExportCsv} disabled={validPoints.length === 0} className="gap-2">
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button variant="ghost" className="text-slate-500 gap-2" onClick={() => {
                setSelectedCaseworker("");
                setFromDate(undefined);
                setToDate(undefined);
                setSelectedTimePeriod("All Time");
                setSelectedFacility("all");
                setAppliedFilters({ caseworker: "", from: "", to: "", facility: "" });
                setPlaybackIndex(0);
                setIsPlaying(false);
                setViewMode("journey");
              }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </GlowCard>

        {/* Map Card */}
        <div className={cn(isMapFullscreen && "fixed inset-0 z-[1000] bg-white overflow-auto")}>
        <GlowCard
          className={cn(isMapFullscreen && "rounded-none border-0 shadow-none")}
        >
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Journey Map
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {validPoints.length > 0 && (
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button onClick={() => { setViewMode("journey"); setIsPlaying(false); }}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        viewMode === "journey" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}>
                      <MapPin className="h-3 w-3 inline mr-1" /> Journey
                    </button>
                    <button onClick={() => { setViewMode("heatmap"); setIsPlaying(false); }}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        viewMode === "heatmap" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}>
                      <Flame className="h-3 w-3 inline mr-1" /> Heatmap
                    </button>
                    <button onClick={() => { setViewMode("playback"); setPlaybackIndex(0); setIsPlaying(false); }}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        viewMode === "playback" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}>
                      <Play className="h-3 w-3 inline mr-1" /> Playback
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
                  title={isMapFullscreen ? "Exit fullscreen (Esc)" : "Expand to fullscreen"}
                >
                  {isMapFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{isMapFullscreen ? "Exit" : "Fullscreen"}</span>
                </button>
              </div>
            </div>
            {validPoints.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
                {appliedFilters.caseworker && appliedFilters.caseworker !== "all" && (
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3 w-3 text-slate-400" />
                    <span className="text-slate-500">Caseworker:</span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {(caseworkerList.find((cw: any) => cw.caseworker === appliedFilters.caseworker) as any)?.display_name || appliedFilters.caseworker}
                    </Badge>
                  </div>
                )}
                {(() => {
                  const selectedCw = caseworkerList.find((cw: any) => cw.caseworker === appliedFilters.caseworker) as any;
                  const district = selectedCw?.district as string | undefined;
                  if (!district) return null;
                  return (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-emerald-500" />
                      <span className="text-slate-500">District:</span>
                      <Badge variant="outline" className="text-xs font-normal border-emerald-200 bg-emerald-50/60 text-emerald-700">
                        {normalizePlaceName(district)}
                      </Badge>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span className="text-slate-500">Points:</span>
                  <span className="font-semibold text-slate-700">{validPoints.length}</span>
                </div>
                {dateRange && (
                  <div className="flex items-center gap-1.5">
                    <Navigation className="h-3 w-3 text-slate-400" />
                    <span className="text-slate-500">Period:</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(dateRange.from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} &mdash; {new Date(dateRange.to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className={cn(isMapFullscreen && "p-2 sm:p-3")}>
            {isLoading ? (
              <div className={cn("flex items-center justify-center rounded-lg bg-slate-50", isMapFullscreen ? "h-[calc(100vh-130px)]" : "h-[500px]")}>
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm text-slate-500">Loading GPS data...</p>
                </div>
              </div>
            ) : isError ? (
              <div className={cn("flex items-center justify-center rounded-lg bg-red-50", isMapFullscreen ? "h-[calc(100vh-130px)]" : "h-[500px]")}>
                <p className="text-sm font-medium text-red-600">Failed to load journey data.</p>
              </div>
            ) : !hasServerFilter ? (
              <div className={cn("flex items-center justify-center rounded-lg bg-slate-50", isMapFullscreen ? "h-[calc(100vh-130px)]" : "h-[500px]")}>
                <div className="text-center max-w-md">
                  <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Select a caseworker or date range</p>
                  <p className="mt-1 text-xs text-slate-400">Choose a caseworker or set a date range, then click Apply. You can also filter by facility after data loads.</p>
                </div>
              </div>
            ) : validPoints.length === 0 ? (
              <div className={cn("flex items-center justify-center rounded-lg bg-slate-50", isMapFullscreen ? "h-[calc(100vh-130px)]" : "h-[500px]")}>
                <div className="text-center max-w-md">
                  <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No GPS data found for this caseworker</p>
                  <p className="mt-1 text-xs text-slate-400">Try a different date range or caseworker.</p>
                </div>
              </div>
            ) : (
              <div>
                {/* Playback controls - above map */}
                {viewMode === "playback" && sortedPoints.length > 0 && (
                  <div className="mb-3 p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <Button size="sm" variant="outline" onClick={() => { setPlaybackIndex(0); setIsPlaying(false); }}>
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={togglePlayback} className={isPlaying ? "bg-red-500 hover:bg-red-600" : ""}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setPlaybackIndex(sortedPoints.length - 1); setIsPlaying(false); }}>
                        <SkipForward className="h-4 w-4" />
                      </Button>
                      <div className="flex-1">
                        <input
                          type="range" min={0} max={sortedPoints.length - 1} value={playbackIndex}
                          onChange={(e) => { setPlaybackIndex(Number(e.target.value)); setIsPlaying(false); }}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                      <div className="text-xs text-slate-500 min-w-[100px] text-right">
                        <span className="font-mono font-bold">{playbackIndex + 1}</span> / {sortedPoints.length}
                      </div>
                    </div>
                    {playbackPoint && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{new Date(playbackPoint.visit_date).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        {(playbackPoint as any).facility && <span className="text-blue-600 font-medium">{normalizePlaceName((playbackPoint as any).facility)}</span>}
                        {(playbackPoint as any).household_id && <span className="text-emerald-600 font-medium">ID: {(playbackPoint as any).household_id}</span>}
                        <span>{categorizeVisit(playbackPoint.form_type)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className={cn("relative overflow-hidden rounded-lg", isMapFullscreen ? "h-[calc(100vh-130px)]" : "h-[500px]")}>
                  {/* Map / Satellite pill — top-left, above the map */}
                  <div className="absolute left-3 top-3 z-[400] flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-sm">
                    {(Object.keys(TILE_LAYERS) as TileMode[]).map((mode) => {
                      const T = TILE_LAYERS[mode];
                      const Icon = T.icon;
                      const active = tileMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setTileMode(mode)}
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                            active
                              ? "bg-slate-900 text-white shadow-sm"
                              : "text-slate-600 hover:bg-slate-100",
                          )}
                          aria-pressed={active}
                          title={`Show ${T.label.toLowerCase()} view`}
                        >
                          <Icon className="h-3 w-3" />
                          {T.label}
                        </button>
                      );
                    })}
                  </div>
                  <MapContainer center={mapCenter} zoom={mapZoom} maxZoom={MAP_MAX_ZOOM} className="h-full w-full" scrollWheelZoom={true}>
                    <TileLayer
                      key={tileMode}
                      attribution={TILE_LAYERS[tileMode].attribution}
                      url={TILE_LAYERS[tileMode].url}
                      maxNativeZoom={TILE_LAYERS[tileMode].maxNativeZoom}
                      maxZoom={TILE_LAYERS[tileMode].maxZoom}
                    />

                    {/* Journey view */}
                    {viewMode === "journey" && (
                      <>
                        {validPoints.map((point: any, idx: number) => {
                          const visits = Number(point.visit_count || 1);
                          const radius = visits > 1 ? Math.min(5 + Math.sqrt(visits) * 2, 12) : 5;
                          const types: string[] = Array.isArray(point.visit_form_types) && point.visit_form_types.length > 0
                            ? point.visit_form_types
                            : (point.form_type ? [point.form_type] : []);
                          return (
                            <CircleMarker key={`j-${idx}`} center={[Number(point.lat), Number(point.lng)]} radius={radius}
                              pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.8, weight: 1 }}>
                              <Popup>
                                <div className="text-sm space-y-0.5">
                                  {point.facility && <p className="text-blue-600 font-semibold">{normalizePlaceName(point.facility)}</p>}
                                  {point.household_id && <p className="text-emerald-600 text-xs font-medium">ID: {point.household_id}</p>}
                                  <p className="text-slate-500">{new Date(point.visit_date).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                                  {visits > 1 ? (
                                    <p className="text-slate-400 text-xs">
                                      <span className="inline-flex items-center px-1.5 py-0.5 mr-1 rounded bg-emerald-100 text-emerald-700 font-bold">{visits} visits</span>
                                      {visitLabel(types)}
                                    </p>
                                  ) : (
                                    <p className="text-slate-400 text-xs">{categorizeVisit(point.form_type)}</p>
                                  )}
                                </div>
                              </Popup>
                            </CircleMarker>
                          );
                        })}
                        {polylinePositions.length > 1 && (
                          <Polyline positions={polylinePositions} pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.7 }} />
                        )}
                      </>
                    )}

                    {/* Heatmap view */}
                    {viewMode === "heatmap" && <HeatmapLayer points={heatmapData} />}

                    {/* Playback view */}
                    {viewMode === "playback" && (
                      <>
                        {playbackTrail.length > 1 && (
                          <Polyline positions={playbackTrail} pathOptions={{ color: "#10b981", weight: 3, opacity: 0.6 }} />
                        )}
                        {sortedPoints.slice(0, playbackIndex + 1).map((point: any, idx: number) => (
                          <CircleMarker key={`p-${idx}`} center={[Number(point.lat), Number(point.lng)]} radius={3}
                            pathOptions={{ color: "#94a3b8", fillColor: "#94a3b8", fillOpacity: 0.5, weight: 1 }} />
                        ))}
                        {playbackPosition && <PlaybackMarker position={playbackPosition} point={playbackPoint} />}
                      </>
                    )}
                  </MapContainer>
                </div>
              </div>
            )}
          </CardContent>
        </GlowCard>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CaseworkerJourneys;
