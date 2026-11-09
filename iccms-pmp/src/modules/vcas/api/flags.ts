import { directusRequest } from "@/core/api";

export type VcaFlag = {
  id: string;
  vca_id: string;
  status: string;
  comment: string | null;
  category: string | null;
  severity: string | null;
  verifier: string | null;
  created_on: string | null;
};

export const vcaFlagsKey = (scope: string, id: string) =>
  ["vcas", "profile", scope, id, "flags"] as const;

function directusRows(payload: unknown): ReadonlyArray<Record<string, unknown>> {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    !Array.isArray(payload.data)
  )
    return [];
  return payload.data.filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object",
  );
}

export async function fetchVcaFlags(ids: ReadonlyArray<string>): Promise<ReadonlyArray<VcaFlag>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const filters: Record<string, string> = {};
  let index = 0;
  for (const id of uniqueIds) {
    filters[`filter[_or][${index}][vca_id][_eq]`] = id;
    index += 1;
    filters[`filter[_or][${index}][child_id][_eq]`] = id;
    index += 1;
  }
  const payload = await directusRequest<unknown>({
    path: "/items/flagged_forms_ecapplus_pmp",
    query: {
      ...filters,
      fields:
        "id,vca_id,child_id,status,comment,category,severity,verifier,date_created,created_at",
      sort: "-date_created",
      limit: 100,
    },
  });
  return directusRows(payload).map((row) => ({
    id: String(row.id ?? ""),
    vca_id: String(row.vca_id ?? row.child_id ?? ""),
    status: String(row.status ?? "pending"),
    comment: typeof row.comment === "string" ? row.comment : null,
    category: typeof row.category === "string" ? row.category : null,
    severity: typeof row.severity === "string" ? row.severity : null,
    verifier: typeof row.verifier === "string" ? row.verifier : null,
    created_on:
      typeof row.date_created === "string"
        ? row.date_created
        : typeof row.created_at === "string"
          ? row.created_at
          : null,
  }));
}

/** Deliberately omits caregiver/member names and telephone numbers. */
export async function createVcaFlag(payload: {
  vca_id: string;
  household_id: string | null;
  facility: string | null;
  comment: string;
  category: string;
  severity: string;
  verifier: string;
  status: "pending";
}): Promise<void> {
  await directusRequest({
    path: "/items/flagged_forms_ecapplus_pmp",
    method: "POST",
    body: payload,
  });
}

export async function resolveVcaFlag(id: string): Promise<void> {
  await directusRequest({
    path: `/items/flagged_forms_ecapplus_pmp/${encodeURIComponent(id)}`,
    method: "PATCH",
    body: { status: "resolved" },
  });
}
