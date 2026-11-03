# services — legacy audit (part: vca-services-dashboard)

> New module `services` · Legacy routes → new routes: `/vca-services`, `/household-services`, `/caregiver-services` → `/services/:type`; `/profile/{vca,household,caregiver}-service-details` → `/services/:type/:recordId`; `/services/household-services` (orphan, kept per decision 3); **unrouted `VcaServicesDashboard` (this part), to be ported per decision 2** · Plan: MIGRATION_PLAN.md §5 row "services"
>
> This part covers only the unrouted page component `VcaServicesDashboard` and the `DuplicateDetectionCard` widget it renders. The live `/vca-services` route renders `VcaServices` → `ServicesPage` (`legacy:src/pages/VcaServices.tsx:1-9`, `legacy:src/App.tsx:36,317-324`), which other parts of this module cover.
>
> **Where it goes in the new app (not decided by legacy):** legacy has no URL for this page. A natural home is a "dashboard"/"overview" tab under `/services/vca` (e.g. `/services/vca/overview`), but that is a developer decision. See Open questions.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/VcaServicesDashboard.tsx` | 954 | The page. **Unrouted and never imported.** Grep of `src` for `VcaServicesDashboard` hits only the file itself (`legacy:src/pages/VcaServicesDashboard.tsx:218,306,307,954`). It is not in the lazy imports of `legacy:src/App.tsx:19-110`. Read in full. |
| `src/components/dashboard/DuplicateDetectionCard.tsx` | 489 | Duplicate-service widget rendered at the bottom of the page (`legacy:src/pages/VcaServicesDashboard.tsx:946-948`). Its only importer is this page, so it is effectively dead too. Read in full. |
| `src/lib/data-validation.ts` | 70 | `isCategoryProvided` used for domain coverage KPIs. Read in full. |
| `src/context/FyFilterContext.tsx` | 122 | Global FY filter (`useFyFilter`) the page reads. Read in full. |
| `src/lib/fiscalYear.ts` | 84 | `resolveFy`, FY bounds (Oct–Sep). Read lines 1-84 (relevant parts 18-62). |
| `src/lib/api.ts` | 1486 | Wrappers `getChildrenByDistrict` (`:368-379`), `getVcaServicesByDistrict` (`:499-506`), `getDuplicates` (`:1270-1281`), `listDuplicateReviews` (`:1079-1082`), `upsertDuplicateReview` (`:1084-1101`), `deleteDuplicateReview` (`:1103-1114`), helpers `getListValue` (`:116-182`), `dqaGet` (`:185-210`), `getListFromApiWithCache` (`:212-238`), `fyQs` (`:240-245`), `dqaGetSkipCache` (`:701-712`), TTL constants (`:8,14`). Read those ranges. |
| `src/lib/indexedDbCache.ts` | 92 | IndexedDB list cache behind the wrappers. Read lines 1-80. |
| `src/lib/utils.ts` | 64 | `cn`, `toTitleCase` (`:18-21`). Read lines 1-40. |
| `src/App.tsx` | 602 | Route table; confirms no route renders this page; QueryClient defaults (`:112-134`). Read relevant parts (1-200, 310-330). |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Nav; "Services" section and visibility filter. Read 60-100, 140-182. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile nav. Read 1-30. |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Search nav entries (grep only for services entries `:38-39`). |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Read in full; **not used** by this page. |
| `src/pages/VcaRiskRegister.tsx` | 396 | Link target of the KPI cards; read 1-130 to verify which query params it reads. |
| `src/pages/VcaServices.tsx` | 11 | The component actually routed at `/vca-services` (for contrast). Read in full. |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Layout wrapper; `subtitle` prop (`:28,48,94`). Grep only. |

## Component `VcaServicesDashboard` (unrouted)

### Purpose
A VCA service-delivery intelligence page (layout subtitle "Vca services intelligence", `legacy:src/pages/VcaServicesDashboard.tsx:584`). For one "June–May reporting year" and one district (or all), it shows:
1. a green banner with VCA count, service-event count, district, a reporting-year picker, district picker and a "Sync" button (`:586-661`);
2. four domain-coverage KPI cards (Health, Schooled, Safe, Stable) and a "Graduation readiness (all 4 domains)" card, each linking to the VCA risk register (`:667-717`);
3. a horizontal bar chart "Most common health services" (top 10) (`:720-760`);
4. 12 clickable "Data quality & insights" cards that filter the table (`:763-793`);
5. a searchable "Vca Services" table of the 50 most recent service records (`:798-944`);
6. the `DuplicateDetectionCard` for type `vca` (`:946-948`).

All data is fetched nationally and filtered in the browser.

### Access
- [ ] **Route guard:** none — the page is not routed (no `<Route>` in `legacy:src/App.tsx`; the `/vca-services` route at `legacy:src/App.tsx:317-324` renders `<ProtectedRoute><VcaServices /></ProtectedRoute>`, not this page). When ported, mount it behind the same authenticated-route guard as other `services` routes and declare its permission in the manifest.
- [ ] **Sidebar / nav:** no nav entry points here. The sidebar "Services" section lists `"VCA Services"` → `/vca-services` (`legacy:src/components/dashboard/AppSidebar.tsx:76-96`, item at `:80`); the Services section has no visibility rule (the filter only hides `/districts` for `user.description === "District User"`, the `"Admin"` section for `!isAdmin`, and the `"Data Pipeline"` section for `!isAdmin && !isSupport`, `legacy:src/components/dashboard/AppSidebar.tsx:164-176`). Mobile nav `{ label: "Services", url: "/vca-services" }` (`legacy:src/components/dashboard/MobileBottomNav.tsx:9`). Global search nav `{ title: "VCA Services", url: "/vca-services", category: "Navigation" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:38`). All point at the routed `ServicesPage`, not this component. The new nav entry (if any) is a developer decision.
- [ ] **In-page role checks** (exact string comparisons — port through `useAccess()` / scope, never by comparing strings):
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/VcaServicesDashboard.tsx:221`)
  - `const isProvincialUser = user?.description === "Provincial User";` (`:222`)
  - `const userProvince = user?.title;` (`:223`) — province taken from the Directus `title` field.
  - `const initialDistrict = (isDistrictUser && user?.location) ? user.location : "All";` (`:226-228`)
  - District lock effect: `if (isDistrictUser && user?.location && selectedDistrict !== user.location) setSelectedDistrict(user.location)` (`:237-241`).
  - District picker hidden for district users: `{isDistrictUser ? <div …>{selectedDistrict}</div> : <Select …>}` (`:629-648`) — district users see a read-only pill with their district.
  - Province filter on the district list: `if (isProvincialUser && userProvince && v.province !== userProvince) return;` (`:258`).
  - Province filter on table rows: `if (isProvincialUser && userProvince && service.province !== userProvince) return false;` (`:358`).
  - No admin check anywhere; any authenticated user sees all national KPIs/insights (see Bugs).
- [ ] **Data scope:** the page does **not** use `useEffectiveDistrict` (no import; contrast `legacy:src/hooks/useEffectiveDistrict.ts:5-18`, which uses substring matching on `description`). Both API calls always request **all districts** (empty district path segment → national data, AUDIT.md §3.2 "Notes for every `/child`… endpoint"): `getChildrenByDistrict("", fyArg)` (`:250,277`) and `getVcaServicesByDistrict("")` (`:284`). District/province restriction is applied only client-side (`:349,357-364,426-436`). Port: send the scoped district from `platform/scope`, and record the backend gap (child endpoints trust the district param and return national data for `All`/empty) under PROGRESS.md "Backend asks".
- [ ] **District picker values:** "All" plus districts discovered from the VCA register: `toTitleCase(raw.trim())` of each `v.district`, grouping raw spelling variants under the Title-Case key (`:254-269`), sorted alphabetically (`:271-273`). Provincial users only see districts whose VCA `province === user.title` (`:258`). Selecting a district matches services whose raw `district` is any of the variants (`:349,363,426,434`). (In the new app the district list should come from `platform/scope` / config geography, not data discovery.)

### Endpoints
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2) — wrapper `getChildrenByDistrict` (`legacy:src/lib/api.ts:368-379`). Called **twice** with identical args under two different query keys:
  - District discovery: key `["vca-districts-discovery", fyKey]`, `queryFn: () => getChildrenByDistrict("", fyArg)`, `staleTime: 30 min` (`legacy:src/pages/VcaServicesDashboard.tsx:248-252`).
  - VCA lookup / KPI denominator: key `["vca-vcas-all", "All", fyKey]`, same fn and args, `staleTime: 30 min` (`:275-279`).
  - Params as sent: district path segment `""` (URL `/child/vcas-assessed-register/`), plus `?from=YYYY-MM-DD&to=YYYY-MM-DD` only when the global FY filter resolves to a window (`fyArg = fy.fromDate && fy.toDate ? { from, to } : undefined`, `:244`; `fyQs`, `legacy:src/lib/api.ts:240-245`). `fyKey` is `"all"` or `` `${fromDate}_${toDate}` `` (`:245`). FY window = global PEPFAR FY Oct 1 – Sep 30 (`legacy:src/lib/fiscalYear.ts:21-32`) or custom range; default "All time" (`legacy:src/context/FyFilterContext.tsx:24`).
  - Always enabled. Global defaults otherwise apply: `gcTime 24h`, `refetchOnWindowFocus/Mount/Reconnect: true`, `retry: 1` (`legacy:src/App.tsx:112-134`).
  - Wrapper post-processing: IndexedDB list cache key `children_by_district:ALL` or `children_by_district:ALL:{from}_{to}`, TTL 60 s, stale-on-error fallback (`legacy:src/lib/api.ts:14,212-238,372-377`); `getListValue` unwraps `data` (`:116-182`).
  - Client post-processing: VCA id = `v.uid || v.unique_id || v.vca_id || v.child_id || v.id` (`:353,454,857`); province filter for provincial users (`:258`); district filter by variants for KPIs (`:427-430`).
- [ ] `GET /child/vca-services-by-district/:district(*)` (AUDIT.md §3.2) — wrapper `getVcaServicesByDistrict` (`legacy:src/lib/api.ts:499-506`).
  - Key `["vca-services-all", "All", fyKey]`, `queryFn: () => getVcaServicesByDistrict("")`, `staleTime: 30 min`, `gcTime: 60 min`, `retry: false` (`legacy:src/pages/VcaServicesDashboard.tsx:282-288`).
  - Params as sent: district `""` only. **No FY is sent** (the endpoint ignores FY anyway, AUDIT.md §3.2), yet `fyKey` is in the query key, so changing the global FY refetches the same national list.
  - Wrapper: IndexedDB cache key `vca_services_by_district:ALL`, TTL 5 min (`legacy:src/lib/api.ts:8,500-504`).
  - Client post-processing: reporting-year window (see Filters), district/province/search filters, join to VCA register, sort newest first (`:335-415`); KPI/insight/chart aggregation (`:425-565`).
  - Manual refetch: "Sync" button calls `servicesQuery.refetch()` only (`:649-655`); the VCA queries are not refetched.
- [ ] `GET /etl/duplicates?type=vca` (AUDIT.md §3.2) — via `DuplicateDetectionCard`, see "Other behaviour".
- [ ] `GET /etl/duplicates/reviews`, `POST /etl/duplicates/review`, `DELETE /etl/duplicates/review/:run_key` (AUDIT.md §3.2) — via `DuplicateDetectionCard`, see "Other behaviour". These three endpoints have **no other caller** in legacy (AUDIT.md §3.2 summary), so porting this page revives them.

### Fields used

Service records (`/child/vca-services-by-district`, raw `cs.*` + `district`):

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| vcaId (join key) | `vca_id`, `vcaid`, `child_id` (`:359`); KPI map adds `uid`, `id` (`:442`); table cell uses `pickValue(["vca_id","vcaid","child_id","unique_id"])` (`:854`); duplicate insight uses `vcaid \|\| vca_id` (`:549`) | Join to VCA register; search; "Beneficiary id" column | raw, monospace pill; `"N/A"` if missing (`:422`) |
| serviceDate (for windowing/sort) | `service_date`, `visit_date`, `date`, `created_at`, `service_month`, `referral_month` (`:101-108`, duplicated `:380-387`) | Reporting-year window, newest-first sort | parsed: ISO (`/^\d{4}-\d{2}-\d{2}/` or contains `T`) → `parseISO`; `dd-MM-yyyy`; `dd/MM/yyyy`; else `new Date()` (`:112-125`) |
| serviceDate (display) | `service_date`, `visit_date`, `date` (`:892`) | "Date of service" column | **raw string, unformatted**; `"N/A"` if missing |
| district | `district` (`:360,889`) | District filter; search; "District" column | raw; `"N/A"` if missing |
| province | `province` (`:358`) | Provincial-user row filter | — (column existence uncertain, see Bugs) |
| primaryService | `service`, `service_name`, `form_name` (`:368,866`) | Search; first badge in "Service provided" | raw |
| health_services, hiv_services, schooled_services, safe_services, stable_services, other_hiv_services, other_health_services, other_schooled_services, other_safe_services, other_stable_services | exact keys (`SERVICE_CATEGORIES`, `:132-143`) | "Service provided" badges (`:869-876`); domain KPIs (`:462-465`, only the 4 primary pillars); chart (`health_services`, `hiv_services`, `other_health_services`, `:487-489`); insights (`:525-536`) | JSON-array strings or comma lists, see `parseHealthServices` (`:90-99`) |
| is_hiv_positive | `is_hiv_positive` (`:538,913-917`) | "HIV status" column; HIV+ insights | `"1"`/`true` → "Positive" badge; `"0"`/`false` → "Negative" badge; else "N/A" |
| date_last_vl | `date_last_vl` (`:539,920`) | "Last VL date" column; "HIV+ missing VL" | raw; `"N/A"` |
| vl_last_result | `vl_last_result` (`:539-542,923`) | "VL result" column; VL insights | raw; `"N/A"` |
| level_mmd | `level_mmd` (`:545,926`) | "Level MMD" column; "No MMD level" | raw; `"N/A"` |
| caseworker (service fallback) | `caseworker_name` (`:862`) | "Caseworker" column fallback | raw |

VCA register records (`/child/vcas-assessed-register`):

| Field | Raw keys tried | Where used | Formatting |
| --- | --- | --- | --- |
| vcaId | `uid`, `unique_id`, `vca_id`, `child_id`, `id` (`:353,454,857`) | Join key; KPI denominator | trimmed string |
| district | `district` (`:259,428`) | District discovery and KPI district filter | Title-Cased for picker |
| province | `province` (`:258`) | Provincial-user district list filter | exact compare to `user.title` |
| caseworker | `caseworker_name`, `cwac_member_name`, `caseworker` (`:371,859-861`) | Search; "Caseworker" column | raw, then service `caseworker_name`, then `"N/A"` |

### Filters / sort / pagination / search
- [ ] **Reporting-year filter** ("June year"): `<Select>` in banner (`:614-628`), placeholder "Select June year". Options derived from data: every service date's June reporting year (`getJuneReportingYear(d) = d.getMonth() >= 5 ? year : year - 1`, `:128-130`), de-duplicated, sorted descending; if no dates, the current reporting year (`:310-322`). Option label `` `June ${year} - May ${year + 1}` `` (`:624`). Default: current reporting year (`:233`); an effect falls back to the current year if available, else the newest year, whenever the selection is not in the list (`:324-333`). Window = `[June 1 year, June 1 year+1)` local time (`:335-345`). Records with no parseable date are dropped. Persisted: **none** (state only). Applies to: table, KPIs, chart, insights, banner counts. Does **not** apply to the VCA register (which uses the global FY instead) nor to `DuplicateDetectionCard`. **QUESTION:** the June–May year is hardcoded here while the global FY is Oct–Sep (`legacy:src/lib/fiscalYear.ts:21-32`); per CLAUDE.md rule 4 the year-start month must come from `@/config`. Should the port use the platform FY scope instead of a separate June year?
- [ ] **Global FY filter** (`useFyFilter`, `:243-245`): not a control on this page (the chip lives in the shell); persisted in URL `fy`/`from`/`to` and localStorage `ecap_plus_pmp.fy_filter_state_v2` (`legacy:src/context/FyFilterContext.tsx:12,50-80`). Only affects which VCAs are in the register (cohort window) → KPI denominators and the table join.
- [ ] **District filter:** `<Select>` (`:634-647`), placeholder "Select district", options `"All"` (label **"All districts"**) + discovered districts (see Access). Default `"All"`, or the user's `location` for district users (locked, read-only pill). Persisted: none. Applies to table (`:363`), KPIs/banner/chart (`:426-436`). **Not** applied to insights (`:520-565`) or duplicates.
- [ ] **Data-quality filter** (`dqFilter`): clicking an insight card toggles it (`:770`); active card styled with an emerald border (`:773-775`); a badge `` `Filtered: ${label}` `` and a "Clear filter" text button appear (`:783-792`). Table shows `filteredServices ∩ insight.records` by object identity (`:567-573`). Persisted: none. Applies to the table only.
- [ ] **Search:** `<Input>` placeholder `"Search by beneficiary id, caseworker or district..."` (`:808-813`). Matches (substring, lowercased query, `includes`) any of: VCA id, primary service name (`service`/`service_name`/`form_name`), caseworker from the joined VCA record (`caseworker_name`/`cwac_member_name`/`caseworker`), service `district` (`:367-376`). Query is not trimmed; no debounce. Applies to the table only (not KPIs/insights/chart). Not persisted.
- [ ] **Sort:** fixed, newest service date first (unparseable → timestamp 0, i.e. last) (`:379-414`). No sortable columns.
- [ ] **Pagination:** none. Only the first **50** rows are rendered (`displayedServices.slice(0, 50)`, `:852`), with no "showing 50 of N" indicator and no way to see more (see Bugs). Port: use `platform/data-table` with real client pagination.
- [ ] **Join requirement:** a service row is shown only if its VCA id exists in the (FY-scoped, active-only) VCA register (`if (!vcaMap.has(vId)) return false;`, `:364`).

### Exports
- [ ] The page itself has **no export**. The embedded `DuplicateDetectionCard` has a CSV export (see "Other behaviour"). Port: decide whether the services table gets a `platform/export` export (recommended by UI rules), see Open questions.

### Charts
- [ ] **Banner counters** (`:598-611`): `` `${totalVcas.toLocaleString()} VCAs` ``, `` `${totalServices.toLocaleString()} Service events` ``, and district (`"All districts"` when `"All"`). `totalVcas` = VCAs in the register filtered by district (`:427-430,502`); `totalServices` = services in the reporting-year window filtered by district (`:432-436,505`) — **not** filtered by province, search, the VCA join or dqFilter.
- [ ] **Domain coverage KPI cards** (`RiskKpiCard`, `:161-215`, rendered `:671-716`). For each VCA in the district-filtered register, collect its window services (`serviceMap` keyed by service VCA id, `:440-445`), and mark a domain covered if any service has `isCategoryProvided(s, "<pillar>_services")` true (`:461-466`; helper `legacy:src/lib/data-validation.ts:10-70` treats `"not applicable"`, `"none"`, `"null"`, `"n/a"`, `"na"`, `"no"`, `"false"`, `"0"`, `""`, `"[]"`, `"{}"` as not provided, parses JSON arrays). Rate = count / totalVcas × 100 (`:507-515`).
  | Label | Count | Threshold (inverse) | Icon | Link |
  | --- | --- | --- | --- | --- |
  | `Health` | VCAs with ≥1 `health_services` | yellow 60, red 40 | HeartPulse | `/registers/vca-risk?type=health_domain&district=${selectedDistrict}` |
  | `Schooled` | VCAs with ≥1 `schooled_services` | yellow 60, red 40 | BookOpen | `…?type=schooled_domain&district=…` |
  | `Safe` | VCAs with ≥1 `safe_services` | yellow 60, red 40 | Shield | `…?type=safe_domain&district=…` |
  | `Stable` | VCAs with ≥1 `stable_services` | yellow 60, red 40 | Landmark | `…?type=stable_domain&district=…` |
  | `Graduation readiness (all 4 domains)` | VCAs covered in all four | yellow 15, red 5 | GraduationCap | `…?type=graduation_path&district=…` |
  Card body: big count (`toLocaleString()`, `"0"` when undefined), footer `"Click to view"` + `` ` (${percent.toFixed(1)}%)` `` (`:165-166,200-202`). Colour rule (inverse): `percent <= red` → rose, `<= yellow` → amber, else emerald; slate when no percent (`:168-178`). The `description` props ("Click to view VCAs missing health services", etc., `:677,686,695,704,714`) are never displayed because every card has `to` (`:201`). Library: none (plain markup); colours: Tailwind classes (port to theme tokens).
- [ ] **"Most common health services"** bar chart (`:720-760`): Recharts horizontal `BarChart` (`layout="vertical"`), height 350, Y axis = service name (width 150), X axis hidden, tooltip, bar radius `[0,4,4,0]`, barSize 20. Data: for each window service in the selected district, items from `JSON.parse(health_services)`, `JSON.parse(hiv_services)`, `JSON.parse(other_health_services)` (non-JSON strings → `[]`), skipping falsy and exactly `"None"`, counted per trimmed name; top 10 by count desc (`:475-500`). Header badge `` `${totalServices} service events` `` (`:727-729`). Colours: hardcoded 10-colour palette (sky blues then emeralds) cycled per bar (`:578-581,751-753`) — port to theme chart tokens. Loading → `LoadingDots` (`:733-736`); empty → Target icon + "No health services found" (`:737-741`).
- [ ] **"Data quality & insights"** cards (`:763-793`; heading "Data quality & insights", hint "Click a card to filter records"). Computed over **all** window services (no district/province/search filter, `:520-565`). `isEmpty(v)` = falsy or exactly `""`, `"not applicable"`, `"N/A"`, `"[]"`, `"none"` (case-sensitive, `:523`). Cards in order (key — label — rule):
  1. `no_date` — "Missing service date" — `isEmpty(service_date)` (`:525`)
  2. `no_health` — "No health services" — `health_services` and `other_health_services` both empty (`:526`)
  3. `no_hiv` — "No HIV services" — `hiv_services` and `other_hiv_services` empty (`:527`)
  4. `no_schooled` — "No education services" — `schooled_services` and `other_schooled_services` empty (`:528`)
  5. `no_safe` — "No safety services" — `safe_services` and `other_safe_services` empty (`:529`)
  6. `no_stable` — "No stability services" — `stable_services` and `other_stable_services` empty (`:530`)
  7. `incomplete` — "Incomplete coverage" — any of the 4 primary pillars (with its `other_`) empty (`:531-536`)
  8. `hiv_no_vl` — "HIV+ missing VL" — `is_hiv_positive === "1" || === true` and (`date_last_vl` or `vl_last_result` empty) (`:538-539`)
  9. `vl_suppressed` — "VL suppressed" — HIV+ and `vl_last_result` (lowercased) contains `"suppress"` or `"undetect"`, equals `"ldl"`, or is numeric in (0, 1000) (`:540-543`)
  10. `no_mmd` — "No MMD level" — `isEmpty(level_mmd)` over all records (`:545`)
  11. `future` — "Future-dated" — `new Date(service_date) > now` (`:546`)
  12. `duplicates` — "Duplicate records" — 2nd+ occurrence of key `` `${vcaid || vca_id}|${service_date}|${health_services}` `` (`:547-549`)
  Card shows the count (`text-2xl`) and the uppercase label (`:778-779`). Grid 2/4/6 columns.

### Links in / out
- [ ] **In:** none. Grep of `legacy:src` for `VcaServicesDashboard` finds only the file itself; no route, nav, search entry or `navigate` targets it.
- [ ] **Out — KPI cards** (`<Link>`, `:206-211`): `/registers/vca-risk?type=<health_domain|schooled_domain|safe_domain|stable_domain|graduation_path>&district=<selectedDistrict>` (`:678,687,696,705,715`). No `location.state`, no storage writes. New target: `/vcas/risk?type=…&district=…` (MIGRATION_PLAN.md §5). The target reads `type` (default `health_domain`) and `district` (default `"All"`; ignored for `description === "District User"`) (`legacy:src/pages/VcaRiskRegister.tsx:60-65`). Note the `district` value is not URL-encoded (`:678`).
- [ ] **Out — table rows:** none. A `ChevronRight` hover affordance is shown (`:885`) but rows have no click handler (see Bugs). `useNavigate()` is called but `navigate` is never used (`:219`). Port: rows should link to `/services/vca/:recordId` or `/vcas/:vcaId` (decide).
- [ ] **Out — DuplicateDetectionCard:** none (no links).

### Loading / empty / error
- [ ] Loading: chart area and table body show `LoadingDots` while `servicesQuery.isLoading` (`:733-736,834-841`). KPI cards and banner show `0` while loading (no skeleton). VCA-register loading is not tracked: while it loads, `vcaMap` is empty so the table shows the empty state (see Bugs). Port: skeletons for KPIs, chart and table.
- [ ] Empty: table → FileText icon + "No service logs available" (`:842-850`); chart → "No health services found" (`:737-741`); when both lists are empty `dashboardStats` is `null` and all KPIs show `0` (`:438`).
- [ ] Error: **no error UI**. `servicesQuery` has `retry: false` (`:287`); a failure leaves the empty states. No toast. VCA-query failures are silent. The wrapper falls back to stale IndexedDB data on fetch error (`legacy:src/lib/api.ts:229-236`). Port: `<ErrorState>` with retry per query; partial failure (VCAs ok, services failed or vice versa) should be explicit.
- [ ] Refreshing indicator: the Sync icon spins while `servicesQuery.isFetching` (`:653`). `isRefreshing` is computed but unused (`:576`).

### Bugs and quirks
- [ ] **BUG** KPI meaning vs. link target: the Health/Schooled/Safe/Stable cards show the number of VCAs **with** coverage, but link to the risk register filtered to VCAs **missing** that domain (`legacy:src/pages/VcaServicesDashboard.tsx:671-705` vs `legacy:src/pages/VcaRiskRegister.tsx:49-52,164-167`). The graduation card is consistent (both "all 4", `:168`). Port intended behaviour: label the link clearly ("View VCAs missing …") or show the missing count.
- [ ] **BUG** Numbers do not reconcile with the link target: the risk register uses the global FY only and no June window (`legacy:src/pages/VcaRiskRegister.tsx:108-123`), while this page windows services to a June–May year.
- [ ] **BUG** Insights ignore the selected district and province (computed over `juneWindowServices`, `:520-565`), so district and provincial users see national data-quality counts; clicking a card then shows only the intersection with the district-filtered table, so the card count and visible rows disagree.
- [ ] **BUG** KPIs, banner and chart do not apply the provincial-user restriction when "All" is selected (`:426-436` has no province filter), so provincial users see national KPIs.
- [ ] **BUG** All data is downloaded nationally (`getChildrenByDistrict("")`, `getVcaServicesByDistrict("")`, `:250,277,284`) even for district/provincial users; restriction is client-side only. Backend ask: the child endpoints must enforce user scope.
- [ ] **BUG** Role detection uses exact `description` strings (`:221-222`), unlike `useEffectiveDistrict` (substring rules) and the backend `deriveScope` (AUDIT.md §3.1.3). A user whose description is e.g. "District user" is unrestricted here.
- [ ] **BUG** (PLAUSIBLE) Provincial-user row filter compares `service.province` (`:358`), but `/child/vca-services-by-district` returns `cs.*` + `district` only; if `vca_services` has no `province` column the table is empty for every provincial user (AUDIT.md §3.2 lists other `vca_services` columns as uncertain).
- [ ] **BUG** "Missing service date" can only count records whose date came from `visit_date`/`date`/`created_at`/… because records without any parseable date are already excluded by the June window (`:341-344` vs `:525`). It is effectively always 0.
- [ ] **BUG** "Future-dated" uses `new Date(r.service_date)` (`:546`), which misparses `DD-MM-YYYY` strings (the backend stores both formats, AUDIT.md §3.2); use the same parser as the window. Also, the window already excludes dates past next June, so future dates after that are never counted.
- [ ] **BUG** "VL suppressed" substring `"suppress"` also matches "unsuppressed"/"not suppressed" (`:542`).
- [ ] **QUESTION** "No MMD level" counts every record, not only HIV+ (`:545`); MMD applies only to clients on ART.
- [ ] **QUESTION** `is_hiv_positive`, `date_last_vl`, `vl_last_result`, `level_mmd` are read from service rows (`:538-545,913-926`), but AUDIT.md §3.2 establishes these as `children` columns; they may be absent from `vca_services`, making the HIV/VL/MMD columns all "N/A" and the HIV insights 0. Confirm against the backend/fixtures; maybe they must come from the joined VCA record.
- [ ] **BUG** Chart parser `parseServices` returns whatever `JSON.parse` yields for strings (`:476-484`); a JSON scalar (e.g. `"5"`) is spread at `:490` and throws (number not iterable) or a JSON string is split into characters. Only exactly `"None"` is skipped (`:491`), so "Not applicable"/"none" items are counted. Chart title says "health services" but also counts `hiv_services` (`:488`).
- [ ] **BUG** "Service provided" badges: `parseHealthServices` filters not-applicable values only in the comma-split branch (`:98`); JSON arrays/arrays (`:92,95`) keep "Not applicable"/"None" items as badges.
- [ ] **BUG** Table shows only the first 50 rows, with no pagination or count (`:852`).
- [ ] **BUG** Table rows show a hover chevron (`:885`) but are not clickable.
- [ ] **BUG** While the VCA register loads (or if it fails), every service row is filtered out by the join (`:364`) and the table shows "No service logs available" instead of loading/error.
- [ ] **QUESTION** The join to the active VCA register (`:364`) hides services of archived/out-of-cohort VCAs from the table, but those services still count in `totalServices`, the chart and the insights (`:432-436,520`). Which population is intended?
- [ ] **BUG** `cachedNationwideStats` reads localStorage `ecap_cache_nationwide_vca` (`:290-298`), but nothing in `legacy:src` ever writes that key (grep; the household counterpart writes `ecap_cache_nationwide_household_list` at `legacy:src/pages/HouseholdServicesPage.tsx:121`). Dead fallback; drop it.
- [ ] **BUG** "Sync" only refetches services (`:650`) and the wrapper serves from its 5-minute IndexedDB cache first (`legacy:src/lib/api.ts:220-222`), so Sync often returns the same cached data. It never refreshes the VCA register.
- [ ] **BUG** `fyKey` in the services query key (`:283`) refetches the national service list on FY change although no FY is sent.
- [ ] **BUG** The same VCA register request is issued under two query keys (`:248-252`, `:275-279`). Port: one `queryOptions` shared.
- [ ] **BUG** Debug `console.log` of all field names and three full service records on **every render** (`:304-308`) — leaks beneficiary data to the console. Do not port.
- [ ] **BUG** Per-row `vcas.find(...)` over the whole national register for each of 50 rows on every render (`:856-857`); the `vcaMap` built at `:351-355` should be reused.
- [ ] **BUG** Table heading "Audited operations in {selectedDistrict}" prints the literal `All` for all districts (`:804`), while the banner says "All districts" (`:609`).
- [ ] Quirk: date column shows the raw stored string (`:892`), mixing `YYYY-MM-DD`, ISO timestamps and `DD-MM-YYYY`. Port: format through `core/lib/format.ts`.
- [ ] Quirk: KPI-card `description` texts are never shown (`:201`).
- [ ] Dead code to drop: `MONTHS`, `YEARS = ["2024","2025","2026"]`, `filterKeyToDataKey`, `isNotApplicable`, `PageIntro` import, `navigate`, `isRefreshing`, and unused imports (`useRef`, `format`, `isAfter`, `getMonth`, `getYear`, `AreaChart`, `Area`, `PieChart`, `Pie`, `Legend`, several icons) (`:1-75,83-87,145-159,219,576`). Comment "Full list of 14 filters from legacy TreeTable.tsx" refers to nothing (`:77`).
- [ ] Quirk: hardcoded colours throughout (banner gradient, `#00a67e` Sync text, chart palette `:578-581`, axis `#64748b`/`#f1f5f9`) — port to theme tokens.

## Other behaviour

### `DuplicateDetectionCard` (rendered as `<DuplicateDetectionCard type="vca" />`, `legacy:src/pages/VcaServicesDashboard.tsx:947`)
- [ ] Props: `type: "vca" | "caregiver" | "household"`, optional `district`, `facility` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:13-17`). This page passes **no district**, so it always shows national duplicates regardless of the page's district picker or user scope (**BUG**).
- [ ] `GET /etl/duplicates?type=vca[&district=][&facility=]` (AUDIT.md §3.2) — wrapper `getDuplicates` (`legacy:src/lib/api.ts:1270-1281`, `dqaGetSkipCache`, no IndexedDB cache), returns `data.data`. Query key `["duplicates", type, district, facility]`, `staleTime 5 min` (`DuplicateDetectionCard.tsx:83-87`). Note the backend's all-districts sentinel is `"All Districts"` and it sends `district` whenever truthy (AUDIT.md §3.2).
- [ ] `GET /etl/duplicates/reviews` (AUDIT.md §3.2) — `listDuplicateReviews` (`legacy:src/lib/api.ts:1079-1082`). Key `["duplicate-reviews"]`, `staleTime 60 s` (`:89-93`). Reviewed set = `run_key` of reviews where `!service_type || service_type === type` (`:94-101`).
- [ ] `POST /etl/duplicates/review` body `{ run_key, service_type: type }` (`legacy:src/lib/api.ts:1084-1101`, raw `fetch`); `DELETE /etl/duplicates/review/:run_key` (URL-encoded) (`legacy:src/lib/api.ts:1103-1114`, raw `fetch`). `run_key` = `` `${entity_id}|${service_date}|${services}` `` (`:123,159,410`). Toggle is optimistic with rollback (`:168-193`); toasts (sonner): "Unmarked — record restored to review queue", "Marked as reviewed", error "Failed to save review — try again" (`:179,182,191`). `reviewed_by` is never sent (backend gap: should come from the token, AUDIT.md §3.2). The reviews query is not invalidated after a mutation.
- [ ] Fields: `entity_id`, `service_date`, `services`, `duplicate_count` (backend sends a string; summed with `Number()`), `caseworker_name`, `facility`, `district`, `province`, `ward`; response `entity_label`, `summary.total_groups`, `summary.total_redundant_records` (`legacy:src/lib/api.ts:1245-1268`).
- [ ] Date handling: `normalizeDate` → `YYYY-MM-DD` from ISO, `DD-MM-YYYY`, `DD/MM/YYYY` (`:21-30`); display `formatDate` = `toLocaleDateString("en-US", { year:"numeric", month:"short", day:"2-digit" })`, `"Unknown"` when empty (`:32-40`); month header `formatMonth` = `toLocaleDateString("en-US", { year:"numeric", month:"long" })` (`:71-77`). Port through `core/lib/format.ts` (locale from config).
- [ ] Grouping: groups → by normalised date (`"Unknown"` if none) → per date: totalGroups, redundantRecords = Σ(duplicate_count − 1), top caseworker/location pair by summed duplicate_count (location = `ward || facility || "-"`), reviewedCount (`:107-135`); dates sorted desc; dates grouped by `YYYY-MM`, months desc (`:138-152`).
- [ ] Severity by `duplicate_count`: `>= 10` "Critical", `>= 5` "High", `>= 3` "Medium", else "Low" (`:42-47`).
- [ ] Main card (`:256-381`): title "Duplicate Detection" + badge `` `${total_groups} groups • ${total_redundant_records} redundant records` ``; help text "Grouped by service date. Pick a day to see which {entityLabel.toLowerCase()}s were logged in duplicate on that day."; info box "Why these are flagged: …" (`:269-277`). Table headers in order: "Service Date", "Duplicate Groups" (tooltip "Distinct combinations of entity + date + services that appear more than once"), "Redundant Records" (tooltip "Extra records beyond the first one in each group (count − 1)"), "Top Caseworker", "Review Progress", (blank, "View" button) (`:289-296`). Month header rows with "N group(s)", "N redundant", "N reviewed" badges (`:300-319`). Row: date, groups, redundant badge, top caseworker + location + "N record(s)", progress bar `reviewed/total` (emerald when all reviewed) (`:320-373`). Clicking a row opens the side sheet (`:330`).
- [ ] Side sheet (`Sheet`, right, `sm:max-w-2xl`, `:383-484`): title = formatted date; badges "N duplicate group(s)", "N redundant record(s)", "N reviewed"; one card per group sorted unreviewed first then by `duplicate_count` desc (`:154-166`): entity id (struck through when reviewed), `` `${duplicate_count}× logged` ``, "Reviewed" or severity badge, caseworker ("Unknown caseworker"), facility, `province / district`, "Services" raw string (`"(empty)"`), "Why flagged: …" explanation (`:447-454`), buttons "Flag caseworker" (unreviewed only) and "Mark reviewed" / "Unmark".
- [ ] **BUG** "Flag caseworker" only shows a toast `` `Flagged: ${caseworker_name || "Unknown"} - ${entityLabel} ${entity_id}` `` with description "Caseworker will be notified for correction." (`:195-199`); nothing is saved or sent. Port: wire it to the flags module (`/flags/new?…`) or drop the button — see Open questions.
- [ ] CSV export (`:201-214`): button "Export CSV" (`:279-281`); disabled-by-no-op when no groups. Rows: **all groups** returned (not only the open date). Headers in order: `` `${entityLabel} ID` `` (`entity_id`), "Service Date" (`service_date`, raw), "Services" (`services` with `,`→`;`), "Duplicate Count" (`duplicate_count`), "Caseworker" (`caseworker_name`), "Facility" (`facility`), "District" (`district`), "Severity" (`SEVERITY(duplicate_count).label` — note: passes the raw string, comparisons still coerce). Every cell double-quoted with `"` escaped. Filename `` `duplicates-${type}-${YYYY-MM-DD}.csv` `` (UTC date via `toISOString`). Library: none (Blob + anchor; object URL never revoked). Port via `platform/export`. No branding strings.
- [ ] States: loading spinner + "Analyzing duplicates..." (`:216-225`); error or no data → "Failed to load duplicate detection data" (no retry) (`:227-236`); empty → "No duplicates found" / "Data integrity is clean for the selected filters." (`:238-254`).
- [ ] Quirks: `LOCATION_LABEL = "Ward"` unused (`:49`); month rows use a keyless fragment `<>` inside `map` (`:300`); backend caps groups at 500 in `entity_id` order and only compares `health_services` (AUDIT.md §3.2 `GET /etl/duplicates` issues).

### Timers / polling
- [ ] No `setInterval`/`setTimeout`/polling in the page or card. Refresh behaviour comes from React Query defaults (`refetchOnWindowFocus/Mount/Reconnect: true`, `legacy:src/App.tsx:128-130`) and the per-query `staleTime`s above. The services list is ETL/warehouse data (`meta: { etl: true }` in the port).

### Storage keys
- [ ] localStorage `ecap_cache_nationwide_vca` — read only (`legacy:src/pages/VcaServicesDashboard.tsx:292`), never written (dead).
- [ ] localStorage `ecap_plus_pmp.fy_filter_state_v2` — read via `useFyFilter` (`legacy:src/context/FyFilterContext.tsx:12,36`).
- [ ] IndexedDB `ecap_plus_cache_db` / store `api_cache` (`legacy:src/lib/indexedDbCache.ts:6-7`): keys `children_by_district:ALL`, `children_by_district:ALL:{from}_{to}` (`legacy:src/lib/api.ts:372-376`), `vca_services_by_district:ALL` (`legacy:src/lib/api.ts:500-504`).
- [ ] IndexedDB (idb-keyval) `ecap-plus-pmp-react-query` — React Query persister for all queries incl. this page's (`legacy:src/App.tsx:140-148`).

### Browser APIs
- [ ] `URL.createObjectURL` + synthetic `<a download>` for the duplicate CSV (`DuplicateDetectionCard.tsx:209-213`).

## Open questions for the developer
1. **Route and nav:** legacy never exposed this page. What URL should it get (e.g. `/services/vca/overview` or a tab on `/services/vca`), and does it get a sidebar/mobile/search entry? Which permission gates it?
2. **Reporting window:** keep the separate June–May "reporting year" picker, or use the platform FY scope (Oct–Sep from config)? If June–May is a real program rule, it must move to `program.config.ts`.
3. **KPI card semantics:** should the cards show "VCAs covered" (current number) or "VCAs missing" (what the link opens)? Should the risk register apply the same window so numbers reconcile?
4. **Population for KPIs/table/insights:** should services of VCAs not in the active (FY-cohort) register be counted? Should insights respect district/province scope (assumed yes)?
5. **HIV/VL/MMD fields:** are `is_hiv_positive`, `date_last_vl`, `vl_last_result`, `level_mmd` present on `vca_services` rows, or must they come from the VCA record? (Check `test/fixtures/dqa-vcas.json` / backend.)
6. **Table row click:** link to the service record detail (`/services/vca/:recordId`) or the VCA profile (`/vcas/:vcaId`)?
7. **Export:** should the services table get a CSV/XLSX export via `platform/export` (legacy has none)?
8. **DuplicateDetectionCard:** pass the selected district (backend sentinel for all is `"All Districts"`)? What should "Flag caseworker" do — create a flag via the flags module, or be removed? Should `reviewed_by` be recorded (backend change)?
9. **Duplicate review persistence:** the three `/etl/duplicates/review*` endpoints have no permission check and no district scope (AUDIT.md §3.2). Acceptable for the port, or a Backend ask first?
