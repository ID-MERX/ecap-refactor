# households — legacy audit

> Legacy routes → new routes: `/households` → `/households`; `/households/archived` → `/households/archived`; `/registers/household-risk` → `/households/risk`; (`/profile/household-details` → `/households/:householdId` is covered by the profile part) · Plan: MIGRATION_PLAN.md §5 row "households" ("Pilot module (Phase 4). Profile ≈2,000 lines → split into tabs/sections")  · *part `registers`*
> This part covers the three **list** pages: the active register (`HouseholdRegister`, the Phase 4 pilot), the archived register (`HouseholdArchivedRegister`) and the household domain-gap ("risk") register (`HouseholdRiskRegister`). The household profile page is in the other part of this module. Phase 4 "done" criteria (MIGRATION_PLAN.md §Phase 4): columns, filters incl. sub-populations, export contents, filter state in URL, global search by name or ID.
> Legacy routes → new routes: `/profile/household-details` → `/households/:householdId` (this part only; `/households`, `/households/archived` and `/registers/household-risk` are covered by the other households parts) · Plan: MIGRATION_PLAN.md §5 row "households"  · *part `profile`*
> Merged from the step-3 drafts: `registers`, `profile`. Content is carried over verbatim; only heading levels, the merged header and the shared Legacy files table were consolidated.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/HouseholdRegister.tsx` | 612 | `/households` active register (pilot). Read in full. |
| `src/pages/HouseholdArchivedRegister.tsx` | 785 | `/households/archived` archived (de-registered) register. Read in full. |
| `src/pages/HouseholdRiskRegister.tsx` | 405 | `/registers/household-risk` domain-gap register. Read in full. **Orphan route**: no inbound link anywhere in `src` (see Links in). |
| `src/components/dashboard/SubPopulationFilter.tsx` | 67 | All/Yes/No segmented toggles per sub-population, used by the active and archived registers. Read in full. |
| `src/lib/data-validation.ts` | 70 | `isCategoryProvided` (domain-coverage test used by the risk register). Read in full. |
| `src/lib/utils.ts` | 64 | `toTitleCase`, `toSentenceCase`, `cn`. Read in full. |
| `src/App.tsx` | 602 | Route table, QueryClient defaults, IndexedDB persister. Read in full. |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard. Read in full. |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar nav + visibility filter. Read in full. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile bottom nav. Read in full. |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Cmd/Ctrl+K palette (nav entries + household records). Read in full. |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Scope hook. Read in full. **Not used** by any of the three register pages. |
| `src/context/FyFilterContext.tsx` | 122 | Global FY filter (`resolved.fromDate/toDate/mode`). Read in full. |
| `src/lib/api.ts` | 1486 | Read the relevant parts: `DEFAULT_DISTRICT` `:7`, TTLs `:8-14`, `getListValue` `:116-183`, `dqaGet` `:185-210`, `getListFromApiWithCache` `:212-238`, `fyQs` `:240-245`, `getHouseholdsByDistrict` `:301-312`, `getHouseholdArchivedRegister` `:319-339`, `getHouseholdServicesByDistrict` `:419-426`. |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Read `:20-95` (mobile sheet menu entries, subtitle pass-through). |
| `src/components/dashboard/DashboardHeader.tsx` | 539 | Read `:24-43,76-90,238-239` (search + FY filter visibility, subtitle). |
| `src/pages/Districts.tsx` | 585 | Read `:85-160,490-510` (inbound link with `?district=`). |
| `src/components/dashboard/MetricsGrid.tsx` | 252 | Read `:105-115,205-230` (Households KPI card links to `/households`). |
| `src/pages/HouseholdProfile.tsx` | 1964 | Read `:130-160,430-445` only (how the target page reads the ID; "Back to Register" link). Full audit in the profile part. |
| `src/pages/FlaggedRecordForm.tsx` | 240 | Read `:115-128` ("Go to Households" link). |
| `src/pages/HouseholdServices.tsx` | 11 | Grepped (target of the risk register's back button). |
| `src/components/EtlInvalidator.tsx`, `src/lib/indexedDbCache.ts`, `src/lib/fiscalYear.ts` | 90 / 92 / 84 | Grepped for cache store names, invalidation predicate and FY date format. |
| `backend:controllers/etlController.js` | — | Grepped `:1476-1486,1545-1556` to check which tables carry the sub-population columns. |
| `src/lib/directus.ts` | 869 | Partial: `listUsers` `:79-100`, `createNotification` `:514-527`, flag notification helpers `:635-709`. |
| `src/lib/indexedDbCache.ts` | 92 | Partial: DB and store names `:6-7`. |
| `src/components/EmptyState.tsx` | 51 | Partial: props `title`, `description`, `action`. |
| Inbound callers (context only) | — | `GlobalSearch.tsx:150-158`, `HouseholdRegister.tsx:511,541-547`, `HouseholdArchivedRegister.tsx:636-640,698-705`, `HouseholdRiskRegister.tsx:375-380`, `CaregiverRiskRegister.tsx:132,173,354-360`, `Flags.tsx:167-169,393`, `CaseworkerProfile.tsx:187-192,381-384`, `MotherIndexDetails.tsx:33,128-131`, `VcaProfile.tsx:188-196,536-555`. |

## Contents

- [the registers](#part-registers)
- [the profile page](#part-profile)

<a id="part-registers"></a>

## Part: the registers

## Route `/households` → `/households`

### Purpose
The active household register (pilot). Downloads the **whole national** active register once, then filters, searches, sorts, paginates and exports entirely on the client. Header subtitle `"Household Register"` (`legacy:src/pages/HouseholdRegister.tsx:314`).

Hero block (`legacy:src/pages/HouseholdRegister.tsx:316-383`):
- Eyebrow `"Household register"` · today's date · badge `"<n> records"` where n = filtered row count, `toLocaleString()` (`:325-332`). Date format: `toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })` (`:308-310`) → must go through `core/lib/format.ts`.
- Title `"Active households"` with badge `"Caregivers · Members · Services"` (`:334-341`).
- Description `"Only active caregivers shown. Use the filters to drill down by sub-population, facility, or caseworker."` (`:342-344`). (Facility and caseworker are only searchable, not separate filters.)
- Right side: district select + `"Export CSV"` button (`:347-381`).

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:268-275`). `ProtectedRoute` redirects to `/` when there is no user and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:12-18`).
- [ ] Sidebar: section `"Registers"` → item `{ title: "Households", url: "/households" }` (`legacy:src/components/dashboard/AppSidebar.tsx:56-58`). No visibility rule applies; the filter only touches `/districts` for district users, the `"Admin"` section and the `"Data Pipeline"` section (`legacy:src/components/dashboard/AppSidebar.tsx:166-173`). Active state is exact `pathname === url` (`:183`).
- [ ] Mobile bottom nav: `{ label: "Registers", url: "/households" }` (`legacy:src/components/dashboard/MobileBottomNav.tsx:8`), no visibility rule. Mobile sheet menu: `{ title: "Household Register", url: "/households" }` (`legacy:src/components/dashboard/DashboardLayout.tsx:36`), no rule.
- [ ] Global search nav entry: `{ title: "Household Register", url: "/households", category: "Navigation" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:36`), no rule.
- [ ] Header: the global search box and FY filter are shown on this route (it is not in `HIDDEN_ROUTES`, `legacy:src/components/dashboard/DashboardHeader.tsx:35-43,84-86`).
- [ ] In-page role checks (all compare free-text profile strings; must become `can()`/scope in the rebuild):
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/HouseholdRegister.tsx:83`)
  - `const isProvincialUser = user?.description === "Provincial User";` (`:84`)
  - `const userProvince = user?.title;` (`:85`)
  - `const lockedDistrict = isDistrictUser && user?.location ? user.location : null;` (`:88`)
  - District select `disabled={!!lockedDistrict}` and `onValueChange` ignores changes when locked (`:350-354`); the `"All Districts"` option is rendered only when `!lockedDistrict` (`:364-366`).
  - Effect re-forces `selectedDistrict = lockedDistrict` whenever `lockedDistrict` changes (`:95-99`).
  - Provincial users: district options limited to rows with `h.province === userProvince` (`:123`) and rows filtered by `household.province !== userProvince` → excluded (`:154-156`). Exact, case-sensitive comparison.
  - District chip is hidden for locked users (`:437`).
- [ ] Data scope: the API is always called with district `""` → `GET /household/all-households/` → national register for **every** user (`legacy:src/pages/HouseholdRegister.tsx:111`). District and province scoping is purely client-side (`:141-164`). `useEffectiveDistrict` is not used. Initial district = `lockedDistrict ?? (searchParams.get("district") || "All")` (`:90-92`). **Backend ask:** `/household/all-households/:district(*)` trusts the caller's district and no data controller applies user scope (AUDIT.md §3.1 "User scope"); district/provincial users currently receive the national register.

### Endpoints
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2)
  - Wrapper `getHouseholdsByDistrict("", fyArg)` (`legacy:src/lib/api.ts:301-312`), called at `legacy:src/pages/HouseholdRegister.tsx:111`.
  - Path sent: `/household/all-households/` (empty district, `encodeURIComponent("")`) plus `?from=YYYY-MM-DD&to=YYYY-MM-DD` only when both FY dates exist (`legacy:src/lib/api.ts:240-245`). `fyArg = fy.fromDate && fy.toDate ? { from, to } : undefined` (`legacy:src/pages/HouseholdRegister.tsx:103`). FY "All time" → no `from`/`to` (`legacy:src/context/FyFilterContext.tsx:24`).
  - Fires on mount, no `enabled` condition (`legacy:src/pages/HouseholdRegister.tsx:109-113`).
  - React Query key `["households", "All", fyKey]` where `fyKey = fy.mode === "all" ? "all" : "<fromDate>_<toDate>"` (`:104,110`). District is **not** in the key (district is a client-side filter).
  - `staleTime: 1000 * 60 * 10` (10 min) (`:112`); global defaults otherwise: `gcTime` 24 h, `retry: 1`, refetch on mount/focus/reconnect, persisted to IndexedDB for 24 h (`legacy:src/App.tsx:112-148,213-224`).
  - Extra layer: IndexedDB list cache key `households_by_district:ALL` (+ `:<from>_<to>` when FY) with 60 s TTL; on fetch error a stale cached list is returned silently (`legacy:src/lib/api.ts:14,212-238,305-311`). Response unwrapped by `getListValue` (first array in `data`/known keys, `legacy:src/lib/api.ts:116-183`).
  - Invalidated by `EtlInvalidator` after a successful ETL run (predicate: every query whose key[0] ≠ `"etl"`, `legacy:src/components/EtlInvalidator.tsx:75-79`) → new module sets `meta: { etl: true }`.
  - Client-side post-processing: province guard, district-variant match, search, sub-population filters, sort (see Filters).
  - **QUESTION:** the full national register is persisted to IndexedDB (React Query persister and the list cache). Rows include caregiver name/phone (AUDIT.md §3.2 column table). Should the new query set `meta: { persist: false }`?

### Fields used
| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| `householdId` | table/View: `household_id`, `householdId` → `"N/A"` (`legacy:src/pages/HouseholdRegister.tsx:511`); sort: `household_id`, `householdId`, `id` → `""` (`:195-196`); search: `household_id`, `householdId`, `hh_id`, `id` (`:170`); export: `household_id` only (`:256`) | HH ID column, mobile cell, View navigation payload, sort, search, export | bold chip; mobile: mono 10px |
| `homeAddress` | `homeaddress` (`:298`) | "Household details" line `Address: …`; search; export "Home Address" | — |
| `facility` | `facility` (`:299,526`) | details line `Facility: …`; mobile cell (fallback text `"No Facility"`); search; export | mobile: italic, truncated 140px |
| `province` | `province` (`:300`) | details line `Province: …`; provincial guard (`:123,154`); export | — |
| `district` | `district` (`:301`, `:121`, `:162`) | details line `District: …`; district options (Title Case); district filter; search; export | options: `toTitleCase(raw.trim())` |
| `ward` | `ward` (`:302`) | details line `Ward: …`; search; export | — |
| `caseworkerName` | table: `caseworker_name`, `cwac_member_name` → `"N/A"` (`:529,539`); search: `caseworker_name` (`:171`); export: `caseworker_name` only (`:262`) | "Case worker" column; mobile `CW: <name>`; search; export | — |
| `screened` | `screened` (`:263`) | export only | raw |
| `lastServiceDate` | `last_service_date` (`:264`) | export only | raw (no date formatting) |
| sub-populations `calhiv`, `hei`, `cwlhiv`, `agyw`, `csv`, `cfsw`, `abym` | same key (no mapping; `filterKeyToDataKey` is empty, `:57-59,184`) | sub-population filters only (not shown, not exported) | — |

- [ ] "Household details" cell = non-empty parts of `Address: <homeaddress>`, `Facility: <facility>`, `Province: <province>`, `District: <district>`, `Ward: <ward>` joined with `"\n"` (`legacy:src/pages/HouseholdRegister.tsx:296-306`), clamped to 2 lines (`:534`).

### Filters / sort / pagination / search
- [ ] **District select** (`legacy:src/pages/HouseholdRegister.tsx:348-371`): options `"All Districts"` (value `All`, hidden for locked users) + districts derived from the loaded data: each raw `district` is grouped under `toTitleCase(raw.trim())`, list sorted alphabetically (`:116-138`). Provincial users only see districts of rows where `province === user.title` (`:123`). Placeholder `"Select District"`. Default: locked district, else URL `?district=`, else `All` (`:90-92`). Filter: row kept when `String(district).trim()` is one of the raw variants of the chosen display name (`:146-149,161-164`). Read from URL `district` on mount only; **never written back** to the URL. Applies to table, count badge and export (export filename too).
- [ ] **Sub-population filters** (`SubPopulationFilter`, `legacy:src/pages/HouseholdRegister.tsx:425-430`): card titled `"Sub-population"` (`legacy:src/components/dashboard/SubPopulationFilter.tsx:19-21`); one row per label with a 3-way toggle `all | yes | no` (rendered uppercase, `:37-57`); active `yes` green, active `no` red (`:39-45`). Labels in order (`legacy:src/pages/HouseholdRegister.tsx:45-53`):
  - `calhiv` → `"CALHIV"`, `hei` → `"HEI"`, `cwlhiv` → `"CWLHIV"`, `agyw` → `"AGYW"`, `csv` → `"C/SV"`, `cfsw` → `"CFSW"`, `abym` → `"ABYM"`.
  - Default `"all"` for each (`:78-80`). Combined with AND (`:181`).
  - `yes` matches `"1"`, `"true"`, `1`, `true`; `no` matches `"0"`, `"false"`, `0`, `false`, `null`, `undefined` (`:187-189`). Any other value (e.g. `""`, `"Yes"`, `"TRUE"`) matches neither.
  - Not persisted (no URL, no storage). Applies to table, count and export.
  - Labels/keys are sub-population config → must come from `@/config` (program config).
- [ ] **Search** input, placeholder `"Search by ID, facility, or caseworker…"` (`:394-399`). Initial value from URL `?search=` (`:76`), never written back. Case-insensitive substring (`toString().toLowerCase().includes(q)`) over: `household_id`, `householdId`, `hh_id`, `id`, `homeaddress`, `facility`, `district`, `ward`, `caseworker_name` (`:167-178`). No trim, no debounce (filters on every keystroke).
- [ ] **Clear** button (`:401-421`): shows a count badge = number of non-`all` sub-population filters + 1 if search is set; disabled when 0. Resets search and all sub-population filters (`:241-246`). It does **not** reset the district.
- [ ] **Active filter chips** (`:433-481`): label `"Active"`, then chips `District: <name>` (only when not `All` and not locked; click → `All`), `<LABEL>: <yes|no>` per sub-population (click → `all`), `Search: "<q>"` (click → clears). Each chip clears only itself.
- [ ] **Sort:** fixed, descending by ID string: `idB.localeCompare(idA)` on `household_id || householdId || id` (`:194-198`). No sortable columns.
- [ ] **Pagination:** client-side, fixed 50 rows/page (`ITEMS_PER_PAGE = 50`, `:43`), no page-size selector, page not in URL. Reset to page 1 when search, sub-population filters or district change (`:210-212`). Footer `"Showing <start> to <end> of <total> entries"` (`:563-567`). Page buttons: Previous / numbers / Next, 5-slot window with ellipses (`:219-234,569-603`), hidden when ≤ 1 page.
- [ ] FY filter (header, global): changes the query key and refetches; applied server-side through `from`/`to`.

### Exports
- [ ] **CSV**, button `"Export CSV"` in the hero, disabled when 0 rows (`legacy:src/pages/HouseholdRegister.tsx:373-380`). Hand-built, no library (`:251-293`).
  - Rows: **all filtered rows** (all pages; district, province guard, search and sub-population filters applied) in the current sort order (`:271`).
  - Columns in order (header → source key, raw value, `null`/`undefined` → empty) (`:255-265`):
    1. `Household ID` → `household_id`
    2. `Home Address` → `homeaddress`
    3. `Facility` → `facility`
    4. `Province` → `province`
    5. `District` → `district`
    6. `Ward` → `ward`
    7. `Case Worker` → `caseworker_name`
    8. `Screened` → `screened`
    9. `Last Service Date` → `last_service_date`
  - Every cell quoted, `"` doubled (`:267`); rows joined with `\n`; UTF-8 BOM prepended for Excel (`:282`).
  - Filename `households_${districtLabel}_${dateLabel}.csv`, `districtLabel = "all_districts"` for `All` else the district with whitespace → `_`; `dateLabel = new Date().toISOString().slice(0, 10)` (UTC date) (`:277-280`).
  - No toast; errors only `console.error("Error exporting CSV:", …)` (`:290-292`). No PDF/XLSX.

### Charts
- [ ] None. Only the hero badge `"<n> records"` (filtered count) (`legacy:src/pages/HouseholdRegister.tsx:331`).

### Links in / out
- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:58`), mobile bottom nav (`legacy:src/components/dashboard/MobileBottomNav.tsx:8`), mobile sheet menu (`legacy:src/components/dashboard/DashboardLayout.tsx:36`), global search nav (`legacy:src/components/dashboard/GlobalSearch.tsx:36`), Dashboard "Households" KPI card `to: "/households"` (`legacy:src/components/dashboard/MetricsGrid.tsx:218`, click `navigate(to)` `:112`), Districts row "View" → `/households?district=${encodeURIComponent(data.district)}` where `data.district` is the Title-Cased name (`legacy:src/pages/Districts.tsx:89,155,499-502`), FlaggedRecordForm "Go to Households" (`legacy:src/pages/FlaggedRecordForm.tsx:123`), HouseholdProfile not-found "Back to Register" (`legacy:src/pages/HouseholdProfile.tsx:438-439`). Query params consumed: `district`, `search` (no inbound link uses `search`). No `location.state`, no storage written before navigating.
- [ ] Out: row "View" → `navigate("/profile/household-details", { state: { id: String(id) } })` (`legacy:src/pages/HouseholdRegister.tsx:545-547`). The target reads `location.state.id || ?id`, then writes/reads sessionStorage `ecap_last_household_id` (`legacy:src/pages/HouseholdProfile.tsx:141-147`). Rebuild: link to `/households/:householdId` (route param).

### Loading / empty / error
- [ ] Loading: `LoadingDots` centred in a full-width table row while `isLoading` (`legacy:src/pages/HouseholdRegister.tsx:495-502`).
- [ ] Empty: table row `"No households found matching criteria."` (`:503-508`).
- [ ] Error: not handled. A failed query leaves `data` undefined and shows the empty text; the list cache may silently serve stale data instead (`legacy:src/lib/api.ts:229-236`). Rebuild: `<ErrorState>` with retry.

### Bugs and quirks
- [ ] **BUG** District users and provincial users download the whole national register; scoping is UI-only (`legacy:src/pages/HouseholdRegister.tsx:111,141-164`). Port as scope-aware query (scope in key) and log as a backend ask.
- [ ] **BUG** District variants are stored untrimmed (`variants.push(raw)`, `:129`) but compared against the trimmed row value (`:162-163`), so rows whose `district` has leading/trailing whitespace never match a selected district.
- [ ] **BUG** "Household details" joins parts with `"\n"` but renders in a normal `div` (no `white-space: pre-line`), so the lines collapse into one run of text (`:296-306,534-536`).
- [ ] **BUG** Errors are shown as "No households found" (no error state) (`:495-508`).
- [ ] **BUG** The page is not reset when the FY changes (reset deps omit FY, `:210-212`); if the new result has fewer pages the table body renders empty with no message.
- [ ] **BUG** The ID used for the View link (`household_id`, `householdId` → `"N/A"`, `:511`) differs from the sort/search candidates (`hh_id`, `id` too); a row with only `id` navigates with `"N/A"`.
- [ ] **QUESTION** Sub-population columns on `all_households`: the backend never references `calhiv`, `hei`, `agyw`, `csv`, `cfsw` or `abym` on `all_households`; `calhiv`/`hei`/`cwlhiv` exist on `children` (`backend:controllers/etlController.js:1476-1486`) and household-level CWLHIV is derived from `caregiver_hiv_status` (`backend:controllers/etlController.js:1552`). If the columns are absent, `yes` matches nothing and `no` matches everything. Confirm against a real response / fixture.
- [ ] **QUESTION** Sub-population `yes` only accepts `"1"`/`"true"`/1/true; backend counts also accept `ILIKE 'true'` / `ILIKE 'yes'` (`backend:controllers/etlController.js:1481`). Should `"Yes"`/`"TRUE"` count as yes in the normaliser?
- [ ] Quirk: Clear button ignores the district; the district chip is the only way back to "All" besides the select (`:241-246,437-443`).
- [ ] Quirk: on narrow screens the header shows only "Action" while the body shows the combined mobile cell + action (no mobile header cell) (`:488-491,522-532`).
- [ ] Quirk: export uses `household_id`/`caseworker_name` only, while the table falls back to `householdId`/`cwac_member_name` (`:256,262` vs `:511,539`). Rebuild: export the normalised fields.
- [ ] Quirk: the effect that re-enforces the lock lists only `[lockedDistrict]` as deps (`:95-99`).

---

## Route `/households/archived` → `/households/archived`

### Purpose
Archived (closed, de-registered/graduated) households. Same layout as the active register plus a de-registration-reason filter applied **server-side**. Header subtitle `"Household Archived Register"` (`legacy:src/pages/HouseholdArchivedRegister.tsx:384`).

Hero (`legacy:src/pages/HouseholdArchivedRegister.tsx:386-460`): eyebrow `"Archived households"` · date (same `en-GB` long format, `:376-381`) · badge `"Deregistered ─ <n> records"` (`:400-406`); title `"Graduated & exited households"` with badge `"Closed cases"` (`:408-418`); description `"Households that have been deregistered or graduated out of the programme."` (`:419-422`); district select + `"Export CSV"` (`:424-458`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:389-396`).
- [ ] Sidebar: section `"Archived"` → `{ title: "Households", url: "/households/archived" }` (`legacy:src/components/dashboard/AppSidebar.tsx:70-72`), no visibility rule (`:166-173`). Not in the mobile bottom nav. Mobile sheet menu: `"Household Archived Register"` (`legacy:src/components/dashboard/DashboardLayout.tsx:41`). Global search nav: `{ title: "Household Archived", url: "/households/archived" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:41`). Header search + FY filter shown (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43`).
- [ ] In-page role checks:
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/HouseholdArchivedRegister.tsx:87`)
  - `const isProvincialUser = user?.description === "Provincial User";` (`:88`); `const userProvince = user?.title;` (`:89`)
  - `const lockedDistrict = isDistrictUser && user?.location ? user.location : null;` (`:93-94`)
  - Select disabled / changes ignored when locked; `"All Districts"` hidden when locked (`:427-442`); lock re-enforced by effect (`:101-105`).
  - Provincial guard on district options (`:143-144`) and rows (`:173-179`), exact `province !== userProvince`.
- [ ] Data scope: always `getHouseholdArchivedRegister("", …)` → national archive (`:129`); district and province scoping client-side only. Initial district = `lockedDistrict ?? "All"` (`:96-98`) — **no** `?district=` URL support (unlike the active register). `useEffectiveDistrict` not used.

### Endpoints
- [ ] `GET /household/all-households-archived/:district(*)` (AUDIT.md §3.2)
  - Wrapper `getHouseholdArchivedRegister("", { de_registration_reason, fy })` (`legacy:src/lib/api.ts:319-339`), called at `legacy:src/pages/HouseholdArchivedRegister.tsx:128-133`.
  - Path `/household/all-households-archived/` + query `de_registration_reason=<option>` only when the reason filter ≠ `all`, and `from`/`to` only when both FY dates exist (`legacy:src/lib/api.ts:323-337`).
  - Fires on mount and whenever the reason or FY changes; no `enabled` condition.
  - Key `["households", "archived", "All", graduationFilter, fyKey]` (`legacy:src/pages/HouseholdArchivedRegister.tsx:127`); `staleTime` 10 min (`:134`). No IndexedDB list cache (plain `dqaGet`, `legacy:src/lib/api.ts:337`), but persisted by the React Query persister.
  - Server applies the reason filter as an exact, case-sensitive match (AUDIT.md §3.2 detail block).
  - Client post-processing: province guard, district, search, sub-population filters, sort.

### Fields used
| Field (normalised) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| `householdId` | table/View: `household_id`, `householdId`, `hh_id`, `id` → `"N/A"` (`legacy:src/pages/HouseholdArchivedRegister.tsx:636-641`); sort: `household_id`, `householdId`, `id` (`:221-222`); search: `household_id` (`:190`); export: `household_id` (`:299`) | HH ID, mobile cell, View payload, search, export | chip |
| `homeAddress`, `facility`, `province`, `district`, `ward` | same raw keys (`:364-374`) | "Household details" (same `Address:/Facility:/Province:/District:/Ward:` format as active, 10px text), filters, export | — |
| `caseworkerName` | `caseworker_name` (`:193,305`) | search and export only (no caseworker column on this page) | — |
| `archivedOn` | table: `de_registration_date`, `archived_on`, `date_archived`, `updated_at` → `"N/A"` (`:659-664,681-686`); export: `de_registration_date`, `archived_on`, `archivedOn`, `date_archived`, `updated_at` → `"N/A"` (`:320-327`) | "Archived on" column (lg+), mobile `Archived: <date>`, export | raw string, no date formatting |
| `reason` | table: `de_registration_reason`, `reason`, `archived_reason` → `"N/A"` (`:667-671,690-694`); export: `de_registration_reason`, `reason`, `archived_reason`, `case_status`, `status` → `"N/A"` (`:311-318`) | "Reason" column (md+, amber text), mobile cell (amber, truncated), export | — |
| sub-populations | `calhiv`, `hei`, `cwlhiv`, `agyw`, `csv`, `cfsw`, `abym` (`:52-60,202`) | filters only | — |

### Filters / sort / pagination / search
- [ ] **District select**: identical behaviour to the active register (options from data, Title Case grouping, provincial limit, `"All Districts"`, placeholder `"Select District"`) (`legacy:src/pages/HouseholdArchivedRegister.tsx:138-160,166-184,425-449`). Not read from or written to the URL.
- [ ] **Reason ("graduation") select** (`:480-502`): trigger icon GraduationCap, text `"All reasons"` or the chosen option. Options: `"All reasons"` (value `all`) then, exactly (`:64-73`):
  1. `"Graduated (Household has met the graduation benchmarks in ALL domains)"`
  2. `"Exited without graduation"`
  3. `"Transferred to other OVC program"`
  4. `"Lost to follow-up"`
  5. `"Passed on"`
  6. `"Aging without transition plan"`
  7. `"Moved (Relocated)"`
  8. `"Other"`
  - Default `all` (`:116`). Sent to the API as `de_registration_reason` (server-side). Not persisted. Applies to table, count and export (export only contains what the server returned).
  - These values are program-specific (de-registration reasons) → put in program config, not hardcoded.
- [ ] **Sub-population filters**: same labels, defaults and yes/no matching as the active register (`:52-60,111-115,198-216,529-534`).
- [ ] **Search**, placeholder `"Search by ID, facility, or caseworker…"` (`:473-478`). Case-insensitive substring over `household_id`, `homeaddress`, `ward`, `caseworker_name`, `facility` (`:187-196`) — **not** `district` (unlike active). Not read from URL. No debounce.
- [ ] **Clear** button (`:503-526`): count = non-`all` sub-populations + 1 if reason ≠ `all` + 1 if search + 1 if district ≠ `All` and not locked. Click resets search, sub-populations and reason (`:283-292`) — **not** the district.
- [ ] **Chips** (`:537-592`): `District: <name>` (not locked), `<LABEL>: <yes|no>`, `Reason: <reason>`, `Search: "<q>"`; each clears itself.
- [ ] **Sort**: descending ID string (`:220-224`). No sortable columns.
- [ ] **Pagination**: client-side, 50/page (`:50`), reset on search/sub-population/reason/district change (`:237-239`), same footer text and page-number window (`:248-277,720-777`).

### Exports
- [ ] **CSV**, button `"Export CSV"` (hero), disabled when 0 rows (`legacy:src/pages/HouseholdArchivedRegister.tsx:450-457`). Rows: all filtered rows (`:337-339`).
  - Columns in order (`:298-308`):
    1. `Household ID` → `household_id`
    2. `Home Address` → `homeaddress`
    3. `Facility` → `facility`
    4. `Province` → `province`
    5. `District` → `district`
    6. `Ward` → `ward`
    7. `Case Worker` → `caseworker_name`
    8. `Archived On` → first of `de_registration_date`, `archived_on`, `archivedOn`, `date_archived`, `updated_at`, else `"N/A"`
    9. `Reason` → first of `de_registration_reason`, `reason`, `archived_reason`, `case_status`, `status`, else `"N/A"`
  - Other columns: `row[key] ?? ""` (`:329`). All cells quoted, `"` doubled, BOM (`:332-351`).
  - Filename `archived_households_${districtLabel}_${dateLabel}.csv` (same label rules as active, UTC date) (`:342-347`).
  - Errors: `console.error("Error exporting data:", …)` only (`:359-361`).

### Charts
- [ ] None; hero badge shows filtered count (`legacy:src/pages/HouseholdArchivedRegister.tsx:404-405`).

### Links in / out
- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:72`), mobile sheet menu (`legacy:src/components/dashboard/DashboardLayout.tsx:41`), global search nav (`legacy:src/components/dashboard/GlobalSearch.tsx:41`). No other inbound links; no query params or state consumed.
- [ ] Out: row "View" → `navigate("/profile/household-details", { state: { id: String(id) } })` (`legacy:src/pages/HouseholdArchivedRegister.tsx:701-705`). Rebuild: `/households/:householdId` (the profile must also find archived households; the profile part covers how it falls back to the archived endpoint).

### Loading / empty / error
- [ ] Loading: `LoadingDots` row (`legacy:src/pages/HouseholdArchivedRegister.tsx:617-624`); changing the reason creates a new key, so the spinner shows again (no `keepPreviousData`).
- [ ] Empty: `"No archived households found matching the criteria."` (`:625-633`).
- [ ] Error: not handled (shown as empty).

### Bugs and quirks
- [ ] **BUG** Search calls `.toLowerCase()` directly on the field (`household.household_id?.toLowerCase()`, `:190-194`); a non-string value (e.g. numeric ID) throws and crashes the page. Normalise to strings.
- [ ] **BUG** Clear counts an active district (`:509`) but does not reset it (`:283-292`); with only a district selected the enabled Clear button does nothing.
- [ ] **BUG** Same untrimmed-variant district match bug as the active register (`:150-151` vs `:182-183`).
- [ ] **BUG** National data for scoped users; errors shown as empty (same as active).
- [ ] **BUG** Export "Reason" falls back to `case_status`/`status` (`:316-317`), so a blank reason exports `"Closed"` while the table shows `"N/A"`.
- [ ] **QUESTION** Are the eight reason options exactly the stored `de_registration_reason` values? The backend match is exact and case-sensitive, so any mismatch returns 0 rows (AUDIT.md §3.2). Households with status "Inactive" appear in neither register (AUDIT.md §3.2).
- [ ] **QUESTION** Archived-on date shown raw; backend may return an ISO timestamp or `DD-MM-YYYY` text (AUDIT.md §3.1 FY section). Normaliser should parse both and format through config.
- [ ] Quirk: `graduationFilter` is in the `useMemo` deps but not used client-side (`:231`).
- [ ] Quirk: no Case worker column, although search and export use `caseworker_name`.

---

## Route `/registers/household-risk` → `/households/risk`

### Purpose
"Household stability registry": lists active households that are **missing** a service domain (Health / Schooled / Safe / Stable) or, for `graduation_path`, households that have received all four. Computed client-side by joining the active register with all household service rows. Header subtitle `"Household stability registry"` (`legacy:src/pages/HouseholdRiskRegister.tsx:239`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:341-348`).
- [ ] Nav: **none.** No sidebar, mobile nav, mobile sheet menu or global-search entry (grep of `src` for `household-risk` finds only `legacy:src/App.tsx:342`). Reachable by typing the URL only.
- [ ] In-page role checks:
  - Initial district: `(user?.description === "District User" && user?.location) ? user.location : (searchParams.get("district") || "All")` (`legacy:src/pages/HouseholdRiskRegister.tsx:63-65`).
  - Effect: `if (user?.description === "District User" && user?.location && selectedDistrict !== user.location) setSelectedDistrict(user.location)` (`:75-79`).
  - District select `disabled={user?.description === "District User"}` (`:285`), but the `"All districts"` option is always listed (`:291`).
  - **No provincial restriction** on this page (no `Provincial User` check at all).
- [ ] Data scope: both queries send `""` (national) (`:89,116`); district filtering client-side.

### Endpoints
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) — `getHouseholdsByDistrict("", fyArg)` (`legacy:src/pages/HouseholdRiskRegister.tsx:87-91`). Key `["hh-districts-discovery-reg", fyKey]`, `staleTime` 30 min. Same `from`/`to` and list cache (`households_by_district:ALL[:from_to]`, 60 s) as the active register. Used both for the district list and as the household population.
- [ ] `GET /household/household-services-by-district/:district(*)` (AUDIT.md §3.2) — `getHouseholdServicesByDistrict("")` (`legacy:src/pages/HouseholdRiskRegister.tsx:114-118`; wrapper `legacy:src/lib/api.ts:419-426`). Key `["hh-services-risk-reg", "All", fyKey]`, `staleTime` 10 min. FY is in the key but **not sent** (comment `:113` "services aren't FY-aware yet"). IndexedDB list cache `household_services_by_district:ALL`, 5 min TTL (`legacy:src/lib/api.ts:8,421-425`). Unbounded national service rows.
- [ ] Both fire on mount; `isLoading = servicesQuery.isLoading || hhListQuery.isLoading` (`:120`).
- [ ] Rebuild note: share the active-register `queryOptions` for the household list (same cache entry) instead of a separate key.

### Gap computation (`legacy:src/pages/HouseholdRiskRegister.tsx:124-206`)
- [ ] `selectedVariants` = raw variants of the chosen Title-Cased district (`:129`).
- [ ] Services grouped by `String(s.household_id || s.hh_id || s.hhid || s.id || "unknown").trim()`; services whose `district` (untrimmed) is not in the variants are dropped when a district is selected (`:132-140`).
- [ ] Population = active-register rows whose `district` is in the variants (or all) (`:143-146`); ID `String(h.household_id || h.hh_id || h.hhid || h.id).trim()` (`:152`).
- [ ] Per household, over **all** its service rows (no date window): `hasHealth = isCategoryProvided(s, "health_services")`, likewise `schooled_services`, `safe_services`, `stable_services` (`:161-165`). `hh_level_services` and `other_*` columns are ignored.
- [ ] `isCategoryProvided` (`legacy:src/lib/data-validation.ts:10-70`): falsy → false; strings starting `[`/`{` are JSON-parsed; arrays → true if any element (trimmed, lower-cased) is not one of `not applicable`, `none`, `null`, `n/a`, `na`, `no`, `false`, `0`, `""`; scalars → true unless (trimmed, lower-cased) empty or one of `not applicable`, `n/a`, `na`, `none`, `no`, `false`, `0`, `[]`, `{}`, `null`; JSON parse failure → same scalar test on the raw string. Port as a tested pure helper in `model/`.
- [ ] `isActive` = any `service_date` (`parseISO`) after `now − 90 days` (`:128,167-168`).
- [ ] Inclusion by `type`: `health_domain` → `!hasHealth`; `schooled_domain` → `!hasSchooled`; `safe_domain` → `!hasSafe`; `stable_domain` → `!hasStable`; `graduation_path` → all four (`:171-178`).
- [ ] Row = `{ household_id, district: h.district || "Unknown", last_service_date: h.last_service_date || "N/A", domain_count (0–4), has_health, has_schooled, has_safe, has_stable, is_active, raw_household }` (`:181-192`). No explicit sort (register order).

### Fields used
| Field | Raw keys tried | Where shown | Formatting |
| --- | --- | --- | --- |
| `householdId` | households: `household_id`, `hh_id`, `hhid`, `id`; services: `household_id`, `hh_id`, `hhid`, `id`, `"unknown"` (`:134,152`) | "Household ID" column, search, View link, export | bold |
| `district` | `district` → `"Unknown"` (`:183`) | badge column, district options, search, export | outline badge |
| `lastServiceDate` | household `last_service_date` → `"N/A"` (`:184`) | "Last service" column, export | raw |
| domain flags | service `health_services`, `schooled_services`, `safe_services`, `stable_services` | "Domain count", "Status tags", export | `"<n> / 4"` in table, `"<n>/4"` in export |
| `isActive` | service `service_date` | export only ("Active (90d)") | Yes/No |

### Filters / sort / pagination / search
- [ ] **Type select** ("Metric category" placeholder) (`legacy:src/pages/HouseholdRiskRegister.tsx:263-277`), options = `toSentenceCase(label)` of `RISK_TYPES` in order (`:48-54`):
  - `health_domain` → `"Missing health services"`
  - `schooled_domain` → `"Missing schooled services"`
  - `safe_domain` → `"Missing safe services"`
  - `stable_domain` → `"Missing stable services"`
  - `graduation_path` → `"Graduation ready (all 4)"`
  - Default `health_domain` (`:60`). Persisted in URL `?type=`; on change `setSearchParams({ type: val, district: selectedDistrict })` (`:266`).
  - Domain names (Health/Schooled/Safe/Stable) are program domain terms → config.
- [ ] **District select** (`:279-296`): `"All districts"` + data-derived Title-Cased districts (all provinces); placeholder `"District"`; persisted in URL `?district=` via `setSearchParams({ type, district: val })` (`:283`).
- [ ] **Search**, placeholder `"Search by Household ID or District..."` (`:321-329`): case-insensitive substring on `household_id` and `district` (`:197-203`). Not in URL. No debounce.
- [ ] No sub-population filters (the row keeps `raw_household` "for sub-population filtering" but nothing uses it, `:191`).
- [ ] No sort controls. **No pagination: the table renders only the first 100 rows** (`filteredData.slice(0, 100)`, `:351`) with no notice; the subtitle count and export use all rows.

### Exports
- [ ] **CSV**, button `"Export csv"`, disabled when 0 rows (`legacy:src/pages/HouseholdRiskRegister.tsx:298-305`). Rows: all filtered rows (not capped at 100) (`:208-234`).
  - Headers in order (`:211`): `Household ID`, `District`, `Last Service Date`, `Domains Covered`, `Health`, `Schooled`, `Safe`, `Stable`, `Active (90d)`.
  - Values: `household_id`, `district`, `last_service_date`, `"<domain_count>/4"`, then `"Yes"`/`"No"` for `has_health`, `has_schooled`, `has_safe`, `has_stable`, `is_active` (`:212-222`).
  - Joined with `,` and `\n` **without quoting or escaping**, no BOM (`:224-225`).
  - Filename `household_domain_gap_${type}_${selectedDistrict}.csv` (district not sanitised; `All` when all) (`:229`).

### Charts
- [ ] None. Header: icon per type (`RISK_TYPES[type].icon`, colour per type: health rose, schooled/safe/graduation emerald, stable amber) + title `toSentenceCase(label)`; sub-line `"<n> households found"` + `" in <district>"` when not `All` (`:253-259`).
- [ ] "Status tags" column: badges `Health`, `Schooled`, `Safe`, `Stable` for each domain the household **has**, plus `Grad-ready` when `domain_count === 4` (`:365-373`).
- [ ] Info alert (hidden for `graduation_path`): title `"Gap analysis mode"`, text `"The dashboard shows overall coverage, but this register lists households specifically MISSING <domainLabel> services so you can prioritize them."` (`:310-318`).

### Links in / out
- [ ] In: **none** (orphan). Query params consumed: `type`, `district`. Compare: the VCA equivalent is linked from `VcaServicesDashboard` (`legacy:src/pages/VcaServicesDashboard.tsx:678-715`).
- [ ] Out: back arrow → `navigate("/household-services")` (`legacy:src/pages/HouseholdRiskRegister.tsx:247`) → new `/services/household`; row `"View profile"` → `navigate("/profile/household-details?id=${item.household_id}")` (query param, ID not URL-encoded) (`:379`). Rebuild: `/households/:householdId`.

### Loading / empty / error
- [ ] Loading: `LoadingDots` replaces the table while either query is loading (`legacy:src/pages/HouseholdRiskRegister.tsx:334-337`).
- [ ] Empty: Home icon, `"No records found"`, `"Adjust your filters to see households in different stability phases."` (`:389-396`).
- [ ] Error: not handled (empty state shown). A failure of one query is indistinguishable from "no gaps".

### Bugs and quirks
- [ ] **BUG** Changing the district does not recompute the list: `filteredData`'s deps are `[type, servicesQuery.data, searchQuery, hhListQuery.data]` and omit `selectedDistrict`/`discoveredDistrictsMap` (`:206`). The table and count keep showing the previous district until type, search or data change (the subtitle's " in <district>" does update).
- [ ] **BUG** An unknown `?type=` value crashes the page (`RISK_TYPES[type].icon` on `undefined`, `:60,236`). Validate the param and fall back to the default.
- [ ] **BUG** CSV cells are not quoted/escaped (`:224`); commas in districts or dates break the file. No BOM.
- [ ] **BUG** No provincial restriction and national data for every user (`:63-79,89,116`).
- [ ] **BUG** Only the first 100 rows are rendered, silently (`:351`).
- [ ] **BUG** `setSearchParams({ type, district })` replaces the whole query string, dropping the FY params `fy`/`from`/`to` from the URL (FY state survives in context/localStorage) (`:266,283`; `legacy:src/context/FyFilterContext.tsx:69-79`).
- [ ] **QUESTION** Services are not FY-scoped while the household population is; a household's domain coverage counts services from any date. Intended?
- [ ] **QUESTION** For "Missing X" lists the tags show the domains the household **has**, not the missing one. Keep?
- [ ] Quirk: `handleClearFilters` defined but unused (`:70-72`); `RISK_TYPES[*].bg` and `.domain` unused.
- [ ] Quirk: district select is disabled for any `"District User"`, even without a location (`:285`).
- [ ] Quirk: a household with none of `household_id`/`hh_id`/`hhid`/`id` gets the literal ID `"undefined"` (`String(undefined)`, `:152`) and can never match services; normaliser should drop or flag rows without an ID.
- [ ] Quirk: lock effect deps are `[user, selectedDistrict]` (`:75-79`), so a locked user's selection snaps back immediately (unlike the other two pages, which depend only on `lockedDistrict`). `format` from date-fns is imported but unused (`:44`).

---

<a id="part-profile"></a>

## Part: the profile page

## Route `/profile/household-details` → `/households/:householdId`

### Purpose
This is the read-only profile of one household (one caregiver), plus a data-quality flag form. It has:
- a hero header
- three stat cards
- six tabs: Summary, Family members, Case plans (with inline vulnerabilities), Caregiver services, Referrals and Flag record form, which also lists open flags and lets the user resolve them

The page works for both active and archived households (`legacy:src/pages/HouseholdProfile.tsx:227-264`).

### Access
- [ ] **Route guard:** `ProtectedRoute` only, with no role check (`legacy:src/App.tsx:453-460`; `legacy:src/components/auth/ProtectedRoute.tsx:4-21`).
  - It renders `null` while auth loads.
  - With no user it redirects to `/`.
  - If `password_change_required` is set, it redirects to `/change-password`.
- [ ] **Sidebar:** no entry. The sidebar items are `/households` (`legacy:src/components/dashboard/AppSidebar.tsx:58`) and `/households/archived` (`:72`). `isActive` is an exact path match (`:183`), so no sidebar item is highlighted on this page. The new shell should highlight "Households" for `/households/:householdId`.
- [ ] **Mobile nav:** no entry. "Registers" points to `/households` and also uses an exact match (`legacy:src/components/dashboard/MobileBottomNav.tsx:8,20`).
- [ ] **Global search:** the "Recent Households (District)" group links here. See Links in.
- [ ] **In-page role checks.** There is exactly one:
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/HouseholdProfile.tsx:150`).
  - It only chooses the district sent to the register endpoints (next item).
  - Nothing is hidden by role: the flag form, the Resolve buttons and all tabs are shown to every logged-in user (`:1391-1676`).
  - Port with `can(...)` permissions. **QUESTION:** should raising and resolving flags need a permission (e.g. `flags.create` / `flags.resolve`)? Legacy allows anyone.
- [ ] **Data scope:**
  - The code is `const district = isDistrictUser ? user?.location || "None" : "";` (`legacy:src/pages/HouseholdProfile.tsx:152`). The comment at `:151` says: "Admins and Provincial Users have global view access at the profile level".
  - A district user sends their `location`, or the literal `"None"` when it is empty.
  - Everyone else (admins, provincial users, support users, users with no description) sends `""`. Both register endpoints treat `""` as all districts (AUDIT.md §3.2), so a provincial user gets national data.
  - `useEffectiveDistrict` is **not** used here (compare `legacy:src/hooks/useEffectiveDistrict.ts:5-17`, which would restrict provincial users to their province). The new page must take scope from `platform/scope`.
  - The scope only affects whether the household is found in the register lists. The five by-ID endpoints have no scope check on the backend (AUDIT.md §3.2: "by ID"). They are called whenever an id is present, even if the household is outside the user's district.
  - **Backend ask:** enforce household ownership/scope on the `/household/...:household_id(*)` routes.
- [ ] **QUESTION:** if the household is not in the user's scoped registers but `location.state` carries a matching record, the page still renders it from the state (`:243-261`). That bypasses the client-side scope. The new page has no `location.state`; decide whether a scoped "not found" or a by-ID fetch is the intended behaviour.

### How the household ID arrives
- [ ] The id is resolved in `useMemo` at `legacy:src/pages/HouseholdProfile.tsx:140-147`, in this precedence:
  1. `location.state.id`
  2. the query param `?id=`
  3. `sessionStorage["ecap_last_household_id"]`
- [ ] When 1 or 2 is present, the value is **written** to `sessionStorage["ecap_last_household_id"]` (`:143`), as a side effect inside `useMemo`.
- [ ] The new page reads `:householdId` from the route param only (CLAUDE.md data rules). Legacy redirects must map `/profile/household-details?id=X` to `/households/X`. A link that carried only `location.state` cannot be redirected, so the legacy redirect for a bare `/profile/household-details` should go to `/households`.
- [ ] **BUG:** opening `/profile/household-details` with no state and no `?id` silently shows the **last viewed** household from sessionStorage (`:146`). Do not port this.
- [ ] Resolving the household record (`:227-264`):
  - The page concatenates the active register and then the archived register, and takes the first row where any of `uid`, `unique_id`, `household_code`, `household_id` or `id` equals the id, case-insensitively (`:228-239`).
  - If none matches, but `location.state` exists and its `id` / `household_id` / `unique_id` equals the id (case-insensitive), it builds the household from the **state object itself**. It adds `id`, `household_id` (state's or id), `unique_id` (state's or id) and `household_code` (state's `household_code`, then `household_id`, then id) (`:243-260`).
  - Otherwise the household is `undefined`, which shows "not found".
- [ ] **QUESTION:** the state fallback lets `MotherIndexDetails` pass a mother record spread into state (`legacy:src/pages/MotherIndexDetails.tsx:130`). The Summary tab then shows mother-row fields under household labels. The new page should not render from a foreign record. Decide whether to fetch by id instead. There is no single-household endpoint today (AUDIT.md §3.2), so the new page still has to find the row in the register lists. The register normaliser should expose a `findHousehold(id)` that matches `household_id` (and any alias the normaliser settles on) once.

### Endpoints
The DQA wrappers use `dqaGet` (`legacy:src/lib/api.ts:185-210`): a Bearer token, and it throws `data.message ?? "DQA request failed"` on a non-2xx response. Responses are unwrapped by the heuristic `getListValue` (`:116-183`). No query on this page overrides the global defaults (`legacy:src/App.tsx:112-134`): `staleTime` 60 s, `gcTime` 24 h, `retry: 1`, refetch on mount, focus and reconnect. Every successful query is persisted to IndexedDB for 24 h (`legacy:src/App.tsx:214-224`), including flags and household members.

- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdsByDistrict(district)` (`legacy:src/lib/api.ts:301-312`).
  - Called with `district` from the Access section (`legacy:src/pages/HouseholdProfile.tsx:154-158`). No FY window is sent, so the endpoint returns all active households, not an FY cohort.
  - Key `["households","district",district]`; `enabled: true` (always fires, even without an id).
  - The wrapper adds an IndexedDB list cache: key `households_by_district:<district or "ALL">`, TTL 60 s, stale data served on fetch error (`legacy:src/lib/api.ts:212-238,305-310`; DB `ecap_plus_cache_db`, store `api_cache`, `legacy:src/lib/indexedDbCache.ts:6-7`).
  - Post-processing: only used to find one row (see "How the household ID arrives").
  - **BUG (performance):** it downloads the whole national active register (for non-district users) to show one household.
- [ ] `GET /household/all-households-archived/:district(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdArchivedRegister(district)` (`legacy:src/lib/api.ts:319-339`). No reason and no FY are sent (`legacy:src/pages/HouseholdProfile.tsx:160-164`).
  - Key `["households","archived","district",district]`; `enabled: true`. No wrapper cache.
  - Post-processing: concatenated after the active list for the lookup. Same performance BUG as above.
- [ ] `GET /household/caregiver-services/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getCaregiverServicesByHousehold(id)` (`legacy:src/lib/api.ts:444-449`).
  - Key `["caregiver-services","household",id]`; `enabled: Boolean(id)` (`legacy:src/pages/HouseholdProfile.tsx:166-170`).
  - Post-processing (`:351-367`):
    - Rows are filtered again on the client, keeping those where `household_id || householdId || hh_id` equals `household.household_id || id`, case-insensitively.
    - They are then sorted newest first by `service_date || visit_date || date`, using `safeParseDate` (unparseable dates become `0`, so they sort last).
  - **QUESTION:** the client re-filter is redundant, since the server already filters by `household_id`. It also drops every row when the id in the URL is a non-`household_id` alias (`uid` / `household_code`) that matched the household in the register. In that case the request was already sent with the wrong id. The new page should call every by-ID endpoint with the normalised `household.householdId`, not the raw URL value. Better still, the route param *is* the `household_id`.
- [ ] `GET /household/caregiver-caseplans/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getCaregiverCasePlansByHousehold(id)` (`legacy:src/lib/api.ts:551-556`).
  - Key `["caregiver-caseplans","household",id]`; `enabled: Boolean(id)`; default `[]` (`legacy:src/pages/HouseholdProfile.tsx:172-177`).
  - Post-processing: sorted newest first by `case_plan_date || date_of_caseplan || date` (`:369-379`).
- [ ] `GET /household/caregiver-caseplan-domains/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getCaregiverCasePlanDomainsByHousehold(id)` (`legacy:src/lib/api.ts:558-565`).
  - Key `["caregiver-caseplan-domains","household",id]`.
  - **Lazy:** `enabled: Boolean(id) && expandedVulnPlanDate !== null`, so it fires the first time any case-plan row is expanded (`legacy:src/pages/HouseholdProfile.tsx:184-194`).
  - Post-processing (`:195-204`):
    - Keeps the rows where `String(v.case_plan_date ?? "") === expandedVulnPlanDate`.
    - **If none match, it shows all of the household's domain rows.** This is deliberate: the comment at `:200-202` describes it as handling "date drift in the source data".
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2)
  - Wrapper: `getChildrenByDistrict(district)` (`legacy:src/lib/api.ts:368-379`; IndexedDB cache key `children_by_district:<district or "ALL">`, 60 s).
  - Key `["vcas","district",district]`; `enabled: true` (`legacy:src/pages/HouseholdProfile.tsx:206-210`). The same key and function are used by `VcaProfile`, so the cache is shared (`legacy:src/pages/VcaProfile.tsx:204`).
  - Post-processing: only used to count the household's VCAs. It filters rows where `household_code || household_id` equals `id`, case-insensitively (`legacy:src/pages/HouseholdProfile.tsx:391-399`).
  - **BUG (performance):** it downloads the whole national active VCA register to show one count badge.
  - **QUESTION:** the badge counts active VCAs only, while the Family members tab lists every `children` row, both active and closed. The two numbers can disagree. The new page could derive the count from the members list (filtered by status if wanted) and drop this request.
- [ ] `GET /items/flagged_forms_ecapplus_pmp?fields=*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name` (Directus, AUDIT.md §3.3)
  - Wrapper: `getFlaggedRecords()` (`legacy:src/lib/api.ts:604-628`). It is a raw `fetch` with a Bearer token, and returns `[]` when there is no token or on a thrown error.
  - Key `["flagged-records"]`; no `enabled` condition (`legacy:src/pages/HouseholdProfile.tsx:212-215`). The key is shared with `Flags.tsx:43` and `VcaProfile.tsx:258`.
  - Post-processing (`:381-389`): keeps the rows where `household_id || hh_id` equals `household.household_id || id` (case-insensitive) **and** `status !== "resolved"`.
  - **BUG:** there is no filter, sort or limit, so it fetches every flag nationally (only the Directus default page size, AUDIT.md §3.3) and filters on the client. Flags beyond the first page never appear. Port it as `filter[household_id][_eq]=<id>`.
  - **BUG:** `response.ok` is never checked (`legacy:src/lib/api.ts:622-623`). On a 4xx/5xx, `getListValue` falls through to "the first non-empty array" (`:166-172`) and returns the Directus `errors` array as if it were flags.
- [ ] `GET /household/members/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdMembers(id)` (`legacy:src/lib/api.ts:314-317`).
  - Key `["household-members",id]`; `enabled: Boolean(id)`; default `[]` (`legacy:src/pages/HouseholdProfile.tsx:217-223`).
  - Post-processing: none. The order is as returned; the backend has no ORDER BY.
- [ ] `GET /household/caregiver-referrals/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdReferralsById(id)` (`legacy:src/lib/api.ts:567-572`).
  - Key `["caregiver-referrals",id]`; `enabled: Boolean(id)`; default `[]` (`legacy:src/pages/HouseholdProfile.tsx:401-406`).
  - Post-processing: sorted newest first by `service_date || visit_date || date || referral_date` (`:408-418`).
  - **BUG:** the backend date column is `referred_date` (AUDIT.md §3.2), which is not in this candidate list, nor in the display list at `:1883-1890`. The sort is effectively a no-op and the Date column probably shows "N/A". The normaliser should map `referred_date`.
  - **QUESTION:** key prefix `["caregiver-referrals", …]` is also used by `Referrals.tsx:169` with a different shape. Use the module key factory to keep them apart.
- [ ] `POST /items/flagged_forms_ecapplus_pmp` (Directus, AUDIT.md §3.3)
  - Wrapper: `createFlaggedRecord(payload)` (`legacy:src/lib/api.ts:630-652`). It throws `errorData.message || "Failed to create flagged record"`.
  - Fired by submitting the flag form (`legacy:src/pages/HouseholdProfile.tsx:275-298,331-349`). The payload is listed under Other behaviour.
- [ ] `PATCH /items/flagged_forms_ecapplus_pmp/:id` with body `{status:"resolved"}` (Directus, AUDIT.md §3.3)
  - Wrapper: `updateFlagStatus(flagId,"resolved")` (`legacy:src/lib/api.ts:1283-1305`; the id is not URL-encoded).
  - Fired by "Resolve" (`legacy:src/pages/HouseholdProfile.tsx:300-329`).
- [ ] `GET /users?fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required&limit=-1&filter[status][_eq]=active`, then N × `POST /notifications` (Directus, AUDIT.md §3.3)
  - Wrappers: `notifyUsersOfFlag` / `notifyUsersOfFlagResolution` → `listUsers("active")` + `createNotification` (`legacy:src/lib/directus.ts:79-100,514-527,657-709`).
  - They run after a flag is created or resolved. See Other behaviour.

### Fields used
The household row comes from `all_households` (active or archived register), or from `location.state` (see above). "N/A" is the fallback unless stated otherwise. Every value is shown through `String(...)`, so falsy values (`0`, `""`, `false`) show the fallback.

**Hero and stat cards** (`legacy:src/pages/HouseholdProfile.tsx:463-636`)

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| isArchived | `de_registration_date` (truthy) | Status badge: "Archived" (amber) or "Active" (emerald, glowing dot) (`:463-509`) | — |
| id | route id | Badge `#{id}` (`:514`); layout subtitle `Household: {id}` (`:472`) | mono |
| householdVcaCount | count of `vcas` where `household_code \|\| household_id` = id (`:391-399`) | Badge `{n} VCAs` (`:520`) | — |
| caregiver name | **not shown**: the literal `"Caregiver Name – Confidential"` is the H1 (`:525`) | H1 | gradient text |
| district | `district` | Hero meta line `{district} · {facility}` (`:531-532`) | — |
| facility | `facility` | Hero meta; stat card "Facility" (`:590`) | — |
| lastServiceDate | `householdServices[0].service_date`, then `household.last_service_date` (`:467-469`) | Hero "Last updated: …" (`:536`); stat card "Last service date" (`:597`) | `DD MMM YYYY`, else "N/A" |
| caseworker | `caseworker_name` | Hero meta (`:540`) | — |
| ward | `ward` | Stat card "Ward" (`:583`) | — |

**Summary tab → card "Caregiver Personal Information"** (`:665-739`)

| Label (exact) | Raw keys (in order) | Formatting |
| --- | --- | --- |
| Caregiver name | literal `"Caregiver Name – Confidential"` | — |
| Caregiver sex | `caregiver_sex`, `sex`, `gender` | raw |
| Date of birth | `caregiver_birthdate`, `caregiver_birth_date`, `dob` | `DD MMM YYYY` via `formatBirthDate` |
| HIV status | `caregiver_hiv_status`, `hiv_status` | raw |
| ART Number | `caregiver_art_number`, `art_number` | raw |
| On HIV Treatment? | `is_on_hiv_treatment`, `active_on_treatment` | raw |
| Date Started ART | `date_started_art` | **raw string**, not formatted |
| Date HIV Known | `date_hiv_known` | raw string |
| Marital status | `marital_status` | raw |
| Education | `education` | raw |
| Relation | `relation`, `relationship` | raw |
| Phone number | literal `"Phone – Confidential"` | — |

**Summary tab → card "Household Information"** (`:741-947`). Every value is a raw string; the date fields are **not** formatted.

| Label (exact) | Raw keys (in order) |
| --- | --- |
| Home Address | `homeaddress`, `home_address` |
| Family Source of Income | `fam_source_income` |
| Monthly Expenses | `monthlyexpenses` |
| Number of Beds | `beds` |
| Malaria ITNs | `malaria_itns` |
| Number of Pregnant Women | `number_of_pregnant_women`, `pregnant_woment` |
| Biological Children | `biological_children` |
| Approved Family? | `approved_family` |
| Acceptance | `acceptance` |
| Screening Location | `screening_location`, `screening_location_home` |
| Screening Date | `screening_date` |
| Enrolled Date | `enrolled_date` |
| Date Offered Enrollment | `date_offered_enrollment` |
| Date Referred | `date_referred` |
| Last Service Date | `last_service_date` |
| Client Screened | `client_screened`, `screened` |
| Client Result | `client_result` |
| HEI | `hei` |
| CALHIV | `calhiv` |
| Child MMD | `child_mmd` |
| VL Results on File? | `viral_load_results_on_file` |
| TPT Client Eligibility | `tpt_client_eligibility` |
| TPT Client Initiated | `tpt_client_initiated` |
| Takes Drugs to Prevent Other Diseases? | `takes_drugs_to_prevent_other_diseases` |
| Is Child's Caregiver an FSW? | `is_the_child_caregiver_an_fsw` |
| Is Biological Mother of Child Living with HIV? | `is_biological_mother_of_child_living_with_hiv` |
| Child Experienced Sexual Violence? | `child_ever_experienced_sexual_violence` |
| Violence in Last 6 Months? | `violence_six_months` |
| Children with Violence (6 Months)? | `children_violence_six_months` |
| VCA Gender | `vca_gender` |
| Adolescent Birthdate | `adolescent_birthdate` |
| Emergency Contact | `emergency_name` |
| School | `school` |
| Service | `service` |
| Quarter | `quarter` |
| Index Check Box | `index_check_box` |
| Consent Check Box | `consent_check_box` |
| ART Check Box | `art_check_box` |
| VL Check Box | `vl_check_box` |
| De-Registration Date | `de_registration_date` |
| De-Registration Reason | `de_registration_reason` |
| Exited / Graduation Reason | `exited_graduation_reason` |
| Active on Treatment? | `active_on_treatment` |

**Summary tab → card "Location & Facility"** (`:950-976`): Province `province`; District `district`; Ward `ward`; Health facility `facility`; Community entry `entry_type`; Partner `partner`, falling back to the hardcoded **`"PCZ"`** (`:974`).

**Summary tab → card "Caseworker Details"** (`:978-998`): Caseworker Name `caseworker_name`; Caseworker Phone `caseworker_phone`; Caseworker Username `provider_id`; Case Status `case_status`, then `status`, falling back to **`"Active"`** (`:995`).

**Family Members tab** (`:1002-1109`), from `/household/members` rows

| Column header (exact, in order) | Raw keys | Formatting |
| --- | --- | --- |
| Member Details | `uid`, `vca_id` | mono-ish chip |
| Birthdate | `birthdate` | `DD MMM YYYY`, else "N/A" |
| Gender | `vca_gender`, `gender` | raw |
| Disability | `disability` | raw, fallback **"None"** |
| Relationship | `relation`, `relationship` → `normalizeRelationship` | "Guardian" for `guardian`/`gardian`, "Parent" for `parent`, otherwise "N/A" (`:448-458`) |
| (blank header) | `uid`, `vca_id`, `unique_id` | "View profile" button → VCA profile |

**Case plans tab** (`:1111-1339`), from `/household/caregiver-caseplans` rows

| Column header (exact) | Raw keys | Formatting |
| --- | --- | --- |
| Case Plan Date | `case_plan_date` ?? `date_of_caseplan` ?? `date` | `DD MMM YYYY` |
| Status | `case_plan_status` ?? `status` | `1` → "Active" (emerald), `0` → "Closed" (slate); string "active"/"closed" (case-insensitive) gets the same colours; anything else shows as-is (sky) (`:1152-1179`) |
| Date Created | `date_created`, `created_at` | `DD MMM YYYY` |
| Date Edited | `date_edited` | `DD MMM YYYY` |
| Action | — | "View Vulnerabilities" / "Hide Vulnerabilities" toggle |

**Vulnerabilities sub-table** (`:1226-1312`), from `/household/caregiver-caseplan-domains` rows. Every cell except Due Date goes through `cleanArrayString`.

| Column header (exact) | Raw key |
| --- | --- |
| Domain | `vulnerability_type` (capitalised by CSS) |
| Vulnerability | `vulnerability` |
| Goal | `goal` |
| Services | `services` |
| Service Referred | `service_referred` |
| Institution | `institution` |
| Due Date | `due_date` (`DD MMM YYYY`) |
| Status | `status` |
| Comment | `vulnerability_comment` |

**Caregiver Services tab** (`HouseholdServicesDetailTable`, `:1696-1819`). The table is fixed-layout, `min-w-[1800px]`, with horizontal scroll. Every pillar column goes through `cleanArrayString`.

| Column header (exact, in order) | Raw key |
| --- | --- |
| Service Date | `service_date`, `visit_date`, `date` (`DD MMM YYYY`) |
| HIV status | `is_hiv_positive` (raw) |
| Viral Load | `vl_last_result` (raw) |
| Health Services | `health_services` |
| HIV Services | `hiv_services` |
| Other Health | `other_health_services` |
| Safe | `safe_services` |
| Other Safe | `other_safe_services` |
| Schooled | `schooled_services` |
| Other Schooled | `other_schooled_services` |
| Stable | `stable_services` |
| Other Stable | `other_stable_services` |

Row key: `id`, then `unique_id`, then `${service_date||visit_date||"service"}-${i}` (`:1767-1772`). **QUESTION:** `is_hiv_positive` and `vl_last_result` are not established columns of `caregiver_services` (AUDIT.md §3.2 lists only the pillar columns). Confirm them against a fixture.

**Referrals tab** (`ActivityTable`, `:1821-1905`)

| Column header (exact) | Raw keys (in order) | Formatting |
| --- | --- | --- |
| Record Name | `service`, `service_name`, `form_name`, `referral`, `referral_type`, `referral_name` | raw, bold |
| Date | `service_date`, `visit_date`, `date`, `referral_date`, `date_created`, `created_at` (**`referred_date` missing**) | `DD MMM YYYY` |
| Status | `status`, `state` | outline badge |

**Flags (open flags for this household)** (`:1536-1675`)

| Field | Raw keys | Where shown | Formatting |
| --- | --- | --- | --- |
| comment | `comment` (fallback "Suspicious data entry") | Attention card title | `toTitleCase` (`legacy:src/lib/utils.ts:18-21`) |
| verifier | `verifier` | "Flagged by {verifier} • {date}" | raw |
| date | `date_created` | Attention card | date-fns `MMM d, yyyy` (**no guard**, see Bugs) |
| category | `category`, `form_type` (fallback "General") | History table "Category" | bold |
| severity | `severity` (fallback "Normal") | `{severity} priority` under the category; red when `=== "Critical"`, otherwise slate | uppercase |
| date flagged | `date_created`, `created_at` | History table "Date flagged" | date-fns `dd MMM yyyy`, else "N/A" |
| observations | `comment`, `description`, `reason` (fallback "No description provided") | History table "Observations" | italic |
| status | — | History table "Status": always the literal badge **"Flagged"** | rose badge |

### Section headings and counters (exact copy)
- [ ] Hero eyebrow "Household profile" (`legacy:src/pages/HouseholdProfile.tsx:488-490`).
- [ ] Family tab heading "Family Members" (`:1004-1006`).
- [ ] Case plans tab heading "Caregiver Caseplans" (`:1112-1114`); expanded row caption "Vulnerabilities recorded against the case plan dated {DD MMM YYYY}" (`:1210-1214`).
- [ ] Services tab heading "Caregiver Services" with a badge "{n} Records", where n = rows after the client re-filter (`:1344-1352`).
- [ ] Referrals tab heading "Household Referrals" plus the dead "Export" button (`:1366-1375`).
- [ ] Flags tab: card heading "Record New Flag" (`:1399-1401`); attention block eyebrow "Active attention required" (`:1538-1540`); history heading "Flagging history" with badge "{n} records" (`:1581-1589`).

### Formatting helpers (port to `core/lib/format.ts` + date-fns)
- [ ] `parseMomentDate` (`:101-116`):
  - `null`/`""`/`"N/A"` → `null`.
  - Otherwise it does a **strict** moment parse against `[ISO_8601, "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD"]`.
  - If that fails it falls back to a lenient `moment(String(value))` (deprecated, and browser-dependent).
- [ ] `formatServiceDate` / `formatBirthDate` (`:123-131`): `DD MMM YYYY`, else `"N/A"`. They are identical. The new code should take the format from config via `core/lib/format.ts`.
- [ ] `safeParseDate` (`:118-121`): epoch ms, or `0` when unparseable. Used for the newest-first sorts.
- [ ] `cleanArrayString` (`:1685-1694`): falsy → "N/A". Otherwise it strips `[`, `]` and `"`, and replaces every `,` with `, `. The pillar columns hold JSON-array-like text. Port this as a normaliser (`string[]`) in `api/schemas.ts`, not as a display hack. Note that it also inserts a space after commas that are inside values.

### Filters / sort / pagination / search
- [ ] **Filters:** none on any tab.
- [ ] **Search:** none.
- [ ] **Sort.** None of the tables can be re-sorted by the user. The fixed sorts are:
  - services newest first (`:362-366`)
  - case plans newest first (`:369-379`)
  - referrals newest first (`:408-418`; broken, see the `referred_date` BUG)
  - members, flags and vulnerabilities in server order
- [ ] **Pagination:** none.
  - Every table renders all rows.
  - Referrals sit in a `ScrollArea` with a fixed `h-[500px]` and a horizontal scrollbar (`:1378-1386`).
  - Services scroll horizontally (`:1723-1724`).
  - The new tables use `platform/data-table` with client-side pagination.
- [ ] **Tabs:** `defaultValue="overview"`. The active tab is not in the URL and is not persisted (`:639`). The tabs, with internal id → label in order: `overview` "SUMMARY", `family` "FAMILY MEMBERS", `history` "CASEPLANS", `services` "SERVICES", `audit` "REFERRALS", `flags` "FLAG RECORD FORM" (`:643-650`). **QUESTION:** sync the tab to a `?tab=` URL param in the new page? (Recommended.)

### Exports
- [ ] **BUG:** the Referrals tab has an "Export" button (`legacy:src/pages/HouseholdProfile.tsx:1369-1375`) with **no `onClick`**, so it does nothing. **QUESTION:** implement it via `platform/export` (CSV of the referrals table: Record Name, Date, Status), or drop it? Nothing else on the page exports.

### Charts
- [ ] None. The only "KPIs" are the three stat cards (Ward, Facility, Last service date) and the hero badges (status, `#id`, `{n} VCAs`). Their sources are under Fields used.

### Links in / out
- [ ] **In** (grep of `household-details` in `legacy:src`). For each, the id key it carries and the new link to use:
  - `GlobalSearch` "Recent Households (District)":
    - `navigate("/profile/household-details", { state: { id } })`, where `id = pickValue(hh, ["household_id","householdId","hh_id","unique_id","id"])` (`legacy:src/components/dashboard/GlobalSearch.tsx:153,158`).
    - The list comes from `getHouseholdsByDistrict(user.location ?? DEFAULT_DISTRICT)`, sliced to 10 (`:51,72-76,152`).
    - New: `/households/:householdId`.
  - `HouseholdRegister` "View": `state: { id: String(id) }`, with `id = pickValue(household, ["household_id","householdId"])` (`legacy:src/pages/HouseholdRegister.tsx:511,546`).
  - `HouseholdArchivedRegister` "View": `state: { id: String(id) }`, with `id = pickValue(household, ["household_id","householdId","hh_id","id", …])` (`legacy:src/pages/HouseholdArchivedRegister.tsx:636-640,702-704`).
  - `HouseholdRiskRegister` "View profile": query `?id=${item.household_id}` (`legacy:src/pages/HouseholdRiskRegister.tsx:379`).
  - `CaregiverRiskRegister` "View profile":
    - query `?id=${item.displayId}`, where `displayId = household_id || hh_id` (trimmed), or the literal `"N/A"` (`legacy:src/pages/CaregiverRiskRegister.tsx:132,173,359`).
    - **BUG:** a row with no id links to `?id=N/A`.
  - `Flags` row click: `state: { id: record.household_id }` (`legacy:src/pages/Flags.tsx:167-169,393`).
  - `CaseworkerProfile` household row click: `state: { id: hh.id }`, where `hh.id = s.household_id || s.hh_id` from caseworker services (`legacy:src/pages/CaseworkerProfile.tsx:190-192,384`).
  - `MotherIndexDetails` "View Household Profile":
    - `state: { id: householdId, household_id: householdId, district, ...mother }`, where `householdId = pick(mother, ["household_id","hh_id","id","unique_id"])`.
    - The button is shown only when `householdId && householdId !== "N/A"` (`legacy:src/pages/MotherIndexDetails.tsx:33,128-131`).
  - `VcaProfile` "Household ID" stat card click: `state: { id: String(hhId) }` (`legacy:src/pages/VcaProfile.tsx:536-555`).
  - None of these callers writes sessionStorage or localStorage before navigating. The profile itself writes `ecap_last_household_id` (`legacy:src/pages/HouseholdProfile.tsx:143`).
  - All of them become `/households/<household_id>`. They should use a path builder exported from `@/modules/households` (e.g. `householdPath(id)`).
- [ ] **Out:**
  - Hero "View Household Profile":
    - `navigate("/profile/household-details", { state: { id, household_id: id, ...household } })` (`:546-557`).
    - **BUG:** it navigates to **this same page**, a no-op apart from re-pushing history. Drop it, or **QUESTION:** was it meant to go somewhere else?
  - Hero "Back to register": `navigate(-1)` (`:558-565`).
    - **BUG:** on direct entry (deep link, new tab) this leaves the app or does nothing.
    - New: go back to the referring register if one is in history, otherwise to `/households` (or `/households/archived` when the household is archived).
  - Not-found state "Back to Register" → `/households` (`:437-440`).
  - Family members "View profile":
    - `navigate("/profile/vca-details", { state: { id: String(m.uid || m.vca_id || m.unique_id) } })` (`:1072-1079`).
    - New: `/vcas/:vcaId`, via the `@/modules/vcas` path builder.
  - No link to `/flagged-record-form` or `/flags`. The flag form is embedded in the tab. **QUESTION:** in the new app, should the profile's flag tab reuse the flags module's form component (exported from `@/modules/flags`) rather than duplicate it? The plan maps `/flagged-record-form` → `/flags/new?householdId=`.

### Loading / empty / error
- [ ] **Page-level loading:** while **either** register query is loading, the page shows `DashboardLayout` (subtitle "Household profile") with a centred `LoadingDots`, `h-[50vh]` (`:420-428`). The by-ID queries do **not** block the page; each tab shows its own `LoadingDots` row.
- [ ] **Not found:**
  - When `household` is undefined: `DashboardLayout` with subtitle "Household not found", then `EmptyState` with the Home icon.
  - Title "Household not found"; description "The household record you're looking for doesn't exist or has been moved."; action "Back to Register" → `/households` (`:430-445`).
- [ ] **Empty states per tab:**
  - Family: "No family members have been registered for this household." (`:1098-1099`)
  - Case plans: "No case plans have been created for this household yet." (`:1329-1330`)
  - Vulnerabilities: "No vulnerabilities recorded for this case plan." (`:1222-1223`)
  - Services: "No caregiver services found." (`:1715`)
  - Referrals: "No referral tracking found" (`:1383`)
  - Flags history: `EmptyState` with title "No flagged records" and description "This household has no documented data quality issues." (`:1669-1673`)
  - The "Active attention required" block is hidden when there are no open flags (`:1536`).
- [ ] **Loading per tab:** `LoadingDots` in a full-width table row (members `:1030-1038`, case plans `:1137-1142`), in a block (services `:1703-1708`, referrals `:1832-1837`), or inline in the expanded vulnerabilities row (`:1215-1218`).
- [ ] **Error handling:** **none.** No query reads `isError`/`error`.
  - **BUG:** if a register request fails, the page shows "Household not found" (or a household built from state) instead of an error with retry.
  - **BUG:** if a by-ID request fails, the tab shows its *empty* message.
  - The new page needs an `<ErrorState>` with retry per section, and a page-level error when the household lookup fails.
- [ ] **Partial failure:** active and archived lookups are independent. If only one of them fails, a household in the other list still renders.

### Bugs and quirks
- [ ] **BUG:** `format(new Date(flag.date_created), "MMM d, yyyy")` has no guard (`:1558-1561`). A flag with a missing or invalid `date_created` throws `RangeError: Invalid time value` and crashes the profile. The history table, by contrast, guards and falls back to `created_at` (`:1638-1645`).
- [ ] **BUG:** "Flagging history" shows only **unresolved** flags, because `householdFlags` filters out `status === "resolved"` (`:387`). Its Status column always shows the literal "Flagged" (`:1660`), whatever the actual status (e.g. `pending`). **QUESTION:** should history list every flag with its real status, while the attention block lists the open ones?
- [ ] **BUG:** the flag form's Selects use `defaultValue={field.value}` (`:1420-1421,1461-1462`). After `form.reset()` on success (`:291`), the trigger keeps showing the previous category and severity while the form value is `""`. Use controlled `value`.
- [ ] **BUG:** `normalizeRelationship` maps anything other than guardian/gardian/parent to "N/A" (`:448-458`), which hides real values. Port it as a normaliser that keeps the raw value (title-cased) and only fixes the "gardian" typo.
- [ ] **BUG:** the falsy-to-"N/A" pattern (`String(x || "N/A")`) turns a numeric `0` into "N/A". This affects counts like `beds`, `biological_children` and `number_of_pregnant_women` if the API returns numbers (`:759,769,775`). Use `??` semantics in the normaliser.
- [ ] **BUG:** the Disability column falls back to "None" when the field is missing (`:1057`). That presents unknown data as a negative answer. Use the standard empty placeholder instead.
- [ ] **QUESTION:** the Summary tab shows raw, unformatted strings for most date fields (Date Started ART, Date HIV Known, Screening Date, Enrolled Date, Date Offered Enrollment, Date Referred, Last Service Date, Adolescent Birthdate, De-Registration Date), but formats Date of birth. The new page should format every date through `core/lib/format.ts`.
- [ ] **QUESTION:** the hero label "Last updated:" shows the latest service date, not a record-updated timestamp (`:536`). Rename it to "Last service"?
- [ ] **QUESTION (brand):** the Partner fallback is the hardcoded `"PCZ"` (`legacy:src/pages/HouseholdProfile.tsx:974`). It must come from `@/config` (program partner name), or the field shows the empty placeholder.
- [ ] **QUESTION (copy):** "Submitted flags will be reviewed by district monitors within 24 hours." (`:1513-1514`) is a program-specific SLA claim. Move it to config or drop it.
- [ ] **QUESTION (PII):**
  - Caregiver name and phone are masked with the literals "Caregiver Name – Confidential" (`:525,668`) and "Phone – Confidential" (`:738`).
  - Yet the page shows the caseworker phone in clear (`:986`) and sends `caregiver_name` into the flag record (`:340`).
  - The full register rows (with names) are also persisted to IndexedDB (`legacy:src/App.tsx:214-224`; `legacy:src/lib/api.ts:227`).
  - Confirm the masking policy. Should it be a config/permission (e.g. `households.viewPii`)? Mark the profile queries `meta: { persist: false }`.
- [ ] **QUESTION:** case-plan expansion is keyed by the plan **date string** (`:1151`), so two plans on the same date (or two with empty dates) expand together. Key it by plan id in the new page. The "no match → show all domains" fallback (`:203`) can show another plan's vulnerabilities under the wrong date. Keep it only with a visible notice, or drop it.
- [ ] **QUESTION:** the "VCAs" badge counts active VCAs from the national register by `household_code || household_id` against the raw id (`:391-399`), while the Family tab lists every `children` row (active and closed) from `/household/members`. The two can disagree.
- [ ] **Quirk:** `InfoItem` falls back to "Not Provided" (`:1958`), but every caller already passes "N/A", so "Not Provided" never shows.
- [ ] **Quirk:** the subtitle in the layout header is `Household: {id}` (`:472`); `id` may be `null`, which renders as "Household: null".
- [ ] **Quirk:** the household lookup also matches `uid` / `unique_id` / `id` (`:231-236`). VCA rows are not in these lists, but a household whose `household_code` equals another household's `household_id` would match first. The new code should match on the canonical `household_id` only.

---

## Other behaviour

### The registers draft

- [ ] **Global search (search provider for the pilot).** Nav entries: `"Household Register"` → `/households`, `"Household Archived"` → `/households/archived` (`legacy:src/components/dashboard/GlobalSearch.tsx:36,41`). Opens with Ctrl/Cmd+K (`:54-64`). Record group `"Recent Households (District)"`: query key `["households", "search", district]`, `getHouseholdsByDistrict(district)` with `district = user?.location ?? DEFAULT_DISTRICT` (env `VITE_DEFAULT_DISTRICT`) and no FY, enabled only while open and district truthy (`:52,72-76`); shows only the **first 10** households (`:152`), label `caregiver_name || name || "Unknown Caregiver"` + `"HH ID: <id>"`, id from `household_id`, `householdId`, `hh_id`, `unique_id`, `id` (`:153-154,164-166`); select → `navigate("/profile/household-details", { state: { id } })` (`:158`). cmdk only filters those 10 rendered items, so legacy search cannot find most households. **QUESTION** Caregiver names are shown here although other pages label them "Confidential" (`legacy:src/lib/utils.ts:8-16`); confirm whether the new search may match/display caregiver names (Phase 4 says "by name or ID").
- [ ] **Scope helper not used.** `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts:5-17`) uses substring rules (`description.includes("district")`, `"provincial"`/`"province"`, admin = `includes("admin")` or `=== "ecap+ support"`) that differ from the exact `=== "District User"` / `=== "Provincial User"` checks in these pages. The rebuild should use the single `core/access` scope (mirrors backend `deriveScope`, AUDIT.md §3.1).
- [ ] **Storage keys touched by these flows:**
  - IndexedDB `ecap_plus_cache_db` / store `api_cache` (`legacy:src/lib/indexedDbCache.ts:6-7`): `households_by_district:ALL[:<from>_<to>]` (`legacy:src/lib/api.ts:305-308`), `household_services_by_district:ALL` (`legacy:src/lib/api.ts:421-422`).
  - IndexedDB React Query persister key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`) — persists all three registers' data.
  - localStorage `ecap_plus_pmp.fy_filter_state_v2` (FY state) (`legacy:src/context/FyFilterContext.tsx:12,64`).
  - sessionStorage `ecap_last_household_id` written by the profile target page (`legacy:src/pages/HouseholdProfile.tsx:143,146`).
  - None of the registers' own filters (district, search, sub-populations, reason, page) are persisted.
- [ ] **Timers:** none in the three pages. staleTime overrides: 10 min (`legacy:src/pages/HouseholdRegister.tsx:112`; `legacy:src/pages/HouseholdArchivedRegister.tsx:134`; `legacy:src/pages/HouseholdRiskRegister.tsx:117`), 30 min (`legacy:src/pages/HouseholdRiskRegister.tsx:90`). IndexedDB list TTLs 60 s / 5 min (`legacy:src/lib/api.ts:8,14`). Indirect: `EtlInvalidator` polling invalidates all non-`etl` queries (`legacy:src/components/EtlInvalidator.tsx:54-57,75-79`).
- [ ] **Program strings to move to config:** sub-population labels `CALHIV`, `HEI`, `CWLHIV`, `AGYW`, `C/SV`, `CFSW`, `ABYM` (`legacy:src/pages/HouseholdRegister.tsx:45-53`; `legacy:src/pages/HouseholdArchivedRegister.tsx:52-60`); de-registration reasons incl. `"Transferred to other OVC program"` (`legacy:src/pages/HouseholdArchivedRegister.tsx:64-73`); domains Health / Schooled / Safe / Stable and their service columns (`legacy:src/pages/HouseholdRiskRegister.tsx:48-54`); "programme" wording (`legacy:src/pages/HouseholdArchivedRegister.tsx:420-421`).
- [ ] No modals, forms, mutations or toasts on any of the three pages.

### The profile page draft

### Flag form (tab "FLAG RECORD FORM", `:1391-1534`)
- [ ] Heading "Record New Flag" with a Flag icon.
- [ ] **Schema** (`:93-99`):
  - `category`: optional string.
  - `severity`: optional string.
  - `comment`: required, `min(10)`, with the message **"Flag observations must be at least 10 characters long."**
  - Default values are all `""` (`:266-273`).
- [ ] **"Flag category"** Select. Placeholder "Choose category...(optional)". Options (value → label) in order:
  - `"Missing Data"` → "Missing data"
  - `"Invalid Data"` → "Invalid data"
  - `"Duplicate Record"` → "Duplicate record"
  - `"Incorrect Service"` → "Incorrect service logging"
  - `"Case Plan Mismatch"` → "Case plan mismatch"
  - `"Other"` → "Other"

  (`:1419-1446`)
- [ ] **"Priority severity"** Select. Placeholder "Select severity... (optional)". Options:
  - `"Low"` → "Low severity"
  - `"Medium"` → "Medium severity"
  - `"High"` → "High severity"
  - `"Critical"` → "Critical issue"

  (`:1460-1483`)
- [ ] **"Flag observations & action details"** Textarea. Placeholder "Provide detailed observations about the data quality issue, any suspected causes, and recommended immediate actions..." (`:1495-1503`).
- [ ] Footer note: "Submitted flags will be reviewed by district monitors within 24 hours." (see the QUESTION above).
- [ ] Submit button: "Submit flag record". While pending it is disabled and shows "Submitting..." with `LoadingDots` (`:1516-1529`).
- [ ] **Payload** (`:331-349`):
  ```
  { household_id: id,
    caseworker_phone: household.caseworker_phone || "N/A",
    caseworker_name: household.caseworker_name || household.cwac_member_name || "N/A",
    caregiver_name: household.caregiver_name || "N/A",
    facility: household.facility || household.health_facility || "N/A",
    comment, category, severity,
    verifier: `${user.first_name} ${user.last_name}` (or "Unknown Verifier"),
    status: "pending" }
  ```
  - No `vca_id`, no `flagged_by`, and no district/province.
  - `household_id` is the raw route id, not `household.household_id`.
  - Empty category and severity are sent as `""`.
  - **QUESTION:** add `district` / `province` so that flags can be scoped on the backend (**Backend ask**: Directus permission on `flagged_forms_ecapplus_pmp`, AUDIT.md §3.3 item 9).
- [ ] **On success** (`:277-292`):
  1. Invalidate `["flagged-records"]`.
  2. Fire `notifyUsersOfFlag(id || "N/A", verifier, comment)` **without awaiting it**. Its errors are swallowed by `Promise.allSettled`.
  3. Toast success: "Flag submitted successfully", description "The record has been flagged for review."
  4. `form.reset()`.
- [ ] **On error** (`:293-297`): toast error "Submission failed", with the description `err.message || "Please try again later."`.

### Resolve flag (`:300-329,1565-1573`)
- [ ] Each card in "Active attention required" has a "Resolve" button. It calls `updateFlagStatus(flag.id, "resolved")`, then, if the flag is found in `householdFlags`, **awaits** `notifyUsersOfFlagResolution(String(record.household_id ?? ""), resolver, "Resolved from Household profile.", String(record.vca_id ?? ""))`.
- [ ] **On success:** invalidate `["flagged-records"]`, then toast "Flag resolved" with the description "Caseworker and admins have been notified."
  - **QUESTION:** the caseworker is not notified. Recipients are role-filtered admins and supervisors only (next item), so the description is inaccurate.
- [ ] **On error:** toast "Failed to resolve flag" with the description `err.message`. If the PATCH succeeded but the notification failed, the user sees an error even though the flag is resolved.
- [ ] While any resolve is pending, **every** Resolve button is disabled (shared `resolveMutation.isPending`).
- [ ] There is no confirmation dialog and no permission check.

### Flag notifications (`legacy:src/lib/directus.ts:635-709`)
- [ ] Recipients: `listUsers("active")`, which fetches **every** active user with `limit=-1` (`:79-100`), then a client-side filter `isFlagNotifyRecipient`. A user qualifies when `role.name` (lower-cased) **contains** any of `["admin","administrator","supervisor","qa","data quality","manager"]` (`:638-655`).
  - This is a role-name comparison, so in the new code it must move behind `core/access` or, better, to the backend (a Directus Flow on create/update).
  - **Backend ask:** server-side notification on flag create/resolve. The browser should not list all users.
- [ ] Entity label: `vcaId && vcaId !== "Not Available" ? "VCA {vcaId} (HH {hhId})" : "Household {hhId}"` (`:665-668,692-695`).
- [ ] On create: subject `Record Flagged: {entity}`; message `A record for {entity} has been flagged by {verifier}. \n\nComment: {comment}` (`:669-670`).
- [ ] On resolve: subject `Flag Resolved: {entity}`; message `The flag for {entity} has been resolved by {resolver}. \n\nResolution/Comment: {comment}` (`:696-697`).
- [ ] Each recipient gets one `POST /notifications` with `{recipient, subject, message, collection:"flagged_forms_ecapplus_pmp"}`. No `item` is sent, so a notification cannot deep-link to the flag. **QUESTION:** send `item`?

### Storage
- [ ] `sessionStorage["ecap_last_household_id"]`: written at `:143`, read at `:146`. **Drop it** (route param).
- [ ] IndexedDB `ecap_plus_cache_db` / `api_cache`, keys `households_by_district:<district|ALL>` and `children_by_district:<district|ALL>` (via the wrappers, `legacy:src/lib/api.ts:305-310,372-377`).
- [ ] React Query persisted cache (IndexedDB, key `ecap-plus-pmp-react-query`, 24 h; `legacy:src/App.tsx:136-161,214-224`). It includes `["flagged-records"]`, `["household-members",id]`, services, case plans and referrals.

### Timers / polling / browser APIs
- [ ] No page-specific timers or polling. Refresh comes from the global `refetchOnWindowFocus`/`refetchOnMount` with a 60 s `staleTime` (`legacy:src/App.tsx:126-131`), plus `EtlInvalidator` invalidating every query after an ETL run (shell).
- [ ] Decorative: a pulsing blurred hero background (`animate-pulse`, 6 s / 8 s, `:478-479`), a fade-in on mount (`:473`) and hover lift on the stat cards. Per the UI rules, this animation is decorative and can be dropped.

### Keyboard
- [ ] No page shortcuts. Global ⌘/Ctrl+K opens GlobalSearch, which links here (shell).

---

## Open questions for the developer

### The registers draft

1. Does `all_households` actually carry `calhiv`, `hei`, `cwlhiv`, `agyw`, `csv`, `cfsw`, `abym`, and in what value format? The backend only uses these on `children` (and derives household CWLHIV from `caregiver_hiv_status`). If they are missing, should the household sub-population filters be derived differently (e.g. from members), or dropped?
2. Should sub-population "yes" also accept `"Yes"`/`"TRUE"` (case-insensitive), as the backend counts do?
3. Are the eight de-registration reasons exactly the stored values (exact, case-sensitive backend match)? Should the list come from program config?
4. Until the backend enforces scope: should the new register call the endpoint with the user's district/province districts (comma list) instead of `""`, so scoped users no longer download the national register?
5. Should the household register data be excluded from IndexedDB persistence (`meta: { persist: false }`), since it carries caregiver details?
6. Risk register: keep the 100-row cap or paginate like the other registers? Should it get sub-population filters and a province restriction like the other two? Should services be FY-scoped?
7. Risk register is orphaned in legacy. Add a nav/entry point in the rebuild (e.g. from household services or the register), or keep it URL-only?
8. Archived register: add `?district=` URL support for parity with the active register (all filters will be URL-synced via `platform/filters` anyway)?
9. Export column sets differ from the visible columns (active exports `Screened` and `Last Service Date`, which are not shown; no sub-population columns). Keep the legacy column sets exactly?

### The profile page draft

1. Scope: should provincial users be limited to their province on the profile (legacy gives them national access at `:151-152`, unlike `useEffectiveDistrict`)? And should an out-of-scope household id show "not found" (the legacy state fallback bypasses scope)?
2. There is no single-household endpoint: the new page must still find the household in the active and archived register lists, which are national for most users. Should the backend add `GET /household/:household_id`? (**Backend ask.**)
3. Flags: filter server-side by `household_id`. Should "Flagging history" include resolved flags with their real status? Who may raise or resolve a flag (permissions)?
4. Referrals "Export" button: implement it (CSV via `platform/export`) or remove it?
5. The hero "View Household Profile" button links to itself: remove it?
6. PII masking of caregiver name and phone: is it a fixed rule, a config flag, or a permission? Should the caseworker phone be masked too?
7. The `"PCZ"` partner fallback and the "within 24 hours" review promise: move them to `@/config` or drop them?
8. Case-plan vulnerabilities: keep the "show all domains when no date matches" fallback?
9. The "{n} VCAs" badge: count active VCAs from the members response instead of loading the national VCA register?
10. Notifications: move recipient selection to a Directus Flow (server-side)? Fix the resolve toast copy, which says "Caseworker … notified"?
11. Confirm the `caregiver_services` fields `is_hiv_positive` and `vl_last_result`, and the referral fields (`referred_date`, name/status columns), against the fixtures before writing the zod schemas.
