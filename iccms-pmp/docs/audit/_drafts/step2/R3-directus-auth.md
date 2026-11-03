# Step 2 draft — R3: Directus client, auth and Directus setup scripts

Scope: `legacy:src/lib/directus.ts` (all), `legacy:src/lib/auth.ts`, `legacy:src/context/AuthContext.tsx`,
`legacy:src/components/auth/ProtectedRoute.tsx`, `legacy:scripts/setup-calendar-collection.mjs`,
`legacy:scripts/setup-weekly-extract-flow.mjs`. In the script sections below, a bare `:<line>` refers to the script
named in that row or bullet. The two auth pages that call Directus directly
(`legacy:src/pages/ForgotPassword.tsx`, `legacy:src/pages/ResetPassword.tsx`) are included because they are part of
the auth flow. Directus calls made from `legacy:src/lib/api.ts` (flagged forms) belong to another part; they are only
cross-referenced here.

None of the Directus endpoints below is a DQA backend route. They go to the Directus instance, so the §3.2 table
does not apply to them. Two match neither a core Directus route nor §3.2: `acceptUserInvite` (definitely, see Issue 1)
and the unused `sendMail` (`/mail`, see Issue 12).

## Infrastructure

### Base URL
- The Directus base URL comes from env var **`REACT_APP_BASE_URL`** through `getDirectusBaseUrl()`
  (`legacy:src/lib/env.ts:13-14`). Vite ships it to the browser because `envPrefix` is `["VITE_", "REACT_"]`
  (`legacy:vite.config.ts:7`). As a result, **every** `REACT_*` variable is public, not only `VITE_*`.
- `requireDirectusUrl()` throws `"REACT_APP_BASE_URL is not set"` when the value is empty. It is defined twice, once in
  `legacy:src/lib/directus.ts:5-11` and once in `legacy:src/context/AuthContext.tsx:44-50`.
- `directus.ts` strips a trailing slash (`legacy:src/lib/directus.ts:26,218,269,292`). `AuthContext.fetchProfile`
  and `login` do not (`legacy:src/context/AuthContext.tsx:54,114`), and neither do `ForgotPassword`/`ResetPassword`
  (`legacy:src/pages/ForgotPassword.tsx:30-32`, `legacy:src/pages/ResetPassword.tsx:41`). Those two pages call
  `getDirectusBaseUrl()` directly with no "not set" check, so with an empty env value they post to a relative path
  on the SPA's own origin instead of throwing.
- Other env names read in these files: `VITE_DIRECTUS_USER_ROLE`, a role **id**. It is read into a module constant at
  `legacy:src/lib/directus.ts:3`, which is only used in an `if` block whose body is commented out (`:85-94`), so it has
  no effect there; the live reads are `:791` and `:827`. `VITE_RESET_PASSWORD_URL` is the reset-link origin and falls
  back to `window.location.origin` (`legacy:src/pages/ForgotPassword.tsx:28`, `legacy:src/pages/Users.tsx:123-126`,
  `legacy:src/pages/Profile.tsx:233`, `legacy:src/pages/AddUser.tsx:407`; AddUser does not strip a trailing slash).
  The scripts read `process.env.REACT_APP_BASE_URL`, `DIRECTUS_EMAIL` and `DIRECTUS_PASSWORD` (admin credentials)
  (`legacy:scripts/setup-calendar-collection.mjs:15-17`, `legacy:scripts/setup-weekly-extract-flow.mjs:17-19`). The
  scripts are run with `node --env-file=.env` (`legacy:package.json:15-16`), and both log the Directus URL and the
  admin email to the console (`legacy:scripts/setup-calendar-collection.mjs:28-29`,
  `legacy:scripts/setup-weekly-extract-flow.mjs:42-43`).

### Request helper `directusRequest` (`legacy:src/lib/directus.ts:21-57`)
- It reads the token through `getStoredToken()`. If there is none, it throws `"Not authenticated."` **before**
  any request is made (`:22-25`).
- It sets the header `Authorization: Bearer <token>` (`:30-32`) and merges any caller headers (`:34-39`). It sets
  `Content-Type: application/json` unless the body is `FormData` (`:29,41-43`).
- It uses plain `fetch(`${baseUrl}${path}`)` (`:45-48`), with **no timeout, no AbortSignal, no retry and no de-duplication**.
  The only retry is React Query's global `retry: 1` (`legacy:src/App.tsx:131`).
- Errors: the body goes through `safeJson` (returns null on parse failure, `:13-19`). A non-2xx response throws
  `Error(data.errors[0].message ?? "Directus request failed")` (`:52-54`). The HTTP status is lost, so callers
  cannot tell 401, 403 and 404 apart. The one exception is `deleteUser`, which matches FK error **message strings**
  (`:359-367`).
- **401/expiry handling: none.** An expired token makes every call throw, and the user stays "logged in" in
  context. Only a full reload clears it, because bootstrap `fetchProfile` then fails and calls
  `clearStoredToken()` (`legacy:src/context/AuthContext.tsx:95-101`).
- There is no debug logging in the helper. There are `console.warn`/`console.error` calls in `sendChatMessage`
  (`:175`), `triggerWeeklyFlow` (`:591`) and `notifyAllUsers` (`:619`, which **logs user emails** to the console).
- `publicBackendRequest` (`:288-301`) is a second, unauthenticated helper. It **never reads the response or checks
  `response.ok`**, and it returns `undefined`.
- Three exports bypass `directusRequest`: `requestPasswordReset` (raw `fetch`, unauthenticated, `:268-286`),
  `acceptUserInvite` (through `publicBackendRequest`, `:303-308`) and `getFileUrl`, which makes no request and only
  builds a URL (`:215-221`).

### Token handling (`legacy:src/lib/auth.ts`)
- Storage key: **`localStorage["ecap.access_token"]`** (`legacy:src/lib/auth.ts:1,20,31,40`).
- There is a module-level in-memory cache `cachedToken`, where `undefined` means "not read yet" (`:7,15-17`). Once it
  is filled it is never re-read from storage, so a logout or login in **another tab** is not seen until reload. There
  is no `storage` event listener.
- `setStoredToken` writes both the cache and storage (`:25-32`). `clearStoredToken` sets the cache to null and
  removes the key (`:34-41`).
- Only the **access token** is stored. The refresh token and `expires` from `/auth/login` are thrown away
  (`legacy:src/context/AuthContext.tsx:128`). Nothing calls `/auth/refresh` or `/auth/logout` (grep for
  `auth/refresh|refresh_token|auth/logout` in `legacy:src` returns nothing).
- The same Directus access token is also used as the DQA backend bearer token. Consumers (working-tree line numbers,
  i.e. with the uncommitted patch applied): `legacy:src/lib/api.ts:186,605,631,684,702,754,1090,1104,1284,1438`
  (`:754` is the patch's new `withTokenParam`; the others existed before the patch, shifted by 10 lines after `:750`),
  plus `legacy:src/lib/superset.ts:25`, `legacy:src/lib/ai-service.ts:15` and `legacy:src/components/EtlInvalidator.tsx:33`,
  all three of which are added by the patch (`git diff` shows `+import { getStoredToken }` in each).
  The DQA backend verifies this JWT locally with the shared secret and never calls Directus (AUDIT.md §3.1, item 2).
- Token in the URL: `getFileUrl` appends **`?access_token=<token>`** to `/assets/<id>` (`legacy:src/lib/directus.ts:215-221`).
  The resulting URL is used directly as `<img src>` and in chat file links (callers in the table).

### Security-fix patch (uncommitted `git diff`)
- The patch changes `src/lib/api.ts`, `src/lib/superset.ts`, `src/lib/ai-service.ts` and `src/components/EtlInvalidator.tsx`
  (`git diff --stat`). It touches **none** of the files in this part.
- It is relevant here only because it adds more consumers of `getStoredToken()`: an `Authorization: Bearer` header in
  `ai-service.ts`/`EtlInvalidator.tsx`, `superset.ts` now sending the token to the backend's `POST /superset/guest-token`
  instead of logging in to Superset itself, and a `withTokenParam()` helper in `api.ts` that adds `?token=` to
  download and EventSource URLs. The Directus token therefore leaks into URLs in two places: `?access_token=` for
  Directus assets (unpatched) and `?token=` for DQA downloads and SSE.

### Caches
- There is no Directus-specific cache. All Directus reads go through React Query, which is **persisted to IndexedDB for
  24 h** under the key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:140-148,214-224`). It has no per-query
  opt-out, so every successful Directus query is written to disk, including the full user directory, chat messages,
  notifications and user activity.
- Query keys used with these wrappers:
  - `["directus","users"]` (`legacy:src/pages/Users.tsx:80`)
  - `["directus","roles"]` (`legacy:src/pages/Users.tsx:85`, `legacy:src/pages/AddUser.tsx:234`, `legacy:src/pages/EditUser.tsx:127`)
  - `["directus","user",id]` (`legacy:src/pages/EditUser.tsx:167`)
  - `["users-list-chat"]` (`legacy:src/pages/SupportCenter.tsx:68`)
  - `["chat-messages", userId]` (`legacy:src/pages/SupportCenter.tsx:60`)
  - `["directus-notifications", userId]` (`legacy:src/components/dashboard/DashboardHeader.tsx:93`)
  - `["calendar-events", userId]`, shared by `legacy:src/pages/Calendar.tsx:107` and `legacy:src/hooks/useCalendarNotifications.ts:13`
  - `["calendar-events-widget", userId]` (`legacy:src/components/dashboard/CalendarWidget.tsx:17`). Calendar mutations
    invalidate only `["calendar-events"]` (`legacy:src/pages/Calendar.tsx:115,125,141`), which is not a prefix of
    this key, so the dashboard widget stays stale until its own refetch.
  - `["directus","user-activity"|"pmp-users"|"flagged-form-facilities"]` (`legacy:src/pages/DataPipelinePage.tsx:250,258,266`)
  - `["current-user"]` is invalidated after avatar changes (`legacy:src/pages/Profile.tsx:37,55`,
    `legacy:src/components/chat/ProfilePictureModal.tsx:62,84`), but no query uses that key, so those calls do nothing.
- Polling:
  - chat messages every **3 s** (`legacy:src/pages/SupportCenter.tsx:63`)
  - chat user list every 30 s (`:70`)
  - notifications every 30 s with staleTime 25 s (`legacy:src/components/dashboard/DashboardHeader.tsx:98-100`)
  - calendar every 30 s (`legacy:src/hooks/useCalendarNotifications.ts:16`)

### Auth flow end to end
1. **Bootstrap** (`legacy:src/context/AuthContext.tsx:87-107`). If no token is stored, `isLoading=false` and the
   user is null. If a token is stored, `fetchProfile(token)`. On success `setUser(profile)`. On any error
   `clearStoredToken()` and user null.
2. **Login** (`:109-146`). `POST {REACT_APP_BASE_URL}/auth/login` with body `{email, password}` (`:114-120`). The
   token is read as `data.data.access_token ?? data.access_token` (`:128`), stored (`:133`), and the profile is fetched
   (`:134`). On any failure the error message goes into `error` state, the token is cleared and the error is
   re-thrown (`:137-143`).
   - The caller `legacy:src/components/LoginCard.tsx:34-44` then writes `sessionStorage["ecap.first_login"]`,
     `localStorage["ecap.known_users"]` (a JSON array of lowercased **emails**) and `localStorage["ecap.returning_user"]`.
     It then navigates to `/change-password` if `password_change_required`, otherwise to `/dashboard`.
3. **Route guard** (`legacy:src/components/auth/ProtectedRoute.tsx:4-21`). While `isLoading` it renders `null` (`:8-10`).
   With no user it redirects to `/` (`:12-14`). If `password_change_required` and the path is not `/change-password`,
   it redirects there (`:16-18`). It does no role or permission check. Public routes: `/`, `/forgot-password`,
   `/reset-password`, `/accept-invite` (`legacy:src/App.tsx:237-243`). Every other route, including the admin pages
   `/users`, `/users/new`, `/users/:id/edit` and `/data-pipeline` (`legacy:src/App.tsx:414,430,438,526`), is wrapped
   only in `ProtectedRoute`, so any logged-in user can open them by URL. The admin/support restriction exists only as
   menu hiding in the sidebar (`legacy:src/components/dashboard/AppSidebar.tsx:153-173`).
4. **Expiry and refresh.** There is none. The expiry is never read and the refresh token is discarded (`:128`). With
   Directus's default short access-token TTL (the server config cannot be checked), calls start failing mid-session
   with the Directus error message, and the app stays on the page until the next reload.
5. **Logout** (`:148-151`). `clearStoredToken()` and `setUser(null)`, with **no network call**, so the session is
   not revoked on the server. Two callers then `navigate("/")` (`legacy:src/components/dashboard/AppSidebar.tsx:185-188`,
   `legacy:src/components/dashboard/DashboardHeader.tsx:521-523`). The third, the "Sign out instead" button on the
   forced-password page, is `onClick={logout}` with no navigate (`legacy:src/pages/ChangePassword.tsx:188-190`); the
   redirect to `/` then comes from `ProtectedRoute` once `user` is null. Even with an `/auth/logout` call, the DQA
   backend would keep accepting the JWT until it expires, because it verifies tokens locally (AUDIT.md §3.1, item 2).
   Logout does **not** clear:
   - the React Query in-memory cache or its 24 h IndexedDB copy
   - the auxiliary IDB cache
   - `ecap.known_users` / `ecap.returning_user` / `ecap.first_login`
   - the token caches of other tabs
6. **Forced password change** (`legacy:src/pages/ChangePassword.tsx:59-64`). `updateCurrentUserPassword(password)`
   sends `PATCH /users/me {password, password_change_required:false}`, then `refreshProfile()`, then navigates to
   `/dashboard`. The client checks for at least 8 characters and that the two entries match (`:45-55`). A user who
   opens the page without the flag is sent to `/dashboard` (`:36-40`).
7. **Forgot password** (`legacy:src/pages/ForgotPassword.tsx:28-61`). Inline `POST /auth/password/request
   {email (trimmed, lowercased), reset_url: <VITE_RESET_PASSWORD_URL|origin>/reset-password}`. In production it
   always shows the same success toast (no account enumeration). In dev it throws `[DEV-ONLY] <message>`.
8. **Reset password** (`legacy:src/pages/ResetPassword.tsx:15,20-65`). It reads `?token=` from the URL (toast and
   stop if missing, `:23-26`) and checks the password (entries match, then at least 8 characters, `:28-36`). It sends `POST /auth/password/reset {token, password}`, and
   on success navigates to `/` after 3 s.
9. **Admin-initiated setup** (`legacy:src/pages/AddUser.tsx:306-322`). `getUserByEmail`, then `updateUser` (if the user
   exists) or `createUser` with `status:"active", password_change_required:false`. In `"invite"` mode it then calls
   `requestPasswordReset(email, resetUrl)`, so the password reset email doubles as the invite. `ActivationMode` is the
   single literal `"invite"` and the state is never changed (`legacy:src/pages/AddUser.tsx:30,173`), so this path always
   runs and the "temporary password" branches (`:336-338`) are dead. Adding an email that already exists silently
   overwrites that user and sets it back to `active` (`:314-315`). Admins can also send a
   reset from the user list (`legacy:src/pages/Users.tsx:121-133`), and users can send one to themselves from
   Profile (`legacy:src/pages/Profile.tsx:231-236`).
10. **Directus native invite.** `inviteUser` (`POST /users/invite`) is **unused**. The `/accept-invite` page calls
    `acceptUserInvite`, which posts to a non-existent path and never fails on an HTTP error response; it rejects only on
    a network error or a missing base URL (see Issues).

### User profile fields the app reads
- `fetchProfile` fields: `id,email,first_name,last_name,role.id,role.name,location,avatar,description,title,password_change_required`
  (`legacy:src/context/AuthContext.tsx:54`). Type `AuthUser` (`:12-23`).
- Meaning, from the comments at `legacy:src/lib/directus.ts:769-770,815-816`:
  - **`description` = user level.** Exact string compares against `"District User"`, `"Provincial User"`,
    `"Administrator"`, `"Support User"`, plus substring checks (`includes("admin"|"provincial"|"province"|"district")`)
    and one lowercased equality against a brand-prefixed support label in `useEffectiveDistrict`. Seen in:
    - `legacy:src/components/dashboard/AppSidebar.tsx:155-160`
    - `legacy:src/hooks/useEffectiveDistrict.ts:7-10`
    - `legacy:src/components/dashboard/WelcomeBanner.tsx:14-21`
    - `legacy:src/components/dashboard/MetricsGrid.tsx:124`
    - `legacy:src/components/dashboard/services/ServicesPage.tsx:193-194`
    - `legacy:src/pages/Flags.tsx:37-38`
    - `legacy:src/pages/HouseholdRegister.tsx:83-84`, `legacy:src/pages/VcaRegister.tsx:128-129`
    - `legacy:src/pages/HouseholdArchivedRegister.tsx:87-88`, `legacy:src/pages/VcaArchivedRegister.tsx:138-139`
    - the four risk registers: `legacy:src/pages/VcaRiskRegister.tsx:63,76,273`,
      `legacy:src/pages/HouseholdRiskRegister.tsx:63,76,285`, `legacy:src/pages/CaregiverRiskRegister.tsx:63,72,270`,
      `legacy:src/pages/HTSRiskRegister.tsx:78,87,242`
    - `legacy:src/pages/VcaServicesDashboard.tsx:221-222`
    - `legacy:src/pages/CaseworkerJourneys.tsx:230-231`
    - `legacy:src/pages/HouseholdProfile.tsx:150`, `legacy:src/pages/VcaProfile.tsx:199`
    - display only, not a comparison: `legacy:src/pages/Documentation.tsx:65` (role-label fallback),
      `legacy:src/pages/Users.tsx:434` (shows `"Administrator"` when empty)
  - **`title` = province** (`legacy:src/components/dashboard/MetricsGrid.tsx:125`,
    `legacy:src/hooks/useEffectiveDistrict.ts:11`, `legacy:src/pages/Flags.tsx:39`, etc.).
  - **`location` = district**, with `"All"` meaning unrestricted (`legacy:src/hooks/useEffectiveDistrict.ts:12`,
    `legacy:src/components/dashboard/DashboardHeader.tsx:90`, `legacy:src/components/dashboard/GlobalSearch.tsx:52`,
    `legacy:src/pages/Districts.tsx:52`, etc.).
  - **`role` (string or `{id,name}`)**: name is compared or substring-matched at
    `legacy:src/components/dashboard/AppSidebar.tsx:150-158` (menu), `legacy:src/pages/Users.tsx:157-175` and
    `legacy:src/pages/SupportCenter.tsx:77-106` (client-side hiding of `"Administrator"` and "ecap ii"/"ecapii" roles from
    a user list that was already fetched in full), and `legacy:src/lib/directus.ts:647-655` (flag-notification
    recipients). It is only displayed at `legacy:src/pages/Profile.tsx:73` and `legacy:src/pages/Documentation.tsx:64`.
  - **`avatar`** (Directus file id), rendered through `getFileUrl` (`legacy:src/components/dashboard/AppSidebar.tsx:306`,
    `legacy:src/components/dashboard/DashboardHeader.tsx:432,467`, `legacy:src/pages/Profile.tsx:74`).
  - **`password_change_required`** (`legacy:src/components/auth/ProtectedRoute.tsx:16`, `legacy:src/components/LoginCard.tsx:42`).
- Read but **never fetched** (always `undefined`): `user.province` and `user.district`
  (`legacy:src/hooks/useEffectiveDistrict.ts:11-12`, which fall back to `DEFAULT_DISTRICT`). `facility` is also not in the
  profile `fields=`, even though user-management stores it.
- The user-management wrappers fetch more: `facility,status,last_access` (`legacy:src/lib/directus.ts:82,104`) and
  `district` (`:833`). Per the comment at `:769-770`, `district`/`facility` may hold CSV lists.
- The DQA backend derives scope from the same `description`/`role.name`/`location`/`title` (AUDIT.md §3.1, item 3,
  `lib/userScope.js`), but only `POST /superset/guest-token` uses it; no data endpoint applies user scope.

## Calls

All Directus paths are relative to `REACT_APP_BASE_URL`. "Bearer" means `directusRequest` (token required, so it throws
"Not authenticated." without one). Line numbers are in `legacy:src/lib/directus.ts` unless stated otherwise.

| Function / call site | Defined at | Method + URL template | Params sent | Target | Response handling | Callers |
| --- | --- | --- | --- | --- | --- | --- |
| `directusRequest` (internal) | `:21-57` | any, `${base}${path}` | Bearer, JSON content type unless FormData | Directus | Returns parsed JSON. Throws `errors[0].message` or "Directus request failed" | internal only |
| `listUsers(status?)` | `:79-100` | GET `/users?fields=…&limit=-1[&filter[status][_eq]=<status>]` | fields `id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required`, `limit=-1` (all). The role filter is commented out (`:85-94`) | Directus `/users` (directus_users) | `data.data ?? []`, raw objects | `legacy:src/pages/SupportCenter.tsx:69` (`"active"`), `legacy:src/pages/Users.tsx:81` (no status). Internal: `notifyAllUsers` `:597`, `notifyUsersOfFlag` `:663`, `notifyUsersOfFlagResolution` `:690` |
| `getUser(id)` | `:102-107` | GET `/users/<encodeURIComponent(id)>?fields=…` | same field list as `listUsers` | Directus `/users/:id` | `data.data` | `legacy:src/pages/EditUser.tsx:168` (passes `id ?? ""`) |
| `getChatMessages(userId)` | `:116-131` | GET `/notifications?…` | `sort=timestamp`, `limit=500`, fields `id,status,timestamp,sender,recipient,subject,message,collection,item`, `filter[recipient][_eq]=userId`, `filter[sender][_nnull]=true`, `filter[collection][_in]=support_chat,support_chat_outbox`. Returns `[]` early if no userId | Directus `/notifications` (directus_notifications) | `data.data ?? []`. Oldest first, so with more than 500 messages the **newest are cut off** | `legacy:src/pages/SupportCenter.tsx:61` (3 s poll `:63`) |
| `sendChatMessage(recipientId, message, priority="Normal", fileId?, senderId?)` | `:133-179` | GET `/users/me?fields=id` (only if no senderId), then POST `/notifications` twice | Inbox: `{recipient, sender, subject: priority, message, collection:"support_chat", item: fileId \|\| null}`. Outbox: `{recipient: sender, sender, subject: priority, message: fileId ? message+"\|\|\|FILE:"+fileId : message, collection:"support_chat_outbox", item: recipientId}` | Directus `/users/me`, `/notifications` | Returns the created inbox notification. An outbox failure is only logged with `console.warn` (`:174-176`) | `legacy:src/pages/SupportCenter.tsx:125` |
| `deleteChatMessage(id)` | `:182-187` | DELETE `/notifications/<encoded id>` | none | Directus `/notifications/:id` | void | `legacy:src/pages/SupportCenter.tsx:352` |
| `uploadFile(file)` | `:190-200` | POST `/files` | multipart, field name `file`, no folder or title | Directus `/files` (directus_files) | `data.data` (uses `.id`) | `legacy:src/components/chat/ProfilePictureModal.tsx:58`, `legacy:src/pages/SupportCenter.tsx:314,325`, `legacy:src/pages/Profile.tsx:34` |
| `updateUserAvatar(userId, fileId\|null)` | `:203-212` | PATCH `/users/<userId>` (**not encoded**) | body `{avatar}` | Directus `/users/:id` | `data.data` | `legacy:src/components/chat/ProfilePictureModal.tsx:59,82`, `legacy:src/pages/Profile.tsx:35,54` (old file not deleted) |
| `getFileUrl(fileId)` | `:215-221` | builds URL `/assets/<fileId>?access_token=<token>` (no fetch) | token in query string, fileId not encoded | Directus `/assets/:id` | `""` if no id. URL without the token if there is no token | `legacy:src/components/chat/CallOverlay.tsx:62`, `legacy:src/components/dashboard/DashboardHeader.tsx:432,467`, `legacy:src/components/dashboard/AppSidebar.tsx:306`, `legacy:src/pages/Profile.tsx:74`, `legacy:src/pages/SupportCenter.tsx:377,539,597,835`. Imported but unused at `legacy:src/components/chat/ProfilePictureModal.tsx:5` |
| `listRoles()` | `:223-226` | GET `/roles?fields=id,name&limit=100` | — | Directus `/roles` | `data.data ?? []` | `legacy:src/pages/Users.tsx:86`, `legacy:src/pages/EditUser.tsx:128`, `legacy:src/pages/AddUser.tsx:235` |
| `getUserByEmail(email)` | `:228-234` | GET `/users?filter[email][_eq]=<encoded>&fields=id,email,first_name,last_name,role` | exact email match (case-sensitive) | Directus `/users` | First match cast to `DirectusUser`, or null | `legacy:src/pages/AddUser.tsx:307` |
| `createUser(payload)` | `:236-254` | POST `/users` | `{email, first_name, last_name, role, status, password, password_change_required, description, title, location, facility}` | Directus `/users` | `data.data` | `legacy:src/pages/AddUser.tsx:317` |
| `inviteUser(email, roleId, inviteUrl)` | `:256-266` | POST `/users/invite` | `{email, role, invite_url}` | Directus `/users/invite` | Raw `data` | **UNUSED** |
| `requestPasswordReset(email, resetUrl)` | `:268-286` | POST `/auth/password/request` (raw fetch, **no token**) | `{email, reset_url}` | Directus `/auth/password/request` | `true`. Throws `errors[0].message` or "Password reset request failed" | `legacy:src/pages/AddUser.tsx:321`, `legacy:src/pages/Profile.tsx:236`, `legacy:src/pages/Users.tsx:126` |
| `publicBackendRequest` (internal) | `:288-301` | any, `${directusBase}${path}`, no token | JSON | — | **Discards the response and never checks `ok`.** Returns undefined | `acceptUserInvite` only |
| `acceptUserInvite(token, password)` | `:303-308` | POST `${REACT_APP_BASE_URL}/directus/users/invite/accept` | `{token, password}` | **NO BACKEND ROUTE.** It is sent to the Directus host, where the native route is `/users/invite/accept` with no `/directus` prefix. It is also not in §3.2: the DQA backend mounts only `/household`, `/child`, `/etl`, `/mother`, `/agent`, `/superset` (`backend:index.js:40-45`) and has no invite code (grep `invite` and `/directus` in backend `*.js`, excluding `node_modules`: no hits). Directus is therefore expected to answer 404 (inferred; the live server cannot be called). The wrapper ignores the response, so the page shows **"Invitation accepted"** although no password is set | resolves `undefined` | `legacy:src/pages/AcceptInvite.tsx:49` (passes `token ?? ""`) |
| `updateUser(id, payload)` | `:310-331` | PATCH `/users/<id>` (not encoded) | partial `{email, first_name, last_name, role, status, password, password_change_required, description, title, location, facility}` | Directus `/users/:id` | `data.data` | `legacy:src/pages/EditUser.tsx:220` (form save), `:233` (`{status:"suspended"}`), `legacy:src/pages/Users.tsx:100` (suspend), `:112` (`{status:"active"}`), `legacy:src/pages/AddUser.tsx:315` |
| `updateCurrentUserPassword(password)` | `:333-342` | PATCH `/users/me` | `{password, password_change_required:false}` | Directus `/users/me` | `data.data` | `legacy:src/pages/ChangePassword.tsx:59` |
| `UserHasLinkedRecordsError` | `:346-357` | — | — | — | Error class | `legacy:src/pages/Users.tsx:142` |
| `scrubUserReferences` (internal) | `:371-404` | GET `/items/<collection>?filter[<field>][_eq]=<encoded userId>&fields=id&limit=200`, then for each row DELETE `/items/<collection>/<id>`, falling back to PATCH `{<field>: null}` | collections and fields are passed in by `deleteUser` | Directus `/items/flagged_forms_ecapplus_pmp`, `/items/flagged_forms_ecapii`, `/items/calendar_events` | Every error is swallowed. Only the first 200 rows per field are handled | `deleteUser` |
| `purgeUserNotifications` (internal) | `:406-424` | GET `/notifications?filter[recipient\|sender][_eq]=<encoded>&fields=id&limit=200`, then DELETE `/notifications/<id>` each | — | Directus `/notifications` | Errors ignored. 200-row cap per field | `deleteUser` |
| `deleteUser(id)` | `:426-472` | DELETE `/users/<id>`. On an FK-looking error message: purge notifications; scrub `flagged_forms_ecapplus_pmp` and `flagged_forms_ecapii` (fields `user_created, created_by, flagged_by, caseworker`) and `calendar_events` (`user_id, user_created, created_by`); retry DELETE; if that fails, PATCH `{status:"suspended"}` and throw `UserHasLinkedRecordsError` | id not encoded | Directus `/users/:id`, `/notifications`, `/items/*` | void or throws | `legacy:src/pages/Users.tsx:136`. Imported but unused at `legacy:src/pages/EditUser.tsx:18` |
| `getNotifications(userId?)` | `:486-501` | GET `/notifications?…` | `filter[status][_eq]=inbox`, `filter[recipient][_eq]=userId`, `sort=-timestamp`, `limit=100`, fields `id,subject,message,timestamp,collection,sender,recipient,item`. Returns `[]` if no userId | Directus `/notifications` | Second client-side filter `n.recipient === userId` (`:500`). Chat messages (`collection` support_chat) also show here, because there is no collection filter | `legacy:src/components/dashboard/DashboardHeader.tsx:95-96` (dynamic import, 30 s poll) |
| `markNotificationRead(id)` | `:503-512` | PATCH `/notifications/<encoded>` | `{status:"archived"}` | Directus `/notifications/:id` | `data.data` | `legacy:src/components/dashboard/DashboardHeader.tsx:198` |
| `createNotification(payload)` | `:514-527` | POST `/notifications` | `{recipient, sender?, subject, message?, collection?, item?}` | Directus `/notifications` | `data.data` | No external caller (exported). Internal: `:162,166,600,674,701,850` |
| `sendMail(payload)` | `:532-543` | POST `/mail` | `{to, subject, text?, html?}` | `/mail` is **not a core Directus REST endpoint**. It would need a custom endpoint extension; none is visible, so this is unverifiable. Expect 404 → throws | raw `data` | Only `notifyAllUsers` (which is **UNUSED**), so effectively **UNUSED** |
| `clearAllNotifications(userId)` | `:550-561` | PATCH `/notifications?filter[recipient][_eq]=<userId>&filter[status][_eq]=inbox` | body `{status:"archived"}` | Directus `/notifications` (batch update) | `data.data.length` if it is an array, else 0. See Issues: the request is likely rejected as an invalid batch payload | `legacy:src/components/dashboard/DashboardHeader.tsx:211` |
| `markAllNotificationsReadForUser` | `:568` | alias of `clearAllNotifications` | — | — | — | **UNUSED** |
| `triggerWeeklyFlow()` | `:575-594` | POST `/items/weekly_extracts` | body `{}` | Directus `/items/weekly_extracts` (fires the flow from the script) | Returns hardcoded placeholders `{sent:"Queued", emailsSent:"Queued", matched:"Server-side", subject:"Weekly Extracts"}` | **UNUSED** |
| `notifyAllUsers(subject, message)` | `:596-633` | `listUsers("active")`, then one POST `/notifications` per user (`collection:"weekly_extracts"`) and one POST `/mail` per user | — | Directus `/users`, `/notifications`, `/mail` | `{sent, emailsSent, total}` from `Promise.allSettled` | **UNUSED** |
| `notifyUsersOfFlag(hhId, verifier, comment, vcaId?)` | `:657-682` | `listUsers("active")`, then POST `/notifications` per recipient | subject `Record Flagged: <VCA x (HH y) \| Household y>`, the message embeds the verifier name and comment, `collection:"flagged_forms_ecapplus_pmp"`. `vcaId === "Not Available"` is treated as absent | Directus `/users`, `/notifications` | `Promise.allSettled` results, so failures are silent. Recipients are chosen by role-name keyword match (`:638-655`) | `legacy:src/pages/FlaggedRecordForm.tsx:75`, `legacy:src/pages/VcaProfile.tsx:364`, `legacy:src/pages/HouseholdProfile.tsx:282` |
| `notifyUsersOfFlagResolution(...)` | `:684-709` | same as above | subject `Flag Resolved: …` | Directus `/users`, `/notifications` | same | `legacy:src/pages/Flags.tsx:175`, `legacy:src/pages/VcaProfile.tsx:334`, `legacy:src/pages/HouseholdProfile.tsx:308` |
| `getCalendarEvents(userId)` | `:722-732` | GET `/items/calendar_events?…` | `filter[user_id][_eq]=userId` (no guard for `""` in the wrapper, unlike `getChatMessages`; every caller sets `enabled: !!user?.id`), fields `id,title,description,start_time,end_time,category,user_id,status`, `sort=start_time`, **no limit**, so the Directus default (normally 100) applies | Directus `/items/calendar_events` | `data.data ?? []` | `legacy:src/hooks/useCalendarNotifications.ts:14` (30 s poll), `legacy:src/components/dashboard/CalendarWidget.tsx:18`, `legacy:src/pages/Calendar.tsx:108` |
| `createCalendarEvent(payload)` | `:734-740` | POST `/items/calendar_events` | `Partial<CalendarEvent>`: title, description, start_time, end_time, category, user_id, status | Directus | `data.data` | `legacy:src/pages/Calendar.tsx:113` |
| `updateCalendarEvent(id, payload)` | `:742-751` | PATCH `/items/calendar_events/<id>` | partial | Directus | `data.data` | `legacy:src/pages/Calendar.tsx:139` |
| `deleteCalendarEvent(id)` | `:753-757` | DELETE `/items/calendar_events/<id>` | — | Directus | void | `legacy:src/pages/Calendar.tsx:123` |
| `listUserActivity(limit=500)` | `:788-808` | GET `/activity?…` | fields `id,action,collection,timestamp,user.id,user.first_name,user.last_name,user.email,user.district,user.facility,user.location,user.title,user.description`, `sort=-timestamp`, `limit`, `filter[user][role][_eq]=<VITE_DIRECTUS_USER_ROLE>`, `filter[collection][_nin]=case_management,finance,stores,human_resource,procurement`. Throws if the env var is missing or contains `<` | Directus `/activity` (directus_activity) | `data.data ?? []` | `legacy:src/pages/DataPipelinePage.tsx:251` |
| `listPmpUsers()` | `:826-840` | GET `/users?…` | fields `id,first_name,last_name,email,title,location,district,facility,description,last_access,status`, `sort=first_name`, `limit=500`, `filter[role][_eq]=<VITE_DIRECTUS_USER_ROLE>` | Directus `/users` | `data.data ?? []` | `legacy:src/pages/DataPipelinePage.tsx:259` |
| `broadcastAnnouncement(ids, subject, message)` | `:843-855` | POST `/notifications` per id | `{recipient, subject, message}` | Directus `/notifications` | `{sent, failed}` | **UNUSED**: only in commented-out JSX (`legacy:src/pages/DataPipelinePage.tsx:2246`), but still imported at `:69` |
| `listFlaggedFormFacilities()` | `:861-869` | GET `/items/flagged_forms_ecapii?fields=id,facility&limit=1000` | — | Directus `/items/flagged_forms_ecapii` | `data.data ?? []`. Truncates silently above 1000 | `legacy:src/pages/DataPipelinePage.tsx:267` |
| `fetchProfile(token)` (internal) | `legacy:src/context/AuthContext.tsx:52-69` | GET `/users/me?fields=id,email,first_name,last_name,role.id,role.name,location,avatar,description,title,password_change_required` | Bearer header (raw fetch) | Directus `/users/me` | `data.data ?? null`. Throws `errors[0].message` or "Failed to load profile" | `refreshProfile` (`:83`), bootstrap (`:96`), `login` (`:134`) |
| `login(email, password)` | `legacy:src/context/AuthContext.tsx:109-146` | POST `/auth/login` | `{email, password}` (sent as typed, not trimmed). No `mode` param, so the default JSON mode | Directus `/auth/login` | Reads `data.data.access_token ?? data.access_token`. Ignores `refresh_token` and `expires`. Returns the profile | `legacy:src/components/LoginCard.tsx:34` |
| `refreshProfile()` | `legacy:src/context/AuthContext.tsx:76-85` | → `fetchProfile` | — | Directus `/users/me` | `setUser`. Errors propagate to the caller | `legacy:src/components/chat/ProfilePictureModal.tsx:65,86`, `legacy:src/pages/Profile.tsx:41,58`, `legacy:src/pages/ChangePassword.tsx:60` |
| `logout()` | `legacy:src/context/AuthContext.tsx:148-151` | no network | — | — | Clears the token key and user state | `legacy:src/components/dashboard/AppSidebar.tsx:186`, `legacy:src/components/dashboard/DashboardHeader.tsx:522`, `legacy:src/pages/ChangePassword.tsx:190` |
| ForgotPassword submit (inline) | `legacy:src/pages/ForgotPassword.tsx:32-38` | POST `/auth/password/request` | `{email: trimmed+lowercased, reset_url}` | Directus `/auth/password/request` | Production always shows success | page itself (route `/forgot-password`) |
| ResetPassword submit (inline) | `legacy:src/pages/ResetPassword.tsx:41-47` | POST `/auth/password/reset` | `{token (from ?token=), password}` | Directus `/auth/password/reset` | Throws `errors[0].message` or "Reset failed" | page itself (route `/reset-password`) |
| `getStoredToken` / `setStoredToken` / `clearStoredToken` | `legacy:src/lib/auth.ts:9-41` | localStorage `ecap.access_token` | — | — | — | `getStoredToken`: see the Token handling list. `set`/`clear`: `legacy:src/context/AuthContext.tsx:99,133,140,149` only |
| `ProtectedRoute` | `legacy:src/components/auth/ProtectedRoute.tsx:4-21` | no network | — | — | null while loading; redirects to `/` or `/change-password` | every route in `legacy:src/App.tsx:244-588` (all except the four public ones and the `*` catch-all at `:590`) |
| Cross-ref (other part): `getFlaggedRecords`, `createFlaggedRecord`, `updateFlagStatus` | `legacy:src/lib/api.ts:604-628,630-…,1283-…` | GET, POST and PATCH `/items/flagged_forms_ecapplus_pmp[/<id>]` | raw fetch with Bearer, bypassing `directusRequest` | Directus | covered by the api.ts part | — |

### Script calls (Node, admin token, run by hand)

| Call site | Method + URL | Body / notes | Target |
| --- | --- | --- | --- |
| `login()` `legacy:scripts/setup-calendar-collection.mjs:27-46`, `legacy:scripts/setup-weekly-extract-flow.mjs:41-62` | POST `/auth/login` | `{email: DIRECTUS_EMAIL, password: DIRECTUS_PASSWORD}`. Reads the response body's `data.access_token` (`calendar :42`, `weekly :58`). No trailing-slash stripping on the base URL, except for one weekly call (`weekly :160`) | Directus |
| calendar `:58-70` | POST `/collections` | `{collection:"calendar_events", meta:{icon, note, display_template:"{{title}}"}, schema:{}}`. **Any** 400 is treated as "already exists" (`:74`) | Directus |
| calendar `:123-134` | POST `/fields/calendar_events` ×7 | field definitions below. Non-2xx responses are not checked (only a success line is logged, `:130`) and network errors are caught and ignored (`:131-133`) | Directus |
| calendar `:139-194` | GET `/roles`, then 4 × POST `/permissions` per non-"Administrator" role, each with `role: role.id` | read, update and delete use `{user_id:{_eq:"$CURRENT_USER"}}`; create uses `{}` (no preset or validation). No `fields` key. Responses are never checked (`.catch(() => {})` only) and "Permissions updated" is logged regardless (`:193`). No check for existing rows, so a re-run adds duplicates | Directus |
| weekly `:150-157` | POST `/collections` | `{collection:"weekly_extracts", meta:{icon:"bolt", note}}`, **no `schema` key**. Errors swallowed | Directus |
| weekly `:160-168` | POST `/fields/weekly_extracts` | `{field:"triggered_at", type:"timestamp", meta:{hidden:true}}` | Directus |
| weekly `:172-211` | GET `/roles`, GET `/permissions?filter[collection][_eq]=weekly_extracts`, POST `/permissions` | grants **create** and **read** with `{}` to every non-Administrator role, skipping ones that already exist | Directus |
| weekly `:214-230` | POST `/flows` | `{name, description, status:"active", trigger:"action", accountability:"all", options:{collection:"weekly_extracts", action:"create"}}` | Directus |
| weekly `:255-272` | POST `/operations` | `type:"mail"`, key `send_weekly_email`. `options.to` = hardcoded distribution list joined with "," (**3 hardcoded personal/company email addresses**, `:32-36`). `subject:"{{notify_team.subject}}"`. HTML body with hardcoded brand and company strings (`:243-253`) | Directus |
| weekly `:283-298` | POST `/operations` | `type:"exec"`, key `notify_team`, `options.code` = `buildExecCode()` (`:67-136`), `resolve: mailOp.id` | Directus |
| weekly `:310-314` | PATCH `/flows/<id>` | `{operation: execOp.id}` (entry point) | Directus |
| exec script (runs inside Directus) `:72-134` | GET `<$env.PUBLIC_URL\|$env.DIRECTUS_URL\|setup-time REACT_APP_BASE_URL>/users?filter[status][_eq]=active&fields[]=id,email&limit=-1`, then POST `/notifications` per user whose email is on the distribution list | The third URL fallback is the script's own `REACT_APP_BASE_URL`, interpolated into the stored code when the script runs (`:74`), not a literal in the source. Uses `data.$accountability.token` as the bearer (`:76`). Message `collection:"weekly_extracts"` (`:126`). Subject `"<brand> weekly data extracts - <date>"` (`:113`). The distribution list is embedded as JSON (`:84`) | Directus (from inside the flow) |

### Directus collections and schemas

- **`calendar_events`** (created by `legacy:scripts/setup-calendar-collection.mjs:58-121`). The PK is the Directus default
  (`schema:{}` gives an auto-increment integer `id`, although the TS type says `id: string`, `legacy:src/lib/directus.ts:712`).
  | field | type | meta |
  | --- | --- | --- |
  | `title` | string | input, required |
  | `description` | text | textarea |
  | `start_time` | timestamp | datetime |
  | `end_time` | timestamp | datetime |
  | `category` | string | select-dropdown: `Meeting`, `Field Visit`, `Deadline`, `Personal` |
  | `user_id` | uuid | `select-dropdown-m2o` to `directus_users` (interface only; **no `/relations` call**, so there is no real FK) |
  | `status` | string, default `scheduled` | select-dropdown: `scheduled`, `cancelled`, `completed` |
  The app reads and writes all 7 fields plus `id` (`legacy:src/lib/directus.ts:711-720,725`). `deleteUser` also
  scrubs `user_created`/`created_by` (`:450-454`), which the script never creates.
- **`weekly_extracts`** (`legacy:scripts/setup-weekly-extract-flow.mjs:150-168`) has meta only plus `triggered_at`
  (timestamp, hidden). The app writes `{}` (`legacy:src/lib/directus.ts:579-582`, unused). The `POST /collections` body
  has no `schema` key (`:153-156`); in Directus that creates a folder-only collection with no table, so if the
  collection did not already exist the field and item writes would fail (inferred from Directus's collection API; the
  script comment at `:149` assumes the collection usually exists already).
- **`directus_notifications`** is used as the in-app inbox **and** as chat storage. The app uses fields `id, status
  (inbox|archived), timestamp, sender, recipient, subject, message, collection, item` (`legacy:src/lib/directus.ts:474-484`).
  `collection` holds logical tags, not real collection names: `support_chat`, `support_chat_outbox`, `weekly_extracts`,
  `flagged_forms_ecapplus_pmp`, or none for announcements. `subject` holds the chat **priority** (`:156`). `item`
  holds a file id (inbox) or the partner user id (outbox) (`:159,172`).
- **`directus_users`**: fields as listed above. `facility`, `district` and the meaning of `title`/`location` are
  custom (`:769-770,815-816`).
- **`directus_roles`** (`id,name`), **`directus_files`/`/assets`**, **`directus_activity`**.
- **`flagged_forms_ecapplus_pmp`** and **`flagged_forms_ecapii`**. This part reads only `id`, `facility` and the user
  reference fields `user_created, created_by, flagged_by, caseworker`. The full schema is not created by any script.
- **Flows**: one flow, "Weekly Extract Notifications", with operations `notify_team` (exec) → `send_weekly_email` (mail).

## Issues

1. **Invite acceptance is broken and reports success.** `acceptUserInvite` posts to `/directus/users/invite/accept` on
   the Directus host (`legacy:src/lib/directus.ts:303-307`), but Directus's route is `/users/invite/accept` and no DQA
   route exists. `publicBackendRequest` never checks the response (`:294-301`), so `legacy:src/pages/AcceptInvite.tsx:49-53`
   always shows "Invitation accepted" and the user has no password. Meanwhile `inviteUser` (`:256-266`) is unused. The
   real onboarding path is `createUser` plus `requestPasswordReset` (`legacy:src/pages/AddUser.tsx:306-322`).
2. **No token refresh or expiry handling.** `refresh_token` and `expires` are discarded (`legacy:src/context/AuthContext.tsx:128`).
   A 401 is not detected (status is lost at `legacy:src/lib/directus.ts:52-54`), so mid-session expiry shows raw
   Directus error toasts and empty data with no redirect to login. The new app needs refresh, or at least a 401 →
   logout path.
3. **Logout clears too little.** It clears only `ecap.access_token` (`legacy:src/context/AuthContext.tsx:148-151`). There
   is no `/auth/logout` call. The React Query cache, **persisted to IndexedDB for 24 h with no per-query opt-out**
   (`legacy:src/App.tsx:140-148,214-224`), keeps the previous user's directory, emails, chat, notifications and activity
   for the next person on the same browser. Keys such as `["directus","users"]` and `["users-list-chat"]` are not
   user-scoped. `localStorage["ecap.known_users"]` keeps a list of every email that has logged in on the device
   (`legacy:src/components/LoginCard.tsx:39-40`).
4. **Token in URLs.** `getFileUrl` adds `?access_token=<jwt>` to every avatar and chat-file URL
   (`legacy:src/lib/directus.ts:215-221`). Because the token never refreshes, this full session token ends up in
   browser history, Referer headers and proxy logs. The same token is the DQA bearer, and the patch adds `?token=`
   there too.
5. **Cross-tab state goes stale.** The `cachedToken` module cache (`legacy:src/lib/auth.ts:7,15-17`) has no
   `storage` listener. Logging out in one tab leaves other tabs sending the old token.
6. **Profile fields read but never fetched.** `useEffectiveDistrict` reads `user.province` and `user.district`
   (`legacy:src/hooks/useEffectiveDistrict.ts:11-12`), which are not in `fetchProfile`'s `fields=`
   (`legacy:src/context/AuthContext.tsx:54`), so they are always undefined and the hook falls back to `DEFAULT_DISTRICT`.
   `facility` is stored per user but not loaded into the session.
7. **Access decisions by string comparison** on `description`/`role.name`. There are many exact-string checks
   (see Profile fields), and they disagree: `"Provincial User"` exact vs `.includes("provincial")`, and an admin is
   "no description and any role" (`legacy:src/components/dashboard/AppSidebar.tsx:155-156`). Flag-notification
   recipients are picked by role-name **substring** (`"qa"`, `"manager"`, ...) on the client
   (`legacy:src/lib/directus.ts:638-655`).
8. **Whole user directory exposed to every user.** `notifyUsersOfFlag`/`notifyUsersOfFlagResolution` call
   `listUsers("active")` with `limit=-1` and fields including email, location, `last_access` and
   `password_change_required` (`legacy:src/lib/directus.ts:79-100,663,690`). This works only if every flagging role can
   read all of `directus_users`. Directus permissions cannot be checked from here. Fan-out happens in the browser:
   N POSTs, failures swallowed by `allSettled`. The Support Center chat list uses the same full `listUsers("active")`
   response and hides administrator and "ecap ii" roles only in the browser (`legacy:src/pages/SupportCenter.tsx:67-106`);
   the Users page does the same (`legacy:src/pages/Users.tsx:162-178`). The hidden records are still in the response
   and in the persisted query cache.
9. **Client-chosen sender and recipient.** `sendChatMessage` sets `sender` from the client (`:153-160`), and any user
   can `createNotification` to any recipient. Unless Directus permissions preset `sender=$CURRENT_USER`
   (unverifiable), notifications can be spoofed. The outbox copy encodes the file as `message+"|||FILE:<id>"` while the
   inbox uses `item` (`:159,170`). `item` means different things in each copy, and `subject` holds the priority. The
   inbox and outbox writes are not atomic (`:164-176`). The payload is `any` (`:153`).
10. **`clearAllNotifications` probably does not do what it says.** It sends `PATCH /notifications?filter[...]` with
    body `{status:"archived"}` (`:552-559`). Directus batch updates take an array of items, `{keys, data}` or
    `{query, data}` **in the body**, and do not read URL filters for PATCH. This body has neither `keys`/`query` nor
    `data`, so the most likely result is a 400 invalid-payload error and the "Couldn't clear notifications" toast
    (`legacy:src/components/dashboard/DashboardHeader.tsx:218-220`). Because there is no `data`, a mass archive of other
    users' notifications is unlikely even if some version accepted the request. This is inferred from Directus's
    documented batch API and needs checking against the live Directus version. The return value (`data.data.length`) assumes the response is an
    array of items. The UI toast uses it (`legacy:src/components/dashboard/DashboardHeader.tsx:211-215`).
11. **`deleteUser` deletes domain data from the browser.** On an FK error it **deletes** flagged-form rows where the
    user is `caseworker`/`flagged_by`/`created_by`/`user_created`, in both flagged-forms collections
    (`legacy:src/lib/directus.ts:438-449`). Only if the delete fails does it null the field instead (`:385-397`).
    Audit data is lost when a user is deleted. Every error is swallowed, and each field is capped at 200 rows
    (`:379,410`), so the cleanup can be partial before the final suspend fallback (`:462-470`). The new app should ask
    for a backend-side "archive user" operation.
12. **`sendMail` targets `/mail`** (`:538`), which is not a core Directus endpoint. It is reachable only through the
    unused `notifyAllUsers`. Dead code, together with `triggerWeeklyFlow`, `markAllNotificationsReadForUser`,
    `inviteUser`, `broadcastAnnouncement`, and `createNotification` as an export.
13. **Duplicated wrappers and helpers.**
    - Password reset request: `requestPasswordReset` (`:268-286`, throws on error) vs inline in
      `legacy:src/pages/ForgotPassword.tsx:32-51` (swallows errors in production on purpose). The admin and Profile paths
      reveal Directus errors.
    - `/users/me` is called in three places with different field sets: `AuthContext.tsx:54`, `directus.ts:144`
      (`fields=id`) and `:334` (PATCH).
    - `safeJson`/`requireDirectusUrl` exist in both `directus.ts:5-19` and `AuthContext.tsx:36-50`.
    - Flagged-forms Directus calls in `legacy:src/lib/api.ts:604-640,1283-1295` skip `directusRequest` and use their
      own error handling.
    - Two cache entries for the same user list: `["directus","users"]` and `["users-list-chat"]`.
14. **Encoding is inconsistent.** `getUser`, `deleteChatMessage` and `markNotificationRead` encode ids. `updateUser`,
    `updateUserAvatar`, `deleteUser`, the calendar mutations and `getFileUrl` do not (`:207,326,429,746,754,219`).
15. **Silent truncation.**
    - `getChatMessages` sorts ascending with `limit=500` (`:120-121`), so it returns the **oldest** 500 and drops new
      messages in long histories. It polls every 3 s (`legacy:src/pages/SupportCenter.tsx:63`).
    - `getCalendarEvents` has no limit (Directus default).
    - `listRoles` limit is 100, `listPmpUsers` 500 and `listFlaggedFormFacilities` 1000.
16. **Weak login and reset validation.** `login` sends the email untrimmed while ForgotPassword lowercases it. The
    `useMemo` deps omit the functions (`legacy:src/context/AuthContext.tsx:162`), which is harmless today.
    `ProtectedRoute` renders `null` while loading, so the screen is blank (`legacy:src/components/auth/ProtectedRoute.tsx:8-10`).
17. **Problems in the weekly-flow script** (`legacy:scripts/setup-weekly-extract-flow.mjs`):
    - **The schedule claims are false.** The comments and logs say "every Monday 08:00" (`:4,240,323`), but no
      schedule trigger is configured (`:223-228`).
    - **The trigger probably never fires.** `trigger:"action"` with `options.{collection,action}` is not Directus's
      event-trigger shape. Directus expects `trigger:"event"` with `options:{type:"action", scope:["items.create"],
      collections:[...]}`, so the flow likely never fires. This cannot be verified against the server.
    - **The exec script may not work.** It relies on `fetch` and `$accountability.token` inside the Run Script
      sandbox (`:76,89,119`). Recent Directus versions run that script in an isolated sandbox that may provide
      neither (version-dependent; cannot be verified against the server).
    - **It is not idempotent.** Every run creates another flow and two more operations (`:214,255,283`).
    - **Any user can trigger the mail blast.** Every non-admin role gets `create` on `weekly_extracts` (`:181-194`),
      so any user can fire the email flow repeatedly.
    - **Hardcoded data.** The distribution list holds 3 email addresses (`:32-36`), the HTML body has brand and company
      strings (`:243-253`), and the subject line has the brand name (`:113`). The exec code's third URL fallback
      (`:74`) is not a source literal: it bakes the setup-time `REACT_APP_BASE_URL` into the code stored in Directus.
      None of this may be carried over.
18. **Problems in the calendar script** (`legacy:scripts/setup-calendar-collection.mjs`):
    - The `create` permission has neither a `user_id` preset nor validation (`:158-167`), so a user can create events
      owned by someone else. Read, update and delete are restricted to the owner (`:153,177,189`).
    - No `fields` are set on the permissions, and permissions are posted with `role: role.id` (`:150,162,174,186`).
      Directus 11 attaches permissions to policies, not roles, so on that version these POSTs would be rejected.
      Both points depend on the live Directus version, which cannot be checked.
    - Permission responses are never checked (`.catch(() => {})` only, `:155,167,179,191`), "Permissions updated" is
      logged regardless (`:193`), and a re-run inserts duplicate permission rows (no existence check, unlike the weekly
      script at `:175-196`).
    - `user_id` is not a real relation.
    - Any 400 is treated as "already exists" (`:74`).
    - Field creation errors are swallowed: non-2xx responses are not checked and network errors are ignored (`:130-133`).
19. **Credentials and config.** The scripts need **Directus admin email and password** in the frontend repo's `.env`
    (`legacy:scripts/setup-calendar-collection.mjs:11-17`). They are not `VITE_`/`REACT_`-prefixed, so they are not
    bundled, but they sit next to browser config, which breaks rule 5 for the new app; such scripts belong in a
    separate ops repo. `envPrefix` includes `REACT_` (`legacy:vite.config.ts:7`), which widens what gets shipped.
    `VITE_DIRECTUS_USER_ROLE` (a role id) is shipped. It is not secret, but the app uses it as an implicit access
    filter (`legacy:src/lib/directus.ts:791-801,827-837`).
20. **Activity feed permissions.** `listUserActivity` reads `directus_activity`, filters by the user's role through
    the relation, and excludes non-PMP collections (`:780-806`). Reading activity normally needs admin-level
    permissions, so whether this works for non-admins depends on unverifiable Directus permissions. It also returns
    other users' emails.
