# R2: `src/lib/api.ts` second half (lines 700–1486)

Scope: every wrapper in `legacy:src/lib/api.ts:700-1486` (ETL pipeline, tablet sync, performance, service KPIs,
action queue, duplicate reviews, caseworker journeys, duplicates, Directus flag status, paginated service records,
record detail, CSV export), plus the two direct call sites that use URLs built here (EventSource and anchor download
in `DataPipelinePage.tsx`). The PMTCT register wrappers that the task brief mentions are **not** in this range: they
sit at `legacy:src/lib/api.ts:348-366` (first half). A cross-reference row is included at the end of the Calls table
so they are not lost.

## Infrastructure

**Base URL.** `DQA_BASE_URL = getBackendBaseUrl()` is computed once at module load (`legacy:src/lib/api.ts:5`).
`getBackendBaseUrl()` returns the first non-blank value of the env var **`REACT_PUBLIC_API_URL`**
(`legacy:src/lib/env.ts:16-17`, via `pickFirstEnv`, `legacy:src/lib/env.ts:3-11`). The name has no `VITE_` prefix;
it reaches the browser because the Vite config sets `envPrefix: ["VITE_", "REACT_"]` (`legacy:vite.config.ts:7`), so
every `REACT_*` variable is shipped to the client. If it is unset the base is
`""`, and every call becomes a relative URL against the SPA origin. Directus calls use `getDirectusBaseUrl()`
(env var **`REACT_APP_BASE_URL`**, `legacy:src/lib/env.ts:13-14`). `triggerServiceExport` calls `getBackendBaseUrl()`
again instead of using `DQA_BASE_URL` (`legacy:src/lib/api.ts:1441`); the value is the same.

**Request helpers used by this half.**
| Helper | Defined at | Behaviour |
| --- | --- | --- |
| `dqaPost(path, body = {})` | `legacy:src/lib/api.ts:683-699` | Throws `"Not authenticated"` if no token. `POST` with `Authorization: Bearer <token>` and JSON body. Parses with `safeJson` (`:18-24`, returns `null` on non-JSON). Non-2xx → `throw new Error(data?.message \|\| "Request failed: <status>")`. Returns the whole parsed envelope. |
| `dqaGetSkipCache(path)` | `legacy:src/lib/api.ts:701-712` | Same as `dqaPost` but `GET` and without a `Content-Type` header (`:705-707`). Despite the name, there is no cache to skip: it differs from the first-half `dqaGet` (`:185-210`) only in the error fallback (`data?.message \|\| "Request failed: <status>"` vs `data?.message ?? "DQA request failed"`, so an empty-string message falls back here but not in `dqaGet`, `:710` vs `:206`), the not-authenticated message (no trailing period, `:703` vs `:188`), and the absence of `DEBUG_API` logging. Every GET wrapper in this half uses it except `triggerServiceExport`, which uses raw `fetch` (`:1446`). |
| `withTokenParam(url)` | `legacy:src/lib/api.ts:753-757` | Appends `?token=` / `&token=` with `encodeURIComponent(token)`; returns the URL unchanged when there is no token. Used only by `getEtlDownloadUrl` and `getTabletSyncStreamUrl`. |
| raw `fetch` | `legacy:src/lib/api.ts:1092-1100`, `:1106-1113`, `:1287-1304`, `:1446` | `upsertDuplicateReview`, `deleteDuplicateReview`, `updateFlagStatus` (Directus) and `triggerServiceExport` bypass the helpers and call `fetch` directly. The two duplicate-review wrappers throw `"Not authenticated."` (with period, `:1091`, `:1105`), `updateFlagStatus` throws `"Not authenticated"` (`:1285`), and `triggerServiceExport` has **no token check at all**: with no token it simply sends the request without credentials (`:1438-1446`). |

**Auth token.** `getStoredToken()` reads `localStorage["ecap.access_token"]` once and memoises it in a module
variable, including a cached `null` (`legacy:src/lib/auth.ts:1-23`). It is a Directus access token sent to both the
DQA API and Directus. The backend accepts it from `Authorization: Bearer` or `?token=`
(`backend:middleware/verifyDirectusToken.js:31-40`, per AUDIT §3.2).

**`?token=` in URLs.** Three places put the token in a URL:
- `getEtlDownloadUrl` → `withTokenParam` (`legacy:src/lib/api.ts:759-766`); the URL is opened through an anchor
  with `target="_blank"` (`legacy:src/pages/DataPipelinePage.tsx:392-399`).
- `getTabletSyncStreamUrl` → `withTokenParam` (`legacy:src/lib/api.ts:796-798`); used by `new EventSource(...)`
  (`legacy:src/pages/DataPipelinePage.tsx:295`).
- `triggerServiceExport` sets `q.set("token", token)` (`legacy:src/lib/api.ts:1438-1439`) even though it then uses
  `fetch` (`:1446`), which could send the header instead.

**Security-fix patch (uncommitted, `git diff -- src/lib/api.ts`).** The only change in the file is in this half:
it adds `withTokenParam` (`legacy:src/lib/api.ts:751-757`, with a comment that anchor downloads and EventSource
cannot send headers) and wraps the two URLs above in it (`:763-765`, `:797`). Before the patch both URLs carried no
credential, so under `AUTH_MODE=enforce` the CSV download and the SSE stream would have got `401`. (`enforce` is
the code default, `backend:middleware/verifyDirectusToken.js:42-45`; `backend:.env.example:29` sets `log`.) The patch does
not touch `triggerServiceExport`, which already sent `token` in the query string. A related uncommitted change in
`legacy:src/components/EtlInvalidator.tsx:33-39` adds the bearer header to the `/etl/last-success` poll (outside this file).

**Timeouts / abort.** None. No wrapper sets a timeout or accepts an `AbortSignal` (no `AbortController`/`signal`
in `legacy:src/lib/api.ts`), so React Query cannot cancel in-flight requests (e.g. superseded paginated-records
fetches, `legacy:src/components/dashboard/services/ServicesPage.tsx:309-336`).

**Retries.** None in the wrappers. React Query defaults: `retry: 1`, `staleTime: 60s`, `gcTime: 24h`,
refetch on mount/focus/reconnect (`legacy:src/App.tsx:112-134`). Some callers override, e.g. `refetchInterval:
10_000` for runs and 15 min for tablet sync (`legacy:src/pages/DataPipelinePage.tsx:190-201`).

**Error normalisation.** Inconsistent (see Issues): helper wrappers surface the server `message`; the duplicate-review
wrappers throw fixed strings and ignore the body (`legacy:src/lib/api.ts:1100`, `:1113`); `getServiceRecordDetail`
swallows every error and returns `null` (`:1398-1405`); `triggerServiceExport` reports `Export failed: <status>`
(`:1450`); `updateFlagStatus` reads `errorData?.message` from a Directus response (`:1300-1301`).

**401 / expiry.** No handling anywhere in this half (no status-specific branch; grep for `401` in `legacy:src`
finds nothing). A 401 becomes a thrown `Error` whose message is the backend's `{"status":"fail","message":...}`
text. There is no token refresh, no redirect to login, and the memoised token in `auth.ts` is not cleared.

**Debug logging.** `DEBUG_API` (`import.meta.env.DEV && VITE_DEBUG_API === "true"`, `legacy:src/lib/api.ts:15-16`)
is used only by the first-half `dqaGet`/HTS wrapper; nothing in this half logs requests. `triggerServiceExport` logs
`console.error("Export error:", error)` unconditionally (`:1483`).

**Client-side caches.** None of the wrappers in this half use `getListFromApiWithCache` / the auxiliary IndexedDB
store (`legacy:src/lib/api.ts:212-238`). Caching is React Query only, but every successful query is **persisted to
IndexedDB for 24 h** (`shouldDehydrateQuery: status === "success"`, `legacy:src/App.tsx:139-147,214-224`). That
includes caseworker GPS journeys, the caseworker list and service records from this half. `EtlInvalidator` polls
`/etl/last-success` every 30 s with its own raw `fetch` (`legacy:src/components/EtlInvalidator.tsx:28-46`) and, when
the timestamp advances, invalidates every query whose key does not start with `"etl"` (predicate at
`legacy:src/components/EtlInvalidator.tsx:79`), which covers every query key used by callers of this half except
the data-pipeline page's `["etl", ...]` keys (`legacy:src/pages/DataPipelinePage.tsx:185,191,197`) **and** the
`["etl", "ward-list"]` key that `AddUser`/`EditUser` use for `getFacilityList` (`legacy:src/pages/AddUser.tsx:239`,
`legacy:src/pages/EditUser.tsx:132`), which is therefore never invalidated by an ETL run.

**Request de-duplication.** Only through React Query keys. `CanonicalKpiStrip` and `CohortStrip` share
`["service-summary", type, district, facility, fyKey]`
(`legacy:src/components/dashboard/CanonicalKpiStrip.tsx:89`, `legacy:src/components/dashboard/services/CohortStrip.tsx:38`)
so they share one request; `ServicesPage` uses a different 6-element key for the same endpoint
(`legacy:src/components/dashboard/services/ServicesPage.tsx:296-303`), so it makes a second request. `getFacilityList`
is cached under three different keys for the same URL: `["ward-list"]` (`legacy:src/pages/Performance.tsx:564`),
`["facility-list"]` (`legacy:src/pages/CaseworkerJourneys.tsx:285`) and `["etl", "ward-list"]` (`AddUser`/`EditUser`, above).
No in-flight de-duplication in the wrappers themselves.

**Response typing.** No runtime validation. Every wrapper returns `data?.data ?? <fallback>` cast to a hand-written
TS interface (e.g. `legacy:src/lib/api.ts:655-681`, `:771-789`, `:801-810`).

## Calls

All DQA paths below are relative to `REACT_PUBLIC_API_URL`. "§3.2" = `docs/AUDIT.md` §3.2 summary table.

| Function / call site | Defined at | Method + URL template | Params sent | Target | Response handling | Callers |
| --- | --- | --- | --- | --- | --- | --- |
| `triggerEtlPipeline(pipeline)` | `legacy:src/lib/api.ts:714-717` | `POST /etl/run` | body `{ pipeline }` | §3.2 `POST /etl/run` (`backend:routes/etlRoutes.js:9`) | Returns `res.data` (the run row, typed `EtlRun`). Errors via `dqaPost`. | **UNUSED** (no import anywhere in `legacy:src`; the data-pipeline page has no "run" action) |
| `getEtlRuns(params?)` | `legacy:src/lib/api.ts:719-731` | `GET /etl/runs?limit&pipeline&status` | query `limit` (stringified), `pipeline`, `status`, each only when truthy | §3.2 `GET /etl/runs` (`backend:routes/etlRoutes.js:10`) | `data?.data ?? []` as `EtlRun[]` | `legacy:src/pages/DataPipelinePage.tsx:192` (`{ limit: 30 }`, key `["etl","runs"]`, polled every 10 s) |
| `getEtlRunById(runId)` | `legacy:src/lib/api.ts:733-736` | `GET /etl/runs/${runId}` | path `runId` **not URL-encoded** | §3.2 `GET /etl/runs/:runId` (`backend:routes/etlRoutes.js:11`) | `data?.data` (may be `undefined`, typed `EtlRun`) | `legacy:src/pages/DataPipelinePage.tsx:367` (view logs), `:383` (3 s poll while the run is `running` or `pending`, `:375-390`) |
| `cancelEtlRun(runId)` | `legacy:src/lib/api.ts:738-739` | `POST /etl/cancel/${runId}` | path `runId` not encoded; body `{}` | §3.2 `POST /etl/cancel/:runId` (`backend:routes/etlRoutes.js:12`) | Returns raw envelope | **UNUSED** |
| `getEtlPipelines()` | `legacy:src/lib/api.ts:741-744` | `GET /etl/pipelines` | none | §3.2 `GET /etl/pipelines` (`backend:routes/etlRoutes.js:13`) | `data?.data ?? []` as `EtlPipeline[]` | `legacy:src/pages/DataPipelinePage.tsx:186` |
| `getEtlFiles(pipeline)` | `legacy:src/lib/api.ts:746-749` | `GET /etl/files/${pipeline}` | path `pipeline` not encoded | §3.2 `GET /etl/files/:pipeline` (`backend:routes/etlRoutes.js:14`) | `data?.data ?? []` as `EtlFile[]` | `legacy:src/pages/DataPipelinePage.tsx:241`, called sequentially for each key in the hard-coded `PIPELINE_KEYS` (`:106`); errors swallowed to `[]` (`:242-244`) |
| `getEtlDownloadUrl(pipeline, fileName)` | `legacy:src/lib/api.ts:759-766` | URL builder: `GET /etl/download/${pipeline}/${encodeURIComponent(fileName)}?token=…` | path `pipeline` not encoded, `fileName` encoded; `token` query via `withTokenParam` (patched) | §3.2 `GET /etl/download/:pipeline/:fileName` (`backend:routes/etlRoutes.js:16`) | Returns a string; no request made here | `legacy:src/pages/DataPipelinePage.tsx:393` |
| *direct call site*: anchor download | `legacy:src/pages/DataPipelinePage.tsx:392-399` | `GET` (browser navigation, `target="_blank"`, `rel="noopener"`) | URL from `getEtlDownloadUrl` | §3.2 `GET /etl/download/:pipeline/:fileName` | Browser handles the CSV attachment; a 404/401 JSON body opens in the new tab | — |
| `sendEtlReport()` | `legacy:src/lib/api.ts:768` | `POST /etl/send-report` | body `{}` | §3.2 `POST /etl/send-report` (`backend:routes/etlRoutes.js:15`) | Returns raw envelope | `legacy:src/pages/DataPipelinePage.tsx:404` (shows `data?.message` in a success toast, `:405`) |
| `getTabletSyncStatus()` | `legacy:src/lib/api.ts:791-794` | `GET /etl/tablet-sync` | none | §3.2 `GET /etl/tablet-sync` (`backend:routes/etlRoutes.js:25`) | `data?.data` (may be `undefined`) as `TabletSyncStatus` | `legacy:src/pages/DataPipelinePage.tsx:198` (key `["etl","tablet-sync"]`, 15 min refetch) |
| `getTabletSyncStreamUrl()` | `legacy:src/lib/api.ts:796-798` | URL builder: `GET /etl/tablet-sync/stream?token=…` | `token` query via `withTokenParam` (patched) | §3.2 `GET /etl/tablet-sync/stream` (`backend:routes/etlRoutes.js:19`) | Returns a string | `legacy:src/pages/DataPipelinePage.tsx:295` |
| *direct call site*: `new EventSource(...)` | `legacy:src/pages/DataPipelinePage.tsx:285-354` | `GET` SSE | URL from `getTabletSyncStreamUrl`; opened only while `activeTab === "tablets"` and `EventSource` exists (`:281-290`) | §3.2 `GET /etl/tablet-sync/stream` | Listens to named events `tablet-sync` (writes `payload.data` into the `["etl","tablet-sync"]` cache, `:301-321`; a JSON parse failure sets "reconnecting", `:317-320`), `heartbeat` (`:323-338`), `tablet-sync-error` (`:340-344`); event names match `backend:controllers/etlController.js:636-639,685-707`; `onerror` → status "reconnecting" (`:346-348`); closed on tab change/unmount (`:350-353`) | — |
| `getFacilityPerformance(params?)` | `legacy:src/lib/api.ts:812-832` | `GET /etl/facility-performance?district&facility&ward&from&to` | `district`/`facility`/`ward` omitted when absent or `"all"` (lower-case only); `from`/`to` only when both present | §3.2 `GET /etl/facility-performance` (`backend:routes/etlRoutes.js:28`; FY **ignored** by backend: handler reads only `district, facility, ward`, `backend:controllers/etlController.js:786`) | `data?.data ?? []` as `FacilityPerformance[]` | `legacy:src/pages/Performance.tsx:567` (`{ district, ward, fy }`; district/ward default `"all"`, `:543-544`) |
| `getCaseworkerPerformance(params?)` | `legacy:src/lib/api.ts:850-870` | `GET /etl/caseworker-performance?district&facility&ward&from&to` | same rules as above | §3.2 `GET /etl/caseworker-performance` (`backend:routes/etlRoutes.js:68`; FY **ignored**, `backend:controllers/etlController.js:890`) | `data?.data ?? []` as `CaseworkerPerformance[]` | `legacy:src/pages/Performance.tsx:572` |
| `getServicePerformance(params?)` | `legacy:src/lib/api.ts:883-911` | `GET /etl/service-performance?type&district&facility&ward&from&to` | `type` omitted when absent or `"all"`; rest as above | §3.2 `GET /etl/service-performance` (`backend:routes/etlRoutes.js:71`; FY **ignored**, `backend:controllers/etlController.js:1005`) | `{ data: res?.data ?? [], meta: res?.meta ?? { total_vcas: 0, total_households: 0 } }` | `legacy:src/pages/Performance.tsx:577` (never passes `type`, so backend default `"all"`) |
| `getServiceSummary(params)` | `legacy:src/lib/api.ts:921-947` | `GET /etl/services/${type}/summary?district&facility&ward&from&to` | `type` path (`vca`\|`caregiver`\|`household`, not encoded); `district` omitted when absent, `"all"` or `"All"`; `facility`/`ward` omitted when absent or `"all"`; `from`/`to` when both present | §3.2 `GET /etl/services/:type/summary` (`backend:routes/etlRoutes.js:44`; cohort FY, `backend:controllers/etlController.js:1432`) | `{ type: params.type, source: res?.source ?? "", generated_at: res?.generated_at ?? "", data: res?.data ?? {} }` | `legacy:src/components/dashboard/CanonicalKpiStrip.tsx:90` (with FY); `legacy:src/components/dashboard/services/CohortStrip.tsx:39` (with FY); `legacy:src/components/dashboard/services/ServicesPage.tsx:304` (**without FY**, only `source`/`generated_at` used, `:535-536`) |
| `getServiceTimeseries(params)` | `legacy:src/lib/api.ts:961-987` | `GET /etl/services/${type}/timeseries?district&facility&ward&from&to` | same rules as summary | §3.2 `GET /etl/services/:type/timeseries` (`backend:routes/etlRoutes.js:47`; FY **ignored**, fixed 12 months, `backend:controllers/etlController.js:1732`) | `{ type, source, generated_at, data: res?.data ?? [] }` | `legacy:src/components/dashboard/services/ServicesTimeSeriesChart.tsx:22` |
| `getServiceDistribution(params)` | `legacy:src/lib/api.ts:1003-1031` | `GET /etl/services/${type}/distribution?district&facility&ward&from&to` | same rules as summary | §3.2 `GET /etl/services/:type/distribution` (`backend:routes/etlRoutes.js:50-53`; FY **ignored**, fixed 90 days, `backend:controllers/etlController.js:1828`) | `{ type, source, generated_at, total: res?.total ?? 0, window_days: res?.window_days ?? 90, data: res?.data ?? [] }` | `legacy:src/components/dashboard/services/ServicesDistributionChart.tsx:31` |
| `getActionQueue(params)` | `legacy:src/lib/api.ts:1049-1068` | `GET /etl/action-queue?type&district&facility&ward` | `type` always; `district`/`facility`/`ward` omitted when absent or `"all"` (lower-case only). No FY. | §3.2 `GET /etl/action-queue` (`backend:routes/etlRoutes.js:41`) | `{ type: res?.type ?? params.type, generated_at: res?.generated_at ?? "", data: res?.data ?? [] }` | `legacy:src/components/dashboard/services/QualityReviewPanel.tsx:87` (live); `legacy:src/components/dashboard/ActionQueueBanner.tsx:27` (**dead**: `ActionQueueBanner` is never imported) |
| `listDuplicateReviews()` | `legacy:src/lib/api.ts:1079-1082` | `GET /etl/duplicates/reviews` | none | §3.2 `GET /etl/duplicates/reviews` (`backend:routes/etlRoutes.js:74`) | `data?.data ?? []` as `DuplicateReview[]` | `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:91` only. **Effectively UNUSED**: `DuplicateDetectionCard` is rendered only by `legacy:src/pages/VcaServicesDashboard.tsx:947`, and `VcaServicesDashboard` is not imported by `legacy:src/App.tsx` or any other file |
| `upsertDuplicateReview(payload)` | `legacy:src/lib/api.ts:1084-1101` | `POST /etl/duplicates/review` (raw `fetch`) | JSON body `{ run_key, service_type?, reviewed_by?, note? }` | §3.2 `POST /etl/duplicates/review` (`backend:routes/etlRoutes.js:75`) | Returns `void`; non-2xx → `throw new Error("Failed to save review")` (body ignored) | `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:181` (sends `{ run_key, service_type: type }`) — same dead-component caveat |
| `deleteDuplicateReview(run_key)` | `legacy:src/lib/api.ts:1103-1114` | `DELETE /etl/duplicates/review/${encodeURIComponent(run_key)}` (raw `fetch`) | path `run_key` encoded | §3.2 `DELETE /etl/duplicates/review/:run_key` (`backend:routes/etlRoutes.js:76-79`) | Returns `void`; non-2xx → `"Failed to delete review"` | `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:178` — same dead-component caveat |
| `getCaseworkerJourneys(params)` | `legacy:src/lib/api.ts:1142-1160` | `GET /etl/caseworker-journeys?caseworker&from&to&facility` | `caseworker`/`facility` omitted when absent or `"all"`; `from`/`to` passed through verbatim (caller formats `yyyy-MM-dd`, `legacy:src/pages/CaseworkerJourneys.tsx:400-401`). No district. | §3.2 `GET /etl/caseworker-journeys` (`backend:routes/etlRoutes.js:31`) | `data?.data ?? []` as `JourneyPoint[]`. The backend also returns `facility`, `entity_id` and `household_id` (`backend:controllers/etlController.js:1294-1296`), which the type omits and the page reads through `any` casts (`legacy:src/pages/CaseworkerJourneys.tsx:316,330-334,826-827`). With no filter the backend returns 400 (`backend:controllers/etlController.js:1245-1250`). | `legacy:src/pages/CaseworkerJourneys.tsx:268` (enabled only when at least one filter is set, `:258-276`, mirroring the backend 400) |
| `getCaseworkerList(scope?)` | `legacy:src/lib/api.ts:1162-1237` | `GET /etl/caseworker-list?district&province` | `district`/`province` omitted when absent, `"all"` or `"All"` | §3.2 `GET /etl/caseworker-list` (`backend:routes/etlRoutes.js:34`) | `getListValue(data)` (first-half list guesser, `:116-183`), then per row field guessing: **caseworker** from `caseworker, provider, provider_id, providerId, username, user_name, caseworker_name, display_name, name` (`:1189-1199`); **display_name** from `display_name, caseworker_name, full_name, name`, else caseworker (`:1200-1202`); **location_id** from `location_id, locationId` (`:1213`); **facility** from `facility, ward, location_name` (`:1214`); `district`, `province` (`:1215-1216`); **has_gps** from `has_gps ?? hasGps ?? gps_available ?? has_gps_data ?? gps_count ?? gps_points ?? gps_events ?? journey_points ?? false` (`:1217-1225`), and copies all 7 alternates through (`:1226-1233`). Non-object rows are coerced to `{ caseworker: raw }` (`:1177-1180`); every guessed value is `String(v ?? "").trim()` (`:1181-1188`), so missing fields become `""` rather than `null`. Rows with no caseworker dropped; de-duplicated case-insensitively on caseworker (`:1204-1207`). Backend actually returns `caseworker, display_name, facility` (= `c.ward`), `district, province, has_gps` (`backend:controllers/etlController.js:1361-1369`). Declared return type `{ caseworker; location_id }[]` (`:1165`) is narrower than what is returned. | `legacy:src/pages/CaseworkerJourneys.tsx:242` (called with **no scope**; role scoping done client-side, `:230-256`) |
| `getFacilityList()` | `legacy:src/lib/api.ts:1239-1242` | `GET /etl/facility-list` | none | §3.2 `GET /etl/facility-list` (`backend:routes/etlRoutes.js:35`; returns ward names) | `data?.data ?? []` as `string[]` | `legacy:src/pages/Performance.tsx:564` (key `["ward-list"]`); `legacy:src/pages/CaseworkerJourneys.tsx:286` (key `["facility-list"]`); `legacy:src/pages/AddUser.tsx:240` and `legacy:src/pages/EditUser.tsx:133` (key `["etl","ward-list"]`, enabled only for facility-level users, `AddUser.tsx:241`, `EditUser.tsx:134`) |
| `getDuplicates(params)` | `legacy:src/lib/api.ts:1270-1281` | `GET /etl/duplicates?type&district&facility` | `type` always; `district`/`facility` whenever truthy (no sentinel stripping) | §3.2 `GET /etl/duplicates` (`backend:routes/etlRoutes.js:36`; district sentinel `"All Districts"`, facility sentinel `"all"`, `backend:controllers/etlController.js:2379-2386`) | `data?.data` (may be `undefined`) as `DuplicateResponse` | `legacy:src/components/dashboard/services/QualityReviewPanel.tsx:93` (live; `district` is `undefined` for "All", `legacy:src/components/dashboard/services/ServicesPage.tsx:287-288,772`); `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:85` (dead component) |
| `updateFlagStatus(flagId, status)` | `legacy:src/lib/api.ts:1283-1305` | `PATCH {REACT_APP_BASE_URL}/items/flagged_forms_ecapplus_pmp/${flagId}` (raw `fetch`) | path `flagId` **not encoded**; JSON body `{ status }` | Directus REST, collection `flagged_forms_ecapplus_pmp` | Non-2xx → `throw new Error(errorData?.message \|\| "Failed to update flagged record")`; else returns parsed body | `legacy:src/pages/Flags.tsx:173`; `legacy:src/pages/VcaProfile.tsx:328`; `legacy:src/pages/HouseholdProfile.tsx:302` (all pass `"resolved"`) |
| `getServiceRecords(params)` | `legacy:src/lib/api.ts:1346-1387` | `GET /etl/services/${type}/records?district&search&domain&issue&dateWindow&entityId&page&pageSize` | `district` omitted when absent or `"All"` (capital only); `domain` omitted when `"all"`; `dateWindow` omitted when `"all"`; `search`, `issue`, `entityId` when truthy; `page`, `pageSize` stringified when truthy. No FY. | §3.2 `GET /etl/services/:type/records` (`backend:routes/etlRoutes.js:56`) | Defaults every field: `page ?? 1`, `pageSize ?? 12`, `totalRecords ?? 0`, `totalPages ?? 1`, `stats ?? { loaded:0, monthly:0, recordsWithIssues:0, issueCounts:{} }`, `data ?? []` | `legacy:src/components/dashboard/services/ServicesPage.tsx:323` (`pageSize: ITEMS_PER_PAGE` = 12, `:101`) |
| `getServiceRecordDetail(params)` | `legacy:src/lib/api.ts:1389-1406` | `GET /etl/services/${type}/record-detail?entityId&district` | `entityId` always; `district` omitted when absent or `"All"` | §3.2 `GET /etl/services/:type/record-detail` (`backend:routes/etlRoutes.js:59-62`) | `res?.data ?? null`; **any error → `null`** | `legacy:src/components/dashboard/services/ServicesPage.tsx:424` (passes `record.district` unless `"N/A"`) |
| `triggerServiceExport(params, onProgress?)` | `legacy:src/lib/api.ts:1416-1486` | `GET {getBackendBaseUrl()}/etl/services/${type}/export?district&search&domain&issue&dateWindow&entityId&token` (raw `fetch`, **no Authorization header**) | Same filter rules as `getServiceRecords` (no page/pageSize); `token` in query when present | §3.2 `GET /etl/services/:type/export` (`backend:routes/etlRoutes.js:65`) | Reads the whole body stream into memory chunks, builds a `Blob` (`text/csv`), clicks a generated anchor with client-side name `${type}-services-<UTC yyyy-mm-dd>.csv` (`:1460-1478`); progress callback `preparing → downloading → done` or `error`; non-2xx → `Export failed: <status>` (`:1448-1451`); missing body → `"No response body"` (`:1453-1456`); on these paths `onProgress("error")` fires twice (once before the throw, again in `catch`, `:1482`) and the error is rethrown, so the caller shows up to three identical "Export failed" toasts (`legacy:src/components/dashboard/services/ServicesPage.tsx:463-466,469-470`) | `legacy:src/components/dashboard/services/ServicesPage.tsx:442` |
| *cross-reference (first half)* `getPmtctChildRegisterByDistrict` / `getPmtctMotherRegisterByDistrict` | `legacy:src/lib/api.ts:348-366` | `GET /etl/pmtct-child-register/${encodeURIComponent(district)}${fyQs(fy)}`, `GET /etl/pmtct-mother-register/...` | path district encoded; `from`/`to` via `fyQs` (`:241-245`) | §3.2 `GET /etl/pmtct-child-register/:district(*)`, `GET /etl/pmtct-mother-register/:district(*)` (`backend:routes/etlRoutes.js:82-85`, `backend:routes/etlRoutes.js:88-91`; FY **ignored**, no `All`) | `getListValue(data)` | `legacy:src/pages/PMTCTRegister.tsx:175`, `:191` (one query per district, `:163-167`). Documented in detail by the first-half reader. |

**No NO BACKEND ROUTE rows in this half.** Re-checked against `backend:routes/etlRoutes.js:7-91` (mounted at `/etl`, `backend:index.js:42`, behind `verifyDirectusToken`, `backend:index.js:38`) and §3.2: every DQA URL above matches a route (no `:district(*)` wildcard is involved except the PMTCT cross-reference), and `updateFlagStatus` targets the Directus `items` API. Conversely, four `/etl` routes have **no wrapper** in `legacy:src/lib/api.ts`: `GET /etl/last-success` (raw `fetch` in `legacy:src/components/EtlInvalidator.tsx:35`), `POST /etl/tablet-sync/notify` (Mage webhook, `backend:routes/etlRoutes.js:22`), `GET /etl/dqa-checks` and `GET /etl/dqa-records` (`backend:routes/etlRoutes.js:37-38`; no reference anywhere in `legacy:src`).

## Issues

1. **Unused wrappers / dead callers.** `triggerEtlPipeline` and `cancelEtlRun` have no caller
   (`legacy:src/lib/api.ts:714-717`, `:738-739`), so the data-pipeline page can only view runs, download files and
   email the report. `listDuplicateReviews`, `upsertDuplicateReview` and `deleteDuplicateReview` are only called from
   `DuplicateDetectionCard`, which is only rendered by the unrouted `VcaServicesDashboard`
   (`legacy:src/pages/VcaServicesDashboard.tsx:32,947`; no import in `legacy:src/App.tsx`), so the three
   `/etl/duplicates/review*` endpoints have no live caller. `ActionQueueBanner` is never imported, so its
   `getActionQueue` call is dead (`legacy:src/components/dashboard/ActionQueueBanner.tsx:27`).

2. **FY sent but ignored by the backend.** `getFacilityPerformance`, `getCaseworkerPerformance`,
   `getServicePerformance` (`legacy:src/lib/api.ts:824-827`, `:862-865`, `:900-903`), `getServiceTimeseries` and
   `getServiceDistribution` (`:974-977`, `:1016-1019`) send `from`/`to`; §3.2 marks all five handlers "ignored". The
   Performance page and the service charts key their queries on the FY (`legacy:src/pages/Performance.tsx:559-579`,
   `legacy:src/components/dashboard/services/ServicesTimeSeriesChart.tsx:21`,
   `legacy:src/components/dashboard/services/ServicesDistributionChart.tsx:30`), so changing FY refetches and shows
   identical data while implying it is FY-filtered. Same for the PMTCT wrappers (cross-reference row).

3. **FY in key but not in request.** `ServicesPage` includes `fyKey` in the summary query key but calls
   `getServiceSummary({ type, district })` without `fy` (`legacy:src/components/dashboard/services/ServicesPage.tsx:295-305`),
   while `CanonicalKpiStrip`/`CohortStrip` on the same page do send FY. Two requests to the same endpoint with
   different semantics; the header's `source`/`generated_at` come from the non-FY one (`:535-536`).

4. **District "all" sentinels differ per wrapper and per endpoint.**
   - Performance wrappers strip only lower-case `"all"` (`legacy:src/lib/api.ts:819`, `:857`, `:895`); the backend
     also strips only `"all"` and treats capital `"All"` as a literal district (`backend:controllers/etlController.js:791`, `:895`, `:1010`).
   - Summary/timeseries/distribution strip `"all"` and `"All"` (`:929`, `:969`, `:1011`), matching the backend
     (`backend:controllers/etlController.js:1436`, `:1735`, `:1831`).
   - `getActionQueue` strips only `"all"` (`:1057`); backend sentinel is `"all"` only (`backend:controllers/etlController.js:1919`).
   - `getDuplicates` strips nothing (`:1277`); backend sentinel is `"All Districts"` (`backend:controllers/etlController.js:2379`),
     so `"all"`/`"All"` would return an empty result. Live callers pass `undefined` for all districts, so this is latent today.
   - `getServiceRecords`, `getServiceRecordDetail` and `triggerServiceExport` strip only capital `"All"`
     (`:1358`, `:1396`, `:1429`); the backend accepts both (`backend:controllers/etlController.js:2735`, `:3174`, `:3407`).
     The only caller already maps "All" to `undefined` (`legacy:src/components/dashboard/services/ServicesPage.tsx:287-288`).
   - `getCaseworkerList` strips `"all"`/`"All"` (`:1167-1170`), matching `backend:controllers/etlController.js:1339-1346`.
   The new app needs one scope-to-params mapping per endpoint, not per wrapper.

5. **Role scope enforced only client-side, by comparing role strings.** `getCaseworkerList` supports
   `district`/`province`, but its only caller fetches the full national list and filters by
   `user.description === "District User"` / `"Provincial User"` against `user.location` / `user.title`, falling back
   to the **full list** when nothing matches (`legacy:src/pages/CaseworkerJourneys.tsx:230-256`). The ward list is
   filtered from that (possibly unscoped) caseworker list, or emptied when no caseworker carries a ward (`:290-309`, `:302`). `getCaseworkerJourneys` sends no district at all (`legacy:src/lib/api.ts:1148-1155`)
   and the backend ignores district (§3.2). Any user can therefore load GPS points for any caseworker. Performance,
   tablet sync, ETL downloads and service records are likewise unscoped from the frontend's side (callers pass
   whatever the dropdown holds). Backend ask: derive scope server-side.

6. **Field-name guessing in `getCaseworkerList`.** Nine candidate keys for the caseworker id, four for the display
   name, two for `location_id`, three for facility and eight for `has_gps` (`legacy:src/lib/api.ts:1189-1233`), plus
   `getListValue`'s heuristic "first array in the object" fallback (`:166-180`). The caller repeats the `has_gps`
   guessing (`legacy:src/pages/CaseworkerJourneys.tsx:169-181`). The backend returns a fixed shape
   (`facility` alias holding the ward, boolean `has_gps`, `backend:controllers/etlController.js:1361-1370`); it never returns `location_id`, which the declared return type
   requires (`legacy:src/lib/api.ts:1165`). The declared type is also narrower than the returned object, so the caller
   casts to `any[]` (`legacy:src/pages/CaseworkerJourneys.tsx:247`). The new normaliser should parse the one real
   shape with zod.

7. **Token in URLs.** `?token=` is used for the ETL download, the SSE stream (both added by the security patch,
   `legacy:src/lib/api.ts:751-766,796-798`) and the service export (`:1438-1439`). The export does not need it: it
   uses `fetch`, which can send `Authorization`. The download opens in a new tab (`legacy:src/pages/DataPipelinePage.tsx:392-399`),
   so the token lands in browser history as well as proxy/access logs. `withTokenParam` silently returns a
   token-less URL when there is no token (`:755`), giving a 401 JSON page instead of a clear error.

8. **SSE stream does not recover from auth failure.** The EventSource URL is built once per effect run with the
   token current at that moment (`legacy:src/pages/DataPipelinePage.tsx:295`). If the token expires, a reconnect
   gets 401; per the EventSource spec a non-200 response closes the source permanently, but `onerror` only sets the
   status to `"reconnecting"` (`:346-348`), so the UI shows "reconnecting" indefinitely until the user leaves the tab.

9. **Inconsistent error handling.**
   - `upsertDuplicateReview` / `deleteDuplicateReview` throw fixed strings and drop the server message
     (`legacy:src/lib/api.ts:1100`, `:1113`); the backend's 400 `"run_key is required"` is lost.
   - `getServiceRecordDetail` returns `null` on any error (`:1398-1405`), so 404 "Record not found", 400 and 500 all
     look like "no detail".
   - `updateFlagStatus` reads `errorData?.message` (`:1300-1301`); Directus REST errors are conventionally
     `{ errors: [{ message }] }`, so the generic fallback is what users would see (Directus error shape not verified
     in this repo).
   - `getEtlRunById`, `getTabletSyncStatus` and `getDuplicates` return `data?.data` without a fallback (`:735`,
     `:793`, `:1280`), so a 200 with an unexpected body yields `undefined` typed as a non-optional object.
   - `triggerServiceExport` cannot detect a failure after streaming starts: §3.2 says the backend then ends with
     status 200 and a truncated CSV, and keep-alive lines `# preparing data...` are written into the body; the wrapper
     blobs everything as-is (`:1461-1471`).
   - `getEtlFiles` errors are swallowed per pipeline by the caller (`legacy:src/pages/DataPipelinePage.tsx:240-244`).

10. **Export buffers the whole CSV in memory.** The doc comment says "no fetch, no memory allocation"
    (`legacy:src/lib/api.ts:1408-1412`) but the code that follows is the fetch-based replacement (comment at
    `:1413-1414`) that collects every chunk into an array and a `Blob` (`:1461-1471`). National exports of
    record-level data can be large. The downloaded file name is generated client-side from the UTC date (`:1474`),
    ignoring the server's `Content-Disposition`.

11. **Path segments not encoded.** `runId` (`legacy:src/lib/api.ts:734`, `:739`), `pipeline` (`:747`, `:764`),
    `type` (`:939`, `:979`, `:1021`, `:1370`, `:1400`, `:1441`) and the Directus `flagId` (`:1288`) are interpolated
    raw. Values come from server data or typed unions today, so the risk is low, but the new client should build
    paths with an encoder.

12. **`sendEtlReport` surfaces recipient emails.** The page shows `data?.message` in a toast
    (`legacy:src/pages/DataPipelinePage.tsx:404-405`), and the backend message is
    `"Report email sent to <recipients>"` (`backend:controllers/etlController.js:364`) built from a hard-coded address list
    (`backend:controllers/etlController.js:271`), so any user who clicks sees those addresses.

13. **Persisted PII.** All successful queries are persisted to IndexedDB for 24 h with no exclusion list
    (`legacy:src/App.tsx:214-224`). From this half that includes GPS journey points, the caseworker list, tablet-sync
    providers and paginated service records. Nothing in `legacy:src` clears the persisted React Query store on logout
    (`clearApiCache` only clears the auxiliary store, `legacy:src/lib/api.ts:247-251`); it is only discarded when the
    hard-coded `PERSIST_BUSTER` string changes (`legacy:src/App.tsx:152,219`). The new app must mark these
    `meta: { persist: false }`.

14. **No timeouts and no abort.** See Infrastructure; the records table fires a request per page/filter change
    (`legacy:src/components/dashboard/services/ServicesPage.tsx:309-336`) and superseded requests run to completion.

15. **Duplicated plumbing.** Seven GET wrappers repeat the same `district/facility/ward/from/to` query building with
    small sentinel differences (`getActionQueue` has no FY part) (`legacy:src/lib/api.ts:818-827`, `:856-865`, `:893-903`, `:928-937`, `:968-977`,
    `:1010-1019`, `:1055-1061`); `getServiceRecords` and `triggerServiceExport` duplicate their filter mapping
    (`:1357-1367` vs `:1428-1436`); `dqaGetSkipCache` duplicates `dqaGet` (`:701-712` vs `:185-210`). Two helper
    families plus four raw `fetch` call sites with slightly different header sets (`dqaPost` sends
    `Content-Type`, `dqaGetSkipCache` does not; `EtlInvalidator` sends `Content-Type` on a GET,
    `legacy:src/components/EtlInvalidator.tsx:36-39`).

16. **Unused params / capabilities.** `getFacilityPerformance`, `getCaseworkerPerformance` and
    `getServicePerformance` accept `facility`, and `getServicePerformance` accepts `type`, but the only caller never
    passes them (`legacy:src/pages/Performance.tsx:567-577`). `getEtlRuns` supports `pipeline`/`status` filters that
    the page never uses (`legacy:src/pages/DataPipelinePage.tsx:192`). `getCaseworkerJourneys` sends `facility` (a
    ward name from `/etl/facility-list`) which the backend matches with a fuzzy `LIKE` on location names (§3.2), and the
    page then filters the same points again client-side by substring (`legacy:src/pages/CaseworkerJourneys.tsx:312-321`).

17. **Type drift.** `DuplicateGroup.duplicate_count` is declared `number` (`legacy:src/lib/api.ts:1249`) but §3.2
    says the backend sends a string; callers wrap it in `Number(...)`
    (`legacy:src/components/dashboard/services/QualityReviewPanel.tsx:72`). `TabletSyncProvider.location_id` is
    `string` (`legacy:src/lib/api.ts:773`) but can be `null` on the fallback path (§3.2). `JourneyPoint` has no
    `facility`, `entity_id` or `household_id` field (`:1117-1123`) although the backend returns all three
    (`backend:controllers/etlController.js:1294-1296`); the page reads them through `any` casts
    (`legacy:src/pages/CaseworkerJourneys.tsx:315-316,330-334,826-827`).

18. **Journey date and ward filters are loose.** The backend compares `from`/`to` as text against `dateCreated`
    (`backend:controllers/etlController.js:1220-1227`) and the page sends bare `yyyy-MM-dd` dates
    (`legacy:src/pages/CaseworkerJourneys.tsx:400-401`); if `dateCreated` is a full timestamp string (data not checked
    here), events on the `to` day sort after `"yyyy-MM-dd"` and are excluded. The client-side ward filter matches
    `f === filter || f.includes(filter) || filter.includes(f)` (`legacy:src/pages/CaseworkerJourneys.tsx:316-317`); a point
    whose `facility` is null becomes `""`, and `filter.includes("")` is always true, so points with no location name pass
    every ward filter. The backend's own ward filter is a `LIKE %name%` on location names that keeps up to 10 matches
    (`backend:controllers/etlController.js:1230-1241`).
