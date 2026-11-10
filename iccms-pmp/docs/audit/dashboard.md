# dashboard — legacy audit

> Legacy routes → new routes: `/dashboard` → `/dashboard` (+ unreferenced/side widgets ported per decision 2) · Plan: MIGRATION_PLAN.md §5 row "dashboard" ("Welcome banner, KPI grid, quick links generated from nav; other modules contribute widgets")  · *part `main`*
> This part covers `Dashboard.tsx`, `WelcomeBanner`, `MetricsGrid`, `CanonicalKpiStrip`, `DuplicateDetectionCard`. Other dashboard widgets are covered by other parts; the merger combines them.
> Legacy routes → new routes: `/dashboard` → `/dashboard` (this part covers only the six  · *part `widgets`*
> **unreferenced** widget components, which per decision 2 are to be ported as dashboard widgets) · Plan:
> MIGRATION_PLAN.md §5 row "dashboard" ("Welcome banner, KPI grid, quick links generated from nav; other modules
> contribute widgets") and §2.4 (dead/questionable code) · Decision: PROGRESS.md "Decisions" row 2 ("Port them (incl.
> `VcaServicesDashboard`)").
> This file covers `ServiceInsights` (plus its three exported `compute*Insights` helpers), `RecentActivity`,
> `DataQualityChart`, `ActionQueueBanner`, `CalendarWidget` and `ProvincialBreakdown`. The `/dashboard` page itself
> (`Dashboard.tsx`, `MetricsGrid`, `WelcomeBanner`) is another part's job; it is cited here only as the host route.
> **Porting note on module boundaries:** several of these widgets are domain widgets (flags, services, calendar,
> households). Under the CLAUDE.md layering they belong to the owning module and are *contributed* to the dashboard
> through that module's manifest `widgets` (MIGRATION_PLAN.md §4 manifest `widgets?: DashboardWidget[]`), not built
> inside `modules/dashboard`. Suggested owners are given per component below.
> Merged from the step-3 drafts: `main`, `widgets`. Content is carried over verbatim; only heading levels, the merged header and the shared Legacy files table were consolidated.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/Dashboard.tsx` | 135 | `/dashboard` page: WelcomeBanner + "Programme metrics" (MetricsGrid) + 8 hardcoded "Quick actions" tiles |
| `src/components/dashboard/WelcomeBanner.tsx` | 92 | Greeting banner, role/location badge, Calendar + "Start DQA Review" buttons |
| `src/components/dashboard/MetricsGrid.tsx` | 252 | 3 KPI cards (VCAs, Households, Caseworkers) |
| `src/components/dashboard/CanonicalKpiStrip.tsx` | 161 | "Headline numbers" strip (ever enrolled / active + MoM trend). **Not on Home**: mounted only by `ServicesPage` (`legacy:src/components/dashboard/services/ServicesPage.tsx:759`) |
| `src/components/dashboard/DuplicateDetectionCard.tsx` | 489 | Duplicate service-record review card + side sheet. Mounted only by unrouted `VcaServicesDashboard` (`legacy:src/pages/VcaServicesDashboard.tsx:947`, `type="vca"`, no district/facility) → effectively **unreferenced**; port per decision 2 |
| `src/App.tsx` (relevant parts) | 602 | Route guard (`:252-259`), QueryClient defaults (`:112-134`), IDB persister (`:140-163`) |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Auth + forced password change redirect |
| `src/components/dashboard/AppSidebar.tsx` (relevant parts) | 346 | Nav entry "Home" + visibility filter |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Mobile nav entry "Home" |
| `src/components/dashboard/GlobalSearch.tsx` (relevant parts) | 212 | Nav entry "Dashboard" |
| `src/components/dashboard/DashboardHeader.tsx` (relevant parts) | — | `HIDDEN_ROUTES` hides search + FY filter on `/dashboard` (`:35-43,85,244-257`) |
| `src/components/dashboard/DashboardLayout.tsx` (relevant parts) | — | Mobile sheet menu entry "Home" (`:32-33`) |
| `src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by any file in this part (used only by MotherIndex/HTS/PMTCT/Referrals pages) |
| `src/context/FyFilterContext.tsx` (relevant parts) | — | FY state used by MetricsGrid and CanonicalKpiStrip |
| `src/lib/api.ts` (relevant parts) | — | Wrappers: `getTotalVcasCount` `:253-259`, `getTotalHouseholdsCount` `:261-270`, `getHouseholdsByDistrict` `:301-312`, `getServiceSummary` `:921-947`, `listDuplicateReviews` `:1079-1082`, `upsertDuplicateReview` `:1084-1101`, `deleteDuplicateReview` `:1103-1114`, `getDuplicates` `:1270-1281`, `getCountValue` `:26-114` |
| `src/components/AnimatedCounter.tsx` | 59 | Count-up animation used by MetricsGrid cards |
| `src/components/aceternity/LoadingDots.tsx` | 17 | 3 bouncing dots loader |
| `src/components/dashboard/ServiceInsights.tsx` | 759 | **Unreferenced.** Data-quality insight card grid + records dialog + CSV export, plus exported pure helpers `computeCaregiverInsights`, `computeHouseholdInsights`, `computeVcaInsights` (none imported anywhere) |
| `src/components/dashboard/RecentActivity.tsx` | 306 | **Unreferenced.** "Flagged Records" feed card (Directus flags) |
| `src/components/dashboard/DataQualityChart.tsx` | 323 | **Unreferenced.** "Services & Referrals Trend" stacked area chart + CSV export |
| `src/components/dashboard/ActionQueueBanner.tsx` | 103 | **Unreferenced.** "Action Queue" card (`/etl/action-queue`) |
| `src/components/dashboard/CalendarWidget.tsx` | 91 | **Unreferenced.** "Upcoming Schedule" (today's calendar events) |
| `src/components/dashboard/ProvincialBreakdown.tsx` | 71 | **Unreferenced.** "Geographic Breakdown" top-5 villages/zones |
| `src/App.tsx` | 602 | Route table (host route `/dashboard`, targets `/flags`, `/calendar`), QueryClient defaults, persister (read relevant parts: 112-163, 214-258, 318-339, 382-386, 542-547) |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar nav + visibility rules (read in full) |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Command palette nav entries (read in full) |
| `src/lib/api.ts` | 1486 | Wrappers: `getListValue` 116-183, `dqaGet` 185-210, `getListFromApiWithCache` 212-238, `getHouseholdsByDistrict` 301-312, `*ByMonth` 515-541, `getFlaggedRecords` 604-628, `dqaGetSkipCache` 701-712, `ActionItem`/`getActionQueue` 1034-1068 (relevant parts only) |
| `src/lib/directus.ts` | 869 | `directusRequest` 21-60, `CalendarEvent` type + `getCalendarEvents` 711-732 (relevant parts only) |
| `src/components/aceternity/GlowCard.tsx` | 37 | Decorative card wrapper used by every widget (read in full) |
| `src/lib/utils.ts` | 64 | `toTitleCase` 18-21 (relevant part) |
| `src/pages/Flags.tsx` | 475 | Comparison only: flags geo-scoping 36-62, resolved test 47-50, `["recent-flags"]` invalidation 179 (relevant parts) |
| `src/components/dashboard/services/QualityReviewPanel.tsx` | 350 | Comparison only: the one live `getActionQueue` caller 36-130 (relevant parts) |
| `src/components/EtlInvalidator.tsx` | 90 | Invalidation predicate 70-90 (relevant part) |
| `src/pages/Calendar.tsx` | 886 | Comparison only: `CATEGORIES` 59-80 (relevant part) |
| `src/context/AuthContext.tsx` | 174 | `AuthUser` type 12-24, `/users/me` fields 54 (relevant parts) |

## Contents

- [the dashboard and its shared strips](#part-main)
- [the unreferenced dashboard widgets](#part-widgets)

<a id="part-main"></a>

## Part: the dashboard and its shared strips

## Route `/dashboard` → `/dashboard`

### Purpose
Post-login home. Shows a greeting banner, three programme KPI cards that link to their registers, and eight quick-action tiles to other modules (`legacy:src/pages/Dashboard.tsx:88-132`). Header subtitle is "Home" (`legacy:src/pages/Dashboard.tsx:89`).

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:252-259`). `ProtectedRoute` renders nothing while auth loads (`legacy:src/components/auth/ProtectedRoute.tsx:8-10`), redirects to `/` when no user (`:12-14`), and to `/change-password` when `user.password_change_required` (`:16-18`). Dashboard is eagerly imported, not lazy (`legacy:src/App.tsx:17-20`).
- [ ] Sidebar: "Overview" section → `{ title: "Home", url: "/dashboard" }` (`legacy:src/components/dashboard/AppSidebar.tsx:45-49`). No visibility rule applies to it: the filter (`legacy:src/components/dashboard/AppSidebar.tsx:147-181`) only removes `/districts` for `user.description === "District User"` (`:166`), the "Admin" section for non-admins (`:169`), and the "Data Pipeline" section for non-admin/non-support (`:172`). Active state is exact path match (`:183`).
- [ ] Mobile bottom nav: `{ label: "Home", url: "/dashboard" }` (`legacy:src/components/dashboard/MobileBottomNav.tsx:6`), `NavLink end` exact match (`:26-29`), no role filter. Mobile sheet menu in DashboardLayout also lists "Home" → `/dashboard` (`legacy:src/components/dashboard/DashboardLayout.tsx:33`), unfiltered.
- [ ] Global search nav entry: `{ title: "Dashboard", url: "/dashboard", category: "Navigation" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:34`). Note: GlobalSearch itself is **hidden on `/dashboard`** (see Other behaviour).
- [ ] In-page role checks (all compare raw Directus `description`/`title`/`location` strings — must become `useAccess()`/scope hooks):
  - WelcomeBanner location label: `desc === "District User" && user?.location` → `` `${location} District` ``; `desc === "Provincial User" && user?.title` → `` `${title} Province` ``; else `"All Districts"` (`legacy:src/components/dashboard/WelcomeBanner.tsx:13-18`).
  - WelcomeBanner role label: `"District User"` / `"Provincial User"` / `"Administrator"` passed through, anything else → `"Staff"` (`legacy:src/components/dashboard/WelcomeBanner.tsx:20-26`).
  - MetricsGrid: `isProvincialUser = user?.description === "Provincial User"`, `userProvince = user?.title` (`legacy:src/components/dashboard/MetricsGrid.tsx:124-125`); province filter applied only when `isProvincialUser && userProvince && userProvince !== "All"` (`:153`).
  - No hidden buttons: all 8 quick actions and both banner buttons render for every role (`legacy:src/pages/Dashboard.tsx:105-127`, `legacy:src/components/dashboard/WelcomeBanner.tsx:69-86`).
- [ ] Data scope: MetricsGrid sends `district = user?.location ?? ""` straight from the Directus profile (`legacy:src/components/dashboard/MetricsGrid.tsx:123`). It does **not** use `useEffectiveDistrict` and has no district selector. Queries are `enabled: !!district` (`:134,140,147`), so a user with empty `location` gets no requests. `"All"` (typical admin location) is passed as the path segment and the backend treats `All` as no filter (AUDIT.md §3.2). Province is never sent to the API; the province restriction is client-side only and only for the caseworker card (`:150-157`). For reference, `useEffectiveDistrict` (unused here) derives admin from `description` containing "admin"/"administrator" or equal to `"ecap+ support"` (`legacy:src/hooks/useEffectiveDistrict.ts:7-8`), province user from "provincial"/"province" (`:9`), district fallback `user.location` → `user.district` → `VITE_DEFAULT_DISTRICT` (`:12`), and `availableDistricts` lists (`:13-16`).
- [ ] FY scope: MetricsGrid reads the global FY filter (`useFyFilter().resolved`) and sends `from`/`to` only when both dates exist (`legacy:src/components/dashboard/MetricsGrid.tsx:127-129`). Default FY state is `{ mode: "all" }` (`legacy:src/context/FyFilterContext.tsx:22-24`); state comes from URL `fy`/`from`/`to` params > localStorage `ecap_plus_pmp.fy_filter_state_v2` > default (`legacy:src/context/FyFilterContext.tsx:12,50-56`). The FY chip is **hidden on `/dashboard`** (see Bugs).

### Endpoints
- [ ] `GET /child/vcas-count/:district(*)` (AUDIT.md §3.2) — wrapper `getTotalVcasCount(district, fyArg)` (`legacy:src/lib/api.ts:253-259`); path `/child/vcas-count/<encodeURIComponent(district)>` + `?from=&to=` when FY window set (`legacy:src/lib/api.ts:241-245,254-256`). Fires when `!!district` (`legacy:src/components/dashboard/MetricsGrid.tsx:134`). Key `["metrics","total-vcas",district,fyKey]` where `fyKey = "all"` when `fy.mode === "all"` else `` `${fromDate ?? ""}_${toDate ?? ""}` `` (`:129,131-133`). No per-query overrides → app defaults staleTime 60 s, gcTime 24 h, refetch on mount/focus/reconnect, retry 1 (`legacy:src/App.tsx:126-131`), persisted to IndexedDB for 24 h (`legacy:src/App.tsx:140-148,214-224`). Response `{status,count:"<string>"}` parsed by `getCountValue` (accepts number/string, `count`, nested `count.count`, `total`, `totalCount`, `total_count`, `totalVcaCount`, `total_vca_count`, `data` (number/string/array length/nested object)) (`legacy:src/lib/api.ts:26-114`). Backend counts `COUNT(DISTINCT uid)` over all children incl. archived (AUDIT.md §3.2).
- [ ] `GET /household/households-count/:district(*)` (AUDIT.md §3.2) — wrapper `getTotalHouseholdsCount(district, fyArg)` (`legacy:src/lib/api.ts:261-270`), same path/FY rules. Fires when `!!district` (`legacy:src/components/dashboard/MetricsGrid.tsx:140`). Key `["metrics","total-households",district,fyKey]` (`:138`). App defaults. Counts distinct households incl. closed (AUDIT.md §3.2).
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) — wrapper `getHouseholdsByDistrict(district)` called **without FY** (`legacy:src/components/dashboard/MetricsGrid.tsx:146`). Fires when `!!district` (`:147`). Key `["metrics","households-list",district]` (no FY, `:145`). Wrapper adds an IndexedDB aux cache `households_by_district:<district>` with 60 s TTL and stale-on-error fallback (`legacy:src/lib/api.ts:212-238,301-312`). Post-processing: for provincial users rows are filtered to `h.province === user.title` (`legacy:src/components/dashboard/MetricsGrid.tsx:151-157`); then distinct non-empty `h.caseworker_name || h.cwac_member_name` → caseworker count (`:170-178`). Downloads the full active register (national for `All`) only to count caseworker names.

### Fields used
| Field (normalised name the page uses) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| vcaCount | `getCountValue`: `count` (number/string/`count.count`), `total`, `totalCount`, `total_count`, `totalVcaCount`, `total_vca_count`, `data` (`legacy:src/lib/api.ts:26-114`) | VCAs card value | `Intl.NumberFormat("en-GB")`; `null/undefined` → `"N/A"` (`legacy:src/components/dashboard/MetricsGrid.tsx:180-185`); then AnimatedCounter |
| householdCount | same as above | Households card value | same |
| household.caseworker | `caseworker_name`, `cwac_member_name` (`legacy:src/components/dashboard/MetricsGrid.tsx:174`) | distinct count → Caseworkers card | same |
| household.province | `province` (`:154`) | provincial-user client filter | — |
| household.id (dead) | `household_id`, `householdId`, `hh_id`, `id` (`:164`) | `distinctHouseholdsCount` — computed but never rendered | — |
| user.first_name | Directus `/users/me` `first_name` | Banner greeting, fallback `"there"` (`legacy:src/components/dashboard/WelcomeBanner.tsx:9`) | — |
| user.description / title / location | Directus `/users/me` | Banner role + location labels, MetricsGrid scope | — |

### Filters / sort / pagination / search
- [ ] No page-level filters. District comes from the profile; FY comes from the global FY state, whose chip is hidden on this route (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,252-257`).
- [ ] Global search box hidden on this route (`legacy:src/components/dashboard/DashboardHeader.tsx:245-249`).
- [ ] No sort/pagination.

### Exports
- [ ] None on `/dashboard`.

### Charts
- [ ] **KPI "VCAs"** — value = `getTotalVcasCount(user.location, FY)`; subtitle `"All registered children"`; icon Users; card links to `/vcas` (`legacy:src/components/dashboard/MetricsGrid.tsx:193-206`). Loading flag `totalVcasQuery.isLoading`.
- [ ] **KPI "Households"** — value = `getTotalHouseholdsCount(user.location, FY)` (server `COUNT(DISTINCT household_id)`); subtitle `"Distinct households tracked"`; icon Home; links to `/households` (`legacy:src/components/dashboard/MetricsGrid.tsx:207-224`).
- [ ] **KPI "Caseworkers"** — value = number of distinct non-empty `caseworker_name || cwac_member_name` in the active household register for `user.location` (province-filtered for provincial users), **not FY-scoped**; subtitle `district === "All" || !district ? "All active Caseworkers" : `Active in ${district}`` (`legacy:src/components/dashboard/MetricsGrid.tsx:225-238`, `:228`); links to `/caseworker-journeys`; loading flag `householdsDataQuery.isLoading` (`:231`).
- [ ] Card anatomy (`MetricCard`, `legacy:src/components/dashboard/MetricsGrid.tsx:45-119`): icon tile (`bg-emerald-50`/`text-emerald-600` for all three), uppercase-style title, value (LoadingDots while loading, else AnimatedCounter), subtitle, optional trend badge (never passed), ArrowRight affordance when `to` set; whole card is a `<button>` with `aria-label` `` `${title} — ${subtitle}. Open ${title} register.` `` (`:107-118`). `variant` and `trend` props are unused by callers.
- [ ] Grid: 1 col / `sm` 2 cols / `lg` 3 cols (`legacy:src/components/dashboard/MetricsGrid.tsx:243`). Section heading "Programme metrics" (`legacy:src/pages/Dashboard.tsx:94`).
- [ ] AnimatedCounter: strips commas, `parseInt`; non-numeric (e.g. `"N/A"`) shown as-is; otherwise eases (cubic, 1200 ms) from previous value, rendering with `Intl.NumberFormat("en-GB")` (`legacy:src/components/AnimatedCounter.tsx:9-54`). Decorative; keep only if it aids understanding (CLAUDE.md UI rules) — it's a candidate to drop.
- [ ] Colours: hardcoded Tailwind palette classes (emerald/violet/rose/etc.); new build must use theme tokens.

### Links in / out
- [ ] In: `LoginCard` after login → `/dashboard` (or `/change-password` if required) and writes sessionStorage `ecap.first_login` (`"true"`/`"false"`) + localStorage `ecap.known_users`, `ecap.returning_user` before navigating (`legacy:src/components/LoginCard.tsx:37-42`). `ChangePassword` → `/dashboard` with `replace` (`legacy:src/pages/ChangePassword.tsx:38,64`). Sidebar / mobile nav / mobile menu / GlobalSearch entries (above). No query params or `location.state` payloads.
- [ ] Out (Quick actions, `legacy:src/pages/Dashboard.tsx:18-83`, `navigate(a.to)` at `:110`), in order, exact labels/descriptions:
  1. "VCA services" — "Service activity, pillar coverage, and audit log." → `/vca-services` (new `/services/vca`)
  2. "Caregiver services" — "HIV monitoring, services, and graduation tracking." → `/caregiver-services` (new `/services/caregiver`)
  3. "Household services" — "Service activity at the household level." → `/household-services` (new `/services/household`)
  4. "Help & support" — "Support center — guides, tickets, and assistance." → `/support`
  5. "Caseworker journeys" — "GPS visit map, heatmap, and playback by caseworker." → `/caseworker-journeys` (new `/caseworkers/journeys`)
  6. "Data pipeline" — "Pipeline runs, downloads, and tablet sync status." → `/data-pipeline`
  7. "Performance" — "Facility, caseworker, and service-type benchmarks." → `/performance`
  8. "DQA review" — "Flagged records and data-quality remediation queue." → `/flags`
  Heading "Quick actions", hint "Jump to any module" (`:101-102`); grid 1/2/4 cols (`:104`). Plan says new quick links are generated from nav (MIGRATION_PLAN §5), so they should respect nav permissions.
- [ ] Out (KPI cards): `/vcas`, `/households`, `/caseworker-journeys` (`legacy:src/components/dashboard/MetricsGrid.tsx:200,218,232`).
- [ ] Out (WelcomeBanner): "Calendar" → `/calendar` (`legacy:src/components/dashboard/WelcomeBanner.tsx:70-76`); "Start DQA Review" → `/flags` (`:78-85`). No payloads.

### Loading / empty / error
- [ ] Loading: each KPI card shows LoadingDots in place of the value while its query `isLoading` (`legacy:src/components/dashboard/MetricsGrid.tsx:85`). ProtectedRoute renders `null` while auth loads.
- [ ] Empty/disabled: when `user.location` is empty the queries are disabled; in React Query v5 `isLoading` is false for a disabled query, so cards show `"N/A"` permanently (`:134,140,147,180-185`).
- [ ] Error: no error UI; a failed query leaves `data` undefined → `"N/A"`. No retry button, no toast. Each card fails independently (partial failure = some cards "N/A"). React Query retries once (`legacy:src/App.tsx:131`). Households list has stale IDB fallback on error (`legacy:src/lib/api.ts:229-236`).
- [ ] No error boundary per widget in legacy; new shell wraps each widget (CLAUDE.md).

### Bugs and quirks
- [ ] **BUG** FY chip hidden but FY applied: `/dashboard` is in `HIDDEN_ROUTES`, so the FY filter is not rendered (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,252-257`), yet VCAs/Households cards are FY-scoped from URL/localStorage state (`legacy:src/components/dashboard/MetricsGrid.tsx:127-141`). A user who picked an FY elsewhere sees FY-scoped Home numbers with no visible indicator or way to change it. Port: show the scope/FY chip on the dashboard (scope is always part of the query key).
- [ ] **BUG** Mixed scopes across cards: VCAs and Households are FY-scoped; Caseworkers is not (`legacy:src/components/dashboard/MetricsGrid.tsx:144-148`). Provincial users: Caseworkers is province-filtered client-side (`:151-157`) but VCAs/Households are not (they use `user.location` only, `:123,133,139`). Port: all three use the same scope + FY.
- [ ] **BUG** Scope from raw `user.location` (not `useEffectiveDistrict`/scope service), so users with empty location get no data ("N/A") instead of a fallback (`legacy:src/components/dashboard/MetricsGrid.tsx:123`; compare `legacy:src/hooks/useEffectiveDistrict.ts:12`).
- [ ] **BUG** Caseworker count is computed by downloading the entire active household register (national for "All") and deduping caseworker **names** (case/whitespace-sensitive, `cwac_member_name` fallback) (`legacy:src/components/dashboard/MetricsGrid.tsx:144-148,170-178`). Backend has `GET /child/caseworker/count/:district(*)` wrapped by `getCaseworkerCountByDistrict` (`legacy:src/lib/api.ts:280-285`) but MetricsGrid does not use it. **QUESTION** which definition is canonical.
- [ ] **QUESTION** KPI definitions vs registers: VCAs count includes archived children and Households count includes closed households (AUDIT.md §3.2), but the cards link to the active registers, so the numbers will not match the register row counts. Subtitle "All registered children" vs "Distinct households tracked".
- [ ] Dead code: `distinctHouseholdsCount` (`legacy:src/components/dashboard/MetricsGrid.tsx:160-168`) and `getListCount` (`:187-190`) are never rendered; `trend`/`variant` props unused.
- [ ] **BUG** Quick actions are not permission-aware: "Data pipeline" is shown to every role (`legacy:src/pages/Dashboard.tsx:59-66`). (Related shell bug: the sidebar check `section.label === "Data Pipeline"` (`legacy:src/components/dashboard/AppSidebar.tsx:172`) never matches the section label `"Data pipeline"` (`:98`), so the sidebar also shows Data Pipeline to everyone — record in shell audit.)
- [ ] **QUESTION** "Live data" badge in WelcomeBanner is static text, not tied to ETL freshness (`legacy:src/components/dashboard/WelcomeBanner.tsx:50-52`). Port: drive from `platform/freshness` or drop.
- [ ] Role/location labels use string compares on `description`/`title`/`location` (`legacy:src/components/dashboard/WelcomeBanner.tsx:13-26`); a "Support User" shows as "Staff".

---

## Component `WelcomeBanner` (on `/dashboard`)
- [ ] Greeting by local hour: `< 12` "Good morning", `< 18` "Good afternoon", else "Good evening" (`legacy:src/components/dashboard/WelcomeBanner.tsx:28-33`).
- [ ] Date line: `toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })` (`:35`) → format from config via `core/lib/format.ts`.
- [ ] Headline: `isFirstLogin ? "Welcome, <first>" : "Welcome back, <first>"`, first name fallback `"there"` (`:9,57`). `isFirstLogin` = sessionStorage `ecap.first_login === "true"` (`:11`), written by LoginCard from a localStorage list of known emails (`legacy:src/components/LoginCard.tsx:36-40`).
- [ ] Location badge (Sparkles icon) with the location label (`:59-61`); role line: "**<role>** portal — monitor screening coverage, validate data quality, and coordinate fieldwork." (`:64-66`) — program copy, move to config.
- [ ] Buttons: "Calendar" (`:70-76`), "Start DQA Review" with pulsing dot (`:78-85`).
- [ ] Decorative pulse blobs/gradients (`:38-42`) — decorative animation; drop or keep minimal per UI rules.

---

## Component `CanonicalKpiStrip` (mounted by ServicesPage, not Home)

### Purpose
"Headline numbers" strip for a service type: ever-enrolled and active counts plus a month-over-month services trend badge (`legacy:src/components/dashboard/CanonicalKpiStrip.tsx:22-65,99-158`). Props `type: "vca"|"caregiver"|"household"`, optional `district`, `facility` (`:12-16`). Only caller: `<CanonicalKpiStrip type={type} district={districtParam} />` (`legacy:src/components/dashboard/services/ServicesPage.tsx:759`), where `districtParam` is the page's selected district or `undefined` for "All" (`legacy:src/components/dashboard/services/ServicesPage.tsx:287-288`). Port into the `services` module (or as a widget contributed by it).

### Access
- [ ] No role checks inside the component. Scope = `district`/`facility` props + global FY.

### Endpoints
- [ ] `GET /etl/services/:type/summary` (AUDIT.md §3.2) — wrapper `getServiceSummary({ type, district, facility, fy })` (`legacy:src/lib/api.ts:921-947`). Query params: `district` unless `"all"`/`"All"`, `facility` unless `"all"`, `ward` (not passed here), `from`/`to` when both set (`legacy:src/lib/api.ts:928-937`). Uses `dqaGetSkipCache` (no aux IDB cache) (`legacy:src/lib/api.ts:701-712,938`). Key `["service-summary", type, district, facility, fyKey]`, `staleTime: 5 min` (`legacy:src/components/dashboard/CanonicalKpiStrip.tsx:88-92`). Always enabled. Normalised to `{ type, source, generated_at, data }` with defaults `""`/`{}` (`legacy:src/lib/api.ts:941-946`). Note ServicesPage also queries the same endpoint with a 6-element key `["service-summary", type, districtParam, undefined, undefined, fyKey]` and no FY (`legacy:src/components/dashboard/services/ServicesPage.tsx:295-305`) → two cache entries / two requests; the new build should share one `queryOptions`.

### Fields used
| Field | Raw keys | Where shown | Formatting |
| --- | --- | --- | --- |
| enrolled | `data.enrolled` | stat 1 | `Number(d[key] ?? 0).toLocaleString()` (`legacy:src/components/dashboard/CanonicalKpiStrip.tsx:149`) |
| active | `data.active` | stat 2 | same |
| momTrendPct | `data.mom_trend_pct` (`:97`) | TrendBadge | `+N% vs last month` / `N%`; >0 up/emerald, <0 down/rose, 0 Minus/slate (`:67-82`) |
| generatedAt | `generated_at` | header right, `toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})` (`:119-123`) | locale default |

### Charts
- [ ] Stat labels and tooltips per type (exact) (`legacy:src/components/dashboard/CanonicalKpiStrip.tsx:22-65`):
  - vca: "VCAs ever enrolled", "Active VCAs"
  - caregiver: "Caregivers ever enrolled", "Active caregivers"
  - household: "Households ever enrolled", "Active households"
  Tooltips explain enrolled = all-time incl. exited/graduated/transferred, active = `case_status = 'Active'`, and claim the Home card shows the same number (see QUESTION).
- [ ] Header: Database icon + "Headline numbers" + "Live database" badge with tooltip "Numbers pulled live from the same database that powers the Home page and Superset dashboards. Refreshed every time you open this page." (`:104-116`); TrendBadge only when `!isLoading && data?.data` (`:117`); TrendBadge tooltip "Month-over-month change: how this month's services compare to last calendar month so far." (`:77-79`).
- [ ] Layout: 1 col / `sm` 2 cols (`:130`).

### Loading / empty / error
- [ ] Loading: LoadingDots centred (`:127-128`).
- [ ] Error: component returns `null` (silently disappears) (`:94`). Port: `<ErrorState>` with retry.
- [ ] Missing keys render `0` (`:149`).

### Bugs and quirks
- [ ] **QUESTION** Tooltips reference Home cards that don't exist or differ: "The Home page Caregivers card" (`:42`) — Home has no Caregivers card; Home cards are scoped by `user.location`, not the page's district selector, so "should match" (`:28`) is not guaranteed.
- [ ] **BUG** "Refreshed every time you open this page" (`:114`) is false: `staleTime` 5 min (`:91`) plus a 5-minute backend cache (AUDIT.md §3.2).
- [ ] **BUG** (backend, AUDIT.md §3.2) `mom_trend_pct` / service counts are probably always 0 for vca/household; trend badge would always show "0% vs last month". Record in Backend asks.
- [ ] Copy mentions "Superset" (`:114`) — brand/product string; move to config or reword.

---

## Component `DuplicateDetectionCard` (unrouted; port per decision 2)

### Purpose
Lists duplicate service-record groups (same entity id + service date + services string, count > 1), grouped by month then service date, with a per-day drill-down sheet where reviewers mark groups reviewed and can export CSV (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:79-487`). Props `type: "vca"|"caregiver"|"household"`, optional `district`, `facility` (`:13-17`). Only mount: `<DuplicateDetectionCard type="vca" />` in the unrouted `VcaServicesDashboard` (`legacy:src/pages/VcaServicesDashboard.tsx:947`).

### Access
- [ ] No role checks; any authenticated user can mark/unmark reviews (backend also has no authz, AUDIT.md §3.2). **Backend ask:** scope reviews by district and set `reviewed_by` from the token.
- [ ] Data scope: whatever `district`/`facility` props the parent passes; legacy parent passes none → national.

### Endpoints
- [ ] `GET /etl/duplicates` (AUDIT.md §3.2) — wrapper `getDuplicates({ type, district, facility })` (`legacy:src/lib/api.ts:1270-1281`): `?type=<type>` + `district` if truthy + `facility` if truthy; returns `data.data` (`:1280`). Key `["duplicates", type, district, facility]`, `staleTime: 5 min` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:83-87`). Backend "all" sentinel is `"All Districts"`; the new scope service must send no district (or that sentinel) for all.
- [ ] `GET /etl/duplicates/reviews` (AUDIT.md §3.2) — `listDuplicateReviews()` → `data.data ?? []` (`legacy:src/lib/api.ts:1079-1082`). Key `["duplicate-reviews"]`, `staleTime: 60 s` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:89-93`). Post-processing: keep reviews where `!r.service_type || r.service_type === type`, collect `run_key`s into local `reviewed` Set (`:94-101`).
- [ ] `POST /etl/duplicates/review` (AUDIT.md §3.2) — `upsertDuplicateReview({ run_key, service_type: type })` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:181`; raw fetch `legacy:src/lib/api.ts:1084-1101`).
- [ ] `DELETE /etl/duplicates/review/:run_key` (AUDIT.md §3.2) — `deleteDuplicateReview(key)` with `encodeURIComponent` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:178`; `legacy:src/lib/api.ts:1103-1114`).
- [ ] `run_key` format: `` `${entity_id}|${service_date}|${services}` `` using the **raw** `service_date` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:123,159-160,410`). Must stay byte-identical so existing review rows still match.

### Fields used
| Field | Raw keys | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| entityId | `groups[].entity_id` | sheet card id, export, run_key | mono |
| serviceDate | `groups[].service_date` | grouping key, sheet "Why flagged" | `normalizeDate`: ISO prefix → `YYYY-MM-DD`; `DD-MM-YYYY` or `DD/MM/YYYY` → ISO; else raw (`:21-30`). Display `formatDate`: `en-US` `{year:"numeric", month:"short", day:"2-digit"}`, empty → "Unknown" (`:32-40`) |
| services | `groups[].services` | sheet "Services" box (`"(empty)"` fallback), export (commas → `;`) | mono |
| duplicateCount | `groups[].duplicate_count` (string from backend) | `N× logged`, severity, redundant = count − 1 | `Number()` |
| caseworker | `groups[].caseworker_name` | top caseworker, sheet ("Unknown caseworker"), export | — |
| facility | `groups[].facility` | sheet, export, location fallback | "-" |
| ward | `groups[].ward` | location for top caseworker: `ward || facility || "-"` (`:50`) | — |
| district / province | `groups[].district`, `groups[].province` | sheet `province / district` (`:441`), export (district only) | — |
| entityLabel | `entity_label` (fallback `"Entity"`, `:105`) | column header, copy | lowercased in copy |
| summary | `summary.total_groups`, `summary.total_redundant_records` | header badge `"<n> groups • <m> redundant records"` (`:266`) | `|| 0` |

### Filters / sort / pagination / search
- [ ] No filters/search/pagination in the card. Grouping: by normalised date (`"Unknown"` if empty), dates DESC (`:107-135`); by month `YYYY-MM` DESC (`:138-152`). Month header row: formatted `en-US` "Month YYYY" (`:71-77`), badges "<n> group(s)", "<n> redundant", "<n> reviewed" (only if >0) (`:301-319`).
- [ ] Per-date summary: totalGroups, redundantRecords = Σ(count−1), top (caseworker, location) pair by summed duplicate_count, reviewedCount (`:114-133`).
- [ ] Sheet sort: unreviewed first, then `duplicate_count` DESC (`:154-166`).

### Exports
- [ ] CSV via Blob + `<a download>`; trigger "Export CSV" button (`:279-281`); filename `` `duplicates-${type}-${YYYY-MM-DD}.csv` `` (today, UTC ISO date) (`:212`); rows = **all** groups returned (not just a date) (`:204`); no-op if empty (`:202`). Headers in order: `` `${entityLabel} ID` ``, "Service Date", "Services", "Duplicate Count", "Caseworker", "Facility", "District", "Severity" (`:203`); sources: `entity_id`, raw `service_date`, `services` with `,`→`;`, `duplicate_count`, `caseworker_name`, `facility`, `district`, `SEVERITY(count).label` (`:204-207`). Every cell double-quoted with `"` escaped as `""` (`:208`). No library. Port via `platform/export`.

### Charts
- [ ] Severity scale (`:42-47`): `>= 10` "Critical" (red), `>= 5` "High" (orange), `>= 3` "Medium" (amber), else "Low" (yellow).
- [ ] Review progress bar per date: `pct = round(reviewed/total*100)`, emerald when all reviewed else blue, label `reviewed/total` (`:321-322,354-365`). Fully reviewed rows tinted emerald (`:328`).
- [ ] Table headers (exact): "Service Date", "Duplicate Groups" (title "Distinct combinations of entity + date + services that appear more than once"), "Redundant Records" (title "Extra records beyond the first one in each group (count − 1)"), "Top Caseworker", "Review Progress", blank (`:290-295`). Top caseworker cell shows name, MapPin + location, "<n> record(s)" (`:346-353`). Row click and "View" button open the sheet (`:330,367-371`).

### Other behaviour (modals, mutations, toasts)
- [ ] Explanatory copy (exact): "Grouped by service date. Pick a day to see which {entity}s were logged in duplicate on that day." (`:270`) and the "Why these are flagged:" info box (`:272-277`).
- [ ] Right-side Sheet (`sm:max-w-2xl`) titled with formatted date; badges "<n> duplicate group(s)", "<n> redundant record(s)", "<n> reviewed" (`:383-406`). Each group card: entity id (struck through when reviewed), "<n>× logged", Reviewed or severity badge, caseworker / facility / province-district lines, "Services" box, "Why flagged:" text with `count − 1` "is/are redundant and should be removed after verifying with the caseworker." (`:409-455`).
- [ ] Actions per group: "Flag caseworker" (only when not reviewed) (`:458-463`); "Mark reviewed" / "Unmark" (`:464-474`).
- [ ] Mark/unmark is optimistic: toggle local Set, call API, toast "Marked as reviewed" / "Unmarked — record restored to review queue"; on error roll back and toast "Failed to save review — try again" (`:168-193`). Reviews query is not invalidated after mutation (local Set only).
- [ ] "Flag caseworker" only shows a toast `` `Flagged: ${caseworker || "Unknown"} - ${entityLabel} ${entity_id}` `` with description "Caseworker will be notified for correction." — **no API call** (`:195-199`).

### Loading / empty / error
- [ ] Loading: spinner + "Analyzing duplicates..." (`:216-225`) (reviews query loading is not awaited).
- [ ] Error or no data: AlertTriangle + "Failed to load duplicate detection data", no retry (`:227-236`). Reviews query error ignored (no marks shown).
- [ ] Empty: title "Duplicate Detection", CheckCircle + "No duplicates found" / "Data integrity is clean for the selected filters." (`:238-254`).

### Bugs and quirks
- [ ] **BUG** "Flag caseworker" claims the caseworker will be notified but does nothing (`:195-199`). **QUESTION** wire to the flags module (create a flag) or drop the button?
- [ ] **BUG** Fragment inside `monthGroups.map` has no key (`<>` at `:300`; key is on the inner `<tr>` at `:301`) → React key warning / reconciliation issues.
- [ ] **BUG** `URL.createObjectURL` never revoked (`:211`).
- [ ] **QUESTION** `service_date` for vca/household arrives as an ISO timestamp shifted by server TZ (AUDIT.md §3.2); `normalizeDate` takes `slice(0,10)` of the UTC string (`:24`), which can show the previous day.
- [ ] Backend caps groups at 500 in entity-id order and computes `summary` from that truncated set (AUDIT.md §3.2) — header badge totals may understate.
- [ ] A review with null `service_type` applies to every type (`:97`).
- [ ] `LOCATION_LABEL = "Ward"` is declared but unused (`:49`); geography term — config if used.

---

<a id="part-widgets"></a>

## Part: the unreferenced dashboard widgets

## Host route `/dashboard` → `/dashboard` (access context shared by all six widgets)

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:252-258`). `ProtectedRoute` renders
  nothing while auth loads (`legacy:src/components/auth/ProtectedRoute.tsx:8-10`), redirects to `/` when there is no
  user (`:12-14`), and to `/change-password` when `user.password_change_required` (`:16-18`).
- [ ] Sidebar: "Home" → `/dashboard` in section "Overview" (`legacy:src/components/dashboard/AppSidebar.tsx:49`). The
  filter (`:147-181`) has no rule for `/dashboard`; the only rules are `item.url === "/districts" && isDistrictUser`
  (`:166`), `section.label === "Admin" && !isAdmin` (`:169`) and `section.label === "Data Pipeline" && !isAdmin && !isSupport`
  (`:172`). So Home is visible to every signed-in user.
- [ ] Mobile nav: "Home" → `/dashboard` (`legacy:src/components/dashboard/MobileBottomNav.tsx:6`), no condition.
- [ ] Global search: "Dashboard" → `/dashboard`, category "Navigation" (`legacy:src/components/dashboard/GlobalSearch.tsx:34`), no condition.
- [ ] Widget-level checks: **none** of the six widgets contains any role/permission check (no `isAdmin`,
  `description`, `title` comparison). Each one that needs a district reads `user?.location` directly; none uses
  `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts:5-17`). The port must use `platform/scope` instead
  (see each component's "Data scope" item).

---

## Component `ServiceInsights` (unrouted)

Suggested owner: `services` module (the insight helpers are service-domain logic: domains, VL, graduation). The
generic card/dialog shell could live in `platform` only if it is stripped of domain wording.

### Purpose
A "Data quality & insights" card that shows a grid of insight tiles (count / total / percent, severity-coloured), sorted
critical → warning → info → success, with header badges summarising critical and warning tiles. Clicking a tile with
records opens a dialog that lists the offending records (first 8 columns, max 200 rows, free-text search) and exports
them to CSV. The file also exports three pure functions that compute the insight lists from raw service rows for VCA,
caregiver and household services. Component props: `insights: InsightItem[]`, `title?: string` (default
`"Data quality & insights"`), `isLoading?: boolean` (`legacy:src/components/dashboard/ServiceInsights.tsx:55-59,249`).

`InsightItem` shape (`:44-53`): `id: string`, `label: string`, `description: string`, `count: number`, `total: number`,
`severity: "critical" | "warning" | "info" | "success"`, `icon: React.ElementType`, `records: any[]`.

### Access
- [ ] Route guard: n/a (unrouted). When ported, inherits the host route rules above.
- [ ] Sidebar / mobile / search: n/a.
- [ ] In-page role checks: none.
- [ ] Data scope: none inside the component; it is pure presentation over `insights` passed by a caller. The
  `compute*` helpers take already-filtered arrays (`filteredServices`, `filteredHouseholds`). No caller exists, so
  the legacy app never decided which district/FY feeds it. **Port:** the host must pass rows scoped by
  `platform/scope` (district + FY) and the query key must include scope.

### Endpoints
- [ ] None. The component and helpers make no HTTP calls. No caller exists, so there is no legacy data source.
  Candidate sources whose rows carry the fields the helpers read (see "Fields used"): `GET /child/vca-services-by-district/:district(*)`,
  `GET /household/caregiver-services-by-district/:district(*)`, `GET /household/household-services-by-district/:district(*)`
  (AUDIT.md §3.2). All are unbounded and ignore FY. The server-side alternative `GET /etl/dqa-checks` +
  `GET /etl/dqa-records` (AUDIT.md §3.2, "18 data-quality check counts", no legacy caller) overlaps in purpose. See Open questions.

### Fields used

Inputs to `computeVcaInsights(services, filteredServices)` (`:642-759`), `computeCaregiverInsights(services, filteredServices, allHouseholds, filteredHouseholds)` (`:423-539`), `computeHouseholdInsights(...)` same signature (`:544-637`). In all three, **`services` and `allHouseholds` are unused**; `filteredHouseholds` is used only as `totalHH` fallback (`:437,537`; `:556,635`).

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| entityId (household) | `household_id` | group key for caregiver/household helpers (`:442,561`), dup key (`:473,582`), inactive map (`:517,618`); `String(s.household_id \|\| "")` | — |
| entityId (VCA) | `vcaid`, `vca_id` | group key (`:658`), dup key (`:689`), inactive map (`:736`) | — |
| serviceDate | `service_date` | `parseDate` = `new Date(val)`, null if invalid (`:383-387`); latest date (`:392-399`), future-dated (`:485-488`), inactive (`:518`), dup key (raw string) | — |
| healthServices | `health_services`, `other_health_services` | domain "Health" coverage (`:460`), dup key uses `health_services` only (`:473`) | — |
| schooledServices | `schooled_services`, `other_schooled_services` | domain "Schooled" (`:461`) | — |
| safeServices | `safe_services`, `other_safe_services` | domain "Safe" (`:462`) | — |
| stableServices | `stable_services`, `other_stable_services` | domain "Stable" (`:463`) | — |
| hivServices | `hiv_services`, `other_hiv_services` | only in "any service" test (`:405-410`) | — |
| hhLevelServices | `hh_level_services`, `other_hh_level_services` | only in "any service" test (`:408`) | — |
| isHivPositive | `is_hiv_positive` | `=== "1" \|\| === true` (`:448,664`) | — |
| lastVlDate | `date_last_vl` | missing → hiv-no-vl (`:449`); `< ref − 6 months` → stale-vl (`:452-455`) | — |
| lastVlResult | `vl_last_result` | missing → hiv-no-vl (`:449`); suppression test (`:507-512`) | — |
| district | `district` | missing → no-district (`:482,591,698`) | — |
| mmdLevel | `level_mmd` | provided → mmd-coverage (VCA only, `:731`) | — |

"Empty" means `isFieldEmpty`: falsy, or trimmed lower-case value in
`["not applicable", "n/a", "na", "none", "no", "false", "0", "[]", "{}", "null", ""]` (`:373-379`). "Provided" is the
negation (`:381`). "Domain covered" = any record in the group has the main **or** `other_*` field provided (`:416-418`).
"Any service" = any of the 12 fields `health_services, hiv_services, schooled_services, safe_services, stable_services,
other_health_services, other_hiv_services, other_schooled_services, other_safe_services, other_stable_services,
hh_level_services, other_hh_level_services` provided (`:404-411`).

Reference dates: `refDate = getLatestServiceDate(filteredServices)` which starts at **today** and moves forward only if
a later `service_date` exists (`:392-399`); `sixMonthsBefore = refDate − 6 months`, `threeMonthsBefore = refDate − 3 months`
(`:431-434`, `:552-553`, `:648-651`); `now = new Date()` for future-dated (`:429,550,646`).

### Insight definitions (each is a port item)

Caregiver (`computeCaregiverInsights`, return order `:527-538`); household (`computeHouseholdInsights`, `:628-636`);
VCA (`computeVcaInsights`, `:746-758`). "Group" = household for caregiver/household, VCA for VCA. `total` = number of
filtered service rows unless stated.

- [ ] `hiv-no-vl` — label "HIV+ missing viral load"; description caregiver "Clients positive but no VL test recorded" (`:528`), VCA "Children positive but no VL test recorded" (`:747`). count = HIV+ rows where `date_last_vl` **or** `vl_last_result` is empty (`:448-449`, `:664-665`). total = `hivPositive.length || total`. severity `critical` if count > 0 else `success`. Icon ShieldAlert. records = those rows. Caregiver + VCA only.
- [ ] `stale-vl` — "Overdue viral load tests" / "Last VL older than 6 months from latest service". count = HIV+ rows with parseable `date_last_vl` < `sixMonthsBefore` (`:452-455`, `:668-671`). total = `hivPositive.length || total`. critical/success. Icon Clock. Caregiver + VCA only.
- [ ] `missing-domains` — "Incomplete service coverage"; description "Households missing at least one domain across all visits" (`:530,629`) / "VCAs missing at least one domain across all visits" (`:749`). count = groups where any of Health/Schooled/Safe/Stable is not covered across all the group's rows (`:459-467`, `:568-576`, `:675-683`). total = number of groups. warning/success. Icon AlertTriangle. records = synthetic rows `{ household_id | vcaid, health, schooled, safe, stable, total_visits }` with values `"Yes"` / `"Missing"`. All three.
- [ ] `duplicates` — "Possible duplicate records"; "Same household, date and services entered twice" (`:531,630`) / "Same VCA, date and services entered twice" (`:750`). Key `${entityId}|${service_date}|${health_services}`; every row after the first with the same key counts (`:470-476`, `:579-585`, `:686-692`). total = rows. warning/success. Icon Copy. All three.
- [ ] `empty-records` — "Blank service records" / "No service data in any field". count = rows with no "any service" field (`:479,588,695`). warning/success. Icon FileX. All three.
- [ ] `no-district` — "Records without district" / "Missing district breaks geographic filtering". count = rows with empty `district` (`:482,591,698`). warning/success. Icon MapPinOff. All three.
- [ ] `future-dated` — "Future-dated records" / "Service date is after today". count = rows with parseable `service_date` > now (`:485-488`, `:594-597`, `:701-704`). **critical**/success. Icon CalendarX. All three.
- [ ] `almost-ready` — "Almost graduation-ready"; "Households with 3 of 4 domains — one more to go" (`:535,634`) / "VCAs with 3 of 4 domains — one more to go" (`:754`). count = groups covering exactly 3 of Health/Schooled/Safe/Stable (`:491-504`, `:600-613`, `:707-720`). total = groups. severity **info** if count > 0 else success. Icon GraduationCap. records `{ household_id | vcaid, domains_covered: 3, missing_domain: "Health" | "Schooled" | "Safe" | "Stable", total_visits }`. All three.
- [ ] `vl-suppression` — "Viral load suppressed"; "HIV+ clients with suppressed viral load" (`:536`) / "HIV+ children with suppressed viral load" (`:755`). withVl = HIV+ rows with `vl_last_result` provided; suppressed = lower-cased value contains `"suppress"` or `"undetect"`, equals `"ldl"`, or numeric value > 0 and < 1000 (`:507-512`, `:723-728`). total = `withVl.length || hivPositive.length`. severity **success** if count > 0 else **info** (inverted). Icon Pill. Caregiver + VCA only.
- [ ] `mmd-coverage` — "Multi-month dispensing" / "VCAs with MMD level recorded". count = rows with `level_mmd` provided (`:731`). total = rows. severity `warning` if `count < total * 0.5` else success (`:756`). Icon TrendingUp. VCA only.
- [ ] `inactive` — "Clients without recent services" / "Last visit over 3 months before latest service in period". For each group take the row with the latest parseable `service_date`; count groups whose latest date < `threeMonthsBefore` (`:515-525`, `:616-626`, `:734-744`). total = groups with a parseable date (`|| totalHH` fallback for caregiver/household). warning/success. Icon UserX. records = each group's latest row. All three.

### Filters / sort / pagination / search
- [ ] Tile sort: by severity order `{ critical: 0, warning: 1, info: 2, success: 3 }`, stable within a severity (`:252-255`). No user-controlled sort.
- [ ] Header badges (`:257-258`, `:284-300`): `criticalCount` = tiles with severity critical **and** count > 0 → badge "`{n} critical`"; `warningCount` likewise → "`{n} warnings`" (always plural); if both 0 → "All clear".
- [ ] Records dialog search (`:131`, `:138-145`, `:173-182`): placeholder "Search records..."; matches if **any value** of the record, `String(v ?? "")` lower-cased, contains the lower-cased query; no debounce; not persisted.
- [ ] Records dialog columns: `Object.keys(insight.records[0]).slice(0, 8)` (`:133-136`), header text = key with `_` → space (`:201`), plus a leading `#` column (row index + 1). Cell = `String(record[col] ?? "N/A")` truncated at 200px (`:218-220`).
- [ ] Records dialog pagination: client-side, shows first **200** filtered rows (`:214`); footer "Showing 200 of {n} records. Export CSV to view all." when more (`:227-231`); footer "`{filtered} of {total} records shown`" (`:235-237`). Close button "Close" (`:238-240`).

### Exports
- [ ] CSV, button "Export CSV" in the records dialog (`:183-191`). Filename `insight_${insight.id}_${new Date().toISOString().slice(0, 10)}.csv` (`:187`, `:113`) — date is the **UTC** date. Rows = **all** `insight.records` (ignores the dialog search). Headers = `Object.keys(records[0])` in object order (`:98`); every cell double-quoted with `"` doubled (`:102-106`); null/undefined → empty. No-op when there are no records (`:97`). Built by hand (Blob + anchor, `:109-117`); URL revoked after click. **Port:** use `platform/export` with explicit column definitions per insight.
- [ ] Dialog header shows `{insight.count.toLocaleString()} records` badge (`:166-168`).

### Charts
- [ ] Insight tile (`:305-355`): icon, label, description, big `count.toLocaleString()`, then "`/ {total.toLocaleString()} ({percent}%)`" where percent = `(count / total * 100).toFixed(1)` or `"0"` when total is 0 (`:308`, `:343-345`). Tile coloured by severity only when count > 0, otherwise neutral (`:318`, `:322`, `:327-329`, `:338-340`). Chevron shown and tile clickable only when `records.length > 0` (`:309`, `:314`, `:347-349`). Grid 1 / 2 / 3 columns at sm / lg (`:304`).
- [ ] Severity colours (`:63-92`): critical = rose, warning = amber, info = emerald, success = emerald (hard-coded Tailwind classes). **Port:** map to theme tokens (destructive / warning / info / success).

### Links in / out
- [ ] In: none (unreferenced; grep above).
- [ ] Out: none. No navigation from tiles or dialog rows.

### Loading / empty / error
- [ ] Loading (`isLoading` prop): card with title and `LoadingDots` (`:260-273`).
- [ ] Empty: no empty state for `insights = []` — renders the header with "All clear" and an empty grid. **Port:** `<EmptyState>`.
- [ ] Error: none (no data fetching). Dialog shows "No matching records" row when the search matches nothing (`:207-212`).

### Bugs and quirks
- [ ] **BUG** `getLatestServiceDate` starts from `new Date()` (`:393`), so `refDate` is never earlier than today. The comments "compared to latest service date in dataset, not today" (`:451`, `:514`, `:667`, `:733`) are false: windows are relative to today, and a single future-dated row moves them forward. Port intended behaviour: reference = latest service date in the filtered set (or explicitly today — see Open questions).
- [ ] **BUG** `parseDate` uses `new Date(val)` (`:383-387`). Caregiver/VCA `service_date` and `date_last_vl` can be `DD-MM-YYYY` text (AUDIT.md §3.2 `/child/vca-services-by-district`, `service_date` "text, ISO or DD-MM-YYYY"), which `new Date` does not parse reliably, so those rows silently drop out of future-dated, stale-VL and inactive checks. Port: parse both formats in the normaliser with `date-fns`.
- [ ] **BUG** VL suppression test `val.includes("suppress")` (`:510`, `:726`) also matches "not suppressed" / "unsuppressed", counting them as suppressed.
- [ ] **BUG** Comment says "HIV+ without VL — unique per household" (`:447`) but `hivNoVl` and `staleVl` count **rows** (visits), so one client with many visits is counted many times; denominators are also row counts.
- [ ] **BUG** `mmd-coverage` description says "VCAs with MMD level recorded" but counts service rows of all VCAs, HIV status ignored (`:731`, `:756`). With `total = 0` severity is success (`0 < 0` false).
- [ ] **QUESTION** `is_hiv_positive` is matched only as `"1"` or `true` (`:448`, `:664`); other encodings ("yes", "positive", 1) are missed. The column is not in the confirmed `vca_services` column list (AUDIT.md §3.2), nor are `date_last_vl`, `vl_last_result`, `level_mmd`.
- [ ] **QUESTION** `isFieldEmpty` treats `"no"`, `"false"`, `"0"` as empty (`:373`). Correct for service multi-selects, but for `vl_last_result` a literal `0` result counts as "missing VL".
- [ ] Quirk: duplicate key uses only `health_services` among the service fields (`:473`, `:582`, `:689`), so two visits on the same day with different non-health services are flagged as duplicates.
- [ ] Quirk: `hiv-no-vl` / `stale-vl` fall back to `total` (all rows) as denominator when there are no HIV+ rows (`:528-529`, `:747-748`).
- [ ] Quirk: `vl-suppression` severity is inverted (count > 0 → success, 0 → info) (`:536`, `:755`).
- [ ] Quirk: the dialog's `search` state lives in a component that stays mounted (it returns `null` after the hooks, `:147`), so the previous search text is kept when another tile is opened.
- [ ] Quirk: CSV and dialog expose the **raw** service rows (all columns), which may include personal data. Port: export only declared columns.
- [ ] Quirk: CSV headers come from the first record only; keys present only in later records are dropped (`:98`).
- [ ] `records: any[]` and `any` throughout (`:52`, `:96`, `:423-428`). Port: typed domain rows via zod normalisers.

---

## Component `RecentActivity` (unrouted)

Suggested owner: `flags` module (contributes a "Flagged records" dashboard widget).

### Purpose
Despite the name, a "Flagged Records" card: "Review records requiring administrative attention"
(`legacy:src/components/dashboard/RecentActivity.tsx:177-181`). Lists up to 15 unresolved flags, newest first, with
status-count chips that double as a status filter, a text filter, and a click-through to `/flags`. The file still
carries remnants of a multi-source activity feed (VCA and caregiver services) that is no longer fetched.

### Access
- [ ] Route guard: n/a (unrouted).
- [ ] In-page role checks: **none**. Compare `legacy:src/pages/Flags.tsx:36-39,52-62`: the Flags page filters flags to
  `r.district === user.location` when `user.description === "District User"` and `user.location !== "All"`, and to
  `r.province === user.title` when `user.description === "Provincial User"` and `user.title !== "All"`. The widget
  applies **no** geographic filter and shows national flags to everyone.
- [ ] Data scope: none sent to the API (Directus collection read with no filter). **Port:** apply the same scope as the
  flags module (`platform/scope`), ideally as a server-side Directus filter; record as Backend ask (AUDIT.md §3.3 "Server-side permissions" row 9
  already asks whether every user may read all flags nationally).

### Endpoints
- [ ] `GET /items/flagged_forms_ecapplus_pmp?fields=*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name`
  (AUDIT.md §3.3) — wrapper `getFlaggedRecords` (`legacy:src/lib/api.ts:604-628`): raw `fetch` with Bearer token, not
  `directusRequest`; returns `[]` when no token (`:606`) and **swallows every error to `[]`** (`:624-627`); list via
  `getListValue` (`:623`). No filter, sort or limit (Directus default page size). React Query key `["recent-flags"]`
  (`legacy:src/components/dashboard/RecentActivity.tsx:98-101`), no `enabled`, no overrides → global defaults
  `staleTime` 60 s, `gcTime` 24 h, `refetchOnMount/WindowFocus/Reconnect: true`, `retry: 1`
  (`legacy:src/App.tsx:112-134`), persisted to IndexedDB by the global persister (`legacy:src/App.tsx:140-148,214-224`).
  Invalidated by the Flags page after resolving a flag (`legacy:src/pages/Flags.tsx:179`) and by `EtlInvalidator`
  (all keys except `etl`, `legacy:src/components/EtlInvalidator.tsx:78-80`). The Flags page uses a **different** key
  `["flagged-records"]` (`legacy:src/pages/Flags.tsx:42-45`) for the same request. **Port:** one shared
  `queryOptions` from the flags module's key factory; `meta: { persist: false }` is not needed (not user-private) but
  scope must be in the key.
- [ ] Unused imports (dead): `DEFAULT_DISTRICT`, `getVcaServicesByDistrict`, `getCaregiverServicesByDistrict`
  (`:12-17`), `useAuth` (`:5`). No call is made to those endpoints.
- [ ] Client-side post-processing (`:105-138`): drop rows whose `status?.toLowerCase() === "resolved"` (`:110-112`);
  build feed items; sort by `date_created` descending, invalid dates as epoch (sorted last) (`:40-43`, `:135`).

### Fields used

`pickValue` returns the first non-null, non-empty key as a string, else `"N/A"` (`:30-38`).

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| id | `id` | search target, React key (`:125`, `:152`, `:266`) | — |
| title | `comment`, `reason` | row title (`:126`, `:278-280`) | `toTitleCase` (`:161`) |
| householdId | `household_id` | subtitle and unused `linkId` (`:127`, `:130`) | — |
| caregiverName | `caregiver_name` | subtitle (`:127`) | subtitle = `` `HH ${household_id} - ${caregiver_name}` ``, then `toTitleCase` (`:162`) |
| dateCreated | `date_created` | sort + relative time (`:128`, `:282`) | `formatDate` (see below) |
| status | `status` | counts, filter, badge (`:117`, `:129`, `:287-289`) | `toTitleCase(status \|\| "Pending review")` (`:163`) |

`formatDate` (`:45-58`): invalid → raw string; `< 1 min` "Just now"; `< 60 min` "`{m}m ago`"; `< 24 h` "`{h}h ago`";
`< 7 d` "`{d}d ago`"; else `toLocaleDateString("en-GB", { day: "numeric", month: "short" })` (e.g. "3 Nov"). **Port:**
via `core/lib/format.ts` (relative-time helper) so formats come from config.

`toTitleCase` lower-cases the whole string, then upper-cases the first letter of each space-separated word
(`legacy:src/lib/utils.ts:18-21`).

### Filters / sort / pagination / search
- [ ] Status chips (`:184-229`), single-select, default `"all"`, state only (not persisted): "All" (`counts.all` =
  all unresolved), "Pending" (`status` contains `"pending"`), "Incomplete" (contains `"incomplete"`), "Draft"
  (contains `"draft"`) (`:107`, `:117-121`). Counts are computed on the full unresolved list, not on the search result.
  Filtering: `item.status?.toLowerCase().includes(activeFilter)` (`:144-146`). **Port:** URL-synced filter via `platform/filters`.
- [ ] Search input (`:232-240`), placeholder "Filter flags by name, ID or reason...", case-insensitive substring on
  `id`, `title`, `subtitle` (subtitle contains household ID and caregiver name) (`:149-156`); no debounce; not persisted.
- [ ] Sort: fixed, `date_created` desc (`:135`).
- [ ] Limit: first **15** after status filter and search (`FEED_LIMIT`, `:91`, `:164`). No pagination, no "view all" link (only row click).
- [ ] Unused: `tabs` constant "All" / "VCA Services" / "Caregiver" / "Flags" (`:60-65`) and the `vca-service` /
  `caregiver-service` entries of `typeConfig` with routes `/vca-services`, `/household-services` (`:67-89`). Only
  `typeConfig.flag` is used (`:261`).

### Exports
- [ ] None.

### Charts
- [ ] Status-count strip (above). Chip colours: All = slate/dark, Pending = amber, Incomplete = **emerald**, Draft = slate (`:186-228`). Row icon Flag on amber; status badge amber (`:272-289`).

### Links in / out
- [ ] In: none (unreferenced).
- [ ] Out: every row → `navigate("/flags")` with **no** query params, no state (`:268-270`). The computed `linkId`
  (household ID, `:130`) is never used. Hover text "View details" (`:290-292`). **Port:** link to the flags list
  filtered to this flag/household (e.g. `/flags?householdId=` per §5 mapping), from route/query params only.

### Loading / empty / error
- [ ] Loading: `LoadingDots` centred while `flagsQuery.isLoading` (`:103`, `:245-248`).
- [ ] Empty (no unresolved flags **or** nothing matches filter/search): Flag icon, "No flags requiring attention",
  "Excellent! All records are clean." (`:249-256`). **Port:** distinguish "no flags" from "no matches".
- [ ] Error: none surfaced. `getFlaggedRecords` returns `[]` on any failure, so a network or permission error shows
  the "All records are clean" empty state. **Port:** `<ErrorState>` with retry.
- [ ] List area is a fixed-height `ScrollArea` 420 px (`:258`); empty state 380 px.

### Bugs and quirks
- [ ] **BUG** Error swallowed into `[]` → displayed as "Excellent! All records are clean." (`legacy:src/lib/api.ts:624-627`; `:249-256`).
- [ ] **BUG** No geographic scoping, unlike `/flags` (`legacy:src/pages/Flags.tsx:52-62`).
- [ ] **BUG** "Resolved" test is exact `=== "resolved"` after lower-casing (`:111`), while the Flags page treats any
  status containing `resolved`, `closed` or `done` as resolved and also falls back to `flag_status` / `state`
  (`legacy:src/pages/Flags.tsx:47-50`). Closed/done flags appear here as open.
- [ ] **BUG** Missing status renders as "N/a", not "Pending review": `pickValue` returns `"N/A"` (`:37`), so the
  `|| "Pending review"` fallback (`:163`, `:288`) never fires, and `toTitleCase("N/A")` gives `"N/a"`.
- [ ] **BUG** Missing household/caregiver render as "Hh N/a - N/a" (subtitle built with `"N/A"` then title-cased, `:127`, `:162`). Note "HH" also becomes "Hh".
- [ ] **QUESTION** Statuses "incomplete" and "draft" are never written by the app (create writes `status:"pending"`, resolve writes `"resolved"`; AUDIT.md §3.3 rows for `/items/flagged_forms_ecapplus_pmp`). Are those chips meaningful? The Flags page also knows "approved" / "rejected" (`legacy:src/pages/Flags.tsx:204-214`).
- [ ] **BUG** No limit/sort sent to Directus; with the default page size only the first page of flags (unsorted on the server) is considered, so "recent" may miss the newest flags.
- [ ] Quirk: component name `RecentActivity` vs content "Flagged Records"; `typeConfig.flag.route` `/flags` is not used (navigation is hard-coded, `:269`).
- [ ] Quirk: relative time is computed at render; there is no timer to refresh "Xm ago".

---

## Component `DataQualityChart` (unrouted)

Suggested owner: `analytics` or `services` module (service + referral volumes). Name is misleading; title is
"Services & Referrals Trend".

### Purpose
Monthly stacked area chart of VCA services, caregiver services, VCA referrals and caregiver referrals for one calendar
year, with year / month / data-type selectors and CSV export (`legacy:src/components/dashboard/DataQualityChart.tsx:184-229`).

### Access
- [ ] Route guard: n/a (unrouted).
- [ ] In-page role checks: none.
- [ ] Data scope: `district = user?.location ?? ""` (`:51`), passed as the path segment of all four calls. No
  `useEffectiveDistrict`, no district selector. A user whose `location` is `"All"` gets national data (backend treats
  `"All"` as no filter, AUDIT.md §3.1 item 4); an empty `location` disables all queries (`:60,65,70,75`). FY is not
  used at all (calendar year instead). **Port:** district/province from `platform/scope`; decide FY vs calendar year (Open questions).

### Endpoints
All four: wrapper uses `dqaGet` (Bearer token, throws on non-2xx, `legacy:src/lib/api.ts:185-210`), result through
`getListValue` (`legacy:src/lib/api.ts:116-183`); **no** IndexedDB list cache; `district` is `encodeURIComponent`-ed;
no `from`/`to`. React Query overrides: none (global defaults `legacy:src/App.tsx:112-134`; persisted to IndexedDB).
Fires when `!!district`.
- [ ] `GET /child/vca-services-by-month/:district(*)` (AUDIT.md §3.2) — `getVcaServicesByMonth` (`legacy:src/lib/api.ts:522-527`); key `["chart", "vca-services", district]` (`:57-61`). Response rows `{ district, service_count (string), service_month "MM-YYYY" }`.
- [ ] `GET /household/caregiver-services-by-month/:district(*)` (AUDIT.md §3.2) — `getCaregiverServicesByMonth` (`legacy:src/lib/api.ts:515-520`); key `["chart", "caregiver-services", district]` (`:62-66`). Rows `{ district, service_count, service_month }`.
- [ ] `GET /child/vca-referrals-by-month/:district(*)` (AUDIT.md §3.2) — `getVcaReferralsByMonth` (`legacy:src/lib/api.ts:536-541`); key `["chart", "vca-referrals", district]` (`:67-71`). Rows `{ district, referral_count, referral_month }`.
- [ ] `GET /household/caregiver-referrals-by-month/:district(*)` (AUDIT.md §3.2) — `getCaregiverReferralsByMonth` (`legacy:src/lib/api.ts:529-534`); key `["chart", "caregiver-referrals", district]` (`:72-76`). Rows `{ district, referral_count, referral_month }`.
- [ ] Post-processing (`:81-146`): build 12 month buckets January..December with all four series at 0 (`:86-95`);
  for each row, split the month field on `-`: if the first part has 4 chars treat as `YYYY-MM[-DD]`, else if ≥ 2 parts
  treat as `MM-YYYY` (year = last part) (`:103-115`); keep only rows whose year string equals `selectedYear` (`:117`);
  month index 1-12 → name (`:118-120`); if a month is selected, skip rows of other months but keep all 12 buckets
  (`:122-124`); count = `Number(item.count || item.service_count || item.referral_count || 0)` (`:128`); add to the
  series only if data type is `"all"` or equals the series key (`:131-133`). Rows from multiple districts are summed.
  The backend's lexical month ordering does not matter because buckets are fixed.

### Fields used

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| month (services) | `service_month` | bucket (`:140-141`) | x-axis tick = first 3 letters of English month name (`:266`) |
| month (referrals) | `referral_month` | bucket (`:142-143`) | same |
| count | `count`, `service_count`, `referral_count` (truthy-chain) | series value (`:128`) | `Number(...)` |
| district | — (not read) | rows of all districts summed | — |

### Filters / sort / pagination / search
- [ ] Year select (`:194-203`): hard-coded options `["2023", "2024", "2025", "2026"]` (`:199`); default
  `new Date().getFullYear().toString()` (`:52`); state only. Applied to chart and export.
- [ ] Month select (`:205-215`): "All Months" (`all`, default, `:53`) + `January`…`December` (`MONTHS`, `:44-47`).
  Selecting a month zeroes the other 11 buckets but keeps the 12-month axis. State only.
- [ ] Data-type select (`:217-228`): "All Data" (`all`, default, `:54`), "VCA Services" (`vcaServices`), "Caregiver
  Services" (`caregiverServices`), "VCA Referrals" (`vcaReferrals`), "Caregiver Referrals" (`caregiverReferrals`).
  Zeroes other series (`:131-133`) and hides their `<Area>` (`:278-313`). State only.
- [ ] Description reflects year: "Monthly breakdown of services and referrals for {selectedYear}" (`:185`).
- [ ] **Port:** filters declared via `platform/filters` and URL-synced.

### Exports
- [ ] CSV via icon button (Download, title "Export to CSV", `:188-190`), handler `handleExportCSV` (`:148-176`).
  Filename `` `services_referrals_${selectedYear}_${selectedMonth}.csv` `` (`:170`) — month is the English name or
  `all`. Rows: always all **12** month buckets after filters (filtered-out months/series are 0). Headers in order:
  `Month` (month name), `VCA Services` (vcaServices), `Caregiver Services` (caregiverServices), `VCA Referrals`
  (vcaReferrals), `Caregiver Referrals` (caregiverReferrals) (`:151-162`). Comma-joined, **no quoting**. Hand-built
  Blob + anchor; object URL never revoked. Returns early only if `processedData` is empty (i.e. while loading, `:149`).
  **Port:** `platform/export`.

### Charts
- [ ] Recharts `AreaChart` inside shadcn `ChartContainer`, height 300 px (`:238-316`). Four `<Area type="monotone">`
  series, **all with `stackId="1"`** (stacked) (`:278-313`), gradient fills 0.8 → 0.1 opacity (`:241-258`).
  Dashed horizontal grid only (`:259`); x-axis = month (3-letter), y-axis numeric; shadcn tooltip + legend (`:275-276`).
- [ ] Series config (`:25-42`): `vcaServices` "VCA Services" `hsl(var(--chart-1))`; `caregiverServices` "Caregiver
  Services" `--chart-2`; `vcaReferrals` "VCA Referrals" `--chart-3`; `caregiverReferrals` "Caregiver Referrals"
  `--chart-4` (theme tokens in `legacy:src/index.css:55-58` light, `:110-113` dark). **Port:** `platform/charts` + theme tokens.

### Links in / out
- [ ] In: none (unreferenced).
- [ ] Out: none.

### Loading / empty / error
- [ ] Loading: `LoadingDots` in a 300 px box while **any** of the four queries `isLoading` (`:79`, `:233-236`).
- [ ] Empty: none; zero data renders a flat chart of 12 zero months.
- [ ] Error: none. A failed query leaves `data` undefined → series silently 0 (`:140-143`); global `retry: 1`. Partial
  failure is indistinguishable from "no activity". **Port:** `<ErrorState>` with retry; partial-failure notice.

### Bugs and quirks
- [ ] **BUG** Hard-coded year list ends at 2026 (`:199`) while the default is the current year (`:52`): from 2027 the
  select's value is not among its options. Port: derive years from config/data (and from the FY scope if adopted).
- [ ] **BUG** When `user.location` is empty the four queries are disabled; React Query v5 reports `isLoading: false`
  for disabled queries, so the widget shows an all-zero chart instead of a "no scope" state (`:51`, `:60-79`).
- [ ] **QUESTION** Services and referrals are stacked in one cumulative area (`stackId="1"`, `:284-311`), so the top
  line is a meaningless sum of services + referrals. Port as stacked, grouped, or two charts?
- [ ] **QUESTION** Calendar year rather than the program fiscal year; backend ignores FY for these routes (AUDIT.md §3.2).
- [ ] Backend issues carried by the endpoints (AUDIT.md §3.2): `TO_DATE(...,'DD-MM-YYYY')` can mis-bucket ISO dates or
  500 the whole request; possible join-duplicate inflation. Record in PROGRESS.md "Backend asks" if the widget is ported.
- [ ] Quirk: `useMemo` depends on `queries`, a new object each render (`:56`, `:146`), so it recomputes every render (perf only).
- [ ] Quirk: English month names hard-coded (`:44-47`); port through `date-fns` locale formatting.

---

## Component `ActionQueueBanner` (unrouted)

Suggested owner: `services` module (it is per service type `vca | caregiver | household`). The live equivalent is
the "actions" tab of `QualityReviewPanel` on the service pages
(`legacy:src/components/dashboard/services/QualityReviewPanel.tsx:85-89`); the port should share one query.

### Purpose
"Action Queue" card: fixed list of priority work items for a service type, each with a count, severity, description,
and a click handler for drill-down supplied by the parent (`legacy:src/components/dashboard/ActionQueueBanner.tsx:10-15,24-101`).
Props: `type: "vca" | "caregiver" | "household"` (required), `district?: string`, `facility?: string`,
`onAction?: (item: ActionItem) => void`.

### Access
- [ ] Route guard: n/a (unrouted).
- [ ] In-page role checks: none.
- [ ] Data scope: `district` and `facility` come from props; no caller exists. The wrapper drops each only when it is
  exactly lower-case `"all"` (`legacy:src/lib/api.ts:1055-1060`), matching the backend sentinel; `"All"` or
  `"All Districts"` would be sent as a literal district and return zero counts (AUDIT.md §3.2 `/etl/action-queue`).
  `ward` is supported by the wrapper but never passed by the banner. **Port:** scope from `platform/scope`; omit the
  param for "all".

### Endpoints
- [ ] `GET /etl/action-queue?type=<type>[&district=][&facility=][&ward=]` (AUDIT.md §3.2) — wrapper `getActionQueue`
  (`legacy:src/lib/api.ts:1049-1068`) via `dqaGetSkipCache` (Bearer token, throws on non-2xx, no IndexedDB cache,
  `legacy:src/lib/api.ts:701-712`). Normalises to `{ type: res.type ?? params.type, generated_at: res.generated_at ?? "", data: res.data ?? [] }`.
  Query key `["action-queue", type, district, facility]`, `staleTime: 5 * 60 * 1000` (`:25-29`); always enabled; other
  options global (`legacy:src/App.tsx:112-134`); persisted by the global persister. The live caller uses key
  `["quality-review", "action-queue", type, district]` with the same staleTime
  (`legacy:src/components/dashboard/services/QualityReviewPanel.tsx:85-89`). Backend caches 5 min and reports a failed
  sub-query as `count: 0` (AUDIT.md §3.2).
- [ ] Item shape `ActionItem` (`legacy:src/lib/api.ts:1034-1041`): `key`, `label`, `description`, `count: number`,
  `severity: "red" | "orange" | "yellow" | "slate"`, `filter: { type: string }`. Keys / filter types per type are listed
  in AUDIT.md §3.2 `/etl/action-queue`.

### Fields used

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| items | `data` | card grid (`:33`, `:67-95`) | — |
| generatedAt | `generated_at` | "Updated {time}" (`:50-54`) | `new Date(...).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })` |
| item.key | `key` | React key (`:72`) | — |
| item.label | `label` | card label (`:86`) | uppercase via CSS |
| item.count | `count` | big number, total, clickability (`:34`, `:69`, `:88`) | `toLocaleString()` |
| item.description | `description` | card text (`:89`) | — |
| item.severity | `severity` | card colours (`:17-22`, `:68`) | — |
| item.filter | `filter` | not read by the banner; passed to `onAction` | — |

### Filters / sort / pagination / search
- [ ] None in the widget. Order = server order (fixed).
- [ ] Header badge (`:44-48`), shown when not loading: "All clear" when `totalCount === 0`, else
  "`{totalCount.toLocaleString()} item{s} need attention`" (singular "item" when 1). `totalCount` = sum of counts (`:34-35`).

### Exports
- [ ] None.

### Charts
- [ ] Count tiles, grid 1 / 2 / 3 columns (`:66`). Each tile is a `<button>`: disabled and 60 % opacity when
  `count === 0` (`:69`, `:75-80`); icon AlertTriangle (severity colour) when count > 0 else CheckCircle2 emerald
  (`:85`); arrow shown when clickable (`:91`). Severity styles (`:17-22`): red = rose, orange = amber, yellow = yellow,
  slate = slate (icon emerald). **Port:** theme tokens.

### Links in / out
- [ ] In: none (unreferenced).
- [ ] Out: click → `onAction?.(item)` only when `count > 0` (`:74`). No navigation inside the widget; behaviour depends
  on the host. **Port:** as a dashboard widget it needs a concrete drill-down (e.g. navigate to `/services/:type` with
  the issue filter in the URL, matching `QualityReviewPanel`'s `onIssueChange`).

### Loading / empty / error
- [ ] Loading: `LoadingDots` (`:58-59`); header badge hidden while loading (`:44`).
- [ ] Empty / all clear: CheckCircle2 + "No pending actions for the current filter. Nice work." (`:60-64`).
- [ ] Error: **the whole card disappears** (`if (isError) return null;`, `:31`). **Port:** `<ErrorState>` with retry
  (widget error boundary from the shell).
- [ ] "Updated HH:MM" hidden when `generated_at` is empty (`:50`).

### Bugs and quirks
- [ ] **BUG** Errors hide the widget silently (`:31`).
- [ ] **BUG** (backend, carried) failing count queries are reported as `0` and cached for 5 min, so the banner can show
  "All clear" for a broken check (AUDIT.md §3.2 `/etl/action-queue` issues). Backend ask.
- [ ] Quirk: `allClear` is true for an empty `data` array as well as for all-zero counts (`:35`), so an unknown `type`
  (backend returns `data: []`) also reads "All clear".
- [ ] Quirk: `toLocaleTimeString([], ...)` uses the browser locale (`:52`); port via `core/lib/format.ts`.

---

## Component `CalendarWidget` (unrouted)

Suggested owner: `calendar` module.

### Purpose
"Upcoming Schedule" — "Your scheduled events and meetings" (`legacy:src/components/dashboard/CalendarWidget.tsx:28-29`).
Shows **today's** events for the signed-in user (despite the title), with a link to the full calendar.

### Access
- [ ] Route guard: n/a (unrouted). Target `/calendar` is `ProtectedRoute` only (`legacy:src/App.tsx:542-547`); sidebar
  "Calendar" has no condition (`legacy:src/components/dashboard/AppSidebar.tsx:50`); not in mobile nav or global search.
- [ ] In-page role checks: none.
- [ ] Data scope: own events only, by `user.id` (`:16-20`). Directus permission on `calendar_events` is the only real
  guard (AUDIT.md §3.3 "Server-side permissions" row 12). No district/FY.

### Endpoints
- [ ] `GET /items/calendar_events?filter[user_id][_eq]=<user.id>&fields=id,title,description,start_time,end_time,category,user_id,status&sort=start_time`
  (AUDIT.md §3.3) — wrapper `getCalendarEvents` (`legacy:src/lib/directus.ts:722-732`) via `directusRequest` (Bearer
  token, throws when not authenticated, `legacy:src/lib/directus.ts:21-60`); returns `data?.data ?? []`. No `limit`
  (Directus default page size). Query key `["calendar-events-widget", user?.id]`, `enabled: !!user?.id` (`:16-20`);
  global defaults otherwise; persisted to IndexedDB by the global persister. The Calendar page and the reminder hook
  use `["calendar-events", id]` and its mutations never invalidate the widget key (AUDIT.md §3.5 (d) "Several wrappers or call sites for one endpoint", row for
  `/items/calendar_events`). **Port:** reuse the calendar module's `queryOptions`; user-private →
  `meta: { persist: false }`.
- [ ] Post-processing: `events.filter(e => isToday(new Date(e.start_time)))` (`:22`) in the browser's local time zone.

### Fields used

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| id | `id` | React key (`:54`) | — |
| title | `title` | row title (`:66`) | truncated |
| startTime | `start_time` | today filter (`:22`), time range (`:69`) | `format(new Date(start_time), "HH:mm")` |
| endTime | `end_time` | time range (`:69`) | `format(..., "HH:mm")`; shown as "`HH:mm - HH:mm`" |
| category | `category` | left colour bar (`:59-64`) | `"Meeting"` → emerald, `"Field Visit"` → emerald, `"Deadline"` → rose, anything else (e.g. `"Personal"`) → amber |
| status | `status` | **not used** (cancelled events still shown) | — |
| description | `description` | fetched, not shown | — |

`CalendarEvent.category` type: `"Meeting" | "Field Visit" | "Deadline" | "Personal"`; `status`:
`"scheduled" | "cancelled" | "completed"` (`legacy:src/lib/directus.ts:711-720`). Colours mirror the Calendar page's
`CATEGORIES` (`legacy:src/pages/Calendar.tsx:59-80`). **Port:** category list/colours from one shared definition in the calendar module.

### Filters / sort / pagination / search
- [ ] Today-only filter (fixed, `:22`). Sort = server `start_time` ascending. No pagination, no limit on rows shown.

### Exports
- [ ] None.

### Charts
- [ ] None.

### Links in / out
- [ ] In: none (unreferenced).
- [ ] Out: each event row → `navigate("/calendar")` (`:55`); empty-state "Schedule now" → `/calendar` (`:44-48`);
  footer button "View full calendar" → `/calendar` (`:79-84`). No query params or state (the event is not
  pre-selected). **Port:** consider `/calendar?date=` or event deep link if the calendar module supports it.

### Loading / empty / error
- [ ] Loading: `LoadingDots` (`:35-38`).
- [ ] Empty: Calendar icon, "No events for today", "Schedule now" button (`:39-49`).
- [ ] Error: none; `data` defaults to `[]` (`:16`), so an error shows "No events for today". **Port:** `<ErrorState>`.

### Bugs and quirks
- [ ] **BUG** No `limit` and ascending sort: Directus returns only its default page (oldest events first), so a user
  with many past events gets no "today" events at all (`legacy:src/lib/directus.ts:723-731`). Port: filter server-side
  on today's `start_time` range.
- [ ] **QUESTION** Cancelled events (`status: "cancelled"`) are shown; should they be hidden or struck through?
- [ ] Quirk: title "Upcoming Schedule" but only today's events are listed (`:22`, `:28`).
- [ ] Quirk: widget cache key is never invalidated by Calendar create/update/delete (see Endpoints).

---

## Component `ProvincialBreakdown` (unrouted)

Suggested owner: `households` module (counts households by village/zone).

### Purpose
"Geographic Breakdown" — "Top Villages/Zones in {district}" (`legacy:src/components/dashboard/ProvincialBreakdown.tsx:41-42`):
top 5 villages/zones by number of household rows in the user's district, as labelled progress bars. Despite the name,
nothing is provincial.

### Access
- [ ] Route guard: n/a (unrouted).
- [ ] In-page role checks: none.
- [ ] Data scope: `district = user?.location ?? ""` (`:12`) sent as the path segment; `"All"` → national register;
  empty → query disabled (`:17`). No FY window sent. **Port:** `platform/scope` (district + FY in the key and request).

### Endpoints
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) — wrapper `getHouseholdsByDistrict(district)`
  (`legacy:src/lib/api.ts:301-312`) called **without** `fy`, so no `from`/`to`; goes through the IndexedDB list cache
  key `households_by_district:${district || "ALL"}` with 60 s TTL and stale-on-error fallback
  (`legacy:src/lib/api.ts:14,212-238,306-310`). Query key `["households-list", district]`, `enabled: !!district`
  (`:14-18`); global defaults otherwise; persisted. Downloads the whole household register to compute 5 numbers.
  **Port:** share the households register `queryOptions` (same cache entry as the register page) or ask for a
  server-side aggregate (Backend ask).
- [ ] Post-processing (`:20-34`): `location = h.village || h.zone || "Unspecified"` (comment says "Unknown", `:25-26`);
  count rows per location; sort desc by count; first 5.

### Fields used

| Field (normalised name) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| locality | `village`, `zone` (fallback literal `"Unspecified"`) | row label, group key (`:26`, `:58`) | — |
| count | — (row count per locality) | "`{count} households`" (`:59`), bar value `count / maxCount * 100` (`:61`) | no thousands separator, no singular |

### Filters / sort / pagination / search
- [ ] None. Sort by count desc, top 5 (`:31-33`). `maxCount = villageStats[0]?.count || 1` (`:36`).

### Exports
- [ ] None.

### Charts
- [ ] Horizontal bars via shadcn `Progress` (height 2, `:61`), relative to the top village. Label left, "`{n} households`" right.

### Links in / out
- [ ] In: none (unreferenced).
- [ ] Out: none.

### Loading / empty / error
- [ ] Loading: `LoadingDots` in a 300 px box (`:45-48`).
- [ ] Empty: dashed box "No geographic data available." (`:49-52`). Also shown when the query is disabled (no
  `location`) and when it fails.
- [ ] Error: none surfaced (falls into the empty state). **Port:** `<ErrorState>`.

### Bugs and quirks
- [ ] **QUESTION** `village` and `zone` are not among the confirmed `all_households` columns (AUDIT.md §3.2
  `/household/all-households` response table). If neither exists every household lands in "Unspecified". Confirm
  the column names (e.g. `ward`, which does exist) before porting.
- [ ] **BUG** Counts rows, not distinct `household_id`; the endpoint uses `SELECT DISTINCT *` and may still return
  duplicates (AUDIT.md §3.2). Port: count distinct household IDs.
- [ ] **BUG** No FY window although household KPIs elsewhere are FY-scoped (AUDIT.md §3.2 `/household/all-households` "Params" note).
- [ ] Quirk: description reads "Top Villages/Zones in All" for national users and "in district" when empty (`:42`).
- [ ] Quirk: "households" label is never singular (`:59`).

---

## Other behaviour

### The dashboard and its shared strips draft

- [ ] **Timers/polling:** none in these files. Global `EtlInvalidator` polls `["etl","last-success"]` every 30 s and invalidates every non-`etl` query (incl. `metrics`, `service-summary`, `duplicates`) when a newer ETL run is seen (`legacy:src/components/EtlInvalidator.tsx:28,53-61,73-80`). In the new build mark MetricsGrid/summary/duplicates queries `meta: { etl: true }`.
- [ ] **Storage keys read/written (this part):** sessionStorage `ecap.first_login` read (`legacy:src/components/dashboard/WelcomeBanner.tsx:11`); localStorage `ecap_plus_pmp.fy_filter_state_v2` read via FY context (`legacy:src/context/FyFilterContext.tsx:12,36`); IndexedDB aux cache `households_by_district:<district>` (`legacy:src/lib/api.ts:308`); React Query IDB persister key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`).
- [ ] **Header on `/dashboard`:** GlobalSearch and FyFilter are hidden because `/dashboard` is in `HIDDEN_ROUTES` (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,245-257`).
- [ ] **Browser APIs:** `performance.now`/`requestAnimationFrame` (AnimatedCounter), Blob/ObjectURL download (DuplicateDetectionCard).
- [ ] **Locale strings hardcoded:** `"en-GB"` (`legacy:src/components/dashboard/MetricsGrid.tsx:184`, `legacy:src/components/dashboard/WelcomeBanner.tsx:35`, `legacy:src/components/AnimatedCounter.tsx:38`), `"en-US"` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:39,76`) → config + `core/lib/format.ts`.

### The unreferenced dashboard widgets draft

- [ ] **Shared card chrome:** every widget is wrapped in `GlowCard` (decorative gradient glow, blur and translucent
  card, `legacy:src/components/aceternity/GlowCard.tsx:12-35`) and uses `LoadingDots` (three bouncing dots,
  `legacy:src/components/aceternity/LoadingDots.tsx:7-15`) for loading. **Port:** plain card + skeletons per CLAUDE.md
  UI rules; no Aceternity effects.
- [ ] **Modals/dialogs:** only `ServiceInsights`' records dialog (`InsightRecordsDialog`, `ServiceInsights.tsx:122-245`):
  shadcn `Dialog`, max-width 5xl, max-height 85vh; closes via overlay/Escape (`onOpenChange={onClose}`) or "Close" button.
- [ ] **Forms / mutations:** none in any of the six widgets.
- [ ] **Toasts:** none.
- [ ] **Keyboard shortcuts:** none (the dialog inherits shadcn Escape-to-close).
- [ ] **Timers / polling:** none. No `refetchInterval`, `setInterval` or `setTimeout` in any of the six files. Only
  `staleTime: 5 * 60 * 1000` on `ActionQueueBanner` (`ActionQueueBanner.tsx:28`); everything else uses the global
  defaults (`staleTime` 60 s, refetch on mount/focus/reconnect, `legacy:src/App.tsx:126-131`). `EtlInvalidator`
  invalidates every key except `etl`-prefixed ones after a new ETL run (`legacy:src/components/EtlInvalidator.tsx:78-80`),
  which covers all six widgets' keys.
- [ ] **Storage:** no widget reads or writes `localStorage`/`sessionStorage` directly. Indirect:
  - React Query persister: every successful query (including `["recent-flags"]`, `["calendar-events-widget", id]`,
    `["chart", …]`, `["action-queue", …]`, `["households-list", district]`) is dehydrated to IndexedDB key
    `ecap-plus-pmp-react-query` for 24 h (`legacy:src/App.tsx:140-148,214-224`).
  - IndexedDB list cache entry `households_by_district:<district|ALL>` (60 s TTL) written by `getHouseholdsByDistrict`
    for `ProvincialBreakdown` (`legacy:src/lib/api.ts:306-310`).
- [ ] **Browser APIs:** `Blob` + `URL.createObjectURL` + temporary `<a download>` for CSV in `ServiceInsights`
  (`:109-117`, revokes URL) and `DataQualityChart` (`:165-175`, does **not** revoke).
- [ ] **Hardcoded program/domain strings** (move to `@/config` or module i18n; none are brand strings):
  - Sub-population / domain terms: "VCA", "VCAs", "Caregiver", "HH", "Households", "Children", "Clients" in labels
    (`ServiceInsights.tsx:528-537,629-635,747-757`; `RecentActivity.tsx:62-63,127`; `DataQualityChart.tsx:27,31,35,39,151,223-227`).
  - Service domains "Health", "Schooled", "Safe", "Stable" (`ServiceInsights.tsx:499-501,608-610,715-717`) and the
    service field names per domain (`:405-409`, `:460-463`).
  - Clinical thresholds: VL suppression `< 1000`, keywords `suppress`/`undetect`/`ldl` (`:510-511`, `:726-727`); VL
    staleness 6 months (`:432`, `:649`); inactivity 3 months (`:434`, `:553`, `:651`); MMD 50 % (`:756`); graduation = 3
    of 4 domains (`:498`).
  - Calendar categories "Meeting", "Field Visit", "Deadline" (`CalendarWidget.tsx:61-63`).
  - Year list `["2023", "2024", "2025", "2026"]` (`DataQualityChart.tsx:199`).
  - Geography terms "Villages/Zones", "district" (`ProvincialBreakdown.tsx:42`).
  - Flag statuses "pending", "incomplete", "draft", "resolved" (`RecentActivity.tsx:111,119-121`).

## Open questions for the developer

### The dashboard and its shared strips draft

1. Caseworkers KPI: keep "distinct caseworker names in the active household register" or switch to `GET /child/caseworker/count/:district(*)`? Should it be FY-scoped like the other two?
2. VCAs/Households KPIs count active **and** closed records but link to active registers — keep the backend definitions (label them "ever enrolled") or ask the backend for active counts?
3. Should the dashboard show the FY/scope chip (legacy hides it while still applying the FY)?
4. Quick actions: generate from nav (plan) so they respect permissions — confirm the 8 legacy tiles and their copy should be kept as the default set.
5. DuplicateDetectionCard: where does it live in the new app (services module widget for each type, VCA only, or a DQA page)? Should "Flag caseworker" create a real flag?
6. Keep the "Live data" / "Live database" badges, tied to the freshness service, or drop them?
7. CanonicalKpiStrip tooltips reference Home cards ("Caregivers card") that do not exist — rewrite copy?

### The unreferenced dashboard widgets draft

1. **Placement:** confirm each widget's owning module (ServiceInsights + ActionQueueBanner → `services`;
   RecentActivity → `flags`; DataQualityChart → `analytics` or `services`; CalendarWidget → `calendar`;
   ProvincialBreakdown → `households`) contributing to the dashboard through manifest `widgets`, rather than living in
   `modules/dashboard`.
2. **ServiceInsights data source:** compute client-side from the unbounded `*-services-by-district` endpoints (as the
   helpers expect), or use the server-side `GET /etl/dqa-checks` + `GET /etl/dqa-records` (no legacy caller) or
   `GET /etl/action-queue`? On which page(s) should it appear (dashboard, `/services/:type`, both)?
3. **ServiceInsights reference date:** relative to today (what the code actually does) or to the latest service date
   in the filtered set (what the comments say)?
4. **ServiceInsights counting unit:** per service row (current) or per unique client/household for HIV/VL insights?
5. **RecentActivity statuses:** are "incomplete" and "draft" real flag statuses? Which statuses mean resolved
   (`resolved` only, or also `closed`/`done` as on the Flags page)?
6. **DataQualityChart:** calendar year or program fiscal year (scope)? Stacked services + referrals, or separate
   series/charts? Year options from config, data, or FY list?
7. **ActionQueueBanner drill-down:** what should clicking a tile do on the dashboard (navigate to `/services/:type`
   with the issue filter)? Which service type(s) does the dashboard show — one banner per type?
8. **CalendarWidget:** "today" only (current) or truly "upcoming" (next N days)? Hide cancelled events?
9. **ProvincialBreakdown:** which household column holds village/zone (the confirmed columns include `ward` but not
   `village`/`zone`)? Should it be FY-scoped? Is a server-side aggregate acceptable instead of loading the whole register?
10. **Scope for national users:** these widgets send `user.location` verbatim (`"All"` → national). Confirm the port
    uses `platform/scope` (province/district selector + FY) for all of them.

## Phase 5 implementation decision and status (2026-11-03)

The user approved a **default-off scaffold**. `module.dashboard` is false by default. Legacy dashboard data widgets call endpoints with untrusted caller scope, fetch national lists, expose flag/GPS-style records, or mutate duplicate-review state without verified authorization.

- `/dashboard` is registered with `records.view` at district-or-higher scope, but the feature flag removes its route and nav by default. The existing `/` shell landing page remains unchanged.
- If intentionally opened for the scaffold, it shows an unavailable-metrics notice and quick links derived from the navigation groups already filtered by the app registry for the signed-in user's feature flags, scope and permissions. It makes no widget API calls.
- No KPI/count queries, national register or ward downloads, flags/recent activity, action queue, duplicate-review widgets/mutations, unmounted service insight/chart widgets, or calendar data are loaded from the dashboard scaffold. No by-ID routes are added.
- Other dashboard widgets should be contributed by their owning modules only after their data endpoints and mutation permissions are safe. The `Outlet` passes the filtered navigation groups into page context for the dashboard quick links.

Backend follow-up before enabling data widgets: enforce caller-derived scope on count/action-queue/duplicate endpoints; define consistent count semantics and pagination; authorize duplicate-review mutations; use scoped data contracts for household and caseworker widgets. Calendar and flags should remain owned by their feature modules.
