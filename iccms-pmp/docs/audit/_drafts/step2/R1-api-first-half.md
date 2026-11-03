# Step 2 draft — R1: `src/lib/api.ts` lines 1–713, `src/constants/api.ts`, `src/lib/env.ts`

Scope: every helper and exported wrapper from the top of `legacy:src/lib/api.ts` up to (not including) the ETL
wrappers that start at `legacy:src/lib/api.ts:714`. The ETL types (`EtlRun`, `EtlPipeline`, `EtlFile`, `:655-681`)
and the shared helpers `dqaPost` / `dqaGetSkipCache` (`:683-712`) are in range and are covered under Infrastructure.
Caller lists come from a whole-word grep of `legacy:src` for each exported name; "import only" means the name is
imported but never referenced again in that file.

## Infrastructure

### Base URLs and env vars
- `legacy:src/lib/env.ts:1-17`. `pickFirstEnv(...keys)` reads `import.meta.env[key]` and returns the first non-blank
  value, else `""` (`:3-11`). Only one key is passed to each helper:
  - `getDirectusBaseUrl()` → `REACT_APP_BASE_URL` (`legacy:src/lib/env.ts:13-14`). Directus REST base.
  - `getBackendBaseUrl()` → `REACT_PUBLIC_API_URL` (`legacy:src/lib/env.ts:16-17`). DQA backend base.
- These are not `VITE_*` names. They reach the browser because `vite.config.ts` sets `envPrefix: ["VITE_", "REACT_"]`
  (`legacy:vite.config.ts:7`), so **every** `REACT_*` variable in the env file is shipped in the bundle.
- `DQA_BASE_URL` is captured once at module load (`legacy:src/lib/api.ts:5`), whereas the Directus base is read per
  call (`legacy:src/lib/api.ts:615,635`). Neither helper trims a trailing slash. If the variable is unset, the base is
  `""` and every request becomes a same-origin relative URL against the SPA host (no error is raised).
- Other env reads in range: `VITE_DEFAULT_DISTRICT` exported as `DEFAULT_DISTRICT` (`legacy:src/lib/api.ts:7`) and
  `VITE_DEBUG_API` (`legacy:src/lib/api.ts:15-16`).
- `legacy:src/constants/api.ts` is **not** an API-constants file: it is the training-log loader. It exports
  `TRAINING_LOG_IS_MOCK = true` (`:8`) and `getTrainingLog()`, which waits 300 ms and returns
  `generateMockTrainingLog()` (`:25-29`). It makes no HTTP call. The comment says a real endpoint would be
  `dqaGet("/training/log" + fyQs(fy))` (`:13-23`); no such route exists in §3.2.

### Request helpers
| Helper | Lines | Behaviour |
| --- | --- | --- |
| `dqaGet(path)` | `legacy:src/lib/api.ts:185-210` | Reads the token with `getStoredToken()`; throws `Error("Not authenticated.")` if absent (`:186-189`). `fetch(DQA_BASE_URL + path, { headers: { Authorization: "Bearer <token>" } })` (`:194-198`). Body parsed with `safeJson` (`:200`). On `!response.ok` throws `Error(data?.message ?? "DQA request failed")` (`:205-207`). Returns the raw parsed body. |
| `dqaPost(path, body = {})` | `legacy:src/lib/api.ts:683-699` | Same token check but message `"Not authenticated"` (no full stop) (`:685`). POST JSON with `Content-Type: application/json` (`:687-694`). Error: `data?.message \|\| "Request failed: <status>"` (`:696-697`). Used only by ETL wrappers after line 713. |
| `dqaGetSkipCache(path)` | `legacy:src/lib/api.ts:701-712` | Functionally identical to `dqaGet` minus debug logging, with `dqaPost`'s error text (`:709-710`). The name is misleading: `dqaGet` itself has no cache. Used only after line 713: ETL wrappers from `legacy:src/lib/api.ts:729,734,742,747,792` through `:1399` (about 18 call sites). |
| `safeJson(response)` | `legacy:src/lib/api.ts:18-24` | `response.json()` or `null` on parse failure (e.g. HTML error pages). |
| `getListFromApiWithCache(key, path, ttl)` | `legacy:src/lib/api.ts:212-238` | IndexedDB-backed list cache, see below. |
| `fyQs(fy)` | `legacy:src/lib/api.ts:240-245` | Returns `?from=<from>&to=<to>` via `URLSearchParams` only when **both** are truthy, else `""`. Dates are ISO `YYYY-MM-DD` from `legacy:src/lib/fiscalYear.ts:15,45,53`, matching the backend's `parseFyWindow` regex. |
| Direct `fetch` to Directus | `legacy:src/lib/api.ts:614-621,634-644` | `getFlaggedRecords` / `createFlaggedRecord` bypass `dqaGet` and call Directus with the same Bearer token. |

- **Token source.** `getStoredToken()` reads `localStorage["ecap.access_token"]` once and memoises it in a module
  variable (`legacy:src/lib/auth.ts:1,7-23`). `setStoredToken`/`clearStoredToken` update both
  (`legacy:src/lib/auth.ts:25-41`). The same Directus access token is sent to both the DQA backend and Directus.
- **`?token=` query.** Not used anywhere in lines 1–713. The uncommitted security patch
  (`git diff -- src/lib/api.ts`) adds only `withTokenParam(url)` (`legacy:src/lib/api.ts:753-757`) and applies it to
  `getEtlDownloadUrl` (`:763`) and `getTabletSyncStreamUrl` (`:797`), both outside this range. **The patch does not
  touch lines 1–713, `constants/api.ts` or `env.ts`.**
- **Timeouts:** none. No `AbortController`/`signal` is passed by any helper, and React Query's `signal` is not
  forwarded (wrapper signatures take no signal), so cancelled queries keep downloading.
- **Retries:** none in the wrappers; left to React Query per caller.
- **Error normalisation:** errors are plain `Error(message)`; the HTTP status is discarded in `dqaGet`
  (`legacy:src/lib/api.ts:205-207`), so callers cannot tell 401 from 404 from 500. Backend 404s produce
  `"Can't find <url> on this server"` (backend 404 catch-all, `backend:index.js:55-60`), which becomes the thrown message.
- **401 / expiry handling:** none in this file. No status check, no token refresh, no `clearStoredToken()` on 401.
  Expired tokens surface as thrown `Error`s (or, for flags, as a bogus list; see Issues).
- **Debug logging:** only when `import.meta.env.DEV && VITE_DEBUG_API === "true"` (`legacy:src/lib/api.ts:15-16`).
  Logs the full URL, token *presence* (not value) and the **full response body** (`:190-193,201-203`), plus the raw
  HTS response (`:436-438`). Production builds never log.
- **Client-side caches.**
  - IndexedDB DB `ecap_plus_cache_db`, store `api_cache`, version 1 (`legacy:src/lib/indexedDbCache.ts:6-8`). Entries
    are `{ value, updatedAt }` (`:1-4,69-72`). Read/write errors are swallowed with `console.warn`
    (`:56-59,76-78`).
  - `getListFromApiWithCache` returns the cached list when `now - updatedAt <= ttl` (`legacy:src/lib/api.ts:217-222`).
    Otherwise it fetches, normalises with `getListValue`, writes the cache fire-and-forget (`:224-228`). On a fetch
    error it **returns the expired cache entry if any** (stale-on-error) with a `console.warn` (`:229-235`).
  - TTLs: `LIST_CACHE_TTL_MS = 60 s` for the household and VCA registers (`legacy:src/lib/api.ts:9-14`);
    `SERVICES_CACHE_TTL_MS = 5 min` for the three services-by-district lists (`:8`).
  - Keys: `households_by_district:<d|ALL>[:<from>_<to>]` (`:305-308`), `children_by_district:<d|ALL>[:<from>_<to>]`
    (`:372-375`), `caregiver_services_by_district:<d|ALL>` (`:411-413`), `household_services_by_district:<d|ALL>`
    (`:420-422`), `vca_services_by_district:<d|ALL>` (`:500-502`). Keys contain **no user id**.
  - Clearing: `clearApiCache()` (`legacy:src/lib/api.ts:247-251`) → `clearAllCacheEntries()`
    (`legacy:src/lib/indexedDbCache.ts:81-92`). Also cleared when the ETL watermark advances
    (`legacy:src/components/EtlInvalidator.tsx:77`) and when the persist buster changes (`legacy:src/App.tsx:157-162`).
    **Not cleared on logout** (`legacy:src/context/AuthContext.tsx:148-151` only clears the token and user).
- **Request de-duplication:** none in this file (no in-flight promise map). Only React Query's per-key dedupe applies,
  and callers use different query keys for the same URL (e.g. `["households","district",""]` at
  `legacy:src/pages/HouseholdProfile.tsx:155` vs `["hh-districts-discovery-services",fyKey]` at
  `legacy:src/pages/HouseholdServicesPage.tsx:53`; both request `/household/all-households/` when the FY filter is
  "All time", because `HouseholdServicesPage` then passes `fyArg = undefined`, `legacy:src/pages/HouseholdServicesPage.tsx:48,54`).
  The IndexedDB layer partly masks this: both resolve to the same cache key `households_by_district:ALL`.

### Response normalisers (field-name guessing)
- **`getCountValue(data)`** (`legacy:src/lib/api.ts:26-114`):
  1. number → itself; numeric string → number (`:27-34`).
  2. `record.count` if **truthy**: number, numeric string, or nested `{count:{count:x}}` (`:43-59`).
  3. first numeric/numeric-string among `total`, `totalCount`, `total_count`, `totalVcaCount`, `total_vca_count`,
     `data` (`:61-81`). An empty or blank string candidate parses as `Number("") === 0` and is returned as `0`.
  4. `data` array → its length (`:83-86`).
  5. `data` object → `count`, `total`, `totalCount`, `total_count`, `totalVcaCount`, `total_vca_count` (`:88-111`).
  6. else `null`.
  Backend count shapes are `{status, count:"<string>"}` (household/child: un-cast `COUNT(...)`, a pg bigint, so a
  string; `backend:controllers/householdController.js:25-28`, `backend:controllers/childController.js:27,32`) and
  `{status, count:<number>}` (mother: `COUNT(...)::int`, `backend:controllers/motherController.js:36-39,52-59`), so step 2
  is the only branch that matters in practice.
- **`getListValue(data)`** (`legacy:src/lib/api.ts:116-183`): array → itself; else the first array under any of 16
  keys (`data`, `results`, `records`, `referrals`, `referral`, `caregiver_referrals`, `caregiver_referral`,
  `caregiver_services`, `caregiver_services_by_district`, `household_services`, `services`, `caseplans`, `members`,
  `vca_services`, `vca_services_by_district`, `household_services_by_district`) (`:126-151`); then the same keys one
  level deep (`:153-164`); then **the first non-empty array under any key** (`:166-172`); then any array at all
  (`:174-180`); else `[]`. Every DQA list endpoint in §3.2 returns `{status, data:[...]}`, so only `data` is ever
  needed.

## Calls

Legend: **NO BACKEND ROUTE** = path matches no row in AUDIT.md §3.2 nor any route in `backend:routes/*.js` (the backend
answers `404 {"status":"error","message":"Can't find <url> on this server"}`, `backend:index.js:55-60`, which `dqaGet`
turns into a thrown `Error`). The "no trailing segment → 404" verdicts rely on Express 4 (`backend:package.json:27`)
compiling `/x/:district(*)` with a mandatory `/` before the wildcard, so `/x` does not match while `/x/` does (empty
param). The backend has no `node_modules` checked out, so this is inferred from Express 4 path-matching rules, not
executed. **UNUSED** = never called. FY = `fyQs(fy)` (`?from=&to=` only when both set).

| Function / call site | Defined at | Method + URL template | Params sent | Target | Response handling | Callers |
| --- | --- | --- | --- | --- | --- | --- |
| `DEFAULT_DISTRICT` (constant) | `legacy:src/lib/api.ts:7` | — | — | env `VITE_DEFAULT_DISTRICT` | Exported raw value, may be `undefined`. | `legacy:src/components/dashboard/GlobalSearch.tsx:52`; `legacy:src/hooks/useEffectiveDistrict.ts:12`. Import only: `legacy:src/components/dashboard/RecentActivity.tsx:13`, `legacy:src/pages/HouseholdServicesPage.tsx:38`, `legacy:src/pages/HouseholdProfile.tsx:6`, `legacy:src/pages/VcaProfile.tsx:6`. |
| `clearApiCache()` | `legacy:src/lib/api.ts:247-251` | — (IndexedDB clear) | — | local IndexedDB | `Promise.allSettled` around `clearAllCacheEntries()`. | `legacy:src/pages/MotherIndexRegister.tsx:154`; `legacy:src/pages/HTSRegister.tsx:149`; `legacy:src/pages/PMTCTRegister.tsx:204`. |
| `getTotalVcasCount(district?, fy?)` | `legacy:src/lib/api.ts:253-259` | GET `/child/vcas-count/{enc(district)}{fy}`; with no district GET `/child/vcas-count{fy}` | path district via `encodeURIComponent` (`"All"`, single name or name variant passed by caller); FY from/to | `/child/vcas-count/:district(*)`. No-district form: **NO BACKEND ROUTE** (no trailing slash → 404 → throws). | `getCountValue` → number or `null`. | `legacy:src/components/dashboard/MetricsGrid.tsx:133` (user location, FY); `legacy:src/pages/Districts.tsx:68` (location or `"All"`, FY), `:147` (one call per case-variant of a district name, FY); `legacy:src/pages/Documentation.tsx:82` (**no args → 404**). |
| `getTotalHouseholdsCount(district?, fy?)` | `legacy:src/lib/api.ts:261-270` | GET `/household/households-count/{enc(district)}{fy}`; no district → `/household/households-count{fy}` | as above | `/household/households-count/:district(*)`. No-district form: **NO BACKEND ROUTE** (404 → throws). | `getCountValue`. | `legacy:src/components/dashboard/MetricsGrid.tsx:139`; `legacy:src/pages/Districts.tsx:63`; `legacy:src/pages/Documentation.tsx:77` (**no args → 404**). |
| `getTotalMothersCount(district?)` | `legacy:src/lib/api.ts:272-278` | GET `/mother/members-count/{enc(district)}`; no district → GET `/mother/total/count` | path district only; no FY | `/mother/members-count/:district(*)` or `/mother/total/count` | `getCountValue`. Mother count is a JSON number, so `0` is falsy at `:43` and the function returns `null` for an empty table. | `legacy:src/pages/MotherIndexRegister.tsx:85` (only when "All Districts", no args); `legacy:src/pages/Documentation.tsx:87` (no args). Import only: `legacy:src/pages/Districts.tsx:32`. The `members-count` branch is never exercised. |
| `getCaseworkerCountByDistrict(district)` | `legacy:src/lib/api.ts:280-285` | GET `/child/caseworker/count/{enc(district)}` | path district | **NO BACKEND ROUTE** (404 → throws) | `getCountValue`. | **UNUSED** |
| `getHouseholdCountByDistrict(district)` | `legacy:src/lib/api.ts:287-292` | GET `/household/district/count/{enc(district)}` | path district | **NO BACKEND ROUTE** (404 → throws) | `getCountValue`. | **UNUSED** |
| `getVcaCountByDistrict(district)` | `legacy:src/lib/api.ts:294-299` | GET `/child/district/count/{enc(district)}` | path district | **NO BACKEND ROUTE** (404 → throws) | `getCountValue`. | **UNUSED** |
| `getHouseholdsByDistrict(district, fy?)` | `legacy:src/lib/api.ts:301-312` | GET `/household/all-households/{enc(district)}{fy}` | path district (`""` = national; `"All"` also national); FY from/to. Cache key uses `district \|\| "ALL"` plus `:<from>_<to>`. | `/household/all-households/:district(*)` | `getListFromApiWithCache` (60 s IndexedDB TTL, stale-on-error) → `getListValue` → `Record<string,unknown>[]`. | `legacy:src/components/dashboard/MetricsGrid.tsx:146` (no FY); `legacy:src/components/dashboard/GlobalSearch.tsx:74`; `legacy:src/pages/CaregiverRiskRegister.tsx:80,111`; `legacy:src/pages/HTSRiskRegister.tsx:99`; `legacy:src/pages/CaseworkerProfile.tsx:79`; `legacy:src/pages/HouseholdServicesPage.tsx:54`; `legacy:src/pages/HouseholdRiskRegister.tsx:89`; `legacy:src/pages/Performance.tsx:548`; `legacy:src/pages/EditUser.tsx:63`; `legacy:src/pages/AddUser.tsx:180`; `legacy:src/pages/HouseholdRegister.tsx:111`; `legacy:src/pages/Districts.tsx:75,234`; `legacy:src/pages/HouseholdProfile.tsx:156`; `legacy:src/components/dashboard/ProvincialBreakdown.tsx:16` (component never imported); `legacy:src/components/dashboard/services/service-records.ts:174` (`fetchHouseholdRegister`, itself never called); `legacy:src/components/dashboard/services/ServicesPage.tsx:269`. |
| `getHouseholdMembers(hhId)` | `legacy:src/lib/api.ts:314-317` | GET `/household/members/{enc(hhId)}` | path household_id | `/household/members/:household_id(*)` | `getListValue`. | `legacy:src/pages/HouseholdProfile.tsx:220`; `legacy:src/pages/Districts.tsx:249` (one request **per household** in a district export). |
| `getHouseholdArchivedRegister(district, {de_registration_reason?, fy?})` | `legacy:src/lib/api.ts:319-339` | GET `/household/all-households-archived/{enc(district)}?de_registration_reason=&from=&to=` | path district; query `de_registration_reason` (only if truthy); FY from/to only if both | `/household/all-households-archived/:district(*)` (backend reads `reason ?? de_registration_reason`) | `getListValue`. No cache. | `legacy:src/pages/HouseholdArchivedRegister.tsx:129` (`""`, reason filter, FY); `legacy:src/pages/HouseholdProfile.tsx:162` (district or `""`, no FY). |
| `getMothersByDistrict(district, fy?)` | `legacy:src/lib/api.ts:341-346` | GET `/mother/district/{enc(district)}/filtered{fy}` | path district (`"All Districts"` = national, case-insensitive); FY from/to | `/mother/district/:district(*)/filtered` (FY **ignored** by backend) | `getListValue`. | `legacy:src/pages/MotherIndexRegister.tsx:77`, `:86` (`.length` used as the count for a single district). |
| `getPmtctChildRegisterByDistrict(district, fy?)` | `legacy:src/lib/api.ts:348-356` | GET `/etl/pmtct-child-register/{enc(district)}{fy}` | path district (single, no "all" sentinel); FY from/to | `/etl/pmtct-child-register/:district(*)` (FY **ignored**; `LOWER(TRIM(district)) = LOWER(TRIM($1))`, `backend:controllers/etlController.js:3660-3671`) | `getListValue`. | `legacy:src/pages/PMTCTRegister.tsx:175` (one query per district; "All Districts" fans out, `:163-167`). |
| `getPmtctMotherRegisterByDistrict(district, fy?)` | `legacy:src/lib/api.ts:358-366` | GET `/etl/pmtct-mother-register/{enc(district)}{fy}` | as above | `/etl/pmtct-mother-register/:district(*)` (FY **ignored**, `backend:controllers/etlController.js:3681-3692`) | `getListValue`. | `legacy:src/pages/PMTCTRegister.tsx:191` (fan-out per district). |
| `getChildrenByDistrict(district, fy?)` | `legacy:src/lib/api.ts:368-379` | GET `/child/vcas-assessed-register/{enc(district)}{fy}` | path district (`""`/`"All"` national); FY from/to | `/child/vcas-assessed-register/:district(*)` | `getListFromApiWithCache` (60 s TTL, stale-on-error) → `getListValue`. | `legacy:src/components/dashboard/GlobalSearch.tsx:68`; `legacy:src/pages/VcaRiskRegister.tsx:84,115`; `legacy:src/pages/VcaRegister.tsx:163`; `legacy:src/pages/MotherIndexDetails.tsx:84`; `legacy:src/pages/VcaServicesDashboard.tsx:250,277` (page never imported); `legacy:src/pages/HouseholdProfile.tsx:208`; `legacy:src/pages/VcaProfile.tsx:205` (whole register loaded to find one VCA). Import only: `legacy:src/pages/Districts.tsx:34`. |
| `getVcaProfileById(uniqueId)` | `legacy:src/lib/api.ts:381-386` | GET `/child/vca-profile/{enc(uniqueId)}` | path unique_id | `/child/vca-profile/:unique_id(*)` (broken: always `{status:"success"}`, hangs on DB error) | Returns the raw body unnormalised (`:385`). | **UNUSED** |
| `getChildrenArchivedRegister(district, {reason?, fy?})` | `legacy:src/lib/api.ts:388-408` | GET `/child/vcas-archived-register/{enc(district)}?reason=&from=&to=` | path district; query `reason` if truthy; FY from/to | `/child/vcas-archived-register/:district(*)` | `getListValue`. No cache. | `legacy:src/pages/VcaArchivedRegister.tsx:184` (`""`, reason, FY); `legacy:src/pages/VcaProfile.tsx:211` (district or `""`, no FY). |
| `getCaregiverServicesByDistrict(district)` | `legacy:src/lib/api.ts:410-417` | GET `/household/caregiver-services-by-district/{enc(district)}` | path district; no FY | `/household/caregiver-services-by-district/:district(*)` | `getListFromApiWithCache` (5 min TTL) → `getListValue`. | `legacy:src/pages/CaregiverRiskRegister.tsx:117`; `legacy:src/pages/CaseworkerProfile.tsx:85`; `legacy:src/lib/api.ts:466` (referral fallback); `legacy:src/components/dashboard/services/service-records.ts:170` (`fetchRawServices`, never called). Import only: `legacy:src/components/dashboard/RecentActivity.tsx:15`. |
| `getHouseholdServicesByDistrict(district)` | `legacy:src/lib/api.ts:419-426` | GET `/household/household-services-by-district/{enc(district)}` | path district; no FY | `/household/household-services-by-district/:district(*)` | `getListFromApiWithCache` (5 min) → `getListValue`. | `legacy:src/pages/CaseworkerProfile.tsx:97` (`""`); `legacy:src/pages/HouseholdRiskRegister.tsx:116` (`""`); `legacy:src/pages/HouseholdServicesPage.tsx:71` (**`"*"` when "All"** → backend treats `*` as a district name → `[]`); `legacy:src/components/dashboard/services/service-records.ts:171` (never called). |
| `getHTSRegisterByDistrict(district, _fy?)` + alias `getHtsRegisterByDistrict` | `legacy:src/lib/api.ts:428-440`, alias `:442` | GET `/household/hts-register-by-district/{enc(district)}` | path district only; `_fy` accepted and **dropped** | `/household/hts-register-by-district/:district(*)` (all only for `""` or `"all districts"`; otherwise single case-insensitive match) | DEBUG log of raw body (`:436-438`); `getListValue`. | `getHtsRegisterByDistrict`: `legacy:src/pages/HTSRegister.tsx:139` (`"All Districts"`, FY dropped). `getHTSRegisterByDistrict`: `legacy:src/pages/HTSRiskRegister.tsx:125` and `legacy:src/pages/HTSProfile.tsx:86` (both pass **`"*"`** → backend `LOWER(TRIM(district)) = '*'` → `[]`). |
| `getCaregiverServicesByHousehold(hhId)` | `legacy:src/lib/api.ts:444-449` | GET `/household/caregiver-services/{enc(hhId)}` | path household_id | `/household/caregiver-services/:household_id(*)` | `getListValue`. | `legacy:src/pages/HouseholdProfile.tsx:168`. |
| `getCaregiverReferralsByDistrict(district?)` | `legacy:src/lib/api.ts:451-474` | GET `/household/district/caregiver-referrals` (no district or `"All Districts"`) or `/household/district/caregiver-referrals/{enc(district)}` | path district; no FY | **NO BACKEND ROUTE** (both forms). 404 → caught (`:464`) → fallback `getCaregiverServicesByDistrict(district)` then client filter. | Primary: `getListValue`. Fallback: keeps rows where `String(r.service \|\| r.form_name \|\| r.type).toLowerCase()` contains `"referral"` (`:466-472`). Fallback errors propagate. | `legacy:src/pages/Referrals.tsx:170` (`undefined` for "All Districts", else the district; query key includes `fyKey` but FY is never sent). |
| `getVcaReferralsByDistrict(district?)` | `legacy:src/lib/api.ts:476-497` | GET `/child/district/vcareferrals` or `/child/district/vcareferrals/{enc(district)}` | path district; no FY | **NO BACKEND ROUTE** (both forms). 404 → caught (`:487`) → fallback `getVcaServicesByDistrict(district)` + same client filter. | Same as above (`:489-495`). | `legacy:src/pages/Referrals.tsx:176`. |
| `getVcaServicesByDistrict(district)` | `legacy:src/lib/api.ts:499-506` | GET `/child/vca-services-by-district/{enc(district)}` | path district; no FY | `/child/vca-services-by-district/:district(*)` | `getListFromApiWithCache` (5 min) → `getListValue`. | `legacy:src/pages/CaseworkerProfile.tsx:91`; `legacy:src/pages/VcaRiskRegister.tsx:121`; `legacy:src/pages/VcaServicesDashboard.tsx:284` (page never imported); `legacy:src/lib/api.ts:489` (referral fallback); `legacy:src/components/dashboard/services/service-records.ts:169` (never called). Import only: `legacy:src/pages/VcaProfile.tsx:7`, `legacy:src/components/dashboard/RecentActivity.tsx:14`. |
| `getVcaServicesByChildId(childId)` | `legacy:src/lib/api.ts:508-513` | GET `/child/vca-services/{enc(childId)}` | path vcaid | `/child/vca-services/:vcaid(*)` | `getListValue`. | `legacy:src/pages/VcaProfile.tsx:217`. |
| `getCaregiverServicesByMonth(district)` | `legacy:src/lib/api.ts:515-520` | GET `/household/caregiver-services-by-month/{enc(district)}` | path district | `/household/caregiver-services-by-month/:district(*)` | `getListValue`. | `legacy:src/components/dashboard/DataQualityChart.tsx:64` only, and **DataQualityChart is never imported** → effectively UNUSED. |
| `getVcaServicesByMonth(district)` | `legacy:src/lib/api.ts:522-527` | GET `/child/vca-services-by-month/{enc(district)}` | path district | `/child/vca-services-by-month/:district(*)` | `getListValue`. | `legacy:src/components/dashboard/DataQualityChart.tsx:59` only (unmounted) → effectively UNUSED. |
| `getCaregiverReferralsByMonth(district)` | `legacy:src/lib/api.ts:529-534` | GET `/household/caregiver-referrals-by-month/{enc(district)}` | path district | `/household/caregiver-referrals-by-month/:district(*)` | `getListValue`. | `legacy:src/components/dashboard/DataQualityChart.tsx:74` only (unmounted) → effectively UNUSED. Import only: `legacy:src/pages/HouseholdProfile.tsx:8`. |
| `getVcaReferralsByMonth(district)` | `legacy:src/lib/api.ts:536-541` | GET `/child/vca-referrals-by-month/{enc(district)}` | path district | `/child/vca-referrals-by-month/:district(*)` | `getListValue`. | `legacy:src/components/dashboard/DataQualityChart.tsx:69` only (unmounted) → effectively UNUSED. |
| `getCaregiverCasePlansByDistrict(district)` | `legacy:src/lib/api.ts:543-549` | GET `/household/caregiver-caseplans/{enc(district)}`; no district → `/household/caregiver-caseplans` | path **district** sent into a household_id route | With district: hits `/household/caregiver-caseplans/:household_id(*)` with a district name as the id → `WHERE household_id = <district>` (`backend:controllers/householdController.js:474-480`) matches nothing, so in practice `[]`. Without: **NO BACKEND ROUTE** (404). | `getListValue`. | **UNUSED** (import only: `legacy:src/pages/HouseholdProfile.tsx:11`). |
| `getCaregiverCasePlansByHousehold(hhId)` | `legacy:src/lib/api.ts:551-556` | GET `/household/caregiver-caseplans/{enc(hhId)}` | path household_id | `/household/caregiver-caseplans/:household_id(*)` | `getListValue`. | `legacy:src/pages/HouseholdProfile.tsx:175`. |
| `getCaregiverCasePlanDomainsByHousehold(hhId)` | `legacy:src/lib/api.ts:558-565` | GET `/household/caregiver-caseplan-domains/{enc(hhId)}` | path household_id | `/household/caregiver-caseplan-domains/:household_id(*)` | `getListValue`. | `legacy:src/pages/HouseholdProfile.tsx:192` (lazy, on expand). |
| `getHouseholdReferralsById(household_id)` | `legacy:src/lib/api.ts:567-572` | GET `/household/caregiver-referrals/{enc(household_id)}` | path household_id | `/household/caregiver-referrals/:household_id(*)` | `getListValue`. | `legacy:src/pages/HouseholdProfile.tsx:404`. |
| `getVcaReferralsById(vcaId)` | `legacy:src/lib/api.ts:574-579` | GET `/child/vca-referrals/{enc(vcaId)}` | path unique_id | `/child/vca-referrals/:unique_id(*)` | `getListValue`. | `legacy:src/pages/VcaProfile.tsx:223`. |
| `getVcaCasePlansByDistrict(district)` | `legacy:src/lib/api.ts:581-585` | GET `/child/vca-caseplans` (argument ignored) | none | **NO BACKEND ROUTE** (no trailing segment → 404 → throws). The comment at `:582` claims the route takes no district; in fact it needs a VCA id. | `getListValue`. | **UNUSED** |
| `getVcaCasePlansById(vcaId)` | `legacy:src/lib/api.ts:587-592` | GET `/child/vca-caseplans/{enc(vcaId)}` | path unique_id | `/child/vca-caseplans/:unique_id(*)` | `getListValue`. | `legacy:src/pages/VcaProfile.tsx:229`. |
| `getVcaCasePlanDomainsById(vcaId)` | `legacy:src/lib/api.ts:594-602` | GET `/child/vca-caseplan-domains/{enc(vcaId)}` | path unique_id | `/child/vca-caseplan-domains/:unique_id(*)` | `getListValue`. | `legacy:src/pages/VcaProfile.tsx:243`. |
| `getFlaggedRecords()` | `legacy:src/lib/api.ts:604-628` | GET `{Directus}/items/flagged_forms_ecapplus_pmp?fields=<enc>` | `fields=*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name` (`:612-613`); no filter, no limit, no sort. With no `limit`, Directus applies its server-side default page size (100 unless the Directus instance overrides it; Directus behaviour, not visible in either repo), so the flag list may be silently truncated. | Directus collection `flagged_forms_ecapplus_pmp` (REST `items` read) | No token → `[]` (`:605-606`). **No `response.ok` check**; `safeJson` → `getListValue` (`:622-623`). Any thrown error → `console.error` + `[]` (`:624-627`). | `legacy:src/pages/Flags.tsx:44`; `legacy:src/pages/HouseholdProfile.tsx:214`; `legacy:src/pages/VcaProfile.tsx:259`; `legacy:src/components/dashboard/RecentActivity.tsx:100` (component never imported). |
| `createFlaggedRecord(payload: any)` | `legacy:src/lib/api.ts:630-652` | POST `{Directus}/items/flagged_forms_ecapplus_pmp` | JSON body = caller payload, unvalidated (`payload: any`, `:630,642`) | Directus collection `flagged_forms_ecapplus_pmp` (REST `items` create) | No token → throws `"Not authenticated"`. `!ok` → throws `errorData?.message \|\| "Failed to create flagged record"` (`:646-649`); Directus errors are `{errors:[...]}`, so the message is always the fallback. Success → raw body (`{data:{...}}`). | `legacy:src/pages/FlaggedRecordForm.tsx:69`; `legacy:src/pages/HouseholdProfile.tsx:276`; `legacy:src/pages/VcaProfile.tsx:358` (all as `mutationFn`). |
| `getTrainingLog()` | `legacy:src/constants/api.ts:25-29` | none (mock, 300 ms delay) | — | demo data from `legacy:src/constants/mockData.ts` | Returns `generateMockTrainingLog()`. `TRAINING_LOG_IS_MOCK = true` (`:8`). | `legacy:src/pages/TrainingLog.tsx:77` (`queryFn`; imported at `:55`); `TRAINING_LOG_IS_MOCK` drives the test-data badge at `legacy:src/pages/TrainingLog.tsx:192`. Route mounted at `legacy:src/App.tsx:21,425`. |
| Types `EtlRun`, `EtlPipeline`, `EtlFile` | `legacy:src/lib/api.ts:655-681` | — | — | shapes for `/etl/runs`, `/etl/pipelines`, `/etl/files/:pipeline` | — | `EtlRun`: `legacy:src/pages/DataPipelinePage.tsx:42,152` (and ETL wrappers `legacy:src/lib/api.ts:714,723,733`); `EtlFile`: `legacy:src/pages/DataPipelinePage.tsx:43,154,238` (and `legacy:src/lib/api.ts:746`); `EtlPipeline`: only `legacy:src/lib/api.ts:741`, no reference outside `api.ts`. |

## Issues

### Calls that cannot succeed
1. **One live page calls two routes that 404.** `getTotalHouseholdsCount()` and `getTotalVcasCount()` with no district
   build `/household/households-count` and `/child/vcas-count` (plus `?from=&to=` only if an FY is passed; the
   Documentation page passes none) (`legacy:src/lib/api.ts:265-267,254-256`). Both routes need a trailing
   `/:district(*)` segment (`backend:routes/householdRoutes.js:6`, `backend:routes/childRoutes.js:6`), so they 404. The
   only no-argument caller is the Documentation page, mounted at `legacy:src/App.tsx:104,553`
   (`legacy:src/pages/Documentation.tsx:77,82`); its third stat, `getTotalMothersCount()` → `/mother/total/count`
   (`:87`), does resolve. `MetricsGrid` never hits the no-district form because its queries are `enabled: !!district`
   (`legacy:src/components/dashboard/MetricsGrid.tsx:134,140`). The fix is to send `/All`.
2. **The referral pages always hit missing routes.** `getCaregiverReferralsByDistrict` and `getVcaReferralsByDistrict`
   call `/household/district/caregiver-referrals[/d]` and `/child/district/vcareferrals[/d]`
   (`legacy:src/lib/api.ts:456,461,480,484`). Neither exists in §3.2. Every request 404s and is silently replaced by
   the services-list fallback (`:464-473,487-496`). So the Referrals page (`legacy:src/pages/Referrals.tsx:170,176`)
   actually shows *service rows* whose `service`/`form_name`/`type` text contains "referral". It never shows rows from
   `all_referrals`, the table the by-ID referral handlers read (`backend:controllers/householdController.js:447-448`,
   `backend:controllers/childController.js:335-336`). Whether any service row matches is unknown: the service tables are `SELECT *` with no documented
   columns. **There is no backend endpoint for referrals by district.** The only referral endpoints are by ID or monthly
   aggregates.
3. **The referral fallback poisons the IndexedDB cache.** With "All Districts", `Referrals.tsx` passes `undefined`
   (`legacy:src/pages/Referrals.tsx:165-166`). The fallback then calls `getCaregiverServicesByDistrict(undefined)` /
   `getVcaServicesByDistrict(undefined)`. Those build the cache key from `district || "ALL"` (→ `…:ALL`) but the URL
   from `encodeURIComponent(undefined)` (→ `/…-by-district/undefined`) (`legacy:src/lib/api.ts:411-415,500-504`). The
   backend treats `"undefined"` as a district name and returns `[]`, and that `[]` is stored under the same `:ALL` key
   that `getCaregiverServicesByDistrict("")` / `getVcaServicesByDistrict("")` read. As a result the caregiver/VCA risk
   registers and the caseworker profile (`legacy:src/pages/CaregiverRiskRegister.tsx:117`,
   `legacy:src/pages/VcaRiskRegister.tsx:121`, `legacy:src/pages/CaseworkerProfile.tsx:85,91`) can show an empty
   national list for up to 5 minutes after a visit to the Referrals page. TypeScript does not catch the `undefined`
   argument because `strictNullChecks` is off (`"strictNullChecks": false` at `legacy:tsconfig.json:10`;
   `"strict": false` at `legacy:tsconfig.app.json:19`).
4. **`"*"` is used as an "all" sentinel that no endpoint recognises.** `HouseholdServicesPage` sends `"*"` for "All"
   (`legacy:src/pages/HouseholdServicesPage.tsx:71`). The household-services handler only skips the filter for `""`
   or `"All"` (`backend:controllers/householdController.js:379`), so `*` returns `[]`. `HTSRiskRegister` and
   `HTSProfile` send `"*"` to the HTS route (`legacy:src/pages/HTSRiskRegister.tsx:125`,
   `legacy:src/pages/HTSProfile.tsx:86`), which only treats `""` or `"all districts"` (trimmed, any case) as all
   (`backend:controllers/householdController.js:420-431`). It runs `LOWER(TRIM(district)) = LOWER('*')` (`:428`) and
   returns `[]`. (The route comment at `backend:routes/householdRoutes.js:47-49` saying `:district` is ignored is stale.)
   `HTSRegister` sends `"All Districts"`, which works (`legacy:src/pages/HTSRegister.tsx:93,139`).
5. **Dead wrappers with no backend route:** `getCaseworkerCountByDistrict`, `getHouseholdCountByDistrict` and
   `getVcaCountByDistrict` (`legacy:src/lib/api.ts:280-299`), `getVcaCasePlansByDistrict` (`:581-585`), and
   `getCaregiverCasePlansByDistrict` (`:543-549`). The last one sends a district name into a household_id route. None
   of them is called.
6. **`getVcaProfileById` is unused and its endpoint is broken** (`legacy:src/lib/api.ts:381-386`; see §3.2). It is also
   the only wrapper that returns an unnormalised body. Profile pages instead download whole registers to find one
   record (`legacy:src/pages/VcaProfile.tsx:205,211`, `legacy:src/pages/HouseholdProfile.tsx:156,162`).

### Params sent vs params the backend reads
7. **FY sent but ignored by the backend:**
   - `getMothersByDistrict` (`legacy:src/lib/api.ts:343`). The mother handler reads only `req.params.district`
     (`backend:controllers/motherController.js:14-26`).
   - `getPmtctChildRegisterByDistrict` / `getPmtctMotherRegisterByDistrict` (`:353,363`). The handlers read only
     `req.params.district` (`backend:controllers/etlController.js:3661,3682`). The caller's comment that "both endpoints
     accept a `fy` window" is wrong (`legacy:src/pages/PMTCTRegister.tsx:169-171`).
   - `getHTSRegisterByDistrict` drops `_fy` itself (`legacy:src/lib/api.ts:430`).
8. **FY accepted by the backend but never sent:** `getHouseholdArchivedRegister` and `getChildrenArchivedRegister` from
   the profile pages (`legacy:src/pages/HouseholdProfile.tsx:162`, `legacy:src/pages/VcaProfile.tsx:211`), and
   `getHouseholdsByDistrict` from `MetricsGrid` (`legacy:src/components/dashboard/MetricsGrid.tsx:146`). In
   `MetricsGrid` the KPI counts on the same card *are* FY-scoped (`:133,139`), so the FY-filtered count and the
   unfiltered list disagree. Other no-FY calls to the cohort-filtered registers (mostly lookups or district discovery,
   possibly intentional): `getHouseholdsByDistrict` at `legacy:src/pages/CaregiverRiskRegister.tsx:80`,
   `legacy:src/pages/CaseworkerProfile.tsx:79`, `legacy:src/pages/Performance.tsx:548`, `legacy:src/pages/EditUser.tsx:63`,
   `legacy:src/pages/AddUser.tsx:180`, `legacy:src/components/dashboard/services/ServicesPage.tsx:269`,
   `legacy:src/components/dashboard/GlobalSearch.tsx:74`, `legacy:src/pages/HouseholdProfile.tsx:156`,
   `legacy:src/pages/Districts.tsx:234` (the export, while the page's KPI tiles and district discovery are FY-scoped, `:63,68,75`);
   `getChildrenByDistrict` at `legacy:src/pages/VcaRiskRegister.tsx:84`, `legacy:src/components/dashboard/GlobalSearch.tsx:68`,
   `legacy:src/pages/MotherIndexDetails.tsx:84`, `legacy:src/pages/HouseholdProfile.tsx:208`, `legacy:src/pages/VcaProfile.tsx:205`.
9. **The "all" sentinel and district format differ per endpoint, and the wrappers do not hide this:**
   - household/child: `""` or `All` (exact case). Comma lists are allowed.
   - mother: `""`, `all` or `all districts` (any case). Single value only.
   - HTS: `""` or `all districts`. Single value only.
   - PMTCT: no sentinel, single value only. Hence the per-district fan-out at `legacy:src/pages/PMTCTRegister.tsx:163-167`.

   Callers pass `""`, `"All"`, `"All Districts"`, `"*"`, `undefined` or `"None"`
   (`legacy:src/pages/HouseholdProfile.tsx:151`) without any normalisation. Case-sensitive household/child matching
   forces `Districts.tsx` to fire one request per spelling variant (`legacy:src/pages/Districts.tsx:147,234`).
10. **`getHouseholdArchivedRegister` sends `de_registration_reason`** (`legacy:src/lib/api.ts:324-326`). The backend
    prefers `reason` but falls back to this name, so it works. The VCA archive sends `reason` (`:393-395`). This
    naming difference between the two archived wrappers is harmless but should be unified.

### Normalisation and error handling
11. **`getFlaggedRecords` turns a Directus error into data.** It never checks `response.ok`
    (`legacy:src/lib/api.ts:622-623`). An expired token or a 403 returns `{errors:[{message,extensions}]}`.
    `getListValue` step 3 (first non-empty array, `:166-172`) then returns the `errors` array as if it were flagged
    records. Every other failure is swallowed into `[]` (`:605-606,624-627`), so the Flags page cannot show an error
    state.
12. **`createFlaggedRecord` error messages are always the generic fallback**, because Directus has no top-level
    `message` (`legacy:src/lib/api.ts:647-648`). The payload is `any` and has no schema (`:630`).
13. **`getCountValue` returns `null` for a numeric `0`.** `if (record.count)` is falsy for `0` (`legacy:src/lib/api.ts:43`).
    This affects `/mother/total/count`, which returns a JSON number. The household and child counts are strings, so
    `"0"` passes.
14. **The list and count normalisers guess field names generously** (`legacy:src/lib/api.ts:61-111,126-180`).
    Every §3.2 list endpoint uses `data`, and every count endpoint uses `count`. The fallback chain hides contract
    breaks: it returns whatever array it finds first.
15. **Three near-identical HTTP helpers with inconsistent error text and auth messages:** `dqaGet` ("DQA request
    failed", "Not authenticated."), `dqaPost`/`dqaGetSkipCache` ("Request failed: <status>", "Not authenticated")
    (`legacy:src/lib/api.ts:188,206,685,697,703,710`). In addition, the Directus calls in this range use their own raw
    `fetch` (`:614,634`). None of them keeps the HTTP status, handles 401, or sets a timeout.
16. **Stale-on-error masks failures.** When a fetch fails, `getListFromApiWithCache` returns an *expired* cache entry
    with only a `console.warn` (`legacy:src/lib/api.ts:229-235`). A 401 after logout or a backend outage therefore
    shows old data with no signal to the UI.
17. **Same data cached under two keys:** `getHouseholdsByDistrict("")` caches under `households_by_district:ALL`, while
    `getHouseholdsByDistrict("All")` caches under `households_by_district:All` (`legacy:src/lib/api.ts:305-308`). Both
    are national, so the same data is downloaded and stored twice.

### Security
18. **National PII persists in IndexedDB across logins.** The household and VCA registers and all three services lists
    are written to IndexedDB with keys that contain no user (`legacy:src/lib/api.ts:305-308,372-375,411-425,500-504`).
    `logout()` does not clear them (`legacy:src/context/AuthContext.tsx:148-151`). The next user on the same browser
    gets the previous user's cached lists for up to the TTL (60 s / 5 min), and past the TTL whenever their own refetch
    fails (stale-on-error, `legacy:src/lib/api.ts:229-235`). The data stays on disk until a later clear.
19. **`envPrefix` exposes every `REACT_*` variable to the browser** (`legacy:vite.config.ts:7`), in addition to
    `VITE_*`. Any secret stored under a `REACT_` name in the env file ships in the bundle.
20. **Any authenticated user can download national data.** Calls with `""`/`"All"`/`"All Districts"` return national
    data (household, VCA, services, HTS, mothers), and the backend applies no user scope (AUDIT.md §3.1: `lib/userScope.js`
    is used only by `backend:controllers/supersetController.js:2,72-73`; data handlers filter only by the caller-supplied
    district, e.g. `backend:controllers/householdController.js:60`, `backend:controllers/motherController.js:3-12`). Every
    restriction is client-side. Examples: `legacy:src/pages/HouseholdRegister.tsx:111`,
    `legacy:src/pages/VcaRegister.tsx:163` and `legacy:src/pages/HTSRegister.tsx:139` all fetch national data and
    filter in the browser.
21. **Debug logging dumps full PII responses to the console**, but only in dev with `VITE_DEBUG_API=true`
    (`legacy:src/lib/api.ts:15-16,190-203,436-438`). The token value is never logged.
22. **Unbounded fan-out:** the district export issues one `/household/members/:id` request per household, all at once
    (`legacy:src/pages/Districts.tsx:244-256`).

### Dead or orphaned callers (affects "used by" mapping)
23. **Several callers are never mounted.** `DataQualityChart`, `RecentActivity`, `ProvincialBreakdown` and
    `VcaServicesDashboard` are not imported anywhere (a grep of `legacy:src` for each name finds only its own file).
    `fetchRawServices` / `fetchHouseholdRegister` (`legacy:src/components/dashboard/services/service-records.ts:168-174`)
    are never called. As a result, the four `*-by-month` wrappers (`legacy:src/lib/api.ts:515-541`) have no live caller.
24. **Discrepancy with AUDIT.md §3.2 "10 endpoints have no live legacy caller".** That list was built by grepping paths
    and omits five routes this caller trace shows are never reached from a mounted page:
    `/household/caregiver-services-by-month/:district(*)`, `/child/vca-services-by-month/:district(*)`,
    `/household/caregiver-referrals-by-month/:district(*)`, `/child/vca-referrals-by-month/:district(*)` (only caller is the
    unmounted `DataQualityChart`, `legacy:src/components/dashboard/DataQualityChart.tsx:59,64,69,74`), and
    `/mother/members-count/:district(*)` (the only callers of `getTotalMothersCount` pass no district,
    `legacy:src/pages/MotherIndexRegister.tsx:85`, `legacy:src/pages/Documentation.tsx:87`, so `legacy:src/lib/api.ts:274`
    never runs). §3.2 should be updated when step 2 is merged.
