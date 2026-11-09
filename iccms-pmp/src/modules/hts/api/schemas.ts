export type HtsResult = "positive" | "negative" | "pending" | "unknown";
export type HtsRiskType = "unlinked" | "pending" | "new" | "all";

export const HTS_RISK_TYPES: ReadonlyArray<{
  value: HtsRiskType;
  label: string;
  description: string;
}> = [
  {
    value: "unlinked",
    label: "Positives not on ART",
    description: "Positive results without a recorded ART link.",
  },
  {
    value: "pending",
    label: "Pending outcomes",
    description: "Tests with missing, unknown, or indeterminate results.",
  },
  {
    value: "new",
    label: "New positives",
    description: "Positive results recorded in the last seven days.",
  },
  { value: "all", label: "All records", description: "All HTS records in your effective scope." },
];

export type HtsRecord = {
  /** Stable app key for table rows; it can fall back to the source HTS identifier. */
  rowId: string;
  /** Approved route key: ecap_id first, then client_number. */
  clientId: string;
  clientNumber: string;
  ecapId: string;
  htsId: string;
  clientType: string;
  resultText: string;
  result: HtsResult;
  artNumber: string;
  artDate: string;
  testingModality: string;
  entryPoint: string;
  testDate: string;
  recordDate: string | null;
  facility: string;
  district: string;
  province: string;
  age: string;
  gender: string;
  dateTestedContact: string;
  dateTestedLink: string;
  linkEventId: string;
  subPopulation: string;
};

export type HtsRegisterResult = {
  rows: ReadonlyArray<HtsRecord>;
  truncatedDistricts: ReadonlyArray<string>;
};

function text(value: unknown, fallback = "N/A"): string {
  if (value === null || value === undefined) return fallback;
  const valueText = String(value).replace(/\s+/g, " ").trim();
  return valueText || fallback;
}

function firstText(record: Record<string, unknown>, fields: ReadonlyArray<string>): string {
  for (const field of fields) {
    const value = record[field];
    if (value !== null && value !== undefined && String(value).trim() !== "") return text(value);
  }
  return "N/A";
}

function validIso(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse ISO or the backend's documented DD-MM-YYYY format without browser-dependent guessing. */
export function parseHtsDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const source = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/.exec(source);
  if (iso) return validIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(source);
  if (!dmy) return null;
  const rawYear = Number(dmy[3]);
  const year = dmy[3]!.length === 2 ? (rawYear < 50 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
  return validIso(year, Number(dmy[2]), Number(dmy[1]));
}

const RESULT_FIELDS = [
  "hiv_result",
  "hiv_status",
  "status",
  "art_status",
  "current_hiv_status",
] as const;
const DATE_FIELDS = [
  "date_created",
  "datecreated",
  "date_client_created",
  "created_at",
  "date_tested",
  "test_date",
  "hiv_test_date",
  "date_edited",
  "date_screened",
  "art_date_initiated",
] as const;

export function classifyHtsResult(value: unknown): HtsResult {
  const result = text(value, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (
    !result ||
    ["n/a", "na", "unknown", "pending", "indeterminate", "inconclusive"].includes(result)
  )
    return "pending";
  // Check negative values first: "non-reactive" contains "reactive".
  if (
    /(?:non[-\s]?reactive)/.test(result) ||
    result.includes("negative") ||
    result.includes("hiv-")
  )
    return "negative";
  if (result.includes("positive") || result.includes("reactive") || result.includes("hiv+"))
    return "positive";
  return "unknown";
}

function inferredClientType(record: Record<string, unknown>): string {
  const declared = firstText(record, ["type", "record_type"]);
  if (declared !== "N/A") return declared.toLowerCase().includes("child") ? "CA (Child)" : "Mother";
  const age = Number(firstText(record, ["individual_age", "age"]));
  return Number.isFinite(age) && age < 20 ? "CA (Child)" : "Mother/Adult";
}

function hasMeaningfulArtLink(value: string): boolean {
  return ![
    "",
    "n/a",
    "na",
    "none",
    "no",
    "not linked",
    "not on art",
    "unknown",
    "pending",
  ].includes(value.trim().toLowerCase());
}

export function normalizeHtsRecord(record: Record<string, unknown>): HtsRecord {
  const ecapId = firstText(record, ["ecap_id"]);
  const clientNumber = firstText(record, ["client_number"]);
  const htsId = firstText(record, ["hts_id", "client_id", "id"]);
  const resultText = firstText(record, RESULT_FIELDS);
  const artNumber = firstText(record, ["case_art_number", "art_number", "art_no"]);
  const artDate = firstText(record, ["art_date", "art_date_initiated"]);
  const recordDate = DATE_FIELDS.map((field) => parseHtsDate(record[field])).find(Boolean) ?? null;
  const rowId = clientNumber !== "N/A" ? clientNumber : ecapId !== "N/A" ? ecapId : htsId;
  const age = firstText(record, ["individual_age", "age"]);
  const artLinked = hasMeaningfulArtLink(artNumber) || hasMeaningfulArtLink(artDate);

  return {
    rowId,
    clientId: ecapId !== "N/A" ? ecapId : clientNumber !== "N/A" ? clientNumber : "",
    clientNumber,
    ecapId,
    htsId,
    clientType: inferredClientType(record),
    resultText,
    result: classifyHtsResult(resultText),
    artNumber: artLinked ? artNumber : "N/A",
    artDate: artLinked ? artDate : "N/A",
    testingModality: firstText(record, ["testing_modality"]),
    entryPoint: firstText(record, ["entry_point"]),
    testDate: firstText(record, ["date_tested", "test_date", "hiv_test_date"]),
    recordDate,
    facility: firstText(record, ["health_facility", "facility", "facility_name"]),
    district: firstText(record, ["district", "district_name"]),
    province: firstText(record, ["province"]),
    age,
    gender: firstText(record, ["gender_case", "gender_link", "sex"]),
    dateTestedContact: firstText(record, ["date_tested_contact"]),
    dateTestedLink: firstText(record, ["date_tested_link"]),
    linkEventId: firstText(record, ["link_event_id"]),
    subPopulation: firstText(record, ["sub_population", "case_suppopulation"]),
  };
}

export function parseHtsRows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const data = (payload as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
}

export function isHtsRiskType(value: unknown): value is HtsRiskType {
  return value === "unlinked" || value === "pending" || value === "new" || value === "all";
}

export function isHtsArtLinked(record: HtsRecord): boolean {
  return hasMeaningfulArtLink(record.artNumber) || hasMeaningfulArtLink(record.artDate);
}
