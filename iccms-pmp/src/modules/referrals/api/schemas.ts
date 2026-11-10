export type ReferralMonthlyCount = {
  district: string;
  month: string;
  count: number;
};

export type ReferralMonthlyResult = {
  rows: ReadonlyArray<ReferralMonthlyCount>;
};

function unwrapRows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === "object" && !Array.isArray(row),
    );
  }
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as Record<string, unknown>).data;
  if (Array.isArray(data)) return unwrapRows(data);
  if (data && typeof data === "object") return unwrapRows(data);
  return [];
}

export function parseReferralMonth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(0[1-9]|1[0-2])-(\d{4})$/.exec(value.trim());
  return match ? `${match[2]}-${match[1]}` : null;
}

export function parseReferralMonthlyRows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  return unwrapRows(payload);
}

export function normalizeReferralMonthlyRow(
  row: Record<string, unknown>,
): ReferralMonthlyCount | null {
  const districtValue = row.district;
  const district = typeof districtValue === "string" ? districtValue.trim() : "";
  const month = parseReferralMonth(row.referral_month);
  const countValue = Number(row.referral_count);
  if (!district || !month || !Number.isFinite(countValue) || countValue < 0) return null;
  return { district, month, count: countValue };
}
