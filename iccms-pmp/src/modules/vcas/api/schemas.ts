import { pick } from "@/core/lib/values";

export type Vca = Record<string, unknown> & {
  vcaId: string;
  uid: string | null;
  uniqueId: string | null;
  vcaid: string | null;
  district: string | null;
  province: string | null;
  householdId: string | null;
  isArchived: boolean;
};

const ID_KEYS = [
  "uid",
  "unique_id",
  "uniqueId",
  "vca_id",
  "vcaId",
  "vcaid",
  "child_id",
  "id",
] as const;

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function normalizeVca(raw: Record<string, unknown>): Vca {
  const uid = text(pick(raw, ["uid", "id"]));
  const uniqueId = text(pick(raw, ["unique_id", "uniqueId"]));
  const vcaid = text(pick(raw, ["vcaid", "vca_id", "child_id"]));
  return {
    ...raw,
    vcaId: text(pick(raw, ID_KEYS)) ?? "",
    uid,
    uniqueId,
    vcaid,
    district: text(pick(raw, ["district"])),
    province: text(pick(raw, ["province"])),
    householdId: text(pick(raw, ["household_id", "household_code", "householdid", "hh_id"])),
    isArchived: Boolean(
      text(pick(raw, ["de_registration_date", "reason", "de_registration_reason"])),
    ),
  };
}

export function unwrapVcaList(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
    );
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return unwrapVcaList(record.data);
  if (Array.isArray(record.results)) return unwrapVcaList(record.results);
  if (record.data && typeof record.data === "object") return unwrapVcaList(record.data);
  return [];
}

export function comparableVcaId(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim().toLowerCase();
}

export function vcaMatchesId(vca: Vca, id: string): boolean {
  const wanted = comparableVcaId(id);
  return [vca.vcaId, ...ID_KEYS.map((key) => vca[key])].some(
    (candidate) => comparableVcaId(candidate) === wanted,
  );
}
