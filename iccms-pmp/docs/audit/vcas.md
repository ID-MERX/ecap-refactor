# vcas — legacy audit

> Legacy routes → new routes: `/vcas` → `/vcas`; `/vcas/archived` → `/vcas/archived`; `/registers/vca-risk` → `/vcas/risk`; `/profile/vca-details` → `/vcas/:vcaId` (profile is covered by another part) · Plan: MIGRATION_PLAN.md §5 row "vcas"  · *part `registers`*
> This part covers the three register pages only. The VCA profile page (`legacy:src/pages/VcaProfile.tsx`) is audited in a separate part; it is referenced here only where the registers link to it.
> Legacy routes → new routes: `/profile/vca-details` → `/vcas/:vcaId` (this part only; `/vcas`, `/vcas/archived`, `/registers/vca-risk` are covered by other parts) · Plan: MIGRATION_PLAN.md §5 row "vcas"  · *part `profile`*
> Merged from the step-3 drafts: `registers`, `profile`. Content is carried over verbatim; only heading levels, the merged header and the shared Legacy files table were consolidated.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
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
| `src/lib/directus.ts` | 869 | `listUsers` (`:79-100`), `createNotification` (`:514-528`), `FLAG_NOTIFY_ROLE_KEYWORDS`/`isFlagNotifyRecipient` (`:637-655`), `notifyUsersOfFlag` (`:657-682`), `notifyUsersOfFlagResolution` (`:684-709`). Relevant parts read. |
| Inbound callers: `src/pages/VcaRegister.tsx:617-620`, `src/pages/VcaArchivedRegister.tsx:810-816`, `src/pages/VcaRiskRegister.tsx:365-370`, `src/pages/HouseholdProfile.tsx:1070-1080`, `src/pages/MotherIndexDetails.tsx:245` | — | Snippets read for the navigation payload only. |
| `backend:controllers/childController.js` | — | Handlers `getAllVCAsAssessedRegister` (`:43-78`), `getAllVCAsArchivedRegister` (`:80-132`), `getVcaServices` (`:155-179`), `getVcaCasePlans` (`:277-304`), `getVcaCasePlanDomains` (`:306-329`), `getAllReferrals` (`:331-356`). Read for the lookup columns. |

## Contents

- [the registers](#part-registers)
- [the profile page](#part-profile)

<a id="part-registers"></a>

## Part: the registers

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

<a id="part-profile"></a>

## Part: the profile page

## Route `/profile/vca-details` → `/vcas/:vcaId`

### Purpose
A detail page for one VCA (child). It shows:
- a hero with active/deregistered status, a suppression badge and the ID
- 3 quick-stat cards: Household ID (links to the household), Facility, Last service date
- 5 tabs: **SUMMARY** (demographics, clinical and vulnerability fields, sub-populations), **CASEPLANS** (case plans, with vulnerabilities expanding inline), **SERVICES**, **REFERRALS**, and **FLAG RECORD FORM** (create a data-quality flag, list and resolve open flags)

Tab definitions are at `legacy:src/pages/VcaProfile.tsx:621-641`.

### Access
- [ ] **Route guard:** `ProtectedRoute` only, with no role check (`legacy:src/App.tsx:461-468`). `ProtectedRoute` renders `null` while auth loads, redirects to `/` with no user, and redirects to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). The component is lazy-loaded via `lazyWithRetry` (`legacy:src/App.tsx:51`).
- [ ] **Sidebar / nav:** no entry in the sidebar (sections at `legacy:src/components/dashboard/AppSidebar.tsx:50-112`) or in the mobile bottom nav (`legacy:src/components/dashboard/MobileBottomNav.tsx:9-10` has only `/vca-services` and `/profile`). It is not in GlobalSearch's `navigationItems` (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`). GlobalSearch reaches it only as a **record link**: the "Recent VCAs (District)" group shows the first 10 VCAs of `user?.location ?? DEFAULT_DISTRICT` and navigates with `state: { id }`. The id is `pickValue(vca, ["vca_id","vcaid","child_id","unique_id","uid"])` (`legacy:src/components/dashboard/GlobalSearch.tsx:50,62-66,126-133`). In the new app, the `vcas` search provider should link to `/vcas/:vcaId`.
- [ ] **In-page role checks:**
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/VcaProfile.tsx:199`)
  - `const district = isDistrictUser ? user?.location || "None" : "";` (`legacy:src/pages/VcaProfile.tsx:201`). The code comment says "Admins and Provincial Users have global view access at the profile level" (`:200`).
  - Nothing else is hidden by role. The flag form and the Resolve buttons show for every signed-in user (`legacy:src/pages/VcaProfile.tsx:1271-1457`).
  - Port as `can()` checks: e.g. a `flags.create` / `flags.resolve` permission, plus a scope rule derived from `core/access`.
- [ ] **Data scope:**
  - District users get `user.location`, or the literal `"None"` if `location` is empty. Every other user gets `""` (`legacy:src/pages/VcaProfile.tsx:199-201`). `useEffectiveDistrict` is **not** used.
  - With `""`, the wrappers call `/child/vcas-assessed-register/` and `/child/vcas-archived-register/`. The backend treats an empty district as "no filter" and returns every district (`backend:controllers/childController.js:56-60,98-105`).
  - No FY window is sent: neither wrapper gets a `fy` (`legacy:src/pages/VcaProfile.tsx:205,211`).
  - So provincial users can open any VCA nationally, and a district user can open only VCAs in their own district. For a district user, any other VCA shows "Vca not found".
  - The per-VCA endpoints (services, case plans, domains, referrals) are by-ID lookups with **no scope check** on the backend (AUDIT.md §3.2: "by ID"). → Backend ask.
  - **QUESTION:** the new app should load the VCA by ID and enforce scope on the server. Should a provincial user see VCAs outside their province (legacy allows it)?

### Endpoints
All DQA GETs go through `dqaGet`. It sends a `Bearer` token and throws `data?.message ?? "DQA request failed"` on non-2xx (`legacy:src/lib/api.ts:185-210`). Lists are unwrapped by `getListValue` (`legacy:src/lib/api.ts:116+`). Global query defaults: `staleTime` 60 s, `gcTime` 24 h, refetch on mount/focus/reconnect, `retry: 1` (`legacy:src/App.tsx:126-131`). No query on this page overrides them, and none sets `refetchInterval`.

- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2), active VCA register
  - Wrapper: `getChildrenByDistrict(district)` (`legacy:src/lib/api.ts:368-379`)
  - Params: district as above, no `from`/`to`
  - Fires on mount, always (`enabled: true`)
  - Key: `["vcas","district",district]` (`legacy:src/pages/VcaProfile.tsx:203-207`). The same key is used by `HouseholdProfile` (`legacy:src/pages/HouseholdProfile.tsx:207`).
  - Extra IndexedDB cache: key `children_by_district:<district||"ALL">`, 60 s TTL (`LIST_CACHE_TTL_MS`, `legacy:src/lib/api.ts:14`), stale-on-error (`legacy:src/lib/api.ts:212-238`)
  - **The whole register is downloaded only to find one VCA client-side** (see the lookup below)
- [ ] `GET /child/vcas-archived-register/:district(*)` (AUDIT.md §3.2), archived VCA register
  - Wrapper: `getChildrenArchivedRegister(district)`, no `reason`, no FY (`legacy:src/lib/api.ts:388-409`)
  - Fires always
  - Key: `["vcas","archived","district",district]` (`legacy:src/pages/VcaProfile.tsx:209-213`)
  - No IndexedDB cache
- [ ] **Client-side lookup** (`legacy:src/pages/VcaProfile.tsx:293-303`)
  - `vca = [...active, ...archived].find(v => uid|unique_id|vca_id|id (lower-cased) === id.toLowerCase())`. The match is case-insensitive.
  - The first match wins, and active rows come first.
  - The new app should replace this with a by-ID fetch. The existing `/child/vca-profile/:unique_id(*)` is **broken** (it never returns data, AUDIT.md §3.2; handler reads `req.params.uid` while the route param is `unique_id`, `backend:controllers/childController.js:134-153`). Until the backend fixes it, the rebuild must keep the register lookup (QUESTION / Backend ask).
- [ ] `GET /child/vca-services/:vcaid(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaServicesByChildId(id)` (`legacy:src/lib/api.ts:508-513`)
  - Key: `["vca-services","vca",id]`, `enabled: Boolean(id)` (`legacy:src/pages/VcaProfile.tsx:215-219`)
  - The backend matches `vca_services.vcaid = $1` (`backend:controllers/childController.js:155-163`)
  - Post-processing: sorted by date, newest first (see Sort)
- [ ] `GET /child/vca-referrals/:unique_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaReferralsById(id)` (`legacy:src/lib/api.ts:574-579`)
  - Key: `["vca-referrals",id]`, `enabled: Boolean(id)` (`legacy:src/pages/VcaProfile.tsx:221-225`)
  - The backend matches `all_referrals.unique_id` (`backend:controllers/childController.js:331-340`)
  - Sorted newest first
- [ ] `GET /child/vca-caseplans/:unique_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaCasePlansById(id)` (`legacy:src/lib/api.ts:587-592`)
  - Key: `["vca-caseplans","vca",id]`, `enabled: Boolean(id)` (`legacy:src/pages/VcaProfile.tsx:227-231`)
  - The backend matches `ec_vca_case_plan.unique_id` (`backend:controllers/childController.js:277-286`)
  - Sorted newest first
- [ ] `GET /child/vca-caseplan-domains/:unique_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaCasePlanDomainsById(id)` (`legacy:src/lib/api.ts:594-602`)
  - Key: `["vca-caseplan-domains",id]`
  - **Lazy:** `enabled: Boolean(id) && expandedVulnPlanDate !== null`, so it first fires when "View Vulnerabilities" is clicked (`legacy:src/pages/VcaProfile.tsx:237-245`)
  - The backend matches `ec_vca_case_plan_domain.unique_id` (`backend:controllers/childController.js:306-314`)
  - Post-processing: rows are filtered to `String(v.case_plan_date ?? "") === expandedVulnPlanDate`. **If none match, all of the VCA's domain rows are shown** ("date drift" fallback, `legacy:src/pages/VcaProfile.tsx:246-255`).
- [ ] Directus `GET /items/flagged_forms_ecapplus_pmp?fields=*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name`
  - Wrapper: `getFlaggedRecords` (`legacy:src/lib/api.ts:604-628`). It returns `[]` with no token and swallows errors to `[]`, so a failure looks the same as an empty list.
  - Key: `["flagged-records"]`, no `enabled` (`legacy:src/pages/VcaProfile.tsx:257-260`). The key is shared with `Flags.tsx:43` and `HouseholdProfile.tsx:213`.
  - **Fetches every flag in the collection** (no filter, default Directus limit), then filters client-side: `String(f.vca_id || f.child_id || "").toLowerCase() === id.toLowerCase() && f.status !== "resolved"` (`legacy:src/pages/VcaProfile.tsx:262-270`)
  - The rebuild should filter on the server: `filter[vca_id][_eq]=…`.
- [ ] Directus `POST /items/flagged_forms_ecapplus_pmp`: create a flag
  - Wrapper: `createFlaggedRecord` (`legacy:src/lib/api.ts:630-652`). It throws `errorData?.message || "Failed to create flagged record"`.
  - Payload (`legacy:src/pages/VcaProfile.tsx:387-399`):
    - `household_id: vca.household_id || "N/A"`
    - `vca_id: id` (the raw id from navigation, not a normalised field)
    - `caseworker_phone: vca.caseworker_phone || "N/A"`
    - `caseworker_name: vca.caseworker_name || vca.cwac_member_name || "N/A"`
    - `caregiver_name: vca.caregiver_name || "N/A"`
    - `facility: vca.facility || vca.health_facility || "N/A"`
    - `comment`, `category`, `severity` (form values; `category`/`severity` may be `""`)
    - `verifier: "<first_name> <last_name>"` or `"Unknown Verifier"`
    - `status: "pending"`
  - On success: invalidate `["flagged-records"]`, call `notifyUsersOfFlag` (not awaited), toast, reset the form (`legacy:src/pages/VcaProfile.tsx:357-381`).
- [ ] Directus `PATCH /items/flagged_forms_ecapplus_pmp/:id` with body `{ status: "resolved" }`: resolve a flag
  - Wrapper: `updateFlagStatus(flagId,"resolved")` (`legacy:src/lib/api.ts:1283-1300`)
  - Then awaits `notifyUsersOfFlagResolution(String(record.household_id ?? ""), resolver, "Resolved from VCA profile.", String(record.vca_id ?? ""))`. The resolver is `"<first> <last>"` or `"Unknown Resolver"` (`legacy:src/pages/VcaProfile.tsx:326-351`).
  - On success: invalidate `["flagged-records"]` and toast.
  - **Note:** the DQA backend CORS does not allow `PATCH`, but this call goes to Directus, so that is irrelevant here.
- [ ] Directus `GET /users?fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required&limit=-1&filter[status][_eq]=active`
  - Called inside both notify functions via `listUsers("active")` (`legacy:src/lib/directus.ts:79-100`)
  - Recipients are users whose `role.name` (lower-cased) includes any of `"admin","administrator","supervisor","qa","data quality","manager"` (`legacy:src/lib/directus.ts:637-655`). **This is a role-name comparison;** port it to a backend or Directus Flow, or to an access rule.
- [ ] Directus `POST /notifications`, one request per recipient, via `Promise.allSettled` (`legacy:src/lib/directus.ts:514-528,657-709`). Body: `{recipient, subject, message, collection:"flagged_forms_ecapplus_pmp"}`.
  - `entityId` = `VCA <vcaId> (HH <hhId>)`, or `Household <hhId>` when the vcaId is falsy or `"Not Available"`
  - Create: subject `Record Flagged: <entityId>`, message `A record for <entityId> has been flagged by <verifier>. \n\nComment: <comment>`
  - Resolve: subject `Flag Resolved: <entityId>`, message `The flag for <entityId> has been resolved by <resolver>. \n\nResolution/Comment: <comment>`

### Fields used

**VCA record** (a row from the active/archived register; `children` table):

| Field (normalised) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| id (lookup) | `uid`, `unique_id`, `vca_id`, `id` | Match against the navigation id (`:293-303`) | case-insensitive |
| displayId | navigation `id` itself | Hero badge `#{id}` (`:490`), layout subtitle `Vca: ${id}` (`:440`) | raw |
| isArchived | `de_registration_date` OR `reason` truthy | Badge "Deregistered" (amber) vs "Active" (green) (`:431,459-477`) | — |
| virallySuppressed (hero) | `virally_suppressed === "YES"` (strict, upper-case) | "Suppressed" badge (`:478-485`) | — |
| gender | `vca_gender`, `gender` | Hero line `"<gender> · <age> years"` (`:508`); Summary "Gender" (`:654`) | raw, fallback "N/A" |
| age | `calculateAge(birthdate)` | Hero line (`:508`) | integer years; 0 when the date can't be parsed (`:98-141`) |
| ageDisplay | `age`, then `${calcAge} Years` | Summary "Age" (`:658`) | raw |
| location (hero) | `ward`, `district` | Hero MapPin (`:513`) | raw |
| householdId (card) | `household_id`, `household_code`, `householdid`, `hh_id` | Quick card "Household ID", clickable (`:538-556`) | raw |
| householdId (summary / flag) | `household_id` only | Summary "Household ID" (`:677`), flag payload (`:388`), notify (`:365`) | raw |
| facility | `facility` (card/summary); `facility`, `health_facility` (flag payload) | Card "Facility" (`:560`), Summary "Facility" (`:696`), flag payload (`:393`) | raw |
| lastServiceDate (card) | `sortedServices[0].service_date`, `vca.last_service_date` | Card "Last service date" (`:435-437,567-569`) | `DD MMM YYYY` (moment), else "N/A" |
| birthdate | `birthdate` | Summary "Date of birth" (`:649`) | `DD MMM YYYY` via `parseMomentDate` (strict formats ISO_8601, `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY/MM/DD`, then lenient fallback) (`:143-173`) |
| ageGroup | `age_group` | Summary "Age Group" | raw |
| school | `school_name`, `school` | "School" | raw |
| relation | `relation` | "Caregiver Relationship" | raw |
| province / district / ward | `province` / `district` / `ward` | "Province" / "District" / "Ward" | raw |
| partner | `partner` | "Partner" | raw |
| caseStatus | `case_status` | "Case Status" | raw |
| memberType | `member_type` | "Member Type" | raw |
| dateEnrolled / dateReferred / dateScreened | `date_enrolled` / `date_referred` / `date_screened` | same labels | **raw string, not formatted** |
| lastServiceDate (summary) | `last_service_date` | "Last Service Date" | raw (differs from the card, which uses the newest service row) |
| screeningLocation | `screening_location` | "Screening Location" | raw |
| caseworkerName | `caseworker_name` (summary); `caseworker_name`, `cwac_member_name` (flag payload) | "Caseworker Name" | raw |
| caseworkerPhone | `caseworker_phone` | "Caseworker Phone", flag payload | raw (PII) |
| caregiverName | `caregiver_name` | flag payload only | — |
| hivStatus | `is_hiv_positive` | "HIV Status" | raw |
| onArt | `receiving_art` | "On HIV Treatment?" | raw |
| artNumber | `art_number` | "ART Number" | raw |
| hivTestDate | `hiv_test_date` | "Date HIV Known" | raw |
| dateStartedArt | `date_started_art` | "Date Started ART" | raw |
| mmdLevel | `level_mmd`, `child_mmd` | "MMD Level" | raw |
| lastVlDate / nextVlDate | `date_last_vl` / `date_next_vl` | "Last VL Date" / "Next VL Date" | raw |
| vlLastResult / vlNextResult | `vl_last_result` / `vl_next_result` | "VL Last Result" / "VL Next Result" | raw |
| virallySuppressed (summary) | `vl_suppressed`, `virally_suppressed` | "Virally Suppressed?" | raw |
| testedForHiv | `child_been_tested_for_hiv` | "Child Tested for HIV?" | raw |
| testedLastYear | `been_tested_last_year` | "Tested Last Year?" | raw |
| receivedResults | `received_results_last_hiv_test` | "Received Results (Last HIV Test)?" | raw |
| tbScreening | `tb_screening` | "TB Screening" | raw |
| tpt | `takes_tb_preventive_therapy` | "Takes TB Preventive Therapy?" | raw |
| otherProphylaxis | `takes_drugs_to_prevent_other_diseases` | "Takes Drugs to Prevent Other Diseases?" | raw |
| birthCertificate | `received_birth_certificate` | "Received Birth Certificate?" | raw |
| pregnantBreastfeeding | `is_pregnant_breastfeeding` | "Pregnant / Breastfeeding?" | raw |
| under5Malnourished | `under_5_malnourished` | "Under-5 Malnourished?" | raw |
| isBiologicalChild | `is_biological_child`, `is_biological` | "Is Biological Child?" | raw |
| isIndex | `is_index` | "Is Index Case?" | raw |
| caregiverFsw | `is_the_child_caregiver_an_fsw`, `cfsw` | "Caregiver an FSW?" | raw |
| motherOnTreatment | `is_mother_currently_on_treatment_wlhiv` | "Mother Currently on Treatment?" | raw |
| motherAdhering | `is_mother_adhering_to_treatment_wlhiv` | "Mother Adhering to Treatment?" | raw |
| motherSuppressed | `is_mother_virally_suppressed_wlhiv` | "Mother Virally Suppressed?" | raw |
| motherArtNumber | `mother_art_number_wlhiv` | "Mother ART Number (WLHIV)" | raw |
| sexualViolence | `child_ever_experienced_sexual_violence` | "Child Experienced Sexual Violence?" | raw |
| otherViolence | `survivors_of_other_form_of_violence` | "Survivor of Other Form of Violence?" | raw |
| disability | `child_adolescent_living_with_disability` | "Living with Disability?" | raw |
| agedHeadedHh | `child_adolescent_in_aged_headed_household` | "Aged-Headed Household?" | raw |
| childHeadedHh | `child_adolescent_in_child_headed_household` | "Child-Headed Household?" | raw |
| chronicallyIllHeadedHh | `child_adolescent_in_chronically_ill_headed_household` | "Chronically-Ill-Headed Household?" | raw |
| femaleHeadedHh | `child_adolescent_in_female_headed_household` | "Female-Headed Household?" | raw |
| service | `service` | "Service" | raw |
| quarter | `quarter` | "Quarter" | raw |
| updatedStatus | `updated_status` | "Updated Status" | raw |
| dateEdited | `date_edited`, `dateedited` | "Date Edited" | raw |
| timeOnArt / timeSinceVl / timeSinceResult | `time_art` / `time_vl` / `time_result` | "Time on ART" / "Time since Last VL" / "Time since Last Result" | raw |
| subPopulations | every key in `subPopulationFilterLabels` whose value `isTrue`; plus derived flags from `pbfw`, `agyw`, `is_hiv_positive`, `calhiv`, `is_biological_mother_of_child_living_with_hiv`, `mother_pbfw`, `caregiver_pbfw` | "Sub Population Details" card (`:944-986`) | see Other behaviour |

Summary InfoItems are at `legacy:src/pages/VcaProfile.tsx:646-942`, in the order listed: "VCA Details" card (DOB, Gender, Age, Age Group), then the "Other Details" card (School … Time since Last Result). `InfoItem` shows `value || "Not Provided"`, but every caller already passes `"N/A"` as the fallback (`:1801`). Values are truncated, with the full value in a `title` tooltip (`:1797-1800`).

**Case plan row** (`ec_vca_case_plan`):

| Field | Raw keys (in order) | Where | Formatting |
| --- | --- | --- | --- |
| planDate | `case_plan_date` ?? `date_of_caseplan` ?? `date` (`??` for display; `\|\|` for sort) | "Case Plan Date"; key for vulnerability expansion | `DD MMM YYYY` |
| status | `case_plan_status` ?? `status` ?? "N/A" | "Status" badge: `1` → "Active", `0` → "Closed", else raw. Colour: active (string "active" or 1) green, closed (string "closed" or 0) grey, else sky. | — |
| dateCreated | `date_created`, `created_at` | "Date Created" | `DD MMM YYYY` |
| dateEdited | `date_edited`, `dateedited` | "Date Edited" | `DD MMM YYYY` |

**Case-plan domain / vulnerability row** (`ec_vca_case_plan_domain`, `:1140-1191`). Every text field goes through `cleanArrayString`: strip `[`, `]` and `"`, replace `,` with `", "`, `"N/A"` if empty (`:1643-1652`).

| Column | Raw key |
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
| (match key) | `case_plan_date` |

**Service row** (`vca_services`, `:1654-1747`): Service Date = `service_date`, `visit_date`, `date` (`DD MMM YYYY`). Health Services = `health_services`; HIV Services = `hiv_services`; Other Health = `other_health_services`; Safe = `safe_services`; School Services = `schooled_services`; Stable = `stable_services`, all through `cleanArrayString`. Row key: `id`, `unique_id`, or `<date>-<i>`.

**Referral row** (`all_referrals`, `ActivityTable`, `:1567-1641`):
- Record Name = `service`, `service_name`, `form_name`, `referral_type`, then "N/A"
- Date = `service_date`, `visit_date`, `date` (**not `referral_date`**), shown as `DD MMM YYYY`
- Status = `status`, `state`, then "N/A", shown in an outline badge

**Flag row** (`flagged_forms_ecapplus_pmp`):
- `id`, `vca_id`/`child_id` (match), `status` (exclude "resolved")
- `comment` (alert title through `toTitleCase`, fallback "Suspicious data entry")
- `verifier`
- `date_created`/`created_at`
- `category`/`form_type` (fallback "General")
- `severity` (fallback "Normal"; "Critical" in red)
- `comment`/`description`/`reason` (fallback "No description provided")
- `household_id` (resolution notify)

These are used at `legacy:src/pages/VcaProfile.tsx:1421-1546`.

### Filters / sort / pagination / search
- [ ] No filters or search on this page.
- [ ] **Tabs:** `defaultValue="overview"`. They are uncontrolled and not persisted to the URL or storage (`legacy:src/pages/VcaProfile.tsx:621`). Tab order and labels: `SUMMARY` (overview), `CASEPLANS` (history), `SERVICES` (services), `REFERRALS` (audit), `FLAG RECORD FORM` (flags) (`:625-631`). The new app could sync the tab to `?tab=` (UX improvement, optional).
- [ ] **Sort** (client-side, newest first, via `safeParseDate` → moment epoch, 0 if unparsable):
  - case plans by `case_plan_date || date_of_caseplan || date` (`:272-282`)
  - services by `service_date || visit_date || date` (`:284-291`)
  - referrals by `service_date || visit_date || date || referral_date` (`:305-315`)
  - flags are unsorted (Directus order)
  - no column is user-sortable
- [ ] **Pagination:** none. Every table renders all rows. Referrals sit in a `ScrollArea` 500 px tall with a horizontal scrollbar (`:1258-1266`). The services table is `min-w-[1200px] table-fixed`, with horizontal scroll (`:1681-1682`).

### Exports
- [ ] **BUG:** the REFERRALS tab has an "Export" button with **no `onClick`**, so it does nothing (`legacy:src/pages/VcaProfile.tsx:1249-1255`). The intended behaviour is presumably a CSV of the referrals table via `platform/export`: columns "Record Name", "Date", "Status", filename to be decided. **QUESTION:** implement it, or drop it?
- No other exports on this page.

### Charts
- [ ] No charts.
- [ ] Quick-stat cards (3, `:536-618`):
  - "Household ID" (clickable when present)
  - "Facility"
  - "Last service date"
- [ ] Count badges: "`<n>` Records" for services (`:1227-1232`) and "`<n>` records" for flags (`:1464-1469`).

### Links in / out
- [ ] **In.** Every caller passes the id in `location.state.id`, except VcaRiskRegister:
  - `VcaRegister`: `navigate("/profile/vca-details", { state: { id: String(id) } })` (`legacy:src/pages/VcaRegister.tsx:617-620`)
  - `VcaArchivedRegister`: `state: { id: String(id) }` (`legacy:src/pages/VcaArchivedRegister.tsx:810-816`)
  - `HouseholdProfile` members table: `state: { id: String(m.uid || m.vca_id || m.unique_id) }` (`legacy:src/pages/HouseholdProfile.tsx:1070-1080`)
  - `MotherIndexDetails` children list: `state: { id: String(cid), district: child.district || district }`. The `district` key is **ignored** by VcaProfile (`legacy:src/pages/MotherIndexDetails.tsx:245`).
  - `GlobalSearch`: `state: { id }`, where id = `vca_id → vcaid → child_id → unique_id → uid` (`legacy:src/components/dashboard/GlobalSearch.tsx:128-132`)
  - `VcaRiskRegister`: **query param** `navigate("/profile/vca-details?id=${id}")` (`legacy:src/pages/VcaRiskRegister.tsx:369`). See BUG.
- [ ] **ID resolution:** `location.state?.id` first. If present, it is written to `sessionStorage["ecap_last_vca_id"]`; otherwise that key is read back (`legacy:src/pages/VcaProfile.tsx:188-196`). The new app reads `:vcaId` from route params only (CLAUDE.md data rules). Legacy redirect: `/profile/vca-details?id=X` → `/vcas/X`. A state-only legacy link cannot be redirected; fall back to `/vcas`.
- [ ] **Out:**
  - "Household ID" quick card → `navigate("/profile/household-details", { state: { id: String(hhId) } })`, only when hhId is truthy (`:550-555`). New: `/households/:householdId` via the households module's path builder (`@/modules/households`).
  - "Back to register" button → `navigate(-1)` (`:518-525`). New: history back, falling back to `/vcas`.
  - Not-found EmptyState action "Back to Register" → `navigate("/vcas")` (`:420-423`).
  - No links out from service, referral or case-plan rows: there is no service detail link to `/services/vca/:recordId`. **QUESTION:** add one?

### Loading / empty / error
- [ ] **Page loading:** while *either* register query is loading, a centred `LoadingDots` fills a 50vh area, with layout subtitle "Vca profile" (`:403-411`). New: skeleton.
- [ ] **Not found:** when no VCA matches, including when there is no id at all, `EmptyState` shows (`:413-428`):
  - icon User
  - title "Vca not found"
  - description "The VCA record you're looking for doesn't exist or has been moved."
  - action "Back to Register" → `/vcas`
  - layout subtitle "Vca not found"
- [ ] **Case plans:**
  - loading: `LoadingDots` in a row spanning 5 columns
  - empty: FileText icon + "No case plans have been created for this VCA yet." (`:1015-1020,1203-1215`)
- [ ] **Vulnerabilities (expanded row):**
  - heading "Vulnerabilities recorded against the case plan dated `<DD MMM YYYY>`"
  - loading: `LoadingDots`
  - empty: "No vulnerabilities recorded for this case plan." (`:1089-1104`)
- [ ] **Services:** loading `LoadingDots`; empty "No VCA services found." (`:1661-1678`)
- [ ] **Referrals:** loading `LoadingDots`; empty "No referral tracking for this VCA." (`:1263,1578-1594`)
- [ ] **Flags:**
  - empty history: `EmptyState` with title "No flagged records" and description "This child has no documented data quality issues." (`:1551-1555`)
  - the "Active attention required" panel is hidden when there are no flags (`:1416`)
  - `isLoadingFlags` is destructured but never used (`:257`)
- [ ] **Errors:** none of the read queries render an error state. A failed sub-query looks like "empty", and a failed register query looks like "Vca not found". Flag fetch errors are swallowed to `[]` in the wrapper (`legacy:src/lib/api.ts:624-627`). Mutation errors use toasts (see Other behaviour). New: `<ErrorState>` with retry, per tab.

### Bugs and quirks
- [ ] **BUG:** `VcaRiskRegister` passes the id as `?id=` (`legacy:src/pages/VcaRiskRegister.tsx:369`), but VcaProfile reads only `location.state.id` (`legacy:src/pages/VcaProfile.tsx:189-196`). The page therefore shows the **last VCA viewed in this tab** (from sessionStorage) or "Vca not found". Route params fix this.
- [ ] **BUG:** the "Flagging history" table lists `vcaFlags`, which already **excludes resolved flags** (`:262-270,1491`). Resolved flags never appear in "history", and every row's status badge is hard-coded "Flagged" (`:1538-1543`). Intended: show all flags for the VCA, with the real status (pending/resolved).
- [ ] **BUG:** the flag date uses `format(new Date(flag.date_created), …)` with no guard (`:1438-1441`). In the history table, `String(... || "N/A") && format(new Date(item.date_created || item.created_at))` (`:1518-1527`) always calls `format`, because `"N/A"` is truthy. A missing or invalid date makes date-fns throw `RangeError: Invalid time value`, and the page crashes. Intended: show "N/A".
- [ ] **BUG:** the Referrals "Export" button is dead (no handler) (`:1249-1255`).
- [ ] **BUG:** referrals are sorted with `referral_date` as a fallback, but the Date column does not use `referral_date`, so rows sorted by it show "N/A" (`:308-311` vs `:1627-1629`).
- [ ] **BUG:** the hero title is a hard-coded placeholder, "VCA Name – Confidential", next to a decorative badge "Caseplans · Referrals · Services" (`:493-504`). The name is never shown. **QUESTION:** keep it confidential (no name), or show `firstname lastname`?
- [ ] **BUG:** the district role check is a strict `user?.description === "District User"` (`:199`). This differs from `useEffectiveDistrict` (includes "district", plus a location fallback, `legacy:src/hooks/useEffectiveDistrict.ts:9`). A district user whose description differs in case or wording gets national scope. Its sibling falls back to `"None"` when `location` is empty, which then 404s every VCA.
- [ ] **BUG:** ID mismatches across endpoints. The page sends the same navigation `id` to services (`vca_services.vcaid`), referrals, case plans and domains (`unique_id` columns), but callers pass different identifiers: GlobalSearch prefers `vca_id`, and HouseholdProfile prefers `uid`. If `uid ≠ unique_id`, the record is found (the lookup tries 4 keys), but services, case plans and referrals come back empty. Intended: normalise to the VCA's canonical `unique_id` (from the found record) before calling the by-ID endpoints. **QUESTION:** which field is canonical, and are `uid`/`unique_id`/`vcaid` always equal?
- [ ] **BUG:** the flag payload uses `vca_id: id` (the navigation id, not the normalised record id) (`:389`). Flags match by `vca_id || child_id` against that same raw id (`:267`), so a flag created from one entry point may not show from another.
- [ ] **BUG:** `calculateAge` returns `0` for missing or unparsable birthdates, shown as "0 years" in the hero (`:98-141,508`). Intended: "N/A".
- [ ] **BUG (perf):** the page downloads the full active **and** archived national registers (for non-district users) to show one VCA (`:203-213,293-303`). Use a by-ID endpoint (Backend ask: fix `/child/vca-profile/:unique_id(*)`).
- [ ] **BUG (perf):** it fetches the whole flags collection to filter client-side (`:257-270`).
- [ ] Quirk: the "Last service date" card uses the newest service row's `service_date`. The Summary "Last Service Date" item uses the record's raw `last_service_date` and is unformatted, so the two can disagree (`:435-437` vs `:727-729`).
- [ ] Quirk: most date fields in Summary are shown raw (unformatted strings). Only DOB is formatted (`:649,712-778`). New: format through `core/lib/format.ts`.
- [ ] Quirk: the hero suppression badge checks `virally_suppressed === "YES"` (case-sensitive), while Summary shows `vl_suppressed || virally_suppressed` (`:478,790-792`).
- [ ] Quirk: `isArchived` = `de_registration_date || reason` (`:431`). When the same VCA is in both lists, the active row wins (`:294`).
- [ ] Quirk: expanding vulnerabilities is keyed by plan **date**. Two case plans with the same date expand together, and a date mismatch shows *all* domains (`:246-255,1029`).
- [ ] Quirk: `ActivityTable`'s `type` prop is unused (`:1575`).
- [ ] **QUESTION:** the derived "HIV+ PBFW" / "HIV- PBFW" counts **`agyw` truthy as PBFW** (`pbfwFlag = isTrue(pbfw) || isTrue(agyw)`, `:951-952`). This looks wrong: AGYW is not PBFW.
- [ ] Quirk: `notifyUsersOfFlag` in the create `onSuccess` is not awaited, and notification failures are silent (`Promise.allSettled`) (`:364-369`). In resolve, notification is awaited inside `mutationFn`, so a `/users` failure makes the resolve show "Failed to resolve flag" even though the PATCH succeeded (`:327-340`).

## Other behaviour

### The registers draft

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

### The profile page draft

- [ ] **Sub Population Details card** (`legacy:src/pages/VcaProfile.tsx:944-986`). Shown only when at least one label applies. Each label renders as an InfoItem with value `"True"`.
  - `isTrue(v)` = `v === "1" || v === "true" || v === 1 || v === true || String(v).toLowerCase() === "yes"`.
  - Generic labels (`subPopulationFilterLabels`, `:82-96`), shown when `isTrue(vca[key])`, in object-entry order: `calhiv: "C/ALHIV"`, `hei: "HEI"`, `cwlhiv: "C/WLHIV"`, `agyw: "AGYW"`, `csv: "C/SV"`, `cfsw: "CFSW"`, `abym: "ABYM"`, `caahh: "CAAHH"`, `caichh: "CAICHH"`, `caich: "CAICH"`, `calwd: "CALWD"`, `caifhh: "CAIFHH"`, `muc: "MUC"`. These are **sub-population program strings** and must come from `@/config` (program.config sub-populations).
  - Derived labels:
    - `"HIV+ PBFW"` if pbfwFlag && hivPos
    - `"HIV- PBFW"` if pbfwFlag && !hivPos
    - `"Children of PBFW"` if `is_biological_mother_of_child_living_with_hiv || mother_pbfw || caregiver_pbfw`
    - where pbfwFlag = `pbfw || agyw` and hivPos = `is_hiv_positive || calhiv`, all via `isTrue`
  - Code comment: "PBFW removed; the three derived PBFW sub-populations are computed per-VCA at render time" (`:80-81`).
- [ ] **Flag form** (react-hook-form + zod, `:175-181,317-324,1285-1412`):
  - Heading "Record New Flag".
  - Field `category` (optional) is a Select labelled "Flag category", placeholder "Choose category...(optional)". Options as value → label:
    - `Missing Data` → "Missing data"
    - `Invalid Data` → "Invalid data"
    - `Duplicate Record` → "Duplicate record"
    - `Incorrect Service` → "Incorrect service logging"
    - `Case Plan Mismatch` → "Case plan mismatch"
    - `Other` → "Other"
  - Field `severity` (optional) is a Select labelled "Priority severity", placeholder "Select severity... (optional)". Options:
    - `Low` → "Low severity"
    - `Medium` → "Medium severity"
    - `High` → "High severity"
    - `Critical` → "Critical issue"
  - Field `comment` (required) is a Textarea labelled "Flag observations & action details". Placeholder: "Provide detailed observations about the data quality issue, any suspected causes, and recommended immediate actions...". Validation: `min(10)` with message "Observation details must be at least 10 characters".
  - Footer hint: "Submitted flags will be reviewed by district monitors within 24 hours." (`:1393-1394`). This is a program/process claim; **QUESTION:** move it to config?
  - Submit button: "Submit flag record". While pending it shows "Submitting..." with LoadingDots and is disabled.
  - Defaults are `""` for all three fields. `form.reset()` on success.
  - **Quirk:** the Selects use `defaultValue={field.value}` (uncontrolled), so after `form.reset()` they may keep showing the previous choice.
  - The new app should share this flag form and the flag option lists with the `flags` module (export from `@/modules/flags`), not duplicate them. HouseholdProfile has the same feature.
- [ ] **Toasts** (sonner):
  - Create success: "Flag submitted successfully", description "The record has been flagged for review."
  - Create error: "Submission failed", description `err.message || "Please try again later."`
  - Resolve success: "Flag resolved", description "Caseworker and admins have been notified."
  - Resolve error: "Failed to resolve flag", description `err.message`
  - Citations: `:344-349,371-379`
- [ ] **Active attention panel** (`:1416-1457`):
  - Heading "Active attention required".
  - One card per unresolved flag:
    - title: `toTitleCase(flag.comment || "Suspicious data entry")`
    - line: "Flagged by `<verifier>` • `<MMM d, yyyy>`"
    - "Resolve" button, disabled while any resolve is pending
- [ ] **Flagging history table** (`:1459-1557`):
  - Heading "Flagging history", badge "`<n>` records".
  - Columns:
    - "Category": category, or form_type, or "General"; plus "`<severity||Normal>` priority" underneath, red when Critical
    - "Date flagged": `dd MMM yyyy`
    - "Observations"
    - "Status": always "Flagged"
- [ ] **Storage keys:**
  - `sessionStorage["ecap_last_vca_id"]`, written and read (`:192,195`). Drop it in the rebuild, because the route param replaces it.
  - IndexedDB list cache entry `children_by_district:<district||"ALL">`, written via `getListFromApiWithCache` (`legacy:src/lib/api.ts:368-379`).
  - React Query persistence to IndexedDB, app-wide (`legacy:src/App.tsx:122-123` comment). In the new app, flags are user-private workflow data, so mark them `meta: { persist: false }` as appropriate.
- [ ] **Timers / polling:** none on this page beyond the global refetch-on-focus/mount/reconnect defaults (`legacy:src/App.tsx:128-130`). There are decorative CSS `animate-pulse` blobs in the hero (`:446-447`); drop them per the UI rules.
- [ ] **Query meta for the new app:** the register and by-ID DQA endpoints read warehouse tables (`children`, `vca_services`, `ec_vca_case_plan*`, `all_referrals`), so set `meta: { etl: true }`. Scope belongs in the key wherever district is sent.
- [ ] **Keyboard / browser APIs:** none specific to this page. GlobalSearch's Ctrl/Cmd+K, which links here, belongs to the shell.

## Open questions for the developer

### The registers draft

1. Should `/vcas` and `/vcas/archived` request the user's scoped district from the API (and province for provincial users) instead of the national list? Backend `/child/*` has no province param (AUDIT.md §3.2) — how should provincial scope be sent (comma list of districts)?
2. Risk register: should service coverage be limited to the FY window (services endpoint ignores `from`/`to`), or stay "ever received"?
3. Risk register: which name fields should be shown (`firstname`/`lastname`)? Should `age` be computed from `birthdate` like the other registers rather than the raw `age` column?
4. Sub-population "no" semantics: should missing/empty values count as "no" (legacy counts `null`/`undefined` but not `""`)?
5. Archived register: confirm the canonical reason/date columns (`reason`, `de_registration_date`) so the table and export use one field each.
6. Default sort for each register (legacy: household_id desc on `/vcas`, uid desc on `/vcas/archived`, none on risk) — keep, or make columns sortable?
7. Should the risk register appear in navigation (legacy: no nav entry, only links from the unreferenced services dashboard)?
8. `calculateAge` interprets `a/b/YYYY` as month/day — which date formats does `birthdate` actually use?

### The profile page draft

1. **By-ID lookup.** `/child/vca-profile/:unique_id(*)` is broken (handler reads `req.params.uid`, `backend:controllers/childController.js:135`). Can the backend fix it, so the profile stops downloading both national registers? Until then, should the rebuild keep the register-scan lookup?
2. **Canonical VCA id.** Which identifier is canonical in the route (`/vcas/:vcaId`): `unique_id`, `uid`, `vca_id` or `vcaid`? Are they always equal? Different endpoints filter on different columns (`vcaid` vs `unique_id`).
3. **Scope.** Should provincial users be limited to their province on the profile? Legacy gives every non-district user national access (`legacy:src/pages/VcaProfile.tsx:200-201`). The by-ID endpoints have no server-side scope check (Backend ask).
4. **Flag history.** Should it include resolved flags, with their real status? Legacy hides them (BUG above).
5. **Referrals "Export".** Implement it as a CSV, or remove it?
6. **Hero name.** Show the VCA name, or keep the "VCA Name – Confidential" placeholder?
7. **AGYW and PBFW.** Is counting `agyw` as PBFW in the derived sub-populations intended?
8. **Footer hint.** Should "reviewed by district monitors within 24 hours" become config-driven, or be removed?
9. **Notification recipients.** Recipients are chosen by role-name keyword matching on the client (`legacy:src/lib/directus.ts:637-655`). Should this move to a Directus Flow or a backend endpoint, and use permissions instead of role names?
10. **Service rows.** Should service rows link to `/services/vca/:recordId`? Legacy has no such link.
