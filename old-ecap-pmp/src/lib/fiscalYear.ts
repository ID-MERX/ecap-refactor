// PEPFAR fiscal year — Oct 1 to Sep 30. FY2026 = 2025-10-01 to 2026-09-30.

export type FyMode = "fy" | "all" | "custom";

export interface FyState {
  mode: FyMode;
  fy?: number;        // when mode === "fy"
  from?: string;      // YYYY-MM-DD, when mode === "custom"
  to?: string;        // YYYY-MM-DD, when mode === "custom"
}

export interface FyResolved {
  mode: FyMode;
  fy?: number;
  fromDate: string | null; // ISO YYYY-MM-DD, or null for All time
  toDate: string | null;
  label: string;          // "FY2026", "Custom: 2025-10-01 to 2026-05-15", "All time"
}

/** Returns the PEPFAR FY containing the given date (default: today). */
export const getCurrentFy = (date: Date = new Date()): number => {
  // Oct, Nov, Dec → next-year FY; Jan–Sep → current-year FY
  const m = date.getMonth(); // 0-indexed
  const y = date.getFullYear();
  return m >= 9 ? y + 1 : y;
};

/** Returns inclusive YYYY-MM-DD bounds for a fiscal year. */
export const getFyBounds = (fy: number): { from: string; to: string } => ({
  from: `${fy - 1}-10-01`,
  to: `${fy}-09-30`,
});

const todayIso = () => new Date().toISOString().slice(0, 10);

export const resolveFy = (state: FyState): FyResolved => {
  if (state.mode === "all") {
    return { mode: "all", fromDate: null, toDate: null, label: "All time" };
  }
  if (state.mode === "custom") {
    const from = state.from || "1970-01-01";
    const to = state.to || todayIso();
    return {
      mode: "custom",
      fromDate: from,
      toDate: to,
      label: `Custom: ${from} → ${to}`,
    };
  }
  // mode === "fy"
  const fy = state.fy ?? getCurrentFy();
  const { from, to } = getFyBounds(fy);
  return { mode: "fy", fy, fromDate: from, toDate: to, label: `FY${fy}` };
};

/** Builds the list of FY options surfaced in the dropdown. */
export const getFyOptions = (max: number = 3): number[] => {
  const current = getCurrentFy();
  const list: number[] = [];
  for (let i = 0; i < max; i++) list.push(current - i);
  return list;
};

/** Serializes FY state to a URLSearchParams-friendly object. */
export const fyToParams = (state: FyState): Record<string, string> => {
  if (state.mode === "all") return { fy: "all" };
  if (state.mode === "custom") return { fy: "custom", from: state.from ?? "", to: state.to ?? "" };
  return { fy: String(state.fy ?? getCurrentFy()) };
};

/** Parses FY state from URLSearchParams. */
export const fyFromParams = (params: URLSearchParams): FyState | null => {
  const raw = params.get("fy");
  if (!raw) return null;
  if (raw === "all") return { mode: "all" };
  if (raw === "custom") {
    const from = params.get("from") || undefined;
    const to = params.get("to") || undefined;
    return { mode: "custom", from, to };
  }
  const fy = Number(raw);
  if (!Number.isFinite(fy)) return null;
  return { mode: "fy", fy };
};
