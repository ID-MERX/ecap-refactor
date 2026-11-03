# referrals — legacy audit

> Legacy routes → new routes: `/referrals` → `/referrals` · Plan: MIGRATION_PLAN.md §5 row "referrals"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/Referrals.tsx` | 552 | The whole page (read in full): normaliser, KPIs, chart, tabs, table, CSV export |
| `legacy:src/App.tsx` | 602 | Route at `:581-588`, lazy import at `:42`, QueryClient defaults at `:112-133`, persister at `:140-161`, `:214-224` (relevant parts read) |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard (read in full) |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | Nav entry `:86`, visibility filter `:147-180` (relevant parts read) |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | No referrals entry (`:6-10`) |
| `legacy:src/components/dashboard/GlobalSearch.tsx` | 212 | No referrals entry (`:34-45`) |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | District scope + `isAdmin` (read in full) |
| `legacy:src/lib/api.ts` | 1486 | `getListValue` `:116-~140`, `dqaGet` `:185-209`, `getListFromApiWithCache` `:212-237`, services wrappers `:410-417`, `:499-506`, referral wrappers `:451-497` (relevant parts read) |
| `legacy:src/lib/indexedDbCache.ts` | 92 | IndexedDB list cache used by the fallback (DB/store names only) |
| `legacy:src/lib/csv.ts` | 29 | `downloadCsv` (read in full) |
| `legacy:src/lib/utils.ts` | 64 | `CAREGIVER_CONFIDENTIAL_LABEL`, `anonymizeCaregiverName` `:8-16` |
| `legacy:src/context/FyFilterContext.tsx` | 122 | `useFyFilter().resolved` (only the key part is used here) |

## Route `/referrals` → `/referrals`

### Purpose
"Referrals & Linkages" page (`legacy:src/pages/Referrals.tsx:316-318`), subtitle "Referrals made vs services provided — completion rate and linkage feedback." (`:320-323`). It merges caregiver referrals and VCA ("Child") referrals into one list and shows 4 KPI cards, a "Referred vs Provided" bar chart, and a table with two tabs ("All Referrals" / "Linkages → Provided"), search, pagination and CSV export.

**Important:** the two "dedicated" endpoints legacy calls do not exist on the backend (no `district/...referrals` routes in `backend:routes/householdRoutes.js` / `backend:routes/childRoutes.js`; only `/caregiver-referrals/:household_id(*)`, `/caregiver-referrals-by-month/:district(*)`, `/vca-referrals/:unique_id(*)`, `/vca-referrals-by-month/:district(*)` exist, `backend:routes/householdRoutes.js:37,55`, `backend:routes/childRoutes.js:41,45`). Every request 404s and legacy silently falls back to filtering *service* rows client-side (see Endpoints). In practice the page shows little or nothing. The rebuild needs a backend endpoint (see Open questions).

### Access
- [ ] Route guard: `<ProtectedRoute>` only, no role check (`legacy:src/App.tsx:581-588`). ProtectedRoute redirects to `/` when there is no user and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-19`).
- [ ] Sidebar: `{ title: "Referrals", url: "/referrals", icon: Share2 }` in the "Services" section (`legacy:src/components/dashboard/AppSidebar.tsx:86`). No filter rule matches it (the only rules are `item.url === "/districts" && isDistrictUser`, `section.label === "Admin" && !isAdmin`, `section.label === "Data Pipeline" && !isAdmin && !isSupport`, `AppSidebar.tsx:166-175`), so every logged-in user sees it.
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:6-10`).
- [ ] Global search: no nav entry (`legacy:src/components/dashboard/GlobalSearch.tsx:34-45`). **QUESTION:** add a "Referrals" nav item to search in the rebuild?
- [ ] In-page role checks: only `isAdmin` from `useEffectiveDistrict` (`legacy:src/pages/Referrals.tsx:138-142`), used solely to default the district to `"All Districts"` (`:144-146`, `:154`). `isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support"` (lowercased `user.description`, `legacy:src/hooks/useEffectiveDistrict.ts:6-7`). No buttons are hidden by role. In the rebuild use a permission (e.g. `scope:national`) via `useAccess()`.
- [ ] Data scope (`legacy:src/hooks/useEffectiveDistrict.ts:8-16`):
  - `district` = `user.location` if set and not `"All"`, else `user.district`, else `VITE_DEFAULT_DISTRICT` env (`DEFAULT_DISTRICT`, `legacy:src/lib/api.ts:7`), else `""`.
  - `availableDistricts`: province user (description includes "provincial"/"province") with a province (`user.title` unless `"All"`, else `user.province`) → `["All Districts", ...DISTRICTS_BY_PROVINCE[province]]`; district user → `[district]`; admin → `["All Districts", ...ALL_DISTRICTS]`; anyone else → `ALL_DISTRICTS` (no "All Districts" option).
  - Initial selection: `initialDistrict || (isAdmin ? "All Districts" : "")` (`legacy:src/pages/Referrals.tsx:144-146`).
  - API value: `districtParam = selectedDistrict === "All Districts" ? undefined : selectedDistrict` (`:165-166`).
  - Frontend only. The backend trusts whatever district is sent (AUDIT.md §3.2 "trusts district"). In the rebuild, scope must come from `platform/scope`.

### Endpoints
Both queries fire on mount with no `enabled` condition (`legacy:src/pages/Referrals.tsx:168-179`).

- [ ] **Caregiver referrals**: `useQuery({ queryKey: ["caregiver-referrals", districtParam ?? "all", fyKey], queryFn: () => getCaregiverReferralsByDistrict(districtParam), placeholderData: keepPreviousData, staleTime: 5 * 60 * 1000 })` (`:168-173`). Global defaults also apply: gcTime 24h, refetchOnMount/WindowFocus/Reconnect true, retry 1 (`legacy:src/App.tsx:112-133`). The cache is persisted to IndexedDB for 24h (key `ecap-plus-pmp-react-query`, `legacy:src/App.tsx:146,214-224`).
  - Wrapper `getCaregiverReferralsByDistrict` (`legacy:src/lib/api.ts:451-474`):
    1. With no district or `"All Districts"`: `GET /household/district/caregiver-referrals`. Otherwise `GET /household/district/caregiver-referrals/<encodeURIComponent(district)>`. **Neither route exists, so both 404** (AUDIT.md §3.2, entry `/household/caregiver-referrals/:household_id(*)` Issues; catch-all `ALL *` row lists "Referrals (unintended 404s)").
    2. On any error it falls back to `getCaregiverServicesByDistrict(district)` → `GET /household/caregiver-services-by-district/:district(*)` (AUDIT.md §3.2) through the IndexedDB list cache (`legacy:src/lib/api.ts:410-417`, TTL 5 min, key `caregiver_services_by_district:<district || "ALL">`). It keeps rows where `String(r.service || r.form_name || r.type || "").toLowerCase().includes("referral")` (`:466-472`).
  - The response list is unwrapped by `getListValue`, which accepts an array or one of the keys `data`, `results`, `records`, `referrals`, `referral`, `caregiver_referrals`, ... (`legacy:src/lib/api.ts:116-133`).
- [ ] **VCA referrals**: `useQuery({ queryKey: ["vca-referrals", districtParam ?? "all", fyKey], queryFn: () => getVcaReferralsByDistrict(districtParam), placeholderData: keepPreviousData, staleTime: 5 min })` (`legacy:src/pages/Referrals.tsx:174-179`).
  - Wrapper `getVcaReferralsByDistrict` (`legacy:src/lib/api.ts:476-497`): `GET /child/district/vcareferrals[/<district>]`, which **does not exist (404)**. The fallback is `getVcaServicesByDistrict(district)` → `GET /child/vca-services-by-district/:district(*)` (AUDIT.md §3.2), cached under `vca_services_by_district:<district || "ALL">` (`:499-506`), with the same `"referral"` substring filter (`:489-495`).
- [ ] FY: `fyKey = fy.mode === "all" ? "all" : "<fromDate>_<toDate>"` is only in the query key (`legacy:src/pages/Referrals.tsx:161-163`). It is **never sent to the API**, and no endpoint involved applies an FY window (AUDIT.md §3.2). Changing FY refetches identical data.
- [ ] Client post-processing: each list is mapped through `normalizeRow` (caregiver rows → `"Caregiver"`, VCA rows → `"Child"`), and the results are concatenated, caregivers first (`:183-191`).
- [ ] Rebuild: existing endpoints for real referral rows are only per-record (`/household/caregiver-referrals/:household_id(*)`, `/child/vca-referrals/:unique_id(*)`, AUDIT.md §3.2) or monthly counts (`*-referrals-by-month/:district(*)`). A district-level list of `all_referrals` is a **Backend ask**.

### Fields used
`pickValue` returns the first non-null, non-empty value as a string, else `"N/A"` (`legacy:src/pages/Referrals.tsx:67-74`). The normaliser is at `:97-135`.

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| beneficiaryType | — (set by source list: `"Caregiver"` / `"Child"`) | Table "Type", chart X axis, export | as-is |
| entityId | Child: `unique_id`, `household_id`; Caregiver: `household_id`, `unique_id` | Table "ID" (mono), search, export "ID", row key | `"N/A"` fallback |
| householdId | `household_id` | Table "Household ID" (mono), search, export | `"N/A"` |
| district | `district` | Export only | `"N/A"` |
| facility | `facility` | Table "Facility", search, export | `"N/A"` |
| name | Child: `` `${firstname} ${lastname}` `` with every `N/A` removed, trimmed, else `"N/A"`. Caregiver: `anonymizeCaregiverName(pickValue(r, ["caregiver_name","full_name","name","mother_name","guardian_name"]))`, which **always** returns `"Caregiver Name - Confidential"` (`legacy:src/lib/utils.ts:8-16`) | Not in table. Used in search and export "Name" | — |
| caseworker | `caseworker_name` | Export only | `"N/A"` |
| referredDate | `referred_date`, `date_referred` | Table "Referred Date", export | raw string (backend stores `DD-MM-YYYY` text, AUDIT.md §3.2); no formatting or sorting |
| receivingOrg | `receiving_organization` | Table "Receiving Org", search, export, "Linked w/ Feedback" KPI | `"N/A"` |
| servicesReferred | `services_referred` (`"N/A"` → `""`) | Table "Services Referred" (truncated at 220px, full value in `title` tooltip, `"—"` when empty), search, export | — |
| servicesProvided | `services_provided` (`"N/A"` → `""`) | Export only; drives `provided` | — |
| provided | `hasProvided(servicesProvided)`: non-empty after trim and not `"N/A"` (`:77-80`) | Status badge, KPIs, chart, Linkages tab, export "Status" | `"Provided"` / `"Referred"` |

Fallback service rows (`caregiver_services`, `vca_services`) have none of `services_referred`, `services_provided`, `receiving_organization`, `facility` or `unique_id` (the VCA key is `vcaid`), per AUDIT.md §3.2. They also probably have no `service`/`form_name`/`type` column, so the `"referral"` filter likely drops every row (**QUESTION**, column set unknown).

### Filters / sort / pagination / search
- [ ] District select (`legacy:src/pages/Referrals.tsx:326-340`): shadcn `Select`, width 180px, placeholder "District", options = `availableDistricts` (see Access). The default is described under Access. It is not persisted (no URL or storage). It applies to the API call and so to the table, KPIs, chart and export. Changing it resets the page to 1 (`:157-159`). The rebuild uses `platform/scope`.
- [ ] Tabs (`:410-417`): `"overview"` label "All Referrals" (default, `:149`); `"linkages"` label "Linkages → Provided" (ArrowRight icon), which shows only `provided` rows (`:236-241`). The tab affects the table, pagination and export. It does **not** affect the KPIs or chart. Not persisted. **QUESTION:** sync the tab to the URL in the rebuild (e.g. `?tab=linkages`)?
- [ ] Search (`:418-426`): placeholder "Search ID, name, facility, organization…". It uses `useDeferredValue` (no timed debounce, `:150`). Case-insensitive substring match on `[entityId, householdId, name, facility, receivingOrg, servicesReferred].join(" ")` (`:193-209`). Because fields are joined with spaces, a query can match across two fields. Search applies to the table, KPIs, chart and export. It resets the page (`:157-159`). Not persisted.
- [ ] Sort: none. Rows appear in API order, caregivers before children. No sortable columns.
- [ ] Pagination: client-side, `ITEMS_PER_PAGE = 50` (`:65`), fixed (no page-size choice). Shown only when `totalPages > 1` (`:512`). Previous / "`{currentPage} / {totalPages}`" / Next, disabled at the ends (`:513-543`). Resets on search, district or tab change.

### Exports
- [ ] CSV only, through the "Export" outline button (Download icon, `:341-349`). Disabled when `tableRows.length === 0`. Built with `downloadCsv` (`legacy:src/lib/csv.ts:19-29`): it quotes values containing `"`, `,` or newline, ends with a trailing newline, has no BOM, and uses MIME `text/csv;charset=utf-8;`.
- [ ] Filename: `` `referrals-${selectedDistrict || "all"}-${activeTab}.csv` `` (`:277-281`), e.g. `referrals-All Districts-overview.csv` (contains a space) or `referrals-<District>-linkages.csv`.
- [ ] Rows: every row of the current tab after search (`tableRows`), across all pages, not just the current page (`:263`).
- [ ] Columns in order (`:249-276`): "Beneficiary Type" (beneficiaryType), "ID" (entityId), "Household ID" (householdId), "Name" (name), "District" (district), "Facility" (facility), "Caseworker" (caseworker), "Referred Date" (referredDate), "Receiving Organization" (receivingOrg), "Services Referred" (servicesReferred), "Services Provided" (servicesProvided), "Status" (`provided ? "Provided" : "Referred"`).
- [ ] No PDF and no branding strings in the export.

### Charts
- [ ] KPI cards (`:211-218`, `:284-309`, rendered `:353-376` in `GlowCard`, each fades/slides in with a `0.05s * i` stagger through framer-motion). All are computed over `filteredRows` (search applied, tab ignored):
  - "Referrals Made" = `filteredRows.length` (Share2 icon, emerald).
  - "Referrals Provided" = count of `provided` rows (CheckCircle2, teal).
  - "Completion Rate" = `provided / made * 100`, `toFixed(1)` + `"%"`; `0` when there are no rows → `"0.0%"` (TrendingUp, blue).
  - "Linked w/ Feedback" = rows with `provided && receivingOrg !== "N/A"` (Building2, violet).
  - The value shows `<LoadingDots/>` while loading.
- [ ] Bar chart "Referred vs Provided" (Activity icon) (`:221-234`, `:378-408`): Recharts `BarChart`, height 240, grouped bars per beneficiary type. Both categories `"Caregiver"` and `"Child"` always appear, even with 0. Series "Referred" (count) is `#10b981` and "Provided" (count where `provided`) is `#0ea5e9`, top radius 4. Grid `strokeDasharray 3 3` `#eef2f7`, Y axis `allowDecimals={false}`, Tooltip and Legend. Hex colours are hardcoded; the rebuild must use theme tokens.

### Links in / out
- [ ] In: only the sidebar entry (`legacy:src/components/dashboard/AppSidebar.tsx:86`). A grep for `/referrals` across `src` finds only that and the route (`legacy:src/App.tsx:582`). No query params, `location.state` or storage payload.
- [ ] Out: none. Rows are not clickable and there are no profile links. **QUESTION:** should rows link to `/households/:householdId` / `/vcas/:vcaId` in the rebuild?

### Loading / empty / error
- [ ] Loading: `isLoading = caregiverQuery.isLoading || vcaQuery.isLoading` (`:181`). KPI values show `LoadingDots`, and the table shows one row with `LoadingDots` across 8 columns (`:446-451`). The chart renders immediately with zeros. `keepPreviousData` keeps old rows visible while a new district loads, with no indicator. Rebuild: skeletons.
- [ ] Empty: one table row "No referrals found." (`:452-460`). Rebuild: `<EmptyState>`.
- [ ] Error: none handled. A failed query leaves `data` undefined, so the page looks the same as empty. There is no toast and no retry. Partial failure (one query fails) silently shows only the other beneficiary type. Rebuild: `<ErrorState>` with retry, per source.

### Bugs and quirks
- [ ] **BUG** The district selector snaps back. The effect at `legacy:src/pages/Referrals.tsx:152-155` has `selectedDistrict` in its deps and runs `if (initialDistrict) setSelectedDistrict(initialDistrict)`. Whenever `initialDistrict` is truthy (it is any time `user.location`, `user.district` or `VITE_DEFAULT_DISTRICT` is set), picking another district is immediately reverted. Intended: the user can change district within their scope.
- [ ] **BUG** The primary endpoints `/household/district/caregiver-referrals[/:d]` and `/child/district/vcareferrals[/:d]` don't exist (404) (`legacy:src/lib/api.ts:451-497`). Every load costs a failed request plus a fallback (AUDIT.md §3.2).
- [ ] **BUG** The fallback filter (`service`/`form_name`/`type` containing "referral") runs on service rows that don't carry referral fields, so the page is effectively empty or wrong. Fallback VCA rows use `vcaid`, so `entityId` would be `household_id`/`"N/A"`.
- [ ] **BUG** With "All Districts", the fallback calls `getCaregiverServicesByDistrict(undefined)` → URL `/household/caregiver-services-by-district/undefined` (no rows), but caches under `caregiver_services_by_district:ALL`. If another page cached the national list under that key within 5 min, Referrals reads the cached national list. Otherwise it writes `[]` into the shared `ALL` key and poisons CaregiverRiskRegister/CaseworkerProfile for 5 min. The same applies to `vca_services_by_district:ALL` (`legacy:src/lib/api.ts:410-417,499-506`; AUDIT.md §3.2).
- [ ] **BUG** A non-admin user with no district gets `selectedDistrict = ""`, so `districtParam = ""` → the fallback requests `/…-services-by-district/` (empty segment = all districts), which is national data (`legacy:src/pages/Referrals.tsx:144-146,165-166`; `legacy:src/lib/api.ts:411-415`). This is a scope leak.
- [ ] **BUG** A province user can pick "All Districts" → `districtParam` undefined → national (not province) request. (It is masked by the snap-back bug.) The rebuild should send the province's district list.
- [ ] **BUG** The FY filter is in the query key but never sent, so FY has no effect on the data (`:161-179`).
- [ ] **QUESTION** Export includes child first/last names, caseworker names and district, which the table does not show. Caregiver names are always the label "Caregiver Name - Confidential". Should child names be exported or anonymised?
- [ ] **QUESTION** These queries do not set `persist: false`, so referral rows (with child names) are persisted to IndexedDB for 24h (`legacy:src/App.tsx:214-224`). The rebuild should set `meta: { persist: false }`.
- [ ] Quirk: query-key prefixes `["caregiver-referrals", …]` / `["vca-referrals", …]` are shared with HouseholdProfile (`["caregiver-referrals", id]`, `legacy:src/pages/HouseholdProfile.tsx:403`) and VcaProfile (`["vca-referrals", id]`, `legacy:src/pages/VcaProfile.tsx:222`). The rebuild should use its own key factory.
- [ ] Quirk: the Child name builder strips every literal `N/A` substring (`:117`).
- [ ] Quirk: "Linked w/ Feedback" treats "has a receiving organisation" as "feedback". There is no actual feedback field.
- [ ] Quirk: the row key uses the index (`:463-465`); duplicate referral rows are not de-duplicated.

## Other behaviour

- [ ] No modals, forms, mutations, toasts or keyboard shortcuts.
- [ ] Timers/polling: none. Refetch comes from staleTime 5 min plus the global refetch-on-focus/reconnect (`legacy:src/App.tsx:126-131`). Animation is the framer-motion KPI stagger only (decorative; it may be dropped).
- [ ] Storage (indirect via the fallback): IndexedDB DB `ecap_plus_cache_db`, store `api_cache` (`legacy:src/lib/indexedDbCache.ts:6-7`), keys `caregiver_services_by_district:<district|ALL>` and `vca_services_by_district:<district|ALL>` (`legacy:src/lib/api.ts:413,502`). The React Query persister uses key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`) and the localStorage `ecap_plus_persist_buster` (`legacy:src/App.tsx:158-161`). Sidebar: sessionStorage `ecap_sidebar_scroll` (`legacy:src/components/dashboard/AppSidebar.tsx:126-131`).
- [ ] Browser APIs: Blob + `URL.createObjectURL` + a temporary `<a download>` for CSV (`legacy:src/lib/csv.ts:19-29`).
- [ ] Brand/program strings: `"ecap+ support"` role description in `isAdmin` (`legacy:src/hooks/useEffectiveDistrict.ts:7`); the `"Caregiver Name - Confidential"` label (`legacy:src/lib/utils.ts:8`); beneficiary labels "Caregiver"/"Child" (`legacy:src/pages/Referrals.tsx:83,226-227`), which are domain terms and should come from config.

## Open questions for the developer

1. **Backend ask:** a district/province-scoped, FY-aware list of `all_referrals` (caregiver + VCA) is needed. Without it the page can't show real data. Until it exists, should the page ship behind a feature flag, or aggregate the `*-referrals-by-month` counts for KPIs only?
2. What exactly is `all_referrals`'s column set (`services_referred`, `services_provided`, `receiving_organization`, `facility`, `caseworker_name`, `firstname`/`lastname`)? The legacy normaliser assumes these keys, but the DDL is not in the repo.
3. How should a referral be classified as caregiver vs child? `all_referrals` holds both, keyed by `household_id` / `unique_id` (AUDIT.md §3.2).
4. Should rows link to household/VCA detail pages, and should the tab and search be URL-synced?
5. Should child names appear in the export? Should referral data be excluded from persistence?
6. Should KPIs follow the active tab? Legacy KPIs ignore it.
