# users — legacy audit

> Legacy routes → new routes: `/users` → `/users`; `/users/new` → `/users/new`; `/users/:id/edit` → `/users/:id/edit` · Plan: MIGRATION_PLAN.md §5 row "users"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/Users.tsx` | 566 | `/users`: list, search, Active/Archived tabs, reset, trash, restore, wipe |
| `src/pages/AddUser.tsx` | 848 | `/users/new`: create form, role cards, scope pickers, live preview, setup email. Contains dead password code (see Bugs). |
| `src/pages/EditUser.tsx` | 543 | `/users/:id/edit`: edit form, role select, scope pickers, optional new password, move to trash |
| `src/lib/directus.ts` | 869 (read: 1-500) | Wrappers: `listUsers` :79-100, `getUser` :102-107, `listRoles` :223-226, `getUserByEmail` :228-234, `createUser` :236-254, `inviteUser` :256-266 (unused), `requestPasswordReset` :268-286, `updateUser` :310-331, `UserHasLinkedRecordsError` :346-357, `deleteUser` cascade :359-472 |
| `src/components/MultiFacilityPicker.tsx` | 174 | Multi-select chip picker. Its value is a CSV string. It also exports `parseFacilitiesCsv` and `serializeFacilitiesCsv`. |
| `src/components/dashboard/ConfirmDialog.tsx` | 55 | AlertDialog wrapper used for every confirm |
| `src/App.tsx` | 602 (read: 1-230, 380-460) | Route registration :414-444. QueryClient defaults :108-133. IndexedDB persister :140-148, 216-224. |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard (no role check) |
| `src/components/dashboard/AppSidebar.tsx` | 346 | "Admin" section :103-106; visibility rules :147-181 |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | No users entry |
| `src/components/dashboard/DashboardLayout.tsx` | (read: 25-80) | Mobile sheet menu :31-45; includes "User Management" unconditionally :44 |
| `src/components/dashboard/GlobalSearch.tsx` | 212 (read: 1-120) | Navigation entry "User Management" :44, unfiltered |
| `src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by any users page (read for comparison of role rules) |
| `src/lib/api.ts` | (read: 301-312, 1239-1242) | `getHouseholdsByDistrict` :301-312, `getFacilityList` :1239-1242 |
| `src/lib/utils.ts` | (read: 35-48) | `normalizePlaceName` (Title Case per word and hyphen part, whitespace collapsed) |
| `src/lib/env.ts` | (read: 13-17) | `getDirectusBaseUrl()` reads env name `REACT_APP_BASE_URL` |

## Route `/users` → `/users`

### Purpose
This is the directory of Directus accounts. Admins search it, open the edit page, send password resets, move users to trash (suspend), restore them and wipe them permanently. The hero subtitle copy is "Create Directus accounts, assign roles, and monitor platform access." (`legacy:src/pages/Users.tsx:262-265`). The layout subtitle is "User Management" (`:219`).

### Access
- [ ] Route guard: `ProtectedRoute` only, with no role check (`legacy:src/App.tsx:413-420`, `legacy:src/components/auth/ProtectedRoute.tsx:4-21`). Any logged-in user can open `/users` by URL. The new module must declare a manage-users permission in its manifest (for example `users.manage`) and the shell must enforce it.
- [ ] Sidebar: one item `{ title: "Users", url: "/users" }` in the section labelled `"Admin"` (`legacy:src/components/dashboard/AppSidebar.tsx:103-106`). It is hidden unless `isAdmin` (`:169` `if (section.label === "Admin" && !isAdmin) return false;`). The rule is:
  `isAdmin = roleName === "administrator" || user.description === "Administrator" || (!user.description && roleName !== "")`, where `roleName` is the lower-cased Directus role name (`:150-156`). **BUG**: the third clause makes any user with an empty `description` and any role count as admin.
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`).
- [ ] Mobile sheet menu: `{ title: "User Management", url: "/users" }` is shown to **everyone** (`legacy:src/components/dashboard/DashboardLayout.tsx:44`). **BUG**: it ignores the sidebar rule.
- [ ] Global search: the navigation entry `{ title: "User Management", url: "/users", category: "Navigation" }` is shown to **everyone** (`legacy:src/components/dashboard/GlobalSearch.tsx:44,107-119`). **BUG**: it ignores the sidebar rule. There are no user records in global search.
- [ ] In-page visibility filter (client-side only) (`legacy:src/pages/Users.tsx:157-178`):
  - `myRoleName = resolveRoleName(currentUser?.role, rolesById)`. A string role is looked up in `rolesById`, an object role uses `.name`, and the fallback is `"User"` (`:53-60`).
  - `isAdmin = myRoleName === "Administrator"` (exact Directus role name, `:163`).
  - `isSupport = myRoleName.toLowerCase().includes("support")` (`:164`).
  - Row is hidden when `!isAdmin && targetRole === "Administrator"` (`:169,174`).
  - Row is hidden when `!isSupport && !isAdmin && targetIsEcapII`, where `targetIsEcapII = targetRole.toLowerCase().includes("ecap ii") || ...includes("ecapii")` (`:170-175`). This is a hardcoded other-program role marker.
  - If `currentUser` is null, all rows are shown (`:167`).
  - **BUG / QUESTION**: this test uses the Directus **role name**, while the sidebar uses `description`. AddUser gives every PMP "Administrator" the generic program user role, not the Directus "Administrator" role (see AddUser). A description-level Administrator therefore has `isAdmin=false` here, cannot see Directus-admin accounts, and cannot see legacy-program accounts. In the rebuild, use `can()` from `core/access`, and the backend must enforce which accounts are listable (Backend ask).
- [ ] Action buttons are not gated in-page: Reset, Edit, Trash, Restore and Wipe are shown for every visible row (`:455-511`). A user can trash or wipe **their own** account. **QUESTION**: block self-suspend and self-delete?
- [ ] Data scope: none. `useEffectiveDistrict` is not used. `GET /users` fetches every user nationally (`limit=-1`), and there is no province/district filter on the list. A provincial user who reaches the page by URL sees everyone except the hidden-role rows above.

### Endpoints
- [ ] `GET /users` (AUDIT.md §3.3): `listUsers()` (`legacy:src/lib/directus.ts:79-100`) is called with no status (`legacy:src/pages/Users.tsx:79-82`).
  - Params: `fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required` and `limit=-1`. There is no sort and no role filter (the role filter is commented out, `directus.ts:85-94`).
  - Key `["directus","users"]`, global defaults (staleTime 60 s, gcTime 24 h, retry 1, refetch on mount/focus/reconnect, `legacy:src/App.tsx:108-133`).
  - The query is persisted to IndexedDB under persister key `ecap-plus-pmp-react-query` (`App.tsx:140-148,216-224`), so the whole user directory, emails included, sits on disk for 24 h. The rebuild must set `meta: { persist: false }`.
  - Client-side post-processing: visibility filter, tab filter, search.
- [ ] `GET /roles` (AUDIT.md §3.3): `listRoles()` (`directus.ts:223-226`) is called with `fields=id,name&limit=100`. Key `["directus","roles"]` (`Users.tsx:84-87`). It is used only to resolve string role ids to names.
- [ ] `PATCH /users/:id {status:"suspended"}` (Move to trash): `updateUser` (`directus.ts:310-331`, id not URL-encoded) via `softDeleteMutation` (`Users.tsx:99-109`). On success it invalidates `["directus","users"]` and toasts "User moved to trash". On error it toasts `e.message` or "Failed to move user to trash".
- [ ] `PATCH /users/:id {status:"active"}` (Restore): `restoreMutation` (`Users.tsx:111-119`). Success toast "User restored successfully". Error toast is the message or "Failed to restore user". **There is no confirm dialog.**
- [ ] `POST /auth/password/request {email, reset_url}` (AUDIT.md §3.3): `requestPasswordReset` (`directus.ts:268-286`). It is a raw `fetch` with **no auth header**. `reset_url = (VITE_RESET_PASSWORD_URL || window.location.origin)` with the trailing `/` stripped, plus `/reset-password` (`Users.tsx:121-127`). Success toast "Password reset email sent". Error toast is the message or "Failed to send reset email" (`:128-132`).
- [ ] `DELETE /users/:id` with cascade (Wipe): `deleteUser` (`directus.ts:426-472`) via `deleteMutation` (`Users.tsx:135-152`).
  1. Plain `DELETE /users/:id`. If the error message is not a foreign-key error (`isForeignKeyError` matches "foreign key", "sqlite_constraint", "violates foreign key" or "update or delete on table", `:359-367`), it rethrows.
  2. Otherwise it purges notifications: for `recipient` and `sender`, `GET /notifications?filter[<f>][_eq]=<id>&fields=id&limit=200`, then a `DELETE /notifications/:id` for each (`:406-424`).
  3. It scrubs `/items/flagged_forms_ecapplus_pmp` and `/items/flagged_forms_ecapii` on fields `user_created, created_by, flagged_by, caseworker`, and `/items/calendar_events` on `user_id, user_created, created_by`. For each match (`limit=200`) it tries `DELETE /items/<c>/<id>`, falls back to `PATCH {<field>: null}`, and swallows errors (`:371-404,437-454`).
  4. It retries `DELETE /users/:id`. On another FK error it does `PATCH /users/:id {status:"suspended"}` and throws `UserHasLinkedRecordsError` (`:456-471`).
  - UI: success toast "User deleted permanently". On `UserHasLinkedRecordsError` it invalidates and shows `toast.warning("Cannot permanently delete", { description: e.message, duration: 8000 })`. Any other error toasts the message or "Failed to delete user" (`Users.tsx:137-151`).
  - **BUG**: deleting another user's flags, calendar events and notifications from the browser destroys audit data. Do **not** port the cascade. Ask the backend for a server-side "archive/delete user" operation (AUDIT.md §3.3 Server-side permissions row 11).

### Fields used
| Field | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| id | `id` | row key; edit link; mutation target | — |
| name | `first_name`, `last_name` | "User details" line 1 (`Users.tsx:417-419`); search | `[first,last].filter(Boolean).join(" ")`, fallback "Unnamed user" |
| email | `email` | "User details" line 2 with mail icon (`:421-424`); search; reset target | raw |
| role (display) | `description` | "Role" badge (`:430-435`) | `user.description \|\| "Administrator"` with CSS `capitalize`. **BUG**: an empty description is shown as "Administrator". |
| role (access) | `role` (string id → `rolesById` name, or `role.name`) | visibility filter only (`:53-60,166-177`) | — |
| province | `title` | "Province" column (`:439-443`) | `user.title \|\| "All"` |
| district | `location` | "District" column (`:446-450`) | `user.location \|\| "All"` |
| status | `status` | tab split. Active = `status === "active" \|\| !status` (`:183`). The trash count is `status === "suspended"` only (`:205-207`). | — |
| (unused) | `facility`, `avatar`, `last_access`, `password_change_required` | fetched but not displayed | — |

### Filters / sort / pagination / search
- [ ] Tabs: `Tabs` with values `"active"` (label "Active", count badge `activeCount`) and `"trash"` (label "Archived", count badge only when `trashCount > 0`) (`Users.tsx:292-319`). The default is `"active"` (`:73`). It is not persisted (local state only). The rebuild should sync the tab to the URL per the filters rule.
  - Active tab: rows where `status === "active"` or status is empty. Trash tab: **every other status** (`:183-187`), so `invited`, `draft`, `archived` and so on also appear there. **BUG**: those statuses are counted in neither badge. The hero total `activeCount + trashCount` (`:239`) excludes them.
- [ ] Search: placeholder "Search users…". The desktop input is `hidden md:block` (`:269-277`) and the mobile input is `md:hidden` (`:321-329`); both share `searchQuery`. Debounce is 300 ms (`useDebouncedValue`, `:41-48,71`). It is a case-insensitive substring match on the full name (`first last`) or the email (`:180-198`). It is not persisted.
- [ ] Sort: none. Rows keep the Directus response order, and the request sends no `sort`. **QUESTION**: default the rebuild to sort by name?
- [ ] Pagination: none. Every row is rendered, and `limit=-1` fetches all users.

### Exports
- [ ] None.

### Charts
- [ ] Hero badges: "`{activeCount + trashCount}` users" via `toLocaleString()` (`Users.tsx:234-240`). "`{trashCount}` in trash" appears only when `trashCount > 0` (`:241-248`). The hero also shows today's date via `toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })` (`:210-215,233`). In the rebuild, format it through `core/lib/format.ts`.
- [ ] Card header: "Active directory" (shield icon) or "Recycle bin" (trash icon), depending on the tab (`:342-358`).

### Links in / out
- [ ] In: sidebar (`AppSidebar.tsx:105`), mobile sheet (`DashboardLayout.tsx:44`), global search (`GlobalSearch.tsx:44`), and redirects after save, trash or cancel from AddUser (`AddUser.tsx:341,449,475`) and EditUser (`EditUser.tsx:225,237,332`). No query params, `location.state` or storage payload.
- [ ] Out: "Add User" button → `navigate("/users/new")` (`Users.tsx:278-285`). "Edit" → ``navigate(`/users/${user.id}/edit`)`` (`:471-473`). No payload.

### Loading / empty / error
- [ ] Loading: `LoadingDots` in the card header (`:359-361`) and a full-width table row with `LoadingDots` (`:379-387`). The rebuild should use skeletons.
- [ ] Empty: `UserX` icon plus text: `searchQuery ? "No matching users found." : activeTab === "active" ? "No active users found." : "Trash is empty."` (`:390-405`). **BUG**: it tests the undebounced `searchQuery`.
- [ ] Error: **not handled**. A failed `GET /users` shows the empty state (`:390`). The rebuild needs `<ErrorState>` with retry.
- [ ] Per-row buttons share one mutation's `isPending`, so one pending action disables that button on **every** row (`:462,482,495,505`).

### Bugs and quirks
- [ ] **BUG**: there is no route guard (see Access). Data restriction must be enforced by Directus permissions (AUDIT.md §3.3 Server-side permissions rows 1, 2, 5).
- [ ] **BUG**: three different "admin" definitions disagree: the sidebar uses `description` (`AppSidebar.tsx:153-156`), the user list uses the role name (`Users.tsx:163`), and `useEffectiveDistrict` uses a description substring (`legacy:src/hooks/useEffectiveDistrict.ts:8`).
- [ ] **QUESTION**: the reset confirm says "The link will expire in 24 hours." (`Users.tsx:532`). That depends on the Directus server config and is unverified.
- [ ] **BUG**: the wipe confirm says "All data associated with this user account will be permanently removed." (`:558`), but on an FK block the user is only suspended (`directus.ts:462-470`).

---

## Route `/users/new` → `/users/new`

### Purpose
Creates (or silently re-uses) a Directus account, assigns an access level and scope, and sends a "setup email", which is a Directus password-reset email, so the user can set their own password. The heading is "Add a new Directus account" (`legacy:src/pages/AddUser.tsx:438`) and the layout subtitle is "Add User" (`:418`). The page has a two-column layout: the form, and a sticky live-preview panel at `lg:grid-cols-[minmax(0,1fr)_320px]` (`:459,764`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:429-436`), so any logged-in user can open it by URL. **BUG**. In the rebuild, gate it with the same manage-users permission.
- [ ] Nav: no direct sidebar, mobile or search entry. It is reached only from the "Add User" button on `/users`.
- [ ] In-page role checks: none. Any visitor can pick "Administrator". **QUESTION**: may a non-super-admin create Administrators? (AUDIT.md §3.3 Server-side permissions row 2.)
- [ ] Data scope: the province/district/ward options are national (see Endpoints). They are not limited to the creator's own scope.

### Endpoints
- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2): `getHouseholdsByDistrict("")` (`legacy:src/lib/api.ts:301-312`).
  - The path is `/household/all-households/` (empty district means no filter, so it returns **the whole national active household register**). There is no FY.
  - Key `["districts-discovery","All"]`, `staleTime: 1h` (`AddUser.tsx:178-182`). There is also an auxiliary IndexedDB cache key `households_by_district:ALL` with a 60 s TTL (`api.ts:14,307-311`).
  - It is used only to build the province → district map and the district → ward map. **BUG/perf**: downloading the full register to build three pickers. The rebuild should take provinces/districts from `platform/scope` (config geography), and Backend ask: a lightweight geography endpoint.
- [ ] `GET /etl/facility-list` (AUDIT.md §3.2, "distinct ward names (misnamed)"): `getFacilityList()` (`api.ts:1239-1242`, skip-cache). Key `["etl","ward-list"]`, `enabled: selectedLevel === "facility"`, `staleTime: 10 min` (`AddUser.tsx:238-243`).
- [ ] `GET /roles?fields=id,name&limit=100` (AUDIT.md §3.3): key `["directus","roles"]` (`AddUser.tsx:233-236`).
- [ ] Role-id auto-detection (`:255-274`):
  - "program user" role = first role whose lower-cased name `includes("ecap+") && !includes("support")`.
  - "program support" role = first role whose name `includes("ecap+") && includes("support")`.
  - This is a hardcoded program brand string inside role matching. **The env var `VITE_DIRECTUS_USER_ROLE` (a role id, `legacy:src/lib/directus.ts:3`) is NOT used here.** In the rebuild, take the role ids from config or env (no secrets: role ids are not secret) instead of name-substring matching. **QUESTION**: confirm the env var names to use, for example `VITE_DIRECTUS_USER_ROLE` and a new support-role id variable.
- [ ] Create flow (`createMutation`, `AddUser.tsx:297-346`):
  1. `GET /users?filter[email][_eq]=<email>&fields=id,email,first_name,last_name,role` via `getUserByEmail` (`directus.ts:228-234`). The match is exact and case-sensitive on the trimmed email.
  2. The payload is `{...profilePayload, status:"active", password_change_required:false}` (`:308-312`). **No password is sent.**
  3. If the user exists: `PATCH /users/:id` with that payload (`:314-315`). **BUG**: it silently overwrites an existing account (role, scope, names) and reactivates a suspended one, with no warning. Otherwise: `POST /users` (`:317`, `directus.ts:236-254`).
  4. `POST /auth/password/request {email, reset_url}` (`:320-322`). `reset_url = (VITE_RESET_PASSWORD_URL || window.location.origin) + "/reset-password"` (`:407-411`). **BUG**: unlike `/users`, the trailing slash is not stripped, so the URL can contain `//reset-password`.
  - The success toast is always "Setup email sent" with description "The user can set a password from the email link.", because `mode` is always `"invite"` (`:326-340`). Then `navigate("/users")` (`:341`). It invalidates `["directus","users"]` (`:327`).
  - Error: `toast.error(error.message || "Failed to create user")` (`:343-345`). **BUG**: if step 4 fails, the account was already created or updated, but the UI reports a failure. A retry then takes the "existing user" path.
  - The unused native invite (`POST /users/invite`, `inviteUser`, `directus.ts:256-266`) and the broken `/accept-invite` flow are covered in the auth module (AUDIT.md §3.3 auth table).

### Form fields and validation
- [ ] Section headers: "1 Personal information · Identity", "2 Access level · Scope & permissions · Required", "3 Account activation · Invite or temporary password" (`:481-486,557-563,700-705`). The card title is "Create New Account" with sub "Three quick sections — personal, access, login" (`:471-472`), plus a "Cancel" ghost button → `/users` (`:475-477`).
- [ ] **Email address** (required, marked `*`): placeholder "email@example.com", `type="email"`, `required` (`:488-522`).
  - Live validity uses `isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` on the trimmed value (`:135,276`). The state is null when empty, then a green check or a red alert icon.
  - Helper text: "Used for login. Must be unique across all users." or, when invalid, "Doesn't look like a valid email yet." (`:516-521`).
- [ ] **First name**, **Last name**: optional, placeholders "Jane" / "Banda" (`:524-553`). They are trimmed and sent as `undefined` when empty (`:398-399`). The "Banda" placeholder is a locale-specific example name; keep placeholders neutral or take them from config.
- [ ] **Access level** (required): five cards from `ROLE_CARDS` (`:73-133`), in this order:

  | id | label | scope line | description |
  | --- | --- | --- | --- |
  | `administrator` | "Administrator" | "All regions · Global" | "Full access to every district, user, and report." |
  | `province` | "Provincial User" | "Single province" | "Access to all districts within one province." |
  | `district` | "District User" | "Single district" | "Access limited to one district's data." |
  | `facility` | "Facility User" | "One or more facilities" | "Access scoped to the facilities they're attached to." |
  | `support` | "Support User" | "Help desk · Global" | "Read-only support staff for chat and tickets." |

  - Picking `administrator` or `support` clears province, district and facility. Picking another card keeps province and district, and keeps facility only for `facility` (`:573-580`).
- [ ] **Configure scope** panel, shown when the level is province, district or facility (`:607-696`):
  - **Province** `*`: options are the sorted distinct `h.province` values from the discovery data. Only names whose first character is an uppercase letter are kept (`isCanonicalName`, `/^[A-Z]/`, `:187-192`), so lower-case typo duplicates are dropped. Placeholder "Loading…" or "Select province". Disabled while discovery loads. A change clears the district (`:621-639`).
  - **District** `*` (district and facility levels only): sorted canonical districts of the chosen province (`:194-216`). Placeholder "Loading…", "Pick a province first" or "Select district". A disabled item "No districts found" shows when the list is empty. A change clears the facility (`:642-675`).
  - **Ward** `*` (facility level only), with label note "User will only see data from the wards below" (`:677-693`). `MultiFacilityPicker` options are `/etl/facility-list` entries whose lower-cased value is among the wards seen in the households of the chosen district, each normalised with `normalizePlaceName` (`:218-231,245-253`). Picker placeholder "Select a district first" or "Select one or more wards".
    - Picker internals (`legacy:src/components/MultiFacilityPicker.tsx`): chips with remove buttons, "+ Add more", "Clear all", a search box "Search facilities…" (case-insensitive substring), list texts "Loading…" and "No matches", a footer "`n` selected", and a "Done" button. The loading trigger text is "Loading facilities…". The value is a CSV, de-duplicated and joined with `", "` (`:7-17`).
    - **QUESTION/naming**: the UI says "Ward" but the stored Directus field is `facility`, and the picker's internal copy says "facilities". The rebuild should take the label from config (domain term).
- [ ] **Account activation**: a single, always-selected, no-op card "Send setup email" with the text "The user receives an ECAP+ password setup link before first sign-in." (`:707-721`), and a note "The email link opens the ECAP+ password setup screen. No password is shared by the administrator." (`:723-730`).
- [ ] Submit button: "Send setup email" (pending: "Sending setup email" plus dots), disabled while pending (`:738-751`). The hint "⌘ + Enter to save" is shown (`:735-737`), but **no keyboard handler exists**. **BUG**: either implement Cmd/Ctrl+Enter or drop the hint.
- [ ] Submit validation, in order (`:348-394`):
  1. Email empty or no level → toast "Email and role type are required".
  2. Email fails the regex → toast "Enter a valid email address".
  3. Role resolution: `finalRoleId = programUserRoleId`. For support, `programSupportRoleId || programUserRoleId`. If it is empty → toast "Could not find a matching role in Directus." (the submit is not disabled while roles load).
  4. province: no province → "Please select a Province".
  5. district: no province → "Please select a Province"; no district → "Please select a District".
  6. facility: those two checks, then no ward → "Please select at least one facility".
- [ ] Payload mapping (`:362-405`). This is the access contract every other module reads:

  | Level | `role` | `description` | `title` (province) | `location` (district) | `facility` |
  | --- | --- | --- | --- | --- | --- |
  | administrator | program user role | `"Administrator"` | `"All"` | `"All"` | omitted |
  | province | program user role | `"Provincial User"` | chosen province | `"All"` | omitted |
  | district | program user role | `"District User"` | province | district | omitted |
  | facility | program user role | `"Facility User"` | province | district | ward CSV |
  | support | support role (fallback: user role) | `"ECAP+ Support"` | `"All"` | `"All"` | omitted |

  - **QUESTION**: Administrators get the ordinary program user Directus role, not the Directus Administrator role, so admin is purely a `description` label. Confirm this is intended, and that Directus permissions stop a plain-role user from editing users. If they do, the admin UI could not work for these admins.
  - The `description` value `"ECAP+ Support"` contains the brand. In the rebuild, map it through config. It must stay byte-identical on the wire for compatibility.

### Live preview panel (`:764-842`)
- [ ] Avatar with initials (first letters of the first and last name, upper-cased) or a placeholder icon. Full name, or a grey "Full name". The email, or "email@example.com".
- [ ] Rows:
  - "Role": the selected card label, or "Not selected".
  - "Scope": `scopeLabel` (`:284-295`): administrator → "All regions"; support → "Help desk · Global"; province → the province; district → "`<district>, <province>`"; facility → "`<n> facilities · <district>`" when more than one is picked, otherwise "`<name> · <district>`"; else "Not configured".
  - "Email": "—", "Valid" or "Invalid".
  - "Activation": "Setup email".
- [ ] Footer note: "ECAP+ sends the setup email. No password is shared by the administrator." (`:836`).

### Filters / sort / pagination / search · Exports · Charts
- [ ] None.

### Links in / out
- [ ] In: `/users` "Add User" button (`legacy:src/pages/Users.tsx:280`). No payload.
- [ ] Out: "Back to Users" (`AddUser.tsx:447-454`), "Cancel" (`:475`) and a successful create (`:341`) all → `/users`.

### Loading / empty / error
- [ ] Province and district selects show "Loading…" and are disabled while discovery loads. The ward picker shows "Loading facilities…" or "Loading…" (`:626-631,689`).
- [ ] While roles load, `LoadingDots` appears under the submit button (`:754-758`).
- [ ] Discovery or ward-list errors are not handled: the lists are just empty. A roles error leads to the "Could not find a matching role" toast on submit.

### Bugs and quirks
- [ ] **BUG (dead code)**: password fields and helpers that are never rendered: `password`/`confirm_password` state (`:44-45`), `scorePassword` (`:137-154`), `generatePassword` (`:156-166`, which uses `Math.random`), `showPassword`/`showConfirm` (`:174-175`), `pwStrength`/`pwMatch` (`:277-278`), the `ActivationMode` temporary-password branch (`:30,173,329-338`), unused icons (`KeyRound, Eye, EyeOff, Wand2`, `:8`), and the unused `roles` variable (`:361`). Do not port any of it.
- [ ] **BUG**: the existing-email overwrite and the partial failure after create (see Endpoints).
- [ ] **BUG**: the trailing slash in `VITE_RESET_PASSWORD_URL` is not stripped.

---

## Route `/users/:id/edit` → `/users/:id/edit`

### Purpose
Edit one Directus account's profile, access level, scope and (optionally) password, or move it to trash. The heading is "Edit Directus account" with sub "Update profile details, adjust access, and manage credentials." (`legacy:src/pages/EditUser.tsx:319-327`). The layout subtitle is "Edit User" (`:301`). The hero badge shows `custom_role || "Unassigned Role"` (`:296,315-317`).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:437-444`). **BUG**: any logged-in user can edit any user, **including their own role and scope**, by URL. Gate it with the manage-users permission. Backend ask: Directus must restrict `PATCH /users/:id` (AUDIT.md §3.3 Server-side permissions row 2), and `PATCH /users/me` must not allow `description/title/location` (row 3).
- [ ] Nav: none. It is reached from the "Edit" button on `/users`.
- [ ] In-page role checks: none. The visibility filter from `/users` is not applied, so a hidden admin account can be edited by id.
- [ ] Data scope: the pickers are national, as on AddUser.
- [ ] The ID comes from the route param `:id` (`useParams`, `:46`). This is correct per the rules.

### Endpoints
- [ ] `GET /users/:id` (AUDIT.md §3.3): `getUser(id)` (`legacy:src/lib/directus.ts:102-107`, id encoded), with the same `fields` as `listUsers`. Key `["directus","user", id]`, `enabled: Boolean(id)` (`EditUser.tsx:166-170`). Set `meta: { persist: false }` in the rebuild.
- [ ] `GET /roles` (key `["directus","roles"]`, `:126-129`). Role auto-detection is the same as AddUser (`:148-164`): the "ecap+" name substring, with and without "support".
- [ ] `GET /household/all-households/` discovery (key `["districts-discovery","All"]`, staleTime 1 h, `:61-65`) and `GET /etl/facility-list` (key `["etl","ward-list"]`, `enabled: formState.custom_role === "Facility User"`, staleTime 10 min, `:131-136`) (AUDIT.md §3.2). Same derivations as AddUser (`:69-146`).
- [ ] `PATCH /users/:id` save: `updateMutation` (`:219-230`). On success it invalidates `["directus","users"]` and `["directus","user", id]`, toasts "User updated successfully" and navigates to `/users`. On error it toasts the message or "Failed to update user".
- [ ] `PATCH /users/:id {status:"suspended"}` Move to Trash: `trashMutation` (`:232-242`). On success it invalidates `["directus","users"]`, toasts "User moved to trash" and navigates to `/users`. On error it toasts the message or "Failed to move user to trash".

### Form load mapping (`:172-209`)
- [ ] `role` = `data.role` (string) or `data.role.id`.
- [ ] Pseudo-role `custom_role` = `data.description`, except that `"ECAP+ Support"` → `"Support User"`.
- [ ] `province` = `data.title`, with `"All"` → `""`. `district` = `data.location`, with `"All"` → `""`.
- [ ] `facility` = `data.facility`. If it is non-empty and the pseudo-role is not "Administrator" or "Support User", the pseudo-role is forced to `"Facility User"`.
- [ ] The password field always starts empty.

### Form fields and validation
- [ ] **Email** (placeholder "Email", `type="email"`, `required`, full width). No regex beyond the browser's `type=email` validation (`:364-373`). Submit returns silently if the trimmed value is empty (`:247-249`).
- [ ] **First name**, **Last name** (placeholders "First name" / "Last name") (`:374-387`).
- [ ] **Role** select, placeholder "Select a role" (`:388-413`). Options, quoted exactly as value → label:
  - `"Administrator"` → "Administrator"
  - `"Provincial User"` → "Provincial User"
  - `"District User"` → "District User"
  - `"Facility User"` → "Facility Level User"
  - **BUG**: there is no "Support User" option. A loaded support user shows an empty select, and an admin cannot change a user to or from Support here. **QUESTION**: add Support User to match AddUser?
  - On change (`:392-401`): province is cleared for Administrator and Support; district is cleared for Administrator, Provincial and Support; facility is kept only for Facility User.
- [ ] **Province**, shown for Provincial, District and Facility users (`:416-438`). Placeholder "Loading" or "Select province". Disabled while loading. A change clears the district.
- [ ] **District**, shown for District and Facility users (`:441-466`). Placeholder "Loading", "Select a province first" or "Select district". A disabled item "No districts found" appears when empty. A change clears the facility.
- [ ] **Ward** (multi), shown for Facility users. Label "Ward" with the note "User will only see data from the wards below". `MultiFacilityPicker` placeholder "Select a district first" or "Select one or more wards" (`:469-482`).
- [ ] **New password (optional)**, `type="password"` (`:486-493`). It is sent only if `password.trim()` is non-empty, and the **trimmed** value is sent (`:289-291`). **BUG**: this trims leading and trailing spaces and does no length or strength check. ChangePassword and ResetPassword require at least 8 characters (AUDIT.md §3.3 auth table). **QUESTION**: should an admin-set password also set `password_change_required: true`? Legacy does not.
- [ ] Status is not editable here; there is a comment: "Status management is handled via list actions" (`:484`).
- [ ] Buttons: "Save Changes" (pending: "Saving" plus dots), disabled while saving or while the user loads (`:497-505`). "Move to Trash" (outline amber), which opens a confirm (`:506-514`).
- [ ] Submit validation and payload (`:244-294`):
  - Facility User: no province → toast "Please select a Province"; no district → "Please select a District"; no ward → "Please select at least one facility". Then `title = province`, `location = district`, `facility = CSV`.
  - Provincial User: `title = province || "All"`, `location = "All"`. **BUG**: no province is required, so it can save a provincial user with national scope (`"All"`). AddUser requires one.
  - District User: `title = province || "All"`, `location = district || "All"`. **BUG**: same; a district user can save with national scope.
  - Support User: `title = "All"`, `location = "All"`, `description = "ECAP+ Support"`, `role = supportRoleId || current role`.
  - Administrator or empty: `title = "All"`, `location = "All"`.
  - The payload is `{ email: trimmed, first_name: trimmed || undefined, last_name: trimmed || undefined, role: (programUserRoleId || current role) || undefined, description: custom_role || undefined, title, location, facility }`. `facility` is `""` for every non-facility role, which clears it.
  - **BUG**: `role` is **always overwritten** with the auto-detected program user role (`:255`). Saving any account that holds a different Directus role (for example the Directus Administrator role, or another program's role) silently changes its Directus role.
  - **BUG**: clearing the first or last name sends `undefined`, so the name cannot be cleared.
  - **BUG**: with an empty role, `description` is omitted (the old value is kept) but `title` and `location` are reset to `"All"`.

### Links in / out
- [ ] In: `/users` row "Edit" → ``/users/${user.id}/edit`` (`legacy:src/pages/Users.tsx:471-473`). No state payload.
- [ ] Out: "Back to Users" (`EditUser.tsx:330-337`), and a successful save or trash → `/users` (`:225,237`).

### Loading / empty / error
- [ ] While the user loads, the text "Loading user" plus `LoadingDots` appears above the form, and the form renders empty (`:357-361`). The rebuild should use a skeleton.
- [ ] Error: an inline `<p className="text-destructive">` shows `updateMutation.error.message || trashMutation.error.message` (`:517-522`), in addition to the toast. **BUG**: a failing `GET /users/:id` (for example an unknown id) is not handled, so an empty form is shown. The rebuild needs `<ErrorState>`, or a not-found state with a back link.
- [ ] There is no unsaved-changes guard.

### Bugs and quirks
- [ ] **BUG (dead code)**: `deleteUser` is imported but unused (`:18`). `rolesById` is computed but unused (`:211-217`).
- [ ] **BUG**: the trash confirm copy refers to "the Archived Users tab" (`:535`), but the tab is labelled "Archived" (`Users.tsx:311`).

---

## Other behaviour

- [ ] **Confirm dialogs** (`ConfirmDialog`, AlertDialog; cancel text defaults to "Cancel"; the destructive variant gives a red confirm button; `legacy:src/components/dashboard/ConfirmDialog.tsx:24-53`):
  - Users, reset: title "Send password reset?"; description "This will send a password reset link to `<email>`. The link will expire in 24 hours."; confirm "Send Reset Link"; variant default (`Users.tsx:524-535`).
  - Users, trash: "Move user to trash?" / "This user will be suspended and unable to log in. You can restore them later." / "Move to trash", destructive (`:537-548`).
  - Users, wipe: "Permanently delete user?" / "This action is irreversible. All data associated with this user account will be permanently removed." / "Wipe permanently", destructive (`:550-561`).
  - EditUser, trash: "Move User to Trash?" / "This user will be suspended and unable to log in. You can restore them later from the Archived Users tab." / "Move to Trash", destructive (`EditUser.tsx:527-538`).
- [ ] **Toasts** (sonner): every success and error message is quoted in the endpoint sections above.
- [ ] **Timers**: only the 300 ms search debounce (`Users.tsx:41-48`). No polling.
- [ ] **Storage**: no direct localStorage or sessionStorage use in these pages. Indirect storage:
  - The React Query IndexedDB persister (`ecap-plus-pmp-react-query`) stores `["directus","users"]`, `["directus","user",id]`, `["directus","roles"]`, `["districts-discovery","All"]` and `["etl","ward-list"]` (`App.tsx:140-148,216-224`).
  - The api.ts IndexedDB list cache stores key `households_by_district:ALL` (`api.ts:307-311`).
  - In the rebuild, the user queries must be `persist: false`.
- [ ] **Env var names used**:
  - `VITE_RESET_PASSWORD_URL` is the reset and setup link origin, falling back to `window.location.origin` (`Users.tsx:124`, `AddUser.tsx:407`).
  - `REACT_APP_BASE_URL` is the Directus base URL via `getDirectusBaseUrl()` (`legacy:src/lib/env.ts:13-14`). The error text is "REACT_APP_BASE_URL is not set" (`directus.ts:8`).
  - `VITE_DIRECTUS_USER_ROLE` is a role id, read at `directus.ts:3`. It is **not** used by the users pages (the filter in `listUsers` is commented out, `:85-94`), even though it is the natural source for the program user role id that AddUser/EditUser find by name.
  - `VITE_DEFAULT_DISTRICT` is not used by these pages.
- [ ] **Directus user fields as the access contract**: `description` = level label (`"Administrator" | "Provincial User" | "District User" | "Facility User" | "ECAP+ Support"`), `title` = province or `"All"`, `location` = district or `"All"`, `facility` = CSV of ward names. These values are read by the sidebar, `useEffectiveDistrict` and the Superset RLS heuristic, so the rebuild must write exactly these values (AUDIT.md §3.3).
- [ ] **Brand strings in this module** (move to `@/config`):
  - UI copy "Directus" (`Users.tsx:263`, `AddUser.tsx:438`, `EditUser.tsx:321`).
  - "ECAP+" in UI copy (`AddUser.tsx:718,727,836`).
  - The description value "ECAP+ Support" (`AddUser.tsx:369`, `EditUser.tsx:181,274`).
  - Role-name matchers "ecap+" (`AddUser.tsx:263,268`, `EditUser.tsx:155,158`) and "ecap ii" / "ecapii" (`Users.tsx:171-172`).
  - The comment "canonical Zambian names" (`AddUser.tsx:185`, `EditUser.tsx:68`).
  - The placeholder surname "Banda" (`AddUser.tsx:545`).
  - The date locale "en-GB" (`Users.tsx:210`, `AddUser.tsx:415`, `EditUser.tsx:298`).

## Open questions for the developer

1. Which permission gates the users module (for example `users.manage`)? Should Support users have it? Legacy shows the menu only for description-level admins (or users with no description), but the pages are open to everyone by URL.
2. Should "Administrator" users keep the generic program Directus role, with admin as a `description` label only? If so, which Directus permissions let them create and edit users?
3. Role ids: replace the "ecap+" name matching with configured ids? Which env or config names: `VITE_DIRECTUS_USER_ROLE` plus a new support-role id variable?
4. Keep hiding Directus-admin and other-program ("ECAP II") accounts from non-admins? Should the backend enforce that instead?
5. Wipe: drop the browser-side FK cascade and add a backend "delete/archive user" operation? Until then, should Wipe be hidden?
6. Adding an existing email: warn and offer "edit existing" instead of silently overwriting and reactivating?
7. EditUser: add the "Support User" option, require a province or district for scoped roles, keep the user's existing Directus role instead of forcing the program user role, enforce a minimum password length, and decide whether an admin-set password sets `password_change_required: true`.
8. Should the list support statuses other than `active` and `suspended` (`invited`, `draft`, `archived`) as their own tab or filter?
9. Should an admin be blocked from trashing, wiping or demoting their own account?
10. Should the reset confirm's "expire in 24 hours" text come from config, since the lifetime depends on Directus server config?
11. Province, district and ward pickers: use the config geography (`platform/scope`) plus `/etl/facility-list`, instead of downloading the national household register?
