# shell — legacy audit

> New module `shell` (app-wide: `src/app` providers, router, layouts and error boundaries; `core/access`, `core/lib`,
> `core/ui`; `platform/scope`, `platform/freshness`, `platform/notifications`, `platform/search`, `platform/states`,
> `platform/filters`, `platform/export`) · Legacy routes → new routes: no routes of its own; `*` (NotFound) → shell 404.
> The shell also owns the route table, the guards and the legacy redirects for every row of MIGRATION_PLAN.md §5 ·
> Plan: MIGRATION_PLAN.md §5 (all rows), §4.4 access, §4.6 routing, §4.7 global search, §4.8 tables/filters/export,
> §4.9 notifications and freshness, §4.10 resilience, Phase 3 "Core and shell"

This file merges three verified drafts: the layout (sidebar, header, notifications, search, mobile nav), the
infrastructure (bootstrap, query client, routing, guards, FY filter, scope, freshness, theme, toasts, 404) and the
shared building blocks (sub-population filter, facility picker, CSV/PDF helpers, geography, generic helpers).
Each cited line was re-opened during the merge. Claims that could not be confirmed were removed. Behaviour that
belongs to a feature module is only summarised here and points to that module's audit.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/main.tsx` | 5 | Entry: imports `index.css`, `createRoot(document.getElementById("root")!).render(<App />)` |
| `index.html` | 38 | Title, meta/og tags, API preconnects, Google Font "Inter" |
| `vite.config.ts` | 56 | Env prefixes, dev/preview port, Superset dev proxy, allowed hosts, `@` alias, vendor chunk |
| `src/App.tsx` | 602 | Query client, IDB persister and buster, `ChunkErrorBoundary`, provider tree, full route table |
| `src/components/auth/ProtectedRoute.tsx` | 23 | The only route guard (auth + forced password change) |
| `src/context/ThemeContext.tsx` | 106 | Runtime colour overrides (only the AI assistant uses them), persisted in localStorage |
| `src/context/FyFilterContext.tsx` | 122 | FY filter state: URL > localStorage > default, URL sync |
| `src/components/FyFilter.tsx` | 229 | Header FY chip and popover with a custom range |
| `FY_FILTER_REVIEW.md` | 249 | Developer checklist for the FY filter (partly out of date) |
| `src/lib/fiscalYear.ts` | 84 | FY maths, resolve, URL (de)serialisation |
| `src/components/EtlInvalidator.tsx` | 90 | Polls `/etl/last-success`; invalidates caches when it moves forward |
| `src/lib/lazyWithRetry.ts` | 62 | `React.lazy` wrapper: one guarded hard reload on stale-chunk errors |
| `src/lib/indexedDbCache.ts` | 92 | Auxiliary raw-IndexedDB response cache used by `getListFromApiWithCache` |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Role/scope derivation from `description` / `title` / `location` (4 pages) |
| `src/hooks/use-mobile.tsx` | 19 | `useIsMobile()` (768 px). Only consumer: `components/ui/sidebar.tsx:51` |
| `src/hooks/use-toast.ts` | 186 | Radix toast store. Mounted, but **no feature code calls it** |
| `src/components/ui/use-toast.ts` | 3 | Re-export of the above. **Never imported** |
| `src/components/ui/sonner.tsx` | 27 | Sonner `<Toaster>` wrapper; uses `next-themes` without a provider |
| `src/pages/NotFound.tsx` | 24 | `*` route |
| `src/components/EmptyState.tsx` | 51 | Shared empty-state block (8 consumers) |
| `src/components/dashboard/ConfirmDialog.tsx` | 55 | Shared confirm AlertDialog (Users, EditUser) |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Page chrome rendered **inside** 41 pages; mounts sidebar, header, mobile nav, AI assistant, calendar reminders |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Desktop sidebar: hardcoded nav sections, role-based hiding, user footer, logout |
| `src/components/dashboard/DashboardHeader.tsx` | 539 | Header: subtitle, search slot, FY slot, shortcuts, notifications centre, user menu |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Ctrl/Cmd+K palette: static nav, first 10 VCAs + households, help/FAQ |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Fixed bottom bar below `sm` (640 px) |
| `src/components/dashboard/PageIntro.tsx` | 37 | Page title block. Used by 3 pages |
| `src/components/NavLink.tsx` | 28 | react-router `NavLink` adapter adding `activeClassName` / `pendingClassName` |
| `src/components/VersionFooter.tsx` | 27 | Fixed footer on the 5 auth pages: hardcoded version, render-time date/time |
| `src/components/aceternity/GlowHeader.tsx` | 25 | `<header>` wrapper used by `DashboardLayout` |
| `src/lib/sounds.ts` | 51 | WebAudio synth: `playBell` (**unused**), `playDrop` (AI assistant) |
| `src/hooks/useCalendarNotifications.ts` | 61 | Calendar reminders (30 s poll, toast + browser notification), mounted by the layout |
| `src/components/dashboard/SubPopulationFilter.tsx` | 67 | Presentational all/yes/no toggle grid (4 registers) |
| `src/components/MultiFacilityPicker.tsx` | 174 | Multi-select ward picker stored as CSV on the Directus user (AddUser/EditUser) |
| `src/lib/exportUtils.ts` | 29 | CSV helper #1 (`data:` URI). Used by Districts, HTSRiskRegister |
| `src/lib/csv.ts` | 29 | CSV helper #2 (Blob). Used by 6 files, imported unused by a 7th |
| `src/constants/pdf.ts` | 215 | Trainee record PDF (jsPDF + autotable). The only PDF export in the app |
| `src/constants/utils.ts` | 235 | Training-log helpers: status, formatting, search, CSV headers/rows |
| `src/constants/types.ts` | 96 | Training-log types, partner list, target audiences, `MAX_SESSIONS` |
| `src/constants/districts.ts` | 8 | Hardcoded provinces and districts |
| `src/lib/utils.ts` | 64 | `cn`, caregiver-name masking, `toTitleCase`, `toSentenceCase`, `normalizePlaceName`, `dedupePlaceNames` |
| `src/lib/data-validation.ts` | 70 | `isCategoryProvided` (service-domain coverage check) |
| `src/components/AnimatedCounter.tsx` | 59 | KPI count-up animation (MetricsGrid, Districts) |
| Read in part | — | `components/ui/sidebar.tsx` 13-100 (cookie, shortcut, widths); `lib/directus.ts` 214-221, 486-568, 722-732; `lib/api.ts` 1-16, 195-251, 298-312, 365-379, 405-432, 495-506, 1239-1242, 1458-1474; `lib/env.ts` (17 lines, full); `lib/auth.ts` 1-25; `context/AuthContext.tsx` 140-160; `components/LoginCard.tsx` 36-46; `pages/Index.tsx` 1-30; `data/supportData.tsx` titles; `components/dashboard/AiAssistant.tsx` 37-200 (theme and sound use only); `backend:lib/fyClause.js` (80, full); `backend:config/geography.js` (9, full); `backend:lib/userScope.js` 1-60; callers spot-checked at the lines cited below |

Unreferenced code found: `playBell` (`legacy:src/lib/sounds.ts:40-45`, no caller); `components/ui/use-toast.ts`
(never imported); the Radix toast store (no feature caller); `PROVINCES` (`legacy:src/constants/districts.ts:1`, no
importer); `isProvincialUser` (`legacy:src/components/dashboard/AppSidebar.tsx:160`, computed, unused);
`MobileBottomNav`'s local `isActive` (`legacy:src/components/dashboard/MobileBottomNav.tsx:20`, unused);
`resetTheme` (destructured but never called, `legacy:src/components/dashboard/AiAssistant.tsx:49`);
`SubPopulationFilterProps.onClear` (declared at `legacy:src/components/dashboard/SubPopulationFilter.tsx:7`, never
read); `escapeCsvField` export (only used in its own file). The page `VcaServicesDashboard` has no `<Route>` (ported
per decision 2, services module).

---

## Route `*` → shell 404

### Purpose
Catch-all for unknown URLs (`legacy:src/App.tsx:589-590`).

### Access
- [ ] Route guard: none. Not wrapped in `ProtectedRoute` (`legacy:src/App.tsx:590`), so anonymous users see it too.
- [ ] Sidebar / mobile nav / global search: no entry.
- [ ] In-page role checks: none. Data scope: n/a.

### Endpoints
- [ ] None.

### Fields used
None.

### Filters / sort / pagination / search
- [ ] None.

### Exports
- [ ] None.

### Charts
- [ ] None.

### Links in / out
- [ ] In: any unmatched path. Known code path: `navigate("/hts/view", { state: item.raw ? { ...item.raw, type, district } : item })`
      (`legacy:src/pages/HTSRegister.tsx:1185-1193`). **BUG**: no route matches, so it always lands here. The hts
      module maps it to `/hts/:clientId`.
- [ ] In: old bookmarks. Every legacy path in the route table below must redirect so that nothing old reaches the 404.
- [ ] Out: plain `<a href="/">Return to Home</a>` (`legacy:src/pages/NotFound.tsx:16-18`), which is a **full page
      reload** to the login card. New: router link to `/dashboard` when signed in, `/login` otherwise.

### Loading / empty / error
- [ ] Full screen, **outside** `DashboardLayout`, `bg-muted`, centred: "404", "Oops! Page not found", "Return to Home"
      (`legacy:src/pages/NotFound.tsx:12-20`).
- [ ] Side effect: `console.error("404 Error: User attempted to access non-existent route:", pathname)` on every path
      change (`legacy:src/pages/NotFound.tsx:7-9`).
- [ ] Lazy-loaded (`legacy:src/App.tsx:95`), so a blank `PageLoader` shows until its chunk arrives (`:165,235`).

### Bugs and quirks
- [ ] **BUG** "Return to Home" hard-reloads to `/`, which shows the login card even to signed-in users
      (`legacy:src/pages/Index.tsx:6-19`).
- [ ] **QUESTION** Render the 404 inside the app layout for signed-in users so navigation stays available?

---

## Component `Bootstrap and providers` (unrouted)

- [ ] Entry imports global CSS then renders `<App />` into `#root` with a non-null assertion (`legacy:src/main.tsx:1-5`).
      The new code needs a comment on the assertion (CLAUDE.md TS rules).
- [ ] Provider nesting, outermost first (`legacy:src/App.tsx:213-600`): `PersistQueryClientProvider` (`:214-225`) →
      `ThemeProvider` (`:226`) → `AuthProvider` (`:227`) → `TooltipProvider` (`:228`) → `EtlInvalidator` (renders null,
      `:229`) → Radix `Toaster` (`:230`) and `Sonner` (`:231`) → `BrowserRouter` (`:232`) → `FyFilterProvider` (needs
      the router, `:233`) → `ChunkErrorBoundary` (`:234`) → `Suspense fallback={<PageLoader />}` with
      `PageLoader = () => null` (`:165,235`) → `Routes` (`:236-591`). A lazy route shows a **blank page** while its
      chunk loads. New app: skeleton shell.
- [ ] `EtlInvalidator` sits above the router, so it runs on every screen including login; it skips the network when
      there is no token (`legacy:src/components/EtlInvalidator.tsx:33-34`).
- [ ] Module-level side effect before render: if `localStorage["ecap_plus_persist_buster"] !== PERSIST_BUSTER`,
      clear the aux IDB cache and write the new buster (`legacy:src/App.tsx:157-163`). **BUG**: the localStorage access
      is not in try/catch, so blocked storage throws at import time (white screen).
- [ ] No `next-themes` provider is mounted (only `legacy:src/components/ui/sonner.tsx:1,7` imports it), so Sonner
      always gets `theme="system"`.
- [ ] `index.html`: `<title>PMP</title>` (`legacy:index.html:16`), never changed per page (the only `document.title`
      use in `src` is a read by the AI assistant, `legacy:src/components/dashboard/AiAssistant.tsx:78`, which therefore
      always sees "PMP"). Meta description/author/og tags carry hardcoded brand strings (`legacy:index.html:17-22`).
      Favicon and og:image are commented out (`:7,23-27`), although `public/favicon.ico` and `public/ecap-logo.png`
      exist and are used by browser notifications. `preconnect` + `dns-prefetch` to two hardcoded API origins
      (`:11-14`) → derive from config or drop. Google Fonts "Inter" 400/500/600/700 (`:29-31`). `#root` + module
      script (`:35-36`).
- [ ] `vite.config.ts`: `envPrefix: ["VITE_", "REACT_"]` (`legacy:vite.config.ts:7`). Legacy **relies** on the
      `REACT_` prefix: the Directus URL comes from `REACT_APP_BASE_URL` and the DQA URL from `REACT_PUBLIC_API_URL`
      (`legacy:src/lib/env.ts:13-17`). New app: only `VITE_*` (hard rule 5); the deploy env must be renamed. Dev/preview
      host `::`, port `3040` (`:9-10,25-26`), HMR overlay off (`:11-13`). Dev proxy `/superset-api` → a localhost port,
      prefix stripped (`:14-21`, analytics module). `allowedHosts` lists two hardcoded hostnames (`:22,27`) → deploy
      config. `@` → `./src` (`:30-33`). `manualChunks`: react-dom, react, react-router, scheduler, `@tanstack` →
      `react-vendor` (`:40-52`); plan §4.10 keeps this.

## Component `Query client and persistence` (unrouted)

- [ ] Defaults (`legacy:src/App.tsx:112-134`): `staleTime` 60 s (`:126`), `gcTime` 24 h (`:127`), `refetchOnMount`,
      `refetchOnWindowFocus`, `refetchOnReconnect` all true (`:128-130`), `retry: 1` (`:131`). No mutation defaults, no
      global `onError`, no `meta` conventions.
- [ ] Persister: `createAsyncStoragePersister` over idb-keyval (default DB/store; `undefined` → `null` at `:142`), key
      `"ecap-plus-pmp-react-query"` (`:146`), `throttleTime: 1000` (`:147`).
- [ ] Persist options: `maxAge` 24 h (`:218`), `buster: PERSIST_BUSTER` = `"v13-2026-06-16-caseworker-list"`
      (`:152,219`), `shouldDehydrateQuery = status === "success" && data !== undefined` (`:221-222`). **Every**
      successful query is persisted, including user-private ones (notifications, calendar events, users list, profile).
- [ ] New app: keep stale-while-revalidate with IDB persistence (decision 6), exclude `meta: { persist: false }`,
      drive freshness from `meta: { etl: true }`, take the buster from config/build.
- [ ] **BUG** `logout()` only clears the token and user (`legacy:src/context/AuthContext.tsx:148-151`); the in-memory
      cache, the persisted IDB blob and the aux IDB cache all survive, so the next user on the same browser sees the
      previous user's cached data for up to 24 h. Decision 6 requires a logout wipe: clear all three on logout and on
      user change.
- [ ] **BUG** Aux cache keys are not user-scoped (`households_by_district:<district|ALL><:from_to>` etc.,
      `legacy:src/lib/api.ts:305-308,372-375,411-413,420-422,500-502`), and on a fetch error a stale entry of **any
      age** is returned (`legacy:src/lib/api.ts:229-235`).

## Component `Routing and guards` (unrouted)

### Full route table (`legacy:src/App.tsx`)
Every route except the four public ones and `*` is wrapped in `<ProtectedRoute>` and nothing else (43 wrappers;
grep count). **No route has a role or permission check** (MIGRATION_PLAN S2).

| Line | Legacy path | Component (load, line) | Guard | New route (§5) |
|---|---|---|---|---|
| 237 | `/` | `Index` (eager `:19`) | none | `/login` (`/` → `/dashboard` or `/login`) |
| 238-241 | `/forgot-password` | `ForgotPassword` (lazy `:91`) | none | same |
| 242 | `/reset-password` | `ResetPassword` (lazy `:92`) | none | same |
| 243 | `/accept-invite` | `AcceptInvite` (lazy `:93`) | none | same |
| 244-251 | `/change-password` | `ChangePassword` (lazy `:94`) | ProtectedRoute | same |
| 252-259 | `/dashboard` | `Dashboard` (eager `:20`) | ProtectedRoute | `/dashboard` |
| 260-267 | `/districts` | `Districts` (lazy `:80`) | ProtectedRoute | `/districts` |
| 268-275 | `/households` | `HouseholdRegister` (lazy `:26-28`) | ProtectedRoute | `/households` |
| 276-283 | `/vcas` | `VcaRegister` (lazy `:29`) | ProtectedRoute | `/vcas` |
| 284-291 | `/registers/hts` | `HTSRegister` (lazy `:40`) | ProtectedRoute | `/hts` |
| 292-299 | `/registers/hts-risk` | `HTSRiskRegister` (lazy `:73`) | ProtectedRoute | `/hts/risk` |
| 300-307 | `/registers/pmtct` | `PMTCTRegister` (lazy `:41`) | ProtectedRoute | `/pmtct` |
| 308-315 | `/registers/mother-index` | `MotherIndexRegister` (lazy `:43-45`) | ProtectedRoute | `/mother-index` |
| 317-324 | `/vca-services` | `VcaServices` (lazy `:36`) | ProtectedRoute | `/services/vca` |
| 325-332 | `/registers/vca-risk` | `VcaRiskRegister` (lazy `:69`) | ProtectedRoute | `/vcas/risk` |
| 333-340 | `/household-services` | `HouseholdServices` (lazy `:30-32`) | ProtectedRoute | `/services/household` |
| 341-348 | `/registers/household-risk` | `HouseholdRiskRegister` (lazy `:70-72`) | ProtectedRoute | `/households/risk` |
| 349-356 | `/caregiver-services` | `CaregiverServices` (lazy `:37-39`) | ProtectedRoute | `/services/caregiver` |
| 357-364 | `/registers/caregiver-risk` | `CaregiverRiskRegister` (lazy `:66-68`) | ProtectedRoute | `/caregivers/risk` |
| 365-372 | `/profile/caseworker-details` | `CaseworkerProfile` (lazy `:74-76`) | ProtectedRoute | `/caseworkers/:caseworkerId` |
| 373-380 | `/services/household-services` | `HouseholdServicesPage` (lazy `:33-35`) | ProtectedRoute | keep (decision 3) |
| 381-388 | `/flags` | `Flags` (lazy `:81`) | ProtectedRoute | `/flags` |
| 389-396 | `/households/archived` | `HouseholdArchivedRegister` (lazy `:82-84`) | ProtectedRoute | `/households/archived` |
| 397-404 | `/vcas/archived` | `VcaArchivedRegister` (lazy `:85-87`) | ProtectedRoute | `/vcas/archived` |
| 405-412 | `/charts` | `Charts` (lazy `:88`) | ProtectedRoute | `/analytics` |
| 413-420 | `/users` | `Users` (lazy `:46`) | ProtectedRoute only | `/users` (`users.manage`) |
| 421-428 | `/training-log` | `TrainingLog` (**eager** `:21`) | ProtectedRoute | `/training-log` (flag, demo data) |
| 429-436 | `/users/new` | `AddUser` (lazy `:89`) | ProtectedRoute only | `/users/new` (`users.manage`) |
| 437-444 | `/users/:id/edit` | `EditUser` (lazy `:90`) | ProtectedRoute only | `/users/:id/edit` (`users.manage`) |
| 445-452 | `/profile` | `Profile` (lazy `:47`) | ProtectedRoute | `/account` |
| 453-460 | `/profile/household-details` | `HouseholdProfile` (lazy `:48-50`) | ProtectedRoute | `/households/:householdId` |
| 461-468 | `/profile/vca-details` | `VcaProfile` (lazy `:51`) | ProtectedRoute | `/vcas/:vcaId` |
| 469-476 | `/profile/hts-details` | `HTSProfile` (lazy `:52`) | ProtectedRoute | `/hts/:clientId` |
| 477-484 | `/profile/pmtct-details` | `PMTCTProfile` (lazy `:53`) | ProtectedRoute | `/pmtct/:id` |
| 485-492 | `/profile/mother-index-details` | `MotherIndexDetails` (lazy `:54-56`) | ProtectedRoute | `/mother-index/:id` |
| 493-500 | `/profile/vca-service-details` | `VcaServiceProfile` (lazy `:57-59`) | ProtectedRoute | `/services/:type/:recordId` |
| 501-508 | `/profile/household-service-details` | `HouseholdServiceProfile` (lazy `:60-62`) | ProtectedRoute | `/services/:type/:recordId` |
| 509-516 | `/profile/caregiver-service-details` | `CaregiverServiceProfile` (lazy `:63-65`) | ProtectedRoute | `/services/:type/:recordId` |
| 517-524 | `/flagged-record-form` | `FlaggedRecordForm` (lazy `:96-98`) | ProtectedRoute | `/flags/new?householdId=` |
| 525-532 | `/data-pipeline` | `DataPipelinePage` (lazy `:99-101`) | ProtectedRoute only | `/data-pipeline/:tab?` (`pipeline.view`) |
| 533-540 | `/support` | `SupportCenter` (lazy `:102`) | ProtectedRoute | `/support` |
| 541-548 | `/calendar` | `Calendar` (lazy `:103`) | ProtectedRoute | `/calendar` |
| 549-556 | `/documentation` | `Documentation` (lazy `:104`) | ProtectedRoute | `/docs` |
| 557-564 | `/documentation/:slug` | `DocumentationArticle` (lazy `:105-107`) | ProtectedRoute | `/docs/:slug` |
| 565-572 | `/caseworker-journeys` | `CaseworkerJourneys` (lazy `:108-110`) | ProtectedRoute | `/caseworkers/journeys` |
| 573-580 | `/performance` | `Performance` (lazy `:77`) | ProtectedRoute | `/performance` |
| 581-588 | `/referrals` | `Referrals` (lazy `:42`) | ProtectedRoute | `/referrals` |
| 590 | `*` | `NotFound` (lazy `:95`) | **none** | shell 404 |

(Service type slugs `vca` / `household` / `caregiver` per `legacy:src/components/dashboard/services/service-records.ts:8`.)

- [ ] Every legacy path needs a redirect in the owning module's manifest. The `/profile/*-details` pages receive their
      record through `location.state`, so a redirect cannot know the ID: send them to the parent register (or a
      "link is outdated" page).
- [ ] `ProtectedRoute` (`legacy:src/components/auth/ProtectedRoute.tsx`): `isLoading` → `null` (blank) (`:8-10`); no
      `user` → `<Navigate to="/" replace />` (`:12-14`); `user.password_change_required && pathname !== "/change-password"`
      → `<Navigate to="/change-password" replace />` (`:16-18`); else children (`:20`).
- [ ] The requested URL is **not** remembered: after login the user always lands on `/dashboard` or
      `/change-password` (`legacy:src/components/LoginCard.tsx:42`). New app: preserve `returnTo`.
- [ ] Public routes have no "already signed in" redirect: `Index` renders `LoginCard` unconditionally
      (`legacy:src/pages/Index.tsx:6-19`). Plan §5: `/` → `/dashboard` when signed in.
- [ ] Route-level permissions move into manifests and are enforced by the shell. Backend ask (S2): `/users*` and
      `/data-pipeline` data are not role-restricted server-side (AUDIT.md §3.1 item 3).
- [ ] Routes with **no** sidebar, mobile or search entry: the four risk registers, `/services/household-services`, all
      `/profile/*-details`, `/flagged-record-form`, `/users/new`, `/users/:id/edit`, `/documentation/:slug`,
      `/change-password`. Inbound links (grep): `/registers/vca-risk?type=<health_domain|schooled_domain|safe_domain|stable_domain|graduation_path>&district=<selectedDistrict>`
      only from the unrouted `VcaServicesDashboard` (`legacy:src/pages/VcaServicesDashboard.tsx:678,687,696,705,715`);
      `/registers/household-risk`, `/registers/caregiver-risk`, `/registers/hts-risk` and `/services/household-services`
      have **no** inbound link outside `App.tsx`.

### Error boundary (`ChunkErrorBoundary`, `legacy:src/App.tsx:167-211`)
- [ ] The only error boundary in the app; wraps `Suspense`/`Routes` once (`:234-593`).
- [ ] `getDerivedStateFromError`: chunk-load error → `{ hasError: true }`; otherwise returns `null` "so it isn't masked
      here" (`:178-184`).
- [ ] Fallback (`:187-206`): centred card "Reload required" / "A new version of the app is available. Please reload to
      continue." / button "Reload now" → `window.location.reload()`. Never auto-reloads (comment `:167-171`). State never
      resets on navigation.
- [ ] **BUG** Non-chunk render errors are not handled by any boundary, so any page error unmounts the whole app
      (white screen). New shell: per-route and per-widget boundaries with `<ErrorState>` + retry (CLAUDE.md), plus this
      chunk-specific variant.

### `lazyWithRetry` (`legacy:src/lib/lazyWithRetry.ts`)
- [ ] `isChunkLoadError`: message (`error.message` or `String(error)`) contains "Failed to fetch dynamically imported
      module", "Importing a module script failed", "error loading dynamically imported module", "Loading chunk",
      "ChunkLoadError", or both "module script" and "MIME type" (`:8-19`).
- [ ] Success → `sessionStorage.removeItem("ecap_chunk_reload_at")` (`:39-43`). Non-chunk error → rethrow (`:45`).
      Chunk error and more than 10 s since the stored timestamp → store now, `window.location.reload()`, return a
      never-resolving promise (`:47-55`). Within 10 s → rethrow to the boundary (`:57-59`). Constants `:24-25`.
- [ ] All pages except `Index`, `Dashboard` and `TrainingLog` are lazy (`legacy:src/App.tsx:17-110`). Plan Phase 3 /
      §4.10 keeps `lazyWithRetry` in `core/lib` with a namespaced key; wrap sessionStorage in try/catch (legacy does not).

## Component `Access and scope derivation` (unrouted)

Legacy derives roles in two places with **different rules** (S4). The new `core/access` derives role, province and
district once; nothing else compares strings.

### Sidebar rules (`legacy:src/components/dashboard/AppSidebar.tsx:147-181`)
- [ ] `roleName = (typeof user.role === "string" ? user.role : user.role?.name || "").toLowerCase()` (`:150-152`)
- [ ] `isAdmin = roleName === "administrator" || user.description === "Administrator" || (!user.description && roleName !== "")` (`:153-156`)
- [ ] `isSupport = user.description === "Support User" || roleName.includes("support")` (`:157-158`)
- [ ] `isDistrictUser = user.description === "District User"` (`:159`); `isProvincialUser = user.description === "Provincial User"` (`:160`, unused)
- [ ] Filters: `item.url === "/districts" && isDistrictUser` → hide (`:166`); `section.label === "Admin" && !isAdmin` → hide (`:169`);
      `section.label === "Data Pipeline" && !isAdmin && !isSupport` → hide (`:172-173`); empty sections dropped (`:180`);
      no user → no sections (`:148`).
- [ ] **BUG** (S3) The section label is `"Data pipeline"` (`:98`), so the Data Pipeline rule never matches and every user
      sees it. Intended: admins and support users.
- [ ] **BUG** Any user with an empty `description` and any role is admin (`:156`).
- [ ] **BUG** `isSupport` uses a role-name substring while the other checks use `description` (`:158`).

### `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts`)
Called by `HTSRegister` (`legacy:src/pages/HTSRegister.tsx:91`), `PMTCTRegister` (`legacy:src/pages/PMTCTRegister.tsx:144`),
`MotherIndexRegister` (`legacy:src/pages/MotherIndexRegister.tsx:52`) and `Referrals` (`legacy:src/pages/Referrals.tsx:142`).
Other pages derive scope themselves (e.g. `GlobalSearch` `user?.location ?? DEFAULT_DISTRICT`,
`legacy:src/components/dashboard/GlobalSearch.tsx:52`; `DashboardHeader` `user?.location ?? ""`,
`legacy:src/components/dashboard/DashboardHeader.tsx:90`; `Districts` `user?.location || "All"`,
`legacy:src/pages/Districts.tsx:52`).
- [ ] `description = (user?.description || "").toLowerCase()` (`:7`)
- [ ] `isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support"` (`:8`, hardcoded brand role string)
- [ ] `isProvinceUser = description.includes("provincial") || description.includes("province")` (`:9`)
- [ ] `isDistrictUser = description.includes("district") || (!!user?.location && user.location !== "All" && !isAdmin && !isProvinceUser)` (`:10`)
- [ ] `province = user?.title && user.title !== "All" ? user.title : user?.province` (`:11`) — province lives in Directus `title`.
- [ ] `district = user?.location && user.location !== "All" ? user.location : (user?.district || DEFAULT_DISTRICT || "")` (`:12`);
      `DEFAULT_DISTRICT = import.meta.env.VITE_DEFAULT_DISTRICT` (`legacy:src/lib/api.ts:7`).
- [ ] `availableDistricts`, first match wins (`:13-16`): default `ALL_DISTRICTS` (no "All Districts"); province user with
      province → `["All Districts", ...DISTRICTS_BY_PROVINCE[province]]`; else district user with district → `[district]`;
      else admin → `["All Districts", ...ALL_DISTRICTS]`.
- [ ] Returns `{ district, province, isAdmin, isProvinceUser, isDistrictUser, isRestrictedToDistrict: isDistrictUser, availableDistricts }` (`:17`).
- [ ] Intended data-scope rule (UX only): admins pick "All Districts" or any district; provincial users pick within their
      province; district users are locked to `location`. The backend trusts a caller-supplied district on 35 endpoints
      (AUDIT.md §3.2) → backend ask.
- [ ] **BUG** Overlapping substrings: "Provincial Administrator" is admin **and** province user, and the province branch
      wins (restricted to one province); "District Administrator" → district branch wins. `backend:lib/userScope.js:27-35`
      checks admin **first**, so the UI and the server disagree for these users.
- [ ] **BUG** Users matching no rule get the full `ALL_DISTRICTS` list (`:13`), while the backend returns
      `{ level: "none" }` → deny (`backend:lib/userScope.js:16,48`).
- [ ] **BUG** "All" sentinel differs: `"All Districts"` here (`:14,16`) vs `"All"` in other pages (e.g.
      `legacy:src/pages/Districts.tsx:52`). New scope hook: one typed value (e.g. `null` = all).

### Geography constants (`legacy:src/constants/districts.ts:1-8`) → `program.config.ts`
- [ ] `PROVINCES = ["Central Province", "Southern Province"]` (unused).
- [ ] `DISTRICTS_BY_PROVINCE`: `"Central Province"`: `["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"]`;
      `"Southern Province"`: `["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"]`. `ALL_DISTRICTS` = flattened (12).
- [ ] The backend holds an identical copy "to keep in sync with the frontend's program config"
      (`backend:config/geography.js:1-7`), used for province scope (`backend:lib/userScope.js:2,39`).
- [ ] Other consumers: PMTCTRegister falls back to `ALL_DISTRICTS` when "All Districts" has no list
      (`legacy:src/pages/PMTCTRegister.tsx:163-167`); MotherIndexRegister imports it unused (`:17`). Registers rebuild
      district lists from data with `toTitleCase(raw.trim())` instead (e.g. `legacy:src/pages/HouseholdRegister.tsx:126`).

## Component `Fiscal-year filter` (unrouted)

### FY maths (`legacy:src/lib/fiscalYear.ts`) — rules move to `program.config`
- [ ] FY runs Oct 1 → Sep 30, labelled by end year ("PEPFAR fiscal year", `:1,20`).
- [ ] `getCurrentFy(date)`: month ≥ 9 (0-indexed, Oct-Dec) → `year + 1`, else `year`; **local** time (`:21-26`).
- [ ] `getFyBounds(fy)` → `{ from: "${fy-1}-10-01", to: "${fy}-09-30" }` inclusive (`:29-32`).
- [ ] `resolveFy`: `all` → `{fromDate:null,toDate:null,label:"All time"}` (`:37-39`); `custom` → from `state.from || "1970-01-01"`,
      to `state.to || todayIso()`, label `` `Custom: ${from} → ${to}` `` (`:40-49`); `fy` → `fy ?? getCurrentFy()`, label `` `FY${fy}` `` (`:51-53`).
- [ ] `getFyOptions(3)` → `[current, current-1, current-2]` (`:57-62`).
- [ ] `fyToParams`: all → `{fy:"all"}`; custom → `{fy:"custom", from, to}` (empty strings if missing); fy → `{fy:String(fy)}` (`:65-69`).
- [ ] `fyFromParams`: no `fy` → `null`; `"all"`; `"custom"` with `from`/`to` or undefined; else `Number(raw)`, `null` if not finite (`:72-84`).
- [ ] **BUG** `todayIso()` uses UTC (`:34`) while `getCurrentFy` uses local time. Use `date-fns` via `core/lib/format`.
- [ ] **BUG** No validation: `?fy=99999` → "FY99999"; `?fy=2025.5` accepted; `?fy=custom` without dates → "Custom:
      1970-01-01 → <today>" (`:41-42,81-83`). The review doc expects a fallback to the default (`legacy:FY_FILTER_REVIEW.md:182-183`).

### Context (`legacy:src/context/FyFilterContext.tsx`)
- [ ] localStorage key `"ecap_plus_pmp.fy_filter_state_v2"` (`:12`), JSON `FyState`.
- [ ] Default `{ mode: "all" }` ("All time", so first-paint numbers match Superset lifetime totals, `:22-24`).
- [ ] Initial state once on mount: URL > localStorage (try/catch, requires `parsed.mode`) > default (`:33-56`).
- [ ] `setState(next)`: set state, write localStorage (try/catch), delete `fy`/`from`/`to` from the URL, set the non-empty
      `fyToParams` entries, `navigate({pathname, search}, { replace: true })`, keeping other params (`:60-82`).
- [ ] `clearFilter()`: default state, **remove** the key, strip the params (replace) — unlike "All time", which writes
      `?fy=all` (`:84-100`).
- [ ] URL → state: on each `location.search` change, adopt `fy` if present (JSON compare); without `fy` the state is kept
      (`:102-112`). Quirk: a URL-adopted state is not written to localStorage.
- [ ] Value `{ state, setState, clearFilter, resolved }` (`:114-117`); hook `useFyFilter()` (`:122`).
- [ ] Consumer convention repeated in every page: `fyArg = fromDate && toDate ? { from, to } : undefined`;
      `fyKey = mode === "all" ? "all" : `${fromDate ?? ""}_${toDate ?? ""}`` (e.g. `legacy:src/pages/Districts.tsx:54-58`).
      API helpers append `?from=&to=` only when both are set (`fyQs`, `legacy:src/lib/api.ts:241-245`). New app: a
      `platform/scope` hook returning `{ from, to, key }`, always in the query key.
- [ ] Consumers (grep `useFyFilter`): `MetricsGrid`, `CanonicalKpiStrip`, services `ServicesPage`, `CohortStrip`,
      `ServicesTimeSeriesChart`, `ServicesDistributionChart`; pages `CaregiverRiskRegister`, `Districts`, `Flags`,
      `HouseholdArchivedRegister`, `HouseholdRegister`, `HouseholdRiskRegister`, `HouseholdServicesPage`, `HTSRegister`,
      `HTSRiskRegister`, `MotherIndexRegister`, `Performance`, `PMTCTRegister`, `Referrals`, `VcaArchivedRegister`,
      `VcaRegister`, `VcaRiskRegister`, `VcaServicesDashboard`. Each module audit re-verifies its own use.
- [ ] **BUG/QUESTION** The URL carries `?fy=` only on the page where it was changed; nav links drop it, so the state
      persists but the URL is no longer shareable.
- [ ] **BUG** The chip is hidden on `HIDDEN_ROUTES` (`/dashboard`, `/districts`, `/calendar`, `/charts`, `/data-pipeline`,
      `/support`, `/documentation`; `legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,253-257`), yet
      `/dashboard` (`legacy:src/components/dashboard/MetricsGrid.tsx:127`) and `/districts`
      (`legacy:src/pages/Districts.tsx:54`) apply the stored FY: numbers are silently filtered with no visible control. It
      is also hidden below `md` on every page (`hidden md:block`, `:254`).

### Header chip (`legacy:src/components/FyFilter.tsx`)
- [ ] Trigger: calendar icon, `resolved.label`, chevron rotating when open (`:57-67`). Popover `align="end"`,
      `sideOffset=8`, `z-[100]`, 20rem wide (`:68-72`).
- [ ] When `hasActiveFilter` (`mode !== "all"` or the URL has `fy`/`from`/`to`, `:44-45`): "Active: {label}" + "Clear filter"
      → `clearFilter()`, reset custom inputs, close (`:34-40,73-87`).
- [ ] "Quick toggle": "Current FY (FY{n})", "Previous FY (FY{n-1})" with a check on the active one (`:88-110`).
- [ ] "All fiscal years": 3 options `FY{fy}` + muted `{fy-1}-10-01 → {fy}-09-30` (`:113-129`), duplicating the quick toggles.
- [ ] "All time" → `{mode:"all"}` (`:132-142`).
- [ ] "Custom range" toggles an inline panel (`:145-168`): `DateField` "From" and "To" (To has `minDate = From`,
      `:157-158`); "Apply custom range" disabled until both are set (`:159-166`), applies
      `{mode:"custom", from: yyyy-MM-dd, to: yyyy-MM-dd}` and closes (`:47-51`).
- [ ] `DateField`: button `dd MMM yyyy` or "Pick a date"; nested popover `z-[110]` with shadcn `Calendar mode="single"`,
      closes on pick (`:177-227`).
- [ ] Presets close the popover and collapse the custom panel (`:28-32`).
- [ ] Quirk: custom inputs initialise from `state` once (`:20-22`). Quirk: picking "To" first and then a later "From"
      produces a reversed range (only "To" is constrained).
- [ ] Date formats hardcoded (`yyyy-MM-dd`, `dd MMM yyyy`) → `core/lib/format.ts`.

### `FY_FILTER_REVIEW.md` — what still holds
- [ ] §1-§3 (shared primitives, provider wiring, chip options, `z-[100]`, Popover + Calendar, Apply disabled, mounted in the
      header inside `hidden md:block`, `GlowHeader` `sticky top-0 z-40 sm:relative sm:z-30`) match the code
      (`legacy:FY_FILTER_REVIEW.md:23-56`).
- [ ] **Out of date** §2/§8: the doc says key `fy_filter_state_v1` and default current FY (`:36,161`); code uses `..._v2`
      and "All time" (`legacy:src/context/FyFilterContext.tsx:12,24`). Port the code behaviour (QUESTION below).
- [ ] §4 backend helper matches `backend:lib/fyClause.js`: window only if both `from` and `to` match `YYYY-MM-DD`
      (`:8-17`); cohort clause `date_enrolled <= to AND (de_registration_date IS NULL OR >= from)`, ISO or DD-MM-YYYY, other
      formats → NULL (excluded), params `[to, from]`, `enrolledCol`/`deRegCol`/`startParamIndex` options (`:29-57`); service
      clause `BETWEEN from AND to` (`:64-78`).
- [ ] §5 endpoints that must honour `?from=&to=` (ecap-plus list): `GET /child/vcas-count/:district(*)`,
      `GET /household/households-count/:district(*)`, `GET /child/vcas-assessed-register/:district(*)`,
      `GET /household/all-households/:district(*)`, `GET /etl/services/:type/summary` (AUDIT.md §3.2). Only 7 endpoints apply
      the window; 8 receive it and ignore it (AUDIT.md §3.2). Doc checks: HTTP 200, FY count ≤ all-time, FY2024 ≠ FY2026, no
      "bind message supplies N parameters" (`legacy:FY_FILTER_REVIEW.md:98-102`).
- [ ] §6 note: `getHTSRegisterByDistrict` takes `_fy` and ignores it (`legacy:src/lib/api.ts:428-431`); aux cache keys include
      the FY fragment (`legacy:src/lib/api.ts:306-308,373-375`).
- [ ] §7 page status table (`legacy:FY_FILTER_REVIEW.md:130-151`): marks all list pages done, profile and admin pages exempt
      by design; MotherIndex and PMTCT marked n/a for ecap-plus though they do use FY in code.
- [ ] §9 design choice: cohort metrics narrow to the FY-active cohort; service-window metrics (`services_this_month`,
      `services_last_month`) keep calendar-month semantics (`:176-177`). **QUESTION** surface this in UI copy?
- [ ] §10 edge cases: backend without `from`/`to` → all time (`fyQs` sends nothing unless both are set) and with only one →
      no window (`backend:lib/fyClause.js:15`). Reversed custom ranges pass through the URL unvalidated.
- [ ] §11: keyboard navigation and focus trap (shadcn), chip hidden below `md` "we have other selectors there" (`:193`) —
      there is no other FY selector on mobile.

## Component `EtlInvalidator` → `platform/freshness` (unrouted)

- [ ] Mounted once at the root, renders `null` (`legacy:src/App.tsx:229`, `legacy:src/components/EtlInvalidator.tsx:87`).
- [ ] `GET /etl/last-success` (AUDIT.md §3.2) with raw `fetch`, `Content-Type: application/json` and
      `Authorization: Bearer <token>` (token from localStorage `ecap.access_token` via `getStoredToken`,
      `legacy:src/lib/auth.ts:1,9-23`); returns `data?.last_success_at ?? null`; no token, `!ok` or any exception → `null`
      (`:31-47`). The bearer header is an uncommitted working-tree change (`git diff --stat`: 7 insertions, 1 deletion).
- [ ] Query key `["etl","last-success"]`, `refetchInterval` 30 s, `refetchIntervalInBackground: false`, `staleTime: 0`,
      `gcTime` 60 s, `retry: false` (`:53-61`); also refetches on focus/reconnect (global defaults). Plan §4.9: 60 s.
- [ ] Reaction (`:63-85`): ignore `null`; first value = baseline (no invalidation); when `data > previous` (**string**
      compare): `clearAllCacheEntries()`, `invalidateQueries({ predicate: q => q.queryKey[0] !== "etl" })`,
      `console.info("[ETL] Mage run completed at", …)`. Backwards/unchanged ignored.
- [ ] **QUESTION** The predicate also skips non-ETL-freshness data whose key starts with `"etl"` (e.g. `["etl","ward-list"]`,
      `legacy:src/pages/AddUser.tsx:239`) and invalidates everything else, including Directus data. New: invalidate only
      `meta: { etl: true }` and show a quiet "Data updated" toast (plan §4.9).
- [ ] **QUESTION** Baseline is in memory: after a reload the first poll only sets the baseline, so an ETL run that finished
      while the tab was closed does not invalidate the 24 h persisted cache. Persist the last-seen timestamp?
- [ ] Compare parsed dates, not strings, in the new version.

## Component `indexedDbCache` + `getListFromApiWithCache` (unrouted)

- [ ] Raw IndexedDB DB `"ecap_plus_cache_db"`, store `"api_cache"`, version 1, store created on upgrade
      (`legacy:src/lib/indexedDbCache.ts:6-8,14-33`). Envelope `{ value, updatedAt }` (`:1-4,69-72`); invalid envelope →
      `null` (`:52-55`). Errors logged `console.warn("[IndexedDB] …")` and swallowed (`:56-58,76-78,89-91`). Opens/closes the
      DB on every call.
- [ ] `clearAllCacheEntries()` (`:81-92`) is called by the buster change (`legacy:src/App.tsx:160`), `EtlInvalidator`
      (`:77`) and `clearApiCache()` (`legacy:src/lib/api.ts:247-251`), used by refresh buttons in the HTS, PMTCT and
      mother-index registers.
- [ ] `getListFromApiWithCache(key, path, ttl)` (`legacy:src/lib/api.ts:212-238`): fresh cached value within TTL → return it;
      else fetch, store fire-and-forget, return; on error return the stale value of any age. Keys (AUDIT.md §3.2 paths):
  - `households_by_district:{d|ALL}{:from_to}` → `GET /household/all-households/:district(*)`, TTL 60 s (`:14,301-311`)
  - `children_by_district:{d|ALL}{:from_to}` → `GET /child/vcas-assessed-register/:district(*)`, TTL 60 s (`:368-379`)
  - `caregiver_services_by_district:{d|ALL}` → `GET /household/caregiver-services-by-district/:district(*)`, TTL 5 min (`:8,410-417`)
  - `household_services_by_district:{d|ALL}` → `GET /household/household-services-by-district/:district(*)`, TTL 5 min (`:419-426`)
  - `vca_services_by_district:{d|ALL}` → `GET /child/vca-services-by-district/:district(*)`, TTL 5 min (`:499-506`)
- [ ] **QUESTION** This second cache duplicates React Query persistence (and caused "stale empty list survives a buster bump",
      `legacy:src/App.tsx:154-156`). Drop it, unless offline "serve stale on error" is wanted (then implement once in `core/api`).

## Component `Theme` (unrouted)

- [ ] Config `{ banner, sidebar, header, background, button, card, text, theme }`, all `""` by default
      (`legacy:src/context/ThemeContext.tsx:3-23`).
- [ ] Initial = `JSON.parse(localStorage["ecap.ui_theme"])` or default (`:34-37`). **BUG**: no try/catch; corrupt JSON or
      blocked storage crashes the root provider.
- [ ] On change: write the key and apply inline CSS vars on `<html>`, skipping empty values (`:39-78`): `theme` →
      `--primary`, `--accent`, `--ring`; `background` → `--background`; `card` → `--card`; `text` → `--foreground`;
      `sidebar` → `--sidebar-background`; `banner`/`header`/`button` → `--banner-color`/`--header-color`/`--button-color`
      (defaults `legacy:src/index.css:62-64`).
- [ ] `updateColor` merges one key (`:80-82`); `resetTheme` restores defaults and removes the 10 props (`:84-93`).
- [ ] Only consumer: the AI assistant applies `{"action":"change_color","target":<ALLOWED_TARGETS>,"value":…}` from model
      output (`legacy:src/components/dashboard/AiAssistant.tsx:49-51,88-90`); `resetTheme` is never called, so there is no
      UI to undo AI colour changes. Raw model strings (hex/named) are written into HSL-triplet tokens such as `--primary`
      (comment `:57-62` of ThemeContext), which breaks `hsl(var(--primary))`.
- [ ] No light/dark toggle: a `.dark` palette exists (`legacy:src/index.css:68`) but nothing sets the class.

## Component `Toasts` (unrouted)

- [ ] Radix toast store `legacy:src/hooks/use-toast.ts`: `TOAST_LIMIT = 1` (`:5`), `TOAST_REMOVE_DELAY = 1000000` ms
      (`:6,60-66`), module-level state (`:124-133`), `toast()` returns `{ id, dismiss, update }` (`:137-164`). Mounted at
      `legacy:src/App.tsx:230`; only importers are `components/ui/toaster.tsx:1` and the unused re-export. Dead in practice.
- [ ] Sonner: mounted at `legacy:src/App.tsx:231` via `legacy:src/components/ui/sonner.tsx:6-25`, default position and
      duration, classes from theme tokens (`:14-20`). 22 files import `toast` from `"sonner"`.
- [ ] New app: one Sonner mount in the shell; drop the Radix store.

## Component `DashboardLayout` → `app/layouts/AppLayout` (unrouted)

### Purpose
Wraps page content with the sidebar, header, mobile hamburger sheet, mobile bottom bar, floating AI assistant and the
calendar-reminder hook (`legacy:src/components/dashboard/DashboardLayout.tsx:48-108`). Rendered **inside** 41 files
(grep): `ServicesPage` (used by `/vca-services`, `/household-services`, `/caregiver-services`), `AddUser`, `Calendar`,
`CaregiverRiskRegister`, `CaregiverServiceProfile`, `CaseworkerJourneys`, `CaseworkerProfile`, `Charts`, `Dashboard`,
`DataPipelinePage`, `Districts`, `DocumentationArticle`, `Documentation`, `EditUser`, `FlaggedRecordForm`, `Flags`,
`HouseholdArchivedRegister`, `HouseholdProfile`, `HouseholdRegister`, `HouseholdRiskRegister`, `HouseholdServiceProfile`,
`HouseholdServicesPage`, `HTSProfile`, `HTSRegister`, `HTSRiskRegister`, `MotherIndexDetails`, `MotherIndexRegister`,
`Performance`, `PMTCTProfile`, `PMTCTRegister`, `Profile`, `Referrals`, `SupportCenter`, `TrainingLog`, `Users`,
`VcaArchivedRegister`, `VcaProfile`, `VcaRegister`, `VcaRiskRegister`, `VcaServiceProfile`, `VcaServicesDashboard`.
Not wrapped: `Index`, `ForgotPassword`, `ResetPassword`, `AcceptInvite`, `ChangePassword`, `NotFound`.

### Access
- [ ] Route guard: every wrapped page is under `ProtectedRoute` only (see route table). The layout itself does no access
      check; nav hiding lives only in `AppSidebar`.

### Structure
- [ ] `SidebarProvider` around everything (`:51`), `defaultOpen` = shadcn default `true` (`legacy:src/components/ui/sidebar.tsx:50`).
- [ ] `AiAssistant` floating widget on every page (`:52`) → `assistant` module overlay (decision 5; `POST /agent/chat`, AUDIT.md §3.2).
- [ ] `AppSidebar` (`:54`), then `<main>` (`:56`) with `GlowHeader` (`:57`): `sticky top-0 z-40` below `sm`,
      `sm:relative sm:z-30` above, i.e. sticky only on phones. `GlowHeader` is a 64 px `<header>` with bottom border and
      inline `backgroundColor: var(--header-color)` (`legacy:src/components/aceternity/GlowHeader.tsx:11-20`), a token the
      theme context can override (`legacy:src/context/ThemeContext.tsx:76`).
- [ ] Below `sm`: outline icon button with text glyph `☰` and `data-mobile-menu-trigger` opens a top `Sheet` (80vh, scroll)
      titled "Navigation" listing `mobileMenuItems` (bordered rows, active = inverted colours, exact match) (`:58-90`).
      From `sm` up: shadcn `SidebarTrigger` (`:91-93`).
- [ ] `DashboardHeader title subtitle` (`:94`). Content area `flex-1 p-4 pb-24 space-y-6 sm:p-6 sm:pb-6 min-w-0 overflow-x-hidden`
      (`:97`): extra bottom padding on phones for the bottom bar.
- [ ] `MobileBottomNav`; its "More" button opens the sheet via `document.querySelector("[data-mobile-menu-trigger]").click()`
      (`:100-105`). New: shared state, not a DOM query.
- [ ] `useCalendarNotifications()` on every layout mount (`:49`).
- [ ] shadcn sidebar: Ctrl/Cmd+B toggles (`legacy:src/components/ui/sidebar.tsx:20,78-89`); widths 16rem / icon 3rem /
      mobile sheet 18rem (`:17-19`); below 768 px (`legacy:src/hooks/use-mobile.tsx:3`) the sidebar is an off-canvas sheet,
      which between 640 and 767 px is opened by `SidebarTrigger`.

### `mobileMenuItems` (`:32-46`) — no role filtering
| # | Label | Legacy path | Icon | New path |
| --- | --- | --- | --- | --- |
| 1 | Home | `/dashboard` | Home | `/dashboard` |
| 2 | Calendar | `/calendar` | Calendar | `/calendar` |
| 3 | Districts | `/districts` | MapPin | `/districts` |
| 4 | Household Register | `/households` | Home | `/households` |
| 5 | VCA Register | `/vcas` | Users | `/vcas` |
| 6 | VCA Services | `/vca-services` | ClipboardList | `/services/vca` |
| 7 | Household Services | `/household-services` | HeartPulse | `/services/household` |
| 8 | Flags | `/flags` | Flag | `/flags` |
| 9 | Household Archived Register | `/households/archived` | Archive | `/households/archived` |
| 10 | VCA Archived Register | `/vcas/archived` | Archive | `/vcas/archived` |
| 11 | Charts | `/charts` | BarChart3 | `/analytics` |
| 12 | User Management | `/users` | UserCog | `/users` |
| 13 | Profile | `/profile` | UserCircle2 | `/account` |

### Loading / empty / error
- [ ] No loading UI: `ProtectedRoute` renders `null` and the Suspense fallback is `null` (`legacy:src/App.tsx:165,235`).
- [ ] No boundary around header or body; only the app-level `ChunkErrorBoundary`.

### Bugs and quirks
- [ ] **BUG** The layout is rendered inside each page, so the whole chrome (sidebar, header, assistant widget, notification
      baseline, calendar "already notified" set, FY chip local state) unmounts and remounts on every route change. Sidebar
      collapse resets (the shadcn cookie `sidebar:state` is written, `legacy:src/components/ui/sidebar.tsx:15-16,68`, but
      never read), sidebar scroll had to be patched with sessionStorage, and calendar reminders re-fire. Port intent: one
      persistent layout route with `<Outlet/>`.
- [ ] **BUG** `title` is forwarded (`:27,94`) but `DashboardHeader` destructures only `subtitle`
      (`legacy:src/components/dashboard/DashboardHeader.tsx:81-83`), so `Calendar` (`title="Event Calendar"`,
      `legacy:src/pages/Calendar.tsx:469`) and `SupportCenter` (`title="Support Center"`, `legacy:src/pages/SupportCenter.tsx:457`)
      show the default subtitle.
- [ ] **BUG** The sheet is a stale hand-kept copy with no role filtering (shows "User Management" to everyone) and is missing
      `/registers/hts`, `/registers/pmtct`, `/registers/mother-index`, `/caregiver-services`, `/referrals`, `/performance`,
      `/caseworker-journeys`, `/training-log`, `/data-pipeline`, `/support`, `/documentation`; no Logout. Port: generate from
      the same permission-filtered nav as the sidebar.
- [ ] **QUESTION** The `☰` button has no accessible label (`:61-68`).

## Component `AppSidebar` (unrouted)

### Nav items — this table drives the new nav (`legacy:src/components/dashboard/AppSidebar.tsx:45-114`)
| Section (line) | Label | Legacy path | Icon | Legacy visibility | New path | Proposed permission |
| --- | --- | --- | --- | --- | --- | --- |
| Overview (`:47`) | Home | `/dashboard` | Home | always | `/dashboard` | — |
| Overview | Calendar | `/calendar` | Calendar | always | `/calendar` | — |
| Overview | Districts | `/districts` | MapPin | hidden when `user.description === "District User"` (`:159,166`) | `/districts` | `districts.view` |
| Overview | Program Dashboard | `/charts` | BarChart3 | always | `/analytics` | — |
| Registers (`:56`) | Households | `/households` | Home | always | `/households` | — |
| Registers | VCAs | `/vcas` | Users | always | `/vcas` | — |
| Registers | HTS Register | `/registers/hts` | Users | always | `/hts` | — |
| Registers | PMTCT | `/registers/pmtct` | HeartPulse | always | `/pmtct` | — |
| Registers | Mother Index Register | `/registers/mother-index` | Baby | always | `/mother-index` | — |
| Archived (`:70`) | Households | `/households/archived` | Archive | always | `/households/archived` | — |
| Archived | VCAs | `/vcas/archived` | Archive | always | `/vcas/archived` | — |
| Services (`:77`) | Household Services | `/household-services` | Home | always | `/services/household` | — |
| Services | VCA Services | `/vca-services` | ClipboardList | always | `/services/vca` | — |
| Services | Caregiver Services | `/caregiver-services` | HeartPulse | always | `/services/caregiver` | — |
| Services | Referrals | `/referrals` | Share2 | always | `/referrals` | — |
| Services | Performance | `/performance` | Gauge | always | `/performance` | — |
| Services | Caseworker Journeys | `/caseworker-journeys` | MapPin | always | `/caseworkers/journeys` | — |
| Services | Flags | `/flags` | Flag | always | `/flags` | — |
| Services | Training Log | `/training-log` | ClipboardCheck | always | `/training-log` | feature flag (demo data) |
| Data pipeline (`:98`) | Data Pipeline | `/data-pipeline` | DatabaseZap | intended admin or support (`:172-173`); **actual always** (S3) | `/data-pipeline` | `pipeline.view` |
| Admin (`:104`) | Users | `/users` | UserCog | `isAdmin` (`:153-156,169`) | `/users` | `users.manage` |
| Help & support (`:108`) | Support Center | `/support` | CircleHelp | always | `/support` | — |
| Help & support | Documentation | `/documentation` | BookOpen | always | `/docs` | — |

Role rules and their bugs: see "Access and scope derivation" above.

### Behaviour
- [ ] Logo block (`:203-225`): gradient square with `Sparkles` icon; expanded text "PMP" (`:217`) and tagline "Program
      Operations" (`:220`) → `site.config` (short name, tagline; logo per decision 1).
- [ ] Section labels as small uppercase group labels (`:231-233`).
- [ ] Active = exact `pathname === item.url` (`:183`, NavLink `end` `:247`): tinted background, left accent bar, bolder icon,
      `ChevronRight` when expanded (`:237-279`). Nested routes highlight nothing.
- [ ] Collapsed (icon) mode shows a tooltip with the title (`:243`).
- [ ] Footer (`:290-343`): avatar `getFileUrl(user.avatar)` → Directus `GET /assets/:id?access_token=<token>`
      (`legacy:src/lib/directus.ts:215-221`, AUDIT.md §3.3), fallback `user.first_name?.[0] ?? user.email?.[0] ?? "U"`
      (`:306-311`); name `` `${first_name} ${last_name ?? ""}`.trim() `` or email (`:317-319`); role line commented out
      (`:321-325`). Click → `/profile` (`:297`) → `/account`.
- [ ] Logout button: `logout(); navigate("/")` (`:185-188,330-342`) → `/login`; label hidden when collapsed.
- [ ] Scroll persistence: `sessionStorage["ecap_sidebar_scroll"]` written on every scroll (`:126-132,228`), restored with
      `requestAnimationFrame` on each pathname change (`:135-145`). Unnecessary with a persistent layout.
- [ ] Decorative "aurora" blobs with `animate-pulse` and inline rgba colours (`:195-201`) → theme tokens; keep subtle or drop.
- [ ] Quirk: avatar initials differ — sidebar uses one letter (`:310`), header uses the first letters of two words
      (`legacy:src/components/dashboard/DashboardHeader.tsx:224-233`). Port one helper.

## Component `DashboardHeader` (unrouted)

- [ ] Subtitle (`legacy:src/components/dashboard/DashboardHeader.tsx:237-241`), default "Data quality & program operations"
      (`:82`, → config), hidden below `sm`. Pages pass fixed strings or record IDs (e.g. `` `Household: ${id}` ``,
      `legacy:src/pages/HouseholdProfile.tsx:472`); `ServicesPage` (`:530`), `Referrals` (`:312`) and `TrainingLog` (`:184`)
      pass nothing. New: page title from the route manifest.
- [ ] `HIDDEN_ROUTES` (`:35-43`): `["/dashboard", "/districts", "/calendar", "/charts", "/data-pipeline", "/support", "/documentation"]`,
      exact match (`:85`); on them both search and FY chip are hidden (`:245-257`). `/documentation/:slug` is not matched.
      New: a per-route manifest flag.
- [ ] Search slot `flex-1 max-w-xl` (`:245-249`); FY chip `hidden md:block` (`:253-257`).
- [ ] Shortcuts (hidden below `sm`): ghost `CircleHelp` `title="Support center"` → `/support` (`:260-268`); ghost `Calendar`
      `title="Event calendar"` → `/calendar` (`:270-278`).
- [ ] User menu (`:419-532`): trigger avatar (`getFileUrl`, `:432`) + initials fallback (display name =
      `[first_name, last_name].filter(Boolean).join(" ") || email || "User"`, initials = first letters of the first two words,
      upper-case, `:224-233`) + name (hidden below `sm`, `:440-442`). Content: avatar/initials, name, email (`:457-486`), chip
      "My account" (`:487-490`), "Profile" → `/profile` (`:496-510`) → `/account`, "Logout" → `logout(); navigate("/")`
      (`:515-530`) → `/login`.
- [ ] Notification caption district = `user?.location ?? ""` (`:90`) → `platform/scope` label.

## Component `NotificationCenter` (bell in `DashboardHeader`) + calendar reminders (unrouted)

### Endpoints
- [ ] Directus `GET /notifications` (AUDIT.md §3.3) via dynamically imported `getNotifications(user.id)`
      (`legacy:src/components/dashboard/DashboardHeader.tsx:94-96`, `legacy:src/lib/directus.ts:486-501`):
      `filter[status][_eq]=inbox`, `filter[recipient][_eq]=<user.id>`, `sort=-timestamp`, `limit=100`,
      `fields=id,subject,message,timestamp,collection,sender,recipient,item`; `[]` without a user id; recipient re-checked
      client-side twice (`directus.ts:500`, `DashboardHeader.tsx:114`).
      Key `["directus-notifications", user?.id]`, `staleTime` 25 s, `refetchInterval` 30 s, not in background,
      `refetchOnWindowFocus`, `enabled: !!user?.id` (`:92-103`). Persisted to IDB → new `meta: { persist: false }`.
- [ ] No collection filter: support-chat rows also show in the bell (AUDIT.md §3.3). Chat is dropped per decision 4 → exclude
      `support_chat*` from the bell (**QUESTION** confirm).
- [ ] Dismiss one: Directus `PATCH /notifications/:id` body `{status:"archived"}` (`markNotificationRead`,
      `legacy:src/lib/directus.ts:503-512`), then invalidate `["directus-notifications"]`; error → `toast.error("Couldn't dismiss notification")`
      (`DashboardHeader.tsx:194-204`). No optimistic update.
- [ ] Clear all: Directus `PATCH /notifications?filter[recipient][_eq]=<id>&filter[status][_eq]=inbox` body `{status:"archived"}`
      (`clearAllNotifications`, `legacy:src/lib/directus.ts:550-561`); count = length of returned `data` array; then invalidate;
      toast `` `Cleared ${n} notification${n === 1 ? "" : "s"}` `` or "Inbox already clear"; error "Couldn't clear notifications"
      (`DashboardHeader.tsx:206-222`). **BUG** (AUDIT.md §3.5 e): filters in the URL with a bare body are probably not a valid
      Directus batch update. Port intent: archive all inbox items of the current user (e.g. `{keys:[…], data:{status:"archived"}}`).
- [ ] Calendar reminders: Directus `GET /items/calendar_events` via `getCalendarEvents(user.id)`
      (`legacy:src/lib/directus.ts:722-732`; AUDIT.md §3.3): `filter[user_id][_eq]`, `fields=id,title,description,start_time,end_time,category,user_id,status`,
      `sort=start_time`, no limit. Key `["calendar-events", user?.id]` — shared with the Calendar page
      (`legacy:src/pages/Calendar.tsx:107`); `enabled: !!user?.id`, `refetchInterval` 30 s
      (`legacy:src/hooks/useCalendarNotifications.ts:12-17`). Persisted to IDB → `persist: false`.

### Fields used
| Field | Raw key | Where shown | Formatting |
| --- | --- | --- | --- |
| id | `id` | React key, dismiss target | — |
| title | `subject` | bold row title | — |
| description | `message` | 2-line clamp | — |
| date | `timestamp` | relative time | `formatDistanceToNow(date, { addSuffix: true })` (`:391`) |
| icon | `collection === "weekly_extracts"` → `DatabaseZap`, else `Bell` | row tile | — |
| link | `weekly_extracts` → `/data-pipeline`; `collection.startsWith("support") && sender` → `` `/support?userId=${sender}` ``; else none | row click | (`:116-131`) |

### Behaviour
- [ ] Unread count = number of inbox items (max 100) (`:136`). Bell badge + `animate-ping` halo when > 0 (`:289-299`).
- [ ] Panel `w-80` (`:302-305`): "Notifications" + count pill (`:318-325`); caption `` `Tasks and alerts for ${district || "your area"}` ``
      (`:327-329`); sound toggle Bell/BellOff with title "Mute notification sound" / "Enable notification sound" (`:332-347`);
      "Clear all" only when count > 0 (`:348-355`).
- [ ] 288 px scroll list (`:358`); row: icon tile, title, description, relative time, `X` "Dismiss" (`:372-401`). Row click
      navigates if it has a link and does **not** archive (`:376-378`).
- [ ] Empty: "All caught up" / "No recent notifications." (`:359-370`) → `<EmptyState>`.
- [ ] Footer "View all activity" → `/support` (`:405-414`); there is no activity page.
- [ ] Sound preference `localStorage["ecapplus.notifications.sound"]` = `"on"`/`"off"`, default on (`:34,106-109,180-192`);
      write in try/catch, **read not** (`:108`).
- [ ] New-item detection (`:141-171`): first render = baseline; when the count grows, `delta = new - prev`: if sound on →
      `playNotificationBeep()` (new `AudioContext` each time, sine 880 Hz then 1320 Hz 0.12 s apart, peak gain 0.18, closed
      after 400 ms, errors swallowed, `:47-74`); if `Notification.permission === "granted"` and the tab is not visible →
      `new Notification("ECAP+ PMP", { body: "You have a new notification" | `You have ${delta} new notifications`, icon: "/ecap-logo.png", silent: !soundEnabled })`
      in try/catch (`:150-168`).
- [ ] Permission is requested **on mount** when `"default"`, twice (`:173-178` and
      `legacy:src/hooks/useCalendarNotifications.ts:19-24`), with no user gesture. Plan §4.9: request only from an opt-in
      toggle in the panel.
- [ ] Calendar rule (`legacy:src/hooks/useCalendarNotifications.ts:26-60`): for each event, `diff = differenceInMinutes(parseISO(start_time), now)`;
      if `-2 <= diff <= 15` and key `` `${id}-${start_time}` `` not in the in-memory set: browser notification (permission
      granted; title "Upcoming Event" / "Event Started", body = message, icon `/favicon.ico`) and `toast.info`
      `` `Upcoming: ${title}` `` / `` `Started: ${title}` `` with description = message, 10 s. Message:
      `` `${title} starts in ${diff} minutes!` `` / `` `${title} has just started!` ``. New: the calendar module contributes a
      source to the single NotificationCenter poller (plan §4.9).
- [ ] `src/lib/sounds.ts`: lazy singleton `AudioContext`, resumed if suspended (`:5-12`); `beep()` with 10 ms linear attack and
      exponential decay (`:14-38`); `playBell` two triangle tones 1320/1760 Hz (`:40-45`, unused); `playDrop` sine sweep
      900→220 Hz 0.28 s (`:47-51`), used by the AI assistant (`legacy:src/components/dashboard/AiAssistant.tsx:106,192`). New:
      one `platform/notifications` sound helper; the header's private beep duplicates it.

### Loading / empty / error
- [ ] Query errors are silent (no UI; app `retry: 1`). New: small inline error with retry in the panel.

### Bugs and quirks
- [ ] **BUG** The comment says the beep plays "only if the tab is hidden" (`DashboardHeader.tsx:138-140`), but the beep is not
      gated on visibility (`:149`).
- [ ] **BUG** The baseline is taken on the first render even when the query has no data yet (`:141-146`), so when the first
      fetch returns N inbox items the code treats them as new and beeps (and may show a system notification). Port: take the
      baseline from the first loaded result.
- [ ] **BUG** Calendar reminders re-fire after every navigation (the notified set lives in a hook mounted per page,
      `useCalendarNotifications.ts:10`). Port: notify once per event start for the session.
- [ ] **BUG** The reminder check runs only when the `events` reference changes (`:26-60`); identical poll results keep the same
      reference, so an event entering the window is not announced until data changes or the page remounts. Port: evaluate on a
      clock tick.
- [ ] **BUG** Reminders ignore `status` (cancelled/completed still notify) (`:31-37`; status is fetched).
- [ ] **BUG** Calendar system notifications fire while the tab is visible, together with the toast (`:46`).
- [ ] **BUG** `new Notification(...)` in the calendar hook is not in try/catch (`:46-51`); browsers that forbid the constructor
      (e.g. Chrome on Android, which requires a service worker) throw inside the effect, and with no error boundary the app
      goes blank.
- [ ] **QUESTION** Deep links: flags (collection `flagged_forms_ecapplus_pmp`) get no link; `item` may hold the record id.
      `/support?userId=` targeted the dropped chat (decision 4). What should these link to now?

## Component `GlobalSearch` → `platform/search` (unrouted)

### Access / scope
- [ ] No role filtering: "User Management" for everyone, "Districts" for district users
      (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46,107-120`).
- [ ] District = `user?.location ?? DEFAULT_DISTRICT` (`:52`), not `useEffectiveDistrict`. A national user with `"All"` gets the
      national register; a user with `location = ""` gets no record results (`enabled` false, `:69,75`).

### Endpoints
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2) via `getChildrenByDistrict(district)` with **no FY**
      (`legacy:src/lib/api.ts:368-379`); aux cache `children_by_district:<d|ALL>` 60 s. Key `["vcas","search",district]`,
      `enabled: open && Boolean(district)` (`:66-70`), app defaults (IDB-persisted).
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) via `getHouseholdsByDistrict(district)`, no FY
      (`legacy:src/lib/api.ts:301-312`); aux cache `households_by_district:<d|ALL>`. Key `["households","search",district]` (`:72-76`).
- [ ] Both download the whole register (up to ~260,000 rows, decision 8) to show 10 rows. Plan §4.7: record providers reuse
      the register's `queryOptions` entry (same key incl. FY) and MiniSearch; target backend `GET /search` (backend ask).

### Fields used
| Field | Raw keys tried (in order) | Where shown | Formatting |
| --- | --- | --- | --- |
| VCA id | `vca_id`, `vcaid`, `child_id`, `unique_id`, `uid` (`pickValue`, `:83-89,127`) | "VCA ID: {id}"; nav state `{ id }`; key `vca-{id}` | string, `""` if none |
| VCA name | `firstname` \|\| `name`, then `lastname` (`:128`) | title | `` `${first} ${last}`.trim() `` |
| Household id | `household_id`, `householdId`, `hh_id`, `unique_id`, `id` (`:153`) | "HH ID: {id}"; nav state `{ id }`; key `hh-{id}` | string |
| Household name | `caregiver_name` \|\| `name` \|\| `"Unknown Caregiver"` (`:154`) | title | string |

(These candidate lists belong in the vcas / households normalisers.)

### Filters / sort / pagination / search
- [ ] Trigger button: search icon + "Search households, VCAs..." (≥ `lg`) / "Search..." (`:93-100`).
- [ ] Ctrl/Cmd+K toggles (`:54-64`), only while mounted (not on `HIDDEN_ROUTES`). New: available everywhere.
- [ ] Input "Type a name, ID or page..." (`:103`); empty "No results found." (`:105`); list max 450 px (`:104`).
- [ ] Matching: cmdk built-in filter over each rendered item's text (case-insensitive, no debounce, no minimum). Plan §4.7:
      `shouldFilter={false}`, debounce ~150 ms, min 2 chars, top 8 per group.
- [ ] Selecting closes the dialog, then runs the action (`runCommand`, `:78-81`).

### Groups (in order)
- [ ] "Navigation" (`:107-120`) from `navigationItems` (`:33-46`):

  | Label | Legacy path | Icon | New path |
  | --- | --- | --- | --- |
  | Dashboard | `/dashboard` | Home | `/dashboard` |
  | Districts | `/districts` | MapPin | `/districts` |
  | Household Register | `/households` | Home | `/households` |
  | VCA Register | `/vcas` | Users | `/vcas` |
  | VCA Services | `/vca-services` | ClipboardList | `/services/vca` |
  | Caregiver Services | `/caregiver-services` | HeartPulse | `/services/caregiver` |
  | Flags | `/flags` | Flag | `/flags` |
  | Household Archived | `/households/archived` | Archive | `/households/archived` |
  | VCA Archived | `/vcas/archived` | Archive | `/vcas/archived` |
  | Charts | `/charts` | BarChart3 | `/analytics` |
  | User Management | `/users` | UserCog | `/users` |
  | My Profile | `/profile` | UserCircle2 | `/account` |

  Missing sidebar routes: `/calendar`, `/registers/hts`, `/registers/pmtct`, `/registers/mother-index`, `/household-services`,
  `/referrals`, `/performance`, `/caseworker-journeys`, `/training-log`, `/data-pipeline`, `/support`, `/documentation`.
  New: navigation provider generated from permitted manifest nav (plan §4.7).
- [ ] "Recent VCAs (District)" (`:124-146`): first 10 rows; select → `navigate("/profile/vca-details", { state: { id } })`
      (`:132`) → new `/vcas/:vcaId`.
- [ ] "Recent Households (District)" (`:150-172`): first 10 rows; select → `navigate("/profile/household-details", { state: { id } })`
      (`:158`) → new `/households/:householdId`.
- [ ] "Help & Documentation" (`:176-207`): `quickHelpLinks` ("Data Entry Guide", "Troubleshooting Sync", "User Permissions",
      subtitle `` `Quick Guide • ${time}` ``) and `faqs` (4 questions, subtitle "FAQ") from `legacy:src/data/supportData.tsx:3-82`;
      all go to `/support` with no anchor (`:180,195`). New: docs/support providers deep-link to the article/FAQ.

### Loading / empty / error
- [ ] No loading indicator; errors silent (group not rendered). New: per-group skeleton row / error line.

### Bugs and quirks
- [ ] **BUG** (plan §2.3) Only 10 VCAs + 10 households are rendered and cmdk filters rendered items only, so most records can
      never be found.
- [ ] **BUG** "Recent" groups are register order, not recently viewed. Plan §4.7: show locally stored recent records.
- [ ] **BUG** Records open via `location.state` (`:132,158`), so detail pages break on reload/share.
- [ ] **BUG** Duplicate React keys when an id is `""` (`:131,157`).
- [ ] **QUESTION** No FY is sent, so search includes records outside the selected FY. Follow FY (shared cache entry)?

## Component `MobileBottomNav` (unrouted)

- [ ] Fixed bar below `sm` (`sm:hidden`), `z-40`, blurred white (`legacy:src/components/dashboard/MobileBottomNav.tsx:23`).
- [ ] Items (`:5-11`), no role filtering: Home `/dashboard`, Districts `/districts`, Registers `/households`, Services
      `/vca-services` → `/services/vca`, Profile `/profile` → `/account`. Active via `NavLink end activeClassName="text-slate-900"` (`:26-35`).
- [ ] Sixth button "More" (`•••`) → `onOpenMenu` (`:37-46`), which clicks the hamburger trigger.
- [ ] **BUG** Districts shows for district users although the sidebar hides it.
- [ ] **QUESTION** "Registers"/"Services" point to one page each and highlight only on exact match. Section picker or prefix highlight?
- [ ] Breakpoint mismatch: bottom nav/hamburger at 640 px, sidebar sheet at 768 px (`legacy:src/hooks/use-mobile.tsx:3`), FY chip at `md`. Pick one set.

## Component `PageIntro` / `NavLink` / `VersionFooter` (unrouted)

- [ ] `PageIntro` props `title`, `description?`, `eyebrow?`, `actions?`, `className?` (`legacy:src/components/dashboard/PageIntro.tsx:4-10`);
      column on phones, row with bottom alignment from `sm` (`:20`); eyebrow small bold wide-tracking (`:22-26`); `<h2>`
      `text-xl`/`sm:text-2xl` (`:27`); description max `2xl` (`:28-30`); actions wrap, right-aligned (`:32`). Used by
      `FlaggedRecordForm`, `MotherIndexRegister`, `VcaServicesDashboard` only. New: the standard page header.
- [ ] `NavLink`: `forwardRef` wrapper mapping `className` + `activeClassName` + `pendingClassName` to the function form
      (`legacy:src/components/NavLink.tsx:11-23`). Used by `AppSidebar`, `MobileBottomNav`, `DashboardLayout`.
- [ ] `VersionFooter`: fixed translucent footer (`legacy:src/components/VersionFooter.tsx:15`); "Version v2.1.0" hardcoded
      (`:17`); "Date: DD-MM-YYYY" (`en-GB`, `/` → `-`, `:3-7`) and "Time: HH:mm" (`:9-12`), computed once per render. Used on
      `/` (`legacy:src/pages/Index.tsx:44`), `/forgot-password` (`legacy:src/pages/ForgotPassword.tsx:141`), `/reset-password`
      (`legacy:src/pages/ResetPassword.tsx:164`), `/accept-invite` (`legacy:src/pages/AcceptInvite.tsx:194`), `/change-password`
      (`legacy:src/pages/ChangePassword.tsx:216`) → new `AuthLayout`; version from the build, format from `core/lib/format.ts`.

## Component `EmptyState` / `ConfirmDialog` (unrouted)

- [ ] `EmptyState` props `{ icon?, title, description?, action?: { label, onClick }, className? }` (`legacy:src/components/EmptyState.tsx:6-15`);
      centred `py-16 px-4`, 64 px tinted circle with `icon` or `InboxIcon` (`:24-30`), title `text-sm font-bold tracking-widest`
      (`:31-33`), description `text-xs max-w-sm` (`:34-36`), outline rounded button (`:37-46`). Consumers: CaregiverServiceProfile,
      HTSProfile, HouseholdServiceProfile, CaseworkerProfile, VcaServiceProfile, Districts, HouseholdProfile, VcaProfile (imports
      at `:24,22,18,39,19,42,57,62`). New: `platform/states` with theme tokens.
- [ ] `ConfirmDialog` props `{ isOpen, onClose, onConfirm, title, description, confirmText = "Confirm", cancelText = "Cancel", variant = "default" | "destructive" }`
      (`legacy:src/components/dashboard/ConfirmDialog.tsx:13-32`); `AlertDialog open onOpenChange={onClose}` (`:35`); Cancel →
      `onClose` (`:42`, so `onClose` also fires a second time via `onOpenChange`); Action → `onConfirm`, red when destructive
      (`:43-48`). No pending state: it closes immediately even if the async action later fails. Consumers
      `legacy:src/pages/Users.tsx:34`, `legacy:src/pages/EditUser.tsx:28`. New: `core/ui` confirm with destructive token and optional pending state.

## Component `SubPopulationFilter` → `platform/filters` `subPopulation` (unrouted)

### Purpose and access
Purely presentational tri-state grid; labels, state and matching live in each host
(`legacy:src/components/dashboard/SubPopulationFilter.tsx:3-16`). No access logic. Hosts: `/households`
(`legacy:src/pages/HouseholdRegister.tsx:425-430`), `/vcas` (`legacy:src/pages/VcaRegister.tsx:486-491`),
`/households/archived` (`legacy:src/pages/HouseholdArchivedRegister.tsx:529-534`), `/vcas/archived`
(`legacy:src/pages/VcaArchivedRegister.tsx:607-612`); `/registers/mother-index` has an inline copy
(`legacy:src/pages/MotherIndexRegister.tsx:238-254`, caption "Mother category" `:239`).

### Rendering
- [ ] Caption "Sub-population" (`:19-21`); one cell per `labels` entry in object order, label truncated with full `title` (`:23-35`).
- [ ] Options exactly `["all","yes","no"]`, shown upper-case (`:37,52`); missing value = `"all"` (`:24`); active `yes` green,
      `no` red, `all` neutral (`:39-45`) → success/destructive/muted tokens. Click → `onChange(key, option)` (`:50`).
- [ ] Grid 1/2/3/5 columns at base/sm/lg/xl (`:22`). No clear control inside; hosts reset every key to `"all"`
      (`legacy:src/pages/HouseholdRegister.tsx:241-246`).

### Definitions (config parity — `program.config` sub-populations)
Households (active + archived, `legacy:src/pages/HouseholdRegister.tsx:45-53`, `legacy:src/pages/HouseholdArchivedRegister.tsx:52-60`;
an unused copy in `legacy:src/pages/HouseholdProfile.tsx:83-91`); `filterKeyToDataKey` is empty
(`legacy:src/pages/HouseholdRegister.tsx:57-59`), so key = field:

| Key | Household label | VCA label | VCA data field (`legacy:src/pages/VcaRegister.tsx:65-73`) |
| --- | --- | --- | --- |
| `calhiv` | `CALHIV` | `C/ALHIV` | `calhiv` |
| `hei` | `HEI` | `HEI` | `hei` |
| `cwlhiv` | `CWLHIV` | `C/WLHIV` | `cwlhiv` |
| `agyw` | `AGYW` | `AGYW` | `agyw` |
| `csv` | `C/SV` | `C/SV` | `csv` |
| `cfsw` | `CFSW` | `CFSW` | `cfsw` |
| `abym` | `ABYM` | `ABYM` | `abym` |
| `caahh` | — | `CAAHH` | `child_adolescent_in_aged_headed_household` |
| `caichh` | — | `CAICHH` | `child_adolescent_in_chronically_ill_headed_household` |
| `caich` | — | `CAICH` | `child_adolescent_in_child_headed_household` |
| `calwd` | — | `CALWD` | `child_adolescent_living_with_disability` |
| `caifhh` | — | `CAIFHH` | `child_adolescent_in_female_headed_household` |
| `muc` | — | `MUC` | `under_5_malnourished` |
| `pbfw` | — | `PBFW` | `pbfw` |

VCA labels: `legacy:src/pages/VcaRegister.tsx:47-62` ("Full list of 14 filters", `:46`) and
`legacy:src/pages/VcaArchivedRegister.tsx:52-77`; the map is copied a third time in `legacy:src/pages/VcaServicesDashboard.tsx:145-153`.
VCA profile badges (`legacy:src/pages/VcaProfile.tsx:82-96`, 13 keys, no `pbfw`) plus derived badges `HIV+ PBFW`, `HIV- PBFW`,
`Children of PBFW` (`:945-974`) — see vcas audit.
Mother index (`legacy:src/pages/MotherIndexRegister.tsx:27-40,103-116`): `hei` "HEI Status" (`hei`, `hei_status`), `hiv_pos`
"HIV Positive" (`art_status`, `caregiver_hiv_status`, `hiv_status`), `on_art` "On ART" (`on_art`, `art_linkage`), `linked`
"Linked" (`linked`, `linkage_status`); first non-empty, non-zero value else `"N/A"`; `yes` passes for
`yes|true|1|active|positive`, `no` for `no|false|0|""|n/a|negative` (lower-cased).
Descriptions exist only in the AI prompt (`legacy:src/lib/ai-service.ts:42-49`) and the services cohort strip
(`legacy:src/components/dashboard/services/CohortStrip.tsx:17-19`).

### Matching (household + VCA registers)
- [ ] AND over active toggles (`legacy:src/pages/HouseholdRegister.tsx:181-190`); `yes` = value `"1"|"true"|1|true`; `no` =
      `"0"|"false"|0|false|null|undefined` (strict).
- [ ] Client-side over the fetched list; plain `useState` all `"all"` (`:78-80`), **not persisted** → URL via `platform/filters`.
- [ ] Any filter change resets to page 1 (`:209-212`). Active toggles show removable chips `` `${label}: ${value}` `` and count
      toward the Clear badge (households/vcas audits). Exports use the filtered set (`:248-250`).

### Bugs and quirks
- [ ] **BUG** `"Yes"`/`"No"`/`""` match neither `yes` nor `no` (`legacy:src/pages/HouseholdRegister.tsx:187-189`), while
      VcaProfile accepts `"yes"` (`legacy:src/pages/VcaProfile.tsx:950`). One normaliser to `boolean | null` in schemas.
- [ ] **BUG** Labels differ per entity for the same key (`CALHIV` vs `C/ALHIV`, `CWLHIV` vs `C/WLHIV`).
- [ ] **BUG** VcaProfile looks keys up without `filterKeyToDataKey`, so CAAHH…MUC badges never appear
      (`legacy:src/pages/VcaProfile.tsx:964-969`).
- [ ] **BUG** `onClear` prop ignored (`:7,11-16`). MotherIndex re-implements the component inline.
- [ ] **QUESTION** Missing flag counts as "no" (and `"N/A"` as "no" for mother index). Should "unknown" be its own state?

## Component `MultiFacilityPicker` (unrouted, users module)

- [ ] Picks **wards** for a facility-level user, stored as a CSV string in Directus user field `facility`
      (`legacy:src/components/MultiFacilityPicker.tsx:5-6`). Shown when `selectedLevel === "facility"`
      (`legacy:src/pages/AddUser.tsx:677`) / `formState.custom_role === "Facility User"` (`legacy:src/pages/EditUser.tsx:469`).
- [ ] Options: `GET /etl/facility-list` (AUDIT.md §3.2, "distinct ward names (misnamed)") via `getFacilityList`
      (`legacy:src/lib/api.ts:1239-1242`), key `["etl","ward-list"]`, `staleTime` 10 min, enabled only for facility level
      (`legacy:src/pages/AddUser.tsx:238-243`, `legacy:src/pages/EditUser.tsx:131-136`); filtered client-side to the chosen
      district's wards (see users audit). Saved via Directus `POST /users` / `PATCH /users/:id` field `facility`
      (`legacy:src/pages/AddUser.tsx:404`, `legacy:src/pages/EditUser.tsx:286`).
- [ ] `parseFacilitiesCsv`: empty → `[]`, split on `,`, trim, drop empties (`:7-13`). `serializeFacilitiesCsv`: trim, drop
      empties, case-**sensitive** de-dupe, join `", "` (`:15-17`).
- [ ] Trigger: no selection → button "Loading facilities…" / placeholder / "Select one or more facilities" (`:64-72`); callers pass
      "Select a district first" or "Select one or more wards" (`legacy:src/pages/AddUser.tsx:690`). With selection: chips with
      remove (`aria-label` `` `Remove ${name}` ``), "+ Add more", "Clear all" (`:74-106`).
- [ ] Panel (open and not disabled): "Search facilities…" (autofocus, case-insensitive substring, no debounce), list max 220 px,
      "Loading…" / "No matches", click toggles with a check, footer `{n} selected` + "Done" (`:112-167`). No outside-click or
      Escape close → new: Popover + Command multi-select.
- [ ] Validation in callers: at least one ward, toast "Please select at least one facility" (`legacy:src/pages/AddUser.tsx:390`,
      `legacy:src/pages/EditUser.tsx:267`); changing district clears `facility` (`legacy:src/pages/AddUser.tsx:651`,
      `legacy:src/pages/EditUser.tsx:446`).
- [ ] **BUG** Stored values are loaded raw (`legacy:src/pages/EditUser.tsx:191,206`) while options are title-cased; selection uses
      case-sensitive `includes` (`:41,132`), so stored lower-case wards show unselected and can be stored twice.
- [ ] **BUG** The form says "User will only see data from the wards below" (`legacy:src/pages/AddUser.tsx:683`), but nothing
      enforces ward scope (`backend:lib/userScope.js:18-49` derives national/province/district only) → backend ask.

## Component `CSV and PDF export helpers` → `platform/export` (unrouted)

### `legacy:src/lib/exportUtils.ts`
- [ ] `escapeCsvField`: quote and double inner quotes when the value contains `,`, `"` or `\n` (`:4-9`).
- [ ] `downloadCsv(headers, rows, filename)`: `"data:text/csv;charset=utf-8," + [headers.join(","), …rows]` joined with `\n`,
      `encodeURI`, temporary `<a download>` click (`:14-29`). No BOM, no trailing newline, headers not escaped.
- [ ] Callers: `districts_summary_${dateStr}.csv` (`legacy:src/pages/Districts.tsx:210`); `` `${districtName}_detailed_report_${dateStr}.csv` ``
      (`legacy:src/pages/Districts.tsx:282-286`); `` `hts_register_${type}_${selectedDistrict}_${dateStr}.csv` `` (`legacy:src/pages/HTSRiskRegister.tsx:181`).
- [ ] **BUG** `encodeURI` leaves `#` unescaped, so a `#` in any cell truncates the file (`:15-24`); Flags has the same pattern
      (`legacy:src/pages/Flags.tsx:137-140`). Large exports can exceed URL limits.

### `legacy:src/lib/csv.ts`
- [ ] `null`/`undefined` → `""`, else `String(v)` (`:1-3`); same escape rule for headers **and** cells (`:5-14`); lines joined
      `\n` plus trailing `\n` (`:15`); Blob `text/csv;charset=utf-8;` → object URL → click → remove → revoke (`:18-29`). No BOM.
- [ ] Callers and filenames: `` `${type}-duplicate-groups-${scope}-${YYYY-MM-DD}.csv` `` (`legacy:src/components/dashboard/services/QualityReviewPanel.tsx:140`, UTC date);
      `` `index-mothers-${slug}.csv` `` (`legacy:src/pages/MotherIndexRegister.tsx:172`); `` `referrals-${selectedDistrict || "all"}-${activeTab}.csv` ``
      (`legacy:src/pages/Referrals.tsx:277-279`); `` `hts-register-${slug}.csv` `` (`legacy:src/pages/HTSRegister.tsx:572-574`);
      `` `pmtct-register-${slug}.csv` `` (`legacy:src/pages/PMTCTRegister.tsx:431-433`); `` `training-log-${"filtered"|"all"}-${toIsoDate(today)}.csv` ``
      (`legacy:src/pages/TrainingLog.tsx:174-180`). slug = `selectedDistrict.toLowerCase().replace(/\s+/g, "-")`.

### Page-local builders to fold in
- [ ] Always-quote + UTF-8 BOM in the four core registers (e.g. `legacy:src/pages/HouseholdRegister.tsx:267,282`, filename
      `households_${district|all_districts}_${UTC date}.csv` `:277-280`); others hand-roll Blobs (risk registers, Performance,
      CaseworkerJourneys, DataPipelinePage, DuplicateDetectionCard, DataQualityChart, ServiceInsights); the services export is
      streamed by the server (`legacy:src/lib/api.ts:1458-1474`, services module). Details in each module audit.

### Rules for `platform/export` (union of legacy behaviour, plan §4.8)
- [ ] RFC-4180 quoting of headers and cells (`,`, `"`, `\r`, `\n`); null → empty; UTF-8 BOM; Blob + object URL, revoked.
- [ ] Rows = the currently filtered set in current sort (not the current page).
- [ ] Filename `{appShortName}_{table}_{scope}_{yyyy-MM-dd}.{ext}` (plan §4.8), local date via `core/lib/format.ts` (several
      legacy stamps use UTC `toISOString().slice(0,10)`).
- [ ] **QUESTION** Guard against CSV formula injection (cells starting `=`, `+`, `-`, `@`)? Data is free text from field staff.

### Trainee record PDF (`legacy:src/constants/pdf.ts`) — training-log module; layout primitives for `platform/export`
- [ ] Lazy-loaded on click from `TraineeRecordModal` (`await import("@/constants/pdf")`); jsPDF + jspdf-autotable. The only PDF export.
- [ ] Throws "No training records to export." when empty (`:73`). A4 portrait, mm, margin 14 (`:28,75`).
- [ ] Header: "Training Attendance Record" helvetica bold 16 (`:80-83`); right `` `Generated ${formatDate(UTC date)}` `` 9 pt (`:85-93`);
      green rule at y=24 (`:95-97`).
- [ ] Person block: Name, NRC, Sex, Designation, Trainings, Certified in `` `${certified} of ${total}` `` (`:100-108`).
- [ ] Per enrollment: new page if < 70 mm left (`:33-40,114`); grey bar `` `${i+1}. ${title}` `` + status label (`:116-125`);
      key-values Training ID, Partner, Start date, End date, Health facility, District, Training site, Master trainers, Target
      audience, Sessions / hours, Trainers (`"; "`), Materials (`:127-140`); results grid `Attendance`, `Pre-test`, `Post-test`,
      `Change`, `Completed`, `Certified` with green header (`:143-159`); sessions table `#`, `Session`, `Attendance` =
      Present (green) / Absent (red bold) / "Not held yet" (grey) (`:162-186`).
- [ ] Footer every page: `` `${name}, NRC ${nrc}` `` and `` `Page ${i} of ${pages}` `` (`:192-201`). No branding.
- [ ] Filename `` `training-record-${name-slug}-${nrcDigits || "no-nrc"}.pdf` `` lower-cased (`:206-210`).
- [ ] **BUG** "Generated" date is UTC (`:89`). **BUG** "Not held yet" (PDF `:167`) vs "Not held" (CSV `legacy:src/constants/utils.ts:196`).
- [ ] **QUESTION** The PDF prints the national ID (NRC) on every page. Acceptable PII? Should PDFs carry config branding (plan §4.8)?

## Component `Training-log model` (`constants/types.ts`, `constants/utils.ts`) (unrouted) → `modules/training-log/model`

- [ ] `PARTNERS = ["PCZ", "BISO", "ZCCB", "Blue Code"]` (`legacy:src/constants/types.ts:12`) → config;
      `TARGET_AUDIENCES = ["Trainer of Trainers", "MOH/DHO Staff", "HF Staff", "CHW", "Other"]` (`:15-21`); `MAX_SESSIONS = 22` (`:24-25`).
- [ ] `Training` and `TrainingParticipant` shapes (`:33-91`): participant `nrc` documented as "Zambian NRC" (`:71`, country term → config),
      `attendance[]` true/false/null = present/absent/not held, nullable completed/pre/post/certified. `TrainingLog = { trainings, participants }`
      is the intended future API shape (`:8-10,93-96`).
- [ ] `STATUS_META` labels "Certified", "Completed", "In progress", "Did not complete" (`legacy:src/constants/utils.ts:14-34`);
      `getEnrollmentStatus`: certified → completed → `endDate >= todayIso` in_progress → not_completed (`:95-104`).
- [ ] `buildEnrollments`: drops orphans (`:115-116`); held = non-null, attended = true, `scoreChange = post - pre` (`:123-126`);
      `personKey` `nrc:<digits>` or `name:<lower name>` (`:90-93`); `searchText` (`:128-140`); sort startDate desc, training id asc,
      rowNumber asc (`:144-149`). `matchesSearch`: every whitespace term is a substring (`:153-157`).
- [ ] Formatters `toIsoDate` (local), `formatDate` (`en-GB` "d MMM yyyy", input returned if unparsable), `formatDateRange`, `yesNo`,
      `formatScore`, `formatChange`, `attendancePct`, `audienceLabel` (`:55-88`) → `core/lib/format.ts`.
- [ ] CSV headers in order (`:163-193`): `Training ID`, `Training Title`, `Training Materials / Manual`, `Partner`, `Health Facility`,
      `Training Site`, `District`, `Trainers`, `Start Date`, `End Date`, `Training of Master Trainers`, `Target Audience`,
      `Total Sessions`, `Total Hours`, `#`, `Name`, `NRC`, `Sex`, `Designation / Institution`, `Sessions Held`, `Sessions Attended`,
      `Attendance %`, `Pre-test %`, `Post-test %`, `Score Change`, `Completed Training`, `Certified`, `Status`, `Session 1` … `Session 22`;
      row sources in the same order (`:198-235`); session cell `""` beyond `totalSessions`, `null` → "Not held", true/false →
      "Present"/"Absent" (`:195-196,231-233`).

## Component `Generic helpers` (`lib/utils.ts`, `lib/data-validation.ts`, `AnimatedCounter`) (unrouted)

| Export | Behaviour | Users | New home |
| --- | --- | --- | --- |
| `cn` | `twMerge(clsx(inputs))` (`legacy:src/lib/utils.ts:4-6`) | most components | `core/lib/cn.ts` |
| `CAREGIVER_CONFIDENTIAL_LABEL` / `anonymizeCaregiverName` | **Always** returns "Caregiver Name - Confidential"; both branches identical (`:8-16`) | `legacy:src/pages/MotherIndexDetails.tsx:35`, `legacy:src/pages/Referrals.tsx:119` | `core/lib` masking helper with config labels |
| `toTitleCase` | lower-case, split on single spaces, capitalise first char (`:18-21`) | district lists in 9 registers and Districts (e.g. `legacy:src/pages/HouseholdRegister.tsx:126`) | merge into place-name normaliser |
| `toSentenceCase` | trim, first char upper, rest lower (`:23-27`) | service profiles, risk registers | `core/lib/format.ts` |
| `normalizePlaceName` | trim, collapse spaces, lower, capitalise space- and hyphen-separated parts (`:35-49`) | AddUser, EditUser, CaseworkerJourneys | `core/lib/format.ts` / schemas |
| `dedupePlaceNames` | normalise, drop empties, case-insensitive de-dupe keeping first, stable (`:55-64`) | CaseworkerJourneys | same |

- [ ] Hardcoded masking duplicates with en/em dashes: "Caregiver Name – Confidential" (`legacy:src/pages/HTSProfile.tsx:194,356`,
      `legacy:src/pages/HouseholdProfile.tsx:525,668`), "VCA Name – Confidential" (`legacy:src/pages/VcaProfile.tsx:495`), "Mother Index
      Name — Confidential" (`legacy:src/pages/MotherIndexDetails.tsx:119`), "Phone – Confidential" (`legacy:src/pages/HTSProfile.tsx:380-381`,
      `legacy:src/pages/HouseholdProfile.tsx:738`), "Address – Confidential" (`legacy:src/pages/HTSProfile.tsx:382`). Port one helper.
- [ ] **BUG** `toTitleCase` and `normalizePlaceName` disagree ("St-anne's" vs "St-Anne's"; double spaces kept), so the same place
      can appear with different casing.
- [ ] `isCategoryProvided(record, key)` (`legacy:src/lib/data-validation.ts:10-70`) → services module `model/`: falsy → false;
      strings starting `[`/`{` are JSON-parsed; arrays: drop items in {not applicable, none, null, n/a, na, no, false, 0, ""} →
      true if any remain; single values: not empty and not in {not applicable, n/a, na, none, no, false, 0, [], {}, null}; parse
      failure → same without `[]`/`{}`. Used with `health_services`, `schooled_services`, `safe_services`, `stable_services` by the
      three risk registers, `VcaServicesDashboard` and `CaseworkerProfile` (`legacy:src/pages/CaseworkerProfile.tsx:155-158,196-199,455-458`).
      **BUG** `"{}"` and arrays of objects stringify to `"[object object]"` and count as provided (`:16-18,24-25,42-54`).
- [ ] `AnimatedCounter` (`legacy:src/components/AnimatedCounter.tsx`): strip commas, `parseInt`; NaN (e.g. "N/A") → shown as-is
      (`:15-24`); else rAF ease-out-cubic from previous target over 1200 ms, each frame `Intl.NumberFormat("en-GB")` (`:26-47`);
      initial "0" (`:10`). Callers show `LoadingDots` while loading (`legacy:src/components/dashboard/MetricsGrid.tsx:85`,
      `legacy:src/pages/Districts.tsx:563-567`). **BUG** drops decimals/suffixes; `prevValue` only updates when an animation
      finishes (`:42-44`), so a mid-animation update jumps; ignores `prefers-reduced-motion`.

---

## Other behaviour

- **Storage keys** (all brand-prefixed → one namespaced storage helper in `core/lib` with a config prefix)
  - [ ] localStorage `ecap.ui_theme` (`legacy:src/context/ThemeContext.tsx:35,40`)
  - [ ] localStorage `ecap_plus_pmp.fy_filter_state_v2` (`legacy:src/context/FyFilterContext.tsx:12,64,90`)
  - [ ] localStorage `ecap_plus_persist_buster` (`legacy:src/App.tsx:158,161`)
  - [ ] localStorage `ecapplus.notifications.sound` (`legacy:src/components/dashboard/DashboardHeader.tsx:34,108,186`)
  - [ ] localStorage `ecap.access_token` (read by `EtlInvalidator`, `legacy:src/lib/auth.ts:1`; auth module)
  - [ ] sessionStorage `ecap_chunk_reload_at` (`legacy:src/lib/lazyWithRetry.ts:24,42,48,51`)
  - [ ] sessionStorage `ecap_sidebar_scroll` (`legacy:src/components/dashboard/AppSidebar.tsx:126,130,138`)
  - [ ] cookie `sidebar:state`, 7 days, written never read (`legacy:src/components/ui/sidebar.tsx:15-16,68`)
  - [ ] IndexedDB (idb-keyval default DB) key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`)
  - [ ] IndexedDB `ecap_plus_cache_db` / `api_cache` with the 5 key patterns above (`legacy:src/lib/indexedDbCache.ts:6-8`)
- **Timers / polling**
  - [ ] Notifications 30 s (stale 25 s, paused in background, refetch on focus); calendar events 30 s; `/etl/last-success` 30 s
        (paused in background). Plan §4.9: one notifications poller, freshness 60 s.
  - [ ] Persister throttle 1 s; Radix toast remove delay 1,000,000 ms; chunk-reload guard 10 s; aux TTLs 60 s / 5 min; global
        stale 60 s, gc 24 h, persist maxAge 24 h; beep `AudioContext` closed after 400 ms; rAF for sidebar scroll and counters.
- **Keyboard shortcuts**
  - [ ] Ctrl/Cmd+K toggles search (`legacy:src/components/dashboard/GlobalSearch.tsx:54-64`).
  - [ ] Ctrl/Cmd+B toggles the sidebar (`legacy:src/components/ui/sidebar.tsx:20,78-89`).
- **Browser APIs**: `Notification.requestPermission` ×2 on mount, `new Notification`, WebAudio, `document.visibilityState`,
  IndexedDB, localStorage, sessionStorage, `matchMedia`, `window.location.reload`, `fetch` (EtlInvalidator), `URL.createObjectURL`,
  `<a download>`, jsPDF `doc.save`, dynamic `import()`.
- **Toasts (Sonner)**: "Couldn't dismiss notification"; "Cleared N notification(s)" / "Inbox already clear"; "Couldn't clear
  notifications"; calendar `toast.info` "Upcoming: …" / "Started: …" 10 s; "Please select at least one facility" (users).
- **Hardcoded brand / program strings → `@/config`** (`pnpm check:brand`)
  - [ ] `legacy:index.html:16-21` title "PMP", "ECAP+ PMP application", "ECAP+"; hardcoded API origins `:11-14`; hostnames `legacy:vite.config.ts:22,27`
  - [ ] "PMP" / "Program Operations" (`legacy:src/components/dashboard/AppSidebar.tsx:217,220`); "Data quality & program operations"
        (`legacy:src/components/dashboard/DashboardHeader.tsx:82`); "ECAP+ PMP" notification title and `/ecap-logo.png` (`:157,162`);
        `/favicon.ico` (`legacy:src/hooks/useCalendarNotifications.ts:49`); "Version v2.1.0" (`legacy:src/components/VersionFooter.tsx:17`)
  - [ ] All storage keys above; persister key and IDB DB name
  - [ ] Role strings `"ecap+ support"` (`legacy:src/hooks/useEffectiveDistrict.ts:8`), `"Administrator"`, `"Support User"`,
        `"District User"`, `"Provincial User"` (`legacy:src/components/dashboard/AppSidebar.tsx:155-160`); `"ecap+"` role-name lookup
        (`legacy:src/pages/AddUser.tsx:263,268`, `legacy:src/pages/EditUser.tsx:155,158`, users module)
  - [ ] FY rule and "PEPFAR" (`legacy:src/lib/fiscalYear.ts:1,20,29-32`; `legacy:src/components/FyFilter.tsx:125`)
  - [ ] Geography (`legacy:src/constants/districts.ts:1-6`); sub-population keys/labels (register files above); partners and target
        audiences (`legacy:src/constants/types.ts:12,15-21`); "NRC"/"Zambian NRC" (`legacy:src/constants/types.ts:71`,
        `legacy:src/constants/pdf.ts:103,199`, `legacy:src/constants/utils.ts:180`)
  - [ ] Domain terms in UI: "VCA", "HH ID", "Caregiver", "Recent VCAs (District)", "Search households, VCAs..."
        (`legacy:src/components/dashboard/GlobalSearch.tsx:98,125,140,151,154,166`) and all nav labels; confidential labels
        (`legacy:src/lib/utils.ts:8`); `en-GB` locale (`legacy:src/components/AnimatedCounter.tsx:38`, `legacy:src/constants/utils.ts:61`,
        `legacy:src/components/VersionFooter.tsx:3,9`)
- **Inline colours**: rgba/hex gradients in class names (`legacy:src/components/dashboard/AppSidebar.tsx:197-198`,
  `legacy:src/components/dashboard/DashboardHeader.tsx:304,308-309,448,452-453`); RGB triples in the PDF (`legacy:src/constants/pdf.ts:22-26`) → theme tokens.
- **Dropped per decision 4**: the `/support?userId=<sender>` bell deep link only opened a support-chat thread
  (`legacy:src/components/dashboard/DashboardHeader.tsx:129-130`); chat rows share `directus_notifications` with the bell
  (AUDIT.md §3.3). Inventory only.
- **Backend asks**: route-level role enforcement for `/users*` and `/data-pipeline` data (S2); caller-supplied district trusted on
  35 endpoints; ward-level (`facility`) scope never enforced; geography duplicated in `backend:config/geography.js`; `GET /search`
  for global search (plan §4.7).

## Open questions for the developer

1. Data pipeline nav: confirm `pipeline.view` = admins + support users (legacy check is broken and shows it to all).
2. Should the four risk registers (`/households/risk`, `/vcas/risk`, `/caregivers/risk`, `/hts/risk`) and `/services/household-services` get nav entries? Legacy has none and most have no inbound link.
3. Which pages hide the global search and FY chip? Legacy hides both on dashboard, districts, calendar, charts, data pipeline, support and the documentation index, while dashboard and districts still apply the stored FY. Should mobile get the FY control?
4. FY default: keep "All time" (code) rather than current FY (review doc)? Validate `?fy=` (integer, range) and `?fy=custom` without dates (fall back to default)? Carry `fy`/`from`/`to` across navigation so URLs stay shareable?
5. Notification deep links: flags (to the record via `item`?), weekly extracts (which data-pipeline tab?), support items (chat dropped). Exclude chat rows from the bell? Keep, retarget or drop "View all activity"? Should clicking a notification archive it?
6. Calendar reminders: skip cancelled/completed events? Respect the sound and browser-notification preferences?
7. Role model: confirm the canonical source of role, province (`title`) and district (`location`) and the default for unrecognised users (deny?), so `core/access` matches `backend:lib/userScope.js`.
8. Freshness: invalidate only `meta: { etl: true }` queries, and persist the last-seen ETL timestamp so a reload after an ETL run refreshes the persisted cache?
9. Drop the auxiliary IndexedDB cache in favour of one persisted query cache (or keep "serve stale on error" once in `core/api`)?
10. AI-driven theming: keep `change_color` in the assistant? If yes, validate values and add "Reset colours". Add a light/dark toggle?
11. Nested routes: highlight the parent nav item (`/households/:id` → Households)? Bottom-bar items configurable per role?
12. 404 inside the app layout for signed-in users? Keep the auth-page footer date/time, or show only the build version?
13. Sub-populations: one canonical list with labels and per-entity applicability; long descriptions for CFSW, ABYM, C/SV, CWLHIV, CAICHH, CAICH, CAIFHH, MUC (not in code); treat missing flags as "no" or unknown; keep derived PBFW badges and should `agyw` imply PBFW (`legacy:src/pages/VcaProfile.tsx:951-952`)?
14. Export conventions: BOM always? formula-injection guard? one filename pattern for all exports or keep legacy names? PDF branding and NRC on every page?
15. Keep the animated KPI counter (with reduced-motion support)?
16. Should ward-scoped ("facility") users exist before the backend enforces ward scope? Should `anonymizeCaregiverName` always mask?
17. The deploy env uses `REACT_APP_BASE_URL` / `REACT_PUBLIC_API_URL`; confirm they can be renamed to `VITE_*` for the new app.
