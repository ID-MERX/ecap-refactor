# ICCMS PMP — Frontend Migration Plan

Rebuild of `../old-ecap-pmp` (branch `development`) into `./iccms-pmp` as a modular,
config-driven React SPA. Both this plan and the Phase 1 audit live in `iccms-pmp/`, which sits beside
`../old-ecap-pmp` and `../ecap-plus-pmp-backend`; both reference trees are read-only. Frontend only; the existing backends (custom "DQA" API and Directus)
stay as they are, except for the small set of backend asks in section 8.

## 0. How to use this plan

**For the developer:** work through the phases in order. Each phase ends with a prompt (section 9)
you paste into Claude Code. Review the result, run the app, commit, then start the next phase in a
fresh session. Never skip the review.

**Working assumptions (apply to every phase):**

- The backend does not change during this migration. The new frontend talks to the **same live
  backend** (DQA API + Directus) the legacy app uses today, with the same endpoints, parameters and
  response shapes. `pnpm dev` points at a real backend through `.env`, exactly like the legacy app.
- The **only** feature without a backend is the training log. It keeps its demo data behind a clearly
  labelled adapter until an API exists.
- MSW handlers and `test/fixtures/` exist **only for automated tests**. They are never used by
  `pnpm dev`, never bundled into the build, and never replace a real endpoint.
- The backend will be refactored later, after the frontend. Backend source may be added to Claude Code
  sessions as read-only reference so endpoints can be documented precisely; it is never edited here.

**For Claude Code:** `CLAUDE.md` holds the standing rules. This file holds the architecture and the
phase you are working on. Only do the phase you were asked to do. When a phase is complete, update
`docs/PROGRESS.md` and stop.

## 1. Goals

1. Same features and behaviour as the legacy app (parity), minus confirmed dead code.
2. Modular: features are self-contained modules that can be switched on/off or removed
   without touching other modules.
3. One source of truth for branding and program details, so the platform can be re-branded or
   ported to another program by editing `src/config` and `public/brand`.
4. Fast with large registers: virtualised tables, shared caches, no duplicate downloads.
5. Maintainable by one developer: few dependencies, strict types, lint-enforced boundaries,
   consistent patterns, tests where they pay off.

## 2. What the legacy app looks like (review summary)

Roughly 45,000 lines of TypeScript, 49 pages, 47 routes, two API backends (custom DQA API +
Directus), Superset embedded dashboards, a Leaflet map, WebRTC chat/calls and an AI assistant.
Claude Code must **verify** these findings in Phase 1, not take them on trust.

### 2.1 Security issues (fix in the legacy production app now, not only in the rebuild)

| # | Finding | Where | Severity |
|---|---|---|---|
| S1 | Superset service-account username/password are `VITE_` variables, so they are compiled into the public JS bundle. Anyone who opens dev tools can log into Superset as the embedder account. Row-level-security rules for guest tokens are also built in the browser, so a user can request an unrestricted token. | `src/lib/superset.ts`, `.env` | Critical |
| S2 | Page access is only hidden in the sidebar. Routes such as `/users`, `/users/new` and `/data-pipeline` have no permission guard; any logged-in user can open them by URL. | `src/App.tsx` | High |
| S3 | The sidebar hides the "Data pipeline" section by comparing against the label `"Data Pipeline"`, but the section label is `"Data pipeline"` — the check never matches, so the section shows for everyone. | `AppSidebar.tsx` | High |
| S4 | Roles and data scope are inferred from free-text profile fields (`description` contains "admin"/"provincial"/"district", province stored in `title`, district in `location`). The sidebar and `useEffectiveDistrict` use *different* rules for who is an admin. | `useEffectiveDistrict.ts`, `AppSidebar.tsx`, 6 pages | High |
| S5 | Logout clears the token but not the React Query cache or the IndexedDB-persisted cache. The next person on the same computer gets the previous user's cached beneficiary data (PII) on disk and potentially on screen. | `AuthContext.tsx`, `App.tsx` | High |
| S6 | Access token stored in `localStorage` with no refresh flow; expiry logs users out abruptly. | `lib/auth.ts` | Medium |
| S8 | **Backend:** the token middleware existed but was attached to no route, so every backend endpoint was reachable without logging in. Fixed by the `security-fix` patch (global middleware, `AUTH_MODE` rollout). | backend `index.js` | Critical (patched) |
| S9 | **Backend:** endpoints trust the `district` parameter; any logged-in user can request any district, and the HTS register ignores district entirely. | backend controllers | High (backend refactor) |
| S7 | `.env` contains `VITE_GROQ_API_KEY` (unused by code; the AI now goes through the backend) and Directus server CORS settings that do not belong in a frontend env file. | `.env` | Medium |

### 2.2 Structural problems

- **Monolithic API files:** `lib/api.ts` (≈1,480 lines) and `lib/directus.ts` (≈870 lines) hold every
  endpoint for every feature, plus defensive shape-guessing (`getCountValue` checks ~12 possible
  field names).
- **Giant pages:** `DataPipelinePage` 2,288 lines, `HouseholdProfile` 1,964, `VcaProfile` 1,807,
  `HTSRegister` 1,271, `ServicesPage` 1,254, `PMTCTRegister` 1,148.
- **Copy-pasted helpers:** `pickValue` defined 14 times, `formatDate` 8 times.
- **Every register re-implements** fetching, searching, filtering, pagination and CSV/PDF export by hand.
  23 pages build raw shadcn tables; nothing is virtualised.
- **Detail pages depend on `location.state` / `sessionStorage`** for the record ID, so links can't be
  bookmarked or shared and refreshing can lose the record.
- **TypeScript not strict** (`strict: false`, `noImplicitAny: false`), heavy `any` in profile pages.
- **Branding hardcoded** in ~50 files ("ECAP+", "PMP", app name in notifications, PDFs, AI prompt,
  storage keys). Geography (provinces/districts) and sub-population lists hardcoded in constants and pages.
- **Duplicated infrastructure:** two toast systems (shadcn toast + sonner), two theme systems
  (custom ThemeContext + next-themes), two date libraries (moment + date-fns), two lockfiles
  (`bun.lockb` + `package-lock.json`).
- **Polling everywhere:** notifications (30 s), calendar reminders (30 s) and ETL freshness each poll
  separately; browser notification permission is requested on page load.
- **Production served with `vite preview`** under pm2, which is a preview server, not a production server.
- **Tests:** one placeholder test.

### 2.3 Global search — why it is slow and incomplete

`GlobalSearch.tsx` downloads the **entire** VCA and household lists for the district when the dialog
opens, then renders only the first 10 of each. Because cmdk filters only the items that are rendered,
typing a name searches those 10 records, not the district: most records can never be found.
The navigation list inside the search is a hand-maintained copy of the sidebar and is already stale
(missing registers, services, performance, calendar and more).

### 2.4 Dead or questionable code (confirm with the developer before porting)

Unreferenced: `pages/VcaServicesDashboard.tsx`, `components/dashboard/{ServiceInsights, RecentActivity,
DataQualityChart, ActionQueueBanner, CalendarWidget, ProvincialBreakdown}.tsx`, two Aceternity components,
17 unused shadcn components. The route `/services/household-services` (`HouseholdServicesPage`) is not
linked from anywhere. `TrainingLog` runs on mock data. The AI assistant's system prompt names districts
(Lusaka, Ndola) that are not in the program's geography.

### 2.5 Good ideas worth keeping

- Stale-while-revalidate React Query defaults with IndexedDB persistence and a cache buster.
- `lazyWithRetry` + chunk-error boundary for stale deploys.
- `EtlInvalidator`: invalidate caches when an ETL run finishes (to be made targeted, see 4.9).
- Fiscal-year filter design (URL → localStorage → default) and its review checklist in `FY_FILTER_REVIEW.md`.
- The config-driven `ServicesPage` (one component, three service types). Generalise this pattern.
- Cmd/Ctrl+K command palette.

## 3. Target stack

**Version policy:** use the latest *stable* major of each package at install time (check with
`pnpm view <pkg> version`). Skip any release published in the last 14 days and pin exact versions
in `package.json`. Record the versions installed in PROGRESS.md.

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + `@vitejs/plugin-react-swc` | |
| Language | TypeScript, `strict: true` | |
| UI | React (current major, 19+) | |
| Styling | Tailwind CSS v4 (CSS-first config) | `@tailwindcss/vite`; no `tailwind.config.ts`, no PostCSS config |
| Components | shadcn/ui (current CLI) + Radix | Add components only when used |
| Icons | lucide-react | |
| Server state | TanStack Query v5 + `persistQueryClient` (IndexedDB via `idb-keyval`) | |
| Tables | TanStack Table v8 + TanStack Virtual | |
| Routing | React Router (current major, data mode with `createBrowserRouter`) | Routes assembled from module manifests |
| URL state | `nuqs` (React Router adapter) | Typed search params for filters, sort, page, FY |
| Forms | react-hook-form + zod (v4) | |
| Directus | `@directus/sdk` | Replaces hand-written `directus.ts` |
| Dates | date-fns (+ `@date-fns/tz` if needed) | moment removed |
| Charts | Recharts via shadcn `chart` component | Revisit only if a chart is too slow |
| Maps | react-leaflet + leaflet.heat | Loaded only inside the caseworker-journeys route |
| Client search | MiniSearch | Interim global search index (see 4.7) |
| Export | papaparse (CSV), jspdf + jspdf-autotable (PDF, lazy-loaded) | |
| Toasts | sonner | Only toast system |
| Theme | shadcn Vite theme-provider pattern | Only theme system |
| Superset | `@superset-ui/embedded-sdk` | Guest tokens from the backend only |
| Testing | Vitest + Testing Library + MSW; Playwright | |
| Lint/format | ESLint flat config + `typescript-eslint` + `eslint-plugin-boundaries` + react-hooks; Prettier | |
| Housekeeping | pnpm, `.nvmrc`, `knip` (unused code/deps), `rollup-plugin-visualizer` | |

Removed from the legacy stack: moment, next-themes, shadcn toast, Aceternity effects, framer-motion
(re-add the `motion` package only for a specific, justified need), embla-carousel, vaul, input-otp,
react-resizable-panels, `bun.lockb`. PeerJS (WebRTC calls) only if the developer confirms calls are used.

## 4. Target architecture

### 4.1 Folder structure

```
iccms-pmp/
  CLAUDE.md
  docs/                 MIGRATION_PLAN.md, AUDIT.md (index), audit/<module>.md, PROGRESS.md,
                        ADDING_A_MODULE.md, REBRANDING.md
  public/brand/         logo.svg, logo-mark.svg, favicon.ico, login-background.jpg, og-image.png
  e2e/                  Playwright smoke tests, one per module
  test/fixtures/        Sanitised API response samples (JSON), used by MSW
  scripts/check-brand.mjs
  src/
    main.tsx
    app/
      providers.tsx       QueryClient + persistence, theme, toasts, tooltip, auth
      router.tsx          Builds the route tree from enabled module manifests
      module-registry.ts  The single list of modules
      layouts/            AppLayout (sidebar, header), AuthLayout
      boundaries/         RouteErrorBoundary, WidgetBoundary, ChunkErrorBoundary
      styles/             globals.css, theme.css (brand tokens)
    config/
      site.config.ts      Branding and organisation
      program.config.ts   Country, geography, fiscal year, sub-populations, terminology
      env.ts              Zod-validated import.meta.env
      features.ts         Module and feature flags
      index.ts
    core/
      api/                http client, dqa client, directus client (SDK), ApiError, auth refresh
      auth/               session, AuthProvider (useQuery "me"), login/logout, auth pages
      access/             Permission list, deriveAccess(user), useAccess(), <Can>, route guard
      ui/                 shadcn components
      lib/                cn, format (dates/numbers from config), lazyWithRetry, storage (namespaced keys)
      hooks/
    platform/
      scope/              Geography scope + fiscal-year window (URL-synced), ScopeBar
      data-table/         DataTable, column helpers, virtualisation, column visibility
      filters/            FilterDef types, FilterBar, URL sync
      export/             exportRows(): CSV, PDF (lazy), branded headers
      search/             Command palette, SearchProvider registry, nav provider
      notifications/      NotificationCenter, single poller, browser notifications, sounds
      freshness/          ETL watcher → targeted invalidation
      charts/             ChartCard, chart theme helpers
      states/             EmptyState, ErrorState, PageHeader, StatCard, skeletons
      dashboard/          Widget registry + grid
    modules/
      <module>/           See CLAUDE.md "Module anatomy"
```

### 4.2 Configuration (single source of truth)

`site.config.ts` — branding (change this to re-brand):

```ts
const appName = "ICCMS PMP";                  // TODO(dev): confirm final name
const appShortName = "ICCMS";

export const siteConfig = {
  appName,
  appShortName,
  appDescription: "Program management platform",
  organization: { name: "…", shortName: "…", supportEmail: "…", website: "…" },
  brand: {
    logo: "/brand/logo.svg",
    logoMark: "/brand/logo-mark.svg",
    favicon: "/brand/favicon.ico",
    loginBackground: "/brand/login-background.jpg",
  },
  assistant: { name: "Bumi", enabled: true },
  storageNamespace: "iccms-pmp",              // prefix for every localStorage/IndexedDB key
  pageTitle: (page?: string) => (page ? `${page} · ${appShortName}` : appName),
} as const;
```

`program.config.ts` — program and domain details (change this to port to another program):

```ts
export const programConfig = {
  country: "Zambia",
  fiscalYear: { startMonth: 10, label: (fy: number) => `FY${fy}` },   // PEPFAR: Oct–Sep
  geography: {
    levels: ["province", "district"] as const,
    provinces: {
      "Central Province": ["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"],
      "Southern Province": ["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"],
    },
  },
  subPopulations: [
    { key: "calhiv", label: "CALHIV", description: "Children/Adolescents Living with HIV" },
    // … port the full list and descriptions from the legacy registers and AI prompt
  ],
  serviceDomains: ["Schooled", "Healthy", "Safe", "Stable"],
  terms: { child: "VCA", children: "VCAs", household: "Household", caseworker: "Caseworker" },
  dateFormats: { display: "dd MMM yyyy", input: "yyyy-MM-dd" },
} as const;
```

Rules: `index.html` gets its title, description and favicon from `siteConfig` through a small Vite
plugin (`transformIndexHtml`), so even the HTML has no hardcoded brand. Brand colours live as CSS
tokens in `src/app/styles/theme.css`. `scripts/check-brand.mjs` fails the build if any denylisted
string (`ECAP`, `ecap`, `bluecode`, program district names, the app name, …) appears in `src/`
outside `src/config/`. `docs/REBRANDING.md` explains the full re-brand procedure (edit two config
files, swap `public/brand/*`, adjust `theme.css`, set env vars).

`env.ts` — zod-validated environment, fails fast at startup with a readable error:

| New variable | Replaces | Notes |
|---|---|---|
| `VITE_API_URL` | `REACT_PUBLIC_API_URL` | DQA backend |
| `VITE_DIRECTUS_URL` | `REACT_APP_BASE_URL` | |
| `VITE_SUPERSET_URL` | `VITE_SUPERSET_DOMAIN` | |
| `VITE_SUPERSET_DASHBOARDS` | `VITE_SUPERSET_DASHBOARD_ID_*` | JSON map `{ key: uuid }` |
| `VITE_DIRECTUS_INVITE_ROLE` | `VITE_DIRECTUS_USER_ROLE` | Role UUID (not secret) |
| — | `VITE_RESET_PASSWORD_URL` | Derive from `window.location.origin` |
| — | `VITE_DEFAULT_DISTRICT` | Scope comes from the user's access |
| `VITE_DEBUG_API` | same | Dev only |
| **removed** | `VITE_SUPERSET_USERNAME/PASSWORD`, `VITE_GROQ_API_KEY`, CRA and CORS leftovers | Never reintroduce |

Only `env.ts` reads `import.meta.env`. Provide `.env.example`; `.env*` (except the example) is git-ignored.

`features.ts` — flags with defaults, overridable per environment (e.g. `VITE_FEATURES_OFF=assistant,support.calls`):

```ts
export const features = {
  "module.households": true,
  "module.trainingLog": false,        // demo data only: no backend API yet
  "module.analytics": true,           // guest tokens come from POST /superset/guest-token (section 8.1)
  "support.chat": true,
  "support.calls": false,             // TODO(dev): confirm calls are used
  "assistant": true,
  // …
} as const;
```

### 4.3 Module manifest and registry

```ts
// core/modules/types.ts  (types only; the shell does the work)
export interface ModuleManifest {
  id: string;
  feature: FeatureKey;                         // module is mounted only if this flag is on
  dependsOn?: string[];                        // shell disables the module if a dependency is off
  permissions?: Permission[];                  // required for all its routes unless overridden
  routes: Array<{
    path: string;                              // e.g. "households/:householdId"
    lazy: () => Promise<{ Component: React.ComponentType }>;
    title: string;                             // used for <title>, breadcrumbs, search
    permissions?: Permission[];
  }>;
  nav?: Array<{ section: NavSectionId; label: string; path: string; icon: LucideIcon; order: number; permissions?: Permission[] }>;
  search?: SearchProvider[];
  widgets?: DashboardWidget[];                 // contributed to the home dashboard
  notificationTypes?: NotificationTypeDef[];   // how to render/link a notification type
  overlays?: Array<() => Promise<{ Component: React.ComponentType }>>; // app-wide floating UI (e.g. assistant)
  legacyRedirects?: Array<{ from: string; to: (search: URLSearchParams) => string }>;
}
```

`app/module-registry.ts` is the only list of modules. The shell filters it by feature flags and
`dependsOn`, then builds routes, sidebar, command-palette navigation, dashboard widgets and legacy
redirects from it. Adding a module = new folder + one registry line. Removing = the reverse.
Sidebar section order and labels live in the shell, not in modules.

### 4.4 Access control

`core/access/derive-access.ts` exports `deriveAccess(user): Access` — the **only** place that turns
a Directus user into permissions and scope:

```ts
type Access = {
  level: "national" | "province" | "district";
  province?: string;
  district?: string;
  permissions: Set<Permission>;     // e.g. "users.manage", "pipeline.view", "registers.view", "flags.resolve"
};
```

Phase 1 documents every legacy rule (sidebar, `useEffectiveDistrict`, the six pages with `isAdmin`
checks). Phase 3 reproduces the *intended* behaviour in `deriveAccess`, with a unit test per role,
and lists every place the old rules disagreed so the developer can decide. When the backend later
exposes real roles/scopes (section 8), only `deriveAccess` changes.

### 4.5 Data layer

- `core/api/http.ts`: thin fetch wrapper — base URL, auth header, JSON, `AbortSignal`, timeout,
  normalised `ApiError` (status, message, details), one retry on network errors only.
- `core/api/dqa.ts`: DQA client built on `http.ts`. Adds FY/scope params helper (`toScopeParams`).
- `core/api/directus.ts`: `@directus/sdk` client with `rest()` and `authentication()`. Use refresh
  tokens; prefer session-cookie mode if the Directus server's CORS/cookie settings allow it (section 8).
- 401 handling: attempt one refresh; on failure, log out cleanly (see below).
- **Logout** clears: token/session, React Query cache, the persisted IndexedDB cache, namespaced
  localStorage keys, then navigates to login. Fixes S5.
- **Query client defaults** keep the legacy stale-while-revalidate behaviour (60 s stale, 24 h gc,
  IndexedDB persistence). The persistence buster is the app version + build hash (injected by Vite
  `define`), not a hand-edited string. Only successful queries without `meta.persist === false` are persisted.
- Per module: `api/endpoints.ts` → `api/schemas.ts` (zod + normaliser) → `api/queries.ts`
  (`householdKeys.list(scope)`, `householdQueries.list(scope)` returning `queryOptions`).

### 4.6 Routing and URLs

- Readable, shareable, ID-based URLs: `/households`, `/households/archived`, `/households/risk`,
  `/households/:householdId`, `/vcas/:vcaId`, `/hts/:clientId`, `/caseworkers/:caseworkerId`, etc.
- All table state (search text, filters, sort, page, page size) and scope (district, FY window) live in
  the URL via `nuqs`, so any filtered view can be bookmarked or sent to a colleague.
- Every legacy URL keeps working through `legacyRedirects` (e.g. `/profile/household-details?id=X` →
  `/households/X`, `/registers/hts` → `/hts`). Important for links in old emails and notifications.
- Shell provides: `RequireAuth`, `RequirePermission`, password-change redirect, `Forbidden` and
  `NotFound` pages, per-route error boundary, `<title>` from route title + `siteConfig.pageTitle`.

### 4.7 Global search

Command palette (Cmd/Ctrl+K) owned by `platform/search`; content comes from providers.

```ts
interface SearchProvider {
  id: string; label: string; minChars?: number; permissions?: Permission[];
  search(query: string, ctx: { access: Access; scope: Scope; signal: AbortSignal; queryClient: QueryClient }): Promise<SearchResult[]>;
}
interface SearchResult { id: string; title: string; subtitle?: string; href: string; icon?: LucideIcon }
```

- **Navigation provider** is generated from the enabled modules' routes and nav, filtered by
  permissions. It can never go stale again.
- **Record providers (interim, no backend change):** each module's provider calls
  `queryClient.ensureQueryData(xQueries.list(scope))` — the *same* cache entry the register uses, so
  nothing is downloaded twice and persisted data makes it instant. It builds a MiniSearch index over
  names and all ID fields, memoised per dataset version (`dataUpdatedAt`). Input is debounced (~150 ms),
  minimum 2 characters, top 8 results per group, prefix + fuzzy matching. If indexing a dataset takes
  more than ~50 ms, move indexing to a Web Worker.
- **Target:** a backend `GET /search?q=&types=&district=` endpoint (section 8). Swapping a provider's
  `search()` to call it requires no UI change.
- Recently viewed records (stored locally, namespaced, cleared on logout) show when the query is empty.
- cmdk's built-in filtering is disabled (`shouldFilter={false}`); providers return already-ranked results.

### 4.8 Tables, filters and export

`platform/data-table` provides `<DataTable>`:

- Column definitions per module (`table.tsx`) with `meta` for: label, export header and formatter,
  default visibility, alignment, and filter definition.
- Client mode now (the APIs return full district lists); server mode supported in the API so a
  register can switch to server pagination later without UI changes.
- Virtualised rows (TanStack Virtual) whenever more than ~100 rows are rendered; pagination with page
  sizes 50/100/500/All on top.
- Sticky header, column visibility menu (persisted per table, namespaced), sortable columns, row
  links (real `<a href>` so middle-click/new tab works), loading skeleton, empty and error states.

`platform/filters`: declarative `FilterDef` (`search`, `select`, `multiSelect`, `dateRange`, `boolean`,
`subPopulation`) → `FilterBar` UI → URL state → a single `applyFilters(rows, defs, state)` used by
the table *and* the export. Facet options can be derived from the data. "Active filters" chips with clear-all.

`platform/export`: `exportRows({ rows, columns, format, title })` exports exactly what the user sees —
current filters, visible columns, in the current sort order. CSV via papaparse; PDF via
jspdf-autotable loaded on demand, with logo, app name, title, scope, FY label, generation timestamp and
user taken from config/session. File names: `{appShortName}_{table}_{scope}_{yyyy-MM-dd}.{ext}`.
Large exports run in a Web Worker so the UI stays responsive.

### 4.9 Notifications and data freshness

- One `NotificationCenter` in the header with a single poller (30 s, paused when the tab is hidden).
  Sources: Directus notifications and calendar reminders, merged and sorted. Modules declare
  `notificationTypes` to control icon and deep link.
- Browser notification permission is requested only when the user turns it on (a toggle in the panel),
  never on page load. Sound on/off persisted.
- `platform/freshness` polls `/etl/last-success` (60 s, paused when hidden). When it changes, it
  invalidates only queries with `meta.etl === true` and shows a quiet "Data updated" toast — instead of
  wiping every cache.

### 4.10 Resilience and performance

- Error boundary per route and per dashboard widget: one failing widget shows a small error card with
  retry; the rest of the page works.
- Every route is lazy-loaded; heavy libraries (leaflet, jspdf, superset SDK, MiniSearch, recharts) are
  only in the chunks that use them. `lazyWithRetry` + chunk-error boundary are kept.
- Budgets (checked in Phase 6): shell + login JS ≤ 200 KB gzipped; filtering a 10,000-row register
  responds in under 100 ms; no route chunk over 250 KB gzipped without a recorded reason.
- `manualChunks` only for stable vendor groups (react, router, tanstack), as in the legacy config.

### 4.11 Testing strategy

Unit tests (Vitest) for: fiscal-year maths (port the FY_FILTER_REVIEW.md checks as tests),
`deriveAccess`, every normaliser, `applyFilters`, export formatting, search ranking. MSW handlers
built from `test/fixtures/` for API layers and page tests (test-only; see the working assumptions in
section 0). One Playwright smoke test per module: run against the real backend locally (staging or a
local backend with a test account), and against MSW in CI so CI doesn't depend on the live servers or touch real data.

## 5. Module inventory

Legacy routes on the left; every one of them needs a legacy redirect. "By-ID fetch" means the legacy
page received the whole record through `location.state`; the new page must load it from its URL.

| Module | Legacy route(s) | New route(s) | Notes |
|---|---|---|---|
| `auth` (core, always on) | `/`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/change-password` | `/login`, same others | `/` redirects to `/dashboard` or `/login` |
| `dashboard` | `/dashboard` | `/dashboard` | Welcome banner, KPI grid, quick links generated from nav; other modules contribute widgets |
| `districts` | `/districts` | `/districts` | |
| `analytics` | `/charts` | `/analytics` | Superset embeds via `POST /superset/guest-token` (section 8.1). Check whether `MetricsGrid` also depends on Superset |
| `households` | `/households`, `/households/archived`, `/registers/household-risk`, `/profile/household-details` | `/households`, `/households/archived`, `/households/risk`, `/households/:householdId` | Pilot module (Phase 4). Profile ≈2,000 lines → split into tabs/sections |
| `vcas` | `/vcas`, `/vcas/archived`, `/registers/vca-risk`, `/profile/vca-details` | `/vcas`, `/vcas/archived`, `/vcas/risk`, `/vcas/:vcaId` | Profile ≈1,800 lines → split |
| `caregivers` | `/registers/caregiver-risk` | `/caregivers/risk` | |
| `services` | `/vca-services`, `/household-services`, `/caregiver-services`, `/profile/{vca,household,caregiver}-service-details`, `/services/household-services` | `/services/:type`, `/services/:type/:recordId` | Generalise the config-driven ServicesPage. Detail pages need by-ID fetch (`getServiceRecordDetail` may cover it). Orphan route: confirm before porting |
| `hts` | `/registers/hts`, `/registers/hts-risk`, `/profile/hts-details` | `/hts`, `/hts/risk`, `/hts/:clientId` | |
| `pmtct` | `/registers/pmtct`, `/profile/pmtct-details` | `/pmtct`, `/pmtct/:id` | |
| `mother-index` | `/registers/mother-index`, `/profile/mother-index-details` | `/mother-index`, `/mother-index/:id` | By-ID fetch needed |
| `referrals` | `/referrals` | `/referrals` | |
| `flags` | `/flags`, `/flagged-record-form` | `/flags`, `/flags/new?householdId=` | Form loads the household by ID instead of `location.state` |
| `performance` | `/performance` | `/performance` | Facility, caseworker and service performance |
| `caseworkers` | `/caseworker-journeys`, `/profile/caseworker-details` | `/caseworkers/journeys`, `/caseworkers/:caseworkerId` | Leaflet only in the journeys chunk |
| `training-log` | `/training-log` | `/training-log` | Flag off in production until real endpoint exists |
| `calendar` | `/calendar` | `/calendar` | Contributes calendar-reminder notifications |
| `users` | `/users`, `/users/new`, `/users/:id/edit` | same | `users.manage` permission (fixes S2). AddUser is ≈1,000 lines → shared user form |
| `account` | `/profile` | `/account` | Profile, avatar, password |
| `data-pipeline` | `/data-pipeline` | `/data-pipeline/:tab?` | ≈2,300 lines → one route with tabs, one component file per tab. `pipeline.view` permission (fixes S2/S3) |
| `support` | `/support` | `/support` | Support centre; chat and calls are sub-features with their own flags |
| `docs` | `/documentation`, `/documentation/:slug` | `/docs`, `/docs/:slug` | Move article content to Markdown files with `{{appName}}` placeholders |
| `assistant` | (floating widget in layout) | overlay | Calls backend `/agent/chat`. System prompt should move server-side (section 8); until then build it from config |

## 6. Phases

Each phase: plan mode first → review the proposal → execute → `pnpm check` → manual test → commit
(`git commit -m "phase N: …"`) → fresh session for the next phase.

### Phase 0 — Preparation (developer, no Claude Code)

- [ ] Deploy the `security-fix` patches (backend auth + Superset guest tokens) following their README,
      including **rotating the Superset embedder password** (S1, S8).
- [ ] Revoke the Groq API key from the legacy `.env` if it was ever real (S7). It also travelled in the zip.
- [ ] Commit or stash everything in `old-ecap-pmp`; confirm `git status` is clean on `development`.
- [ ] `git init` in `iccms-pmp`; copy `CLAUDE.md` and `docs/MIGRATION_PLAN.md` in; create an empty
      `docs/PROGRESS.md`; commit.
- [ ] Install Node LTS and pnpm; make sure the legacy app still runs locally.
- [ ] Make sure `pnpm dev` in the new project will be able to reach the live backend: note the API and
      Directus URLs to use (staging if you have one), and create a test login for each role
      (national admin, provincial, district, support).
- [ ] Optional but recommended: put the backend source next to the two frontends (e.g.
      `../ecap-plus-pmp-backend`) so Claude Code can read route handlers and document exact parameters
      and response shapes in Phase 1. It stays read-only.
- [ ] For automated tests only: save a few **sanitised** real responses (one per endpoint family:
      lists, profiles, services, counts, ETL, Directus users/notifications/calendar) into
      `iccms-pmp/test/fixtures/`. Replace names, IDs and phone numbers with fakes but keep field names,
      types and nulls exactly. If the backend source is available, Claude Code can draft these from the
      handlers in Phase 1 and you only spot-check them.
- [ ] Note the approximate row counts of the largest registers per district and nationally.
- [ ] Answer the open decisions in section 10 (write answers into PROGRESS.md).

### Phase 1 — Audit (read-only)

Output: `docs/AUDIT.md` (the index: table of contents, endpoint catalogue, cross-cutting inventories,
section-2 verification, surprises), one `docs/audit/<module>.md` per module in section 5 (plus
`docs/audit/shell.md` for app-wide behaviour), and draft test fixtures in `test/fixtures/`; nothing else.
In the module files, for each legacy route: purpose, who can see it (every role rule
found), endpoints called with params, response fields actually used, filters, sort, pagination,
exports (format + columns), charts, navigation in/out (including `location.state` payloads),
loading/empty/error behaviour, known bugs. Plus: an endpoint catalogue (method, path, params, used by;
if the backend source is available, also the response shape and any server-side scope filtering read
from the handler),
a list of all hardcoded brand/program strings by file, all `localStorage`/`sessionStorage`/IndexedDB keys,
all polling intervals, and verification (confirmed / not confirmed) of every finding in section 2.
Each feature becomes a checkbox list that later phases tick off.

Done when: every route in section 5 has an entry, and the developer has reviewed it.

**Status: complete (2026-11-03).** 23 module files, §1–§8 of `AUDIT.md` written, 17 fixtures, 6,863
citations machine-checked. See `docs/PROGRESS.md` for the outcome, the four helper scripts
(`check-citations.py`, `merge-audit-drafts.py`, `build-file-map.py`, `draft-fixtures.py`) and the one
caveat: the audited backend carried the `security-fix` patch, which is absent here — read
`docs/audit/_SOURCE_BASELINE.md` before trusting any `backend:` line number.

### Phase 2 — Scaffold and tooling

Vite + React + TS strict; Tailwind v4; shadcn init (components in `src/core/ui`); path alias `@/`;
ESLint flat config with `eslint-plugin-boundaries` enforcing the table in CLAUDE.md; Prettier; Vitest +
Testing Library + MSW; Playwright; `knip`; `scripts/check-brand.mjs`; `pnpm check`; `.nvmrc`;
`.env.example`; `src/config/*` fully written (values from the legacy app, flagged TODO where the
developer must confirm); `index.html` brand injection plugin; `docs/PROGRESS.md` template.

Done when: `pnpm check` passes on an app that renders a placeholder page whose title comes from
`siteConfig`; a deliberate deep import across modules fails lint; a deliberate "ECAP" string in a
component fails `check:brand`.

### Phase 3 — Core and shell

`core/api` (http, dqa, directus SDK, ApiError, refresh, logout-wipe), `core/auth` (provider, "me" query,
auth pages ported from legacy), `core/access` (`deriveAccess` + tests + discrepancy list),
`core/lib` (format from config, namespaced storage, lazyWithRetry), app shell (providers, query client
+ persistence, theme, sonner, layout with sidebar/header built from manifests, route guards, error
boundaries, NotFound/Forbidden, document titles), module registry and manifest types, feature flags.

Done when: a user can log in, see an empty dashboard module, log out, and the IndexedDB cache is empty
afterwards; a route requiring a permission the user lacks shows Forbidden; turning a module flag off
removes its routes and nav.

### Phase 4 — Platform capabilities + pilot module (households register)

Build `platform/scope` (geography + FY window, port `fiscalYear.ts` with tests from FY_FILTER_REVIEW.md),
`data-table`, `filters`, `export`, `search` (palette, navigation provider, record-provider helper),
`notifications`, `freshness`, `states`, `charts`, `dashboard` widget grid. Validate them by building
**only** `/households` (register) in the `households` module, end to end, including its search provider
and legacy redirect.

Done when: the households register matches legacy behaviour per `docs/audit/households.md` (columns, filters including
sub-populations, export contents), filter state survives refresh and is shareable by URL, global search
finds any household in scope by name or ID, and `docs/ADDING_A_MODULE.md` exists, written from the
experience of building this pilot.

### Phase 5 — Remaining modules, one per session

Order: households (profile, archived, risk) → vcas → caregivers → services → hts → pmtct → mother-index
→ referrals → flags → performance → caseworkers → districts → dashboard widgets → calendar → users →
account → data-pipeline → analytics → docs → support → assistant → training-log.

Per-module checklist (copy into PROGRESS.md for each module):
- [ ] `docs/audit/<module>.md` re-read (plus the module's rows in the `docs/AUDIT.md` endpoint catalogue); legacy files listed
- [ ] `api/` endpoints + zod schemas + normalisers + query factories; MSW handlers from fixtures
- [ ] `table.tsx` columns, filters, export definitions
- [ ] Routes with ID params; page components under ~250 lines
- [ ] Manifest: feature flag, permissions, nav, search provider, widgets, legacy redirects
- [ ] Unit tests for normalisers/helpers; Playwright smoke test
- [ ] Behaviour checked against the legacy app side by side
- [ ] `docs/audit/<module>.md` items ticked; PROGRESS.md updated; `pnpm check` green

### Phase 6 — Parity and hardening

Walk `docs/AUDIT.md` and every `docs/audit/*.md` end to end; test every legacy URL redirect; bundle analysis against the budgets in 4.10;
large-register performance check; keyboard and screen-reader pass on tables, filters and dialogs;
`knip` clean-up; README, `ADDING_A_MODULE.md`, `REBRANDING.md` final versions.

### Phase 7 — Deployment

- Serve `dist/` as static files from nginx or Caddy (SPA fallback to `index.html`; `assets/*` cached
  for a year as immutable; `index.html` with `no-cache`; gzip/brotli; security headers including a
  Content-Security-Policy that allows only the API, Directus and Superset origins). Retire `vite preview` + pm2.
- Staging first, run legacy and new side by side, then switch production.
- Optional (helps porting): load environment URLs from a runtime `/config.json` so one build can be
  deployed to several environments. Brand config stays build-time.

## 7. Model and effort

- **Phases 1–4 and any module that is tangled (households/VCA profiles, services, data-pipeline):**
  Opus 5.5 at the highest effort setting, plan mode on. Architecture mistakes here spread everywhere.
- **Routine module ports in Phase 5** once the pilot pattern is proven (referrals, districts, docs,
  account, training-log, risk registers): Opus 5.5 at a medium effort setting, or Sonnet 5.5 to stretch
  usage limits. Move back up if a module fights back.
- **Phase 6:** Opus 5.5, high effort.
- Always start a fresh session per phase/module; the plan, CLAUDE.md and PROGRESS.md carry the context.

## 8. Backend asks (cannot be fixed in the frontend)

Item 1 is already done by the `security-fix` patch. The rest are collected for the later backend
refactor; the frontend is built to work with the backend as it is today (plus that patch).

1. **Done (security-fix patch):** `POST /superset/guest-token { dashboardId }` →
   `{ status, token }`. The dashboard ID must be in the backend allowlist; RLS is built server-side from
   the user's scope. Every backend endpoint now requires the Directus token (S8). The new frontend's
   `core/api` must therefore send the token on **every** call; for downloads and EventSource it goes in
   `?token=` until signed download URLs exist.
2. **Enforce data scope server-side (S9):** every list/profile endpoint should restrict data to the caller's
   province/district, not trust a `district` query param. Verify current behaviour.
3. **Explicit roles and scopes** on the Directus user (e.g. `access_level`, `province`, `district`
   fields and proper Directus roles) instead of free-text `description`/`title`/`location` (S4).
4. **Search endpoint:** `GET /search?q=&types=&limit=` over households, VCAs, HTS, PMTCT, caseworkers,
   scoped to the caller, using Postgres full-text + `pg_trgm`.
5. **By-ID endpoints** for records the legacy app passed through `location.state` (mother index,
   service records, caseworkers) if they don't already exist.
6. **Auth:** Directus refresh tokens or session-cookie mode with correct CORS/cookie settings.
7. **Assistant system prompt** moved to the backend.
8. Later, for very large registers: server-side pagination/filtering endpoints (the DataTable already supports server mode).

## 9. Prompts to paste into Claude Code

Start every session from inside `iccms-pmp`, with `../old-ecap-pmp` (and the backend folder, if you
added it) as extra readable directories. Use plan mode for the first message of each phase.

**Phase 1 — Audit**
```
Read CLAUDE.md and docs/MIGRATION_PLAN.md (sections 0, 2, 5 and the Phase 1 description).
We are doing Phase 1 only. The legacy app is in ../old-ecap-pmp and is strictly read-only.
The backend source is in ../ecap-plus-pmp-backend (read-only, if present): use it to document each
endpoint's parameters, response shape and server-side scope filtering, and draft sanitised test
fixtures from it into test/fixtures/ for my review.
Produce docs/AUDIT.md (index) and one docs/audit/<module>.md per module exactly as Phase 1 describes.
Cover every route in section 5 (in the module files), and in the index the endpoint catalogue,
hardcoded brand/program strings, storage keys and polling intervals, and mark each finding
in section 2 as confirmed or not confirmed with file and line references.
First propose the outline and your approach, and wait for my approval. Do not write application code.
When finished, update docs/PROGRESS.md and stop.
```

**Phase 2 — Scaffold and tooling**
```
Read CLAUDE.md, docs/MIGRATION_PLAN.md (sections 3, 4.1, 4.2, 4.3 and Phase 2), docs/AUDIT.md (the index:
especially the brand/program strings and env variable inventories) and docs/PROGRESS.md (including my
answers to section 10). We are doing Phase 2 only.
Resolve the latest stable versions per the version policy in section 3 and show them to me before installing.
Set up the project, tooling, lint boundaries, brand check and the full src/config files.
Meet every "Done when" criterion for Phase 2 and show me evidence (command output) for each.
Update docs/PROGRESS.md and stop.
```

**Phase 3 — Core and shell**
```
Read CLAUDE.md, docs/MIGRATION_PLAN.md (sections 4.3–4.6, 4.10 and Phase 3), docs/audit/auth.md,
docs/audit/shell.md, the access-rules and storage-keys sections of docs/AUDIT.md, and docs/PROGRESS.md.
We are doing Phase 3 only.
Build core/api, core/auth (port the auth pages' behaviour), core/access with deriveAccess and a unit
test per role, the app shell, the module registry and feature flags. List every place the legacy role
rules disagreed and ask me which behaviour to keep before finalising deriveAccess.
Meet every "Done when" criterion for Phase 3 with evidence. Update docs/PROGRESS.md and stop.
```

**Phase 4 — Platform + pilot**
```
Read CLAUDE.md, docs/MIGRATION_PLAN.md (sections 4.7–4.11 and Phase 4), the households register entry
in docs/audit/households.md, docs/audit/shell.md (search, notifications, freshness, FY filter), the
households rows of the endpoint catalogue in docs/AUDIT.md, test/fixtures, and docs/PROGRESS.md.
We are doing Phase 4 only.
Build the platform capabilities, then the households register (list page only) as the pilot module,
including its search provider and legacy redirect. Propose the platform APIs (types and component
props) first and wait for my approval before implementing them.
Finish by writing docs/ADDING_A_MODULE.md from what you learned. Meet every "Done when" criterion with
evidence. Update docs/PROGRESS.md and stop.
```

**Phase 5 — One module per session** (replace `<module>`)
```
Read CLAUDE.md, docs/ADDING_A_MODULE.md, the <module> row in section 5 of docs/MIGRATION_PLAN.md,
docs/audit/<module>.md, the <module> rows of the endpoint catalogue in docs/AUDIT.md, and
docs/PROGRESS.md. We are porting the <module> module only.
List the legacy files you will read and propose the module structure, routes, permissions and any
by-ID fetching needs, then wait for my approval. Then implement it following the per-module checklist
in Phase 5. Do not change platform/ or core/ unless it is a genuine gap; if so, explain the change
first. Update docs/PROGRESS.md and stop.
```

**Resuming after an interruption**
```
Read CLAUDE.md and docs/PROGRESS.md. Summarise where we are, what is half-finished, and what you
propose to do next. Wait for my go-ahead.
```

## 10. Open decisions (developer answers before Phase 2)

1. Final app name, short name, organisation details and logo for `site.config.ts`. Is ICCMS the same
   program (same geography, sub-populations, fiscal year) or a different one?
    - App name: ICCMS PMP, Short Name: ICCMS, Orginization name: PCZ, logo will be provided later, Same program yes.
2. Port the unreferenced dashboard widgets and `VcaServicesDashboard` (section 2.4), or drop them?
    - Port them
3. Is `/services/household-services` still needed?
    - Yes they are needed
    4. Are WebRTC voice/video calls in the support centre used? Chat? Voice notes?
    - No, they are not
5. Keep the AI assistant?
    -  Yes
6. Is it acceptable to persist beneficiary data in IndexedDB for 24 h on shared computers, given the
   logout wipe? (Alternative: persist only aggregate/dashboard queries.)
    - Yes, as it is very unlikely for people to share a computer in this case
7. Who will implement the backend asks in section 8, and roughly when? This decides when `analytics`
   can be switched on.
    - The backend is exactly the same as the old project, for now.
8. Approximate largest register size (rows) — decides whether any register needs server mode now.
    - About 260,000 records