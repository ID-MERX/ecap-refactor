export type PmtctOutcome = "positive" | "negative" | "pending" | "unknown";
export type PmtctRecordKind = "mother" | "infant";

export type PmtctRecord = {
  rowId: string;
  clientId: string;
  ecapId: string;
  pmtctId: string;
  kind: PmtctRecordKind;
  clientType: "Mother" | "Infant (HEI)";
  householdId: string;
  beneficiaryName: string;
  hivStatus: "positive";
  hivStatusText: "HIV Positive";
  outcome: PmtctOutcome;
  outcomeText: string;
  facility: string;
  district: string;
  province: string;
  enrolledDate: string | null;
  artStartDate: string | null;
  dateTested: string | null;
  age: string;
  sex: string;
  phone: string;
  homeAddress: string;
  landmark: string;
  partner: string;
  relation: string;
  caseworker: string;
  infantOutcome: string;
  dbsDate: string | null;
};

export type PmtctListResult = {
  rows: ReadonlyArray<PmtctRecord>;
  truncatedDistricts: ReadonlyArray<string>;
};

export type PmtctProfileResult = {
  mother: PmtctRecord | null;
  infants: ReadonlyArray<PmtctRecord>;
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
    if (value !== null && value !== undefined && String(value).trim()) return text(value);
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

export function parsePmtctDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const source = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/.exec(source);
  if (iso) return validIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(source);
  if (!dmy) return null;
  return validIso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
}

function firstDate(record: Record<string, unknown>, fields: ReadonlyArray<string>): string | null {
  for (const field of fields) {
    const date = parsePmtctDate(record[field]);
    if (date) return date;
  }
  return null;
}

export function classifyPmtctOutcome(value: unknown): PmtctOutcome {
  const result = text(value, "").toLowerCase();
  if (!result || ["n/a", "na", "unknown", "pending", "not done", "not tested"].includes(result))
    return "pending";
  if (/\b(non[-\s]?detect(?:ed)?|negative|not detected|not reactive)\b/.test(result))
    return "negative";
  if (/\b(detect(?:ed)?|positive|reactive)\b/.test(result)) return "positive";
  return "unknown";
}

function personName(record: Record<string, unknown>, kind: PmtctRecordKind): string {
  const full = firstText(
    record,
    kind === "mother"
      ? ["mother_name", "client_name", "beneficiary_name", "caregiver_name"]
      : ["child_name", "infant_name", "beneficiary_name"],
  );
  if (full !== "N/A") return full;
  const first = firstText(record, [
    "firstname",
    "first_name",
    "mother_firstname",
    "child_firstname",
  ]);
  const last = firstText(record, ["lastname", "last_name", "mother_lastname", "child_lastname"]);
  return [first, last].filter((part) => part !== "N/A").join(" ") || "N/A";
}

export function normalizePmtctRecord(
  record: Record<string, unknown>,
  kind: PmtctRecordKind,
): PmtctRecord {
  const ecapId = firstText(record, ["ecap_id", "ecapid"]);
  const pmtctId = firstText(record, [
    "pmtct_id",
    "pmtctid",
    "mother_id",
    "motherid",
    "hei_id",
    "ca_id",
    "id",
  ]);
  const clientId = ecapId !== "N/A" ? ecapId : pmtctId !== "N/A" ? pmtctId : "";
  const outcomeText =
    kind === "mother"
      ? firstText(record, ["result_of_hiv_test", "result_r_nr", "hiv_status", "final_outcome"])
      : firstText(record, [
          "test_result_at_birth",
          "infant_hiv_status",
          "hiv_status",
          "final_outcome",
        ]);
  const enrolledDate = firstDate(
    record,
    kind === "mother"
      ? ["date_enrolled_pmtct", "date_enrolled", "date_1st_visit", "date_tested"]
      : [
          "date_enrolled",
          "date_enrolled_pmtct",
          "dbs_at_birth_actual_date",
          "dbs_at_birth_due_date",
          "date_tested",
        ],
  );
  const dbsDate =
    kind === "infant"
      ? firstDate(record, ["dbs_at_birth_actual_date", "dbs_at_birth_due_date", "date_tested"])
      : null;
  const rowId = pmtctId !== "N/A" ? pmtctId : clientId || "unknown-row";

  return {
    rowId,
    clientId,
    ecapId,
    pmtctId,
    kind,
    clientType: kind === "mother" ? "Mother" : "Infant (HEI)",
    householdId: firstText(record, ["household_id", "hh_id", "ecap_id"]),
    beneficiaryName: personName(record, kind),
    // Legacy PMTCT treats maternal HIV positivity as definitional; keep it fixed rather than
    // accidentally reclassifying the mother from a milestone/result field.
    hivStatus: "positive",
    hivStatusText: "HIV Positive",
    outcome: classifyPmtctOutcome(outcomeText),
    outcomeText,
    facility: firstText(record, ["facility", "facility_name", "health_facility"]),
    district: firstText(record, ["district", "district_name"]),
    province: firstText(record, ["province"]),
    enrolledDate,
    artStartDate:
      parsePmtctDate(record.art_start_date) ??
      parsePmtctDate(record.date_initiated_art) ??
      parsePmtctDate(record.date_initiated_on_art),
    dateTested: parsePmtctDate(record.date_tested),
    age: firstText(record, ["age", "caregiver_age", "individual_age"]),
    sex: firstText(record, ["caregiver_sex", "sex", "gender"]),
    phone: firstText(record, ["mothers_phone", "phone_number", "contact", "telephone"]),
    homeAddress: firstText(record, ["home_address", "homeaddress", "address"]),
    landmark: firstText(record, ["nearest_landmark", "landmark"]),
    partner: firstText(record, ["partner", "male_partner_name", "spouse_name"]),
    relation: firstText(record, ["relation"]),
    caseworker: firstText(record, ["caseworker_name"]),
    infantOutcome: kind === "infant" ? outcomeText : "N/A",
    dbsDate,
  };
}

export function parsePmtctRows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(payload))
    return payload.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  if (!payload || typeof payload !== "object") return [];
  const value = payload as Record<string, unknown>;
  for (const key of ["data", "results", "rows"]) {
    const rows = value[key];
    if (Array.isArray(rows)) return parsePmtctRows(rows);
    if (rows && typeof rows === "object") {
      const nested = parsePmtctRows(rows);
      if (nested.length) return nested;
    }
  }
  return [];
}
