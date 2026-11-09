/**
 * Raw response shapes for the household register, and the normaliser into the domain type.
 *
 * The backend returns column names straight from Postgres with several historical spellings in play
 * (`household_id` / `householdId` / `hh_id` / `id`), and the legacy page tried a different list of
 * candidates for the table, the sort, the search and the CSV. Here the candidate order is declared once
 * and every consumer reads the normalised field.
 */

import { z } from "zod";

import { pick } from "@/core/lib/values";

/**
 * Deliberately loose: unknown columns are preserved rather than stripped, because modules may need a
 * column this schema does not name yet, and a strict schema would silently drop it.
 */
export const rawHouseholdSchema = z.record(z.string(), z.unknown());
export const rawHouseholdListSchema = z.union([
  z.array(rawHouseholdSchema),
  z.object({ data: z.array(rawHouseholdSchema) }),
  z.object({ data: z.object({ data: z.array(rawHouseholdSchema) }) }),
]);

export type Household = {
  householdId: string;
  homeAddress: string | null;
  facility: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  caseworkerName: string | null;
  screened: string | null;
  lastServiceDate: string | null;
  archivedOn: string | null;
  reason: string | null;
  /** Sub-population flags, keyed by the `program.config` key. */
  flags: Record<string, unknown>;
};

const ID_KEYS = [
  "household_id",
  "householdId",
  "hh_id",
  "hhid",
  "unique_id",
  "uid",
  "household_code",
  "id",
] as const;
const CASEWORKER_KEYS = ["caseworker_name", "cwac_member_name"] as const;

export function normalizeHousehold(raw: Record<string, unknown>): Household {
  return {
    // Preserve raw field names for sub-population predicates and any legacy field not yet promoted to
    // the domain shape. Canonical properties below win if a source key collides.
    ...raw,
    householdId: asString(pick(raw, ID_KEYS)) ?? "",
    homeAddress: asString(pick(raw, ["homeaddress", "home_address"])),
    facility: asString(pick(raw, ["facility"])),
    province: asString(pick(raw, ["province"])),
    district: asString(pick(raw, ["district"])),
    ward: asString(pick(raw, ["ward"])),
    caseworkerName: asString(pick(raw, [...CASEWORKER_KEYS])),
    screened: asString(pick(raw, ["screened"])),
    lastServiceDate: asString(pick(raw, ["last_service_date", "lastServiceDate"])),
    archivedOn: asString(
      pick(raw, [
        "de_registration_date",
        "archived_on",
        "archivedOn",
        "date_archived",
        "updated_at",
      ]),
    ),
    reason: asString(
      pick(raw, ["de_registration_reason", "reason", "archived_reason", "case_status", "status"]),
    ),
    flags: raw,
  };
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** The envelope the list endpoint uses, unwrapped by `getListValue` in the legacy client. */
export function unwrapList(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  const parsed = rawHouseholdListSchema.safeParse(payload);
  if (!parsed.success) return [];
  const data = parsed.data;
  if (Array.isArray(data)) return data;
  if ("data" in data && Array.isArray(data.data)) return data.data;
  if ("data" in data && data.data && typeof data.data === "object" && "data" in data.data) {
    const inner = (data.data as { data: unknown }).data;
    return Array.isArray(inner) ? (inner as ReadonlyArray<Record<string, unknown>>) : [];
  }
  return [];
}
