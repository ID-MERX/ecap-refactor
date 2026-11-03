# shell — legacy audit (part: layout)

> New module `shell` (app-wide; `src/app/layouts`, `platform/search`, `platform/notifications`) · Legacy routes → new
> routes: none of its own (the layout wraps 41 protected pages; the `*` NotFound route is covered by another shell part) ·
> Plan: MIGRATION_PLAN.md §4 (shell, search §4.x "Global search", notifications), §2.3, §5 (every row: nav targets)

This part covers the authenticated page chrome: `DashboardLayout`, the sidebar, the header (FY filter slot,
notifications centre, user menu), the global search palette, the mobile navigation (hamburger sheet + bottom bar),
`PageIntro`, `NavLink`, `VersionFooter` (auth pages), the shared WebAudio sounds and the calendar-reminder hook.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Page chrome for every protected page except `/change-password`; mounts sidebar, header, mobile nav, AI assistant, calendar reminders |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Desktop sidebar: hardcoded nav sections, role-based hiding, user footer, logout |
| `src/components/dashboard/DashboardHeader.tsx` | 539 | Header: subtitle, global search slot, FY filter slot, support/calendar shortcuts, notifications centre (poll, sound, browser notification), user menu |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Ctrl/Cmd+K command palette: static nav list, first 10 VCAs + households of the user's district, help/FAQ entries |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Fixed bottom bar below `sm` (640 px) with 5 links + "More" |
| `src/components/dashboard/PageIntro.tsx` | 37 | Page title block (eyebrow, title, description, actions). Used by 3 pages only |
| `src/components/NavLink.tsx` | 28 | Compat wrapper over react-router `NavLink` adding `activeClassName` / `pendingClassName` |
| `src/components/VersionFooter.tsx` | 27 | Fixed footer on the 5 auth pages: hardcoded version + render-time date/time |
| `src/lib/sounds.ts` | 51 | Shared WebAudio synth: `playBell` (unused) and `playDrop` (AI assistant) |
| `src/hooks/useCalendarNotifications.ts` | 61 | Calendar reminders (poll 30 s, toast + browser notification) mounted by `DashboardLayout` |
| `src/components/aceternity/GlowHeader.tsx` | 25 | `<header>` wrapper used by `DashboardLayout` (read in full for context) |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Read for scope comparison: **not used** by any file in this part |
| `src/App.tsx` | 602 | Read for route guards (every route under `ProtectedRoute`, no role checks) |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Read for the guard semantics |
| `src/components/ui/sidebar.tsx` | 623 | shadcn sidebar; only lines 15-20, 43-100 read (cookie, keyboard shortcut, widths) |
| `src/lib/directus.ts` | — | Only `getFileUrl` 215-221, `getNotifications` 486-501, `markNotificationRead` 503-512, `clearAllNotifications` 550-568, `getCalendarEvents` 722-732 read |
| `src/lib/api.ts` | — | Only `DEFAULT_DISTRICT` :7, `LIST_CACHE_TTL_MS` :14, `getListFromApiWithCache` 212-238, `getHouseholdsByDistrict` 301-312, `getChildrenByDistrict` 368-379 read |
| `src/data/supportData.tsx` | 110 | Only `faqs` 3-24 and `quickHelpLinks` 26-82 titles read (search "Help & Documentation" group) |

Pages that render `DashboardLayout` (grep `components/dashboard/DashboardLayout`): `ServicesPage` (used by
`/vca-services`, `/household-services`, `/caregiver-services`), `AddUser`, `Calendar`, `CaregiverRiskRegister`,
`CaregiverServiceProfile`, `CaseworkerJourneys`, `CaseworkerProfile`, `Charts`, `Dashboard`, `DataPipelinePage`,
`Districts`, `DocumentationArticle`, `Documentation`, `EditUser`, `FlaggedRecordForm`, `Flags`,
`HouseholdArchivedRegister`, `HouseholdProfile`, `HouseholdRegister`, `HouseholdRiskRegister`,
`HouseholdServiceProfile`, `HouseholdServicesPage`, `HTSProfile`, `HTSRegister`, `HTSRiskRegister`,
`MotherIndexDetails`, `MotherIndexRegister`, `Performance`, `PMTCTProfile`, `PMTCTRegister`, `Profile`, `Referrals`,
`SupportCenter`, `TrainingLog`, `Users`, `VcaArchivedRegister`, `VcaProfile`, `VcaRegister`, `VcaRiskRegister`,
`VcaServiceProfile`, `VcaServicesDashboard` (unrouted; ported per decision 2). Not wrapped: `Index` (`/`),
`ForgotPassword`, `ResetPassword`, `AcceptInvite`, `ChangePassword`, `NotFound` (`legacy:src/App.tsx:237-251,590`).

---

## Component `DashboardLayout` (rendered by every protected page)

### Purpose
Wraps page content with the sidebar, the sticky/glow header, the mobile hamburger sheet, the mobile bottom bar, the
floating AI assistant and the calendar-reminder hook (`legacy:src/components/dashboard/DashboardLayout.tsx:48-108`).

### Access
- [ ] Route guard: every page that uses this layout is wrapped only in `ProtectedRoute` (`legacy:src/App.tsx:252-588`).
      `ProtectedRoute` renders `null` while auth is loading, redirects to `/` when there is no user, and to
      `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`).
      **No role check on any route**, including `/users`, `/users/new`, `/users/:id/edit`, `/data-pipeline`
      (`legacy:src/App.tsx:413-444,525-532`) — S2 in MIGRATION_PLAN.md; the new shell enforces manifest permissions.
- [ ] The layout itself performs no access check; visibility logic lives in `AppSidebar` only (see below).

### Structure (port as `app/layouts/AppLayout`)
- [ ] `SidebarProvider` wraps everything (`DashboardLayout.tsx:51`). `defaultOpen` is the shadcn default `true`
      (`legacy:src/components/ui/sidebar.tsx:50`); the layout passes nothing.
- [ ] `AiAssistant` floating widget mounted on every page (`DashboardLayout.tsx:52`) → `assistant` module overlay
      (decision 5). See AUDIT.md §3.4 (`/agent/chat`).
- [ ] Desktop sidebar `AppSidebar` (`:54`), then `<main>` (`:56`).
- [ ] Header = `GlowHeader` (`:57`): `sticky top-0 z-40` below `sm`, `sm:relative sm:z-30` from `sm` up — i.e. the
      header is **sticky only on phones**. `GlowHeader` is a 64 px (`h-16`) `<header>` with bottom border and a
      background from CSS var `--header-color` (`legacy:src/components/aceternity/GlowHeader.tsx:11-20`), a theme
      token that `ThemeContext` can override (`legacy:src/context/ThemeContext.tsx:76`, theme part).
- [ ] Below `sm` (640 px): a `☰` outline icon button (`data-mobile-menu-trigger`) opens a top `Sheet` (height 80vh,
      scrollable) titled **"Navigation"** listing `mobileMenuItems` as bordered rows; the active item gets inverted
      colours (`DashboardLayout.tsx:58-90`). From `sm` up: shadcn `SidebarTrigger` (`:91-93`).
- [ ] `DashboardHeader` receives `title` and `subtitle` (`:94`) — but see BUG below (`title` is ignored).
- [ ] Content area `flex-1 p-4 pb-24 space-y-6 sm:p-6 sm:pb-6 min-w-0 overflow-x-hidden` (`:97`): extra bottom
      padding on phones so the fixed bottom bar does not cover content.
- [ ] `MobileBottomNav` (`:100-105`); its "More" button opens the hamburger sheet by
      `document.querySelector("[data-mobile-menu-trigger]").click()` (`:101-104`). New app: open the sheet through
      shared state, not a DOM query.
- [ ] `useCalendarNotifications()` runs on every layout mount (`:49`) — see Notifications centre.
- [ ] Sidebar keyboard shortcut Ctrl/Cmd+B toggles the sidebar (`legacy:src/components/ui/sidebar.tsx:20,78-89`).
      Desktop width 16rem, icon-collapsed 3rem, mobile sheet 18rem (`sidebar.tsx:17-19`). Below 768 px
      (`legacy:src/hooks/use-mobile.tsx:3`) the shadcn sidebar renders as an off-canvas sheet; between 640 and 767 px the
      `SidebarTrigger` opens that sheet.

### `mobileMenuItems` (hamburger sheet, `DashboardLayout.tsx:32-46`) — no role filtering
| # | Label | Legacy path | Icon (lucide) | New path |
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

(Service type slugs `vca` / `caregiver` / `household` come from `legacy:src/components/dashboard/services/service-records.ts:8`.)

### Loading / empty / error
- [ ] No loading UI in the layout; `ProtectedRoute` renders `null` during auth load and the router `Suspense`
      fallback is `null` (`legacy:src/App.tsx:165,235`). New app: skeleton shell.
- [ ] No error boundary around the page body or header; only the app-level `ChunkErrorBoundary` (chunk-load errors
      only, `legacy:src/App.tsx:172-211`). New app: per-route and per-widget boundaries (CLAUDE.md).

### Bugs and quirks
- [ ] **BUG** The layout is rendered **inside each page** (41 pages import it), so the whole chrome — sidebar,
      header, AI assistant, notification beep state, calendar reminder state — unmounts and remounts on every route
      change. Consequences: sidebar collapse state resets to expanded on every navigation (the shadcn cookie
      `sidebar:state` is written, `legacy:src/components/ui/sidebar.tsx:15-16,66-68`, but never read; `defaultOpen`
      is always `true`), sidebar scroll had to be patched with a sessionStorage key (see Sidebar), calendar reminders
      re-fire after every navigation (see Notifications), and the AI assistant re-greets (AUDIT.md §3.4). Port intent:
      one persistent layout route (`<Outlet/>`), state survives navigation.
- [ ] **BUG** `title` prop is accepted and forwarded (`DashboardLayout.tsx:27,94`) but `DashboardHeader` destructures
      only `subtitle` (`legacy:src/components/dashboard/DashboardHeader.tsx:81-83`), so `title` is never shown.
      `Calendar` (`title="Event Calendar"`, `legacy:src/pages/Calendar.tsx:469`) and `SupportCenter`
      (`title="Support Center"`, `legacy:src/pages/SupportCenter.tsx:457`) therefore show the default subtitle.
- [ ] **BUG** The hamburger sheet has no role filtering (shows "User Management" to everyone) and is a stale
      hand-maintained copy: it is missing `/registers/hts`, `/registers/pmtct`, `/registers/mother-index`,
      `/caregiver-services`, `/referrals`, `/performance`, `/caseworker-journeys`, `/training-log`, `/data-pipeline`,
      `/support`, `/documentation` compared with the sidebar. It also has no Logout (the header user menu is still
      visible on phones). Port intent: generate the mobile menu from the same permission-filtered nav as the sidebar.
- [ ] **QUESTION** The hamburger glyph `☰` is a text character, not an icon, and the button has no accessible label
      (`DashboardLayout.tsx:61-68`).

---

## Component `AppSidebar`

### Purpose
Collapsible (`collapsible="icon"`) left navigation with logo block, hardcoded sections, role-based hiding,
current-user footer and logout (`legacy:src/components/dashboard/AppSidebar.tsx:116-346`).

### Access — role derivation (`AppSidebar.tsx:147-161`)
Quoted exactly:
```
const roleName = (typeof user.role === "string" ? user.role : user.role?.name || "").toLowerCase();   // :150-152
const isAdmin = roleName === "administrator" || user.description === "Administrator" ||
                (!user.description && roleName !== "");                                              // :153-156
const isSupport = user.description === "Support User" || roleName.includes("support");                // :157-158
const isDistrictUser = user.description === "District User";                                           // :159
const isProvincialUser = user.description === "Provincial User";                                       // :160 (unused)
```
Item filter (`:163-176`):
- `if (item.url === "/districts" && isDistrictUser) return false;` (`:166`)
- `if (section.label === "Admin" && !isAdmin) return false;` (`:169`)
- `if (section.label === "Data Pipeline" && !isAdmin && !isSupport) return false;` (`:172-173`)
- Sections with no remaining items are dropped (`:180`). If `!user`, no sections render (`:148`).

These rules disagree with `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts:8-10`: admin =
`description` contains `"admin"`/`"administrator"` or equals `"ecap+ support"`; district user = description contains
`"district"` **or** has a non-"All" `location` and is not admin/province) — S4 in MIGRATION_PLAN.md. The new shell
must use `can(permission)` only.

- [ ] Map each rule to a permission: Districts hidden for district-level users (`districts.view`), Admin section
      (`users.manage`), Data pipeline (`pipeline.view`; intended: admins + support users).

### Sidebar nav items (this table drives the new nav)

Section order and labels as legacy (`AppSidebar.tsx:45-114`). "Visibility" quotes the effective legacy behaviour.

| Section (label, line) | Label | Legacy path | Icon (lucide) | Legacy visibility (file:line) | New path | Proposed permission |
| --- | --- | --- | --- | --- | --- | --- |
| Overview (`:47`) | Home | `/dashboard` | Home | always (`:49`) | `/dashboard` | — |
| Overview | Calendar | `/calendar` | Calendar | always (`:50`) | `/calendar` | — |
| Overview | Districts | `/districts` | MapPin | hidden when `user.description === "District User"` (`:51`, `:159`, `:166`) | `/districts` | `districts.view` |
| Overview | Program Dashboard | `/charts` | BarChart3 | always (`:52`) | `/analytics` | — |
| Registers (`:56`) | Households | `/households` | Home | always (`:58`) | `/households` | — |
| Registers | VCAs | `/vcas` | Users | always (`:59`) | `/vcas` | — |
| Registers | HTS Register | `/registers/hts` | Users | always (`:60`) | `/hts` | — |
| Registers | PMTCT | `/registers/pmtct` | HeartPulse | always (`:61`) | `/pmtct` | — |
| Registers | Mother Index Register | `/registers/mother-index` | Baby | always (`:62-66`) | `/mother-index` | — |
| Archived (`:70`) | Households | `/households/archived` | Archive | always (`:72`) | `/households/archived` | — |
| Archived | VCAs | `/vcas/archived` | Archive | always (`:73`) | `/vcas/archived` | — |
| Services (`:77`) | Household Services | `/household-services` | Home | always (`:79`) | `/services/household` | — |
| Services | VCA Services | `/vca-services` | ClipboardList | always (`:80`) | `/services/vca` | — |
| Services | Caregiver Services | `/caregiver-services` | HeartPulse | always (`:81-85`) | `/services/caregiver` | — |
| Services | Referrals | `/referrals` | Share2 | always (`:86`) | `/referrals` | — |
| Services | Performance | `/performance` | Gauge | always (`:87`) | `/performance` | — |
| Services | Caseworker Journeys | `/caseworker-journeys` | MapPin | always (`:88-92`) | `/caseworkers/journeys` | — |
| Services | Flags | `/flags` | Flag | always (`:93`) | `/flags` | — |
| Services | Training Log | `/training-log` | ClipboardCheck | always (`:94`) | `/training-log` | feature flag (demo data) |
| Data pipeline (`:98`) | Data Pipeline | `/data-pipeline` | DatabaseZap | **intended** admin or support (`:172-173`); **actual: always** (label mismatch, BUG below) | `/data-pipeline` | `pipeline.view` |
| Admin (`:104`) | Users | `/users` | UserCog | `isAdmin` (`:153-156`, `:169`) | `/users` | `users.manage` |
| Help & support (`:108`) | Support Center | `/support` | CircleHelp | always (`:110`) | `/support` | — |
| Help & support | Documentation | `/documentation` | BookOpen | always (`:111`) | `/docs` | — |

Routes with **no** sidebar, mobile or search entry (reachable only from in-page links or URL): `/registers/hts-risk`,
`/registers/vca-risk`, `/registers/household-risk`, `/registers/caregiver-risk`, `/services/household-services`,
all `/profile/*-details` pages, `/flagged-record-form`, `/users/new`, `/users/:id/edit`, `/documentation/:slug`,
`/change-password` (`legacy:src/App.tsx:292-588`). Grep for inbound links: `/registers/vca-risk` is linked only from
the unrouted `VcaServicesDashboard` (`legacy:src/pages/VcaServicesDashboard.tsx:678-715`); `/registers/household-risk`,
`/registers/caregiver-risk`, `/registers/hts-risk` and `/services/household-services` have **no** inbound link in
`src/` other than `App.tsx`. **QUESTION** Should the risk registers and `/services/household-services` get nav
entries in the new app (decision 3 keeps the latter)?

### Other sidebar behaviour
- [ ] Logo block (`:203-225`): gradient square with `Sparkles` icon; when expanded, text **"PMP"** (`:217`) and
      tagline **"Program Operations"** (`:220`) — hardcoded branding → `site.config` (short name + tagline; logo to be
      provided per decision 1).
- [ ] Section label rendered as small uppercase group label (`:231-233`).
- [ ] Active item = **exact** `pathname === item.url` (`:183`, NavLink `end` `:247`): highlighted background, left
      accent bar, bolder icon, `ChevronRight` when expanded (`:237-279`). Nested routes (e.g. a household profile)
      highlight nothing. **QUESTION** New app: highlight the parent item for nested routes (`/households/:id` →
      Households)?
- [ ] Collapsed (icon) mode shows tooltips with the item title (`:243`).
- [ ] Footer (`:290-343`): avatar (`getFileUrl(user.avatar)` → Directus `GET /assets/:id?access_token=<token>`,
      `legacy:src/lib/directus.ts:215-221`, AUDIT.md §3.3) with fallback initial `user.first_name?.[0] ?? user.email?.[0] ?? "U"`
      (`:306-311`); name `first_name + last_name` or email (`:317-319`); the role line is commented out (`:321-325`).
      Clicking the user block → `/profile` (`:297`) → new `/account`.
- [ ] Logout button (`:330-342`): `logout()` then `navigate("/")` (`:185-188`) → new `/login`. Label "Logout"
      hidden when collapsed.
- [ ] Scroll position persistence: `sessionStorage["ecap_sidebar_scroll"]` (`:126`) written on every scroll event
      (`:128-132`, `:228`), restored via `requestAnimationFrame` on each pathname change (`:135-145`). Only needed
      because the layout remounts; a persistent layout makes it unnecessary. If kept, namespace the key via config.
- [ ] Decorative "aurora" blobs with `animate-pulse` (`:195-201`) — decorative animation; drop or keep subtle per
      UI rules. Hex/rgba colours inline in class names (`:197-198`) → theme tokens.

### Bugs and quirks
- [ ] **BUG** Data-pipeline hiding never matches: the check compares `section.label === "Data Pipeline"` (`:172`) but
      the section label is `"Data pipeline"` (`:98`), so the section shows for every user (S3). Intended: admins and
      support users only.
- [ ] **BUG** `isAdmin` is true for **any user with an empty `description` and any role** (`!user.description && roleName !== ""`, `:156`).
- [ ] **BUG** `isSupport` uses a role-name substring (`roleName.includes("support")`, `:158`) while everything else
      uses `description`.
- [ ] **QUESTION** `isProvincialUser` is computed and never used (`:160`). Should provincial users have any nav
      difference?
- [ ] **BUG** Sidebar hiding is the only protection for `/users` and `/data-pipeline` (S2); the routes are unguarded.
- [ ] Inconsistent avatar initials: sidebar uses first letter of first name/email (`:310`); header uses the initials
      of the first two words of the display name (`legacy:src/components/dashboard/DashboardHeader.tsx:228-233`).
      Port one shared helper.

---

## Component `DashboardHeader`

### Purpose
Right-hand header bar: page subtitle, global search, FY filter, Support and Calendar shortcuts, notifications
centre and user menu (`legacy:src/components/dashboard/DashboardHeader.tsx:235-536`).

### Layout and behaviour
- [ ] Subtitle (`:237-241`): `subtitle` prop, default **"Data quality & program operations"** (`:82`, hardcoded
      program tagline → config); shown only from `sm` up (`hidden sm:flex`). Pages pass e.g. "Home", "Household
      Register", `` `Household: ${id}` `` (see Legacy files grep; full list: `legacy:src/pages/*.tsx` `<DashboardLayout subtitle=…>`).
      `ServicesPage` (`legacy:src/components/dashboard/services/ServicesPage.tsx:530`), `Referrals`
      (`legacy:src/pages/Referrals.tsx:312`) and `TrainingLog` (`legacy:src/pages/TrainingLog.tsx:184`) pass nothing
      and show the default. New app: page title comes from the route manifest (breadcrumb/title).
- [ ] `HIDDEN_ROUTES` (`:35-43`): `["/dashboard", "/districts", "/calendar", "/charts", "/data-pipeline", "/support", "/documentation"]`.
      Exact pathname match (`:85`). On these routes **both** the global search and the FY filter are hidden
      (`:245-249`, `:253-257`). New mapping: `/dashboard`, `/districts`, `/calendar`, `/analytics`, `/data-pipeline/*`,
      `/support`, `/docs`. **QUESTION** `/documentation/:slug` is not matched (exact compare), so search + FY filter
      show on article pages; and `/districts` hides the FY filter even though district counts are FY-scoped
      (AUDIT.md §3.2 `/household/households-count`) — confirm the intended list. Better: a per-route manifest flag
      (`usesFyFilter`), since search should arguably be available everywhere.
- [ ] Global search slot (`:245-249`, `flex-1 max-w-xl`) → see GlobalSearch.
- [ ] FY filter slot: `<FyFilter />` shown only from `md` up (`hidden md:block`, `:254`). Comment: "affects every
      list/count query app-wide" (`:252`). Component and context are covered by the FY/providers shell part. **QUESTION**
      The FY filter is unreachable on phones/tablets (< 768 px); should mobile get it in the menu?
- [ ] Support shortcut: ghost icon button `CircleHelp`, `title="Support center"`, → `/support` (`:260-268`); hidden
      below `sm`.
- [ ] Calendar shortcut: ghost icon button `Calendar`, `title="Event calendar"`, → `/calendar` (`:270-278`); hidden
      below `sm`.
- [ ] Notifications bell (`:281-416`) — see Notifications centre.
- [ ] User menu (`:419-532`):
  - Trigger: avatar (`getFileUrl(user.avatar)`, `:432`) with initials fallback (`:224-233`: display name =
    `[first_name, last_name].filter(Boolean).join(" ") || email || "User"`; initials = first letter of first two words,
    upper-cased) and the display name (hidden below `sm`, `:440-442`).
  - Content: avatar (img or initials, `:465-475`), display name, email (`:479-484`), chip **"My account"** (`:487-490`),
    item **"Profile"** → `/profile` (`:496-510`) → new `/account`, item **"Logout"** → `logout(); navigate("/")`
    (`:515-530`) → new `/login`.
- [ ] `district` for the notification panel caption = `user?.location ?? ""` (`:90`) — raw profile field, not
      `useEffectiveDistrict`. New app: from `platform/scope` label.

### Endpoints
- [ ] Directus `GET /assets/:id?access_token=<token>` for avatars (URL only, `getFileUrl`,
      `legacy:src/lib/directus.ts:215-221`; AUDIT.md §3.3). Token in URL — new app should use an authenticated fetch or
      Directus cookie/asset token per AUDIT.md §3.3.
- [ ] Notifications endpoints: see next section.

---

## Component Notifications centre (inside `DashboardHeader`) + calendar reminders

### Sources
1. **Directus inbox** (`DashboardHeader.tsx:92-103`):
   - [ ] `GET /notifications` (Directus `directus_notifications`, AUDIT.md §3.3) via `getNotifications(user.id)`
         (`legacy:src/lib/directus.ts:486-501`), dynamically imported (`:94-96`). Params as sent:
         `filter[status][_eq]=inbox`, `filter[recipient][_eq]=<user.id>`, `sort=-timestamp`, `limit=100`,
         `fields=id,subject,message,timestamp,collection,sender,recipient,item` (`directus.ts:491-497`). Returns `[]`
         without a user id (`:487-490`); filters `recipient === userId` again client-side (`:500`) and a third time in
         the header (`DashboardHeader.tsx:114`).
   - [ ] React Query key `["directus-notifications", user?.id]`; `staleTime` 25 s, `refetchInterval` **30 s**,
         `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true`, `enabled: !!user?.id` (`:93-103`).
         Persisted to IndexedDB by the app-wide persister (`legacy:src/App.tsx:140-148,214-224`) → new app:
         `meta: { persist: false }` (user-private).
   - [ ] No collection filter, so support-chat messages (`collection` `support_chat*`) also appear in the bell
         (AUDIT.md §3.3). Chat is dropped per decision 4 → new app should exclude `support_chat` /
         `support_chat_outbox` from the bell (**QUESTION** confirm).
2. **Calendar reminders** (`legacy:src/hooks/useCalendarNotifications.ts`, mounted by `DashboardLayout.tsx:49`):
   - [ ] Directus `GET /items/calendar_events` via `getCalendarEvents(user.id)` (`legacy:src/lib/directus.ts:722-732`;
         AUDIT.md §3.3): `filter[user_id][_eq]=<user.id>`,
         `fields=id,title,description,start_time,end_time,category,user_id,status`, `sort=start_time`, **no limit**
         (Directus default page size).
   - [ ] Query key `["calendar-events", user?.id]` — shared with the Calendar page cache
         (`useCalendarNotifications.ts:13`); `enabled: !!user?.id`; `refetchInterval` **30 s** (`:16`); app defaults
         otherwise (staleTime 60 s, `legacy:src/App.tsx:126`). Persisted to IDB (user-private → `persist: false`).
   - [ ] Rule (`:28-60`): for each event, `diff = differenceInMinutes(parseISO(start_time), now)`; if
         `-2 <= diff <= 15` and key `` `${id}-${start_time}` `` not yet notified (in-memory `Set`, `:10,36-38`):
     - browser `Notification` (only if permission already `granted`, **not** gated on tab visibility): title
       **"Upcoming Event"** or **"Event Started"** (past = `diff < 0`), body = message, icon `/favicon.ico` (`:46-51`);
     - sonner `toast.info` titled `` `Upcoming: ${title}` `` / `` `Started: ${title}` `` with description = message,
       duration 10 000 ms (`:54-57`);
     - message: `` `${title} starts in ${diff} minutes!` `` or `` `${title} has just started!` `` (`:41-43`).
   - New app (plan §4 notifications): calendar module contributes reminder notifications to the single
     NotificationCenter instead of its own poller.

### Display (`DashboardHeader.tsx:112-134`, `:281-416`)
- [ ] Normalised item: `id`; `title` ← `subject`; `description` ← `message`; `date` ← `new Date(timestamp)`; icon
      `DatabaseZap` if `collection === "weekly_extracts"`, else `Bell` (`:116-126`).
- [ ] Deep links (`:127-131`): `weekly_extracts` → `/data-pipeline`; `collection` starting with `"support"` **and**
      `sender` set → `` `/support?userId=${sender}` ``; everything else (incl. flag notifications, collection
      `flagged_forms_ecapplus_pmp`) → no link (AUDIT.md §3.3). Clicking an item navigates if it has a link (`:376-378`)
      and does **not** mark it read. New app: modules declare `notificationTypes` (plan §4) — flags should deep-link
      to the flagged record (**QUESTION**: `item` holds the flag/record id?). `/support?userId=` targets the chat
      (dropped per decision 4) — **QUESTION** what should support notifications link to now?
- [ ] Unread count = number of inbox items (max 100), not a separate read flag (`:136`). Bell badge with count and
      `animate-ping` halo when `> 0` (`:289-299`).
- [ ] Panel (`w-80`, `:302-305`): header **"Notifications"** + count pill (`:318-325`); caption
      `` `Tasks and alerts for ${district || "your area"}` `` (`:327-329`); sound toggle (Bell/BellOff icon,
      title **"Mute notification sound"** / **"Enable notification sound"**, `:332-347`); **"Clear all"** button only when
      count `> 0` (`:348-355`).
- [ ] List in a 288 px (`h-72`) scroll area (`:358`); each row: icon tile, bold title, description clamped to 2
      lines, relative time `formatDistanceToNow(date, { addSuffix: true })` (`:391`), and an `X` **"Dismiss"** button
      (`:394-400`).
- [ ] Empty state: **"All caught up"** / **"No recent notifications."** (`:359-370`) → `<EmptyState>`.
- [ ] Footer button **"View all activity"** → `/support` (`:405-414`). **QUESTION** There is no activity page;
      keep, retarget or drop?

### Read / unread mutations
- [ ] Dismiss one: `PATCH /notifications/:id` body `{status:"archived"}` (`markNotificationRead`,
      `legacy:src/lib/directus.ts:503-512`; AUDIT.md §3.3), then invalidate `["directus-notifications"]`
      (`DashboardHeader.tsx:194-204`). Error → `toast.error("Couldn't dismiss notification")` (`:202`). No optimistic
      update.
- [ ] Clear all: `PATCH /notifications?filter[recipient][_eq]=<id>&filter[status][_eq]=inbox` body
      `{status:"archived"}` (`clearAllNotifications`, `legacy:src/lib/directus.ts:550-561`; AUDIT.md §3.3), then
      invalidate; success toast `` `Cleared ${n} notification${n === 1 ? "" : "s"}` `` or **"Inbox already clear"**
      when `n` is 0; error toast **"Couldn't clear notifications"** (`DashboardHeader.tsx:206-222`).
      **BUG** (AUDIT.md §3.5 e) the batch body shape is probably rejected by Directus (needs `{query,data}` or
      `{keys,data}`). Port intent: archive all inbox items for the current user (e.g. `PATCH /notifications` with
      `{keys:[…ids], data:{status:"archived"}}`).

### Sound and browser notifications
- [ ] Sound preference: `localStorage["ecapplus.notifications.sound"]`, values `"on"` / `"off"`, default on
      (anything but `"off"`) (`:34`, `:106-109`, `:180-192`; write wrapped in try/catch). New key must be
      namespaced from config (brand string in key).
- [ ] New-item detection (`:138-171`): the first value after mount is taken as baseline (`firstLoadRef`); afterwards,
      when the count **grows**, `delta = new - prev`:
  - if sound on → `playNotificationBeep()` (WebAudio, new `AudioContext` each time: sine tones 880 Hz then 1320 Hz
    0.12 s apart, peak gain 0.18, ~0.1 s each, context closed after 400 ms, failures swallowed — `:47-74`);
  - if `Notification.permission === "granted"` **and** `document.visibilityState !== "visible"` → system
    notification titled **"ECAP+ PMP"** (hardcoded app name, `:157`) with body **"You have a new notification"** or
    `` `You have ${delta} new notifications` ``, icon `/ecap-logo.png` (hardcoded brand asset, `:162`),
    `silent: !soundEnabled` (`:150-168`).
- [ ] Permission request timing: `Notification.requestPermission()` is called **on mount** when permission is
      `"default"` — twice: by `DashboardHeader` (`:173-178`) and by `useCalendarNotifications`
      (`legacy:src/hooks/useCalendarNotifications.ts:19-24`), i.e. on the first protected page load with no user
      gesture. Plan §4: request only when the user switches browser notifications on in the panel.
- [ ] `src/lib/sounds.ts`: shared lazily-created singleton `AudioContext`, resumed if suspended (`:5-12`);
      `beep(freqStart, freqEnd, duration, startAt, type, gain)` with linear attack 10 ms and exponential decay
      (`:14-38`). `playBell` = two triangle tones 1320 Hz (0.18 s, gain 0.07) and 1760 Hz (0.24 s at +0.09 s, gain 0.05)
      (`:40-45`) — **unused** (grep: no caller). `playDrop` = sine sweep 900→220 Hz over 0.28 s, gain 0.08 (`:47-51`),
      used by the AI assistant on each reply and greeting (`legacy:src/components/dashboard/AiAssistant.tsx:106,192`).
      New app: one `platform/notifications` sound helper (bell for notifications, drop for assistant) — the
      header's private `playNotificationBeep` is a duplicate of this file.

### Bugs and quirks
- [ ] **BUG** The comment says the beep plays "only if the tab is hidden / unfocused" (`DashboardHeader.tsx:138-140`)
      but the beep is **not** gated on visibility (`:149`); only the system notification is.
- [ ] **BUG** Calendar reminders re-fire after every navigation: the "already notified" `Set` lives in a ref of a hook
      mounted inside each page's layout (`useCalendarNotifications.ts:10`, `DashboardLayout.tsx:49`), so it is reset
      on each route change; any event inside the −2…+15 min window produces a new toast + system notification per
      navigation. Port intent: notify once per event start (persist notified keys for the session).
- [ ] **BUG** The reminder check runs only when the `events` array reference changes (`useEffect(..., [events])`,
      `useCalendarNotifications.ts:27-60`). React Query's structural sharing keeps the same reference when a 30 s
      poll returns identical data, so an unchanged event entering the 15-minute window is **not** announced until
      the data changes or the page remounts. Port intent: evaluate on a clock tick (e.g. every 30-60 s).
- [ ] **BUG** Reminders ignore `status`: cancelled or completed events still notify (`:31-37`; status field fetched,
      `legacy:src/lib/directus.ts:725`).
- [ ] **BUG** Calendar system notifications fire even when the tab is visible (no `visibilityState` check, `:46`),
      unlike the inbox ones; both a toast and a system notification appear.
- [ ] **QUESTION** Clicking a notification does not mark it read; only "Dismiss" archives. Keep (archive = dismiss)
      or add mark-read-on-open?
- [ ] Partial failure: notification query errors are silent (no error UI; app default `retry: 1`,
      `legacy:src/App.tsx:131`). New app: small inline error with retry inside the panel.

---

## Component `GlobalSearch` (command palette)

### Purpose
Header search button + `CommandDialog` (cmdk ^1.1.1, `legacy:package.json:55`) with static navigation, a sample of
VCAs and households from the user's district, and help/FAQ entries (`legacy:src/components/dashboard/GlobalSearch.tsx:48-212`).

### Access / scope
- [ ] No role filtering on any entry: "User Management" is listed for every user, "Districts" for district users
      (`:33-46`, `:107-120`).
- [ ] District = `user?.location ?? DEFAULT_DISTRICT` (`:52`) — **not** `useEffectiveDistrict`. `DEFAULT_DISTRICT`
      = `import.meta.env.VITE_DEFAULT_DISTRICT` (`legacy:src/lib/api.ts:7`). A national user with `location = "All"`
      sends `All` → the backend returns the national register (AUDIT.md §3.2 district convention). A user with
      `location = ""` gets **no record results** (`?? ` keeps `""`, `enabled` false).
      New app: scope from `platform/scope`, part of the query key.

### Trigger and keyboard
- [ ] Button (`:93-100`): search icon + **"Search households, VCAs..."** (≥ `lg`) / **"Search..."** (below `lg`).
- [ ] Ctrl/Cmd+K toggles the dialog (`:54-64`). The listener exists only while `GlobalSearch` is mounted, i.e. not on
      `HIDDEN_ROUTES` pages (`DashboardHeader.tsx:245-249`). New app: palette shortcut available on every page.
- [ ] Input placeholder **"Type a name, ID or page..."** (`:103`); empty text **"No results found."** (`:105`);
      list max height 450 px (`:104`).
- [ ] Selecting any item closes the dialog then runs the action (`runCommand`, `:78-81`).

### Endpoints
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2) via `getChildrenByDistrict(district)`
      (`legacy:src/lib/api.ts:368-379`), **no FY** sent (cohort window not applied). Auxiliary IDB cache key
      `children_by_district:<district || "ALL">`, TTL 60 s (`legacy:src/lib/api.ts:14,212-238`). React Query key
      `["vcas", "search", district]`, `enabled: open && Boolean(district)` (`:66-70`); app defaults (staleTime 60 s,
      gcTime 24 h, IDB-persisted).
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2) via `getHouseholdsByDistrict(district)`
      (`legacy:src/lib/api.ts:301-312`), no FY. Aux cache key `households_by_district:<district || "ALL">`. Query key
      `["households", "search", district]`, same `enabled` (`:72-76`).
- [ ] Both download the **entire** district register (up to ~260,000 rows nationally, decision 8) to show 10 rows.
      Plan §4 search: record providers reuse the register's `queryOptions` cache entry (same key as the register page,
      incl. FY) and index with MiniSearch; target backend `GET /search` (Backend ask).

### Fields used
| Field | Raw keys tried (in order) | Where shown | Formatting |
| --- | --- | --- | --- |
| VCA id | `vca_id`, `vcaid`, `child_id`, `unique_id`, `uid` (`pickValue`, `:83-89,127`) | subtitle `VCA ID: {id}`; nav state `{ id }`; React key `vca-{id}` | string; empty → `""` |
| VCA name | `firstname` \|\| `name`, then `lastname` (`:128`) | bold title | `` `${first} ${last}`.trim() `` |
| Household id | `household_id`, `householdId`, `hh_id`, `unique_id`, `id` (`:153`) | subtitle `HH ID: {id}`; nav state `{ id }`; React key `hh-{id}` | string |
| Household name | `caregiver_name` \|\| `name` \|\| `"Unknown Caregiver"` (`:154`) | bold title | string |

(These candidate lists belong in the vcas / households normalisers, not in search UI.)

### Groups (in order)
- [ ] **"Navigation"** (`:107-120`) — static `navigationItems` (`:33-46`), all category "Navigation":

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

  **Sidebar routes missing from search navigation:** `/calendar`, `/registers/hts`, `/registers/pmtct`,
  `/registers/mother-index`, `/household-services`, `/referrals`, `/performance`, `/caseworker-journeys`,
  `/training-log`, `/data-pipeline`, `/support`, `/documentation`. **Search-only entry:** `/profile` ("My Profile").
  Labels also differ from the sidebar ("Dashboard" vs "Home", "Charts" vs "Program Dashboard"). New app: navigation
  provider generated from permitted manifest nav (plan §4) — fixes all of this.
- [ ] **"Recent VCAs (District)"** (`:124-146`): shown when data loaded and non-empty; **first 10 rows** of the
      register (`slice(0, 10)`, `:126`); select → `navigate("/profile/vca-details", { state: { id } })` (`:132`) →
      new `/vcas/:vcaId` (route param, no `location.state`).
- [ ] **"Recent Households (District)"** (`:150-172`): first 10 rows (`:152`); select →
      `navigate("/profile/household-details", { state: { id } })` (`:158`) → new `/households/:householdId`.
- [ ] **"Help & Documentation"** (`:176-207`): each `quickHelpLinks` item (titles "Data Entry Guide", "Troubleshooting
      Sync", "User Permissions"; subtitle `` `Quick Guide • ${time}` `` e.g. "5 min read",
      `legacy:src/data/supportData.tsx:26-82`) and each `faqs` question ("How do I reset my password?", "Where can I
      find the latest weekly extract?", "How do I add a new household?", "Who should I contact for technical issues?";
      subtitle "FAQ", `supportData.tsx:3-24`) → all navigate to `/support` with no anchor (`:180,195`). New app: docs /
      support modules register a search provider that deep-links to the article or FAQ. (The FAQ answers contain a
      hardcoded support email, `legacy:src/data/supportData.tsx:22` — support module / config.)

### Search / filter behaviour
- [ ] Filtering is cmdk's built-in fuzzy filter over each rendered item's text (no `value`/`shouldFilter` set,
      `legacy:src/components/ui/command.tsx:26-35`): case-insensitive, matches name and the "VCA ID:/HH ID:" text. No
      debounce, no minimum length.

### Loading / empty / error
- [ ] No loading indicator while the registers download; record groups simply appear when ready. Errors are silent
      (group not rendered). Empty: cmdk "No results found." New app: per-group skeleton row / error line.

### Bugs and quirks
- [ ] **BUG** (plan §2.3) Only the first 10 VCAs and 10 households are rendered, and cmdk filters only rendered items,
      so typing a name searches those 20 records — most records can never be found.
- [ ] **BUG** Group headings say "Recent" but rows are register order, not recently viewed. Plan §4: show
      locally stored recently viewed records when the query is empty.
- [ ] **BUG** Records are opened via `location.state` (`:132,158`) — detail pages break on reload/share; new routes
      use params.
- [ ] **BUG** Duplicate React keys when an id resolves to `""` (`vca-`, `hh-`) (`:131,157`).
- [ ] **QUESTION** No FY window is sent, so search includes records outside the selected FY while registers don't.
      Should search follow the FY filter (it would if it shares the register cache entry)?

---

## Component `MobileBottomNav`

- [ ] Fixed bottom bar, visible only below `sm` (`sm:hidden`), `z-40`, blurred white background
      (`legacy:src/components/dashboard/MobileBottomNav.tsx:23`).
- [ ] Items (`:5-11`), no role filtering:

  | Label | Legacy path | Icon | New path |
  | --- | --- | --- | --- |
  | Home | `/dashboard` | Home | `/dashboard` |
  | Districts | `/districts` | MapPin | `/districts` (should hide for district users like the sidebar) |
  | Registers | `/households` | Users | `/households` |
  | Services | `/vca-services` | ClipboardList | `/services/vca` |
  | Profile | `/profile` | UserCircle2 | `/account` |

- [ ] Sixth button **"More"** (`•••` glyph) calls `onOpenMenu` (`:37-46`), which clicks the hamburger trigger
      (`DashboardLayout.tsx:100-105`).
- [ ] Active style via `NavLink` exact match (`end`, `activeClassName="text-slate-900"`, `:26-35`). The local
      `isActive` helper is dead code (`:20`).
- [ ] **BUG** "Districts" is shown to district users although the sidebar hides it (`AppSidebar.tsx:166`).
- [ ] **QUESTION** "Registers" goes to households and "Services" to VCA services only; on nested pages (e.g. a VCA
      register) nothing is highlighted. Should these open a section picker or highlight by prefix?

---

## Component `PageIntro`

- [ ] Props: `title` (required), `description?`, `eyebrow?`, `actions?: ReactNode`, `className?`
      (`legacy:src/components/dashboard/PageIntro.tsx:4-10`).
- [ ] Layout: column on phones, row with bottom alignment and space-between from `sm` (`:20`); eyebrow small,
      bold, wide tracking (not upper-cased by CSS) (`:22-26`); `<h2>` title `text-xl`/`sm:text-2xl` (`:27`);
      description muted, max width `2xl` (`:28-30`); actions wrap, right-aligned from `sm` (`:32`).
- [ ] Used by only 3 pages: `FlaggedRecordForm` (`legacy:src/pages/FlaggedRecordForm.tsx:16`),
      `MotherIndexRegister` (`legacy:src/pages/MotherIndexRegister.tsx:6`), `VcaServicesDashboard`
      (`legacy:src/pages/VcaServicesDashboard.tsx:33`). New app: make it the standard page header (title from
      manifest, actions slot), replacing the header subtitle.

## Component `NavLink`

- [ ] `forwardRef` wrapper over react-router `NavLink` that maps `className` + `activeClassName` +
      `pendingClassName` into the function-form `className` (`legacy:src/components/NavLink.tsx:11-23`). Used by
      `AppSidebar`, `MobileBottomNav`, `DashboardLayout` only. Port as a tiny `core/ui` helper or use router `NavLink`
      directly.

## Component `VersionFooter` (auth pages)

- [ ] Fixed bottom footer, translucent white (`legacy:src/components/VersionFooter.tsx:15`): left
      **"Version v2.1.0"** — hardcoded (`:17`); right **"Date: DD-MM-YYYY"** (`toLocaleDateString('en-GB')` with `/`
      replaced by `-`, `:3-7`) and **"Time: HH:mm"** (`toLocaleTimeString('en-GB')`, `:9-12`).
- [ ] Date/time are computed once per render and never tick.
- [ ] Used on `/` (`legacy:src/pages/Index.tsx:44`), `/forgot-password` (`legacy:src/pages/ForgotPassword.tsx:141`),
      `/reset-password` (`legacy:src/pages/ResetPassword.tsx:164`), `/accept-invite`
      (`legacy:src/pages/AcceptInvite.tsx:194`), `/change-password` (`legacy:src/pages/ChangePassword.tsx:216`) → new
      `AuthLayout`. Version should come from the build (`package.json` version via Vite define) and the date format
      from `core/lib/format.ts`. **QUESTION** Is the live date/time worth keeping at all?

---

## Other behaviour

- **Storage keys (this part)**
  - [ ] `localStorage["ecapplus.notifications.sound"]` = `"on"|"off"` (`legacy:src/components/dashboard/DashboardHeader.tsx:34,108,186`).
  - [ ] `sessionStorage["ecap_sidebar_scroll"]` = scrollTop number (`legacy:src/components/dashboard/AppSidebar.tsx:126,130,138`).
  - [ ] Cookie `sidebar:state` = `true|false`, max-age 7 days, written on toggle, never read (`legacy:src/components/ui/sidebar.tsx:15-16,68`).
  - [ ] IndexedDB (via app persister `ecap-plus-pmp-react-query`, `legacy:src/App.tsx:146`): query keys
        `["directus-notifications", userId]`, `["calendar-events", userId]`, `["vcas","search",district]`,
        `["households","search",district]`. IDB aux cache (`legacy:src/lib/api.ts:212-238`):
        `children_by_district:<d>`, `households_by_district:<d>`.
- **Timers / polling (this part)**
  - [ ] Notifications poll 30 s, staleTime 25 s, not in background, refetch on focus (`DashboardHeader.tsx:98-101`).
  - [ ] Calendar reminders poll 30 s (`useCalendarNotifications.ts:16`).
  - [ ] Beep `AudioContext` closed after `setTimeout(400 ms)` (`DashboardHeader.tsx:70`).
  - [ ] `requestAnimationFrame` for sidebar scroll restore (`AppSidebar.tsx:141`).
  - Plan §4: a single notifications poller in `platform/notifications`; calendar contributes a source.
- **Keyboard shortcuts**
  - [ ] Ctrl/Cmd+K: toggle search (`GlobalSearch.tsx:54-64`).
  - [ ] Ctrl/Cmd+B: toggle sidebar (`legacy:src/components/ui/sidebar.tsx:20,78-89`).
- **Browser APIs**
  - [ ] `Notification.requestPermission()` on mount ×2 (`DashboardHeader.tsx:173-178`, `useCalendarNotifications.ts:19-24`).
  - [ ] `new Notification(...)` (`DashboardHeader.tsx:157-164`, `useCalendarNotifications.ts:47-50`).
  - [ ] WebAudio `AudioContext`/`webkitAudioContext` (`DashboardHeader.tsx:47-74`, `legacy:src/lib/sounds.ts:5-12`).
  - [ ] `document.visibilityState` (`DashboardHeader.tsx:154`).
- **Toasts (sonner)**: "Couldn't dismiss notification"; "Cleared N notification(s)" / "Inbox already clear";
  "Couldn't clear notifications" (`DashboardHeader.tsx:202,213-216,220`); calendar `toast.info` "Upcoming: …" /
  "Started: …" 10 s (`useCalendarNotifications.ts:54-57`).
- **Hardcoded brand / program strings (move to `@/config`)**
  - [ ] "PMP" (`legacy:src/components/dashboard/AppSidebar.tsx:217`), "Program Operations" (`:220`).
  - [ ] "Data quality & program operations" (`legacy:src/components/dashboard/DashboardHeader.tsx:82`).
  - [ ] "ECAP+ PMP" system-notification title (`DashboardHeader.tsx:157`); icon path `/ecap-logo.png` (`:162`).
  - [ ] Storage key prefixes "ecapplus." (`DashboardHeader.tsx:34`) and "ecap_" (`AppSidebar.tsx:126`).
  - [ ] "Version v2.1.0" (`legacy:src/components/VersionFooter.tsx:17`).
  - [ ] Calendar notification icon `/favicon.ico` (`legacy:src/hooks/useCalendarNotifications.ts:49`).
  - [ ] Domain terms in UI text: "VCA", "HH ID", "Caregiver", "Recent VCAs (District)", "Recent Households
        (District)", "Search households, VCAs..." (`legacy:src/components/dashboard/GlobalSearch.tsx:98,125,140,151,154,166`)
        and all nav labels — sub-population terms come from `program.config`.
- **Inline colours**: rgba/hex gradients in class names throughout (`AppSidebar.tsx:197-198`,
  `DashboardHeader.tsx:304,308-309,448,452-453`) → theme tokens.
- **Dropped per decision 4**: the `/support?userId=<sender>` notification deep link exists only to open a support
  chat thread (`DashboardHeader.tsx:129-130`); chat messages share the `directus_notifications` collection with the
  bell (AUDIT.md §3.3). Inventory only; do not port chat.

## Open questions for the developer

1. Data pipeline nav: intended for admins + support users only (the legacy check is broken and shows it to all) —
   confirm the permission set (`pipeline.view`).
2. Should the four risk registers (`/households/risk`, `/vcas/risk`, `/caregivers/risk`, `/hts/risk`) and
   `/services/household-services` get sidebar entries? Legacy has none and most have no inbound link at all.
3. Which pages should hide the global search and/or FY filter? Legacy hides both on dashboard, districts, calendar,
   charts, data pipeline, support, documentation (index only).
4. Notification deep links in the new app: flags (to the flagged record?), weekly extracts (`/data-pipeline`, which tab?),
   support items (chat dropped) — and should chat-tagged rows be excluded from the bell?
5. "View all activity" has no destination page — keep, retarget or remove?
6. Should clicking a notification also archive it?
7. Browser notifications: plan says opt-in toggle in the panel. Should calendar reminders also respect a "sound" /
   "browser notification" preference, and should cancelled events be skipped (legacy notifies them)?
8. Mobile: should the FY filter be reachable below 768 px, and should the bottom bar items be configurable per role?
9. Should nested routes highlight their parent nav item (legacy uses exact match only)?
10. Keep the auth-page footer date/time, or show only the build version?
