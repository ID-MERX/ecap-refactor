import type { ReferralMonthlyCount } from "../api/schemas";

export type ReferralMonthTotal = {
  month: string;
  caregivers: number;
  children: number;
};

export function combineReferralMonths(
  caregiverRows: ReadonlyArray<ReferralMonthlyCount>,
  vcaRows: ReadonlyArray<ReferralMonthlyCount>,
): ReadonlyArray<ReferralMonthTotal> {
  const months = new Map<string, ReferralMonthTotal>();
  for (const row of caregiverRows) {
    const total = months.get(row.month) ?? { month: row.month, caregivers: 0, children: 0 };
    total.caregivers += row.count;
    months.set(row.month, total);
  }
  for (const row of vcaRows) {
    const total = months.get(row.month) ?? { month: row.month, caregivers: 0, children: 0 };
    total.children += row.count;
    months.set(row.month, total);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}
