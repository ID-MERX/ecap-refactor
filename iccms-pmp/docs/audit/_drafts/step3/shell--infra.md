# shell — legacy audit (part: infra)

> New module `shell` (app-wide: `src/app`, `core/*`, `platform/scope`, `platform/freshness`, `platform/states`) · Legacy routes → new routes: no routes of its own; `*` → NotFound (new shell 404) · Plan: MIGRATION_PLAN.md §5 (all rows; this part owns the route table, guards and legacy redirects) and Phase 3 "Core and shell"
>
> This part covers bootstrap, providers, query client and persistence, routing and guards, the chunk error boundary, `lazyWithRetry`, theme, both toast systems, the fiscal-year filter, `useEffectiveDistrict`, `EtlInvalidator`, the auxiliary IndexedDB cache, NotFound, EmptyState and ConfirmDialog. Header, sidebar, mobile nav, global search, notifications and the layout are covered by other shell parts. They are cited here only where they decide route visibility.

## Legacy files

| File | Lines | Role |
|---|---|---|
| `src/main.tsx` | 5 | Entry: `createRoot(...).render(<App />)` and imports `index.css` |
| `index.html` | 38 | HTML shell: title, meta, API preconnects, Google Font |
| `vite.config.ts` | 56 | Dev server port, Superset proxy, allowed hosts, env prefixes, vendor chunk |
| `src/App.tsx` | 602 | Query client, IDB persister, buster, ChunkErrorBoundary, provider tree, full route table |
| `src/components/auth/ProtectedRoute.tsx` | 23 | The only route guard (auth plus forced password change) |
| `src/context/ThemeContext.tsx` | 106 | Runtime colour overrides (used only by the AI assistant) persisted in localStorage |
| `src/context/FyFilterContext.tsx` | 122 | FY filter state: URL > localStorage > default, URL sync |
| `src/components/FyFilter.tsx` | 229 | Header FY chip popover with a custom date range |
| `FY_FILTER_REVIEW.md` | 249 | Developer review checklist for the FY filter (partly out of date, see below) |
| `src/lib/fiscalYear.ts` | 84 | FY maths, resolve, URL (de)serialisation |
| `src/components/EtlInvalidator.tsx` | 90 | Polls `/etl/last-success` and invalidates all caches when it moves forward |
| `src/lib/lazyWithRetry.ts` | 62 | `React.lazy` wrapper: one guarded hard reload on stale-chunk errors |
| `src/lib/indexedDbCache.ts` | 92 | Auxiliary raw-IndexedDB response cache used by `getListFromApiWithCache` |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Role/scope derivation from `description`/`title`/`location` (used by 4 pages) |
| `src/hooks/use-mobile.tsx` | 19 | `useIsMobile()` (768 px breakpoint). Only consumer is `components/ui/sidebar.tsx:51` |
| `src/hooks/use-toast.ts` | 186 | shadcn/Radix toast store. Mounted, but **no feature code calls it** |
| `src/components/ui/use-toast.ts` | 3 | Re-export of the above. Never imported |
| `src/components/ui/toaster.tsx` | 24 | Radix `<Toaster>` renderer (mounted in App) |
| `src/components/ui/sonner.tsx` | 27 | Sonner `<Toaster>` wrapper (mounted in App). Uses `next-themes` without a provider |
| `src/pages/NotFound.tsx` | 24 | `*` route |
| `src/components/EmptyState.tsx` | 51 | Shared empty-state block (8 consumers) |
| `src/components/dashboard/ConfirmDialog.tsx` | 55 | Shared confirm AlertDialog (Users, EditUser) |
| `src/components/NavLink.tsx` | 28 | react-router `NavLink` adapter with `activeClassName` (read for nav context) |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Read for nav visibility rules (owned by the layout part) |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Read for mobile nav entries (owned by the layout part) |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Read for search nav entries (owned by the search part) |
| `src/constants/districts.ts` | 8 | Hardcoded provinces/districts used by `useEffectiveDistrict` |
| `src/lib/api.ts` (lines 1-16, 195-260, 300-430, 495-505) | partial | `DEFAULT_DISTRICT`, `getListFromApiWithCache`, `fyQs`, `clearApiCache`, TTLs |
| `src/lib/auth.ts` (lines 1-40) | partial | Token storage key used by `EtlInvalidator` |
| `src/context/AuthContext.tsx` (lines 140-160) | partial | `logout()` (does not clear caches) |
| `backend:lib/fyClause.js` (lines 1-80) | 80 | Server-side FY window semantics (for FY_FILTER_REVIEW §4) |

Unrouted page: `src/pages/VcaServicesDashboard.tsx` has no `<Route>` in `App.tsx` (decision 1: port it under `services`).

---

## Component `Providers & bootstrap order`

- [ ] Entry: `createRoot(document.getElementById("root")!).render(<App />)` with global CSS imported first (`legacy:src/main.tsx:1-5`). The non-null assertion needs a comment in the new code (CLAUDE.md TS rules).
- [ ] Provider nesting, outermost first (`legacy:src/App.tsx:213-600`):
  1. `PersistQueryClientProvider` (query client and IDB persister) `:214-225`
  2. `ThemeProvider` `:226`
  3. `AuthProvider` `:227`
  4. `TooltipProvider` `:228`
  5. `EtlInvalidator` (renders null; sibling of the router) `:229`
  6. `Toaster` (Radix) `:230` and `Sonner` `:231`
  7. `BrowserRouter` `:232`
  8. `FyFilterProvider` (must be inside the router because it uses `useLocation`/`useNavigate`) `:233`
  9. `ChunkErrorBoundary` `:234`
  10. `Suspense fallback={<PageLoader />}` where `PageLoader = () => null` `:165,235`. A lazy route shows a **blank page** while its chunk loads.
  11. `Routes` `:236-591`
- [ ] `EtlInvalidator` sits **above** `BrowserRouter` and `AuthProvider` is above it, so it polls on every screen, including the login page. It skips the network when there is no token (`legacy:src/components/EtlInvalidator.tsx:33-34`).
- [ ] No `next-themes` `ThemeProvider` is mounted anywhere (grep: only `legacy:src/components/ui/sonner.tsx:1,7` imports `next-themes`), so Sonner always gets `theme="system"`.
- [ ] Before render, a module-level side effect runs: it compares `localStorage["ecap_plus_persist_buster"]` with `PERSIST_BUSTER` and, if they differ, clears the auxiliary IDB cache (`clearAllCacheEntries`) and writes the new buster (`legacy:src/App.tsx:157-163`).
- [ ] `index.html` (`legacy:index.html`):
  - `<title>PMP</title>` (`:16`), never changed per page (no `document.title` writes in src). The AI assistant reads `document.title.split("-")[0]` as "current page" (`legacy:src/components/dashboard/AiAssistant.tsx:78`), so it always sees "PMP".
  - Meta description, author and og tags carry hardcoded brand strings (`:17-22`). Favicon and og:image are commented out (`:7,23-27`).
  - `preconnect` + `dns-prefetch` to two hardcoded API origins (the DQA backend and Directus hosts) (`:11-14`). The new app should derive these from env or config, or drop them.
  - Google Fonts "Inter" 400/500/600/700 stylesheet (`:29-31`).
  - `<div id="root">` and module script `/src/main.tsx` (`:35-36`).
- [ ] `vite.config.ts` (`legacy:vite.config.ts`):
  - `envPrefix: ["VITE_", "REACT_"]` (`:7`). `REACT_*` variables are also shipped to the browser. The new app must only expose `VITE_*` (hard rule 5).
  - Dev and preview server on host `::`, port `3040` (`:9-10,25-26`), with the HMR overlay disabled (`:11-13`).
  - Dev proxy `/superset-api` → a localhost port with the prefix stripped (`:14-21`). This is relevant to the analytics module.
  - `allowedHosts` lists two hardcoded production/staging hostnames (`:22,27`). These belong in deploy config.
  - `@` alias → `./src` (`:30-33`).
  - `manualChunks`: react-dom, react, react-router, scheduler and `@tanstack` go to the `react-vendor` chunk (`:40-52`).

## Component `Query client`

- [ ] Defaults (`legacy:src/App.tsx:112-134`): `staleTime: 60_000` (`:126`), `gcTime: 24h` (`:127`), `refetchOnMount: true` (`:128`), `refetchOnWindowFocus: true` (`:129`), `refetchOnReconnect: true` (`:130`), `retry: 1` (`:131`). There are no mutation defaults, no global `QueryCache`/`MutationCache` `onError`, and no `meta` conventions (grep: no `meta: {` on any query).
- [ ] Persister (`legacy:src/App.tsx:140-148`): `createAsyncStoragePersister` over **idb-keyval** (default idb-keyval DB/store, `get`/`set`/`del`; `undefined` is mapped to `null` at `:142`). Storage key `"ecap-plus-pmp-react-query"` (`:146`), `throttleTime: 1000` (`:147`).
- [ ] Persist options (`legacy:src/App.tsx:216-224`): `maxAge: 24h` (`:218`), `buster: PERSIST_BUSTER` (`:219`) where `PERSIST_BUSTER = "v13-2026-06-16-caseworker-list"` (`:152`). `dehydrateOptions.shouldDehydrateQuery = query.state.status === "success" && query.state.data !== undefined` (`:221-222`). **Every** successful query is persisted, including user-private ones: `directus-notifications`, users list, profile and `etl/last-success`. Nothing is excluded.
- [ ] The buster is also mirrored in `localStorage["ecap_plus_persist_buster"]` to clear the aux IDB cache in lock-step (`legacy:src/App.tsx:154-163`).
- [ ] New app: keep stale-while-revalidate with IDB persistence. Exclude queries marked `meta: { persist: false }`, drive invalidation from `meta: { etl: true }` (CLAUDE.md data rules), and take the buster from config/build.
- [ ] **BUG** (security/privacy): `logout()` only clears the token and user (`legacy:src/context/AuthContext.tsx:148-151`). It does not clear the React Query cache, the persisted IDB blob, or the aux IDB cache. The next user on the same browser gets the previous user's cached registers and notifications rendered instantly for up to 24 h (`legacy:src/App.tsx:218`). The new shell must clear the in-memory cache, the persisted cache and the aux cache on logout and on user change.
- [ ] **BUG**: aux cache keys are not user-scoped: `households_by_district:${district||"ALL"}${fyKey}` and similar (`legacy:src/lib/api.ts:306-308,373-375,413,422,502`). An admin's "ALL" list is served to the next user who asks for "ALL" within the TTL, and as a stale fallback on fetch error indefinitely (`legacy:src/lib/api.ts:229-235`).

## Component `Routing & guards`

### Full route table (`legacy:src/App.tsx`)

Every route except the four public ones is wrapped in `<ProtectedRoute>` and **nothing else**. No route has a role or permission check (S2).

| Line | Legacy path | Component (load) | Guard | New route (MIGRATION_PLAN §5) |
|---|---|---|---|---|
| 237 | `/` | `Index` (eager, `:19`) | none | `/login` (redirect `/` → `/dashboard` or `/login`) |
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
| 317-324 | `/vca-services` | `VcaServices` (lazy `:36`) | ProtectedRoute | `/services/:type` |
| 325-332 | `/registers/vca-risk` | `VcaRiskRegister` (lazy `:69`) | ProtectedRoute | `/vcas/risk` |
| 333-340 | `/household-services` | `HouseholdServices` (lazy `:30-32`) | ProtectedRoute | `/services/:type` |
| 341-348 | `/registers/household-risk` | `HouseholdRiskRegister` (lazy `:70-72`) | ProtectedRoute | `/households/risk` |
| 349-356 | `/caregiver-services` | `CaregiverServices` (lazy `:37-39`) | ProtectedRoute | `/services/:type` |
| 357-364 | `/registers/caregiver-risk` | `CaregiverRiskRegister` (lazy `:66-68`) | ProtectedRoute | `/caregivers/risk` |
| 365-372 | `/profile/caseworker-details` | `CaseworkerProfile` (lazy `:74-76`) | ProtectedRoute | `/caseworkers/:caseworkerId` |
| 373-380 | `/services/household-services` | `HouseholdServicesPage` (lazy `:33-35`) | ProtectedRoute | keep (decision 3); orphan, no nav entry |
| 381-388 | `/flags` | `Flags` (lazy `:81`) | ProtectedRoute | `/flags` |
| 389-396 | `/households/archived` | `HouseholdArchivedRegister` (lazy `:82-84`) | ProtectedRoute | `/households/archived` |
| 397-404 | `/vcas/archived` | `VcaArchivedRegister` (lazy `:85-87`) | ProtectedRoute | `/vcas/archived` |
| 405-412 | `/charts` | `Charts` (lazy `:88`) | ProtectedRoute | `/analytics` |
| 413-420 | `/users` | `Users` (lazy `:46`) | ProtectedRoute only | `/users` (`users.manage`) |
| 421-428 | `/training-log` | `TrainingLog` (**eager**, `:21`) | ProtectedRoute | `/training-log` (flag, demo data) |
| 429-436 | `/users/new` | `AddUser` (lazy `:89`) | ProtectedRoute only | `/users/new` |
| 437-444 | `/users/:id/edit` | `EditUser` (lazy `:90`) | ProtectedRoute only | `/users/:id/edit` |
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

- [ ] Every legacy path above needs a legacy redirect in the owning module's manifest. Detail routes (`/profile/*-details`) received their record through `location.state` and cannot be redirected to an ID route without the ID. Redirect them to the parent register, or to a page that explains the link is outdated.
- [ ] `ProtectedRoute` (`legacy:src/components/auth/ProtectedRoute.tsx`):
  - [ ] while `isLoading` → render `null` (blank) (`:8-10`)
  - [ ] no `user` → `<Navigate to="/" replace />` (`:12-14`). The originally requested URL is **not** remembered, so the user lands on `/dashboard` after login (`legacy:src/components/LoginCard.tsx:42`). New app: preserve a `returnTo`.
  - [ ] `user.password_change_required && location.pathname !== "/change-password"` → `<Navigate to="/change-password" replace />` (`:16-18`)
  - [ ] otherwise render children (`:20`)
- [ ] Public routes have no "already logged in" redirect: `Index` renders `LoginCard` unconditionally (`legacy:src/pages/Index.tsx:6-25`). Plan §5 wants `/` → `/dashboard` when signed in.
- [ ] Nav visibility (the only role gating in the app, UX only). Rules quoted for the route-table owner:
  - Sidebar role derivation (`legacy:src/components/dashboard/AppSidebar.tsx:150-160`): `roleName = (typeof user.role === "string" ? user.role : user.role?.name || "").toLowerCase()`; `isAdmin = roleName === "administrator" || user.description === "Administrator" || (!user.description && roleName !== "")`; `isSupport = user.description === "Support User" || roleName.includes("support")`; `isDistrictUser = user.description === "District User"`; `isProvincialUser = user.description === "Provincial User"` (unused).
  - `if (item.url === "/districts" && isDistrictUser) return false` (`:166`)
  - `if (section.label === "Admin" && !isAdmin) return false` (`:169`), which hides `/users`
  - `if (section.label === "Data Pipeline" && !isAdmin && !isSupport) return false` (`:172`). **BUG**: the section label is `"Data pipeline"` with a lowercase p (`:98`), so the rule never matches and every user sees Data Pipeline.
  - Mobile bottom nav has no role rules: Home `/dashboard`, Districts `/districts`, Registers `/households`, Services `/vca-services`, Profile `/profile` (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). District users see Districts there.
  - Global search "Navigation" group has no role rules and includes "User Management" `/users` for everyone (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`).
  - These role checks use the forbidden string-comparison pattern. The new app maps them to `can(permission)` in `core/access` and enforces them on routes in the manifest.
- [ ] Route-level access must be enforced by the shell from manifests (CLAUDE.md). Record as a backend ask that `/users*` and `/data-pipeline` data are not role-restricted server-side (cross-ref AUDIT.md §3.1 item 3 / S2-S3).

### Links in to NotFound

- [ ] `navigate("/hts/view", { state: item.raw ? {...item.raw, type, district} : item })` (`legacy:src/pages/HTSRegister.tsx:1185-1193`). **BUG**: no route matches, so this always lands on NotFound. The hts module should map it to `/hts/:clientId`.
- [ ] Any mistyped or old bookmark URL. Every legacy path must redirect so that nothing old hits the 404.

## Component `Error boundaries` (`ChunkErrorBoundary`, `legacy:src/App.tsx:167-211`)

- [ ] Sits once around `Suspense`/`Routes` (`:234-593`). It is the **only** error boundary in the app (grep: no other `getDerivedStateFromError`/`componentDidCatch`).
- [ ] `getDerivedStateFromError(error)`: if `isChunkLoadError(error)` → `{ hasError: true }`, otherwise returns `null` "so it isn't masked here" (`:178-184`).
- [ ] Fallback UI (`:187-206`): full-screen centred card. Heading "Reload required", body "A new version of the app is available. Please reload to continue.", button "Reload now" → `window.location.reload()`. It never auto-reloads (`:167-171`).
- [ ] `hasError` never resets on navigation. The user must reload.
- [ ] **BUG**: for non-chunk errors the boundary returns `null` state, so the children re-render, throw again and the error escapes to the root. There is no outer boundary, so **any render error in any page unmounts the whole app (white screen)**. The new shell needs a per-route and per-widget boundary (CLAUDE.md UI rules) that shows `<ErrorState>` with retry, plus this chunk-specific variant.

## Component `lazyWithRetry` (`legacy:src/lib/lazyWithRetry.ts`)

- [ ] `isChunkLoadError(error)` is true if the message (`error.message` or `String(error)`) includes any of: `"Failed to fetch dynamically imported module"`, `"Importing a module script failed"`, `"error loading dynamically imported module"`, `"Loading chunk"`, `"ChunkLoadError"`, or both `"module script"` and `"MIME type"` (`:8-19`).
- [ ] `lazyWithRetry(factory)` = `React.lazy(async () => ...)` (`:34-62`):
  - on success → `sessionStorage.removeItem("ecap_chunk_reload_at")` and return the module (`:39-43`)
  - non-chunk error → rethrow (`:45`)
  - chunk error and `Date.now() - Number(sessionStorage["ecap_chunk_reload_at"] || 0) > 10_000` → set the key to now, `window.location.reload()`, return a never-resolving promise so Suspense keeps showing (`:47-55`)
  - chunk error within 10 s of the last reload → rethrow to `ChunkErrorBoundary` (`:57-59`)
- [ ] Constants: `RELOAD_GUARD_KEY = "ecap_chunk_reload_at"` (sessionStorage) (`:24`), `RELOAD_GUARD_MS = 10_000` (`:25`).
- [ ] Every page except `Index`, `Dashboard` and `TrainingLog` is lazy (`legacy:src/App.tsx:17-110`). Plan Phase 3 puts `lazyWithRetry` in `core/lib` with a namespaced storage key.
- [ ] `sessionStorage` access is not wrapped in try/catch, so it throws in storage-blocked contexts. Wrap it in the new version.

## Component `Theme` (`legacy:src/context/ThemeContext.tsx`)

- [ ] Config shape `{ banner, sidebar, header, background, button, card, text, theme }`, all strings, default all `""` (`:3-23`).
- [ ] Initial state = `JSON.parse(localStorage["ecap.ui_theme"])` or default (`:34-37`). **BUG**: no try/catch, so corrupt JSON or blocked storage crashes the whole app at the root provider.
- [ ] On every change: write `localStorage["ecap.ui_theme"]` and apply it (`:39-42`). `applyTheme` sets inline CSS vars on `<html>`, skipping empty values (`:44-78`):
  - `theme` → `--primary`, `--accent`, `--ring` (`:56-66`)
  - `background` → `--background`, `card` → `--card`, `text` → `--foreground`, `sidebar` → `--sidebar-background` (`:69-72`)
  - `banner` → `--banner-color`, `header` → `--header-color`, `button` → `--button-color` (`:75-77`). Defaults for these three are defined in `legacy:src/index.css:62-64`.
- [ ] `updateColor(target, value)` merges one key (`:80-82`). `resetTheme()` restores the defaults and removes the 10 inline props (`:84-93`).
- [ ] The only consumer is the AI assistant: when the model returns a fenced JSON `{"action":"change_color","target":<one of ALLOWED_TARGETS>,"value":...}` it calls `updateColor` (`legacy:src/components/dashboard/AiAssistant.tsx:49-53,85-91`). `resetTheme` is destructured but **never called** (`:49`), so the UI has no way to undo AI colour changes except clearing storage. **QUESTION**: keep AI-driven theming in the assistant module (decision: assistant kept)? If so, values must be validated (raw strings from the model, possibly hex/named, are written into HSL-triplet tokens such as `--primary`, which breaks `hsl(var(--primary))`; see the comment at `:57-62`), and a "Reset colours" action is needed.
- [ ] There is no light/dark mode toggle. The `.dark` palette exists in `legacy:src/index.css:68` but nothing sets the class (no next-themes provider). The new app has dark tokens in `theme.css`. **QUESTION**: expose a toggle?

## Component `Toasts` (two systems mounted)

- [ ] Radix/shadcn toasts: `<Toaster />` from `components/ui/toaster` mounted at `legacy:src/App.tsx:230`. The store is in `legacy:src/hooks/use-toast.ts`: `TOAST_LIMIT = 1` (`:5`), `TOAST_REMOVE_DELAY = 1000000` ms (about 16.7 min before a dismissed toast is removed from memory) (`:6`), module-level `memoryState` and listeners (`:124-133`), `toast()` returns `{ id, dismiss, update }` (`:137-164`). **No feature code imports `useToast`/`toast` from it** (grep: only `components/ui/toaster.tsx:1` and the unused re-export `components/ui/use-toast.ts:1-3`). It is dead in practice.
- [ ] Sonner: `<Sonner />` mounted at `legacy:src/App.tsx:231` via `legacy:src/components/ui/sonner.tsx:6-25`, with `theme` from `next-themes` `useTheme()` defaulting to `"system"` (no provider). Default position and duration (no props). Toast class names use theme tokens (`:14-20`). This is the system every feature uses: 22 files import `toast` from `"sonner"` (e.g. `pages/Users.tsx`, `pages/Flags.tsx`, `pages/DataPipelinePage.tsx`, `components/dashboard/DashboardHeader.tsx`, `hooks/useCalendarNotifications.ts`).
- [ ] New app: one toast system (Sonner) in `core/ui`, mounted once by the shell. Drop the Radix toast store.

## Component `Fiscal-year filter`

### FY maths (`legacy:src/lib/fiscalYear.ts`)
- [ ] FY runs Oct 1 → Sep 30, labelled by the end year ("PEPFAR fiscal year", `:1`). These rules must come from `program.config` (hard rule 4).
- [ ] `getCurrentFy(date = new Date())`: `month >= 9` (Oct-Dec, 0-indexed) → `year + 1`, else `year`. Uses **local** time (`:21-26`).
- [ ] `getFyBounds(fy)` → `{ from: "${fy-1}-10-01", to: "${fy}-09-30" }` inclusive (`:29-32`).
- [ ] `resolveFy(state)` (`:36-54`):
  - `all` → `{ mode:"all", fromDate:null, toDate:null, label:"All time" }` (`:37-39`)
  - `custom` → `from = state.from || "1970-01-01"`, `to = state.to || todayIso()`, label `` `Custom: ${from} → ${to}` `` (`:40-49`)
  - `fy` → `fy = state.fy ?? getCurrentFy()`, bounds, label `` `FY${fy}` `` (`:51-53`)
- [ ] `todayIso()` = `new Date().toISOString().slice(0,10)` (`:34`). **BUG**: UTC date, while `getCurrentFy` uses local time. They differ near midnight in non-UTC zones. Use `date-fns` local formatting through `core/lib/format`.
- [ ] `getFyOptions(max = 3)` → `[current, current-1, current-2]` (`:57-62`).
- [ ] `fyToParams`: all → `{fy:"all"}`; custom → `{fy:"custom", from, to}` (empty strings if missing); fy → `{fy: String(fy ?? current)}` (`:65-69`).
- [ ] `fyFromParams`: no `fy` → `null`; `"all"` → all; `"custom"` → `{mode:"custom", from: params.from || undefined, to: params.to || undefined}`; otherwise `Number(raw)`, and `null` if not finite (`:72-84`). No range or integer validation (`?fy=99999` and `?fy=2025.5` are accepted).

### Context (`legacy:src/context/FyFilterContext.tsx`)
- [ ] localStorage key `"ecap_plus_pmp.fy_filter_state_v2"` (`:12`), JSON of `FyState`.
- [ ] Default `{ mode: "all" }` ("All time", so first-paint numbers match Superset lifetime totals) (`:22-24`).
- [ ] Initial state, read once on mount: URL (`fyFromParams(location.search)`) > localStorage (`loadStored`, try/catch, requires `parsed.mode`) > default (`:33-44,51-56`).
- [ ] `setState(next)`: set state, write localStorage (try/catch), then rewrite the URL: delete `fy`, `from`, `to`, set the non-empty `fyToParams(next)` entries, and `navigate({pathname, search}, { replace: true })`, keeping other query params (`:60-82`).
- [ ] `clearFilter()`: reset to the default, **remove** the localStorage key, strip `fy`/`from`/`to` from the URL (replace). This differs from choosing "All time", which writes `?fy=all` (`:84-100`).
- [ ] URL → state sync: on every `location.search` change, if the URL has `fy`, adopt it (JSON compare to avoid re-render). If the URL has no `fy`, the current state is kept (`:102-112`).
- [ ] Context value `{ state, setState, clearFilter, resolved: resolveFy(state) }` (`:114-117`). Hook `useFyFilter()` (`:122`).
- [ ] Consumer convention (repeated in every page): `fyArg = fy.fromDate && fy.toDate ? { from, to } : undefined`; `fyKey = fy.mode === "all" ? "all" : `${fromDate ?? ""}_${toDate ?? ""}`` (e.g. `legacy:src/pages/Districts.tsx:54-58`, `legacy:src/pages/VcaRegister.tsx:156-157`). API helpers append `?from=&to=` only when both are set (`fyQs`, `legacy:src/lib/api.ts:240-245`, defined at `:241`). New app: a `platform/scope` hook returning `{ from, to, key }` that is always part of the query key.
- [ ] Consumers (grep `useFyFilter`): `MetricsGrid`, `CanonicalKpiStrip`, `services/{ServicesPage,CohortStrip,ServicesTimeSeriesChart,ServicesDistributionChart}`, pages `CaregiverRiskRegister`, `Districts`, `Flags`, `HouseholdArchivedRegister`, `HouseholdRegister`, `HouseholdRiskRegister`, `HouseholdServicesPage`, `HTSRegister`, `HTSRiskRegister`, `MotherIndexRegister`, `Performance`, `PMTCTRegister`, `Referrals`, `VcaArchivedRegister`, `VcaRegister`, `VcaRiskRegister`, `VcaServicesDashboard`.
- [ ] **BUG/QUESTION**: the URL only reflects FY on the page where it was changed. Sidebar links carry no query, so after navigating the state persists (context plus localStorage) but the URL loses `?fy=` and the link is no longer shareable. New app: carry scope params across nav or always write them.
- [ ] **BUG**: the chip is hidden on `HIDDEN_ROUTES` = `/dashboard`, `/districts`, `/calendar`, `/charts`, `/data-pipeline`, `/support`, `/documentation` (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85,253-257`), yet `/dashboard` (`MetricsGrid`, `legacy:src/components/dashboard/MetricsGrid.tsx:127`) and `/districts` (`legacy:src/pages/Districts.tsx:54`) apply the stored FY. Numbers there are silently filtered with no visible control or label. It is also hidden below `md` (`hidden md:block`, `:254`) on every page.

### Header chip (`legacy:src/components/FyFilter.tsx`)
- [ ] Trigger: calendar icon, `resolved.label`, chevron (rotates when open) (`:57-67`).
- [ ] Popover `align="end"`, `sideOffset=8`, `z-[100]`, width 20rem (`:68-72`).
- [ ] When `hasActiveFilter` (`resolved.mode !== "all"` or `window.location.search` matches `/[?&](fy|from|to)=/`) (`:44-45`): row "Active: {label}" plus a "Clear filter" button → `clearFilter()`, reset the custom inputs, close (`:34-40,73-87`).
- [ ] "Quick toggle" section: "Current FY (FY{currentFy})" → `{mode:"fy", fy: currentFy}`; "Previous FY (FY{currentFy-1})" (`:88-110`). A check icon appears on the active item.
- [ ] "All fiscal years" section: `getFyOptions(3)`, each shown as `FY{fy}` plus muted `{fy-1}-10-01 → {fy}-09-30` (`:113-129`). This duplicates the quick toggles for the current and previous FY.
- [ ] "All time" → `{mode:"all"}` (writes `?fy=all`) (`:132-142`).
- [ ] "Custom range" toggles an inline panel (`:145-168`): `DateField` "From", `DateField` "To" with `minDate = customFrom` (dates before From are disabled) (`:157-158`). "Apply custom range" is disabled until both are set (`:159-166`) and applies `{mode:"custom", from: yyyy-MM-dd, to: yyyy-MM-dd}` (`:47-51`).
- [ ] `DateField`: button shows `dd MMM yyyy` or "Pick a date". A nested Popover (`z-[110]`) holds a shadcn `Calendar mode="single"` and closes on pick (`:177-227`).
- [ ] Choosing any preset closes the popover and collapses the custom panel (`:28-32`).
- [ ] Quirk: `showCustom`, `customFrom` and `customTo` are initialised from `state` once (`:20-22`) and are not re-synced when the state changes via URL.
- [ ] Date display formats are hardcoded (`yyyy-MM-dd`, `dd MMM yyyy`). The new app formats through `core/lib/format.ts`.

### FY_FILTER_REVIEW.md checklist (`legacy:FY_FILTER_REVIEW.md`), with the current code's status

§1 Shared primitives
- [ ] `getCurrentFy(date)` returns 2026 for Oct 2025-Sep 2026, 2025 for Oct 2024-Sep 2025 (`:23`). Code matches (`fiscalYear.ts:21-26`).
- [ ] `getFyBounds(fy)` returns `{ from: "${fy-1}-10-01", to: "${fy}-09-30" }` (`:24`). Matches.
- [ ] `resolveFy({mode:"fy", fy})` produces `fromDate`, `toDate`, `label` (`:25`). Matches.
- [ ] `FyState` shape `{ mode: "fy"|"all"|"custom", fy?, from?, to? }` (`:26`). Matches.
- [ ] `fyToParams` ↔ `fyFromParams` round-trip preserves state (`:27`). Holds for well-formed state. A custom state with an empty from/to is dropped from the URL by `if (v)` (`FyFilterContext.tsx:75-77`) and comes back as `undefined`.

§2 Context wiring
- [ ] `<FyFilterProvider>` inside `<BrowserRouter>` (`:32`). Yes (`App.tsx:232-233`).
- [ ] All `<Route>`s inside `<FyFilterProvider>` (`:33`). Yes.
- [ ] Initial state URL first, then localStorage `fy_filter_state_v1`, then default `{ mode: "fy", fy: getCurrentFy() }` (`:36`). **Out of date**: the key is now `ecap_plus_pmp.fy_filter_state_v2` and the default is `{ mode: "all" }` (`FyFilterContext.tsx:12,24`). Port the code behaviour (All time default), not the doc.
- [ ] `setState(next)` writes localStorage and the URL via `navigate(..., { replace: true })` (`:37`). Yes.
- [ ] External URL change syncs via `useEffect` on `location.search` without an infinite re-render (`:38`). Yes (JSON compare).

§3 Header chip
- [ ] Trigger shows `resolved.label` (`:43`). Yes.
- [ ] shadcn `Popover` + `Calendar`, not `<input type="date">` (`:44`). Yes.
- [ ] Popover `z-[100]` (`:45`). Yes.
- [ ] Options: Current FY, Previous FY, 3 most recent FYs, All time, Custom range (`:46`). Yes.
- [ ] Custom range inline two-field picker (`:47`). Yes.
- [ ] "Apply custom range" disabled until both dates are picked (`:48`). Yes.
- [ ] Mounted in `DashboardHeader` right side, wrapped in `<div className="hidden md:block">` (`:51-53`). Yes (`DashboardHeader.tsx:253-257`), and also hidden on `HIDDEN_ROUTES`.
- [ ] `DashboardLayout` `<GlowHeader className="sticky top-0 z-40 sm:relative sm:z-30">` (`:56`). Yes (`legacy:src/components/dashboard/DashboardLayout.tsx:57`).

§4 Backend helper (`backend:lib/fyClause.js`)
- [ ] `parseFyWindow` is windowed only if BOTH `from` and `to` match `^\d{4}-\d{2}-\d{2}$` (`:62`). Yes (`backend:lib/fyClause.js:8-17`).
- [ ] `buildCohortFyClause` returns `{ clause, params: [to, from] }` with `$N::date` placeholders (`:63`). Yes (`:29-59`).
- [ ] Cohort semantics `date_enrolled <= TO AND (de_registration_date IS NULL OR de_registration_date >= FROM)` (`:64-68`). Yes.
- [ ] Handles `YYYY-MM-DD…` and `DD-MM-YYYY` (`:69`). Yes (CASE regex). Other formats become `NULL` and are excluded by `<=`.
- [ ] `opts.enrolledCol` / `opts.deRegCol` (`:70`). Yes (`:30-33`).
- [ ] `opts.startParamIndex` honoured (`:71`). Yes.
- (Service window: `buildServiceFyClause` → `service_date BETWEEN from AND to`, `backend:lib/fyClause.js:67-78`.)

§5 Endpoints accept `?from=&to=` (the ecap-plus list; the curl commands contain local hosts, so they are not reproduced). Per AUDIT.md §1, only 7 endpoints actually apply the window and 8 receive it but ignore it (AUDIT.md §3.2).
- [ ] `GET /child/vcas-count/:district(*)` with from/to (AUDIT.md §3.2)
- [ ] `GET /household/households-count/:district(*)` with from/to (AUDIT.md §3.2)
- [ ] `GET /child/vcas-assessed-register/:district(*)` with from/to (AUDIT.md §3.2)
- [ ] `GET /household/all-households/:district(*)` with from/to (AUDIT.md §3.2)
- [ ] `GET /etl/services/:type/summary` with from/to (AUDIT.md §3.2)
- [ ] For each: HTTP 200, no SQL errors (`:99`)
- [ ] FY2026 count ≤ all-time count (`:100`)
- [ ] FY2024 count differs from FY2026 (`:101`)
- [ ] No "bind message supplies N parameters" errors (`:102`)

§6 Frontend API helpers accept `fy?: FyWindow` and append `?from=&to=`
- [ ] `getTotalVcasCount`, `getTotalHouseholdsCount` (`:109`)
- [ ] `getVcaCountByDistrict`, `getHouseholdCountByDistrict` (`:110`)
- [ ] `getChildrenByDistrict`, `getHouseholdsByDistrict`, `getHtsRegisterByDistrict` (`:111`). Note: the ecap-plus `getHTSRegisterByDistrict` takes `_fy` and ignores it (`legacy:src/lib/api.ts:428-431`).
- [ ] `getChildrenArchivedRegister`, `getHouseholdArchivedRegister` (`:112`)
- [ ] `getFacilityPerformance`, `getCaseworkerPerformance`, `getServicePerformance` (`:113`)
- [ ] `getServiceSummary`, `getServiceTimeseries`, `getServiceDistribution` (`:114`)
- [ ] `getHouseholdsByDistrict` cache key includes the FY fragment, e.g. `households_by_district:ALL:2025-10-01_2026-09-30` (`:117`). Yes (`legacy:src/lib/api.ts:304-308`).
- [ ] `getChildrenByDistrict` same cache-key pattern (`:118`). Yes (`legacy:src/lib/api.ts:372-375`).
- [ ] `getHouseholdArchivedRegister` accepts `{ de_registration_reason, fy }` (`:119`)
- [ ] `getChildrenArchivedRegister` accepts `{ reason, fy }` (`:120`)

§7 Pages consume FY context (import `useFyFilter`, derive `fyArg` + `fyKey`, include `fyKey` in every affected query key, pass `fyArg`) (`:124-128`). Status per the table (`:130-151`), to be re-verified in each module audit:
- [ ] Home `MetricsGrid`
- [ ] Services (`ServicesPage` + KPI strip + Cohort strip + chart components)
- [ ] Performance
- [ ] Flags (client-side filter on `date_created`)
- [ ] VCA Register
- [ ] Household Register
- [ ] VCA Archived Register
- [ ] Household Archived Register
- [ ] HTS Register
- [ ] HTS Risk Register
- [ ] Household Risk Register
- [ ] VCA Risk Register
- [ ] Caregiver Risk Register
- [ ] VCA Services Dashboard
- [ ] Household Services Page
- [ ] Districts (aggregate)
- [ ] Also using FY in code but not in the doc table: `MotherIndexRegister`, `PMTCTRegister` (marked n/a for ecap-plus in the doc), `Referrals`, `CanonicalKpiStrip`
- [ ] Exempt by design: profile pages (single entity) and admin/static pages (`:150-151,226-235`)
- [ ] For each "verify" cell: grep `useFyFilter`, pass `fyArg` to `getXByDistrict` helpers, record the scope decision (`:154-156`)

§8 URL + persistence round-trip
- [ ] Default chip = current FY (`:161`). **Out of date**: the default is now "All time".
- [ ] Pick FY2024 → URL `?fy=2024`, numbers refresh (`:162`)
- [ ] Reload with no URL change → chip still FY2024 (localStorage wins) (`:163`)
- [ ] URL `?fy=all` → chip "All time" (`:164`)
- [ ] URL `?fy=custom&from=2024-01-01&to=2024-12-31` → chip "Custom: 2024-01-01 → 2024-12-31" and refetch (`:165`)
- [ ] Independent state between apps (different localStorage key prefix) (`:166`)

§9 Cohort math smoke test
- [ ] All-time VCA count ≥ FY2026 count for a known facility (`:171`)
- [ ] FY2024 count ≠ FY2026 count (`:172`)
- [ ] FY2023 zero or near zero (`:173`)
- [ ] Cohort metrics (`enrolled`/`active`/`clhiv`/`hei`/`cwlhiv`) narrow to the FY-active cohort. Service-window metrics (`services_this_month`/`services_last_month`) keep calendar-month semantics by design (`:176-177`). **QUESTION**: surface this in UI copy?

§10 Edge cases
- [ ] `?fy=99999` → falls back to default (`:182`). **Code does not**: it resolves to "FY99999" with bounds `99998-10-01 → 99999-09-30` (`fiscalYear.ts:81-83`). The new app should validate the range.
- [ ] `?fy=custom` with no `from`/`to` → falls back to default (`:183`). **Code does not**: it resolves to "Custom: 1970-01-01 → <today UTC>" (`fiscalYear.ts:41-42`).
- [ ] Reversed range `?fy=custom&from=2026-09-30&to=2024-01-01` → rejected or zero rows, no crash (`:184`). The UI prevents it (`minDate`) but the URL path accepts it unvalidated.
- [ ] Backend without `from`/`to` → all-time (`:185`). Yes (`fyQs` sends nothing when either is missing, `legacy:src/lib/api.ts:241-242`).
- [ ] Backend with only `from` or only `to` → `hasWindow=false` (`:186`). Yes (`backend:lib/fyClause.js:16`).

§11 Visual / accessibility
- [ ] Chip dropdown keyboard-navigable (Tab + Enter) (`:190`)
- [ ] Calendar opens with a focus trap (`:191`)
- [ ] Dropdown `z-[100]` clears the WelcomeBanner stacking context (`:192`)
- [ ] Chip hidden below `md` (`:193`). **QUESTION**: the "other selectors" on mobile do not include FY. Mobile users cannot change or see the FY. The new app should expose it on mobile.

## Component `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts`)

Used only by `HTSRegister` (`:53`), `PMTCTRegister` (`:58`), `MotherIndexRegister` (`:15`) and `Referrals` (`:52`). Other pages derive scope themselves (e.g. `GlobalSearch` uses `user?.location ?? DEFAULT_DISTRICT`, `legacy:src/components/dashboard/GlobalSearch.tsx:52`; `DashboardHeader` uses `user?.location ?? ""`, `legacy:src/components/dashboard/DashboardHeader.tsx:90`).

- [ ] `description = (user?.description || "").toLowerCase()` (`:7`)
- [ ] `isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support"` (`:8`). It hardcodes a branded support role string.
- [ ] `isProvinceUser = description.includes("provincial") || description.includes("province")` (`:9`)
- [ ] `isDistrictUser = description.includes("district") || (!!user?.location && user.location !== "All" && !isAdmin && !isProvinceUser)` (`:10`)
- [ ] `province = user?.title && user.title !== "All" ? user.title : user?.province` (`:11`). The province name is stored in Directus `title`.
- [ ] `district = user?.location && user.location !== "All" ? user.location : (user?.district || DEFAULT_DISTRICT || "")` (`:12`). `DEFAULT_DISTRICT = import.meta.env.VITE_DEFAULT_DISTRICT` (`legacy:src/lib/api.ts:7`).
- [ ] `availableDistricts`, first match wins (`:13-16`):
  - default `ALL_DISTRICTS` (no "All Districts" entry) (`:13`)
  - `isProvinceUser && province` → `["All Districts", ...(DISTRICTS_BY_PROVINCE[province] || [])]` (`:14`)
  - else `isDistrictUser && district` → `[district]` (`:15`)
  - else `isAdmin` → `["All Districts", ...ALL_DISTRICTS]` (`:16`)
- [ ] Returns `{ district, province, isAdmin, isProvinceUser, isDistrictUser, isRestrictedToDistrict: isDistrictUser, availableDistricts }` (`:17`).
- [ ] Geography comes from `legacy:src/constants/districts.ts:1-8`: `PROVINCES = ["Central Province", "Southern Province"]`; `"Central Province": ["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"]`; `"Southern Province": ["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"]`; `ALL_DISTRICTS` = flattened. It must move to `program.config` (geography), and AUDIT.md §3.1 item 10 has the backend copy.
- [ ] **BUG**: substring matching overlaps. A description like "Provincial Administrator" is both `isAdmin` and `isProvinceUser`, and the province branch wins, so that admin is restricted to one province. "District Administrator" → `isAdmin` and `isDistrictUser` (true via `includes("district")`), so the district branch wins. `isRestrictedToDistrict` is true for any description containing "district", even for admins.
- [ ] **BUG**: inconsistent with the sidebar's role derivation (exact-match `"Administrator"`, `"District User"`, `"Support User"`, plus `role.name`; `legacy:src/components/dashboard/AppSidebar.tsx:150-160`). The same user can be "admin" in one place and not in another. The new `core/access` must derive role, province and district **once**, from Directus fields, and backend scope must match (AUDIT.md §3.1 item 3 `lib/userScope.js`).
- [ ] **QUESTION**: a user with no role keywords and `location` empty or "All" gets `availableDistricts = ALL_DISTRICTS` without "All Districts" and `district = DEFAULT_DISTRICT`. Confirm the intended default for unrecognised roles (deny by default?).
- [ ] Data-scope rule (frontend, UX only): admins can pick "All Districts" or any district; provincial users pick within their province (or all of it); district users are locked to `location`. The backend trusts a caller-supplied district on 35 endpoints (AUDIT.md §1), so record this as a backend ask.

## Component `EtlInvalidator` (`legacy:src/components/EtlInvalidator.tsx`)

- [ ] Mounted once at the app root (`legacy:src/App.tsx:229`) and renders `null` (`:87`).
- [ ] `GET /etl/last-success` (AUDIT.md §3.2). It uses raw `fetch` with `Content-Type: application/json` and `Authorization: Bearer <token>` (token from `getStoredToken()`, localStorage `ecap.access_token`, `legacy:src/lib/auth.ts:1,9-22`), not a shared client (`:31-47`). It returns `data?.last_success_at ?? null`. No token, `!response.ok`, or any exception → `null` (`:33-34,41,44-45`). The bearer header is an uncommitted working-tree change (`git diff --stat`: 7 insertions).
- [ ] Query: key `["etl", "last-success"]`, `refetchInterval: 30_000` (`POLL_INTERVAL_MS`, `:28`), `refetchIntervalInBackground: false` (pauses in hidden tabs), `staleTime: 0`, `gcTime: 60_000`, `retry: false` (`:53-61`). It also refetches on focus and reconnect (global defaults).
- [ ] Reaction (`:63-85`): ignore `null`. The first non-null value sets the baseline in a ref (no invalidation). When `data > previous` (**string** comparison of ISO timestamps) it does three things: `clearAllCacheEntries()` on the aux IDB cache, then `queryClient.invalidateQueries({ predicate: q => q.queryKey[0] !== "etl" })` (all non-`etl` queries become stale, and active ones refetch in the background), then `console.info("[ETL] Mage run completed at", data, "— refreshing caches.")`. Backwards or unchanged values are ignored.
- [ ] **QUESTION**: the predicate excludes every query whose key starts with `"etl"`, which also excludes data queries `["etl","ward-list"]` (`AddUser.tsx:239`, `EditUser.tsx:132`), `["etl","pipelines"]`, `["etl","runs"]` and `["etl","tablet-sync"]` (`DataPipelinePage.tsx:185-197`). The new design uses `meta: { etl: true }` instead (CLAUDE.md), so invalidate only ETL-backed queries rather than everything.
- [ ] **QUESTION**: the baseline is in-memory, so after a reload or new tab the first poll only sets the baseline. An ETL run that finished while the tab was closed does not invalidate the 24 h persisted cache. Freshness then relies on `staleTime: 60s` plus refetch-on-mount. The new freshness service could persist the last-seen timestamp alongside the cache.
- [ ] **QUESTION**: the string `>` comparison assumes an identical ISO format and offset. Compare parsed dates in the new version.
- [ ] The endpoint covers all pipelines, so any successful run invalidates everything (AUDIT.md §3.2 `/etl/last-success` issues).

## Component `indexedDbCache` (`legacy:src/lib/indexedDbCache.ts`)

- [ ] Raw IndexedDB DB `"ecap_plus_cache_db"`, store `"api_cache"`, version `1`, out-of-line keys. The store is created in `onupgradeneeded` (`:6-8,14-33`).
- [ ] Envelope `{ value, updatedAt: Date.now() }` (`:1-4,69-72`). `getCacheEntry` returns `null` unless `updatedAt` is a number and `value` is present (`:42-60`). Errors are logged with `console.warn("[IndexedDB] ...")` and swallowed (`:56-58,76-78,89-91`). It opens and closes the DB on every call.
- [ ] `clearAllCacheEntries()` clears the store (`:81-92`). Callers: the buster change (`legacy:src/App.tsx:160`), `EtlInvalidator` (`:77`), and `clearApiCache()` (`legacy:src/lib/api.ts:247-251`), which is called by the refresh buttons in `HTSRegister` (`:149`), `PMTCTRegister` (`:204`) and `MotherIndexRegister` (`:154`).
- [ ] Used by `getListFromApiWithCache(cacheKey, path, ttlMs)` (`legacy:src/lib/api.ts:212-238`): return the cached value if `now - updatedAt <= ttl`, else fetch, store (fire-and-forget) and return. **On fetch error, return the stale cached value of any age** (`:229-235`).
  - `households_by_district:{district||ALL}{:from_to}` → `GET /household/all-households/:district(*)` TTL `LIST_CACHE_TTL_MS = 60s` (`api.ts:14,301-311`) (AUDIT.md §3.2)
  - `children_by_district:{district||ALL}{:from_to}` → `GET /child/vcas-assessed-register/:district(*)` TTL 60 s (`api.ts:368-379`) (AUDIT.md §3.2)
  - `caregiver_services_by_district:{district||ALL}` → `GET /household/caregiver-services-by-district/:district(*)` TTL `SERVICES_CACHE_TTL_MS = 5 min` (`api.ts:8,410-417`) (AUDIT.md §3.2)
  - `household_services_by_district:{district||ALL}` → `GET /household/household-services-by-district/:district(*)` TTL 5 min (`api.ts:419-426`) (AUDIT.md §3.2)
  - `vca_services_by_district:{district||ALL}` → `GET /child/vca-services-by-district/:district(*)` TTL 5 min (`api.ts:499-506`) (AUDIT.md §3.2)
- [ ] **QUESTION**: this second cache layer duplicates React Query persistence and causes the "stale empty list survives a buster bump" problem noted at `legacy:src/App.tsx:154-156`. The new app should drop it and rely on one persisted query cache, unless offline fallback-on-error is a wanted feature.

## Component `useIsMobile` (`legacy:src/hooks/use-mobile.tsx`)

- [ ] `MOBILE_BREAKPOINT = 768` (`:3`). It listens to `matchMedia("(max-width: 767px)")` change events and reads `window.innerWidth < 768`, starting as `undefined` and coerced to `false` (`:5-19`). The only consumer is the shadcn sidebar (`legacy:src/components/ui/sidebar.tsx:51`), which decides between the off-canvas sheet and the fixed sidebar.
- [ ] Note the mismatch: the mobile bottom nav uses `sm:hidden` (640 px, `legacy:src/components/dashboard/MobileBottomNav.tsx:23`) and the FY chip uses `md` (768 px). Pick one breakpoint set in the new app.

## Route `*` → shell 404

### Purpose
Catch-all for unknown URLs (`legacy:src/App.tsx:589-590`).

### Access
- [ ] Route guard: none. It is not wrapped in `ProtectedRoute` (`legacy:src/App.tsx:590`), so anonymous users see the 404 too.
- [ ] Sidebar / mobile nav / global search: no entry.
- [ ] In-page role checks: none.
- [ ] Data scope: n/a.

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
- [ ] In: any unmatched path. Known code path: `/hts/view` from `legacy:src/pages/HTSRegister.tsx:1185` (dead route, `location.state` = HTS record plus `type`, `district`).
- [ ] Out: a plain `<a href="/">Return to Home</a>` (`legacy:src/pages/NotFound.tsx:16-18`), which causes a **full page reload** (not router navigation). `/` is the login card even for signed-in users (see Routing). New: router link to `/dashboard` when signed in, `/login` otherwise.

### Loading / empty / error
- [ ] Rendered full-screen **outside** `DashboardLayout` (no sidebar/header), `bg-muted`, centred: "404" heading, "Oops! Page not found", link "Return to Home" (`legacy:src/pages/NotFound.tsx:12-20`).
- [ ] Side effect: `console.error("404 Error: User attempted to access non-existent route:", location.pathname)` on every path change (`:7-9`).
- [ ] Lazy-loaded (`legacy:src/App.tsx:95`), so it shows a blank `PageLoader` until its chunk arrives.

### Bugs and quirks
- [ ] **QUESTION**: render the 404 inside the app layout for signed-in users so navigation stays available?
- [ ] **BUG**: "Return to Home" does a hard reload to the login page, which then does not redirect signed-in users.

## Component `EmptyState` (`legacy:src/components/EmptyState.tsx`)

- [ ] Props `{ icon?: ReactNode, title: string, description?: string, action?: { label, onClick }, className? }` (`:6-15`).
- [ ] Layout: centred column `py-16 px-4`. A 64 px round emerald-tinted circle holds `icon` or the default `InboxIcon` (h-7) (`:24-30`). Title is `text-sm font-bold tracking-widest` (`:31-33`). Optional description is `text-xs`, max-w-sm (`:34-36`). Optional outline `sm` rounded-full button (`:37-46`).
- [ ] Consumers: `CaregiverServiceProfile:24`, `HTSProfile:22`, `HouseholdServiceProfile:18`, `CaseworkerProfile:39`, `VcaServiceProfile:19`, `Districts:42`, `HouseholdProfile:57`, `VcaProfile:62`. Other pages roll their own empty text.
- [ ] New app: `platform/states` `<EmptyState>` with the same API. Colours come from theme tokens (no hardcoded emerald/slate).

## Component `ConfirmDialog` (`legacy:src/components/dashboard/ConfirmDialog.tsx`)

- [ ] Props `{ isOpen, onClose, onConfirm, title, description, confirmText = "Confirm", cancelText = "Cancel", variant: "default" | "destructive" = "default" }` (`:13-32`).
- [ ] shadcn `AlertDialog open={isOpen} onOpenChange={onClose}` (`:35`). Header has the title and description (`:37-40`). Footer: Cancel → `onClose` (`:42`); Action → `onConfirm`, with red styling when `variant === "destructive"` (`:43-48`).
- [ ] Clicking Action calls `onConfirm`, then Radix closes the dialog, which fires `onOpenChange(false)` → `onClose`. Callers must tolerate `onClose` after confirm. There is no pending/loading state: the dialog closes immediately, even if the async confirm action later fails.
- [ ] Consumers: `legacy:src/pages/Users.tsx:34`, `legacy:src/pages/EditUser.tsx:28`.
- [ ] New app: `core/ui` confirm dialog with a destructive variant using theme tokens (not `bg-red-600`), plus an optional pending state.

## Other behaviour

- [ ] Storage keys owned by this part:
  - localStorage `ecap.ui_theme` (`legacy:src/context/ThemeContext.tsx:35,40`)
  - localStorage `ecap_plus_pmp.fy_filter_state_v2` (`legacy:src/context/FyFilterContext.tsx:12,64,90`)
  - localStorage `ecap_plus_persist_buster` (`legacy:src/App.tsx:158,161`)
  - sessionStorage `ecap_chunk_reload_at` (`legacy:src/lib/lazyWithRetry.ts:24,42,48,51`)
  - IndexedDB (idb-keyval default DB) key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`)
  - IndexedDB `ecap_plus_cache_db` / store `api_cache`, keys `households_by_district:*`, `children_by_district:*`, `caregiver_services_by_district:*`, `household_services_by_district:*`, `vca_services_by_district:*` (`legacy:src/lib/indexedDbCache.ts:6-8`, `legacy:src/lib/api.ts:307,374,413,422,502`)
  - read only: localStorage `ecap.access_token` (`legacy:src/lib/auth.ts:1`, read by `EtlInvalidator`)
  - seen in nav (layout part): sessionStorage `ecap_sidebar_scroll` (`legacy:src/components/dashboard/AppSidebar.tsx:126,130,138`)
  - New app: namespaced storage helper in `core/lib` (Phase 3), with a prefix from config rather than a brand string.
- [ ] Timers:
  - `EtlInvalidator` poll every 30 s, paused in background tabs (`legacy:src/components/EtlInvalidator.tsx:28,56-57`)
  - persister write throttle 1 s (`legacy:src/App.tsx:147`)
  - Radix toast remove delay 1,000,000 ms (`legacy:src/hooks/use-toast.ts:6,60-66`)
  - chunk-reload guard window 10 s (`legacy:src/lib/lazyWithRetry.ts:25`)
  - aux cache TTLs 60 s / 5 min (`legacy:src/lib/api.ts:8,14`)
  - global `staleTime` 60 s, `gcTime` 24 h, persist `maxAge` 24 h (`legacy:src/App.tsx:126-127,218`)
- [ ] Keyboard: none in this part (Ctrl/Cmd+K is in GlobalSearch, `legacy:src/components/dashboard/GlobalSearch.tsx:54-64`).
- [ ] Browser APIs: IndexedDB, localStorage, sessionStorage, `matchMedia`, `window.location.reload`, `fetch`.
- [ ] Brand / program strings in this part (must move to `@/config`):
  - `legacy:index.html:16` title "PMP"
  - `legacy:index.html:17,21` description "ECAP+ PMP application"
  - `legacy:index.html:18,20` "ECAP+"
  - `legacy:src/App.tsx:146` persister key "ecap-plus-pmp-react-query"
  - `legacy:src/App.tsx:158` "ecap_plus_persist_buster"
  - `legacy:src/lib/indexedDbCache.ts:6` "ecap_plus_cache_db"
  - `legacy:src/context/FyFilterContext.tsx:12` "ecap_plus_pmp.fy_filter_state_v2"
  - `legacy:src/context/ThemeContext.tsx:35` "ecap.ui_theme"
  - `legacy:src/lib/lazyWithRetry.ts:24` "ecap_chunk_reload_at"
  - `legacy:src/hooks/useEffectiveDistrict.ts:8` role string "ecap+ support"
  - `legacy:src/lib/fiscalYear.ts:1,20` "PEPFAR" FY (comments) plus the Oct-Sep rule
  - `legacy:src/components/FyFilter.tsx:125` hardcoded `-10-01`/`-09-30`
  - `legacy:src/constants/districts.ts:1-6` provinces/districts
  - hardcoded API origins in `legacy:index.html:11-14`
  - hardcoded hostnames in `legacy:vite.config.ts:22,27`
  - (sidebar, layout part) `legacy:src/components/dashboard/AppSidebar.tsx:217,220` "PMP" / "Program Operations"
- [ ] Dropped per decision 4 (WebRTC calls, support chat, voice notes): none of their files are in this part. Their Sonner toasts (`components/chat/VoiceRecorder.tsx`, `components/chat/ProfilePictureModal.tsx`) use the shared Sonner mount.

## Open questions for the developer

1. Should logout (and user switch) wipe the persisted React Query cache and the aux IDB cache? Legacy does not, so cached data leaks between users on a shared browser for up to 24 h.
2. Drop the auxiliary IndexedDB cache (`indexedDbCache` + `getListFromApiWithCache`) in favour of one persisted query cache? If offline "serve stale on error" is wanted, implement it once in `core/api`.
3. FY: keep "All time" as the default (code) rather than the current FY (review doc)? Validate `?fy=` (range, integer) and `?fy=custom` without dates (fall back to the default, as the review doc expects)?
4. FY chip visibility: legacy hides it on `/dashboard`, `/districts` and mobile while those pages still apply the stored FY. Show it (or at least a read-only label) wherever a page is FY-scoped?
5. Should scope params (`fy`, `from`, `to`, district) be carried on every in-app navigation so URLs stay shareable?
6. AI-driven theming: keep `change_color` in the assistant? If so, validate values and add a reset. Add a light/dark toggle?
7. Role model: confirm the canonical source of role, province and district (Directus `role.name` vs `description`, `title` = province, `location` = district) and the default for unrecognised users (deny?), so `core/access` derives it once and matches `backend:lib/userScope.js`.
8. EtlInvalidator: invalidate only `meta: { etl: true }` queries, and persist the last-seen ETL timestamp so a reload after an ETL run refreshes the persisted cache?
9. 404 page: render inside the app layout for signed-in users and link to `/dashboard`?
10. `REACT_*` env prefix: confirm nothing in deploy relies on `REACT_*` variables before dropping it.
