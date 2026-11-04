# hts — legacy audit

> Legacy routes → new routes: `/registers/hts` → `/hts` (this part); `/registers/hts-risk` → `/hts/risk` and `/profile/hts-details` → `/hts/:clientId` are covered by the other parts · Plan: MIGRATION_PLAN.md §5 row "hts" (MIGRATION_PLAN.md §5, row "hts")  · *part `register`*
> This part covers the HTS (HIV testing services) register page `HTSRegister` only: one page with two tabs ("Register" and "Charts"), five KPI cards, two bar charts, a client-side register table and a CSV export. The page downloads the **whole national HTS register** once and does all scoping, FY filtering, time-period filtering, KPI filtering, search, sort and pagination on the client.
> Legacy routes → new routes: `/registers/hts-risk` → `/hts/risk`; `/profile/hts-details?id=<id>` → `/hts/:clientId` (this part). `/registers/hts` → `/hts` is covered by the "register" part. · Plan: MIGRATION_PLAN.md §5 row "hts"  · *part `risk-profile`*
> Merged from the step-3 drafts: `register`, `risk-profile`. Content is carried over verbatim; only heading levels, the merged header and the shared Legacy files table were consolidated.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/HTSRegister.tsx` | 1271 | `/registers/hts` page. **Read in full.** |
| `src/App.tsx` | 602 | Route table (`:285-291`), lazy import (`:40`), QueryClient defaults (`:115-134`), IndexedDB persister (`:140-163`, `:213-224`), catch-all (`:590`). Relevant parts read. |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard. Read in full. |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar sections + visibility filter. Read `:1-200`, grepped the rest. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile bottom nav. Read in full. No HTS entry. |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Mobile sheet menu entries (`:33-45`) and subtitle pass-through (`:94`). Relevant parts read. No HTS entry. |
| `src/components/dashboard/DashboardHeader.tsx` | 539 | `HIDDEN_ROUTES` (`:35-43`), `hideSearchAndFilter` (`:86`), subtitle rendering (`:82,238-239`). Relevant parts read. |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Cmd/Ctrl+K palette. Grepped nav list (`:34-45`) and record links (`:132,158`). No HTS entry. |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Scope hook used by this page. Read in full. |
| `src/context/FyFilterContext.tsx` | 122 | Global FY filter (`resolved.fromDate/toDate/mode`). Read in full. |
| `src/lib/fiscalYear.ts` | 84 | FY bounds / resolve. Read `:20-56`. |
| `src/lib/api.ts` | 1486 | Read `DEFAULT_DISTRICT` `:7`, `DEBUG_API` `:15-16`, `getListValue` `:116-183`, `dqaGet` `:185-210`, `clearApiCache` `:247-251`, `getHTSRegisterByDistrict` `:428-440`, alias `:442`. |
| `src/lib/csv.ts` | 29 | `downloadCsv` helper. Read in full. |
| `src/constants/districts.ts` | 8 | Hardcoded provinces/districts used by `useEffectiveDistrict`. Read in full. |
| `src/components/EtlInvalidator.tsx` | 90 | Grepped: polls `/etl/last-success` every 30 s and invalidates every non-`etl` query (incl. this page's). |
| `src/pages/HTSProfile.tsx` | 443 | Read `:75-145` only (how the profile reads its record; "Back to HTS Register" link). Full audit in the profile part. |
| `src/pages/HTSRiskRegister.tsx` | 353 | Read `:120-126,200-210` only (shared query-key prefix; back button to this page). Full audit in the risk part. |
| `backend:controllers/householdController.js` | — | Read `:416-440` (HTS handler). |
| `backend:routes/householdRoutes.js` | — | Read `:45-51` (route + stale comment). |
| `src/lib/exportUtils.ts` | 29 | `escapeCsvField`, `downloadCsv`. Read in full. |
| `src/lib/utils.ts` | 64 | `toTitleCase` (`:18-21`). Relevant part read. |
| `src/components/EmptyState.tsx` | 51 | Empty state used by the profile "not found" view. Read. |
| `src/components/aceternity/LoadingDots.tsx` | 17 | Loading indicator. Read in full. |
| `src/data/documentationArticles.ts` | 165 | Grepped: an in-app doc article describes the risk filters (`:82`). |

## Contents

- [the register](#part-register)
- [the risk register and the profile](#part-risk-profile)

<a id="part-register"></a>

## Part: the register

## Route `/registers/hts` → `/hts`

### Purpose

HIV testing services register: who was tested, their result, and whether HIV-positive clients are linked to ART. Page title (header subtitle) is `"HTS Charts"` when the Charts tab is active, otherwise `"HTS Register"` (`legacy:src/pages/HTSRegister.tsx:581-583`).

Hero block (`legacy:src/pages/HTSRegister.tsx:590-676`):
- [ ] Eyebrow `"HTS register"` (`:600-602`); badge `"<n> tests"` where n = `stats.total` (FY- and time-period-filtered row count, **not** affected by KPI filter or search), `toLocaleString()`, `"—"` while loading (`:603-609`); badge with map pin and the selected district label (`:610-615`).
- [ ] Title `"HIV testing services"` with badge `"Testing & linkage"` (`:617-627`).
- [ ] Description `"Track tests, results, and ART linkage outcomes across the programme."` (`:628-631`).
- [ ] Right side: `"Sync data"` button (spinner icon while `isLoading || isSyncing`) and the district select (`:633-674`).

Tabs (`legacy:src/pages/HTSRegister.tsx:679-697`): `"Register"` (value `register`, default, `:105`) and `"Charts"` (value `charts`). Tab state is local `useState` only; not in the URL.

### Access

- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:284-291`). `ProtectedRoute` returns `null` while auth loads, redirects to `/` with no user, and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`).
- [ ] Sidebar: section `"Registers"` → `{ title: "HTS Register", url: "/registers/hts", icon: Users }` (`legacy:src/components/dashboard/AppSidebar.tsx:60`). No visibility rule applies to it. The filter only hides `/districts` for district users (`item.url === "/districts" && isDistrictUser`), the `"Admin"` section for non-admins, and a `"Data Pipeline"` section for non-admin/non-support (`legacy:src/components/dashboard/AppSidebar.tsx:150-175`). Active state is exact `currentPath === path` (`:183`).
- [ ] Mobile bottom nav: **no entry** (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). Mobile sheet menu: **no entry** (`legacy:src/components/dashboard/DashboardLayout.tsx:33-45`). On mobile the page is reachable only via the "More" menu that opens the sidebar.
- [ ] Global search: **no nav entry** and no HTS record provider (`legacy:src/components/dashboard/GlobalSearch.tsx:34-45`). The rebuild should add a nav entry (and decide whether HTS clients are searchable by ID; see Open questions).
- [ ] Header: `/registers/hts` is not in `HIDDEN_ROUTES`, so the global search box and the global FY filter chip are shown (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,84-86`).
- [ ] In-page scope/role checks (all derived from free-text profile strings; must become `useAccess()` / `platform/scope` in the rebuild):
  - `useEffectiveDistrict()` (`legacy:src/hooks/useEffectiveDistrict.ts:7-17`):
    - `isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support"` (`:8`, description lower-cased at `:7`).
    - `isProvinceUser = description.includes("provincial") || description.includes("province")` (`:9`).
    - `isDistrictUser = description.includes("district") || (!!user?.location && user.location !== "All" && !isAdmin && !isProvinceUser)` (`:10`); exported as `isRestrictedToDistrict` (`:17`).
    - `province = user?.title && user.title !== "All" ? user.title : user?.province` (`:11`).
    - `district = user?.location && user.location !== "All" ? user.location : (user?.district || DEFAULT_DISTRICT || "")` (`:12`); `DEFAULT_DISTRICT` = `import.meta.env.VITE_DEFAULT_DISTRICT` (`legacy:src/lib/api.ts:7`).
    - `availableDistricts`: province user → `["All Districts", ...DISTRICTS_BY_PROVINCE[province]]`; district user → `[district]`; admin → `["All Districts", ...ALL_DISTRICTS]`; otherwise `ALL_DISTRICTS` (`:13-16`).
  - `const lockedDistrict = isRestrictedToDistrict && user?.location ? user.location : null;` (`legacy:src/pages/HTSRegister.tsx:97-98`).
  - Initial district: `lockedDistrict ?? (initialDistrict || (isAdmin ? ALL : ""))` with `ALL = "All Districts"` (`:93,100-102`).
  - Effect re-applies on `[lockedDistrict, initialDistrict, isAdmin]`: locked → force `lockedDistrict`; else if `initialDistrict` → set it; else if `isAdmin && !selectedDistrict` → `ALL` (`:109-122`).
  - District select `disabled={!!lockedDistrict}` and `onValueChange` returns early `if (lockedDistrict)` (`:649,653`); the `"All Districts"` option is rendered only when `!lockedDistrict` (`:662-664`).
  - Province restriction (client-side row filter): `if (isProvinceUser && userProvince && record.province !== userProvince) return false;` (`:163-169`) — exact, case-sensitive comparison of the raw `province` column with `user.title`/`user.province`.
- [ ] Data scope: the API is **always** called with the literal district `"All Districts"` (`legacy:src/pages/HTSRegister.tsx:139`) regardless of user, so every authenticated user downloads the national register; district and province are applied in the browser (`:160-181`). The page comment claims the backend ignores the district segment (`:128-136`); that is **stale**: the handler filters by `LOWER(TRIM(district)) = LOWER($1)` unless the value is empty or `"all districts"` (`backend:controllers/householdController.js:420-431`; AUDIT.md §3.2). Province is never sent and is not supported by the endpoint. Rebuild: send the selected single district server-side when one is selected; for "all"/province scope fetch all and filter client-side by province from `platform/scope`; record the national-dump gap in PROGRESS.md "Backend asks" (already in AUDIT.md §3.2 Issues).

### Endpoints

- [ ] `GET /household/hts-register-by-district/:district(*)` (AUDIT.md §3.2)
  - Wrapper: `getHtsRegisterByDistrict` = alias of `getHTSRegisterByDistrict` (`legacy:src/lib/api.ts:428-442`), via `dqaGet` with `Authorization: Bearer <token>` (`legacy:src/lib/api.ts:185-210`). Not cached in the auxiliary IndexedDB list cache (it does not use `getListFromApiWithCache`).
  - Params as sent: path `encodeURIComponent("All Districts")` → `/household/hts-register-by-district/All%20Districts`. The page passes `fyArg = { from: fy.fromDate, to: fy.toDate }` when both are set (`legacy:src/pages/HTSRegister.tsx:124-126,139`) but the wrapper **drops it** (`_fy` unused, no query string; `legacy:src/lib/api.ts:428-435`). The backend reads no FY either.
  - When it fires: always (no `enabled` condition) on mount; refires when the FY mode/from/to changes (they are in the key, `:138`) even though the request is byte-identical.
  - Query key: `["hts-register", "all", fy.mode, fy.fromDate, fy.toDate]` (`legacy:src/pages/HTSRegister.tsx:138`). Note HTSProfile uses `["hts-register", "All"]` and HTSRiskRegister `["hts-register", "All", fyKey]` (`legacy:src/pages/HTSProfile.tsx:85`, `legacy:src/pages/HTSRiskRegister.tsx:124`) — same endpoint, different keys, so no cache sharing. Rebuild: one key factory, shared `queryOptions` across register / risk / profile / search provider.
  - Options: `placeholderData: (prev) => prev` (keeps previous rows while refetching), `retry: 1` (`:140-141`). Global defaults: `staleTime` 60 s, `gcTime` 24 h, `refetchOnMount/WindowFocus/Reconnect: true`, `retry: 1` (`legacy:src/App.tsx:115-134`). Successful queries are persisted to IndexedDB under persister key `"ecap-plus-pmp-react-query"` for 24 h (`legacy:src/App.tsx:140-148,213-224`), i.e. the national HTS register (sensitive health data) is persisted in the browser. Decision 6 (PROGRESS.md) accepts IndexedDB persistence with logout wipe.
  - Invalidation: `EtlInvalidator` polls `/etl/last-success` every 30 s and invalidates every query whose key[0] ≠ `"etl"` when the timestamp advances (`legacy:src/components/EtlInvalidator.tsx:28,54-57,78-79`). Rebuild: `meta: { etl: true }` (data comes from the `hts_register` ETL pipeline, AUDIT.md §3.2).
  - Response parsing: `getListValue(data)` picks the array out of `{status, data:[...]}` with heuristic fallbacks (`legacy:src/lib/api.ts:116-183`). In dev with `VITE_DEBUG_API === "true"` the raw response is logged to the console (`legacy:src/lib/api.ts:15-16,436-438`).
  - Client-side post-processing, in order (`legacy:src/pages/HTSRegister.tsx:157-499`):
    1. Province filter (province users) and district filter (`selectedDistrict !== "All Districts"` → `String(record.district ?? "").trim().toLowerCase() === selectedDistrict.trim().toLowerCase()`) (`:161-181`).
    2. Normalise each row (see Fields used) (`:182-226`).
    3. **Drop rows whose normalised status is `"n/a"`, `""` or `"unknown"`** (case-insensitive) (`:227-230`).
    4. Global FY window on the record date (`:291-301`).
    5. Local "Time period" window (`:316-346`).
    6. KPI filter, search, sort (`:430-499`); paginate (`:501-507`).
- [ ] `POST`/`GET` none other. The `"Sync data"` button calls `clearApiCache()` (clears the auxiliary IndexedDB list cache via `clearAllCacheEntries`, `legacy:src/lib/api.ts:247-251`; HTS does not use that cache) then `queryClient.invalidateQueries({ queryKey: ["hts-register"] })` (prefix: also invalidates the profile and risk keys), then `toast.success("HTS Register data synced successfully")`; on throw `toast.error("Sync failed")` (`legacy:src/pages/HTSRegister.tsx:147-155`).

### Fields used

Raw-key lists below are the legacy `pickValue` candidates in order; `pickValue` returns the first value that is not `null`/`undefined`/`""`, stringified, else the literal `"N/A"` (`legacy:src/pages/HTSRegister.tsx:70-78`). In the rebuild these belong in `api/schemas.ts` normalisers once; confirm real column names against the fixture `test/fixtures/dqa-hts.json` (AUDIT.md §3.2 says the legacy names are uncertain).

| Field (normalised name the page uses) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| `id` | `client_number`, `unique_id`, `uid`, `vca_id`, `mother_id`, `id`, `hts_id` (`:187-195`) | Table "Case ID"; CSV "ID"; search | Monospace; `"N/A"` fallback. Note HTSProfile identifies records by `ecap_id \|\| client_number` (`legacy:src/pages/HTSProfile.tsx:101-103`) — `ecap_id` is not in this list. |
| `caseworker` | `caseworker_name`, `caseworker`, `cw_name`, `assigned_to`, `provider` (`:196-202`) | Table "Caseworker Name"; CSV "Caseworker"; search | `"N/A"` fallback |
| `type` | `type`, `record_type` (`:203-210`); fallback inferred from age `parseInt(String(record.individual_age \|\| record.age \|\| 0))` (`:183-184`) | Table "Type" with icon; CSV "Type" | If `type`/`record_type` present: contains `"child"` (case-insensitive) → `"CA (Child)"`, else `"Mother"`. If absent: age `< 20` → `"CA (Child)"`, else `"Mother/Adult"`. Icon: `HeartPulse` when `type === "Mother"`, else `Baby` (`:1143-1148`). |
| `status` | `hiv_result`, `hiv_status`, `status`, `art_status`, `current_hiv_status` (`:211-217`) | Table "HIV Status" badge; CSV "Status"; KPI classification; row inclusion | Badge text `status.toUpperCase()`; rose badge when status contains `"hiv+"` or `"known positive"`, else emerald (`:1155-1167`). Documented real values: `"Newly Tested HIV+"`, `"Newly Tested HIV-"`, `"Known Positive"`, `"Known Negative"` (`:365-371`, comment). |
| `facility` | `health_facility`, `facility`, `facility_name` (`:218-222`) | Table "Facility" (line 1); CSV "Facility"; search | `"N/A"` fallback |
| `district` | `district`, `district_name` (`:223`) | Table "Facility" cell line 2 (uppercase, small); CSV "District"; chart grouping | `"N/A"` fallback |
| `raw.district` | `district` (raw, not normalised) (`:174`) | District filter | trimmed, lower-cased compare |
| `raw.province` | `province` (`:166`) | Province-user filter | exact compare with user province |
| `artNo` (linkage) | `case_art_number`, `art_number`, `art_no`, `vca_art_number`, `art_status` (`:380-386`, duplicated `:444-450`) | "Positives Not on ART" KPI + filter | `isLinked = artNo !== "N/A" && artNo !== "" && !artNo.toLowerCase().includes("not")` (`:387-388`, `:451-454`) |
| record date (`getRecordDate`) | `date_created`, `datecreated`, `date_client_created`, `created_at`, `date_tested`, `test_date`, `hiv_test_date`, `date_edited`, `date_screened`, `art_date_initiated` (first that parses) (`:259-283`) | FY window, time-period window, "latest test on file" anchor | Parsed by `parseHtsDate`: `new Date(s)` first, then `^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2}\|\d{4})$` as D-M-Y; 2-digit years `< 50` → 20xx else 19xx (`:243-257`). The comment explains `date_created` is preferred because `date_tested` is often backdated (`:261-265`). |
| sort date | `service_date`, `visit_date`, `date_created`, `created_at` (first truthy) (`:486-493`) | Table sort | `new Date(d).getTime()`, 0 when missing (see Bugs) |

### Filters / sort / pagination / search

- [ ] **District** select (hero, `legacy:src/pages/HTSRegister.tsx:646-673`): options = `"All Districts"` (only when not locked) + `availableDistricts` minus `"All Districts"`. Option source is the hardcoded geography in `legacy:src/constants/districts.ts:1-8` (`"Central Province"`: `"Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"`; `"Southern Province"`: `"Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"`) → must come from `@/config` / `platform/scope`. Default: see Access. Changing it resets page to 1 (`:651`). Persisted: **none** (local state). Applies to table, export, KPIs, charts, hero badge.
- [ ] **Global FY filter** (header chip, `FyFilterContext`): modes `all` (default) / `fy` / `custom`; FY bounds `${fy-1}-10-01` .. `${fy}-09-30` (`legacy:src/lib/fiscalYear.ts:29-32,36-54`). Persisted in URL params `fy`, `from`, `to` and localStorage `ecap_plus_pmp.fy_filter_state_v2` (`legacy:src/context/FyFilterContext.tsx:12,50-80`). Applied **client-side** on the record date: `from = new Date(fy.fromDate)`, `to = new Date(`${fy.toDate}T23:59:59Z`)`, inclusive; records with no parseable date are **excluded** when a window is active (`legacy:src/pages/HTSRegister.tsx:291-301`). Applies to table, export, KPIs, charts. Rebuild: from `platform/scope` FY hooks and part of the query key.
- [ ] **Time period** select (Charts tab only, `legacy:src/pages/HTSRegister.tsx:709-741`): label `"Time period"`; options exactly: `all` → `"All time"` (default, `:236-238`), `fy` → `"This Fiscal Year (Oct–Sep)"`, `quarter` → `"This Quarter"`, `month` → `"This Month"`, `30d` → `"Last 30 days"`, `90d` → `"Last 90 days"` (`:722-729`). Window is anchored to `dataMaxDate` = the latest record date in the FY-filtered set (or today if none) (`:307-314`), **not** today: `fy` → from Oct 1 of the FY containing the anchor (`ref.getMonth() >= 9 ? year : year-1`, month index 9) (`:326-330`); `quarter` → first day of the anchor's calendar quarter (`:331-332`); `month` → first of the anchor's month (`:333-334`); `30d`/`90d` → anchor minus 30/90 × 24 h (`:335-339`); keep `from <= d <= anchor` (`:341-345`). When not `all`, shows `"Relative to latest test on file: <date>"` with `toLocaleDateString("en-GB")` (`:732-739`) → format via `core/lib/format.ts`. Persisted: none. Applies to KPIs, charts, hero count **and the register table and export** (`:430-432`), although the control is only visible on the Charts tab (see Bugs). The fiscal-year start month must come from config.
- [ ] **KPI filter** (`kpiFilter`: `null` | `"positives"` | `"unlinked"` | `"pending"`, `:106`), set by clicking KPI cards (Charts tab), which also switches to the Register tab and resets page to 1 (`:803-807`). Definitions (must match the card counts, `:434-471`):
  - `positives`: status contains `"hiv+"` or `"known positive"` (case-insensitive).
  - `unlinked`: positive **and** not linked (see `artNo` rule in Fields used).
  - `pending`: neither positive nor negative (negative = contains `"hiv-"` or `"known negative"`).
  - Cards with `filter: null` ("Total Tested", "Overall Yield") clear the KPI filter when clicked.
  - Active-filter banner on the Register tab: `"Active Filter"` / `"Showing only: <label>"` where label is `unlinked` → `"Positives Not Linked To ART"`, `pending` → `"Pending Outcomes"`, `positives` → `"New Positives"`; `"Clear Filter"` button sets it to null (`:1013-1045`). Persisted: none. Applies to table and export; not to KPIs/charts.
- [ ] **Search** (`:1049-1060`): placeholder `"Search by ID, caseworker or facility..."`; matches normalised `id`, `caseworker`, `facility` with case-insensitive `includes` (`:473-482`); input change resets page to 1. No debounce — uses `useDeferredValue` (`:107`). Persisted: none. Applies to table and export. (Searching `"n/a"` matches rows where the field is missing, because the fallback literal is searched.)
- [ ] **"Clear Filters"** button (`:1062-1068`) → `handleClearFilters`: clears search and KPI filter, page 1, `toast.info("Filter reset.")` (`:542-547`). Does **not** reset district or time period.
- [ ] **Sort**: fixed, most-recent first by sort date (`:484-496`). No user-sortable columns.
- [ ] **Pagination**: client-side, fixed 50 rows (`ITEMS_PER_PAGE = 50`, `:68`); no page-size selector. Footer `"Showing {start} to {end} of {total} entries"` (`:1208-1212`). Pager shown only when `totalPages > 1` (`:1214`): Previous / numbered links / Next; window of 5 with ellipses: `currentPage <= 3` → `1 2 3 4 … N`; `currentPage >= N-2` → `1 … N-3 N-2 N-1 N`; else `1 … p-1 p p+1 … N` (`:509-540`). Previous/Next disabled (pointer-events none, 50 % opacity) at the ends (`:1222-1226,1251-1255`). Rebuild with `platform/data-table`; filters/search/page/tab should sync to the URL via `platform/filters`.

### Exports

- [ ] **CSV** — three buttons share one handler `handleExportCsv` (`legacy:src/pages/HTSRegister.tsx:549-578`):
  - Register tab: `"EXPORT CSV"` (`:1069-1077`), disabled when `isLoading || htsData.length === 0`.
  - Charts tab: `"Export CSV"` in the "Testing Volume and Positives by District" card header (`:858-866`) and in the "Yield by District" card header (`:940-948`); not disabled. Both export the **register rows**, not the chart data (see Bugs).
  - Empty guard: `toast.error("No data available to export.")` (`:550-553`).
  - Rows: **all filtered rows** (`htsData`: district + province + status-present + FY + time period + KPI filter + search, sorted), not just the current page (`:563-570`).
  - Columns in order: `"ID"` ← `id`, `"Caseworker"` ← `caseworker`, `"Type"` ← `type`, `"Status"` ← `status` (original case, not upper-cased), `"Facility"` ← `facility`, `"District"` ← `district` (`:555-570`).
  - Filename: `` `hts-register-${selectedDistrict.toLowerCase().replace(/\s+/g, "-")}.csv` `` (`:573`), e.g. `hts-register-all-districts.csv`.
  - Library: in-house `downloadCsv` (`legacy:src/lib/csv.ts:18-29`): comma-separated, quotes values containing `"`, `,` or `\n` (doubling quotes), `\n` line endings, trailing newline, Blob type `text/csv;charset=utf-8;`, no BOM, no branding/header rows.
  - Success toast `"Register exported successfully."` (`:577`).
  - Rebuild via `platform/export`.
- [ ] No PDF / XLSX export on this page.

### Charts

All charts and KPIs are computed from `periodFilteredHts` (district + province + status-present + FY + time period; **not** KPI filter or search) in `stats` (`legacy:src/pages/HTSRegister.tsx:348-428`). Library: `recharts` (`:17-25`). KPI cards show `<LoadingDots />` while loading (`:834`).

- [ ] KPI cards row (`:743-844`), each card: title, value, subtitle, icon, colour class; selected card with a filter gets an emerald ring (`:810-815`):
  1. `"Total Tested"` = `stats.total` = count of rows (`:350`); subtitle `"Everyone with a recorded HIV test"`; icon Users; `bg-emerald-500`; filter none.
  2. `"Total HIV Positive"` = `newPositives` = rows whose status contains `"hiv+"` or `"known positive"` (`:372-374,390-391`); subtitle `"Click to filter to positives"`; icon TrendingUp; `bg-rose-500`; filter `positives`.
  3. `"Overall Yield"` = `newPositives / total × 100`, shown with one decimal + `%`, `"0%"` when total is 0 (`:764-779`); subtitle `"% of tested that are HIV positive"`; icon Activity; `bg-sky-500`; filter none.
  4. `"Positives Not on ART"` = positives that are not linked (`:387-392`); subtitle `"Click to filter to unlinked positives"`; icon AlertCircle; `bg-amber-500`; filter `unlinked`.
  5. `"Pending Outcomes"` = rows that are neither positive nor negative (`:375-377,394`); subtitle `"Click to filter to pending results"`; icon Info; `bg-indigo-500`; filter `pending`.
  - Values use `toLocaleString()`. Icon tint derived by string-replacing `bg-` with `text-` on the colour class (`:822-827`). Rebuild: theme tokens.
- [ ] `"Testing Volume and Positives by District"` — subtitle `"Tests run vs HIV positives, per district"` (`:848-857`); vertical grouped bar chart, X = district (ticks angled −15°, all labels shown), Y = count; bars `total` named `"Tested"` (`#10b981`) and `positives` named `"Positives"` (`#f43f5e`), bar size 20, rounded tops; tooltip default (`:874-925`). Data `testingByDistrict`: group by normalised `district` (`"Unknown"` if blank), keep groups with total > 0, sort by total desc (`:396-411`). Height 300 px; loading → `<LoadingDots />` (`:868-873`).
- [ ] `"Yield by District"` — subtitle `"Positivity rate per district (positives ÷ tested)"` (`:930-939`); horizontal bar chart (`layout="vertical"`), Y = district (width 100), X = yield with `%` tick formatter; single bar `yield` named `"Yield"` (`#6366f1`), bar size 12; tooltip `[`${v}%`, "Yield"]` (`:956-1002`). Data `yieldByDistrict`: `positives / total × 100` rounded to 1 decimal, sorted by yield desc (`:413-421`).
- [ ] Hardcoded chart colours (grid `#f1f5f9`, ticks `#64748b`/`#94a3b8`, cursor `#f8fafc`, bars above, accent `#00a67e` in table/search, `:882,891,900,908,913,920,971,982,997,1053,1113,1136,1145`) → theme tokens / `platform/charts` palette.
- [ ] No empty state for charts (an empty data array renders empty axes).

### Links in / out

- [ ] In:
  - Sidebar `"HTS Register"` → `/registers/hts`, no payload (`legacy:src/components/dashboard/AppSidebar.tsx:60`).
  - HTSProfile "Record not found" empty-state action `"Back to HTS Register"` → `navigate("/registers/hts")`, no payload (`legacy:src/pages/HTSProfile.tsx:142`).
  - HTSRiskRegister back (arrow) button → `navigate("/registers/hts")`, no payload (`legacy:src/pages/HTSRiskRegister.tsx:206`).
  - No query params, `location.state` or storage keys are read by this page (only the global FY URL params / localStorage via `FyFilterContext`). Grep of `src` for `registers/hts` found no other links (dashboard widgets, global search and docs do not link here).
  - Rebuild: add legacy redirect `/registers/hts` → `/hts` (MIGRATION_PLAN.md §5).
- [ ] Out:
  - Row `"View"` button → `navigate("/hts/view", { state: item.raw ? { ...item.raw, type: item.type, district: item.district } : item })` (`legacy:src/pages/HTSRegister.tsx:1179-1198`). Payload = **all raw record columns spread at the top level** plus normalised `type` and `district` overriding the raw ones. **`/hts/view` is not a route** — only `/profile/hts-details` exists (`legacy:src/App.tsx:469-476`), so this lands on the catch-all `NotFound` (`legacy:src/App.tsx:590`). See Bugs. Rebuild: link to `/hts/:clientId` using the route param only (no `location.state`).
  - No link to `/registers/hts-risk` from this page.

### Loading / empty / error

- [ ] Loading (`isLoading`, first load only): hero count `"—"` (`:608`), KPI values `<LoadingDots />` (`:834`), chart bodies `<LoadingDots />` (`:869-873,951-955`), table single row with `<LoadingDots />` spanning 6 columns (`:1109-1116`). Refetch (`isFetching`) only spins the Sync icon (`:638-643`); old data stays via `placeholderData` (`:140`). Rebuild: skeletons.
- [ ] Empty: table row with an Activity icon and text `"NO RECORDS FOUND"` (`:1117-1129`). Rebuild: `<EmptyState>`.
- [ ] Error: **not handled.** `htsQuery.isError` / `error` are never read; a failed request leaves `data` undefined → `[]` (`:158`), so the page shows zero KPIs, empty charts and `"NO RECORDS FOUND"` with no message and no retry (other than the Sync button). Rebuild: `<ErrorState>` with retry.
- [ ] Toasts (sonner): `"HTS Register data synced successfully"`, `"Sync failed"` (`:151,153`); `"Filter reset."` (`:546`); `"No data available to export."` (`:551`); `"Register exported successfully."` (`:577`).

### Bugs and quirks

- [ ] **BUG** The `"View"` button navigates to `/hts/view`, which is not a route, so every click shows NotFound (`legacy:src/pages/HTSRegister.tsx:1185`; route table `legacy:src/App.tsx:469-476,590`). Even if the path were `/profile/hts-details`, the payload shape is wrong: HTSProfile reads `location.state.record` and `?id=` (`legacy:src/pages/HTSProfile.tsx:81,88,94,101-103`), while the register spreads the record at the top of `state` and sends no `id`. Net effect: the profile cannot be reached from this register; the only working inbound link is the HTS risk register row click (`navigate(`/profile/hts-details?id=${id}`, { state: { record: item } })`, `legacy:src/pages/HTSRiskRegister.tsx:326`). Intended: open the client's profile → rebuild as `/hts/:clientId`.
- [ ] **BUG** `parseHtsDate` tries `new Date(s)` before the D-M-Y regex (`:247-248`). In Chromium/V8, a `DD-MM-YYYY` string whose day is ≤ 12 (e.g. `"05-10-2025"`) is accepted by the legacy date parser as **month-day-year** (5 May, not 5 Oct), so the regex fallback only runs when day > 12. Day and month are silently swapped for roughly 40 % of dates, which skews FY, time-period and `dataMaxDate`. Intended: parse ISO strictly, then D-M-Y (with `date-fns` `parse` and formats from config).
- [ ] **BUG** The table sort uses a different date list (`service_date`, `visit_date`, `date_created`, `created_at`) with raw `new Date(d)` (`:486-494`), not `parseHtsDate`; `DD-MM-YYYY` values with day > 12 give `NaN`, making the comparator return `NaN` (inconsistent order). Intended: sort by the same resolved record date, desc.
- [ ] **BUG** Rows with status `"N/A"`/`""`/`"unknown"` are removed from the whole page (`:227-230`), so "Total Tested", charts and the export silently exclude clients without a recorded result, while "Pending Outcomes" counts only rows with some other unrecognised status text. **QUESTION** for the developer: should untested/unknown rows be counted (e.g. as pending)?
- [ ] **BUG** The Time-period select lives only on the Charts tab but also filters the Register table and the CSV export (`:430-432`); when a KPI card switches to the Register tab, the period filter remains active with no visible indicator, and "Clear Filters" does not reset it (`:542-547`). Intended: one visible filter bar applying to both tabs, cleared by "Clear Filters".
- [ ] **BUG** The two Charts-tab `"Export CSV"` buttons export the register rows (filtered by the hidden KPI filter and search), not the chart's per-district data (`:862,944` → `:549-578`). **QUESTION**: should chart exports contain district / tested / positives / yield?
- [ ] **BUG** `currentPage` is not reset when the FY filter, time period or KPI "Clear Filter" banner button changes the row count (`:716,1039`); the table can show `"NO RECORDS FOUND"` while the footer reads e.g. `"Showing 101 to 40 of 40 entries"` (`:1208-1211`). Intended: reset or clamp page when the filtered set changes.
- [ ] **BUG** Type inference is inconsistent: the inferred label is `"Mother/Adult"` but the explicit-type label is `"Mother"` (`:184,209`), and the icon only treats `"Mother"` as a mother (`:1144`), so inferred adults get the child (Baby) icon. A non-numeric age gives `NaN`, and `NaN < 20` is false, so the row becomes `"Mother/Adult"` (`:183-184`). The age threshold `20` is hardcoded.
- [ ] **BUG** Scope default for non-admin, non-district users: when `user.location` is `"All"` and there is no `user.district`/`VITE_DEFAULT_DISTRICT`, `selectedDistrict` starts as `""` (`:101`; `legacy:src/hooks/useEffectiveDistrict.ts:12`), and the district filter compares every row against `""` (`:173-178`), so a province user sees an **empty register** until they pick "All Districts" or a district. If `VITE_DEFAULT_DISTRICT` is set, admins and province users default to that district instead of "All".
- [ ] **BUG** A user whose description contains `"district"` but whose `location` is `"All"` gets `lockedDistrict = "All"` (`:97-98`; `legacy:src/hooks/useEffectiveDistrict.ts:10`) and sees zero rows (no district named "All"), with the selector disabled.
- [ ] **BUG** The province restriction is an exact, case-sensitive comparison of the raw `province` column with `user.title` (`:166`). Any mismatch (e.g. `"Central"` vs `"Central Province"`) hides all rows. Rebuild: normalised comparison via `platform/scope`; confirm `hts_register.province` values against the fixture.
- [ ] **BUG** Sync always shows `"HTS Register data synced successfully"` (`:150-151`): `invalidateQueries` does not throw on a failed refetch, so the error toast is effectively unreachable. It also clears an unrelated IndexedDB cache (`legacy:src/lib/api.ts:247-251`).
- [ ] **BUG** No error state (see Loading / empty / error).
- [ ] **QUESTION** "Linked to ART" counts any non-empty ART-number-or-status value that does not contain `"not"` (`:387-388`); because `art_status` is in the candidate list, a status like `"Pending"` or `"Defaulted"` would count as linked. Confirm the intended linkage rule (probably `case_art_number` present).
- [ ] **QUESTION** Label mismatch: card `"Total HIV Positive"` vs banner `"New Positives"` vs code `newPositives`, although the count includes `"Known Positive"` (`:756,1032,373-374`). Pick one label.
- [ ] **QUESTION** Relative time periods are anchored to the latest record date, not today (`:303-346`). A single record with a mistyped future date would move every window into the future and show zero rows. Confirm the intended anchor.
- [ ] Quirk: the district bucket for rows with no district is `"N/A"` (from `pickValue`), not `"Unknown"`, because the `|| "Unknown"` fallback never fires for the truthy string `"N/A"` (`:223,396`).
- [ ] Quirk: FY bounds are compared as UTC (`new Date("YYYY-MM-DD")`, `T23:59:59Z`) while D-M-Y record dates are built in local time (`:255,293-294`), shifting boundary days by the timezone offset.
- [ ] Quirk: the request is re-sent on every FY change although its URL never changes (FY in key, dropped by wrapper) (`:138`; `legacy:src/lib/api.ts:430`).
- [ ] Quirk: the page comment saying the backend ignores the district is stale (`:128-136` vs `backend:controllers/householdController.js:420-431`); the backend route comment is stale too (`backend:routes/householdRoutes.js:47-49`).
- [ ] Quirk: table rows are keyed by index (`:1133`).

<a id="part-risk-profile"></a>

## Part: the risk register and the profile

## Route `/registers/hts-risk` → `/hts/risk`

### Purpose
A narrow "registry" view of the HTS register filtered by a risk category chosen from `?type=` (`legacy:src/pages/HTSRiskRegister.tsx:75`). The categories are defined in `RISK_TYPES` (`legacy:src/pages/HTSRiskRegister.tsx:44-49`):

| key | label (exact, note trailing spaces on `unlinked`) | description (shown in the alert) | icon / colour |
| --- | --- | --- | --- |
| `unlinked` | `"Positives Not On ART  "` | `"Positive cases not yet linked to ART"` | AlertCircle, rose |
| `pending` | `"Pending Outcomes"` | `"Tests with unknown results"` | Clock, amber |
| `new` | `"New Positives"` | `"Positive results found in the last 7 days"` | TrendingUp, emerald |
| `all` | `"All Records"` | `"Full HTS Register"` | Briefcase, emerald |

The page shows a header, a category select, a district select, an Export CSV button, an info alert, a search box and a table of at most 100 rows, each with a "Details" link to the HTS profile.

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:292-299`). `ProtectedRoute` only checks that a user is logged in and redirects to `/change-password` when `password_change_required` is set (`legacy:src/components/auth/ProtectedRoute.tsx:8-20`). No role check. New app: declare a permission for this route in the `hts` manifest (e.g. `hts.view`) and let the shell enforce it.
- [ ] Sidebar / nav: **no entry** for `/registers/hts-risk`. The only HTS sidebar item is `{ title: "HTS Register", url: "/registers/hts", icon: Users }` in the "Registers" section (`legacy:src/components/dashboard/AppSidebar.tsx:60`). It has no visibility rule: the role filter only removes `/districts` for District Users, the "Admin" section for non-admins and a "Data Pipeline" section for non-admin/non-support users (`legacy:src/components/dashboard/AppSidebar.tsx:164-176`). Sidebar highlighting is exact-path (`legacy:src/components/dashboard/AppSidebar.tsx:183`), so no item is highlighted on this page. Mobile bottom nav has no HTS entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). GlobalSearch has no HTS navigation entry (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`).
- [ ] In-page role checks (all compare the `description` string; the new app must use `can()` / scope hooks instead):
  - `user?.description === "District User" && user?.location` → initial district is forced to `user.location` (`legacy:src/pages/HTSRiskRegister.tsx:78-80`).
  - `useEffect`: `if (user?.description === "District User" && user?.location && selectedDistrict !== user.location) setSelectedDistrict(user.location)` (`legacy:src/pages/HTSRiskRegister.tsx:86-90`).
  - District select `disabled={user?.description === "District User"}` (`legacy:src/pages/HTSRiskRegister.tsx:242`).
  - No admin, provincial or support checks. **Provincial users are not restricted**: they start on "All" and may pick any district.
- [ ] Data scope: the page does **not** use `useEffectiveDistrict`. The HTS fetch always asks for the whole register (`getHTSRegisterByDistrict("*")`, `legacy:src/pages/HTSRiskRegister.tsx:125`) and filters by district in the browser (`legacy:src/pages/HTSRiskRegister.tsx:131-140`). The district value comes from, in order: District User `location`, else `?district=` URL param, else `"All"` (`legacy:src/pages/HTSRiskRegister.tsx:78-80`). New app: take province/district from `platform/scope` and put it in the query key; a district user must only ever get their district's rows (and the backend should enforce it, see Backend asks).

### Endpoints
- [ ] `GET /household/hts-register-by-district/:district(*)` (AUDIT.md §3.2)
  - Wrapper `getHTSRegisterByDistrict(district, _fy)` (`legacy:src/lib/api.ts:428-440`); the FY argument is accepted and dropped, and the page passes none anyway.
  - Params as sent: path district = `"*"` (`legacy:src/pages/HTSRiskRegister.tsx:125`), URL-encoded with `encodeURIComponent` (which leaves `*` unchanged). No query params.
  - Fires on mount, always (no `enabled`).
  - Query key `["hts-register", "All", fyKey]` where `fyKey = fy.mode === "all" ? "all" : \`${fy.fromDate ?? ""}_${fy.toDate ?? ""}\`` (`legacy:src/pages/HTSRiskRegister.tsx:94,124`). FY is in the key but never sent, so changing FY refetches identical data.
  - Overrides: `staleTime` 10 min, `gcTime` 60 min, `retry: 1` (`legacy:src/pages/HTSRiskRegister.tsx:126-128`). Global defaults otherwise: refetch on mount/focus/reconnect (`legacy:src/App.tsx:126-131`).
  - Post-processing: `getListValue` unwraps `data` (`legacy:src/lib/api.ts:116-…`); then client-side district filter, risk-type filter and search (below).
  - **BUG (blocking):** the backend treats only `""` or `"all districts"` (case-insensitive) as "all"; anything else runs `WHERE LOWER(TRIM(district)) = LOWER($1)` (`backend:controllers/householdController.js:418-431`). `"*"` therefore returns `[]`, so this page always shows "No records found" in production (AUDIT.md §3.2, "Sentinels"). The route comment claiming the district is ignored is stale (`backend:routes/householdRoutes.js:47-49`). Port the intended behaviour: request the HTS register for the user's scope (one district, or "all districts" for national users).
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2), used **only to discover district names** for the district select and to map spelling variants.
  - Wrapper `getHouseholdsByDistrict(district, fy)` (`legacy:src/lib/api.ts:301-312`), IndexedDB list cache with 60 s TTL and stale-on-error (`legacy:src/lib/api.ts:14,212-238`), cache key `households_by_district:${district || "ALL"}${fy ? ":"+from+"_"+to : ""}` (`legacy:src/lib/api.ts:305-308`).
  - Params: path district = `""` when `selectedDistrict === "All"`, else the selected district; FY `?from=&to=` when both FY dates are set (`legacy:src/pages/HTSRiskRegister.tsx:93,99`; `legacy:src/lib/api.ts:241-245`). The backend applies the FY cohort window to this endpoint (AUDIT.md §3.2), so the district list only contains districts with households enrolled in the FY window.
  - Fires on mount and whenever `selectedDistrict` or FY changes.
  - Query key `["districts-discovery", selectedDistrict === "All" ? "All" : selectedDistrict, fyKey]`, `staleTime` 30 min (`legacy:src/pages/HTSRiskRegister.tsx:97-101`). The same key shape is used by Districts (`legacy:src/pages/Districts.tsx:72-79`) with the same query function, so the cache entry is shared.
  - Post-processing: rows' `district` values are grouped by `toTitleCase(raw.trim())`; each group keeps the list of raw spellings (`legacy:src/pages/HTSRiskRegister.tsx:103-117`; `legacy:src/lib/utils.ts:18-21`). Option list = sorted group names (`legacy:src/pages/HTSRiskRegister.tsx:119-121`).
  - New app: district options come from `platform/scope` / config geography, not from downloading the national household register.

### Fields used
HTS rows (raw, `SELECT * FROM public.hts_register`):

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| caseId (display) | `client_number`, `ecap_id` (`pickVal`, skips null/undefined/"") | Table "Case ID" (`legacy:src/pages/HTSRiskRegister.tsx:307`); export "Case ID" (`:52`) | raw string; `"—"` when missing (`:63-69`); truncated `max-w-[120px]` |
| profileId (navigation) | `ecap_id \|\| client_number` (note: **reverse order** of the display id) | "Details" link `?id=` (`legacy:src/pages/HTSRiskRegister.tsx:325-326`) | raw, not URL-encoded |
| hivResult | `hiv_result \|\| hiv_status` | Status badge (`:185`), `unlinked`/`pending`/`new` filters (`:148,155,162`) | lower-cased, substring match |
| hivStatus (export) | `hiv_status`, `hiv_result` (**reverse order** of the badge) | Export "HIV Status" (`:54`) | raw / `"—"` |
| artDate | `art_date \|\| art_date_initiated` | `unlinked` filter: truthy = linked (`:150`); export "ART Date" (`:55`) | raw / `"—"` |
| artNumber | `case_art_number` | Export "ART Number" (`:53`); search (`:170`) | raw |
| testingModality | `testing_modality` | Table "Modality" outline badge (`:314`); export (`:56`) | raw / `"—"` |
| healthFacility | `health_facility` | Table "Facility" (`:311`); export (`:57`); search (`:170`) | raw / `"—"`; truncated `max-w-[150px]` |
| caseworkerName | `caseworker_name` | Table "Caseworker" (`:317`); export (`:58`); search (`:170`) | raw / `"—"` |
| district | `district` | Client-side district filter (exact match against the raw spellings found in households, `:135-139`); export "District" (`:59`); search (`:170`) | raw |
| dateCreated | `date_created` | `new` filter via `parseISO` (`:161`); export "Date Created" (`:60`) | raw string in export |
| ecapId | `ecap_id` | search (`:170`) | — |

Household rows (discovery only): `district` (`legacy:src/pages/HTSRiskRegister.tsx:107`).

### Filters / sort / pagination / search
- [ ] **Category (risk type)** — shadcn Select, placeholder "Category", width 200px (`legacy:src/pages/HTSRiskRegister.tsx:222-234`). Options = `RISK_TYPES` in order: "Positives Not On ART  ", "Pending Outcomes", "New Positives", "All Records". Default `all` when `?type` is absent (`:75`). Persisted in URL param `type`; changing it calls `setSearchParams({ type: val, district: selectedDistrict })` (`:224`), which also writes `district` and drops any other params. Applied to table, export and the header count. Rules (`legacy:src/pages/HTSRiskRegister.tsx:146-166`), with `res = String(r.hiv_result || r.hiv_status || "").toLowerCase()`:
  - `unlinked`: `(res.includes("positive") || res.includes("reactive")) && !(r.art_date || r.art_date_initiated)`.
  - `pending`: `!res || res === "unknown" || res === "—"`.
  - `new`: positive (same test) `&& date_created && isAfter(parseISO(date_created), subDays(new Date(), 7))`. Rolling 7×24 h window from "now"; future dates are included; non-ISO dates parse as Invalid Date and are excluded.
  - `all`: no filter.
  - Unknown `type` values: see BUG below (page crashes).
- [ ] **District** — shadcn Select, placeholder "District", width 180px (`legacy:src/pages/HTSRiskRegister.tsx:236-253`). Options: `"All Districts"` (value `All`) then discovered district names (title-cased, sorted). Default: District User `location`, else `?district=`, else `All` (`:78-80`). Disabled for District Users (`:242`). Persisted in URL param `district` via `setSearchParams({ type, district: val })` (`:238-241`). The URL is read **only on first render**; later URL changes (back/forward) do not update the select (`useState(initialDistrict)`, `:82`). Applied to table, export, header count and export filename. Matching: a row is kept when its raw `district` string is exactly one of the raw spellings grouped under the selected title-cased name; if the selected name has no group (discovery still loading or failed) it falls back to an exact, case-sensitive match on the selected name (`:133-139`).
- [ ] **Search** — `Input` with placeholder `"Search by ID, Facility or Worker..."` (`legacy:src/pages/HTSRiskRegister.tsx:275-283`). Case-insensitive substring match over `client_number`, `ecap_id`, `case_art_number`, `district`, `health_facility`, `caseworker_name` (`:168-173`). No trim, no debounce, not persisted (local state, `:83`). Applied to table, export and header count.
- [ ] **Sort** — none. Rows appear in backend order (the backend has no ORDER BY, AUDIT.md §3.2). No sortable columns.
- [ ] **Pagination** — none. The table renders only `filteredData.slice(0, 100)` (`legacy:src/pages/HTSRiskRegister.tsx:304`) while the header shows the full count (`:217`). New app: use `platform/data-table` pagination (client-side over the scoped result, unless a paged endpoint is added).
- [ ] Header count text: `` `${filteredData.length} records found${selectedDistrict !== "All" ? ` in ${selectedDistrict}` : ""}` `` (`legacy:src/pages/HTSRiskRegister.tsx:216-218`).
- [ ] Heading text: `` `${currentRisk.label} Registry` `` with the category icon (`legacy:src/pages/HTSRiskRegister.tsx:212-215`).
- [ ] Info alert: title `"HTS Filter Active"`, body `` `${currentRisk.description}. Use the search bar for granular lookups.` `` (`legacy:src/pages/HTSRiskRegister.tsx:267-273`).

### Exports
- [ ] **CSV**, button "Export CSV" (Download icon), disabled when there are no filtered rows (`legacy:src/pages/HTSRiskRegister.tsx:255-262`); handler also returns early when empty (`:177`).
  - Filename: `` `hts_register_${type}_${selectedDistrict}_${dateStr}.csv` `` with `dateStr = format(new Date(), "yyyy-MM-dd")` (`legacy:src/pages/HTSRiskRegister.tsx:180-181`). `selectedDistrict` is used raw (may contain spaces; `All` when national).
  - Rows: **all filtered rows** (category + district + search), not limited to the 100 shown (`:179`).
  - Columns in order (`PROFILE_FIELDS`, `legacy:src/pages/HTSRiskRegister.tsx:51-61`), each value via `pickVal` (first non-empty key, else `"—"`):
    1. `Case ID` ← `client_number`, `ecap_id`
    2. `ART Number` ← `case_art_number`
    3. `HIV Status` ← `hiv_status`, `hiv_result`
    4. `ART Date` ← `art_date`, `art_date_initiated`
    5. `Testing Modality` ← `testing_modality`
    6. `Health Facility` ← `health_facility`
    7. `Caseworker` ← `caseworker_name`
    8. `District` ← `district`
    9. `Date Created` ← `date_created`
  - Library: hand-rolled `downloadCsv` (`legacy:src/lib/exportUtils.ts:14-29`): comma-joined, cells quoted only when they contain `,` `"` or newline (`:4-9`), headers not escaped, `\n` line endings, no BOM, built as a `data:` URI passed through `encodeURI`. No PDF/XLSX. New app: `platform/export`.

### Charts
- [ ] None. (The category icon/colour per risk type is the only visual coding: rose / amber / emerald, `legacy:src/pages/HTSRiskRegister.tsx:44-49`; use theme tokens.)

### Links in / out
- [ ] In: **none**. A grep of `src` for `hts-risk`, `HTSRiskRegister`, `type=unlinked` and `type=pending` finds only the route registration (`legacy:src/App.tsx:73,293-296`). The HTS register computes an "unlinked positives" count and a "Positives Not Linked To ART" label (`legacy:src/pages/HTSRegister.tsx:387-392,1030`) but does not link here. Reachable only by typing the URL. An in-app documentation article describes "Special filters for positives not on ART, pending outcomes, and new positives" (`legacy:src/data/documentationArticles.ts:82`). Accepted URL params: `type` (`unlinked|pending|new|all`) and `district`.
- [ ] Out:
  - Back arrow button → `navigate("/registers/hts")` (`legacy:src/pages/HTSRiskRegister.tsx:203-210`) → new `/hts`.
  - Row "Details" button → `navigate(\`/profile/hts-details?id=${id}\`, { state: { record: item } })` with `id = item.ecap_id || item.client_number`; does nothing when both are empty (`legacy:src/pages/HTSRiskRegister.tsx:320-331`). Payload: query `id` (not URL-encoded) + `location.state.record` = the whole raw HTS row. New app: `/hts/:clientId` with the id in the route param only.

### Loading / empty / error
- [ ] Loading: while `htsQuery.isLoading`, the table card shows centred `LoadingDots` (`legacy:src/pages/HTSRiskRegister.tsx:287-290`); the header meanwhile reads "0 records found" and Export is disabled. Discovery loading is not indicated (the select just has fewer options). New app: skeleton rows.
- [ ] Empty: Info icon, heading `"No records found"`, text `"Adjust your filters or district selection."` (`legacy:src/pages/HTSRiskRegister.tsx:337-345`). New app: `<EmptyState>`.
- [ ] Error: **not handled**. A failed HTS query falls through to the same "No records found" empty view; no toast, no retry button. A failed discovery query just leaves only "All Districts". New app: `<ErrorState>` with retry.

### Bugs and quirks
- [ ] **BUG** Always empty in production: the page requests district `"*"`, which the backend treats as a literal district name and returns `[]` (`legacy:src/pages/HTSRiskRegister.tsx:125`; `backend:controllers/householdController.js:420-431`). Port the intended behaviour (scoped HTS register).
- [ ] **BUG** `"non-reactive"` contains `"reactive"`, so non-reactive results are classified **positive** in the `unlinked` and `new` filters and the badge (`legacy:src/pages/HTSRiskRegister.tsx:149,163,186`). The badge checks positive first, so its `"non-reactive"` → Negative branch (`:189`) is unreachable. Classify into positive / negative / unknown once in a normaliser, with negatives matched first.
- [ ] **BUG** An unknown `?type=` value (e.g. `?type=foo`) makes `RISK_TYPES[type]` undefined and `currentRisk.icon` throws, crashing the page (`legacy:src/pages/HTSRiskRegister.tsx:75,195-196`). Validate the param and fall back to `all`.
- [ ] **BUG** After choosing a district, the discovery query refetches households for that district only, so the select's options shrink to "All Districts" + the chosen district; the user must go back to "All" to pick another (`legacy:src/pages/HTSRiskRegister.tsx:98-99,119-121`).
- [ ] **BUG** District matching depends on household spellings: HTS rows whose `district` string differs in case/whitespace from every household spelling are dropped; while discovery is loading or failed it falls back to an exact case-sensitive match (`legacy:src/pages/HTSRiskRegister.tsx:135-139`). The backend already matches HTS districts with `LOWER(TRIM(...))` (`backend:controllers/householdController.js:426-429`); filter server-side or case/trim-insensitively.
- [ ] **BUG** Only the first 100 filtered rows are rendered and there is no pagination (`legacy:src/pages/HTSRiskRegister.tsx:304`).
- [ ] **BUG** FY is in the query key but never sent, and the page does not filter by FY client-side either, so the FY selector only causes redundant refetches (`legacy:src/pages/HTSRiskRegister.tsx:94,124-125`; `legacy:src/lib/api.ts:428-430`). Meanwhile the district list *is* FY-scoped through the households discovery (`:99`). Decide whether HTS risk views are FY-scoped (see Open questions).
- [ ] **BUG** Provincial users are not restricted to their province (only `description === "District User"` is checked, `legacy:src/pages/HTSRiskRegister.tsx:78,87,242`); a District User with an empty `location` gets national data.
- [ ] **BUG** Inconsistent id/status key order: displayed Case ID prefers `client_number` while the profile link prefers `ecap_id` (`:307` vs `:325`); the badge prefers `hiv_result` while the export prefers `hiv_status` (`:185` vs `:54`); the badge's fallback text shows `record.hiv_result || "Unknown"`, ignoring `hiv_status` (`:192`). Normalise once.
- [ ] **BUG** Profile link id is not URL-encoded (`legacy:src/pages/HTSRiskRegister.tsx:326`).
- [ ] **BUG** CSV is built as a `data:` URI with `encodeURI`, which does not escape `#`; any `#` in a cell truncates the file (`legacy:src/lib/exportUtils.ts:15-22`). Use `platform/export`.
- [ ] Quirk: label `"Positives Not On ART  "` has two trailing spaces, so the heading renders as "Positives Not On ART   Registry" (`legacy:src/pages/HTSRiskRegister.tsx:45,214`).
- [ ] Quirk: row `key` is the array index (`legacy:src/pages/HTSRiskRegister.tsx:305`).
- [ ] Quirk: layout subtitle is `"Hts testing registry"` (`legacy:src/pages/HTSRiskRegister.tsx:199`).
- [ ] Quirk: the header row is a fixed flex row with three controls (200px + 180px + button) and is not responsive (`legacy:src/pages/HTSRiskRegister.tsx:201-265`); the new page must work at phone width.

---

## Route `/profile/hts-details` → `/hts/:clientId`

### Purpose
Read-only profile of a single HTS register row: gradient banner (result badge, ART number, masked name, id, district, caseworker, date created, facility), three quick-info cards and four tabs ("Clinical info", "Individual", "Contact & location", "System & case"). Personal identifiers (name, phones, address) are deliberately masked with fixed "Confidential" text.

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:469-476`; `legacy:src/components/auth/ProtectedRoute.tsx:8-20`). No role check.
- [ ] Sidebar / nav: none. Not in the sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:45-114`), mobile nav (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`) or GlobalSearch (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`; it only lists VCA and household records, `:124-172`).
- [ ] In-page role checks: **none**. No `description`/`location` comparison anywhere in the file.
- [ ] Data scope: **none**. The fallback fetch asks for the whole register (`"*"`, `legacy:src/pages/HTSProfile.tsx:86`) and any authenticated user can open any record by id. New app: the record must be fetched within the user's scope; the backend has no by-ID HTS endpoint and no scope check (see Backend asks).

### Endpoints
- [ ] `GET /household/hts-register-by-district/:district(*)` (AUDIT.md §3.2), fallback only.
  - Wrapper `getHTSRegisterByDistrict("*")` (`legacy:src/pages/HTSProfile.tsx:86`; `legacy:src/lib/api.ts:428-440`).
  - Enabled only when there is **no** `location.state.record` **and** `?id` is present (`legacy:src/pages/HTSProfile.tsx:88`).
  - Query key `["hts-register", "All"]` (no FY part, so it never shares the risk register's cache entry `["hts-register","All",fyKey]`), `staleTime` 10 min (`legacy:src/pages/HTSProfile.tsx:85-87`); global defaults otherwise (`gcTime` 24 h, `retry: 1`, `legacy:src/App.tsx:126-131`).
  - Post-processing: `find(r => String(r.ecap_id || r.client_number) === idFromUrl)` (`legacy:src/pages/HTSProfile.tsx:101-104`). The whole national register is downloaded to show one record.
  - **BUG:** like the risk register, `"*"` returns `[]` from the backend (`backend:controllers/householdController.js:420-431`), so the fallback never finds a record; deep links work only via `location.state` or the sessionStorage copy.

### Record resolution (in order)
- [ ] 1. `location.state.record` (set by the risk register's Details button). Written to `sessionStorage["ecap_last_hts_record"]` as JSON and used (`legacy:src/pages/HTSProfile.tsx:93-98`).
- [ ] 2. Fallback query result matched on `ecap_id || client_number === ?id`; also written to `sessionStorage["ecap_last_hts_record"]` (`legacy:src/pages/HTSProfile.tsx:100-109`).
- [ ] 3. `sessionStorage["ecap_last_hts_record"]`, used only if its `ecap_id || client_number` equals `?id`; JSON parse errors → null (`legacy:src/pages/HTSProfile.tsx:111-122`).
- [ ] New app: read `:clientId` from the route param and fetch through a shared `queryOptions` (same cache entry as the register). No `location.state`, no sessionStorage (CLAUDE.md data rules).

### Fields used
`p(record, keys)` returns the first non-null/undefined/"" value as a string, else `"N/A"` (`legacy:src/pages/HTSProfile.tsx:28-34`). No date or number formatting anywhere; every value is shown raw.

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| hivResult | `hiv_result` | Banner result badge and `isPositive` (`:149,155-157,181`); Clinical "Hiv result" (`:318`) | raw; colour highlight (see InfoItem) |
| hivStatus | `hiv_status` | Clinical "Hiv status" (`:319`) | raw |
| hivRecentTest | `hiv_recent_test` | Clinical "Recent hiv test" (`:320`) | raw |
| dateTestedContact | `date_tested_contact` | Quick card "Date tested (contact)" (`:246-247`); Clinical (`:321`) | raw |
| dateTestedLink | `date_tested_link` | Quick card "Date tested (link)" (`:251-252`); Clinical (`:322`) | raw |
| artDate | `art_date` | Clinical "Art date" (`:323`) | raw |
| artDateInitiated | `art_date_initiated` | Clinical "Art date initiated" (`:324`) | raw |
| artNumber | `case_art_number` | Banner badge `ART: {artNumber}` only when not "N/A" (`:150,186-190`); Clinical "Art number" (`:325`) | raw |
| testingModality | `testing_modality` | Testing details "Testing Modality" (`:336`) | raw |
| entryPoint | `entry_point` | "Entry Point" (`:337`) | raw |
| testDoneAtFacility | `test_done_hf` | "Test Done at Facility" (`:338`) | raw |
| healthFacility | `health_facility` | Metadata strip "Facility: …" (`:235`); Testing details (`:339`); Location (`:396`) | raw |
| linkEventId | `link_event_id` | Quick card "Link event id" (`:256-257`); Testing details "Link Event ID" (`:340`) | raw |
| ageIndexSns | `age_index_sns` | Individual "Age (Index/SNS)" (`:357`) | raw |
| individualAge | `individual_age` | Individual "Individual Age" (`:358`) | raw |
| genderCase | `gender_case` | "Gender (case)" (`:359`) | raw |
| genderLink | `gender_link` | "Gender (linked)" (`:360`) | raw |
| relationship | `relationship` | "Relationship" (`:361`) | raw |
| otherRelationship | `other_relationship` | "Other relationship" (`:362`) | raw |
| subPopulation | `sub_population` | "Sub population" (`:363`) | raw (sub-population labels must come from config) |
| caseSubPopulation | `case_suppopulation` (sic) | "Case sub-population" (`:364`) | raw |
| landmark | `landmark` | Contact "Landmark" (`:383`) | raw |
| province | `province` | Location "Province" (`:394`) | raw |
| district | `district` | Banner (`:152,204`); Location "District" (`:395`) | raw |
| caseworkerName | `caseworker_name` | Banner (`:153,208`); System "Caseworker" (`:415`) | raw |
| caseUid / display id | `ecap_id`, `client_number` | Banner "ID: …" when not "N/A" (`:151,196-201`); tab-bar "ID: …" (`:303-305`); System "Case uid" (`:412`); layout subtitle (`:160`) | raw |
| clientNumber | `client_number` | System "Client number" (`:413`) | raw |
| ecapId | `ecap_id` | System, label `"id"` (`:414`) | raw |
| dateCreated | `date_created` | Metadata strip "Date Created: …" (`:231`); System "Date created" (`:416`) | raw |
| comment | `comment` | "Notes & comments" card, only when not "N/A" (`:420-434`) | raw |

Masked (never read from the record): heading and "Individual Tested" `"Caregiver Name – Confidential"` (`:194,356`); "Phone" and "Contact Phone" `"Phone – Confidential"` (`:380-381`); "Address" `"Address – Confidential"` (`:382`).

### Layout (exact labels)
- [ ] Layout subtitle `` `Hts profile — ${ecapId}` `` (`legacy:src/pages/HTSProfile.tsx:160`).
- [ ] Banner badges: result badge `"HIV Positive"` if `isPositive`, else `"HIV Negative"` if `hivResult !== "N/A"`, else `"Result Unknown"` (`:175-182`); static `"Hts record"` (`:183-185`); `"ART: {artNumber}"` when present (`:186-190`).
- [ ] Banner heading `"Caregiver Name – Confidential"`; line with `ID: {ecapId}` (only when present), district, caseworker (`:194-210`). Back button "Back" → `navigate(-1)` (`:213-220`).
- [ ] Metadata strip: `"Date Created: {date_created}"`, `"Facility: {health_facility}"` (`:225-238`).
- [ ] Quick-info cards (3): "Date tested (contact)", "Date tested (link)", "Link event id" (`:242-272`).
- [ ] Tabs, default `clinical`, not persisted in URL (`:275`): "Clinical info" / "Individual" / "Contact & location" / "System & case" (`:278-301`). Tab bar also shows `ID: {ecapId}` on md+ (`:303-305`).
  - Clinical info: card "Hiv testing results" (8 items, `:311-327`); card "Testing details" (5 items, `:329-342`).
  - Individual: card "Individual being tested" (9 items, `:349-366`).
  - Contact & location: cards "Contact details" (4 items) and "Location" (3 items) (`:373-398`).
  - System & case: card "Case & system information" (5 items, `:405-418`); optional "Notes & comments" card with label "Comment" (`:420-434`).
- [ ] `InfoItem` value highlighting (`legacy:src/pages/HTSProfile.tsx:46-72`): for **every** item, if the value (lower-cased) contains `positive` or `reactive` → rose pill; else if it contains `negative` or `non-reactive` → emerald pill; `"N/A"` is never highlighted. The `highlight` prop exists but is never passed.

### Filters / sort / pagination / search
- [ ] None.

### Exports
- [ ] None.

### Charts
- [ ] None.

### Links in / out
- [ ] In: only the risk register's "Details" button: `/profile/hts-details?id=${ecap_id || client_number}` with `state: { record: <raw HTS row> }` (`legacy:src/pages/HTSRiskRegister.tsx:325-326`). The HTS register's row button goes to `/hts/view` (`legacy:src/pages/HTSRegister.tsx:1184-1193`), which is **not a registered route** (falls to `NotFound`, `legacy:src/App.tsx:590`), so the main register never reaches this profile (covered in the "register" part). Because the risk register is itself unreachable and always empty, the profile is effectively unreachable in production. No sessionStorage/localStorage is written by callers before navigating.
- [ ] Out:
  - "Back" → `navigate(-1)` (`legacy:src/pages/HTSProfile.tsx:214`). New app: back to `/hts` (or history back when it came from the app).
  - Not-found action "Back to HTS Register" → `navigate("/registers/hts")` (`legacy:src/pages/HTSProfile.tsx:142`) → new `/hts`.

### Loading / empty / error
- [ ] Loading: while the fallback query `isLoading` and no record is resolved, full page `LoadingDots` with layout subtitle `"Loading profile"` (`legacy:src/pages/HTSProfile.tsx:125-133`). New app: skeleton.
- [ ] Not found: `EmptyState` with TestTube2 icon, title `"Record not found"`, description `` `Profile with ID ${idFromUrl} could not be loaded.` `` when `?id` is present, else `"The HTS record you're looking for could not be loaded."`, action "Back to HTS Register"; layout subtitle `"Hts profile"` (`legacy:src/pages/HTSProfile.tsx:135-147`).
- [ ] Error: **not handled**. A failed fallback query is indistinguishable from "not found" (no toast, no retry). New app: `<ErrorState>` with retry, separate from not-found.

### Bugs and quirks
- [ ] **BUG** Fallback fetch uses `"*"`, which returns `[]` (`legacy:src/pages/HTSProfile.tsx:86`; `backend:controllers/householdController.js:420-431`): a shared or bookmarked link in a new tab always shows "Record not found".
- [ ] **BUG** Positive/negative classification: `"non-reactive"` contains `"reactive"`, so it is shown as "HIV Positive" in the banner (`legacy:src/pages/HTSProfile.tsx:155-157,181`) and highlighted rose in every InfoItem (`:46-53`); the `non-reactive` negative branch is unreachable.
- [ ] **BUG** Any non-empty result that is not positive (e.g. "Indeterminate", "Unknown") is labelled `"HIV Negative"` (`legacy:src/pages/HTSProfile.tsx:181`).
- [ ] **BUG** The banner uses only `hiv_result` (`:149`), while the risk register classifies on `hiv_result || hiv_status`; a record with only `hiv_status` is "Positive" in the list and "Result Unknown" on the profile.
- [ ] **BUG** InfoItem colours any field whose text contains "positive"/"negative"/"reactive" (e.g. free-text comment-like fields, relationship), not just HIV result fields (`legacy:src/pages/HTSProfile.tsx:46-53`). Highlight only the result/status fields.
- [ ] **BUG** Full HTS row (health PII) is copied into `sessionStorage["ecap_last_hts_record"]` and never cleared, including on logout (`legacy:src/pages/HTSProfile.tsx:96,106`; no removal anywhere in `src`). The write happens inside `useMemo` (side effect in render).
- [ ] **BUG** No scope check: any authenticated user can open any HTS record (`legacy:src/pages/HTSProfile.tsx:84-123`).
- [ ] Quirk: the label for `ecap_id` is just `"id"` (`legacy:src/pages/HTSProfile.tsx:414`) and "Case uid" shows `ecap_id || client_number` (`:412`), so the same value can appear twice.
- [ ] Quirk: all dates shown raw (no `format.ts`), `case_suppopulation` key spelt as in the data (`:364`).

---

## Other behaviour

### The register draft

- [ ] No modals, dialogs, forms or mutations on this page.
- [ ] Animations: page fade/slide-in via `framer-motion` (`:584-589`), KPI card hover lift (`:799-802`), banner slide-in (`:1014-1018`), tab slide-in classes (`:701,1011`), pulsing hero blobs (`:594-595`). Decorative only; the rebuild must not add an animation library (CLAUDE.md UI rules).
- [ ] Timers/polling: none in the page. Global: `EtlInvalidator` polls `/etl/last-success` every 30 s and invalidates this query on ETL completion (`legacy:src/components/EtlInvalidator.tsx:28,54-57,78-79`); default `refetchOnWindowFocus` refetches the national dump on focus once older than 60 s (`legacy:src/App.tsx:115-134`).
- [ ] Storage: the page reads/writes no storage directly. Indirect: FY filter localStorage `ecap_plus_pmp.fy_filter_state_v2` + URL `fy`/`from`/`to` (`legacy:src/context/FyFilterContext.tsx:12,63-79`); React Query IndexedDB persister key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:147`); `clearApiCache` wipes the auxiliary IndexedDB list cache (`legacy:src/lib/api.ts:247-251`).
- [ ] Browser APIs: Blob + `URL.createObjectURL` + temporary `<a download>` for CSV (`legacy:src/lib/csv.ts:18-29`).
- [ ] Keyboard shortcuts: none on this page (global Cmd/Ctrl+K palette has no HTS entry).
- [ ] Hardcoded domain/program strings to move to `@/config` (quoted for config parity): `"All Districts"` (`:93`); sub-population/type labels `"CA (Child)"`, `"Mother"`, `"Mother/Adult"` and age cut-off `20` (`:184,208-209`); FY label `"This Fiscal Year (Oct–Sep)"` and FY start month index `9` (`:327-330,724`); status vocabularies `"hiv+"`, `"known positive"`, `"hiv-"`, `"known negative"` (`:373-376`); geography via `legacy:src/constants/districts.ts:1-8`; scope role string `"ecap+ support"` (`legacy:src/hooks/useEffectiveDistrict.ts:8`). Comments mention "OpenSRP / ECAP" (`:240`) and "PEPFAR FY" (`:327`).

### The risk register and the profile draft

- [ ] Storage keys:
  - `sessionStorage["ecap_last_hts_record"]` — JSON of the last viewed HTS row; written `legacy:src/pages/HTSProfile.tsx:96,106`, read `:113`. **Drop** in the new app (route param + query cache).
  - IndexedDB list cache entry `households_by_district:<district|ALL>[:<from>_<to>]` written by `getHouseholdsByDistrict` for the district discovery (`legacy:src/lib/api.ts:305-308,212-238`).
  - The global React Query persister writes every successful query to IndexedDB key `ecap-plus-pmp-react-query` for 24 h (`legacy:src/App.tsx:146,216-223`), so the national HTS register (health PII) is persisted on disk. New app: HTS queries should set `meta: { persist: false }` (user-private/sensitive data) — confirm with developer.
- [ ] Timers / refetch: no page-level timers. Global `EtlInvalidator` polls every 30 s and, when a new ETL run completes, invalidates every query whose key does not start with `"etl"`, including `["hts-register", …]` and `["districts-discovery", …]` (`legacy:src/components/EtlInvalidator.tsx:28,56,77-80`). HTS data is warehouse/ETL data (`hts_register` pipeline, AUDIT.md §3.2), so new HTS queries set `meta: { etl: true }`. The HTS register page's refresh button invalidates the `["hts-register"]` prefix (`legacy:src/pages/HTSRegister.tsx:150`), which also hits this part's two keys.
- [ ] No modals, forms, mutations, toasts or keyboard shortcuts in either page.
- [ ] Unused imports: `useEffect` is used; `useEffectiveDistrict` is not imported by either page.
- [ ] Backend asks (record in PROGRESS.md): (1) `GET /household/hts-register-by-district/:district(*)` trusts the caller's district and returns the national register to any user (AUDIT.md §3.2); it should derive scope from the user. (2) There is no by-ID HTS endpoint, so the profile must download the register to show one record; a scoped `GET …/hts/:clientId` would avoid that. (3) No FY window on the HTS endpoint.

## Open questions for the developer

### The register draft

1. The register "View" button has never worked (`/hts/view` is not a route). What is the stable client ID for `/hts/:clientId` — `client_number`, `ecap_id`, or `hts_id`? (Legacy register and profile disagree: `legacy:src/pages/HTSRegister.tsx:187-195` vs `legacy:src/pages/HTSProfile.tsx:101-103`.)
2. Should rows without an HIV result (`"N/A"`/empty/`"unknown"`) appear in the register and counts (`legacy:src/pages/HTSRegister.tsx:227-230`)?
3. What is the correct "linked to ART" rule (`legacy:src/pages/HTSRegister.tsx:380-388`)?
4. Should the Charts-tab exports export the chart data instead of register rows?
5. Should relative time periods be anchored to today or to the latest record on file (`legacy:src/pages/HTSRegister.tsx:303-346`)?
6. Should the time-period filter and the global FY filter both exist on this page, or should the local "This Fiscal Year" option be dropped in favour of the global FY scope?
7. Should HTS clients be searchable from the global search, and should the page get a mobile nav entry (none in legacy)?
8. Is sending a single district server-side acceptable (the handler supports it, `backend:controllers/householdController.js:420-431`), with "all"/province scope still fetching the national register? (The backend stays unchanged per decision 7; the national dump to any authenticated user should be listed under "Backend asks".)

### The risk register and the profile draft

1. **QUESTION** Both pages call the HTS endpoint with `"*"`, which returns `[]` from the current backend (`legacy:src/pages/HTSRiskRegister.tsx:125`, `legacy:src/pages/HTSProfile.tsx:86`; `backend:controllers/householdController.js:420-431`). Confirm on the live API, then confirm the new module should send `"All Districts"` (national users) or the user's single district.
2. **QUESTION** What values do `hiv_result` / `hiv_status` actually hold (e.g. "Positive", "Reactive", "Non-reactive", "Negative", "Unknown", "Indeterminate")? Needed to write one correct classifier for the risk filters, badges and banner.
3. **QUESTION** What is the canonical client id for `/hts/:clientId`: `ecap_id` or `client_number`? Legacy displays `client_number` first but links/looks up with `ecap_id || client_number`. Are either unique?
4. **QUESTION** Should the HTS risk views be FY-scoped? Legacy keys on FY but filters nothing; the backend ignores FY; the main HTS register re-applies FY client-side (`legacy:src/pages/HTSRegister.tsx:129-140`). If yes, which date field defines the window (`date_created`? a test date?).
5. **QUESTION** What format is `date_created` in (ISO vs DD-MM-YYYY)? The "New Positives" rule relies on `parseISO` (`legacy:src/pages/HTSRiskRegister.tsx:161`).
6. **QUESTION** `/registers/hts-risk` has no inbound link. Should the new `/hts` register link to `/hts/risk?type=…` (e.g. from its "unlinked positives" count), and should `/hts/risk` get a nav entry?
7. **QUESTION** Provincial users currently see all districts on the risk register. Should they be limited to their province (as `useEffectiveDistrict` would do)?
8. **QUESTION** The masked heading says "Caregiver Name – Confidential" (`legacy:src/pages/HTSProfile.tsx:194,356`) although the tested individual may be an index client or a contact. Keep the masking text, make it a config domain term, or use a neutral "Name – Confidential"?
9. **QUESTION** Should HTS query results be excluded from the persisted query cache (`meta: { persist: false }`) given they are health PII?
