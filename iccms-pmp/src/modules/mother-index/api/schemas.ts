export type MotherAnswer = "yes" | "no" | "unknown";

export type MotherRecord = {
  rowId: string;
  motherId: string;
  householdId: string;
  ecapId: string;
  district: string;
  province: string;
  facility: string;
  partner: string;
  homeAddress: string;
  landmark: string;
  hivStatus: string;
  hivAnswer: MotherAnswer;
  artStatus: string;
  onArt: MotherAnswer;
  heiStatus: string;
  hei: MotherAnswer;
  linkageStatus: string;
  linked: MotherAnswer;
  sex: string;
  dateOfBirth: string;
  enrolledDate: string | null;
  updatedAt: string | null;
  childCount: string;
};

export type MotherListResult = {
  rows: ReadonlyArray<MotherRecord>;
  truncatedDistricts: ReadonlyArray<string>;
};

export type HouseholdChild = {
  id: string;
  householdId: string;
  district: string;
  facility: string;
  age: string;
  sex: string;
  isIndex: boolean;
  hivPositive: boolean | null;
};

export type MotherProfileResult = {
  mother: MotherRecord | null;
  children: ReadonlyArray<HouseholdChild>;
  truncatedDistricts: ReadonlyArray<string>;
};

function text(value: unknown, fallback = "N/A"): string {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function firstText(record: Record<string, unknown>, fields: ReadonlyArray<string>): string {
  for (const field of fields) {
    const value = record[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") return text(value);
  }
  return "N/A";
}

function answer(value: string): MotherAnswer {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.includes("not linked") ||
    normalized.includes("unlinked") ||
    normalized.includes("not on art") ||
    normalized.includes("not positive") ||
    normalized.includes("negative") ||
    normalized.includes("non-reactive")
  )
    return "no";
  if (
    ["yes", "true", "1", "active", "positive", "linked", "on art"].includes(normalized) ||
    normalized.includes("hiv positive") ||
    normalized.includes("linked")
  )
    return "yes";
  if (["no", "false", "0", "inactive", "off art"].includes(normalized)) return "no";
  return "unknown";
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const source = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/.exec(source);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(source);
    if (!dmy) return null;
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstDate(record: Record<string, unknown>, fields: ReadonlyArray<string>): string | null {
  for (const field of fields) {
    const date = parseDate(record[field]);
    if (date) return date;
  }
  return null;
}

export function normalizeMotherRecord(record: Record<string, unknown>): MotherRecord {
  const motherId = firstText(record, ["mother_id", "household_id", "ecap_id"]);
  const householdId = firstText(record, [
    "household_id",
    "hh_id",
    "household",
    "householdId",
    "hhid",
    "household_unique_id",
    "household_uid",
    "hhId",
    "HH_ID",
    "HHID",
  ]);
  const hivStatus = firstText(record, ["caregiver_hiv_status", "hiv_status", "user_select_hiv"]);
  const artStatus = firstText(record, ["art_status", "on_art", "art_linkage"]);
  const heiStatus = firstText(record, ["hei", "hei_status"]);
  const linkageStatus = firstText(record, ["linked", "linkage_status"]);
  return {
    rowId: motherId,
    motherId,
    householdId,
    ecapId: firstText(record, ["ecap_id", "ecapid"]),
    district: firstText(record, ["district", "district_name"]),
    province: firstText(record, ["province"]),
    facility: firstText(record, ["facility", "facility_name"]),
    partner: firstText(record, ["partner", "partner_name"]),
    homeAddress: firstText(record, ["homeaddress", "home_address", "address"]),
    landmark: firstText(record, ["landmark", "nearest_landmark"]),
    hivStatus,
    hivAnswer: answer(hivStatus),
    artStatus,
    onArt: answer(artStatus),
    heiStatus,
    hei: answer(heiStatus),
    linkageStatus,
    linked: answer(linkageStatus),
    sex: firstText(record, ["caregiver_sex", "sex", "gender"]),
    dateOfBirth: firstText(record, [
      "caregiver_birth_date",
      "caregiver_birthdate",
      "dob",
      "date_of_birth",
    ]),
    enrolledDate: firstDate(record, [
      "mother_screening_date",
      "anc_date",
      "date_enrolled",
      "registration_date",
      "created_at",
    ]),
    updatedAt: firstDate(record, ["updated_at", "date_created", "created_at", "anc_date"]),
    childCount: firstText(record, ["child_count", "children_count"]),
  };
}

export function normalizeHouseholdChild(record: Record<string, unknown>): HouseholdChild {
  const rawPositive = firstText(record, ["is_hiv_positive", "hiv_status"]);
  const parsedPositive = answer(rawPositive);
  const isIndexValue = firstText(record, ["is_index"]);
  return {
    id: firstText(record, ["uid", "vca_id", "unique_id", "id"]),
    householdId: firstText(record, ["household_id", "hh_id", "household", "householdId"]),
    district: firstText(record, ["district", "district_name"]),
    facility: firstText(record, ["facility", "facility_name"]),
    age: firstText(record, ["age"]),
    sex: firstText(record, ["vca_gender", "sex", "gender"]),
    isIndex: ["1", "true", "yes"].includes(isIndexValue.toLowerCase()),
    hivPositive: parsedPositive === "unknown" ? null : parsedPositive === "yes",
  };
}

export function parseMotherRows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(payload))
    return payload.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const key of ["data", "results", "rows"]) {
    const nested = value[key];
    if (Array.isArray(nested)) return parseMotherRows(nested);
    if (nested && typeof nested === "object") {
      const rows = parseMotherRows(nested);
      if (rows.length) return rows;
    }
  }
  return [];
}
