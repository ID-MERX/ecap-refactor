# caregivers — legacy audit

> Legacy routes → new routes: `/registers/caregiver-risk` → `/caregivers/risk` · Plan: MIGRATION_PLAN.md §5 row "caregivers"

## Rebuild decisions and implementation status

The Phase 5 proposal was approved with these resolutions:

- Add a Registers navigation entry labelled “Caregiver service gaps”; add the cross-link from the caregiver-services page when the Services module is built. No search-provider entry was approved.
- Scope household and caregiver-service reads to the user's effective geography. The caregiver-services endpoint is called once per allowed district, and returned rows must carry that same district. The existing household query is reused and its rows are filtered to allowed configured districts before joining.
- Count caregiver service events only inside the selected FY/custom date window. The endpoint ignores date params, so service rows are filtered client-side; rows without a recognized service date are excluded and disclosed. All time includes available history.
- Keep the four configured domains; `hiv_services` and other service columns do not count.
- Rows are households. Keep the caregiver-service-gap terminology but say “households” in the count; show caregiver names as “Hidden for privacy” and omit names from CSV.
- Backend remains unchanged. A server-side aggregate/pagination endpoint remains a follow-up; the client cap does not bound response bytes.
- Empty/JSON-object category semantics have not been confirmed against production payloads. Current implementation recursively treats an object as provided only if it contains a meaningful value.

The detailed legacy checkboxes below remain for the later live parity/audit pass; implementation coverage is tracked in `PROGRESS.md`.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/CaregiverRiskRegister.tsx` | 387 | The whole page: caregiver (household-level) service-domain gap register. Fetches the national household register and national caregiver service rows, computes per-household domain coverage client-side, filters by gap type / district / search, renders a table (first 100 rows) and exports CSV |
| `legacy:src/App.tsx` | 602 (partial) | Lazy import (`:66-68`), route registration (`:357-363`), QueryClient defaults (`:112-134`), React Query IndexedDB persister (`:140-148`), persist buster clearing the aux API cache (`:152-163`) |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard: auth + forced password change only |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | No entry for this route (read in full) |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | No entry for this route (read in full) |
| `legacy:src/components/dashboard/DashboardLayout.tsx` | (partial) | Mobile sheet menu (`:32-46`): no entry for this route; passes `subtitle` to the header (`:94`) |
| `legacy:src/components/dashboard/DashboardHeader.tsx` | (partial) | `HIDDEN_ROUTES` (`:35-43`) does **not** include this path, so GlobalSearch and the FY filter chip are shown on this page (`:85`) |
| `legacy:src/components/dashboard/GlobalSearch.tsx` | 212 | No navigation entry for this route; no record links to it (read in full) |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | **Not used by this page**; read for comparison only (the page derives the district lock itself) |
| `legacy:src/lib/api.ts` | (partial) | Wrappers `getHouseholdsByDistrict` (`:301-312`), `getCaregiverServicesByDistrict` (`:410-417`); `getListFromApiWithCache` (`:212-238`), `getListValue` (`:115-182`), `dqaGet` (`:184-210`), `fyQs` (`:241-245`), `LIST_CACHE_TTL_MS` 60 s (`:14`), `SERVICES_CACHE_TTL_MS` 5 min (`:8`) |
| `legacy:src/lib/data-validation.ts` | 70 | `isCategoryProvided` (`:10-70`): decides whether a service row "provides" a domain |
| `legacy:src/lib/utils.ts` | (partial) | `toTitleCase` (`:18-21`), `toSentenceCase` (`:23-27`) |
| `legacy:src/context/FyFilterContext.tsx` | 122 | FY window source (`useFyFilter`, `:122`); URL > localStorage > default "all" (`:50-56`) |
| `legacy:src/lib/fiscalYear.ts` | (partial) | `resolveFy` (`:36-53`): `mode:"all"` gives null dates, so no `from`/`to` is sent |
| `legacy:src/components/EtlInvalidator.tsx` | 90 | App-wide: on a new ETL success it clears the aux IDB cache and invalidates every non-`etl` query, including this page's (`:63-83`) |
| `legacy:src/pages/HouseholdProfile.tsx` | (partial) | Consumer of the outbound "View profile" link: reads `?id=` (`:139-147`) |
| `legacy:src/pages/CaregiverServices.tsx` | 11 | Target of the back button; wraps `ServicesPage type="caregiver"`; contains no link back to this register |
| `legacy:src/components/dashboard/services/ServicesPage.tsx` | (grep only) | Confirmed no navigate/link to `/registers/caregiver-risk` (`:488-498`, `:544`, `:565` are the only navigates) |

## Route `/registers/caregiver-risk` → `/caregivers/risk`

### Purpose
A "gap analysis" register that lists households (one row per household, labelled by its caregiver) whose caregiver has **never** received a service in a chosen wellbeing domain (Health, Schooled, Safe, Stable), or, for the "graduation" view, households whose caregiver has received services in **all four** domains. Users pick the gap type and a district, search by ID/name, open the household profile, and export the list as CSV (`legacy:src/pages/CaregiverRiskRegister.tsx:48-54,123-192,194-219`).

Gap types (`legacy:src/pages/CaregiverRiskRegister.tsx:48-54`, quoted exactly):

| `type` key | `label` | icon (lucide) | icon colour class | `domainLabel` | service field tested |
| --- | --- | --- | --- | --- | --- |
| `health_domain` (default) | `"Missing Health Services"` | `HeartPulse` | `text-rose-600` | `"Health"` | `health_services` |
| `schooled_domain` | `"Missing Schooled Services"` | `BookOpen` | `text-emerald-600` | `"Schooled"` | `schooled_services` |
| `safe_domain` | `"Missing Safe Services"` | `Shield` | `text-emerald-600` | `"Safe"` | `safe_services` |
| `stable_domain` | `"Missing Stable Services"` | `Landmark` | `text-amber-600` | `"Stable"` | `stable_services` |
| `graduation_path` | `"Graduation Ready (All 4)"` | `GraduationCap` | `text-emerald-600` | `"Full"` | all four |

- [ ] Port the five gap types with the same keys (`health_domain`, `schooled_domain`, `safe_domain`, `stable_domain`, `graduation_path`) so links shaped like the sibling registers keep working; domain labels/terms must come from `@/config` (program domain terms), not hardcoded (`legacy:src/pages/CaregiverRiskRegister.tsx:48-54`).
- [ ] Inclusion rule per household (`legacy:src/pages/CaregiverRiskRegister.tsx:162-169`): `health_domain` → no Health; `schooled_domain` → no Schooled; `safe_domain` → no Safe; `stable_domain` → no Stable; `graduation_path` → all four present. A household with **zero** service rows is included in every "missing" list and never in graduation.
- [ ] `hiv_services` (and the `other_*_services` columns) are **not** considered for any domain (`legacy:src/pages/CaregiverRiskRegister.tsx:155-158`). **QUESTION:** confirm HIV is intentionally excluded from the four-domain model.

### Access
- [ ] Route guard: `<ProtectedRoute>` only — no role check (`legacy:src/App.tsx:357-363`). `ProtectedRoute` returns `null` while auth loads, redirects to `/` when there is no user, and redirects to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). New manifest: authenticated-only route permission (no extra role), unless the developer decides otherwise.
- [ ] Sidebar: **no entry** (sections listed at `legacy:src/components/dashboard/AppSidebar.tsx:45-114`; the filter at `:147-181` therefore never applies). Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). Mobile sheet menu: no entry (`legacy:src/components/dashboard/DashboardLayout.tsx:32-46`). GlobalSearch navigation: no entry (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`). **QUESTION:** should the new app add a nav entry / search provider entry, and link to it from the caregiver services page (as the VCA dashboard does for its register)?
- [ ] In-page role check 1 — initial district for district users: `(user?.description === "District User" && user?.location) ? user.location : (searchParams.get("district") || "All")` (`legacy:src/pages/CaregiverRiskRegister.tsx:63-65`).
- [ ] In-page role check 2 — district lock effect: `if (user?.description === "District User" && user?.location && selectedDistrict !== user.location) setSelectedDistrict(user.location)` (`legacy:src/pages/CaregiverRiskRegister.tsx:71-75`).
- [ ] In-page role check 3 — district select disabled: `disabled={user?.description === "District User"}` (`legacy:src/pages/CaregiverRiskRegister.tsx:270`). Note it does not also require `user.location`, unlike checks 1 and 2.
- [ ] No other role checks: export and "View profile" are available to every authenticated user (`legacy:src/pages/CaregiverRiskRegister.tsx:283-290,354-364`).
- [ ] Data scope: **the API is always called with `""` (national)** for both data sets, regardless of role (`legacy:src/pages/CaregiverRiskRegister.tsx:80,111,117`). District restriction is purely client-side filtering of national data (`:130,140,146-149`). Provincial users (any description other than the exact `"District User"`) are **not** restricted to their province: they see every district. `useEffectiveDistrict` is not used, so its broader rules (substring `"district"`, `"provincial"`/`"province"`, admin detection; `legacy:src/hooks/useEffectiveDistrict.ts:7-16`) do not apply here. New build: take scope from `platform/scope` (province/district) and send it to the API; put the scope in the query key.
- [ ] **BUG (security/UX):** a district user's browser downloads the full national household register and every caregiver service row; the lock only hides rows. Backend ask: both endpoints trust the district param and apply no user scope (AUDIT.md §3.1 item 3; AUDIT.md §3.2 rows for `/household/all-households/:district(*)` and `/household/caregiver-services-by-district/:district(*)`).

### Endpoints
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) — **district discovery** query.
  - Wrapper `getHouseholdsByDistrict("")` (`legacy:src/lib/api.ts:301-312`), called at `legacy:src/pages/CaregiverRiskRegister.tsx:78-82`.
  - Params as sent: district `""` → URL `/household/all-households/` (empty wildcard = no filter); **no FY** (`from`/`to` not sent).
  - Fires on mount, always (no `enabled`).
  - React Query key `["districts-discovery", "All"]`; `staleTime` 30 min (`:79,81`); global defaults otherwise (`gcTime` 24 h, `retry: 1`, refetch on mount/focus/reconnect; `legacy:src/App.tsx:112-134`).
  - Aux IndexedDB cache key `households_by_district:ALL`, TTL 60 s, stale-on-error fallback (`legacy:src/lib/api.ts:305-311,212-238`).
  - Post-processing: groups `h.district` by `toTitleCase(raw.trim())`, keeping every raw spelling as a variant (`legacy:src/pages/CaregiverRiskRegister.tsx:84-98`); option list = sorted group keys (`:100-102`).
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) — **household rows** query.
  - Same wrapper, called as `getHouseholdsByDistrict("", fyArg)` (`legacy:src/pages/CaregiverRiskRegister.tsx:109-113`).
  - Params: district `""`; `?from=<fy.fromDate>&to=<fy.toDate>` only when both dates are set (`:105`; `legacy:src/lib/api.ts:241-245`). FY "All time" sends nothing. Backend applies the cohort window (enrolled ≤ to and not de-registered before from) (AUDIT.md §3.1 item 5).
  - Fires on mount, always.
  - React Query key `["households-risk-reg", "All", fyKey]` where `fyKey = fy.mode === "all" ? "all" : \`${fy.fromDate ?? ""}_${fy.toDate ?? ""}\`` (`:106,110`); `staleTime` 10 min (`:112`).
  - Aux IndexedDB key `households_by_district:ALL` (all time) or `households_by_district:ALL:<from>_<to>` (`legacy:src/lib/api.ts:305-308`). With FY = all time this is the **same IDB entry and same URL** as the discovery query but a different React Query key.
- [ ] `GET /household/caregiver-services-by-district/:district(*)` (AUDIT.md §3.2) — **caregiver service rows**.
  - Wrapper `getCaregiverServicesByDistrict("")` (`legacy:src/lib/api.ts:410-417`), called at `legacy:src/pages/CaregiverRiskRegister.tsx:115-119`.
  - Params: district `""` → URL `/household/caregiver-services-by-district/`; **no FY** (the endpoint ignores FY anyway).
  - Fires on mount, always.
  - React Query key `["caregiver-services-risk-reg", "All", fyKey]`; `staleTime` 10 min (`:116,118`). The key includes `fyKey` although FY is not sent, so an FY change refetches the identical national list.
  - Aux IndexedDB key `caregiver_services_by_district:ALL`, TTL 5 min (`legacy:src/lib/api.ts:411-415`). Shared with CaseworkerProfile and the Referrals fallback (AUDIT.md §3.2 detail block).
  - Response shape: list via `getListValue` (`data` array). Fields used: `household_id`/`hh_id`, `district` (from the joined household), `health_services`, `schooled_services`, `safe_services`, `stable_services`.
- [ ] Client-side join/post-processing (`legacy:src/pages/CaregiverRiskRegister.tsx:123-192`):
  1. `getHhId(x) = String(x.household_id || x.hh_id || "").trim()` (`:132`).
  2. Service rows are bucketed by household ID, skipping rows whose raw `district` is not in the selected district's variants (when a district is selected) (`:136-144`).
  3. Households are filtered to the selected district's variants (`:146-149`), then for each household the four flags are set if **any** of its service rows satisfies `isCategoryProvided(row, "<domain>_services")` (`:150-159`).
  4. `domain_count` = number of true flags (`:178`); `displayId = hhId || "N/A"` (`:173`); the whole household row is spread into the result (`:171-172`).
  5. Search filter (see below), result returned unsorted (API order).
- [ ] `isCategoryProvided(record, key)` rules (`legacy:src/lib/data-validation.ts:10-70`) — port as a pure, unit-tested helper in `model/`:
  - falsy value → not provided (`:11-12`);
  - a string starting with `[` or `{` is `JSON.parse`d (`:16-18`);
  - array: not provided if empty; otherwise provided if any element, `String(v).trim().toLowerCase()`, is not one of `"not applicable"`, `"none"`, `"null"`, `"n/a"`, `"na"`, `"no"`, `"false"`, `"0"`, `""` (`:21-39`);
  - scalar: provided unless lower-trimmed value is `""` or one of `"not applicable"`, `"n/a"`, `"na"`, `"none"`, `"no"`, `"false"`, `"0"`, `"[]"`, `"{}"`, `"null"` (`:42-54`);
  - JSON parse failure: same scalar check on the raw string, minus `"[]"`/`"{}"` (`:56-69`).
  - **QUESTION:** a parsed JSON **object** (e.g. `{"a":null}`) stringifies to `"[object object]"` and counts as provided (`:42-54`). Confirm whether object-shaped values occur.

### Fields used

| Field (normalised name the page uses) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| householdId (`displayId`) | `household_id`, `hh_id` (`legacy:src/pages/CaregiverRiskRegister.tsx:132`) | Join key with services; column "Household ID"; search; profile link `?id=`; CSV | trimmed string; `"N/A"` when empty (`:173`) |
| caregiverName | `caregiver_name`, `name` (`:187,200,343`) | Column "Caregiver name"; search; CSV | raw; `"N/A"` fallback |
| district | `district` (households `:147`; services `:139`; discovery `:88`) | District filter matching; "District" badge column (raw value, `:344`); CSV (`:201`) | raw string in table/CSV; `toTitleCase(trim)` only for the selector option labels (`:90`) |
| hasHealth | service `health_services` via `isCategoryProvided` (`:155`) | Filter rule; "Health" Yes/No badge; CSV | `"Yes"`/`"No"` |
| hasSchooled | service `schooled_services` (`:156`) | "Schooled" column; CSV | `"Yes"`/`"No"` |
| hasSafe | service `safe_services` (`:157`) | "Safe" column; CSV | `"Yes"`/`"No"` |
| hasStable | service `stable_services` (`:158`) | "Stable" column; CSV | `"Yes"`/`"No"` |
| domainCount | derived (`:178`) | "Grad-ready" badge when `=== 4` (`:351-353`); CSV "Domains Covered" | `` `${n}/4` `` (`:206`) |

### Filters / sort / pagination / search
- [ ] **Gap type** (`legacy:src/pages/CaregiverRiskRegister.tsx:248-262`): Select, `w-[200px]`, placeholder `"Risk category"`. Options in order, labels via `toSentenceCase(label)`: `"Missing health services"`, `"Missing schooled services"`, `"Missing safe services"`, `"Missing stable services"`, `"Graduation ready (all 4)"`. Default `health_domain` when `?type` is absent (`:60`). Persisted in URL param `type` (read every render from `useSearchParams`, `:60`); on change `setSearchParams({ type: val, district: selectedDistrict })` (`:251`). Applies to table, header count, alert, export rows and export filename.
- [ ] **District** (`legacy:src/pages/CaregiverRiskRegister.tsx:264-281`): Select, `w-[180px]`, placeholder `"District"`. Options: `"All districts"` (value `"All"`) then discovered districts (title-cased, sorted, from the national household list — not from config). Default: `user.location` for district users, else `?district` URL value, else `"All"` (`:63-65`). On change sets state and `setSearchParams({ type, district: val })` (`:266-269`). Disabled for `"District User"` (`:270`). Matching: when not `"All"`, households and service rows match if their raw `district` equals any raw spelling grouped under the selected title-case name, falling back to `[selectedDistrict]` when the name is not in the map (`:130`). Applies to table, header count (`" in <district>"` suffix, `:243`), export rows and filename. New build: replace with `platform/scope` district (URL-synced via `platform/filters`), and normalise district names once in the module's normaliser.
- [ ] **Search** (`legacy:src/pages/CaregiverRiskRegister.tsx:306-316,183-189`): text input, placeholder `"Search by ID, Name or District..."`, local state only (not in URL), no debounce. Case-insensitive substring (`toLowerCase().includes`) on `displayId` and `caregiver_name || name`. Applied to table, header count and export.
- [ ] **FY window** comes from the header FY chip (`useFyFilter`, `legacy:src/pages/CaregiverRiskRegister.tsx:104-106`); it restricts **households only** (cohort), never service rows. **QUESTION:** should the services side be FY-scoped (service date within FY) so "missing in this FY" is meaningful? Today a household enrolled in the FY counts as covered by services delivered in any earlier year.
- [ ] Sort: none; rows appear in API order (no ORDER BY on `/household/all-households`, AUDIT.md §3.2). No sortable columns. New build: use `platform/data-table` (decide a default sort, e.g. household ID).
- [ ] Pagination: none; the table renders only `filteredData.slice(0, 100)` (`legacy:src/pages/CaregiverRiskRegister.tsx:340`) with no indication that rows are hidden, while the header count shows the full total (`:243`). New build: real client-side pagination via `platform/data-table`.

### Exports
- [ ] **CSV** — button `"Export csv"` with `Download` icon (`legacy:src/pages/CaregiverRiskRegister.tsx:283-290`), disabled when there are 0 rows; handler returns early on 0 rows (`:195`).
  - Rows: **all** filtered rows (gap type + district + search), not limited to the 100 shown (`:198`).
  - Filename: `` `caregiver_domain_gap_${type}_${selectedDistrict}.csv` `` (`:214`), e.g. `caregiver_domain_gap_health_domain_All.csv`.
  - Columns in order (`:197-207`):
    1. `Household ID` ← `displayId` or `"N/A"`
    2. `Caregiver Name` ← `caregiver_name || name || "N/A"`
    3. `District` ← raw `district || "N/A"`
    4. `Health` ← `"Yes"`/`"No"`
    5. `Schooled` ← `"Yes"`/`"No"`
    6. `Safe` ← `"Yes"`/`"No"`
    7. `Stable` ← `"Yes"`/`"No"`
    8. `Domains Covered` ← `` `${domain_count || 0}/4` ``
  - Library: none — hand-built string joined with `,` and `\n`, `Blob` type `text/csv;charset=utf-8;`, hidden `<a download>` click (`:209-218`). No BOM, no header/footer, no branding.
  - Port through `platform/export`; domain column headers from config.
- [ ] **BUG:** fields are not escaped/quoted (`legacy:src/pages/CaregiverRiskRegister.tsx:209`): a caregiver name or district containing a comma, quote or newline shifts columns. Port with proper CSV escaping.
- [ ] **BUG:** the object URL is never revoked (`legacy:src/pages/CaregiverRiskRegister.tsx:212`).

### Charts
- [ ] None. The only metric is the header count `"<n> records found"` + `" in <district>"` when a district is selected (`legacy:src/pages/CaregiverRiskRegister.tsx:242-244`).

### Links in / out
- [ ] In: **none** — no navigate/link anywhere targets `/registers/caregiver-risk` (grep, see Legacy files). Accepted inbound payload: URL query `?type=<gap key>&district=<district name>` (`legacy:src/pages/CaregiverRiskRegister.tsx:60,65`), plus the app-wide FY params `fy`/`from`/`to` read by `FyFilterContext` (`legacy:src/context/FyFilterContext.tsx:50-56,103-112`). No `location.state`, no sessionStorage/localStorage written by callers. New build: legacy redirect `/registers/caregiver-risk?type=…&district=…` → `/caregivers/risk?type=…&district=…` declared in the manifest.
- [ ] Out — back button (round outline `ArrowLeft`): `navigate("/caregiver-services")` (`legacy:src/pages/CaregiverRiskRegister.tsx:229-236`), no payload. New target: `/services/caregiver` (services module path builder via its `index.ts`).
- [ ] Out — row "View profile" (ghost button + `ChevronRight`): `` navigate(`/profile/household-details?id=${item.displayId}`) `` (`legacy:src/pages/CaregiverRiskRegister.tsx:354-364`); query param `id` only, no state. HouseholdProfile reads `location.state.id || ?id=` and writes sessionStorage `ecap_last_household_id` (`legacy:src/pages/HouseholdProfile.tsx:139-147`). New target: `/households/:householdId` via the households module path builder (`@/modules/households`).
- [ ] **BUG:** the ID is not URL-encoded (`legacy:src/pages/CaregiverRiskRegister.tsx:359`), and a household with no ID links to `?id=N/A` (`:173`). New build: encode the route param and hide the link when there is no ID.

### Loading / empty / error
- [ ] Loading: `isLoading = householdsQuery.isLoading || servicesQuery.isLoading` (`legacy:src/pages/CaregiverRiskRegister.tsx:121`) → centred `<LoadingDots />` inside the card (`:321-324`). The discovery query is not included; header count reads `"0 records found"` while loading. New: skeleton table.
- [ ] Empty: centred `Home` icon, heading `"No records found"`, text `"Try adjusting your filters or search query to find what you're looking for."` (`legacy:src/pages/CaregiverRiskRegister.tsx:371-379`). New: `<EmptyState>`.
- [ ] Context alert (not loading/empty): shown when `type !== "graduation_path"` (`legacy:src/pages/CaregiverRiskRegister.tsx:295-303`) — title `"Gap analysis mode"`, text `"The dashboard shows overall coverage, but this register lists caregivers specifically MISSING {domainLabel} services so you can prioritize them."` (`MISSING` in `<strong>`), with fade/slide-in CSS animation.
- [ ] **BUG:** no error handling. If either data query fails, `filteredData` is `[]` (`legacy:src/pages/CaregiverRiskRegister.tsx:124`) and the page shows the "No records found" empty state; no toast, no retry. The aux cache may silently serve stale data on fetch error (`legacy:src/lib/api.ts:226-236`). If the discovery query fails, the district list is just empty. New: `<ErrorState>` with retry; partial failure (discovery only) should still allow "All".

### Bugs and quirks
- [ ] **BUG:** `filteredData`'s `useMemo` dependency list is `[type, householdsQuery.data, servicesQuery.data, searchQuery]` (`legacy:src/pages/CaregiverRiskRegister.tsx:192`) — it omits `selectedDistrict` and `discoveredDistrictsMap`. Changing the district select does **not** refilter the table, count or export rows until the type, search text or data changes; the export filename does use the new district (`:214`), so it can mislabel national rows. Likewise, if discovery loads after the data, variant matching is not recomputed. Port intended behaviour: district changes refilter immediately.
- [ ] **BUG:** an unknown `?type=` value makes `RISK_TYPES[type]` undefined and the page crashes at `RISK_TYPES[type].icon` (`legacy:src/pages/CaregiverRiskRegister.tsx:60,221`). New: validate with zod, fall back to `health_domain`.
- [ ] **BUG:** search placeholder promises "District" matching, but only ID and name are matched (`legacy:src/pages/CaregiverRiskRegister.tsx:185-188,310`).
- [ ] **BUG:** `setSearchParams({ type, district })` replaces the whole query string, dropping the FY URL params `fy`/`from`/`to` (`legacy:src/pages/CaregiverRiskRegister.tsx:251,268`). FY state survives in context/localStorage (`legacy:src/context/FyFilterContext.tsx:103-112` only syncs when params exist) but shared links lose it.
- [ ] **BUG:** district is read from the URL only once (`useState` initialiser, `legacy:src/pages/CaregiverRiskRegister.tsx:67`) while `type` is read every render (`:60`): browser back/forward changes the URL district but not the select/filter.
- [ ] **QUESTION:** labelling — the page title and alert say "caregivers", but rows are households from the household register keyed by `household_id`; one row per household, not per caregiver (`legacy:src/pages/CaregiverRiskRegister.tsx:146-180,300`).
- [ ] Quirk: households with an empty ID all share the `""` bucket in the service map, so they inherit each other's (and any ID-less service row's) coverage (`legacy:src/pages/CaregiverRiskRegister.tsx:132,138,151-152`).
- [ ] Quirk: the "Grad-ready" badge (`domain_count === 4`) can only appear in the `graduation_path` view, because every other view requires a missing domain (`legacy:src/pages/CaregiverRiskRegister.tsx:351-353,162-169`).
- [ ] Quirk: the table key is the array index (`legacy:src/pages/CaregiverRiskRegister.tsx:341`). Use household ID.
- [ ] Quirk: the same national household URL is cached under two React Query keys (`["districts-discovery","All"]`, `["households-risk-reg","All","all"]`) and downloaded twice when the persisted cache is cold (`legacy:src/pages/CaregiverRiskRegister.tsx:79,110`). New: derive the district list from scope/config or share one `queryOptions` entry with the households module.
- [ ] Performance: both national lists (the full active register and every caregiver service row ever recorded) are downloaded and joined in the browser for every user (`legacy:src/pages/CaregiverRiskRegister.tsx:80,111,117`; AUDIT.md §3.2 "Issues" for both endpoints). **QUESTION:** ask the backend for a server-side domain-coverage endpoint, or at least send the scoped district.

## Other behaviour

- [ ] Page chrome: `DashboardLayout subtitle="Detailed risk registry"` (`legacy:src/pages/CaregiverRiskRegister.tsx:224`); the header therefore shows GlobalSearch and the FY chip (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85`).
- [ ] Title: gap-type icon (coloured per type) + `` `${toSentenceCase(label)} registry` `` → e.g. `"Missing health services registry"`, `"Graduation ready (all 4) registry"` (`legacy:src/pages/CaregiverRiskRegister.tsx:238-241`).
- [ ] Table columns in order (`legacy:src/pages/CaregiverRiskRegister.tsx:329-336`): `"Household ID"`, `"Caregiver name"`, `"District"` (outline badge), `"Health"`, `"Schooled"`, `"Safe"`, `"Stable"` (each a `"Yes"` success-tone / `"No"` danger-tone badge, `:345-348`), `"Action"` (optional `"Grad-ready"` badge + `"View profile"` button, `:349-366`). Colours must map to theme tokens (success/danger), not the hardcoded emerald/rose classes.
- [ ] No mutations, dialogs, forms, toasts or keyboard shortcuts on this page.
- [ ] Timers/polling: none in the page. App-wide `EtlInvalidator` polls ETL last-success and, on a new run, clears the aux IDB cache and invalidates these queries (`legacy:src/components/EtlInvalidator.tsx:53-83`) → new build: set `meta: { etl: true }` on both data queries. Alert uses CSS `animate-in fade-in slide-in-from-top-2` (`legacy:src/pages/CaregiverRiskRegister.tsx:296`) — decorative, may be dropped.
- [ ] Storage read/written (indirectly): IndexedDB `ecap_plus_cache_db` / store `api_cache` keys `households_by_district:ALL`, `households_by_district:ALL:<from>_<to>`, `caregiver_services_by_district:ALL` (`legacy:src/lib/api.ts:305-308,411-415`; `legacy:src/lib/indexedDbCache.ts:6-7`); React Query persisted cache in IndexedDB key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:140-148`); FY state localStorage `ecap_plus_pmp.fy_filter_state_v2` (`legacy:src/context/FyFilterContext.tsx:12`). The page itself writes no storage.
- [ ] Browser APIs: `Blob`, `URL.createObjectURL`, DOM anchor click for the CSV download (`legacy:src/pages/CaregiverRiskRegister.tsx:210-218`).
- [ ] Module boundary note for the rebuild: this page consumes household rows (households module data) and caregiver service rows (services module data). Import only from `@/modules/households` / `@/modules/services` `index.ts` (shared `queryOptions`, path builders), keep the domain-coverage computation in `src/modules/caregivers/model/` with unit tests.

## Resolved decisions and remaining questions

1. **Navigation:** add a Registers item; defer the link from `/services/caregiver` until the Services module exists. No caregiver search provider for now.
2. **FY:** filter service events to the selected FY/custom window; disclose/exclude undated rows. All time counts all available service rows.
3. **Scope:** use effective scope. Service requests are district-by-district with row-tag validation; household rows are filtered to allowed districts. No district user gets an all-district filter or request.
4. **HIV:** intentionally excluded; the model remains the four configured domains.
5. **Labels/privacy:** rows are households, counted as households. Keep caregiver-service-gap terminology; mask names in the table and omit them from CSV.
6. **Backend:** no backend changes in this migration. Keep the response cap and track a scoped aggregate/pagination endpoint as a backend ask; current API response transfer is still unbounded.
7. **Category objects:** still needs confirmation against production payloads. The implementation recursively checks object values and counts only meaningful values.
