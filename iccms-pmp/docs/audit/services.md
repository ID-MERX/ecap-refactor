# services — legacy audit

> Legacy routes → new routes: `/vca-services`, `/household-services`, `/caregiver-services` → `/services/:type` (`type` = `vca` | `household` | `caregiver`); `/profile/{vca,household,caregiver}-service-details` → `/services/:type/:recordId`; `/services/household-services` (orphan, KEEP per decision 3) · Plan: MIGRATION_PLAN.md §5 row "services"  · *part `core`*
> Legacy routes → new routes: `/vca-services`, `/household-services`, `/caregiver-services` → `/services/:type`; **`/profile/vca-service-details`, `/profile/household-service-details`, `/profile/caregiver-service-details` → `/services/:type/:recordId`** (this part); **`/services/household-services` (orphan, KEEP per decision 3)** (this part); unrouted `VcaServicesDashboard` (other part) · Plan: MIGRATION_PLAN.md §5 row "services" ("Detail pages need by-ID fetch (`getServiceRecordDetail` may cover it). Orphan route: confirm before porting")  · *part `profiles`*
> This part covers the three service-record profile pages and the orphan `HouseholdServicesPage`. The config-driven list page `ServicesPage` (used by `/vca-services`, `/household-services`, `/caregiver-services`) and `VcaServicesDashboard` belong to the other part(s); only the lines of `ServicesPage` that hand a record to the profiles are cited here.
> Legacy routes → new routes: `/vca-services`, `/household-services`, `/caregiver-services` → `/services/:type`; `/profile/{vca,household,caregiver}-service-details` → `/services/:type/:recordId`; `/services/household-services` (orphan, kept per decision 3); **unrouted `VcaServicesDashboard` (this part), to be ported per decision 2** · Plan: MIGRATION_PLAN.md §5 row "services"  · *part `vca-services-dashboard`*
> This part covers only the unrouted page component `VcaServicesDashboard` and the `DuplicateDetectionCard` widget it renders. The live `/vca-services` route renders `VcaServices` → `ServicesPage` (`legacy:src/pages/VcaServices.tsx:1-9`, `legacy:src/App.tsx:36,317-324`), which other parts of this module cover.
> **Where it goes in the new app (not decided by legacy):** legacy has no URL for this page. A natural home is a "dashboard"/"overview" tab under `/services/vca` (e.g. `/services/vca/overview`), but that is a developer decision. See Open questions.
> Merged from the step-3 drafts: `core`, `profiles`, `vca-services-dashboard`. Content is carried over verbatim; only heading levels, the merged header and the shared Legacy files table were consolidated.

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
| `src/pages/VcaServiceProfile.tsx` | 250 | Route `/profile/vca-service-details`. Local helpers `p` (`:23-29`) and `InfoItem` (`:31-47`). **Read in full.** |
| `src/pages/HouseholdServiceProfile.tsx` | 216 | Route `/profile/household-service-details`. Local helpers `p` (`:22-28`) and `InfoItem` (`:30-46`). **Read in full.** |
| `src/pages/CaregiverServiceProfile.tsx` | 267 | Route `/profile/caregiver-service-details`. Local helpers `p` (`:28-34`), `cleanArrayString` (`:36-43`), `InfoItem` (`:45-61`). **Read in full.** |
| `src/pages/HouseholdServicesPage.tsx` | 336 | Route `/services/household-services`. **Orphan: no inbound link anywhere in `src`** (grep for `services/household-services` hits only `src/App.tsx:374`). **Read in full.** |
| `src/App.tsx` | 602 | Lazy imports `:33-35`, `:57-65`; routes `:374-380`, `:494-516`; QueryClient defaults `:112-133`; IndexedDB persister key `:140-148`. Relevant parts read. |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard. Read in full. |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Nav sections + visibility filter. Read in full. No entry for any route in this part. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile bottom nav. Read in full. No entry for any route in this part. |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Mobile "More" menu items `:30-44` (no entry for this part's routes); `subtitle` prop passed to header `:94`. Spot-read. |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Cmd/Ctrl+K palette. Read in full. No entry or record link for this part's routes. |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Scope hook. Read in full. **Not used by any file in this part.** |
| `src/components/dashboard/services/ServicesPage.tsx` | 1254 | Only caller of the three profiles. Spot-read `:395-520` (detail-sheet fetch `:419-434`, `openRecordRoute` `:476-500`), `:1040-1070`, `:1200-1235` ("Open Record" button `:1217-1220`). |
| `src/lib/api.ts` | 1486 | `DEFAULT_DISTRICT` `:7`, `SERVICES_CACHE_TTL_MS` `:8`, `LIST_CACHE_TTL_MS` `:14`, `getListFromApiWithCache` `:212-238`, `fyQs` `:241-245`, `getHouseholdsByDistrict` `:301-312`, `getHouseholdServicesByDistrict` `:419-426`, `dqaGetSkipCache` `:701-711`, `ServiceRecordRow` `:1309-1327`, `getServiceRecords` `:1346-1386`, `getServiceRecordDetail` `:1389-1406`. |
| `src/lib/utils.ts` | 64 | `toSentenceCase` `:23-27`. |
| `src/components/EmptyState.tsx` | 51 | Props `icon`, `title`, `description`, `action {label,onClick}`, `className`. Read in full. |
| `src/components/aceternity/LoadingDots.tsx` | 17 | Three bouncing dots. Read in full. |
| `src/components/aceternity/GlowCard.tsx` | 37 | Card wrapper used by `HouseholdServicesPage`. Not read in detail (presentational). |
| `src/context/FyFilterContext.tsx` | 122 | `useFyFilter().resolved` used by `HouseholdServicesPage`. Read in full. |
| `src/components/EtlInvalidator.tsx` | 90 | 30 s poll (`:28`) of `/etl/last-success`; on a new run it clears the IndexedDB list cache and invalidates every query whose key does not start with `"etl"` (`:63-81`). Spot-read `:28`, `:50-90`. |
| `backend:controllers/etlController.js` | — | `getServiceRecordDetail` `:3126-3201`; `/records` row normaliser `:3054-3087`. Read-only reference. |
| `backend:controllers/householdController.js` | — | `getHouseholdServicesByDistrict` `:365-407`. Read-only reference. |
| `src/pages/VcaServicesDashboard.tsx` | 954 | The page. **Unrouted and never imported.** Grep of `src` for `VcaServicesDashboard` hits only the file itself (`legacy:src/pages/VcaServicesDashboard.tsx:218,306,307,954`). It is not in the lazy imports of `legacy:src/App.tsx:19-110`. Read in full. |
| `src/components/dashboard/DuplicateDetectionCard.tsx` | 489 | Duplicate-service widget rendered at the bottom of the page (`legacy:src/pages/VcaServicesDashboard.tsx:946-948`). Its only importer is this page, so it is effectively dead too. Read in full. |
| `src/lib/data-validation.ts` | 70 | `isCategoryProvided` used for domain coverage KPIs. Read in full. |
| `src/lib/fiscalYear.ts` | 84 | `resolveFy`, FY bounds (Oct–Sep). Read lines 1-84 (relevant parts 18-62). |
| `src/lib/indexedDbCache.ts` | 92 | IndexedDB list cache behind the wrappers. Read lines 1-80. |
| `src/pages/VcaRiskRegister.tsx` | 396 | Link target of the KPI cards; read 1-130 to verify which query params it reads. |
| `src/pages/VcaServices.tsx` | 11 | The component actually routed at `/vca-services` (for contrast). Read in full. |

## Contents

- [the shared services page](#part-core)
- [the three service profile pages](#part-profiles)
- [the unreferenced VCA services dashboard](#part-vca-services-dashboard)

<a id="part-core"></a>

## Part: the shared services page

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

<a id="part-profiles"></a>

## Part: the three service profile pages

## Record hand-off and by-ID fetch (applies to all three profiles) — FOCUS

### How each profile receives its record (legacy)
- [ ] All three profiles call **no API**. Each reads the whole record object from `location.state.record`, and falls back to a sessionStorage copy (`legacy:src/pages/VcaServiceProfile.tsx:53-65`, `legacy:src/pages/HouseholdServiceProfile.tsx:52-64`, `legacy:src/pages/CaregiverServiceProfile.tsx:67-79`):
  1. `const r = location.state?.record;` → if truthy, `sessionStorage.setItem(<key>, JSON.stringify(r))` and use it.
  2. else `JSON.parse(sessionStorage.getItem(<key>))`, or `null` on a missing key / parse error.
  3. `null` → "Service Record Not Found" empty state (see each route).
- [ ] sessionStorage keys (written and read only by the profile itself):
  - `ecap_last_vca_service` (`legacy:src/pages/VcaServiceProfile.tsx:56,60`)
  - `ecap_last_household_service_event` (`legacy:src/pages/HouseholdServiceProfile.tsx:55,59`)
  - `ecap_last_caregiver_service_event` (`legacy:src/pages/CaregiverServiceProfile.tsx:70,74`)
- [ ] The URL carries **no id, no query param**. A reload, a shared link or a new tab shows the last record viewed in this tab (or "not found").

### What the callers actually send
- [ ] **`ServicesPage` (main list pages) sends the record flat, not under `record`.** `openRecordRoute` builds `state = { ...raw, district, district_name, facility, facility_name, caseworker_name, service_date, vca_id, vcaid, household_id }` and calls `navigate(<path>, { state })` (`legacy:src/components/dashboard/services/ServicesPage.tsx:476-500`):
  - `raw` = `detailRaw ?? record.raw` (`:477`). `detailRaw` is the `/etl/services/:type/record-detail` row fetched when the detail sheet opened (`:419-434`); `record.raw` is the lightweight `{ entity_id, district, facility, caseworker_name, service_date }` from `/records` (`backend:controllers/etlController.js:3080-3086`).
  - Overrides: `district`, `district_name` ← `record.district`; `facility`, `facility_name` ← `record.facility`; `caseworker_name` ← `record.caseworker`; `service_date` ← `record.serviceDate`; `vca_id`, `vcaid` ← `record.entityId` when `type === "vca"` else the raw value; `household_id` ← `record.entityId` when `type !== "vca"` else `raw.household_id` (`:479-489`).
  - Path by type: `"vca"` → `/profile/vca-service-details`; `"caregiver"` → `/profile/caregiver-service-details`; anything else → `/profile/household-service-details` (`:490-499`).
  - Trigger: the **"Open Record"** button in the detail sheet (`:1217-1220`), i.e. row "Open" → sheet → "Open Record".
- [ ] **`HouseholdServicesPage` (orphan) sends `{ state: { record: service } }`** where `service` is a raw row from `/household/household-services-by-district/:district(*)` (`legacy:src/pages/HouseholdServicesPage.tsx:295-297`). This is the only caller that matches the profiles' expected shape, and only for the household profile.
- [ ] **BUG (major): the three routed list pages can never open a profile correctly.** `ServicesPage` sends `state` without a `record` key, so `location.state?.record` is `undefined` (no service or entity table is known to have a column named `record`). The VCA and caregiver profiles then always show "Service Record Not Found", because their sessionStorage keys are only written by the profile itself when `state.record` exists, and no caller ever sends it. The household profile shows a **stale, unrelated record** from the last time the orphan page was used in this tab, or "not found". Port the intended behaviour: open the record the user clicked.
- [ ] **BUG:** `openRecordRoute` mixes data from two different service visits. `/record-detail` returns the entity's **latest** service (`backend:controllers/etlController.js:3185-3186`), but `service_date` is then overwritten with the clicked row's date (`legacy:src/components/dashboard/services/ServicesPage.tsx:486`). An older visit therefore shows the latest visit's service columns with the older date.
- [ ] **BUG:** if "Open Record" is clicked before the detail fetch finishes, or the fetch fails (the wrapper turns every error into `null`, `legacy:src/lib/api.ts:1401-1405`), `raw` is the five-field lightweight object and the profile shows almost nothing.

### Can `GET /etl/services/:type/record-detail` serve a by-ID fetch? (AUDIT.md §3.2)
- Wrapper `getServiceRecordDetail({ type, entityId, district? })` (`legacy:src/lib/api.ts:1389-1406`): sends `entityId`; sends `district` only when truthy and not `"All"`; uses `dqaGetSkipCache` (no IndexedDB cache); returns `res.data ?? null`; **every error → `null`**.
- Backend (`backend:controllers/etlController.js:3126-3201`):
  - `type` ∈ `vca` | `caregiver` | `household` (lower-cased, `:3128`), else 400 `Unknown type` (`:3164-3169`).
  - `entityId` required (400, `:3131-3135`), matched with `LOWER(TRIM(s.<id>::text)) = LOWER(TRIM($1::text))` against `s.vcaid` (vca) or `s.household_id` (caregiver, household) (`:3137-3162`, `:3183`).
  - `district` optional; ignored when absent, `All` or `all`; otherwise exact case-sensitive `c.district::text = $2` (`:3174-3177`).
  - `SELECT s.*, c.*` … `ORDER BY s.service_date DESC NULLS LAST LIMIT 1` (`:3180-3186`); 404 `Record not found` (`:3190-3193`); 200 `{status:"success", data:{…}}` (`:3196`).
  - **No param selects a specific service visit** (no service id, no service date). `c.*` overwrites same-named `s.*` columns.
- **Answer: partially.** It is a by-ID fetch for an **entity** (VCA `vcaid` or `household_id`), not for a **service record**. It can back `/services/:type/:recordId` only if the new detail page is defined as "the latest service for this entity", or if the client accepts that an older visit's full columns are unavailable.
- Options for `/services/:type/:recordId` with the backend unchanged (decision 7):
  - [ ] (a) `recordId` = entity id (URL-encoded). Fetch `/etl/services/:type/record-detail?entityId=<id>[&district=<scope district>]` → latest service. Optionally add `?date=<serviceDate>`; when it differs from the returned `service_date`, show a notice that only the latest visit's full detail is available, and show the clicked visit's summary from (b).
  - [ ] (b) For the clicked visit's own summary fields, `GET /etl/services/:type/records?entityId=<id>&pageSize=100` (AUDIT.md §3.2) returns every service of that entity (all other filters skipped in `entityId` mode), each with `serviceDate`, `serviceNames`, `pillars`, `status`, `issues`, `facility`, `caseworker`, `district`. Match on `serviceDate`. This gives no raw columns (`raw` is the five-field object, `backend:controllers/etlController.js:3080-3086`). The synthetic row `id` (`${type}-${entityId}-${serviceDate}-${offset+idx}`, `:3063`) depends on position and **must not** be used as `recordId`.
  - [ ] Recommended: route `/services/:type/:entityId?date=<serviceDate>` → (a) for the full row plus (b) for the visit list and the matched visit. Record a **Backend ask**: add an optional `serviceDate` (or service row id) param to `/record-detail` so a specific visit can be fetched, select only the needed `c.*` columns (PII), and enforce scope from `req.user`.
- [ ] Scope for the new fetch: legacy profiles apply none (they fetch nothing). `ServicesPage` sends the row's own district (`legacy:src/components/dashboard/services/ServicesPage.tsx:427`). The new app should send the scope district from `platform/scope` (district users: their district). The backend still trusts it, and `/records?entityId=` ignores district entirely (AUDIT.md §3.2). **Backend ask:** server-side scope on both.
- [ ] Query key: `services.detail(type, entityId, scope)` with `meta: { etl: true }` (warehouse data); `meta: { persist: false }` is advisable because `c.*` includes beneficiary PII (names, phone numbers).

---

## Route `/profile/vca-service-details` → `/services/vca/:recordId`

### Purpose
Read-only detail view of one VCA service record: green banner (type badge, status badge, service name as H1, VCA ID, district), a metadata strip (service date, derived category), three quick-info cards, and two tabs, **Overview** and **Intervention details** (`legacy:src/pages/VcaServiceProfile.tsx:87-245`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:493-500`). `ProtectedRoute` renders `null` while auth loads, redirects to `/` with no user, and to `/change-password` when `password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). No role check. New app: manifest permission, e.g. `services.view`.
- [ ] Sidebar: no entry. The "Services" section lists `/household-services`, `/vca-services`, `/caregiver-services`, … (`legacy:src/components/dashboard/AppSidebar.tsx:76-96`). The Services section has no visibility rule; only `/districts` (`item.url === "/districts" && isDistrictUser`), the `Admin` section (`!isAdmin`) and `"Data Pipeline"` are filtered (`:165-173`). Active state is exact-path (`isActive = currentPath === path`, `:183`), so **nothing is highlighted on the profile**. New app: highlight "VCA Services". Mobile bottom nav: no entry; "Services" → `/vca-services` uses `end` exact match (`legacy:src/components/dashboard/MobileBottomNav.tsx:9,29`). Mobile "More" menu: no entry (`legacy:src/components/dashboard/DashboardLayout.tsx:30-44`). Global search: no nav entry or record link (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`).
- [ ] In-page role/permission checks: **none** (no `useAuth`, no `useEffectiveDistrict` import; `legacy:src/pages/VcaServiceProfile.tsx:1-21`).
- [ ] Data scope: none (no fetch). Whatever record arrives is shown, whatever its district. See the FOCUS section for the new fetch's scope.

### Endpoints
- [ ] None in legacy. New: `GET /etl/services/vca/record-detail?entityId=<vcaid>[&district=]` (AUDIT.md §3.2), plus optionally `GET /etl/services/vca/records?entityId=` (AUDIT.md §3.2). See FOCUS.

### Fields used
Resolver `p(record, keys)` returns the first value that is not `null`/`undefined`/`""`, as `String(val)`, else `"N/A"` (`legacy:src/pages/VcaServiceProfile.tsx:23-29`).

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| vcaId | `vca_id`, `vcaid`, `child_id`, `unique_id` (`:81`) | Header subtitle `` `VCA Service — ${vcaId}` `` (`:88`); banner "VCA ID: {vcaId}" (`:113`); Overview "VCA Identifier" (`:204`) | raw string |
| serviceName | `service`, `service_name`, `form_name` (`:82`) | Banner H1 (`:107-109`); Overview "Service Item" (`:205`); drives Category (`:141`) | raw string. **QUESTION:** `vca_services` has `*_services` pillar columns (AUDIT.md §3.2 record-detail table), and none of these three keys is known to exist, so the H1 is probably always "N/A" |
| status | `status`, `state`, `outcome` (`:83`) | Banner badge (`:103-105`); quick card "Service Status" (`:154-155`) | raw string. **QUESTION:** none of these keys is known on `vca_services`/`children` (the entity status column is `case_status`) |
| district | `district` (`:84`) | Banner (`:117`); quick card "District Location" (`:165-166`); Overview "District" (`:218`) | raw |
| dateStr | `service_date`, `visit_date`, `date`, `created_at` (`:85`) | Strip "Service Date: …" (`:137`); quick card "**Audit Date**" (`:176-177`); Overview "Service Date" (`:206`) | **raw string, no formatting**. From `/record-detail` it is an ISO timestamp shifted by server TZ (AUDIT.md §3.2); from `ServicesPage` override it is `YYYY-MM-DD` |
| category | derived from serviceName (`:141`) | Strip "Category: …" | `serviceName.toLowerCase().includes("health") ? "Health" : …includes("school") ? "Schooled" : "Social Support"` |
| province | `province` (`:217`) | Overview "Province" | raw |
| facility | `health_facility`, `facility` (`:219`) | Overview "Health Facility" (heart-pulse icon) | raw |
| every string field | `Object.entries(record)` (`:233-240`) | **Intervention details** tab, one `InfoItem` per field | label = `toSentenceCase(key.replace(/_/g, " "))` (first letter upper, rest lower; `legacy:src/lib/utils.ts:23-27`); value raw. Shown only if `typeof value === "string"` and not `"N/A"`, `""`, `"null"` (`:234`). Skips keys `['id','vca_id','service','service_date','district','province','health_facility']` (`:236`) |

### Filters / sort / pagination / search
- [ ] None. Tabs `Overview` (default, `defaultValue="overview"`) and `Intervention details` (`:185-193`); tab not persisted in URL.

### Exports
- [ ] None.

### Charts
- [ ] None. The three quick-info cards are static values: "Service Status", "District Location", "Audit Date" (`:148-182`).

### Links in / out
- [ ] In: `ServicesPage` "Open Record" for `type === "vca"` (`legacy:src/components/dashboard/services/ServicesPage.tsx:490-492`, button `:1217-1220`), mounted by `VcaServices` (`/vca-services`). Payload: flat `location.state` (keys: every key of `detailRaw` or `record.raw` + `district`, `district_name`, `facility`, `facility_name`, `caseworker_name`, `service_date`, `vca_id`, `vcaid`, `household_id`). Nothing written to storage before navigating. **No other inbound link** (grep `service-details` in `src`).
- [ ] Out: "Back" button → `navigate(-1)` (`:121-128`). Empty state "Back to VCA Services" → `/vca-services` (`:74`). No link to the VCA profile (`/profile/vca-details`, new `/vcas/:vcaId`). **QUESTION:** add a link to the VCA in the new app?

### Loading / empty / error
- [ ] No loading state (no fetch). Wrapped in `DashboardLayout` with `subtitle="VCA Service Profile"` when empty (`:69`).
- [ ] Empty: `EmptyState` with `ClipboardList` icon, title "Service Record Not Found", description "The VCA service record could not be loaded.", action "Back to VCA Services" → `/vca-services`, `className="h-[50vh]"` (`:67-79`).
- [ ] New app: skeleton while the by-ID fetch runs; `<EmptyState>` on 404; `<ErrorState>` with retry on other errors (legacy `getServiceRecordDetail` hides errors as `null`).

### Bugs and quirks
- [ ] **BUG:** the page never receives its record from the real list page (see FOCUS). Always "not found" in practice.
- [ ] **BUG:** quick card labelled "Audit Date" shows the service date (`:176-177`).
- [ ] **BUG:** "Intervention details" duplicates fields already shown, because the skip list misses `vcaid`, `district_name`, `facility`, `facility_name`, `caseworker_name` that the caller injects (`:236`; `legacy:src/components/dashboard/services/ServicesPage.tsx:479-488`). It also hides all non-string values (numbers, booleans).
- [ ] **QUESTION:** the Category rule is a guess from the service name and falls back to "Social Support" for "N/A". The new app should use the pillar data (`pillars` from `/records`, or the non-empty `*_services` columns) with pillar labels from config.
- [ ] Quirk: `Back` uses history (`navigate(-1)`), so with a deep link it leaves the app. New app: link to `/services/vca`.
- [ ] Quirk: hardcoded gradient `from-green-700 via-emerald-600 to-teal-600` and slate colours (`:92`); use theme tokens.

---

## Route `/profile/household-service-details` → `/services/household/:recordId`

### Purpose
Read-only detail of one household-level service record: banner (badge "Household Service", status badge, service name H1, Household ID, district), metadata strip (service date, caseworker), tabs **Overview** (three cards) and **Full record** (`legacy:src/pages/HouseholdServiceProfile.tsx:86-211`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:501-508`). No role check.
- [ ] Sidebar: no entry ("Household Services" → `/household-services`, `legacy:src/components/dashboard/AppSidebar.tsx:79`; exact-path active, `:183`). Mobile bottom nav: none (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). Global search: none; note that global search has **no** "Household Services" nav entry at all, only VCA and Caregiver services (`legacy:src/components/dashboard/GlobalSearch.tsx:38-39`).
- [ ] In-page role checks: none (`legacy:src/pages/HouseholdServiceProfile.tsx:1-20`).
- [ ] Data scope: none (no fetch).

### Endpoints
- [ ] None in legacy. New: `GET /etl/services/household/record-detail?entityId=<household_id>` (AUDIT.md §3.2). Note that for rows coming from the orphan page (`/household/household-services-by-district`), the entity id is `household_id` too.

### Fields used
`p` resolver identical to VCA (`:22-28`).

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| householdId | `household_id`, `hh_id`, `householdId`, `unique_id` (`:80`) | Subtitle `` `Household Service — ${householdId}` `` (`:87`); banner "Household ID: …" (`:112`); Overview "Household ID" (`:174`) | raw |
| serviceName | `service`, `service_name`, `form_name` (`:81`) | H1 (`:106-108`); Overview "Service Item" (`:163`) | raw. **QUESTION:** these keys are not known on `household_services` (it has `health_services`, `hh_level_services`, `schooled_services`, `safe_services`, `stable_services` + `other_*`; AUDIT.md §3.2) |
| status | `status`, `state`, `outcome` (`:82`) | Banner badge (`:102-104`); Overview "Status" (`:164`) | raw |
| district | `district` (`:83`) | Banner (`:116`); Overview "District" (`:185`) | raw |
| dateStr | `service_date`, `visit_date`, `date`, `created_at` (`:84`) | Strip "Service Date: …" (`:135`); Overview "Service Date" (`:165`) | raw (ISO timestamp from `household-services-by-district`/`record-detail`, AUDIT.md §3.2) |
| caseworker | `caseworker_name` (`:139`, `:175`) | Strip "Caseworker: …"; Overview "Caseworker" | raw |
| caseworkerId | `caseworker_id`, `staff_id` (`:176`) | Overview "Caseworker ID" | raw |
| province | `province` (`:186`) | Overview "Province" | raw |
| facility | `health_facility`, `facility` (`:187`) | Overview "Facility" | raw |
| every string field | `Object.entries(record)` (`:201-206`) | **Full record** tab | same rule as VCA (string, not `"N/A"`/`""`/`"null"`), **no skip list** |

Overview card titles: "Service branding" (`:160`), "Entity details" (`:171`), "Location" (`:182`). Full record card title: "System audit fields" (`:197`).

### Filters / sort / pagination / search
- [ ] None. Tabs `Overview` (default) and `Full record` (`:146-154`).

### Exports
- [ ] None.

### Charts
- [ ] None.

### Links in / out
- [ ] In (1): `ServicesPage` "Open Record" for any type other than `vca`/`caregiver`, i.e. `household` (`legacy:src/components/dashboard/services/ServicesPage.tsx:498`), mounted by `HouseholdServices` (`/household-services`). Flat `state` as described in FOCUS (**does not work**, see BUG).
- [ ] In (2): orphan `HouseholdServicesPage` row click on the "Household focus" cell → `navigate('/profile/household-service-details', { state: { record: service } })` (`legacy:src/pages/HouseholdServicesPage.tsx:293-297`). `service` = raw row of `/household/household-services-by-district/:district(*)` (`hs.*` + `ah.district`, `backend:controllers/householdController.js:369-375`).
- [ ] Out: "Back" → `navigate(-1)` (`:120-127`); empty-state action "Back to Household Services" → `/household-services` (`:73`). No link to the household profile. **QUESTION:** add one (`/households/:householdId`)?

### Loading / empty / error
- [ ] No loading state. Empty: `EmptyState` `ClipboardList` icon, "Service Record Not Found", "The household service record could not be loaded.", action "Back to Household Services" → `/household-services`, layout subtitle "Household Service Profile" (`:66-78`).

### Bugs and quirks
- [ ] **BUG:** from `/household-services` the page shows a **stale record** from sessionStorage `ecap_last_household_service_event` (written only by the orphan-page flow), not the clicked record (FOCUS).
- [ ] **BUG:** the "Full record" tab duplicates `district`/`district_name`/`facility`/`facility_name` (no skip list) and hides non-string values (`:201-206`).
- [ ] Quirk: card title "Service branding" (`:160`) is a misnomer for service info.
- [ ] Quirk: `household_id` in the `/record-detail` row comes from `c.*` (it overwrites `s.*`, AUDIT.md §3.2). Harmless here (same value).

---

## Route `/profile/caregiver-service-details` → `/services/caregiver/:recordId`

### Purpose
Read-only detail of one caregiver service visit: banner (badge "Caregiver Service", HIV status badge, fixed H1 "Service Interaction Log", Household ID, district), strip (service date, latest VL), tabs **Service domains** (four pillar cards), **Clinical data**, **System audit** (`legacy:src/pages/CaregiverServiceProfile.tsx:100-262`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:509-516`). No role check.
- [ ] Sidebar: no entry ("Caregiver Services" → `/caregiver-services`, `legacy:src/components/dashboard/AppSidebar.tsx:81-85`; exact-path active, `:183`). Mobile bottom nav: none. Mobile "More" menu: none (`legacy:src/components/dashboard/DashboardLayout.tsx:30-44`). Global search: none (only a nav entry for the list, `legacy:src/components/dashboard/GlobalSearch.tsx:39`).
- [ ] In-page role checks: none (`legacy:src/pages/CaregiverServiceProfile.tsx:1-26`).
- [ ] Data scope: none (no fetch).

### Endpoints
- [ ] None in legacy. New: `GET /etl/services/caregiver/record-detail?entityId=<household_id>` (AUDIT.md §3.2). Caveat: for caregiver, `service_date` is **text**, so `ORDER BY s.service_date DESC` sorts lexically and "latest" is wrong for `DD-MM-YYYY` values (AUDIT.md §3.2 record-detail Issues). This makes option (a) in FOCUS less reliable for caregivers.

### Fields used
`p` resolver identical (`:28-34`). `cleanArrayString(str)` (`:36-43`): falsy → `"None"`; else removes `[`, `]` and `"` and replaces every `,` with `", "`.

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| householdId | `household_id`, `hh_id`, `householdId` (`:95`) (no `unique_id`, unlike household) | Subtitle `` `Caregiver Service — ${householdId}` `` (`:101`); banner "Household ID: …" (`:126`) | raw |
| isPositive | `is_hiv_positive` (`:96`) | Badge: `isPositive ? "HIV Positive" : "HIV Negative"`; positive uses rose styling (`:116-118`) | `String(record.is_hiv_positive \|\| "").toLowerCase().includes("yes") \|\| String(record.is_hiv_positive) === "1"` |
| dateStr | `service_date`, `visit_date`, `date` (`:97`) (no `created_at`) | Strip "Service Date: …" (`:149`) | raw (caregiver `service_date` is text: `YYYY-MM-DD…` or `DD-MM-YYYY`, AUDIT.md §3.2) |
| district | `district` (`:98`) | Banner (`:130`) | raw |
| vlLast | `vl_last_result` (`:153`, `:236`) | Strip "Latest VL: …" (bold, amber icon); Clinical "Recent Viral Load" | raw |
| health | `health_services` (`:182`) | Domains → "Health & hiv" card → "Health Services" | `cleanArrayString` |
| otherHealth | `other_health_services` (`:183`) | "Other Health" | `cleanArrayString` |
| hiv | `hiv_services` (`:184`) | "HIV Services" | `cleanArrayString` |
| otherHiv | `other_hiv_services` (`:185`) | "Other HIV" | `cleanArrayString` |
| schooled | `schooled_services` (`:196`) | "Schooled" card → "Schooled Services" | `cleanArrayString` |
| otherSchooled | `other_schooled_services` (`:197`) | "Other Schooled" | `cleanArrayString` |
| safe | `safe_services` (`:208`) | "Safe" card → "Safe Services" | `cleanArrayString` |
| otherSafe | `other_safe_services` (`:209`) | "Other Safe" | `cleanArrayString` |
| stable | `stable_services` (`:220`) | "Stable" card → "Stable Services" | `cleanArrayString` |
| otherStable | `other_stable_services` (`:221`) | "Other Stable" | `cleanArrayString` |
| hivPositiveRaw | `is_hiv_positive` (`:235`) | Clinical "Is HIV Positive?" | raw |
| vlDate | `date_last_vl` (`:237`) | Clinical "Date of Last VL" | raw |
| tbScreened | `is_tb_screened`, `tb_screened` (`:238`) | Clinical "TB Screened?" | raw |
| nutritionScreened | `is_nutrition_screened`, `nutrition_screened` (`:239`) | Clinical "Nutrition Screened?" | raw |
| every string field | `Object.entries(record)` (`:252-257`) | **System audit** tab, card "System audit log" | same rule as household, no skip list |

Tabs: `domains` "Service domains" (default, `:160-163`), `clinical` "Clinical data" (`:165-167`), `raw` "System audit" (`:168-170`). Domain card titles: "Health & hiv" (`:178`), "Schooled" (`:192`), "Safe" (`:204`), "Stable" (`:216`). Clinical card title "Clinical profile" (`:231`).

### Filters / sort / pagination / search
- [ ] None.

### Exports
- [ ] None.

### Charts
- [ ] None.

### Links in / out
- [ ] In: `ServicesPage` "Open Record" for `type === "caregiver"` (`legacy:src/components/dashboard/services/ServicesPage.tsx:494-496`), mounted by `CaregiverServices` (`/caregiver-services`). Flat `state` (**does not work**, see FOCUS). No other inbound link.
- [ ] Out: "Back" → `navigate(-1)` (`:134-141`); empty-state "Back to Caregiver Services" → `/caregiver-services` (`:88`). No link to the household profile.

### Loading / empty / error
- [ ] No loading state. Empty: `EmptyState` with `Heart` icon, "Service Record Not Found", "The caregiver service record could not be loaded.", action "Back to Caregiver Services" → `/caregiver-services`, layout subtitle "Caregiver Service Profile" (`:81-93`).

### Bugs and quirks
- [ ] **BUG:** never receives its record from the real list page (FOCUS). Always "not found" in practice.
- [ ] **BUG:** a missing or unknown `is_hiv_positive` is shown as "HIV Negative" (`:96`, `:117`). The new app must show "Unknown" when the value is absent or unrecognised.
- [ ] **BUG:** `cleanArrayString` produces a double space for values already written as `a, b` (`","` → `", "`), and splits service names that contain commas. A value `"null"` (string) is shown as "null" (`:36-43`). The new app should parse JSON-array text in the normaliser (`api/schemas.ts`).
- [ ] **BUG:** System audit tab hides non-string values and duplicates caller-injected keys (`:252-257`).
- [ ] Quirk: H1 is the fixed text "Service Interaction Log" (`:121`), not a service name.
- [ ] **QUESTION:** the card label "Health & hiv" combines two pillars, and the pillar names "Schooled", "Safe", "Stable" are program domain terms; they should come from config (`@/config` program pillars). Note that `/records` labels the pillars "HIV / Health / Education / Safety / Stability" (AUDIT.md §3.2), so the legacy app uses two naming schemes.

---

## Route `/services/household-services` → keep (decision 3); new path TBD (see Open questions)

### Purpose
Orphan "Household services insights" page: banner with district picker and "Sync" button, a stats strip, three KPI cards, and a searchable table ("Household operations audit") showing the **first 15** household-service rows. Clicking a household ID opens the household service profile (`legacy:src/pages/HouseholdServicesPage.tsx:131-332`).
- [ ] Header strings: layout subtitle "Household services intelligence" (`:132`); banner badges "Operational dashboard" and "Household support" (`:143-148`); H1 "Household services insights" (`:150-152`); table card title "Household operations audit" (`:241`).
- [ ] Quirk: `DEFAULT_DISTRICT` is imported but never used (`:38`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:373-380`). No role check.
- [ ] Sidebar: **no entry** (Services section lists `/household-services`, not `/services/household-services`, `legacy:src/components/dashboard/AppSidebar.tsx:79`). Mobile bottom nav: none. Mobile "More" menu: none. Global search: none. **No inbound link anywhere in `src`** (grep). Reachable only by typing the URL.
- [ ] In-page role checks: **none**. No `useAuth`, no `useEffectiveDistrict` (`:1-40`).
- [ ] Data scope: local `useState<string>("All")` (`:44`). The district picker offers every district found in the national household register, for **every user**, including district users. **Backend ask** (the endpoint trusts the district path param, AUDIT.md §3.2); the new app must use `platform/scope` (district users locked to their district).

### Endpoints
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2), used **only to discover district names**. Wrapper `getHouseholdsByDistrict("", fyArg)` (`:54`; `legacy:src/lib/api.ts:301-312`) → path `/household/all-households/` + `?from=&to=` when the FY has both dates (`fyQs`, `legacy:src/lib/api.ts:241-245`). `""` means all districts on the backend. Query key `["hh-districts-discovery-services", fyKey]` where `fyKey = fy.mode === "all" ? "all" : \`${fy.fromDate ?? ""}_${fy.toDate ?? ""}\`` (`:47-49`, `:53`); `staleTime: 1000 * 60 * 30` (`:55`); always enabled. IndexedDB list cache key `households_by_district:ALL[:<from>_<to>]`, TTL `LIST_CACHE_TTL_MS` = 60 s, stale-on-error (`legacy:src/lib/api.ts:14,212-238,305-309`). Post-processing: distinct non-empty `h.district`, sorted with default `Array.prototype.sort()` (`:58-66`). Downloads the whole national active register (~260k rows per decision 8) only to build a picker. New app: use the geography from `@/config` / `platform/scope`.
- [ ] `GET /household/household-services-by-district/:district(*)` (AUDIT.md §3.2). Wrapper `getHouseholdServicesByDistrict(selectedDistrict === "All" ? "*" : selectedDistrict)` (`:71`; `legacy:src/lib/api.ts:419-426`) → path `/household/household-services-by-district/<encodeURIComponent(district)>`. No FY sent (the endpoint ignores FY anyway). Query key `["household-services-all", selectedDistrict, fyKey]` (`:70`); `enabled: Boolean(selectedDistrict)` (always true); `staleTime` 30 min when "All", else 5 min (`:73`); `gcTime: 1000 * 60 * 60` (`:74`); `retry: 1` (`:75`). IndexedDB list cache key `household_services_by_district:<district or "*">`, TTL `SERVICES_CACHE_TTL_MS` = 5 min (`legacy:src/lib/api.ts:8,421-424`). Backend: `SELECT hs.*, ah.district FROM household_services hs JOIN all_households ah … ORDER BY ah.district`, district filter skipped only for `""`/`"All"` (`backend:controllers/householdController.js:369-386`).
- [ ] Both query keys start with something other than `"etl"`, so `EtlInvalidator` invalidates them after every new ETL run (`legacy:src/components/EtlInvalidator.tsx:78-80`). New app: `meta: { etl: true }`.

### Fields used
Local `pickValue` (same rule as `p`, returns `"N/A"`; `:102-108`).

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| householdId | `household_id`, `hh_id` (`:301`); search uses `household_id \|\| hh_id` (`:95`); KPI unique count uses `household_id` only (`:112`); row key `` `${index}-${service.household_id}` `` (`:292`) | Column "Household focus" (mono chip, clickable) | raw, `"N/A"` fallback |
| serviceName | `service`, `service_name`, `form_name` (`:308`); search uses `service \|\| form_name` (`:96`) | Column "Service item" | raw. **QUESTION:** these keys are not known on `household_services` (AUDIT.md §3.2), so probably always "N/A" |
| caseworker | `caseworker_name` (`:314`) | Column "Caseworker" (briefcase icon) | raw. **QUESTION:** the endpoint returns `hs.*` + `ah.district` only; whether `household_services` has `caseworker_name` is unknown |
| serviceDate | `service_date`, `visit_date`, `date` (`:318`) | Column "Service date" | raw (ISO timestamp, AUDIT.md §3.2), not formatted |
| outcome | `status`, `state`, `outcome` (`:322`) | Column "Outcome" (outline badge, right-aligned) | raw |
| district | `h.district` from households register (`:62`) | District picker options | raw |

### Filters / sort / pagination / search
- [ ] District select (`:165-177`): placeholder "Select District"; options `All Districts` (value `"All"`) + discovered districts (value = label); default `"All"`; persisted nowhere (state only). Applied to the services fetch (so table, KPIs and strip all follow). Banner shows "District: {selectedDistrict}" (`:160`); table subtitle "Service interactions logged in {selectedDistrict}" (`:242`), which shows the raw value `All`.
- [ ] FY filter (global, `useFyFilter`, `:47`; persisted in URL params `fy`/`from`/`to` and localStorage `ecap_plus_pmp.fy_filter_state_v2`, `legacy:src/context/FyFilterContext.tsx:12,60-80`): affects only the district-discovery list and the services **query key**, not the services data (FY not sent). **QUESTION:** apply FY to service dates client-side in the new app?
- [ ] Search input (`:244-252`): placeholder "Search Household ID or Service..."; matches `household_id || hh_id` or `service || form_name`, both lower-cased, substring `includes` (`:93-100`); no debounce; not persisted; applies to the table only (KPIs and strip use all rows).
- [ ] Sort: none on the client; rows arrive `ORDER BY ah.district` (`backend:controllers/householdController.js:388`).
- [ ] Pagination: **none; only `filteredServices.slice(0, 15)` is rendered** (`:291`), with no indication that more rows exist. New app: `platform/data-table` with pagination.

### Exports
- [ ] None.

### Charts
- [ ] Banner strip (`:190-211`): "Total services: {total}", "Unique households: {uniqueHhs}", "Engagement depth: {engagement} services/HH" (dot colours emerald, emerald, amber). Banner also shows "Tracking {allServices.length} household interactions" (`:156`).
- [ ] KPI cards (`:215-235`), via `GlowCard`: "Total operations" = `total`; "Target entities" = `uniqueHhs`; "Interaction density" = `engagement`. While `servicesQuery.isLoading && !displayStats` each value shows `LoadingDots`.
- [ ] Metric definitions (`:110-125`): `total = allServices.length`; `uniqueHhs = new Set(allServices.map(s => s.household_id)).size`; `engagement = (total / (uniqueHhs || 1)).toFixed(1)` (string). `null` when no rows → values show `0`.
- [ ] `displayStats` = when "All": `dashboardStats || cachedNationwideStats`; otherwise `dashboardStats` (`:128`).

### Links in / out
- [ ] In: none (orphan).
- [ ] Out: "Household focus" cell click → `/profile/household-service-details` with `state: { record: <raw row> }` (`:293-297`). New app: `/services/household/:recordId` (see FOCUS for the id).

### Loading / empty / error
- [ ] Table loading: when `servicesQuery.isLoading || servicesQuery.isFetching`, a single row with centred `LoadingDots` (`:268-275`). This also hides the table during background refetches.
- [ ] Empty: "No operational data found" / "No services have been logged for this district." with a faded `FileText` icon (`:276-289`). Shown both for "no data" and "search matched nothing".
- [ ] Error: **not handled.** A failed query falls through to the empty state. New app: `<ErrorState>` with retry.
- [ ] Refresh indicator: `isRefreshing = servicesQuery.isFetching && (displayStats?.total > 0 || displayStats?.totalServices > 0)` (`:129`) shows "Syncing nationwide records..." with a spinning icon in the strip (`:204-209`), for any district. The "Sync" button icon spins while fetching (`:182`).

### Bugs and quirks
- [ ] **BUG (major):** "All Districts" sends `"*"` (`:71`), but the backend treats only `""`/`"All"` as all (`backend:controllers/householdController.js:379`), so `IN ('*')` returns `[]`. The default view is always empty (AUDIT.md §3.2 "Sentinels"). Intended: nationwide (or the user's scope).
- [ ] **BUG:** the nationwide stats cache never fills, because the write happens only when `selectedDistrict === "All" && result.total > 0` (`:120-122`) and "All" always returns 0 rows. The key name `ecap_cache_nationwide_household_list` is also misleading (it stores service stats `{total, uniqueHhs, engagement}`). It is written from inside `useMemo` (a side effect). Drop it in the new app (React Query persistence covers instant load).
- [ ] **BUG:** "Sync" calls `servicesQuery.refetch()` (`:179`), but the wrapper serves the IndexedDB copy for 5 min (`legacy:src/lib/api.ts:220-222`), so Sync does not reach the network within the TTL.
- [ ] **BUG:** `isRefreshing` reads `displayStats?.totalServices`, which never exists (`:129`). The text says "nationwide" whatever district is selected (`:207`).
- [ ] **BUG:** the unique-household count uses `household_id` only, while the table and search fall back to `hh_id` (`:95`, `:112`, `:301`).
- [ ] **BUG:** only 15 rows are shown, with no pagination or "more" indicator (`:291`).
- [ ] **BUG:** there is no scope enforcement; any user can view any district (`:44`, `:165-177`).
- [ ] **BUG:** the FY appears in the query keys but does not filter the services data (`:70-71`).
- [ ] Quirk: the district picker downloads the entire national household register (`:52-56`).
- [ ] Quirk: hardcoded gradient/colour classes (`:135`, `:180`, `:217-219`); use theme tokens. `animate-in fade-in slide-in-from-bottom-2` on the KPI grid (`:215`).

---

<a id="part-vca-services-dashboard"></a>

## Part: the unreferenced VCA services dashboard

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

### The shared services page draft

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

### The three service profile pages draft

- [ ] **Storage keys (this part):**
  - sessionStorage `ecap_last_vca_service` (`legacy:src/pages/VcaServiceProfile.tsx:56,60`), `ecap_last_household_service_event` (`legacy:src/pages/HouseholdServiceProfile.tsx:55,59`), `ecap_last_caregiver_service_event` (`legacy:src/pages/CaregiverServiceProfile.tsx:70,74`). Each holds a full raw record, including entity PII from `c.*` when it came via `/record-detail`. **Drop**: the new detail pages read ids from route params (CLAUDE.md data rules).
  - localStorage `ecap_cache_nationwide_household_list` (read `legacy:src/pages/HouseholdServicesPage.tsx:81`, written `:121`). **Drop.**
  - IndexedDB (via `legacy:src/lib/api.ts` list cache): `households_by_district:ALL[:<from>_<to>]` (`:305-306`) and `household_services_by_district:<district>` (`:421-422`). React Query persister key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`) also persists the two `HouseholdServicesPage` queries.
- [ ] Timers/polling: none in these four files. App-wide `EtlInvalidator` polls `/etl/last-success` every 30 s (`legacy:src/components/EtlInvalidator.tsx:28,53-60`) and invalidates `HouseholdServicesPage`'s queries after a new ETL run. QueryClient defaults `staleTime` 60 s, `gcTime` 24 h, `refetchOnWindowFocus: true`, `retry: 1` (`legacy:src/App.tsx:112-133`).
- [ ] No modals, forms, mutations, toasts or keyboard shortcuts in these four files.
- [ ] Shared UI to rebuild once in the module: an `InfoItem` label/value tile (duplicated three times: `legacy:src/pages/VcaServiceProfile.tsx:31-47`, `legacy:src/pages/HouseholdServiceProfile.tsx:30-46`, `legacy:src/pages/CaregiverServiceProfile.tsx:45-61`); a "raw fields" grid (key → sentence-case label) that should live in the module's normaliser as an explicit field list rather than dumping `Object.entries`.
- [ ] Brand/program strings: storage-key prefix `ecap_` (`legacy:src/pages/VcaServiceProfile.tsx:56`, `legacy:src/pages/HouseholdServiceProfile.tsx:55`, `legacy:src/pages/CaregiverServiceProfile.tsx:70`, `legacy:src/pages/HouseholdServicesPage.tsx:81`). Domain/pillar terms "Health", "Schooled", "Social Support" (`legacy:src/pages/VcaServiceProfile.tsx:141`); "Health & hiv", "Schooled", "Safe", "Stable" (`legacy:src/pages/CaregiverServiceProfile.tsx:178,192,204,216`); "VCA" labels throughout. Move to config.
- [ ] Proposed generalisation for the new `/services/:type/:recordId`: one detail route with a per-type config (`vca` / `household` / `caregiver`) declaring the id field, header title, overview fields, pillar sections (from config) and the clinical section (caregiver only). Per-type behaviour to keep:
  - VCA: Overview "Primary identifiers" (VCA Identifier, Service Item, Service Date) and "Geographic context" (Province, District, Health Facility).
  - Household: Overview "Service" (Service Item, Status, Service Date), "Entity details" (Household ID, Caseworker, Caseworker ID) and "Location" (District, Province, Facility).
  - Caregiver: pillar cards, the Clinical tab, and the HIV badge.
  - All three: the raw-fields tab.

### The unreferenced vca services dashboard draft

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

### The shared services page draft

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

### The three service profile pages draft

1. **Detail record identity.** `/record-detail` only returns an entity's *latest* service. Is "latest service for this VCA/household" acceptable as the detail page (route `/services/:type/:entityId`), or must a specific visit open (needs `?date=` plus a backend change to `/record-detail`, which decision 7 currently rules out)? See FOCUS options (a)/(b).
2. **New path for the orphan page.** `/services/household-services` collides with `/services/:type` (it would match `type = "household-services"`). Keep the literal path as a static route declared before `/services/:type`, or move it, e.g. `/services/household/insights`, with a legacy redirect?
3. Should the orphan page keep its own endpoint (`/household/household-services-by-district`, unbounded, no FY) or be rebuilt on `/etl/services/household/records` + `/summary` like the main list? Its KPIs (total, unique households, services per household) could come from `/summary`.
4. The "Service item", "Status"/"Outcome" and "Caseworker ID" fields resolve from keys (`service`, `service_name`, `form_name`, `status`, `state`, `outcome`, `caseworker_id`, `staff_id`) that are not known to exist on the service tables. Can someone check a real row (sanitised) so the normaliser maps real columns (likely the pillar `*_services` columns and `case_status`)?
5. Should the detail pages link to the beneficiary profile (`/vcas/:vcaId`, `/households/:householdId`)? Legacy has no such link.
6. Should the raw "Intervention details" / "Full record" / "System audit" tabs survive? They show every string column of `s.*` + `c.*` (including caregiver/VCA PII). If kept, show an explicit allow-list from the normaliser and gate them behind a permission.
7. Caregiver HIV badge: confirm the value set of `is_hiv_positive` (legacy treats contains "yes" or `"1"` as positive and everything else as negative).

### The unreferenced vca services dashboard draft

1. **Route and nav:** legacy never exposed this page. What URL should it get (e.g. `/services/vca/overview` or a tab on `/services/vca`), and does it get a sidebar/mobile/search entry? Which permission gates it?
2. **Reporting window:** keep the separate June–May "reporting year" picker, or use the platform FY scope (Oct–Sep from config)? If June–May is a real program rule, it must move to `program.config.ts`.
3. **KPI card semantics:** should the cards show "VCAs covered" (current number) or "VCAs missing" (what the link opens)? Should the risk register apply the same window so numbers reconcile?
4. **Population for KPIs/table/insights:** should services of VCAs not in the active (FY-cohort) register be counted? Should insights respect district/province scope (assumed yes)?
5. **HIV/VL/MMD fields:** are `is_hiv_positive`, `date_last_vl`, `vl_last_result`, `level_mmd` present on `vca_services` rows, or must they come from the VCA record? (Check `test/fixtures/dqa-vcas.json` / backend.)
6. **Table row click:** link to the service record detail (`/services/vca/:recordId`) or the VCA profile (`/vcas/:vcaId`)?
7. **Export:** should the services table get a CSV/XLSX export via `platform/export` (legacy has none)?
8. **DuplicateDetectionCard:** pass the selected district (backend sentinel for all is `"All Districts"`)? What should "Flag caseworker" do — create a flag via the flags module, or be removed? Should `reviewed_by` be recorded (backend change)?
9. **Duplicate review persistence:** the three `/etl/duplicates/review*` endpoints have no permission check and no district scope (AUDIT.md §3.2). Acceptable for the port, or a Backend ask first?
