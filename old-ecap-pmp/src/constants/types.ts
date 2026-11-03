/**
 * Types mirroring the paper "Training Attendance Log" form.
 *
 * The form has two levels:
 *   - Training: the header block, filled once per training event.
 *   - TrainingParticipant: one numbered row per trainee.
 *
 * When the backend table lands, aim for the API to return exactly
 * `TrainingLog` and nothing on the page needs to change.
 */

export const PARTNERS = ["PCZ", "BISO", "ZCCB", "Blue Code"] as const;
export type Partner = (typeof PARTNERS)[number];

export const TARGET_AUDIENCES = [
  "Trainer of Trainers",
  "MOH/DHO Staff",
  "HF Staff",
  "CHW",
  "Other",
] as const;
export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

/** The form has room for 22 sessions. */
export const MAX_SESSIONS = 22;

export interface TrainingSession {
  /** 1-based, matches "Session N" on the form. */
  number: number;
  title: string;
}

export interface Training {
  id: string;
  /** "Title of Training" */
  title: string;
  /** "Name of the training materials / manual used" */
  materials: string;
  /** "Partner Supporting Training" */
  partner: Partner;
  healthFacility: string;
  /** "Training / Activity Site" */
  site: string;
  /** "District of Training Site" */
  district: string;
  /** "Name(s) of Trainer(s)/Facilitator(s)" — "Surname, First name" each */
  trainers: string[];
  /** ISO date, YYYY-MM-DD */
  startDate: string;
  /** ISO date, YYYY-MM-DD */
  endDate: string;
  /** "Is it Training of Master Trainers?" */
  isMasterTrainerTraining: boolean;
  targetAudience: TargetAudience[];
  /** Free text when "Other (specify)" is ticked. */
  targetAudienceOther?: string;
  /** "Total Number of Sessions to be Covered" */
  totalSessions: number;
  /** "Number of Training Hours Total" */
  totalHours: number;
  sessions: TrainingSession[];
}

export interface TrainingParticipant {
  id: string;
  trainingId: string;
  /** "#" column on the form */
  rowNumber: number;
  /** "Surname, First name" */
  name: string;
  /** "NRC #" — Zambian NRC, e.g. 123456/10/1 */
  nrc: string;
  sex: "Male" | "Female";
  /** "Designation / Institution" — a single free-text field on the form */
  designation: string;
  /**
   * One entry per session, index 0 = Session 1. Length = training.totalSessions.
   *   true  → signed for that session (present)
   *   false → session held, no signature (absent)
   *   null  → session not held yet
   */
  attendance: (boolean | null)[];
  /** "Completed Training (Yes/No)" — null until the training ends */
  completedTraining: boolean | null;
  /** Percentage, 0–100 */
  preTest: number | null;
  /** Percentage, 0–100 */
  postTest: number | null;
  /** "Certified? (Yes/No)" — null until the training ends */
  certified: boolean | null;
}

export interface TrainingLog {
  trainings: Training[];
  participants: TrainingParticipant[];
}
