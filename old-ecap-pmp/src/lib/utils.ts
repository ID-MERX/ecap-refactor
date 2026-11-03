import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CAREGIVER_CONFIDENTIAL_LABEL = "Caregiver Name - Confidential";

export const anonymizeCaregiverName = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || ["N/A", "Not Provided", "null", "undefined"].includes(text)) {
    return CAREGIVER_CONFIDENTIAL_LABEL;
  }
  return CAREGIVER_CONFIDENTIAL_LABEL;
};

export function toTitleCase(str: string) {
  if (!str) return "";
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function toSentenceCase(str: string) {
  if (!str) return "";
  const s = str.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Normalize a place name (ward / district / facility / province): trim, collapse
 * internal whitespace, hyphen-aware Title Case. Names sourced from free-text DB
 * fields routinely arrive lowercase ("chibale") or SHOUTING ("MULUNGUSHI"); this
 * brings them to a consistent display form ("Chibale", "Mulungushi", "St-Anne's").
 */
export function normalizePlaceName(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (!s) return "";
  return s
    .toLowerCase()
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join("-"),
    )
    .join(" ");
}

/**
 * Dedupe an array of place names case-insensitively, keeping the prettiest
 * (Title-cased) representation. Stable: preserves input order.
 */
export function dedupePlaceNames(values: Array<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const v of values) {
    const pretty = normalizePlaceName(v);
    if (!pretty) continue;
    const key = pretty.toLowerCase();
    if (!seen.has(key)) seen.set(key, pretty);
  }
  return Array.from(seen.values());
}
