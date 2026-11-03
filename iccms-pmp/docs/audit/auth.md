# auth — legacy audit

> New module `auth` (core, always on; lives in `core/auth` per MIGRATION_PLAN.md §4.5 / Phase 3) · Legacy routes → new routes:
> `/` → `/login` (and `/` itself redirects to `/dashboard` or `/login`), `/forgot-password` → `/forgot-password`,
> `/reset-password` → `/reset-password`, `/accept-invite` → `/accept-invite`, `/change-password` → `/change-password` ·
> Plan: MIGRATION_PLAN.md §5 row "auth" · Directus contracts: AUDIT.md §3.3 "Client and auth" (all auth calls go to
> Directus, none to the DQA backend, so none of them appear in AUDIT.md §3.2).

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/Index.tsx` | 49 | `/` login page shell: aurora background, `LoginCard`, right image slider + marketing copy, `VersionFooter` |
| `src/components/LoginCard.tsx` | 179 | Login form, "returning user" heuristic, post-login redirect, storage writes |
| `src/pages/ForgotPassword.tsx` | 146 | `/forgot-password`: request reset email (inline Directus call) |
| `src/pages/ResetPassword.tsx` | 169 | `/reset-password?token=`: set a new password from the emailed token |
| `src/pages/AcceptInvite.tsx` | 199 | `/accept-invite?token=`: accept invite (calls a non-existent path, see Bugs) |
| `src/pages/ChangePassword.tsx` | 221 | `/change-password`: forced password change for `password_change_required` users |
| `src/components/RightImageSlider.tsx` | 73 | Auto-rotating background photo slider used on all five auth pages |
| `src/components/aceternity/AuroraBackground.tsx` | 30 | Decorative page background; used by all five auth pages and `LoadingScreen` |
| `src/components/aceternity/LoadingDots.tsx` | 17 | Three bouncing dots; used by `LoginCard`, `ChangePassword` and ~35 app pages/components |
| `src/components/aceternity/GlowCard.tsx` | 37 | Card wrapper; used across the app (not by auth pages) |
| `src/components/aceternity/GlowHeader.tsx` | 25 | App header wrapper; used only by `src/components/dashboard/DashboardLayout.tsx` |
| `src/components/aceternity/LoadingScreen.tsx` | 34 | Full-page loader. **Unreferenced** (no importer in `src`) |
| `src/components/aceternity/SpotlightCard.tsx` | 22 | **Unreferenced** |
| `src/components/aceternity/Title.tsx` | 22 | **Unreferenced** |
| `src/context/AuthContext.tsx` | 174 | `AuthProvider` / `useAuth`: bootstrap, login, logout, refreshProfile, `GET /users/me` |
| `src/lib/auth.ts` | 41 | Token storage (`localStorage["ecap.access_token"]` + in-memory memo) |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Route guard: auth + forced-password-change redirect; no role checks |
| `src/App.tsx` | 602 | Router (read in full): which auth routes are public/guarded, lazy loading, providers |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Read in full: logout button; no auth-route nav entries |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Read in full: no auth-route entries, no logout |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Read in full: no auth-route entries |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Read in full: consumes session profile fields (not used by auth pages) |
| `src/lib/directus.ts` (lines 1-58, 256-345) | 880+ | `directusRequest`, `requestPasswordReset`, `publicBackendRequest`, `acceptUserInvite`, `updateCurrentUserPassword` |
| `src/lib/env.ts` | 17 | `getDirectusBaseUrl()` = env `REACT_APP_BASE_URL` |
| `src/components/VersionFooter.tsx` | 27 | Fixed footer on all five auth pages |
| `src/components/dashboard/WelcomeBanner.tsx` (lines 1-40) | — | Reader of `sessionStorage["ecap.first_login"]` |
| `src/components/dashboard/DashboardHeader.tsx` (lines 500-535) | — | Second logout entry point |
| `src/pages/NotFound.tsx` | 24 | Links to `/` |
| `src/pages/Profile.tsx` (lines 220-250) | — | Self-service "Reset password" email (links users into `/reset-password`) |
| `src/components/EtlInvalidator.tsx` (lines 1-60) | — | Token consumer; polls even on auth pages (skips the request without a token) |

## Route `/` → `/login`

### Purpose
Sign-in page. Two-column layout on `lg+`: left = glass `LoginCard`; right = rotating photo slider with marketing copy
(`legacy:src/pages/Index.tsx:10-41`). The right column is hidden below `lg` (`:21` `hidden lg:block`). Fixed
`VersionFooter` at the bottom (`:44`).

### Access
- [ ] Route guard: **public**, no guard and **no redirect when already logged in** (`legacy:src/App.tsx:237`). New
  behaviour per plan: `/` redirects to `/dashboard` (authenticated) or `/login` (anonymous); `/login` with a valid
  session should also go to `/dashboard` (or `/change-password` if `password_change_required`).
- [ ] Eagerly loaded (not lazy), together with Dashboard (`legacy:src/App.tsx:17-20`).
- [ ] Sidebar / mobile nav / global search: no entry for `/` (`legacy:src/components/dashboard/AppSidebar.tsx:45-114`,
  `legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`, `legacy:src/components/dashboard/GlobalSearch.tsx:33-46`).
- [ ] In-page role checks: none.
- [ ] Data scope: none (no data requests).

### Endpoints
- [ ] `POST /auth/login` (Directus, AUDIT.md §3.3) — `login(email, password)` in `legacy:src/context/AuthContext.tsx:109-146`.
  Body `{ email, password }` with email **exactly as typed** (not trimmed / lower-cased) (`:119`). No `mode` param.
  Token read as `data.data.access_token ?? data.access_token` (`:128`); missing → throws
  `"No access token returned from Directus"` (`:129-131`). `refresh_token` and `expires` are discarded. Non-OK →
  throws `data.errors[0].message ?? "Login failed"` (`:124-126`). Raw `fetch`, not React Query.
- [ ] `GET /users/me?fields=id,email,first_name,last_name,role.id,role.name,location,avatar,description,title,password_change_required`
  (Directus, AUDIT.md §3.3) — `fetchProfile(token)` `legacy:src/context/AuthContext.tsx:52-69`, header
  `Authorization: Bearer <token>`. Fires (a) on app bootstrap when a token is stored (`:87-107`), (b) right after login
  (`:134`), (c) on `refreshProfile()` (`:76-85`, called by ChangePassword). Non-OK → throws
  `errors[0].message ?? "Failed to load profile"` (`:64-66`). Returns `data.data ?? null`.
- [ ] Missing base URL: `requireDirectusUrl()` throws `"REACT_APP_BASE_URL is not set"` (`legacy:src/context/AuthContext.tsx:44-50`);
  that message is then shown in the login error box.

### Fields used
Session profile type `AuthUser` (`legacy:src/context/AuthContext.tsx:12-23`):

| Field (normalised name the page uses) | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| `id` | `id` | identity for other modules | — |
| `email` | `email` | login identity; ChangePassword greeting fallback; sidebar name fallback | as-is |
| `first_name`, `last_name` | same | ChangePassword greeting (`legacy:src/pages/ChangePassword.tsx:34`), sidebar footer | joined with space |
| `role` | `role.id`, `role.name` (or a plain string) | access derivation elsewhere (`legacy:src/components/dashboard/AppSidebar.tsx:150-158`) | lower-cased for checks |
| `location` | `location` | district scope (`"All"` = unrestricted) | — |
| `title` | `title` | province scope | — |
| `description` | `description` | user level (`"Administrator"`, `"District User"`, `"Provincial User"`, `"Support User"`) | — |
| `avatar` | `avatar` | sidebar/header avatar via `getFileUrl` | Directus file id |
| `password_change_required` | `password_change_required` | forced change gate (`legacy:src/components/auth/ProtectedRoute.tsx:16`, `legacy:src/components/LoginCard.tsx:42`) | boolean |
| `province`, `district` | **never fetched** | read by `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts:11-12`), always `undefined` | — |

### Filters / sort / pagination / search
- [ ] N/A.

### Exports
- [ ] N/A.

### Charts
- [ ] N/A.

### Login form (fields + validation)
- [ ] Brand block: logo image `/ecap-logo.png`, alt `"ECAP+ logo"` (`legacy:src/components/LoginCard.tsx:58-62`), caption
  `"Program Management Platform"` (`:63-65`) → both from `@/config` site config.
- [ ] Greeting badge: `"Welcome back"` if returning user else `"First time here"` (`:71-73`). Heading:
  `"Sign in to continue"` (returning) else `"Welcome to the platform"` (`:76-80`). Subtext:
  `"Sign in to continue data reporting and monitoring."` (`:81-83`).
- [ ] "Returning user" heuristic (`:16-29`): reads `localStorage["ecap.known_users"]` (JSON array of lower-cased emails,
  parse errors → `[]`). Empty email field → returning if the list is non-empty; otherwise returning iff the trimmed,
  lower-cased email is in the list.
- [ ] Field "Email address" (label with mail icon, `:89-92`): `<Input type="email" required>` (`:95-101`), no placeholder,
  no autocomplete attribute. Validation = native browser only (`required` + `type=email`).
- [ ] Field "Password" (`:106-109`): `<Input required>` with `type` toggled `password`/`text` (`:112-118`), monospace.
  Show/hide button with `aria-label` `"Show password"` / `"Hide password"`, `tabIndex={-1}` (`:119-127`). No length rule
  on login.
- [ ] "Remember me" checkbox (`:132-138`): **uncontrolled, not wired to anything** (see Bugs).
- [ ] "Forgot password?" button → `navigate("/forgot-password")` (`:139-145`).
- [ ] Error box: shown when `error` is set, rose alert with icon, text = thrown message (`:148-153`). Cleared at the start
  of each submit (`:32`). Fallback text `"Login failed"` (`:45`). Possible messages: Directus `errors[0].message`
  (e.g. invalid credentials), `"Login failed"`, `"No access token returned from Directus"`, `"Failed to load profile"`
  (or Directus message from `/users/me`), `"REACT_APP_BASE_URL is not set"`, or a browser network error message.
- [ ] Submit button: disabled while `useAuth().isLoading` (`:155-158`); label `"Signing in"` + `LoadingDots` while loading,
  else `"Sign in"` + arrow icon (`:162-169`). Note `isLoading` is the context flag, so it is also true during
  app bootstrap (see Bugs).

### Redirect after login
- [ ] On success (`legacy:src/components/LoginCard.tsx:35-43`):
  1. `sessionStorage["ecap.first_login"] = "true"` if the trimmed lower-cased email was not in `known_users`, else `"false"` (`:36-38`).
  2. Adds that email to `localStorage["ecap.known_users"]` (deduped) (`:39-40`).
  3. `localStorage["ecap.returning_user"] = "true"` (`:41`) — **write-only**, nothing reads it.
  4. `navigate(profile?.password_change_required ? "/change-password" : "/dashboard")` (`:42`) — push, not replace.
- [ ] No "return to the page you came from": `ProtectedRoute` redirects to `/` without saving the original location
  (`legacy:src/components/auth/ProtectedRoute.tsx:12-14`), so deep links are lost after login. New app should preserve
  the intended URL (e.g. `?redirect=`), only for same-origin relative paths.
- [ ] Already logged in: no redirect (see Access). The plan requires one.

### Links in / out
- [ ] In: `ProtectedRoute` when no user → `<Navigate to="/" replace />` (`legacy:src/components/auth/ProtectedRoute.tsx:13`);
  sidebar logout → `navigate("/")` (`legacy:src/components/dashboard/AppSidebar.tsx:185-188`); header logout →
  `navigate("/")` (`legacy:src/components/dashboard/DashboardHeader.tsx:521-524`); NotFound `<a href="/">Return to Home</a>`
  (`legacy:src/pages/NotFound.tsx:16-18`); ForgotPassword "Back to sign in" (`legacy:src/pages/ForgotPassword.tsx:112`);
  AcceptInvite "Back to sign in" (`legacy:src/pages/AcceptInvite.tsx:145-150`) and post-success/no-token redirects
  (`:28,53`); ResetPassword post-success (`legacy:src/pages/ResetPassword.tsx:57-59`); services page "Dashboard" button
  `navigate("/")` (`legacy:src/components/dashboard/services/ServicesPage.tsx:565`, a logged-in user lands on the login
  form — **BUG** in that module; with the new `/` redirect it would reach `/dashboard`). No payloads (no state, no params).
- [ ] Out: `/forgot-password` (`legacy:src/components/LoginCard.tsx:142`); `/dashboard` or `/change-password` after login (`:42`).
  Right panel: external stock-photo attribution link (see RightImageSlider).

### Loading / empty / error
- [ ] Page renders immediately (no bootstrap wait). Submit shows "Signing in" + dots. Errors inline in the card (no toast).
- [ ] Animations: card `animate-fade-in` (`legacy:src/components/LoginCard.tsx:50`), pulsing blur blobs
  (`legacy:src/pages/Index.tsx:13-16`), aurora background (decorative; keep minimal per UI rules).

### Bugs and quirks
- [ ] **BUG** A user with a valid session who opens `/` sees the login form, not the dashboard (`legacy:src/App.tsx:237`).
  While bootstrap runs, the submit button shows "Signing in" and is disabled because it reads the shared
  `isLoading` (`legacy:src/components/LoginCard.tsx:15,157`, `legacy:src/context/AuthContext.tsx:73`).
- [ ] **BUG** "Remember me" checkbox does nothing (`legacy:src/components/LoginCard.tsx:133-136`). Drop it or implement
  (e.g. session vs persistent storage) — see Open questions.
- [ ] **BUG** Email sent to Directus untrimmed (`legacy:src/context/AuthContext.tsx:119`) while the known-users list uses
  the trimmed lower-cased value (`legacy:src/components/LoginCard.tsx:36`). Trim before sending.
- [ ] **QUESTION** `ecap.known_users` stores every email that ever signed in on this browser in plain localStorage
  (PII, never cleared, `legacy:src/components/LoginCard.tsx:39-40`). Only used for the badge/heading wording and the
  dashboard first-login banner. Consider storing a hash, a boolean, or dropping it.
- [ ] **QUESTION** `ecap.returning_user` is written but never read (`legacy:src/components/LoginCard.tsx:41`; grep finds no reader).
- [ ] Labels are not associated with inputs (no `htmlFor`/`id`) (`legacy:src/components/LoginCard.tsx:89,106`); the
  password toggle is removed from tab order (`:123`). Fix for accessibility.
- [ ] Slider image files `/pic-1.jpg`, `/pic-3.jpg`, `/pic-4.jpg` are **not in the repo** (`public/` only holds
  `ecap-logo.png`, `favicon.ico`, `placeholder.svg`, `robots.txt`, `assets/no-results-document.png`), so the right panel
  shows broken images unless the deployment adds them (`legacy:src/pages/Index.tsx:24-27`).

## Route `/forgot-password` → `/forgot-password`

### Purpose
Request a password-reset email.

### Access
- [ ] Route guard: **public** (`legacy:src/App.tsx:238-241`), lazy-loaded (`:91`). No redirect when logged in.
- [ ] Sidebar / mobile nav / global search: no entry.
- [ ] In-page role checks: none. Data scope: none.

### Endpoints
- [ ] `POST /auth/password/request` (Directus, AUDIT.md §3.3) — **inline raw fetch** in
  `legacy:src/pages/ForgotPassword.tsx:32-38` (duplicates `requestPasswordReset` in `legacy:src/lib/directus.ts:268-286`).
  No auth header. Body `{ email: email.trim().toLowerCase(), reset_url }` where
  `reset_url = (VITE_RESET_PASSWORD_URL || window.location.origin)` minus trailing slash + `"/reset-password"` (`:21,28-29,37`).
  Base URL from `getDirectusBaseUrl()` **without** the "not set" guard (`:30`).
- [ ] Response handling (`:40-61`): non-OK → `console.error("Password Request Error:", data)` in every build (`:42`);
  in **dev** throws `"[DEV-ONLY] <errors[0].message || 'Request failed'>"` (`:45-49`) → error toast; in **prod** falls
  through to the same success toast (no account enumeration). Network/other errors: dev → error toast with message or
  `"Unable to request reset"`; prod → success toast (`:55-61`).

### Form + validation
- [ ] Heading block: logo `/ecap-logo.png` alt `"ECAP+ logo"` (`:73-77`), eyebrow `"ECAP+"` (`:78-80`), h1
  `"Forgot your password?"` (`:81-83`), text `"Enter your email and we will send you a reset link."` (`:84-86`).
- [ ] One field: `<Input type="email" placeholder="Email address" required>` (`:91-98`).
- [ ] Extra check: trimmed email empty → toast error `"Please enter a valid email address."` (`:22-26`).
- [ ] Submit button: disabled while loading; label `"Sending"` while loading else `"Send reset link"` (`:101-107`).
- [ ] Success: toast `"If an account exists with this email, you will receive a password reset link shortly."` and the
  email field is cleared (`:53-54`). Stays on the page.
- [ ] Footer link: `"Remembered it?"` + `"Back to sign in"` → `/` (`:110-115`).
- [ ] Right panel (shown at `md+`, stacked below the form on small screens, `min-h-[320px]`) (`:118-138`): slider images
  `/pic-1.jpg` (alt `" school lunch break"`) and `/pic-3.jpg` (alt `"community member"`), a commented-out `/pic-2.jpg`;
  eyebrow `"ECAP+ platform"`, h2 `"Track progress across communities with confidence."`, text
  `"Secure reporting, real-time insights, and streamlined monitoring in one place."`.

### Filters / sort / pagination / search · Exports · Charts
- [ ] N/A.

### Links in / out
- [ ] In: LoginCard "Forgot password?" (`legacy:src/components/LoginCard.tsx:142`); ResetPassword invalid-link card
  "Request a new link" (`legacy:src/pages/ResetPassword.tsx:76-80`). No payloads.
- [ ] Out: `/` (`legacy:src/pages/ForgotPassword.tsx:112`). The emailed link targets `/reset-password?token=…` (Directus
  appends `token`).
- [ ] Other places that trigger the same reset email (not this page, but they produce links into `/reset-password`):
  Profile "Reset password" (`legacy:src/pages/Profile.tsx:230-246`), Users list admin action
  (`legacy:src/pages/Users.tsx:121-133`), AddUser onboarding (`legacy:src/pages/AddUser.tsx:407-411`). All use
  `VITE_RESET_PASSWORD_URL || origin` + `/reset-password`.

### Loading / empty / error
- [ ] Button text only; toasts (sonner) for result.

### Bugs and quirks
- [ ] **BUG** Error body is `console.error`-logged in production (`legacy:src/pages/ForgotPassword.tsx:42`). Drop it.
- [ ] **QUESTION** Dev and prod behave differently (dev surfaces the Directus error). Port the prod behaviour
  (always the neutral success message); optionally log in dev only.
- [ ] **QUESTION** `reset_url` is caller-controlled; whether Directus `PASSWORD_RESET_URL_ALLOW_LIST` is set is a backend
  ask (AUDIT.md §3.3 security table row 15). In the new app the reset origin comes from `@/config` (env), not
  `window.location.origin` blindly.
- [ ] Duplicated wrapper: use one `requestPasswordReset` in `core/api` for this page, Profile, Users and AddUser.

## Route `/reset-password` → `/reset-password`

### Purpose
Set a new password using the token from the reset email (`?token=`).

### Access
- [ ] Route guard: **public** (`legacy:src/App.tsx:242`), lazy (`:92`). No logged-in handling.
- [ ] Sidebar / mobile nav / global search: no entry. In-page role checks: none. Data scope: none.

### URL params
- [ ] `token` = `useSearchParams().get("token")` (`legacy:src/pages/ResetPassword.tsx:13-15`). Not validated or decoded
  client-side; no expiry check before submit.
- [ ] Missing token → full "Invalid Link" card instead of the form (`:67-85`): h1 `"Invalid Link"`, text
  `"This password reset link is invalid or has expired."`, button `"Request a new link"` → `/forgot-password`. No
  `VersionFooter`, no slider on this variant.

### Endpoints
- [ ] `POST /auth/password/reset` (Directus, AUDIT.md §3.3) — inline raw fetch (`:41-47`), no auth, body
  `{ token, password }`. Non-OK → throws `errors[0].message ?? "Reset failed"` (`:49-52`). Base URL without "not set" guard.

### Form + validation (order matters for which message shows)
- [ ] Heading: logo alt `"ECAP+ logo"` (`:93-97`), eyebrow `"ECAP+"` (`:98-100`), h1 `"Reset your password"` (`:101-103`),
  text `"Enter your new password below."` (`:104-106`).
- [ ] Fields: `type="password"` placeholder `"New password"` (`:111-118`); `type="password"` placeholder
  `"Confirm new password"` (`:123-130`); both `required`; no show/hide toggle.
- [ ] On submit: (1) no token → toast `"Invalid or missing reset token."` (`:23-26`); (2) mismatch → toast
  `"Passwords do not match."` (`:28-31`); (3) `length < 8` → toast `"Password must be at least 8 characters long."` (`:33-36`).
- [ ] Button: `"Resetting"` while loading else `"Reset password"` (`:133-139`).
- [ ] Success: toast `"Password reset successful. Redirecting to sign in page..."` then `navigate("/")` after **3000 ms**
  (`:54-59`). Error: toast with message or `"Unable to reset password"` (`:60-61`).
- [ ] Right panel (`md+`, stacked on mobile) (`:143-161`): images `/pexels-uniqueerique-6572780.jpg`,
  `/pexels-uniqueerique-6572781.jpg` (alts `"Program fieldwork photo"`, `"Community program photo"`); same eyebrow /
  h2 / text as ForgotPassword.

### Filters / sort / pagination / search · Exports · Charts
- [ ] N/A.

### Links in / out
- [ ] In: emailed reset link only (built by ForgotPassword, Profile, Users, AddUser — see `/forgot-password`). No in-app
  navigation to this path.
- [ ] Out: `/forgot-password` (invalid card), `/` (after success).

### Loading / empty / error
- [ ] Button text; toasts.

### Bugs and quirks
- [ ] **BUG** The button is re-enabled during the 3 s redirect delay (`setIsLoading(false)` in `finally`, `:62-64`), so the
  user can submit the spent token again and get an error toast. Keep the form disabled after success.
- [ ] **BUG** The pending `setTimeout` is not cleared on unmount (`:57-59`).
- [ ] Slider images `/pexels-uniqueerique-*.jpg` are not in the repo (`:146-147`).
- [ ] Password rule differs by page: reset = ≥ 8 chars only, same as invite and forced change. Unify into one rule from
  config (see Other behaviour).

## Route `/accept-invite` → `/accept-invite`

### Purpose
Accept a Directus user invite by setting a password (`?token=`).

### Access
- [ ] Route guard: **public** (`legacy:src/App.tsx:243`), lazy (`:93`).
- [ ] Sidebar / mobile nav / global search: no entry. In-page role checks: none. Data scope: none.

### URL params
- [ ] `token` from `?token=` (`legacy:src/pages/AcceptInvite.tsx:13-15`). Missing → on mount: toast error
  `"Invalid invitation link"` with description `"No token was provided. Ask an administrator to resend the invite."`
  then `navigate("/", { replace: true })` (`:22-30`).

### Endpoints
- [ ] Legacy: `POST {REACT_APP_BASE_URL}/directus/users/invite/accept` body `{ token, password }` via `acceptUserInvite`
  (`legacy:src/lib/directus.ts:303-308`) → `publicBackendRequest` (`:288-301`), which **never reads the response and
  never throws on HTTP errors**. AUDIT.md §3.3 / §3.5 item 5: the path does not exist on Directus or the DQA backend.
- [ ] Intended: Directus `POST /users/invite/accept` `{ token, password }` (AUDIT.md §3.3; native invite
  `POST /users/invite` exists in `legacy:src/lib/directus.ts:256-266` but is **unused** — AddUser onboards via the
  reset email instead, AUDIT.md §3.3 "Admin-created account").

### Form + validation
- [ ] Heading: logo alt `"ECAP Plus logo"` (`:72-76`), eyebrow `"ECAP+"` (`:77-79`), h1 `"Accept your invite"` (`:80-82`),
  text `"Create your password to activate this account."` (`:83-85`).
- [ ] Notice (green): `"This invitation can only be used once. After setting your password, sign in from the main login page."` (`:87-93`).
- [ ] Fields: `"New password"` with show/hide toggle (`aria-label` `"Show password"`/`"Hide password"`) (`:96-120`);
  `"Confirm new password"` (`:122-132`); one toggle controls both; both `required`.
- [ ] On submit: (1) mismatch → toast `"Passwords do not match"` (`:35-38`); (2) `length < 8` → toast
  `"Password too short"` / description `"Password must be at least 8 characters long."` (`:40-45`). No token re-check
  at submit (sends `token ?? ""`, `:49`).
- [ ] Button: `"Activating..."` / `"Activate account"` (`:134-140`).
- [ ] Success: toast `"Invitation accepted"` / `"You can now sign in with your new password."` then
  `navigate("/", { replace: true })` after **1500 ms** (`:50-53`). Error: toast `"Invite failed"` / message or
  `"Unable to accept invitation"` (`:54-60`).
- [ ] Footer: `"Already activated?"` + `"Back to sign in"` → `/` (`:143-151`).
- [ ] Right panel (`md+`, stacked on mobile) (`:154-191`): images `/pic-1.jpg`, `/pic-3.jpg`, `/pic-4.jpg` with alts
  `"ECAP Plus Program Image 1|3|4"` and a `credit` object (`label "Sourced from Pexels - Under Pexels Free License"`
  plus a stock-site URL) that **RightImageSlider ignores** (not in `SliderImage`, `legacy:src/components/RightImageSlider.tsx:4-7`;
  compiles only because `tsconfig.app.json` has `"strict": false`). Eyebrow `"ECAP+ Platform"`, h2
  `"Activate access for secure reporting."` (`:183-190`).

### Filters / sort / pagination / search · Exports · Charts
- [ ] N/A.

### Links in / out
- [ ] In: none in-app (grep finds no navigate/link to `/accept-invite`); only external invite emails. No code builds an
  `invite_url` pointing here (`inviteUser` is unused).
- [ ] Out: `/` (no token, success, footer link).

### Loading / empty / error
- [ ] Button text; toasts.

### Bugs and quirks
- [ ] **BUG** Always reports success and sets no password: wrong path + response ignored
  (`legacy:src/lib/directus.ts:288-308`, `legacy:src/pages/AcceptInvite.tsx:49-53`). Port to Directus
  `/users/invite/accept` and surface errors.
- [ ] **BUG** Button re-enabled during the 1.5 s redirect delay; timeout not cleared on unmount (`:53,61-63`).
- [ ] **QUESTION** Is the invite flow used at all? Onboarding uses reset emails (AUDIT.md §3.3). Keep the route (legacy
  links may exist) but confirm with the developer whether AddUser should switch to native invites.

## Route `/change-password` → `/change-password`

### Purpose
Forced password change for accounts with `password_change_required = true` (temporary password).

### Access
- [ ] Route guard: `ProtectedRoute` only (`legacy:src/App.tsx:244-251`), lazy (`:94`). No role check.
- [ ] Guard behaviour (`legacy:src/components/auth/ProtectedRoute.tsx:4-21`): while `isLoading` → render `null` (blank);
  no user → `<Navigate to="/" replace />`; `user.password_change_required && pathname !== "/change-password"` →
  `<Navigate to="/change-password" replace />`. So **every** protected route funnels a flagged user here.
- [ ] Page-level redirect: user present and **not** flagged → `navigate("/dashboard", { replace: true })`
  (`legacy:src/pages/ChangePassword.tsx:36-40`). The page cannot be used for a voluntary change.
- [ ] Sidebar / mobile nav / global search: no entry. In-page role checks: none. Data scope: none.

### Endpoints
- [ ] `PATCH /users/me` (Directus, AUDIT.md §3.3) — `updateCurrentUserPassword(password)`
  (`legacy:src/lib/directus.ts:333-342`) via `directusRequest` (Bearer). Body
  `{ password, password_change_required: false }`. Non-OK → throws `errors[0].message ?? "Directus request failed"`
  (`:52-54`); no token → `"Not authenticated."` (`:22-25`).
- [ ] Then `GET /users/me` via `refreshProfile()` (`legacy:src/context/AuthContext.tsx:76-85`) so the flag clears in context.

### Form + validation
- [ ] Heading: logo alt `"ECAP+ logo"` (`legacy:src/pages/ChangePassword.tsx:83`), eyebrow `"Account security"` (`:85`),
  h1 `"Set your password"` (`:88`), text `"<fullName>, choose a new password before continuing."` or
  `"Choose a new password before continuing."` where `fullName = [first_name, last_name].filter(Boolean).join(" ") || email`
  (`:34,91-93`).
- [ ] Amber notice: `"This account was created with a temporary password. A new password is required before platform access is enabled."` (`:96-101`).
- [ ] Field "New password", placeholder `"At least 8 characters"`, show/hide toggle (`:105-123`).
- [ ] Strength meter (shown when length > 0) (`:125-142`): `scorePassword` (`:15-22`) = +1 for length ≥ 8, +1 for upper
  **and** lower case, +1 for a digit, +1 for a non-alphanumeric char (0-4). Bar: ≤1 → 1/4 rose; 2 → 1/2 amber; 3 → 3/4
  emerald; ≥4 → full dark emerald (`:131-134`). Hint `"Use a mix of upper and lower case letters, numbers, and symbols."` (`:139`).
  **Advisory only** — not enforced.
- [ ] Field "Confirm password", placeholder `"Re-enter password"` (`:146-151`); live match indicator once confirm is
  non-empty: green border + check icon when equal, rose border + alert icon otherwise (`:33,156-169`).
- [ ] On submit: (1) `length < 8` → toast `"Password too short"` / `"Use at least 8 characters."` (`:45-50`);
  (2) mismatch → toast `"Passwords do not match"` (`:52-55`).
- [ ] Button: `"Updating"` + dots while saving, else `"Update password"` (`:173-185`).
- [ ] Success: toast `"Password updated"` / `"You can now continue to ECAP+ PMP."` (brand string → config), then
  `navigate("/dashboard", { replace: true })` (`:61-64`). Error: toast `"Password change failed"` / message or
  `"Unable to update your password. Contact an administrator if this continues."` (`:65-71`).
- [ ] "Sign out instead" button → `logout()` only (`:188-194`); `ProtectedRoute` then redirects to `/` because `user` is null.
- [ ] Right panel `lg+` only (`:198`): images `/pic-1.jpg`, `/pic-3.jpg`; eyebrow `"ECAP+ platform"`, h2
  `"Secure access for program reporting."` (`:201-210`).

### Filters / sort / pagination / search · Exports · Charts
- [ ] N/A.

### Links in / out
- [ ] In: `LoginCard` after login when flagged (`legacy:src/components/LoginCard.tsx:42`); `ProtectedRoute` from any
  protected path (`legacy:src/components/auth/ProtectedRoute.tsx:16-17`). No payload.
- [ ] Out: `/dashboard` (not flagged / success), `/` (via guard after sign-out).
- [ ] How users get flagged: AddUser and EditUser write `password_change_required`; AddUser always sets `false` (temporary
  password branch is dead, AUDIT.md §3.3 "Admin-created account", `legacy:src/pages/AddUser.tsx:311`). Users module owns that.

### Loading / empty / error
- [ ] Blank (`null`) while auth bootstrap runs (guard). Toasts for results.

### Bugs and quirks
- [ ] **BUG** If `PATCH /users/me` succeeds but `refreshProfile()` fails, the user sees "Password change failed" although
  the password was changed (`legacy:src/pages/ChangePassword.tsx:59-71`).
- [ ] **QUESTION** No current-password field: Directus `PATCH /users/me` accepts a new password with only the bearer
  token. Whether the self-update allowlist is restricted is a backend ask (AUDIT.md §3.3 security table row 3).
- [ ] Validation order differs from reset/invite (length first here, match first there). Unify.
- [ ] Double navigation on success: `refreshProfile()` updates `user` with the flag cleared, which fires the
  `useEffect` redirect (`legacy:src/pages/ChangePassword.tsx:36-40`), and the handler also calls
  `navigate("/dashboard", { replace: true })` (`:64`). Harmless, but navigate once in the rebuild.
- [ ] **QUESTION** The gate is client-only: a flagged user's token is still accepted by Directus and the DQA backend
  (the backend never reads `password_change_required`, AUDIT.md §3.1 item 2), so data calls work outside the UI. Record
  as a backend ask.

## Component `RightImageSlider` (used by all five auth pages)
- [ ] Props `{ images: {src, alt?}[], className?, intervalMs = 7000 }` (`legacy:src/components/RightImageSlider.tsx:4-15`).
- [ ] Timer: `window.setInterval` advances the active slide every `intervalMs` (7 s) when there is more than one image;
  cleared on unmount (`:18-28`).
- [ ] Rendering: all images stacked, active one `opacity-80` else `opacity-0`, 700 ms fade (`:32-42`); bottom-up dark
  gradient overlay (`:43`); vertical pill buttons (`aria-label "Show slide N"`) to jump to a slide (`:53-68`). Whole
  container `aria-hidden="true"` (`:31`) even though it contains a focusable link and buttons (**BUG**, a11y).
- [ ] Hardcoded external stock-photo attribution link with photographer/organisation credit names, opens in new tab
  (`:44-52`) — content/brand string, move to config with the images (or drop with the images).
- [ ] Respect `prefers-reduced-motion` in the rebuild (decorative only).

## Component `aceternity/*`
- [ ] Used by auth: `AuroraBackground` (all five pages) — hex background `#f8fafc` and green/teal radial gradients,
  `animate-aurora` 18 s blobs, `bg-grid-slate` overlay (`legacy:src/components/aceternity/AuroraBackground.tsx:11-23`,
  keyframes `legacy:src/index.css:136-170`). `LoadingDots` (LoginCard, ChangePassword).
- [ ] Used elsewhere only: `GlowCard` (many pages), `GlowHeader` (DashboardLayout; uses `as any` for a CSS var style,
  `legacy:src/components/aceternity/GlowHeader.tsx:16`).
- [ ] **Unreferenced:** `LoadingScreen` (default label `"ECAP Plus PMP"`, logo alt `"ECAP+ logo"`, text
  `"Preparing your workspace"`, `legacy:src/components/aceternity/LoadingScreen.tsx:9,17,22`), `SpotlightCard`, `Title`.
  Do not port; the new shell uses skeletons and theme tokens.

## Component `VersionFooter` (all five auth pages)
- [ ] Fixed bottom bar: `"Version v2.1.0"` **hardcoded** (`legacy:src/components/VersionFooter.tsx:17`) plus
  `"Date: dd-mm-yyyy"` and `"Time: HH:mm"` (en-GB) computed once at render, never ticking (`:2-12,19-20`). Rebuild:
  version from build metadata (Vite `define`), date via `core/lib/format.ts`. **QUESTION** keep the date/time at all?
- [ ] Overlaps content on short screens (fixed, no bottom padding on pages).

## Other behaviour

### Session / token storage
- [ ] Token: `localStorage["ecap.access_token"]` with a module-level memo (`legacy:src/lib/auth.ts:1-41`). Memo never
  re-reads storage and nothing listens to the `storage` event, so other tabs keep a stale token until reload.
- [ ] Same token is the DQA bearer (`legacy:src/lib/api.ts:185-198`) and is used by superset, ai-service and
  `EtlInvalidator` (AUDIT.md §3.3 "Token"). The new client must attach the current (refreshed) token to both clients.
- [ ] Bootstrap (`legacy:src/context/AuthContext.tsx:87-107`): no token → `isLoading=false`, user null. Token →
  `GET /users/me`; **any** error (including offline / 5xx) clears the token (**BUG**: transient failures log the user
  out; only 401/403 should). `isLoading` starts `true` (`:73`), so `ProtectedRoute` renders nothing until done.
- [ ] Context value `{ user, isLoading, error, login, logout, refreshProfile }` (`:25-32,153-163`). `error` is set by
  login but no consumer reads it (LoginCard keeps its own error state).

### Session expiry
- [ ] **None.** `expires` and `refresh_token` are discarded (`legacy:src/context/AuthContext.tsx:128`); no `/auth/refresh`
  calls; no 401 interception in `directusRequest` (`legacy:src/lib/directus.ts:52-54`) or `dqaGet`
  (`legacy:src/lib/api.ts:205-207`). After expiry every request fails with the server message while the UI still
  shows the user as logged in; a reload then clears the token in bootstrap. New app: refresh once on 401, then clean
  logout with a "session expired" message (MIGRATION_PLAN.md §4.5; plan risk S6).

### Logout
- [ ] `logout()` = `clearStoredToken()` + `setUser(null)` (`legacy:src/context/AuthContext.tsx:148-151`). No network call
  (session not revoked).
- [ ] Callers: sidebar "Logout" button → `logout(); navigate("/")` (`legacy:src/components/dashboard/AppSidebar.tsx:185-188,330-342`);
  header dropdown "Logout" → same (`legacy:src/components/dashboard/DashboardHeader.tsx:515-524`); ChangePassword
  "Sign out instead" (no navigate; guard redirects). Mobile bottom nav has no logout
  (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`).
- [ ] **BUG** (plan risk S5) Not cleared: React Query memory cache + IndexedDB persisted cache
  `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:140-148`), auxiliary IDB cache, `ecap.known_users`,
  `ecap.returning_user`, `ecap.first_login`, AI chat history, `ecap_sidebar_scroll`
  (`legacy:src/components/dashboard/AppSidebar.tsx:126`), `ecap.ui_theme` (per-device, may stay). Full list in AUDIT.md §3.3
  "What logout does not clear". New logout: call Directus `POST /auth/logout` with the refresh token, wipe caches and
  namespaced user keys, navigate to `/login` (MIGRATION_PLAN.md §4.5).

### Forced password change flow (end to end)
- [ ] Login → profile flagged → `/change-password` (`legacy:src/components/LoginCard.tsx:42`); any protected URL while
  flagged → `/change-password` (`legacy:src/components/auth/ProtectedRoute.tsx:16-17`); success clears the flag server-side
  and in context, then `/dashboard`.

### Password rules (all flows)
- [ ] Minimum 8 characters, confirm must match — reset (`legacy:src/pages/ResetPassword.tsx:28-36`), invite
  (`legacy:src/pages/AcceptInvite.tsx:35-45`), forced change (`legacy:src/pages/ChangePassword.tsx:45-55`). No complexity
  rule enforced; strength meter is advisory on the forced-change page only. Server-side Directus password policy (if any)
  surfaces via `errors[0].message`. Put the min length in config and share one zod schema.

### Storage keys
| Key | Store | Written | Read | Cleared on logout? |
| --- | --- | --- | --- | --- |
| `ecap.access_token` | localStorage | `legacy:src/lib/auth.ts:31` | `:20` | yes (`:40`) |
| `ecap.known_users` | localStorage | `legacy:src/components/LoginCard.tsx:40` | `:19` | no |
| `ecap.returning_user` | localStorage | `legacy:src/components/LoginCard.tsx:41` | nowhere | no |
| `ecap.first_login` | sessionStorage | `legacy:src/components/LoginCard.tsx:38` | `legacy:src/components/dashboard/WelcomeBanner.tsx:11` | no |

### Timers
- [ ] `RightImageSlider` `setInterval` 7000 ms (`legacy:src/components/RightImageSlider.tsx:23-27`).
- [ ] ResetPassword `setTimeout` 3000 ms → `/` (`legacy:src/pages/ResetPassword.tsx:57-59`).
- [ ] AcceptInvite `setTimeout` 1500 ms → `/` (`legacy:src/pages/AcceptInvite.tsx:53`).
- [ ] App-wide `EtlInvalidator` polls every 30 s even on auth pages but skips the request without a token
  (`legacy:src/components/EtlInvalidator.tsx:28,33-34`) — shell concern; the new freshness service should only run when authenticated.

### Toasts
- [ ] All auth toasts use sonner (`@/components/ui/sonner`); LoginCard uses an inline error box instead.

### Brand / program strings (move to `@/config`)
- [ ] `legacy:src/components/LoginCard.tsx:59-60` logo path + alt `"ECAP+ logo"`; `:64` `"Program Management Platform"`.
- [ ] `legacy:src/pages/Index.tsx:32` `"ECAP+ platform"`; `:35,38` marketing copy.
- [ ] `legacy:src/pages/ForgotPassword.tsx:74-75,79,129` (`"ECAP+ logo"`, `"ECAP+"`, `"ECAP+ platform"`).
- [ ] `legacy:src/pages/ResetPassword.tsx:94-95,99,152`.
- [ ] `legacy:src/pages/AcceptInvite.tsx:74,78,159,166,173,185` (`"ECAP Plus logo"`, `"ECAP+"`, `"ECAP Plus Program Image N"`, `"ECAP+ Platform"`).
- [ ] `legacy:src/pages/ChangePassword.tsx:83,62,207` (`"ECAP+ logo"`, `"You can now continue to ECAP+ PMP."`, `"ECAP+ platform"`).
- [ ] `legacy:src/components/aceternity/LoadingScreen.tsx:9,17` (`"ECAP Plus PMP"`, `"ECAP+ logo"`) — unreferenced.
- [ ] `legacy:src/components/VersionFooter.tsx:17` `"Version v2.1.0"`.
- [ ] `legacy:src/components/RightImageSlider.tsx:44-52` stock-photo attribution link + credit names.
- [ ] Storage key prefix `ecap.` (`legacy:src/lib/auth.ts:1`, `legacy:src/components/LoginCard.tsx:19,38-41`) → namespace from config.

## Open questions for the developer

1. **Remember me**: implement (session-only vs persistent refresh token) or remove the checkbox?
2. **"Welcome back" heuristic**: keep it? It stores plain emails of everyone who signed in on the browser (`ecap.known_users`).
   Alternative: a single "has signed in before" flag, or a hashed list.
3. **Return-to-URL after login**: add `?redirect=` support (legacy always lands on `/dashboard`)?
4. **Accept invite**: switch to native Directus `/users/invite/accept` (and should AddUser use `POST /users/invite`
   instead of reset emails)? Or keep `/accept-invite` only as a redirect for old links?
5. **Session mode**: Directus cookie session vs JSON tokens + refresh (MIGRATION_PLAN.md §4.5 / §8)? Determines where the
   token lives and how logout revokes it.
6. **Voluntary password change**: legacy `/change-password` bounces non-flagged users to `/dashboard`; self-service change is
   only via reset email from Profile. Should the account module offer an in-app change (with current password)?
7. **Password policy**: keep "≥ 8 characters" only, or enforce the complexity the strength meter suggests? Is a Directus
   password policy configured server-side?
8. **Slider images** are missing from the legacy repo; does the deployment provide them? Should images/marketing copy be
   configurable per program (site config) or dropped?
9. **Version footer** with current date/time on auth pages: keep (version from build) or drop?
