# calendar — legacy audit

> Legacy routes → new routes: `/calendar` → `/calendar` · Plan: MIGRATION_PLAN.md §5 row "calendar" ("Contributes calendar-reminder notifications")

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/Calendar.tsx` | 886 | The `/calendar` page: month/week/day views, category legend, "Upcoming Soon" list, create/edit dialog, detail/delete dialog |
| `src/hooks/useCalendarNotifications.ts` | 61 | Reminder hook, mounted by `DashboardLayout` on every page: 30 s poll, browser `Notification` + sonner toast |
| `scripts/setup-calendar-collection.mjs` | 213 | One-off Node admin script that creates the Directus `calendar_events` collection, fields and per-role permissions (not shipped in the bundle) |
| `src/lib/directus.ts` (`:711-757`, `:21-57`, `:450-454`) | 869 | `CalendarEvent` type, `getCalendarEvents` / `createCalendarEvent` / `updateCalendarEvent` / `deleteCalendarEvent`, `directusRequest` helper, user-delete scrub of `calendar_events` |
| `src/components/dashboard/CalendarWidget.tsx` | 91 | "Upcoming Schedule" dashboard widget. **Unreferenced** (no import anywhere in `src`); port per decision (unreferenced dashboard widgets are ported) |
| `src/components/dashboard/DashboardLayout.tsx` | 110 | Mounts `useCalendarNotifications()` (`:49`); mobile sheet menu entry (`:34`) |
| `src/components/dashboard/DashboardHeader.tsx` (`:1-100`, `:255-300`) | 539 | Header calendar icon button (`:274-278`); `/calendar` in `HIDDEN_ROUTES` (`:35-43`, `:85`) |
| `src/components/dashboard/WelcomeBanner.tsx` (`:55-85`) | 92 | "Calendar" quick button on the dashboard banner (`:71-76`) |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar entry (`:50`) and visibility filter (`:147-181`) |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | No calendar entry |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | No calendar entry |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Not used by calendar |
| `src/App.tsx` (`:103`, `:112-133`, `:140-148`, `:213-231`, `:541-548`) | 602 | Lazy import, route, QueryClient defaults, IndexedDB persister, `<Sonner />` toaster |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard |

## Route `/calendar` → `/calendar`

### Purpose

A personal event calendar. Each user sees, creates, edits and deletes only their own events, stored in the Directus collection `calendar_events`. Three views (month / week / day), a category legend with counts, and an "Upcoming Soon" list. The same event list drives app-wide reminder toasts and browser notifications (see Other behaviour).

### Access

- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:541-548`). `ProtectedRoute` renders nothing while auth is loading, redirects to `/` when there is no user, and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). Page is lazy-loaded (`legacy:src/App.tsx:103`).
- [ ] Sidebar: "Calendar" in section "Overview", second item after "Home" (`legacy:src/components/dashboard/AppSidebar.tsx:47-53`). No filter matches it: the only conditions are `item.url === "/districts" && isDistrictUser`, `section.label === "Admin" && !isAdmin`, `section.label === "Data Pipeline" && !isAdmin && !isSupport` (`:166-173`), so every signed-in user sees it. Active when `currentPath === "/calendar"` (`:183`).
- [ ] Mobile: no entry in `MobileBottomNav` (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`); reachable through the "More" sheet menu, item "Calendar" (`legacy:src/components/dashboard/DashboardLayout.tsx:34`). The header calendar icon button is `hidden sm:inline-flex`, i.e. desktop only (`legacy:src/components/dashboard/DashboardHeader.tsx:270-278`).
- [ ] Global search: no "Calendar" navigation entry and no event search (`legacy:src/components/dashboard/GlobalSearch.tsx:34-45`).
- [ ] In-page role checks: none. Edit and Delete are shown for every event (all listed events are the user's own by filter) (`legacy:src/pages/Calendar.tsx:853-876`).
- [ ] Data scope: no district/province/FY. `useEffectiveDistrict` is not used. The only scope is `filter[user_id][_eq]=<current user id>` (`legacy:src/lib/directus.ts:722-726`). Server side, the setup script's read/update/delete permissions are `{ user_id: { _eq: "$CURRENT_USER" } }`; create is `{}` (open) (`legacy:scripts/setup-calendar-collection.mjs:146-191`). See AUDIT.md "calendar_events" note and Open questions.
- [ ] Header on this route: `/calendar` is in `HIDDEN_ROUTES`, so the global search and FY filter are hidden here (`legacy:src/components/dashboard/DashboardHeader.tsx:35-43,85`). Page title passed to layout: "Event Calendar" (`legacy:src/pages/Calendar.tsx:469`).

### Endpoints

All Directus REST through `directusRequest` (bearer token from storage, `Content-Type: application/json`, throws `data.errors[0].message ?? "Directus request failed"` on non-2xx) (`legacy:src/lib/directus.ts:21-57`). None go through DQA (AUDIT.md §3.2 does not apply; see the Directus table in AUDIT.md).

- [ ] `GET /items/calendar_events` — `getCalendarEvents(userId)` (`legacy:src/lib/directus.ts:722-732`). Params: `filter[user_id][_eq]=<user.id>`, `fields=id,title,description,start_time,end_time,category,user_id,status`, `sort=start_time`; **no `limit`** (Directus default applies). Returns `data ?? []`.
  - Page: key `["calendar-events", user?.id]`, `enabled: !!user?.id`, no overrides (`legacy:src/pages/Calendar.tsx:106-110`). Global defaults apply: `staleTime` 60 s, `gcTime` 24 h, refetch on mount/focus/reconnect, `retry: 1` (`legacy:src/App.tsx:112-133`).
  - Reminder hook: same key `["calendar-events", user?.id]`, `enabled: !!user?.id`, `refetchInterval: 30_000` (`legacy:src/hooks/useCalendarNotifications.ts:12-17`). Because the hook runs in every `DashboardLayout`, the 30 s poll runs on every protected page, including `/calendar`.
  - Widget (unreferenced): key `["calendar-events-widget", user?.id]` — a **different** key, so mutations do not invalidate it (`legacy:src/components/dashboard/CalendarWidget.tsx:16-20`).
  - Persisted to IndexedDB with the rest of the cache (key `ecap-plus-pmp-react-query`, 24 h maxAge, every successful query dehydrated) (`legacy:src/App.tsx:140-148,213-224`). New app: user-private, set `meta: { persist: false }`.
  - Client post-processing: per-day bucketing with `isSameDay(new Date(e.start_time), day)` in local time (`legacy:src/pages/Calendar.tsx:183-185,257-259,319-321`); category counts (`:497-499`); first 4 for "Upcoming Soon" (`:543`).
- [ ] `POST /items/calendar_events` — `createCalendarEvent(payload)` (`legacy:src/lib/directus.ts:734-740`). Body: `{ title, description, category, status: "scheduled", start_time, end_time, user_id }` where `start_time`/`end_time` are `new Date(<datetime-local string>).toISOString()` and `user_id = user.id` (`legacy:src/pages/Calendar.tsx:424-434,455-463`). On success: invalidate `["calendar-events"]` (prefix), close dialog, `toast.success("Event scheduled successfully!")`; error: `toast.error("Failed to schedule event")` (`:112-120`).
- [ ] `PATCH /items/calendar_events/:id` — `updateCalendarEvent(id, payload)` (`legacy:src/lib/directus.ts:742-751`, id not URL-encoded). Body: `{ title, description, category, start_time, end_time, user_id }` (no `status`, since `handleEditClick` does not copy it) (`legacy:src/pages/Calendar.tsx:438-449,424-432`). Success: invalidate `["calendar-events"]`, close dialog, `toast.success("Event updated successfully!")`; error `toast.error("Failed to update event")` (`:132-146`).
- [ ] `DELETE /items/calendar_events/:id` — `deleteCalendarEvent(id)` (`legacy:src/lib/directus.ts:753-757`). Fired directly from the detail dialog's Delete button, no confirmation (`legacy:src/pages/Calendar.tsx:868-875`). Success: invalidate, close detail dialog, `toast.success("Event deleted successfully")`; error `toast.error("Failed to delete event")` (`:122-130`).
- [ ] Related (users module, not calendar): `deleteUser` FK cascade scrubs `calendar_events` rows by `user_id`, `user_created`, `created_by` (`legacy:src/lib/directus.ts:450-454`). Only `user_id` exists in the collection.

### Fields used

Event model (`legacy:src/lib/directus.ts:711-720`; collection schema `legacy:scripts/setup-calendar-collection.mjs:85-121`):

| Field (normalised name the page uses) | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| `id` | `id` (TS `string`; Directus default PK is an auto-increment integer — AUDIT.md) | PATCH/DELETE path; reminder dedupe key `${id}-${start_time}` | — |
| `title` | `title` (required in schema) | month chip, week card, day card, Upcoming list, detail dialog title, reminder text | truncated in chips/lists |
| `description` | `description` (text, optional) | day card (`line-clamp-1`), detail dialog "Description" block, only when truthy | plain |
| `start_time` | `start_time` (timestamp) | day bucketing; week card `HH:mm`; day card `HH:mm` + "Start"; Upcoming `MMM d, HH:mm`; detail "Starts" `MMM d, HH:mm`; reminder window | date-fns `format`, local time |
| `end_time` | `end_time` (timestamp) | detail "Ends" `MMM d, HH:mm`; widget `HH:mm - HH:mm` | as above |
| `category` | `category`: `"Meeting" \| "Field Visit" \| "Deadline" \| "Personal"` | colour of chips/cards/detail header; badge text on day card and detail; legend counts | colour map below |
| `user_id` | `user_id` (uuid, m2o UI to `directus_users`, no relation) | filter; written on create/update | — |
| `status` | `status`: `"scheduled" \| "cancelled" \| "completed"`, default `scheduled` | written `"scheduled"` on create only. **Never displayed, filtered or edited.** | — |

- [ ] Category list and colours (`legacy:src/pages/Calendar.tsx:59-84`): `Meeting` emerald, `Field Visit` emerald (same as Meeting), `Deadline` rose, `Personal` amber. Chips use `<color>/10` background + border + text classes (`:218-225`). Detail header uses solid colour, fallback emerald (`:795-799`). New app: category colours come from theme tokens; category list should be config-driven (or a module constant) matching the Directus choices.

### Filters / sort / pagination / search

- [ ] View switcher: segmented buttons `month` / `week` / `day` (rendered capitalised via CSS), default `month` (`legacy:src/pages/Calendar.tsx:90,607-626`). Not persisted (component state). New app: consider a URL param.
- [ ] Date navigation: Prev / Next buttons step 1 month / 7 days / 1 day by view; "Today" resets to now (`:148-158,578-604`). Header label is always `format(currentDate, "MMMM yyyy")`, even in week/day view (`:586-588`). Not persisted.
- [ ] Week starts Sunday (date-fns `startOfWeek` default) and month header row is hardcoded `["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]` (`:163-164,174,250-251`). New app: week start from config/locale.
- [ ] Category legend: card "Categories" listing the 4 categories with a count of **all** loaded events per category (not the visible period). Rows have `cursor-pointer` but no click handler — it is not a filter (`:496-524`).
- [ ] Search: none. Sort: server `sort=start_time`. Pagination: none (no `limit` → Directus default).

### Exports

- [ ] None.

### Charts

- [ ] None. (Counts only: legend counts per category; month cell badge `"{n} Events"` shown on hover (`:205-212`).)

### Links in / out

- [ ] In: sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:50`); mobile sheet menu (`legacy:src/components/dashboard/DashboardLayout.tsx:34`); header icon button `title="Event calendar"` (`legacy:src/components/dashboard/DashboardHeader.tsx:274-278`); dashboard `WelcomeBanner` "Calendar" button (`legacy:src/components/dashboard/WelcomeBanner.tsx:71-76`); unreferenced `CalendarWidget` "Schedule now", each event row, and "View full calendar" (`legacy:src/components/dashboard/CalendarWidget.tsx:44,55,80`). All plain `navigate("/calendar")`: no query params, no `location.state`, no storage writes. Documentation articles mention Calendar in text only (`legacy:src/data/documentationArticles.ts:26,32`).
- [ ] Out: none (no links leave the page other than the shell).

### Loading / empty / error

- [ ] Loading: nothing — `data` defaults to `[]`, so the grid renders empty until the query resolves; no skeleton/spinner (`legacy:src/pages/Calendar.tsx:106`). New app: skeleton.
- [ ] Error: not handled; a failed GET looks identical to "no events". New app: `<ErrorState>` with retry.
- [ ] Empty states: week view per-day placeholder "Free" (`:303-309`); day view "No events scheduled" + link button "Schedule Something" opening the create dialog (`:394-408`); Upcoming card "No future events scheduled" when there are no events at all (`:556-565`). Day view header text "You have {n} events scheduled for today." (`:338-340`).
- [ ] Month cell shows at most 3 events, then "+ {n} more" (non-clickable) (`:215-240`). Out-of-month days dimmed; today's number highlighted (`:189-201`).
- [ ] Widget (unreferenced): loading `LoadingDots`; empty "No events for today" + "Schedule now"; lists only today's events with `HH:mm - HH:mm`; title "Upcoming Schedule", subtitle "Your scheduled events and meetings" (`legacy:src/components/dashboard/CalendarWidget.tsx:22-84`).

### Bugs and quirks

- [ ] **BUG** No `limit` on the GET, so Directus' default page size applies; with `sort=start_time` ascending the *oldest* events are kept and newer ones silently disappear once a user has more than the default (`legacy:src/lib/directus.ts:722-731`). Port: fetch the visible window (filter on `start_time` range) plus an upcoming window, or page explicitly.
- [ ] **BUG** "Upcoming Soon" is `events.slice(0, 4)` of an ascending list, so it shows the user's four *oldest* (past) events; its empty text says "No future events scheduled" (`legacy:src/pages/Calendar.tsx:543-563`). Port intended: next 4 events with `start_time >= now`.
- [ ] **BUG** Day view says "events scheduled for today" for whatever day is selected (`:338-340`).
- [ ] **BUG** Month badge pluralisation: "1 Events" (`:210`).
- [ ] **BUG** Multi-day events appear only on their start day (all bucketing is by `start_time`) (`:183-185,257-259,319-321`). Default new event spans now → now + 1 day (`:97-98,461-462`).
- [ ] **BUG** Save validation is silent: if title/start/end is empty the click does nothing; no check that end ≥ start (`:414-421`).
- [ ] **BUG** Delete has no confirmation (`:870`).
- [ ] **BUG** `status` is written but never shown or editable; cancelled/completed events still render and still trigger reminders (`:96`, `legacy:src/hooks/useCalendarNotifications.ts:31-58`).
- [ ] **BUG** Header label is "MMMM yyyy" in week view, so a week spanning two months shows only one (`:586-588`).
- [ ] **QUESTION** "Meeting" and "Field Visit" share the same emerald colour, so they are indistinguishable (`:60-71`; widget `legacy:src/components/dashboard/CalendarWidget.tsx:61-62`).
- [ ] **QUESTION** Category chip background is built at runtime (`color.replace("bg-","bg-").concat("/10")` → e.g. `bg-rose-500/10`); the `replace` is a no-op and Tailwind JIT only generates the class if it appears literally somewhere (`:220-222,282-284,350-352`).
- [ ] **QUESTION** Category legend rows look clickable but do nothing (`:503`) — was a category filter intended?
- [ ] **BUG** Update re-sends `user_id: user.id` and create trusts a client-supplied `user_id` (create permission is open), so a user could create events owned by someone else (`:424-427`, `legacy:scripts/setup-calendar-collection.mjs:158-167`). Backend ask: create preset `user_id = $CURRENT_USER`.
- [ ] **BUG** Unreferenced widget uses query key `calendar-events-widget`, not invalidated by mutations (`legacy:src/components/dashboard/CalendarWidget.tsx:17`). New app: share the module's query options.
- [ ] Lists use array index as React key (`:182,215,256,277,345,543`) — cosmetic.
- [ ] Time zones: inputs are `datetime-local` (browser local), converted with `toISOString()` (UTC) on save, and displayed via `new Date()` in local time (`:423-428,444-448`). Keep this round-trip.

## Component `CalendarWidget` (unreferenced)

- [ ] Port as a dashboard widget contributed by the calendar module (decision: port unreferenced dashboard widgets). Behaviour as in Loading/empty/error above: today's events only (`isToday(new Date(start_time))`), category stripe colour (Meeting/Field Visit emerald, Deadline rose, else amber), click → `/calendar`, "View full calendar" button (`legacy:src/components/dashboard/CalendarWidget.tsx:12-88`). Must share the page's query options rather than its own key.

## Other behaviour

### Create / edit dialog (`legacy:src/pages/Calendar.tsx:638-787`)

- [ ] Opened by sidebar-card button "Schedule event" (`:474-482`) or day-view "Schedule Something" (`:400-406`); `openAddModal` resets the form to defaults `{ title: "", description: "", category: "Meeting", status: "scheduled", start_time: now, end_time: now + 1 day }` (formatted `yyyy-MM-dd'T'HH:mm`) and `isEditing=false` (`:455-466`).
- [ ] Edit: opened from detail dialog "Edit"; copies title, description (or ""), category, start/end (formatted local) into the form, sets `isEditing`, closes detail, opens dialog (`:438-453`).
- [ ] Header pill "New event" / "Editing"; title "Schedule new event" / "Edit event"; subtitle "Fill in the details to add to your agenda." / "Update your event details below." (`:651-662`).
- [ ] Fields in order: "Event title" (text, placeholder "Ex: Weekly Team Review"); "Start time" and "End time" (`datetime-local`); "Category" (toggle chips of the 4 categories); "Description (optional)" (single-line input, placeholder "Add more context…") (`:668-760`).
- [ ] Footer: "Cancel" (closes); primary button label "Create Event" / "Scheduling…" or "Update Event" / "Updating…"; disabled while either mutation is pending (`:763-785`).
- [ ] Validation: requires title, `user.id`, start, end; otherwise no-op (`:414-421`). New app: zod form schema with visible errors and end ≥ start.

### Detail dialog (`legacy:src/pages/Calendar.tsx:789-881`)

- [ ] Opened by clicking any event in month/week/day views (`:226-230,288-292,356-360`). Header in category colour with category badge and title; "Starts" / "Ends" (`MMM d, HH:mm`); "Description" if present; buttons "Close", "Edit", "Delete" ("Deleting..." while pending, disabled).

### Reminders / notifications (`legacy:src/hooks/useCalendarNotifications.ts`)

- [ ] Mounted by `DashboardLayout` on every protected page (`legacy:src/components/dashboard/DashboardLayout.tsx:24,49`).
- [ ] Polls the event list every 30 s (`:16`); `refetchIntervalInBackground` not set, so it pauses in background tabs (React Query default).
- [ ] On mount, if `"Notification" in window && Notification.permission === "default"`, calls `Notification.requestPermission()` — without a user gesture (`:19-24`).
- [ ] For each event, `diff = differenceInMinutes(parseISO(start_time), now)`; if `-2 <= diff <= 15` and key `${id}-${start_time}` not yet in an in-memory `Set` (`useRef`), it fires once (`:26-38`):
  - browser `Notification` (only if permission `granted`): title "Event Started" (diff < 0) or "Upcoming Event"; body "`{title}` has just started!" or "`{title}` starts in `{diff}` minutes!"; `icon: "/favicon.ico"` (`:40-51`);
  - sonner `toast.info("Started: {title}" | "Upcoming: {title}", { description: <same body>, duration: 10000 })` (`:54-57`).
- [ ] Legacy reminders are **not** added to the header bell list; the bell only shows Directus `/notifications` (`legacy:src/components/dashboard/DashboardHeader.tsx:91-100`). Plan §5: the new `calendar` module contributes reminder items to the notifications service (merged with Directus notifications).
- [ ] **BUG** The check only runs when the `events` array reference changes (`useEffect(..., [events])`, `:26-60`). React Query's structural sharing keeps the same reference when a poll returns identical data, so an event entering the 15-minute window between polls is never announced unless the data changes or the layout remounts. Port intended: evaluate on a clock tick (e.g. each minute) independent of fetches.
- [ ] **BUG** The dedupe `Set` lives in a `useRef` inside `DashboardLayout`, which every page mounts itself, so navigating between pages resets it and re-announces the same event (toast + OS notification) on every navigation inside the 17-minute window (`:10`; `legacy:src/pages/Calendar.tsx:469`). Port: keep the "already notified" set in a shell-level service (and ideally `sessionStorage`) so each event is announced once.
- [ ] **BUG** "starts in 0 minutes!" / "starts in 1 minutes!" wording for diff 0/1 (`:43`).
- [ ] Notification icon path `/favicon.ico` is a branding asset (`:49`) — take from `@/config`.

### Directus collection setup (`legacy:scripts/setup-calendar-collection.mjs`)

- [ ] Node script, run manually with an env file holding the Directus URL and an **admin email/password** (`:9-25`). Logs in via `POST /auth/login` (`:31-45`), `POST /collections` `calendar_events` (meta icon `calendar_month`, note "Collection for user-scheduled events and meetings", display template `{{title}}`) (`:58-79`), `POST /fields/calendar_events` for each field (`:85-134`), `GET /roles` and `POST /permissions` per non-"Administrator" role: read/update/delete with `{ user_id: { _eq: "$CURRENT_USER" } }`, create with `{}` (`:139-194`).
- [ ] **QUESTION** Per-role permission posting does not match Directus 11 policies, responses are unchecked, re-runs duplicate permissions, and field-create errors are swallowed (`:123-134,146-191`) — confirm the live collection's actual permissions (Backend ask). The new repo must not ship admin credentials or this script with `VITE_*` vars (rule 5).

### Storage / browser APIs

- [ ] No localStorage/sessionStorage keys of its own. Event data is persisted inside the shared React Query IndexedDB cache `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:140-148`).
- [ ] Browser APIs: `Notification` (permission + constructor), sonner toasts.

## Open questions for the developer

1. Should the new calendar fetch by visible date window (server filter on `start_time`) instead of the whole history, to avoid the Directus default limit?
2. Should `status` (`scheduled` / `cancelled` / `completed`) become visible/editable, and should cancelled/completed events be excluded from reminders?
3. Is the category legend meant to be a filter? Should Meeting and Field Visit get distinct colours?
4. Should reminders keep using OS `Notification` (permission requested on a user gesture, e.g. from the bell or settings) in addition to the in-app toast and bell entry?
5. Backend ask: create permission should preset/validate `user_id = $CURRENT_USER`; confirm Directus 11 policy configuration for `calendar_events`.
6. Should multi-day events render across every day they span?

## Phase 5 implementation decision and status (2026-11-03)

The user approved a **default-off scaffold only** until the Directus collection's ownership permissions are verified and corrected. The audit found the collection's create permission open and the setup script's per-role permission configuration questionable; clients must not be treated as the ownership boundary.

- `module.calendar` is false by default. `/calendar` is registered with `records.view` at district-or-higher scope, but the feature flag removes its route and nav by default.
- If the scaffold is explicitly enabled, it displays an unavailable state and makes no event reads/writes, reminder polling, browser notifications, or dashboard-widget requests. No event/by-ID routes or CRUD controls are added.
- Do not enable calendar data until backend/Directus owners verify caller-derived read/update/delete scope, force ownership to `$CURRENT_USER` on create/update, confirm policy behavior, and address bounded/date-window reads. Reminder integration must be designed separately after safe data access exists.
