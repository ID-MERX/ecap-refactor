export type FlagContextTarget = { kind: "household" | "vca"; id: string } | { kind: null };

/** Accept exactly one non-empty record identifier; reject ambiguous mixed contexts. */
export function flagContextTarget(
  householdId: string | null | undefined,
  vcaId: string | null | undefined,
): FlagContextTarget {
  const household = householdId?.trim() ?? "";
  const vca = vcaId?.trim() ?? "";
  if (Boolean(household) === Boolean(vca)) return { kind: null };
  return household ? { kind: "household", id: household } : { kind: "vca", id: vca };
}
