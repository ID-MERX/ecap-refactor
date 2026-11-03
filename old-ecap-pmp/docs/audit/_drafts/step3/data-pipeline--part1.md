# data-pipeline — legacy audit (part 1: `DataPipelinePage.tsx` lines 1–1200)

> New module `data-pipeline` · Legacy routes → new routes: `/data-pipeline` → `/data-pipeline/:tab?` · Plan: MIGRATION_PLAN.md §5 row "data-pipeline"
>
> Scope of this part: everything defined or rendered in `legacy:src/pages/DataPipelinePage.tsx:1-1200`. That covers module constants, all page state, **all queries** (including the User Activity tab queries, defined at `:249-271`), the tablet-sync SSE stream, the hero, the five KPI cards, the tab bar, the **Pipelines** tab, the **Run History** tab, the **Log viewer**, the tablet-sync pipeline card (`renderTabletSyncPipelineCard`, `:457-576`), and the first lines of the **Tablet Sync** tab (filter + pagination maths, `:1190-1212`). The Tablet Sync table, its CSV export (`:1213` onward), and the whole **User Activity** tab body (`:1556-2283`) are documented in part 2. The file was read in full (2288 lines) for orientation.

## Legacy files

| File | Lines | Role |
|---|---|---|
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

## Other behaviour
- [ ] **Timers / streams** (lines 1–1200): runs poll `refetchInterval: 10_000` (`:193`); tablet-sync poll `refetchInterval: 15 min` (`:200`); log poll `setInterval(…, 3000)` while pending/running (`:381-389`); SSE `EventSource` on `/etl/tablet-sync/stream` only while Tablet Sync tab is open (`:281-354`). App-wide: `EtlInvalidator` polls `/etl/last-success` every 30 s and invalidates all non-`etl` keys (`legacy:src/components/EtlInvalidator.tsx:53-61`, `:78-80`) — affects this page's `["directus", …]` keys.
- [ ] **Storage:** page writes no localStorage/sessionStorage. Auth token is read via `getStoredToken()` for headers and `?token=` URLs (`legacy:src/lib/api.ts:684`, `:753-757`). React Query cache persisted to IndexedDB key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`).
- [ ] **Browser APIs:** `EventSource` (feature-detected, `:287`), `document.createElement("a").click()` for downloads (`:394-398`), `Intl.DateTimeFormat` with `timeZone: "Africa/Lusaka"` (`:109-117`).
- [ ] **Toasts** (sonner): "Failed to load run details"; email success `data.message || "Email report sent to the team"`; "Failed to send email" + description; "Refreshed".
- [ ] **Hardcoded program/brand strings to move to config** (`legacy:src/pages/DataPipelinePage.tsx`): pipeline descriptions naming "ECAP Plus"/"ECAP+", "OpenSRP", "Mage AI" (`:84`, `:90`, `:96`, `:102`); "ECAP+ Tablet Sync Status Refresh" (`:484`); source labels (`:136-141`); "ECAP Plus + HTS Register" (`:733`); "Prevention of Mother-to-Child Transmission" (`:808`); "Mage AI controlled" (`:952`); "Updated by Mage AI always-on pipeline" (`:551`); file-name fallbacks with `ecapplus` (`:122-128`); timezone `"Africa/Lusaka"` (`:110`); pipeline keys `ecap_plus`, `hts_register`, `pmtct`, `ecap_plus_tablet_sync` (`:106`, `:131`).

## Open questions for the developer
1. Who may see `/data-pipeline`? Legacy intent is admins + support (sidebar rule), but the rule is broken and the route is open. Should the User Activity tab (other users' emails) be admin-only, separate from the pipeline monitoring tabs?
2. Should the "Email Report" button stay, and for whom? The backend has no permission check and echoes recipient emails in the success message.
3. Keep the hardcoded fallback file names (`DEFAULT_PIPELINE_FILES`) or rely only on `/etl/files/:pipeline` + `/etl/pipelines`?
4. Should the card title use the server `name` for `pmtct` (dropping the client override)?
5. How to address a selected run in the URL: `/data-pipeline/runs?run=<id>` or a nested `/data-pipeline/runs/:runId`?
6. Revive the commented-out "Announce New Update" broadcast (Directus notifications to filtered users), or drop it?
7. Downloads: can the backend accept a header-authenticated blob fetch so the token stops travelling in `?token=`?
