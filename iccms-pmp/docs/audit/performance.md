# performance — legacy audit

> Legacy routes → new routes: `/performance` → `/performance` · Plan: MIGRATION_PLAN.md §5 row "performance"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/Performance.tsx` | 697 | The whole page. Holds the hero, the 3 tabs (Facility / Caseworker / Service), the shared `KpiCard`, `HorizontalBarChart`, `TrendPill` and `exportCsv` helpers, and the 3 section components. |
| `legacy:src/lib/api.ts` (lines 7, 14, 205-238, 301-312, 701-712, 800-911, 1239-1242) | (partial) | Wrappers `getFacilityPerformance`, `getCaseworkerPerformance`, `getServicePerformance`, `getFacilityList`, `getHouseholdsByDistrict`; `dqaGetSkipCache`; IndexedDB list cache |
| `legacy:src/App.tsx` (lines 77, 112-160, 573-579) | (partial) | Lazy import, route + guard, QueryClient defaults, persister |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | Nav entry `:87`, visibility filter `:147-180` |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | No entry for this route |
| `legacy:src/components/dashboard/GlobalSearch.tsx` (lines 33-46) | 212 | No entry for this route |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by this page |
| `legacy:src/pages/Dashboard.tsx` (lines 18-80, 105-110) | 135 | Inbound quick-action card |
| `legacy:src/context/FyFilterContext.tsx` | 122 | FY state that the page reads (`useFyFilter`) |
| `legacy:src/lib/fiscalYear.ts` | 84 | `resolveFy` (fromDate/toDate/mode) |
| `legacy:src/components/EtlInvalidator.tsx` | 90 | 30 s poll that invalidates every non-`etl` query key, including this page's keys |
| `legacy:src/components/aceternity/GlowCard.tsx` | 37 | Decorative card wrapper (not read in full; visual only) |
| `legacy:src/components/aceternity/LoadingDots.tsx` | 17 | Loading indicator (not read in full; visual only) |

## Route `/performance` → `/performance`

### Purpose
This page compares service delivery in the **current calendar month** with the **previous calendar month** at three levels: facility, caseworker and service type. Each tab has a row of 4 KPI cards, two "top 10" horizontal bar charts and a collapsible full table with CSV export. The page header is "Performance overview" with the eyebrow text "Analytics" and the badge "MoM benchmarks" (`legacy:src/pages/Performance.tsx:595-608`). The hero subtitle reads "Monitor delivery this month vs last. Rankings use top-20% / bottom-20% thresholds by volume." (`legacy:src/pages/Performance.tsx:610`). The `DashboardLayout` subtitle is "Performance" (`:584`).

### Access
- [ ] Route guard: `ProtectedRoute` only, with no role check (`legacy:src/App.tsx:573-579`). `ProtectedRoute` renders nothing while auth is loading, redirects to `/` when there is no user, and redirects to `/change-password` when `user.password_change_required` is set (`legacy:src/components/auth/ProtectedRoute.tsx:8-20`).
- [ ] Sidebar: the entry is `{ title: "Performance", url: "/performance", icon: Gauge }` in section "Services" (`legacy:src/components/dashboard/AppSidebar.tsx:87`). No visibility rule applies to it. The filter only removes `/districts` for district users, the "Admin" section for non-admins and the "Data Pipeline" section for non-admin/non-support users (`legacy:src/components/dashboard/AppSidebar.tsx:166,169,172`), so **every authenticated user sees it**.
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). Mobile users reach the page only through the "More" menu, which opens the sidebar (`:37-47`).
- [ ] Global search: no nav entry (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`).
- [ ] In-page role/permission checks: **none**. The page has no `isAdmin`, `description`, `title` or `location` comparisons, and every user sees every control.
- [ ] Data scope: `useEffectiveDistrict` is **not** used. The district starts as `"all"` for every user (`legacy:src/pages/Performance.tsx:543`). The district dropdown lists every distinct `district` value from the national household register (`:546-557`), so a district or provincial user can pick any district or "All districts". The backend also trusts the `district` param (AUDIT.md §3.2). **QUESTION / Backend ask:** should the new page default to and lock the user's scope through `platform/scope`? The backend still returns national data on request.

### Endpoints
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2). Wrapper `getHouseholdsByDistrict("")` (`legacy:src/lib/api.ts:301-312`), called at `legacy:src/pages/Performance.tsx:546-550`.
  - Params: an empty district (path `/household/all-households/`) and no FY. Returns the **whole national household register**.
  - Fires on mount, always. React Query key `["districts-discovery", "All"]`, `staleTime: 60 * 60 * 1000` (1 h). AddUser, EditUser and CaregiverRiskRegister share the same key (`legacy:src/pages/AddUser.tsx:179`, `legacy:src/pages/EditUser.tsx:62`, `legacy:src/pages/CaregiverRiskRegister.tsx:79`). It also goes through the IndexedDB list cache under key `households_by_district:ALL` with a 60 s TTL and stale-on-error (`legacy:src/lib/api.ts:14,212-238,305-308`).
  - Post-processing: the page collects the distinct truthy `h.district` values into a Set and sorts them (`legacy:src/pages/Performance.tsx:551-557`). It uses this data **only** to build the district dropdown.
  - The new app should take the district options from `platform/scope` or config, not from a register download.
- [ ] `GET /etl/facility-list` (AUDIT.md §3.2). Wrapper `getFacilityList` (`legacy:src/lib/api.ts:1239-1242`), called at `legacy:src/pages/Performance.tsx:564`.
  - Despite the name it returns **ward** names, and a code comment notes this at `:563`. No params are sent, and the list is national.
  - Fires on mount. Key `["ward-list"]`, `staleTime: 10 * 60 * 1000`. The ward list is not filtered by the selected district.
- [ ] `GET /etl/facility-performance` (AUDIT.md §3.2). Wrapper `getFacilityPerformance` (`legacy:src/lib/api.ts:812-832`), called at `legacy:src/pages/Performance.tsx:565-569`.
  - Params: `district` is sent only when it is not `"all"`, and `ward` likewise. `from`/`to` are sent only when both `fy.fromDate` and `fy.toDate` are set, i.e. not in "All time" mode (`legacy:src/pages/Performance.tsx:560`; `legacy:src/lib/api.ts:818-827`). `facility` is never sent.
  - Backend: **ignores** `from`/`to`, works on fixed calendar months, and trusts `district` (AUDIT.md §3.2).
  - Fires on mount, whichever tab is active. Key `["facility-performance", district, ward, fyKey]`, where `fyKey` is `"all"` in all-time mode and otherwise `` `${fromDate}_${toDate}` `` (`:561`). `staleTime: 5 * 60 * 1000`.
  - Transport: `dqaGetSkipCache`, which uses a Bearer token, has no IndexedDB layer and throws `Error(data.message || "Request failed: <status>")` (`legacy:src/lib/api.ts:701-712`).
  - Returns `data ?? []`.
- [ ] `GET /etl/caseworker-performance` (AUDIT.md §3.2). Wrapper `getCaseworkerPerformance` (`legacy:src/lib/api.ts:850-870`), called at `legacy:src/pages/Performance.tsx:570-574`. Same params, firing and staleTime as above. Key `["caseworker-performance", district, ward, fyKey]`. The backend limits the result to 500 rows and computes tiers (AUDIT.md §3.2).
- [ ] `GET /etl/service-performance` (AUDIT.md §3.2). Wrapper `getServicePerformance` (`legacy:src/lib/api.ts:883-911`), called at `legacy:src/pages/Performance.tsx:575-579`.
  - Params: same as above. The wrapper accepts `type`, but the page **never passes it**, so the type filter is client-side only.
  - Key `["service-performance", district, ward, fyKey]`, `staleTime: 5 min`.
  - Returns `{ data: res.data ?? [], meta: res.meta ?? { total_vcas: 0, total_households: 0 } }` (`legacy:src/lib/api.ts:907-910`).
- [ ] Global query defaults apply to all of the above: `gcTime` 24 h, `refetchOnMount`, `refetchOnWindowFocus` and `refetchOnReconnect` all true, `retry: 1`. The query cache is persisted to IndexedDB under the key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:112-147`).
- [ ] `EtlInvalidator` polls every 30 s. When the last successful ETL run moves forward, it invalidates every query whose key does not start with `"etl"`, which covers all 5 keys above, and it clears the aux IndexedDB cache (`legacy:src/components/EtlInvalidator.tsx:28,53-85`). New app: set `meta: { etl: true }` on the three performance queries and on the ward list.

### Fields used
| Field (normalised name the page uses) | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| Household `district` | `h.district` only | district dropdown options (`:553-554`) | sorted ascending |
| ward list item | string array element | ward dropdown option value and label (`:652-653`) | raw |
| **Facility** `facility` | `facility` | bar label, table "Facility", search, row key | truncated at 260 px (`:262`) |
| `ward` | `ward` | bar sub, table "Ward", search | `"-"` when empty (`:263`) |
| `district` | `district` | bar sub, table "District", search | raw |
| `total_vcas` | `total_vcas` | table "Enrolled VCAs"; secondary sort key | `toLocaleString()` |
| `households` | `households` | table "Households" | `toLocaleString()` |
| `services_this_month` | `services_this_month` | KPI sum, bar value, table, sort key | `toLocaleString()` |
| `services_last_month` | `services_last_month` | KPI sum ("… last month") | `toLocaleString()` |
| `trend_pct` | `trend_pct` | TrendPill, "Trending up/down" counts, drop chart | `+N%` / `N%`, with an up/down/flat icon |
| **Caseworker** `caseworker_name` | `caseworker_name` | bar label, table "Caseworker", search, row key | raw |
| `ward` / `facility` / `district` | same keys | bar sub = `ward \|\| facility \|\| district \|\| ""` (`:325,330`); the table shows ward and district | `"-"` when empty |
| `services_this_month` | same | KPIs, bars, table "Services", sort | `toLocaleString()` |
| `unique_entities_this_month` | same | table "Unique" | `toLocaleString()` |
| `active_days_this_month` | same | table "Days" | raw number |
| `services_per_active_day` | same | table "Per-day" | raw number (1 dp from the backend) |
| `trend_pct` | same | TrendPill | as above |
| `tier` | same | tier filter, KPI counts, Tier badge | `TIER_BADGE` label (`:47-52`) |
| `services_last_month`, `last_active` | — | **not shown**; they appear in the CSV only | — |
| **Service** `service` | `service` | bar label, table "Service" | truncated at 280 px |
| `type` | `type` | type filter, bar sub, table "Type" | CSS `capitalize` (`:521`) |
| `this_month` / `last_month` | same | KPI sums, bars, table "Volume (this month)" | `toLocaleString()` |
| `trend_pct` | same | TrendPill, "Declining sharply", drop chart | as above |
| `unique_entities_this_month` | same | table "Unique entities" | `toLocaleString()` |
| `coverage_pct` | same | "Avg coverage" KPI, bar sub, table "Coverage" | `N%` |
| `tier` | same | tier filter, badge | `TIER_BADGE` |
| `meta.total_vcas`, `meta.total_households` | same | "Avg coverage" KPI sub | `` `${vcas} VCAs · ${hh} HH` `` (`:447`) |

### Filters / sort / pagination / search
- [ ] **District (page-level, applies to all tabs)**
  - Control: a Select with the placeholder "All districts" and a MapPin icon (`:629-642`).
  - Options: `"all"` → "All districts", followed by the distinct household districts.
  - Default: `"all"`. Not persisted (component state only, `:543`).
  - Sent to all 3 performance APIs, so it applies to KPIs, charts, tables and exports. It is part of every query key.
- [ ] **Ward (page-level)**
  - Control: a Select with the inline label "Ward" and the placeholder "All wards" (`:643-656`).
  - Options: `"all"` → "All wards", followed by every national ward. The list is **not narrowed by the selected district**.
  - Default: `"all"`. Not persisted. Sent to all 3 APIs.
- [ ] **Clear button:** shown when `district !== "all" || ward !== "all"`, labelled "Clear" with an X icon. It resets both values to `"all"` (`:657-665`).
- [ ] **FY window:** comes from the global header FY chip (`useFyFilter`, `:559`). It is persisted in the URL `?fy=` (plus `from`/`to` in custom mode) and in localStorage `ecap_plus_pmp.fy_filter_state_v2` (`legacy:src/context/FyFilterContext.tsx:12,48-55`). The page sends it to the APIs, but the backend ignores it (see Bugs).
- [ ] **Tab:** Radix Tabs with `defaultValue="facility"` and the values `facility` / `caseworker` / `service`, labelled "Facility" / "Caseworker" / "Service" (`:615-627`). Not in the URL and not persisted.
- [ ] **Facility tab search:** an Input with the placeholder "Search facility / ward / district…" (`:238`). It matches a case-insensitive substring against `facility`, `district` and `ward` (`:173-178`), with no debounce. It applies to both bar charts and to the table and CSV, but **not to the KPI cards**, which use the unfiltered `data` (`:183-187`).
- [ ] **Caseworker tab tier filter:** a Select with the options exactly as follows (`:351-355`). It applies to the bar charts, table and CSV, not to the KPIs. Default `"all"`.
  - `all` "All tiers"
  - `top` "Top performers"
  - `mid` "Average"
  - `bottom` "Under-performing"
  - `inactive` "No activity"
- [ ] **Caseworker tab search:** an Input with the placeholder "Search name / ward…" (`:358`). It matches a case-insensitive substring against `caseworker_name`, `ward` and `facility` (`:288-294`), but not `district`. No debounce. It applies to the charts, table and CSV, not to the KPIs.
- [ ] **Service tab type filter:** a client-side Select with the options exactly as follows (`:482-485`). Default `"all"`. It applies to the charts, table and CSV, not to the KPIs.
  - `all` "All types"
  - `vca` "VCA"
  - `caregiver` "Caregiver"
  - `household` "Household"
- [ ] **Service tab tier filter:** a Select with the options exactly as follows (`:491-494`). There is **no `inactive` option**. Default `"all"`.
  - `all` "All tiers"
  - `top` "Well-performing" (the badge for the same value says "High performer")
  - `mid` "Average"
  - `bottom` "Under-performing"
- [ ] **Sort** (fixed, with no user sort controls):
  - Facility: `services_this_month` desc, then `total_vcas` desc (`:180`).
  - Caseworker: `services_this_month` desc (`:296`).
  - Service: `this_month` desc (`:419`).
- [ ] **Pagination:** none. Every filtered row renders in a plain `<table>`. The tables are **collapsed by default** (`showTable=false`), and a chevron header button toggles them (`:170,228-236,245`). The header badge shows the count: "N facility/facilities", "N caseworker(s)" or "N service type(s)" (`:233,343,474`).
- [ ] Section-level state (search, tier, type, table expanded) is local to each section component. Radix `TabsContent` unmounts inactive panels, so this state resets on every tab switch. **QUESTION:** in the new app, should these be URL-synced filters per tab, as CLAUDE.md requires?

### Exports
- [ ] Three CSV exports, one per tab, each triggered by an outline "CSV" button with a Download icon (`:239-241,359-361,497-499`).
  - Helper: `exportCsv` (`:154-166`), hand-rolled with no library.
  - Rows: the **currently filtered and sorted** rows (search/tier/type applied), all of them, not just a page.
  - Headers: `Object.keys(rows[0])`, i.e. the **raw API field names in response order**, not the table headers. Every value is double-quoted with `"` escaped as `""`, and rows are joined with `\n`.
  - Blob type `text/csv`, no BOM. When there are no rows the function returns silently (`:155`).
  - Filenames: `` `${filename}-${new Date().toISOString().slice(0,10)}.csv` `` (UTC date), with the prefixes `facility-performance`, `caseworker-performance` and `service-performance`.
  - Column order follows the backend response, and the TS interfaces list the expected keys:
    - Facility (`legacy:src/lib/api.ts:801-810`): `facility, district, ward, total_vcas, households, services_this_month, services_last_month, trend_pct`.
    - Caseworker (`:835-848`): `caseworker_name, facility, ward, district, services_this_month, services_last_month, trend_pct, unique_entities_this_month, active_days_this_month, services_per_active_day, last_active, tier`.
    - Service (`:872-881`): `service, type, this_month, last_month, trend_pct, unique_entities_this_month, coverage_pct, tier`.
  - Branding: none.
  - **QUESTION:** port with human-readable headers through `platform/export`?

### Charts
All charts are CSS bars, with no chart library. `HorizontalBarChart` (`:97-152`) works as follows:
- The card title carries a badge "Top {rows.length}" (shown on the drop charts too).
- Each row shows "{i+1}. {label}", the value via `toLocaleString()` with an optional TrendPill, and a bar whose width is `value / max * 100%`.
- Bar colour cycles through a 10-colour Tailwind list (`BAR_COLORS`, `:54-58`). For `tone="rose"` every bar uses `bg-rose-500`.
- An optional sub line can appear under each row. When there are no rows the empty text shows (default "No data").

`TrendPill` (`:60-68`) uses a green up arrow when the value is above 0, a red down arrow when below 0 and a grey flat line at 0. The text is `+N%` or `N%`.

`KpiCard` (`:83-94`) shows an icon, an uppercase label, a value, an optional sub line, and a tone colour (emerald/rose/slate/blue).

Facility tab (`:183-223`):
- [ ] KPI "Services this month": Σ `services_this_month` over all rows. Sub "{Σ services_last_month} last month". Tone slate.
- [ ] KPI "Month-over-month": `round((Σthis − Σlast)/Σlast × 100)`, or 0 when Σlast is 0. Value shown as `+N%` / `N%`. Sub "All facilities combined". Tone emerald if >0, rose if <0, otherwise slate.
- [ ] KPI "Trending up": count of rows where `trend_pct > 0 && services_this_month > 0`. Sub "Facilities growing MoM". Tone emerald.
- [ ] KPI "Trending down": count of rows where `trend_pct < 0` (this includes facilities at 0 this month). Sub "Facilities declining MoM". Tone rose.
- [ ] Bar "Top facilities by volume": the top 10 filtered rows by `services_this_month`. Label is the facility; sub is `"{ward} · {district}"` (the ward part is omitted when empty); trend is `trend_pct`.
- [ ] Bar "Biggest month-over-month drops" (rose): filtered rows where `services_this_month > 0 && trend_pct < 0`, sorted by `trend_pct` ascending, top 10. Value is `Math.abs(trend_pct)`. Sub is `"{district} · {N} this month"`. Empty text "No facilities declining MoM".

Caseworker tab (`:299-332`):
- [ ] KPI "Active caseworkers": count of rows where `tier !== "inactive"`. Sub "Delivered ≥1 this month". Tone slate.
- [ ] KPI "Top performers": count of rows where `tier === "top"`. Sub "Top 20% by volume". Tone emerald.
- [ ] KPI "Under-performing": count of rows where `tier === "bottom"`. Sub "Bottom 20% by volume". Tone rose.
- [ ] KPI "Avg services / caseworker": `round(Σ services_this_month of active rows / active count)`, or 0 when there are no active rows. Sub "Among active only". Tone blue.
- [ ] Bar "Top 10 caseworkers": the first 10 filtered rows (already sorted desc).
- [ ] Bar "Lowest-volume active caseworkers" (rose): filtered rows with `services_this_month > 0`, ascending, first 10. Default empty text "No data".

Service tab (`:422-463`):
- [ ] KPI "Services delivered": Σ `this_month`. Sub "{Σ last_month} last month".
- [ ] KPI "Month-over-month": same formula as the facility KPI. Sub "All service types".
- [ ] KPI "Avg coverage": the mean of `coverage_pct` over all rows, rounded to 1 dp, shown as `N%`. Sub `"{total_vcas} VCAs · {total_households} HH"`. Tone blue.
- [ ] KPI "Declining sharply": count of rows where `trend_pct < -20 && this_month > 0`. Sub "Down >20% MoM". Tone rose.
- [ ] Bar "Top services by volume": the top 10 filtered rows by `this_month`. Sub `"{type} · {coverage_pct}% coverage"`.
- [ ] Bar "Biggest month-over-month drops" (rose): rows where `this_month > 0 && trend_pct < 0`, sorted by trend ascending, top 10. Value is `|trend_pct|`. Sub `"{type} · {N} this month"`. Empty text "No services declining MoM".

Tier badge labels and colours (`TIER_BADGE`, `:47-52`): `top` "High performer" (emerald), `mid` "Average" (slate), `bottom` "Under-performing" (rose), `inactive` "No activity" (muted slate). Colours are hardcoded Tailwind classes; the new app should map them to theme tokens.

Tables:
- [ ] Facility columns, in order: "Facility", "Ward", "District", "Enrolled VCAs", "Households", "Services (this month)", "Trend" (`:250-256`).
- [ ] Caseworker columns, in order: "Caseworker", "Ward" (with a MapPin icon), "District", "Services", "Unique", "Days", "Per-day", "Trend", "Tier" (`:370-378`).
- [ ] Service columns, in order: "Service", "Type", "Volume (this month)", "Trend", "Unique entities", "Coverage", "Tier" (`:508-514`).

### Links in / out
- [ ] In: sidebar entry (`legacy:src/components/dashboard/AppSidebar.tsx:87`). Dashboard quick-action card "Performance", described as "Facility, caseworker, and service-type benchmarks.", which calls `navigate("/performance")` with no payload (`legacy:src/pages/Dashboard.tsx:67-74,110`). No other inbound links. No query params, no `location.state` and no storage writes before navigating. The FY `?fy=` param may be carried by `FyFilterProvider`.
- [ ] Out: **none**. Rows, bars and names are not clickable, so there is no link to caseworker or facility detail. **QUESTION:** link caseworker rows to `/caseworkers/:caseworkerId`? The backend identifies caseworkers by free-text name only.

### Loading / empty / error
- [ ] Loading: while a tab's query `isLoading` (first load with no cached data), the tab body shows centred `LoadingDots` (`:670-672,678-680,686-688`). The district and ward dropdowns show no loading state; they just have no options yet. Background refetches show cached data with no indicator. New app: use skeletons.
- [ ] Empty: KPIs show 0 / `0%`. Bar charts show "No data", or the per-chart empty texts quoted above. Tables render an empty body with a "0 …" badge, and there is no `<EmptyState>`. CSV with no rows does nothing.
- [ ] Error: **not handled**. `isError` is never read, so on failure the section renders with `[]` and looks identical to "no data". There is no toast and no retry button; only the global `retry: 1` applies. The three queries fail independently, so a partial failure affects only its own tab. New app: `<ErrorState>` with retry per tab.

### Bugs and quirks
- [ ] **BUG** The FY window is sent but ignored by all three performance endpoints, which always compute the current versus previous calendar month (AUDIT.md §3.2; `legacy:src/lib/api.ts:824-827,862-865,900-903`). Changing the FY chip only fragments the cache keys (`:561`) and refetches identical data. The UI suggests FY scoping it does not have. Port: either hide the FY scope on this page or label it "calendar month", until the backend supports `from`/`to`. Record as a Backend ask.
- [ ] **BUG** No user scoping (see Access). District users can choose any district, and the backend trusts the param.
- [ ] **BUG** KPI cards use the unfiltered `data`, while the charts, tables and CSV use the search/tier/type-filtered rows (`:183-187,299-304,422-428`). The numbers on one tab therefore disagree whenever a local filter is set.
- [ ] **BUG** The ward list is national and does not narrow with the selected district (`:564,652`). A mismatched district + ward pair returns empty data.
- [ ] **BUG** The district list is built by downloading the whole national household register (`:546-557`), which is very expensive for a dropdown.
- [ ] **BUG** "Trending down" counts facilities with `trend_pct < 0` even when `services_this_month` is 0, but the drops chart excludes them (`:187` vs `:195`), so the counts and the chart disagree.
- [ ] **BUG** On the drop charts the value shown is `Math.abs(trend_pct)` with no `%` sign, followed by the TrendPill (for example "45 −45%"). The bar width is also scaled on percentage, not on volume (`:219,460`). The badge "Top N" is shown on "drops" and "lowest-volume" charts too (`:118`).
- [ ] **BUG** `TIER_BADGE[r.tier].cls` throws if the backend ever returns an unknown tier, which would crash the table (`:395-396,527-528`).
- [ ] **BUG** React row keys can collide. Facility rows use `${facility}-${ward}`, and the same facility name can appear in several districts (`:261`). Caseworker rows use `${caseworker_name}-${ward}`, but backend groups are by name+facility+district+ward (`:383`; AUDIT.md §3.2).
- [ ] **BUG** The service tier filter has no `inactive` option, so inactive services are visible only under "All tiers" (`:491-494`). The labels are also inconsistent: the filter says "Well-performing" while the badge says "High performer" for `top`.
- [ ] **BUG** The hero text says rankings use top/bottom 20% by volume (`:610`), but service tiers also use trend rules (AUDIT.md §3.2, service-performance).
- [ ] **QUESTION** The caseworker search placeholder says "name / ward" but also matches facility, and it does not match district (`:290-293`).
- [ ] **BUG** The CSV headers are raw API keys and include fields that are not shown (`last_active`, `services_last_month`). `URL.createObjectURL` is never revoked. The filename date is UTC (`:154-166`).
- [ ] **QUESTION** Facility totals ("Services this month" and MoM) inherit the backend merge bug, where services are repeated per district/ward group (AUDIT.md §3.2 facility-performance). Should the frontend dedupe by facility, or wait for a backend fix?
- [ ] Quirk: all three performance queries fire on mount whichever tab is open (`:565-579`). New app: fetch only the active tab's query (`enabled` on the active tab), or keep prefetching. Decide.
- [ ] Quirk: the date string uses the hardcoded locale `"en-GB"` with weekday/day/month/year (`:581`). Route it through `core/lib/format.ts`.
- [ ] Quirk: `(h: any)` in the district discovery (`:553`), which needs a zod normaliser.

## Other behaviour

- No modals, dialogs, forms, mutations, toasts or keyboard shortcuts.
- Decorative hero animation: two `animate-pulse` blurred blobs (6 s and 8 s) (`:589-590`), purely CSS. Per the UI rules, drop or keep it minimal.
- Storage this page touches indirectly:
  - IndexedDB `households_by_district:ALL` (list cache, `legacy:src/lib/api.ts:305-308`).
  - The persisted React Query cache `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:139-147`).
  - localStorage FY state `ecap_plus_pmp.fy_filter_state_v2` (`legacy:src/context/FyFilterContext.tsx:12`).
  - The page itself reads and writes no storage.
- Timers: per-query staleTimes (1 h, 10 min, and 5 min ×3) and the global focus/mount refetch. The `EtlInvalidator` 30 s poll invalidates this page's keys after a new ETL success (`legacy:src/components/EtlInvalidator.tsx:28,78-80`). The backend also keeps a 5-min process cache on these endpoints (AUDIT.md §3.2).
- Brand/program strings:
  - A code comment mentions the program name: "In ECAP Plus, /etl/facility-list actually returns ward names." (`:563`). It is a comment only.
  - Domain terms that belong in config/terminology: "VCAs" (`:253,447`), "HH" (`:447`), "Households" (`:254`), and the type labels "VCA"/"Caregiver"/"Household" (`:483-485`).
  - The hero eyebrow "Analytics" (`:595`).
  - The inbound card description sits at `legacy:src/pages/Dashboard.tsx:70`.

## Open questions for the developer

1. Scope: should the district selector default to and lock the user's jurisdiction (`platform/scope`), given that the backend trusts any district?
2. FY: the endpoints ignore `from`/`to`. Should the page hide the FY chip, show a "calendar month (current vs previous)" notice, or ask the backend for FY support?
3. Should the KPIs follow the in-tab search/tier/type filters (consistent) or stay on the unfiltered totals (legacy)?
4. Should the ward options be narrowed by the selected district? `/etl/facility-list` returns all wards with no district; this would need a different source or client-side mapping.
5. CSV: keep raw API keys as headers (legacy parity), or use the table headers through `platform/export`?
6. Should caseworker rows link to the caseworker profile? There is no stable caseworker ID, only a name.
7. Should the tab, district, ward and per-tab filters sync to the URL? Legacy keeps none of them.
8. Should the service tier filter gain a "No activity" option, and should the `top` label be unified ("High performer" vs "Well-performing")?
