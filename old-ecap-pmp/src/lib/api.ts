import { getStoredToken } from "@/lib/auth";
import { getCacheEntry, setCacheEntry } from "@/lib/indexedDbCache";
import { getBackendBaseUrl, getDirectusBaseUrl } from "@/lib/env";

const DQA_BASE_URL = getBackendBaseUrl();

export const DEFAULT_DISTRICT = import.meta.env.VITE_DEFAULT_DISTRICT;
const SERVICES_CACHE_TTL_MS = 1000 * 60 * 5;
// Keep this short — it's a defensive layer in front of React Query's own cache.
// If a request returns junk (e.g. backend permission error → empty list), we
// don't want it pinned for minutes. React Query handles the longer-lived
// memoization upstream (gcTime: 24h) and EtlInvalidator wipes both caches when
// a Mage ETL run completes.
const LIST_CACHE_TTL_MS = 1000 * 60;
const DEBUG_API =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === "true";

const safeJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getCountValue = (data: unknown): number | null => {
  if (typeof data === "number") {
    return data;
  }

  if (typeof data === "string") {
    const parsed = Number(data);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;

  // Check generic "count" property which might be a number, string, or object (nested count)
  if (record.count) {
    if (typeof record.count === "number") {
      return record.count;
    }
    if (typeof record.count === "string") {
      const parsed = Number(record.count);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (typeof record.count === "object" && record.count !== null) {
      // Handle case: { count: { count: "123" } }
      const nestedCount = (record.count as Record<string, unknown>).count;
      if (nestedCount) {
        const parsed = Number(nestedCount);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }

  const candidates = [
    record.total,
    record.totalCount,
    record.total_count,
    record.totalVcaCount,
    record.total_vca_count,
    record.data,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return candidate;
    }

    if (typeof candidate === "string") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  const nested = record.data;
  if (Array.isArray(nested)) {
    return nested.length;
  }

  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    const nestedCandidates = [
      nestedRecord.count,
      nestedRecord.total,
      nestedRecord.totalCount,
      nestedRecord.total_count,
      nestedRecord.totalVcaCount,
      nestedRecord.total_vca_count,
    ];

    for (const candidate of nestedCandidates) {
      if (typeof candidate === "number") {
        return candidate;
      }

      if (typeof candidate === "string") {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }

  return null;
};

const getListValue = (data: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(data)) {
    return data as Array<Record<string, unknown>>;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const record = data as Record<string, unknown>;
  const keysToCheck = [
    "data",
    "results",
    "records",
    "referrals",
    "referral",
    "caregiver_referrals",
    "caregiver_referral",
    "caregiver_services",
    "caregiver_services_by_district",
    "household_services",
    "services",
    "caseplans",
    "members",
    "vca_services",
    "vca_services_by_district",
    "household_services_by_district",
  ];

  // 1. Check direct keys
  for (const key of keysToCheck) {
    const val = record[key];
    if (Array.isArray(val)) {
      return val as Array<Record<string, unknown>>;
    }
  }

  // 2. Check depth-1 nested keys (e.g. { data: { caregiver_services: [...] } })
  for (const key of keysToCheck) {
    const val = record[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = val as Record<string, unknown>;
      for (const nKey of keysToCheck) {
        if (Array.isArray(nested[nKey])) {
          return nested[nKey] as Array<Record<string, unknown>>;
        }
      }
    }
  }

  // 3. Fallback: Find the FIRST non-empty array property in the root record
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (Array.isArray(val) && val.length > 0) {
      return val as Array<Record<string, unknown>>;
    }
  }

  // 4. Final attempt: any array even if empty (find any list named anything)
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (Array.isArray(val)) {
      return val as Array<Record<string, unknown>>;
    }
  }

  return [];
};

const dqaGet = async (path: string) => {
  const token = getStoredToken();
  if (!token) {
    throw new Error("Not authenticated.");
  }
  if (DEBUG_API) {
    console.log("[DQA] Request", `${DQA_BASE_URL}${path}`);
    console.log("[DQA] Access token present:", Boolean(token));
  }
  const response = await fetch(`${DQA_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await safeJson(response);
  if (DEBUG_API) {
    console.log("[DQA] Response", data);
  }

  if (!response.ok) {
    throw new Error(data?.message ?? "DQA request failed");
  }

  return data;
};

const getListFromApiWithCache = async (
  cacheKey: string,
  path: string,
  ttlMs: number,
): Promise<Array<Record<string, unknown>>> => {
  const now = Date.now();
  const cached = await getCacheEntry<Array<Record<string, unknown>>>(cacheKey);

  if (cached && now - cached.updatedAt <= ttlMs) {
    return cached.value;
  }

  try {
    const data = await dqaGet(path);
    const list = getListValue(data);
    void setCacheEntry(cacheKey, list);
    return list;
  } catch (error) {
    if (cached) {
      console.warn(
        `[DQA] Using stale IndexedDB cache for ${cacheKey} after fetch error.`,
      );
      return cached.value;
    }
    throw error;
  }
};

type FyWindow = { from?: string | null; to?: string | null } | undefined;
const fyQs = (fy?: FyWindow) => {
  if (!fy?.from || !fy?.to) return "";
  const params = new URLSearchParams({ from: fy.from, to: fy.to });
  return `?${params.toString()}`;
};

export const clearApiCache = async () => {
  await Promise.allSettled([
    import("@/lib/indexedDbCache").then((m) => m.clearAllCacheEntries()),
  ]);
};

export const getTotalVcasCount = async (district?: string, fy?: FyWindow) => {
  const path = district
    ? `/child/vcas-count/${encodeURIComponent(district)}${fyQs(fy)}`
    : `/child/vcas-count${fyQs(fy)}`;
  const data = await dqaGet(path);
  return getCountValue(data);
};

export const getTotalHouseholdsCount = async (
  district?: string,
  fy?: FyWindow,
) => {
  const path = district
    ? `/household/households-count/${encodeURIComponent(district)}${fyQs(fy)}`
    : `/household/households-count${fyQs(fy)}`;
  const data = await dqaGet(path);
  return getCountValue(data);
};

export const getTotalMothersCount = async (district?: string) => {
  const path = district
    ? `/mother/members-count/${encodeURIComponent(district)}`
    : "/mother/total/count";
  const data = await dqaGet(path);
  return getCountValue(data);
};

export const getCaseworkerCountByDistrict = async (district: string) => {
  const data = await dqaGet(
    `/child/caseworker/count/${encodeURIComponent(district)}`,
  );
  return getCountValue(data);
};

export const getHouseholdCountByDistrict = async (district: string) => {
  const data = await dqaGet(
    `/household/district/count/${encodeURIComponent(district)}`,
  );
  return getCountValue(data);
};

export const getVcaCountByDistrict = async (district: string) => {
  const data = await dqaGet(
    `/child/district/count/${encodeURIComponent(district)}`,
  );
  return getCountValue(data);
};

export const getHouseholdsByDistrict = async (
  district: string,
  fy?: FyWindow,
) => {
  const normalizedDistrict = district || "ALL";
  const fyKey = fy?.from && fy?.to ? `:${fy.from}_${fy.to}` : "";
  return getListFromApiWithCache(
    `households_by_district:${normalizedDistrict}${fyKey}`,
    `/household/all-households/${encodeURIComponent(district)}${fyQs(fy)}`,
    LIST_CACHE_TTL_MS,
  );
};

export const getHouseholdMembers = async (hhId: string) => {
  const data = await dqaGet(`/household/members/${encodeURIComponent(hhId)}`);
  return getListValue(data);
};

export const getHouseholdArchivedRegister = async (
  district: string,
  params?: { de_registration_reason?: string; fy?: FyWindow },
) => {
  const queryParams = new URLSearchParams();
  if (params?.de_registration_reason) {
    queryParams.append("de_registration_reason", params.de_registration_reason);
  }
  if (params?.fy?.from && params?.fy?.to) {
    queryParams.append("from", params.fy.from);
    queryParams.append("to", params.fy.to);
  }

  const queryString = queryParams.toString();
  const url = `/household/all-households-archived/${encodeURIComponent(district)}${
    queryString ? `?${queryString}` : ""
  }`;

  const data = await dqaGet(url);
  return getListValue(data);
};

export const getMothersByDistrict = async (district: string, fy?: FyWindow) => {
  const data = await dqaGet(
    `/mother/district/${encodeURIComponent(district)}/filtered${fyQs(fy)}`,
  );
  return getListValue(data);
};

export const getPmtctChildRegisterByDistrict = async (
  district: string,
  fy?: FyWindow,
) => {
  const data = await dqaGet(
    `/etl/pmtct-child-register/${encodeURIComponent(district)}${fyQs(fy)}`,
  );
  return getListValue(data);
};

export const getPmtctMotherRegisterByDistrict = async (
  district: string,
  fy?: FyWindow,
) => {
  const data = await dqaGet(
    `/etl/pmtct-mother-register/${encodeURIComponent(district)}${fyQs(fy)}`,
  );
  return getListValue(data);
};

export const getChildrenByDistrict = async (
  district: string,
  fy?: FyWindow,
) => {
  const normalizedDistrict = district || "ALL";
  const fyKey = fy?.from && fy?.to ? `:${fy.from}_${fy.to}` : "";
  return getListFromApiWithCache(
    `children_by_district:${normalizedDistrict}${fyKey}`,
    `/child/vcas-assessed-register/${encodeURIComponent(district)}${fyQs(fy)}`,
    LIST_CACHE_TTL_MS,
  );
};

export const getVcaProfileById = async (uniqueId: string) => {
  const data = await dqaGet(
    `/child/vca-profile/${encodeURIComponent(uniqueId)}`,
  );
  return data; // Individual object, not a list
};

export const getChildrenArchivedRegister = async (
  district: string,
  params?: { reason?: string; fy?: FyWindow },
) => {
  const queryParams = new URLSearchParams();
  if (params?.reason) {
    queryParams.append("reason", params.reason);
  }
  if (params?.fy?.from && params?.fy?.to) {
    queryParams.append("from", params.fy.from);
    queryParams.append("to", params.fy.to);
  }

  const queryString = queryParams.toString();
  const url = `/child/vcas-archived-register/${encodeURIComponent(district)}${
    queryString ? `?${queryString}` : ""
  }`;

  const data = await dqaGet(url);
  return getListValue(data);
};

export const getCaregiverServicesByDistrict = async (district: string) => {
  const normalizedDistrict = district || "ALL";
  return getListFromApiWithCache(
    `caregiver_services_by_district:${normalizedDistrict}`,
    `/household/caregiver-services-by-district/${encodeURIComponent(district)}`,
    SERVICES_CACHE_TTL_MS,
  );
};

export const getHouseholdServicesByDistrict = async (district: string) => {
  const normalizedDistrict = district || "ALL";
  return getListFromApiWithCache(
    `household_services_by_district:${normalizedDistrict}`,
    `/household/household-services-by-district/${encodeURIComponent(district)}`,
    SERVICES_CACHE_TTL_MS,
  );
};

export const getHTSRegisterByDistrict = async (
  district: string,
  _fy?: FyWindow,
) => {
  // Backend route: /household/hts-register-by-district/:district(*)
  const data = await dqaGet(
    `/household/hts-register-by-district/${encodeURIComponent(district)}`,
  );
  if (DEBUG_API) {
    console.log("[HTS] Raw API response for district:", district, data);
  }
  return getListValue(data);
};

export const getHtsRegisterByDistrict = getHTSRegisterByDistrict;

export const getCaregiverServicesByHousehold = async (hhId: string) => {
  const data = await dqaGet(
    `/household/caregiver-services/${encodeURIComponent(hhId)}`,
  );
  return getListValue(data);
};

export const getCaregiverReferralsByDistrict = async (district?: string) => {
  try {
    const districtId = district;
    if (!districtId || district === "All Districts") {
      return getListValue(
        await dqaGet(`/household/district/caregiver-referrals`),
      );
    }
    return getListValue(
      await dqaGet(
        `/household/district/caregiver-referrals/${encodeURIComponent(districtId)}`,
      ),
    );
  } catch (e) {
    // If dedicated endpoint fails, fallback to filtering services on client
    const services = await getCaregiverServicesByDistrict(district);
    return services.filter((r) => {
      const service = String(
        r.service || r.form_name || r.type || "",
      ).toLowerCase();
      return service.includes("referral");
    });
  }
};

export const getVcaReferralsByDistrict = async (district?: string) => {
  try {
    const districtId = district;
    if (!districtId || district === "All Districts") {
      return getListValue(await dqaGet(`/child/district/vcareferrals`));
    }
    return getListValue(
      await dqaGet(
        `/child/district/vcareferrals/${encodeURIComponent(districtId)}`,
      ),
    );
  } catch (e) {
    // If dedicated endpoint fails, fallback to filtering services on client
    const services = await getVcaServicesByDistrict(district);
    return services.filter((r) => {
      const service = String(
        r.service || r.form_name || r.type || "",
      ).toLowerCase();
      return service.includes("referral");
    });
  }
};

export const getVcaServicesByDistrict = async (district: string) => {
  const normalizedDistrict = district || "ALL";
  return getListFromApiWithCache(
    `vca_services_by_district:${normalizedDistrict}`,
    `/child/vca-services-by-district/${encodeURIComponent(district)}`,
    SERVICES_CACHE_TTL_MS,
  );
};

export const getVcaServicesByChildId = async (childId: string) => {
  const data = await dqaGet(
    `/child/vca-services/${encodeURIComponent(childId)}`,
  );
  return getListValue(data);
};

export const getCaregiverServicesByMonth = async (district: string) => {
  const data = await dqaGet(
    `/household/caregiver-services-by-month/${encodeURIComponent(district)}`,
  );
  return getListValue(data);
};

export const getVcaServicesByMonth = async (district: string) => {
  const data = await dqaGet(
    `/child/vca-services-by-month/${encodeURIComponent(district)}`,
  );
  return getListValue(data);
};

export const getCaregiverReferralsByMonth = async (district: string) => {
  const data = await dqaGet(
    `/household/caregiver-referrals-by-month/${encodeURIComponent(district)}`,
  );
  return getListValue(data);
};

export const getVcaReferralsByMonth = async (district: string) => {
  const data = await dqaGet(
    `/child/vca-referrals-by-month/${encodeURIComponent(district)}`,
  );
  return getListValue(data);
};

export const getCaregiverCasePlansByDistrict = async (district: string) => {
  const path = district
    ? `/household/caregiver-caseplans/${encodeURIComponent(district)}`
    : "/household/caregiver-caseplans";
  const data = await dqaGet(path);
  return getListValue(data);
};

export const getCaregiverCasePlansByHousehold = async (hhId: string) => {
  const data = await dqaGet(
    `/household/caregiver-caseplans/${encodeURIComponent(hhId)}`,
  );
  return getListValue(data);
};

export const getCaregiverCasePlanDomainsByHousehold = async (hhId: string) => {
  // ec_caregiver_case_plan_domain — detailed vulnerabilities linked to a
  // caregiver's case plans (ec_caregiver_case_plan). Keyed by household_id.
  const data = await dqaGet(
    `/household/caregiver-caseplan-domains/${encodeURIComponent(hhId)}`,
  );
  return getListValue(data);
};

export const getHouseholdReferralsById = async (household_id: string) => {
  const data = await dqaGet(
    `/household/caregiver-referrals/${encodeURIComponent(household_id)}`,
  );
  return getListValue(data);
};

export const getVcaReferralsById = async (vcaId: string) => {
  const data = await dqaGet(
    `/child/vca-referrals/${encodeURIComponent(vcaId)}`,
  );
  return getListValue(data);
};

export const getVcaCasePlansByDistrict = async (district: string) => {
  // The backend route is /vca-caseplans and does not accept a district parameter
  const data = await dqaGet("/child/vca-caseplans");
  return getListValue(data);
};

export const getVcaCasePlansById = async (vcaId: string) => {
  const data = await dqaGet(
    `/child/vca-caseplans/${encodeURIComponent(vcaId)}`,
  );
  return getListValue(data);
};

export const getVcaCasePlanDomainsById = async (vcaId: string) => {
  // ec_vca_case_plan_domain — the detailed vulnerabilities/domains linked
  // to a VCA's case plans (ec_vca_case_plan). Keyed by the VCA's own
  // unique_id, unlike ec_caregiver_case_plan_domain (household-level).
  const data = await dqaGet(
    `/child/vca-caseplan-domains/${encodeURIComponent(vcaId)}`,
  );
  return getListValue(data);
};

export const getFlaggedRecords = async () => {
  const token = getStoredToken();
  if (!token) return [];

  try {
    // Expand Directus user references so flagged_by / user_created / created_by
    // come back with first_name + last_name instead of bare UUIDs (matches the
    // dqa-dashboard fetch shape).
    const fields =
      "*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name";
    const response = await fetch(
      `${getDirectusBaseUrl()}/items/flagged_forms_ecapplus_pmp?fields=${encodeURIComponent(fields)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const data = await safeJson(response);
    return getListValue(data);
  } catch (error) {
    console.error("Error fetching flagged records:", error);
    return [];
  }
};

export const createFlaggedRecord = async (payload: any) => {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `${getDirectusBaseUrl()}/items/flagged_forms_ecapplus_pmp`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorData = await safeJson(response);
    throw new Error(errorData?.message || "Failed to create flagged record");
  }

  return safeJson(response);
};
// ─── ETL Pipeline API ───────────────────────────────────────────────

export interface EtlRun {
  run_id: string;
  pipeline: string;
  pipeline_name: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  duration_sec: number | null;
  logs: string;
  error: string | null;
  created_at: string;
}

export interface EtlPipeline {
  id: string;
  name: string;
  downloadFiles: string[];
}

export interface EtlFile {
  name: string;
  exists: boolean;
  size: number | null;
  sizeFormatted: string | null;
  lastModified: string | null;
}

const dqaPost = async (path: string, body: Record<string, unknown> = {}) => {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");
  const url = `${DQA_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await safeJson(response);
  if (!response.ok)
    throw new Error(data?.message || `Request failed: ${response.status}`);
  return data;
};

const dqaGetSkipCache = async (path: string) => {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");
  const url = `${DQA_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await safeJson(response);
  if (!response.ok)
    throw new Error(data?.message || `Request failed: ${response.status}`);
  return data;
};

export const triggerEtlPipeline = async (pipeline: string): Promise<EtlRun> => {
  const res = await dqaPost("/etl/run", { pipeline });
  return res.data;
};

export const getEtlRuns = async (params?: {
  limit?: number;
  pipeline?: string;
  status?: string;
}): Promise<EtlRun[]> => {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.pipeline) query.set("pipeline", params.pipeline);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  const data = await dqaGetSkipCache(`/etl/runs${qs ? `?${qs}` : ""}`);
  return data?.data ?? [];
};

export const getEtlRunById = async (runId: string): Promise<EtlRun> => {
  const data = await dqaGetSkipCache(`/etl/runs/${runId}`);
  return data?.data;
};

export const cancelEtlRun = async (runId: string) =>
  dqaPost(`/etl/cancel/${runId}`);

export const getEtlPipelines = async (): Promise<EtlPipeline[]> => {
  const data = await dqaGetSkipCache("/etl/pipelines");
  return data?.data ?? [];
};

export const getEtlFiles = async (pipeline: string): Promise<EtlFile[]> => {
  const data = await dqaGetSkipCache(`/etl/files/${pipeline}`);
  return data?.data ?? [];
};

// Browser-native downloads (anchor clicks) and EventSource can't send an
// Authorization header, so these URLs carry the token as ?token=.
const withTokenParam = (url: string): string => {
  const token = getStoredToken();
  if (!token) return url;
  return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
};

export const getEtlDownloadUrl = (
  pipeline: string,
  fileName: string,
): string => {
  return withTokenParam(
    `${DQA_BASE_URL}/etl/download/${pipeline}/${encodeURIComponent(fileName)}`,
  );
};

export const sendEtlReport = async () => dqaPost("/etl/send-report");

// ─── Tablet Sync Status API ─────────────────────────────────────────
export interface TabletSyncProvider {
  provider: string;
  location_id: string;
  facility?: string;
  district?: string;
  last_activity: string;
  total_events: number;
  status: "active" | "stale" | "inactive";
}

export interface TabletSyncStatus {
  total: number;
  active_7d: number;
  active_30d: number;
  stale: number;
  providers: TabletSyncProvider[];
  source?: string;
  refreshed_at?: string | null;
}

export const getTabletSyncStatus = async (): Promise<TabletSyncStatus> => {
  const data = await dqaGetSkipCache("/etl/tablet-sync");
  return data?.data;
};

export const getTabletSyncStreamUrl = (): string => {
  return withTokenParam(`${DQA_BASE_URL}/etl/tablet-sync/stream`);
};

// ─── Facility Performance API ───────────────────────────────────────
export interface FacilityPerformance {
  facility: string;
  district: string;
  ward?: string;
  total_vcas: number;
  households: number;
  services_this_month: number;
  services_last_month: number;
  trend_pct: number;
}

export const getFacilityPerformance = async (params?: {
  district?: string;
  facility?: string;
  ward?: string;
  fy?: FyWindow;
}): Promise<FacilityPerformance[]> => {
  const q = new URLSearchParams();
  if (params?.district && params.district !== "all")
    q.set("district", params.district);
  if (params?.facility && params.facility !== "all")
    q.set("facility", params.facility);
  if (params?.ward && params.ward !== "all") q.set("ward", params.ward);
  if (params?.fy?.from && params?.fy?.to) {
    q.set("from", params.fy.from);
    q.set("to", params.fy.to);
  }
  const data = await dqaGetSkipCache(
    `/etl/facility-performance${q.toString() ? `?${q}` : ""}`,
  );
  return data?.data ?? [];
};

// ─── Caseworker & Service Performance API ───────────────────────────
export interface CaseworkerPerformance {
  caseworker_name: string;
  facility: string | null;
  ward?: string | null;
  district: string | null;
  services_this_month: number;
  services_last_month: number;
  trend_pct: number;
  unique_entities_this_month: number;
  active_days_this_month: number;
  services_per_active_day: number;
  last_active: string | null;
  tier: "top" | "mid" | "bottom" | "inactive";
}

export const getCaseworkerPerformance = async (params?: {
  district?: string;
  facility?: string;
  ward?: string;
  fy?: FyWindow;
}): Promise<CaseworkerPerformance[]> => {
  const q = new URLSearchParams();
  if (params?.district && params.district !== "all")
    q.set("district", params.district);
  if (params?.facility && params.facility !== "all")
    q.set("facility", params.facility);
  if (params?.ward && params.ward !== "all") q.set("ward", params.ward);
  if (params?.fy?.from && params?.fy?.to) {
    q.set("from", params.fy.from);
    q.set("to", params.fy.to);
  }
  const data = await dqaGetSkipCache(
    `/etl/caseworker-performance${q.toString() ? `?${q}` : ""}`,
  );
  return data?.data ?? [];
};

export interface ServicePerformance {
  service: string;
  type: "vca" | "caregiver" | "household";
  this_month: number;
  last_month: number;
  trend_pct: number;
  unique_entities_this_month: number;
  coverage_pct: number;
  tier: "top" | "mid" | "bottom" | "inactive";
}

export const getServicePerformance = async (params?: {
  type?: string;
  district?: string;
  facility?: string;
  ward?: string;
  fy?: FyWindow;
}): Promise<{
  data: ServicePerformance[];
  meta: { total_vcas: number; total_households: number };
}> => {
  const q = new URLSearchParams();
  if (params?.type && params.type !== "all") q.set("type", params.type);
  if (params?.district && params.district !== "all")
    q.set("district", params.district);
  if (params?.facility && params.facility !== "all")
    q.set("facility", params.facility);
  if (params?.ward && params.ward !== "all") q.set("ward", params.ward);
  if (params?.fy?.from && params?.fy?.to) {
    q.set("from", params.fy.from);
    q.set("to", params.fy.to);
  }
  const res = await dqaGetSkipCache(
    `/etl/service-performance${q.toString() ? `?${q}` : ""}`,
  );
  return {
    data: res?.data ?? [],
    meta: res?.meta ?? { total_vcas: 0, total_households: 0 },
  };
};

// ─── Service Summary (DB-backed canonical KPIs) ─────────────────────
export interface ServiceSummary {
  type: "vca" | "caregiver" | "household";
  source: string;
  generated_at: string;
  data: Record<string, number>;
}

export const getServiceSummary = async (params: {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
  ward?: string;
  fy?: FyWindow;
}): Promise<ServiceSummary> => {
  const q = new URLSearchParams();
  if (params.district && params.district !== "all" && params.district !== "All")
    q.set("district", params.district);
  if (params.facility && params.facility !== "all")
    q.set("facility", params.facility);
  if (params.ward && params.ward !== "all") q.set("ward", params.ward);
  if (params.fy?.from && params.fy?.to) {
    q.set("from", params.fy.from);
    q.set("to", params.fy.to);
  }
  const res = await dqaGetSkipCache(
    `/etl/services/${params.type}/summary${q.toString() ? `?${q}` : ""}`,
  );
  return {
    type: params.type,
    source: res?.source ?? "",
    generated_at: res?.generated_at ?? "",
    data: res?.data ?? {},
  };
};

export interface ServiceTimeseriesPoint {
  month: string;
  label: string;
  count: number;
}
export interface ServiceTimeseriesResponse {
  type: string;
  source: string;
  generated_at: string;
  data: ServiceTimeseriesPoint[];
}

export const getServiceTimeseries = async (params: {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
  ward?: string;
  fy?: FyWindow;
}): Promise<ServiceTimeseriesResponse> => {
  const q = new URLSearchParams();
  if (params.district && params.district !== "all" && params.district !== "All")
    q.set("district", params.district);
  if (params.facility && params.facility !== "all")
    q.set("facility", params.facility);
  if (params.ward && params.ward !== "all") q.set("ward", params.ward);
  if (params.fy?.from && params.fy?.to) {
    q.set("from", params.fy.from);
    q.set("to", params.fy.to);
  }
  const res = await dqaGetSkipCache(
    `/etl/services/${params.type}/timeseries${q.toString() ? `?${q}` : ""}`,
  );
  return {
    type: params.type,
    source: res?.source ?? "",
    generated_at: res?.generated_at ?? "",
    data: res?.data ?? [],
  };
};

export interface ServiceDistributionSlice {
  pillar: string;
  count: number;
  pct: number;
}
export interface ServiceDistributionResponse {
  type: string;
  source: string;
  generated_at: string;
  total: number;
  window_days: number;
  data: ServiceDistributionSlice[];
}

export const getServiceDistribution = async (params: {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
  ward?: string;
  fy?: FyWindow;
}): Promise<ServiceDistributionResponse> => {
  const q = new URLSearchParams();
  if (params.district && params.district !== "all" && params.district !== "All")
    q.set("district", params.district);
  if (params.facility && params.facility !== "all")
    q.set("facility", params.facility);
  if (params.ward && params.ward !== "all") q.set("ward", params.ward);
  if (params.fy?.from && params.fy?.to) {
    q.set("from", params.fy.from);
    q.set("to", params.fy.to);
  }
  const res = await dqaGetSkipCache(
    `/etl/services/${params.type}/distribution${q.toString() ? `?${q}` : ""}`,
  );
  return {
    type: params.type,
    source: res?.source ?? "",
    generated_at: res?.generated_at ?? "",
    total: res?.total ?? 0,
    window_days: res?.window_days ?? 90,
    data: res?.data ?? [],
  };
};

// ─── Action Queue API ───────────────────────────────────────────────
export interface ActionItem {
  key: string;
  label: string;
  description: string;
  count: number;
  severity: "red" | "orange" | "yellow" | "slate";
  filter: { type: string };
}

export interface ActionQueueResponse {
  type: string;
  generated_at: string;
  data: ActionItem[];
}

export const getActionQueue = async (params: {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
  ward?: string;
}): Promise<ActionQueueResponse> => {
  const q = new URLSearchParams();
  q.set("type", params.type);
  if (params.district && params.district !== "all")
    q.set("district", params.district);
  if (params.facility && params.facility !== "all")
    q.set("facility", params.facility);
  if (params.ward && params.ward !== "all") q.set("ward", params.ward);
  const res = await dqaGetSkipCache(`/etl/action-queue?${q}`);
  return {
    type: res?.type ?? params.type,
    generated_at: res?.generated_at ?? "",
    data: res?.data ?? [],
  };
};

// ─── Duplicate review persistence ───────────────────────────────────
export interface DuplicateReview {
  run_key: string;
  service_type: string | null;
  reviewed_by: string | null;
  reviewed_at: string;
  note: string | null;
}

export const listDuplicateReviews = async (): Promise<DuplicateReview[]> => {
  const data = await dqaGetSkipCache("/etl/duplicates/reviews");
  return data?.data ?? [];
};

export const upsertDuplicateReview = async (payload: {
  run_key: string;
  service_type?: string;
  reviewed_by?: string;
  note?: string;
}): Promise<void> => {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated.");
  const response = await fetch(`${DQA_BASE_URL}/etl/duplicates/review`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to save review");
};

export const deleteDuplicateReview = async (run_key: string): Promise<void> => {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated.");
  const response = await fetch(
    `${DQA_BASE_URL}/etl/duplicates/review/${encodeURIComponent(run_key)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) throw new Error("Failed to delete review");
};

// ─── Caseworker Journey API ─────────────────────────────────────────
export interface JourneyPoint {
  caseworker: string;
  visit_date: string;
  form_type: string;
  lat: string | null;
  lng: string | null;
}

export interface CaseworkerListItem {
  caseworker: string;
  display_name?: string | null;
  location_id?: string | null;
  facility?: string | null;
  district?: string | null;
  province?: string | null;
  has_gps?: boolean | number | string | null;
  hasGps?: boolean | number | string | null;
  gps_available?: boolean | number | string | null;
  has_gps_data?: boolean | number | string | null;
  gps_count?: number | string | null;
  gps_points?: number | string | null;
  gps_events?: number | string | null;
  journey_points?: number | string | null;
}

export const getCaseworkerJourneys = async (params: {
  caseworker?: string;
  from?: string;
  to?: string;
  facility?: string;
}): Promise<JourneyPoint[]> => {
  const query = new URLSearchParams();
  if (params.caseworker && params.caseworker !== "all")
    query.set("caseworker", params.caseworker);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.facility && params.facility !== "all")
    query.set("facility", params.facility);
  const qs = query.toString();
  const data = await dqaGetSkipCache(
    `/etl/caseworker-journeys${qs ? `?${qs}` : ""}`,
  );
  return data?.data ?? [];
};

export const getCaseworkerList = async (scope?: {
  district?: string;
  province?: string;
}): Promise<{ caseworker: string; location_id: string }[]> => {
  const q = new URLSearchParams();
  if (scope?.district && scope.district !== "all" && scope.district !== "All")
    q.set("district", scope.district);
  if (scope?.province && scope.province !== "all" && scope.province !== "All")
    q.set("province", scope.province);
  const url = `/etl/caseworker-list${q.toString() ? `?${q}` : ""}`;
  const data = await dqaGetSkipCache(url);
  const rows = getListValue(data);
  const seen = new Set<string>();

  return rows.flatMap((raw) => {
    const row =
      raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : { caseworker: raw };
    const value = (...keys: string[]) => {
      for (const key of keys) {
        const v = row[key];
        const text = String(v ?? "").trim();
        if (text) return text;
      }
      return "";
    };
    const caseworker = value(
      "caseworker",
      "provider",
      "provider_id",
      "providerId",
      "username",
      "user_name",
      "caseworker_name",
      "display_name",
      "name",
    );
    const displayName =
      value("display_name", "caseworker_name", "full_name", "name") ||
      caseworker;

    if (!caseworker) return [];
    const dedupeKey = caseworker.toLowerCase();
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);

    return [
      {
        caseworker,
        display_name: displayName,
        location_id: value("location_id", "locationId"),
        facility: value("facility", "ward", "location_name"),
        district: value("district"),
        province: value("province"),
        has_gps: (row.has_gps ??
          row.hasGps ??
          row.gps_available ??
          row.has_gps_data ??
          row.gps_count ??
          row.gps_points ??
          row.gps_events ??
          row.journey_points ??
          false) as CaseworkerListItem["has_gps"],
        hasGps: row.hasGps as CaseworkerListItem["hasGps"],
        gps_available: row.gps_available as CaseworkerListItem["gps_available"],
        has_gps_data: row.has_gps_data as CaseworkerListItem["has_gps_data"],
        gps_count: row.gps_count as CaseworkerListItem["gps_count"],
        gps_points: row.gps_points as CaseworkerListItem["gps_points"],
        gps_events: row.gps_events as CaseworkerListItem["gps_events"],
        journey_points:
          row.journey_points as CaseworkerListItem["journey_points"],
      },
    ];
  });
};

export const getFacilityList = async (): Promise<string[]> => {
  const data = await dqaGetSkipCache("/etl/facility-list");
  return data?.data ?? [];
};

// ─── Duplicate Detection API ────────────────────────────────────────
export interface DuplicateGroup {
  entity_id: string;
  service_date: string;
  services: string;
  duplicate_count: number;
  caseworker_name: string;
  facility: string;
  district: string;
  province: string;
  ward?: string;
}

export interface DuplicateResponse {
  type: string;
  entity_label: string;
  groups: DuplicateGroup[];
  summary: {
    total_groups: number;
    total_redundant_records: number;
    by_district: Record<string, number>;
    by_facility: Record<string, number>;
    by_caseworker: Record<string, number>;
  };
}

export const getDuplicates = async (params: {
  type: "vca" | "caregiver" | "household";
  district?: string;
  facility?: string;
}): Promise<DuplicateResponse> => {
  const query = new URLSearchParams();
  query.set("type", params.type);
  if (params.district) query.set("district", params.district);
  if (params.facility) query.set("facility", params.facility);
  const data = await dqaGetSkipCache(`/etl/duplicates?${query.toString()}`);
  return data?.data;
};

export const updateFlagStatus = async (flagId: string, status: string) => {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `${getDirectusBaseUrl()}/items/flagged_forms_ecapplus_pmp/${flagId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!response.ok) {
    const errorData = await safeJson(response);
    throw new Error(errorData?.message || "Failed to update flagged record");
  }

  return safeJson(response);
};

// ─── Paginated Service Records (server-side filtering) ──────────────────────

export interface ServiceRecordRow {
  id: string;
  type: "vca" | "caregiver" | "household";
  entityId: string;
  entityLabel: string;
  name: string;
  district: string;
  facility: string;
  caseworker: string;
  serviceDate: string;
  serviceNames: string[];
  pillars: string[];
  servicesByPillar: Record<string, string[]>;
  status: string;
  issues: string[];
  issueKeys: string[];
  ageDays: number | null;
  raw: Record<string, unknown>;
}

export interface ServiceRecordsStats {
  loaded: number;
  monthly: number;
  recordsWithIssues: number;
  issueCounts: Record<string, number>;
}

export interface ServiceRecordsResponse {
  type: string;
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  stats: ServiceRecordsStats;
  data: ServiceRecordRow[];
}

export const getServiceRecords = async (params: {
  type: "vca" | "caregiver" | "household";
  district?: string;
  search?: string;
  domain?: string;
  issue?: string;
  dateWindow?: string;
  entityId?: string;
  page?: number;
  pageSize?: number;
}): Promise<ServiceRecordsResponse> => {
  const q = new URLSearchParams();
  if (params.district && params.district !== "All")
    q.set("district", params.district);
  if (params.search) q.set("search", params.search);
  if (params.domain && params.domain !== "all") q.set("domain", params.domain);
  if (params.issue) q.set("issue", params.issue);
  if (params.dateWindow && params.dateWindow !== "all")
    q.set("dateWindow", params.dateWindow);
  if (params.entityId) q.set("entityId", params.entityId);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));

  const res = await dqaGetSkipCache(
    `/etl/services/${params.type}/records${q.toString() ? `?${q}` : ""}`,
  );

  return {
    type: res?.type ?? params.type,
    page: res?.page ?? 1,
    pageSize: res?.pageSize ?? 12,
    totalRecords: res?.totalRecords ?? 0,
    totalPages: res?.totalPages ?? 1,
    stats: res?.stats ?? {
      loaded: 0,
      monthly: 0,
      recordsWithIssues: 0,
      issueCounts: {},
    },
    data: res?.data ?? [],
  };
};

export const getServiceRecordDetail = async (params: {
  type: "vca" | "caregiver" | "household";
  entityId: string;
  district?: string;
}): Promise<Record<string, unknown> | null> => {
  const q = new URLSearchParams();
  q.set("entityId", params.entityId);
  if (params.district && params.district !== "All")
    q.set("district", params.district);
  try {
    const res = await dqaGetSkipCache(
      `/etl/services/${params.type}/record-detail?${q}`,
    );
    return res?.data ?? null;
  } catch {
    return null;
  }
};

/**
 * Triggers a full CSV export for the given filters by navigating the browser
 * directly to the streaming export endpoint. The browser handles the download
 * natively — no fetch, no memory allocation, no page-by-page batching.
 */
// In your api.ts — replace triggerServiceExport with a fetch-based version
// that shows progress and handles errors gracefully

export const triggerServiceExport = async (
  params: {
    type: "vca" | "caregiver" | "household";
    district?: string;
    search?: string;
    domain?: string;
    issue?: string;
    dateWindow?: string;
    entityId?: string;
  },
  onProgress?: (state: "preparing" | "downloading" | "done" | "error") => void,
): Promise<void> => {
  const q = new URLSearchParams();
  if (params.district && params.district !== "All")
    q.set("district", params.district);
  if (params.search) q.set("search", params.search);
  if (params.domain && params.domain !== "all") q.set("domain", params.domain);
  if (params.issue) q.set("issue", params.issue);
  if (params.dateWindow && params.dateWindow !== "all")
    q.set("dateWindow", params.dateWindow);
  if (params.entityId) q.set("entityId", params.entityId);

  const token = getStoredToken();
  if (token) q.set("token", token);

  const url = `${getBackendBaseUrl()}/etl/services/${params.type}/export${q.toString() ? `?${q}` : ""}`;

  onProgress?.("preparing");

  try {
    const response = await fetch(url);

    if (!response.ok) {
      onProgress?.("error");
      throw new Error(`Export failed: ${response.status}`);
    }

    if (!response.body) {
      onProgress?.("error");
      throw new Error("No response body");
    }

    onProgress?.("downloading");

    // Stream the response into a blob
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    // Combine chunks and trigger download
    const blob = new Blob(chunks, { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${params.type}-services-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    onProgress?.("done");
  } catch (error) {
    onProgress?.("error");
    console.error("Export error:", error);
    throw error;
  }
};
