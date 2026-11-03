# services — legacy audit (part: profiles)

> New module `services` · Legacy routes → new routes: `/vca-services`, `/household-services`, `/caregiver-services` → `/services/:type`; **`/profile/vca-service-details`, `/profile/household-service-details`, `/profile/caregiver-service-details` → `/services/:type/:recordId`** (this part); **`/services/household-services` (orphan, KEEP per decision 3)** (this part); unrouted `VcaServicesDashboard` (other part) · Plan: MIGRATION_PLAN.md §5 row "services" ("Detail pages need by-ID fetch (`getServiceRecordDetail` may cover it). Orphan route: confirm before porting")
>
> This part covers the three service-record profile pages and the orphan `HouseholdServicesPage`. The config-driven list page `ServicesPage` (used by `/vca-services`, `/household-services`, `/caregiver-services`) and `VcaServicesDashboard` belong to the other part(s); only the lines of `ServicesPage` that hand a record to the profiles are cited here.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
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

---

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

## Other behaviour
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

## Open questions for the developer
1. **Detail record identity.** `/record-detail` only returns an entity's *latest* service. Is "latest service for this VCA/household" acceptable as the detail page (route `/services/:type/:entityId`), or must a specific visit open (needs `?date=` plus a backend change to `/record-detail`, which decision 7 currently rules out)? See FOCUS options (a)/(b).
2. **New path for the orphan page.** `/services/household-services` collides with `/services/:type` (it would match `type = "household-services"`). Keep the literal path as a static route declared before `/services/:type`, or move it, e.g. `/services/household/insights`, with a legacy redirect?
3. Should the orphan page keep its own endpoint (`/household/household-services-by-district`, unbounded, no FY) or be rebuilt on `/etl/services/household/records` + `/summary` like the main list? Its KPIs (total, unique households, services per household) could come from `/summary`.
4. The "Service item", "Status"/"Outcome" and "Caseworker ID" fields resolve from keys (`service`, `service_name`, `form_name`, `status`, `state`, `outcome`, `caseworker_id`, `staff_id`) that are not known to exist on the service tables. Can someone check a real row (sanitised) so the normaliser maps real columns (likely the pillar `*_services` columns and `case_status`)?
5. Should the detail pages link to the beneficiary profile (`/vcas/:vcaId`, `/households/:householdId`)? Legacy has no such link.
6. Should the raw "Intervention details" / "Full record" / "System audit" tabs survive? They show every string column of `s.*` + `c.*` (including caregiver/VCA PII). If kept, show an explicit allow-list from the normaliser and gate them behind a permission.
7. Caregiver HIV badge: confirm the value set of `is_hiv_positive` (legacy treats contains "yes" or `"1"` as positive and everything else as negative).
