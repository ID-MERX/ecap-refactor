# caseworkers — legacy audit

> Legacy routes → new routes: `/caseworker-journeys` → `/caseworkers/journeys`; `/profile/caseworker-details` → `/caseworkers/:caseworkerId` · Plan: MIGRATION_PLAN.md §5 row "caseworkers" ("Leaflet only in the journeys chunk"; stack row "Maps | react-leaflet + leaflet.heat | Loaded only inside the caseworker-journeys route", MIGRATION_PLAN.md stack table)

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/CaseworkerJourneys.tsx` | 934 | Journeys page: filters, Leaflet map (journey / heatmap / playback), tile switcher, fullscreen, CSV export |
| `legacy:src/pages/CaseworkerProfile.tsx` | 496 | Caseworker profile page. Routed, but **no inbound link anywhere in `src`** (orphan; see Links in) |
| `legacy:src/App.tsx` | 602 | Lazy imports (`:74-76`, `:108-110`) and routes (`:365-372`, `:565-572`) |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Guard used by both routes |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar entry for journeys (`:88-92`), visibility filter (`:147-181`) |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | No caseworker entry |
| `legacy:src/components/dashboard/GlobalSearch.tsx` | 212 | No caseworker entry |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | Not used by either caseworker page |
| `legacy:src/lib/api.ts` (parts: `:7-14`, `:212-239`, `:301-313`, `:410-426`, `:499-506`, `:701-712`, `:1116-1242`) | — | Wrappers `getCaseworkerJourneys`, `getCaseworkerList`, `getFacilityList`, `getHouseholdsByDistrict`, `get*ServicesByDistrict`, `dqaGetSkipCache`, `getListFromApiWithCache` |
| `legacy:src/lib/data-validation.ts` (`isCategoryProvided`, `:10-~65`) | — | Domain "provided?" check used by the profile |
| `legacy:src/lib/utils.ts` (`normalizePlaceName :35-49`, `dedupePlaceNames :55-64`) | — | Title-case place names / case-insensitive dedupe |
| `legacy:src/components/dashboard/MetricsGrid.tsx` (`:170`, `:225-238`, `:112`) | — | Dashboard "Caseworkers" KPI card links to journeys |
| `legacy:src/pages/Dashboard.tsx` (`:18`, `:52-58`, `:105-110`) | — | Quick action "Caseworker journeys" |

## Route `/caseworker-journeys` → `/caseworkers/journeys`

### Purpose
GPS map of field visits for a caseworker and/or date range and/or ward. Hero texts: eyebrow "Global positioning system" · long date · badge "Live GPS" (`legacy:src/pages/CaseworkerJourneys.tsx:475-480`); title "Caseworker journeys" with badge "Map · Heatmap · Playback" (`:482-489`); subtitle "Track and visualize field visits, movement patterns, and GPS-tagged form submissions." (`:490`). Layout subtitle "Caseworker Journeys" (`:463`).

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:565-572`). `ProtectedRoute` redirects to `/` when no user and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`).
- [ ] Sidebar: section "Services", item `{ title: "Caseworker Journeys", url: "/caseworker-journeys", icon: MapPin }` (`legacy:src/components/dashboard/AppSidebar.tsx:88-92`). No item-specific rule; visible to every logged-in user (filters at `:164-176` only touch `/districts`, "Admin", "Data Pipeline"). Active state is exact `pathname === url` (`:183`).
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`); reachable via "More" (opens sidebar, `:37-46`).
- [ ] Global search: no navigation entry (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`). New search should add a "Caseworker journeys" nav entry and a caseworker provider (MIGRATION_PLAN mentions caseworkers in the search endpoint plan).
- [ ] In-page role checks (string comparisons; port to `can()`/scope):
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/CaseworkerJourneys.tsx:230`)
  - `const isProvincialUser = user?.description === "Provincial User";` (`:231`)
  - `const userDistrict = isDistrictUser ? (user?.location ?? undefined) : undefined;` (`:232`)
  - `const userProvince = isProvincialUser ? (user?.title ?? undefined) : undefined;` (`:233`)
  - Admin/others: full list (`:248`, `:296`).
- [ ] Data scope:
  - Caseworker dropdown: full national list fetched (`getCaseworkerList()` with no scope, `:240-244`), then filtered client-side: district users by `cw.district`, provincial users by `cw.province`, trimmed + lower-cased exact match (`:246-256`). **If the scoped list is empty, the full national list is shown** (`:253-255`) — see BUG.
  - Ward dropdown: admins get full `/etl/facility-list`; district/provincial users get only wards that appear as `cw.facility` on their scoped caseworkers (case-insensitive set intersection), or `[]` when none (`:294-305`); then `dedupePlaceNames` + `localeCompare` sort (`:308`).
  - Journey points: **no district/province is sent** (`legacy:src/lib/api.ts:1148-1155`); backend ignores scope (AUDIT.md §3.2). `useEffectiveDistrict` is not used.
  - No fiscal-year context is used; only the page's own from/to.

### Endpoints
- [ ] `GET /etl/caseworker-list` (AUDIT.md §3.2) — wrapper `getCaseworkerList` (`legacy:src/lib/api.ts:1162-1237`) via `dqaGetSkipCache` (raw fetch + bearer token, no client cache; `:701-712`). Called with no args, so no `district`/`province` params (`legacy:src/pages/CaseworkerJourneys.tsx:242`). Fires on mount. Key `["caseworker-list", "full", "v2"]`, `staleTime: 10 * 60 * 1000` (`:240-244`); global defaults otherwise (staleTime 60s, gcTime 24h, refetch on mount/focus/reconnect, retry 1 — `legacy:src/App.tsx:112-130`) and IndexedDB persistence of the query cache (`legacy:src/App.tsx:133+`).
  - Normaliser (port into `schemas.ts`): `caseworker` = first non-empty trimmed of `caseworker, provider, provider_id, providerId, username, user_name, caseworker_name, display_name, name`; `display_name` = first of `display_name, caseworker_name, full_name, name`, else `caseworker`; `location_id` = `location_id, locationId`; `facility` = `facility, ward, location_name`; `district`; `province`; `has_gps` = first non-nullish of `has_gps, hasGps, gps_available, has_gps_data, gps_count, gps_points, gps_events, journey_points`, else `false`. Rows without `caseworker` dropped; dedupe case-insensitive on `caseworker` (`legacy:src/lib/api.ts:1173-1236`). Backend actually returns only `caseworker, display_name, facility (=ward), district, province, has_gps (boolean)` (AUDIT.md §3.2).
- [ ] `GET /etl/facility-list` (AUDIT.md §3.2) — wrapper `getFacilityList` (`legacy:src/lib/api.ts:1239-1242`), returns `data?.data ?? []` (string[] of **ward** names). Fires on mount. Key `["facility-list"]`, `staleTime: 10 * 60 * 1000` (`legacy:src/pages/CaseworkerJourneys.tsx:284-288`). Note Performance uses key `["ward-list"]` and users module `["etl","ward-list"]` for the same endpoint (AUDIT.md §3.2) — new code should share one key from one module.
- [ ] `GET /etl/caseworker-journeys` (AUDIT.md §3.2) — wrapper `getCaseworkerJourneys` (`legacy:src/lib/api.ts:1142-1160`) via `dqaGetSkipCache`; returns `data?.data ?? []`.
  - Params as sent: `caseworker` (only if set and `!== "all"`), `from`, `to` (`yyyy-MM-dd`, formatted with date-fns `format(d, "yyyy-MM-dd")`, `legacy:src/pages/CaseworkerJourneys.tsx:400-401`), `facility` (only if set and `!== "all"`; carries a **ward name**) (`legacy:src/lib/api.ts:1148-1155`).
  - Fires only after **Apply** and only when `hasServerFilter` = caseworker (not "all") || from || to || facility (not "all") (`legacy:src/pages/CaseworkerJourneys.tsx:258-260, 275`). Backend returns 400 "Select a caseworker, ward, or date range to load GPS data" with no filter (AUDIT.md §3.2).
  - Key `["caseworker-journeys", caseworker, from, to, facility]` (applied values), `staleTime: 5 * 60 * 1000` (`:266, 274`).
  - Response is capped at 500 most-recent events server-side; no pagination (AUDIT.md §3.2). New UI should show a "showing latest 500" notice when the count hits 500 (**QUESTION**).
  - Client post-processing pipeline (port as pure, unit-tested helpers in `model/`):
    1. `allValidPoints`: drop points where `lat`/`lng` null or `isNaN(Number(...))` (`:278-281`). Note `Number("") === 0` so empty-string coordinates pass as (0,0) — see BUG.
    2. `filteredPoints`: live client-side ward filter on **unapplied** `selectedFacility`: keep `p.facility` (lower) where `f === filter || f.includes(filter) || filter.includes(f)` (`:312-321`).
    3. `validPoints`: group by `${entity_id || household_id || round(lat*1e4),round(lng*1e4)}::${visit_date.slice(0,10)}`; first point is representative; adds `visit_count` and `visit_form_types` (unique truthy `form_type`s) (`:328-349`).
    4. `sortedPoints`: ascending by `new Date(visit_date)` (`:351-354`); `polylinePositions` from sorted (`:356-359`).
    5. `heatmapData`: `[lat, lng, min(0.3 + 0.15 * visit_count, 1)]` per grouped point (`:361-367`).
    6. `mapCenter`: first sorted position, else `ZAMBIA_CENTER = [-13.1339, 27.8493]`; zoom 13 with data else `DEFAULT_ZOOM = 6` (`:38-39, 369-374`). Centre/zoom must come from `@/config` (geography).
    7. `dateRange`: min/max of `visit_date` strings (lexicographic sort) (`:376-380`).

### Fields used
| Field (normalised) | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| caseworker id | see normaliser (`caseworker` …) | combobox value, query param, CSV "Caseworker", filename | raw |
| display name | `display_name`, `caseworker_name`, `full_name`, `name`, else id | combobox label, applied-filter badge (`:537`, `:581`, `:734`) | raw |
| caseworker ward | `facility`, `ward`, `location_name` | combobox group heading, search haystack, auto-sets ward filter, scoped ward list (`:575-590`, `:298-300`) | `normalizePlaceName` in heading |
| caseworker district | `district` | "District:" badge of the applied caseworker (`:738-751`); scope filter | `normalizePlaceName` |
| caseworker province | `province` | scope filter only | — |
| has GPS | `has_gps ?? hasGps ?? gps_available ?? has_gps_data` (bool / number>0 / "true","1","yes","y" vs "false","0","no","n",""), else `Number(gps_count ?? gps_points ?? gps_events ?? journey_points ?? 0) > 0` (`:169-181`) | "GPS" / "No GPS" pill in combobox (`:597-601`) | — |
| visit_date | `visit_date` (OpenSRP `dateCreated` text) | popups, playback info, period, sort, grouping, CSV | `toLocaleString("en-GB", {day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"})` (`:149`, `:825`, `:886`); period uses date only (`:762`). Port via `core/lib/format.ts` |
| form_type | `form_type` (OpenSRP `entityType`) | visit category label; CSV "Form Type" after `cleanFormType` | `categorizeVisit` / `visitLabel` (below) |
| lat / lng | `lat`, `lng` (strings) | markers, polyline, heatmap, CSV | `Number()` |
| facility (point) | `facility` (core.location name) | popup heading, playback info, client ward filter, CSV "Facility" | `normalizePlaceName` in UI; raw in CSV |
| household_id | `household_id` | popup / playback "ID: …"; grouping fallback | raw |
| entity_id | `entity_id` | grouping key only | — |

- [ ] `categorizeVisit(formType)` (`:80-101`), lower-cased substring rules in order: empty → "Visit"; contains any of `household`, `caregiver`, `mother`, `pmtct_mother`, `hh_` → "Household Visit"; any of `vca`, `child`, `client`, `hiv_assessment`, `hiv_testing`, `muac`, `grad`, `pmtct_child` → "Child Visit"; else "Visit". (Note `pmtct_child` contains no earlier household keyword, but "mother" check precedes; order matters.) These are domain terms → labels via config terms.
- [ ] `visitLabel(types)` (`:103-113`): set of categories; 0 → "Visit"; 1 → that one; has both Household and Child → "Household & Child Visit"; else joined ", ".
- [ ] `cleanFormType(raw)` for CSV: `String(raw ?? "").replace(/^(ec[-_]?(pmp|app|plus)?[-_]?)+/i, "").trim()` (`:411-414`).

### Filters / sort / pagination / search
- [ ] **Time Period** preset pill group (`:504-520`), options `TIME_PRESETS` = "This Week" (7 days), "This Month" (30), "This Quarter" (90), "All Time" (0) (`:158-163`). Default "All Time" (`:187`). Selecting sets `fromDate = today - days`, `toDate = today` (rolling windows, not calendar periods); "All Time" clears both (`:382-395`). Only takes effect after Apply. Not persisted.
- [ ] **Caseworker** combobox (Popover + cmdk Command) (`:523-613`): trigger label "All Caseworkers" when empty/"all", else display name, fallback "Select Caseworker" (`:534-538`). Search placeholder "Search caseworker, ward, facility…" (`:551`); empty text "No caseworker found." (`:553`). Group "Quick" with item "All Caseworkers" (value `"all-caseworkers"`, sets `"all"`) (`:554-565`). Then caseworkers sorted by `facility` (missing → "zzz", i.e. last) then label `localeCompare`, grouped under heading `normalizePlaceName(facility || "Unassigned")` (`:566-579`). Item value `${caseworker}::${label} ${facility}`; custom filter = case-insensitive substring of that value (also matches the id) (`:544-549`, `:582-586`). No debounce. Selecting a caseworker **also sets the Ward filter** to `cw.facility` when present (`:588-591`). Default "" (none). Not persisted.
- [ ] **From** / **To** date pickers (Popover + Calendar single mode), label "Pick date" when empty, display `format(d, "dd MMM yyyy")` (`:614-641`). Picking a date does not change the preset highlight. Not persisted. No validation that from ≤ to.
- [ ] **Ward** select (`:642-653`): label "Ward", options "All Wards" (value `all`) + `facilities` list (see scope). Default "all". Applies **live, client-side** to the loaded points (no Apply needed) and is also sent server-side as `facility` on Apply (`:402`, `:311-321`).
- [ ] **Apply** button (`:655-661`): disabled while loading; shows spinner "Loading..." else "Apply". Copies UI state into `appliedFilters` and resets playback (`:397-406`).
- [ ] **Clear Filters** ghost button (`:665-677`): resets caseworker "", dates, preset "All Time", ward "all", applied filters, playback, view mode "journey".
- [ ] Applied-filter summary under the map title, only when points exist (`:727-767`): "Caseworker: <display name>" (when applied caseworker ≠ all), "District: <normalised>" (from the applied caseworker's list row), "Points: <grouped count>", "Period: <from> — <to>".
- [ ] Sort: points sorted by visit_date ascending for polyline/playback; markers render in grouping order. No table, no pagination.
- [ ] New app: filters should be declarative `platform/filters` synced to URL (caseworker, from, to, ward, view, tile) — legacy has no URL state (**QUESTION** whether to keep explicit Apply).

### Map (layers, tiles, markers, heatmap, playback)
- [ ] Libraries: `react-leaflet` (`MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap`), `leaflet`, `leaflet/dist/leaflet.css`, `leaflet.heat` (`:4-7`); versions `leaflet ^1.9.4`, `react-leaflet ^4.2.1`, `leaflet.heat ^0.2.0` (`legacy:package.json:63-73`). Must stay in the journeys chunk only.
- [ ] `MapContainer` props: `center={mapCenter} zoom={mapZoom} maxZoom={20}` (`MAP_MAX_ZOOM`, `:74`), `scrollWheelZoom`, full size; container `h-[500px]`, or `h-[calc(100vh-130px)]` in fullscreen (`:834`, `:861`).
- [ ] Tile providers `TILE_LAYERS` (`:50-72`) — external services; move URLs/attributions to config:
  - `map` — label "Map", icon Layers, URL `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png` (CARTO Voyager; the comment says "Positron", but the URL is Voyager — **QUESTION**), attribution "© OpenStreetMap contributors © CARTO" with links, `maxNativeZoom: 19`, `maxZoom: 20`.
  - `satellite` — label "Satellite", icon Satellite, URL `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`, attribution "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community", `maxNativeZoom: 17`, `maxZoom: 20`.
  - Toggle: pill top-left over the map (`z-[400]`), one button per mode, `aria-pressed`, title "Show map view"/"Show satellite view"; default `map` (`:205`, `:835-860`). `TileLayer key={tileMode}` remounts on switch (`:862-868`). Not persisted.
- [ ] View mode switcher "Journey" / "Heatmap" / "Playback", only shown when points exist (`:694-715`); default "journey" (`:199`). Switching stops playback; "Playback" also resets index to 0.
- [ ] **Journey** view (`:871-904`): one `CircleMarker` per grouped point; radius `5`, or `min(5 + sqrt(visits) * 2, 12)` when visits > 1; colour/fill `#3b82f6`, fillOpacity 0.8, weight 1 (`:874-881`). Popup: facility (normalised, bold), "ID: <household_id>", formatted date-time, then either badge "<n> visits" + `visitLabel(types)` or `categorizeVisit(form_type)` (`:882-896`). Polyline through all sorted points when >1, `#3b82f6`, weight 3, opacity 0.7 (`:900-902`). Colours → theme tokens.
- [ ] **Heatmap** view (`:907`, `HeatmapLayer :116-129`): `L.heatLayer(points, { radius: 20, blur: 15, maxZoom: 17, gradient: { 0.2: "#3b82f6", 0.4: "#10b981", 0.6: "#f59e0b", 0.8: "#ef4444", 1.0: "#dc2626" } })`; removed on unmount/points change; nothing added when empty. Weight per point per heatmapData above.
- [ ] **Playback** view (`:910-921`, controls `:800-832`, timer `:441-454`):
  - Controls above map: SkipBack (index 0, stop), Play/Pause (red when playing), SkipForward (last, stop), range slider `0..n-1` (dragging stops play), counter "<i+1> / <n>".
  - Info line: formatted date-time, facility (normalised), "ID: <household_id>", category.
  - `setInterval` every **800 ms** advancing index; stops at the end; pressing Play at the end restarts from 0 (`:431-439`). Interval cleared on pause/unmount.
  - Trail polyline of points `0..i`, `#10b981`, weight 3, opacity 0.6; past points as small `CircleMarker` radius 3 `#94a3b8` fillOpacity 0.5; current point `PlaybackMarker` radius 10 `#ef4444` weight 3 with popup "Current Position", facility, date-time, category; map `panTo(position, {animate: true, duration: 0.3})` on each step (`:132-156`).
- [ ] **Fullscreen** toggle button (`:716-724`): title "Expand to fullscreen" / "Exit fullscreen (Esc)", label "Fullscreen"/"Exit" (hidden on mobile). Fullscreen = wrapper `fixed inset-0 z-[1000] bg-white overflow-auto` (`:683`); Escape key listener on `document` and `document.body.style.overflow = "hidden"` while open, restored on exit (`:206-218`). Not the browser Fullscreen API.

### Exports
- [ ] **Export CSV** button (`:662-664`), disabled when no grouped points. Handler `handleExportCsv` (`:416-428`), hand-rolled CSV, Blob `text/csv`, anchor click. Filename: `` `caseworker-journeys-${appliedFilters.caseworker}-${new Date().toISOString().slice(0, 10)}.csv` `` (`:426`). Rows: `validPoints` (grouped one-per-entity-per-day, after the client ward filter; **not** raw events). Columns in order:
  1. "Caseworker" ← `p.caseworker` (quoted)
  2. "Facility" ← `p.facility || ""` (quoted, raw)
  3. "Visit Date" ← `p.visit_date` (quoted, raw text)
  4. "Form Type" ← `cleanFormType(p.form_type)` (quoted)
  5. "Latitude" ← `p.lat ?? ""`
  6. "Longitude" ← `p.lng ?? ""`
  No PDF/XLSX; no branding strings. New: use `platform/export`.

### Charts
- [ ] No charts/KPI cards beyond the map summary ("Points:" count = grouped points, "Period:").

### Links in / out
- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:88-92`); Dashboard quick action "Caseworker journeys" — "GPS visit map, heatmap, and playback by caseworker." `navigate(a.to)` with no state (`legacy:src/pages/Dashboard.tsx:52-58, 105-110`); Dashboard MetricsGrid "Caseworkers" KPI card `to: "/caseworker-journeys"`, `navigate(to)` no state (`legacy:src/components/dashboard/MetricsGrid.tsx:225-233, 112`). No query params, location.state or storage keys are written by callers.
- [ ] Out: none. Journeys does **not** link to the caseworker profile, the household profile (despite showing household IDs in popups) or anywhere else. **QUESTION:** new app should probably link popup "ID" to `/households/:householdId` and caseworker name to `/caseworkers/:caseworkerId`.

### Loading / empty / error
- [ ] Lists (caseworkers, wards): no loading/error UI; dropdowns just stay empty.
- [ ] Map area states, in order (`:770-797`), each in a 500px (or fullscreen-height) panel:
  - loading: spinner + "Loading GPS data..."
  - error: red panel "Failed to load journey data." (no retry button)
  - no server filter applied: "Select a caseworker or date range" / "Choose a caseworker or set a date range, then click Apply. You can also filter by facility after data loads."
  - no points: "No GPS data found for this caseworker" / "Try a different date range or caseworker."
- [ ] New: skeleton, `<EmptyState>`, `<ErrorState>` with retry.

### Bugs and quirks
- [ ] **BUG** Scope fallback leaks the national caseworker list to district/provincial users whenever no record matches their location/title (`legacy:src/pages/CaseworkerJourneys.tsx:253-255`); and the journeys endpoint has no server scope at all, so any user can fetch any caseworker's GPS trail + household IDs (AUDIT.md §3.2). Record in PROGRESS "Backend asks"; scope must come from `platform/scope`, not role strings (`:230-233`).
- [ ] **BUG** Ward filter is applied twice with different values: the applied value goes to the server as `facility`, while the live unapplied `selectedFacility` filters client-side (`:402`, `:312-321`). Changing the ward after Apply filters the old server result instead of refetching, often to nothing.
- [ ] **BUG** Ward list comes from `children.ward` (`/etl/facility-list`, misnamed), but point `facility` is the `core.location` name and the server resolves `facility` by fuzzy `LIKE` on location names (AUDIT.md §3.2). Ward and facility are different vocabularies, so the filter matches loosely or not at all.
- [ ] **BUG** Picking a caseworker silently sets the Ward filter to the caseworker's ward (`:590`), which is then sent server-side and can hide visits in other locations.
- [ ] **BUG** Client ward match `filter.includes(f)` is true for `f === ""`, so points without facility always pass the ward filter (`:316-317`).
- [ ] **BUG** `Number("")` is `0`, so empty-string coordinates pass the validity check and plot at (0,0) in the Gulf of Guinea (`:279`); backend can return `""` (AUDIT.md §3.2). Treat `""` as missing.
- [ ] **BUG** `to` date is sent as bare `yyyy-MM-dd` and compared as text against an ISO timestamp, so visits on the `to` day are excluded (AUDIT.md §3.2). New UI should send `to` + 1 day or a full timestamp (**QUESTION** backend fix).
- [ ] **BUG** Manually picking From/To leaves the old preset pill highlighted (`:187`, `:513`, `:624`, `:638`). Presets are rolling day counts labelled "This Week/Month/Quarter".
- [ ] **BUG** CSV values are wrapped in quotes without escaping embedded `"` (`:420`); object URL never revoked (`:425`); filename contains `""` or `all` when no caseworker is applied (`:426`); export holds grouped rows, not raw visits, and drops `visit_count`.
- [ ] **BUG** Empty-state text says "for this caseworker" even when only a date range or ward was used (`:793`).
- [ ] **BUG** Fullscreen changes the container height without calling `map.invalidateSize()`, so Leaflet can render grey/missing tiles until a resize (`:683`, `:834`) — needs runtime check (**QUESTION**).
- [ ] Quirk: `MapContainer` `center`/`zoom` are initial-only in react-leaflet 4; the map recentres only because the loading branch remounts it; a client-side ward change keeps the old view (`:861`).
- [ ] Quirk: "Live GPS" badge is decorative; data is not live (`:478-480`).
- [ ] Quirk: `has_gps=true` does not guarantee journeys returns rows (AUDIT.md §3.2).
- [ ] Quirk: marker keys use array index (`:880`, `:916`); dates/times use hardcoded `en-GB` locale (`:149`, `:460`, `:762`, `:825`, `:886`).
- [ ] Quirk: legacy frontend type expects `location_id` that the backend never returns (`legacy:src/lib/api.ts:1128`).

---

## Route `/profile/caseworker-details` → `/caseworkers/:caseworkerId`

### Purpose
Single-caseworker summary: banner, KPIs, domain coverage, households served, latest 50 services — computed client-side from the full national service datasets.

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:365-372`).
- [ ] Sidebar / mobile nav / global search: no entry (`AppSidebar.tsx:45-114`, `MobileBottomNav.tsx:5-11`, `GlobalSearch.tsx:33-46`).
- [ ] In-page role checks: none.
- [ ] Data scope: **none**. Every query passes `""` (= all districts) regardless of user role (`legacy:src/pages/CaseworkerProfile.tsx:79, 85, 91, 97`); `useEffectiveDistrict` not used. New page must apply `platform/scope`.

### How the page gets its record
- [ ] Caseworker identity = **display name string** from `location.state.name`; written to `sessionStorage["ecap_last_cw_name"]` when present, else read back from it (`:66-74`). No route param, no ID. New page: read `:caseworkerId` (OpenSRP username from `/etl/caseworker-list`) from route params, resolve display name via the caseworker list, never from state/storage.
- [ ] Services are attributed to the caseworker when `resolveCw(s).toLowerCase() === cwName.toLowerCase()` (`:132-140`), where `resolveCw` = first of `s.caseworker_name, s.caseworkerName, s.cwac_member_name, s.caseworker`, else the household's caseworker from `householdCwMap[s.household_id || s.hh_id]` (`:119-129`). `householdCwMap` built from the household register: id `household_id || hh_id` → `caseworker_name || cwac_member_name || caseworker` (`:108-116`).

### Endpoints
All four fire on mount, unconditionally (even with no name), via `getListFromApiWithCache` (IndexedDB envelope cache; returns cached value within TTL, stale cache on error; `legacy:src/lib/api.ts:212-239`):
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) with district `""` → path `/household/all-households/` — `getHouseholdsByDistrict("")` (`legacy:src/lib/api.ts:301-313`), IDB key `households_by_district:ALL`, TTL `LIST_CACHE_TTL_MS` 60s (`:14`). Query key `["cw-profile-hh-list"]`, `staleTime: 30 min` (`legacy:src/pages/CaseworkerProfile.tsx:77-81`). No FY.
- [ ] `GET /household/caregiver-services-by-district/:district(*)` (AUDIT.md §3.2), `""` — `getCaregiverServicesByDistrict` (`legacy:src/lib/api.ts:410-416`), IDB key `caregiver_services_by_district:ALL`, TTL 5 min (`:8`). Query key `["cw-profile-cg-services"]`, `staleTime: 10 min` (`:83-87`).
- [ ] `GET /child/vca-services-by-district/:district(*)` (AUDIT.md §3.2), `""` — `getVcaServicesByDistrict` (`legacy:src/lib/api.ts:499-506`), IDB key `vca_services_by_district:ALL`. Query key `["cw-profile-vca-services"]`, `staleTime: 10 min` (`:89-93`).
- [ ] `GET /household/household-services-by-district/:district(*)` (AUDIT.md §3.2), `""` — `getHouseholdServicesByDistrict` (`legacy:src/lib/api.ts:419-426`), IDB key `household_services_by_district:ALL`. Query key `["cw-profile-hh-services"]`, `staleTime: 10 min` (`:95-99`).
- [ ] All three service lists are concatenated and filtered client-side (`:137`). **QUESTION:** new page should use a caseworker-scoped endpoint (backend ask) instead of downloading national service tables; `/etl/caseworker-performance` is an alternative source of per-caseworker stats.

### Fields used
| Field | Raw keys tried (order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| caseworker name | `caseworker_name`, `caseworkerName`, `cwac_member_name`, `caseworker`, then household map (`:119-129`) | attribution filter | case-insensitive compare |
| household caseworker | `caseworker_name`, `cwac_member_name`, `caseworker` (`:112`) | household → caseworker map | — |
| household id | `household_id`, `hh_id` (`:111`, `:120`, `:152`, `:190`, `:453`) | unique-household count, tables, row link | raw; "N/A" in history when missing |
| service date | `service_date`, `visit_date`, `date` (`safeDate :43-46`) | last service, sort, tables | raw string, "N/A" when missing |
| district | `district` | district counts → primary district; tables | raw; "Unknown" in counts, "N/A" in tables |
| health / schooled / safe / stable | `health_services`, `schooled_services`, `safe_services`, `stable_services` via `isCategoryProvided` | KPIs, domain badges, dots, history badges | `isCategoryProvided` (`legacy:src/lib/data-validation.ts:10+`): falsy → no; JSON-looking strings parsed; arrays count items not in `not applicable, none, null, n/a, na, no, false, 0, ""`; scalars likewise plus `[]`, `{}` |

### Page content
- [ ] Banner (`:239-308`): avatar initials = first letters of the first two words, upper-case (`:228-233`); badges "Caseworker" and `<primary district>`; h1 name; "<n> services recorded", "<n> households served", "Primary district: <d>"; **Back** button `navigate(-1)`. Metadata strip: "Role: Community Caseworker" (hardcoded domain term → config), "<n> total interventions", "Last service: <date of newest service or N/A>". Layout subtitle `Caseworker: <name>` (`:236`).
- [ ] Stats (`:143-173`): totalServices = matched rows; uniqueHouseholds = distinct household ids; primaryDistrict = district with most rows (ties: first in sort), "N/A" when none; health/schooled/safe/stable = rows where the domain is provided.
- [ ] KPI cards (`:311-330`): "Total Services", "Households Served", "Health Services", "Safe Services" (schooled/stable have no card), `toLocaleString()`.
- [ ] "Service Domain Coverage" (`:333-346`): `DomainBadge` for Health / Schooled / Safe / Stable, "✓ Yes" when count > 0 else "✗ No" (`:50-60`).
- [ ] "Households Served" table (`:349-422`): subtitle "<n> unique households", badge "<n> total"; columns "Household ID", "District", "Domains" (coloured dots for each provided domain + "<k>/4"), "Last Service", "Visits" (row count). Sorted by visits desc (`:201`). Row click → household profile. Empty row "No household data found". Scroll box max 380px, sticky header. Client-side, no pagination/search/sort controls.
- [ ] "Recent Service History" table (`:425-489`): subtitle "Latest 50 service records"; columns "Household ID", "Service Date", "Services Provided" (badges Health/Schooled/Safe/Stable or "–"), "District". Sorted by `Date.parse(safeDate)` desc, unparseable → 0, top 50 (`:176-184`). Empty row "No service records found". Rows not clickable.
- [ ] No filters, exports or charts.

### Links in / out
- [ ] In: **none**. Grep of `legacy:src` for `caseworker-details` finds only the route (`legacy:src/App.tsx:366`); no page navigates here with `state.name`. Only reachable by typing the URL, and then only if `ecap_last_cw_name` is already in sessionStorage (it is written only by this page, `:70`). Effectively dead. New app: link from journeys (caseworker badge/combobox) and Performance caseworker rows (**QUESTION**, Performance audit).
- [ ] Out: household row click → `navigate("/profile/household-details", { state: { id: hh.id } })` (`:384`) → new `/households/:householdId`. Back buttons `navigate(-1)` (`:221`, `:281`).

### Loading / empty / error
- [ ] Loading: full-page `LoadingDots` while **any** of the four queries is loading (`:101-105`, `:204-212`).
- [ ] No name: `EmptyState` title "No caseworker selected", description "Navigate to a caseworker from the Caseworker Journeys page.", action "Back" (`navigate(-1)`), layout subtitle "Caseworker not found" (`:214-226`). Checked only after loading finishes.
- [ ] Errors: not handled; failed queries yield empty data and zero stats, no message.

### Bugs and quirks
- [ ] **BUG** Record identified by display name from `location.state`/sessionStorage, not a route param (`:66-74`); name collisions merge different caseworkers; a refresh in a new tab loses it.
- [ ] **BUG** Downloads full national household register and all three national service tables for any user regardless of scope (`:79-97`) — data exposure + performance. Backend ask.
- [ ] **BUG** `lastDate` uses string comparison with "N/A" for missing dates; `"N/A" > "2025-…"` so any undated service makes the household's Last Service "N/A" (`:194-195`).
- [ ] **BUG** All four national datasets load even when no name is available, before the empty state can show (`:204-214`).
- [ ] **BUG** Dead route: nothing links here (see Links in), and the empty state points users to Journeys, which has no link either (`:220`).
- [ ] Quirk: "Visits" counts service rows (each service record), not distinct visit dates (`:193`).
- [ ] Quirk: query keys lack scope; IDB cache keys `*_by_district:ALL` are shared with other pages (risk registers, Referrals) (AUDIT.md §3.2).

---

## Other behaviour

- [ ] Storage: `sessionStorage["ecap_last_cw_name"]` written/read by the profile (`legacy:src/pages/CaseworkerProfile.tsx:70, 73`) — drop (route params). IndexedDB list cache entries `households_by_district:ALL`, `caregiver_services_by_district:ALL`, `vca_services_by_district:ALL`, `household_services_by_district:ALL` via `getListFromApiWithCache` (`legacy:src/lib/api.ts:212-239`); plus the app-wide persisted React Query cache (`legacy:src/App.tsx:133+`). Journeys uses no storage. New: journeys data contains precise GPS + household IDs → `meta: { persist: false }` (**QUESTION**).
- [ ] Timers: playback `setInterval` 800 ms (`legacy:src/pages/CaseworkerJourneys.tsx:441-454`); no polling; leaflet `panTo` animation 0.3 s (`:135`).
- [ ] Keyboard: Escape exits map fullscreen (`:206-211`). Global Ctrl/Cmd+K search (shell).
- [ ] Browser APIs: `document.addEventListener("keydown")`, `document.body.style.overflow` lock (`:211-216`), `Blob` + `URL.createObjectURL` + anchor click (`:423-427`).
- [ ] External services: CARTO and Esri tile servers (`:54`, `:63`) — must be listed in CSP/config.
- [ ] Hardcoded program/geography: `ZAMBIA_CENTER = [-13.1339, 27.8493]`, `DEFAULT_ZOOM = 6` (`:38-39`); comments mention Zambia (`:45`, `:67`); "Role: Community Caseworker" (`CaseworkerProfile.tsx:296`); visit categories "Household Visit"/"Child Visit" and OpenSRP form-type keywords (`:80-113`); `ec`/`pmp`/`app`/`plus` form-type prefix regex (`:413`); role descriptions "District User"/"Provincial User" (`:230-231`).
- [ ] Not used by this module: WebRTC calls, support chat, voice notes (dropped per decision 4); no Directus calls.

## Open questions for the developer

1. Profile identity: should `/caseworkers/:caseworkerId` use the OpenSRP username (`caseworker` from `/etl/caseworker-list`, which journeys already uses) and resolve services by display name until a backend endpoint by username exists?
2. Profile data source: request a scoped per-caseworker endpoint (backend ask) rather than downloading national service tables? Or reuse `/etl/caseworker-performance`?
3. Should District/Provincial users without a matching caseworker see an empty list (secure) rather than the national fallback?
4. Ward vs facility: keep the Ward filter (children.ward) or switch to a real facility/location list that matches journey point `facility`? Should the ward filter be server-side only (refetch) rather than live client-side?
5. Keep the explicit Apply button, or apply filters on change with URL sync?
6. Tile basemap: Voyager (as coded) or Positron (as commented)? Tile URLs in config?
7. Show a "latest 500 events" truncation notice?
8. Should map popups link household IDs to `/households/:householdId` and journeys link to the caseworker profile?
9. Should the `to` date be made inclusive client-side (send next day) until the backend compares dates properly?

## Phase 5 implementation decision and status (2026-11-03)

The user approved a **default-off scaffold**. `module.caseworkers` is false by default until the backend enforces caller-derived scope for journey events and caseworker lists and provides a scoped profile source. Precise GPS coordinates plus household IDs must not be downloaded to district/province clients without that boundary.

- `/caseworkers/journeys` and `/caseworkers/:caseworkerId` are registered under `records.view` with district-or-higher scope, but the feature flag removes their routes and nav by default.
- When intentionally opened for the scaffold, both routes show an unavailable state and make no calls to `/etl/caseworker-list`, `/etl/caseworker-journeys`, national household/service lists, or map tile providers. Leaflet is not loaded.
- The future `caseworkerId` is the stable OpenSRP username (`caseworker` from the scoped caseworker list), not a display name, location state, or session storage value. No by-ID fetch occurs until a caller-scoped profile endpoint exists.
- The legacy journeys URL redirects to `/caseworkers/journeys`. The old profile URL has no stable ID, so it also redirects to journeys for a future explicit selection; it does not guess a caseworker by name.

Backend follow-up before enabling: enforce authenticated district/province scope on both journey and caseworker-list endpoints; add a caller-scoped per-caseworker profile/service endpoint keyed by username; ensure date upper bounds are inclusive; support pagination or document latest-500 truncation. GPS result data must remain non-persistent when live queries are eventually implemented.
