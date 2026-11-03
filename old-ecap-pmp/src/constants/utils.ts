import {
  MAX_SESSIONS,
  type Training,
  type TrainingLog,
  type TrainingParticipant,
} from "./types";

export type EnrollmentStatus =
  | "certified"
  | "completed"
  | "in_progress"
  | "not_completed";

export const STATUS_META: Record<
  EnrollmentStatus,
  { label: string; badgeClass: string }
> = {
  certified: {
    label: "Certified",
    badgeClass: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  },
  in_progress: {
    label: "In progress",
    badgeClass: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  not_completed: {
    label: "Did not complete",
    badgeClass: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  },
};

/** One trainee in one training — a single row on the paper form. */
export interface Enrollment {
  id: string;
  participant: TrainingParticipant;
  training: Training;
  status: EnrollmentStatus;
  /** Sessions held so far. */
  held: number;
  /** Sessions the trainee signed for. */
  attended: number;
  scoreChange: number | null;
  /** Groups the same person across trainings (by NRC, falling back to name). */
  personKey: string;
  /** Pre-lowercased haystack so search stays fast with thousands of rows. */
  searchText: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDateRange = (start: string, end: string) =>
  start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;

export const yesNo = (value: boolean | null) =>
  value === null ? "—" : value ? "Yes" : "No";

export const formatScore = (value: number | null) =>
  value === null ? "—" : `${value}%`;

export const formatChange = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value}`;

export const attendancePct = (e: Pick<Enrollment, "attended" | "held">) =>
  e.held > 0 ? Math.round((e.attended / e.held) * 100) : null;

export const audienceLabel = (t: Training) =>
  t.targetAudience
    .map((a) =>
      a === "Other" && t.targetAudienceOther ? `Other (${t.targetAudienceOther})` : a,
    )
    .join(", ");

export const getPersonKey = (p: TrainingParticipant) => {
  const digits = p.nrc.replace(/\D/g, "");
  return digits ? `nrc:${digits}` : `name:${p.name.trim().toLowerCase()}`;
};

export const getEnrollmentStatus = (
  p: TrainingParticipant,
  t: Training,
  todayIso: string,
): EnrollmentStatus => {
  if (p.certified) return "certified";
  if (p.completedTraining) return "completed";
  if (t.endDate >= todayIso) return "in_progress";
  return "not_completed";
};

export const buildEnrollments = (
  log: TrainingLog,
  today: Date = new Date(),
): Enrollment[] => {
  const todayIso = toIsoDate(today);
  const trainingsById = new Map(log.trainings.map((t) => [t.id, t]));
  const enrollments: Enrollment[] = [];

  for (const p of log.participants) {
    const t = trainingsById.get(p.trainingId);
    if (!t) continue;

    enrollments.push({
      id: p.id,
      participant: p,
      training: t,
      status: getEnrollmentStatus(p, t, todayIso),
      held: p.attendance.filter((a) => a !== null).length,
      attended: p.attendance.filter((a) => a === true).length,
      scoreChange:
        p.preTest !== null && p.postTest !== null ? p.postTest - p.preTest : null,
      personKey: getPersonKey(p),
      searchText: [
        p.name,
        p.nrc,
        p.nrc.replace(/\D/g, ""),
        p.designation,
        t.title,
        t.healthFacility,
        t.site,
        t.district,
        t.id,
      ]
        .join(" ")
        .toLowerCase(),
    });
  }

  return enrollments.sort(
    (a, b) =>
      b.training.startDate.localeCompare(a.training.startDate) ||
      a.training.id.localeCompare(b.training.id) ||
      a.participant.rowNumber - b.participant.rowNumber,
  );
};

/** Text search that also matches an NRC typed without slashes. */
export const matchesSearch = (e: Enrollment, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).every((term) => e.searchText.includes(term));
};

// ─── CSV ─────────────────────────────────────────────────────────────
// One row per trainee per training, with every form field flattened out and
// one column per session so it opens cleanly in Excel.

export const CSV_HEADERS = [
  "Training ID",
  "Training Title",
  "Training Materials / Manual",
  "Partner",
  "Health Facility",
  "Training Site",
  "District",
  "Trainers",
  "Start Date",
  "End Date",
  "Training of Master Trainers",
  "Target Audience",
  "Total Sessions",
  "Total Hours",
  "#",
  "Name",
  "NRC",
  "Sex",
  "Designation / Institution",
  "Sessions Held",
  "Sessions Attended",
  "Attendance %",
  "Pre-test %",
  "Post-test %",
  "Score Change",
  "Completed Training",
  "Certified",
  "Status",
  ...Array.from({ length: MAX_SESSIONS }, (_, i) => `Session ${i + 1}`),
];

const sessionCell = (value: boolean | null | undefined) =>
  value === undefined ? "" : value === null ? "Not held" : value ? "Present" : "Absent";

export const enrollmentsToCsvRows = (enrollments: Enrollment[]): string[][] =>
  enrollments.map((e) => {
    const { participant: p, training: t } = e;
    const pct = attendancePct(e);
    return [
      t.id,
      t.title,
      t.materials,
      t.partner,
      t.healthFacility,
      t.site,
      t.district,
      t.trainers.join("; "),
      t.startDate,
      t.endDate,
      t.isMasterTrainerTraining ? "Yes" : "No",
      audienceLabel(t),
      String(t.totalSessions),
      String(t.totalHours),
      String(p.rowNumber),
      p.name,
      p.nrc,
      p.sex,
      p.designation,
      String(e.held),
      String(e.attended),
      pct === null ? "" : String(pct),
      p.preTest === null ? "" : String(p.preTest),
      p.postTest === null ? "" : String(p.postTest),
      e.scoreChange === null ? "" : String(e.scoreChange),
      p.completedTraining === null ? "" : yesNo(p.completedTraining),
      p.certified === null ? "" : yesNo(p.certified),
      STATUS_META[e.status].label,
      ...Array.from({ length: MAX_SESSIONS }, (_, i) =>
        i < t.totalSessions ? sessionCell(p.attendance[i]) : "",
      ),
    ];
  });
