# hts — legacy audit (part: risk-profile)

> New module `hts` · Legacy routes → new routes: `/registers/hts-risk` → `/hts/risk`; `/profile/hts-details?id=<id>` → `/hts/:clientId` (this part). `/registers/hts` → `/hts` is covered by the "register" part. · Plan: MIGRATION_PLAN.md §5 row "hts"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/HTSRiskRegister.tsx` | 353 | Route `/registers/hts-risk`: "risk" views of the HTS register (positives not on ART, pending outcomes, new positives, all). Read in full. **Unreferenced as a link target**: nothing in `src` navigates to it (see Links in). |
| `src/pages/HTSProfile.tsx` | 443 | Route `/profile/hts-details`: one HTS record shown in four tabs. Read in full. |
| `src/App.tsx` | 602 | Route registration (`:52`, `:73` lazy imports; `:292-299`, `:469-476` routes), QueryClient defaults (`:112-132`), React Query IndexedDB persister (`:140-223`). Relevant parts read. |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard (auth + forced password change only). Read in full. |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar; only the HTS register entry, nothing for these two routes. Read in full. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile nav; no HTS entry. Read in full. |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Cmd/Ctrl+K search; no HTS entry or HTS record results. Read in full. |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Shared scope hook. **Not used** by either page in this part. Read in full. |
| `src/lib/api.ts` | 1486 | `getHTSRegisterByDistrict` (`:428-440`), alias (`:442`), `getHouseholdsByDistrict` (`:301-312`), list cache (`:212-238`), `fyQs` (`:241-245`), `getListValue` (`:116-…`). Relevant parts read. |
| `src/lib/exportUtils.ts` | 29 | `escapeCsvField`, `downloadCsv`. Read in full. |
| `src/lib/utils.ts` | 64 | `toTitleCase` (`:18-21`). Relevant part read. |
| `src/components/EmptyState.tsx` | 51 | Empty state used by the profile "not found" view. Read. |
| `src/components/aceternity/LoadingDots.tsx` | 17 | Loading indicator. Read in full. |
| `src/components/EtlInvalidator.tsx` | 90 | Global ETL-completion invalidation (affects these queries). Relevant parts read. |
| `src/pages/HTSRegister.tsx` | 1271 | Grepped only, for links into this part's routes (none) and shared query keys. Covered by the "register" part. |
| `src/data/documentationArticles.ts` | 165 | Grepped: an in-app doc article describes the risk filters (`:82`). |
| `backend:controllers/householdController.js` | 551 | `getHTSRegisterByDistrict` handler (`:410-440`). Relevant part read. |
| `backend:routes/householdRoutes.js` | 72 | HTS route + stale comment (`:47-52`). Relevant part read. |

---

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
- [ ] Storage keys:
  - `sessionStorage["ecap_last_hts_record"]` — JSON of the last viewed HTS row; written `legacy:src/pages/HTSProfile.tsx:96,106`, read `:113`. **Drop** in the new app (route param + query cache).
  - IndexedDB list cache entry `households_by_district:<district|ALL>[:<from>_<to>]` written by `getHouseholdsByDistrict` for the district discovery (`legacy:src/lib/api.ts:305-308,212-238`).
  - The global React Query persister writes every successful query to IndexedDB key `ecap-plus-pmp-react-query` for 24 h (`legacy:src/App.tsx:146,216-223`), so the national HTS register (health PII) is persisted on disk. New app: HTS queries should set `meta: { persist: false }` (user-private/sensitive data) — confirm with developer.
- [ ] Timers / refetch: no page-level timers. Global `EtlInvalidator` polls every 30 s and, when a new ETL run completes, invalidates every query whose key does not start with `"etl"`, including `["hts-register", …]` and `["districts-discovery", …]` (`legacy:src/components/EtlInvalidator.tsx:28,56,77-80`). HTS data is warehouse/ETL data (`hts_register` pipeline, AUDIT.md §3.2), so new HTS queries set `meta: { etl: true }`. The HTS register page's refresh button invalidates the `["hts-register"]` prefix (`legacy:src/pages/HTSRegister.tsx:150`), which also hits this part's two keys.
- [ ] No modals, forms, mutations, toasts or keyboard shortcuts in either page.
- [ ] Unused imports: `useEffect` is used; `useEffectiveDistrict` is not imported by either page.
- [ ] Backend asks (record in PROGRESS.md): (1) `GET /household/hts-register-by-district/:district(*)` trusts the caller's district and returns the national register to any user (AUDIT.md §3.2); it should derive scope from the user. (2) There is no by-ID HTS endpoint, so the profile must download the register to show one record; a scoped `GET …/hts/:clientId` would avoid that. (3) No FY window on the HTS endpoint.

## Open questions for the developer
1. **QUESTION** Both pages call the HTS endpoint with `"*"`, which returns `[]` from the current backend (`legacy:src/pages/HTSRiskRegister.tsx:125`, `legacy:src/pages/HTSProfile.tsx:86`; `backend:controllers/householdController.js:420-431`). Confirm on the live API, then confirm the new module should send `"All Districts"` (national users) or the user's single district.
2. **QUESTION** What values do `hiv_result` / `hiv_status` actually hold (e.g. "Positive", "Reactive", "Non-reactive", "Negative", "Unknown", "Indeterminate")? Needed to write one correct classifier for the risk filters, badges and banner.
3. **QUESTION** What is the canonical client id for `/hts/:clientId`: `ecap_id` or `client_number`? Legacy displays `client_number` first but links/looks up with `ecap_id || client_number`. Are either unique?
4. **QUESTION** Should the HTS risk views be FY-scoped? Legacy keys on FY but filters nothing; the backend ignores FY; the main HTS register re-applies FY client-side (`legacy:src/pages/HTSRegister.tsx:129-140`). If yes, which date field defines the window (`date_created`? a test date?).
5. **QUESTION** What format is `date_created` in (ISO vs DD-MM-YYYY)? The "New Positives" rule relies on `parseISO` (`legacy:src/pages/HTSRiskRegister.tsx:161`).
6. **QUESTION** `/registers/hts-risk` has no inbound link. Should the new `/hts` register link to `/hts/risk?type=…` (e.g. from its "unlinked positives" count), and should `/hts/risk` get a nav entry?
7. **QUESTION** Provincial users currently see all districts on the risk register. Should they be limited to their province (as `useEffectiveDistrict` would do)?
8. **QUESTION** The masked heading says "Caregiver Name – Confidential" (`legacy:src/pages/HTSProfile.tsx:194,356`) although the tested individual may be an index client or a contact. Keep the masking text, make it a config domain term, or use a neutral "Name – Confidential"?
9. **QUESTION** Should HTS query results be excluded from the persisted query cache (`meta: { persist: false }`) given they are health PII?
