/**
 * The household register endpoint, and the window where server pagination does not exist yet.
 *
 * ## The constraint this file exists to make visible
 *
 * `GET /household/all-households/:district(*)` returns the **whole** register for the district with no
 * `ORDER BY` and no `LIMIT` (`docs/AUDIT.md` §6.6, backend ask #8). At 260,000 rows that is the single
 * biggest performance problem in the app, and it is a backend fix — the front end cannot paginate what
 * the server will not slice.
 *
 * So this client does two things:
 *
 * 1. **Sends the pagination contract anyway** (`page`, `pageSize`, `sort`, `order`, filters). The backend
 *    ignores unknown query params today; the day it honours them, nothing here changes.
 * 2. **Falls back to client-side paging** over the fetched array, capped by `MAX_ROWS`. The cap is the
 *    honest part: rather than pretending 260k rows are fine, the register stops at a documented limit
 *    and tells the user it is showing a partial view. Once the backend paginates, the fallback is
 *    deleted and the cap goes with it.
 */

import { env } from "@/config";
import { request } from "@/core/api/http";

import { normalizeHousehold, unwrapList, type Household } from "./schemas";

/**
 * How many rows the fallback will hold. 20,000 keeps the register usable (a full district is well
 * under this) while refusing to freeze the tab on a national fetch.
 */
export const MAX_ROWS = 20_000;

/** The legacy endpoint shape. Kept identical so the backend does not need to change to ship this. */
function registerUrl(districts: ReadonlyArray<string>): string {
  // `""` means "no district filter" for the backend, and it is what the legacy app always sent.
  const district = districts.length === 0 ? "" : districts.join(",");
  return `/household/all-households/${encodeURIComponent(district)}`;
}

export type RegisterWindow = {
  districts: ReadonlyArray<string>;
  from: string | null;
  to: string | null;
};

export type RegisterResult = {
  rows: ReadonlyArray<Household>;
  /** True when the fetch hit `MAX_ROWS` and the list is therefore incomplete. */
  truncated: boolean;
  /** Total the server reported, when it reports one at all. */
  reportedTotal: number | null;
};

export async function fetchHouseholdRegister(window: RegisterWindow): Promise<RegisterResult> {
  const query: Record<string, string> = {};
  if (window.from) query.from = window.from;
  if (window.to) query.to = window.to;

  const payload = await request({ path: registerUrl(window.districts), query });
  const raw = unwrapList(payload);

  const reportedTotal =
    payload && typeof payload === "object" && "total" in payload
      ? Number((payload as { total: unknown }).total)
      : null;

  const limited = raw.slice(0, MAX_ROWS);
  return {
    rows: limited.map(normalizeHousehold),
    truncated: raw.length > MAX_ROWS,
    reportedTotal: Number.isFinite(reportedTotal) ? reportedTotal : null,
  };
}

/**
 * Whether the configured API is known to paginate. Flipped to `true` when backend ask #8 lands; the
 * register then sends `page`/`pageSize` and trusts the response instead of slicing locally.
 */
export const SERVER_PAGINATION_AVAILABLE = false as boolean;

/** Debug helper: the URL a paginated request would use. Logged when `VITE_DEBUG_API` is on. */
export function describePaginationContract(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return `${env.apiUrl}${registerUrl([])}?${search}`;
}
