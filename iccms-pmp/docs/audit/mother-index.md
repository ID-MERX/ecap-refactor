# mother-index — legacy audit

> Legacy routes → new routes: `/registers/mother-index` → `/mother-index`; `/profile/mother-index-details` → `/mother-index/:id` · Plan: MIGRATION_PLAN.md §5 row "mother-index"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/MotherIndexRegister.tsx` | 326 | Register page (`/registers/mother-index`) |
| `legacy:src/pages/MotherIndexDetails.tsx` | 264 | Detail page (`/profile/mother-index-details`) |
| `legacy:src/App.tsx` | 602 | Lazy imports (`:43-45`, `:54-56`), route guards (`:308-315`, `:485-492`), QueryClient defaults (`:113-134`), IndexedDB persister (`:140-148`) |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | Nav entry "Mother Index Register" (`:62-66`), visibility filter (`:147-181`) |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | No mother-index entry (`:5-11`) |
| `legacy:src/components/dashboard/GlobalSearch.tsx` | 212 | No mother-index entry (`:33-46`) |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | Default district / selector options / restriction |
| `legacy:src/lib/api.ts` (parts read: `:1-420`) | — | `dqaGet` (`:185-210`), `getListValue` (`:115-182`), `getCountValue` (`:25-113`), `getListFromApiWithCache` (`:212-238`), `fyQs` (`:240-245`), `clearApiCache` (`:247-251`), `getTotalMothersCount` (`:272-278`), `getMothersByDistrict` (`:341-346`), `getChildrenByDistrict` (`:368-379`) |
| `legacy:src/lib/csv.ts` | 29 | `downloadCsv` (hand-rolled CSV, no BOM) |
| `legacy:src/lib/utils.ts` (`:1-21`) | — | `CAREGIVER_CONFIDENTIAL_LABEL`, `anonymizeCaregiverName` |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard |
| `legacy:src/context/FyFilterContext.tsx` (`:1-60`) | — | FY state (`resolved.fromDate/toDate/mode`), localStorage key |
| `legacy:src/components/EtlInvalidator.tsx` (`:70-85`) | — | Invalidates every non-`etl` query (incl. `mothers`) after an ETL run |
| `backend:controllers/motherController.js` | 64 | Mother register and count handlers |
| `backend:routes/motherRoutes.js` | 12 | Mother router |

## Route `/registers/mother-index` → `/mother-index`

### Purpose
List of index mothers (rows from the backend `mothers` table) for one district or all districts. It has 4 yes/no "Mother category" filters, a search, an expandable row showing the last-updated date, CSV export, a "Sync" (cache refresh) button, and a "View" link to the detail page. Page subtitle is "Mother Index Register" (`legacy:src/pages/MotherIndexRegister.tsx:192`).

Header copy (`:200-209`):
- eyebrow "Mother index register" · today's date (`toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })`, `:151`) · badge "`{countQuery.data ?? 0}` records" (`:203`)
- h1 "All registered mothers" + badge "Active mothers only" (`:206-207`)
- description "Index mother records with sub-population filters and CSV export." (`:209`)

### Access
- [ ] Route guard: `<ProtectedRoute>` only, with no role check (`legacy:src/App.tsx:308-315`). ProtectedRoute renders nothing while auth is loading, redirects to `/` if there is no user, and redirects to `/change-password` if `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`).
- [ ] Sidebar: section "Registers", item `{ title: "Mother Index Register", url: "/registers/mother-index", icon: Baby }` (`legacy:src/components/dashboard/AppSidebar.tsx:62-66`). The filter has only three rules: `item.url === "/districts" && isDistrictUser`, `section.label === "Admin" && !isAdmin`, and `section.label === "Data Pipeline" && !isAdmin && !isSupport` (`:166-173`). None applies here, so **every authenticated user sees it**. Active state uses an exact path match (`:183`).
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). Mobile users reach it through "More" (`onOpenMenu`, which opens the sidebar) (`:37-46`).
- [ ] Global search: no navigation entry (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`) and no mother records are searched (`:66-76`).
- [ ] In-page checks, all from `useEffectiveDistrict()` (`legacy:src/pages/MotherIndexRegister.tsx:52`):
  - `isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support"` (description lower-cased) (`legacy:src/hooks/useEffectiveDistrict.ts:7-8`)
  - `isProvinceUser = description.includes("provincial") || description.includes("province")` (`:9`)
  - `isDistrictUser = description.includes("district") || (!!user?.location && user.location !== "All" && !isAdmin && !isProvinceUser)` (`:10`); `isRestrictedToDistrict: isDistrictUser` (`:17`)
  - The district `<Select>` renders only when `!isRestrictedToDistrict` (`legacy:src/pages/MotherIndexRegister.tsx:214`).
  - Initial district: `useState(initialDistrict || (isAdmin ? "All Districts" : ""))` (`:56`).
- [ ] Data scope:
  - `initialDistrict = user.location` if it is set and not `"All"`, else `user.district || DEFAULT_DISTRICT || ""` (`legacy:src/hooks/useEffectiveDistrict.ts:12`). `DEFAULT_DISTRICT` is `import.meta.env.VITE_DEFAULT_DISTRICT` (`legacy:src/lib/api.ts:7`).
  - `availableDistricts` (`legacy:src/hooks/useEffectiveDistrict.ts:13-16`):
    - province user with a province: `["All Districts", ...DISTRICTS_BY_PROVINCE[province]]`
    - district user: `[district]`
    - admin: `["All Districts", ...ALL_DISTRICTS]`
    - anyone else: `ALL_DISTRICTS`
  - The Select always renders a hardcoded `<SelectItem value="All Districts">All Districts</SelectItem>`, followed by `availableDistricts` minus `"All Districts"` (`legacy:src/pages/MotherIndexRegister.tsx:215-220`). Placeholder: "All Districts".
  - The district is sent as a path segment, so `"All Districts"` goes literally. The backend treats `""`, `"all"` and `"all districts"` (case-insensitive) as no filter (`backend:controllers/motherController.js:3-12`).
  - **BUG** (scope leak): any non-district user, province users included, can pick "All Districts" and get every district's mothers. The backend does not apply user scope (AUDIT.md §3.1). Backend ask: enforce scope.
  - **BUG** (selector reset): the effect at `:66-69` has `selectedDistrict` in its deps and runs `if (initialDistrict) setSelectedDistrict(initialDistrict)`. So whenever `initialDistrict` is truthy (almost always, because of the `DEFAULT_DISTRICT` fallback), any user choice is reverted straight away. Admins whose `location` is `"All"` get pinned to `user.district`/`DEFAULT_DISTRICT` instead of "All Districts". Port the intended behaviour: the default comes from scope and the user's choice sticks.
  - **QUESTION**: a district user with no location and no `DEFAULT_DISTRICT` gets `selectedDistrict = ""`. That requests `/mother/district//filtered`, which the backend most likely treats as "all" (empty → no filter, `backend:controllers/motherController.js:5`).

### Endpoints
- [ ] `GET /mother/district/:district(*)/filtered` (AUDIT.md §3.2)
  - Wrapper: `getMothersByDistrict(district, fy)` → `dqaGet(`/mother/district/${encodeURIComponent(district)}/filtered${fyQs(fy)}`)` → `getListValue(data)` (`legacy:src/lib/api.ts:341-346`).
  - Params: `selectedDistrict` (or `"All Districts"`), plus `?from=&to=` only when both `fy.fromDate` and `fy.toDate` are set (`legacy:src/pages/MotherIndexRegister.tsx:54`; `legacy:src/lib/api.ts:240-245`). The backend **ignores FY**; it runs `SELECT * FROM mothers ... ORDER BY household_id ASC` and returns `{status:"success", data: rows}` (`backend:controllers/motherController.js:14-31`).
  - Query key: `["mothers", "district", selectedDistrict, fy.mode, fy.fromDate, fy.toDate]`, with `retry: 1` and `placeholderData: keepPreviousData`. There is no `enabled` guard, so it fires on mount (`legacy:src/pages/MotherIndexRegister.tsx:75-80`).
  - Global defaults apply: `staleTime: 60s`, `gcTime: 24h`, refetch on mount/focus/reconnect, `retry: 1` (`legacy:src/App.tsx:113-134`). The result is persisted to IndexedDB by the React Query persister (`legacy:src/App.tsx:140-148`), and it is invalidated after ETL runs (`legacy:src/components/EtlInvalidator.tsx:77-80`). New app: `meta: { etl: true }` (**QUESTION**: confirm `mothers` is ETL-loaded). The rows are personal health data, so also consider `persist: false`.
  - Auth: Bearer token from `getStoredToken()`. Throws "Not authenticated." if there is none, and `data.message ?? "DQA request failed"` on a non-2xx response (`legacy:src/lib/api.ts:185-210`). Not cached in the auxiliary IDB cache.
- [ ] Count badge query, key `["mothers", "count", selectedDistrict, fy.mode, fy.fromDate, fy.toDate]`, `placeholderData: keepPreviousData` (`legacy:src/pages/MotherIndexRegister.tsx:82-89`):
  - When `selectedDistrict === "All Districts"`, it calls `GET /mother/total/count` (AUDIT.md §3.2) via `getTotalMothersCount()` with no district (`legacy:src/lib/api.ts:272-278`). The backend returns `COUNT(DISTINCT household_id)` over all mothers, ignoring FY (`backend:controllers/motherController.js:33-44`). The value is parsed with `getCountValue` (`legacy:src/lib/api.ts:25-113`).
  - Otherwise it **re-fetches the whole list** `GET /mother/district/:district(*)/filtered` and uses `data.length` (raw rows, before de-duplication).
  - **BUG**: the badge mixes "distinct households" (all) with "raw row count" (district). Neither equals the de-duplicated, filtered list length. Show one consistent number (e.g. the de-duplicated total, plus the filtered count).
  - **BUG**: the district branch requests the same list twice under different keys. The new app should derive the count from the list query.
  - The `/mother/members-count/:district(*)` branch of `getTotalMothersCount` is never taken (AUDIT.md §3.2).
- [ ] Client-side post-processing (`legacy:src/pages/MotherIndexRegister.tsx:91-145`), in order:
  1. De-duplicate by mother ID: the first non-empty of `["mother_id", "household_id", "ecap_id", "id", "unique_id"]`. The first occurrence wins; records with no ID are **dropped** (`:94-99`).
  2. Apply the sub-population filters (`:101-115`).
  3. Apply the date filter (dead, see below) (`:116-124`).
  4. Apply the search (`:128-135`).
  5. Sort descending by `rec.updated_at || rec.date_created || rec.created_at || rec.anc_date`; a missing date sorts as 0, i.e. last (`:137-143`).
  - **QUESTION**: the backend count uses `DISTINCT household_id`, which suggests several rows per household. If `mother_id` is absent, de-duplicating by `household_id` collapses them to one row. Confirm the real row identity.

### Fields used

`pickValue` in the register treats `null`, `undefined`, `""` **and `0`** as missing and returns `"N/A"` (`legacy:src/pages/MotherIndexRegister.tsx:34-40`).

| Field (normalised) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| motherId | `mother_id`, `household_id`, `ecap_id`, `id`, `unique_id` | De-dup key, search, "Mother ID" column (mono, rose), CSV "Mother ID", row key `${id}-${index}` (`:96,131,166,284,295`) | raw string |
| district | `district`, `district_name` | "District" column, CSV (`:167,296`) | raw |
| facility | `facility`, `facility_name` | "Facility" column, search, CSV (`:132,168,297`) | raw |
| hivStatus (named `artStatus` in code) | `art_status`, `caregiver_hiv_status`, `hiv_status` | "HIV Status" column badge (rose if lower-cased value includes `"positive"`, else emerald, which includes "N/A"); CSV header "ART Status"; the `hiv_pos` filter (`:107,169,286,299`) | upper-case badge |
| hei | `hei`, `hei_status` | "HEI Status" filter (`:106`) | — |
| onArt | `on_art`, `art_linkage` | "On ART" filter (`:108`) | — |
| linked | `linked`, `linkage_status` | "Linked" filter (`:109`) | — |
| updatedAt (expanded row) | `updated_at`, `last_edited`, `date_updated`, `registration_date` | Expanded row "Updated: {date}" (`:308`) | `formatDate`: `Intl.DateTimeFormat("en-GB", dd/MM/yyyy)`, then `/` → `-` (e.g. `05-03-2025`); invalid date → raw; N/A → "N/A" (`:42-47`) |
| sortDate | `updated_at`, `date_created`, `created_at`, `anc_date` (`\|\|` chain, not pickValue) | Default sort (`:139`) | epoch ms |
| filterDate (dead) | `updated_at`, `last_service_date`, `last_edited`, `anc_date`, `registration_date` | Date filter (`:117`) | — |

**QUESTION**: `hiv_pos` reads `art_status` first. ART status is not HIV status. Confirm the real `mothers` columns (fixture `dqa-mothers.json`) so the normaliser picks one key per field.

### Filters / sort / pagination / search
- [ ] **Mother category** panel titled "Mother category" (`:239`). Four tri-state segmented buttons, defined as `subPopulationFilterLabels = { hei: "HEI Status", hiv_pos: "HIV Positive", on_art: "On ART", linked: "Linked" }` (`:27-32`).
  - Options: `"all" | "yes" | "no"`, shown upper-case. Active `yes` is emerald, active `no` is rose, active `all` is white (`:247-248`). Default: `"all"` for every filter (`:60-62`).
  - Not persisted (component state only).
  - Matching (`:111-114`): the value is `pickValue(...)` lower-cased.
    - `yes` keeps the row only if the value is one of `["yes", "true", "1", "active", "positive"]`.
    - `no` keeps the row only if the value is one of `["no", "false", "0", "", "n/a", "negative"]`.
    - Any other value (e.g. `"unknown"`) is excluded under both `yes` and `no`.
  - Applies to the table and to the export. The count badge is not affected.
  - Layout grid is `xl:grid-cols-5` for 4 items (cosmetic).
  - Sub-population labels are program terms and should come from `@/config`.
- [ ] **Date filter (dead code)**: state `dateFilter`, default `"any"`, values `"30_days"`, `"90_days"` and `"this_year"`, with logic at `:116-124` (absolute day difference ≤ 30/90, or same calendar year; unparsable dates excluded). **No UI control sets it** (it is only reset in `handleClearFilters`, `:179`). **QUESTION**: should the rebuild add this filter or drop it?
- [ ] **District selector**: see Access / Data scope. Changing district does **not** reset `currentPage` (the reset effect deps are `[searchQuery, subPopulationFilters, dateFilter]`, `:71-73`).
- [ ] **Search**: input with placeholder "Search by ID or facility..." (`:232`). Case-insensitive substring match on motherId or facility (`:128-135`). Uses `useDeferredValue` (no timer debounce) (`:64`). The query is lower-cased but not trimmed (`trim()` is only used for the emptiness check). Not persisted.
- [ ] **Clear Filters** button: resets search, all category filters to `all`, date filter to `any`, page to 1 (`:176-181,234`). It does not reset district.
- [ ] **Sort**: fixed, newest first by sortDate (`:137-143`). No sortable columns.
- [ ] **Pagination**: client-side, `ITEMS_PER_PAGE = 50` (`:25`), slicing at `:147-149`. **BUG**: no pagination control is rendered (the `Pagination*` imports are unused, `:13`), so **only the first 50 rows can ever be seen**. The export still includes all rows. The rebuild uses `platform/data-table` pagination.

### Exports
- [ ] CSV export, button "Export CSV" (`:213`), handler `handleExportCsv` (`:159-174`).
  - If there are no rows (`!rawMothers.length`) it silently does nothing: no toast.
  - Rows: **all filtered and searched rows** (`rawMothers`, every page), in the sorted order.
  - Filename: `` `index-mothers-${selectedDistrict.toLowerCase().replace(/\s+/g, "-")}.csv` `` (e.g. `index-mothers-all-districts.csv`) (`:172`).
  - Columns in order:
    1. "No." — 1-based index
    2. "Mother ID" — motherId
    3. "District" — district
    4. "Facility" — facility
    5. "ART Status" — the same value as the "HIV Status" column (`art_status`/`caregiver_hiv_status`/`hiv_status`)
  - Missing values export as the literal "N/A".
  - Library: `downloadCsv` in `legacy:src/lib/csv.ts:18-29`. Escaping quotes fields containing `"`, `,` or `\n`; no BOM; MIME `text/csv;charset=utf-8;`.
  - Success toast (sonner): "Register exported." (`:173`).
  - **QUESTION**: the header "ART Status" differs from the on-screen "HIV Status" for the same field. Pick one label.
  - No PDF/XLSX. No branding in the file.

### Charts
- [ ] None. The only KPI is the "`N` records" count badge (see Endpoints for its inconsistent definition).

### Links in / out
- [ ] In: sidebar only (`legacy:src/components/dashboard/AppSidebar.tsx:64`); grep finds no other reference except the route (`legacy:src/App.tsx:309`). No payload. The detail page's "Back to register" uses `navigate(-1)`, not this path.
- [ ] Out: row "View" button → `navigate("/profile/mother-index-details", { state: { record } })`, where `record` is the **whole raw API row** (`legacy:src/pages/MotherIndexRegister.tsx:302`). New app: `/mother-index/:id`, with the ID from the route param (see detail route QUESTION).

### Loading / empty / error
- [ ] Loading: a single table row with `<LoadingDots />` (`colSpan=6`) while `countQuery.isLoading || allDistrictQuery.isLoading` (`:270-271`). `keepPreviousData` keeps old rows on screen while the district/FY changes. New app: skeletons.
- [ ] Empty: `HeartPulse` icon + "No records found for the current filters." (`:272-280`).
- [ ] Error: **not handled**. A failed list query leaves `data` undefined, so the page shows the same "No records found" text. A failed count makes the badge show `0`. There is no toast and no retry button. New app: `<ErrorState>` with retry.
- [ ] Sync button "Sync" (`:212`): `clearApiCache()` (clears **all** auxiliary IndexedDB cache entries in `ecap_plus_cache_db/api_cache`, `legacy:src/lib/api.ts:247-251`) → `invalidateQueries({ queryKey: ["mothers"] })` → toast "Mother index data refreshed." (`:153-157`). There is no loading state on the button and no error path. The toast fires even if the refetch later fails.

### Bugs and quirks
- [ ] **BUG** The district selector is reverted by the effect at `legacy:src/pages/MotherIndexRegister.tsx:66-69` (see Access).
- [ ] **BUG** No pagination UI; only 50 rows are visible (`:147-149`, `:13`).
- [ ] **BUG** The count badge definition is inconsistent and the list is double-fetched (`:82-89`).
- [ ] **BUG** "All Districts" is offered to every non-district user, which leaks scope (`:218`). Backend ask.
- [ ] **BUG** Errors are shown as the empty state (`:270-280`).
- [ ] **BUG** `pickValue` treats `0` as missing, so a numeric `0` flag reads as "N/A" (`:37`). For the "no" filter this happens to work, because "n/a" is accepted.
- [ ] **QUESTION** The badge "Active mothers only" (`:207`) is hardcoded. The backend applies no active filter (`SELECT * FROM mothers`, `backend:controllers/motherController.js:18-24`).
- [ ] **QUESTION** The FY window is part of the key and is sent, but the backend ignores it (AUDIT.md §3.2). Should the FY chip be hidden or disabled for this module, or should the backend add FY support?
- [ ] The page does not reset to page 1 on a district change (`:71-73`).
- [ ] Expand/collapse state is keyed by `${id}-${index}`, so it survives across filters by index, not by record (`:284-285`).

---

## Route `/profile/mother-index-details` → `/mother-index/:id`

### Purpose
Read-only profile of one index mother. It is built entirely from the raw register row passed in `location.state`. It also shows a "CAs in this Household" panel listing VCAs (children/adolescents) from the same district that match the mother's household (or name/phone), each linking to the VCA profile. Page subtitle is "Mother Details" (`legacy:src/pages/MotherIndexDetails.tsx:99`).

### Access
- [ ] Route guard: `<ProtectedRoute>` only (`legacy:src/App.tsx:485-492`).
- [ ] No sidebar, mobile-nav or global-search entry (grep: only `legacy:src/App.tsx:486` and `legacy:src/pages/MotherIndexRegister.tsx:302`).
- [ ] No in-page role checks. There is no district check, so any authenticated user holding the state could view any row.
- [ ] Data scope: the CAs query uses the **mother record's** `district` (`[district, district_name]`), not the user's scope (`:36,83-84`).

### Endpoints
- [ ] **No fetch for the mother itself.** Data comes from `location.state.record ?? location.state ?? {}` (`:31`). There is no single-mother endpoint in the backend (`backend:routes/motherRoutes.js:5-10`).
  - **BUG**: a reload, a deep link or a new tab shows an empty profile (all "N/A").
  - **QUESTION**: the new route is `/mother-index/:id`, but no endpoint fetches one mother. Options:
    - (a) fetch `GET /mother/district/:district(*)/filtered` for the user's scope and find the record by ID, sharing the register's query cache (the district could be carried as a query param `?district=`);
    - (b) a backend ask for `GET /mother/:id`.
    - Also decide which ID: motherId (register key list) or householdId (detail key list, below).
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2), used for the "CAs in this Household" panel.
  - Wrapper: `getChildrenByDistrict(district)` with **no FY** (`legacy:src/pages/MotherIndexDetails.tsx:84`; `legacy:src/lib/api.ts:368-379`).
  - Goes through the auxiliary IndexedDB cache: key `children_by_district:<district>`, TTL 60s (`LIST_CACHE_TTL_MS`, `legacy:src/lib/api.ts:14`). On a fetch error it falls back to a stale cached entry (`legacy:src/lib/api.ts:212-238`).
  - Query key: `["mother-cas", district, hhKey, motherName, motherPhone]`, `enabled: !!hhKey || !!motherName || !!motherPhone` (`legacy:src/pages/MotherIndexDetails.tsx:64-96`). Global defaults otherwise.
  - Fires only if `district && district !== "Unknown District"`; otherwise it returns `[]` (`:83`).
  - **BUG**: `pick()` returns `"N/A"`, never `""`. So `hhKey`, `motherName` and `motherPhone` are always truthy, the query is always enabled, and a missing district calls `getChildrenByDistrict("N/A")`. The `"Unknown District"` fallback (`:36`) is unreachable.
  - Client-side matching (`:69-92`), in order:
    1. **By household** (`matchesHousehold`, `:69-75`): the child's household value is the first truthy of `household_id`, `hh_id`, `household`, `householdId`, `hhid`, `household_unique_id`, `household_uid`, `hhId`, `HH_ID`, `HHID`, `caregiverId`, `caregiver_id`, trimmed and lower-cased. It matches when it equals `hhKey`, **or either string contains the other**, or the strings left after stripping leading non-digits (`replace(/^\D+/g, "")`) are equal. If any match, those children are returned.
    2. **Else by caregiver** (`matchesCaregiver`, `:77-81`): lower-cased `caregiver_name || caregiver || full_name` equals the mother's raw name lower-cased, or `caregiver_phone || phone || contact_number` equals the mother's phone and is not `"Not Provided"`.
    3. Else `[]`.
  - **BUG**: the substring and numeric-suffix matching over-matches. For example, a short child household value such as `"1"` is contained in many IDs, and two IDs that differ only in a non-digit prefix compare equal. The rebuild should use exact household-ID equality, done in a normaliser. Backend ask: an endpoint for VCAs by household (`GET /household/members/:household_id` exists, AUDIT.md §3.2; **QUESTION** whether it can replace this).
  - **BUG**: with no phone/name, the sentinel strings `"N/A"`/`"n/a"` are compared, so they can match children whose raw value is also "N/A".
  - Matching by name/phone means PII-based linking in the browser. **QUESTION**: keep it?

### Fields used

`pick` here treats `null`, `undefined` and `""` as missing (**not** `0`) and returns `"N/A"` (`:13-19`). So every `x || "fallback"` below is dead: the fallback never shows and "N/A" shows instead.

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| householdId | `household_id`, `hh_id`, `id`, `unique_id` | Header badge `#{id}`, "Household ID" card (mono), CAs matching key, "View Household Profile" payload (`:33,116,160`) | raw |
| rawName → name | `caregiver_name`, `full_name`, `name`, `mother_name` | Never displayed. `anonymizeCaregiverName()` **always** returns `"Caregiver Name - Confidential"` (`legacy:src/lib/utils.ts:8-16`). The raw value is used only for caregiver matching (`:34-35,61`) | — |
| avatar initials | derived from `name` | 2-letter avatar. Because `name` is always the confidential label it always shows "CN"; the `"MI"` fallback is unreachable (`:107`) | upper-case |
| district | `district`, `district_name` | Header "{district} · {facility}", CAs fetch district, payloads (`:36,122`) | raw |
| facility | `facility`, `facility_name`, `health_facility` | Header line, "Facility" card (shows "N/A" if equal to "Unknown Facility") (`:37,179`) | raw |
| ward | `ward` | **Unused** (`:38`) | — |
| province | `province` | "Province" card. Rendered when truthy, i.e. **always**, showing "N/A" when missing (`:39,193-198`) | raw |
| partner | `partner`, `partner_name` | "Implementing Partner" card (`:40,186-187`) | raw |
| homeAddress | `homeaddress`, `home_address`, `address` | "Home Address" card (full width) (`:41,190-191`) | `{address}{landmark ? " · " + landmark : ""}`. **BUG**: landmark is always truthy, so " · N/A" is appended when it is missing |
| landmark | `landmark` | Appended to the address (`:42,191`) | — |
| hivStatus | `caregiver_hiv_status`, `hiv_status`, `user_select_hiv` | "HIV Status" card: rose if it includes "positive", emerald if "negative", otherwise slate (`:43,183`) | CSS capitalize |
| sex | `caregiver_sex`, `sex`, `gender` | "Gender" card (`:44,175`) | CSS capitalize |
| dob | `caregiver_birth_date`, `caregiver_birthdate`, `dob`, `date_of_birth` | "Date of Birth" card (`:45,171`) | **raw, unformatted** (inconsistent with the other dates) |
| enrolledDate | `mother_screening_date`, `anc_date`, `date_enrolled`, `registration_date`, `created_at` | "Screening Date" card with calendar icon (`:46,163-167`) | `formatDate` dd-mm-yyyy (`:21-26`) |
| lastService | `last_interacted_with`, `last_service_date`, `visit_date`, `date_updated`, `updated_at`, `modified` | Header "Last updated: {value}" (`:47,50-58,123`) | if numeric and > 1e12 → epoch ms → `toLocaleDateString("en-GB")` with `/`→`-`; else the string before `"T"` (ISO date) |
| phone | `caregiver_phone`, `phone`, `phone_number`, `contact`, `contact_number`, `mobile`, `mother_phone` | Not displayed; caregiver matching only (`:48,62`) | — |
| CA: cid | `uid \|\| vca_id \|\| unique_id \|\| id \|\| "N/A"` | "CA ID" (mono), View payload (`:228`) | raw |
| CA: isIndex | `is_index` lower-cased equals `"1"` or `"true"` | "Primary CA" amber badge (`:229,243`) | — |
| CA: hivPos | `is_hiv_positive \|\| hiv_status` includes "positive", or `is_hiv_positive` equals "yes" | "Positive" (rose) / "Negative" (emerald) badge (`:230,244`). **BUG**: unknown/missing shows as "Negative" | upper-case |

Note the register uses `mother_id` first as the record ID, while the detail page uses `household_id` first. **QUESTION**: which one is the canonical `:id`?

### Filters / sort / pagination / search
- [ ] None. The CAs list shows the first 8 (`cas.slice(0, 8)`), then "+ {n} more" (`:227,253`), with no way to see the rest. It is in API order and not sorted.

### Exports
- [ ] None.

### Charts
- [ ] None.

### Layout and copy
- [ ] Header (`:101-146`):
  - avatar (initials)
  - eyebrow "Mother profile"
  - badge "Active" (green dot; **hardcoded, always shown**; **QUESTION**)
  - badge `#{householdId}`
  - h1 "Mother Index Name — Confidential" (literal text; the name is never shown)
  - line with MapPin "{district} · {facility}"
  - line with Activity "Last updated: {lastService}"
- [ ] Card "Mother Index Details" (`:149-201`), 2-column grid, in order: "Household ID", "Screening Date", "Date of Birth", "Gender", "Facility", "HIV Status", "Implementing Partner", "Home Address" (span 2), "Province" (span 2).
- [ ] Card "CAs in this Household" (`:203-257`):
  - badge "…" while loading, or "`{n}` child"/"`{n}` children"
  - each row: user icon, "CA ID" label + id, optional "Primary CA", the HIV badge, and a "View" button with an external-link icon
- [ ] Domain terms "CA", "Primary CA", "Implementing Partner" and "Mother Index" should come from `@/config` domain terms.

### Links in / out
- [ ] In: only the register's "View" button → `navigate("/profile/mother-index-details", { state: { record } })`, where `record` is the full raw row (`legacy:src/pages/MotherIndexRegister.tsx:302`). The page also accepts a bare record as `location.state` (`legacy:src/pages/MotherIndexDetails.tsx:31`). No sessionStorage/localStorage is written. New app: route param `:id`.
- [ ] Out:
  - "View Household Profile" button, shown only when `householdId && householdId !== "N/A"` (`:128-136`).
    - It calls `navigate("/profile/household-details", { state: { id: householdId, household_id: householdId, district, ...(mother || {}) } })` (`:130`). New: `/households/:householdId`.
    - **BUG**: the raw record is spread **after** the explicit keys, so raw `id`/`household_id`/`district` values override them. For example, a raw `id` that is not the household ID becomes `state.id`, which HouseholdProfile reads first (`legacy:src/pages/HouseholdProfile.tsx:141`).
    - HouseholdProfile then writes sessionStorage `ecap_last_household_id` (`legacy:src/pages/HouseholdProfile.tsx:143`).
  - "Back to register" button → `navigate(-1)` (`:137-143`). **BUG**: on a deep link this leaves the app. The new app should link to `/mother-index`, keeping the filters from the URL.
  - Per-CA "View" → `navigate("/profile/vca-details", { state: { id: String(cid), district: child.district || district } })`. It is disabled when `cid === "N/A"` and uses `stopPropagation` (`:245`). New: `/vcas/:vcaId`. VcaProfile writes sessionStorage `ecap_last_vca_id` (`legacy:src/pages/VcaProfile.tsx:190-192`).

### Loading / empty / error
- [ ] The mother record is synchronous (from state). There is no loading or not-found state, so an empty state renders the page full of "N/A". New app: loading skeleton, plus `<EmptyState>`/not-found when the ID is not in the data.
- [ ] CAs loading: pink `<LoadingDots>` (`:216-219`). Empty: Users icon + "No CAs linked to this household." (`:220-224`).
- [ ] CAs error: **not handled**. `isError` is ignored and `cas` defaults to `[]`, so the empty text shows (`:64`). The stale IDB cache fallback in `getListFromApiWithCache` may hide errors (`legacy:src/lib/api.ts:228-236`).

### Bugs and quirks
- [ ] **BUG** The profile depends on `location.state`, so it is blank on reload or deep link (`:31`).
- [ ] **BUG** Dead `||` fallbacks after `pick()`, which returns "N/A": district, facility, province, landmark, sex, hivStatus, partner (`:36-45,171-191`). As a result the Province card always shows, " · N/A" is appended to the address, and the CAs fetch runs for district "N/A".
- [ ] **BUG** Fuzzy household matching over-matches (`:69-75`).
- [ ] **BUG** CA HIV status defaults to "Negative" when unknown (`:230,244`).
- [ ] **BUG** The spread order in the household-profile payload overrides `id` (`:130`).
- [ ] **QUESTION** The "Active" badge and the header are hardcoded (`:112-119`).
- [ ] The date of birth is shown raw while the other dates are formatted (`:171`).
- [ ] The register and the detail page use different ID key orders (motherId vs householdId).

---

## Other behaviour

- [ ] Toasts (sonner): "Mother index data refreshed." after Sync; "Register exported." after export (`legacy:src/pages/MotherIndexRegister.tsx:156,173`).
- [ ] Row expand/collapse: a +/- icon button per row toggles a sub-row "Updated: {date}" (`:183-189,290-311`). The expanded set is component state.
- [ ] Timers and polling: none in these pages. Global React Query defaults apply: `staleTime` 60s, refetch on mount/focus/reconnect (`legacy:src/App.tsx:126-131`). EtlInvalidator invalidates all non-`etl` keys (`["mothers", ...]` and `["mother-cas", ...]` included) when a new ETL run is detected (`legacy:src/components/EtlInvalidator.tsx:73-80`).
- [ ] Storage:
  - React Query persister (IndexedDB via idb-keyval, key `ecap-plus-pmp-react-query`) persists `["mothers", ...]` and `["mother-cas", ...]`, which hold raw personal health data (`legacy:src/App.tsx:140-148`). New app: `meta: { persist: false }` should be considered.
  - The auxiliary IDB cache `ecap_plus_cache_db/api_cache` holds `children_by_district:<district>` (`legacy:src/lib/indexedDbCache.ts:6-7`; `legacy:src/lib/api.ts:373-376`). Sync clears all of its entries (`legacy:src/lib/api.ts:247-251`).
  - FY state is read from localStorage `ecap_plus_pmp.fy_filter_state_v2`, or from the URL (`legacy:src/context/FyFilterContext.tsx:12,50-56`).
  - Downstream pages write sessionStorage `ecap_last_household_id` and `ecap_last_vca_id`.
- [ ] Browser APIs: `URL.createObjectURL` plus a temporary `<a download>` for the CSV (`legacy:src/lib/csv.ts:18-29`).
- [ ] No forms, mutations, modals or keyboard shortcuts.
- [ ] Brand/program strings:
  - "Caregiver Name - Confidential" (`legacy:src/lib/utils.ts:8`)
  - "Mother Index Name — Confidential" (`legacy:src/pages/MotherIndexDetails.tsx:119`)
  - "Implementing Partner" (`:186`)
  - sub-population labels "HEI Status", "HIV Positive", "On ART", "Linked" (`legacy:src/pages/MotherIndexRegister.tsx:27-32`)
  - "CAs in this Household" / "Primary CA" / "CA ID" (`legacy:src/pages/MotherIndexDetails.tsx:208,238,243`)
  - the `"ecap+ support"` role description in `legacy:src/hooks/useEffectiveDistrict.ts:8`
  - filename prefix `index-mothers-` (`legacy:src/pages/MotherIndexRegister.tsx:172`)
  - district names come from `legacy:src/constants/districts.ts` (`ALL_DISTRICTS`, `DISTRICTS_BY_PROVINCE`, `:8`)

## Open questions for the developer

1. **Detail data source**: there is no single-mother endpoint. Should `/mother-index/:id` re-use the district list query and find the record (which district? a `?district=` param or the user's scope), or should we ask the backend for `GET /mother/:id`?
2. **Canonical ID**: `mother_id` (register) or `household_id` (detail)? Can one household have several mother rows? (The backend count is `COUNT(DISTINCT household_id)`.)
3. **Count badge**: what should it show? The legacy value is inconsistent (distinct households for all districts, raw rows for one district).
4. **"Active mothers only" and "Active" badges**: the backend applies no active filter. Drop the badges or add a filter?
5. **FY**: the backend ignores `from`/`to` for mothers. Hide the FY control on this module, or ask the backend?
6. **Date filter** (30 days / 90 days / this year): it exists in code with no UI. Add it or drop it?
7. **Field mapping**: confirm the real `mothers` columns for HIV status, HEI, on-ART and linkage (legacy reads `art_status` first for "HIV Positive"). Also choose "HIV Status" vs "ART Status" as the export header.
8. **CAs linking**: replace the fuzzy household, name and phone matching with exact `household_id` equality, or with `GET /household/members/:household_id`? Keep name/phone matching at all?
9. **Scope**: should province users be restricted to their province (no national "All Districts")? This needs backend enforcement (backend ask).
10. **Persistence**: should mother rows (health PII) be excluded from the IndexedDB query persistence (`persist: false`)?
