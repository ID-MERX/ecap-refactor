import {
  getCaregiverServicesByDistrict,
  getHouseholdServicesByDistrict,
  getHouseholdsByDistrict,
  getVcaServicesByDistrict,
} from "@/lib/api";

export type ServiceType = "vca" | "caregiver" | "household";
export type ServicePillar = "HIV" | "Health" | "Education" | "Safety" | "Stability" | "Household";

export interface NormalizedServiceRecord {
  id: string;
  type: ServiceType;
  entityId: string;
  entityLabel: string;
  name: string;
  district: string;
  facility: string;
  caseworker: string;
  serviceDate: string;
  serviceNames: string[];
  pillars: ServicePillar[];
  servicesByPillar: Partial<Record<ServicePillar, string[]>>;
  status: string;
  issues: string[];
  issueKeys: string[];
  ageDays: number | null;
  raw: Record<string, unknown>;
}

export const SERVICE_TYPE_META: Record<ServiceType, { label: string; shortLabel: string; route: string; entityLabel: string }> = {
  vca: {
    label: "VCA Services",
    shortLabel: "VCA",
    route: "/vca-services",
    entityLabel: "VCA",
  },
  caregiver: {
    label: "Caregiver Services",
    shortLabel: "Caregiver",
    route: "/caregiver-services",
    entityLabel: "Household",
  },
  household: {
    label: "Household Services",
    shortLabel: "Household",
    route: "/household-services",
    entityLabel: "Household",
  },
};

export const ISSUE_META: Record<string, { label: string; tone: "red" | "amber" | "slate" }> = {
  missing_date: { label: "Missing date", tone: "red" },
  no_service_details: { label: "No service details", tone: "red" },
  missing_caseworker: { label: "Missing caseworker", tone: "amber" },
  missing_district: { label: "Missing district", tone: "amber" },
  stale_90d: { label: "Older than 90d", tone: "slate" },
};

const COMMON_HOUSEHOLD_ID_KEYS = [
  "household_id",
  "hh_id",
  "hhid",
  "householdId",
  "household_id_number",
  "household_uid",
  "household_unique_id",
  "unique_id",
  "uid",
  "id",
];

const ENTITY_ID_KEYS: Record<ServiceType, string[]> = {
  vca: [
    "vca_id",
    "vcaid",
    "child_id",
    "childId",
    "ovc_id",
    "beneficiary_id",
    "beneficiaryId",
    "unique_id",
    "uid",
    "id",
  ],
  caregiver: COMMON_HOUSEHOLD_ID_KEYS,
  household: COMMON_HOUSEHOLD_ID_KEYS,
};

const NAME_KEYS: Record<ServiceType, string[]> = {
  vca: ["vca_name", "child_name", "beneficiary_name", "full_name", "name", "firstname", "first_name"],
  caregiver: ["caregiver_name", "caregiver_full_name", "full_name", "name"],
  household: ["caregiver_name", "caregiver_full_name", "full_name", "name"],
};

const DATE_KEYS = ["service_date", "visit_date", "date", "date_created", "created_at", "updated_at", "sync_date"];
const DISTRICT_KEYS = ["district", "district_name", "District", "districtName"];
const FACILITY_KEYS = [
  "facility",
  "facility_name",
  "health_facility",
  "health_facility_name",
  "hf_name",
  "clinic",
  "clinic_name",
  "site",
  "site_name",
  "service_point",
];
const CASEWORKER_KEYS = [
  "caseworker_name",
  "case_worker_name",
  "case_worker",
  "caseworker",
  "caseWorker",
  "caseWorkerName",
  "cw_name",
  "cw_fullname",
  "field_officer",
  "field_worker",
  "field_worker_name",
  "mobilizer",
  "mobilizer_name",
  "officer_name",
  "worker_name",
  "social_worker",
  "assigned_caseworker",
  "assigned_to",
  "provider",
  "submitted_by",
];
const STATUS_KEYS = ["status", "state", "service_status", "case_status", "syncStatus", "sync_status"];
const SERVICE_NAME_KEYS = ["service", "service_name", "form_name", "type", "name", "activity", "intervention"];

const PILLAR_FIELD_PAIRS: Record<ServicePillar, [string, string | undefined][]> = {
  HIV: [
    ["hiv_services", "other_hiv_services"],
    ["hivServices", "otherHivServices"],
    ["hiv_service", "other_hiv_service"],
  ],
  Health: [
    ["health_services", "other_health_services"],
    ["healthServices", "otherHealthServices"],
    ["health_service", "other_health_service"],
  ],
  Education: [
    ["schooled_services", "other_schooled_services"],
    ["education_services", "other_education_services"],
    ["educationServices", "otherEducationServices"],
  ],
  Safety: [
    ["safe_services", "other_safe_services"],
    ["safety_services", "other_safety_services"],
    ["safeServices", "otherSafeServices"],
  ],
  Stability: [
    ["stable_services", "other_stable_services"],
    ["stability_services", "other_stability_services"],
    ["stableServices", "otherStableServices"],
  ],
  Household: [
    ["hh_level_services", "other_hh_level_services"],
    ["household_services", "other_household_services"],
    ["hhLevelServices", "otherHhLevelServices"],
  ],
};

export const fetchRawServices = async (type: ServiceType, district: string) => {
  if (type === "vca") return getVcaServicesByDistrict(district);
  if (type === "caregiver") return getCaregiverServicesByDistrict(district);
  return getHouseholdServicesByDistrict(district);
};

export const fetchHouseholdRegister = async (district: string) => getHouseholdsByDistrict(district);

export const requiresHouseholdRegister = (type: ServiceType) => type === "caregiver" || type === "household";

export const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return false;
  const text = String(value).trim();
  return !text || ["N/A", "Not Provided", "null", "undefined", "[]"].includes(text);
};

const toText = (value: unknown) => {
  if (isEmptyValue(value)) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const getCaseInsensitive = (record: Record<string, unknown>, key: string) => {
  const exact = record[key];
  if (!isEmptyValue(exact)) return exact;
  const lower = key.toLowerCase();
  const match = Object.keys(record).find((k) => k.toLowerCase() === lower);
  return match ? record[match] : undefined;
};

export const pickValue = (
  records: Array<Record<string, unknown> | undefined | null>,
  keys: string[],
  fallback = "N/A",
  fuzzyHints: string[] = [],
) => {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = getCaseInsensitive(record, key);
      const text = toText(value);
      if (text) return text;
    }
  }

  for (const record of records) {
    if (!record || fuzzyHints.length === 0) continue;
    for (const hint of fuzzyHints) {
      const lowerHint = hint.toLowerCase();
      const match = Object.entries(record).find(([key, value]) => {
        return key.toLowerCase().includes(lowerHint) && !key.startsWith("_") && !isEmptyValue(value);
      });
      const text = match ? toText(match[1]) : "";
      if (text) return text;
    }
  }

  return fallback;
};

const normalizeKey = (value: string) => value.trim().toLowerCase();

export const buildHouseholdRegisterMap = (rows: Array<Record<string, unknown>>) => {
  const map = new Map<string, Record<string, unknown>>();
  rows.forEach((row) => {
    const householdId = pickValue([row], COMMON_HOUSEHOLD_ID_KEYS, "");
    if (householdId) map.set(normalizeKey(householdId), row);
  });
  return map;
};

export const parseServiceList = (value: unknown, otherValue?: unknown): string[] => {
  const values: string[] = [];

  const push = (item: unknown) => {
    const text = toText(item);
    if (!text) return;
    const lower = text.toLowerCase();
    if (lower === "not applicable" || lower === "other" || lower === "none") return;
    values.push(text);
  };

  if (!isEmptyValue(value)) {
    if (Array.isArray(value)) {
      value.forEach(push);
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) parsed.forEach(push);
          else push(parsed);
        } catch {
          push(trimmed);
        }
      } else {
        push(trimmed);
      }
    } else {
      push(value);
    }
  }

  push(otherValue);
  return Array.from(new Set(values));
};

export const parseDateValue = (value: string) => {
  if (!value || value === "N/A") return null;
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const daysSince = (date: Date | null) => {
  if (!date) return null;
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const getPillarServices = (raw: Record<string, unknown>, register?: Record<string, unknown>) => {
  const servicesByPillar: Partial<Record<ServicePillar, string[]>> = {};

  (Object.keys(PILLAR_FIELD_PAIRS) as ServicePillar[]).forEach((pillar) => {
    const values: string[] = [];
    PILLAR_FIELD_PAIRS[pillar].forEach(([mainKey, otherKey]) => {
      const mainValue = pickValue([raw, register], [mainKey], "");
      const otherValue = otherKey ? pickValue([raw, register], [otherKey], "") : "";
      values.push(...parseServiceList(mainValue, otherValue));
    });
    const unique = Array.from(new Set(values));
    if (unique.length > 0) servicesByPillar[pillar] = unique;
  });

  return servicesByPillar;
};

export const normalizeServiceRecord = (
  type: ServiceType,
  raw: Record<string, unknown>,
  sourceDistrict: string,
  householdRegister: Map<string, Record<string, unknown>>,
  index: number,
): NormalizedServiceRecord => {
  const entityId = pickValue([raw], ENTITY_ID_KEYS[type], "N/A");
  const householdMatch = entityId !== "N/A" ? householdRegister.get(normalizeKey(entityId)) : undefined;
  const records = [raw, householdMatch];
  const serviceDate = pickValue(records, DATE_KEYS);
  const parsedDate = parseDateValue(serviceDate);
  const ageDays = daysSince(parsedDate);
  const servicesByPillar = getPillarServices(raw, householdMatch);
  const pillars = Object.keys(servicesByPillar) as ServicePillar[];
  const namedService = pickValue(records, SERVICE_NAME_KEYS, "");
  const serviceNames = Array.from(
    new Set([
      ...parseServiceList(namedService),
      ...Object.values(servicesByPillar).flat(),
    ]),
  );

  const districtFromRecord = pickValue(records, DISTRICT_KEYS, "");
  const district = districtFromRecord || sourceDistrict || "N/A";
  const facility = pickValue(records, FACILITY_KEYS, "N/A", ["facility", "clinic", "site", "service_point"]);
  const caseworker = pickValue(records, CASEWORKER_KEYS, "N/A", ["caseworker", "worker", "officer", "mobilizer"]);
  const name = pickValue(records, NAME_KEYS[type], "N/A", ["caregiver", "child", "beneficiary", "name"]);
  const status = pickValue(records, STATUS_KEYS, serviceDate === "N/A" ? "Missing date" : "Synced");

  const issues: string[] = [];
  const issueKeys: string[] = [];
  const addIssue = (key: string) => {
    issues.push(ISSUE_META[key].label);
    issueKeys.push(key);
  };

  if (serviceDate === "N/A") addIssue("missing_date");
  if (serviceNames.length === 0) addIssue("no_service_details");
  if (caseworker === "N/A") addIssue("missing_caseworker");
  if (district === "N/A") addIssue("missing_district");
  if (ageDays !== null && ageDays > 90) addIssue("stale_90d");

  return {
    id: `${type}-${entityId}-${serviceDate}-${index}`,
    type,
    entityId,
    entityLabel: SERVICE_TYPE_META[type].entityLabel,
    name,
    district,
    facility,
    caseworker,
    serviceDate,
    serviceNames,
    pillars,
    servicesByPillar,
    status,
    issues,
    issueKeys,
    ageDays,
    raw,
  };
};
