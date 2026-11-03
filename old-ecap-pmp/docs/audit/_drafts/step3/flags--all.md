# flags — legacy audit

> New module `flags` · Legacy routes → new routes: `/flags` → `/flags`; `/flagged-record-form` → `/flags/new?householdId=` · Plan: MIGRATION_PLAN.md §5 row "flags" ("Form loads the household by ID instead of `location.state`")

All flag data lives in the Directus collection `flagged_forms_ecapplus_pmp`; there is **no DQA API endpoint** for flags (AUDIT.md §3.2 has none; Directus table in AUDIT.md lines 2957-2959). Notifications go to Directus `/notifications` (AUDIT.md line 2948).

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/Flags.tsx` | 475 | `/flags` page: flag review queue (tabs, search, CSV export, resolve) |
| `src/pages/FlaggedRecordForm.tsx` | 240 | `/flagged-record-form` page: create flag from a household passed via `location.state`. **Routed but no inbound link anywhere in `src`** (grep for `flagged-record-form` hits only `legacy:src/App.tsx:518`) |
| `src/App.tsx` | 602 | Lazy imports (`:81`, `:96-97`), routes (`:382-388`, `:518-524`), QueryClient defaults (`:112-133`), IndexedDB persistence (`:213-224`) |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Sidebar entry "Flags" (`:93`) and visibility filter (`:147-180`) |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Bottom nav — no Flags entry (`:6-10`) |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Ctrl/Cmd-K nav entry "Flags" (`:40`) |
| `src/components/dashboard/DashboardLayout.tsx` | (partial, `:30-80`) | Mobile sheet menu entry "Flags" (`:40`) |
| `src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by either flags page (they compare `user.description` directly) |
| `src/lib/api.ts` | (partial) | `getFlaggedRecords` `:604-628`, `createFlaggedRecord` `:630-651`, `updateFlagStatus` `:1283-1305`, `getListValue` `:116+`, `safeJson` `:18-24` |
| `src/lib/directus.ts` | (partial) | `listUsers` `:79-100`, `createNotification` `:514-527`, `FLAG_NOTIFY_ROLE_KEYWORDS` / `isFlagNotifyRecipient` `:638-655`, `notifyUsersOfFlag` `:657-682`, `notifyUsersOfFlagResolution` `:684-709` |
| `src/pages/HouseholdProfile.tsx` | (partial) | Inline flag create/resolve tab — the **real** create path (`:93-99`, `:211-214`, `:274-349`, `:381-389`, `:1391-1671`). Owned by households audit; summarised here for lifecycle |
| `src/pages/VcaProfile.tsx` | (partial) | Inline flag create/resolve for VCAs (`:175-181`, `:256-259`, `:326-400`). Owned by vcas audit; summarised here |
| `src/components/dashboard/RecentActivity.tsx` | (partial) | Unmounted dashboard widget reading flags (key `["recent-flags"]`, `:98-138`, `:255-270`) |
| `src/components/dashboard/WelcomeBanner.tsx` | (partial) | "Start DQA Review" button → `/flags` (`:78-85`) |
| `src/pages/Dashboard.tsx` | (partial) | Quick action "DQA review" → `/flags` (`:76-82`, mapped at `:105-110`) |

## Flag lifecycle (cross-page summary)

- [ ] **Create**: `POST /items/flagged_forms_ecapplus_pmp` with `status: "pending"` (`legacy:src/pages/FlaggedRecordForm.tsx:94-104`, `legacy:src/pages/HouseholdProfile.tsx:335-347`, `legacy:src/pages/VcaProfile.tsx:387-399`). Then fire-and-forget `notifyUsersOfFlag` (not awaited, errors swallowed by `Promise.allSettled`) (`legacy:src/pages/FlaggedRecordForm.tsx:75`, `legacy:src/lib/directus.ts:676-681`).
- [ ] **Statuses**: only two values are ever written by the app: `"pending"` (create) and `"resolved"` (resolve) (`legacy:src/lib/api.ts:1283-1296`). The Flags page tolerates others: "resolved" = status (or `flag_status`, `state`) lowercased **contains** `resolved`, `closed` or `done` (`legacy:src/pages/Flags.tsx:47-50`). Anything else is "active".
- [ ] **Resolve**: `PATCH /items/flagged_forms_ecapplus_pmp/:id` body `{status:"resolved"}` then awaited `notifyUsersOfFlagResolution` (`legacy:src/pages/Flags.tsx:171-176`). Also possible from the household and VCA profile pages (`legacy:src/pages/HouseholdProfile.tsx:299-321`, `legacy:src/pages/VcaProfile.tsx:326-347`). No resolution comment, resolver id or resolved date is stored on the flag — only `status` changes.
- [ ] **No reopen, edit or delete** of a flag anywhere in the UI (only `scrubUserReferences` on user delete, AUDIT.md line 2961).
- [ ] **Who can resolve**: anyone who can see the row; there is no role/permission check on the Resolve button (`legacy:src/pages/Flags.tsx:443` only checks `!isResolved`). New app: gate with `can("flags.resolve")` (MIGRATION_PLAN.md permission example) and record the backend gap (AUDIT.md line 3058, Backend ask 9).
- [ ] **Who is notified**: all **active** Directus users (`GET /users?fields=...&limit=-1&filter[status][_eq]=active`, `legacy:src/lib/directus.ts:79-100`) whose `role.name` lowercased contains any of `"admin"`, `"administrator"`, `"supervisor"`, `"qa"`, `"data quality"`, `"manager"` (`legacy:src/lib/directus.ts:641-655`). One `POST /notifications` per recipient with `collection: "flagged_forms_ecapplus_pmp"`, no `item`, no `sender` (`legacy:src/lib/directus.ts:674-681`, `:701-708`). The caseworker is **not** notified (they are not a Directus user here) despite toasts saying so.
  - Raise subject: `Record Flagged: <entityId>`; message: `A record for <entityId> has been flagged by <verifier>. \n\nComment: <comment>` (`legacy:src/lib/directus.ts:670-671`).
  - Resolve subject: `Flag Resolved: <entityId>`; message: `The flag for <entityId> has been resolved by <resolver>. \n\nResolution/Comment: <comment>` (`legacy:src/lib/directus.ts:697-698`).
  - `entityId` = `VCA <vcaId> (HH <hhId>)` when `vcaId` is truthy and `!== "Not Available"`, else `Household <hhId>` (`legacy:src/lib/directus.ts:666-669`, `:693-696`).
  - **QUESTION** role-name keyword matching is a role-string comparison; the new app should resolve recipients via config/backend, not hardcoded role keywords.

### Directus collection `flagged_forms_ecapplus_pmp` — fields

| Field | Written by | Read by Flags page | Notes |
| --- | --- | --- | --- |
| `id` | Directus | resolve target, row key (`legacy:src/pages/Flags.tsx:196-198`, `:391`) | |
| `household_id` | all create paths | Subject, export, row click, notify | Form: from state, default `"Not Available"`; HH profile: route id; VCA profile: `vca.household_id \|\| "N/A"` |
| `vca_id` | form, VCA profile | Subject fallback `CA <vca_id>`, notify | HH profile **does not send** `vca_id` (`legacy:src/pages/HouseholdProfile.tsx:335-347`) |
| `caseworker_phone` | all | — (not shown on Flags) | |
| `caseworker_name` | all | Caseworker column, export | profile fallback `cwac_member_name` |
| `caregiver_name` | all | export only | |
| `facility` | all | Subject secondary line, export | profile fallback `health_facility` |
| `comment` | all | Comment column, export | |
| `verifier` | all (`"<first_name> <last_name>"` of current user or `"Unknown Verifier"`) | "Flagged by" fallback, export | Free text, not a user relation |
| `status` | `"pending"` / `"resolved"` | tabs, badge, export | |
| `category` | profile pages only (optional) | — | options: "Missing Data", "Invalid Data", "Duplicate Record", "Incorrect Service", "Case Plan Mismatch", "Other" (`legacy:src/pages/HouseholdProfile.tsx:1429-1444`) |
| `severity` | profile pages only (optional) | Priority (via `severity`) | options: "Low", "Medium", "High", "Critical" (`legacy:src/pages/HouseholdProfile.tsx:1470-1481`) |
| `date_created` | Directus (accountability) | FY filter, sort, Date column, export | |
| `flagged_by`, `user_created`, `created_by` | not written by app; expanded `first_name,last_name` on read | "Flagged by" column | |
| `district`, `province` | **never written** | geo scoping | see BUG below |
| `priority`, `risk_level`, `flag_status`, `state`, `ward`, `form_name`, `form_type`, `title`, `created_at`, `flagged_date`, `date` | never written | guessed fallbacks | dead guesses |

## Route `/flags` → `/flags`

### Purpose
Data-quality review queue listing every flagged record ("Flagged forms requiring review and resolution."), with All/Active/Resolved tabs, free-text search, CSV export and a per-row Resolve action (`legacy:src/pages/Flags.tsx:237-471`).

### Access
- [ ] Route guard: `<ProtectedRoute>` only, no role check (`legacy:src/App.tsx:381-388`).
- [ ] Sidebar: item `{ title: "Flags", url: "/flags", icon: Flag }` in section "Services" (`legacy:src/components/dashboard/AppSidebar.tsx:93`). The section filter only hides `/districts` for district users, the "Admin" section for non-admins, and "Data Pipeline" for non-admin/non-support (`legacy:src/components/dashboard/AppSidebar.tsx:147-180`), so Flags is **visible to every logged-in user**.
- [ ] Mobile bottom nav: no Flags entry (items Home, Districts, Registers, Services, Profile — `legacy:src/components/dashboard/MobileBottomNav.tsx:6-10`). Mobile sheet menu: `{ title: "Flags", url: "/flags" }` (`legacy:src/components/dashboard/DashboardLayout.tsx:40`), unconditional.
- [ ] Global search: navigation entry `{ title: "Flags", url: "/flags", category: "Navigation" }` (`legacy:src/components/dashboard/GlobalSearch.tsx:40`), unconditional. No flag records are searchable.
- [ ] In-page role checks:
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/Flags.tsx:37`)
  - `const isProvincialUser = user?.description === "Provincial User";` (`legacy:src/pages/Flags.tsx:38`)
  - `userProvince = user?.title`, `userDistrict = user?.location` (`legacy:src/pages/Flags.tsx:39-40`)
  - Resolve button shown when `!isResolved` — no permission check (`legacy:src/pages/Flags.tsx:443`).
- [ ] Data scope: **client-side only**. The request fetches all flags; then (`legacy:src/pages/Flags.tsx:53-63`):
  - `if (isDistrictUser && userDistrict && userDistrict !== "All") return r.district === userDistrict;`
  - `if (isProvincialUser && userProvince && userProvince !== "All") return r.province === userProvince;`
  - else all rows. `useEffectiveDistrict` is not used; there is no district selector.
  - New app: scope from `platform/scope` in the query key and send it as a Directus filter; backend must enforce (AUDIT.md Backend ask 9).

### Endpoints
- [ ] `GET /items/flagged_forms_ecapplus_pmp?fields=*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name` — `getFlaggedRecords` (`legacy:src/lib/api.ts:604-628`), raw `fetch` with Bearer token. Returns `[]` with no request if there is no stored token; returns `[]` on any thrown error (errors swallowed, logged). No filter/sort/limit → Directus default page size (AUDIT.md line 2957). Query key `["flagged-records"]` (`legacy:src/pages/Flags.tsx:42-45`), always enabled, global defaults: staleTime 60 s, gcTime 24 h, refetch on mount/focus/reconnect, retry 1 (`legacy:src/App.tsx:112-133`); persisted to IndexedDB for 24 h (`legacy:src/App.tsx:213-224`). Key has no user id (AUDIT.md line 2891). New app: `meta: { persist: false }`, scope in key.
- [ ] `PATCH /items/flagged_forms_ecapplus_pmp/:id` body `{"status":"resolved"}` — `updateFlagStatus` (`legacy:src/lib/api.ts:1283-1305`); throws `errorData.message || "Failed to update flagged record"` on non-OK. id not URL-encoded.
- [ ] `GET /users?fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required&limit=-1&filter[status][_eq]=active` — `listUsers("active")` inside `notifyUsersOfFlagResolution` (`legacy:src/lib/directus.ts:79-100`, `:690`).
- [ ] `POST /notifications` × N recipients — `createNotification` (`legacy:src/lib/directus.ts:514-527`), body `{recipient, subject, message, collection:"flagged_forms_ecapplus_pmp"}`.
- [ ] Mutation flow (`legacy:src/pages/Flags.tsx:171-202`): `handleResolve` stops row-click propagation, sets `isResolving = record.id`, mutates with `{id, household_id, vca_id}`. `mutationFn` awaits PATCH then awaits notify with resolver `"<first_name> <last_name>"` or `"Unknown Resolver"` and comment `"Issue marked as resolved via Flags dashboard."`. onSuccess: invalidate `["flagged-records"]` and `["recent-flags"]`, toast.success `"Flag resolved successfully"` / `"All users have been notified of the resolution."`, clear `isResolving`. onError: `console.error`, toast.error `"Failed to resolve flag"` / `"An error occurred while updating the status."`, clear `isResolving`.

### Fields used

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| resolved? | `status`, `flag_status`, `state` | tabs/counts (`:47-50`) | lowercase contains `resolved`/`closed`/`done` |
| row resolved? (badge + button) | `status` only | Status badge, Resolve button (`:376-377`) | lowercase contains `resolved`/`closed` (no `done`) |
| created date (FY filter) | `date_created`, `created_at`, `flagged_date`, `date` | FY window (`:72`) | `new Date()` |
| created date (sort/display) | `date_created` only | sort (`:102`), Date column (`:422`) | `toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"})`, `"—"` if empty, raw string on throw (`:226-233`) |
| subject | `household_id` → `HH <id>`; else `vca_id` → `CA <id>`; else `"—"` | Subject column (`:382-386`) | |
| wardOrFacility | `facility`, `ward`, `district` | Subject secondary line, truncated 200px (`:387`, `:398-402`) | |
| caseworker | `caseworker_name` | Caseworker column (lg+), `CW: <name>` under subject below lg (`:403-412`) | `"—"` if empty |
| flagged by | `flagged_by`, `user_created`, `created_by`, `verifier`, `supervisor` via local `pickValue` | Flagged by column (lg+) (`:414`) | object → `first_name last_name`; skips empty values and raw UUIDs; `"N/A"` fallback (`:106-123`) |
| comment | `comment` | Comment column (md+), 2-line clamp, `title` tooltip (`:417-419`) | italic `"No comment"` if empty |
| priority | `priority`, `severity`, `risk_level` | Priority badge (`:219-224`, `:425-432`) | contains `high`/`critical` → `HIGH`; contains `low` → `LOW`; else `MEDIUM` (so flags with no severity show MEDIUM) |
| status label | `status` | Status badge (`:439`) | `"Resolved"` if resolved, else `status.toUpperCase()` (e.g. `PENDING`), else `"Active"` |
| unused | `form_name`, `form_type`, `title` → `"Flagged form"` | computed `formName` never rendered (`:379`) | dead |

Badge colours: priority HIGH rose, MEDIUM amber, LOW slate; status resolved emerald, else rose (`:427-437`). Map to theme tokens.

### Filters / sort / pagination / search
- [ ] Tabs: `"all" | "active" | "resolved"`, rendered as `{tab} (<count>)` capitalised, default `"all"`, local state only (not persisted) (`legacy:src/pages/Flags.tsx:35`, `:270-291`). Counts computed from FY+geo scoped rows (`:79-86`). Applies to table and export (export uses `filteredRecords`).
- [ ] Resolution policy note shown **only** on the Resolved tab: "**Resolution policy:** Only tick a flag as resolved **if and only if the caseworker has fixed the underlying issue** on the actual record. Marking a flag as resolved without verifying the fix will hide real data-quality problems from this queue." (`legacy:src/pages/Flags.tsx:294-303`).
- [ ] FY filter: global `useFyFilter().resolved` `fromDate`/`toDate`; if both set, keep rows whose created date (keys above) is within `[fromDate, toDate T23:59:59Z]`; rows with no date are **dropped**; if not set, no filter (`legacy:src/pages/Flags.tsx:66-77`). Applies to tabs, counts, table, export. New app: fiscal-year window from `platform/scope`, in the query key.
- [ ] Search: input placeholder `"Search records…"`, no debounce, case-insensitive substring over `String(value)` of **every** top-level field of the record (`Object.values`) (`legacy:src/pages/Flags.tsx:94-104`, `:318-326`). Not persisted. Applies to table, export and "Showing N records".
- [ ] Sort: by `date_created` descending — **only when the search box is non-empty** (see BUG). No sortable columns.
- [ ] Pagination: none; all rows rendered. Footer `Showing {filteredRecords.length} records` (`:465-467`).

### Exports
- [ ] CSV, button "Export CSV" (`legacy:src/pages/Flags.tsx:327-334`), hand-built `data:text/csv;charset=utf-8,` URI + `encodeURI` + temporary `<a download>` (`:125-165`). No library.
  - Filename: `` `district_flagged_records_${user?.location || "all"}.csv` `` (`:158`).
  - Rows: `filteredRecords` (current tab + FY + geo + search).
  - Columns, in order: `Household ID` ← `household_id`; `Caseworker Name` ← `caseworker_name`; `Caregiver Name` ← `caregiver_name`; `Facility` ← `facility`; `Comment` ← `comment` (quoted, `"` doubled); `Verifier` ← `verifier`; `Status` ← `status`; `Created At` ← `date_created` (raw ISO) (`:127-151`).
  - Errors only `console.error`; no toast. New app: `platform/export`.

### Charts
- [ ] None. (Tab counts are the only aggregates.)

### Links in / out
- [ ] In (all plain `navigate("/flags")`/`NavLink`, no state, no query params, no storage):
  - Sidebar `legacy:src/components/dashboard/AppSidebar.tsx:93`
  - Mobile sheet menu `legacy:src/components/dashboard/DashboardLayout.tsx:40`
  - Global search `legacy:src/components/dashboard/GlobalSearch.tsx:40`
  - Dashboard quick action "DQA review" — "Flagged records and data-quality remediation queue." `legacy:src/pages/Dashboard.tsx:76-82`
  - WelcomeBanner button "Start DQA Review" `legacy:src/components/dashboard/WelcomeBanner.tsx:78-85`
  - RecentActivity feed item click and type route (unmounted widget) `legacy:src/components/dashboard/RecentActivity.tsx:87`, `:268-270`
- [ ] Out: row click → `navigate("/profile/household-details", { state: { id: record.household_id } })` (`legacy:src/pages/Flags.tsx:167-169`, `:393`). New app: `/households/:householdId` path builder from the households module index. For VCA-only flags (no `household_id`) this navigates with `id: undefined` — new app should go to `/vcas/:vcaId` instead (QUESTION). Resolve cell stops propagation (`:442`).

### Loading / empty / error
- [ ] Loading: single table row with `LoadingDots` (`:353-361`). New app: skeleton rows.
- [ ] Empty (when not loading and `filteredRecords.length === 0`): Flag icon, "No flagged records found", "All records are clean or no data available." (`:363-373`).
- [ ] Error: none — `getFlaggedRecords` catches and returns `[]`, so fetch failure shows the empty state (`legacy:src/lib/api.ts:624-627`). New app: `<ErrorState>` with retry.
- [ ] Resolve in-flight: that row's button disabled and shows `LoadingDots` (`:447-455`); only one row tracked at a time.

### Header content
- [ ] Hero: eyebrow "Data quality flags", today's date `toLocaleDateString("en-GB", {weekday:"long", day:"numeric", month:"long", year:"numeric"})`, badge `user?.location ?? "All"`; title **"Flagged forms from the ECAP Plus"** (hardcoded program name → `@/config`); badge "Review queue"; subtitle "Flagged forms requiring review and resolution." (`legacy:src/pages/Flags.tsx:235-264`). Layout subtitle "Flags" (`:238`).
- [ ] Card title `{user?.location || "All districts"} flagged records` (`:313-315`).

### Bugs and quirks
- [ ] **BUG** Geo scoping filters on `r.district` / `r.province`, but no create path writes those fields (`legacy:src/pages/Flags.tsx:53-63` vs `legacy:src/pages/FlaggedRecordForm.tsx:94-104`, `legacy:src/pages/HouseholdProfile.tsx:335-347`, `legacy:src/pages/VcaProfile.tsx:387-399`). District and provincial users therefore see **no** flags (unless Directus fills them). Intended: scope flags by the household's district/province; write them on create (or filter server-side by relation).
- [ ] **BUG** All flags nationally are downloaded to every user and only filtered in the browser; admins/others with location set still see everything (`legacy:src/lib/api.ts:614`). Also no `limit` → Directus default page size silently truncates.
- [ ] **BUG** Sort by date only runs inside the search branch; with an empty search box rows are in Directus default order (`legacy:src/pages/Flags.tsx:95-103`).
- [ ] **BUG** Two different "resolved" predicates: tabs use `status|flag_status|state` incl. `done`; badge/button use `status` only, without `done` (`:47-50` vs `:376-377`). A `done` row appears under Resolved but still shows a Resolve button.
- [ ] **BUG** Search over `Object.values` stringifies expanded user objects as `[object Object]`, so "Flagged by" names are not searchable, and the string `"object"` matches every row with an expanded relation (`:97-100`).
- [ ] **BUG** CSV: only `comment` is quoted; commas/newlines in names or facility break columns; `encodeURI` does not encode `#`, truncating the file at the first `#` (`:141-155`).
- [ ] **BUG** FY filter drops rows with no created date even though the table could show them (`:73`).
- [ ] **BUG** Toast says "All users have been notified" but only role-keyword-matching active users are notified (`:180-181` vs `legacy:src/lib/directus.ts:657-660`).
- [ ] **BUG** Individual notification failures are swallowed by `Promise.allSettled`, but if `listUsers` throws after the PATCH succeeded, the mutation errors with "Failed to resolve flag" although the flag **was** resolved and no invalidation happens (`legacy:src/pages/Flags.tsx:173-175`, `legacy:src/lib/directus.ts:690`).
- [ ] **BUG** Row click with a VCA-only flag navigates to the household profile with `id: undefined` (`:393`).
- [ ] Quirk: `getStatusColor` (`:204-217`) is unused; imports `Activity, Sparkles, Button, CheckCircle2, XCircle, AlertTriangle, RefreshCw` unused.
- [ ] Quirk: "Flagged by" falls back to the free-text `verifier`, since the app never writes `flagged_by` (`:414`).

## Route `/flagged-record-form` → `/flags/new?householdId=`

### Purpose
Standalone form to flag a household: shows read-only household reference details and collects a required comment, then creates a `pending` flag and goes back (`legacy:src/pages/FlaggedRecordForm.tsx:42-229`). **No code in `src` navigates here** — the household and VCA profile pages have their own inline flag forms. Port per plan as `/flags/new?householdId=`.

### Access
- [ ] Route guard: `<ProtectedRoute>` only (`legacy:src/App.tsx:517-524`).
- [ ] Sidebar / mobile nav / global search: no entry.
- [ ] In-page role checks: none.
- [ ] Data scope: none; no data fetched.

### How the form gets the household
- [ ] Reads `location.state?.household` (object) and destructures `household_id`, `caseworker_phone`, `caseworker_name`, `caregiver_name`, `facility`, `vca_id`, each defaulting to `"Not Available"` (`legacy:src/pages/FlaggedRecordForm.tsx:48-57`). No fetch.
- [ ] If `location.state?.household` is falsy → guard screen: PageIntro eyebrow "Flags", title "Flag record", description "Create a new flagged record entry."; icon; heading "No household selected"; text "This form requires a household context. Please navigate from a household profile."; button "Go to Households" → `/households` (`:109-129`).
- [ ] New app: read `householdId` (and optional `vcaId`) from the URL, load the household through the households module's exported `queryOptions` (share cache), derive caseworker name/phone, caregiver name, facility, district, province in the normaliser; show `<EmptyState>` with the same "No household selected" guidance when the param is missing, `<ErrorState>` when not found.

### Form fields + validation
- [ ] Single field `comment`: Textarea, label "Comment *", placeholder "Enter your comment here...", min height 120px, vertical resize; zod `z.string().min(1, { message: "Please enter a comment" })` (`legacy:src/pages/FlaggedRecordForm.tsx:38-40`, `:177-193`). Default `""`.
- [ ] **QUESTION** The profile inline forms instead require `comment` ≥ 10 chars ("Flag observations must be at least 10 characters long." / "Observation details must be at least 10 characters") and add optional `category` and `severity` selects (`legacy:src/pages/HouseholdProfile.tsx:93-99`, `legacy:src/pages/VcaProfile.tsx:175-181`). Unify: one shared flag form in the flags module (comment ≥ 10, optional category/severity with the option lists in the field table) used by `/flags/new` and embedded by profiles?
- [ ] Read-only details card "Household details" / "Reference information for this flag": Household ID, Caregiver Name, Caseworker Name, Caseworker Phone, Facility, and VCA ID only when `vca_id !== "Not Available"` (`:146-164`).
- [ ] Page header: PageIntro eyebrow "Compliance", title "Flag record form", description "Add a comment for the caseworker regarding this household.", action "Back" → `navigate(-1)` (`:133-142`). Card "Add comment" / "Provide detailed feedback or instructions for the caseworker." (`:167-173`).

### Endpoints
- [ ] `POST /items/flagged_forms_ecapplus_pmp` — `createFlaggedRecord` (`legacy:src/lib/api.ts:630-651`), throws `"Not authenticated"` without token, throws `errorData.message || "Failed to create flagged record"` on non-OK. Payload (`legacy:src/pages/FlaggedRecordForm.tsx:94-104`): `{ household_id, vca_id, caseworker_phone, caseworker_name, caregiver_name, facility, comment, verifier, status: "pending" }`, `verifier` = `"<first_name> <last_name>"` or `"Unknown Verifier"`. Placeholder `"Not Available"` values are sent as data.
- [ ] onSuccess: invalidate `["flagged-records"]`; call `notifyUsersOfFlag(household_id, verifier, comment, vca_id)` not awaited (`GET /users` active + `POST /notifications` per recipient, see lifecycle); toast.success "Flagged record created successfully" / "Your comment has been submitted to the caseworker."; `navigate(-1)` (`:68-81`).
- [ ] onError: inline destructive Alert "Error" with `err.message || "Failed to submit flagged record."` and toast.error "Submission failed" / `err.message || "Please try again later."` (`:82-88`, `:195-201`). Error cleared on next submit (`:91`).
- [ ] Submit button "Submit flag" (CheckCircle2 icon), disabled while pending showing `LoadingDots` + "Submitting..." (`:203-220`).
- [ ] New app: invalidate the flags list key factory root (and household-scoped flag keys); navigate to the household detail page or back.

### Fields used

| Field | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| household_id | `state.household.household_id` | details card, payload, notify | `"Not Available"` default |
| caregiver_name | `state.household.caregiver_name` | details, payload | same |
| caseworker_name | `state.household.caseworker_name` | details, payload | same |
| caseworker_phone | `state.household.caseworker_phone` | details, payload | same |
| facility | `state.household.facility` | details, payload | same |
| vca_id | `state.household.vca_id` | details (conditional), payload, notify entity | same |

### Filters / sort / pagination / search, Exports, Charts
- [ ] None.

### Links in / out
- [ ] In: none found (grep of `src` for `flagged-record-form` → only `legacy:src/App.tsx:518`). Expected payload if used: `navigate("/flagged-record-form", { state: { household: {...} } })`.
- [ ] Out: Back → `navigate(-1)`; success → `navigate(-1)`; guard → `/households`.

### Loading / empty / error
- [ ] No loading state (no fetch). Empty = guard screen above. Error = inline Alert + toast.

### Bugs and quirks
- [ ] **BUG** Household context only via `location.state` — lost on refresh/deep link (`:49`). Plan fixes with `?householdId=`.
- [ ] **BUG** Missing values stored as the literal `"Not Available"` (profiles use `"N/A"`) (`:50-57`, AUDIT.md line 3019). Send `null`/omit instead.
- [ ] **BUG** No `district`/`province` written, breaking Flags page scoping (see above).
- [ ] **BUG** Success toast claims the comment was "submitted to the caseworker"; caseworkers are not notified (only admin/supervisor/QA/manager roles).
- [ ] Quirk: unused imports `Separator`, `Flag` used; route is orphaned.

## Other behaviour

- [ ] Toasts via `sonner` (listed per mutation above).
- [ ] No timers/polling on either page; refresh is via React Query focus/mount refetch (`legacy:src/App.tsx:126-131`).
- [ ] Storage: no localStorage/sessionStorage keys read or written by the flags pages. Flag list query is persisted in the app-wide IndexedDB React Query cache (`legacy:src/App.tsx:136-148`, `:213-224`); new app must mark it `meta: { persist: false }` (user-scoped data).
- [ ] Shared cache key `["flagged-records"]` is also used by `HouseholdProfile` (`:212-214`) and `VcaProfile` (`:258-259`), which filter client-side by `household_id|hh_id` / `vca_id|child_id` and `status !== "resolved"`. New app: flags module exports `queryOptions` for list-by-household / list-by-VCA (server-side filter) for those modules.
- [ ] Unmounted `RecentActivity` widget uses key `["recent-flags"]`, excludes `status === "resolved"`, counts `pending`/`incomplete`/`draft` (`legacy:src/components/dashboard/RecentActivity.tsx:98-138`); Flags resolve invalidates it (`legacy:src/pages/Flags.tsx:179`). Per decision 1 (port unreferenced widgets) the dashboard module should consume a flags-module exported query.
- [ ] Brand strings: "Flagged forms from the ECAP Plus" (`legacy:src/pages/Flags.tsx:258`); notification collection name `flagged_forms_ecapplus_pmp` (collection name is backend config, not branding — keep in `@/config` or module constant).

## Open questions for the developer

1. Should district/province be written on flag create (from the household record) so scoping works, or should scoping join via the household? Does the Directus collection have those fields?
2. Who may resolve flags — which roles get `flags.resolve`? Should caseworker-level users be able to raise flags at all?
3. Should resolution capture a comment, resolver user and resolved date (collection changes would be a backend ask)?
4. Unify the standalone form and the profile inline forms (comment min length 1 vs 10; category/severity only on profiles)?
5. For VCA-only flags, should row click go to `/vcas/:vcaId`?
6. Notification recipients: keep role-name keyword matching, or move to a backend-side rule/role list in config?
7. Should the `/flags/new` form accept `vcaId` as well as `householdId`?
