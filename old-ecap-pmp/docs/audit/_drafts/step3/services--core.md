# services — legacy audit
> New module `services` · Legacy routes → new routes: `/vca-services`, `/household-services`, `/caregiver-services` → `/services/:type` (`type` = `vca` | `household` | `caregiver`); `/profile/{vca,household,caregiver}-service-details` → `/services/:type/:recordId`; `/services/household-services` (orphan, KEEP per decision 3) · Plan: MIGRATION_PLAN.md §5 row "services"

**This file is the "core" part** of the services audit: the three routed list pages and the shared, config-driven
`ServicesPage` with everything it renders (header, KPI strips, cohort strip, charts, quality review panel, records
table, detail sheet, export). The profile/detail pages (`/profile/*-service-details`), the orphan
`/services/household-services` (`HouseholdServicesPage`) and the unrouted `VcaServicesDashboard` are audited in the
other services parts; they appear here only as link targets.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/VcaServices.tsx` | 11 | Route component for `/vca-services`: `<ServicesPage type="vca" title="VCA Services" subtitle=…>` (`:4-8`) |
| `legacy:src/pages/HouseholdServices.tsx` | 11 | Route component for `/household-services`: `<ServicesPage type="household" title="Household Services" …>` (`:4-8`) |
| `legacy:src/pages/CaregiverServices.tsx` | 11 | Route component for `/caregiver-services`: `<ServicesPage type="caregiver" title="Caregiver Services" …>` (`:4-8`) |
| `legacy:src/components/dashboard/services/ServicesPage.tsx` | 1254 | The whole page: filters, stat cards, KPI/cohort strips, charts, quality review, server-paginated records table, detail sheet, CSV export, navigation to the detail routes |
| `legacy:src/components/dashboard/services/service-records.ts` | 374 | Per-type metadata (`SERVICE_TYPE_META` `:31-50`), issue metadata (`ISSUE_META` `:52-58`), `parseDateValue` (`:278-287`). **Everything else is dead code**: a client-side normaliser (`normalizeServiceRecord` `:312-374`, `pickValue` `:201-229`, key lists `:60-166`, `fetchRawServices` `:168-172`, `fetchHouseholdRegister` `:174`, `requiresHouseholdRegister` `:176`, `buildHouseholdRegisterMap` `:233-240`, `parseServiceList` `:242-276`) left over from before the records moved server-side. Only `ISSUE_META`, `SERVICE_TYPE_META`, `parseDateValue` and the types are imported (`ServicesPage.tsx:76-82`, `QualityReviewPanel.tsx:28`, `ServicesPageHeader.tsx:11`) |
| `legacy:src/components/dashboard/services/QualityReviewPanel.tsx` | 350 | "Quality Review" card: action queue, duplicates (with CSV export), data-gap tiles |
| `legacy:src/components/dashboard/services/ServicesDistributionChart.tsx` | 99 | Donut chart "Service mix by domain (last 90 days)" |
| `legacy:src/components/dashboard/services/ServicesTimeSeriesChart.tsx` | 82 | Area chart "Services delivered per month (last 12 months)" |
| `legacy:src/components/dashboard/services/ServicesPageHeader.tsx` | 160 | Hero header: eyebrow, date, "Live" badge, title + per-type chip, subtitle, source/generated-at badges |
| `legacy:src/components/dashboard/services/CohortStrip.tsx` | 82 | "Population breakdown" chips (sub-population counts) per type |
| `legacy:src/components/dashboard/CanonicalKpiStrip.tsx` | 161 | "Headline numbers" card (enrolled / active + month-on-month trend). Lives outside `services/` but its only consumer is `ServicesPage` (`ServicesPage.tsx:759`); read in full |
| `legacy:src/lib/api.ts` | 1486 (partial) | Wrappers used here: `getHouseholdsByDistrict` (`:301-312`), `getServiceSummary` (`:921-947`), `getServiceTimeseries` (`:961-987`), `getServiceDistribution` (`:1003-1031`), `getActionQueue` (`:1049-1068`), `getDuplicates` (`:1270-1281`), `getServiceRecords` (`:1346-1387`), `getServiceRecordDetail` (`:1389-1406`), `triggerServiceExport` (`:1416-1486`); helpers `dqaGet` (`:185-210`), `getListFromApiWithCache` (`:212-238`), `dqaGetSkipCache` (`:701-712`). The dead normaliser's fetchers `getVcaServicesByDistrict` (`:499-506`), `getCaregiverServicesByDistrict` (`:410-417`), `getHouseholdServicesByDistrict` (`:419-426`) are not called by the core pages |
| `legacy:src/lib/csv.ts` | 29 | `downloadCsv` (used by the duplicates export; imported but unused in `ServicesPage.tsx:73`) |
| `legacy:src/App.tsx` | 602 (partial) | Lazy imports (`:30-32`, `:36`, `:37-39`), routes (`:317-324`, `:333-340`, `:349-356`), QueryClient defaults (`:112-134`), React Query IndexedDB persister (`:140-148`) |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard (auth + forced password change only) |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | "Services" sidebar section (`:76-96`), filter logic (`:147-181`) |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | "Services" tab → `/vca-services` (`:9`) |
| `legacy:src/components/dashboard/DashboardLayout.tsx` | 110 (partial) | Mobile sheet menu entries (`:38-39`) |
| `legacy:src/components/dashboard/DashboardHeader.tsx` | 539 (partial) | `HIDDEN_ROUTES` (`:35-43`) does not include the services paths, so GlobalSearch and the FY chip show on these pages (`:85`) |
| `legacy:src/components/dashboard/GlobalSearch.tsx` | 212 | Navigation entries for VCA / Caregiver Services (`:38-39`); none for Household Services |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by the services pages (they derive scope themselves); read for comparison |
| `legacy:src/context/FyFilterContext.tsx` | 122 (partial) | FY window (`useFyFilter`), URL params `fy`/`from`/`to` and localStorage key (`:12`, `:50-80`) |
| `legacy:src/components/EtlInvalidator.tsx` | 90 (partial) | Polls `/etl/last-success` every 30 s (`:28`, `:54-57`) and invalidates every non-`etl` query, including all of this page's (`:77-80`) |
| `legacy:src/pages/Dashboard.tsx`, `VcaRiskRegister.tsx`, `HouseholdRiskRegister.tsx`, `CaregiverRiskRegister.tsx`, `VcaServiceProfile.tsx`, `HouseholdServiceProfile.tsx`, `CaregiverServiceProfile.tsx`, `components/dashboard/RecentActivity.tsx` | (grep only) | Inbound links (see "Links in") |

---

## Service-type config (the pattern to generalise)

Legacy has one page component and three thin wrappers. The per-type values are **scattered over seven files**.
The rebuild should gather them in one typed config object per type (in the `services` module, with the
program-specific labels coming from `@/config`). Every row below is a value that differs by type, so every row
must become a config field.

| Config field | `vca` | `caregiver` | `household` | Source |
| --- | --- | --- | --- | --- |
| Legacy route | `/vca-services` | `/caregiver-services` | `/household-services` | `service-records.ts:35,41,47`; `App.tsx:318,334,350` |
| Page title | `"VCA Services"` | `"Caregiver Services"` | `"Household Services"` | `VcaServices.tsx:6`, `CaregiverServices.tsx:6`, `HouseholdServices.tsx:6` |
| Page subtitle | `"Service activity for VCAs — sourced directly from the data warehouse."` | `"Service activity for caregivers — sourced directly from the data warehouse."` | `"Service activity for households — sourced directly from the data warehouse."` | same files `:7` |
| `label` (meta) | `"VCA Services"` | `"Caregiver Services"` | `"Household Services"` | `service-records.ts:33,39,45` (not rendered anywhere in the core page) |
| `shortLabel` (tab text, stat-card nouns, duplicates CSV "Service Type") | `"VCA"` | `"Caregiver"` | `"Household"` | `service-records.ts:34,40,46` |
| `entityLabel` (detail-sheet title prefix) | `"VCA"` | `"Household"` | `"Household"` | `service-records.ts:36,42,48`; the page actually renders the server's `entityLabel` (`ServicesPage.tsx:1070`), which has the same values (AUDIT.md §3.2 `/etl/services/:type/records`) |
| Header chip icon / label | `ClipboardList` / `"Children & adolescents"` | `HeartPulse` / `"Caregivers"` | `Home` / `"Household level"` | `ServicesPageHeader.tsx:50-62` |
| Sidebar icon | `ClipboardList` | `HeartPulse` | `Home` | `AppSidebar.tsx:79-85` |
| Tab order | tabs render in `Object.keys(SERVICE_TYPE_META)` order: **VCA, Caregiver, Household** (`ServicesPage.tsx:548`); the sidebar order is Household, VCA, Caregiver (`AppSidebar.tsx:79-85`) | | | |
| Headline KPI stats (`CanonicalKpiStrip`) | `enrolled` "VCAs ever enrolled", `active` "Active VCAs" | `enrolled` "Caregivers ever enrolled", `active` "Active caregivers" | `enrolled` "Households ever enrolled", `active` "Active households" | `CanonicalKpiStrip.tsx:22-65` (tooltips quoted under Charts) |
| Cohort chips (`CohortStrip`) | `clhiv` "CLHIV", `cwlhiv` "CWLHIV", `hei` "HEI", `active_this_month` "Received a service this month", `stale_90d` "No service in 90+ days" | `cwlhiv` "Living with HIV", `pregnant` "Pregnant" | `screened` "Screened for vulnerabilities", `unscreened` "Not yet screened" | `CohortStrip.tsx:15-31` |
| Pillars the backend knows (records `domain` filter, `pillars` output, distribution slices) | HIV, Health, Education, Safety, Stability | HIV, Health, Education, Safety, Stability | Health, **Household**, Education, Safety, Stability | AUDIT.md §3.2 `/etl/services/:type/records` (backend per-type config) |
| Domain filter options offered by legacy | all six for every type (`ServicesPage.tsx:103-111`) — see BUG below | same | same | |
| Action-queue items (server-defined) | `stale_90d`, `clhiv_no_art`, `vl_overdue_6m`, `calhiv_no_art_started`, `missing_hiv_status` | `pregnant_no_anc`, `cwlhiv_not_suppressed`, `stale_90d` | `stale_hh_90d`, `unscreened`, `missing_partner` | AUDIT.md §3.2 `/etl/action-queue` |
| Server CSV "Type" column | `VCA` | `Caregiver` | `Household` | AUDIT.md §3.2 `/etl/services/:type/export` |
| Detail route (Open Record) | `/profile/vca-service-details` | `/profile/caregiver-service-details` | `/profile/household-service-details` | `ServicesPage.tsx:490-498` |
| Back-link from detail page | "Back to VCA Services" → `/vca-services` | "Back to Caregiver Services" → `/caregiver-services` | "Back to Household Services" → `/household-services` | `VcaServiceProfile.tsx:74`, `CaregiverServiceProfile.tsx:88`, `HouseholdServiceProfile.tsx:73` |
| Location-state id keys written on Open Record | `vca_id`, `vcaid` = entityId | `household_id` = entityId | `household_id` = entityId | `ServicesPage.tsx:486-488` |

Shared (type-independent) config the page also hard-codes: page size `12` (`ServicesPage.tsx:101`); date windows
(`:113-118`); issue keys/labels (`service-records.ts:52-58`); pillar colours (`ServicesPage.tsx:120-127`,
`ServicesDistributionChart.tsx:16-23`); search debounce 350 ms (`ServicesPage.tsx:222`).

- [ ] Build one `ServiceTypeConfig` per type holding every row above (labels/sub-population terms from `@/config`), and drive the page, tabs, nav, KPI strip, cohort strip, domain options and detail links from it. `:type` route param must be validated against the config keys (unknown → not-found).
- [ ] Domain filter options per type come from the config's pillar list (not one global list of six).

---

## Route `/vca-services` · `/household-services` · `/caregiver-services` → `/services/:type`

The three routes render the same component with a different `type` prop; everything below applies to all three
unless a type is named.

### Purpose
Operational view of individual **service records** (one row per service visit, joined to its VCA or household)
for one service type, read from the warehouse through the `/etl/services/:type/*` endpoints. It shows headline
KPIs, sub-population counts, a 12-month volume chart and a 90-day domain mix, a data-quality review (action queue,
duplicates, data gaps), and a server-side paginated, filterable table of records with a detail sheet and a full CSV
export of the filtered set.

Page layout, top to bottom (`ServicesPage.tsx:529-1230`):
1. `ServicesPageHeader` (`:531-537`)
2. Type tabs + "Dashboard" and "Export" buttons (`:540-592`)
3. Filter bar: search, district, domain, date range (`:595-651`)
4. Three operational stat cards (`:654-755`)
5. `CanonicalKpiStrip` (`:758-760`)
6. `CohortStrip` (`:762`)
7. Time-series and distribution charts side by side on `lg` (`:764-767`)
8. `QualityReviewPanel` (`:769-781`)
9. "Service Records" table card, anchor id `services-records-table` (`:784-1053`)
10. Detail `Sheet` (`:1056-1229`)

### Access
- [ ] **Route guard**: `ProtectedRoute` only, no role check (`App.tsx:317-324` `/vca-services`, `:333-340` `/household-services`, `:349-356` `/caregiver-services`). `ProtectedRoute` returns `null` while auth loads, redirects to `/` when there is no user, and to `/change-password` when `user.password_change_required` (`ProtectedRoute.tsx:8-18`).
- [ ] **Sidebar**: section "Services" lists "Household Services" `/household-services`, "VCA Services" `/vca-services`, "Caregiver Services" `/caregiver-services` (`AppSidebar.tsx:76-85`). None of the filter conditions in `AppSidebar.tsx:164-175` matches these items (`item.url === "/districts" && isDistrictUser`; `section.label === "Admin" && !isAdmin`; `section.label === "Data Pipeline" && !isAdmin && !isSupport`), so they are **visible to every signed-in user**. Active state is exact-path match (`:183`).
- [ ] **Mobile bottom nav**: "Services" → `/vca-services`, no visibility rule (`MobileBottomNav.tsx:9`); active only on the exact path (`:20`, `end` at `:29`), so it is not highlighted on the household/caregiver tabs.
- [ ] **Mobile sheet menu**: "VCA Services" `/vca-services` and "Household Services" `/household-services`, no rule (`DashboardLayout.tsx:38-39`). **No Caregiver Services entry.**
- [ ] **Global search**: navigation items "VCA Services" `/vca-services` and "Caregiver Services" `/caregiver-services` (`GlobalSearch.tsx:38-39`). **No Household Services entry.** No record results link to the services pages.
- [ ] **Header**: these paths are not in `HIDDEN_ROUTES` (`DashboardHeader.tsx:35-43`), so the GlobalSearch box and FY chip are shown (`:85`).
- [ ] **In-page role checks** (all by exact `description` string; the rebuild must use `can()` / scope hooks instead):
  - `const isDistrictUser = user?.description === "District User";` (`ServicesPage.tsx:193`)
  - `const isProvincialUser = user?.description === "Provincial User";` (`:194`)
  - `const userProvince = user?.title;` (`:195`)
  - Initial district: `params.get("district") ?? (isDistrictUser && user?.location ? user.location : "All")` (`:197-199`)
  - Lock effect: `if (isDistrictUser && user?.location && selectedDistrict !== user.location) setSelectedDistrict(user.location)` (`:227-235`)
  - District select `disabled={isDistrictUser}` (`:609`)
  - District options for provincial users: `if (isProvincialUser && userProvince && h.province !== userProvince) return;` (`:279-280`)
  - Duplicate focus: `if (!isDistrictUser && selectedDistrict !== "All") setSelectedDistrict("All")` (`:508-510`)
  - No button is hidden by role; export, quality review and detail sheet are available to everyone.
- [ ] **Data scope**: `useEffectiveDistrict` is **not** used. The district sent to every endpoint is `districtParam = selectedDistrict !== "All" ? selectedDistrict : undefined` (`:287-288`), i.e. "All" → no `district` param → national data. Facility and ward are never sent (the child components accept `facility` but `ServicesPage` never passes it, `:759-767`).
- [ ] **BUG** Provincial users can pick "All" (it is always the first option, `:284`), which sends no district and returns **national** data; the dropdown only hides other provinces' districts (`:279-280`). None of these endpoints accepts `province` (AUDIT.md §3.2). Intended: provincial scope = their province's districts. → Backend ask.
- [ ] **BUG** A District User opening `/vca-services?district=<other>` gets one render (and one fetch of every query) for `<other>` before the lock effect resets it (`:197-199` runs before the `useEffect` at `:227-235`). Intended: scope is fixed before the first query.
- [ ] **Backend gap** (record in PROGRESS "Backend asks"): every endpoint used here trusts the caller-supplied district and never reads `req.user`; `/records` and `/export` with `entityId` ignore `district` entirely; `/record-detail` returns any entity's full joined row (AUDIT.md §3.2).

### Endpoints
All DQA calls go through `dqaGetSkipCache` (Bearer token from `getStoredToken`, throws `data.message` or `Request failed: <status>` on non-2xx; `api.ts:701-712`) unless noted. Global React Query defaults apply unless overridden: `staleTime` 60 s, `gcTime` 24 h, refetch on mount/focus/reconnect, `retry: 1` (`App.tsx:112-134`); all queries are persisted to IndexedDB for 24 h (`App.tsx:140-148`, `:213-224`) and invalidated on every new ETL success (`EtlInvalidator.tsx:77-80`).

- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) — **district discovery for the dropdown only.** Wrapper `getHouseholdsByDistrict("")` (`api.ts:301-312`), so the path is `/household/all-households/` (empty district = whole national register). Goes through `getListFromApiWithCache` with IndexedDB key `households_by_district:ALL` and a 60 s TTL (`api.ts:14`, `:212-238`, `:305-310`); on fetch error it falls back to a stale cached copy. React Query key `["districts-discovery-services", "All"]`, `staleTime` 30 min (`ServicesPage.tsx:267-271`). Fires on mount, always (also for district users, whose select is disabled). Post-processing: distinct non-empty `district` values, filtered by `province === user.title` for provincial users, sorted, with `"All"` prepended (`:273-285`). **Rebuild: take districts from `platform/scope` / config geography, not from the national household register.**
- [ ] `GET /etl/services/:type/summary` (AUDIT.md §3.2) — three callers on this page:
  - `ServicesPage` header data: `getServiceSummary({ type, district: districtParam })` — **no FY sent**; key `["service-summary", type, districtParam, undefined, undefined, fyKey]`; `staleTime` 5 min (`ServicesPage.tsx:295-306`). Only `source` and `generated_at` are used (`:535-536`).
  - `CanonicalKpiStrip`: `getServiceSummary({ type, district, facility, fy: fyArg })`; key `["service-summary", type, district, facility, fyKey]`; `staleTime` 5 min (`CanonicalKpiStrip.tsx:85-92`).
  - `CohortStrip`: identical call and key to `CanonicalKpiStrip` (`CohortStrip.tsx:34-41`), so the two share one cache entry.
  - Wrapper (`api.ts:921-947`): sets `district` unless empty/`all`/`All`; `facility`/`ward` unless `all`; `from`+`to` only when both present. Returns `{ type, source: res.source ?? "", generated_at: res.generated_at ?? "", data: res.data ?? {} }`.
  - `fyArg = fy.fromDate && fy.toDate ? { from, to } : undefined`; `fyKey = fy.mode === "all" ? "all" : \`${fromDate}_${toDate}\`` (`CanonicalKpiStrip.tsx:86-87`, same in `CohortStrip.tsx:35-36`, `ServicesPage.tsx:290-292`).
  - **BUG** `ServicesPage`'s own summary query has a 6-element key that differs from the strips' 5-element key and sends no FY (`ServicesPage.tsx:296-304`), so the page makes a second, redundant request and the header's "generated at" comes from a non-FY call. Intended: one shared `queryOptions` for the summary.
- [ ] `GET /etl/services/:type/records` (AUDIT.md §3.2) — **primary data, server-side paginated.** Wrapper `getServiceRecords` (`api.ts:1346-1387`). Params as sent:
  - `district` = `districtParam` (omitted for "All"; wrapper also drops a literal `"All"`, `api.ts:1358-1359`)
  - `search` = debounced search text, omitted when empty (`ServicesPage.tsx:326`, `api.ts:1360`)
  - `domain` = pillar label (`HIV` … `Household`), omitted for `"all"` (`:327`, `api.ts:1361`)
  - `issue` = one issue key, omitted when none (`:328`, `api.ts:1362`)
  - `dateWindow` = `"30"` / `"90"` / `"365"`, omitted for `"all"` (`:329`, `api.ts:1363-1364`)
  - `entityId` = focused entity id, omitted when none (`:330`, `api.ts:1365`) — server then **ignores every other filter**
  - `page` = current page (1-based), `pageSize` = `12` (`:331-332`, `api.ts:1366-1367`)
  - **No FY** (`from`/`to`) is sent and the backend would ignore it.
  - Key `["service-records-paged", type, districtParam ?? "all", debouncedSearch, domainFilter, issueFilter ?? "", dateWindow, focusedEntityId ?? "", currentPage]` (`:311-321`) — FY is not in the key.
  - Overrides: `staleTime` 60 s, `gcTime` 5 min, `refetchOnWindowFocus: false`, `placeholderData: (prev) => prev` (previous page stays visible while the next loads) (`:334-337`).
  - Wrapper defaults when fields are missing: `page 1`, `pageSize 12`, `totalRecords 0`, `totalPages 1`, `stats {loaded:0, monthly:0, recordsWithIssues:0, issueCounts:{}}`, `data []` (`api.ts:1373-1386`).
  - Page reads `data`, `totalRecords`, `totalPages`, `stats`, `stats.issueCounts` (`ServicesPage.tsx:340-345`).
- [ ] `GET /etl/services/:type/record-detail` (AUDIT.md §3.2) — fired imperatively (no React Query) when a row's "Open" button is clicked (`ServicesPage.tsx:419-435`). Wrapper `getServiceRecordDetail({ type, entityId: record.entityId, district: record.district !== "N/A" ? record.district : undefined })` (`api.ts:1389-1406`); sends `entityId` and `district` (unless `All`); returns `res.data ?? null` and **swallows every error as `null`**. Result fills the sheet's "Source Payload".
  - **BUG** The endpoint returns the entity's **latest** service, not the clicked row (AUDIT.md §3.2), so the payload can belong to a different visit than the row. Intended: detail by service-record id. → Backend ask.
  - **BUG** No request cancellation/ordering: opening row A then row B quickly lets A's late response overwrite B's payload (`:420-429`). Rebuild: use a keyed query.
- [ ] `GET /etl/services/:type/export` (AUDIT.md §3.2) — see Exports.
- [ ] `GET /etl/services/:type/timeseries` (AUDIT.md §3.2) — `ServicesTimeSeriesChart`: `getServiceTimeseries({ type, district, facility, fy: fyArg })` (`ServicesTimeSeriesChart.tsx:17-24`, wrapper `api.ts:961-987`); key `["service-timeseries", type, district, facility, fyKey]`; `staleTime` 5 min. `from`/`to` sent but ignored by the backend (fixed last 12 months).
- [ ] `GET /etl/services/:type/distribution` (AUDIT.md §3.2) — `ServicesDistributionChart`: `getServiceDistribution({ type, district, facility, fy: fyArg })` (`ServicesDistributionChart.tsx:26-33`, wrapper `api.ts:1003-1031`); key `["service-distribution", type, district, facility, fyKey]`; `staleTime` 5 min. `from`/`to` ignored by the backend (fixed last 90 days). Client drops slices with `count <= 0` (`:35`).
- [ ] `GET /etl/action-queue` (AUDIT.md §3.2) — `QualityReviewPanel`: `getActionQueue({ type, district })` (`QualityReviewPanel.tsx:85-89`, wrapper `api.ts:1049-1068`: always sends `type`; `district` unless `"all"`); key `["quality-review", "action-queue", type, district]`; `staleTime` 5 min; no FY.
- [ ] `GET /etl/duplicates` (AUDIT.md §3.2) — `QualityReviewPanel`: `getDuplicates({ type, district })` (`QualityReviewPanel.tsx:91-95`, wrapper `api.ts:1270-1281`: sends `type`, and `district` when truthy; returns `data.data`, i.e. `{ type, entity_label, groups, summary }`); key `["quality-review", "duplicates", type, district]`; `staleTime` 5 min; no FY. The backend "all" sentinel is `"All Districts"`, but the page sends `undefined` for All, so it works.
- [ ] Rebuild: all service queries set `meta: { etl: true }`; scope + FY are part of every key (even where the backend ignores FY — **QUESTION** below); records and record-detail contain names → consider `meta: { persist: false }`.

### Fields used

Records rows are already normalised by the server (`ServiceRecordRow`, `api.ts:1309-1327`); the core page does **no** client-side key guessing. (The `pickValue` candidate lists in `service-records.ts:60-166` are dead code.)

| Field (normalised name the page uses) | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| `id` | server `id` (synthetic `${type}-${entityId}-${serviceDate}-${offset+idx}`) | React row key (`ServicesPage.tsx:925`) | — |
| `entityId` | server `entityId` | Entity column line 1 (`:929-931`); sheet title (`:1070`); record-detail param (`:426`); location-state id (`:486-488`) | monospace, bold |
| `name` | server `name` | Entity column line 2 (`:932-934`); sheet "Name" (`:1089-1093`) | truncated at 190px |
| `district` | server `district` (`"N/A"` when blank) | District column with pin icon (`:936-941`); sheet description (`:1082`); record-detail param unless `"N/A"` (`:427`) | — |
| `facility` | server `facility` | Facility column (`:942-949`); sheet "Facility" (`:1094-1098`) | truncated 180px |
| `caseworker` | server `caseworker` | Caseworker column (`:950-957`); sheet "Caseworker" (`:1099-1103`) | truncated 180px |
| `serviceDate` | server `serviceDate` (raw text: `YYYY-MM-DD`, caregiver may be `DD-MM-YYYY`, or `"N/A"`) | Service Date column (`:961`); sheet description (`:1083`) | `formatDate` → `parseDateValue` (ISO or `DD-MM-YYYY`/`DD/MM/YYYY`, else `new Date()`; `service-records.ts:278-287`) then `toLocaleDateString("en-US", {month:"short", day:"2-digit", year:"numeric"})`, `"N/A"` when unparseable (`ServicesPage.tsx:154-162`) |
| `status` | server `status` (raw `case_status`, `"Synced"` if blank, `"Missing date"` if blank and no date) | Badge under the date (`:963-971`); badge in sheet title (`:1071-1079`) | colour by `statusClass` (`:137-152`): contains `missing`/`error`/`fail` → rose; `pending`/`draft`/`process` → amber; else emerald |
| `pillars` | server `pillars` | Domains column badges (`:975-988`); `"No domain captured"` when empty (`:989-993`) | colour by `PILLAR_CLASS[pillar]`, fallback slate (`:120-127`, `:982-983`) |
| `serviceNames` | server `serviceNames` | Under the domain badges: first 3 joined `", "` (`:995-999`) | truncated 240px |
| `servicesByPillar` | server `servicesByPillar` | Sheet "Service Domains": one card per pillar with its services as badges (`:1115-1160`); `"No service domains captured."` when empty | |
| `issueKeys` | server `issueKeys` | Issues column: first 2 as badges + `+N` badge if more; `"Clear"` badge when none (`:1001-1033`); sheet "Issues" shows all (`:1162-1186`) | label from `ISSUE_META[key].label` (fallback the key); colour from `ISSUE_CLASS` (`:129-135`) |
| `issues` | server `issues` | not used (labels come from `issueKeys` + `ISSUE_META`) | |
| `ageDays` | server `ageDays` | sheet "Record age": `"${ageDays} days"` or `"N/A"` (`:1104-1112`) | |
| `entityLabel` | server `entityLabel` | sheet title prefix (`:1070`) | |
| `type` | server `type` | chooses detail route (`:490-498`) | |
| `raw` | server `raw` = `{ entity_id, district, facility, caseworker_name, service_date }` | fallback for "Source Payload" when detail fetch fails (`:522`); spread into location state (`:477-479`) | |
| record-detail `data` | dynamic `s.*, c.*` columns | "Source Payload" key/value table: keys not starting with `_`, first 80 entries (`:521-526`, `:1197-1212`) | objects `JSON.stringify`, null → `""` (`:164-174`) |
| records `stats.loaded` | server | stat card 1 (`:393`) | `toLocaleString()` |
| records `stats.monthly` | server | stat card 2 (`:401`) | |
| records `stats.recordsWithIssues` | server | stat card 3 (`:409`) | |
| records `stats.issueCounts.<key>` | server | issue breakdown popover (`:376-386`); passed to `QualityReviewPanel` (`:773`) | |
| records `totalRecords`, `totalPages` | server | "N shown" badge (`:792`); "Page X of Y" (`:842`) | |
| summary `source`, `generated_at` | server | header badges (`ServicesPageHeader.tsx:135-153`) | see Charts |
| summary `data.enrolled`, `data.active`, `data.mom_trend_pct` | server | `CanonicalKpiStrip` | `Number(d[key] ?? 0).toLocaleString()` |
| summary `data.clhiv`, `cwlhiv`, `hei`, `active_this_month`, `stale_90d`, `pregnant`, `screened`, `unscreened` | server | `CohortStrip` chips | `Number(d[key] ?? 0).toLocaleString()` |
| timeseries `data[].label`, `data[].count` | server | area chart X / Y | |
| distribution `data[].pillar`, `count`, `pct`, `total` | server | donut slices, tooltip, badge | |
| action-queue `data[].key`, `label`, `description`, `count`, `severity`, `filter.type` | server | action-queue table | |
| duplicates `groups[].entity_id`, `service_date`, `services`, `duplicate_count`, `caseworker_name`, `facility`, `district`, `province`; `summary.total_redundant_records` | server | duplicates table/export, summary total | `duplicate_count` arrives as a **string** and is wrapped in `Number()` (`QualityReviewPanel.tsx:72`, `:132`, `:269`) |

### Filters / sort / pagination / search
None of these filters except district is persisted; all are component state lost on reload or tab switch.

- [ ] **Search**: `Input` with placeholder `"Search ID, name, facility, caseworker, service"` (`ServicesPage.tsx:596-604`). Debounced 350 ms by a local `useDebounce` (`:178-185`, `:222`). Server-side: the backend lower-cases and `LIKE`-matches entity id, name, district, facility, caseworker and the raw text of all service columns (AUDIT.md §3.2). Applied to table, stats, export. Not in URL.
- [ ] **District**: `Select`, placeholder `"District"`, options `["All", ...sorted districts]` (`:606-621`, `:273-285`). Default: `?district=` URL param, else the user's `location` for District Users, else `"All"` (`:197-199`). Locked/disabled for District Users (`:227-235`, `:609`). Persisted in URL param **`district`** (omitted for All) via `setParams(next, { replace: true })` (`:238-243`). Applied to table, stats, export, KPI strip, cohort strip, charts, quality review.
  - **BUG** The URL sync builds a **fresh** `URLSearchParams` containing only `district` (`:239-242`), wiping the FY params `fy`/`from`/`to` that `FyFilterContext` writes for shareable links (`FyFilterContext.tsx:69-79`). The FY state survives in context/localStorage, but the URL no longer carries it. Intended: merge params.
  - **BUG** Switching type tabs calls `navigate(SERVICE_TYPE_META[next].route)` with no query (`:543-545`) and the routes are different elements, so the page remounts and the selected district resets to the default. Intended (rebuild): `/services/:type` keeps scope and filters across tabs.
- [ ] **Domain**: `Select`, placeholder `"Domain"`, options (`:103-111`): `all` "All domains", `HIV` "HIV", `Health` "Health", `Education` "Education", `Safety` "Safety", `Stability` "Stability", `Household` "Household". Default `"all"`. Sent as `domain` (`:327`). Applied to table, stats, export; not to KPIs/charts/quality review. Not persisted.
  - **BUG** All six are offered for every type, but the backend silently ignores pillars the type does not have (`HIV` on household, `Household` on vca/caregiver), so the table shows **unfiltered** results while the filter reads "HIV" (AUDIT.md §3.2). Intended: per-type options from config.
- [ ] **Date range**: `Select`, placeholder `"Date range"`, options (`:113-118`): `all` "All dates", `30` "Last 30 days", `90` "Last 90 days", `365` "Last 12 months". Default `"all"`. Sent as `dateWindow` (rolling days before server `CURRENT_DATE`, rows with no parseable date excluded). Applied to table, stats, export. Independent of the global FY chip. Not persisted. (The `days` field of each option is unused.)
- [ ] **Issue filter** (no control of its own; set from the issues stat-card popover `:705-714`, the quality review panel's Data Gaps tiles / action-queue "Filter" buttons `:775-778`). Values: `missing_date`, `no_service_details`, `missing_caseworker`, `missing_district`, `stale_90d` (`service-records.ts:52-58`). Shown as an amber badge `"Issue: <label>"` with a `×` clear button (`:821-839`). Sent as `issue`. Applied to table, stats (so the issue counts themselves change when an issue is active), export. Not persisted.
- [ ] **Focused entity** (set only by duplicates "Focus", `handleDuplicateFocus` `:502-518`): clears search, issue, domain, date window; sets `focusedEntityId`; for non-district users resets district to "All"; resets page; after 100 ms smooth-scrolls to `#services-records-table`; toasts `info` `"Searching for <id>…"`. Shown as an emerald badge `"Focused on <id>"` with `×` (`:802-820`, aria-label `"Clear focused entity filter"`). Sent as `entityId` (server ignores all other filters). If the settled result has `totalRecords === 0`, toasts error `"No service records for <id> in the current scope. The record may belong to a different service type or district."` and clears the focus (`:352-367`). Not persisted.
- [ ] **Reset rules**: page → 1 whenever type, district, domain, date window, debounced search, issue or focus changes (`:246-256`); focus, issue, selected record and payload cleared when `type` changes (`:259-264`); if `currentPage > totalPages` it is clamped (`:370-372`).
- [ ] **Sort**: fixed server order `service_date DESC NULLS LAST, entity_id` (AUDIT.md §3.2); no sortable columns.
- [ ] **Pagination**: server-side, fixed page size 12 (`:101`), no page-size selector. Header shows `"Page {currentPage} of {totalPages}"` with previous/next icon buttons, disabled at the bounds **and while any fetch is running** (`:841-863`). Page not in URL.
- [ ] Rebuild: every filter (search, district, domain, date window, issue, focused entity, page) becomes a declarative `platform/filters` definition synced to the URL.

### Exports
- [ ] **Records CSV (server-side, all filtered rows)** — "Export" button (`:570-590`), handler `handleExportCsv` (`:438-473`), wrapper `triggerServiceExport` (`api.ts:1416-1486`).
  - Params: same filter mapping as the records query (`district`, `search`, `domain`, `issue`, `dateWindow`, `entityId`), **no** `page`/`pageSize`, **no FY**; plus **`token=<JWT>` in the query string** (`api.ts:1438-1439`).
  - Rows: **all** records matching the current filters (not the current page); server-generated.
  - Columns (server, in order): `Type, Entity ID, Name, District, Facility, Caseworker, Service Date, Domains, Services, Status, Issues` (AUDIT.md §3.2 `/etl/services/:type/export`).
  - Filename (client, ignores `Content-Disposition`): `` `${params.type}-services-${new Date().toISOString().slice(0, 10)}.csv` `` (UTC date) (`api.ts:1474`).
  - Mechanism: raw `fetch(url)` with no `Authorization` header (`api.ts:1446`), reads the whole stream into memory, builds a `Blob` (`text/csv;charset=utf-8;`), clicks a temporary `<a download>` and revokes the object URL (`api.ts:1461-1478`). No library.
  - Button states (`ExportState`, `ServicesPage.tsx:99`): label `"Export"` (idle), `"Preparing…"`, `"Downloading…"` (download icon pulses in these two, `:577-584`), `"Downloaded ✓"`, `"Failed — retry"`; disabled whenever state ≠ idle (`:575`); a second click while busy is ignored (`:439`).
  - Toasts: on `preparing` → info `"Preparing your export — this may take a moment for large datasets."`; on `done` → success `"Export downloaded successfully."` and back to idle after 3 s; on `error` → error `"Export failed. Please try again."` and back to idle after 3 s (`:452-467`); on thrown error → error toast again and immediate idle (`:469-472`).
  - **BUG** The token travels in the URL (proxy/access logs) although `fetch` could send the header. Intended: `Authorization` header through the core API client.
  - **BUG** On a failure the user gets up to three identical error toasts: `onProgress("error")` before the throw (`api.ts:1449`/`:1454`), again in the wrapper's catch (`api.ts:1482`), then the page's catch (`ServicesPage.tsx:470`). The page's catch also resets to idle immediately, so `"Failed — retry"` is never really visible (and the button is disabled while it is).
  - **BUG** The doc comment says the browser downloads natively with no memory allocation (`api.ts:1408-1412`), but the code buffers the entire CSV in memory (`:1461-1471`). Keep-alive lines `# preparing data...` written by the server every 5 s end up **inside** the CSV (AUDIT.md §3.2).
  - Rebuild: through `platform/export`; FY behaviour per open question.
- [ ] **Duplicate groups CSV (client-side)** — "Export duplicates" button in Quality Review (`QualityReviewPanel.tsx:153-156`), handler `:107-142`, library `downloadCsv` (`csv.ts:18-29`: quotes cells containing `"`, `,` or newline; `\n` line endings; trailing newline; Blob `text/csv;charset=utf-8;`).
  - If there are no groups: error toast `"No duplicate records available to export."` and nothing downloads (`:108-111`).
  - Rows: **all** groups returned by `/etl/duplicates` (backend caps at 500), not just the 8 shown.
  - Headers, in order, with source (`:113-137`): `Service Type` ← `SERVICE_TYPE_META[type].shortLabel`; `Entity ID` ← `entity_id`; `Service Date` ← `service_date` (raw); `Services` ← `services` (raw JSON-array text); `Duplicate Count` ← `duplicate_count`; `Redundant Records` ← `max(0, Number(duplicate_count) - 1)`; `Caseworker` ← `caseworker_name`; `Facility` ← `facility`; `District` ← `district`; `Province` ← `province`.
  - Filename: `` `${type}-duplicate-groups-${scope}-${new Date().toISOString().slice(0, 10)}.csv` `` where `scope` = district lower-cased with whitespace → `-`, or `"all-districts"` (`:139-140`).
  - Success toast `"Duplicate records exported."` (`:141`).
  - No PDF exports and no branding strings in either export.

### Charts
- [ ] **Operational stat cards** (3, `ServicesPage.tsx:375-416`, rendered `:654-755`), values `toLocaleString()`, monospace:
  1. key `loaded`, label `` `${shortLabel} records on this page` `` (e.g. "VCA records on this page"), value `stats.loaded`, `Database` icon, tooltip `` `How many ${noun} service records match the current filters in the database.` `` (`noun` = lower-cased shortLabel).
     **BUG** `stats.loaded` equals `totalRecords` (all matching rows, AUDIT.md §3.2), not the rows on this page; the label contradicts its own tooltip. Intended: "records matching filters".
  2. key `monthly`, label `` `This month's ${noun} services` ``, value `stats.monthly` (service date in the current calendar month, among filtered rows), `Activity` icon, tooltip `` `${Noun} service records whose service_date falls in the current calendar month.` ``
  3. key `issues`, label `"Records flagged with issues"`, value `stats.recordsWithIssues`, `AlertTriangle` icon, tooltip `"Records that hit at least one data-quality check."`. When any issue count > 0 it becomes a **popover** instead of a tooltip: title `"Top issues in the loaded records"`, one row per issue with count > 0 sorted by count descending (label from `ISSUE_META`, count badge), click → set that issue filter, page 1, smooth-scroll to the table (`:685-739`); footer `"Click a row to filter the table to records with that issue."`. A `hint` line is supported but `ISSUE_META` defines no hints (`service-records.ts:52-58`), so it never shows.
- [ ] **Headline numbers** (`CanonicalKpiStrip.tsx`): card title `"Headline numbers"` + badge `"Live database"` with tooltip `"Numbers pulled live from the same database that powers the Home page and Superset dashboards. Refreshed every time you open this page."` (`:104-116`); month-on-month `TrendBadge` from `mom_trend_pct` (shown when loaded and `data.data` exists): `TrendingUp`/emerald if > 0, `TrendingDown`/rose if < 0, `Minus`/slate if 0; text `` `${pct > 0 ? "+" : ""}${pct}% vs last month` ``; tooltip `"Month-over-month change: how this month's services compare to last calendar month so far."` (`:67-82`, `:117`); `generated_at` as local `HH:MM` (`:119-123`). Two stat tiles per type with a help-icon tooltip (`:131-152`), labels and tooltips exactly (`:22-65`):
  - vca `enrolled` "VCAs ever enrolled": "Cumulative total of every VCA ever enrolled into the programme — active, exited, graduated, and transferred. This is the all-time number.\n\nThe VCA card on the Home page shows the same all-time enrolment number for the current district scope, so the two should match. If they look different, check the District filter at the top of each page."
  - vca `active` "Active VCAs": "VCAs whose case is currently open (case_status = 'Active'). Excludes exited, graduated, and transferred cases. The difference between 'VCAs ever enrolled' and 'Active VCAs' is the count of closed cases.\n\nThe Home page VCA card shows the cumulative enrolment number; this card shows the currently-open subset."
  - caregiver `enrolled` "Caregivers ever enrolled": "Cumulative count of caregivers (one per household) ever enrolled — including exited and graduated households. The Home page Caregivers card shows the same lifetime number for the current district scope."
  - caregiver `active` "Active caregivers": "Caregivers in households whose case is currently open. Excludes exited, graduated, and transferred. 'Ever enrolled' minus 'Active' = closed cases.\n\nThe Home page card shows ever-enrolled; this card shows the currently-open subset."
  - household `enrolled` "Households ever enrolled": "Cumulative total of every household ever enrolled — including those that have since exited, graduated, or been transferred. Use this for lifetime reach. The Home page Households card shows the same lifetime number."
  - household `active` "Active households": "Households whose case is currently open (case_status = 'Active'). Excludes exited, graduated, and transferred. 'Ever enrolled' minus 'Active' = households closed since enrolment.\n\nThe Home page card shows ever-enrolled; this card shows the currently-open subset."
  - FY: cohort-filtered on the backend for `enrolled`/`active`; the month counts are always calendar this/last month (AUDIT.md §3.2).
  - **QUESTION** Tooltips say `case_status = 'Active'`; the backend counts `LOWER(TRIM(case_status)) IN ('active','1')` (AUDIT.md §3.2). Also the backend's vca/household month counts are probably always 0 (AUDIT.md §3.2 summary issues), which makes the trend badge read "0% vs last month".
- [ ] **Population breakdown** (`CohortStrip.tsx`): label `"Population breakdown"` with `Users` icon (`:50-52`), then one outlined chip per cohort: `label` + bold count, tooltip on hover (`:60-75`). Cohorts, tones and tooltips exactly (`:15-31`):
  - vca: `clhiv` "CLHIV" (rose) — "Children Living with HIV — VCAs with a positive HIV status on file."; `cwlhiv` "CWLHIV" (fuchsia) — "Children/Caregivers Whose Mother is Living with HIV — VCAs whose caregiver has HIV+."; `hei` "HEI" (amber) — "HIV-Exposed Infant — children under 24 months born to an HIV+ mother and not yet final-tested."; `active_this_month` "Received a service this month" (emerald) — "VCAs who had at least one service event recorded in the current calendar month."; `stale_90d` "No service in 90+ days" (slate) — "VCAs whose most recent service is older than 90 days — likely overdue for follow-up."
  - caregiver: `cwlhiv` "Living with HIV" (fuchsia) — "Caregivers with a positive HIV status on file."; `pregnant` "Pregnant" (rose) — "Caregivers currently flagged as pregnant in their most recent assessment."
  - household: `screened` "Screened for vulnerabilities" (emerald) — "Households that have completed at least one vulnerability assessment."; `unscreened` "Not yet screened" (amber) — "Enrolled households with no vulnerability assessment recorded yet — pending screening."
  - These sub-population names and definitions are program terms → `@/config`.
- [ ] **Services delivered per month (last 12 months)** (`ServicesTimeSeriesChart.tsx`): Recharts `AreaChart` in `ResponsiveContainer` height 224 (`:58-75`); X = `label` (e.g. `"Jul 26"`), Y = `count`; monotone area, stroke and gradient fill from `hsl(var(--primary))` (35% → 0% opacity, gradient id `svcVolEcapPlus`, `:60-63`, `:73`); dashed horizontal grid; tooltip `[count.toLocaleString(), "Services"]` (`:69-72`). Badge `"{total} total"` = sum of counts (`:26-27`, `:37-41`). Months with no rows may be missing from the backend series when district-filtered (AUDIT.md §3.2) — **rebuild must zero-fill the 12 months.**
- [ ] **Service mix by domain (last 90 days)** (`ServicesDistributionChart.tsx`): Recharts donut `PieChart` (`innerRadius 42`, `outerRadius 72`, `paddingAngle 2`, height 224) with bottom circle legend (`:66-92`); slices `pillar`/`count`, zero slices dropped (`:35`); tooltip `` `${count.toLocaleString()} (${pct}%)` `` labelled `"Services"` (`:68-71`); badge `"{total} services"` from response `total` (`:45-49`). Colours hard-coded hex per pillar (`:16-23`), fallback slate. Note `pct` values overlap (one service can count in several pillars) so they can sum over 100% (AUDIT.md §3.2).
- [ ] Colours: rebuild uses theme tokens for pillar colours (shared by table badges, sheet badges and the donut), issue tones and severity tones; Recharts is the legacy library.

### Quality Review panel (`QualityReviewPanel.tsx`)
- [ ] Card title `"Quality Review"` with a loading-dots indicator while either query loads (`:148-152`); button `"Export duplicates"` (`:153-156`).
- [ ] Three summary buttons that switch the tab (`:161-183`): `"Needs action"` = Σ action-item `count` (`:103`, amber); `"Duplicate records"` = `summary.total_redundant_records`, else Σ(`duplicate_count` − 1) over groups (`:71-73`, `:104`, rose); `"Data gaps"` = Σ of all `issueCounts` values from the records stats (`:99-102`, slate — a record with two issues counts twice).
- [ ] Tabs `"Action Queue"` (default) / `"Duplicates"` / `"Data Gaps"` (`:83`, `:185-190`); tab state is local, not persisted.
- [ ] **Action Queue tab** (`:192-241`): loading → `PanelLoading`; empty when no items **or** total is 0 → `"No action queue items for the current scope."`; else table `Issue` (label + truncated description) / `Severity` (badge showing the raw severity word `red`/`orange`/`yellow`/`slate`, coloured by `SEVERITY_CLASS` `:39-44`) / `Count` / `Action` ("Filter" ghost button). "Filter" calls `onIssueChange(inferIssueKey(item))`, disabled when no key is inferred (`:224-232`).
  - `inferIssueKey` (`:54-62`) matches on `` `${item.key} ${item.label} ${item.filter?.type}` `` lower-cased: contains `date` → `missing_date`; `caseworker` or `worker` → `missing_caseworker`; `district` → `missing_district`; `stale` or `90` → `stale_90d`; `service` → `no_service_details`; else null.
  - **BUG** The keyword guess maps action items to record issues with different meanings. With the backend's fixed items (labels from `backend:controllers/etlController.js:1961-2077`): vca `vl_overdue_6m` (filter `stale_viral_loads`) → `stale_90d` (viral load ≠ service age); caregiver `pregnant_no_anc` ("…no service 90d+") → `stale_90d`; the `stale_*` items ("entities with no service in 90 days") → `stale_90d` (records whose own date is older than 90 days — a different set). All other items get no key and a disabled button. Intended: an explicit per-item mapping in config, or a real drill-down endpoint. → QUESTION.
- [ ] **Duplicates tab** (`:243-288`): loading → `PanelLoading`; empty → `"No duplicate records found for the current scope."`; else table of the **first 8 groups** only (`:262`): `Entity` (mono) / `Service Date` (`formatDate`: `new Date(value)` → `toLocaleDateString("en-US", {month:"short", day:"2-digit", year:"numeric"})`, raw value if unparseable, `"N/A"` if empty; `:64-69`) / `Service` (`services` or `"N/A"`) / `Caseworker` (or `"N/A"`) / `Duplicates` (`Number(duplicate_count)`, rose) / `Action` ("Focus" with search icon → `onDuplicateFocus(entity_id)`, `:271-280`). No "show more"; the remaining groups are only in the CSV.
  - **QUESTION** `new Date("DD-MM-YYYY")` is invalid, so caregiver text dates display raw; dates from date columns arrive as UTC ISO timestamps and `toLocaleDateString` can shift the day by time zone.
- [ ] **Data Gaps tab** (`:290-308`): five toggle tiles in `ISSUE_META` order (missing date, no service details, missing caseworker, missing district, older than 90d), each showing `issueCounts[key] ?? 0` and the label; clicking toggles that issue filter (click again clears); active tile has a ring.
- [ ] No error state in the panel: a failed query renders like "empty" (`actionQuery.data` undefined → `[]`).

### Links in / out
- [ ] **In** (all plain `navigate(path)` / `<NavLink>` with **no** query params, state or storage writes):
  - Sidebar `AppSidebar.tsx:79-85` (all three).
  - Mobile bottom nav `MobileBottomNav.tsx:9` (`/vca-services`).
  - Mobile sheet menu `DashboardLayout.tsx:38-39` (`/vca-services`, `/household-services`).
  - Global search `GlobalSearch.tsx:38-39` (`/vca-services`, `/caregiver-services`).
  - Home quick actions `Dashboard.tsx:18-42` ("VCA services" / "Caregiver services" / "Household services"), `navigate(a.to)` at `:110`.
  - Risk registers' back arrow: `VcaRiskRegister.tsx:235` → `/vca-services`; `HouseholdRiskRegister.tsx:247` → `/household-services`; `CaregiverRiskRegister.tsx:232` → `/caregiver-services`.
  - Detail pages' empty-state action: `VcaServiceProfile.tsx:74` "Back to VCA Services"; `HouseholdServiceProfile.tsx:73` "Back to Household Services"; `CaregiverServiceProfile.tsx:88` "Back to Caregiver Services".
  - The page's own type tabs (`ServicesPage.tsx:541-558`).
  - Dead: `RecentActivity.tsx:73,80` defines `route: "/vca-services"` and `route: "/household-services"` for its "vca-service"/"caregiver-service" types, but the field is never read and the component is never imported (unreferenced widget per decision 2 — audited with the dashboard widgets). Note the caregiver item points at `/household-services`.
  - The only supported deep-link param is `?district=<name>` (`ServicesPage.tsx:198`).
- [ ] **Out**:
  - Type tabs → `/vca-services` / `/caregiver-services` / `/household-services`, no payload (`:543-545`).
  - "Dashboard" button → `navigate("/")` (`:561-569`). **BUG** `/` is the login page (`App.tsx:237`, `Index.tsx`), which does not redirect signed-in users, so this shows the login screen. Intended: `/dashboard`.
  - Detail sheet "Open Record" (`:1216-1224`) → `openRecordRoute` (`:476-499`): `navigate("/profile/vca-service-details" | "/profile/caregiver-service-details" | "/profile/household-service-details", { state })` where `state` = **every key of** `detailRaw ?? record.raw` spread first, then overridden with: `district`, `district_name` (= `record.district`), `facility`, `facility_name` (= `record.facility`), `caseworker_name` (= `record.caseworker`), `service_date` (= `record.serviceDate`), `vca_id` and `vcaid` (= `record.entityId` for vca, else the raw value), `household_id` (= `record.entityId` for caregiver/household, else the raw value). No storage written. **Rebuild: `/services/:type/:recordId` must read its id from the route — see open question on what `recordId` is.**
  - No other links (entity id, caseworker, district are plain text; no link to the VCA/household profile or caseworker profile).

### Loading / empty / error
- [ ] Records table: initial load (`isLoading && records.length === 0`) → centred `LoadingDots`, plus `"Searching for <id> across districts…"` when focusing (`:347`, `:868-880`); refetch keeps previous rows (placeholder) and shows a sky `"Syncing"` badge (`:794-801`) and disables pagination.
- [ ] Records error (`isError`) → `AlertTriangle` + `"Service records could not be loaded for the selected scope."` — **no retry button** (`:881-885`). Because of `placeholderData`, `isError` can be true while old rows exist; the error branch then replaces them.
- [ ] Records empty → `CheckCircle2` + `"No service records match the current filters."` (`:886-890`).
- [ ] Stat cards show `0` while loading (no skeleton) (`:393-409`).
- [ ] Header: source/generated badges simply absent until the summary loads (`ServicesPageHeader.tsx:135`).
- [ ] `CanonicalKpiStrip`: loading → `LoadingDots`; **error → renders nothing** (`CanonicalKpiStrip.tsx:94`, `:127-128`).
- [ ] `CohortStrip`: loading → pill skeletons (one per cohort, `animate-pulse`); **error → renders nothing** (`CohortStrip.tsx:43`, `:53-58`).
- [ ] Charts: loading → `h-56` pulsing grey block; error → `AlertTriangle` + `"Failed to load timeseries"` / `"Failed to load distribution"` + the raw error message in small text (no retry); empty → `"No services in this window"` / `"No service activity in this window"` (`ServicesTimeSeriesChart.tsx:45-56`, `ServicesDistributionChart.tsx:53-64`).
- [ ] Quality review: see panel section (loading dots, empty texts, no error state).
- [ ] Detail sheet: payload area shows `LoadingDots` while fetching (`:1192-1195`); detail fetch failure is silent, falls back to `record.raw` (`:430-432`).
- [ ] Partial failure: every block fails independently; a failed summary hides two cards silently. Rebuild: skeletons, `<EmptyState>`, `<ErrorState>` with retry per block, each widget in an error boundary.

### Bugs and quirks
- [ ] **BUG** Provincial users get national data through the "All" option (`ServicesPage.tsx:284`, `:287-288`).
- [ ] **BUG** District lock applies one render late; a crafted `?district=` fetches another district once (`:197-199`, `:227-235`).
- [ ] **BUG** District URL sync wipes `fy`/`from`/`to` params (`:238-243`).
- [ ] **BUG** "Dashboard" button goes to the login page `/` (`:565`).
- [ ] **BUG** Domain filter offers pillars the type does not have; backend ignores them silently (`:103-111`).
- [ ] **BUG** Stat card "… records on this page" shows the total matching count (`:392-393`); badge `"{totalRecords} shown"` likewise shows the total, not the 12 shown (`:792`); popover title "Top issues in the loaded records" is about all matching records (`:695`).
- [ ] **BUG** Duplicate summary request without FY (`:295-306`) alongside the FY one from the strips.
- [ ] **BUG** Detail sheet payload is the entity's latest service, not the clicked one; and responses can race (`:419-435`).
- [ ] **BUG** Detail sheet "Service Domains" shows the same full service list under every pillar because the backend returns identical lists (`servicesByPillar`, AUDIT.md §3.2). Intended: per-pillar lists. → Backend ask.
- [ ] **BUG** Export: JWT in URL, triple error toast, whole file buffered, keep-alive lines in CSV (`api.ts:1438-1486`, `ServicesPage.tsx:438-473`).
- [ ] **BUG** Action-queue "Filter" keyword mapping applies the wrong record issue (`QualityReviewPanel.tsx:54-62`).
- [ ] **BUG** Tab switch resets district and all filters (`:543-545`).
- [ ] Quirk: `status` badge shows raw `case_status` text such as `"1"` in emerald (backend sends raw values, AUDIT.md §3.2). **QUESTION** map codes to labels?
- [ ] Quirk: the issue counts in the stat popover and Data Gaps tiles are computed **after** the active issue/domain/date/search filters, so selecting an issue changes the other tiles' counts.
- [ ] Quirk: the "issues" stat card's popover trigger and the Data-Gaps toggles are mouse-friendly but the card is a `<div>` trigger (`:670`, `:688`) — rebuild with accessible buttons.
- [ ] Quirk: the Records table / detail sheet header prefix for caregiver records is "Household" (`entityLabel`).
- [ ] Dead code: `downloadCsv` import (`:73`) and `useQueryClient()` (`:189`) unused; `ISSUE_META[*].tone` unused (page uses its own `ISSUE_CLASS`); `DATE_WINDOWS[*].days` unused; `SERVICE_TYPE_META[*].label` unused; type-change reset effect (`:259-264`) is redundant because each route remounts the page; most of `service-records.ts` (see Legacy files).
- [ ] Quirk: the Props interface is declared between two import blocks (`ServicesPage.tsx:84-97`).

## Component `ServicesPageHeader` (rendered by every services route)
- [ ] Rounded hero card with decorative radial gradients and two blurred pulsing blobs (`ServicesPageHeader.tsx:81-99`; colours from `SHARED_PALETTE` `:32-41`, all hard-coded rgba/Tailwind). Rebuild: theme tokens; drop or simplify decorative animation.
- [ ] Eyebrow `"Service delivery"` (`:33`, `:104-108`) · today's date `toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })` (`:73-78`, `:110`) · badge `"Live"` with `Activity` icon (always shown, `:111-116`).
- [ ] `<h1>` = page `title` in gradient text + outlined chip with the per-type icon and label (`:118-130`); optional subtitle paragraph (`:131-133`).
- [ ] Right side, only when the summary loaded: `"Live database"` badge when `source` is truthy (`:137-144`) and a clock badge with `formatTime(generatedAt)` (`:145-152`): `"—"` if missing/invalid, `"just now"` under 1 min, `"<n>m ago"` under 60 min, else local `HH:MM` (`:21-29`). Computed once per render; it does not tick.
- [ ] Rebuild: date formats through `core/lib/format.ts`; the "generated at" freshness belongs to `platform/freshness`.

## Other behaviour
- [ ] **Detail sheet** (shadcn `Sheet`, right side, full width on mobile, `sm:max-w-2xl`, scrollable; `ServicesPage.tsx:1056-1229`): opens on row "Open"; closing clears the record and payload (`:1058-1063`). Title `"<entityLabel> <entityId>"` + status badge; description `"<district> · <formatted date>"`. Info tiles (`InfoLine`, `:1234-1252`): "Name", "Facility", "Caseworker", "Record age". Sections "Service Domains", "Issues", "Source Payload" (key/value table, max height 360px, first 80 non-`_` keys), button "Open Record". **QUESTION** the raw payload shows every column of the entity table (names and other personal data) — keep it?
- [ ] **Toasts** (sonner): focus info/error (`:357-358`, `:517`); export info/success/error (`:455-465`, `:470`); duplicates export error/success (`QualityReviewPanel.tsx:109`, `:141`).
- [ ] **Timers**: search debounce `setTimeout` 350 ms (`ServicesPage.tsx:178-185`, `:222`); export state reset `setTimeout` 3000 ms (`:461`, `:465`); scroll-to-table `setTimeout` 100 ms (`:512-516`); no polling on the page itself. Indirect: `EtlInvalidator` polls `/etl/last-success` every 30 s and invalidates these queries (`EtlInvalidator.tsx:28`, `:54-57`, `:77-80`). Server side, the export writes a keep-alive line every 5 s (AUDIT.md §3.2).
- [ ] **Scrolling**: smooth `scrollIntoView` to `#services-records-table` (with `scroll-mt-24`) after choosing an issue from the stat popover (`:708-713`) and after focusing a duplicate (`:512-516`). Not after choosing a Data-Gaps tile or action-queue Filter.
- [ ] **Storage**: the services files read/write no storage directly. Indirect: React Query cache persisted to IndexedDB under key `ecap-plus-pmp-react-query` for 24 h (`App.tsx:140-148`) — includes the records pages with names; the district-discovery call caches the national household register in IndexedDB DB `ecap_plus_cache_db` / store `api_cache` / key `households_by_district:ALL` (`indexedDbCache.ts:6-7`, `api.ts:307-311`); FY state from localStorage `ecap_plus_pmp.fy_filter_state_v2` and URL `fy`/`from`/`to` via `useFyFilter` (`FyFilterContext.tsx:12`, `:50-80`).
- [ ] **Browser APIs**: `URL.createObjectURL` / temporary `<a download>` for both CSVs (`api.ts:1472-1478`, `csv.ts:21-28`); `ReadableStream.getReader()` (`api.ts:1461`); `document.getElementById(...).scrollIntoView`.
- [ ] **Keyboard**: none specific to the page (Cmd/Ctrl+K global search is shell).
- [ ] **Mutations**: none (read-only page; duplicate-review marks are only used by the unrouted `DuplicateDetectionCard`).
- [ ] **Branding / config strings** to move to `@/config`: sub-population terms and definitions (`CohortStrip.tsx:15-31`), pillar names (`service-records.ts:9`, `ServicesPage.tsx:103-111`), type labels and chips (`service-records.ts:31-50`, `ServicesPageHeader.tsx:50-62`), page subtitles mentioning "data warehouse" (`VcaServices.tsx:7` and siblings), tooltip copy mentioning "Superset dashboards" and "programme" (`CanonicalKpiStrip.tsx:28`, `:114`), gradient id `svcVolEcapPlus` contains the legacy brand (`ServicesTimeSeriesChart.tsx:61`, `:73`), hard-coded locales `en-US` (`ServicesPage.tsx:157`, `QualityReviewPanel.tsx:68`) and `en-GB` (`ServicesPageHeader.tsx:73`), hex colours (`ServicesDistributionChart.tsx:16-23`, `:69`; `ServicesTimeSeriesChart.tsx:66-70`).
- [ ] **WebRTC / support chat / voice notes**: none used by these files (decision 4 does not apply here).

## Open questions for the developer
1. **What is `:recordId` in `/services/:type/:recordId`?** The records API has no stable service-row id (synthetic, position-based `id`), and `/etl/services/:type/record-detail` takes only `entityId` and returns that entity's **latest** service. Options: use `entityId` (and show the latest/all services for it), or ask the backend for a service-row id and a by-id detail endpoint.
2. Should the records table, stats and export honour the global FY window? The backend ignores `from`/`to` for records, export, timeseries and distribution; legacy offers its own rolling "Date range" instead.
3. Provincial users: restrict "All" to their province's districts? The services endpoints accept only a single `district` (records/record-detail/export: no comma lists; AUDIT.md §3.2), so a province filter needs a backend change or a forced district choice.
4. Domain options: confirm they should follow the backend's per-type pillars (vca/caregiver: HIV, Health, Education, Safety, Stability; household: Health, Household, Education, Safety, Stability).
5. Action-queue "Filter" button: replace the keyword guess with an explicit mapping (which items map to which record issue?), or remove the button for items that have no matching record filter?
6. Should the detail sheet stay (with "Open Record" to the detail route), or should "Open" go straight to `/services/:type/:recordId`? Keep the raw "Source Payload" table (exposes every entity column)?
7. Status badge: show raw `case_status` (often `"1"`) or map codes to labels from config?
8. Should records/record-detail queries be excluded from IndexedDB persistence (`meta: { persist: false }`) because they contain names?
9. Duplicates tab shows only the first 8 groups with no "show more"; keep the cap, paginate, or show all?
10. Keep the "Dashboard" shortcut button on the page (it is broken in legacy)?
