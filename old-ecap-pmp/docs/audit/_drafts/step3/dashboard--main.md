# dashboard — legacy audit (part: main)

> New module `dashboard` · Legacy routes → new routes: `/dashboard` → `/dashboard` (+ unreferenced/side widgets ported per decision 2) · Plan: MIGRATION_PLAN.md §5 row "dashboard" ("Welcome banner, KPI grid, quick links generated from nav; other modules contribute widgets")
>
> This part covers `Dashboard.tsx`, `WelcomeBanner`, `MetricsGrid`, `CanonicalKpiStrip`, `DuplicateDetectionCard`. Other dashboard widgets are covered by other parts; the merger combines them.

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

**Superset dependency check:** MetricsGrid does **not** depend on Superset. It imports only DQA wrappers (`legacy:src/components/dashboard/MetricsGrid.tsx:17-21`); the only Superset mention is a code comment saying the households endpoint matches "the ecapplus-superset 'Total Households' chart" (`legacy:src/components/dashboard/MetricsGrid.tsx:209-212`). CanonicalKpiStrip's tooltip text mentions "Superset dashboards" (`legacy:src/components/dashboard/CanonicalKpiStrip.tsx:114`) but calls only the DQA API. No Superset calls in any file of this part.

---

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

## Other behaviour
- [ ] **Timers/polling:** none in these files. Global `EtlInvalidator` polls `["etl","last-success"]` every 30 s and invalidates every non-`etl` query (incl. `metrics`, `service-summary`, `duplicates`) when a newer ETL run is seen (`legacy:src/components/EtlInvalidator.tsx:28,53-61,73-80`). In the new build mark MetricsGrid/summary/duplicates queries `meta: { etl: true }`.
- [ ] **Storage keys read/written (this part):** sessionStorage `ecap.first_login` read (`legacy:src/components/dashboard/WelcomeBanner.tsx:11`); localStorage `ecap_plus_pmp.fy_filter_state_v2` read via FY context (`legacy:src/context/FyFilterContext.tsx:12,36`); IndexedDB aux cache `households_by_district:<district>` (`legacy:src/lib/api.ts:308`); React Query IDB persister key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`).
- [ ] **Header on `/dashboard`:** GlobalSearch and FyFilter are hidden because `/dashboard` is in `HIDDEN_ROUTES` (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,245-257`).
- [ ] **Browser APIs:** `performance.now`/`requestAnimationFrame` (AnimatedCounter), Blob/ObjectURL download (DuplicateDetectionCard).
- [ ] **Locale strings hardcoded:** `"en-GB"` (`legacy:src/components/dashboard/MetricsGrid.tsx:184`, `legacy:src/components/dashboard/WelcomeBanner.tsx:35`, `legacy:src/components/AnimatedCounter.tsx:38`), `"en-US"` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:39,76`) → config + `core/lib/format.ts`.

## Open questions for the developer
1. Caseworkers KPI: keep "distinct caseworker names in the active household register" or switch to `GET /child/caseworker/count/:district(*)`? Should it be FY-scoped like the other two?
2. VCAs/Households KPIs count active **and** closed records but link to active registers — keep the backend definitions (label them "ever enrolled") or ask the backend for active counts?
3. Should the dashboard show the FY/scope chip (legacy hides it while still applying the FY)?
4. Quick actions: generate from nav (plan) so they respect permissions — confirm the 8 legacy tiles and their copy should be kept as the default set.
5. DuplicateDetectionCard: where does it live in the new app (services module widget for each type, VCA only, or a DQA page)? Should "Flag caseworker" create a real flag?
6. Keep the "Live data" / "Live database" badges, tied to the freshness service, or drop them?
7. CanonicalKpiStrip tooltips reference Home cards ("Caregivers card") that do not exist — rewrite copy?
