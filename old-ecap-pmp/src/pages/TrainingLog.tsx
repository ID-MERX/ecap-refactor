import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  CheckCircle2,
  Download,
  GraduationCap,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GlowCard from "@/components/aceternity/GlowCard";
import LoadingDots from "@/components/aceternity/LoadingDots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TraineeRecordModal from "@/components/TraineeRecordModal";
import { downloadCsv } from "@/lib/csv";
import { getTrainingLog, TRAINING_LOG_IS_MOCK } from "@/constants/api";
import { PARTNERS } from "@/constants/types";
import {
  attendancePct,
  buildEnrollments,
  CSV_HEADERS,
  enrollmentsToCsvRows,
  formatChange,
  formatDateRange,
  matchesSearch,
  STATUS_META,
  toIsoDate,
  type Enrollment,
  type EnrollmentStatus,
} from "@/constants/utils";

const ITEMS_PER_PAGE = 25;
const ALL = "all";

const TrainingLog = () => {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["training-log"],
    queryFn: getTrainingLog,
    staleTime: 5 * 60 * 1000,
  });

  const [search, setSearch] = useState("");
  const [trainingId, setTrainingId] = useState(ALL);
  const [district, setDistrict] = useState(ALL);
  const [partner, setPartner] = useState(ALL);
  const [status, setStatus] = useState<EnrollmentStatus | typeof ALL>(ALL);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Enrollment | null>(null);
  const deferredSearch = useDeferredValue(search);

  const enrollments = useMemo(
    () => (data ? buildEnrollments(data) : []),
    [data],
  );

  // ── Filter options, built from the data so they never list empty choices.
  const trainingOptions = useMemo(
    () =>
      (data?.trainings ?? []).map((t) => ({
        id: t.id,
        label: `${t.title}, ${t.district}`,
        dates: formatDateRange(t.startDate, t.endDate),
      })),
    [data],
  );
  const districtOptions = useMemo(
    () => [...new Set((data?.trainings ?? []).map((t) => t.district))].sort(),
    [data],
  );

  const filtered = useMemo(
    () =>
      enrollments.filter(
        (e) =>
          (trainingId === ALL || e.training.id === trainingId) &&
          (district === ALL || e.training.district === district) &&
          (partner === ALL || e.training.partner === partner) &&
          (status === ALL || e.status === status) &&
          matchesSearch(e, deferredSearch),
      ),
    [enrollments, trainingId, district, partner, status, deferredSearch],
  );

  const hasFilters =
    search.trim() !== "" ||
    trainingId !== ALL ||
    district !== ALL ||
    partner !== ALL ||
    status !== ALL;

  const clearFilters = () => {
    setSearch("");
    setTrainingId(ALL);
    setDistrict(ALL);
    setPartner(ALL);
    setStatus(ALL);
  };

  useEffect(() => setPage(1), [deferredSearch, trainingId, district, partner, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  useEffect(() => setPage((p) => Math.min(p, totalPages)), [totalPages]);
  const pageRows = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const firstShown = filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const lastShown = Math.min(page * ITEMS_PER_PAGE, filtered.length);

  // ── KPIs follow the filters, so picking a training shows that training's numbers.
  const kpis = useMemo(() => {
    const people = new Set(filtered.map((e) => e.personKey)).size;
    const trainings = new Set(filtered.map((e) => e.training.id)).size;
    const ended = filtered.filter((e) => e.status !== "in_progress");
    const completed = ended.filter(
      (e) => e.status === "completed" || e.status === "certified",
    ).length;
    const certified = ended.filter((e) => e.status === "certified").length;
    const pct = (n: number) =>
      ended.length ? `${Math.round((n / ended.length) * 100)}%` : "—";
    return [
      { label: "Trainees", value: people.toLocaleString(), note: `${filtered.length.toLocaleString()} enrolments`, icon: Users, color: "text-emerald-600" },
      { label: "Trainings", value: trainings.toLocaleString(), note: "with trainees in this view", icon: CalendarDays, color: "text-teal-600" },
      { label: "Completion rate", value: pct(completed), note: `${completed.toLocaleString()} of ${ended.length.toLocaleString()} finished`, icon: CheckCircle2, color: "text-blue-600" },
      { label: "Certified", value: certified.toLocaleString(), note: `${pct(certified)} of finished`, icon: Award, color: "text-violet-600" },
    ];
  }, [filtered]);

  // ── Everything this person attended, the clicked training first.
  const selectedRecords = useMemo(() => {
    if (!selected) return [];
    const others = enrollments.filter(
      (e) => e.personKey === selected.personKey && e.id !== selected.id,
    );
    return [selected, ...others];
  }, [selected, enrollments]);

  const handleExport = () => {
    const scope = hasFilters ? "filtered" : "all";
    downloadCsv(
      `training-log-${scope}-${toIsoDate(new Date())}.csv`,
      CSV_HEADERS,
      enrollmentsToCsvRows(filtered),
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">
              <GraduationCap className="h-6 w-6 text-emerald-600" />
              Training Attendance Log
              {TRAINING_LOG_IS_MOCK && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-xs font-medium text-amber-800">
                  Test data
                </Badge>
              )}
            </h1>
            <p className="text-sm text-slate-500">
              Trainees, session attendance and test results from the training log form.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={handleExport}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" />
              {hasFilters ? "Export filtered CSV" : "Export all as CSV"}
            </Button>
            <p className="text-xs text-slate-500">
              {filtered.length.toLocaleString()} rows, one per trainee per training
            </p>
          </div>
        </div>

        {error && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">The training log didn't load</p>
                <p className="text-sm text-amber-800">{(error as Error).message}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-white" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Try again
            </Button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlowCard className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {isLoading ? <LoadingDots /> : k.value}
                    </p>
                    {!isLoading && <p className="truncate text-xs text-slate-500">{k.note}</p>}
                  </div>
                  <k.icon className={`h-8 w-8 shrink-0 ${k.color}`} />
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Search by name, NRC, designation, facility or training…"
                className="h-9 pl-8 pr-8"
                aria-label="Search trainees"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <Select value={trainingId} onValueChange={setTrainingId}>
                <SelectTrigger className="h-9 bg-white" aria-label="Training">
                  <SelectValue placeholder="Training" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All trainings</SelectItem>
                  {trainingOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label} ({t.dates})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger className="h-9 bg-white" aria-label="District">
                  <SelectValue placeholder="District" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All districts</SelectItem>
                  {districtOptions.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={partner} onValueChange={setPartner}>
                <SelectTrigger className="h-9 bg-white" aria-label="Partner">
                  <SelectValue placeholder="Partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All partners</SelectItem>
                  {PARTNERS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v: string) => setStatus(v as EnrollmentStatus | typeof ALL)}>
                <SelectTrigger className="h-9 bg-white" aria-label="Status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {(Object.keys(STATUS_META) as EnrollmentStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-slate-600"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead className="hidden md:table-cell">Sex</TableHead>
                    <TableHead className="hidden lg:table-cell">Designation / Institution</TableHead>
                    <TableHead>Training</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead className="hidden sm:table-cell">Pre → Post</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center">
                        <LoadingDots />
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center">
                        <p className="text-sm text-slate-600">
                          {hasFilters
                            ? "No trainees match these filters."
                            : "No training records have been submitted yet."}
                        </p>
                        {hasFilters && (
                          <Button variant="link" size="sm" className="text-emerald-700" onClick={clearFilters}>
                            Clear filters
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((e) => (
                      <EnrollmentRow key={e.id} enrollment={e} onOpen={() => setSelected(e)} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-slate-500">
              Showing {firstShown.toLocaleString()}–{lastShown.toLocaleString()} of{" "}
              {filtered.length.toLocaleString()}
            </p>
            {totalPages > 1 && (
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive>
                      {page} / {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>

      <TraineeRecordModal
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        enrollments={selectedRecords}
      />
    </DashboardLayout>
  );
};

// ─── Row ─────────────────────────────────────────────────────────────

const EnrollmentRow = ({
  enrollment: e,
  onOpen,
}: {
  enrollment: Enrollment;
  onOpen: () => void;
}) => {
  const { participant: p, training: t } = e;
  const pct = attendancePct(e);
  const statusMeta = STATUS_META[e.status];

  return (
    <TableRow
      onClick={onOpen}
      onKeyDown={(ev: KeyboardEvent<HTMLTableRowElement>) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onOpen();
        }
      }}
      tabIndex={0}
      aria-label={`Open training record for ${p.name}`}
      className="cursor-pointer focus-visible:bg-emerald-50/60 focus-visible:outline-none"
    >
      <TableCell>
        <p className="font-medium text-slate-900">{p.name}</p>
        <p className="font-mono text-xs text-slate-500">{p.nrc}</p>
      </TableCell>
      <TableCell className="hidden text-sm text-slate-600 md:table-cell">{p.sex}</TableCell>
      <TableCell className="hidden max-w-[220px] text-sm text-slate-600 lg:table-cell">
        <span className="line-clamp-2" title={p.designation}>{p.designation}</span>
      </TableCell>
      <TableCell className="max-w-[240px]">
        <p className="truncate text-sm text-slate-800" title={t.title}>{t.title}</p>
        <p className="text-xs text-slate-500">
          {formatDateRange(t.startDate, t.endDate)}, {t.district}
        </p>
      </TableCell>
      <TableCell>
        {pct === null ? (
          <span className="text-xs text-slate-400">Not started</span>
        ) : (
          <div className="w-24">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700">{e.attended}/{e.held}</span>
              <span className={pct < 80 ? "font-medium text-rose-600" : "text-slate-500"}>{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${pct < 80 ? "bg-rose-400" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-sm sm:table-cell">
        <span className="text-slate-700">
          {p.preTest ?? "—"} → {p.postTest ?? "—"}
        </span>
        {e.scoreChange !== null && (
          <span className={`ml-1.5 text-xs ${e.scoreChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatChange(e.scoreChange)}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={`whitespace-nowrap ${statusMeta.badgeClass}`}>{statusMeta.label}</Badge>
      </TableCell>
    </TableRow>
  );
};

export default TrainingLog;
