import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Book,
  FileText,
  Search,
  Settings,
  Shield,
  User,
  ChevronRight,
  HelpCircle,
  XCircle,
  ArrowLeft,
  Activity,
  Sparkles,
  Users,
  Home,
  HeartPulse,
  Database,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toSlug } from "@/data/documentationArticles";
import {
  getTotalHouseholdsCount,
  getTotalVcasCount,
  getTotalMothersCount,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface DocSection {
  title: string;
  icon: any;
  description: string;
  links: string[];
  liveStat?: { label: string; value: string };
  isPartialMatch?: boolean;
}

const formatNumber = (n: number | undefined | null) => {
  if (n === undefined || n === null || isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-GB").format(Number(n));
};

const Documentation = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuth();
  const userName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.email ||
    "you";
  const userRole =
    (typeof user?.role === "object" ? user?.role?.name : user?.role) ||
    user?.description ||
    "User";
  const userScope =
    user?.location && user.location !== "All"
      ? `${user.location}`
      : user?.title && user.title !== "All"
        ? `${user.title}`
        : "all districts";

  // ── Live platform data ───────────────────────────────────
  const householdsQuery = useQuery({
    queryKey: ["docs", "total-households"],
    queryFn: () => getTotalHouseholdsCount(),
    staleTime: 5 * 60 * 1000,
  });
  const vcasQuery = useQuery({
    queryKey: ["docs", "total-vcas"],
    queryFn: () => getTotalVcasCount(),
    staleTime: 5 * 60 * 1000,
  });
  const mothersQuery = useQuery({
    queryKey: ["docs", "total-mothers"],
    queryFn: () => getTotalMothersCount(),
    staleTime: 5 * 60 * 1000,
  });

  const isLoadingStats =
    householdsQuery.isLoading || vcasQuery.isLoading || mothersQuery.isLoading;

  const totalRecords =
    (householdsQuery.data ?? 0) +
    (vcasQuery.data ?? 0) +
    (mothersQuery.data ?? 0);

  const docSections: DocSection[] = useMemo(
    () => [
      {
        title: "Getting Started",
        icon: Book,
        description: `You're signed in as ${userRole} for ${userScope}. Learn the basics of the ECAP+ platform.`,
        links: [
          "Platform overview",
          "Logging in and navigation",
          "Understanding your dashboard",
          "Role-based access levels",
        ],
        liveStat: { label: "Your role", value: userRole },
      },
      {
        title: "User Management",
        icon: User,
        description:
          "Create Directus accounts, assign roles (Administrator, Provincial, District, Facility, Support), and scope users by location.",
        links: [
          "Adding new users",
          "Assigning districts and provinces",
          "Editing user profiles",
          "Understanding role permissions",
        ],
      },
      {
        title: "Registers",
        icon: FileText,
        description: `Working data in the system.`,
        links: [
          "Household register",
          "VCA register",
          "Mother index register",
          "HTS and PMTCT registers",
        ],
        liveStat: { label: "Total records", value: formatNumber(totalRecords) },
      },
      {
        title: "Services",
        icon: Shield,
        description:
          "Track service delivery across household, VCA, and caregiver levels — filter by sub-population, drill into records, and export CSVs.",
        links: [
          "Household services",
          "VCA services",
          "Caregiver services",
          "Data quality insights",
        ],
      },
      {
        title: "Data Quality",
        icon: Settings,
        description:
          "Review flagged forms, monitor district performance, and use the DQA tools to improve data integrity.",
        links: [
          "Flagged records review",
          "Data quality insight cards",
          "Exporting service data",
          "District-level reporting",
        ],
      },
      {
        title: "Troubleshooting",
        icon: HelpCircle,
        description: "Common issues, fixes, and how to reach the support team.",
        links: [
          "Login and access issues",
          "Data not loading",
          "Export problems",
          "Contacting support",
        ],
      },
    ],
    [
      householdsQuery.data,
      vcasQuery.data,
      mothersQuery.data,
      totalRecords,
      userRole,
      userScope,
    ],
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return docSections;
    const query = searchQuery.toLowerCase();
    return docSections
      .map((section) => {
        const matchesTitle = section.title.toLowerCase().includes(query);
        const matchesDesc = section.description.toLowerCase().includes(query);
        const filteredLinks = section.links.filter((link) =>
          link.toLowerCase().includes(query),
        );
        if (matchesTitle || matchesDesc || filteredLinks.length > 0) {
          return {
            ...section,
            links: matchesTitle || matchesDesc ? section.links : filteredLinks,
            isPartialMatch:
              !matchesTitle && !matchesDesc && filteredLinks.length > 0,
          } as DocSection;
        }
        return null;
      })
      .filter(Boolean) as DocSection[];
  }, [searchQuery, docSections]);

  const highlightMatch = (text: string, query: string) => {
    if (!query || !text.toLowerCase().includes(query.toLowerCase()))
      return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span
              key={i}
              className="bg-emerald-100 text-emerald-700 font-bold px-0.5 rounded"
            >
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </span>
    );
  };

  return (
    <DashboardLayout subtitle="System Documentation">
      <div className="space-y-10 animate-in fade-in duration-500">
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold transition-all p-0 hover:bg-transparent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 group-hover:bg-emerald-50 transition-all">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back
          </Button>
        </div>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 bg-white/70 backdrop-blur-xl shadow-[0_30px_80px_-50px_rgba(15,118,110,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_30%,rgba(14,165,233,0.15),transparent_45%)]" />
          <div className="pointer-events-none absolute -top-40 -left-32 h-[24rem] w-[24rem] rounded-full bg-emerald-300/40 blur-[110px] animate-pulse [animation-duration:6s]" />
          <div className="pointer-events-none absolute -bottom-32 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-sky-300/30 blur-[120px] animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

          <div className="relative z-10 flex flex-col gap-4 px-5 py-6 sm:px-7 sm:py-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Knowledge base
                </span>
                <span className="text-slate-400 text-[11px]">·</span>
                <span className="text-[11px] text-slate-600">
                  {new Date().toLocaleDateString("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 gap-1 border-emerald-200 bg-emerald-50/80 text-[10px] text-emerald-700"
                >
                  <Activity className="h-3 w-3" /> {docSections.length} sections
                </Badge>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-sky-700 bg-clip-text text-transparent">
                  How can we help you today?
                </span>
                <Badge
                  variant="outline"
                  className="ml-2 gap-1 border-emerald-200 bg-white/70 align-middle text-[10px] text-emerald-700 shadow-sm"
                >
                  <Sparkles className="h-3 w-3" /> Guides · FAQs · How-tos
                </Badge>
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Browse comprehensive help docs for the ECAP+ Program Management
                Platform.
              </p>
            </div>
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for articles, guides, and more…"
                className="pl-9 pr-20 h-11 bg-white/90 border-slate-200 focus-visible:ring-emerald-500/30 backdrop-blur-md"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-12 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-emerald-50 rounded text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                Search
              </div>
            </div>
          </div>
        </div>

        {searchQuery && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Showing results for "
            <span className="font-semibold text-slate-900">{searchQuery}</span>"
            <Badge
              variant="secondary"
              className="ml-2 bg-slate-100 text-slate-600"
            >
              {filteredSections.length} categories found
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {filteredSections.map((section, idx) => (
            <Card
              key={idx}
              className="hover:shadow-lg transition-all duration-300 border-slate-100 overflow-hidden group hover:-translate-y-1 relative"
            >
              {section.isPartialMatch && (
                <div className="absolute top-0 right-0 p-2">
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-emerald-50 text-emerald-600 border-none"
                  >
                    Matching articles
                  </Badge>
                </div>
              )}
              <CardHeader className="bg-gradient-to-b from-emerald-50/40 to-transparent pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-1 ring-white/60 shadow-sm transition-all duration-300">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-bold group-hover:text-emerald-600 transition-colors">
                        {highlightMatch(section.title, searchQuery)}
                      </CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2 mt-1 text-xs leading-relaxed">
                      {highlightMatch(section.description, searchQuery)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {section.links.map((link, lIdx) => (
                    <li
                      key={lIdx}
                      className="flex items-center gap-3 group/link cursor-pointer"
                      onClick={() => navigate(`/documentation/${toSlug(link)}`)}
                    >
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover/link:bg-emerald-100 group-hover/link:text-emerald-600 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-slate-600 group-hover/link:text-emerald-600 group-hover/link:underline transition-colors font-medium">
                        {highlightMatch(link, searchQuery)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredSections.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 text-slate-300 mb-4">
              <Search className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              No matching documentation found
            </h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Try a different keyword or browse the categories above.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-emerald-600 font-bold hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        <div className="relative mt-12 group">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-br from-emerald-400/40 via-teal-400/30 to-sky-400/30 blur-md opacity-70 group-hover:opacity-100 transition-opacity"
          />
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 p-8 text-white shadow-[0_30px_80px_-30px_rgba(15,118,110,0.6)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
            <div className="pointer-events-none absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl animate-pulse [animation-duration:6s]" />
            <div className="pointer-events-none absolute left-0 bottom-0 w-96 h-96 bg-emerald-200/15 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl animate-pulse [animation-duration:8s] [animation-delay:-3s]" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30 shadow-md">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
                    <HelpCircle className="h-3 w-3" />
                    Live support
                  </div>
                  <h2 className="text-3xl font-extrabold tracking-tight">
                    Need more help?
                  </h2>
                  <p className="max-w-xl text-emerald-50/90 text-sm leading-relaxed">
                    Can't find what you're looking for? Our support team is
                    ready to help.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/support")}
                className="group/btn inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-emerald-700 shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-50 active:scale-95"
              >
                Contact support
                <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Documentation;
