# analytics — legacy audit

> New module `analytics` · Legacy routes → new routes: `/charts` → `/analytics` · Plan: MIGRATION_PLAN.md §5 row "analytics"
> ("Superset embeds via `POST /superset/guest-token` (section 8.1). Check whether `MetricsGrid` also depends on Superset" — answered below: it does not.)

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/Charts.tsx` | 119 | Routed page (`/charts`). Builds the dashboard list from env vars, renders the hero, the tab bar and one `EmbeddedDashboard`. |
| `legacy:src/components/dashboard/EmbeddedDashboard.tsx` | 144 | Mounts one Superset dashboard with `@superset-ui/embedded-sdk`; loading / error / retry overlays; iframe sizing; CSS "fullscreen" toggle. Only used by Charts. |
| `legacy:src/lib/superset.ts` | 44 | `fetchGuestToken(dashboardId)` → `POST /superset/guest-token` on the DQA backend; exports `SUPERSET_DOMAIN`. **Working-tree patched** (security-fix): `git diff` shows 27 insertions / 84 deletions vs `HEAD`. |
| `legacy:src/App.tsx` | 602 | Lazy import `:88`, route `:405-412`. Global QueryClient defaults `:112-134` (not used by this module: no React Query here). |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard used by `/charts`. |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar entry "Program Dashboard" `:52`; visibility filter `:147-181`. |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | No `/charts` entry (`:5-11`). |
| `legacy:src/components/dashboard/DashboardLayout.tsx` | 110 | Mobile sheet menu entry "Charts" `:43`, rendered unfiltered `:75`. |
| `legacy:src/components/dashboard/DashboardHeader.tsx` | 539 | `/charts` is in `HIDDEN_ROUTES` `:35-43` → global search and FY filter hidden (`:85,245-256`); subtitle shown `:238-239`. |
| `legacy:src/components/dashboard/GlobalSearch.tsx` | 212 | Nav entry "Charts" `:43`, rendered unfiltered `:108`. |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by any analytics file (scope is server-side only). Read for completeness. |
| `legacy:src/lib/auth.ts` | 41 | `getStoredToken()` (localStorage key `ecap.access_token`, `:1,9-23`) used by `fetchGuestToken`. |
| `legacy:src/lib/env.ts` | 17 | `getBackendBaseUrl()` = env `REACT_PUBLIC_API_URL` (`:16-17`). |
| `legacy:src/context/AuthContext.tsx` | 174 | Supplies `user` (dependency of the embed callback); `refreshProfile` replaces the user object (`:76-85`). |
| `backend:controllers/supersetController.js` | 102 | Handler of `POST /superset/guest-token` (read-only reference). |
| `backend:lib/userScope.js` | (read `:15-80`) | Server-side scope derivation for RLS. |
| `backend:routes/supersetRoutes.js` | 7 | Route registration `:5`. |

Package: `@superset-ui/embedded-sdk` `^0.3.0` (`legacy:package.json:47`, lockfile resolves 0.3.0). `node_modules` is not present in the legacy folder, so SDK-internal behaviour below is marked as such and must be verified against the SDK when porting.

`MetricsGrid` / Superset question from the plan: `MetricsGrid` has **no runtime dependency** on Superset; the only mention is a comment explaining that the households count endpoint matches a Superset chart (`legacy:src/components/dashboard/MetricsGrid.tsx:210-213`). Likewise `legacy:src/context/FyFilterContext.tsx:22` (comment) and `legacy:src/components/dashboard/CanonicalKpiStrip.tsx:114` (user-visible copy that mentions "Superset dashboards" — owned by whichever module ports CanonicalKpiStrip).

## Route `/charts` → `/analytics`

### Purpose
Hosts up to three embedded Apache Superset dashboards ("Program insights & trends") in a tabbed view. All charting, filtering and data scoping happens inside Superset; the page only obtains a guest token and mounts the SDK iframe.

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:405-412`). `ProtectedRoute` renders nothing while auth is loading (`legacy:src/components/auth/ProtectedRoute.tsx:8-10`), redirects to `/` when there is no user (`:12-14`), and to `/change-password` when `user.password_change_required` (`:16-18`). New app: route-level permission in the manifest (e.g. `analytics.view`), granted to every authenticated role to keep parity.
- [ ] Sidebar: section "Overview", item `{ title: "Program Dashboard", url: "/charts", icon: BarChart3 }` (`legacy:src/components/dashboard/AppSidebar.tsx:52`). None of the filter conditions in `filteredSections` touch it (`:164-176`: only `item.url === "/districts" && isDistrictUser`, `section.label === "Admin" && !isAdmin`, `section.label === "Data Pipeline" && !isAdmin && !isSupport`), so it is **visible to every logged-in user**. Active state is exact-path match (`:183`, `NavLink ... end` `:245-247`).
- [ ] Mobile bottom nav: **no entry** (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). Mobile sheet menu ("Navigation"): `{ title: "Charts", url: "/charts", icon: BarChart3 }` (`legacy:src/components/dashboard/DashboardLayout.tsx:43`), no visibility filter (`:75`).
- [ ] Global search: navigation item `{ title: "Charts", url: "/charts", icon: BarChart3, category: "Navigation" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:43`), rendered for everyone, no filter (`:108-112`).
- [ ] In-page role/permission checks: **none** in `Charts.tsx`, `EmbeddedDashboard.tsx` or `superset.ts`. No `isAdmin`, `description`, `title` or `location` comparisons.
- [ ] Data scope: **entirely server-side**. The frontend sends only `{ dashboardId }` (`legacy:src/lib/superset.ts:34`); `useEffectiveDistrict` is not used and the FY filter is hidden on this route (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,253-256`). The backend loads the caller's Directus profile (`GET /users/me?fields=id,email,first_name,last_name,description,title,location,role.name`, `backend:lib/userScope.js:66-70`, cached 5 min `:52-53,60-61,77`), derives `national` / `province` / `district` / `none` (`backend:lib/userScope.js:18-49`) and turns it into Superset RLS (`backend:controllers/supersetController.js:35-47`):
  - national (`admin_access === true`, role name `administrator`, description contains `"admin"`, description `=== "ecap+ support"`, or blank description + a role + no location + no title — `backend:lib/userScope.js:27-35`) → `[]` (no RLS).
  - province (description contains `"provincial"`/`"province"`) → `<column> IN ('<d1>', …)` from `config/geography.js` `DISTRICTS_BY_PROVINCE[title]`; unknown province → `none` (`backend:lib/userScope.js:37-43`).
  - district (description contains `"district"` or any non-`All` `location`) → `<column> = '<location>'` (`backend:lib/userScope.js:45-46`).
  - `none` → 403 (`backend:controllers/supersetController.js:74-79`).
  - Column from `SUPERSET_RLS_DISTRICT_COLUMN` (default `district`), regex-validated (`:27-33`); per-dataset rules if `SUPERSET_RLS_DATASET_IDS` is set (`:45-46`); `SUPERSET_RLS_ENABLED=false` disables RLS for everyone (`:36`).
  - New frontend: nothing to port for RLS, but `program.config.ts` geography must stay in sync with `backend:config/geography.js` or province users get 403 (AUDIT.md §3.2). The frontend must **not** send any scope fields.

### Endpoints
- [ ] `POST /superset/guest-token` (AUDIT.md §3.2) — wrapper `fetchGuestToken(dashboardId, _user?)` (`legacy:src/lib/superset.ts:21-42`), raw `fetch` to `${getBackendBaseUrl()}/superset/guest-token` (`:28`), headers `Content-Type: application/json` + `Authorization: Bearer <token from localStorage "ecap.access_token">` (`:29-33`, `legacy:src/lib/auth.ts:1,9-23`), body `{ dashboardId }` only (`:34`). The second argument is accepted and ignored (`:18-20,23`). Throws `"Not authenticated."` if there is no stored token, before any request (`:25-26`).
  - Fires: from the SDK's `fetchGuestToken` callback (`legacy:src/components/dashboard/EmbeddedDashboard.tsx:40-45`) on every embed (mount, tab switch — the component is keyed by tab `legacy:src/pages/Charts.tsx:96` so a tab switch remounts it — Retry, or a change of the `user` object, `EmbeddedDashboard.tsx:63`). SDK-internal (verify): the SDK also calls `fetchGuestToken` again before the guest token expires to refresh it.
  - **Not** React Query: no key, no staleTime/gcTime, no caching; each embed fetches a new token. New app: may use a `queryOptions` with `meta: { persist: false }` (user-private token) and `staleTime` < token lifetime, or keep it as a plain call inside the SDK callback — either way through `core/api` so the token header and 401 handling are uniform.
  - Response handling: `response.json().catch(() => null)` (`:37`); if `!response.ok || !data?.token` throws `Error(data?.message ?? "Guest token request failed (<status>)")` (`:38-40`); returns `data.token` (`:41`). Backend response is `{ status: "success", token }` (`backend:controllers/supersetController.js:91`); error bodies `{ status, message }` with 503 / 401 / 400 / 403 / 502 (`backend:controllers/supersetController.js:51-98`, full list in AUDIT.md §3.2). The backend `message` is what ends up in the error overlay.
- [ ] Superset (third-party origin, not DQA/Directus): the SDK loads `<VITE_SUPERSET_DOMAIN>/embedded/<dashboardId>` in an iframe and talks to it via postMessage (SDK-internal). `supersetDomain` = env `VITE_SUPERSET_DOMAIN` (`legacy:src/lib/superset.ts:12,44`, used `EmbeddedDashboard.tsx:38`). New env name: `VITE_SUPERSET_URL` (MIGRATION_PLAN.md env table). CSP for the new deploy must allow this origin in `frame-src`.
- [ ] Pre-patch behaviour (for context only, **never port**): `HEAD:src/lib/superset.ts` logged into Superset from the browser with `VITE_SUPERSET_USERNAME` / `VITE_SUPERSET_PASSWORD` (`POST /api/v1/security/login`, `HEAD:src/lib/superset.ts:13-15,31-49`) and requested the guest token itself with client-built `rls` defaulting to `[]` (`:54-99`) — plan finding S1. The patched wrapper replaced this; those env vars are "removed, never reintroduce" (MIGRATION_PLAN.md env table).

### Dashboards list (configuration)
- [ ] Hardcoded list, filtered to entries whose env var is non-empty (`legacy:src/pages/Charts.tsx:12-28`, `.filter((d) => d.id)` `:28`). Order and labels:

  | key | Tab label | Env var NAME |
  | --- | --- | --- |
  | `main` | `"ECAP+ Dashboard"` (brand string) | `VITE_SUPERSET_DASHBOARD_ID_1` (`:13-17`) |
  | `services` | `"Services"` | `VITE_SUPERSET_DASHBOARD_ID_2` (`:18-22`) |
  | `performance` | `"Performance"` | `VITE_SUPERSET_DASHBOARD_ID_3` (`:23-27`) |

- [ ] New app: a single `VITE_SUPERSET_DASHBOARDS` JSON map `{ key: uuid }` (MIGRATION_PLAN.md env table) validated by zod in `env.ts`; labels (incl. the program-branded first label) come from `@/config` (site/program config), not the module. Keys `main`, `services`, `performance` preserve tab identity. Dashboard IDs are not secrets but must match the backend allowlist `SUPERSET_DASHBOARD_IDS` (`backend:controllers/supersetController.js:12,64-70`) or the backend returns 400 "Unknown or non-embeddable dashboard."
- [ ] Hero badge count `Superset · {DASHBOARDS.length} dashboards` (`legacy:src/pages/Charts.tsx:60`) reflects configured dashboards only.

### Tabs
- [ ] Tab bar rendered only when more than one dashboard is configured (`legacy:src/pages/Charts.tsx:70`). Buttons in list order, label text = `d.label` (`:72-89`); active style emerald text on white, inactive slate (`:79-84`).
- [ ] Default tab: first configured dashboard's key, or `"main"` when none (`:31`). State is local `useState` only — **not persisted** (no URL param, no storage). New app: sync to the URL (e.g. `/analytics/:tab?` or `?tab=`), per CLAUDE.md filter/URL rules, defaulting to the first configured key.
- [ ] Switching tab remounts `EmbeddedDashboard` (`key={activeDashboard.key}`, `:96`) → previous iframe destroyed, new guest token requested, loading overlay shown again. No caching of already-loaded dashboards.
- [ ] `title` passed to the embed = tab label (`:98`) — used only in the loading text.

### Embed / iframe sizing
- [ ] `embedDashboard({ id, supersetDomain, mountPoint, fetchGuestToken, dashboardUiConfig })` (`legacy:src/components/dashboard/EmbeddedDashboard.tsx:36-53`) with `dashboardUiConfig = { hideTitle: true, hideChartControls: false, hideTab: false, filters: { expanded: false }, urlParams: {} }` (`:46-52`). Port these exact options (Superset title hidden; chart controls and Superset's own tabs shown; native filter bar collapsed).
- [ ] Guard: no embed when the mount ref is null or `dashboardId` is empty (`:30`).
- [ ] Props: `dashboardId` (required), `title` default `"Dashboard"` (`:20`), `minHeight` default `"80vh"` (`:21`); Charts passes no `minHeight` → 80vh.
- [ ] Sizing: outer wrapper `style.minHeight = minHeight` (or `100vh` in fullscreen) (`:89`); mount div `width:100%; height:100%; minHeight` (`:136-139`); after status becomes `ready`, the SDK's `<iframe>` is styled `width:100%`, `height:100%`, `min-height: <minHeight>`, `border:none` (`:70-80`). Effective iframe height is therefore 80vh (percent heights resolve to auto because no ancestor has a fixed height). The iframe does not auto-resize to Superset content; Superset scrolls inside the iframe.
- [ ] Fullscreen: CSS-only toggle (no Fullscreen API) — wrapper becomes `fixed inset-0 z-50` with white/dark background (`:82-86`); button visible only when `status === "ready"` (`:92`), absolutely positioned top-right `z-20` over the iframe (`:91`), title `"Fullscreen"` / `"Exit fullscreen"`, icons Maximize2 / Minimize2 (`:98-104`). No Escape-key handling.
- [ ] Wrapper non-fullscreen: rounded bordered card with `overflow-hidden` (`:86`).

### Fields used
| Field (normalised name the page uses) | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| guest token | `data.token` (`legacy:src/lib/superset.ts:38,41`) | returned to SDK | — |
| error message | `data.message` (`:39`) | error overlay text | verbatim, fallback `Guest token request failed (<status>)` |
| user email / first / last name | `user.email ?? "guest"`, `user.first_name ?? "Guest"`, `user.last_name ?? "User"` (`legacy:src/components/dashboard/EmbeddedDashboard.tsx:42-44`) | passed to `fetchGuestToken` second arg, **ignored** by the patched wrapper (`superset.ts:23`) | — (do not port; backend uses the Directus profile, `backend:controllers/supersetController.js:83-87`) |

### Filters / sort / pagination / search
- [ ] No page-level filters, search, sort or pagination. All filtering is Superset's native filter bar inside the iframe (collapsed by default, `EmbeddedDashboard.tsx:50`).
- [ ] The global FY filter and global search are **hidden** on `/charts` (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43` lists `"/charts"`; `:85` `hideSearchAndFilter`; `:245-250` search, `:253-256` FY filter). Because GlobalSearch is not mounted there, its Cmd/Ctrl+K shortcut (`GlobalSearch.tsx:54-64`) also does not work on this page. The new shell should hide the FY/scope controls on `/analytics` (they do not affect Superset); keep or drop the search hiding as a shell decision.
- [ ] `urlParams: {}` — no app scope/FY is forwarded into the dashboard (`EmbeddedDashboard.tsx:51`).

### Exports
- [ ] None in the app. (Any download/CSV happens inside Superset via `hideChartControls: false`, i.e. Superset's own chart menus.)

### Charts
- [ ] No app-rendered charts or KPI cards. All visualisations are Superset dashboards identified by the env-configured UUIDs.

### Links in / out
- [ ] In: sidebar "Program Dashboard" (`legacy:src/components/dashboard/AppSidebar.tsx:52`); mobile sheet menu "Charts" (`legacy:src/components/dashboard/DashboardLayout.tsx:43`); global search "Charts" (`legacy:src/components/dashboard/GlobalSearch.tsx:43`). No payload (no query params, no `location.state`, no storage written). Text-only mentions (no link): `legacy:src/data/documentationArticles.ts:26` ("Overview: … Charts …"), `legacy:src/lib/ai-service.ts:54` ("**Charts**: Analytics and reporting section."), `legacy:src/data/supportData.tsx:77` ("read-only: Can view reports and charts …"). Docs/assistant text should be updated to the new name/path when those modules are ported.
- [ ] Legacy redirect: `/charts` → `/analytics` in the manifest's legacy redirects.
- [ ] Out: none from the page. (Links inside Superset dashboards are Superset's.)

### Loading / empty / error
- [ ] Auth loading: `ProtectedRoute` renders `null` (`ProtectedRoute.tsx:8-10`).
- [ ] Page chunk: lazy-loaded via `lazyWithRetry` (`legacy:src/App.tsx:88`).
- [ ] Embed loading: full overlay with spinner (Loader2) and text `Loading {title}…` (e.g. "Loading Services…") (`EmbeddedDashboard.tsx:110-115`). Status becomes `ready` as soon as `embedDashboard` resolves (`:55`), i.e. when the iframe is created/handshaken, not when Superset charts finish loading; Superset shows its own loaders afterwards. New app: replace with a skeleton per UI rules.
- [ ] Error: overlay with AlertTriangle, heading `"Unable to Load Dashboard"`, the error message, and a `Retry` button (outline, RefreshCw) that re-runs the embed (`:118-133`); also `console.error("Failed to embed Superset dashboard:", err)` (`:57`). No toast. Port as `<ErrorState>` with retry; map backend statuses to messages (400 unknown dashboard, 403 no scope, 503 not configured, 502 upstream).
- [ ] Empty (no dashboard env vars set): card with BarChart3 icon, `"No dashboards configured"` and a developer instruction text naming `VITE_SUPERSET_DASHBOARD_ID_1` "(and optionally _2, _3) … then restart the dev server" (`legacy:src/pages/Charts.tsx:100-112`). New app: `<EmptyState>` with an end-user message (and/or hide the nav item / disable `module.analytics` when no dashboards are configured).
- [ ] Partial failure: errors from the SDK's later token refresh (SDK-internal) are not caught by the page; only the initial `embedDashboard` promise is handled.

### Hero (page header)
- [ ] `DashboardLayout subtitle="Charts"` (`Charts.tsx:37`) → header subtitle text "Charts" (`DashboardHeader.tsx:238-239`).
- [ ] Eyebrow `"Program dashboard"` · today's date `new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })` (`Charts.tsx:34,48-50`) · badge `Live` with Activity icon (`:51-53`, decorative; nothing is live-polled). New app: format via `core/lib/format.ts`.
- [ ] Heading `"Program insights & trends"` (`:55-58`) + badge `Superset · {n} dashboards` (`:59-61`); description `"Embedded analytics across coverage, services, and performance."` (`:63`).
- [ ] Decorative gradients/blobs with `animate-pulse` (`:39-43`) — drop or reduce per UI animation rule; hardcoded colours → theme tokens.

### Bugs and quirks
- [ ] **BUG** iframe never fills fullscreen: in fullscreen the wrapper is `100vh` but the mount div and iframe keep `minHeight: 80vh` and `height: 100%` of an auto-height parent (`legacy:src/components/dashboard/EmbeddedDashboard.tsx:70-80,89,136-139`), so the dashboard occupies ~80vh with blank space below. Intended: fill the viewport in fullscreen (use a definite height / flex layout).
- [ ] **BUG** the `embedDashboard` return value (which carries `unmount()` and the SDK's refresh machinery) is discarded and the effect has no cleanup (`EmbeddedDashboard.tsx:36,65-67`). On tab switch/unmount the old embedded instance is not torn down (SDK-internal guest-token refresh timer may keep firing against an unmounted component); on Retry the SDK mounts into the same node again. Intended: keep the handle and call `unmount()` in the effect cleanup / before re-embedding.
- [ ] **BUG** `user` is a dependency of the embed callback (`EmbeddedDashboard.tsx:63`) although the patched wrapper ignores it; any `refreshProfile()` (`legacy:src/context/AuthContext.tsx:76-85`) or user object change re-embeds the dashboard and loses the user's in-dashboard state. Intended: depend on `dashboardId` only.
- [ ] **BUG** no session expiry handling: the guest-token call uses the raw localStorage token with plain `fetch` (`legacy:src/lib/superset.ts:25-35`) instead of the shared API client; a 401 shows a generic error overlay rather than signing out / redirecting, and an SDK token refresh after the Directus token expires fails silently. Intended: go through `core/api` with the app's 401 handling.
- [ ] **BUG** empty state shows developer instructions (env var names, "restart the dev server") to end users (`legacy:src/pages/Charts.tsx:107-110`).
- [ ] **BUG** hero badge pluralisation/zero case: shows `Superset · 0 dashboards` and `1 dashboards` (`Charts.tsx:60`).
- [ ] **BUG** hero uses hardcoded light colours with no dark variants (`Charts.tsx:39-63`) while `EmbeddedDashboard` has `dark:` classes (`EmbeddedDashboard.tsx:84-86`) — inconsistent dark mode.
- [ ] **BUG** inconsistent naming: sidebar "Program Dashboard" (`AppSidebar.tsx:52`) vs mobile menu / global search "Charts" (`DashboardLayout.tsx:43`, `GlobalSearch.tsx:43`) vs page subtitle "Charts" (`Charts.tsx:37`). Pick one label from config for nav, search and page title.
- [ ] Quirk: loading overlay disappears when `embedDashboard` resolves, before charts render (`EmbeddedDashboard.tsx:55`).
- [ ] Quirk: fullscreen toolbar button sits top-right over the iframe (`EmbeddedDashboard.tsx:91`) and can cover Superset UI in that corner; fullscreen overlay is `z-50` above the sticky header (`DashboardLayout.tsx:57` `z-40`). No Escape to exit.
- [ ] Quirk: tab selection is lost on reload/navigation (local state only, `Charts.tsx:31`).
- [ ] Quirk: hardcoded locale `"en-GB"` for the hero date (`Charts.tsx:34`).
- [ ] **QUESTION** brand strings: tab label `"ECAP+ Dashboard"` (`Charts.tsx:15`) and vendor name `"Superset"` in user copy (`Charts.tsx:60`) — move the label to config; decide whether to show the vendor name.

## Other behaviour
- [ ] Storage: reads localStorage `ecap.access_token` via `getStoredToken()` (`legacy:src/lib/auth.ts:1,20`) in `fetchGuestToken` (`legacy:src/lib/superset.ts:25`). Nothing written by this module. (Sidebar writes sessionStorage `ecap_sidebar_scroll`, `AppSidebar.tsx:126-131` — shell concern.)
- [ ] Timers: none in app code. SDK-internal guest-token refresh (verify against `@superset-ui/embedded-sdk` 0.3.0). Hero `animate-pulse` CSS animations only.
- [ ] Browser APIs: iframe + postMessage via the SDK; `console.error` on embed failure (`EmbeddedDashboard.tsx:57`).
- [ ] Env var NAMES used (no values): `VITE_SUPERSET_DOMAIN` (`superset.ts:12`), `VITE_SUPERSET_DASHBOARD_ID_1`, `_2`, `_3` (`Charts.tsx:16,21,26`), `REACT_PUBLIC_API_URL` via `getBackendBaseUrl` (`legacy:src/lib/env.ts:16-17`). Backend-side: `SUPERSET_URL`, `SUPERSET_EMBED_USERNAME`, `SUPERSET_EMBED_PASSWORD`, `SUPERSET_DASHBOARD_IDS`, `SUPERSET_RLS_ENABLED`, `SUPERSET_RLS_DISTRICT_COLUMN`, `SUPERSET_RLS_DATASET_IDS`, `SUPERSET_USE_CSRF` (AUDIT.md backend env list).
- [ ] No modals, forms, mutations, toasts or keyboard shortcuts in this module.
- [ ] Feature flag: `module.analytics` (MIGRATION_PLAN.md features.ts example). Suggest also treating "no dashboards configured" as module off for nav.
- [ ] Lazy-load the SDK (heavy library, MIGRATION_PLAN.md performance note) inside the analytics route chunk.

## Open questions for the developer
- **QUESTION** New route shape for tabs: `/analytics/:tab?` or `/analytics?tab=`? (Keys `main` / `services` / `performance`.)
- **QUESTION** Should the first dashboard's label stay the program-branded "<Program> Dashboard" (from config) or become a neutral "Overview"?
- **QUESTION** Keep showing the vendor name "Superset" and the "Live" badge in the hero?
- **QUESTION** Should the global search stay hidden on `/analytics` (legacy hides it along with the FY filter), or only the FY/scope controls?
- **QUESTION** Should the analytics nav item be hidden when `VITE_SUPERSET_DASHBOARDS` is empty, rather than showing an empty state?
- **QUESTION** Should the fullscreen toggle use the browser Fullscreen API (with Escape support) instead of the CSS overlay?
- **QUESTION** Backend asks to record: scope derivation fails open for free-text `description` containing "admin" (`backend:lib/userScope.js:27-35`); geography parity between `backend:config/geography.js` and `program.config.ts`; 5-minute profile cache delays scope downgrades (`backend:lib/userScope.js:52`). All already noted in AUDIT.md §3.2 — confirm they are in PROGRESS.md "Backend asks".
