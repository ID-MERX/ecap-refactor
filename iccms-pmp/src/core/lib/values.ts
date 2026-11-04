/**
 * Value coercion shared by every module.
 *
 * The legacy app re-implemented each of these per page, and they disagreed: one register accepted
 * `"1" | "true" | 1 | true` as "yes" while the backend also accepted `ILIKE 'yes'`, so a row storing
 * `"Yes"` matched **neither** button (`docs/audit/households.md`, "Sub-population filters";
 * `docs/AUDIT.md` §4.1 item 5).
 */

const TRUE_WORDS = new Set(["1", "true", "yes", "y", "t"]);
const FALSE_WORDS = new Set(["0", "false", "no", "n", "f"]);

/**
 * Tri-state boolean for filterable columns.
 *
 * Returns `null` when the value is absent or unrecognised. Callers must decide what `null` means for
 * them — a "yes" filter excludes it, a "no" filter of the legacy kind included it, and the new table
 * treats an unknown value as *neither*, which is what the data actually says. Silently folding an
 * unknown value into "no" is how the legacy registers overstated their negative counts.
 */
export function toBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const text = String(value).trim().toLowerCase();
  if (text === "") return null;
  if (TRUE_WORDS.has(text)) return true;
  if (FALSE_WORDS.has(text)) return false;
  return null;
}

/** True when the column is explicitly yes/true/1 — used for "is this flag on?" badges. */
export function isTrue(value: unknown): boolean {
  return toBoolean(value) === true;
}

/**
 * The first non-empty candidate. The legacy registers each tried a different list of raw column names
 * per field (table vs sort vs search vs export all differed), which is how a row with only `id` could
 * navigate to `"N/A"`. Modules declare one `pick` order and every consumer uses it.
 */
export function pick<T = unknown>(
  row: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): T | null {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value as T;
  }
  return null;
}

/** Normalise a free-text field for comparison: trimmed, collapsed, lower-cased, null when empty. */
export function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/**
 * District values in the live data are stored inconsistently — untrimmed, mixed case, sometimes a
 * legacy spelling. The legacy register built its variant list from untrimmed values
 * (`legacy:src/pages/HouseholdRegister.tsx:129`) but compared against trimmed row values, so rows with
 * padded values never matched the district select.
 */
export function normalizeDistrict(value: unknown): string | null {
  const text = normalizeText(value);
  return text === null ? null : text.toLowerCase();
}

export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Sort key for identifier columns: numeric-aware so `HH2` sorts before `HH10`. */
export function compareIds(a: unknown, b: unknown): number {
  const left = a === null || a === undefined ? "" : String(a);
  const right = b === null || b === undefined ? "" : String(b);
  const leftNum = Number(left);
  const rightNum = Number(right);
  if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum) && left !== "" && right !== "") {
    return leftNum - rightNum;
  }
  return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
}
