/**
 * Fiscal-year state: the maths, the URL round-trip and the precedence rule.
 *
 * Source of truth: `old-ecap-pmp/FY_FILTER_REVIEW.md`. The legacy implementation had the right maths
 * and the wrong precedence — it read `localStorage` on mount and only later honoured the URL, so a
 * shared link showing FY2024 could silently open on the recipient's saved FY. Here the URL wins,
 * always, and storage is only a fallback for the *absence* of URL state.
 *
 * Pure functions only; the React binding lives in `FyProvider.tsx`.
 */

import { fiscalYearRange, getCurrentFy } from "@/config";
import { storage } from "@/core/lib/storage";

export type FyMode = "fy" | "all" | "custom";

export type FyState =
  { mode: "fy"; fy: number } | { mode: "all" } | { mode: "custom"; from: string; to: string };

/** What the rest of the app consumes: a resolved window, or nothing to constrain by. */
export type FyWindow = {
  /** `null` means "all time" — omit `from`/`to` from every request. */
  from: string | null;
  to: string | null;
  /** e.g. `FY2026`, `All time`, `Custom: 1 Jan – 30 Jun 2026`. */
  label: string;
  /** Short form for filenames: `FY2026`, `all_time`, `2026-01-01_2026-06-30`. */
  slug: string;
};

const STORAGE_KEY = "fy.filter";

export const DEFAULT_FY_STATE: FyState = { mode: "fy", fy: getCurrentFy() };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveFy(state: FyState): FyWindow {
  switch (state.mode) {
    case "all":
      return { from: null, to: null, label: "All time", slug: "all_time" };

    case "fy": {
      const { start, end } = fiscalYearRange(state.fy);
      return { from: start, to: end, label: `FY${state.fy}`, slug: `FY${state.fy}` };
    }

    case "custom": {
      // Order the bounds rather than trusting the caller; a reversed range returns zero rows, which
      // looks like an empty register instead of a user error.
      const [from, to] = state.from <= state.to ? [state.from, state.to] : [state.to, state.from];
      return {
        from,
        to,
        label: `Custom: ${formatDay(from)} – ${formatDay(to)}`,
        slug: `${from}_${to}`,
      };
    }
  }
}

/** `2026-01-01` → `1 Jan 2026`. Deliberately locale-independent so the label is stable in tests. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${day} ${months[month - 1] ?? ""} ${year}`;
}

/** State → URL params. Only the params the mode needs, so links stay readable. */
export function fyToParams(state: FyState): Record<string, string> {
  switch (state.mode) {
    case "all":
      return { fy: "all" };
    case "fy":
      return { fy: String(state.fy) };
    case "custom":
      return { fy: "custom", from: state.from, to: state.to };
  }
}

/**
 * URL params → state.
 *
 * Returns `null` when the params say nothing about the FY, which is the signal for "fall back to
 * storage, then to the default". Malformed or incomplete params also yield `null` rather than a
 * half-applied state: a link with `from` but no `to` is a broken link, and silently interpreting it as
 * an open-ended range would show the user more data than the link intended.
 */
export function fyFromParams(params: URLSearchParams): FyState | null {
  const fy = params.get("fy");
  if (fy === null) return null;

  if (fy === "all") return { mode: "all" };

  if (fy === "custom") {
    const from = params.get("from");
    const to = params.get("to");
    if (from === null || to === null || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return null;
    return { mode: "custom", from, to };
  }

  const year = Number(fy);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { mode: "fy", fy: year };
}

/** Persist the choice so a returning user gets their last filter. Never *overrides* a URL. */
export function saveFyState(state: FyState): void {
  storage.setJson(STORAGE_KEY, state);
}

export function loadFyState(): FyState | null {
  const raw = storage.get(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;

    if (candidate.mode === "all") return { mode: "all" };
    if (candidate.mode === "fy" && typeof candidate.fy === "number") {
      return { mode: "fy", fy: candidate.fy };
    }
    if (
      candidate.mode === "custom" &&
      typeof candidate.from === "string" &&
      typeof candidate.to === "string" &&
      ISO_DATE.test(candidate.from) &&
      ISO_DATE.test(candidate.to)
    ) {
      return { mode: "custom", from: candidate.from, to: candidate.to };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * The precedence rule, in one place and testable without a component:
 * URL → storage → default.
 */
export function initialFyState(params: URLSearchParams, stored: FyState | null): FyState {
  return fyFromParams(params) ?? stored ?? DEFAULT_FY_STATE;
}

/** The list of FYs the picker offers: the current one and the two before it. */
export function recentFys(now: Date = new Date(), count = 3): ReadonlyArray<number> {
  const current = getCurrentFy(now);
  return Array.from({ length: count }, (_, index) => current - index);
}

/**
 * The query-key fragment for a window. Two different windows must never share a cache entry, and
 * `all` must be distinct from a wide custom range.
 */
export function fyKey(window: FyWindow): string {
  return window.from === null ? "all" : `${window.from}_${window.to}`;
}
