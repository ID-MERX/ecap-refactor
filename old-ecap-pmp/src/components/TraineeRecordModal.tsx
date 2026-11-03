import { useEffect, useState } from "react";
import { ChevronDown, FileDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  attendancePct,
  audienceLabel,
  formatChange,
  formatDate,
  formatDateRange,
  formatScore,
  STATUS_META,
  yesNo,
  type Enrollment,
} from "@/constants/utils";

interface TraineeRecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every training this person attended, the one they clicked first. */
  enrollments: Enrollment[];
}

const TraineeRecordModal = ({
  open,
  onOpenChange,
  enrollments,
}: TraineeRecordModalProps) => {
  const person = enrollments[0]?.participant;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pdfState, setPdfState] = useState<"idle" | "working" | "error">("idle");

  // The training they clicked opens expanded; the rest start collapsed so a
  // person with five trainings doesn't get a wall of tables.
  useEffect(() => {
    if (open && enrollments[0]) setExpanded(new Set([enrollments[0].id]));
    if (open) setPdfState("idle");
  }, [open, enrollments]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDownloadPdf = async () => {
    setPdfState("working");
    try {
      const { downloadTraineeRecordPdf } = await import("@/constants/pdf");
      downloadTraineeRecordPdf(enrollments);
      setPdfState("idle");
    } catch (error) {
      console.error("Trainee PDF export failed:", error);
      setPdfState("error");
    }
  };

  if (!person) return null;

  const certified = enrollments.filter((e) => e.status === "certified").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="sticky top-0 z-10 border-b bg-white px-6 pb-4 pt-6 text-left">
          <div className="flex flex-col gap-3 pr-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-xl text-slate-900">{person.name}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-500">
                NRC <span className="font-mono text-slate-700">{person.nrc}</span>
                <span className="mx-2 text-slate-300">|</span>
                {person.sex}
              </DialogDescription>
              <p className="mt-1 text-sm text-slate-600">{person.designation}</p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              <Button
                size="sm"
                className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDownloadPdf}
                disabled={pdfState === "working"}
              >
                {pdfState === "working" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Download PDF
              </Button>
              {pdfState === "error" && (
                <p className="text-xs text-rose-600">
                  The PDF couldn't be created. Try again.
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {enrollments.length === 1
              ? "1 training"
              : `${enrollments.length} trainings`}
            , certified in {certified}
          </p>
        </DialogHeader>

        <div className="space-y-3 px-6 py-5">
          {enrollments.map((e) => (
            <TrainingSection
              key={e.id}
              enrollment={e}
              isOpen={expanded.has(e.id)}
              onToggle={() => toggle(e.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── One training ────────────────────────────────────────────────────

const TrainingSection = ({
  enrollment: e,
  isOpen,
  onToggle,
}: {
  enrollment: Enrollment;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  const { participant: p, training: t } = e;
  const status = STATUS_META[e.status];
  const pct = attendancePct(e);
  const missed = t.sessions.filter((s) => p.attendance[s.number - 1] === false);
  const panelId = `training-panel-${e.id}`;

  return (
    <section className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{t.title}</p>
          <p className="text-xs text-slate-500">
            {formatDateRange(t.startDate, t.endDate)}, {t.district}
          </p>
        </div>
        <Badge className={status.badgeClass}>{status.label}</Badge>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div id={panelId} className="space-y-5 border-t border-slate-100 px-4 pb-4 pt-4">
          {/* Results */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Attendance"
              value={`${e.attended} of ${e.held}`}
              note={
                pct === null
                  ? "No sessions held yet"
                  : e.held < t.totalSessions
                    ? `${pct}%, ${t.totalSessions - e.held} sessions to go`
                    : `${pct}%`
              }
              tone={pct !== null && pct < 80 ? "warn" : "default"}
            />
            <Stat
              label="Test scores"
              value={`${formatScore(p.preTest)} → ${formatScore(p.postTest)}`}
              note={e.scoreChange === null ? "Pre-test to post-test" : `${formatChange(e.scoreChange)} points`}
            />
            <Stat label="Completed" value={yesNo(p.completedTraining)} note={p.completedTraining === null ? "Recorded when it ends" : undefined} />
            <Stat label="Certified" value={yesNo(p.certified)} note={p.certified === null ? "Recorded when it ends" : undefined} />
          </div>

          {/* Attendance by session */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-slate-900">Attendance by session</h4>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <Legend className="bg-emerald-500" label="Present" />
                <Legend className="border border-rose-300 bg-rose-50" label="Absent" />
                <Legend className="border border-dashed border-slate-300 bg-white" label="Not held yet" />
              </div>
            </div>
            <ol className="flex flex-wrap gap-1.5">
              {t.sessions.map((s) => {
                const a = p.attendance[s.number - 1];
                const state = a === null || a === undefined ? "Not held yet" : a ? "Present" : "Absent";
                const cls =
                  a === true
                    ? "bg-emerald-500 text-white"
                    : a === false
                      ? "border border-rose-300 bg-rose-50 text-rose-700"
                      : "border border-dashed border-slate-300 text-slate-400";
                return (
                  <li
                    key={s.number}
                    title={`Session ${s.number}: ${s.title} — ${state}`}
                    aria-label={`Session ${s.number}, ${s.title}: ${state}`}
                    className={`flex h-8 w-8 items-center justify-center rounded text-xs font-medium ${cls}`}
                  >
                    {s.number}
                  </li>
                );
              })}
            </ol>
            {missed.length > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-medium text-rose-700">Missed:</span>{" "}
                {missed.map((s) => `${s.number}. ${s.title}`).join("; ")}
              </p>
            )}
          </div>

          {/* Training details */}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Detail label="Training ID" value={t.id} mono />
            <Detail label="Partner" value={t.partner} />
            <Detail label="Health facility" value={t.healthFacility} />
            <Detail label="Training site" value={t.site} />
            <Detail label="Dates" value={`${formatDate(t.startDate)} to ${formatDate(t.endDate)}`} />
            <Detail label="Sessions and hours" value={`${t.totalSessions} sessions, ${t.totalHours} hours`} />
            <Detail label="Target audience" value={audienceLabel(t)} />
            <Detail label="Master trainers" value={t.isMasterTrainerTraining ? "Yes" : "No"} />
            <Detail label="Trainers" value={t.trainers.join("; ")} />
            <Detail label="Materials" value={t.materials} />
          </dl>
        </div>
      )}
    </section>
  );
};

const Stat = ({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "warn";
}) => (
  <div className="rounded-md bg-slate-50 px-3 py-2">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`mt-0.5 font-semibold ${tone === "warn" ? "text-rose-700" : "text-slate-900"}`}>
      {value}
    </p>
    {note && <p className="text-xs text-slate-500">{note}</p>}
  </div>
);

const Detail = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex gap-3">
    <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
    <dd className={`min-w-0 text-slate-800 ${mono ? "font-mono text-xs leading-5" : ""}`}>{value}</dd>
  </div>
);

const Legend = ({ className, label }: { className: string; label: string }) => (
  <span className="flex items-center gap-1">
    <span className={`inline-block h-3 w-3 rounded-sm ${className}`} />
    {label}
  </span>
);

export default TraineeRecordModal;
