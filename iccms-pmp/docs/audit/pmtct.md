# pmtct — legacy audit

> Legacy routes → new routes: `/registers/pmtct` → `/pmtct`; `/profile/pmtct-details` → `/pmtct/:id` · Plan: MIGRATION_PLAN.md §5 row "pmtct"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/PMTCTRegister.tsx` | 1148 | Register page: mothers table (Register tab) + KPIs/charts (Charts tab), CSV export, district selector, sync |
| `src/pages/PMTCTProfile.tsx` | 175 | Profile page: renders one record passed via `location.state` / `sessionStorage`; makes no API call |
| `src/App.tsx` | 602 | Lazy imports (`:41`, `:53`), routes (`:301-307`, `:478-484`), QueryClient defaults (`:112-134`), IndexedDB persister (`:136-160`, `:214-224`) |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard (auth + forced password change only) |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Nav entry "PMTCT" (`:61`), visibility filter (`:147-181`), active matching (`:183`) |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | No PMTCT entry |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | No PMTCT nav entry or record search |
| `src/hooks/useEffectiveDistrict.ts` | 18 | District scope + `isAdmin` / `isRestrictedToDistrict` / `availableDistricts` |
| `src/lib/api.ts` (parts) | — | `dqaGet` (`:185-210`), `getListValue` (`~:120-183`), `fyQs` (`:240-245`), `clearApiCache` (`:247-251`), wrappers (`:348-366`), `DEFAULT_DISTRICT` (`:7`) |
| `src/lib/csv.ts` | 29 | `downloadCsv` used by export |
| `src/context/FyFilterContext.tsx` / `src/lib/fiscalYear.ts` (parts) | 122 / — | `useFyFilter().resolved` → `fromDate`/`toDate` (`fiscalYear.ts:36-54`) |
| `src/components/EtlInvalidator.tsx` (parts) | — | 30 s ETL poll that invalidates every non-`etl` query incl. `["pmtct", …]` (`:28`, `:54-57`, `:78-79`) |

## Route `/registers/pmtct` → `/pmtct`

### Purpose
Register of PMTCT (prevention of mother-to-child transmission) **mothers** for the selected district(s), with a Charts tab summarising mothers and their HIV-exposed infants (HEI). Infant (child) rows are fetched only for charts/KPIs and are deliberately not listed in the table (`legacy:src/pages/PMTCTRegister.tsx:213-216`, `:240`).

### Access
- [ ] Route guard: `<ProtectedRoute>` only, no role check (`legacy:src/App.tsx:301-307`). ProtectedRoute: renders nothing while auth loads, redirects to `/` if no user, redirects to `/change-password` if `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`).
- [ ] Sidebar: section "Registers", item `{ title: "PMTCT", url: "/registers/pmtct", icon: HeartPulse }` (`legacy:src/components/dashboard/AppSidebar.tsx:61`). No visibility condition applies: the filter only hides `/districts` for district users, the "Admin" section for non-admins, and the "Data Pipeline" section (`legacy:src/components/dashboard/AppSidebar.tsx:166-173`). Active state is exact path equality `currentPath === path` (`:183`), so the profile page highlights nothing.
- [ ] Mobile bottom nav: no PMTCT entry (items are Home, Districts, Registers→`/households`, Services→`/vca-services`, Profile; `legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`); reachable via "More" (opens the sidebar, `:37-46`).
- [ ] Global search: no PMTCT navigation entry (`legacy:src/components/dashboard/GlobalSearch.tsx:34-45`) and no PMTCT record results (only VCA/household records, `:132`, `:158`). (MIGRATION_PLAN.md mentions a future `/search` covering PMTCT — new behaviour, not legacy.)
- [ ] In-page checks:
  - District selector rendered only when `!isRestrictedToDistrict` (`legacy:src/pages/PMTCTRegister.tsx:504`).
  - Initial district: `initialDistrict || (isAdmin ? "All Districts" : "")` (`:149-151`); effect: `if (initialDistrict) setSelectedDistrict(initialDistrict); else if (isAdmin && !selectedDistrict) setSelectedDistrict("All Districts");` (`:158-161`).
  - `useEffectiveDistrict` (string comparisons to port into `core/access`): `isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support"` (lower-cased `user.description`, `legacy:src/hooks/useEffectiveDistrict.ts:7-8`); `isProvinceUser = description.includes("provincial") || description.includes("province")` (`:9`); `isDistrictUser = description.includes("district") || (!!user?.location && user.location !== "All" && !isAdmin && !isProvinceUser)` (`:10`); `province = user.title !== "All" ? user.title : user.province` (`:11`); `district = user.location !== "All" ? user.location : (user.district || DEFAULT_DISTRICT || "")` (`:12`, `DEFAULT_DISTRICT` = `VITE_DEFAULT_DISTRICT`, `legacy:src/lib/api.ts:7`); `isRestrictedToDistrict = isDistrictUser` (`:17`).
  - No hidden buttons: Sync, Export, View are visible to everyone.
- [ ] Data scope (`legacy:src/pages/PMTCTRegister.tsx:163-167`): if `selectedDistrict !== "All Districts"` fetch `[selectedDistrict]`; otherwise fetch every entry of `availableDistricts` except `"All Districts"`, falling back to `ALL_DISTRICTS` (hardcoded geography, `legacy:src/constants/districts.ts:8`) if that list is empty. `availableDistricts` (`legacy:src/hooks/useEffectiveDistrict.ts:13-16`): province user with province → `["All Districts", ...DISTRICTS_BY_PROVINCE[province]]`; district user → `[district]`; admin → `["All Districts", ...ALL_DISTRICTS]`; anyone else → `ALL_DISTRICTS`. Backend **trusts the district path param** (AUDIT.md §3.2) — any user can request any district. Backend ask: enforce scope server-side.

### Endpoints
- [ ] `GET /etl/pmtct-mother-register/:district(*)` (AUDIT.md §3.2) — wrapper `getPmtctMotherRegisterByDistrict` (`legacy:src/lib/api.ts:358-366`) via `dqaGet` (Bearer token, throws `"Not authenticated."` without token, throws `data.message ?? "DQA request failed"` on non-2xx; `legacy:src/lib/api.ts:185-210`). Path district is `encodeURIComponent(district)`; query `?from=<fy.fromDate>&to=<fy.toDate>` appended only when both are set (`legacy:src/lib/api.ts:241-245`, `legacy:src/pages/PMTCTRegister.tsx:146-147`) — **backend ignores from/to** (AUDIT.md §3.2). One query per district via `useQueries` (`legacy:src/pages/PMTCTRegister.tsx:181-195`). Key `["pmtct", "mother-register", d, fy.mode, fy.fromDate, fy.toDate]` (`:183-190`); `placeholderData: keepPreviousData`, `retry: 1` (`:192-193`); otherwise global defaults `staleTime 60s`, `gcTime 24h`, refetch on mount/focus/reconnect (`legacy:src/App.tsx:126-131`). Always enabled (no `enabled` condition). Response list extracted by `getListValue` (tries known keys, then first non-empty array, then any array; `legacy:src/lib/api.ts:~120-183`). Post-processing: flatten all districts, map to row (see Fields), search filter, sort by date desc (`legacy:src/pages/PMTCTRegister.tsx:241-275`). New: `meta: { etl: true }` (ETL table, AUDIT.md §3.2); rows contain names/phones on the profile → consider `meta: { persist: false }`.
- [ ] `GET /etl/pmtct-child-register/:district(*)` (AUDIT.md §3.2) — wrapper `getPmtctChildRegisterByDistrict` (`legacy:src/lib/api.ts:348-356`); same param handling and fan-out (`legacy:src/pages/PMTCTRegister.tsx:172-179`). Key `["pmtct", "child-register", d, fy.mode, fy.fromDate, fy.toDate]` (`:174`); `keepPreviousData`, `retry: 1` (`:176-177`). Used only for the "Infants (HEI)" KPI, the pie, and the DBS-by-district chart (`:213-238`).
- [ ] Invalidation: Sync button (`:201-211`) and global `EtlInvalidator` (every non-`etl` query invalidated when a new ETL success is seen; poll 30 s, `legacy:src/components/EtlInvalidator.tsx:28`, `:54-57`, `:78-79`).
- [ ] "All Districts" = N parallel requests (one per district, both endpoints → 2N). Backend has no `All` support (AUDIT.md §3.2). Backend ask: an "all/province" variant or comma list.

### Fields used
Mother rows (`legacy:src/pages/PMTCTRegister.tsx:244-260`); `pickValue` returns first value that is not null/undefined/`""`, as `String`, else `"N/A"` (`:79-86`).

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
|---|---|---|---|
| `id` | `pmtct_id, pmtctid, ecap_id, ecapid, mother_id, motherid, client_number, client_no, ca_id, caid, household_id, householdId, unique_id, uid, id` (`:88-105`) | Table "PMTCT ID", export, search, row key, profile title | mono text |
| `householdId` | `ecap_id, household_id, hh_id` (`:246`) | search only (placeholder calls it "HHID") | — |
| `hivStatus` | none — hardcoded `"HIV Positive"` (`:247-250`) | Table "HIV Status" (rendered `.toUpperCase()` → "HIV POSITIVE", rose badge, `:1027-1031`), export, passed to profile | — |
| `facility` | `facility, facility_name` (`:251`) | Table "Facility" (line 1), export, search, Records-by-Facility chart | — |
| `district` | `district, district_name` (`:252`) | Table under facility (uppercase small text, `:1045-1047`), export, search | — |
| `type` | constant `"Mother"` (`:253`) | export "Type"; passed to profile as `category` | — |
| `ancDate` | `date_enrolled_pmtct, date_1st_visit, date_tested` (`:254-258`) | Table "Enrolment Date", export, sort key, enrolment trend | `formatDate` → `DD-MM-YYYY` (`:107-126`) |
| `raw` | whole record | passed to profile | — |

Infant rows (`:217-238`):

| Field | Raw keys tried | Used for |
|---|---|---|
| `id` | same list as mother `id` | unused |
| `householdId` | `ca_id, child_id, unique_id` | unused |
| `hivStatus` | `test_result_at_birth, infant_hiv_status, hiv_status` | DBS chart: trimmed, upper-cased; `"D"` → detected, `"ND"` → not detected, anything else → pending (`:314-317`) |
| `facility` | `facility, facility_name` | unused |
| `district` | `district, district_name` | DBS chart x-axis; `"N/A"` → `"Unknown"` (`:304`) |
| `ancDate` | `dbs_at_birth_actual_date, dbs_at_birth_due_date, date_tested` | unused |

Date helpers: `formatDate` parses with `new Date()`, falls back to `DD-MM-YYYY` regex, outputs `en-GB` `dd/mm/yyyy` with `/`→`-`; unparseable → raw string; empty/`"N/A"` → `"N/A"` (`:107-126`). `dateToTime` same parsing, 0 if unparseable (`:128-134`). New: date format from config via `core/lib/format.ts`.

### Filters / sort / pagination / search
- [ ] District select (hero, `:504-529`): options `"All Districts"` + `availableDistricts` minus `"All Districts"`; placeholder "All Districts"; default per Access; changing resets page to 1 (`:507-510`). Not persisted (state only). Applies to table, export, KPIs, charts (all derive from the fetched set). Hidden for district users.
- [ ] FY window: global `useFyFilter()` (header control; state persisted in URL params + localStorage `ecap_plus_pmp.fy_filter_state_v2`, `legacy:src/context/FyFilterContext.tsx:12`, `:36`, `:50`, `:64`). Sent to API and part of keys but has **no effect** on data (backend ignores; client-side FY filter intentionally removed, `:169-171`). **QUESTION:** should the new page filter client-side by enrolment date until the backend honours `from`/`to` (Backend ask)?
- [ ] Search (`:943-954`, `:262-271`): placeholder "Search by ID, HHID or facility..."; matches lower-cased `id`, `householdId`, `facility`, `district` via `includes`; case-insensitive; "debounce" via `useDeferredValue` (`:156`), no timer. Applies to table, export, and mother-derived KPIs/charts, **not** infant-derived ones. Typing resets page to 1. Not persisted.
- [ ] Clear Filters button (`:956-962`): clears search, page 1, toast info "All filters have been reset." — does not reset district or FY.
- [ ] Sort: fixed, by `ancDate` descending (`dateToTime`, unparseable dates = 0 sink to bottom) (`:273`). No sortable columns.
- [ ] Pagination: client-side, fixed 50 rows (`ITEMS_PER_PAGE`, `:77`), no page-size selector. Footer "Showing {start+1 or 0} to {min(end,total)} of {total} entries" (`:1087-1091`); pager only when `totalPages > 1`; numbered pages with ellipses: ≤7 pages all shown, otherwise 1, "…" if page>3, page−1..page+1, "…" if page<total−2, last (`:391-408`, `:1093-1137`); Prev/Next disabled at bounds.

### Exports
- [ ] CSV only, button "EXPORT CSV" (`:963-971`), disabled while loading or when no rows. Handler `handleExportCsv` (`:410-437`): if no rows → toast error "No data available to export."; rows = **all search-filtered, sorted** mothers (not just current page); headers in order: `"PMTCT ID"` (id), `"Type"` (always "Mother"), `"HIV Status"` (always "HIV Positive"), `"Enrolment Date"` (`formatDate(ancDate)`), `"Facility"`, `"District"` (`:415-430`). Filename `` `pmtct-register-${selectedDistrict.toLowerCase().replace(/\s+/g, "-")}.csv` `` (e.g. `pmtct-register-all-districts.csv`) (`:431-435`). Library: in-house `downloadCsv` (quote-escaping for `"`, `,`, newline; no BOM; `\n` line endings; `legacy:src/lib/csv.ts:5-29`). Toast success "Register exported successfully." No PDF/XLSX, no branding.

### Charts
All Recharts (`:18-31`); colours are hardcoded hex (must become theme tokens). Computed in `stats` (`:278-381`).
- [ ] KPI cards (Charts tab, `:560-625`), each clickable → switches to Register tab, caption "Click to view register"; value shows `LoadingDots` while loading:
  - "Total Records" = mothers count after search (`:279-281`).
  - "Infants (HEI)" = all infant rows (unfiltered) (`:280`).
  - "Mothers" = same as Total Records.
  - "HIV Positive" = mothers count (definitional, `:282-284`).
  **QUESTION:** Total Records, Mothers and HIV Positive are always the same number — keep all three?
- [ ] Hero badge "{total} records" (`—` while loading) and district badge (`:468-480`).
- [ ] "Final Outcomes (DBS) for HEIs per District" — subtitle "Dried Blood Spot test result at birth, by district"; grouped bar chart, x = district, bars `Detected` (`detected`), `Not Detected` (`notDetected`), `Pending/Unrecorded` (`pending`); districts sorted by total desc (`:294-325`, `:630-709`). Empty: "No HEI DBS records available". No legend (only tooltip).
- [ ] "Records by Facility" — subtitle "Top 8 facilities by caseload"; horizontal bars, mothers per facility (`"N/A"` → `"Unknown"`), top 8 by count, names >18 chars cut to 16 + "..." (`:327-340`, `:712-771`). **No empty state** (renders an empty chart).
- [ ] "Enrolment Trend" — subtitle "Monthly enrolments over last 6 months"; area chart of mothers per `YYYY-MM` of `ancDate`, sorted ascending, **last 6 months that have data** (not last 6 calendar months), label `toLocaleString("en", {month:"short", year:"2-digit"})` (`:348-369`, `:777-862`). Empty: "No enrolment date data available".
- [ ] "Beneficiary Type Distribution" — subtitle "Mothers vs Infants breakdown"; donut of `Mothers` (mother count) vs `Infants (HEI)` (infant count), zero slices removed, labels `"{name} {pct}%"`, custom legend with counts (`:342-346`, `:865-931`). No empty state.

### Links in / out
- [ ] In: sidebar only (`legacy:src/components/dashboard/AppSidebar.tsx:61`); no query params, state or storage. Documentation mentions "HTS and PMTCT registers" as text only (`legacy:src/data/documentationArticles.ts:85-88`, `legacy:src/pages/Documentation.tsx:133`), no link. No other `navigate`/`to=` targets this path (grep of `legacy:src`).
- [ ] Out: row "View" button (`:1051-1076`) → writes `sessionStorage["pmtct_profile_record"] = JSON.stringify({...raw, hivStatus, district, category: type})` (errors ignored) and `navigate("/profile/pmtct-details", { state: { record } })`. New: `/pmtct/:id` with the ID in the route param (see Open questions — there is no detail endpoint).

### Loading / empty / error
- [ ] `isLoading` = any child or mother query `isLoading` (first load only; `keepPreviousData` keeps old rows while switching district) (`:197-199`). Table: one row with `LoadingDots` (`:999-1004`); KPIs and charts: `LoadingDots`; Sync icon spins while loading or syncing (`:496-501`).
- [ ] Empty table: Activity icon + "No PMTCT records found" (`:1005-1017`).
- [ ] Errors: **none handled** — failed queries contribute no rows and no message appears; partial failure across districts is silent. New: `<ErrorState>` with retry, and a partial-failure notice naming failed districts.

### Bugs and quirks
- [ ] **BUG** District selection snaps back: the effect at `:158-161` depends on `selectedDistrict` and calls `setSelectedDistrict(initialDistrict)` whenever `initialDistrict` is non-empty, so any user whose effective district is set (`user.location`, `user.district` or `VITE_DEFAULT_DISTRICT`, `legacy:src/hooks/useEffectiveDistrict.ts:12`) — including admins and province users — cannot change the selector. Intended: start at the user's default, allow changes within `availableDistricts`.
- [ ] **BUG** A non-admin, non-restricted user with no effective district gets `selectedDistrict = ""` (`:150`) → requests `/etl/pmtct-mother-register/` (empty segment) (`:164`).
- [ ] **BUG** The selector always offers "All Districts" (`:519`) even when `availableDistricts` lacks it (users that are neither admin, province nor district get `ALL_DISTRICTS`, `legacy:src/hooks/useEffectiveDistrict.ts:13`) → national fan-out.
- [ ] **BUG** FY sent and keyed but ignored by backend; the code comment `:169-171` claims server-side filtering (AUDIT.md §3.2).
- [ ] **BUG** Page not reset when FY/data changes; if the row count shrinks `currentPage` can exceed `totalPages` → "No PMTCT records found" while data exists (`:383-388`).
- [ ] **BUG** Search filters mothers but not infants: "Infants (HEI)" KPI, pie and DBS chart ignore search while mother KPIs follow it (`:217-238` vs `:262-271`).
- [ ] **BUG** Sync calls `clearApiCache()` which only clears the IndexedDB list cache (`legacy:src/lib/api.ts:247-251`); these wrappers use `dqaGet` directly and never use it, so only the invalidation matters.
- [ ] **BUG** No error states (see above).
- [ ] Quirk: search matches the `"N/A"` placeholder (typing "n/a" matches rows with missing fields); the query is not trimmed before matching (`:262-263`).
- [ ] Quirk: placeholder says "ID, HHID or facility" but district also matches.
- [ ] Quirk: mother HIV status is hardcoded, not read from data (`:247-250`).
- [ ] Quirk: `id` falls back through 15 keys incl. `ecap_id`/`household_id`/`id` → not guaranteed unique or stable. Pick one key in the normaliser.
- [ ] Quirk: "Enrolment Trend" shows the last 6 months that have data, not the last 6 calendar months (`:359-361`).
- [ ] Quirk: Clear Filters does not reset district.

## Route `/profile/pmtct-details` → `/pmtct/:id`

### Purpose
Read-only "Record Details" card for one PMTCT record (in practice always a mother). Shows the record passed from the register; makes **no API call** (`legacy:src/pages/PMTCTProfile.tsx:40-55`).

### Access
- [ ] Route guard: `<ProtectedRoute>` only (`legacy:src/App.tsx:478-484`).
- [ ] Sidebar/mobile/global search: no entry; sidebar highlights nothing (exact match, `legacy:src/components/dashboard/AppSidebar.tsx:183`).
- [ ] In-page role checks: none.
- [ ] Data scope: none — whatever record was in state/sessionStorage. New page needs re-fetch scoped through `platform/scope`.

### Endpoints
- [ ] None. Record source order (`legacy:src/pages/PMTCTProfile.tsx:40-55`): `location.state.record` if non-empty object → else `JSON.parse(sessionStorage["pmtct_profile_record"])` if non-empty → else `{}` (errors ignored). New: read `:id` from the route and load the mother via `GET /etl/pmtct-mother-register/:district(*)` (AUDIT.md §3.2) — **share the register's query options/cache** — then select by ID (see Open questions).

### Fields used
`pick` = first non-null/undefined/`""` as String, else `"N/A"` (`:10-16`). The header shows:
- Subtitle `` `PMTCT Profile: ${id}` `` (`:78`); eyebrow "PMTCT profile" + badge "Record details" (`:86-90`); title = `id` (`:94`); line `{beneficiaryType || "PMTCT beneficiary"} · {district || "Unknown district"} · {facility || "Unknown facility"}` (`:98`); Back button `navigate(-1)` (`:102-105`).
- Card "Record Details" / "Structured PMTCT profile summary"; badges "PMTCT" and `hiv` (rose if `isPositive`, else slate) (`:114-121`).

Grid tiles, in order (`:127-155`); `"N/A"` shown greyed (`:157-161`). No formatting (raw strings, dates unformatted):

| Label | Raw keys tried (in order) |
|---|---|
| PMTCT ID | same 15-key list as register (`:18-35`) |
| ECAP ID | `ecap_id, ecapid` (`:65`) |
| ECAP Question | `ecap_id_question` (`:66`) |
| Beneficiary Type | `beneficiary_type, type, record_type, client_type` (`:62`) |
| Caregiver | `mother_name, client_name, beneficiary_name, child_name` (`:68`) |
| Sex | `caregiver_sex, sex` (`:131`) |
| Birthdate / Age | `mothers_birthdate, caregiver_age, age` (`:73`) |
| Province | `province` |
| District | `district, district_name` (`:59`) |
| Ward | `ward` |
| Facility | `facility, facility_name, health_facility` (`:58`) |
| Home Address | `home_address, homeaddress, address` (`:71`) |
| Landmark | `nearest_landmark, landmark` (`:72`) |
| Phone | `mothers_phone, phone_number, contact, telephone` (`:69`) |
| Partner | `partner, male_partner_name, spouse_name` (`:70`) |
| Relation | `relation` |
| Caseworker | `caseworker_name` |
| Date Enrolled PMTCT | `date_enrolled_pmtct` |
| Date Enrolled ECAP | `date_enrolled_ecap` |
| Date Initiated ART | `date_initiated_art, date_initiated_on_art, date_initiated_on_treatment` |
| Date Tested | `date_tested` |
| Recency Result | `recency_test_result, recency_test_result_if_applicable, applicable_recency_result` |
| TB Screening | `tb_screening` |
| Syphilis Testing | `syphilis_testing` |
| 1st Visit | `date_1st_visit` |
| 6 Weeks | `hiv_test_result_r_nr_at_6_weeks, art_initiated_at_6_weeks, family_planning_counselling_at_6_weeks` |
| 6 Months | same pattern `_at_6_months` |
| 9 Months | same pattern `_at_9_months` |
| 12 Months | same pattern `_at_12_months` |
| 18 Months | same pattern `_at_18_months` (`:151-155`) |

HIV badge value `hiv`: `result_of_hiv_test, result_r_nr, test_result_at_birth, infant_hiv_status, hiv_status` (`:60`); `isPositive = /positive|reactive|yes/i.test(hiv)` (`:75`). Unused: `date` (`:61`).

The labels "ECAP ID", "ECAP Question", "Date Enrolled ECAP" contain the program name and must come from `@/config`.

### Filters / sort / pagination / search
- [ ] None.

### Exports
- [ ] None.

### Charts
- [ ] None.

### Links in / out
- [ ] In: only the register's View button (`legacy:src/pages/PMTCTRegister.tsx:1055-1073`) — state `{ record: {...raw, hivStatus, district, category} }` + sessionStorage `pmtct_profile_record`. No other inbound links (grep).
- [ ] Out: Back (`navigate(-1)`, `:102`). No links to household/VCA/HEI records.

### Loading / empty / error
- [ ] No loading state (synchronous). With no record (direct load, new tab after sessionStorage cleared) the page renders title "N/A" and every tile "N/A" — no empty/not-found state. New: skeleton while loading, `<EmptyState>` "record not found", `<ErrorState>` with retry.

### Bugs and quirks
- [ ] **BUG** Detail page depends on `location.state`/`sessionStorage` (`:40-55`) — not linkable or refreshable; violates the route-param rule.
- [ ] **BUG** `isPositive` regex matches "Non-reactive"/"non reactive" as positive (`:75`).
- [ ] **BUG** The register passes `hivStatus` and `category` (`legacy:src/pages/PMTCTRegister.tsx:1056-1061`) but the profile never reads those keys (`:60`, `:62`), so the HIV badge and Beneficiary Type are often "N/A" for mothers.
- [ ] **BUG** Fallbacks `|| "PMTCT beneficiary"`, `|| "Unknown district"`, `|| "Unknown facility"` (`:98`) never fire because `pick` returns `"N/A"`, not `""`.
- [ ] **BUG** Milestone tiles (6 Weeks … 18 Months) show whichever of three different fields (HIV test result, ART initiated, FP counselling) is non-empty first (`:151-155`); the user cannot tell which one is shown. Intended: show each sub-field separately.
- [ ] **BUG** "Birthdate / Age" mixes a birthdate and an age in one tile (`:73`); dates throughout are unformatted.
- [ ] **QUESTION** The register comment (`legacy:src/pages/PMTCTRegister.tsx:213-216`) says a mother's linked HEIs "belong on her own profile page … joined by the shared pmtct_id", but the profile does not show them. Should the new `/pmtct/:id` list linked infants from `GET /etl/pmtct-child-register/:district(*)` (AUDIT.md §3.2) where `pmtct_id` matches?
- [ ] Quirk: Back uses history (`navigate(-1)`); on direct load it leaves the app. New: link to `/pmtct` (keep URL filters).

## Other behaviour

- [ ] Tabs "Register" (default) / "Charts" (`legacy:src/pages/PMTCTRegister.tsx:154`, `:535-553`); page subtitle "PMTCT Charts" vs "PMTCT Register" by tab (`:446-448`). Tab not persisted. New: URL param.
- [ ] Hero copy (domain terms, config candidates): eyebrow "PMTCT register" (`:466`), title "Prevention of mother-to-child transmission" (`:484`), description "Mother &amp; infant pairs, HIV exposure, and follow-up status." (`:488`). Sentinel `"All Districts"` (`:150`, `:160`, `:164-165`, `:519`).
- [ ] Sync button "Sync data" (`:492-503`): `clearApiCache()`, then `invalidateQueries({ queryKey: ["pmtct"] })`; toast "Data synced successfully" or "Sync failed" (`:201-211`).
- [ ] Toasts (sonner): "Data synced successfully", "Sync failed", "No data available to export.", "Register exported successfully.", "All filters have been reset."
- [ ] Animations: framer-motion page fade/slide (`:449-454`), KPI hover lift (`:587-591`), Tailwind pulse blobs in hero (`:459-460`), tab slide-in (`:558`, `:938`). Decorative — drop or use CSS only.
- [ ] Storage: sessionStorage `pmtct_profile_record` written (`legacy:src/pages/PMTCTRegister.tsx:1063-1066`), read (`legacy:src/pages/PMTCTProfile.tsx:45`) — holds the full raw record incl. names/phone (PII). Do not port. Query results are persisted to IndexedDB (`ecap-plus-pmp-react-query`, 24 h, any successful query, `legacy:src/App.tsx:136-160`, `:214-224`), so PMTCT rows with PII persist on disk. FY localStorage `ecap_plus_pmp.fy_filter_state_v2` (global).
- [ ] Timers: none in either page; global ETL poll 30 s invalidates PMTCT queries (`legacy:src/components/EtlInvalidator.tsx:28`, `:78-79`); refetch on window focus (global default).
- [ ] No mutations, forms, dialogs or keyboard shortcuts.
- [ ] Related (other modules): data-pipeline has a `pmtct` pipeline producing `pmtct_mother_ecapplus_register_*.csv` / `pmtct_child_ecapplus_register_*.csv` (`legacy:src/pages/DataPipelinePage.tsx:92`, `:106`, `:126-128`); caseworker journeys classify `pmtct_mother`/`pmtct_child` types (`legacy:src/pages/CaseworkerJourneys.tsx:87`, `:98`).

## Open questions for the developer

1. **Detail lookup:** there is no single-record PMTCT endpoint. Should `/pmtct/:id` re-fetch the district mother register and pick the row (needs the district: add `?district=` to the URL, or fan out across scope)? Or is this a backend ask for `GET /etl/pmtct-mother-register/record/:id`?
2. **Record ID:** which raw key is the canonical ID (`pmtct_id` may be `""`, AUDIT.md §3.2)? The legacy 15-key fallback is not unique.
3. **FY:** backend ignores `from`/`to`. Filter client-side by `date_enrolled_pmtct`, or show "all time" with a notice until the backend supports it?
4. **KPIs:** keep three identical KPIs (Total Records / Mothers / HIV Positive)?
5. **Linked HEIs on profile** (see the QUESTION above).
6. **HIV status for mothers:** keep hardcoded "HIV Positive" (definitional) or read `result_of_hiv_test`/`result_r_nr` if present?
7. **PII persistence:** set `meta: { persist: false }` on PMTCT queries (names, phones, addresses)?
8. **Scope:** backend trusts the district param (Backend ask: enforce on the server).
