# data-pipeline — legacy audit

> Legacy routes → new routes: `/data-pipeline` → `/data-pipeline/:tab?` · Plan: MIGRATION_PLAN.md §5 row "data-pipeline"  · *part `part1`*
> Scope of this part: everything defined or rendered in `legacy:src/pages/DataPipelinePage.tsx:1-1200`. That covers module constants, all page state, **all queries** (including the User Activity tab queries, defined at `:249-271`), the tablet-sync SSE stream, the hero, the five KPI cards, the tab bar, the **Pipelines** tab, the **Run History** tab, the **Log viewer**, the tablet-sync pipeline card (`renderTabletSyncPipelineCard`, `:457-576`), and the first lines of the **Tablet Sync** tab (filter + pagination maths, `:1190-1212`). The Tablet Sync table, its CSV export (`:1213` onward), and the whole **User Activity** tab body (`:1556-2283`) are documented in part 2. The file was read in full (2288 lines) for orientation.
> Legacy routes → new routes: `/data-pipeline` → `/data-pipeline/:tab?` · Plan: MIGRATION_PLAN.md §5 row "data-pipeline"  · *part `part2`*
> **Scope of this part:** the end of the run log viewer (`legacy:src/pages/DataPipelinePage.tsx:1150-1187`), the **Tablet Sync** tab (`:1189-1555`) and the **User Activity** tab (`:1556-2283`), including the commented-out "Announce New Update" dialog (`:2185-2280`). Hooks, queries and state declared earlier in the file (`:144-455`) are cited where the part-2 UI depends on them; part 1 documents them in full (hero, status cards, Pipelines tab, Run History table, start of the log viewer).
> Merged from the step-3 drafts: `part1`, `part2`. Content is carried over verbatim; only heading levels, the merged header and the shared Legacy files table were consolidated.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/DataPipelinePage.tsx` | 2288 | The whole page (one component, no sub-components). Lines 1–1200 documented here. |
| `src/App.tsx` | 602 | Lazy import (`:99-101`), route (`:526-531`), QueryClient defaults (`:112-134`), IndexedDB persister (`:140-148`, `:214-224`), `EtlInvalidator` mount |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard: login + forced password change only |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar entry (`:97-102`) and visibility filter (`:147-181`) |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | No data-pipeline entry |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | No data-pipeline entry (nav list `:34-45`) |
| `src/components/dashboard/DashboardHeader.tsx` | 539 | Hides search + FY filter on this route (`:35-43`, `:85`); notification link to this route (`:116`, `:127-128`) |
| `src/pages/Dashboard.tsx` | 135 | Quick-action card linking here (`:60-66`) |
| `src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by this page (checked) |
| `src/lib/api.ts` | 1486 | ETL wrappers and types (`:653-798`) — relevant lines only |
| `src/lib/directus.ts` | 869 | `listUserActivity`, `listPmpUsers`, `broadcastAnnouncement`, `listFlaggedFormFacilities` (`:759-869`) — relevant lines only |
| `src/components/EtlInvalidator.tsx` | 90 | App-wide ETL cache invalidation; explicitly skips `["etl", …]` keys (`:78-80`) |
| `src/lib/api.ts` (part) | 1486 | `getTabletSyncStatus` (`:791-794`), `getTabletSyncStreamUrl` (`:796-798`), `TabletSyncProvider`/`TabletSyncStatus` types (`:771-789`), `dqaGetSkipCache` (`:701-712`), `withTokenParam` (`:753-757`) |
| `src/lib/directus.ts` (part) | 869 | `DirectusActivityEntry` (`:759-776`), `ACTIVITY_EXCLUDED_COLLECTIONS` (`:779-785`), `listUserActivity` (`:788-808`), `PmpUser` (`:810-824`), `listPmpUsers` (`:826-840`), `broadcastAnnouncement` (`:843-856`, only used by commented-out code), `listFlaggedFormFacilities` (`:861-869`), `createNotification` (`:514-527`) |
| `src/components/EtlInvalidator.tsx` (part) | — | Its global invalidation skips `["etl", ...]` keys (`:79`) |

## Contents

- [the page: hero, pipelines, run history and logs](#part-part1)
- [the page: tablet sync and user activity](#part-part2)

<a id="part-part1"></a>

## Part: the page: hero, pipelines, run history and logs

## Route `/data-pipeline` → `/data-pipeline/:tab?`

### Purpose
Read-only monitoring console for the ETL (Mage AI) pipelines: shows run status, recent run history with full logs, today's downloadable output CSVs per pipeline, a live tablet/provider sync status (SSE) and a PMP user-activity report. Header copy: "Run and monitor ETL processes. Trigger pipelines, download output CSVs, and track run history." (`legacy:src/pages/DataPipelinePage.tsx:616-618`). Triggering/cancelling is **not** available in the UI (comment "Monitoring actions only. Mage AI owns ETL execution.", `:949`; `triggerEtlPipeline`/`cancelEtlRun` wrappers are never imported, AUDIT.md §3.5).

Tabs (local state only, default `"pipelines"`, `:146-148`; tab list `:767-772`):
| id | label | icon |
|---|---|---|
| `pipelines` | "Pipelines" | Workflow |
| `runs` | "Run History" | Timer (plus a pulsing blue dot when `runningRuns.length > 0`, `:788-790`) |
| `tablets` | "Tablet Sync" | Smartphone |
| `activity` | "User Activity" | Users |

- [ ] Port the four tabs; in the new app the active tab is the `:tab?` route param (legacy keeps it in `useState`, nothing in the URL — no `useSearchParams` in the file). Default tab = `pipelines`.
- [ ] Clicking a tab also closes the log viewer (`setSelectedRun(null)`, `:775-778`).

### Access
- [ ] **Route guard:** `<ProtectedRoute>` only, no role check (`legacy:src/App.tsx:526-531`). `ProtectedRoute` redirects to `/` when logged out and to `/change-password` when `password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:12-18`). Any logged-in user can open the page by URL.
- [ ] **Sidebar:** section `label: "Data pipeline"` with item `{ title: "Data Pipeline", url: "/data-pipeline", icon: DatabaseZap }` (`legacy:src/components/dashboard/AppSidebar.tsx:97-102`). Intended rule: `// Data Pipeline: Only for Admins and Support` → `if (section.label === "Data Pipeline" && !isAdmin && !isSupport) return false;` (`:171-173`), where
  - `isAdmin = roleName === "administrator" || user.description === "Administrator" || (!user.description && roleName !== "")` (`:153-156`)
  - `isSupport = user.description === "Support User" || roleName.includes("support")` (`:157-158`)
  - **BUG:** the label compared is `"Data Pipeline"` but the section label is `"Data pipeline"` (lowercase p, `:98`), so the condition never matches and the entry is shown to **every** user. Port the intended rule (admins + support) as a manifest permission, and enforce it on the route too.
- [ ] **Mobile bottom nav:** no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`); reachable via the "More" button which opens the sidebar (`:37-46`).
- [ ] **Global search:** no nav entry (`legacy:src/components/dashboard/GlobalSearch.tsx:34-45`).
- [ ] **Header:** `/data-pipeline` is in `HIDDEN_ROUTES`, so the header search box and FY filter are hidden on this page (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43`, `:85`). New app: no scope/FY selector on this page.
- [ ] **In-page role checks (lines 1–1200):** only `const isAdminUser = (authUser?.description ?? "").trim() === "Administrator";` (`legacy:src/pages/DataPipelinePage.tsx:169`). It is used only by the commented-out "Announce New Update" button (`:1781-1791`, part 2), so today it gates nothing. No button in lines 1–1200 is hidden by role: "Email Report", "Refresh", file downloads and "Logs" are available to everyone who reaches the page. New app: express via `can(...)` permissions (e.g. view pipeline, send ETL report, download extracts).
- [ ] **Data scope:** none. The page does not call `useEffectiveDistrict` and sends no district/province/FY to any endpoint. All ETL endpoints return program-wide data (`/etl/download/...` and `/etl/tablet-sync*` "ignores district (returns all)", AUDIT.md §3.2). Backend asks: role check on `/etl/send-report`, `/etl/download/:pipeline/:fileName`, `/etl/tablet-sync*` and `/etl/runs/:runId` (logs).

### Endpoints
All DQA calls use `dqaGetSkipCache`/`dqaPost` (`legacy:src/lib/api.ts:683-712`): bearer token from `getStoredToken()`, throws `"Not authenticated"` with no token, throws `data.message || "Request failed: <status>"` on non-OK. No IndexedDB aux cache for these.

- [ ] `GET /etl/pipelines` (AUDIT.md §3.2) — `getEtlPipelines` (`legacy:src/lib/api.ts:741-744`) returns `data ?? []`. Query key `["etl","pipelines"]`, `staleTime: 60_000` (`legacy:src/pages/DataPipelinePage.tsx:184-188`). Fires on mount, always. Used for each card's display name (`p.id === key` → `name`, `:805-809`) and expected file names (`downloadFiles`, `:810-812`) and the tablet card name (`:460-462`, `:484`).
- [ ] `GET /etl/runs?limit=30` (AUDIT.md §3.2) — `getEtlRuns({ limit: 30 })` (`legacy:src/lib/api.ts:719-731`; wrapper also supports `pipeline`, `status`, never sent). Key `["etl","runs"]`, `refetchInterval: 10_000` (`:190-194`), default staleTime 60 s. Fires on mount, always (all tabs). Client-side post-processing (`:204-208`): `latestRun = runs[0]`; `successRuns` (`status === "success"`), `failedRuns` (`"failed"`), `runningRuns` (`"running"`). `runningPipelines` map `{[pipeline]: run_id}` rebuilt from `runningRuns` (`:229-235`). Per card, `lastPipelineRun = runs.find(r => r.pipeline === key)` (`:804`).
- [ ] `GET /etl/runs/:runId` (AUDIT.md §3.2) — `getEtlRunById` (`legacy:src/lib/api.ts:733-736`, runId not URL-encoded). Not a React Query query: called imperatively by `handleViewLogs` (`:365-372`) and stored in `selectedRun` state; on failure `toast.error("Failed to load run details")`. Auto-poll every **3000 ms** via `setInterval` while `selectedRun.status` is `"running"` or `"pending"`; errors ignored; interval cleared on change of `run_id`/`status` (`:374-390`).
- [ ] `GET /etl/files/:pipeline` (AUDIT.md §3.2) — `getEtlFiles` (`legacy:src/lib/api.ts:746-749`). Called by `loadFiles` (`:237-247`) **sequentially** for each of `PIPELINE_KEYS = ["ecap_plus", "hts_register", "pmtct"]` (`:106`); each failure → `[]` silently. Result in `filesByPipeline` state (not React Query). Fires: on mount (`:273-275`), when `latestRun` becomes `success`/`failed` or its `run_id` changes (`:356-363`), and on hero "Refresh" (`:639`). New app: one `queryOptions` per pipeline keyed `["etl","files",pipeline]`, iterate the server `pipelines` list rather than a hardcoded key list.
- [ ] `GET /etl/download/:pipeline/:fileName?token=<token>` (AUDIT.md §3.2) — URL built by `getEtlDownloadUrl` (`legacy:src/lib/api.ts:759-766`; `fileName` URL-encoded, token appended by `withTokenParam` `:753-757`). `handleDownload` creates an `<a href target="_blank" rel="noopener">` and clicks it (`:392-399`). No fetch, no error handling. New app: go through `platform/export`/core download helper; prefer a header-authenticated blob fetch over `?token=` if the backend allows (record as backend ask otherwise).
- [ ] `POST /etl/send-report` (AUDIT.md §3.2) — `sendEtlReport` (`legacy:src/lib/api.ts:768`), body `{}`. Triggered by hero "Email Report" button (`:622-634`). `isSendingEmail` disables the button and swaps the Mail icon for a spinning RefreshCw. Success: `toast.success(data?.message || "Email report sent to the team")`; error: `toast.error("Failed to send email", { description: err.message })` (`:401-411`). **QUESTION:** the backend `message` echoes recipient email addresses (AUDIT.md §3.2) — show a fixed success text instead?
- [ ] `GET /etl/tablet-sync` (AUDIT.md §3.2) — `getTabletSyncStatus` (`legacy:src/lib/api.ts:791-794`) returns `data`. Key `["etl","tablet-sync"]`, `staleTime: 60_000`, `refetchInterval: 15 * 60 * 1000` (`:196-201`). Fires on mount, always (feeds the "Tablet Sync" KPI card on every tab). Manual refetch from the tablet card's "Refresh status" button (`:558-571`) and the tablet table "Refresh" button (`:1337-1351`, part 2).
- [ ] `GET /etl/tablet-sync/stream?token=<token>` (SSE, AUDIT.md §3.2) — URL from `getTabletSyncStreamUrl` (`legacy:src/lib/api.ts:796-798`). Opened with `new EventSource(...)` **only while `activeTab === "tablets"`** and `EventSource` exists (`:281-295`); closed on tab change/unmount (`:350-353`). Stream status state `"idle" | "connecting" | "live" | "reconnecting"` (`:160-162`):
  - `onopen` → `"live"` (`:297-299`)
  - event `tablet-sync`: parse JSON `{ data?, emitted_at? }`; if `data` → `queryClient.setQueryData(["etl","tablet-sync"], payload.data)`; contact time = `emitted_at` ms or `Date.now()`; status `"live"`. Parse error → `console.error` + `"reconnecting"` (`:301-321`)
  - event `heartbeat`: update contact time (fallback `Date.now()` on parse error), status `"live"` (`:323-338`)
  - event `tablet-sync-error`: `console.error`, `"reconnecting"` (`:340-344`)
  - `onerror` → `"reconnecting"` (browser auto-reconnects) (`:346-348`)
  New app: put this in a hook (`useTabletSyncStream`) that writes into the same query key as the one-shot query.
- [ ] Directus `GET /activity` (AUDIT.md §3.3) — `listUserActivity(500)` (`legacy:src/lib/directus.ts:788-808`): fields `id,action,collection,timestamp,user.id,user.first_name,user.last_name,user.email,user.district,user.facility,user.location,user.title,user.description`, `sort=-timestamp`, `limit=500`, `filter[user][role][_eq]=<VITE_DIRECTUS_USER_ROLE>`, `filter[collection][_nin]=case_management,finance,stores,human_resource,procurement` (`:780-786`). Throws `"VITE_DIRECTUS_USER_ROLE is not configured"` if the env var is missing or contains `<`. Key `["directus","user-activity"]`, `enabled: activeTab === "activity"`, `staleTime: 60_000` (`legacy:src/pages/DataPipelinePage.tsx:249-254`). Consumed in part 2.
- [ ] Directus `GET /users` (AUDIT.md §3.3) — `listPmpUsers` (`legacy:src/lib/directus.ts:826-840`): fields `id,first_name,last_name,email,title,location,district,facility,description,last_access,status`, `sort=first_name`, `limit=500`, `filter[role][_eq]=<VITE_DIRECTUS_USER_ROLE>`. Key `["directus","pmp-users"]`, `enabled: activeTab === "activity"`, `staleTime: 60_000` (`:257-262`). Consumed in part 2.
- [ ] Directus `GET /items/flagged_forms_ecapii` (AUDIT.md §3.3) — `listFlaggedFormFacilities` (`legacy:src/lib/directus.ts:861-869`): `fields=id,facility`, `limit=1000`. Key `["directus","flagged-form-facilities"]`, `enabled: activeTab === "activity"`, `staleTime: 60_000` (`:265-270`). Consumed in part 2. **QUESTION:** collection belongs to another program (AUDIT.md §3.3).
- [ ] Not called (imported but unused in the live code): `broadcastAnnouncement` (`legacy:src/lib/directus.ts:843-855`, only referenced from the commented-out dialog `:2246`, part 2). `POST /etl/run` and `POST /etl/cancel/:runId` have wrappers but no UI (AUDIT.md §3.5).
- [ ] Cache behaviour: global defaults `staleTime 60 s`, `gcTime 24 h`, `refetchOnWindowFocus/Mount/Reconnect: true`, `retry: 1` (`legacy:src/App.tsx:112-134`). Every successful query, including the user-activity and users lists (emails, last access), is persisted to IndexedDB for 24 h (`legacy:src/App.tsx:140-148`, `:214-224`). New app: `meta: { persist: false }` on the Directus user/activity queries; ETL run/file/tablet queries are monitoring data and should not carry `meta: { etl: true }` (legacy `EtlInvalidator` deliberately skips `["etl", …]` keys, `legacy:src/components/EtlInvalidator.tsx:78-80`).

### Fields used

`EtlRun` (`legacy:src/lib/api.ts:655-667`; no `pickValue` — fields used directly)
| Field | Raw keys tried | Where shown / how used | Formatting |
|---|---|---|---|
| run_id | `run_id` | Running badge "Running (<run_id>)" (`:845`), Run ID column (`:1024`), log viewer header (`:1109`), row key, log fetch id | monospace bold |
| pipeline | `pipeline` | matching run → card (`:804`), running map key (`:232`), fallback name (`:1029`, `:1141`) | — |
| pipeline_name | `pipeline_name` | "Running Now" sub-text joined with ", " (`:671`), "Last Run" KPI sub-text (`:692`), Pipeline column `pipeline_name \|\| pipeline` (`:1029`), log viewer (`:1141`) | — |
| status | `status` | KPI counts, card badge (`:877`), table badge (`:1070`), log viewer badge (`:1120`), poll condition | `statusConfig` (below); raw lowercase text |
| started_at | `started_at` | KPI "Last Run" date (`:687`), card (`:881`), Started column (`:1035`), log viewer (`:1149`) | `formatDate` |
| duration_sec | `duration_sec` | KPI sub-text, card "Duration:", Duration column (replaced by spinner + "In progress" when `running`, `:1040-1047`), log viewer | `formatDuration` |
| triggered_by | `triggered_by` | card "By: …" (`:886`), Triggered By column (`:1052`), log viewer (`:1165`) | raw (may be null → blank) |
| error | `error` | log viewer red box "Error: <error>" when truthy (`:1171-1175`) | — |
| logs | `logs` (only from `/etl/runs/:runId`) | `<pre>` "Output Logs", fallback "(no output yet)" (`:1176-1183`) | pre-wrap, max-h 500px, scroll |
| completed_at, created_at | — | not displayed | — |

`EtlPipeline` (`legacy:src/lib/api.ts:669-673`): `id` (match key), `name` (card title; **overridden** to "Prevention of Mother-to-Child Transmission" for `pmtct`, `:806-809`; fallback = key), `downloadFiles` (expected files, fallback `DEFAULT_PIPELINE_FILES`, `:810-812`).

`EtlFile` (`legacy:src/lib/api.ts:675-681`)
| Field | Where shown | Formatting |
|---|---|---|
| name | file row title (`:922`), download fileName | truncate |
| exists | sub-text and download enabled (`:925`, `:935`) | — |
| sizeFormatted, lastModified | sub-text `"<sizeFormatted> \| <formatDate(lastModified)>"` when exists, else "Not generated yet" (`:924-928`) | server-formatted size |
| size | not displayed | — |

`TabletSyncStatus` (`legacy:src/lib/api.ts:771-789`), lines 1–1200 usage
| Field | Where shown | Formatting |
|---|---|---|
| total | KPI `${active_7d}/${total}` (`:748`), tablet card "Total" (`:518`), "All (total)" pill (`:1268`) | `?? "-"` on card |
| active_7d | KPI numerator, card "Active" (`:526`) | |
| active_30d | used for Inactive count `total - active_30d` (`:1323`, part 2 boundary) | |
| stale | KPI warning line when `> 0` (`:756-760`), card "Stale" (`:534`) | |
| source | `tabletSyncSourceLabel(source)` (`:134-142`, `:508`) | mapping below |
| refreshed_at | card "Last refresh", fallback `tabletSyncQuery.dataUpdatedAt` ISO, else "-" (`:463-467`, `:505`) | `formatDate` |
| providers[] | filtered by `status` for the table (`:1192-1195`) | part 2 |

`tabletSyncSourceLabel` (`:134-142`), exact mapping:
- `"ecap_plus_superset_db.tablet_sync_status"` → "ECAP+ tablet sync pipeline"
- `"ecap_plus_superset_db.children"` → "ECAP+ pipeline seed snapshot"
- `"ecap_plus_source.children"` → "ECAP+ source snapshot"
- `"opensrp.core.event"` → "Live OpenSRP sync"
- anything else / undefined → "Processed ECAP+ tablet snapshot"

Formatting helpers (local to the page; new app → `core/lib/format.ts`):
- [ ] `formatDuration(seconds)` (`:413-418`): falsy → `"-"`; else `"<m>m <s>s"` when ≥ 60 s, otherwise `"<s>s"`.
- [ ] `formatDate(dateStr)` (`:420-429`): null → `"-"`; else `toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })` in the browser's timezone (e.g. "03 Nov 2026, 14:05").
- [ ] Hero date `dateStr` (`:450-455`): `toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })`.
- [ ] `statusConfig` (`:431-448`): `success` → emerald + CheckCircle2; `running` → blue + RefreshCw (spins in table, `:1067`); `pending` → slate + Clock; `failed` → red + XCircle; `cancelled` → amber + AlertCircle; unknown → `pending` style. New app: map to theme tokens (success/info/muted/destructive/warning), no Tailwind palette colours.

### Filters / sort / pagination / search
- [ ] **Run History:** no filter, no search, no sort control, no pagination. Rows in server order (`ORDER BY created_at DESC`, AUDIT.md §3.2), capped at 30 by `limit=30`. Badge "<n> runs" (`:984-986`).
- [ ] **Pipelines tab:** no filters.
- [ ] **Tablet Sync tab** (state defined in part 1): `tabletFilter` `"all" | "active" | "stale" | "inactive"`, default `"all"` (`:157-159`), not persisted; filter = `providers.filter(p => tabletFilter === "all" || p.status === tabletFilter)` (`:1192-1195`). Page reset to 1 when the filter changes (`:277-279`). Client pagination, `TABLET_PAGE_SIZE = 20` (`:132`), `totalPages = max(1, ceil(filtered/20))`, `currentPage = min(tabletPage, totalPages)` (clamped), `startIndex = 0` when empty else `(page-1)*20+1`, `endIndex = min(page*20, filtered.length)` (`:1196-1212`). Pills, table, export: part 2.
- [ ] **User Activity tab** (state defined in part 1, logic in part 2): `activityFilter` `"all"|"active"|"stale"|"inactive"|"never"` default `"all"` (`:174-176`); `activityRole`, `activityProvince`, `activityDistrict`, `activityFacility` default `"all"` (`:177-180`); `activityPage` (`:181`), `ACTIVITY_PAGE_SIZE = 20` (`:182`). Cascades: any filter change → page 1 (`:210-218`); province change → district and facility reset to `"all"` (`:220-223`); district change → facility reset (`:225-227`). None persisted. New app: sync all of these to URL via `platform/filters`.

### Exports
- [ ] **Pipeline output CSVs** (server files, not client-generated): one row per expected file per pipeline card with a ghost Download icon button, disabled when `!f.exists` (`:931-939`). Triggers `GET /etl/download/:pipeline/:fileName` in a new tab. File names come from the server (`/etl/files/:pipeline` → else `/etl/pipelines` `downloadFiles` → else hardcoded `DEFAULT_PIPELINE_FILES`, `:819-828`). Hardcoded fallback names (`:120-130`), with `<stamp>` = today's `DDMMYY` in `Africa/Lusaka` (`:108-117`):
  - `ecap_plus`: `monthly_caregiver_ecapplus_services_<stamp>.csv`, `monthly_vca_ecapplus_services_<stamp>.csv`
  - `hts_register`: `hts_register_ecapplus_<stamp>.csv`
  - `pmtct`: `pmtct_mother_ecapplus_register_<stamp>.csv`, `pmtct_child_ecapplus_register_<stamp>.csv`
  Columns: defined by external exporters, unknown (AUDIT.md §3.2). New app: drop the hardcoded fallback names (or move to config) and rely on the server list.
- [ ] **"Email Report"** (hero) — not a file export; server-side email (see Endpoints).
- [ ] Tablet sync CSV and User Activity CSV exports: part 2 (`:1213-1234`, `:1739-1763`).

### Charts
No charts. KPI cards (`:651-763`), all `GlowCard`, grid `1 / sm:2 / lg:5` columns:
- [ ] **"Running Now"** (Activity icon): value `"<n> Active"` (blue) when `runningRuns.length > 0` else `"Idle"` (emerald); sub-text = running `pipeline_name`s joined by ", " or "No pipelines running" (`:653-675`).
- [ ] **"Last Run"** (Clock): value = date part of `formatDate(latestRun.started_at)` (`.split(",")[0]`) or "No runs yet"; sub-text `"<pipeline_name> - <formatDuration(duration_sec)>"` or "-" (`:677-696`). `latestRun = runs[0]` (newest by `created_at`).
- [ ] **"Run History"** (BarChart3): value `runs.length`; "Total recorded runs"; footer "<n> passed" (emerald) and "<n> failed" (red) (`:698-721`). Counts are of the last 30 runs only.
- [ ] **"Pipelines"** (Server): **hardcoded** value `2` and sub-text "ECAP Plus + HTS Register" (`:723-736`). **BUG:** three monitored pipelines are rendered (`PIPELINE_KEYS`, `:106`) plus the tablet-sync pipeline; port as count of `GET /etl/pipelines` entries (and names from the server).
- [ ] **"Tablet Sync"** (Smartphone): value `"<active_7d>/<total>"`, `<LoadingDots/>` while no data; "Active in last 7 days"; when `stale > 0`, orange line `"<stale> stale (>30 days)"` (`:738-762`). **BUG:** stale means 7–30 days (backend, and the table label "Stale (7-30d)" at `:1503`); the KPI text says ">30 days".
- [ ] Hero status badge: `"<n> running"` or `"Idle"` (`:595-603`).

### Hero (`:578-649`)
- [ ] Eyebrow "ETL infrastructure" · hero date · status badge; H1 "Data Pipeline" with badge "Extract · Transform · Load"; description text (`:616-618`, stale copy: "Trigger pipelines" is no longer possible).
- [ ] "Email Report" button (see Endpoints).
- [ ] "Refresh" button: `queryClient.invalidateQueries()` (no filter — **every** cached query in the app), `loadFiles()`, `toast.info("Refreshed")` (`:635-646`). **BUG/QUESTION:** should only invalidate this page's keys.
- [ ] Page subtitle passed to layout: `subtitle="Data Pipeline"` (`:579`).

### Pipelines tab (`:795-974`)
Grid `1 / lg:2` columns, one `GlowCard` per `PIPELINE_KEYS` entry (`ecap_plus`, `hts_register`, `pmtct`):
- [ ] Icon tile from `PIPELINE_META[key]` (`:76-104`): `ecap_plus` Database/emerald, `hts_register` TestTubes/amber, `pmtct` ShieldCheck/rose; inline hex styles (`:813-818`, emerald / rose / else amber) — new app: theme tokens.
- [ ] Title = `displayName` (see Fields). If running: blue badge with spinner "Running (<run_id>)" (`:842-847`).
- [ ] Description = `PIPELINE_META[key].description` (hardcoded strings, `:83-84`, `:89-90`, `:95-96`) — move to config or take from server.
- [ ] "Last Run" box: if `lastPipelineRun` → status badge, `formatDate(started_at)`, `"Duration: <d> | By: <triggered_by>"`; else "No runs yet" (`:856-899`).
- [ ] "Output Files": rows (see Exports) with FileSpreadsheet icon (rose for `pmtct`, else emerald, `:912-919`); empty → "Run the pipeline to generate files" (`:942-946`) — unreachable in practice because expected names always fill the list.
- [ ] Footer: static pill "Mage AI controlled" (`:951-953`) and, when `lastPipelineRun` exists, a "Logs →" button that calls `handleViewLogs(run_id)` and switches to the `runs` tab (`:954-966`). New app: navigate to `/data-pipeline/runs` with the run selected (e.g. `/data-pipeline/runs?run=<id>` or nested route — **QUESTION**).

### Run History tab (`:976-1094`, shown when `activeTab === "runs" && !selectedRun`)
- [ ] Card title "Pipeline Run History" + badge "<n> runs".
- [ ] Empty (`runs.length === 0`): Workflow icon, "No pipeline runs yet", "Trigger a pipeline from the Pipelines tab to get started." (`:990-997`) — stale copy; triggering is not possible.
- [ ] Table columns in order (`:1003-1009`): **Run ID** (`run_id`), **Pipeline** (`pipeline_name || pipeline`), **Started** (Clock + `formatDate(started_at)`), **Duration** (spinner "In progress" if `running`, else `formatDuration`), **Triggered By** (`triggered_by`), **Status** (badge with icon + status), **Actions** (right-aligned "Logs →" → `handleViewLogs`). New app: `platform/data-table`.

### Log viewer (`:1096-1187`, shown when `activeTab === "runs" && selectedRun`)
- [ ] Toolbar: "Back to Runs" (clears `selectedRun`), run id (mono), status badge; "Refresh Logs" button only when `status === "running"` (re-calls `handleViewLogs`) (`:1099-1132`).
- [ ] Header grid: Pipeline, Started, Duration, Triggered By (`:1135-1168`).
- [ ] Red error box when `error` (`:1171-1175`); "Output Logs" `<pre>` dark block with `logs || "(no output yet)"` (`:1176-1183`).
- [ ] Auto-refresh every 3 s while pending/running (Endpoints).
- [ ] New app: the selected run should be addressable in the URL so it survives reload (CLAUDE.md "detail pages read IDs from route params").

### Tablet sync pipeline card (`renderTabletSyncPipelineCard`, `:457-576`; rendered in the Tablet Sync tab at `:1239`)
- [ ] Icon Smartphone; badge with spinning icon "Always on" (`:478-481`).
- [ ] Title `pipelineInfo?.name ?? "ECAP+ Tablet Sync Status Refresh"` where `pipelineInfo` = `/etl/pipelines` entry with `id === "ecap_plus_tablet_sync"` (`:131`, `:460-462`, `:484`). Note AUDIT.md §3.2 says `/etl/pipelines` returns only three entries, so the fallback name is what shows. Description `PIPELINE_META.ecap_plus_tablet_sync.description` (`:101-102`).
- [ ] "Last refresh" box: `formatDate(lastRefreshAt)`; small badge `"live"` when stream status is `live`, else `"polling"`; "Source: <label>" (`:492-510`).
- [ ] Three tiles: "Total", "Active", "Stale" (`:512-537`).
- [ ] "Pipeline output": static row "tablet_sync_status" / "Updated by Mage AI always-on pipeline" (`:539-556`).
- [ ] "Refresh status" button → `tabletSyncQuery.refetch()`, disabled + spinning while fetching (`:558-571`).

### Links in / out
- [ ] In: sidebar item (`legacy:src/components/dashboard/AppSidebar.tsx:100`), no payload.
- [ ] In: Home quick action "Data pipeline" — "Pipeline runs, downloads, and tablet sync status." → `navigate("/data-pipeline")` (`legacy:src/pages/Dashboard.tsx:60-66`, `:106`), no payload, not role-filtered.
- [ ] In: header notification bell — a Directus notification with `collection === "weekly_extracts"` gets `link: "/data-pipeline"` (`legacy:src/components/dashboard/DashboardHeader.tsx:116`, `:127-128`), no payload.
- [ ] In: none from GlobalSearch or MobileBottomNav; no `location.state`, query params or storage written before navigating (grep of `src` for `data-pipeline`: App.tsx, DashboardHeader.tsx, AppSidebar.tsx, Dashboard.tsx only).
- [ ] Out: file download opens `/etl/download/...` in a new browser tab (`:392-399`). No in-app navigation out of the page in lines 1–1200.

### Loading / empty / error
- [ ] No page-level skeleton. KPI cards render immediately from `runs = []` ("Idle", "No runs yet", `0`), so loading looks like "empty". Tablet KPI shows `<LoadingDots/>` until data (`:747-751`). New app: skeletons for KPI cards, tables, file lists.
- [ ] Pipelines query loading/error: silently falls back to the key / hardcoded file names.
- [ ] Runs query error: **no error UI** — `runs` stays `[]`, so the Run History tab shows the empty state "No pipeline runs yet". New app: `<ErrorState>` with retry.
- [ ] Files: no loading state; until `loadFiles` finishes every file shows "Not generated yet" with a disabled download button; errors per pipeline swallowed (`:240-244`).
- [ ] Tablet sync query error: KPI shows `LoadingDots` forever; tablet card shows "-" values.
- [ ] Log fetch error → `toast.error("Failed to load run details")` (`:369-371`); poll errors ignored.
- [ ] Email: success/error toasts (Endpoints). Refresh: `toast.info("Refreshed")`.
- [ ] SSE failures: only reflected in the stream status text/badge; `console.error` for bad payloads.

### Bugs and quirks
- [ ] **BUG** Sidebar visibility rule never applies (`"Data Pipeline"` vs `"Data pipeline"`), and the route has no role guard → page is available to every logged-in user (`legacy:src/components/dashboard/AppSidebar.tsx:98`, `:172`; `legacy:src/App.tsx:526-531`). Port intended rule: admins + support.
- [ ] **BUG** "Pipelines" KPI hardcoded `2` / "ECAP Plus + HTS Register" while 3 pipelines are shown (`legacy:src/pages/DataPipelinePage.tsx:731-733`, `:106`).
- [ ] **BUG** Tablet KPI says "stale (>30 days)" but stale = 7–30 days (`:758` vs `:1503`).
- [ ] **BUG** `runningPipelines` effect depends only on `runningRuns.length` (`:229-235`): if one run finishes and another starts between two polls, the count is unchanged and the card's "Running (<id>)" badge stays wrong. Derive it from data instead of state.
- [ ] **BUG** `CURRENT_FILE_STAMP` is computed once at module load (`:119`); a tab left open past midnight (Lusaka) shows yesterday's fallback names.
- [ ] **BUG** Hero "Refresh" invalidates the entire query cache (`:638`), refetching every module's data.
- [ ] **BUG** Runs query error is rendered as "No pipeline runs yet" (`:990`); stale copy "Trigger a pipeline…" (`:995`) and "Trigger pipelines" (`:617`) though the UI cannot trigger.
- [ ] **BUG** `formatDuration(0)` returns `"-"` (`:414`) — a 0-second run looks like "no duration".
- [ ] **BUG** "Refresh Logs" button shown only for `running`, not `pending` (`:1122`), while the auto-poll covers both (`:378`).
- [ ] **QUESTION** `displayName` for `pmtct` is hardcoded client-side ("Prevention of Mother-to-Child Transmission", `:806-809`) instead of the server name; the "Last Run" KPI sub-text and Run History still use the server `pipeline_name`, so names differ between views.
- [ ] **QUESTION** Logs button on a card calls `handleViewLogs` and switches tab at once; until the fetch resolves the run list flashes (`:957-960`).
- [ ] **QUESTION** `latestRun = runs[0]` is newest by `created_at`, not `started_at` (server sort, AUDIT.md §3.2).
- [ ] Quirk: download uses `?token=` in a URL opened in a new tab; a 404 JSON error opens as a raw page (`:392-399`, AUDIT.md §3.2).
- [ ] Quirk: dead imports/state for the commented-out "Announce New Update" feature: `Dialog*`, `Input`, `Textarea`, `isAdminUser`, `announceOpen/Subject/Message`, `isAnnouncing`, `broadcastAnnouncement` (`:54-72`, `:169-173`). Not ported unless the developer revives it (**QUESTION**).
- [ ] Quirk: User-activity/users data (emails, last access) is persisted to IndexedDB for 24 h by the global persister (`legacy:src/App.tsx:214-224`).

<a id="part-part2"></a>

## Part: the page: tablet sync and user activity

## Route `/data-pipeline` → `/data-pipeline/:tab?` (part 2: Tablet Sync tab, User Activity tab, log viewer tail)

### Purpose
- Tablet Sync tab: monitor when each ECAP+ provider (caseworker tablet) last synced to OpenSRP, with live updates over SSE, a summary card for the always-on Mage AI tablet-sync pipeline, status filter pills, a paginated table and a CSV export (`legacy:src/pages/DataPipelinePage.tsx:1189-1555`).
- User Activity tab: list every PMP dashboard user (Directus users of the PMP role) with last activity, status bucket (active / stale / inactive / never logged in), role/province/district/facility filters, pagination and CSV export (`:1556-2283`).
- Log viewer (tail): run metadata and the raw log output of one ETL run (`:1097-1187`).

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:525-532`). `ProtectedRoute` redirects to `/` when there is no user and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). Any logged-in user can open the page by URL.
- [ ] Sidebar: item `{ title: "Data Pipeline", url: "/data-pipeline", icon: DatabaseZap }` inside section `label: "Data pipeline"` (`legacy:src/components/dashboard/AppSidebar.tsx:97-102`). Intended rule (`:171-173`): `if (section.label === "Data Pipeline" && !isAdmin && !isSupport) return false;` where `isAdmin = roleName === "administrator" || user.description === "Administrator" || (!user.description && roleName !== "")` (`:153-156`) and `isSupport = user.description === "Support User" || roleName.includes("support")` (`:157-158`).
  - [ ] **BUG** The section label is `"Data pipeline"` (lowercase p, `:98`) but the check compares with `"Data Pipeline"` (`:172`), so the condition never matches and the entry is shown to **every** user. Port the intended behaviour: permission `data-pipeline:view` granted to admin + support roles only, and enforce it at the route as well (legacy has no route guard).
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`); reached through "More" → sidebar.
- [ ] Global search: no nav entry (`legacy:src/components/dashboard/GlobalSearch.tsx:34-45`).
- [ ] In-page role checks (part 2 range):
  - [ ] `isAdminUser = (authUser?.description ?? "").trim() === "Administrator"` (`legacy:src/pages/DataPipelinePage.tsx:169`). Only consumer is the commented-out "Announce New Update" button (`:1781-1791`); dead today.
  - [ ] `norm(u.description) === "Facility User"` (`:1608`): only users whose description is exactly `"Facility User"` get flag counts added to their event total (see Fields). This is a data computation, not an access check, but it is a role-string comparison that the new code must express via config/normaliser (not a string literal in UI).
  - [ ] Role filter compares `norm(u.description) !== activityRole` (`:1631`).
  - [ ] No other hidden buttons: Export CSV and Refresh are visible to everyone who can open the page (`:1327-1351`, `:1792-1826`).
- [ ] Data scope: **none**. The page does not call `useEffectiveDistrict` or any district selector. `GET /etl/tablet-sync` ignores district and returns all providers program-wide (AUDIT.md §3.2). The Directus `/activity` and `/users` reads are filtered only by the PMP role id, and `/items/flagged_forms_ecapii` is unfiltered — every viewer sees every PMP user (with emails) nationally. Record as Backend ask (AUDIT.md §3.5 items 8, 10).

### Endpoints
- [ ] `GET /etl/tablet-sync` (AUDIT.md §3.2) — wrapper `getTabletSyncStatus` (`legacy:src/lib/api.ts:791-794`) via `dqaGetSkipCache` (Bearer token, no IDB list cache, `:701-712`); returns `data.data`. No params. Query `queryKey: ["etl", "tablet-sync"]`, `staleTime: 60_000`, `refetchInterval: 15 * 60 * 1000` (`legacy:src/pages/DataPipelinePage.tsx:196-201`). Always enabled (fires on page mount regardless of active tab, also feeds the hero "Tablet Sync" status card at `:738-762`). Manual refetch: "Refresh status" in the pipeline card (`:558-571`) and "Refresh" in the table header (`:1337-1351`). Global invalidation from `EtlInvalidator` skips `etl` keys (`legacy:src/components/EtlInvalidator.tsx:79`); the hero "Refresh" button calls `queryClient.invalidateQueries()` with no filter, which does refetch it (`:637-641`). Persisted to IndexedDB with the rest of the cache (`legacy:src/App.tsx:216-224`) — it contains caseworker names; new code: `meta: { persist: false }`.
- [ ] `GET /etl/tablet-sync/stream` (AUDIT.md §3.2) — SSE. URL from `getTabletSyncStreamUrl()` = `${DQA_BASE_URL}/etl/tablet-sync/stream` with `?token=<access token>` appended (`legacy:src/lib/api.ts:753-757`, `:796-798`). Opened with `new EventSource(...)` only while `activeTab === "tablets"` and `EventSource` exists (`legacy:src/pages/DataPipelinePage.tsx:281-295`); closed on tab change/unmount (`:350-353`). Events:
  - [ ] `onopen` → status `"live"` (`:297-299`).
  - [ ] `tablet-sync` → `JSON.parse(data)` `{ data?: TabletSyncStatus, emitted_at?: string }`; writes `payload.data` into the `["etl","tablet-sync"]` cache with `setQueryData` (`:301-309`); sets "last contact" to `emitted_at` or `Date.now()` (`:311-315`); status `"live"`. Parse failure → `console.error` + status `"reconnecting"` (`:317-320`).
  - [ ] `heartbeat` → updates last contact from `emitted_at` (or now on parse failure), status `"live"` (`:323-338`).
  - [ ] `tablet-sync-error` → `console.error` + `"reconnecting"` (`:340-344`).
  - [ ] `onerror` → `"reconnecting"` (browser auto-reconnects) (`:346-348`).
  - [ ] **QUESTION** The token in the query string leaks into server/proxy logs. Needs a decision for the new `core/api` SSE helper (short-lived stream token, or cookie). Backend ask.
- [ ] `GET /activity` (Directus, `directus_activity`) — wrapper `listUserActivity(500)` (`legacy:src/lib/directus.ts:788-808`). Params: `fields=id,action,collection,timestamp,user.id,user.first_name,user.last_name,user.email,user.district,user.facility,user.location,user.title,user.description`, `sort=-timestamp`, `limit=500`, `filter[user][role][_eq]=<VITE_DIRECTUS_USER_ROLE>`, `filter[collection][_nin]=case_management,finance,stores,human_resource,procurement` (`:779-785`, `:795-806`). Throws `"VITE_DIRECTUS_USER_ROLE is not configured"` when the env var is missing or still contains `<` (`:791-794`). Query `queryKey: ["directus", "user-activity"]`, `enabled: activeTab === "activity"`, `staleTime: 60_000` (`legacy:src/pages/DataPipelinePage.tsx:249-254`). Persisted to IndexedDB (contains emails) → new code `meta: { persist: false }`. The excluded-collections list is program-specific → config.
- [ ] `GET /users` (Directus) — wrapper `listPmpUsers` (`legacy:src/lib/directus.ts:826-840`). Params: `fields=id,first_name,last_name,email,title,location,district,facility,description,last_access,status`, `sort=first_name`, `limit=500`, `filter[role][_eq]=<VITE_DIRECTUS_USER_ROLE>`; same env check. Query `["directus", "pmp-users"]`, `enabled: activeTab === "activity"`, `staleTime: 60_000` (`legacy:src/pages/DataPipelinePage.tsx:257-262`). Persisted (PII) → `persist: false`.
- [ ] `GET /items/flagged_forms_ecapii` (Directus) — wrapper `listFlaggedFormFacilities` (`legacy:src/lib/directus.ts:861-869`). Params `fields=id,facility`, `limit=1000`. Query `["directus", "flagged-form-facilities"]`, `enabled: activeTab === "activity"`, `staleTime: 60_000` (`legacy:src/pages/DataPipelinePage.tsx:265-270`). **QUESTION** this is another program's collection (AUDIT.md §3.5 item 10); flags raised in the PMP go to `flagged_forms_ecapplus_pmp`, so the per-facility counts likely do not reflect PMP flags at all.
- [ ] `GET /etl/runs/:runId` (AUDIT.md §3.2) — log viewer data; auto-polled every 3 s while `selectedRun.status` is `"running"` or `"pending"` (`legacy:src/pages/DataPipelinePage.tsx:375-390`); "Refresh Logs" button for running runs (`:1122-1131`). Documented in part 1.
- [ ] (Dead, commented out) `POST /notifications` (Directus) — `broadcastAnnouncement(recipientIds, subject, message)` calls `createNotification({ recipient, subject, message })` once per recipient with `Promise.allSettled`, returns `{ sent, failed }` (`legacy:src/lib/directus.ts:843-856`, `:514-527`). Only caller is commented out (`legacy:src/pages/DataPipelinePage.tsx:2246-2250`). Imported but unused: `broadcastAnnouncement`, `Dialog*`, `Input`, `Textarea` (`:54-72`), state `announceOpen/Subject/Message/isAnnouncing` (`:170-173`).

### Fields used

**Tablet sync** (`TabletSyncStatus`, `legacy:src/lib/api.ts:771-789`; no normaliser, raw shape used directly)

| Field | Raw keys | Where shown / how used | Formatting |
|---|---|---|---|
| total | `data.total` | "All (n)" pill (`legacy:src/pages/DataPipelinePage.tsx:1268`); "Inactive" pill = `total - active_30d` (`:1322-1323`); card "Total" (`:518`); hero card `active_7d/total` (`:748`) | raw number |
| active_7d | `data.active_7d` | "Active (n)" pill (`:1286`), card (`:526`) | raw |
| active_30d | `data.active_30d` | only to derive the Inactive count (`:1323`). Backend: includes active_7d (AUDIT.md §3.2) | — |
| stale | `data.stale` | "Stale (n)" pill (`:1304`), card (`:534`), hero warning `"{n} stale (>30 days)"` (`:756-760`) | raw |
| source | `data.source` | banner `· Source: <label>` via `tabletSyncSourceLabel` (`:1402-1410`, `:134-142`) | label map (see below) |
| refreshed_at | `data.refreshed_at` | card "Last refresh", fallback `dataUpdatedAt` (`:463-467`, `:505`) | `formatDate` en-GB `dd MMM yyyy, HH:mm` (`:420-429`) |
| providers[].provider | `provider` | "Provider" column (`:1452-1456`); CSV col 1; row key | text |
| providers[].district | `district` | "District" column, fallback `"Unknown"` (`:1459`); CSV `?? ""` | text |
| providers[].facility | `facility`, then `location_id` | "Facility" column, fallback `"Unknown"` (`:1464-1466`); CSV `facility ?? location_id ?? ""` (`:1217`) | text |
| providers[].last_activity | `last_activity` | "Last Activity" column (`:1469-1482`); CSV col 4; row key | table: `toLocaleString("en-GB", {day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"})`; CSV: `toLocaleString("en-GB")` default (`:1218-1220`) |
| providers[].total_events | `total_events` | "Events" column (`:1484-1486`); CSV `String(...)` | table `toLocaleString()` (browser locale) |
| providers[].status | `status` (`active`/`stale`/`inactive`, server-computed) | filter (`:1194`), "Status" badge (`:1489-1505`), CSV raw value (`:1222`) | badge labels `"Active"`, `"Stale (7-30d)"`, `"Inactive (>30d)"` |

`tabletSyncSourceLabel` map (`:134-142`): `"ecap_plus_superset_db.tablet_sync_status"` → `"ECAP+ tablet sync pipeline"`; `"ecap_plus_superset_db.children"` → `"ECAP+ pipeline seed snapshot"`; `"ecap_plus_source.children"` → `"ECAP+ source snapshot"`; `"opensrp.core.event"` → `"Live OpenSRP sync"`; anything else → `"Processed ECAP+ tablet snapshot"`. Branding → config.

**User activity** (`PmpUser`, `legacy:src/lib/directus.ts:810-824`; `DirectusActivityEntry`, `:759-776`). All derivations are inline in the render IIFE (`legacy:src/pages/DataPipelinePage.tsx:1559-1737`) and belong in `model/` with unit tests.

| Field (normalised) | Raw keys (in order) | Where shown / how used | Formatting |
|---|---|---|---|
| name | `first_name` + `last_name` joined by space, else `email`, else `"Unknown user"` (`:1574-1577`) | "User" column (`:2083-2085`), CSV col 1, tie-break sort | text |
| email | `email` | under name in "User" cell if present (`:2086-2090`); CSV col 2 | text |
| province | `title` trimmed (`:1563`) | "Role / Province" column main line, fallback `"—"` (`:2093-2095`); province filter; CSV "Province" | text |
| role | `description` trimmed | small line under province (`:2096-2100`, shows untrimmed `u.description`); role filter (`:1631`); CSV "User Role" (raw `u.description ?? ""`, `:1743`) | text |
| districts | `district` trimmed, else `location` trimmed; split on `,`, trimmed, empties dropped (`:1564-1568`) | "District" column joined `", "` or `"—"` (`:2104`); filter; CSV joined `"; "` (`:1745`) | list |
| facilities | `facility` trimmed, split on `,` (`:1569-1573`) | "Facility" column joined `", "` or `"—"` (`:2109`); filter; flag count; CSV joined `"; "` | list |
| lastActive (ms) | `max(Date(last_access), latest activity.timestamp for user.id)` (`:1579-1598`) | "Last Active" column, `"Never"` when 0 (`:2112-2126`); status; sort; CSV | table `toLocaleString("en-GB", {day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"})`; CSV `toLocaleString("en-GB")` or `"Never"` (`:1748-1750`) |
| events | count of activity rows with `user.id === u.id` (within the 500 fetched) + flag count if `description === "Facility User"`: sum over the user's facilities of `flagged_forms_ecapii` rows whose `facility` (trimmed, lowercased) equals the facility lowercased (`:1600-1616`) | **CSV only** ("Events" col); not shown in the table | number |
| status | `never` if lastActive is 0; `active` if age ≤ 7 days; `stale` if ≤ 30 days; else `inactive` (`:1618-1628`) | pills, filter, badge, CSV | labels: `"Active"`, `"Stale (7-30d)"`, `"Inactive (>30d)"`, `"Never logged in"` (`:1729-1737`); badge colours per status (`:1718-1727`) |
| id | `id` | row key, join with activity `user.id` | — |
| (unused) | `status` (`active`/`suspended`), `action`, `collection`, activity `user.*` profile fields | fetched but not used by the page | — |

### Filters / sort / pagination / search

**Tablet Sync tab**
- [ ] Status pills (`:1256-1326`), shown only once `tabletSync` is loaded: `All ({total})`, `Active ({active_7d})`, `Stale ({stale})`, `Inactive ({total - active_30d})`. Clicking an active non-All pill toggles back to `"all"` (`:1272-1277`, `:1290-1295`, `:1308-1313`). State `tabletFilter` (`"all" | "active" | "stale" | "inactive"`, default `"all"`, `:157-159`). Not persisted (no URL / storage). Applied to table and export; not to the counts (counts are server totals). Filter predicate `tabletFilter === "all" || p.status === tabletFilter` (`:1192-1195`). New: URL param via `platform/filters`.
- [ ] Search: none.
- [ ] Sort: none client-side; server order is `last_activity DESC` (AUDIT.md §3.2).
- [ ] Pagination: client-side, fixed page size `TABLET_PAGE_SIZE = 20` (`:132`); page resets to 1 when the filter changes (`:277-279`); current page clamped to `totalPages` (`:1200`); footer `"Showing {start}-{end} of {n}"` (ASCII hyphen, `:1513-1516`), `Previous` / `Page {p} / {total}` / `Next` (`:1518-1544`). Row number column `#` = global index (`:1447-1451`).

**User Activity tab**
- [ ] Status pills (`:1831-1907`), shown once `pmpUsers` loaded: `All ({locFiltered.length})`, `Active (n)`, `Stale (n)`, `Inactive (n)`, `Never logged in (n)`. Counts computed over the role/location-filtered list (`:1683-1685`). Toggle behaviour as above. State `activityFilter` default `"all"` (`:174-176`). Not persisted.
- [ ] Role select (`:1912-1929`): placeholder `"User role"`, first item `all` → `"All user roles"`; options = unique sorted union of hardcoded `["Administrator", "Provincial User", "District User", "Facility User"]` and every user's trimmed `description` (`:1654-1660`). Matches `norm(u.description) === value` (`:1631`). The hardcoded role list → config.
- [ ] Province select (`:1930-1947`): `"All provinces"`; options = unique sorted `title` values of loaded users (`:1661`). Exact match on trimmed `title`.
- [ ] District select (`:1948-1965`): `"All districts"`; options = unique sorted districts of users in the selected province (`:1662-1670`). Match: user's district list includes the value.
- [ ] Facility select (`:1966-1983`): `"All facilities"`; options = facilities of users in the selected province and district (`:1671-1681`). Match: user's facility list includes the value.
- [ ] Cascades: changing province resets district and facility to `"all"` (`:220-223`); changing district resets facility (`:225-227`). Any filter change resets page to 1 (`:210-218`).
- [ ] "Clear filters" pill appears when any of role/province/district/facility ≠ `"all"`; resets those four (not the status pill) (`:1984-1999`).
- [ ] All filters apply to table, pill counts (except status itself) and CSV export. Not persisted. New: URL params.
- [ ] Search: none.
- [ ] Sort (fixed, not user-changeable, `:1687-1699`): `never` users always last; otherwise `lastActive` descending; ties by name `localeCompare` ascending.
- [ ] Pagination: client-side, `ACTIVITY_PAGE_SIZE = 20` (`:182`); footer `"Showing {start}–{end} of {n}"` (en dash, `:2147-2149`); Previous / `Page {p} / {total}` / Next (`:2151-2177`). **Not clamped** (see Bugs).

### Exports
- [ ] **Tablet sync CSV** — trigger: "Export CSV" button in table header, disabled when `filtered.length === 0` (`:1327-1336`). Rows: **all filtered rows** (not just current page). Built by hand, every cell wrapped in `"..."`, joined by `,`, rows by `\n`, `Blob` type `text/csv`, anchor click (`:1213-1234`). No library.
  - Headers in order (`:1224-1225`): `Provider` (provider), `District` (district ?? ""), `Facility` (facility ?? location_id ?? ""), `Last Activity` (`toLocaleString("en-GB")` or ""), `Events` (total_events), `Status` (raw status value `active`/`stale`/`inactive`).
  - Filename (`:1232`): `` `pmp_user_activity_${activityFilter}_${new Date().toISOString().slice(0, 10)}.csv` `` — **BUG** (see below): should be a tablet-sync filename with `tabletFilter`.
- [ ] **User activity CSV** — trigger: "Export CSV" in card header, disabled when `filtered.length === 0` (`:1792-1801`). Rows: all filtered + sorted rows. Same hand-built format (`:1739-1763`).
  - Headers in order (`:1753-1754`): `User` (name), `Email` (email ?? ""), `User Role` (description ?? ""), `Province` (title trimmed), `District` (districts joined `"; "`), `Facility` (facilities joined `"; "`), `Events` (events), `Last Active` (`toLocaleString("en-GB")` or `"Never"`), `Status` (status label, e.g. `"Never logged in"`).
  - Filename (`:1761`): `` `pmp_user_activity_${activityFilter}_${new Date().toISOString().slice(0, 10)}.csv` `` (`pmp` prefix is a brand-ish string → config). Date is UTC (`toISOString`).
- [ ] New code: both via `platform/export`; keep column order; use the export layer's escaping and BOM.

### Charts
- [ ] None in part 2 range. Tablet pipeline card KPIs (Total / Active / Stale) are in `renderTabletSyncPipelineCard` (`:457-576`, part 1) and rendered in the left column of this tab (`:1238-1240`).

### Links in / out
- [ ] In: sidebar item (`legacy:src/components/dashboard/AppSidebar.tsx:100`); dashboard quick action `{ label: "Data pipeline", desc: "Pipeline runs, downloads, and tablet sync status.", to: "/data-pipeline" }` → `navigate(a.to)` (`legacy:src/pages/Dashboard.tsx:60-66`, `:105-110`), no payload; notification bell: a notification with `collection === "weekly_extracts"` links to `"/data-pipeline"` (`legacy:src/components/dashboard/DashboardHeader.tsx:116`, `:127-128`), no payload. No query params, `location.state` or storage keys are written before navigating. No deep link to a tab exists (tab is local state, `legacy:src/pages/DataPipelinePage.tsx:146-148`) → new `/data-pipeline/:tab?` adds it.
- [ ] `DashboardHeader` hides the global search and filter controls on `/data-pipeline` (`HIDDEN_ROUTES`, `legacy:src/components/dashboard/DashboardHeader.tsx:35-43`, `:85`). New route must keep that (match `/data-pipeline/*`).
- [ ] Out (part 2 range): none. No links to provider/user records. "Back to Runs" in the log viewer only clears `selectedRun` (`:1100-1107`).

### Loading / empty / error
- [ ] Tablet table: `!tabletSync` → centered `<LoadingDots />` (`:1415-1418`); filtered empty → Smartphone icon + `"No providers match this filter"` (`:1419-1425`). **No error state**: if `GET /etl/tablet-sync` fails, `tabletSync` stays undefined and the loader spins forever (no `isError` check anywhere in `:1189-1555`). New: `<ErrorState>` with retry.
- [ ] Live-sync banner (`:1355-1412`) text by stream status: `live` → `"Live sync is connected. "`; `connecting` → `"Connecting to live sync. "`; `reconnecting` → `"Live sync is reconnecting. "`; `idle` → `"Live sync starts when this tab is open. "`; then always `"Tablet sync updates as soon as the server receives fresh activity."`; then `" Last updated: <HH:mm>"` from last SSE contact, else from `tabletSyncQuery.dataUpdatedAt` (`toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit"})`); then `" · Source: <label>"` if `source` present. Activity icon turns green when live.
- [ ] Header (title `"Tablet / Provider Sync Status"`, pills, buttons, banner) is `sticky top-0` inside a `max-h-[70vh] overflow-y-auto` scroll container (`:1247-1248`).
- [ ] Refresh buttons show spinning icon and are disabled while `isFetching` (`:1341-1350`).
- [ ] Activity tab: if `pmpUsersQuery.isError || activityQuery.isError` → AlertCircle + `"Failed to load user activity"` + the error message or `"Unknown error"` (`:2031-2046`), no retry button (the header Refresh works). Else `!pmpUsers` → `<LoadingDots />` (`:2047-2050`); empty → Users icon + `"No users match this filter"` (`:2051-2055`).
- [ ] Partial failure: `flaggedFormsQuery` errors are ignored (flag counts silently 0, `:1601`). While `activityQuery` is still loading, users already render with status from `last_access` only, so pills and statuses can shift once activity arrives (`:1593-1598`, `:1831`).
- [ ] Info banner (`:2006-2028`): `Every PMP dashboard user with their latest recorded activity — users who have never logged in appear as "Never logged in".` + `Last updated: <HH:mm>` from `pmpUsersQuery.dataUpdatedAt` + `· Source: ECAP+ Users & Activity Log` (brand string → config).
- [ ] Log viewer tail: error banner `"Error: {selectedRun.error}"` when present (`:1171-1175`); `"Output Logs"` heading; `<pre>` dark box, max height 500 px, wraps, `{selectedRun.logs || "(no output yet)"}` (`:1176-1183`). Header grid: Pipeline (`pipeline_name || pipeline`), Started (`formatDate`), Duration (`formatDuration`: `"-"` if falsy, else `"{m}m {s}s"` or `"{s}s"`, `:413-418`), Triggered By (`triggered_by`) (`:1135-1168`).

### Bugs and quirks
- [ ] **BUG** Tablet CSV filename reuses the user-activity name and the *activity* filter: `pmp_user_activity_${activityFilter}_<date>.csv` (`legacy:src/pages/DataPipelinePage.tsx:1232`). Port intended: a tablet-sync filename containing the tablet filter (e.g. `<prefix>_tablet_sync_<filter>_<date>.csv`, prefix from config).
- [ ] **BUG** CSV cells are wrapped in quotes but embedded `"` are not escaped (`:1228`, `:1757`); names/facilities with quotes break the file. `URL.createObjectURL` is never revoked (`:1231`, `:1760`). Use `platform/export`.
- [ ] **BUG** Sidebar visibility check never matches (`"Data Pipeline"` vs label `"Data pipeline"`, `legacy:src/components/dashboard/AppSidebar.tsx:98,172`) — page visible in nav to everyone; and there is no route guard.
- [ ] **BUG** Tablet "Last Activity" cell does `new Date(p.last_activity)` with no null check (`:1472-1480`) → `"Invalid Date"` for a null value (backend can return null, AUDIT.md §3.2), while the CSV guards it (`:1218-1220`). Show `"—"`/`"Never"`.
- [ ] **BUG** Tablet tab has no error state; a failed fetch shows an endless loader (`:1415-1418`).
- [ ] **BUG** Activity pagination is not clamped: after a refetch shrinks the list, `activityPage` can exceed `totalPages`, rendering an empty table with `"Showing 21–15 of 15"` (`:1701-1716`); the tablet tab clamps (`:1200`).
- [ ] **BUG** Activity Refresh spinner ignores `flaggedFormsQuery.isFetching` although the disabled state includes it (`:1811-1823`).
- [ ] **QUESTION** "Events" counts only activity rows among the **latest 500 activity rows across all PMP users** (`legacy:src/lib/directus.ts:788-808`), so it is a truncated, misleading number; and `lastActive` from activity is only accurate for users within that window (`last_access` covers the rest). Also adds flag counts from `flagged_forms_ecapii` (another program) matched by facility name only for `"Facility User"`. The column is only in the CSV. Decide whether to keep "Events" at all, or get a server-side aggregate.
- [ ] **QUESTION** `listPmpUsers` caps at 500 users (`legacy:src/lib/directus.ts:833-834`) with no pagination; larger user bases are silently truncated.
- [ ] Quirk: tablet status buckets are server-computed (`p.status`), user-activity buckets are client-computed with the same thresholds (7 / 30 days, `:1618-1628`). Stale label says `"Stale (7-30d)"` while the hero card says `"{n} stale (>30 days)"` (`:758`) — **BUG** contradictory: stale is 7–30 days (AUDIT.md §3.2 `data.stale`). Use the 7–30 d wording.
- [ ] Quirk: two different "showing" separators (`-` at `:1514`, `–` at `:2148`); unify.
- [ ] Quirk: date formats are hardcoded `en-GB` / `toLocaleString()` (browser locale for event counts, `:1485`); new code formats via `core/lib/format.ts`.
- [ ] Quirk: the Directus wrappers throw on a missing `VITE_DIRECTUS_USER_ROLE`; the PMP role id is configuration → `@/config/env.ts` (it is not a secret).
- [ ] PII: emails and caseworker names are persisted to IndexedDB for 24 h via the global persister (`legacy:src/App.tsx:140-148`, `:216-224`) → `meta: { persist: false }` on all four queries.

## Other behaviour

### The page: hero, pipelines, run history and logs draft

- [ ] **Timers / streams** (lines 1–1200): runs poll `refetchInterval: 10_000` (`:193`); tablet-sync poll `refetchInterval: 15 min` (`:200`); log poll `setInterval(…, 3000)` while pending/running (`:381-389`); SSE `EventSource` on `/etl/tablet-sync/stream` only while Tablet Sync tab is open (`:281-354`). App-wide: `EtlInvalidator` polls `/etl/last-success` every 30 s and invalidates all non-`etl` keys (`legacy:src/components/EtlInvalidator.tsx:53-61`, `:78-80`) — affects this page's `["directus", …]` keys.
- [ ] **Storage:** page writes no localStorage/sessionStorage. Auth token is read via `getStoredToken()` for headers and `?token=` URLs (`legacy:src/lib/api.ts:684`, `:753-757`). React Query cache persisted to IndexedDB key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`).
- [ ] **Browser APIs:** `EventSource` (feature-detected, `:287`), `document.createElement("a").click()` for downloads (`:394-398`), `Intl.DateTimeFormat` with `timeZone: "Africa/Lusaka"` (`:109-117`).
- [ ] **Toasts** (sonner): "Failed to load run details"; email success `data.message || "Email report sent to the team"`; "Failed to send email" + description; "Refreshed".
- [ ] **Hardcoded program/brand strings to move to config** (`legacy:src/pages/DataPipelinePage.tsx`): pipeline descriptions naming "ECAP Plus"/"ECAP+", "OpenSRP", "Mage AI" (`:84`, `:90`, `:96`, `:102`); "ECAP+ Tablet Sync Status Refresh" (`:484`); source labels (`:136-141`); "ECAP Plus + HTS Register" (`:733`); "Prevention of Mother-to-Child Transmission" (`:808`); "Mage AI controlled" (`:952`); "Updated by Mage AI always-on pipeline" (`:551`); file-name fallbacks with `ecapplus` (`:122-128`); timezone `"Africa/Lusaka"` (`:110`); pipeline keys `ecap_plus`, `hts_register`, `pmtct`, `ecap_plus_tablet_sync` (`:106`, `:131`).

### The page: tablet sync and user activity draft

- [ ] Timers / streams (page-level, relevant to this part): tablet-sync `refetchInterval` 15 min (`legacy:src/pages/DataPipelinePage.tsx:200`); SSE `EventSource` while the Tablet tab is open (`:281-354`); runs `refetchInterval` 10 s (`:193`, part 1); log auto-poll `setInterval` 3 s while a selected run is running/pending (`:375-390`). Global defaults: `staleTime` 60 s, `gcTime` 24 h, refetch on mount/focus/reconnect, `retry: 1` (`legacy:src/App.tsx:112-133`).
- [ ] Storage: page writes none itself. Indirect: React Query IndexedDB persister key `"ecap-plus-pmp-react-query"` (`legacy:src/App.tsx:147`) stores the four queries above.
- [ ] Browser APIs: `EventSource` (feature-detected, `:287-290`), `Blob` + `URL.createObjectURL` + synthetic anchor click for CSV (`:1229-1233`, `:1758-1762`); commented-out `navigator.clipboard.writeText` (`:2223`).
- [ ] Tab switching: clicking any tab sets `activeTab` and clears `selectedRun` (`:773-778`). Directus queries only fire once the Activity tab is opened; SSE only on the Tablet tab. New: tab from route param `:tab?` (`pipelines` default, `runs`, `tablets`, `activity`).
- [ ] Layout: Tablet tab is a 3-column grid on xl — pipeline card (1 col) + table (2 cols) (`:1237-1241`); table `min-w` none; activity table `min-w-[1000px]` with horizontal scroll (`:2058-2059`).
- [ ] **Dead code — "Announce New Update" (commented out, `:1781-1791`, `:2185-2280`)**. Inventory only; do not port unless the developer asks. Behaviour: admin-only button (`isAdminUser`, `:169`) disabled when no rows; dialog title `"Announce New Update"`, description `Delivers to the notification bell of the <n> user(s) currently listed (respects the filters above).`; inputs Subject (placeholder `"Subject — e.g. New feature: User Activity tab"`) and Message textarea 5 rows (placeholder `"Message — what's new and where to find it…"`); "Copy recipient emails" copies filtered emails joined `", "` → toast `"Copied {n} email addresses"` / `"Could not copy to clipboard"`; "Send to notification bell" disabled while sending or when subject/message blank (trimmed); calls `broadcastAnnouncement(filtered ids, subject, message)` → toast.warning `"Sent to {sent} users, {failed} failed"` or toast.success `"Announcement sent to {sent} users"`, closes and clears; error toast with message or `"Failed to send announcement"`. Would issue one `POST /notifications` per recipient from the browser (AUDIT.md §3.5 item 6).

## Open questions for the developer

### The page: hero, pipelines, run history and logs draft

1. Who may see `/data-pipeline`? Legacy intent is admins + support (sidebar rule), but the rule is broken and the route is open. Should the User Activity tab (other users' emails) be admin-only, separate from the pipeline monitoring tabs?
2. Should the "Email Report" button stay, and for whom? The backend has no permission check and echoes recipient emails in the success message.
3. Keep the hardcoded fallback file names (`DEFAULT_PIPELINE_FILES`) or rely only on `/etl/files/:pipeline` + `/etl/pipelines`?
4. Should the card title use the server `name` for `pmtct` (dropping the client override)?
5. How to address a selected run in the URL: `/data-pipeline/runs?run=<id>` or a nested `/data-pipeline/runs/:runId`?
6. Revive the commented-out "Announce New Update" broadcast (Directus notifications to filtered users), or drop it?
7. Downloads: can the backend accept a header-authenticated blob fetch so the token stops travelling in `?token=`?

### The page: tablet sync and user activity draft

1. Who may open `/data-pipeline`? Legacy intended admin + support only (sidebar), but the check is broken and the route is unguarded. Should the User Activity tab (emails of all users) be admin-only even if support can see pipelines?
2. Keep the "Events" column in the user-activity CSV, given it is truncated to the latest 500 activity rows and mixes in flag counts from `flagged_forms_ecapii` (another program's collection)? Or should flag counts come from `flagged_forms_ecapplus_pmp`?
3. Should the user list paginate server-side beyond 500 users?
4. Port the commented-out "Announce New Update" broadcast, or drop it? (If kept, it needs a server-side fan-out.)
5. SSE auth: keep the `?token=` query parameter for `EventSource`, or can the backend issue a short-lived stream token?
6. Should tablet-sync data be scoped by the viewer's province/district (backend currently returns all providers)?
