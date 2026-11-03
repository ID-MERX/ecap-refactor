/**
 * Fake training log for testing the page before the backend table exists.
 *
 * Seeded, so the data is the same on every load — a trainee you open today is
 * still there tomorrow, which makes reviewing the UI with others much easier.
 * Dates are generated relative to today so there are always a few trainings
 * in progress.
 *
 * Everything here — names, NRCs, facilities — is invented.
 * Delete this file once getTrainingLog() calls the real API.
 */
import {
  PARTNERS,
  type Partner,
  type TargetAudience,
  type Training,
  type TrainingLog,
  type TrainingParticipant,
} from "./types";

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DISTRICT_FACILITIES: Record<string, string[]> = {
  Lusaka: ["Chawama Level 1 Hospital", "Matero Level 1 Hospital", "Chelstone Clinic"],
  Chipata: ["Chipata Central Hospital", "Kapata Clinic", "Mchini Clinic"],
  Kabwe: ["Kabwe Central Hospital", "Makandanyama Clinic", "Bwacha Clinic"],
  Ndola: ["Ndola Teaching Hospital", "Chipulukusu Clinic", "Kabushi Clinic"],
  Kitwe: ["Kitwe Teaching Hospital", "Chimwemwe Clinic", "Bulangililo Clinic"],
  Livingstone: ["Livingstone Teaching Hospital", "Maramba Clinic", "Linda Clinic"],
  Mansa: ["Mansa General Hospital", "Chembe Clinic"],
  Kasama: ["Kasama General Hospital", "Location Clinic"],
  Solwezi: ["Solwezi General Hospital", "Kyawama Clinic"],
  Mongu: ["Lewanika General Hospital", "Mongu Urban Clinic"],
};
const DISTRICTS = Object.keys(DISTRICT_FACILITIES);

const SURNAMES = [
  "Banda", "Phiri", "Mwale", "Tembo", "Zulu", "Mulenga", "Chanda", "Mwansa",
  "Bwalya", "Musonda", "Lungu", "Daka", "Ngoma", "Sakala", "Kabwe", "Chileshe",
  "Mumba", "Siame", "Simukonda", "Nyirenda", "Hamweene", "Mutale", "Kalaba",
  "Chibwe", "Mubanga", "Sichone", "Mwila", "Kunda", "Lubinda", "Mukuka",
];
const MALE_NAMES = [
  "Chola", "Kelvin", "Joseph", "Moses", "Brian", "Emmanuel", "Patrick",
  "Lazarus", "Mapalo", "Chisanga", "Davies", "Fred", "Kondwani", "Nathan",
];
const FEMALE_NAMES = [
  "Mwape", "Chipo", "Natasha", "Grace", "Mercy", "Esther", "Precious", "Agnes",
  "Ruth", "Thandiwe", "Memory", "Beatrice", "Charity", "Namakau", "Towela",
];
const ROLES = [
  "Community Health Worker", "Community Caseworker", "Adherence Supporter",
  "Nurse", "Clinical Officer", "Midwife", "Psychosocial Counsellor",
  "Data Associate", "District M&E Officer", "Social Welfare Officer",
  "Case Management Supervisor",
];

const SHARED_TAIL = [
  "Practical field exercise",
  "Case study review",
  "Role play and feedback",
  "Group presentations",
  "Field visit debrief",
  "Review of key concepts",
  "Action planning",
  "Post-test and evaluation",
  "Closing and certification",
];

interface Curriculum {
  title: string;
  materials: string;
  tot: boolean;
  sessionRange: [number, number];
  audiences: TargetAudience[];
  topics: string[];
}

const CURRICULA: Curriculum[] = [
  {
    title: "Case Management for OVC Caseworkers",
    materials: "ECAP+ Case Management Training Manual (2025)",
    tot: false,
    sessionRange: [10, 22],
    audiences: ["CHW", "HF Staff"],
    topics: [
      "Introduction and pre-test", "Programme overview", "Roles of the caseworker",
      "Household enrolment", "Vulnerability assessment", "Case plan development",
      "Referrals and linkages", "Follow-up visits", "Graduation benchmarks",
      "Using the ECAP+ mobile app", "Documentation standards", "Confidentiality and ethics",
      "Economic strengthening",
    ],
  },
  {
    title: "HIV Testing Services Refresher",
    materials: "MOH Consolidated HIV Guidelines, HTS chapter",
    tot: false,
    sessionRange: [6, 12],
    audiences: ["HF Staff", "CHW"],
    topics: [
      "Introduction and pre-test", "HTS approaches and testing algorithm",
      "Pre-test information", "Index testing", "Self-testing distribution",
      "Linkage to treatment", "Quality assurance and proficiency testing",
      "HTS register documentation",
    ],
  },
  {
    title: "PMTCT Mother-Baby Pair Follow-up",
    materials: "National PMTCT Implementation Guide",
    tot: false,
    sessionRange: [8, 16],
    audiences: ["HF Staff", "CHW"],
    topics: [
      "Introduction and pre-test", "PMTCT cascade overview", "ANC HIV testing and retesting",
      "ART for pregnant and breastfeeding women", "Infant prophylaxis",
      "Early infant diagnosis", "Viral load monitoring", "Tracing missed appointments",
      "Mother-baby pair register", "Infant feeding counselling",
    ],
  },
  {
    title: "Child Protection and Safeguarding",
    materials: "Child Safeguarding Policy and Procedures Handbook",
    tot: false,
    sessionRange: [6, 10],
    audiences: ["CHW", "HF Staff", "MOH/DHO Staff"],
    topics: [
      "Introduction and pre-test", "Forms of child abuse", "Recognising signs of abuse",
      "Reporting pathways", "Working with the Victim Support Unit",
      "Safeguarding code of conduct", "Supporting survivors",
    ],
  },
  {
    title: "Data Quality and Mobile Data Collection",
    materials: "ECAP+ Data Quality Assessment Toolkit",
    tot: false,
    sessionRange: [6, 12],
    audiences: ["HF Staff", "MOH/DHO Staff"],
    topics: [
      "Introduction and pre-test", "Data quality dimensions", "Indicator definitions",
      "Tablet setup and syncing", "Common form errors", "Duplicate records",
      "Running a DQA", "Using the PMP dashboard",
    ],
  },
  {
    title: "Psychosocial Support Fundamentals",
    materials: "REPSSI Psychosocial Support Facilitator Guide",
    tot: false,
    sessionRange: [8, 14],
    audiences: ["CHW", "Other"],
    topics: [
      "Introduction and pre-test", "Wellbeing and resilience", "Grief and loss",
      "Communicating with children", "Adolescent mental health",
      "Caregiver stress", "Support groups", "Referral for specialised care",
    ],
  },
  {
    title: "Training of Trainers: Case Management",
    materials: "ECAP+ Case Management ToT Facilitator Guide",
    tot: true,
    sessionRange: [14, 22],
    audiences: ["Trainer of Trainers"],
    topics: [
      "Introduction and pre-test", "Adult learning principles", "Facilitation skills",
      "Programme overview", "Vulnerability assessment", "Case plan development",
      "Referrals and linkages", "Graduation benchmarks", "Using the ECAP+ mobile app",
      "Planning a cascade training", "Supportive supervision", "Teach-back session 1",
      "Teach-back session 2",
    ],
  },
];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};
const dayDiff = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

interface Person {
  name: string;
  nrc: string;
  sex: "Male" | "Female";
  designation: string;
  district: string;
  reliability: number;
  aptitude: number;
  /** Date ranges already booked, so nobody attends two trainings at once. */
  busy: [string, string][];
}

export interface MockOptions {
  trainingCount?: number;
  peopleCount?: number;
  seed?: number;
  today?: Date;
}

export const generateMockTrainingLog = ({
  trainingCount = 32,
  peopleCount = 540,
  seed = 20261014,
  today = new Date(),
}: MockOptions = {}): TrainingLog => {
  const rand = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
  const chance = (p: number) => rand() < p;
  const shuffle = <T,>(items: T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // ── People pool. Each belongs to a district so most trainings draw locals,
  //    and the same person naturally turns up in several trainings.
  const usedNrcs = new Set<string>();
  const people: Person[] = Array.from({ length: peopleCount }, () => {
    const sex = chance(0.62) ? "Female" : "Male";
    const first = pick(sex === "Female" ? FEMALE_NAMES : MALE_NAMES);
    const district = pick(DISTRICTS);
    let nrc = "";
    do {
      nrc = `${int(100000, 999999)}/${pad(int(10, 99))}/1`;
    } while (usedNrcs.has(nrc));
    usedNrcs.add(nrc);

    const role = pick(ROLES);
    const institution = role.startsWith("District")
      ? `${district} District Health Office`
      : role === "Social Welfare Officer"
        ? `${district} Social Welfare Office`
        : pick(DISTRICT_FACILITIES[district]);

    return {
      name: `${pick(SURNAMES)}, ${first}`,
      nrc,
      sex,
      designation: `${role}, ${institution}`,
      district,
      reliability: chance(0.12) ? 0.45 + rand() * 0.3 : 0.86 + rand() * 0.14,
      aptitude: rand(),
      busy: [],
    };
  });

  const trainings: Training[] = [];
  const participants: TrainingParticipant[] = [];

  for (let i = 0; i < trainingCount; i++) {
    const curriculum = pick(CURRICULA);
    const district = pick(DISTRICTS);
    const healthFacility = pick(DISTRICT_FACILITIES[district]);
    const partner: Partner = pick(PARTNERS);

    // The first few are in progress; the rest are spread over the past ~10 months.
    const ongoing = i < 3;
    const start = ongoing ? addDays(midnight, -int(1, 4)) : addDays(midnight, -int(12, 310));
    const durationDays = int(2, 9);
    const end = addDays(start, durationDays);

    const totalSessions = int(curriculum.sessionRange[0], curriculum.sessionRange[1]);
    const titles = [...curriculum.topics, ...SHARED_TAIL];
    const sessions = Array.from({ length: totalSessions }, (_, s) => ({
      number: s + 1,
      title:
        s === totalSessions - 1
          ? "Post-test and closing"
          : titles[s] ?? `Practical session ${s + 1}`,
    }));

    const audience = curriculum.tot
      ? (["Trainer of Trainers"] as TargetAudience[])
      : shuffle(curriculum.audiences).slice(0, int(1, curriculum.audiences.length));

    const trainerCount = int(1, 3);
    const trainers = Array.from(
      { length: trainerCount },
      () => `${pick(SURNAMES)}, ${pick([...MALE_NAMES, ...FEMALE_NAMES])}`,
    );

    const id = `TRN-${start.getFullYear()}-${pad(i + 1).padStart(4, "0")}`;
    const training: Training = {
      id,
      title: curriculum.title,
      materials: curriculum.materials,
      partner,
      healthFacility,
      site: pick([
        `${district} District Health Office boardroom`,
        `${healthFacility} conference room`,
        `${district} Civic Centre`,
        `${district} Community Hall`,
      ]),
      district,
      trainers,
      startDate: toIso(start),
      endDate: toIso(end),
      isMasterTrainerTraining: curriculum.tot,
      targetAudience: audience,
      targetAudienceOther: audience.includes("Other") ? "Community volunteers" : undefined,
      totalSessions,
      totalHours: Math.round(totalSessions * (1.5 + rand()) * 2) / 2,
      sessions,
    };
    trainings.push(training);

    // Sessions are spread evenly across the training's days.
    const finished = dayDiff(end, midnight) > 0;
    const elapsed = Math.max(0, dayDiff(start, midnight) + 1);
    const heldSessions = finished
      ? totalSessions
      : Math.min(totalSessions, Math.floor((totalSessions * elapsed) / (durationDays + 1)));

    const locals = shuffle(people.filter((p) => p.district === district));
    const outsiders = shuffle(people.filter((p) => p.district !== district));
    const size = int(12, 34);

    const startIso = toIso(start);
    const endIso = toIso(end);
    const isFree = (p: Person) =>
      p.busy.every(([s, e]) => endIso < s || startIso > e);
    const next = (pool: Person[]) => {
      while (pool.length) {
        const candidate = pool.pop()!;
        if (isFree(candidate)) return candidate;
      }
      return undefined;
    };

    for (let row = 1; row <= size; row++) {
      const person = (chance(0.1) ? next(outsiders) : next(locals)) ?? next(outsiders);
      if (!person) break;
      person.busy.push([startIso, endIso]);

      const attendance = Array.from({ length: totalSessions }, (_, s) =>
        s < heldSessions ? rand() < person.reliability : null,
      );
      const attendedRatio =
        heldSessions > 0 ? attendance.filter(Boolean).length / heldSessions : 0;

      const preTest = chance(0.96)
        ? Math.min(95, Math.round(28 + person.aptitude * 45 + rand() * 12))
        : null;
      const postTest =
        finished && chance(0.94)
          ? Math.min(100, Math.round((preTest ?? 45) + attendedRatio * (8 + rand() * 32)))
          : null;
      const completedTraining = finished ? attendedRatio >= 0.8 && postTest !== null : null;
      const certified = finished ? Boolean(completedTraining && (postTest ?? 0) >= 70) : null;

      participants.push({
        id: `${id}-P${pad(row)}`,
        trainingId: id,
        rowNumber: row,
        name: person.name,
        nrc: person.nrc,
        sex: person.sex,
        designation: person.designation,
        attendance,
        completedTraining,
        preTest,
        postTest,
        certified,
      });
    }
  }

  trainings.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return { trainings, participants };
};
