# account — legacy audit

> Legacy routes → new routes: `/profile` → `/account` · Plan: MIGRATION_PLAN.md §5 row "account" ("Profile, avatar, password")

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/Profile.tsx` | 287 | Route page for `/profile`: hero, avatar upload/remove, account summary cards, reset-password button, static access notes |
| `legacy:src/components/chat/ProfilePictureModal.tsx` | 194 | Avatar view/edit dialog. Only used by `SupportCenter` chat (`legacy:src/pages/SupportCenter.tsx:20,831-847`); links to `/profile`. Support chat is dropped per decision 4, but the avatar edit flow it duplicates belongs here |
| `legacy:src/App.tsx` (lines 1-80, 430-460) | 602 | Lazy import (`:46`) and route definition (`:446-452`) |
| `legacy:src/components/dashboard/AppSidebar.tsx` (sections + footer) | 346 | Footer user chip navigates to `/profile` |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | Bottom-nav "Profile" tab |
| `legacy:src/components/dashboard/GlobalSearch.tsx` (lines 20-80) | 212 | "My Profile" navigation entry |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | Read for scope; not used by this page |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard |
| `legacy:src/lib/directus.ts` (lines 1-50, 185-290) | — | `directusRequest`, `uploadFile`, `updateUserAvatar`, `getFileUrl`, `requestPasswordReset` |
| `legacy:src/context/AuthContext.tsx` (lines 20-100) | — | `AuthUser` shape, `fetchProfile`, `refreshProfile` |

## Route `/profile` → `/account`

### Purpose
The signed-in user's own account page. It shows their name, email and role and lets them change or remove their avatar and send themselves a password-reset email. It shows no program data and does not edit other users. Rendered inside `DashboardLayout` with `subtitle="Profile"` (`legacy:src/pages/Profile.tsx:79`).

### Access
- [ ] Route guard: `ProtectedRoute` only, with no role check (`legacy:src/App.tsx:446-452`). `ProtectedRoute` returns `null` while auth is loading, redirects to `/` when there is no user, and redirects to `/change-password` when `user.password_change_required` is set (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). The page also returns `null` if `!user` (`legacy:src/pages/Profile.tsx:19-21`).
- [ ] Sidebar: no item in the `sections` lists. The footer user chip (avatar + name, or email when there is no `first_name`) runs `onClick={() => navigate("/profile")}`. It renders when `user` is set and has no role condition (`legacy:src/components/dashboard/AppSidebar.tsx:291-329`). The fallback initial is `user.first_name?.[0] ?? user.email?.[0] ?? "U"` (`:310`). Role subtitle line is commented out (`:321-325`).
- [ ] Mobile bottom nav: `{ label: "Profile", url: "/profile", icon: UserCircle2 }`, always shown below the `sm` breakpoint (`legacy:src/components/dashboard/MobileBottomNav.tsx:10,23`). Active only on an exact path match (`:20`, `end` at `:29`).
- [ ] Mobile sheet menu: `{ title: "Profile", url: "/profile", icon: UserCircle2 }`, last item, unfiltered (`legacy:src/components/dashboard/DashboardLayout.tsx:45,75`).
- [ ] Header account dropdown: "Profile" item, `onClick={() => navigate("/profile")}` (`legacy:src/components/dashboard/DashboardHeader.tsx:495-510`), under the label "My account".
- [ ] Global search: `{ title: "My Profile", url: "/profile", icon: UserCircle2, category: "Navigation" }`, unfiltered (`legacy:src/components/dashboard/GlobalSearch.tsx:45,108`).
- [ ] In-page role/permission checks: none. The only conditional control is the remove-avatar button, shown when `user.avatar` is set (`legacy:src/pages/Profile.tsx:143`).
- [ ] Data scope: none. `useEffectiveDistrict` is not used, and province/district (`title`/`location`) are not shown even though `MapPin`/`Globe` are imported (`legacy:src/pages/Profile.tsx:1`).

### Endpoints
All endpoints are Directus calls (none are DQA). See (AUDIT.md §3.3).
- [ ] `GET /users/me?fields=id,email,first_name,last_name,role.id,role.name,location,avatar,description,title,password_change_required`: this is the session profile, which `AuthContext` loads at bootstrap and reloads on `refreshProfile()` (`legacy:src/context/AuthContext.tsx:52-66,76-85`). It is state in the context, not a React Query query. The page reads `user` from `useAuth()` (`legacy:src/pages/Profile.tsx:14`).
- [ ] `POST /files`: `uploadFile(file)` (`legacy:src/lib/directus.ts:190-200`) sends multipart `FormData` with field `file`, no folder or title. `directusRequest` leaves `Content-Type` unset for FormData (`legacy:src/lib/directus.ts:28-43`) and sends `Authorization: Bearer <token>`. It fires when an image is picked (`legacy:src/pages/Profile.tsx:34`). It returns `data.data` and the page uses `.id`.
- [ ] `PATCH /users/:id` body `{ avatar: <fileId> }`: `updateUserAvatar(user.id, uploadedFile.id)` (`legacy:src/lib/directus.ts:203-212`, `legacy:src/pages/Profile.tsx:35`). The user id is not URL-encoded.
- [ ] `PATCH /users/:id` body `{ avatar: null }`: removes the avatar after a `confirm()` (`legacy:src/pages/Profile.tsx:49-54`). The old `directus_files` row is not deleted (see bugs).
- [ ] `GET /assets/:id?access_token=<token>`: URL only, built by `getFileUrl(user.avatar)` for `<AvatarImage>` (`legacy:src/lib/directus.ts:215-221`, `legacy:src/pages/Profile.tsx:74,93`). The bearer token goes in the query string.
- [ ] `POST /auth/password/request` body `{ email: user.email, reset_url: "<base>/reset-password" }`, where base is `(import.meta.env.VITE_RESET_PASSWORD_URL || window.location.origin)` with a trailing `/` stripped (`legacy:src/pages/Profile.tsx:232-236`). It uses raw `fetch` with no auth header. On a non-OK response it throws `errors[0].message` or `"Password reset request failed"` (`legacy:src/lib/directus.ts:268-286`). It fires on the "Reset password" button.
- [ ] After each avatar change: `invalidateQueries(["current-user"])` and `invalidateQueries(["users-list-chat"])`, then `await refreshProfile()` (`legacy:src/pages/Profile.tsx:37-41,55-58`). No query uses `["current-user"]` (grep only finds these invalidations), so that call does nothing. `["users-list-chat"]` is the support chat user list (`legacy:src/pages/SupportCenter.tsx:68`), which is dropped.

### Fields used
| Field | Raw keys | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| displayName | `first_name`, `last_name` | Hero h1 (fallback `"Your account"`), "Display name" card (fallback `"N/A"`) | `[first_name, last_name].filter(Boolean).join(" ")` (`legacy:src/pages/Profile.tsx:66,118,177`) |
| initials | displayName → `email` → `"U"` | Avatar fallback | first letter of each space-separated part, first 2, upper-cased (`:67-72`). When the fallback is the email, this gives one letter |
| email | `email` | Hero line with mail icon, "Email address" card | raw (`:127,184`) |
| roleLabel | `role.name` when `role` is an object; otherwise `role` or `"N/A"` | Hero badge, "Role access" card | (`:73,121,191`). Directus role name, not `description` |
| avatar | `avatar` (file id) | Avatar image; shows the remove button | `getFileUrl` (`:74,143`) |
| id | `id` | PATCH target | — |
| today | client clock | Hero date | `new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })` (`:76`). Port through `core/lib/format.ts` |

### Filters / sort / pagination / search
- [ ] None.

### Exports
- [ ] None.

### Charts
- [ ] None. The three "Account summary" cards are static info tiles with the labels `"Display name"`, `"Email address"` and `"Role access"`. The section heading is `"Account summary"` and the side caption is `"Identity & access"` (`legacy:src/pages/Profile.tsx:169-195`).

### Links in / out
- [ ] In: sidebar footer chip `navigate("/profile")` (`legacy:src/components/dashboard/AppSidebar.tsx:297`); mobile bottom nav (`legacy:src/components/dashboard/MobileBottomNav.tsx:10`); mobile sheet menu (`legacy:src/components/dashboard/DashboardLayout.tsx:45`); header dropdown "Profile" (`legacy:src/components/dashboard/DashboardHeader.tsx:502`); global search "My Profile" (`legacy:src/components/dashboard/GlobalSearch.tsx:45`); `ProfilePictureModal` "Go to Account Settings" `navigate("/profile")` (`legacy:src/components/chat/ProfilePictureModal.tsx:182`); SupportCenter "Account settings" menu item `window.location.href = "/profile"` (a full reload) when not already on it (`legacy:src/pages/SupportCenter.tsx:657-668`, dropped per decision 4). None of these pass a payload (no query params, `location.state` or storage).
- [ ] Out: none. The page has no links or navigation. The password-reset email points to `<base>/reset-password` (auth module).

### Loading / empty / error
- [ ] No loading state: the page renders `null` until `user` is present (`legacy:src/pages/Profile.tsx:19-21`), and `ProtectedRoute` renders `null` while auth loads.
- [ ] During an upload or removal, `uploading` disables both buttons and the label becomes `"Updating…"` instead of `"Change photo"` (`:137-141,147`). The hover overlay on the avatar is not disabled (`:98-101`).
- [ ] Toasts (sonner). Non-image file: `toast.error("Please select an image file")` (`:27-29`). Upload: `"Profile picture updated!"` or `"Failed to update profile picture"` (`:40,43`). Remove: `"Profile picture removed"` or `"Failed to remove profile picture"` (`:57,60`). Reset: `"Password reset email sent to your inbox"`, or an error with the Directus message or `"Failed to send reset email"` (`:237,239`).

### Bugs and quirks
- [ ] **BUG** The "Request role review" button has no `onClick` and does nothing (`legacy:src/pages/Profile.tsx:247-252`).
- [ ] **BUG** `invalidateQueries({ queryKey: ["current-user"] })` targets a key no query uses (`legacy:src/pages/Profile.tsx:37,55`; `legacy:src/components/chat/ProfilePictureModal.tsx:62,84`).
- [ ] **BUG** The "Active" badge is hardcoded and ignores the user's real status (`legacy:src/pages/Profile.tsx:112-114`).
- [ ] **BUG** The file input value is never reset, so picking the same file twice does not fire `onChange` again (`legacy:src/pages/Profile.tsx:158-164`). There is no size limit and no client-side resize or crop. Only `file.type.startsWith("image/")` is checked (`:27`).
- [ ] **BUG** Replacing or removing an avatar leaves the old `directus_files` row in place, so orphaned files pile up (`legacy:src/pages/Profile.tsx:34-35,54`).
- [ ] **BUG** The remove button has a `title` but no accessible label, and the avatar overlay is a clickable `div` that cannot be reached by keyboard (`legacy:src/pages/Profile.tsx:98-101,144-152`). The overlay also stays clickable while `uploading`.
- [ ] **BUG** The access token goes into the asset URL as `?access_token=` (`legacy:src/lib/directus.ts:215-221`), so it can leak through logs or referrers. The rebuild should use a core helper (see AUDIT.md §3.3).
- [ ] **QUESTION** The page uses the native `confirm()` dialog (`legacy:src/pages/Profile.tsx:50`). The rebuild should use a shadcn AlertDialog.
- [ ] **QUESTION** Reset password sends an email, so it does not change the password in place. A voluntary in-app change already exists through `PATCH /users/me` on `/change-password` (AUDIT.md §3.3), but nothing on this page links to it. Should `/account` have a change-password form or a link?
- [ ] Quirk: these imports are unused: `Button`, `ArrowLeft`, `MapPin`, `Globe` (`legacy:src/pages/Profile.tsx:1,5`).
- [ ] Quirk: the page text says the avatar is visible "in support chat and on the org dashboard" (`legacy:src/pages/Profile.tsx:276`). Support chat is dropped per decision 4, so the copy must change. Avatars still appear in the sidebar footer and header (AUDIT.md §3.3 `/assets/:id` row).
- [ ] Static copy to keep (or move to config/i18n): `"Security"` / `"Password and account controls"`; `"Reset password"`; `"Access notes"` / `"Permissions are synced from the server"`; `"Your permissions are synced from server. Contact an admin if role updates are required."` (`legacy:src/pages/Profile.tsx:225-270`). There are no brand or program strings.

## Component `ProfilePictureModal` (used only by the dropped SupportCenter chat)
- [ ] Props are `userId`, `currentAvatarUrl?`, `open`, `onOpenChange` and `isEditable` (default `false`) (`legacy:src/components/chat/ProfilePictureModal.tsx:11-25`). `isMe = user?.id === userId` (`:34`).
- [ ] The title is `"Update Profile Picture"` when editable and `"Profile Picture"` otherwise (`:99`). It shows a 48-unit round image of `preview || currentAvatarUrl`, or a dashed placeholder with a camera icon (`:102-126`).
- [ ] Picking a file checks for an image type (`toast.error("Please select an image file")`), then makes a data-URL preview with `FileReader.readAsDataURL` (`:36-51`). When `preview && isEditable`, a red X button clears the preview (`:110-120`).
- [ ] Editable buttons: `"Choose Photo"`, which reads `"Change Photo"` once a preview exists, and `"Save Picture"`, which reads `"Saving..."` while uploading and is disabled when `!selectedFile || uploading` (`:137-156`). "Delete Current Photo" shows when `currentAvatarUrl && !preview` (`:158-167`).
- [ ] Save runs `uploadFile`, then `updateUserAvatar(userId, file.id)`, invalidates `["users-list-chat"]` and `["current-user"]`, runs `refreshProfile()` and closes. Toasts are `"Profile picture updated!"` and `"Failed to upload profile picture"` (`:53-75`).
- [ ] Delete runs `confirm("Are you sure you want to delete your profile picture?")`, then `updateUserAvatar(userId, null)`, the same invalidations and refresh, and closes. Toasts are `"Profile picture removed"` and `"Failed to remove profile picture"` (`:77-93`).
- [ ] When `isMe && !isEditable`, it shows the hint "To manage your identity and profile picture, please visit your account settings." and a button "Go to Account Settings" that closes and runs `navigate("/profile")` (`:171-189`).
- [ ] **BUG** It PATCHes `/users/:userId` for any `userId` when `isEditable`, so the client does not enforce "own avatar only". SupportCenter sets `isEditable` only for self (`legacy:src/pages/SupportCenter.tsx:591,650`), so Directus permissions must enforce this on the server (Backend ask).
- [ ] **BUG** The "Go to Account Settings" branch can never show from SupportCenter: for self, `isEditable` is always true (`legacy:src/pages/SupportCenter.tsx:591,650,846`).
- [ ] Port guidance: drop the modal along with support chat (decision 4). Optionally reuse its select → preview → save flow as the avatar editor on `/account`, because the page uploads immediately with no preview.

## Other behaviour

- [ ] Storage: none read or written directly. Auth token is read by `getStoredToken()` from localStorage key `ecap.access_token` (`legacy:src/lib/auth.ts:1,9-20`) for the Bearer header and the asset URL.
- [ ] Timers/polling: none on the page. The hero blobs use the CSS `animate-pulse` animation (decorative, 6 s/8 s) (`legacy:src/pages/Profile.tsx:84-85`). Drop it per the UI rules.
- [ ] Env: `VITE_RESET_PASSWORD_URL` is optional (`legacy:src/pages/Profile.tsx:233`). The same pattern appears in `ForgotPassword.tsx:28`, `AddUser.tsx:407` and `Users.tsx:124`, so make it one shared helper or config value.
- [ ] Browser APIs: `window.confirm`, a hidden `<input type="file" accept="image/*">`, and `FileReader` (modal only).
- [ ] Mutations should become React Query mutations that update the session user in the auth store. `refreshProfile()` re-fetches `/users/me`.

## Open questions for the developer

- Should `/account` show the user's scope (province `title`, district `location`, `description` user type)? Legacy imports map icons but never renders them.
- Should "Request role review" be built (for example, an email/notification to admins), or removed?
- Should `/account` get a voluntary change-password form (`PATCH /users/me`) in addition to, or instead of, the reset-email button?
- Should avatar replacement delete the previous `directus_files` record, and should we add an upload size/type limit?
- Should the hardcoded "Active" badge reflect the Directus `status`, or be removed?

## Phase 5 implementation decision and status (2026-11-03)

The user approved a **read-only account page**. `module.account` remains enabled. The page reads the signed-in user's profile already loaded by `AuthProvider` from `/users/me`; it does not make an additional profile request.

- `/account` is available inside the authenticated application shell and `/profile` redirects to it. The page displays only the current session user's name, email and role, with no arbitrary user identifier.
- No avatar image, upload/removal, password reset, or other mutation is added. The legacy asset helper puts the access token in the URL, and the audit has not verified server-side own-avatar enforcement. Password controls remain deferred until a safe contract/UI is agreed.
- No `/account/:id`, `/users/:id`, or other by-ID route is added. The page is not a user-directory surface.
- Follow-up before enabling profile changes: provide own-user-only avatar update permissions; use a safe authenticated asset helper that does not expose tokens in URLs; decide between reset email and the existing backend change-password endpoint; validate uploaded file size/type and orphan cleanup policy.
