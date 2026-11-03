# vcas — legacy audit (part: registers)

> New module `vcas` · Legacy routes → new routes: `/vcas` → `/vcas`; `/vcas/archived` → `/vcas/archived`; `/registers/vca-risk` → `/vcas/risk`; `/profile/vca-details` → `/vcas/:vcaId` (profile is covered by another part) · Plan: MIGRATION_PLAN.md §5 row "vcas"
>
> This part covers the three register pages only. The VCA profile page (`legacy:src/pages/VcaProfile.tsx`) is audited in a separate part; it is referenced here only where the registers link to it.

## Legacy files

| File | Lines | Role |
|---|---|---|
| `src/pages/VcaRegister.tsx` | 686 | Active VCA register page (`/vcas`). Read in full. |
| `src/pages/VcaArchivedRegister.tsx` | 893 | Archived (de-registered / graduated) VCA register (`/vcas/archived`). Read in full. |
| `src/pages/VcaRiskRegister.tsx` | 396 | VCA domain-gap ("risk") register (`/registers/vca-risk`). Read in full. Only inbound links come from the unreferenced `VcaServicesDashboard` page. |
| `src/components/dashboard/SubPopulationFilter.tsx` | 67 | Shared tri-state (all/yes/no) sub-population filter grid used by `/vcas` and `/vcas/archived`. Read in full. |
| `src/lib/data-validation.ts` | 70 | `isCategoryProvided` — decides whether a service row "provided" a domain. Read in full. |
| `src/lib/api.ts` | 1486 | Read `:1-540` — `dqaGet`, `getListValue`, `getListFromApiWithCache`, `fyQs`, `getChildrenByDistrict`, `getChildrenArchivedRegister`, `getVcaServicesByDistrict`. |
| `src/lib/utils.ts` | 64 | Read `:18-27` (`toTitleCase`, `toSentenceCase`). |
| `src/context/FyFilterContext.tsx` | 122 | FY filter provider (`resolved.fromDate/toDate/mode`), localStorage + URL sync. Read in full. |
| `src/App.tsx` | 602 | Route table + QueryClient defaults + persister. Read `:1-236` and the VCA route blocks `:277-282`, `:326-331`, `:398-403`, `:462-467`. |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard. Read in full. |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar nav + visibility filter. Read in full. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile bottom nav. Read in full. |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Mobile sheet menu (`mobileMenuItems`) + page subtitle. Read `:25-110`. |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Cmd/Ctrl-K palette: nav entries + VCA record links. Read in full. |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Shared district-scope hook. Read in full. **Not used by any of the three register pages.** |
| `src/components/EtlInvalidator.tsx` | 90 | Global ETL poll that invalidates all non-`etl` queries. Read relevant lines (`:28-79`). |
| `src/lib/indexedDbCache.ts` | 92 | IndexedDB list cache used by `getListFromApiWithCache`. Read `:1-30`. |
| `src/pages/VcaProfile.tsx` | 1807 | Read `:186-215`, `:415-426` only (how it reads the id; "Back to Register" link). |
| `src/pages/VcaServicesDashboard.tsx` | 954 | **Unreferenced** page (never imported/routed; port per decision). Read `:218-232`, `:670-720` (links into `/registers/vca-risk`). |
| `src/components/dashboard/MetricsGrid.tsx` | 252 | Read `:100-115`, `:185-215` (VCAs KPI card links to `/vcas`). |
| `src/pages/HouseholdProfile.tsx` | 1964 | Read `:1068-1082` (link to VCA profile). |
| `src/pages/MotherIndexDetails.tsx` | 264 | Read `:240-248` (link to VCA profile). |

---

## Route `/vcas` → `/vcas`

### Purpose
Register of **active** VCAs (children & adolescents) with district selector, free-text search, 14 tri-state sub-population filters, client-side pagination (50/page) and CSV export. Header copy: eyebrow "VCA register", badge "Active VCAs ─ {n} records", title "Children & adolescents", badge "Demographics · Services · Status", help text "Only active VCAs are shown. Use the filters to drill down by sub-population." (`legacy:src/pages/VcaRegister.tsx:387-406`). Layout subtitle `"VCA Register"` (`legacy:src/pages/VcaRegister.tsx:376`).

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:277-282`). `ProtectedRoute` returns `null` while auth loads, redirects to `/` when no user, and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`).
- [ ] Sidebar: section "Registers", item `{ title: "VCAs", url: "/vcas", icon: Users }` (`legacy:src/components/dashboard/AppSidebar.tsx:59`). No item-specific rule; the only filters are `item.url === "/districts" && isDistrictUser`, `section.label === "Admin" && !isAdmin`, `section.label === "Data Pipeline" && !isAdmin && !isSupport` (`legacy:src/components/dashboard/AppSidebar.tsx:166-173`) — so visible to every logged-in user. Active state is exact-path match (`:183`).
- [ ] Mobile bottom nav: no `/vcas` entry ("Registers" points to `/households`) (`legacy:src/components/dashboard/MobileBottomNav.tsx:8`). Mobile sheet menu: `{ title: "VCA Register", url: "/vcas" }` (`legacy:src/components/dashboard/DashboardLayout.tsx:37`), unconditional.
- [ ] Global search nav entry: `{ title: "VCA Register", url: "/vcas", category: "Navigation" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:37`), unconditional.
- [ ] In-page role checks (all string comparisons; port to `can()`/scope):
  - `const isDistrictUser = user?.description === "District User"` (`legacy:src/pages/VcaRegister.tsx:128`)
  - `const isProvincialUser = user?.description === "Provincial User"` (`:129`)
  - `const userProvince = user?.title` (`:130`)
  - `const lockedDistrict = isDistrictUser && user?.location ? user.location : null` (`:135`)
  - District Select: `disabled={!!lockedDistrict}`, `onValueChange` returns early when locked, and the "All Districts" option is hidden when locked (`:410-427`).
  - Re-enforce lock effect: `if (lockedDistrict && selectedDistrict !== lockedDistrict) setSelectedDistrict(lockedDistrict)` with deps `[lockedDistrict]` (`:148-152`).
  - Provincial users: rows and district options filtered by `v.province !== userProvince` (exact, case-sensitive) (`:174`, `:205`).
- [ ] Data scope: the API is **always** called with `""` (all districts, national) regardless of role (`legacy:src/pages/VcaRegister.tsx:163`); district/province restriction is purely client-side. `useEffectiveDistrict` is not used. **BUG** (security): district and provincial users download the national register (record in PROGRESS.md "Backend asks": `/child/vcas-assessed-register` trusts the district param — AUDIT.md §3.2).

### Endpoints
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2) — wrapper `getChildrenByDistrict` (`legacy:src/lib/api.ts:368-379`).
  - Params as sent: district `""` → URL `/child/vcas-assessed-register/` (`legacy:src/pages/VcaRegister.tsx:163`); `?from=&to=` appended only when both FY bounds exist (`legacy:src/lib/api.ts:241-245`; `fyArg` built at `legacy:src/pages/VcaRegister.tsx:156`).
  - Fires on mount, always enabled. React Query key `["vcas", "All", fyKey]` where `fyKey = fy.mode === "all" ? "all" : \`${fromDate}_${toDate}\`` (`:157`, `:162`). `staleTime: 1000 * 60 * 10` (`:164`). Global defaults otherwise: gcTime 24 h, retry 1, refetch on mount/focus/reconnect (`legacy:src/App.tsx:112-131`); result persisted to IndexedDB for 24 h (`legacy:src/App.tsx:136-145`, `:214-224`).
  - Extra client cache: IndexedDB `ecap_plus_cache_db`/`api_cache` key `children_by_district:ALL[:<from>_<to>]`, 60 s TTL, stale value returned on fetch error (`legacy:src/lib/api.ts:212-238`, `:372-377`).
  - Response unwrapped by `getListValue` (first array in `data`/`results`/... or any array) (`legacy:src/lib/api.ts:116-183`).
  - Post-processing: province guard, district filter, search, sub-population filters, then sort (see below) (`legacy:src/pages/VcaRegister.tsx:193-265`).

### Fields used
| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
|---|---|---|---|
| id | `uid`, `unique_id`, `vca_id` (`pickValue`, `:575`); fallback `"N/A"` (`:82`) | "Unique ID" column, mobile cell, row key, View link payload | Bold chip; mobile mono |
| gender | `vca_gender`, `gender` (`:594`, `:604`) | Gender column; mobile shows first char | raw string; `"N/A"` fallback |
| birthdate | `birthdate` (`:595`, `:607`) | Age column computed by `calculateAge` | integer years; **0 when missing/unparseable** (`:86`, `:116`) |
| homeaddress, facility, province, district, ward | direct keys (`:359-368`) | "Household details" column: lines `Address: …`, `Facility: …`, `Province: …`, `District: …`, `Ward: …` joined by `\n`, empty parts skipped, `line-clamp-2` | — |
| facility | `facility` (`:599`) | Mobile cell, fallback text `"No Facility"` | italic |
| province | `province` | Provincial-user guard (`:174`, `:205`); search | exact compare |
| district | `district` | District options (title-cased) and filter (`:175-181`, `:210-213`); search | `toTitleCase(raw.trim())` for options |
| uid | `uid` | Search (`:230`) | lowercased |
| sub-population flags | `calhiv`, `hei`, `cwlhiv`, `agyw`, `csv`, `cfsw`, `abym`, `child_adolescent_in_aged_headed_household`, `child_adolescent_in_chronically_ill_headed_household`, `child_adolescent_in_child_headed_household`, `child_adolescent_living_with_disability`, `child_adolescent_in_female_headed_household`, `under_5_malnourished`, `pbfw` (`:47-73`) | Filters only | truthy = `"1"`/`"true"`/`1`/`true` |
| sort key | `household_id` ‖ `vca_id` ‖ `id` (`:253-254`) | Default sort | string desc |
| export-only | `birthdate`, `last_service_date`, `virally_suppressed` (`:317`, `:323-324`) | CSV | raw |

`calculateAge` (`legacy:src/pages/VcaRegister.tsx:85-123`) parses in order: `D-M-YYYY` (day first), `YYYY-M-D`, `M/D/YYYY` (**month first**), then `Date.parse` fallback; age = full years before today.

### Filters / sort / pagination / search
- [ ] **District** — Select in hero (`:410-432`). Options: `"All Districts"` (value `All`, hidden when locked) + districts **derived from the loaded data**: `toTitleCase(raw.trim())`, grouped so case variants map to one option, sorted alphabetically; provincial users only see districts of rows whose `province === user.title` (`:168-190`). Default: locked district, else URL `?district=` param, else `"All"` (`:137-139`). URL is read once on mount, never written. Applied to table, export, record-count badge. Matching: row's `String(district).trim()` must be in the variant list for the selected label (`:197-213`).
- [ ] **Sub-population** — `SubPopulationFilter` grid with heading "Sub-population", each label with three buttons `all` / `yes` / `no` (`legacy:src/components/dashboard/SubPopulationFilter.tsx:19-57`). Labels in order (exact): `calhiv: 'C/ALHIV'`, `hei: 'HEI'`, `cwlhiv: 'C/WLHIV'`, `agyw: 'AGYW'`, `csv: 'C/SV'`, `cfsw: 'CFSW'`, `abym: 'ABYM'`, `caahh: 'CAAHH'`, `caichh: 'CAICHH'`, `caich: 'CAICH'`, `calwd: 'CALWD'`, `caifhh: 'CAIFHH'`, `muc: 'MUC'`, `pbfw: 'PBFW'` (`legacy:src/pages/VcaRegister.tsx:47-62`). Data-key mapping in `filterKeyToDataKey` (`:65-73`, see Fields). Default all `"all"`. `yes` keeps `"1"|"true"|1|true`; `no` keeps `"0"|"false"|0|false|null|undefined` (`:238-248`) — other values (e.g. `"yes"`, `"Yes"`) match neither. All filters ANDed. Not persisted. Applied to table and export. Sub-populations must come from `@/config` (program config).
- [ ] **Search** — Input placeholder `"Search by ID, name, or facility…"` (`:456`). Case-insensitive substring over: `uid`; `[homeaddress, facility, province, district, ward]` joined by space; `vca_gender` (`:216-235`). No debounce, not persisted.
- [ ] **Clear** button — label "Clear" + count badge; count = active sub-population filters + (search ? 1 : 0) (district not counted); disabled when 0; resets search + sub-population filters, **not** district (`:299-305`, `:462-482`). `SubPopulationFilter` receives `onClear` but never renders/uses it (`legacy:src/components/dashboard/SubPopulationFilter.tsx:11-16`).
- [ ] **Active chips** row (label "Active"): `District: {name}` (only when not All and not locked; clear → All), `{LABEL}: {yes|no}` per sub-population filter, `Search: "{q}"`; clicking a chip clears it (`:494-544`).
- [ ] **Sort**: fixed, descending `localeCompare` on `household_id || vca_id || id` (`:252-256`). No sortable columns. **QUESTION**: sort ignores `uid`, so rows with the same household are not ordered by VCA; archived page sorts by `uid` first — unify?
- [ ] **Pagination**: client-side, 50 per page (`ITEMS_PER_PAGE`, `:44`), page reset to 1 when search/sub-pop/district change (`:268-270`). Footer "Showing {start} to {end} of {total} entries" (`:636-640`). Page buttons: ≤5 pages all shown; else `1 2 3 4 … N` / `1 … N-3 N-2 N-1 N` / `1 … p-1 p p+1 … N` (`:277-292`). Prev/Next disabled at bounds (`:646-672`). Pager hidden when 1 page.
- [ ] **FY filter** (global, from header chip via `useFyFilter`): sent to API as cohort window and part of the query key (`:155-165`).

### Exports
- [ ] **CSV** — button "Export CSV" in hero, disabled when 0 filtered rows (`:434-441`). Rows: **all filtered rows** (district + province guard + search + sub-pop; not just current page) (`:310-311`, `:332`). Columns in order (header → raw key, no fallbacks) (`:314-325`):
  1. `Unique ID` → `uid`
  2. `Gender` → `vca_gender`
  3. `Birth Date` → `birthdate`
  4. `Home Address` → `homeaddress`
  5. `Facility` → `facility`
  6. `Province` → `province`
  7. `District` → `district`
  8. `Ward` → `ward`
  9. `Last Service Date` → `last_service_date`
  10. `Virally Suppressed` → `virally_suppressed`
  
  Every cell quoted with `"` doubled (`:327-328`); rows joined `\n`; UTF-8 BOM prepended (`:345`). Filename: `` `vcas_${districtLabel}_${dateLabel}.csv` `` where `districtLabel = "all_districts"` or the selected district with whitespace → `_`, `dateLabel = new Date().toISOString().slice(0, 10)` (`:338-343`). Native Blob + anchor download, no library (`:345-352`). Errors only `console.error` (`:353-355`). Must move to `platform/export`.
  - **QUESTION**: export uses raw `uid`/`vca_gender` while the table falls back to `unique_id`/`vca_id`/`gender`; port with the normalised fields.

### Charts
- [ ] No charts. Only KPI-like badge "Active VCAs ─ {filteredVcas.length.toLocaleString()} records" (count after all filters) (`:393`) and a hero date `new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })` (`:370-372`) — format must come from `core/lib/format.ts`.

### Links in / out
- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:59`); mobile sheet menu (`legacy:src/components/dashboard/DashboardLayout.tsx:37`); global search (`legacy:src/components/dashboard/GlobalSearch.tsx:37`); dashboard KPI card "VCAs" (`to: "/vcas"`, `navigate(to)`, no payload) (`legacy:src/components/dashboard/MetricsGrid.tsx:200`, `:112`); VCA profile not-found "Back to Register" (`legacy:src/pages/VcaProfile.tsx:422`). No producer of `/vcas?district=` was found (grep), though the page reads it (`legacy:src/pages/VcaRegister.tsx:138`).
- [ ] Out: row button "View" → `navigate("/profile/vca-details", { state: { id: String(id) } })` (`legacy:src/pages/VcaRegister.tsx:615-624`). The profile then stores it in sessionStorage `ecap_last_vca_id` (`legacy:src/pages/VcaProfile.tsx:189-196`). New: `/vcas/:vcaId` route param.

### Loading / empty / error
- [ ] Loading: table row with `LoadingDots` spinner while `vcasQuery.isLoading` (`:559-566`). New: skeletons.
- [ ] Empty: table row "No VCAs found matching criteria." (`:567-572`). New: `<EmptyState>`.
- [ ] Error: **BUG** — `isError` is never checked; a failed fetch renders the empty message (unless the IndexedDB stale cache masks it) (`:559-573`). New: `<ErrorState>` with retry.
- [ ] District dropdown is empty while loading because options come from the same data (`:168-190`).

### Bugs and quirks
- [ ] **BUG** National data downloaded for every role; district/province restriction is client-side only (`legacy:src/pages/VcaRegister.tsx:163`, `:174`, `:205`). Port: send the scoped district from `platform/scope`; backend ask.
- [ ] **BUG** Search placeholder promises "name" but no name field is matched (`:456` vs `:216-235`).
- [ ] **BUG** Gender search is substring, so `male` also matches `female` (`:232`).
- [ ] **BUG** `vca.uid?.toLowerCase()` throws if `uid` is numeric (`:230`).
- [ ] **BUG** Missing/unparseable birthdate shows age `0` instead of "N/A" (`:86`, `:116`, `:595`, `:607`).
- [ ] **QUESTION** `calculateAge` treats `x/y/YYYY` as month/day (US) but `x-y-YYYY` as day/month (`:90-106`). Confirm source date formats.
- [ ] **BUG** District variant matching compares a trimmed row value against untrimmed stored variants, so a district stored with surrounding whitespace never matches its own option (`:181` vs `:211-212`).
- [ ] **BUG** Locked district (`user.location`) is used verbatim; if its casing differs from the title-cased option labels the Select shows no matching option and the variant lookup falls back to an exact match (`:135`, `:137-139`, `:200`).
- [ ] **QUESTION** Sub-population "no" treats `null`/`undefined` as "no" but other non-truthy strings (`""`, `"No"`) match neither yes nor no (`:245-247`).
- [ ] Filter state (district, search, sub-pop, page) is not in the URL; new app must sync via `platform/filters`.

---

## Route `/vcas/archived` → `/vcas/archived`

### Purpose
Register of **archived** VCAs (closed/inactive, de-registered or graduated), with district selector, server-side de-registration reason filter, search, 14 sub-population filters, pagination (50/page) and CSV export. Copy: eyebrow "Archived VCAs", badge "Deregistered ─ {n} records", title "Graduated & exited VCAs", badge "Closed cases", help text "Children & adolescents who have been deregistered or graduated out of the programme." (`legacy:src/pages/VcaArchivedRegister.tsx:468-495`). Layout subtitle `"VCA Archived Register"` (`:457`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:398-403`).
- [ ] Sidebar: section "Archived", item `{ title: "VCAs", url: "/vcas/archived", icon: Archive }` (`legacy:src/components/dashboard/AppSidebar.tsx:73`); no item-specific rule (same filter as above, `:166-173`). Mobile bottom nav: none (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). Mobile sheet: `{ title: "VCA Archived Register", url: "/vcas/archived" }` (`legacy:src/components/dashboard/DashboardLayout.tsx:42`). Global search: `{ title: "VCA Archived", url: "/vcas/archived" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:42`).
- [ ] In-page role checks:
  - `user?.description === "District User"` (`legacy:src/pages/VcaArchivedRegister.tsx:138`)
  - `user?.description === "Provincial User"` (`:139`); `userProvince = user?.title` (`:140`)
  - `lockedDistrict = isDistrictUser && user?.location ? user.location : null` (`:144-145`)
  - Lock re-enforce effect, deps `[lockedDistrict]` (`:153-157`); Select disabled/early-return/"All Districts" hidden when locked (`:499-516`).
  - Provincial guard `h.province !== userProvince` / `vca.province !== userProvince` (`:197`, `:229`).
- [ ] Data scope: API always called with `""` (national) (`:184`); filtering client-side. **BUG** (same as `/vcas`).

### Endpoints
- [ ] `GET /child/vcas-archived-register/:district(*)` (AUDIT.md §3.2) — wrapper `getChildrenArchivedRegister` (`legacy:src/lib/api.ts:388-408`), **no IndexedDB cache**.
  - Params as sent: district `""`; `reason=<graduationFilter>` only when not `"all"`; `from`/`to` when both FY bounds exist (`legacy:src/pages/VcaArchivedRegister.tsx:183-187`; `legacy:src/lib/api.ts:392-404`). Backend matches `reason` exactly and case-sensitively (AUDIT.md §3.2), so the option strings below must be sent verbatim.
  - Fires on mount and whenever reason or FY changes. Key `["vcas", "archived", "All", graduationFilter, fyKey]` (`:182`); `staleTime: 1000 * 60 * 10` (`:188`). Global defaults as above.
  - Post-processing: province guard, district, search, sub-pop filters, sort (`:218-288`).

### Fields used
| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
|---|---|---|---|
| id | `uid`, `unique_id`, `vca_id`, `vcaid`, `id`, `child_id` (`:736-743`, `:372-379`); fallback `"N/A"` | "Unique ID" column, mobile, View payload, export "VCA ID" | chip |
| gender | `vca_gender` only (`:765`, `:781`) | Gender column (`"N/A"` fallback); mobile first char or `"?"` | raw |
| age | `birthdate` → `calculateAge` (`:744`) | Age column, mobile, export "Age" | integer; 0 when missing |
| address block | `homeaddress`, `facility`, `province`, `district`, `ward` (`:437-446`) | "Household details" column (same `Label: value` lines as `/vcas`) | `text-[10px]`, line-clamp-2 |
| archived date (table) | `de_registration_date`, `archived_on`, `date_archived`, `updated_at` (`:770-775`, `:792-797`) | "Archived" column (md+), mobile "Archived: …" | **raw string, unformatted** |
| archived date (export) | `de_registration_date`, `archived_on`, `archivedOn`, `date_archived`, `updated_at` (`:391-397`) | CSV "Archived On" | raw |
| reason (table) | `de_registration_reason`, `reason`, `archived_reason` (`:801-805`) | "Reason" column (lg+), amber text | raw |
| reason (export) | `de_registration_reason`, `reason`, `archived_reason`, `case_status`, `status` (`:383-389`) | CSV "Reason" | raw |
| search keys | `uid`, `unique_id`, `vca_id`, `homeaddress`, `ward`, `facility` (`:243-248`) | Search | lowercased |
| sort key | `uid` ‖ `vca_id` ‖ `household_id` ‖ `id` (`:275-276`) | Default sort | string desc |
| sub-pop flags | same 14 keys/mapping as `/vcas` (`:52-77`) | Filters | same truthiness |

Per AUDIT.md §3.2 the backend column is `reason` (non-null in this register) and `de_registration_date` (non-null); the other candidates are guesses — normalise once in `api/schemas.ts`.

### Filters / sort / pagination / search
- [ ] **District** — identical behaviour to `/vcas` (options derived from archived data, title-cased, province-limited for provincial users; "All Districts"; locked for district users) (`:192-214`, `:221-237`, `:499-523`), **except** default is `lockedDistrict ?? "All"` — the URL `?district=` is **not** read (`:147-149`).
- [ ] **Reason (graduation) filter** — Select with GraduationCap icon; trigger text "All reasons" or the selected value (`:556-578`). Options in order (exact, sent to backend as `reason`) (`:79-88`):
  - `All reasons` (value `all`, default)
  - `Graduated (Household has met the graduation benchmarks in ALL domains)`
  - `Exited without graduation`
  - `Transferred to other OVC program`
  - `Lost to follow-up`
  - `Passed on`
  - `Aging without transition plan`
  - `Moved (Relocated)`
  - `Other`
  
  Server-side (refetch per value); not persisted. Applied to table, export, count. These are backend values / program domain terms → `@/config` (program config), not hardcoded.
- [ ] **Sub-population** — same 14 tri-state filters and matching rules as `/vcas` (`:52-77`, `:253-270`, `:607-612`).
- [ ] **Search** — placeholder `"Search by ID, name, or facility…"` (`:549`); case-insensitive substring on `uid`, `unique_id`, `vca_id`, `homeaddress`, `ward`, `facility` (`:240-250`). No debounce. (Different field set from `/vcas`: no province/district/gender.)
- [ ] **Clear** — count = sub-pop active + (reason ≠ all) + (search) + (district ≠ All and not locked) (`:581-586`); click resets search, sub-pop, reason, **not** district (`:338-348`).
- [ ] **Active chips** — `District: …` (not locked), `{LABEL}: yes|no`, `Reason: {value}`, `Search: "{q}"` (`:615-677`).
- [ ] **Sort** — fixed desc `localeCompare` on `uid || vca_id || household_id || id` (`:274-278`).
- [ ] **Pagination** — client-side, 50/page, same page-number algorithm and footer text as `/vcas`; reset to page 1 on search/sub-pop/reason/district change (`:50`, `:291-331`, `:831-885`).
- [ ] **FY** — global FY window sent as cohort filter, in query key (`:172-189`).

### Exports
- [ ] **CSV** — "Export CSV" button, disabled when 0 rows (`:525-532`). Rows: all filtered rows (`:353`, `:408`). Columns in order (`:356-367`):
  1. `VCA ID` → id candidates (above)
  2. `Gender` → `vca_gender`
  3. `Age` → `calculateAge(birthdate)`
  4. `Home Address` → `homeaddress`
  5. `Facility` → `facility`
  6. `Province` → `province`
  7. `District` → `district`
  8. `Ward` → `ward`
  9. `Archived On` → archived-date candidates (export list)
  10. `Reason` → reason candidates (export list)
  
  Quoting, BOM, Blob/anchor exactly as `/vcas` (`:403-430`). Filename `` `archived_vcas_${districtLabel}_${dateLabel}.csv` `` (`:414-419`). Errors `console.error("Error exporting data:", …)` only (`:431-433`). Missing values export as `"N/A"` for pickValue columns but `""` for direct keys (`:97`, `:399`).

### Charts
- [ ] None. Badge "Deregistered ─ {count} records" (`:477-478`), hero date en-GB long (`:448-453`).

### Links in / out
- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:73`), mobile sheet (`legacy:src/components/dashboard/DashboardLayout.tsx:42`), global search (`legacy:src/components/dashboard/GlobalSearch.tsx:42`). No other inbound links found (grep `/vcas/archived`). No payload.
- [ ] Out: "View" → `navigate("/profile/vca-details", { state: { id: String(id) } })` (`:808-820`). New: `/vcas/:vcaId` (profile must also resolve archived VCAs).

### Loading / empty / error
- [ ] Loading: `LoadingDots` row (`:708-715`).
- [ ] Error: inline red row with `(archivedQuery.error as Error).message` (`:716-724`); no retry button. New: `<ErrorState>` with retry.
- [ ] Empty: "No archived VCAs found matching the criteria." (`:725-733`).

### Bugs and quirks
- [ ] **BUG** National data for all roles; client-side scoping only (`:184`).
- [ ] **BUG** Clear-count includes the district but Clear does not reset it, so with only a district selected the button is enabled and does nothing (`:586` vs `:338-348`).
- [ ] **BUG** Table and export use different fallback lists for reason and archived date, so the CSV can disagree with the screen (`:770-805` vs `:383-397`); export reason may fall back to `case_status`/`status` (e.g. "closed").
- [ ] **BUG** Archived date shown raw/unformatted (`:792-797`); must go through `core/lib/format.ts`.
- [ ] **BUG** Age 0 for missing birthdate; `calculateAge` duplicated from `/vcas` (`:100-134`).
- [ ] **BUG** `?.toLowerCase()` on id/address fields throws for non-string values (`:243-248`).
- [ ] **BUG** Search placeholder mentions "name" but no name is matched (`:549`).
- [ ] **QUESTION** `/vcas` reads `?district=`, `/vcas/archived` does not (`:147-149`) — unify via URL filters.
- [ ] Inconsistent gender fallback vs `/vcas` (`vca_gender` only here) (`:781`).

---

## Route `/registers/vca-risk` → `/vcas/risk`

### Purpose
"Domain gap" register: lists active VCAs that have **never** received a service in a chosen domain (Health / Schooled / Safe / Stable), or that have services in **all four** domains ("Graduation ready"). Computed client-side by joining the national VCA register with the national VCA service rows. Layout subtitle `"Vca high-risk registry"` (`legacy:src/pages/VcaRiskRegister.tsx:227`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:326-331`).
- [ ] Not in sidebar, mobile bottom nav, mobile sheet menu or global search (grep of `AppSidebar.tsx`, `MobileBottomNav.tsx`, `DashboardLayout.tsx`, `GlobalSearch.tsx`). Only reachable from the unreferenced `VcaServicesDashboard` (see Links in) or by typing the URL.
- [ ] In-page role checks:
  - Initial district: `(user?.description === "District User" && user?.location) ? user.location : (searchParams.get("district") || "All")` (`:63-65`)
  - Lock effect: `if (user?.description === "District User" && user?.location && selectedDistrict !== user.location) setSelectedDistrict(user.location)`, deps `[user, selectedDistrict]` (`:75-79`)
  - District Select `disabled={user?.description === "District User"}` (`:273`) — "All districts" option still listed (`:279`).
  - **No provincial-user handling at all**: district options and rows are national for provincial users (`:88-102`, `:147-150`). **BUG** vs the other two registers.
- [ ] Data scope: all three queries call the API with `""` (national) (`:84`, `:115`, `:121`). **BUG** (security/perf, same backend ask).

### Endpoints
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2) — district discovery. Wrapper `getChildrenByDistrict("")` **without FY** (`:82-86`). Key `["vca-districts-discovery-reg"]`, `staleTime: 1000 * 60 * 30`. Used only to build the district dropdown (all districts, title-cased, grouped variants, sorted) (`:88-106`).
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2) — VCA list, `getChildrenByDistrict("", fyArg)` with FY `from`/`to` (`:113-117`). Key `["vca-vcas-risk-reg", "All", fyKey]`, `staleTime: 1000 * 60 * 10`. (Same endpoint fetched twice under two keys when FY = all time.)
- [ ] `GET /child/vca-services-by-district/:district(*)` (AUDIT.md §3.2) — wrapper `getVcaServicesByDistrict("")` (`legacy:src/lib/api.ts:499-506`; IndexedDB key `vca_services_by_district:ALL`, 5-min TTL, stale-on-error). **FY is not sent** (endpoint ignores it) though `fyKey` is in the query key (`:119-123`). Key `["vca-services-risk-reg", "All", fyKey]`, `staleTime: 1000 * 60 * 10`. Unbounded national dump.
- [ ] All fire on mount, always enabled. `isLoading = vcasQuery.isLoading || servicesQuery.isLoading` (`:125`).
- [ ] Client-side join/derivation (`:127-194`):
  - VCA id: `uid || unique_id || vca_id || child_id || id`, trimmed (`:134`).
  - Service → VCA key: `vca_id || vcaid || child_id || uid || id`, trimmed (`:141`). (Backend join column is `vcaid` — AUDIT.md §3.2.)
  - Per VCA: `hasHealth/hasSchooled/hasSafe/hasStable` = any of its service rows has `isCategoryProvided(row, "health_services" | "schooled_services" | "safe_services" | "stable_services")` (`:154-160`). `hiv_services` and `other_*_services` are ignored.
  - `isCategoryProvided` (`legacy:src/lib/data-validation.ts:10-69`): falsy → false; strings starting `[`/`{` are JSON-parsed; arrays are true if any element (trimmed, lowercased) is not one of `not applicable`, `none`, `null`, `n/a`, `na`, `no`, `false`, `0`, `""`; scalars are true unless (trimmed, lowercased) in `""`, `not applicable`, `n/a`, `na`, `none`, `no`, `false`, `0`, `[]`, `{}`, `null`; JSON parse failure → same scalar check.
  - Inclusion by `type`: `health_domain` ⇢ `!hasHealth`; `schooled_domain` ⇢ `!hasSchooled`; `safe_domain` ⇢ `!hasSafe`; `stable_domain` ⇢ `!hasStable`; `graduation_path` ⇢ all four (`:163-168`). VCAs with zero service rows are included in every "missing" type.
  - Adds `displayId` (`vId || "N/A"`), `has_health`, `has_schooled`, `has_safe`, `has_stable`, `domain_count` (0-4) (`:172-180`).
  - District filter on raw `String(v.district)` ∈ variants of selected label (`:132`, `:147-150`) — no trim.
  - **QUESTION**: VCA cohort is FY-scoped but services are all-time, so "missing" means "never had any service in this domain". Confirm intended metric (FY-scoped services?).

### Fields used
| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
|---|---|---|---|
| displayId | `uid`, `unique_id`, `vca_id`, `child_id`, `id` (`:134`) | "Child ID" column, search, export "VCA ID", View link | bold, nowrap; `"N/A"` |
| name | `name`, else `` `${first_name} ${last_name}`.trim() ``, else `"N/A"` (`:202`, `:345`); search uses `name || first_name` (`:189`) | "Vca name" column, export "VCA Name", search | **BUG**: backend columns are `firstname`/`lastname` (AUDIT.md §3.2), so this is effectively always "N/A" |
| district | `district` (`:148`, `:348`) | "District" column badge, search, export | raw |
| age | `age` (`:204`, `:351`) | "Age" column, export | raw backend text column; `"N/A"` when falsy (empty string/null/numeric 0) |
| service domains | service rows `health_services`, `schooled_services`, `safe_services`, `stable_services` (`:156-159`) | "Domain status" badges, export Yes/No | — |
| service VCA key | `vca_id`, `vcaid`, `child_id`, `uid`, `id` (`:141`) | join | trimmed string |

### Filters / sort / pagination / search
- [ ] **Risk type** — URL param `type`, default `"health_domain"` (`:60`). Select (placeholder "Risk category") options in order, labels shown through `toSentenceCase` (`:251-265`, `:48-54`):
  - `health_domain` → "Missing health services" (icon HeartPulse, `text-rose-600`)
  - `schooled_domain` → "Missing schooled services" (BookOpen)
  - `safe_domain` → "Missing safe services" (Shield)
  - `stable_domain` → "Missing stable services" (Landmark, `text-amber-600`)
  - `graduation_path` → "Graduation ready (all 4)" (GraduationCap)
  
  Change → `setSearchParams({ type: val, district: selectedDistrict })` (`:253-255`) — replaces the whole query string (drops FY `fy`/`from`/`to` params from the URL). Domain names are program terms → `@/config`.
- [ ] **District** — URL param `district` (default `"All"`), Select options "All districts" + discovered districts (`:267-284`); change sets state and `setSearchParams({ type, district: val })` (`:269-272`). Disabled for district users. Applied to table, export, header count text. **BUG**: `filteredData` memo deps are `[type, vcasQuery.data, servicesQuery.data, searchQuery]` (`:194`) — `selectedDistrict`/`discoveredDistrictsMap` are missing, so changing district does not refilter the table until another dependency changes (the header text updates, rows don't). Port the intended behaviour (filter applies immediately).
- [ ] **Search** — placeholder `"Search by Child ID, Name or District..."` (`:312`); case-insensitive substring on `displayId`, `district`, `name || first_name` (`:184-191`). Not persisted, no debounce. `handleClearFilters` exists but is never used (`:70-72`).
- [ ] **Sort** — none; backend/source order.
- [ ] **Pagination** — none; table renders only `filteredData.slice(0, 100)` (`:339`) while the header count shows the full total. **BUG**: rows beyond 100 are invisible (export still includes them). New: `platform/data-table` pagination.

### Exports
- [ ] **CSV** — button "Export csv", disabled when 0 rows (`:286-293`). Rows: all `filteredData` (not capped at 100) (`:196-210`). Headers in order (`:199`): `VCA ID`, `VCA Name`, `District`, `Age`, `Health`, `Schooled`, `Safe`, `Stable`, `Domains Covered`. Values: displayId‖"N/A"; name (as above); district‖"N/A"; age‖"N/A"; `has_health ? "Yes" : "No"` ×4; `` `${domain_count || 0}/4` `` (`:200-210`). Filename `` `vca_domain_gap_${type}_${selectedDistrict}.csv` `` (`:217`). Native Blob + hidden anchor; no library.
  - **BUG**: values joined with `,` with **no quoting/escaping** (`:212`) — commas in names/districts corrupt rows. No BOM (unlike the other registers). Object URL never revoked (`:215-221`). District with spaces in filename.

### Charts
- [ ] No charts. Header: icon (per type colour) + `{toSentenceCase(label)} registry` (e.g. "Missing health services registry") (`:241-244`); subline `{n} children found` + ` in {district}` when not All (`:245-247`).
- [ ] "Domain status" cell badges for domains **present** (`has_*`): "Health" (rose), "Schooled", "Safe", "Stable" (emerald) and "Grad-ready" when `domain_count === 4` (`:353-361`). Colours must become theme tokens.
- [ ] Context alert (when `type !== "graduation_path"`): title "Gap analysis mode", text "The dashboard shows overall coverage, but this register lists VCAs specifically **MISSING** {Domain} services so you can prioritize them." where `{Domain}` = type minus `_domain`, capitalised (`:298-306`).

### Links in / out
- [ ] In: only `legacy:src/pages/VcaServicesDashboard.tsx:678,687,696,705,715` — `` `/registers/vca-risk?type=<health_domain|schooled_domain|safe_domain|stable_domain|graduation_path>&district=${selectedDistrict}` `` where `selectedDistrict` is the user's location for district users, else `"All"` or the chosen district (`legacy:src/pages/VcaServicesDashboard.tsx:225-230`). That page is unreferenced, so in the live legacy app this route has no inbound UI link. Decision: VcaServicesDashboard is ported — new links must target `/vcas/risk?type=…&district=…`.
- [ ] Out: back arrow button → `navigate("/vca-services")` (`:232-239`) (new: `/services/vca`).
- [ ] Out: "View profile" → `navigate(\`/profile/vca-details?id=${id}\`)` only when id ≠ "N/A" (`:363-374`). **BUG**: the profile ignores `?id=` and reads only `location.state.id` or sessionStorage `ecap_last_vca_id` (`legacy:src/pages/VcaProfile.tsx:189-196`), so this opens the previously viewed VCA or "Vca not found". New: `/vcas/:vcaId`.

### Loading / empty / error
- [ ] Loading: centered `LoadingDots` while either query is loading (`:322-325`).
- [ ] Empty: Home icon, "No records found", "Adjust your filters or select a different domain type." (`:380-388`).
- [ ] Error: **BUG** — no error handling; failure of either query renders the empty state (`:127-128`, `:380`). Partial failure (one query errored) also yields empty.
- [ ] District dropdown waits on the separate discovery query.

### Bugs and quirks
- [ ] **BUG** Unknown `?type=` value crashes the page: `RISK_TYPES[type].icon` on undefined (`:60`, `:224`). Port: validate against the allowed list, fall back to default.
- [ ] **BUG** District change does not refilter (missing memo deps) (`:194`).
- [ ] **BUG** No province scoping for provincial users (`:88-102`, `:147-150`).
- [ ] **BUG** Name fields (`name`/`first_name`/`last_name`) don't match backend `firstname`/`lastname` (`:189`, `:202`, `:345`).
- [ ] **BUG** Display capped at 100 rows with no pagination (`:339`).
- [ ] **BUG** CSV not escaped, no BOM (`:212-213`).
- [ ] **BUG** "View profile" link payload ignored by profile (`:369`).
- [ ] **BUG** Type change rewrites the query string, dropping FY URL params (`:254`, `:271`).
- [ ] **QUESTION** Services fetched all-time while VCAs are FY-scoped (`:113-123`); `fyKey` in the services key only duplicates cache entries.
- [ ] **QUESTION** District users can see "All districts" option in a disabled Select; lock relies on `user.location` verbatim.
- [ ] Two fetches of the same national register under different keys (`:82-86`, `:113-117`) — one cached query is enough (share `queryOptions` with `/vcas`).
- [ ] Dead code: `handleClearFilters` (`:70-72`); unused imports `parseISO`, `subDays`, `isAfter`, `format` (`:44`).

---

## Other behaviour
- [ ] No modals, dialogs, forms, mutations, toasts or keyboard shortcuts in the three pages. (Global Cmd/Ctrl-K palette lives in `GlobalSearch`, `legacy:src/components/dashboard/GlobalSearch.tsx:54-64`.)
- [ ] Timers/polling: none in these pages. Overrides: `staleTime` 10 min (`legacy:src/pages/VcaRegister.tsx:164`, `legacy:src/pages/VcaArchivedRegister.tsx:188`, `legacy:src/pages/VcaRiskRegister.tsx:116`, `:122`), 30 min (`legacy:src/pages/VcaRiskRegister.tsx:85`). Global: `EtlInvalidator` polls `["etl","last-success"]` every 30 s and on a new ETL success clears the IndexedDB list cache and invalidates every non-`etl` query, which covers these registers (`legacy:src/components/EtlInvalidator.tsx:28`, `:54-59`, `:77-79`) → new queries need `meta: { etl: true }`. Decorative CSS `animate-pulse` blobs in hero (`legacy:src/pages/VcaRegister.tsx:381-382`, `legacy:src/pages/VcaArchivedRegister.tsx:462-463`).
- [ ] Storage read/written (indirectly):
  - IndexedDB `ecap_plus_cache_db` / store `api_cache`: keys `children_by_district:ALL` and `children_by_district:ALL:<from>_<to>` (60 s TTL), `vca_services_by_district:ALL` (5 min) (`legacy:src/lib/api.ts:372-377`, `:500-505`; `legacy:src/lib/indexedDbCache.ts:6-7`).
  - React Query persisted cache (IndexedDB key `ecap-plus-pmp-react-query`, 24 h, buster) holds the full national VCA registers (PII) (`legacy:src/App.tsx:136-147`). New: consider `meta: { persist: false }` or scoped data.
  - localStorage `ecap_plus_pmp.fy_filter_state_v2` (FY filter) (`legacy:src/context/FyFilterContext.tsx:12`, `:36`, `:64`).
  - sessionStorage `ecap_last_vca_id` written by the profile on arrival from the View buttons (`legacy:src/pages/VcaProfile.tsx:192`).
- [ ] Browser APIs: `Blob`, `URL.createObjectURL`, programmatic `<a download>` click (`legacy:src/pages/VcaRegister.tsx:345-352`, `legacy:src/pages/VcaArchivedRegister.tsx:421-430`, `legacy:src/pages/VcaRiskRegister.tsx:213-221`); `toLocaleDateString("en-GB")`.
- [ ] Shared helpers duplicated per page (`pickValue`, `calculateAge`, sub-population labels/mapping, district-variant grouping, page-number algorithm) (`legacy:src/pages/VcaRegister.tsx:47-123`, `:168-190`, `:277-292`; `legacy:src/pages/VcaArchivedRegister.tsx:52-134`, `:192-214`, `:303-331`). New: put VCA normaliser + age helper in `modules/vcas/model` (unit-tested); sub-population definitions in `@/config`; pagination via `platform/data-table`.
- [ ] `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts:5-18`) is **not** used by these pages; each page reimplements role logic with exact `description` strings. New: `platform/scope` hooks.
- [ ] Global search VCA records (shown in palette, not these pages) link to `/profile/vca-details` with `state: { id }` using id order `vca_id, vcaid, child_id, unique_id, uid` and name `firstname||name` + `lastname` (`legacy:src/components/dashboard/GlobalSearch.tsx:124-145`), fetched with district `user.location ?? DEFAULT_DISTRICT`, key `["vcas","search",district]`, enabled when open (`:66-70`). New search provider should share the register's `queryOptions` (CLAUDE.md data rules).

## Open questions for the developer
1. Should `/vcas` and `/vcas/archived` request the user's scoped district from the API (and province for provincial users) instead of the national list? Backend `/child/*` has no province param (AUDIT.md §3.2) — how should provincial scope be sent (comma list of districts)?
2. Risk register: should service coverage be limited to the FY window (services endpoint ignores `from`/`to`), or stay "ever received"?
3. Risk register: which name fields should be shown (`firstname`/`lastname`)? Should `age` be computed from `birthdate` like the other registers rather than the raw `age` column?
4. Sub-population "no" semantics: should missing/empty values count as "no" (legacy counts `null`/`undefined` but not `""`)?
5. Archived register: confirm the canonical reason/date columns (`reason`, `de_registration_date`) so the table and export use one field each.
6. Default sort for each register (legacy: household_id desc on `/vcas`, uid desc on `/vcas/archived`, none on risk) — keep, or make columns sortable?
7. Should the risk register appear in navigation (legacy: no nav entry, only links from the unreferenced services dashboard)?
8. `calculateAge` interprets `a/b/YYYY` as month/day — which date formats does `birthdate` actually use?
