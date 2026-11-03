# households — legacy audit (part: registers)

> New module `households` · Legacy routes → new routes: `/households` → `/households`; `/households/archived` → `/households/archived`; `/registers/household-risk` → `/households/risk`; (`/profile/household-details` → `/households/:householdId` is covered by the profile part) · Plan: MIGRATION_PLAN.md §5 row "households" ("Pilot module (Phase 4). Profile ≈2,000 lines → split into tabs/sections")
>
> This part covers the three **list** pages: the active register (`HouseholdRegister`, the Phase 4 pilot), the archived register (`HouseholdArchivedRegister`) and the household domain-gap ("risk") register (`HouseholdRiskRegister`). The household profile page is in the other part of this module. Phase 4 "done" criteria (MIGRATION_PLAN.md §Phase 4): columns, filters incl. sub-populations, export contents, filter state in URL, global search by name or ID.

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

---

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
- [ ] Header: the global search box and FY filter are shown on this route (it is not in `HIDDEN_ROUTES`, `legacy:src/components/dashboard/DashboardHeader.tsx:35-43,86`).
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

## Other behaviour

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

## Open questions for the developer

1. Does `all_households` actually carry `calhiv`, `hei`, `cwlhiv`, `agyw`, `csv`, `cfsw`, `abym`, and in what value format? The backend only uses these on `children` (and derives household CWLHIV from `caregiver_hiv_status`). If they are missing, should the household sub-population filters be derived differently (e.g. from members), or dropped?
2. Should sub-population "yes" also accept `"Yes"`/`"TRUE"` (case-insensitive), as the backend counts do?
3. Are the eight de-registration reasons exactly the stored values (exact, case-sensitive backend match)? Should the list come from program config?
4. Until the backend enforces scope: should the new register call the endpoint with the user's district/province districts (comma list) instead of `""`, so scoped users no longer download the national register?
5. Should the household register data be excluded from IndexedDB persistence (`meta: { persist: false }`), since it carries caregiver details?
6. Risk register: keep the 100-row cap or paginate like the other registers? Should it get sub-population filters and a province restriction like the other two? Should services be FY-scoped?
7. Risk register is orphaned in legacy. Add a nav/entry point in the rebuild (e.g. from household services or the register), or keep it URL-only?
8. Archived register: add `?district=` URL support for parity with the active register (all filters will be URL-synced via `platform/filters` anyway)?
9. Export column sets differ from the visible columns (active exports `Screened` and `Last Service Date`, which are not shown; no sub-population columns). Keep the legacy column sets exactly?
