# districts — legacy audit

> Legacy routes → new routes: `/districts` → `/districts` · Plan: MIGRATION_PLAN.md §5 row "districts"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/Districts.tsx` | 585 | The whole page: per-district households/VCAs table, summary CSV export, per-district detailed CSV export. Contains an unused `KpiCard` component (`:522-583`) |
| `legacy:src/App.tsx` | 602 | Route registration (`:80` lazy import, `:261-267` route), QueryClient defaults (`:112-134`), React Query IndexedDB persister (`:140-148`) — read the relevant parts only |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard used by `/districts` |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar nav entry and the only role rule for this page (`:51`, `:159`, `:166`) |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile bottom nav entry (`:7`), no role filtering |
| `legacy:src/components/dashboard/DashboardLayout.tsx` | (partial) | Mobile sheet menu entry (`:35`), no role filtering; passes `subtitle` to header (`:94`) |
| `legacy:src/components/dashboard/DashboardHeader.tsx` | (partial) | `HIDDEN_ROUTES` includes `/districts` (`:35-43`): hides GlobalSearch and the FY filter on this page (`:85`, `:245-257`) |
| `legacy:src/components/dashboard/GlobalSearch.tsx` | 212 | Navigation entry "Districts" (`:35`); no record links to this page |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | **Not used by `Districts.tsx`**; read for comparison only (the page derives scope itself) |
| `legacy:src/lib/api.ts` | (partial) | Wrappers `getTotalVcasCount` (`:253-259`), `getTotalHouseholdsCount` (`:261-270`), `getTotalMothersCount` (`:272-278`, imported, unused), `getHouseholdsByDistrict` (`:301-312`), `getHouseholdMembers` (`:314-317`), list cache `getListFromApiWithCache` (`:212-238`), `fyQs` (`:241-245`), `LIST_CACHE_TTL_MS` (`:14`) |
| `legacy:src/lib/exportUtils.ts` | (partial) | `escapeCsvField` (`:4-9`), `downloadCsv` (`:14-29`) |
| `legacy:src/lib/utils.ts` | (partial) | `toTitleCase` (`:18-21`) used for district-name normalisation |
| `legacy:src/context/FyFilterContext.tsx` | 122 | FY window source (`useFyFilter`, `:122`); URL > localStorage > default (`:50-56`) |
| `legacy:src/lib/fiscalYear.ts` | (partial) | `resolveFy` (`:36-53`): `mode:"all"` gives null dates |
| `legacy:src/pages/HouseholdRegister.tsx` | (partial) | Consumer of the outbound "View" link (`?district=`, `:74-99`, `:140-164`) |
| `legacy:src/components/EmptyState.tsx` | 51 | Empty-state component used by the table |
| `legacy:src/components/aceternity/LoadingDots.tsx` | 17 | Loading indicator used by the table and the per-row export button |
| `legacy:src/components/AnimatedCounter.tsx` | 59 | Imported only for the unused `KpiCard` |
| `legacy:src/components/aceternity/GlowCard.tsx` | 37 | Card wrapper (decorative) |

## Route `/districts` → `/districts`

### Purpose
"District coverage" page: lists every district discovered in the active household register (for the user's `location`, or nationally), with a per-district count of unique households and of VCAs, a summary CSV export, a per-district "detailed report" CSV export (one row per household with member counts), and a "View" button that opens the household register filtered to that district (`legacy:src/pages/Districts.tsx:307-519`).

Static copy (should come from config/i18n, not hardcoded):
- Hero eyebrow: `District coverage` · `<today, en-GB long date>` · badge `<n> districts` (`legacy:src/pages/Districts.tsx:319-329`; date format `{ weekday: "long", day: "numeric", month: "long", year: "numeric" }` in `"en-GB"`, `:296-301`).
- Hero title: `Geographic coverage & reach` + badge `<totalHouseholds> households` (`:331-342`), where `totalHouseholds` is the sum of the per-district household counts (`:302-305`) formatted with `toLocaleString()` (browser locale).
- Hero blurb: `Programme reach by district. Drill into any row to see records or export a detailed report.` (`:343-346`).
- Card title `District Coverage` with badge `<n> district|districts` (singular when exactly 1) (`:388-398`).
- `DashboardLayout subtitle="Districts"` (`:308`), forwarded to `DashboardHeader` (`legacy:src/components/dashboard/DashboardLayout.tsx:94`).

### Access
- [ ] **Route guard:** `ProtectedRoute` only, no role check (`legacy:src/App.tsx:261-267`). `ProtectedRoute` redirects to `/` when there is no user (`legacy:src/components/auth/ProtectedRoute.tsx:12-14`) and to `/change-password` when `user.password_change_required` (`:16-18`); renders nothing while auth is loading (`:8-10`).
- [ ] **Sidebar:** entry `{ title: "Districts", url: "/districts", icon: MapPin }` in section "Overview" (`legacy:src/components/dashboard/AppSidebar.tsx:47-51`). Hidden only for district users: `const isDistrictUser = user.description === "District User";` (`:159`) and `if (item.url === "/districts" && isDistrictUser) return false;` (`:165-166`, comment "Restricted for District Users (per security intent)"). Exact, case-sensitive `description` match.
- [ ] **Mobile bottom nav:** `{ label: "Districts", url: "/districts", icon: MapPin }` (`legacy:src/components/dashboard/MobileBottomNav.tsx:7`), shown to **every** user (no role filtering, `:25-36`).
- [ ] **Mobile sheet menu:** `{ title: "Districts", url: "/districts", icon: MapPin }` (`legacy:src/components/dashboard/DashboardLayout.tsx:35`), no role filtering.
- [ ] **Global search nav entry:** `{ title: "Districts", url: "/districts", icon: MapPin, category: "Navigation" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:35`), no role filtering. No record-level search links point here.
- [ ] **BUG** The intent ("Restricted for District Users") is enforced only by hiding the sidebar entry; district users still reach the page via the mobile bottom nav, mobile sheet menu, global search, or the URL (`legacy:src/App.tsx:261-267`). Port the intent: declare a manifest permission (e.g. `districts:view`, granted to national/province scope) and hide all nav entries + guard the route via the shell. Backend must also enforce (see Backend asks).
- [ ] **In-page role checks:** none. No `isAdmin`/`description`/`title` comparisons in `Districts.tsx`.
- [ ] **Data scope:** `const dashboardDistrict = user?.location || "All";` (`legacy:src/pages/Districts.tsx:52`). The page does **not** use `useEffectiveDistrict` (compare `legacy:src/hooks/useEffectiveDistrict.ts:5-17`) and has no district selector. Consequences:
  - national/admin users (location `"All"` or empty) → `"All"` → national data;
  - **BUG** province users (province in `title`, location usually `"All"`) get **national** data, not their province's districts — no province restriction is applied anywhere on this page (contrast HouseholdRegister's client-side province guard, `legacy:src/pages/HouseholdRegister.tsx:153-156`). New module: derive scope from `platform/scope` (province → that province's districts);
  - district users with a `location` see only their own district; a "District User" with empty `location` gets national data (**BUG**, fails open).
- [ ] FY window: `useFyFilter().resolved` (`legacy:src/pages/Districts.tsx:54`); `fyArg = { from, to }` only when both dates are set (`:55-56`); `fyKey = "all"` when `mode === "all"`, else `"<from>_<to>"` (`:57-58`). **QUESTION/BUG** The header hides the FY filter on `/districts` (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,253-257`) yet the page still applies the FY window held in URL/localStorage (`legacy:src/context/FyFilterContext.tsx:50-56`), and nothing on the page shows which FY is in effect. New page should either show the FY control/label or ignore FY deliberately.

### Endpoints
All via DQA `dqaGet` (Bearer token) — (AUDIT.md §3.2).

- [ ] `GET /household/households-count/:district(*)` — `getTotalHouseholdsCount(dashboardDistrict, fyArg)` (`legacy:src/pages/Districts.tsx:61-64`; wrapper `legacy:src/lib/api.ts:261-270`). Sent as `/household/households-count/<encodeURIComponent(location|"All")>[?from=&to=]`. Fires on mount, always enabled. Query key `["kpi","households", dashboardDistrict, fyKey]`. App defaults (staleTime 60 s, gcTime 24 h, refetch on mount/focus/reconnect, retry 1; `legacy:src/App.tsx:126-131`). **Result is never rendered** — only feeds the `isSyncing` flag (`legacy:src/pages/Districts.tsx:170-171`). Do not port the call unless a page-level KPI is wanted (see Open questions).
- [ ] `GET /child/vcas-count/:district(*)` — same pattern: `getTotalVcasCount(dashboardDistrict, fyArg)` (`legacy:src/pages/Districts.tsx:66-69`; wrapper `legacy:src/lib/api.ts:253-259`), key `["kpi","vcas", dashboardDistrict, fyKey]`. **Result never rendered** (only `isSyncing`, `:172`).
- [ ] `GET /household/all-households/:district(*)` (discovery) — `getHouseholdsByDistrict(dashboardDistrict === "All" ? "" : dashboardDistrict, fyArg)` (`legacy:src/pages/Districts.tsx:72-80`; wrapper `legacy:src/lib/api.ts:301-312`). For "All" the path is `/household/all-households/` (empty segment = no filter → **entire national active register**) plus `?from=&to=` when FY is set. Key `["districts-discovery", dashboardDistrict, fyKey]`, `staleTime: 5 min` (`:79`). Behind an extra IndexedDB list cache: key `households_by_district:<district || "ALL">[:<from>_<to>]`, TTL 60 s, stale-on-error (`legacy:src/lib/api.ts:14,212-238,305-310`). Response list extracted with `getListValue` (`data` key, `legacy:src/lib/api.ts:116-...`).
  - Client post-processing (`legacy:src/pages/Districts.tsx:82-107`): group rows by `toTitleCase(raw.trim())` of `household.district` (rows with falsy district skipped); each group keeps the list of raw spelling variants (untrimmed raw values). District list = group keys sorted with default `Array.prototype.sort()`. If none discovered and the scope is a single district, fall back to `[dashboardDistrict]`; if "All", empty list. `toTitleCase` lower-cases and capitalises each space-separated word (`legacy:src/lib/utils.ts:18-21`).
- [ ] `GET /child/vcas-count/:district(*)` (per district, per variant) — inside each district-stats query: `Promise.all(variants.map(v => getTotalVcasCount(v, fyArg)))`, summed with `Number(r) || 0`; any rejection → whole district VCA count `0` silently (`legacy:src/pages/Districts.tsx:144-152`). One request per raw spelling variant because backend matching is exact/case-sensitive (AUDIT.md §3.2 conventions).
  - District-stats query (`useQueries`, `legacy:src/pages/Districts.tsx:110-165`): one per normalised district, key `["district-stats-v3", normalizedName, fyKey]`, `enabled: !householdsListQuery.isLoading && householdsListQuery.isFetched` (`:162`), `staleTime: 5 min` (`:163`). Households are **not** fetched again: the queryFn filters the discovery data in closure by `String(h.district ?? "").trim()` ∈ variants (`:120-125`) and counts unique household IDs (`h.household_id ?? h.householdId ?? h.hh_id ?? h.id`, non-empty), falling back to row count if no IDs (`:127-139`). Returns `{ district, households, vcas, variants }` (`:154-159`).
  - Final list: query data, falsy removed, de-duplicated by `district` (`:181-185`).
- [ ] `GET /household/all-households/:district(*)` (detailed export) — `getHouseholdsByDistrict(v)` per raw variant, **no FY** (`legacy:src/pages/Districts.tsx:233-236`), results flattened. Imperative (not React Query), triggered by the row's export button. Uses the same IndexedDB list cache key `households_by_district:<variant>`.
- [ ] `GET /household/members/:household_id(*)` (detailed export) — `getHouseholdMembers(hhId)` for **every** household of the district, all in parallel with no batching (`legacy:src/pages/Districts.tsx:243-255`; wrapper `legacy:src/lib/api.ts:314-317`). hhId = `h.household_id ?? h.householdId ?? h.hh_id` (no `id` fallback here, unlike the count); empty → 0 without a request; error → 0; result → `members.length` if array.
- Imported but not called: `getTotalMothersCount`, `getChildrenByDistrict` (`legacy:src/pages/Districts.tsx:32,34`).

### Fields used
| Field (normalised name the page uses) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| district (group name) | `district` (`:87`), normalised `toTitleCase(raw.trim())` | Table "District" column, CSV "District", View link param, row key | Title Case |
| district variants | raw `district` values (`:94-96`); matched as `String(h.district ?? "").trim()` (`:123`) | VCA-count requests, export requests | — |
| householdId (count) | `household_id`, `householdId`, `hh_id`, `id` (`:131`) | Unique-household count per district | — |
| households (count) | derived | Table "Households", mobile "HH:", hero badge sum, summary CSV | `Intl.NumberFormat("en-GB")` via `formatCount` (`:187-192`; null/NaN → "0"); hero sum `toLocaleString()` (`:340`); CSV raw integer string (`:205`) |
| vcas (count) | `count` from `/child/vcas-count` via `getCountValue` | Table "VCAs", mobile "VCAs:", summary CSV | as above |
| export: Household ID | `household_id`, `householdId`, `hh_id` (`:270`) | detailed CSV | string, "" if missing |
| export: Caregiver Name | `caregiver_name`, `name` (`:271`) | detailed CSV | |
| export: District | `district` (`:272`) | detailed CSV | raw (not normalised) |
| export: Ward | `ward` (`:273`) | detailed CSV | |
| export: Community | `community`, `village` (`:274`) | detailed CSV | **QUESTION** neither key is established for `all_households` (AUDIT.md §3.2 field table) — likely always "" |
| export: Date Enrolled | `date_enrolled`, `enrollment_date` (`:275`) | detailed CSV | raw string, no date formatting |
| export: Case Status | `case_status`, `status`, default `"Active"` (`:276`) | detailed CSV | |
| export: Total Members | `members.length` from `/household/members` (`:277`) | detailed CSV | integer string |
| export: Last Service Date | `last_service_date` (`:278`) | detailed CSV | raw; column uncertain on backend |

### Filters / sort / pagination / search
- [ ] No filters, no search, no district selector on the page. Scope = user `location` or "All"; FY from global context (hidden control) — see Access.
- [ ] Sort: rows ordered by normalised district name, default JS sort (code-unit order) (`legacy:src/pages/Districts.tsx:103`). No sortable columns. New page: `platform/data-table` with sortable District/Households/VCAs, default District ascending (locale compare).
- [ ] Pagination: none; all districts rendered (`:441-511`). Small list (12 districts in backend geography config, AUDIT.md §3.1 item 10), so client-side is fine.
- [ ] Row number column `No.` = `String(index + 1).padStart(2, "0")` (`:446-448`), hidden below `md` (`:404`).

### Table
Columns in order (`legacy:src/pages/Districts.tsx:403-419`):
1. `No.` — hidden below `md`.
2. `District` — MapPin icon + name; below `sm` also shows `HH: <households>` and `VCAs: <vcas>` inline (`:454-463`).
3. `Households` — hidden below `sm`.
4. `VCAs` — hidden below `sm`.
5. `Action` (right-aligned) — per-row export icon button (title `Export Detailed Report`, spinner while exporting this district, disabled while `exportingDistrict === data.district`) and `View ›` button (`:479-508`).

### Exports
- [ ] **Summary CSV** — button `Export Summary` in hero (`legacy:src/pages/Districts.tsx:365-372`), disabled when there are 0 districts (`:367`). If empty at click: toast error `No data available to export` (`:196-198`). Rows = all displayed districts (no filtering exists). Headers exactly `["District", "Households", "VCAs"]` (`:202`; comment "Vulnerability Status removed per feedback", `:201`). Row = `[district, String(households || 0), String(vcas || 0)]` (`:203-207`). Filename `districts_summary_${YYYY-MM-DD}.csv` with date from `new Date().toISOString().slice(0,10)` (UTC) (`:209-210`). Success toast `Summary exported successfully`; failure toast `Failed to export summary` + `console.error("Export error:", …)` (`:211-215`). Library: hand-rolled `downloadCsv` (data URI) (`legacy:src/lib/exportUtils.ts:14-29`). No branding/header/footer rows.
- [ ] **Detailed district CSV** — row icon button (`legacy:src/pages/Districts.tsx:481-495`) → `handleExportDistrictDetails(district)` (`:222-294`). Flow: set `exportingDistrict`; info toast `Preparing export for ${districtName}…`; fetch households for each variant (no FY); if none → error toast `No household data found for ${districtName}` and stop; fetch member counts; build rows; download; success toast `${districtName} exported — ${households.length} records`; failure toast `Failed to export data for ${districtName}`; finally clear `exportingDistrict`. Headers exactly, in order: `Household ID`, `Caregiver Name`, `District`, `Ward`, `Community`, `Date Enrolled`, `Case Status`, `Total Members`, `Last Service Date` (`:257-267`) — sources in Fields table. Rows: every household row returned (not de-duplicated by ID). Filename `${districtName}_detailed_report_${YYYY-MM-DD}.csv` (UTC date; district name verbatim, spaces kept) (`:281-286`). New module: use `platform/export`, keep header list and filename pattern (sanitise name), apply the page's scope + FY (see BUGs), and replace N member calls (see Backend asks).

### Charts
- [ ] No charts. Two count badges only: hero `<n> districts` and `<sum> households` (`legacy:src/pages/Districts.tsx:328,340`). `KpiCard` exists but is never rendered (`:522-583`) — do not port.

### Links in / out
- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:51`), mobile bottom nav (`legacy:src/components/dashboard/MobileBottomNav.tsx:7`), mobile sheet menu (`legacy:src/components/dashboard/DashboardLayout.tsx:35`), global search navigation (`legacy:src/components/dashboard/GlobalSearch.tsx:35`). No payload (no query params, no `location.state`, no storage writes). Grep of `src` for `/districts` finds no other navigations (only `DashboardHeader.tsx:37` `HIDDEN_ROUTES`).
- [ ] Out: `View` → `navigate(`/households?district=${encodeURIComponent(data.district)}`)` (`legacy:src/pages/Districts.tsx:499-503`). Payload: query param `district` = normalised Title Case name. Consumed by HouseholdRegister as initial `selectedDistrict` (`legacy:src/pages/HouseholdRegister.tsx:90-92`), which resolves it back to raw variants via its own discovery map (`:146-149,161-164`); district users are locked to their own location regardless (`:83,88`). New: `households` module must expose a path builder (e.g. `householdsPath({ district })`) from its `index.ts`; FY travels via the global scope.

### Loading / empty / error
- [ ] Loading: table body shows a single row with centred `LoadingDots` while `areDistrictsLoading` = discovery `isLoading || isFetching` or any district query `isLoading` (`legacy:src/pages/Districts.tsx:176-179,422-429`). **BUG** Because `isFetching` is included, every background refetch (window focus, 60 s default staleness) replaces existing rows with the loader. New page: skeleton rows on first load only; background refresh keeps data.
- [ ] Empty: `EmptyState` with MapPin icon, title `No District Data`, description `No district data is available yet. Try syncing.` (`:430-439`).
- [ ] Error: **no error handling**. Discovery failure → empty list → shown as the empty state (or, for a single-district user, a row with 0 households). VCA count failure → silently 0 (`:150-152`). No toast, no retry button except "Sync". New page: `<ErrorState>` with retry; per-row VCA failure shown as "—" not 0.
- [ ] Sync button (`:349-364`): label `Sync` / `Syncing…` with spinning icon, disabled while `isSyncing` (any of the 4 query groups fetching, `:170-174`). Invalidates `["kpi"]`, `["districts-discovery"]`, `["district-stats"]`. **BUG** see below.

### Bugs and quirks
- [ ] **BUG** Sync invalidates `["district-stats"]` but the queries use `["district-stats-v3", …]` (`legacy:src/pages/Districts.tsx:112` vs `:355`), so per-district stats are not refreshed; they also keep reading the closed-over discovery data under an unchanged key with a 5-min staleTime (`:112-163`), so household counts can lag the refreshed discovery list. In addition the IndexedDB list cache (60 s TTL) can return the same list again (`legacy:src/lib/api.ts:220-221`). New: one query (or derived `select`) keyed on scope + FY; refresh = refetch.
- [ ] **BUG** District-stats key omits the scope (`dashboardDistrict`) (`:112`); with the 24 h IndexedDB-persisted React Query cache (`legacy:src/App.tsx:140-148`) a different user on the same browser can briefly see another scope's counts. New: scope always in the key; mark user-scoped data appropriately.
- [ ] **BUG** Inconsistent definitions in one row: households = unique IDs in the **active** register (`/all-households`), VCAs = `/child/vcas-count` which counts **active + archived** (AUDIT.md §3.2). Decide one definition (see Open questions).
- [ ] **BUG** Two count requests (`["kpi","households"]`, `["kpi","vcas"]`) are made and never displayed (`:61-69`).
- [ ] **BUG** Detailed export ignores the FY window (`:234`) while the table is FY-scoped, so export row count ≠ table count. Export also does not de-duplicate rows by household ID while the table count does (`:127-134` vs `:269`).
- [ ] **BUG** Detailed export fires one `/household/members` request per household simultaneously (`:244-255`) — thousands of parallel requests for a large district. "Total Members" counts only `children` rows (AUDIT.md §3.2 `/household/members`).
- [ ] **BUG** `Case Status` defaults to `"Active"` when missing (`:276`) — fabricates a value; export "" instead.
- [ ] **BUG** Province users see national data; empty-location district users see national data; route reachable by district users despite sidebar rule (see Access).
- [ ] **BUG** (shared helper) `downloadCsv` builds a `data:` URI with `encodeURI`, which does not encode `#`; any `#` in data truncates the file. No UTF-8 BOM; `escapeCsvField` ignores `\r` (`legacy:src/lib/exportUtils.ts:4-9,14-29`). Use `platform/export`.
- [ ] Quirk: only one `exportingDistrict` is tracked (`:218-220`); starting a second export while one runs clears the first spinner; other rows' buttons stay enabled. New: per-row pending state or disable all while exporting.
- [ ] Quirk: hardcoded locales — `Intl.NumberFormat("en-GB")` (`:191`), `toLocaleDateString("en-GB", …)` (`:296`), browser-locale `toLocaleString()` (`:340`), UTC date in filenames (`:209,281`). Use `core/lib/format.ts`.
- [ ] Quirk: leftover scaffolding comments (`:51`, `:522`) and dead imports (see Legacy files).
- [ ] Quirk: the default sort is code-unit order, not locale-aware (`:103`).

## Other behaviour

- [ ] Toasts (sonner): listed under Exports. No modals, dialogs, forms or mutations.
- [ ] No keyboard shortcuts on the page; GlobalSearch (Ctrl/Cmd+K) is **not mounted** on `/districts` because the header hides it (`legacy:src/components/dashboard/DashboardHeader.tsx:85,245-249`).
- [ ] Timers/polling: none in the page. Caching: discovery + stats `staleTime 5 min` (`legacy:src/pages/Districts.tsx:79,163`); app defaults staleTime 60 s, gcTime 24 h, refetch on mount/focus/reconnect, retry 1 (`legacy:src/App.tsx:126-131`); list cache TTL 60 s (`legacy:src/lib/api.ts:14`). Decorative CSS `animate-pulse` blobs (`legacy:src/pages/Districts.tsx:313-314`) — do not port.
- [ ] Storage read/written (indirect): IndexedDB DB `ecap_plus_cache_db` store `api_cache`, keys `households_by_district:<district|ALL>[:<from>_<to>]` (`legacy:src/lib/indexedDbCache.ts:6-7`, `legacy:src/lib/api.ts:305-310`); React Query persister IndexedDB key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`); localStorage `ecap_plus_pmp.fy_filter_state_v2` read for FY (`legacy:src/context/FyFilterContext.tsx:12,36`). Page itself writes nothing.
- [ ] Browser APIs: DOM anchor click for download (`legacy:src/lib/exportUtils.ts:23-28`).
- [ ] Hardcoded program/brand-ish strings for config parity: `Programme reach by district…` (British spelling, `legacy:src/pages/Districts.tsx:344`), domain term `VCAs` (`:202,414,461`), `households` (`:340`), `HH:` (`:458`).

### Backend asks (to record in PROGRESS.md)
- `/household/all-households`, `/household/households-count`, `/child/vcas-count` trust the `:district` param: any user can request `All` (AUDIT.md §3.2). Server must scope to the user (national / province districts / own district).
- Need a per-district aggregate endpoint (e.g. counts grouped by normalised district for households and VCAs, same active/archived definition, FY-aware) to replace downloading the whole national register plus N count calls.
- Need a household export endpoint with member counts (or a `member_count` column) to replace N parallel `/household/members` calls.
- District names stored with inconsistent case/spacing; backend should normalise (case-insensitive matching) so the client need not fan out per spelling variant.

## Open questions for the developer

- **QUESTION** Who may see `/districts`? Legacy intent hides it from district users only (sidebar), but the route is open to all. Proposed: national + province scope only; province users see their province's districts.
- **QUESTION** Household vs VCA count definitions: active-register unique households vs all-time (active + archived) VCAs. Which definition should the table show? Should a national total row/KPI (the unused `kpi` queries) be displayed?
- **QUESTION** Should the FY filter be visible on this page (legacy hides it but still applies it)?
- **QUESTION** Should the detailed export respect the FY window and de-duplicate households? Keep the `Community` column (source keys `community`/`village` appear absent from `all_households`)?
- **QUESTION** Is the "View" drill-down to the household register enough, or should it also offer VCAs (`/vcas?district=`)?

## Phase 5 implementation decision and status (2026-11-03)

The user approved a **default-off scaffold**. `module.districts` is false by default until the backend provides caller-authorized, scope-enforced district aggregates with consistent household/VCA definitions. Existing count handlers trust caller-supplied district values; the legacy page also downloads the entire national household register.

- `/districts` is registered with `records.view` at province-or-higher scope; district users are excluded because a one-district comparison page is not useful. The feature flag removes the route and nav by default.
- If opened after an intentional code change, the page shows the security/definition blocker and makes no API requests. It does not fetch a national register, render aggregates, show detailed household exports, or expose by-ID routes.
- The future live page should use a server-enforced per-district aggregate endpoint, not row-level household/member downloads. Household and VCA totals must remain separate until their active/archived definitions align; the legacy detailed CSV (which contains caregiver/household data) is not part of this scaffold.
- A future district “View” link may use the households module's public path builder, but there is no row/profile navigation in the scaffold.

Backend follow-up before enabling: authorize aggregates from the authenticated user's scope; return consistent active/archived definitions and documented FY behavior; provide pagination only if returning rows; add a scoped household/member export endpoint if the detailed report is still required. Do not treat client-supplied district values as authorization.
