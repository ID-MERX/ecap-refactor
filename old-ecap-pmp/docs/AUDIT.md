# Legacy app audit — index

Phase 1 output (read-only audit). This file is the index; per-module feature inventories live in
`docs/audit/<module>.md`. Later phases read this index plus only the module file they need.

## Contents

0. [How to read this audit](#0-how-to-read-this-audit)
1. [Summary](#1-summary)
2. [Module files](#2-module-files)
3. [Endpoint catalogue](#3-endpoint-catalogue)
   - 3.1 [DQA backend: conventions](#31-dqa-backend-conventions)
   - 3.2 [DQA backend: endpoints](#32-dqa-backend-endpoints)
   - 3.3 [Directus](#33-directus)
   - 3.4 [External services](#34-external-services)
   - 3.5 [Mismatches and duplicates](#35-mismatches-and-duplicates)
4. [Cross-cutting inventories](#4-cross-cutting-inventories)
   - 4.1 [Hardcoded brand and program strings](#41-hardcoded-brand-and-program-strings)
   - 4.2 [Storage keys](#42-storage-keys)
   - 4.3 [Polling, timers and streams](#43-polling-timers-and-streams)
   - 4.4 [Access rules and disagreements](#44-access-rules-and-disagreements)
   - 4.5 [Environment variables](#45-environment-variables)
   - 4.6 [Dead and unreferenced code](#46-dead-and-unreferenced-code)
   - 4.7 [Duplicated helpers](#47-duplicated-helpers)
5. [Verification of MIGRATION_PLAN.md section 2](#5-verification-of-migration_planmd-section-2)
6. [Surprises](#6-surprises)
7. [Test fixtures index](#7-test-fixtures-index)
8. [Appendix: legacy file → module map](#8-appendix-legacy-file--module-map)

## 0. How to read this audit

**Sources.** `../old-ecap-pmp` (legacy frontend) and `../ecap-plus-pmp-backend` (DQA backend), both on
branch `security-fix`, audited as the working tree was found on 2026-11-02. In both repos the
security-fix patch is **uncommitted** (legacy: `EtlInvalidator.tsx`, `ai-service.ts`, `api.ts`,
`superset.ts` modified; backend: 18 files modified, 7 untracked including `lib/userScope.js`,
`controllers/supersetController.js`, `config/geography.js`, `tests/`). No Directus server
configuration is available, so Directus-side permissions are marked *unverifiable*.

**Evidence format.** `legacy:src/path/File.tsx:123` is a line in `../old-ecap-pmp`;
`backend:controllers/x.js:45` is a line in `../ecap-plus-pmp-backend`. Line numbers refer to the
working tree above.

**Secrets.** Environment files were read only to establish variable *names*. No value from any
`.env` file appears in these docs or in the fixtures.

**Checkboxes.** Every behaviour a later phase must reproduce is a `- [ ]` item. Phase 5 ticks the
items in the module file when the behaviour is ported (or strikes them with a reason when a decision
drops them). Items marked **BUG** describe legacy defects: port the *intended* behaviour, not the bug.

**Module file template.** Each `docs/audit/<module>.md` has one entry per legacy route with these
headings: Purpose · Legacy files · Access · Endpoints · Fields used · Filters / sort / pagination /
search · Exports · Charts · Links in / out · Loading / empty / error · Bugs and quirks.

## 1. Summary

<!-- PENDING: step 5 -->

## 2. Module files

<!-- PENDING: step 3 -->

## 3. Endpoint catalogue

### 3.1 DQA backend: conventions

These conventions apply to every DQA endpoint. Per-endpoint details are in 3.2.

#### 1. App setup
- **Entry points.** `server.js` loads `index.js` and listens on `process.env.PORT` (`backend:server.js:1-8`). It logs only when `ENV == "PRODUCTION"` (`backend:server.js:9-11`). PM2 runs one instance on port 9003 with a 1 GB memory restart (`backend:ecosystem.config.js:4-17`). `npm start` runs `nodemon server.js` (`backend:package.json:7`). README.md has only a title line (`backend:README.md:1-2`).
- **Stack.** Express `^4.18.2`, `pg` `^8.7.3`, `pg-cursor`, `jsonwebtoken` `^9`, `axios`, `compression`, `cors`, `nodemailer` (`backend:package.json:19-40`). Several dependencies are listed but unused in the files read (`mysql`, `mysql2`, `redis`, `express-session`, `bcrypt`, `request`).
- **Middleware order** (`backend:index.js`):
  1. `compression()` gzips every compressible response (`:18`). The tablet-sync SSE stream opts out by sending `Cache-Control: no-cache, no-transform` (`backend:controllers/etlController.js:664-670`), and the SSE writer helper calls `res.flush()` after each event (`backend:controllers/etlController.js:636-640`). The CSV stream sets only `Cache-Control: no-cache` (`backend:controllers/etlController.js:3538-3542`), so it is still eligible for gzip.
  2. `cors(...)` (`:21-32`). It answers CORS preflight `OPTIONS` requests itself (204), before the auth middleware. `origin` is an allowlist of **two hardcoded production/staging origins** (`backend:index.js:23-26`), `credentials: true`, methods `GET,POST,PUT,DELETE`, allowed headers `Content-Type,Authorization,X-Requested-With`, exposed headers `Content-Range,X-Content-Range`. There is no localhost origin and the list is not configurable through env. A local dev frontend must go through a dev-server proxy, or the browser blocks responses. `PATCH` is not in the allowed methods.
  3. `express.json()` (`:34`) with the default 100 kB limit. There is no `urlencoded` or text parser.
  4. `verifyDirectusToken` (`:38`), described in subsection 2.
  5. Routers (`:40-45`): `/household`, `/child`, `/etl`, `/mother`, `/agent`, `/superset`.
  6. `GET /` sends a static logo JPEG (`:47-53`).
  7. `app.all("*")` is the 404 catch-all (`:55-60`).
- **There is no error-handling middleware** (`(err, req, res, next)`) in `index.js`. Body-parser failures (malformed JSON gives 400, a body over 100 kB gives 413) and `sendFile` errors therefore fall through to Express's default handler, which answers in **HTML**, not JSON.
- **Route params.** District and id params use Express 4 wildcard syntax `:district(*)`, `:household_id(*)`, `:unique_id(*)`, `:vcaid(*)` (e.g. `backend:routes/householdRoutes.js:6-68`, `backend:routes/childRoutes.js:5-46`, `backend:routes/motherRoutes.js:5-10`). The two PMTCT register routes are the same (`backend:routes/etlRoutes.js:82-91`). A `(*)` param also matches slashes, so route order matters: in the mother router `/district/:district(*)` is registered before `/district/count/:district(*)` (`backend:routes/motherRoutes.js:6,8`), so `GET /mother/district/count/<d>` most likely reaches `getMothersByDistrict` with `district = "count/<d>"`. This is inferred from Express 4 path matching (no `node_modules` to confirm); the `/mother` entries in 3.2 reach the same conclusion, also by inference.

#### 2. Auth middleware (`middleware/verifyDirectusToken.js`)
- **How tokens are verified:** **local JWT verification, no remote call.** `jwt.verify(token, process.env.DIRECTUS_SECRET, { algorithms: ["HS256"], issuer: "directus" })` (`backend:middleware/verifyDirectusToken.js:47-55`). `DIRECTUS_SECRET` must equal Directus's own `SECRET` (`:6-8`). Audience is not checked. Directus *static* tokens are not JWTs, so they are rejected. Token revocation (logout) is not seen until the JWT expires, because Directus is not called.
- **Where the token is read:** `Authorization: Bearer <jwt>` first, then the `?token=<jwt>` query parameter as a fallback for downloads and SSE (`:31-40`). Query-string tokens end up in access logs and browser history, and the 404 catch-all echoes them back (`backend:index.js:58`).
- **PUBLIC_ROUTES** (`:22-26`), matched by exact `req.method` + `req.path` (`:28-29`):
  - `GET /` (logo)
  - `GET /agent/health` (uptime)
  - `POST /etl/tablet-sync/notify` (webhook with its own secret, `TABLET_SYNC_WEBHOOK_SECRET` in the `x-webhook-secret` header, `backend:controllers/etlController.js:736-747`). The secret check only runs when the env var is set (`:739`); if it is unset the webhook is open to anyone.

  Because the match is exact, `HEAD /` or a trailing slash (`/agent/health/`) is not public.
- **OPTIONS** (CORS preflight) requests are always passed through (`:59`).
- **AUTH_MODE** (`:42-45`). The value is trimmed and lowercased. `"log"` gives log mode; **any other value or unset gives `"enforce"`**.
  - `enforce`: a missing, invalid or expired token gets `401 {"status":"fail","message":<reason>}` (`:69`).
  - `log`: the same failures are logged with `console.warn` and the request **continues without `req.user`** (`:63-68`). Only `POST /superset/guest-token` re-checks for a user (`backend:controllers/supersetController.js:57-62`). Every data endpoint is therefore fully open in log mode.
- **401 reasons:**
  - no token: `"You are not logged in! Please log in to get access."` (`:82`)
  - `TokenExpiredError`: `"Your session has expired, please log in again."` (`:91-93`)
  - any other verify error (bad signature, wrong issuer, malformed): `"Invalid token, please log in again."` (`:94`)
- **Misconfiguration.** If `DIRECTUS_SECRET` is unset: `500 {"status":"error","message":"Server authentication is not configured."}` in enforce mode, pass-through in log mode (`:72-78`).
- **No 403 is ever produced by the middleware.** 403 comes only from the Superset handler (no scope).
- **`req.user`** is the decoded Directus JWT payload, e.g. `{ id, role, app_access, admin_access, iat, exp, iss }` (`:87`). `role` is a role **id**, not a name. **`req.accessToken`** is the raw token string (`:88`). Only two controllers read them: `supersetController` reads both (`backend:controllers/supersetController.js:58,72-73`), and `etlController` reads `req.user.email || req.user.name` for `triggeredBy` (`backend:controllers/etlController.js:57`). Directus JWTs do not normally carry `email` or `name`. With an authenticated user, `triggeredBy` is then likely `undefined`, not `"api"`; it falls back to `"api"` only when there is no user. That is unverified, and logged as a follow-up.
- **No caching** of verification. Every request runs `jwt.verify`, which is cheap and local.
- Tested in `backend:tests/security.test.js:53-70` (see subsection 9).

#### 3. User scope (`lib/userScope.js`)
- **`deriveScope(profile, tokenClaims)`** (`backend:lib/userScope.js:18-49`). The inputs are the Directus profile fields `description` (lowercased), `role.name` (lowercased), `location` (treated as null when `"All"`) and `title` (the province, treated as null when `"All"`) (`:19-25`). The rules, in order:
  1. **National (admin)** if any of these is true (`:27-35`):
     - the token claim `admin_access === true`
     - the role name equals `"administrator"`
     - the description *contains* `"admin"`
     - the description equals `"ecap+ support"`
     - the description is empty AND the user has a role name AND there is no location AND no province. This mirrors the legacy sidebar's "role but no description" rule (`:32-34`).
  2. **Province** if the description contains `"provincial"` or `"province"` (`:37`). The user then gets `{ level:"province", province: title, districts: DISTRICTS_BY_PROVINCE[title] }`, or `{ level:"none" }` if `title` is missing or not a known province (`:38-42`).
  3. **District** if (the description contains `"district"` OR a location is set) AND a location is set. The user then gets `{ level:"district", district: location }` (`:45-46`).
  4. Otherwise `{ level:"none" }` (`:48`). Callers must deny data.
- **Outputs:** `{level:"national"}` | `{level:"province",province,districts[]}` | `{level:"district",district}` | `{level:"none"}` (`:12-16`).
- **`getUserProfile(userId, accessToken)`** (`:59-79`) calls `GET {DIRECTUS_URL}/users/me?fields=id,email,first_name,last_name,description,title,location,role.name` with the **caller's own** token and a 10 s timeout. It throws if `DIRECTUS_URL` is unset or the profile id ≠ the token id. The result is cached in memory per user id for **5 min** (`:52-53,77`).
- **Who uses it:** grep across the backend shows **only `controllers/supersetController.js`** (`backend:controllers/supersetController.js:2,72-73`) plus the tests. **No data controller (household, child, mother, etl) applies user scope.** Every `:district` path param and `?district`/`?province` query param is trusted as sent. Data-level scoping is the main backend gap.
- **Caveat.** The rules come from free-text profile fields (`:7-10`), so substring matches such as `"admin"` are fragile and fail open. The file says these rules mirror the legacy frontend's `useEffectiveDistrict` hook (`:7-8`).

#### 4. District / province parameter convention
- **There is no shared parsing helper.** Each controller repeats the logic inline.
  - **household / child controllers.** `if (district && district !== "All") { district.split(",").map(trim) }` then `district IN (...)` (e.g. `backend:controllers/householdController.js:12-16,60-66,119-126`; `backend:controllers/childController.js:14,58,98,201,254,378`). The match is exact and case-sensitive. `"All"` and an empty string mean no filter. Some handlers bind values as `$n` placeholders (`backend:controllers/householdController.js:119-125`). Others **string-interpolate with only `'`→`''` escaping** (`backend:controllers/householdController.js:13-15,61-65`).
  - **mother controller** has its own local helper `buildDistrictWhere` (`backend:controllers/motherController.js:3-12`). It accepts a **single** district only: no comma split, a case-insensitive `LOWER(TRIM(district)) = LOWER(TRIM($1))` match, and `""`/`"all"`/`"all districts"` (case-insensitive) mean no filter. A comma list therefore matches nothing.
  - **etl controller** uses query params (`?district=`, `?province=`, etc.) per endpoint. For example, `province` is skipped when it is `"all"` or `"All"`, and otherwise matched case-insensitively (`backend:controllers/etlController.js:1320,1343-1345`). The PMTCT registers use `req.params.district` (`backend:controllers/etlController.js:3661,3682`).
- **The province param** exists only on some `/etl/*` query endpoints. The household, child and mother routers never read `province`. The route comment for HTS says `:district` and `?province` are both ignored (`backend:routes/householdRoutes.js:47-49`).
- **Frontend implication.** "All" must be sent as the literal `All` (household, child) or `all` (mother is case-insensitive). Multi-district must be comma-joined, and is supported only by the household and child endpoints.

#### 5. Fiscal-year window (`lib/fyClause.js`)
- **`parseFyWindow(query)`** reads `?from=YYYY-MM-DD&to=YYYY-MM-DD` (strings, trimmed). Both must match `^\d{4}-\d{2}-\d{2}$`, otherwise `hasWindow=false` and **no FY filter is applied** (`backend:lib/fyClause.js:8-17`). There is no default window and no FY start month in the backend: the **frontend computes the FY range** and sends `from`/`to`. The dates are not otherwise validated, so `2025-13-45` passes the regex and Postgres would raise an error, giving a 500.
- **`buildCohortFyClause(window, {enrolledCol="date_enrolled", deRegCol="de_registration_date", startParamIndex})`** adds the "active during FY" condition `enrolled <= to AND (de_reg IS NULL OR de_reg >= from)` (`:29-57`). Text dates in either `YYYY-MM-DD…` or `DD-MM-YYYY` are parsed. Unparseable dates become NULL, so the row is excluded on the enrolled side and fails the de-reg side unless NULL. Note that an empty-string `de_registration_date` (`''`) is not SQL NULL and does not parse, so such still-active rows are **excluded** whenever a window is applied (`:45-53`). The params come out in the order `[to, from]` (`:56`).
- **`buildServiceFyClause(window, {dateCol="service_date", startParamIndex})`** adds `date BETWEEN from AND to` with the same dual-format parsing (`:64-78`). The params come out in the order `[from, to]` (`:77`).
- **Users:**
  - `householdController` and `childController` import only `parseFyWindow` and `buildCohortFyClause` (`backend:controllers/householdController.js:2`, `backend:controllers/childController.js:2`).
  - `etlController` imports all three (`backend:controllers/etlController.js:7-11`) but calls `parseFyWindow` and `buildCohortFyClause` at one site only (`backend:controllers/etlController.js:1432,1449`). Other ETL endpoints use their own date logic; see the `/etl` entries in 3.2.
  - `motherController` applies no FY window.
- Column names are interpolated into the SQL. They come from code, never from the request.

#### 6. Database configuration (`config/database.js`)
- **`FlatPGConnection`** is a `pg.Pool` on env `FlatPGUSER`, `FlatPGHOST`, `FlatPGDATABASE`, `FlatPGPASSWORD`, `FlatPGPORT` (`backend:config/database.js:8-14`). This is the app/warehouse database. A startup `connect()` failure calls `process.exit(1)` (`:16-23`). Used by all controllers.
- **`RawPGConnection`** is a `pg.Pool` on `RawPGUSER/HOST/DATABASE/PASSWORD/PORT`. Each falls back to the Flat value, and the database name falls back to the raw OpenSRP database (`:36-42`). It exists to bypass postgres_fdw for heavy JSON scans of `core.event` (`:25-35`). It is used by `etlController` only (`backend:controllers/etlController.js:3`).
- **`SupersetPG`** is a separate `pg.Pool` in `services/etlRunner.js` on `SUPERSET_DB_USER/HOST/NAME/PASSWORD/PORT` (`backend:services/etlRunner.js:6-13`). It is used for ETL run bookkeeping and is re-exported to `etlController` (`backend:controllers/etlController.js:1-2`).
- **Timeouts.** No pool sets `statement_timeout`, `query_timeout`, `connectionTimeoutMillis` or `max`, so pg defaults apply: 10 connections and no query timeout (`backend:config/database.js:8-14,36-42`). A grep for `statement_timeout|query_timeout|connectionTimeout|idleTimeout` across `controllers/ services/ lib/ config/` found nothing.
- **Other env var names** (from `.env.example`): `PORT`, `ENV`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `DIRECTUS_SECRET`, `DIRECTUS_URL`, `AUTH_MODE`, `TABLET_SYNC_WEBHOOK_SECRET`, `SUPERSET_URL`, `SUPERSET_EMBED_USERNAME`, `SUPERSET_EMBED_PASSWORD`, `SUPERSET_DASHBOARD_IDS`, `SUPERSET_RLS_ENABLED`, `SUPERSET_RLS_DISTRICT_COLUMN`, `SUPERSET_RLS_DATASET_IDS`, `SUPERSET_USE_CSRF`.
  - The code also reads `OLLAMA_HOST`, `OLLAMA_PORT` and `OLLAMA_MODEL` (`backend:controllers/agentController.js:6-8`) and `RawPG*` (`backend:config/database.js:37-41`). None of these appears in `.env.example`.

#### 7. Error envelope conventions
- **Success:** `{"status":"success", "data":[...]}` for lists, or `{"status":"success","count":<n>}` for counts (e.g. `backend:controllers/householdController.js:28,89-92`; `backend:controllers/motherController.js:26,39`). Some ETL endpoints return bare objects (see the `/etl` entries in 3.2).
- **Client/auth failure:** `{"status":"fail","message":"..."}` for 400, 401 and 403 in the middleware and the Superset handler (`backend:middleware/verifyDirectusToken.js:69`; `backend:controllers/supersetController.js:60,68,75-78`). This is not universal: etlController's 400s use `"status":"error"` (e.g. `backend:controllers/etlController.js:50-54`).
- **Server error, three variants:**
  - **household/child:** `500 {"status":"error","message":"<fixed sentence>","error":"<pg err.message>"}` (e.g. `backend:controllers/householdController.js:31-35,96-100`; `backend:controllers/childController.js:35-39,72-76`). 13 of the 14 500-sites in householdController include the `error` field. The 14th (`backend:controllers/householdController.js:540-543`) sends a non-standard `status` string (`"error occurred, NO family members found for this household"`) with `message: <err.message>` and no `error` field. All 10 500-sites in childController include `error`.
  - **mother/etl:** `500 {"status":"error","message":"<err.message>"}`. The raw error is the message itself (`backend:controllers/motherController.js:29,42,62`; e.g. `backend:controllers/etlController.js:119,139,160,196`).
  - **agent:** `{"error":{"message":"..."}}` with no `status` (`backend:controllers/agentController.js:61-63,67`).
  - **superset:** a generic, non-leaking `502`/`503` with `{"status":"error","message":...}` (`backend:controllers/supersetController.js:53-54,95-97`).
- **404:** `{"status":"error","message":"Can't find <url> on this server"}` (`backend:index.js:56-59`).
- **Raw Postgres error messages leak to clients** in the household, child, mother and etl controllers (table and column names, syntax errors).
- **Non-JSON errors.** Body-parser failures and `sendFile` failures come back as HTML from Express's default handler (see subsection 1).

#### 8. Caching layers

| Cache | Where | Key | TTL | Notes |
| --- | --- | --- | --- | --- |
| Directus profile | `backend:lib/userScope.js:52-53,60-61,77` | user id | 5 min | Process memory; never swept. |
| Superset service access token | `backend:lib/supersetClient.js:20,44-53,80-83` | single global | JWT `exp` − 60 s (fallback 10 min) | Cleared and retried once on upstream 401. |
| ETL perf cache `PERF_CACHE` | `backend:controllers/etlController.js:761-777` | `req.path + "?" + querystring` (includes `?token=` when the token is sent in the query, which fragments the cache) | 5 min | Used by `getFacilityPerformance` (`:779`), `getCaseworkerPerformance` (`:883`), `getServicePerformance` (`:997`), `getServiceSummary` (`:1424`), `getServiceTimeseries` (`:1719`), `getServiceDistribution` (`:1815`), `getActionQueue` (`:1907`). The key does **not** include the user, which is safe today only because no scope is applied. Expired entries are deleted lazily on read only. |
| Active ETL processes | `backend:services/etlRunner.js:76` | run id | n/a | Process state, not a response cache. |

- There are no HTTP cache headers on JSON responses; SSE and CSV set `no-cache` (`backend:controllers/etlController.js:666,3541`). There is no Redis use despite the dependency.
- With a single PM2 instance (`backend:ecosystem.config.js:6`) the in-memory caches are coherent, but they reset on every restart.

#### 9. `tests/security.test.js`
Run with `node tests/security.test.js` (`backend:tests/security.test.js:1`). The test mocks Directus `/users/me` and Superset login/guest_token on ephemeral ports (`:23-35`), and mounts only the middleware, stub routes and the real Superset router (`:43-49`). It asserts the following:
- **Auth** (`:53-65`):
  - public `GET /` → 200 (against a stub route, not the real logo handler, `:45`)
  - public `POST /etl/tablet-sync/notify` → 202 (stub)
  - no token → 401
  - junk token → 401
  - wrong-secret token → 401
  - expired token → 401, with a message matching `/expired/`
  - valid Bearer → 200, and `req.user.id` populated
  - `?token=` → 200
- **Log mode** (`:67-70`): no token → 200. `POST /superset/guest-token` without a user is still 401.
- **Superset** (`:72-94`):
  - a non-allowlisted dashboard → 400
  - admin → 200 with `rls: []` and `resources: [{type:"dashboard",id}]`
  - district user → `[{clause:"district = '<district>'"}]`
  - province user → `district IN (<that province's 7 districts>)`
  - a user with no scope → 403
  - `SUPERSET_RLS_DATASET_IDS="5,7"` → one rule per dataset
  - a single Superset login across all calls (token caching)
- **Scope rules** (`:96-103`):
  - blank description + role + All/All → national
  - blank description + location → district
  - "District officer" with location All → none
  - "ECAP+ Support" → national
  - `_buildRls` doubles single quotes
- **Not covered:** no data endpoint (household, child, mother, etl) has any test, and nothing tests that data endpoints honour user scope (they don't).

#### 10. Geography (`config/geography.js`)
- `DISTRICTS_BY_PROVINCE` maps provinces to district names (`backend:config/geography.js:4-7`). It contains **2 provinces** (one with 7 districts, one with 5), **12 districts** in total. Province names must match the Directus profile `title` exactly (case-sensitive object key, `backend:lib/userScope.js:39`).
- It is used only by `lib/userScope.js` to expand a province user into a district list for Superset RLS (`backend:lib/userScope.js:2,39`). A comment says to keep it in sync with the frontend program config by hand (`backend:config/geography.js:1-3`). The new frontend's `program.config.ts` geography must match it, or province users get 403 on dashboards.

### 3.2 DQA backend: endpoints

The DQA backend registers **69 endpoints**: 68 method + path routes in `backend:routes/*.js` and `backend:index.js`, plus the `ALL *` 404 catch-all (`backend:index.js:55`). Scope is weak almost everywhere:
- **1 enforces user scope:** `POST /superset/guest-token`, through `lib/userScope.js`.
- **35 trust a caller-supplied district** (path `:district(*)` or `?district=`). One of them, `/etl/caseworker-list`, also trusts `?province=`.
- **7 ignore district** and return national data to any authenticated user.
- **10 are by-ID lookups with no ownership or scope check:** the 5 `/household/...:household_id(*)` record routes and the 5 `/child/...:unique_id|vcaid(*)` record routes. The source drafts labelled the household ones "n/a" and the VCA ones "ignores district". Both are normalised to "by ID" below and counted as n/a.
- **9 carry no geographic data:** ETL run bookkeeping, duplicate-review marks and the LLM proxy.
- **7 more are n/a:** 4 operational actions with no permission check (`POST /etl/run`, `POST /etl/cancel/:runId`, `POST /etl/send-report`, and the public `POST /etl/tablet-sync/notify` webhook) and 3 infrastructure routes (`GET /`, `ALL *`, `GET /agent/health`).

FY handling is also thin. Only **7 endpoints apply the shared FY cohort window** (`from`/`to` → `buildCohortFyClause`): the household count and two household registers, the VCA count and two VCA registers, and `/etl/services/:type/summary`. **8 endpoints receive `from`/`to` from legacy but ignore them:** facility-, caseworker- and service-performance, services timeseries and distribution, the mother register and both PMTCT registers.

**20 endpoints have no live legacy caller.** An earlier path-only grep counted 10; tracing each wrapper to a mounted page adds 10 more:
- 7 have no wrapper at all: `/household/all-household-members-register`, `/mother/count/:district(*)`, `/etl/tablet-sync/notify` (Mage calls it), `/etl/dqa-checks`, `/etl/dqa-records`, `/agent/health` and `GET /`.
- 2 are route shapes legacy never requests: `/mother/district/:district(*)` without `/filtered`, and the shadowed `/mother/district/count/:district(*)`.
- 3 have a wrapper that is never imported: `/child/vca-profile/:unique_id(*)` (`getVcaProfileById`), `POST /etl/run` (`triggerEtlPipeline`) and `POST /etl/cancel/:runId` (`cancelEtlRun`).
- 7 are called only from components that are never mounted: the four `*-by-month` routes (`/household/caregiver-services-by-month`, `/household/caregiver-referrals-by-month`, `/child/vca-services-by-month`, `/child/vca-referrals-by-month`; only caller `DataQualityChart`) and the three `/etl/duplicates/review*` routes (only caller `DuplicateDetectionCard`, rendered only by the unrouted `VcaServicesDashboard`).
- 1 sits behind a wrapper branch that is never taken: `/mother/members-count/:district(*)` (both callers of `getTotalMothersCount` pass no district).

The **Used by** column of the summary table and the **Used by** line of each detail block name the legacy callers.

**How to read the summary table:**
- **Handler** cells are `backend:controllers/<file>:<line>` (or `backend:index.js:<line>`).
- **Fixture** cells are files in `test/fixtures/`.
- **Scope** values:
  - *trusts district*: filters by a caller-supplied district, with no user check
  - *ignores district*: returns all districts
  - *by ID*: record lookup by ID, with no scope check
  - *user scope*: derived on the server from the Directus profile
  - *no geo*: the data has no geography
  - *n/a*: an action or infrastructure route
- **FY** values:
  - *cohort*: `from`/`to` through `lib/fyClause.js`
  - *ignored*: legacy sends `from`/`to`, but the handler never reads them
  - *none*: no FY handling
  - any other window is named in the cell

| Method | Path | Purpose | Scope | FY | Handler | Fixture | Used by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | **`/household`** | | | | | | |
| GET | `/household/households-count/:district(*)` | Distinct household count (active and closed) | trusts district | cohort | `householdController.js:4` | `dqa-households.json` | `MetricsGrid`, `Districts`, `Documentation` (404) |
| GET | `/household/all-households/:district(*)` | Active household register | trusts district | cohort | `householdController.js:39` | `dqa-households.json` | `HouseholdRegister`, `HouseholdProfile`, `MetricsGrid`, `Districts`, `GlobalSearch` +9 more |
| GET | `/household/all-households-archived/:district(*)` | Archived household register, optional reason filter | trusts district | cohort | `householdController.js:104` | `dqa-households.json` | `HouseholdArchivedRegister`, `HouseholdProfile` |
| GET | `/household/all-household-members-register` | Entire `children` table, unfiltered | ignores district | none | `householdController.js:156` | `dqa-households.json` | — (none) |
| GET | `/household/caregiver-services/:household_id(*)` | Caregiver services for one household | by ID | none | `householdController.js:178` | `dqa-caregiver.json` | `HouseholdProfile` |
| GET | `/household/caregiver-services-by-month/:district(*)` | Caregiver service counts per district and month | trusts district | none | `householdController.js:207` | `dqa-caregiver.json` | — (none; unmounted `DataQualityChart` only) |
| GET | `/household/caregiver-services-by-district/:district(*)` | Raw caregiver service rows plus district | trusts district | none | `householdController.js:265` | `dqa-caregiver.json` | `CaregiverRiskRegister`, `CaseworkerProfile`, `Referrals` (fallback) |
| GET | `/household/caregiver-referrals-by-month/:district(*)` | Caregiver referral counts per district and month | trusts district | none | `householdController.js:307` | `dqa-caregiver.json` | — (none; unmounted `DataQualityChart` only) |
| GET | `/household/household-services-by-district/:district(*)` | Raw household service rows plus district | trusts district | none | `householdController.js:365` | `dqa-households.json` | `CaseworkerProfile`, `HouseholdRiskRegister`, `HouseholdServicesPage` |
| GET | `/household/hts-register-by-district/:district(*)` | HTS register rows (one district or all) | trusts district | none | `householdController.js:418` | `dqa-hts.json` | `HTSRegister`, `HTSRiskRegister`, `HTSProfile` |
| GET | `/household/caregiver-referrals/:household_id(*)` | Referrals for one household | by ID | none | `householdController.js:443` | `dqa-caregiver.json` | `HouseholdProfile` |
| GET | `/household/caregiver-caseplans/:household_id(*)` | Caregiver case plans for one household | by ID | none | `householdController.js:470` | `dqa-caregiver.json` | `HouseholdProfile` |
| GET | `/household/caregiver-caseplan-domains/:household_id(*)` | Caregiver case-plan domains for one household | by ID | none | `householdController.js:499` | `dqa-caregiver.json` | `HouseholdProfile` |
| GET | `/household/members/:household_id(*)` | Household members (`children` rows) | by ID | none | `householdController.js:524` | `dqa-households.json` | `HouseholdProfile`, `Districts` (export) |
| | **`/child`** | | | | | | |
| GET | `/child/vcas-count/:district(*)` | Distinct VCA count (active and archived) | trusts district | cohort | `childController.js:4` | `dqa-vcas.json` | `MetricsGrid`, `Districts`, `Documentation` (404) |
| GET | `/child/vcas-assessed-register/:district(*)` | Active VCA register | trusts district | cohort | `childController.js:43` | `dqa-vcas.json` | `VcaRegister`, `VcaProfile`, `VcaRiskRegister`, `HouseholdProfile`, `MotherIndexDetails` +1 more |
| GET | `/child/vcas-archived-register/:district(*)` | Archived VCA register, optional reason filter | trusts district | cohort | `childController.js:80` | `dqa-vcas.json` | `VcaArchivedRegister`, `VcaProfile` |
| GET | `/child/vca-profile/:unique_id(*)` | One VCA by id (**broken**: never returns data) | by ID | none | `childController.js:134` | `dqa-vcas.json` | — (none; wrapper unused) |
| GET | `/child/vca-services-by-month/:district(*)` | VCA service counts per district and month | trusts district | none | `childController.js:181` | `dqa-vcas.json` | — (none; unmounted `DataQualityChart` only) |
| GET | `/child/vca-services-by-district/:district(*)` | Raw VCA service rows plus district | trusts district | none | `childController.js:239` | `dqa-vcas.json` | `CaseworkerProfile`, `VcaRiskRegister`, `Referrals` (fallback) |
| GET | `/child/vca-services/:vcaid(*)` | Services for one VCA | by ID | none | `childController.js:155` | `dqa-vcas.json` | `VcaProfile` |
| GET | `/child/vca-caseplans/:unique_id(*)` | Case plans for one VCA | by ID | none | `childController.js:277` | `dqa-vcas.json` | `VcaProfile` |
| GET | `/child/vca-caseplan-domains/:unique_id(*)` | Case-plan domains for one VCA | by ID | none | `childController.js:306` | `dqa-vcas.json` | `VcaProfile` |
| GET | `/child/vca-referrals/:unique_id(*)` | Referrals for one VCA | by ID | none | `childController.js:331` | `dqa-vcas.json` | `VcaProfile` |
| GET | `/child/vca-referrals-by-month/:district(*)` | VCA referral counts per district and month | trusts district | none | `childController.js:358` | `dqa-vcas.json` | — (none; unmounted `DataQualityChart` only) |
| | **`/mother`** | | | | | | |
| GET | `/mother/district/:district(*)/filtered` | Mother register (one district or all) | trusts district | ignored | `motherController.js:14` | `dqa-mothers.json` | `MotherIndexRegister` |
| GET | `/mother/district/:district(*)` | Same handler as `/filtered`; shadows the count route | trusts district | none | `motherController.js:14` | `dqa-mothers.json` | — (none) |
| GET | `/mother/total/count` | National mother count (distinct households) | ignores district | none | `motherController.js:33` | `dqa-mothers.json` | `MotherIndexRegister`, `Documentation` |
| GET | `/mother/district/count/:district(*)` | District mother count (**unreachable**, shadowed) | trusts district | none | `motherController.js:46` | `dqa-mothers.json` | — (none) |
| GET | `/mother/count/:district(*)` | District mother count | trusts district | none | `motherController.js:46` | `dqa-mothers.json` | — (none) |
| GET | `/mother/members-count/:district(*)` | District mother count (same handler) | trusts district | none | `motherController.js:46` | `dqa-mothers.json` | — (none; branch never taken) |
| | **`/etl` pipeline** | | | | | | |
| GET | `/etl/last-success` | Latest successful ETL run time (cache invalidation) | no geo | none | `etlController.js:25` | `dqa-etl-pipeline.json` | `EtlInvalidator` (app root) |
| POST | `/etl/run` | Start a pipeline (server-side bash) | n/a | none | `etlController.js:45` | `dqa-etl-pipeline.json` | — (none; wrapper unused) |
| GET | `/etl/runs` | Recent runs (sweeps stale runs first) | no geo | none | `etlController.js:73` | `dqa-etl-pipeline.json` | `DataPipelinePage` |
| GET | `/etl/runs/:runId` | One run with full logs | no geo | none | `etlController.js:123` | `dqa-etl-pipeline.json` | `DataPipelinePage` |
| POST | `/etl/cancel/:runId` | SIGTERM a run started by this instance | n/a | none | `etlController.js:143` | `dqa-etl-pipeline.json` | — (none; wrapper unused) |
| GET | `/etl/pipelines` | Configured pipelines and today's file names | no geo | none | `etlController.js:164` | `dqa-etl-pipeline.json` | `DataPipelinePage` |
| GET | `/etl/files/:pipeline` | Existence, size and mtime of today's output files | no geo | none | `etlController.js:200` | `dqa-etl-pipeline.json` | `DataPipelinePage` |
| POST | `/etl/send-report` | Email the ETL status report to hard-coded recipients | n/a | none | `etlController.js:243` | `dqa-etl-pipeline.json` | `DataPipelinePage` |
| GET | `/etl/download/:pipeline/:fileName` | Stream today's national CSV extract | ignores district | none | `etlController.js:169` | `dqa-etl-pipeline.json` | `DataPipelinePage` (anchor download) |
| GET | `/etl/tablet-sync/stream` | SSE stream of tablet/provider sync status | ignores district | none | `etlController.js:663` | `dqa-etl-pipeline.json` | `DataPipelinePage` (EventSource) |
| POST | `/etl/tablet-sync/notify` | Public webhook (Mage) that wakes SSE clients | n/a | none | `etlController.js:735` | `dqa-etl-pipeline.json` | — (none; Mage webhook) |
| GET | `/etl/tablet-sync` | One-shot tablet/provider sync status | ignores district | none | `etlController.js:646` | `dqa-etl-pipeline.json` | `DataPipelinePage` |
| | **`/etl` performance and caseworkers** | | | | | | |
| GET | `/etl/facility-performance` | Per-facility enrolment and month-on-month services | trusts district | ignored | `etlController.js:779` | `dqa-etl-performance.json` | `Performance` |
| GET | `/etl/caseworker-journeys` | GPS-tagged events (max 500) for a caseworker | ignores district | text `from`/`to` on `dateCreated` | `etlController.js:1203` | `dqa-etl-caseworkers.json` | `CaseworkerJourneys` |
| GET | `/etl/caseworker-list` | Active caseworkers with location and `has_gps` | trusts district + province | none | `etlController.js:1316` | `dqa-etl-caseworkers.json` | `CaseworkerJourneys` |
| GET | `/etl/caseworker-performance` | Per-caseworker service stats and tier | trusts district | ignored | `etlController.js:883` | `dqa-etl-performance.json` | `Performance` |
| GET | `/etl/service-performance` | Per-service-name counts, coverage and tier | trusts district | ignored | `etlController.js:997` | `dqa-etl-performance.json` | `Performance` |
| GET | `/etl/duplicates/reviews` | List duplicate-review marks | no geo | none | `etlController.js:1141` | `dqa-etl-duplicate-reviews.json` | — (none; unmounted `DuplicateDetectionCard` only) |
| POST | `/etl/duplicates/review` | Upsert a duplicate-review mark | no geo | none | `etlController.js:1154` | `dqa-etl-duplicate-reviews.json` | — (none; unmounted `DuplicateDetectionCard` only) |
| DELETE | `/etl/duplicates/review/:run_key` | Delete a duplicate-review mark | no geo | none | `etlController.js:1179` | `dqa-etl-duplicate-reviews.json` | — (none; unmounted `DuplicateDetectionCard` only) |
| | **`/etl` services and DQA** | | | | | | |
| GET | `/etl/facility-list` | Distinct ward names (misnamed) | ignores district | none | `etlController.js:2459` | `dqa-etl-dqa.json` | `Performance`, `CaseworkerJourneys`, `AddUser`, `EditUser` |
| GET | `/etl/duplicates` | Duplicate service groups plus summary | trusts district | none | `etlController.js:2339` | `dqa-etl-dqa.json` | `QualityReviewPanel` (service pages) |
| GET | `/etl/dqa-checks` | 18 data-quality check counts | trusts district | none (fixed rolling windows) | `etlController.js:2099` | `dqa-etl-dqa.json` | — (none) |
| GET | `/etl/dqa-records` | Records failing one DQA check | trusts district | none (fixed rolling windows) | `etlController.js:2277` | `dqa-etl-dqa.json` | — (none) |
| GET | `/etl/action-queue` | Priority work items for a service page | trusts district | none (fixed rolling windows) | `etlController.js:1907` | `dqa-etl-dqa.json` | `QualityReviewPanel` (service pages) |
| GET | `/etl/services/:type/summary` | Headline service KPIs for a type | trusts district | cohort (service counts: calendar months) | `etlController.js:1424` | `dqa-etl-services-summary.json` | `CanonicalKpiStrip`, `CohortStrip`, `ServicesPage` |
| GET | `/etl/services/:type/timeseries` | Monthly service volume, last 12 months | trusts district | ignored (fixed 12 months) | `etlController.js:1719` | `dqa-etl-services-summary.json` | `ServicesTimeSeriesChart` (service pages) |
| GET | `/etl/services/:type/distribution` | Pillar split of services, last 90 days | trusts district | ignored (fixed 90 days) | `etlController.js:1815` | `dqa-etl-services-summary.json` | `ServicesDistributionChart` (service pages) |
| | **`/etl` records and PMTCT** | | | | | | |
| GET | `/etl/services/:type/records` | Paginated service records plus stats | trusts district | rolling `dateWindow` days | `etlController.js:2506` | `dqa-etl-service-records.json` | `ServicesPage` |
| GET | `/etl/services/:type/record-detail` | Raw joined row for an entity's latest service | trusts district | none | `etlController.js:3126` | `dqa-etl-service-records.json` | `ServicesPage` |
| GET | `/etl/services/:type/export` | Streamed CSV of all matching service records | trusts district | rolling `dateWindow` days | `etlController.js:3216` | `dqa-etl-service-records.json` | `ServicesPage` |
| GET | `/etl/pmtct-child-register/:district(*)` | PMTCT child (HEI) register for one district | trusts district | ignored | `etlController.js:3660` | `dqa-pmtct.json` | `PMTCTRegister` |
| GET | `/etl/pmtct-mother-register/:district(*)` | PMTCT mother register for one district | trusts district | ignored | `etlController.js:3681` | `dqa-pmtct.json` | `PMTCTRegister` |
| | **`/agent`** | | | | | | |
| POST | `/agent/chat` | Proxy to the local Ollama chat-completions API | no geo | none | `agentController.js:12` | `dqa-agent.json` | `AiAssistant` (every `DashboardLayout` page) |
| GET | `/agent/health` | Ollama reachability (public, always 200) | n/a | none | `agentController.js:71` | `dqa-agent.json` | — (none) |
| | **`/superset`** | | | | | | |
| POST | `/superset/guest-token` | Superset guest token with server-derived RLS | user scope | none | `supersetController.js:49` | `dqa-superset.json` | `Charts` (via `EmbeddedDashboard`) |
| | **root** | | | | | | |
| GET | `/` | Static logo JPEG (public) | n/a | none | `index.js:47` | `dqa-errors.json` | — (none) |
| ALL | `*` | JSON 404 catch-all | n/a | none | `index.js:55` | `dqa-errors.json` | `Documentation`, `Referrals` (unintended 404s) |

---

**Group: `/household`** (`backend:routes/householdRoutes.js`, mounted at `backend:index.js:40`)

**Mounting and auth (applies to every endpoint below).** The router is mounted at `/household` (`backend:index.js:40`) after the global `verifyDirectusToken` middleware (`backend:index.js:38`). That middleware accepts a Directus HS256 token from `Authorization: Bearer` or `?token=` (`backend:middleware/verifyDirectusToken.js:31-40`), sets `req.user` (`backend:middleware/verifyDirectusToken.js:87`) and, when `AUTH_MODE=log`, lets unauthenticated requests through (`backend:middleware/verifyDirectusToken.js:62-68`). Rejected requests get `401 {"status":"fail","message":...}` (`backend:middleware/verifyDirectusToken.js:69`); if `DIRECTUS_SECRET` is unset, enforce mode answers `500 {"status":"error","message":"Server authentication is not configured."}` and log mode lets the request through (`backend:middleware/verifyDirectusToken.js:72-78`). **No handler in `controllers/householdController.js` reads `req.user`**, so no endpoint in this group applies a user scope; every geographic restriction comes from the caller-supplied `:district` value.

**Shared conventions.**
- All handlers use the `FlatPGConnection` pool (`backend:controllers/householdController.js:1`, `backend:config/database.js:8-14`). None of them uses `RawPGConnection`.
- `:district(*)` / `:household_id(*)` are Express 4 wildcard params (express 4.19.2 / path-to-regexp 0.1.7 per `backend:package-lock.json:699,1840`). Express URL-decodes the value, so an encoded comma (`%2C`) arrives as `,`. Under path-to-regexp 0.1.7 the slash before the param is mandatory: `/household/households-count/` matches with `district=""`, but `/household/households-count` (no trailing slash) does **not** match and falls through to the catch-all `404 {"status":"error","message":"Can't find ... on this server"}` (`backend:index.js:55-60`). (This comes from reading the regex rules of that library version. It was not executed.)
- District convention (all except HTS): `"All"` or an empty value means no filter; otherwise the value is split on `,`, each part is trimmed, and the result is matched with `district IN (...)`. The match is exact and case-sensitive. There is no `province` param anywhere in this router.
- Only `parseFyWindow` and `buildCohortFyClause` are imported (`backend:controllers/householdController.js:2`). `buildServiceFyClause` is **not** imported, so none of the service/referral endpoints applies an FY window. `parseFyWindow` needs both `from` and `to` in `YYYY-MM-DD` form, and otherwise behaves as if no window was sent (`backend:lib/fyClause.js:8-17`). The cohort clause is `enrolled <= to AND (de_reg IS NULL OR de_reg >= from)`, and it accepts ISO or DD-MM-YYYY strings (`backend:lib/fyClause.js:29-57`).
- Standard error body: `500 {"status":"error","message":"<fixed text>","error":"<pg error.message>"}`. The raw DB error message leaks to the client in every handler (the `members` endpoint uses a slightly different shape).
- pg type mapping: `COUNT()` comes back as bigint, which JSON-serialises as a **string**; `date` columns become JS `Date` objects serialised as ISO timestamps (`"YYYY-MM-DDT..Z"`, shifted by the server time zone); `text` columns stay strings.
- No endpoint in this group has pagination, LIMIT or server-side caching.

---

#### `GET /household/households-count/:district(*)`
- **Handler:** `backend:controllers/householdController.js:4` · **Route:** `backend:routes/householdRoutes.js:6`
- **Purpose:** Count distinct households in `all_households`, optionally restricted by district and FY cohort.
- **Params:**
  - `district` (path, string, required segment, may be empty). `"All"` or `""` means no filter. A comma list is split and trimmed (`backend:controllers/householdController.js:12-16`).
  - `from`, `to` (query, `YYYY-MM-DD`, optional, both needed) — FY cohort window (`backend:controllers/householdController.js:7,19-22`).
  - There is no status filter. The count includes active **and** closed/de-registered households, unlike the `all-households` register (compare `backend:controllers/householdController.js:25` with `:55-57`).
- **Fiscal year / date window:** `buildCohortFyClause` on `date_enrolled` / `de_registration_date` (`backend:controllers/householdController.js:19-25`, `backend:lib/fyClause.js:29-57`).
- **Scope enforcement:** **trusts district param**. The value goes into the SQL as given, with no user check. No province param.
- **Data source:** `all_households` via `FlatPGConnection` (`backend:controllers/householdController.js:25-27`).
- **Server-side filtering / sort / pagination / limits:** `SELECT COUNT(DISTINCT household_id) AS count FROM all_households [WHERE district IN (...)] [cohort clause]`. When there is no district but there is a window, `WHERE 1=1` is prepended (`backend:controllers/householdController.js:24-25`). One row is returned.
- **Response:** `200 {"status":"success","count":"<bigint as string>"}` (`backend:controllers/householdController.js:28`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | status | string | no | always `"success"` |
  | count | string | no | `COUNT(DISTINCT household_id)`; pg returns bigint as string, e.g. `"1234"` |
- **Errors:** `500 {"status":"error","message":"An error occurred while retrieving assessed households count.","error":<pg message>}`. The DB message leaks (`backend:controllers/householdController.js:29-35`).
- **Issues:**
  - **SQL built from strings:** district values are interpolated into the SQL with only `'` → `''` escaping (`backend:controllers/householdController.js:14-16`). Whether this is safe depends on `standard_conforming_strings`; it should be parameterised.
  - The handler is named `allAssessedHouseholdsCount`, yet it counts every household regardless of `case_status` or de-registration. Its definition differs from the register at `/all-households` (active only), so the KPI will not match the register's row count.
  - Legacy calls `/household/households-count?from=..` with no district segment (`legacy:src/lib/api.ts:265-267`, invoked by `legacy:src/pages/Documentation.tsx:77`). Under path-to-regexp 0.1.7 that path does not match this route and returns 404 (see the conventions above).
- **Used by:**
  - Wrapper: `getTotalHouseholdsCount` (`legacy:src/lib/api.ts:261-270`).
  - Callers: `legacy:src/components/dashboard/MetricsGrid.tsx:139` (MetricsGrid on Dashboard; user district + FY, query enabled only when a district is set, `:140`); `legacy:src/pages/Districts.tsx:63` (Districts; district or `"All"` + FY); `legacy:src/pages/Documentation.tsx:77` (Documentation; no arguments).
  - Params: Documentation passes no district, so the wrapper builds `/household/households-count` with no trailing segment (`legacy:src/lib/api.ts:265-267`), which falls through to the `ALL *` 404 (see Issues above).
- **Fixture:** `test/fixtures/dqa-households.json` → `"GET /household/households-count/:district(*)"`

#### `GET /household/all-households/:district(*)`
- **Handler:** `backend:controllers/householdController.js:39` · **Route:** `backend:routes/householdRoutes.js:10`
- **Purpose:** The active household register: all columns of `all_households` for active, non-de-registered households.
- **Params:**
  - `district` (path). `"All"` means no filter; a comma list is supported (`backend:controllers/householdController.js:60-66`). An empty string also means no filter, because the check is truthy.
  - `de_registration_reason` (query, string, optional). Adds an exact-match `de_registration_reason = $n` (`backend:controllers/householdController.js:43-48,68-73`). **Any value that is not blank always returns zero rows**, because the base WHERE already requires `de_registration_reason IS NULL OR TRIM(...) = ''` (`backend:controllers/householdController.js:57`). (Only a whitespace-only value could match a row whose stored reason is that same whitespace.)
  - `from`, `to` (query) — FY cohort window (`backend:controllers/householdController.js:42,76-80`).
  - No other query param is read by the handler.
- **Fiscal year / date window:** `buildCohortFyClause` with `startParamIndex` placed after any reason param (`backend:controllers/householdController.js:76-80`).
- **Scope enforcement:** **trusts district param**. No province param.
- **Data source:** `all_households` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT DISTINCT * FROM all_households WHERE LOWER(TRIM(case_status)) IN ('active','1') AND de_registration_date IS NULL AND (de_registration_reason IS NULL OR TRIM(de_registration_reason) = '')` plus the district, reason and FY clauses (`backend:controllers/householdController.js:52-80`). There is no ORDER BY and no LIMIT, so `"All"` returns the entire national active register in one response.
- **Response:** `200 {"status":"success","data":[<all_households row>...]}` (`backend:controllers/householdController.js:89-92`). Rows come from `SELECT *`, so the column set is whatever the table has. Columns established from backend SQL that references `all_households`:

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | household_id | string | no (join key) | `backend:controllers/householdController.js:25`; `backend:controllers/etlController.js:823` |
  | district | string | yes | `backend:controllers/householdController.js:65` |
  | province | string | yes | read by legacy (`legacy:src/pages/HouseholdRegister.tsx:259`); the backend never selects it from `all_households` explicitly, so this column is uncertain |
  | facility | string | yes | `backend:controllers/etlController.js:822` |
  | ward | string | yes | `backend:controllers/etlController.js:822` (`COALESCE(h.ward,'')`) |
  | caseworker_name | string | yes | `backend:controllers/etlController.js:2309` |
  | caregiver_name | string | yes | `backend:controllers/etlController.js:2309` |
  | caregiver_phone | string | yes | `backend:controllers/etlController.js:2226` |
  | case_status | string | yes | `"Active"`/`"1"` in this endpoint (`backend:controllers/householdController.js:55`) |
  | date_enrolled | string | yes | stored as text in ISO or DD-MM-YYYY form according to the backend comment (`backend:lib/fyClause.js:26-27`); the helper casts with `::text` so it also works on a real date column. Not confirmed by DDL: if the column is `date`, JSON would be an ISO timestamp |
  | de_registration_date | string | yes (always null here) | `backend:controllers/householdController.js:56`; same text-vs-date caveat as `date_enrolled` |
  | de_registration_reason | string | yes (null/empty here) | `backend:controllers/householdController.js:57` |
  | screened | string | yes | free-text yes/no/true/false (`backend:controllers/etlController.js:2051`) |
  | partner | string | yes | `backend:controllers/etlController.js:2054` |
  | pregnant_woment | string | yes | column name is spelled this way in the source (`backend:controllers/etlController.js:2007`) |
  | caregiver_hiv_status | string | yes | `backend:controllers/etlController.js:2010` |
  | is_mother_virally_suppressed_wlhiv | string | yes | `backend:controllers/etlController.js:2010` |
  | homeaddress, last_service_date | string | yes | read by legacy only (`legacy:src/pages/HouseholdRegister.tsx:257,264`); uncertain |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching households.","error":<pg message>}` (`backend:controllers/householdController.js:93-100`).
- **Issues:**
  - **SQL built from strings:** district is interpolated with quote doubling (`backend:controllers/householdController.js:61-65`), while the reason and FY values are parameterised.
  - The `de_registration_reason` filter contradicts the base WHERE (described above).
  - The result set is unbounded (whole register, `SELECT DISTINCT *`). `DISTINCT *` across a wide row is expensive and suggests the table holds duplicate rows.
- **Used by:**
  - Wrapper: `getHouseholdsByDistrict` (`legacy:src/lib/api.ts:301-312`), IndexedDB list cache, 60 s TTL, stale-on-error (`legacy:src/lib/api.ts:212-238`).
  - Callers: `legacy:src/pages/HouseholdRegister.tsx:111` (HouseholdRegister); `legacy:src/pages/HouseholdProfile.tsx:156` (HouseholdProfile, whole register loaded to find one household); `legacy:src/components/dashboard/MetricsGrid.tsx:146` (MetricsGrid on Dashboard); `legacy:src/pages/Districts.tsx:75,234` (Districts: discovery and export); `legacy:src/components/dashboard/GlobalSearch.tsx:74` (GlobalSearch in DashboardHeader); `legacy:src/pages/CaregiverRiskRegister.tsx:80,111`; `legacy:src/pages/HouseholdRiskRegister.tsx:89`; `legacy:src/pages/HTSRiskRegister.tsx:99`; `legacy:src/pages/CaseworkerProfile.tsx:79`; `legacy:src/pages/HouseholdServicesPage.tsx:54`; `legacy:src/pages/Performance.tsx:548`; `legacy:src/pages/AddUser.tsx:180` and `legacy:src/pages/EditUser.tsx:63` (only to build province/district/ward pickers); `legacy:src/components/dashboard/services/ServicesPage.tsx:269` (ServicesPage, shared by the HouseholdServices, VcaServices and CaregiverServices pages).
  - Dead callers: `legacy:src/components/dashboard/ProvincialBreakdown.tsx:16` (component never imported); `legacy:src/components/dashboard/services/service-records.ts:174` (`fetchHouseholdRegister`, never called).
  - Params: the handler applies the FY cohort when `from`/`to` are sent, but most callers send none, e.g. `legacy:src/components/dashboard/MetricsGrid.tsx:146` (the KPI counts on the same card are FY-scoped, `:133,139`), `legacy:src/pages/Districts.tsx:234` and `legacy:src/pages/HouseholdProfile.tsx:156`. HouseholdProfile sends `user.location || "None"` as the district for district users (`legacy:src/pages/HouseholdProfile.tsx:150-152`).
- **Fixture:** `test/fixtures/dqa-households.json` → `"GET /household/all-households/:district(*)"`

#### `GET /household/all-households-archived/:district(*)`
- **Handler:** `backend:controllers/householdController.js:104` · **Route:** `backend:routes/householdRoutes.js:14`
- **Purpose:** The archived (closed, de-registered) household register.
- **Params:**
  - `district` (path). `"All"` or `""` means no filter. A comma list is **parameterised** here (`backend:controllers/householdController.js:119-126`).
  - `reason` **or** `de_registration_reason` (query, string, optional). `reason` takes precedence (`??`). The value `"all"` (lower-case only) means no filter; otherwise it is an exact, case-sensitive match on `de_registration_reason` (`backend:controllers/householdController.js:107,128-131`).
  - `from`, `to` (query) — FY cohort window (`backend:controllers/householdController.js:108,134-138`).
- **Fiscal year / date window:** `buildCohortFyClause` (enrolled <= to AND de-registered >= from, the latter non-null in this endpoint) (`backend:controllers/householdController.js:134-138`).
- **Scope enforcement:** **trusts district param**. An empty district returns the national archive. Legacy calls it with `""` (`legacy:src/pages/HouseholdArchivedRegister.tsx:129`).
- **Data source:** `all_households` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT DISTINCT * FROM all_households WHERE LOWER(TRIM(case_status)) = 'closed' AND de_registration_date IS NOT NULL AND de_registration_reason IS NOT NULL` plus the optional filters (`backend:controllers/householdController.js:110-138`). No ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[<all_households row>...]}` (`backend:controllers/householdController.js:142-145`). The columns match `/all-households` above, except that `case_status` is `"Closed"`/`"closed"` and `de_registration_date` and `de_registration_reason` are non-null (though `de_registration_reason` may be an empty string, since only `IS NOT NULL` is checked).
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching archived households.","error":<pg message>}` (`backend:controllers/householdController.js:146-152`).
- **Issues:**
  - Inconsistent with the VCA archive, which accepts `case_status IN ('closed','inactive')` and excludes blank reasons (`backend:controllers/childController.js:89-94`). Households with status "Inactive" never appear in either the active or the archived household register.
  - `reason="All"` (capital A) is treated as a literal reason and returns 0 rows (`backend:controllers/householdController.js:128`).
  - Unbounded result set.
- **Used by:**
  - Wrapper: `getHouseholdArchivedRegister` (`legacy:src/lib/api.ts:319-339`), no cache.
  - Callers: `legacy:src/pages/HouseholdArchivedRegister.tsx:129` (HouseholdArchivedRegister; `""`, reason filter, FY); `legacy:src/pages/HouseholdProfile.tsx:162` (HouseholdProfile; district or `""`, no FY, no reason).
  - Params: the wrapper sends the reason as `de_registration_reason` (`legacy:src/lib/api.ts:324-326`); the handler reads `req.query.reason ?? req.query.de_registration_reason` (`backend:controllers/householdController.js:107`), so it works. The VCA archive wrapper sends `reason` instead.
- **Fixture:** `test/fixtures/dqa-households.json` → `"GET /household/all-households-archived/:district(*)"`

#### `GET /household/all-household-members-register`
- **Handler:** `backend:controllers/householdController.js:156` · **Route:** `backend:routes/householdRoutes.js:18`
- **Purpose:** Returns the entire `children` table (all household members/VCAs nationwide).
- **Params:** none read. Any `district`, `from` or `to` sent by a client is ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **ignores district (returns all)**. There is no district param at all.
- **Data source:** `children` via `FlatPGConnection` (`backend:controllers/householdController.js:158-160`).
- **Server-side filtering / sort / pagination / limits:** `SELECT * FROM children`, with no WHERE, ORDER BY or LIMIT. Active and closed records are both included.
- **Response:** `200 {"status":"success","data":[<children row>...]}` (`backend:controllers/householdController.js:164-167`). The columns come from `SELECT * FROM children`; see the `/household/members/:household_id` table below.
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching all households.","error":<pg message>}`. The message text is misleading (`backend:controllers/householdController.js:168-174`).
- **Issues:**
  - Unbounded, unscoped dump of every child record nationwide. Any authenticated user gets national PII.
  - No legacy frontend caller found (grep: `all-household-members-register`, `members-register` in `legacy:src`).
- **Used by:**
  - No wrapper and no caller: a grep of `legacy:src` for `all-household-members-register` finds nothing.
- **Fixture:** `test/fixtures/dqa-households.json` → `"GET /household/all-household-members-register"`

#### `GET /household/caregiver-services/:household_id(*)`
- **Handler:** `backend:controllers/householdController.js:178` · **Route:** `backend:routes/householdRoutes.js:22`
- **Purpose:** All caregiver service records for one household.
- **Params:** `household_id` (path, string, parameterised as `$1`) (`backend:controllers/householdController.js:180-188`). FY query params are not read.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (n/a)**. This is a record lookup by ID, with no district or user check, so any authenticated user who knows a household ID can read its records.
- **Data source:** `caregiver_services` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT * FROM caregiver_services WHERE household_id = $1`, with no ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[<caregiver_services row>...]}` (`backend:controllers/householdController.js:192-195`). An unknown ID returns `200` with `data: []`.

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | household_id | string | no | `backend:controllers/householdController.js:183` |
  | service_date | string | yes (in theory) | **text** column, DD-MM-YYYY or YYYY-MM-DD (`backend:controllers/etlController.js:1750-1751,2605`) |
  | hiv_services, health_services, schooled_services, safe_services, stable_services | string | yes | service pillars (`backend:controllers/etlController.js:2607-2612`); list-like text |
  | other_hiv_services, other_health_services, other_schooled_services, other_safe_services, other_stable_services | string | yes | `backend:controllers/etlController.js:2607-2624` |
  | (other columns) | — | — | unknown (`SELECT *`, and the DDL is not in the repo) |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching caregiver services by household_id","error":<pg message>}` (`backend:controllers/householdController.js:196-203`).
- **Issues:** No ordering, so the frontend must sort by a date stored as text in mixed formats. There is no ownership check on the household ID (IDOR-style).
- **Used by:**
  - Wrapper: `getCaregiverServicesByHousehold` (`legacy:src/lib/api.ts:444-449`).
  - Callers: `legacy:src/pages/HouseholdProfile.tsx:168` (HouseholdProfile). The id comes from `location.state`, `?id=` or `sessionStorage`, not a route param (`legacy:src/pages/HouseholdProfile.tsx:139-147`).
- **Fixture:** `test/fixtures/dqa-caregiver.json` → `"GET /household/caregiver-services/:household_id(*)"`

#### `GET /household/caregiver-services-by-month/:district(*)`
- **Handler:** `backend:controllers/householdController.js:207` · **Route:** `backend:routes/householdRoutes.js:26`
- **Purpose:** Count of caregiver services per district per month (`MM-YYYY`).
- **Params:** `district` (path; `"All"` or `""` means all; a comma list is parameterised) (`backend:controllers/householdController.js:226-234`). FY `from`/`to` are **ignored**.
- **Fiscal year / date window:** none. The count covers all history.
- **Scope enforcement:** **trusts district param**.
- **Data source:** `caregiver_services cs JOIN all_households ah ON cs.household_id = ah.household_id` via `FlatPGConnection` (`backend:controllers/householdController.js:212-222`).
- **Server-side filtering / sort / pagination / limits:** `WHERE cs.service_date IS NOT NULL AND ah.district IS NOT NULL AND cs.household_id IS NOT NULL`, `GROUP BY ah.district, TO_CHAR(TO_DATE(cs.service_date,'DD-MM-YYYY'),'MM-YYYY')`, `ORDER BY ah.district, service_month` (`backend:controllers/householdController.js:237-240`).
- **Response:** `200 {"status":"success","data":[...]}`.

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | district | string | no | `ah.district` |
  | service_count | string | no | `COUNT(cs.household_id)`, bigint as string |
  | service_month | string | yes (theoretically) | `"MM-YYYY"` |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching caregiver services.","error":<pg message>}` (`backend:controllers/householdController.js:250-256`).
- **Issues:**
  - `TO_DATE(service_date,'DD-MM-YYYY')` assumes DD-MM-YYYY, but the column also holds ISO `YYYY-MM-DD` values (`backend:controllers/etlController.js:1750-1751`; `backend:lib/fyClause.js:26-27`). ISO rows will mis-parse into wrong months or raise a date/time error, failing the whole request.
  - `ORDER BY service_month` sorts the `MM-YYYY` **string**, so months from different years interleave (`01-2026` sorts before `10-2025`).
  - If `all_households` has duplicate rows per `household_id` (suggested by the `SELECT DISTINCT *` elsewhere), the JOIN multiplies counts.
  - No FY window.
- **Used by:**
  - Wrapper: `getCaregiverServicesByMonth` (`legacy:src/lib/api.ts:515-520`).
  - Callers: `legacy:src/components/dashboard/DataQualityChart.tsx:64` only, and DataQualityChart is never imported, so there is no live caller.
- **Fixture:** `test/fixtures/dqa-caregiver.json` → `"GET /household/caregiver-services-by-month/:district(*)"`

#### `GET /household/caregiver-services-by-district/:district(*)`
- **Handler:** `backend:controllers/householdController.js:265` · **Route:** `backend:routes/householdRoutes.js:33`
- **Purpose:** Raw caregiver service records for the district(s), with `district` appended. The route comment says "aggregates", but the handler returns raw rows (`backend:routes/householdRoutes.js:30` vs `backend:controllers/householdController.js:269-275`).
- **Params:** `district` (path; `"All"` or `""` means all; a comma list is parameterised) (`backend:controllers/householdController.js:279-286`). FY params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param**.
- **Data source:** `caregiver_services cs JOIN all_households ah` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `WHERE ah.district IS NOT NULL AND cs.household_id IS NOT NULL`, `ORDER BY ah.district`, no LIMIT (`backend:controllers/householdController.js:269-288`).
- **Response:** `200 {"status":"success","data":[...]}`. Each row has every `caregiver_services` column (see `/caregiver-services/:household_id`) plus `district` (string, from `ah.district`). If `caregiver_services` itself has a `district` column, pg returns two `district` keys and the last one wins in the JS object. This is uncertain because the DDL is unknown.
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching caregiver services by district.","error":<pg message>}` (`backend:controllers/householdController.js:293-303`).
- **Issues:** Unbounded: `"All"` returns every caregiver service row ever recorded, and legacy caches it client-side (`legacy:src/lib/api.ts:410-416`). No FY window. Possible row multiplication from duplicate `all_households` rows.
- **Used by:**
  - Wrapper: `getCaregiverServicesByDistrict` (`legacy:src/lib/api.ts:410-417`), IndexedDB list cache, 5 min TTL.
  - Callers: `legacy:src/pages/CaregiverRiskRegister.tsx:117` (CaregiverRiskRegister); `legacy:src/pages/CaseworkerProfile.tsx:85` (CaseworkerProfile); `legacy:src/lib/api.ts:466` (fallback inside `getCaregiverReferralsByDistrict`, reached from `legacy:src/pages/Referrals.tsx:170`, Referrals).
  - Dead callers: `legacy:src/components/dashboard/services/service-records.ts:170` (`fetchRawServices`, never called). Import only: `legacy:src/components/dashboard/RecentActivity.tsx:15`.
  - Params: for "All Districts" the Referrals fallback passes `undefined`, so the URL ends in `/undefined` (no rows) while the cache key becomes `caregiver_services_by_district:ALL` (`legacy:src/lib/api.ts:411-415`), the same key the risk register and caseworker profile read.
- **Fixture:** `test/fixtures/dqa-caregiver.json` → `"GET /household/caregiver-services-by-district/:district(*)"`

#### `GET /household/caregiver-referrals-by-month/:district(*)`
- **Handler:** `backend:controllers/householdController.js:307` · **Route:** `backend:routes/householdRoutes.js:37`
- **Purpose:** Count of caregiver referrals per district per month.
- **Params:** `district` (path; `"All"` or `""` means all; a comma list is parameterised) (`backend:controllers/householdController.js:326-334`). FY params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param**.
- **Data source:** `all_referrals cs JOIN all_households ah ON cs.household_id = ah.household_id` via `FlatPGConnection` (`backend:controllers/householdController.js:312-322`).
- **Server-side filtering / sort / pagination / limits:** `WHERE cs.referred_date IS NOT NULL AND ah.district IS NOT NULL AND cs.household_id IS NOT NULL`, `GROUP BY ah.district, TO_CHAR(TO_DATE(cs.referred_date,'DD-MM-YYYY'),'MM-YYYY')`, `ORDER BY ah.district, referral_month` (`backend:controllers/householdController.js:337-340`).
- **Response:** `200 {"status":"success","data":[...]}`.

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | district | string | no | `ah.district` |
  | referral_count | string | no | `COUNT(cs.household_id)`, bigint as string |
  | referral_month | string | yes (theoretically) | `"MM-YYYY"` |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching caregiver services.","error":<pg message>}`. The message is copy-pasted and says "services" (`backend:controllers/householdController.js:350-356`).
- **Issues:** It has the same problems as services-by-month: `MM-YYYY` string ordering, DD-MM-YYYY-only parsing of `referred_date`, no FY window, and possible duplicate-join inflation. `all_referrals` also contains VCA referrals keyed by `unique_id` (`backend:controllers/childController.js:336,368`). Only rows with a `household_id` are counted here, so any VCA referral row that also carries a `household_id` would be counted as a caregiver referral. The table's semantics are not in the repo.
- **Used by:**
  - Wrapper: `getCaregiverReferralsByMonth` (`legacy:src/lib/api.ts:529-534`).
  - Callers: `legacy:src/components/dashboard/DataQualityChart.tsx:74` only (component never imported). Import only: `legacy:src/pages/HouseholdProfile.tsx:8`.
- **Fixture:** `test/fixtures/dqa-caregiver.json` → `"GET /household/caregiver-referrals-by-month/:district(*)"`

#### `GET /household/household-services-by-district/:district(*)`
- **Handler:** `backend:controllers/householdController.js:365` · **Route:** `backend:routes/householdRoutes.js:44`
- **Purpose:** Raw household-level service records for the district(s), with `district` appended. As with caregiver services, the route comment says "aggregates", but the handler returns raw rows.
- **Params:** `district` (path; `"All"` or `""` means all; a comma list is parameterised) (`backend:controllers/householdController.js:379-386`). FY params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param**.
- **Data source:** `household_services hs JOIN all_households ah` via `FlatPGConnection` (`backend:controllers/householdController.js:369-375`).
- **Server-side filtering / sort / pagination / limits:** `WHERE ah.district IS NOT NULL AND hs.household_id IS NOT NULL`, `ORDER BY ah.district`, no LIMIT (`backend:controllers/householdController.js:369-388`).
- **Response:** `200 {"status":"success","data":[...]}`.

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | household_id | string | no | join key |
  | service_date | string (ISO timestamp) | yes (theoretically) | a **date** column (`backend:controllers/etlController.js:1751,2642`), which pg turns into a JS Date, so the JSON is e.g. `"2025-11-03T00:00:00.000Z"` (the offset depends on the server time zone) |
  | health_services, hh_level_services, schooled_services, safe_services, stable_services | string | yes | `backend:controllers/etlController.js:2644-2650` |
  | other_health_services, other_hh_level_services, other_schooled_services, other_safe_services, other_stable_services | string | yes | same lines |
  | district | string | no | appended `ah.district` |
  | (other columns) | — | — | unknown (`SELECT hs.*`) |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching household services by district.","error":<pg message>}` (`backend:controllers/householdController.js:396-406`).
- **Issues:** Unbounded with `"All"`. No FY window. Possible join multiplication. `service_date` serialises differently from `caregiver_services.service_date` (ISO timestamp vs text), so the normaliser must handle both.
- **Used by:**
  - Wrapper: `getHouseholdServicesByDistrict` (`legacy:src/lib/api.ts:419-426`), IndexedDB list cache, 5 min TTL.
  - Callers: `legacy:src/pages/CaseworkerProfile.tsx:97` (CaseworkerProfile, `""`); `legacy:src/pages/HouseholdRiskRegister.tsx:116` (HouseholdRiskRegister, `""`); `legacy:src/pages/HouseholdServicesPage.tsx:71` (HouseholdServicesPage).
  - Dead callers: `legacy:src/components/dashboard/services/service-records.ts:171` (never called).
  - Params: HouseholdServicesPage sends `"*"` for "All" (`legacy:src/pages/HouseholdServicesPage.tsx:71`); the handler only skips the filter for `""` or `"All"` (`backend:controllers/householdController.js:379`), so the nationwide view gets `[]`. The FY is in the query key but never sent.
- **Fixture:** `test/fixtures/dqa-households.json` → `"GET /household/household-services-by-district/:district(*)"`

#### `GET /household/hts-register-by-district/:district(*)`
- **Handler:** `backend:controllers/householdController.js:418` · **Route:** `backend:routes/householdRoutes.js:51`
- **Purpose:** HTS register rows, optionally filtered to **one** district.
- **Params:**
  - `district` (path). The value is trimmed. Empty or `"all districts"` (case-insensitive) returns all rows; anything else is matched with `LOWER(TRIM(district)) = LOWER($1)` (`backend:controllers/householdController.js:420-431`). **Comma lists are not supported**: `"Alder,Birch"` is compared as one literal and matches nothing. **`"All"` (the convention every other endpoint uses) is not recognised**: it is treated as a district named "All" and returns `[]`.
  - The route comment says `:district` and `?province` are ignored (`backend:routes/householdRoutes.js:48-49`). That comment is **stale**, because the handler does filter by district. `province` and the FY `from`/`to` are not read.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param**. Legacy always sends `"All Districts"` and filters on the client, including the province restriction (`legacy:src/pages/HTSRegister.tsx:93,128-140,160-170`), so every user downloads the national register.
- **Data source:** `public.hts_register` via `FlatPGConnection`. The table is loaded by the `hts_register` ETL pipeline from `hts_register_ecapplus_*.csv` (`backend:services/etlRunner.js:43-51`).
- **Server-side filtering / sort / pagination / limits:** only the district equality above. No ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[<hts_register row>...]}` (`backend:controllers/householdController.js:432`). Columns come from `SELECT *`. The DDL and CSV header are not in the repo; the only column the backend references is `district`. Columns legacy reads (uncertain): `province`, `district` (fallback `district_name`), `caseworker_name` (fallback `cw_name`), `health_facility` (fallbacks `facility`, `facility_name`), `ecap_id`, `client_number`, `hts_id`, `hiv_result`, `hiv_status`, `hiv_recent_test`, `case_art_number`, `art_date`, `art_date_initiated`, `date_tested_contact`, `date_tested_link`, `link_event_id`, `testing_modality`, `entry_point`, `test_done_hf`, `individual_age` (fallback `age`), `age_index_sns`, `gender_case`, `gender_link`, `relationship`, `other_relationship`, `sub_population`, `case_suppopulation`, `landmark`, `comment`, `date_created`, and date fallbacks `date_tested`/`test_date`/`hiv_test_date`/`date_screened`/`date_edited` (`legacy:src/pages/HTSProfile.tsx:149-153,231-430`, `legacy:src/pages/HTSRegister.tsx:166,174,183,194-223,267-276`). Legacy uses multi-key guessing, so these names are not authoritative. Legacy reads no first/last name or address key for HTS rows.
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching HTS register.","error":<pg message>}` (`backend:controllers/householdController.js:433-439`).
- **Issues:**
  - The convention differs from the other endpoints (`"All Districts"` vs `"All"`, and no comma list).
  - The route comment contradicts the code.
  - Unbounded national dump of HTS clients (sensitive health PII) to any authenticated user.
  - No FY window, although legacy passes one (`legacy:src/lib/api.ts:428-436`, where `_fy` is unused).
- **Used by:**
  - Wrappers: `getHTSRegisterByDistrict` (`legacy:src/lib/api.ts:428-440`) and its alias `getHtsRegisterByDistrict` (`legacy:src/lib/api.ts:442`).
  - Callers: `legacy:src/pages/HTSRegister.tsx:139` (HTSRegister, `"All Districts"`); `legacy:src/pages/HTSRiskRegister.tsx:125` (HTSRiskRegister) and `legacy:src/pages/HTSProfile.tsx:86` (HTSProfile), both `"*"`.
  - Params: `"*"` is not an "all" value for this handler (only `""` or `"all districts"`), so it runs `LOWER(TRIM(district)) = LOWER('*')` and returns `[]` (`backend:controllers/householdController.js:420-431`). The wrapper accepts an FY argument and drops it (`legacy:src/lib/api.ts:430`).
- **Fixture:** `test/fixtures/dqa-hts.json` → `"GET /household/hts-register-by-district/:district(*)"`

#### `GET /household/caregiver-referrals/:household_id(*)`
- **Handler:** `backend:controllers/householdController.js:443` · **Route:** `backend:routes/householdRoutes.js:55`
- **Purpose:** All referral records for one household.
- **Params:** `household_id` (path, parameterised `$1`) (`backend:controllers/householdController.js:445-452`).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (n/a)** (lookup by ID, with no district or user check).
- **Data source:** `all_referrals` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT * FROM all_referrals WHERE household_id = $1`, with no ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[...]}`. An unknown ID returns `[]`.

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | household_id | string | no | filter column |
  | unique_id | string | yes | VCA key in the same table (`backend:controllers/childController.js:336`); probably null or empty on caregiver-only referrals (uncertain) |
  | referred_date | string | yes | text, parsed as DD-MM-YYYY (`backend:controllers/householdController.js:316`) |
  | (other columns) | — | — | unknown (`SELECT *`) |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching all referrals by household_id","error":<pg message>}` (`backend:controllers/householdController.js:460-466`).
- **Issues:**
  - Returns VCA referrals too, if they carry the household_id. The endpoint is named "caregiver" but does not filter by referral subject.
  - Legacy also calls a non-existent `/household/district/caregiver-referrals[/:district]` (`legacy:src/lib/api.ts:455-463`). That request 404s and legacy falls back to client-side filtering of services.
- **Used by:**
  - Wrapper: `getHouseholdReferralsById` (`legacy:src/lib/api.ts:567-572`).
  - Callers: `legacy:src/pages/HouseholdProfile.tsx:404` (HouseholdProfile).
- **Fixture:** `test/fixtures/dqa-caregiver.json` → `"GET /household/caregiver-referrals/:household_id(*)"`

#### `GET /household/caregiver-caseplans/:household_id(*)`
- **Handler:** `backend:controllers/householdController.js:470` · **Route:** `backend:routes/householdRoutes.js:59`
- **Purpose:** Caregiver case plans for one household.
- **Params:** `household_id` (path, parameterised) (`backend:controllers/householdController.js:472-480`).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (n/a)** (lookup by ID).
- **Data source:** `ec_caregiver_case_plan` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT * FROM ec_caregiver_case_plan WHERE household_id = $1`, with no ORDER BY or LIMIT. Unlike the domains endpoint, there is no DISTINCT.
- **Response:** `200 {"status":"success","data":[...]}`. Columns come from `SELECT *`; the only one established from the backend is `household_id`. Legacy reads `case_plan_date`/`date_of_caseplan`/`date`, `case_plan_status`/`status` and `date_created`/`created_at`/`date_edited` with multi-key guessing (`legacy:src/pages/HouseholdProfile.tsx:1145-1153,1183,1187`), so these are uncertain.
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching all caregiver caseplans by household_id.","error":<pg message>}` (`backend:controllers/householdController.js:488-495`).
- **Issues:** Legacy `getCaregiverCasePlansByDistrict` would send a **district** name into this household_id route (`legacy:src/lib/api.ts:543-549`); that would always return `[]` (there is no district route), and its no-district form `/household/caregiver-caseplans` would 404 (path-to-regexp 0.1.7 requires the slash). It is dead code: `legacy:src/pages/HouseholdProfile.tsx:11` imports it but never calls it. The live caller is `getCaregiverCasePlansByHousehold` (`legacy:src/lib/api.ts:550-555`, called at `legacy:src/pages/HouseholdProfile.tsx:175`).
- **Used by:**
  - Wrapper: `getCaregiverCasePlansByHousehold` (`legacy:src/lib/api.ts:551-556`).
  - Callers: `legacy:src/pages/HouseholdProfile.tsx:175` (HouseholdProfile).
  - Params: the unused wrapper `getCaregiverCasePlansByDistrict` (`legacy:src/lib/api.ts:543-549`, import only at `legacy:src/pages/HouseholdProfile.tsx:11`) would send a district name into this household-id route (`backend:controllers/householdController.js:474-480`), and with no district it requests `/household/caregiver-caseplans`, which 404s.
- **Fixture:** `test/fixtures/dqa-caregiver.json` → `"GET /household/caregiver-caseplans/:household_id(*)"`

#### `GET /household/caregiver-caseplan-domains/:household_id(*)`
- **Handler:** `backend:controllers/householdController.js:499` · **Route:** `backend:routes/householdRoutes.js:63`
- **Purpose:** Caregiver case-plan domain rows (the vulnerabilities and actions per domain) for one household.
- **Params:** `household_id` (path, parameterised) (`backend:controllers/householdController.js:501-507`).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (n/a)** (lookup by ID).
- **Data source:** `ec_caregiver_case_plan_domain` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT DISTINCT * FROM ec_caregiver_case_plan_domain WHERE household_id = $1`, with no ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[...]}`. Columns come from `SELECT DISTINCT *`; only `household_id` is established from the backend. Legacy reads `case_plan_date`, `vulnerability_type`, `vulnerability`, `goal`, `services`, `service_referred`, `institution`, `due_date`, `status` and `vulnerability_comment` (`legacy:src/pages/HouseholdProfile.tsx:198,1268-1306`). These are uncertain, because no DDL is in the repo. Legacy joins domains to plans client-side on `case_plan_date` (`legacy:src/pages/HouseholdProfile.tsx:195-204`).
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching all caregiver case plan domains by household_id.","error":<pg message>}` (`backend:controllers/householdController.js:513-520`).
- **Issues:** `DISTINCT *` suggests the source contains duplicate rows. The schema is undocumented.
- **Used by:**
  - Wrapper: `getCaregiverCasePlanDomainsByHousehold` (`legacy:src/lib/api.ts:558-565`).
  - Callers: `legacy:src/pages/HouseholdProfile.tsx:192` (HouseholdProfile, lazy, after a "View Vulnerabilities" click, `:185-194`).
- **Fixture:** `test/fixtures/dqa-caregiver.json` → `"GET /household/caregiver-caseplan-domains/:household_id(*)"`

#### `GET /household/members/:household_id(*)`
- **Handler:** `backend:controllers/householdController.js:524` · **Route:** `backend:routes/householdRoutes.js:67`
- **Purpose:** The household's members (rows of `children` with that household_id).
- **Params:** `household_id` (path, parameterised) (`backend:controllers/householdController.js:525-531`).
- **Fiscal year / date window:** none. Active and closed members are both returned (no status filter).
- **Scope enforcement:** **by ID (n/a)** (lookup by ID).
- **Data source:** `children` via `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT DISTINCT * FROM children WHERE household_id = $1`, with no ORDER BY or LIMIT.
- **Response:** `200 {"status":"success for a single household family members","data":[...]}`. **The `status` string differs from the `"success"` every other endpoint uses** (`backend:controllers/householdController.js:535-538`). Columns established from backend SQL on `children`:

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | uid | string | no | member/VCA ID (`backend:controllers/childController.js:27,139`) |
  | household_id | string | no | filter column |
  | district | string | yes | `backend:controllers/childController.js:59` |
  | province | string | yes | `backend:controllers/etlController.js:1367,1372` |
  | facility | string | yes | `backend:controllers/etlController.js:2301` |
  | caseworker_name | string | yes | `backend:controllers/etlController.js:2301` |
  | firstname, lastname | string | yes | `backend:controllers/etlController.js:2556-2558` |
  | vca_gender | string | yes | `backend:controllers/etlController.js:2134` |
  | age | string | yes | text, sometimes `''` or `'0'` (`backend:controllers/etlController.js:2129,2176`) |
  | case_status | string | yes | `backend:controllers/childController.js:51` |
  | reason | string | yes | de-registration reason for children (`backend:controllers/childController.js:52`) |
  | date_enrolled, de_registration_date | string | yes | text dates per the backend comment (`backend:lib/fyClause.js:20-28`); not confirmed by DDL |
  | is_hiv_positive | string | yes | `backend:controllers/etlController.js:1953` |
  | art_number, date_last_vl | string | yes | `backend:controllers/etlController.js:1947-1950` |
  | (other columns) | — | — | unknown (`SELECT DISTINCT *`) |
- **Errors:** `500 {"status":"error occurred, NO family members found for this household","message":<pg message>}`. The shape differs (there is no `error` key), and it leaks the DB message (`backend:controllers/householdController.js:539-544`). "Not found" is actually `200` with `data: []`, not an error.
- **Issues:** Non-standard success and error envelopes. The member list is drawn only from `children` (no adult members or caregiver row). There is no ownership check.
- **Used by:**
  - Wrapper: `getHouseholdMembers` (`legacy:src/lib/api.ts:314-317`).
  - Callers: `legacy:src/pages/HouseholdProfile.tsx:220` (HouseholdProfile); `legacy:src/pages/Districts.tsx:249` (Districts export: one request per household, all at once, `:244-256`).
- **Fixture:** `test/fixtures/dqa-households.json` → `"GET /household/members/:household_id(*)"`

---

**Group: `/child`** (`backend:routes/childRoutes.js`, mounted at `backend:index.js:41`)

Mounts: `/child` → `routes/childRoutes.js` (`backend:index.js:41`); `/mother` → `routes/motherRoutes.js` (`backend:index.js:43`).

#### Notes for every `/child` and `/mother` endpoint

- **Auth:** every route sits behind `verifyDirectusToken` (`backend:index.js:38`). A missing or invalid token gets `401 {"status":"fail","message":"..."}` (`backend:middleware/verifyDirectusToken.js:69`). The token is read from `Authorization: Bearer` or from `?token=` (`backend:middleware/verifyDirectusToken.js:31-40`). If `AUTH_MODE=log`, bad tokens are logged and let through (`backend:middleware/verifyDirectusToken.js:62-68`). If `DIRECTUS_SECRET` is unset, enforce mode returns `500 {"status":"error","message":"Server authentication is not configured."}` (`backend:middleware/verifyDirectusToken.js:72-78`). The middleware sets `req.user` (`backend:middleware/verifyDirectusToken.js:87`), but no handler in `childController.js` or `motherController.js` reads `req.user`, `req.body` or imports `lib/userScope.js` (grep: `userScope|req.user|req.body`, no hits). **No endpoint here applies user scope.**
- **DB pool:** every handler uses `FlatPGConnection` (`backend:controllers/childController.js:1`, `backend:controllers/motherController.js:1`), which is the app/superset database (`backend:config/database.js:8-14`). `RawPGConnection` is never used.
- **`:param(*)` matching:** Express `^4.18.2` (`backend:package.json`) uses path-to-regexp 0.1.x, where `:x(*)` becomes `(.*)`. So the param:
  - spans slashes;
  - can be empty (`/child/vcas-assessed-register/` → `district = ""`);
  - needs the leading `/`, so `/child/vcas-count` with no trailing segment does **not** match and falls through to the 404 catch-all `{"status":"error","message":"Can't find <url> on this server"}` (`backend:index.js:55-60`).

  `node_modules` is not installed in the backend checkout, so this rests on the declared semver range.
- **"All" sentinel:** `/child` handlers skip the district filter only for the exact, case-sensitive string `All` or an empty string. `/mother` handlers also accept `all` and `all districts` in any case (`backend:controllers/motherController.js:5`). Any other value, such as `All Districts` on a `/child` route, is treated as a district name and returns zero rows.
- **Province:** no endpoint in this group takes a province param.
- **FY helpers:**
  - `parseFyWindow` (`backend:lib/fyClause.js:8-17`) reads `?from=YYYY-MM-DD&to=YYYY-MM-DD`. A window applies only when both pass the regex `^\d{4}-\d{2}-\d{2}$`. A single bound is silently ignored.
  - The regex does not validate calendar dates. `from=2025-13-45` passes, then fails at the `::date` cast, which returns 500 with the Postgres message.
  - `buildCohortFyClause` (`backend:lib/fyClause.js:29-57`) keeps a row when `date_enrolled <= to AND (de_registration_date IS NULL OR de_registration_date >= from)`. It accepts ISO and DD-MM-YYYY strings (`backend:lib/fyClause.js:40-41`, `:49-50`); an unparseable `date_enrolled` becomes NULL and the row is excluded (an unparseable `de_registration_date` also yields NULL, so that row is excluded too).
  - `buildServiceFyClause` is not imported by either controller (`backend:controllers/childController.js:2`).

---

#### `GET /child/vcas-count/:district(*)`
- **Handler:** `backend:controllers/childController.js:4` · **Route:** `backend:routes/childRoutes.js:6-7`
- **Purpose:** Count distinct children (VCAs) in the `children` table, optionally filtered by district and FY cohort.
- **Params:**
  - `district` (path, string, required segment): `All` or empty means no filter; otherwise one district or a comma-separated list, split on `,` and trimmed (`backend:controllers/childController.js:13-14`).
  - `from` / `to` (query, `YYYY-MM-DD`, optional, both needed): FY cohort window (`backend:controllers/childController.js:7`).
  - Ignored: `province`, `reason`, and anything else.
- **Fiscal year / date window:** `buildCohortFyClause` on `date_enrolled` / `de_registration_date`, params `$1=to`, `$2=from` (`backend:controllers/childController.js:21-24`). With no district filter the clause is prefixed with ` WHERE 1=1 ` (`backend:controllers/childController.js:27`).
- **Scope enforcement:** **trusts district param.** `All`/empty returns the national count to any authenticated user. No province param.
- **Data source:** table `children`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT COUNT(DISTINCT uid) AS count FROM children [WHERE district IN (...)] [FY clause]` (`backend:controllers/childController.js:27`). There is **no `case_status` / `reason` / de-registration filter**, so active and archived VCAs are both counted. No cache.
- **Response:** `200 {"status":"success","count": <string>}` (`backend:controllers/childController.js:30-32`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | `"success"` |
  | count | string | no | `COUNT(DISTINCT uid)` is bigint, so pg returns a string, e.g. `"1234"` |
- **Errors:** `500 {"status":"error","message":"An error occurred while retrieving assessed VCAs count.","error":"<pg error message>"}`. **DB error messages leak** (`backend:controllers/childController.js:35-39`).
- **Issues:**
  - **String-interpolated SQL:** district values are spliced into the SQL as literals, escaped only by doubling `'` (`backend:controllers/childController.js:16`). This is safe only while `standard_conforming_strings=on`; it should be parameterised like the `/vca-services-*` handlers.
  - **Semantic mismatch:** the handler name says "assessed", but it counts every row in `children`, while `/vcas-assessed-register` returns only active, non-de-registered rows (`backend:controllers/childController.js:51-53`). The dashboard count and the register length will disagree.
  - **Legacy no-district call 404s:** with no district, legacy calls `/child/vcas-count` with no trailing segment (`legacy:src/lib/api.ts:254-256`; used with no args at `legacy:src/pages/Documentation.tsx:82`). That path does not match the route and gets the 404 catch-all.
  - Invalid-but-regex-valid FY dates cause a 500 (see the FY helper notes above).
- **Used by:**
  - Wrapper: `getTotalVcasCount` (`legacy:src/lib/api.ts:253-259`).
  - Callers: `legacy:src/components/dashboard/MetricsGrid.tsx:133` (MetricsGrid on Dashboard; user district + FY); `legacy:src/pages/Districts.tsx:68` (Districts; district or `"All"` + FY) and `:147` (one call per case variant of a district name); `legacy:src/pages/Documentation.tsx:82` (Documentation; no arguments).
  - Params: with no district the wrapper builds `/child/vcas-count` (`legacy:src/lib/api.ts:254-256`), which 404s, so the Documentation stat always fails.
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vcas-count/:district(*)"`

#### `GET /child/vcas-assessed-register/:district(*)`
- **Handler:** `backend:controllers/childController.js:43` · **Route:** `backend:routes/childRoutes.js:10-11`
- **Purpose:** Full register of active VCAs: every column of `children`.
- **Params:**
  - `district` (path): `All`/empty, single, or comma list, interpolated (`backend:controllers/childController.js:57-60`).
  - `from` / `to` (query): FY cohort.
  - Ignored: `province`, `reason`, paging params (none supported).
- **Fiscal year / date window:** `buildCohortFyClause` with `$1=to`, `$2=from` (`backend:controllers/childController.js:63-66`). The de-registration half is redundant here because the base WHERE already requires `de_registration_date IS NULL`.
- **Scope enforcement:** **trusts district param.** Legacy calls it with `""` (all districts) from the VCA register and several dashboards (`legacy:src/pages/VcaRegister.tsx:163`, `legacy:src/pages/VcaServicesDashboard.tsx:250`), which returns national data.
- **Data source:** table `children`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:**
  - `SELECT DISTINCT * FROM children WHERE LOWER(TRIM(case_status)) IN ('active','1') AND (reason IS NULL OR TRIM(reason) = '') AND de_registration_date IS NULL [AND district IN (...)] [FY]` (`backend:controllers/childController.js:48-66`).
  - No ORDER BY, no LIMIT, no pagination. `DISTINCT *` across a wide row, with no cache on the server. The legacy client caches the response itself (`legacy:src/lib/api.ts:368-378`).
- **Response:** `200 {"status":"success","data":[<children row>...]}` (`backend:controllers/childController.js:69`). The columns are `SELECT *`.

  Columns established from backend SQL across controllers:

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | uid | string | no | VCA id; join key for `vca_services.vcaid` (`backend:controllers/childController.js:192`) |
  | household_id | string | yes | (`backend:controllers/householdController.js:529`) |
  | firstname, lastname | string | yes | (`backend:controllers/etlController.js:2556-2558`, children entity config) |
  | province | string | yes | (`backend:controllers/etlController.js:2407` with `entity_table: "children"` at `:2347`) |
  | district, ward, facility | string | yes | `district` is filtered here; ward/facility at `backend:controllers/etlController.js:818` |
  | case_status | string | yes | `'active'` / `'1'` here (case-insensitive) |
  | reason | string | yes | null or empty in this register |
  | date_enrolled | string | yes | stored as ISO or `DD-MM-YYYY` text (`backend:lib/fyClause.js:26-27`, `:40-41`) |
  | de_registration_date | string | yes | always null in this register |
  | age | string | yes | compared to `''` / `'0'` (`backend:controllers/etlController.js:2129`), so text |
  | vca_gender | string | yes | (`backend:controllers/etlController.js:2302`) |
  | calhiv, is_hiv_positive | string | yes | text; compared with `'1'`, `'true'`, `'yes'` (ILIKE), `'unknown'`, `''` (`backend:controllers/etlController.js:1411-1412`, `:1953`) |
  | art_number, date_started_art, date_last_vl | string | yes | text, compared to `''` (`backend:controllers/etlController.js:1947-1956`, `:2261`) |
  | caseworker_name | string | yes | (`backend:controllers/etlController.js:2302`) |
  | level_mmd | string | yes | compared to `''` (`backend:controllers/etlController.js:2198`) |
  | date_edited | string | yes | cast with `::date` (`backend:controllers/etlController.js:2154`, `:2303`); storage type unknown, so it may serialise as an ISO timestamp if the column is a real `date` |

  Not established for `children`: `caregiver_name`, `screened`, `partner` and `is_mother_virally_suppressed_wlhiv` appear in backend SQL only on `all_households` (`backend:controllers/etlController.js:2309`, `:2051`, `:2054`, `:2010`).

  The legacy UI also reads many further columns that cannot be confirmed from backend SQL, e.g. `birthdate`, `homeaddress`, `virally_suppressed`, `school_name`, and the `child_adolescent_in_*` flags (`legacy:src/pages/VcaProfile.tsx`). **Uncertain.**
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching VCAs.","error":"<pg message>"}`. Leaks DB messages (`backend:controllers/childController.js:72-76`).
- **Issues:**
  - **Interpolated SQL:** district values are spliced into the SQL, escaped by quote-doubling (`backend:controllers/childController.js:59`).
  - **Unbounded result set:** the whole national `children` table for `All`/empty.
  - **Duplicate rows hidden:** `DISTINCT *` suggests `children` has duplicate rows. That affects joins in the by-month endpoints below.
  - **Case-sensitive district match:** `IN (...)` is exact, whereas `/mother` lower-cases.
- **Used by:**
  - Wrapper: `getChildrenByDistrict` (`legacy:src/lib/api.ts:368-379`), IndexedDB list cache, 60 s TTL, stale-on-error.
  - Callers: `legacy:src/pages/VcaRegister.tsx:163` (VcaRegister); `legacy:src/pages/VcaProfile.tsx:205` (VcaProfile, whole register loaded to find one VCA); `legacy:src/pages/VcaRiskRegister.tsx:84,115` (VcaRiskRegister); `legacy:src/pages/HouseholdProfile.tsx:208` (HouseholdProfile); `legacy:src/pages/MotherIndexDetails.tsx:84` (MotherIndexDetails); `legacy:src/components/dashboard/GlobalSearch.tsx:68` (GlobalSearch in DashboardHeader).
  - Dead callers: `legacy:src/pages/VcaServicesDashboard.tsx:250,277` (page never imported). Import only: `legacy:src/pages/Districts.tsx:34`.
  - Params: no FY is sent by `legacy:src/pages/VcaRiskRegister.tsx:84`, `legacy:src/components/dashboard/GlobalSearch.tsx:68`, `legacy:src/pages/MotherIndexDetails.tsx:84`, `legacy:src/pages/HouseholdProfile.tsx:208` or `legacy:src/pages/VcaProfile.tsx:205`, so the cohort window is not applied there.
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vcas-assessed-register/:district(*)"`

#### `GET /child/vcas-archived-register/:district(*)`
- **Handler:** `backend:controllers/childController.js:80` · **Route:** `backend:routes/childRoutes.js:14-15`
- **Purpose:** Register of closed or inactive (de-registered) VCAs, optionally filtered by de-registration reason.
- **Params:**
  - `district` (path): `All`/empty, single, or comma list, **parameterised** (`backend:controllers/childController.js:97-104`).
  - `reason` (query, string, optional): exact, case-sensitive match on `reason`; absent, empty, or exactly lowercase `all` means no filter (`All` is treated as a reason value and matches nothing) (`backend:controllers/childController.js:106-109`).
  - `from` / `to` (query): FY cohort.
- **Fiscal year / date window:** `buildCohortFyClause` with `startParamIndex = params.length + 1` (`backend:controllers/childController.js:112-116`). Because every archived row has a `de_registration_date`, a row is kept when `date_enrolled <= to AND de_registration_date >= from`.
- **Scope enforcement:** **trusts district param.** Legacy calls it with `""` (all) from the archived register (`legacy:src/pages/VcaArchivedRegister.tsx:184`).
- **Data source:** table `children`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT DISTINCT * FROM children WHERE LOWER(TRIM(case_status)) IN ('closed','inactive') AND de_registration_date IS NOT NULL AND reason IS NOT NULL AND TRIM(reason) <> '' [district] [reason] [FY]` (`backend:controllers/childController.js:87-115`). No ORDER BY, LIMIT or cache.
- **Response:** `200 {"status":"success","data":[<children row>...]}` (`backend:controllers/childController.js:120-123`). Same columns as the assessed register, except `case_status` is closed/inactive and `reason` / `de_registration_date` are always non-null.
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching archived VCAs.","error":"<pg message>"}`. Leaks DB messages (`backend:controllers/childController.js:126-130`).
- **Issues:**
  - **Unbounded result set.**
  - **Inconsistent parameterisation:** this handler parameterises districts, but its siblings at lines 16 and 59 interpolate them.
  - **`reason` is case-sensitive:** the match is exact, while `case_status` is lower-cased.
- **Used by:**
  - Wrapper: `getChildrenArchivedRegister` (`legacy:src/lib/api.ts:388-408`), no cache.
  - Callers: `legacy:src/pages/VcaArchivedRegister.tsx:184` (VcaArchivedRegister; `""`, `reason`, FY); `legacy:src/pages/VcaProfile.tsx:211` (VcaProfile; district or `""`, no FY).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vcas-archived-register/:district(*)"`

#### `GET /child/vca-profile/:unique_id(*)`
- **Handler:** `backend:controllers/childController.js:134` · **Route:** `backend:routes/childRoutes.js:17`
- **Purpose:** Intended to return one VCA row by `uid`. **It is broken (see Issues).**
- **Params:**
  - `unique_id` (path): the route names the param `unique_id`, but the handler reads `req.params.uid` (`backend:controllers/childController.js:135`), which is always `undefined`.
  - Query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (no scope check; ignores district).** It would return any VCA by id with no geographic or user check, but in practice it returns nothing.
- **Data source:** table `children` (`SELECT DISTINCT * FROM children WHERE uid = $1`, `backend:controllers/childController.js:138-142`); `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** single-row lookup with `rows[0]`.
- **Response:** always `200`.
  - Because `uid` is `undefined`, pg binds NULL and `uid = NULL` matches nothing. `vca` is then `undefined`, and `res.json` drops the key, so the body is exactly `{"status":"success"}` (`backend:controllers/childController.js:144-149`).
  - If the bug were fixed, `data` would be one `children` row object (same columns as the assessed register), or absent when not found. There is no 404.

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | `"success"` |
  | data | object | absent | omitted in practice; would be a `children` row |
- **Errors:** the `catch` only `console.log`s and **never sends a response** (`backend:controllers/childController.js:150-152`), so the request hangs until the client or proxy times out.
- **Issues:**
  - **Param-name mismatch (`unique_id` vs `uid`):** the endpoint never returns data (`backend:routes/childRoutes.js:17` vs `backend:controllers/childController.js:135`).
  - **No error response:** the catch block never responds.
  - **No 404 for unknown ids.**
  - **No legacy frontend caller found** (grep: `vca-profile`). The wrapper `getVcaProfileById` is defined at `legacy:src/lib/api.ts:381-386` but never imported. The legacy VCA profile page instead loads the whole register and searches it client-side (`legacy:src/pages/VcaProfile.tsx:205-211`).
- **Used by:**
  - Wrapper: `getVcaProfileById` (`legacy:src/lib/api.ts:381-386`), never imported. It is the only wrapper that returns the body unnormalised.
  - Callers: none. VcaProfile loads the whole active and archived VCA registers instead (`legacy:src/pages/VcaProfile.tsx:205,211`).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-profile/:unique_id(*)"`

#### `GET /child/vca-services-by-month/:district(*)`
- **Handler:** `backend:controllers/childController.js:181` · **Route:** `backend:routes/childRoutes.js:20-21`
- **Purpose:** Count of VCA services grouped by district and service month (chart data).
- **Params:**
  - `district` (path): `All`/empty, single, or comma list, parameterised (`backend:controllers/childController.js:200-208`).
  - Ignored: `from` / `to` (not read), `province`.
- **Fiscal year / date window:** **none.** All-time history.
- **Scope enforcement:** **trusts district param.**
- **Data source:** `vca_services cs JOIN children ah ON cs.vcaid = ah.uid`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `WHERE cs.service_date IS NOT NULL AND ah.district IS NOT NULL AND cs.vcaid IS NOT NULL`, then `GROUP BY ah.district, TO_CHAR(TO_DATE(cs.service_date,'DD-MM-YYYY'),'MM-YYYY')` and `ORDER BY ah.district, service_month` (`backend:controllers/childController.js:186-214`). No LIMIT or cache. The result is one row per district-month, so it stays bounded.
- **Response:** `200 {"status":"success","data":[...]}` (`backend:controllers/childController.js:220-223`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | district | string | no | `ah.district` |
  | service_count | string | no | `COUNT(cs.vcaid)` is bigint, so a string |
  | service_month | string | no | `MM-YYYY`, e.g. `"10-2025"` |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching vca services.","error":"<pg message>"}`. Leaks DB messages (`backend:controllers/childController.js:226-230`).
- **Issues:**
  - **Wrong sort order:** `service_month` is `MM-YYYY` text, so `ORDER BY` sorts lexically, not chronologically (`"01-2026"` < `"10-2025"`). The client must re-sort.
  - **ISO dates can break the query:** `TO_DATE(service_date,'DD-MM-YYYY')` assumes one format. Elsewhere the backend treats `vca_services.service_date` as either ISO or DD-MM-YYYY (`backend:controllers/etlController.js:818`), so ISO rows could raise a date-out-of-range error (500) or be mis-bucketed. PLAUSIBLE.
  - **Inflated counts:** if `children` has duplicate `uid` rows (implied by `DISTINCT *` elsewhere), the join multiplies counts.
  - **No FY window:** the frontend cannot restrict it to the current FY.
- **Used by:**
  - Wrapper: `getVcaServicesByMonth` (`legacy:src/lib/api.ts:522-527`).
  - Callers: `legacy:src/components/dashboard/DataQualityChart.tsx:59` only (component never imported).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-services-by-month/:district(*)"`

#### `GET /child/vca-services-by-district/:district(*)`
- **Handler:** `backend:controllers/childController.js:239` · **Route:** `backend:routes/childRoutes.js:27-28`
- **Purpose:** Raw VCA service records for the given district(s), with the child's district appended. The route comment (`backend:routes/childRoutes.js:23-25`) wrongly says it "Aggregates VCA services by district"; the handler returns raw rows.
- **Params:**
  - `district` (path): `All`/empty, single, or comma list, parameterised (`backend:controllers/childController.js:253-260`).
  - Ignored: `from` / `to`, `province`.
- **Fiscal year / date window:** **none.**
- **Scope enforcement:** **trusts district param.** Legacy calls it with `""` (national) from several pages (`legacy:src/pages/VcaServicesDashboard.tsx:284`, `legacy:src/pages/VcaRiskRegister.tsx:121`, `legacy:src/pages/CaseworkerProfile.tsx:91`).
- **Data source:** `vca_services cs JOIN children ah ON cs.vcaid = ah.uid`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT cs.*, ah.district ... WHERE ah.district IS NOT NULL AND cs.vcaid IS NOT NULL [AND ah.district IN (...)] ORDER BY ah.district` (`backend:controllers/childController.js:243-262`). No LIMIT, paging or server cache. The legacy client caches it (`legacy:src/lib/api.ts:499-506`).
- **Response:** `200 {"status":"success","data":[<vca_services row + district>...]}` (`backend:controllers/childController.js:266`). The columns are `cs.*`. Columns established from backend SQL:

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | vcaid | string | no | filtered NOT NULL |
  | service_date | string | yes | text, ISO or `DD-MM-YYYY` |
  | health_services, other_health_services | string | yes | (etlController `vs.*` usage) |
  | hiv_services, other_hiv_services | string | yes | |
  | safe_services, other_safe_services | string | yes | |
  | schooled_services, other_schooled_services | string | yes | |
  | stable_services, other_stable_services | string | yes | |
  | district | string | no | appended from `children` |

  Any other `vca_services` columns are **uncertain**.
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching VCA services by district.","error":"<pg message>"}`. Leaks DB messages (`backend:controllers/childController.js:269-273`).
- **Issues:**
  - **Unbounded result set:** with `All`/empty it dumps the entire national `vca_services` table, which is heavy, and legacy does this from 4+ pages.
  - **Possible duplicate `district` key:** if `vca_services` has its own `district` column, the response object has a duplicate key, and pg keeps the last (the `children` one). PLAUSIBLE.
  - **Duplicate rows:** duplicate `children.uid` rows would duplicate service rows.
- **Used by:**
  - Wrapper: `getVcaServicesByDistrict` (`legacy:src/lib/api.ts:499-506`), IndexedDB list cache, 5 min TTL.
  - Callers: `legacy:src/pages/CaseworkerProfile.tsx:91` (CaseworkerProfile); `legacy:src/pages/VcaRiskRegister.tsx:121` (VcaRiskRegister); `legacy:src/lib/api.ts:489` (fallback inside `getVcaReferralsByDistrict`, reached from `legacy:src/pages/Referrals.tsx:176`, Referrals).
  - Dead callers: `legacy:src/pages/VcaServicesDashboard.tsx:284` (page never imported); `legacy:src/components/dashboard/services/service-records.ts:169` (never called). Import only: `legacy:src/pages/VcaProfile.tsx:7`, `legacy:src/components/dashboard/RecentActivity.tsx:14`.
  - Params: for "All Districts" the Referrals fallback passes `undefined`, so the URL ends in `/undefined` while the cache key is `vca_services_by_district:ALL` (`legacy:src/lib/api.ts:500-504`).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-services-by-district/:district(*)"`

#### `GET /child/vca-services/:vcaid(*)`
- **Handler:** `backend:controllers/childController.js:155` · **Route:** `backend:routes/childRoutes.js:30`
- **Purpose:** All service records for one VCA.
- **Params:** `vcaid` (path, string, required; an empty segment matches and returns `[]`). Query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (no scope check; ignores district).** Any authenticated user can fetch any VCA's services by id. There is no geographic check.
- **Data source:** `SELECT * FROM vca_services WHERE vcaid = $1` (`backend:controllers/childController.js:159`); `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** single-id filter. **No ORDER BY**, so row order is undefined. No LIMIT.
- **Response:** `200 {"status":"success","data":[<vca_services row>...]}` (`backend:controllers/childController.js:167-170`). Same `vca_services` columns as above, without the appended `district`.
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching VCA services.","error":"<pg message>"}` (`backend:controllers/childController.js:173-177`).
- **Issues:**
  - **No ordering:** the client must sort by the mixed-format `service_date`.
  - **No authorisation:** there is no scope check on the record.
- **Used by:**
  - Wrapper: `getVcaServicesByChildId` (`legacy:src/lib/api.ts:508-513`).
  - Callers: `legacy:src/pages/VcaProfile.tsx:217` (VcaProfile). The id comes from `location.state` or `sessionStorage` (`legacy:src/pages/VcaProfile.tsx:188-196`).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-services/:vcaid(*)"`

#### `GET /child/vca-caseplans/:unique_id(*)`
- **Handler:** `backend:controllers/childController.js:277` · **Route:** `backend:routes/childRoutes.js:33-34`
- **Purpose:** Case plans for one VCA.
- **Params:** `unique_id` (path). Query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (no scope check; ignores district).** It is a by-id lookup with no geographic check.
- **Data source:** `SELECT DISTINCT * FROM ec_vca_case_plan WHERE unique_id = $1` (`backend:controllers/childController.js:281-287`); `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** no ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[<ec_vca_case_plan row>...]}` (`backend:controllers/childController.js:291-294`). Only `unique_id` is established from SQL. The legacy UI guesses date and status fields (`plan.case_plan_date`, `plan.case_plan_status`, `plan.date_created`, `plan.date_edited`, etc. at `legacy:src/pages/VcaProfile.tsx`). **All other columns are uncertain.**

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | unique_id | string | no | VCA id |
  | (others) | unknown | unknown | `SELECT DISTINCT *`; no schema in repo |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching all VCA caseplans by unique_id.","error":"<pg message>"}` (`backend:controllers/childController.js:297-302`).
- **Issues:**
  - **Legacy no-id call 404s:** the legacy wrapper `getVcaCasePlansByDistrict` calls `/child/vca-caseplans` with no segment (`legacy:src/lib/api.ts:581-585`). That 404s, but the wrapper is unused.
  - **No ordering** of case plans.
- **Used by:**
  - Wrapper: `getVcaCasePlansById` (`legacy:src/lib/api.ts:587-592`).
  - Callers: `legacy:src/pages/VcaProfile.tsx:229` (VcaProfile).
  - Params: the unused wrapper `getVcaCasePlansByDistrict` (`legacy:src/lib/api.ts:581-585`) ignores its argument and requests `/child/vca-caseplans` with no id, which 404s.
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-caseplans/:unique_id(*)"`

#### `GET /child/vca-caseplan-domains/:unique_id(*)`
- **Handler:** `backend:controllers/childController.js:306` · **Route:** `backend:routes/childRoutes.js:37-38`
- **Purpose:** Case-plan domains (vulnerabilities/goals) for one VCA.
- **Params:** `unique_id` (path). Query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (no scope check; ignores district).** It is a by-id lookup.
- **Data source:** `SELECT DISTINCT * FROM ec_vca_case_plan_domain WHERE unique_id = $1` (`backend:controllers/childController.js:309-314`); `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** no ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[...]}` (`backend:controllers/childController.js:316-319`). Only `unique_id` is established. **Other columns are uncertain**; the legacy UI guesses `case_plan_date`, `vulnerability`, `vulnerability_type`, `goal`, `services`, `service_referred`, `institution`, `due_date`, `status` (`legacy:src/pages/VcaProfile.tsx:249`, `legacy:src/pages/VcaProfile.tsx:1148-1181`).
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching all VCA case plan domains by unique_id.","error":"<pg message>"}` (`backend:controllers/childController.js:322-327`).
- **Issues:** no ordering; no scope check.
- **Used by:**
  - Wrapper: `getVcaCasePlanDomainsById` (`legacy:src/lib/api.ts:594-602`).
  - Callers: `legacy:src/pages/VcaProfile.tsx:243` (VcaProfile, lazy, `:237-245`).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-caseplan-domains/:unique_id(*)"`

#### `GET /child/vca-referrals/:unique_id(*)`
- **Handler:** `backend:controllers/childController.js:331` · **Route:** `backend:routes/childRoutes.js:41-42`
- **Purpose:** Referrals recorded for one VCA.
- **Params:** `unique_id` (path). Query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **by ID (no scope check; ignores district).** It is a by-id lookup.
- **Data source:** `SELECT * FROM all_referrals WHERE unique_id = $1` (`backend:controllers/childController.js:335-340`); `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** no ORDER BY or LIMIT.
- **Response:** `200 {"status":"success","data":[...]}` (`backend:controllers/childController.js:344-347`). Columns established from SQL:

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | unique_id | string | no | VCA id (the same table holds caregiver referrals keyed by `household_id`, `backend:controllers/householdController.js:448`) |
  | household_id | string | yes | |
  | referred_date | string | yes | `DD-MM-YYYY` text, parsed with `TO_DATE(...,'DD-MM-YYYY')` at `backend:controllers/childController.js:367` |
  | (others) | unknown | unknown | `SELECT *`; uncertain |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching all referrals by unique_id","error":"<pg message>"}` (`backend:controllers/childController.js:350-354`).
- **Issues:** no ordering; no scope check.
- **Used by:**
  - Wrapper: `getVcaReferralsById` (`legacy:src/lib/api.ts:574-579`).
  - Callers: `legacy:src/pages/VcaProfile.tsx:223` (VcaProfile).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-referrals/:unique_id(*)"`

#### `GET /child/vca-referrals-by-month/:district(*)`
- **Handler:** `backend:controllers/childController.js:358` · **Route:** `backend:routes/childRoutes.js:45-46`
- **Purpose:** Count of VCA referrals grouped by district and referral month (chart data).
- **Params:**
  - `district` (path): `All`/empty, single, or comma list, parameterised (`backend:controllers/childController.js:377-385`).
  - Ignored: `from` / `to`, `province`.
- **Fiscal year / date window:** **none.**
- **Scope enforcement:** **trusts district param.**
- **Data source:** `all_referrals cs JOIN children ah ON cs.unique_id = ah.uid`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `WHERE cs.referred_date IS NOT NULL AND ah.district IS NOT NULL AND cs.unique_id IS NOT NULL`, then `GROUP BY ah.district, TO_CHAR(TO_DATE(cs.referred_date,'DD-MM-YYYY'),'MM-YYYY')` and `ORDER BY ah.district, referral_month` (`backend:controllers/childController.js:363-391`).
- **Response:** `200 {"status":"success","data":[...]}` (`backend:controllers/childController.js:397-400`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | district | string | no | |
  | referral_count | string | no | `COUNT(cs.unique_id)` is bigint, so a string |
  | referral_month | string | no | `MM-YYYY` |
- **Errors:** `500 {"status":"error","message":"An error occurred while fetching vca services.","error":"<pg message>"}` (`backend:controllers/childController.js:402-407`). The message is copy-pasted from the services handler and says "services".
- **Issues:**
  - **Wrong sort order:** lexical `MM-YYYY` sort, as for services-by-month.
  - **Single date format assumed:** same `TO_DATE` risk as services-by-month.
  - **No FY window.**
  - **Misleading error text** (line 405).
  - **Inflated counts:** duplicate-uid joins can inflate counts.
- **Used by:**
  - Wrapper: `getVcaReferralsByMonth` (`legacy:src/lib/api.ts:536-541`).
  - Callers: `legacy:src/components/dashboard/DataQualityChart.tsx:69` only (component never imported).
- **Fixture:** `test/fixtures/dqa-vcas.json` → `"GET /child/vca-referrals-by-month/:district(*)"`

---

**Group: `/mother`** (`backend:routes/motherRoutes.js`, mounted at `backend:index.js:43`)

#### `/mother` shared helper

`buildDistrictWhere(district)` (`backend:controllers/motherController.js:3-12`) handles the district filter for all `/mother` endpoints:
- An empty value, `all`, or `all districts` (any case) means no filter.
- Otherwise it emits `AND LOWER(TRIM(district)) = LOWER(TRIM($1))`. This is a **single value only**: a comma list such as `Alder,Birch` is compared as one literal string and matches nothing. The value is parameterised.

#### `GET /mother/district/:district(*)/filtered`
- **Handler:** `backend:controllers/motherController.js:14` · **Route:** `backend:routes/motherRoutes.js:5`
- **Purpose:** Mother index register rows (`mothers` table) for one district, or all.
- **Params:**
  - `district` (path, string): see `buildDistrictWhere`.
  - **Ignored:** `from` / `to`. Legacy sends them (`legacy:src/lib/api.ts:341-345`), but the handler never reads `req.query`.
  - The `/filtered` suffix has no effect; it reaches the same handler as the next route.
- **Fiscal year / date window:** **none.** FY params are ignored.
- **Scope enforcement:** **trusts district param.** `All` / `All Districts` returns national data. No province param.
- **Data source:** table `mothers`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** `SELECT * FROM mothers WHERE 1 = 1 [AND LOWER(TRIM(district)) = LOWER(TRIM($1))] ORDER BY household_id ASC` (`backend:controllers/motherController.js:17-23`). No LIMIT or cache.
- **Response:** `200 {"status":"success","data":[<mothers row>...]}` (`backend:controllers/motherController.js:26`). Columns established from SQL:

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | household_id | string | yes | sort key; counted DISTINCT by the count endpoints |
  | district | string | yes | filter column |
  | (others) | unknown | unknown | `SELECT *`; no schema in repo. The legacy UI guesses `unique_id`, `caregiver_name`, `facility`, `province`, `caregiver_hiv_status`, `anc_date`, etc. (`legacy:src/pages/MotherIndexRegister.tsx`, `legacy:src/pages/MotherIndexDetails.tsx`). **Uncertain.** |
- **Errors:** `500 {"status":"error","message":"<raw pg error message>"}`. **The raw DB message is the `message` field** (`backend:controllers/motherController.js:29`).
- **Issues:**
  - **FY filter silently ignored:** the FY filter in the legacy mother register does nothing server-side.
  - **No comma-list support,** unlike `/child`.
  - **Unbounded result set** for "All".
  - **Raw DB error is the `message`.**
- **Used by:**
  - Wrapper: `getMothersByDistrict` (`legacy:src/lib/api.ts:341-346`).
  - Callers: `legacy:src/pages/MotherIndexRegister.tsx:77` (MotherIndexRegister, register) and `:86` (the list `.length` is used as the count for a single district).
  - Params: the wrapper sends `from`/`to` (`legacy:src/lib/api.ts:343`), but the handler reads only `req.params.district` (`backend:controllers/motherController.js:14-26`).
- **Fixture:** `test/fixtures/dqa-mothers.json` → `"GET /mother/district/:district(*)/filtered"`

#### `GET /mother/district/:district(*)`
- **Handler:** `backend:controllers/motherController.js:14` · **Route:** `backend:routes/motherRoutes.js:6`
- **Purpose:** The same handler as `/filtered`: the mothers register for a district.
- **Params:** `district` (path, single value, `buildDistrictWhere`). Query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param.**
- **Data source:** table `mothers`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** as above (`ORDER BY household_id ASC`, unbounded).
- **Response:** identical to `/filtered`.
- **Errors:** `500 {"status":"error","message":"<pg message>"}`.
- **Issues:**
  - **Shadows `/mother/district/count/:district`:** the `(*)` param spans slashes and this route is registered before the count route (`backend:routes/motherRoutes.js:6` vs `:8`). A request to `/mother/district/count/Alder` is handled here with `district = "count/Alder"` and returns `{"status":"success","data":[]}` instead of a count. Inferred from path-to-regexp 0.1.x semantics.
  - **No legacy frontend caller found** (grep: `mother/district/` without `/filtered`). Legacy only calls the `/filtered` variant (`legacy:src/lib/api.ts:343`).
- **Used by:**
  - No caller: the only mother-register wrapper always appends `/filtered` (`legacy:src/lib/api.ts:343`).
- **Fixture:** `test/fixtures/dqa-mothers.json` → `"GET /mother/district/:district(*)"`

#### `GET /mother/total/count`
- **Handler:** `backend:controllers/motherController.js:33` · **Route:** `backend:routes/motherRoutes.js:7`
- **Purpose:** National count of mothers (as distinct households).
- **Params:** none. Query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **ignores district (returns all).** It is always national, for any authenticated user.
- **Data source:** `SELECT COUNT(DISTINCT household_id)::int AS count FROM mothers` (`backend:controllers/motherController.js:35-38`); `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** none.
- **Response:** `200 {"status":"success","count": <number>}` (`backend:controllers/motherController.js:39`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | |
  | count | number | no | `::int`, so a **number** (unlike `/child/vcas-count`, which returns a string); defaults to `0` |
- **Errors:** `500 {"status":"error","message":"<pg message>"}` (`backend:controllers/motherController.js:42`).
- **Issues:**
  - **Counts households, not mothers:** it counts distinct `household_id`. The legacy mother register uses this count for "All Districts" but `data.length` (rows) for a single district (`legacy:src/pages/MotherIndexRegister.tsx:84-87`), so the two numbers are not comparable.
  - **Type differs from `/child/vcas-count`:** this count is a number, that one a string.
- **Used by:**
  - Wrapper: `getTotalMothersCount` with no district (`legacy:src/lib/api.ts:272-278`).
  - Callers: `legacy:src/pages/MotherIndexRegister.tsx:85` (MotherIndexRegister, only for "All Districts"); `legacy:src/pages/Documentation.tsx:87` (Documentation). Import only: `legacy:src/pages/Districts.tsx:32`.
  - Response handling: this endpoint returns a JSON number, and `getCountValue` treats a numeric `0` as missing (`if (record.count)`, `legacy:src/lib/api.ts:43`), so an empty table shows as `null`.
- **Fixture:** `test/fixtures/dqa-mothers.json` → `"GET /mother/total/count"`

#### `GET /mother/district/count/:district(*)`
- **Handler:** `backend:controllers/motherController.js:46` · **Route:** `backend:routes/motherRoutes.js:8`
- **Purpose:** Intended: count of mothers (distinct households) for a district.
- **Params:** `district` (path, single value, `buildDistrictWhere`).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param.**
- **Data source:** `SELECT COUNT(DISTINCT household_id)::int AS count FROM mothers WHERE 1 = 1 [district clause]` (`backend:controllers/motherController.js:49-58`); `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** none.
- **Response:** **in practice unreachable.** `/mother/district/:district(*)` at `backend:routes/motherRoutes.js:6` captures it first and returns `{"status":"success","data":[]}`. If it were reachable, the handler would send `200 {"status":"success","count": <number>}` (`backend:controllers/motherController.js:59`). The fixture records the **real** server output (`{"status":"success","data":[]}`) and gives the intended count shape in `_meta.note`.
- **Errors:** `500 {"status":"error","message":"<pg message>"}` (`backend:controllers/motherController.js:62`).
- **Issues:**
  - **Dead route:** shadowed by the route registered before it.
  - **No legacy frontend caller found** (grep: `mother/district/count`, `district/count`; only `/household/district/count` and `/child/district/count` exist in legacy).
- **Used by:**
  - No wrapper and no caller: a grep of `legacy:src` for `mother/district/count` finds nothing.
- **Fixture:** `test/fixtures/dqa-mothers.json` → `"GET /mother/district/count/:district(*)"`

#### `GET /mother/count/:district(*)`
- **Handler:** `backend:controllers/motherController.js:46` · **Route:** `backend:routes/motherRoutes.js:9`
- **Purpose:** Count of mothers (distinct households) for a district, or all.
- **Params:** `district` (path, single value; `All` / `All Districts` / empty means national).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param.**
- **Data source:** as above; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** none.
- **Response:** `200 {"status":"success","count": <number>}`. Same table as `/mother/total/count`.
- **Errors:** `500 {"status":"error","message":"<pg message>"}`.
- **Issues:**
  - **No legacy frontend caller found** (grep: `mother/count`).
  - Duplicates `/mother/members-count`.
- **Used by:**
  - No wrapper and no caller: a grep of `legacy:src` for `mother/count` finds nothing. The district count wrapper uses `/mother/members-count/` instead (`legacy:src/lib/api.ts:272-278`).
- **Fixture:** `test/fixtures/dqa-mothers.json` → `"GET /mother/count/:district(*)"`

#### `GET /mother/members-count/:district(*)`
- **Handler:** `backend:controllers/motherController.js:46` · **Route:** `backend:routes/motherRoutes.js:10`
- **Purpose:** Same handler as `/mother/count/:district`: count of mothers (distinct households) for a district.
- **Params:** `district` (path, single value).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param.**
- **Data source:** `mothers`; `FlatPGConnection`.
- **Server-side filtering / sort / pagination / limits:** none.
- **Response:** `200 {"status":"success","count": <number>}`.
- **Errors:** `500 {"status":"error","message":"<pg message>"}`.
- **Issues:**
  - Three routes share one handler (`backend:routes/motherRoutes.js:8-10`).
  - The legacy wrapper calls this route when a district is given (`legacy:src/lib/api.ts:272-277`). However, the mother register never passes a district to it (`legacy:src/pages/MotherIndexRegister.tsx:85`), so in practice only `/mother/total/count` is hit.
- **Used by:**
  - Wrapper: `getTotalMothersCount(district)` builds this path when a district is passed (`legacy:src/lib/api.ts:274`).
  - Callers: none in practice. Both callers pass no district (`legacy:src/pages/MotherIndexRegister.tsx:85`, `legacy:src/pages/Documentation.tsx:87`), so they get `/mother/total/count`; for a single district MotherIndexRegister counts the register rows instead (`legacy:src/pages/MotherIndexRegister.tsx:86`).
- **Fixture:** `test/fixtures/dqa-mothers.json` → `"GET /mother/members-count/:district(*)"`

---

#### Dead legacy wrappers pointing at `/child` and `/mother` (no matching backend route)

- `/child/district/count/:district`: `getVcaCountByDistrict` (`legacy:src/lib/api.ts:294-299`). No such route in `routes/childRoutes.js`, so it would 404. The wrapper is never imported.
- `/child/caseworker/count/:district`: `getCaseworkerCountByDistrict` (`legacy:src/lib/api.ts:280-285`). No such route, so it would 404. The wrapper is never imported.
- `/child/vca-caseplans` (no id): `getVcaCasePlansByDistrict` (`legacy:src/lib/api.ts:581-585`). It would 404. Unused.
- `/child/vcas-count` (no district): `getTotalVcasCount()` with no args (`legacy:src/lib/api.ts:254-256`), **used** at `legacy:src/pages/Documentation.tsx:82`. It **404s at runtime**.

---

**Group: `/etl` pipeline** (ETL runs, output files, report email, tablet sync; `backend:routes/etlRoutes.js`, mounted at `backend:index.js:42`)

Router mounted at `/etl` (`backend:index.js:42`), behind the global Directus-token middleware
(`backend:index.js:38`). The token is read from `Authorization: Bearer` or from `?token=`
(`backend:middleware/verifyDirectusToken.js:31-40`). `POST /etl/tablet-sync/notify` is the only route
in this group listed in `PUBLIC_ROUTES` (`backend:middleware/verifyDirectusToken.js:25`). With
`AUTH_MODE=log`, requests without a valid token pass through and `req.user` stays unset
(`backend:middleware/verifyDirectusToken.js:62-68`). On success `req.user` is the decoded Directus JWT
(`backend:middleware/verifyDirectusToken.js:87`). A missing or invalid token in the default `enforce` mode returns
`401 {status:"fail", message}` (`backend:middleware/verifyDirectusToken.js:62-70`), and an unset `DIRECTUS_SECRET`
returns `500` (`backend:middleware/verifyDirectusToken.js:72-78`). Note the 401 envelope uses `"fail"`, not `"error"`.

**No endpoint in this group checks a role or permission.** Any user with a valid Directus token can start or cancel
pipelines, send the report email, download country-wide extracts and read the full provider list.

#### How the ETL runner works (background for the data-pipeline page)

- **DB pool:** `SupersetPG`, a separate `pg.Pool` built from the `SUPERSET_DB_*` env vars
  (`backend:services/etlRunner.js:8-14`). It is distinct from `FlatPGConnection` / `RawPGConnection`
  (`backend:config/database.js:8-14`, `backend:config/database.js:36-42`).
- **Runs table:** `etl_runs_ecap_plus`, created on startup if it is missing (`backend:services/etlRunner.js:81-98`).
  Columns: `id SERIAL`, `run_id VARCHAR(20) UNIQUE`, `pipeline VARCHAR(50)`, `pipeline_name VARCHAR(100)`,
  `status VARCHAR(20) DEFAULT 'pending'`, `triggered_by VARCHAR(100)`, `started_at TIMESTAMPTZ`, `completed_at TIMESTAMPTZ`,
  `duration_sec INTEGER`, `logs TEXT DEFAULT ''`, `error TEXT`, `created_at TIMESTAMPTZ DEFAULT NOW()`.
  The table is shared with Mage AI, which writes its own rows with `triggered_by LIKE 'scheduled:mage%'`
  (`backend:services/etlRunner.js:103-107`).
- **Pipelines** are a hard-coded map with three keys: `ecap_plus`, `hts_register` and `pmtct` (`backend:services/etlRunner.js:29-68`).
  Each entry has a display `name`, a working `dir` on the server, an `envScript`, a `runScript` and a `downloadFiles()` function.
  `downloadFiles()` returns today's file names, stamped `DDMMYY` in the `Africa/Lusaka` timezone (`backend:services/etlRunner.js:18-25`):
  - `ecap_plus`: 2 CSVs, a monthly caregiver services file and a monthly VCA services file, under `cleaned_csv/` (`:35-41`).
  - `hts_register`: 1 CSV, the HTS register, under `cleaned_csv_hts/` (`:48-53`).
  - `pmtct`: 2 CSVs, the PMTCT mother and child registers, under `cleaned_csv_pmtct/` (`:60-66`).
  Real file names follow `<prefix>_<programtoken>_<DDMMYY>.csv`. Fixtures use placeholder names.
- **A run** = one `bash -c "source <envScript> && ./<runScript>"` child process, spawned in the pipeline's `dir`
  (`backend:services/etlRunner.js:242-246`). The working `dir` values are hard-coded absolute server paths (`:32`, `:45`, `:57`)
  and the child's `HOME` is overridden with a hard-coded path (`:245`). On start, a row is inserted with `status='running'` and a random id
  `RUN-<1000..9999>` (`:187-190`, `:236-240`). stdout and stderr are appended to `logs`; stderr lines get the prefix `[stderr] ` (`:250-260`).
  When the process exits, code 0 sets `success` and any other code sets `failed` with `error = "Process exited with code N"`.
  Both set `completed_at` and `duration_sec` (`:262-283`). A spawn error sets `failed`, `completed_at` and `error = err.message`,
  but leaves `duration_sec` NULL (`:285-292`).
  Live processes are tracked only in the in-memory map `activeProcesses` (`:76`, `:248`).
- **Statuses** seen in code: `pending` (column default, `:88`; Node never writes it, since the INSERT sets `running`, `:237-238`),
  `running`, `success`, `failed`, `cancelled` (`:268-312`).
  The startup sweep marks this backend's own `running`/`pending` rows as `failed` with the message "Process lost…" (`:106-108`).
  `GET /etl/runs` marks any row that has been `running` for more than 4 hours as `failed` (`backend:controllers/etlController.js:78-86`).
- **Concurrency guard:** a pipeline is refused if a row with the same `pipeline` key has `status='running'` (`backend:services/etlRunner.js:223-231`).
- **Scheduling:** the Node midnight cron is disabled unless `NODE_ETL_SCHEDULER=1`. Mage AI owns the schedule (`backend:services/etlRunner.js:179-185`).
  When enabled, the cron runs the three pipelines one after another and polls every 30 s (`:119-177`, `:154`). Midnight is
  computed in the server's local timezone (`setHours(0,0,0,0)`, `:120-126`), not Africa/Lusaka.
- **Freshness:** `GET /etl/last-success` reads `MAX(completed_at)` of successful rows, which include Mage rows. The legacy app polls it every 30 s
  (`legacy:src/components/EtlInvalidator.tsx:28`, `legacy:src/components/EtlInvalidator.tsx:56`). The first value is only a baseline; when a later
  value is greater, it clears the IndexedDB cache and invalidates every query whose key does not start with `"etl"`
  (`legacy:src/components/EtlInvalidator.tsx:68-80`).

---

#### `GET /etl/last-success`
- **Handler:** `backend:controllers/etlController.js:25` · **Route:** `backend:routes/etlRoutes.js:7`
- **Purpose:** Returns the timestamp of the most recent successful ETL run. The frontend polls it to invalidate its cache.
- **Params:** none.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **no geographic data**.
- **Data source:** `etl_runs_ecap_plus` via `SupersetPG` (`backend:controllers/etlController.js:27-29`).
- **Server-side filtering / sort / pagination / limits:** `WHERE status = 'success'`, aggregate `MAX(completed_at)`. Single row, no caching.
- **Response:** always `200`. `{ status: "success", last_success_at, note? }`

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | always `"success"`, even when the query fails |
  | last_success_at | string (ISO timestamptz) | yes | `null` if there are no successful rows or the query failed |
  | note | string | — | present only on failure; holds the raw DB error message (`:37-41`) |
- **Errors:** none at the HTTP level. A DB failure returns 200 with `last_success_at: null` and `note: err.message` (`backend:controllers/etlController.js:34-42`).
- **Issues:**
  - DB error text leaks to the client in `note` (`backend:controllers/etlController.js:40`).
  - Because it fails soft, the frontend cannot tell "never ran" from "DB down". Both return `null`.
  - The value covers every pipeline in the table, including Mage-run pipelines, so any successful pipeline, however small, invalidates the whole cache.
- **Used by:**
  - Wrapper: none. `fetchLastSuccess` uses a raw `fetch` (`legacy:src/components/EtlInvalidator.tsx:31-47`, call at `:35`).
  - Callers: `legacy:src/components/EtlInvalidator.tsx:55` (`queryFn`, polled every 30 s, `:53-61`); the component is mounted once at the app root (`legacy:src/App.tsx:229`).
  - Params: none. The bearer header was added by the uncommitted security patch (`legacy:src/components/EtlInvalidator.tsx:33-40`); a 401 or any error is treated as "no new run" (`:41-46`). The `note` field is ignored.
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/last-success"`

#### `POST /etl/run`
- **Handler:** `backend:controllers/etlController.js:45` · **Route:** `backend:routes/etlRoutes.js:9`
- **Purpose:** Starts a pipeline as a server-side bash process and returns at once with 202.
- **Params:**
  - `pipeline` (body, string, required). Valid keys are `ecap_plus`, `hts_register` and `pmtct` (`backend:services/etlRunner.js:29-68`). Looked up with `PIPELINES[pipelineKey]` (`backend:services/etlRunner.js:218`).
  - Any other body fields are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **n/a**. This is an operational action. There is **no permission check**: any authenticated user can start a pipeline.
- **Data source:** `SELECT` on `etl_runs_ecap_plus` for the running guard, then `INSERT` and later `UPDATE`s, all via `SupersetPG` (`backend:services/etlRunner.js:223-240`). It spawns a child process on the API host (`:243`).
- **Server-side filtering / sort / pagination / limits:** n/a. One run per pipeline at a time (`:223-231`).
- **Response:** `202` `{ status: "accepted", message, data }`

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | `"accepted"` |
  | message | string | no | `Pipeline "<name>" started. Poll GET /etl/runs/<run_id> for status.` |
  | data.run_id | string | no | `RUN-NNNN` |
  | data.pipeline | string | no | pipeline key |
  | data.pipeline_name | string | no | display name from config |
  | data.status | string | no | always `"running"` |
  | data.started_at | string (ISO) | no | JS `Date` serialised |
- **Errors:**
  - `400` `{status:"error", message}` when `pipeline` is missing (`backend:controllers/etlController.js:49-55`).
  - `409` when the message contains "already running" (`:66`).
  - `500` `{status:"error", message: err.message}` for everything else, including an unknown pipeline ("Unknown pipeline: x", `backend:services/etlRunner.js:219-221`), a `run_id` UNIQUE collision, and DB errors. The raw message leaks.
- **Issues:**
  - **Security:** no authorization. Any token holder can make the server run shell scripts (`backend:services/etlRunner.js:242-246`). The script names come from config, not user input, so there is no command injection.
  - `triggeredBy = req.user.email || req.user.name` (`backend:controllers/etlController.js:57`). The middleware sets `req.user` to the decoded Directus JWT, which per the comment holds `{ id, role, app_access, admin_access }` (`backend:middleware/verifyDirectusToken.js:87`). It has no email or name, so `triggered_by` is stored as NULL for user-triggered runs. It is `"api"` only when no token was verified (AUTH_MODE=log).
  - The lookup `PIPELINES[pipelineKey]` is a plain object lookup. Inherited keys such as `constructor` or `toString` pass the `!pipeline` check (`backend:services/etlRunner.js:218-221`). They insert a junk run row (for `constructor`, `pipeline_name` becomes the function name `"Object"`) and spawn `bash -c "source undefined && ./undefined"` with `cwd` undefined, i.e. in the server's cwd, which then fails.
  - Unknown pipeline returns 500 instead of 400/404 (`backend:controllers/etlController.js:66`).
  - `run_id` comes from only 9000 random values (`backend:services/etlRunner.js:187-190`). A collision with any historical row violates UNIQUE and returns 500. The odds grow as history accumulates.
  - The "already running" guard is check-then-insert, not atomic (`backend:services/etlRunner.js:223-240`). Two concurrent POSTs can both start.
- **Used by:**
  - Wrapper: `triggerEtlPipeline` (`legacy:src/lib/api.ts:714-717`), not imported anywhere in `legacy:src`. The data-pipeline page cannot start runs.
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"POST /etl/run"`

#### `GET /etl/runs`
- **Handler:** `backend:controllers/etlController.js:73` · **Route:** `backend:routes/etlRoutes.js:10`
- **Purpose:** Lists recent ETL runs, newest first. Before listing, it auto-fails any run that has been `running` for more than 4 hours.
- **Params:**
  - `limit` (query, int, default 20, capped at 100 via `Math.min(parseInt(limit) || 20, 100)`, `backend:controllers/etlController.js:88`).
  - `pipeline` (query, string, optional, exact match, `:93-96`).
  - `status` (query, string, optional, exact match, `:97-100`).
  - The legacy frontend sends `limit=30` (`legacy:src/pages/DataPipelinePage.tsx:192`, `legacy:src/lib/api.ts:729`).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **no geographic data**.
- **Data source:** `etl_runs_ecap_plus` via `SupersetPG`. It runs an `UPDATE` first (`:78-86`), then a `SELECT` (`:104-111`).
- **Server-side filtering / sort / pagination / limits:** parameterised WHERE on `pipeline` and `status`. `ORDER BY created_at DESC LIMIT $n`. No offset or pagination. `logs` is deliberately left out of the SELECT.
- **Response:** `200` `{ status: "success", count, data: [...] }`

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | count | number | no | `rows.length` |
  | data[].run_id | string | no | `RUN-NNNN` from Node; Mage rows may use another format (not in this repo) |
  | data[].pipeline | string | no | |
  | data[].pipeline_name | string | yes | column is nullable |
  | data[].status | string | yes | `pending`/`running`/`success`/`failed`/`cancelled` (column has a default but no NOT NULL) |
  | data[].triggered_by | string | yes | NULL for user-triggered runs (see POST /etl/run); `scheduled:mage…` for Mage; `scheduled:daily-cron` for the Node cron |
  | data[].started_at | string (ISO) | yes | |
  | data[].completed_at | string (ISO) | yes | null while running |
  | data[].duration_sec | number | yes | INTEGER, so it serialises as a number |
  | data[].error | string | yes | |
  | data[].created_at | string (ISO) | yes | |
- **Errors:** `500` `{status:"error", message: err.message}`. The DB message leaks.
- **Issues:**
  - The GET has a write side effect: an `UPDATE` sweep on every call (`backend:controllers/etlController.js:78-86`). The sweep also marks Mage-owned rows as failed, unlike the startup sweep, which skips them (`backend:services/etlRunner.js:107`).
  - A negative `limit` (e.g. `-5`) survives `|| 20` and `Math.min`, so Postgres raises "LIMIT must not be negative" and the endpoint returns 500 (`backend:controllers/etlController.js:88`).
  - `status` and `pipeline` values are not validated, but they are parameterised, so this is safe.
- **Used by:**
  - Wrapper: `getEtlRuns` (`legacy:src/lib/api.ts:719-731`).
  - Callers: `legacy:src/pages/DataPipelinePage.tsx:192` (DataPipelinePage; `{ limit: 30 }`, polled every 10 s, `:190-194`).
  - Params: the wrapper also supports `pipeline` and `status`, which the page never sends.
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/runs"`

#### `GET /etl/runs/:runId`
- **Handler:** `backend:controllers/etlController.js:123` · **Route:** `backend:routes/etlRoutes.js:11`
- **Purpose:** Returns one run, including its full log text. The UI polls it while a run is live.
- **Params:** `runId` (path, string, required, exact match).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **no geographic data**.
- **Data source:** `SELECT * FROM etl_runs_ecap_plus WHERE run_id = $1` via `SupersetPG` (`:126-129`).
- **Server-side filtering / sort / pagination / limits:** a single row. The `logs` column is unbounded.
- **Response:** `200` `{ status: "success", data: {...} }`. Fields are every table column: `id` (number), `run_id`, `pipeline`, `pipeline_name`, `status`, `triggered_by`, `started_at`, `completed_at`, `duration_sec` (number|null), `logs` (string, default `''`), `error` (string|null), `created_at`. Nullability is as in `GET /etl/runs`; `logs` is also nullable by DDL but defaults to `''`. If Mage added columns to the shared table they would also appear, since it is `SELECT *`; this cannot be confirmed from this repo.
- **Errors:** `404` `{status:"error", message:"Run not found"}` (`:131-135`). `500` with `err.message`.
- **Issues:**
  - `logs` holds raw stdout/stderr of the shell scripts (`backend:services/etlRunner.js:250-260`), sent to any authenticated user. It may contain hostnames, file paths or connection details printed by the scripts. The size is unbounded, and the full log is re-sent on every poll.
- **Used by:**
  - Wrapper: `getEtlRunById` (`legacy:src/lib/api.ts:733-736`); `runId` is not URL-encoded.
  - Callers: `legacy:src/pages/DataPipelinePage.tsx:367` (view logs) and `:383` (3 s poll while the run is pending or running, `:375-390`).
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/runs/:runId"`

#### `POST /etl/cancel/:runId`
- **Handler:** `backend:controllers/etlController.js:143` · **Route:** `backend:routes/etlRoutes.js:12`
- **Purpose:** Sends SIGTERM to a pipeline process started by this backend instance.
- **Params:** `runId` (path, string, required). The body is ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **n/a**. There is no permission check.
- **Data source:** the in-memory `activeProcesses` map (`backend:services/etlRunner.js:303-305`). Then a fire-and-forget `UPDATE etl_runs_ecap_plus` via `SupersetPG` (`:308-312`).
- **Server-side filtering / sort / pagination / limits:** n/a.
- **Response:** `200` `{ status: "success", message: "Run <runId> cancelled." }`
- **Errors:** `404` `{status:"error", message:"No active process found for this run. It may have already completed."}` (`backend:controllers/etlController.js:148-154`). `500` with `err.message`.
- **Issues:**
  - **Bug: a cancelled run probably ends up `failed`.** `cancelPipeline` writes `status='cancelled'` without awaiting it (`backend:services/etlRunner.js:308-312`). After the kill, the child's `close` handler still fires with code `null`, because the handler was attached at spawn and is never removed. It then writes `status='failed'` and `error="Process exited with code null"` (`:262-282`). The last write wins, so the row will usually read `failed`.
  - Only processes spawned by this Node instance can be cancelled. Mage-triggered runs, runs started before a restart, and runs on another replica all get 404 (`backend:services/etlRunner.js:76`, `:304-305`).
  - `child.kill("SIGTERM")` signals only the `bash -c` process (`:306`). Grandchild processes started by the scripts may keep running, since no process group is killed.
  - Any authenticated user can cancel.
- **Used by:**
  - Wrapper: `cancelEtlRun` (`legacy:src/lib/api.ts:738-739`), not imported anywhere in `legacy:src`.
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"POST /etl/cancel/:runId"`

#### `GET /etl/pipelines`
- **Handler:** `backend:controllers/etlController.js:164` · **Route:** `backend:routes/etlRoutes.js:13`
- **Purpose:** Lists the configured pipelines and today's expected output file names.
- **Params:** none.
- **Fiscal year / date window:** none. File names carry today's `DDMMYY` stamp in Africa/Lusaka time (`backend:services/etlRunner.js:18-25`).
- **Scope enforcement:** **no geographic data**.
- **Data source:** the static `PIPELINES` config (`backend:services/etlRunner.js:316-322`). No DB.
- **Server-side filtering / sort / pagination / limits:** none. Three entries, in config order.
- **Response:** `200` `{ status: "success", data: [...] }`

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | data[].id | string | no | pipeline key (`ecap_plus` / `hts_register` / `pmtct`) |
  | data[].name | string | no | display name |
  | data[].downloadFiles | string[] | no | today's file names only (no paths) |
- **Errors:** no try/catch. A synchronous throw would reach Express's default error handler (HTML 500). Unlikely.
- **Issues:**
  - The pipeline list and display names are hard-coded on the backend (`backend:services/etlRunner.js:31`, `:44`, `:56`). The `ecap_plus` display name contains the program brand (`:31`); the other two are generic. The new frontend should show the server-supplied `name` and never hard-code it.
- **Used by:**
  - Wrapper: `getEtlPipelines` (`legacy:src/lib/api.ts:741-744`).
  - Callers: `legacy:src/pages/DataPipelinePage.tsx:186` (DataPipelinePage). The page still fetches files from a hardcoded `PIPELINE_KEYS` list (`legacy:src/pages/DataPipelinePage.tsx:106`).
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/pipelines"`

#### `GET /etl/files/:pipeline`
- **Handler:** `backend:controllers/etlController.js:200` · **Route:** `backend:routes/etlRoutes.js:14`
- **Purpose:** For each of today's expected output files of a pipeline, reports whether it exists on disk, with its size and mtime.
- **Params:** `pipeline` (path, string, required, a pipeline key).
- **Fiscal year / date window:** none. Only today's stamped file names are checked (`:211-214`).
- **Scope enforcement:** **no geographic data**. The listing has none. The files themselves are country-wide extracts.
- **Data source:** filesystem `fs.existsSync`/`statSync` under the pipeline `dir` (`:216-227`).
- **Server-side filtering / sort / pagination / limits:** none.
- **Response:** `200` `{ status: "success", data: [...] }`

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | data[].name | string | no | |
  | data[].exists | boolean | no | |
  | data[].size | number | yes | bytes; null if missing |
  | data[].sizeFormatted | string | yes | e.g. `"12.3 MB"` (`formatBytes`, `backend:controllers/etlController.js:2473-2479`); null if missing or 0 bytes (`size ? … : null`) |
  | data[].lastModified | string (ISO) | yes | `stat.mtime`; null if missing |
- **Errors:** `404` `{status:"error", message:"Pipeline not found"}` (`:205-209`). `500` with `err.message`.
- **Issues:**
  - After midnight Lusaka time, yesterday's files are reported as `exists:false` until a new run finishes, even though they are still on disk (`backend:services/etlRunner.js:18-25`).
  - The lookup `PIPELINES[pipeline]` accepts inherited keys (e.g. `constructor`). `downloadFiles` is then undefined, `.map` throws, and the endpoint returns 500 with a TypeError message (`backend:controllers/etlController.js:203-216`).
  - A 0-byte file gets `sizeFormatted: null`, although `formatBytes(0)` would return `"0 B"` (`:232`).
- **Used by:**
  - Wrapper: `getEtlFiles` (`legacy:src/lib/api.ts:746-749`); `pipeline` is not URL-encoded.
  - Callers: `legacy:src/pages/DataPipelinePage.tsx:241` (DataPipelinePage; one sequential call per hardcoded pipeline key, errors swallowed to `[]`, `:237-246`).
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/files/:pipeline"`

#### `POST /etl/send-report`
- **Handler:** `backend:controllers/etlController.js:243` (body in `_sendUnifiedEtlReport`, `:267-370`, HTML in `_renderEtlReportHtml`, `:372-490`) · **Route:** `backend:routes/etlRoutes.js:15`
- **Purpose:** Emails an HTML summary of the latest run of each of 7 pipelines (this program plus the sister program) to a hard-coded recipient list.
- **Params:** none. The body is ignored, so the frontend cannot choose recipients or a date.
- **Fiscal year / date window:** none. It reports the latest run per `pipeline_name` regardless of date, despite the "today's" comment (`:254-256`, `:275-287`).
- **Scope enforcement:** **n/a**. There is no permission check.
- **Data source:** `etl_runs` UNION ALL `etl_runs_ecap_plus` via `SupersetPG`, ranked with `ROW_NUMBER() OVER (PARTITION BY pipeline_name ORDER BY started_at DESC NULLS LAST, created_at DESC)` (`:275-288`). Results are matched to a hard-coded `DAG_PIPELINES` list by display name (`:257-265`, `:301-303`). Mail goes through nodemailer using the `SMTP_*` env vars (`:348-353`).
- **Server-side filtering / sort / pagination / limits:** one row per pipeline_name. The output is shaped by the 7-entry `DAG_PIPELINES` list.
- **Response:** `200` `{ status: "success", message: "Report email sent to <recipients>" }` (`:362-365`). The message contains the recipient email addresses.
- **Errors:** `500` `{status:"error", message: err.message}` (`:366-369`). SMTP and DB errors leak.
- **Issues:**
  - **Hard-coded recipients, sender and dashboard URLs** in the controller (`:248`, `:271`, `:356`, `:474`, `:477`). The response echoes recipient emails to any caller (`:364`).
  - There is no authorization or rate limit, so any authenticated user can trigger unlimited emails (`:243-251`).
  - **Name mismatch:** `DAG_PIPELINES` expects names such as `"HTS Register Extract (ECAP Plus)"` (`:259-260`). The Node runner writes `pipeline_name` as `"HTS Register Extract"` and `"Prevention of Mother-to-Child Transmission Register Extract"` (`backend:services/etlRunner.js:44`, `:56`). Runs started from the dashboard for those pipelines never match and show as "pending" in the email. Only Mage rows, if they use the suffixed names, match.
  - The report date and start times use the server's local timezone (`toLocaleString` with no `timeZone`, `:299`, `:305`), while file stamps use Africa/Lusaka (`backend:services/etlRunner.js:20`). The two can disagree.
  - The `transport` param is named misleadingly: it is a DB pool, not a mail transport (`:246`, `:288`).
  - The HTML is built by string interpolation without escaping (`:389-396`), but no DB string reaches it raw: names come from the constant `DAG_PIPELINES` (`:316`), status is mapped through the `STATUS` table (`:388`), and start time and duration are formatted values. No injection path today.
  - The query reads the sister program's `etl_runs` table as well (`:280`). If that table is missing from the `SUPERSET_DB_NAME` database, the whole report fails with 500.
  - The email body also hard-codes branding and the output file-name list for both programs (`:402`, `:407`, `:459-465`, `:485`).
- **Used by:**
  - Wrapper: `sendEtlReport` (`legacy:src/lib/api.ts:768`), body `{}`.
  - Callers: `legacy:src/pages/DataPipelinePage.tsx:404` (DataPipelinePage). The success toast shows `data.message`, which contains the recipient addresses (`legacy:src/pages/DataPipelinePage.tsx:405`, `backend:controllers/etlController.js:364`).
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"POST /etl/send-report"`

#### `GET /etl/download/:pipeline/:fileName`
- **Handler:** `backend:controllers/etlController.js:169` · **Route:** `backend:routes/etlRoutes.js:16`
- **Purpose:** Streams one of today's pipeline output CSVs as an attachment.
- **Params:**
  - `pipeline` (path, string, required).
  - `fileName` (path, string, required). It must exactly equal one of the names from today's `downloadFiles()` (`backend:services/etlRunner.js:324-333`).
  - `token` (query): the auth token, because browser anchor downloads cannot set headers (`legacy:src/lib/api.ts:753-766`, `backend:middleware/verifyDirectusToken.js:36-38`). The legacy app URL-encodes `fileName` (`legacy:src/lib/api.ts:764`).
- **Fiscal year / date window:** none. Only today's stamped files are reachable.
- **Scope enforcement:** **ignores district (returns all)**. The CSVs are whole-program extracts (caregiver/VCA monthly services, HTS register, PMTCT registers). There is no scope or permission check, so any authenticated user, including a district-scoped one, gets national data.
- **Data source:** filesystem `fs.createReadStream` (`backend:controllers/etlController.js:193-194`). The CSV columns come from the external bash exporters, which are not in this repo.
- **Server-side filtering / sort / pagination / limits:** none. The whole file is streamed.
- **Response:** `200`, headers `Content-Type: text/csv`, `Content-Disposition: attachment; filename="<fileName>"`, `Content-Length: <bytes>` (`:188-191`). The body is the raw CSV. **Columns are uncertain** (defined by external scripts).
- **Errors:**
  - `404` `{status:"error", message:"File \"x\" not found for pipeline \"y\""}` when the name is not whitelisted (`:174-179`).
  - `404` `{status:"error", message:"File not yet generated. Run the pipeline first."}` when today's file is missing (`:181-186`).
  - `500` with `err.message`.
- **Issues:**
  - **Security:** country-wide PII-bearing extracts with no role or scope check. The token in `?token=` can end up in access logs and browser history.
  - Path traversal is prevented by exact matching against the whitelist (`backend:services/etlRunner.js:328`). The whitelist also keeps `fileName` safe to interpolate into `Content-Disposition` (`:190`).
  - Inherited keys as `pipeline` (e.g. `constructor`) pass the `!pipeline` check in `getDownloadFilePath`; `getDownloadFiles` then returns undefined and `.find` throws, giving 500 with a TypeError message (`backend:services/etlRunner.js:70-73`, `:325-328`).
  - No `error` handler on the read stream (`:193-194`). A read error after the headers are sent leaves the response hanging or truncated.
  - Yesterday's files cannot be downloaded after midnight Lusaka time until a new run finishes.
  - `compression()` is global (`backend:index.js:18`) and would gzip the stream, while the explicit `Content-Length` is set from the uncompressed size. The compression middleware is expected to drop it when compressing, but `node_modules` is not present in the backend checkout, so this is not verified here.
- **Used by:**
  - Wrapper: `getEtlDownloadUrl` builds the URL (`legacy:src/lib/api.ts:759-766`) and adds `?token=` through `withTokenParam` (`legacy:src/lib/api.ts:753-757`, uncommitted security patch); no request is made by the wrapper.
  - Callers: `legacy:src/pages/DataPipelinePage.tsx:393`, inside `handleDownload`, which clicks an `<a target="_blank">` (`:392-399`); triggered by the per-file button at `:936`.
  - Params: the token travels in the query string because an anchor cannot send headers; `pipeline` is not URL-encoded, `fileName` is.
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/download/:pipeline/:fileName"` (bodyText CSV; columns invented)

#### `GET /etl/tablet-sync/stream`
- **Handler:** `backend:controllers/etlController.js:663` · **Route:** `backend:routes/etlRoutes.js:19`
- **Purpose:** A Server-Sent Events stream of the tablet/provider sync summary. Pushes when the data changes or a webhook arrives, otherwise sends heartbeats.
- **Params:** `token` (query): the auth token, because EventSource cannot set headers (`legacy:src/lib/api.ts:751-757`, `legacy:src/lib/api.ts:796-798`). There are no other params.
- **Fiscal year / date window:** none. Activity windows are fixed at 7 and 30 days from now (`backend:controllers/etlController.js:493-494`, `:516-526`).
- **Scope enforcement:** **ignores district (returns all)**. Every provider in every district is pushed to every subscriber.
- **Data source:** `getTabletSyncStatusData()` (`:492-619`):
  1. Primary: `tablet_sync_status` LEFT JOIN a CTE over `children` (facility → MAX(district)), via `SupersetPG`, with a 5 s timeout (env `TABLET_SYNC_STATUS_QUERY_TIMEOUT_MS`) (`:551-576`). `source` = `"ecap_plus_superset_db.tablet_sync_status"`.
  2. Fallback, used if the primary errors, times out or returns 0 rows: `children` GROUP BY `caseworker_name, facility` via `FlatPGConnection`, with a 7 s timeout (env `TABLET_SYNC_SNAPSHOT_QUERY_TIMEOUT_MS`) (`:600-618`). `source` = `"ecap_plus_source.children"`, `refreshed_at` = null.
- **Server-side filtering / sort / pagination / limits:** `ORDER BY last_activity DESC`. No LIMIT; the provider list is unbounded. Each connection re-queries every `max(TABLET_SYNC_STREAM_INTERVAL_MS, 10000)` ms, or 30000 if the env value is not a number (`:713-721`). There is no shared cache between connections.
- **Response:** `200` with headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` (`:664-669`). Named events (`event:` + `data:` JSON lines, `:636-640`):
  - `heartbeat` `{status:"connected", emitted_at}`, sent once on connect (`:707-710`).
  - `tablet-sync` `{status:"success", data:<TabletSyncStatus>, emitted_at}`, sent right after connect (forced), when the fingerprint changes, or on a webhook refresh (`:678-689`, `:674-676`).
  - `heartbeat` `{status:"ok", emitted_at}` on interval ticks with no change (`:690-694`).
  - `tablet-sync-error` `{status:"error", message, emitted_at}` when the query fails (`:696-702`). The DB message leaks.
  The `data` object is the same as in `GET /etl/tablet-sync` (see that table). The fingerprint covers counts plus provider, location_id, last_activity, total_events and status (`:621-634`).
  Clients must use `addEventListener` for the named events. `onmessage` receives nothing.
- **Errors:** errors come as `tablet-sync-error` events. If the token is missing or invalid, the middleware returns `401 {status:"fail", message}` JSON before the stream opens (`backend:middleware/verifyDirectusToken.js:69`); `EventSource` cannot read that body and just fires `error`.
- **Issues:**
  - **Performance:** N open tabs each run the query every 10 s. A `notify` webhook makes every connection query at the same moment (`:706`, `:674-676`). If `tablet_sync_status` is empty or unavailable, each tick runs the fallback full `GROUP BY` over `children`.
  - `withTimeout` neither cancels the underlying pg query nor clears its timer (`:495-504`). Timed-out queries keep running on the DB.
  - `pushLatest` checks `closed` only before awaiting the query (`:679`). The close handler calls `res.end()` (`:723-728`), so a query that resolves after the client disconnects writes to an ended stream.
  - PII exposure: provider (caseworker) names, facilities and districts for the whole program go to any authenticated user.
- **Used by:**
  - Wrapper: `getTabletSyncStreamUrl` builds the URL with `?token=` (`legacy:src/lib/api.ts:796-798`, uncommitted security patch).
  - Callers: `new EventSource(...)` at `legacy:src/pages/DataPipelinePage.tsx:295`, opened only while the "tablets" tab is active (effect at `:281-354`); events are written into the `["etl","tablet-sync"]` query cache (`:301-321`).
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/tablet-sync/stream"` (bodyText SSE sample)

#### `POST /etl/tablet-sync/notify`
- **Handler:** `backend:controllers/etlController.js:735` · **Route:** `backend:routes/etlRoutes.js:22`
- **Purpose:** A webhook that Mage calls after the tablet-sync refresh. It wakes every SSE connection to re-query and push.
- **Params:** header `x-webhook-secret`, compared after trim with env `TABLET_SYNC_WEBHOOK_SECRET` (`:736-747`). The body is ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **n/a**. The route is public: it is in `PUBLIC_ROUTES` and skips the Directus token (`backend:middleware/verifyDirectusToken.js:25`).
- **Data source:** none directly. It emits `refresh` on the in-process `tabletSyncBus` (`backend:controllers/etlController.js:13-14`, `:749`).
- **Server-side filtering / sort / pagination / limits:** none.
- **Response:** `202` `{ status: "accepted", message: "Tablet sync refresh queued." }` (`:750-753`).
- **Errors:** `401` `{status:"error", message:"Invalid webhook secret."}` when the secret is set and does not match (`:741-746`).
- **Issues:**
  - **Security:** if `TABLET_SYNC_WEBHOOK_SECRET` is unset or blank, the check is skipped entirely (`:739`). The endpoint is then unauthenticated, and anyone can force every connected SSE client to query the DB, which amplifies load.
  - The secret comparison is not constant-time (`:741`).
  - The bus is in-process only, so with several API replicas a webhook reaches only one of them.
  - No legacy frontend caller found (grep: `tablet-sync/notify`). This is expected, since Mage is the caller.
- **Used by:**
  - No wrapper and no caller: a grep of `legacy:src` for `tablet-sync/notify` finds nothing. The route is called by Mage (`backend:routes/etlRoutes.js:22`).
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"POST /etl/tablet-sync/notify"`

#### `GET /etl/tablet-sync`
- **Handler:** `backend:controllers/etlController.js:646` · **Route:** `backend:routes/etlRoutes.js:25`
- **Purpose:** A one-shot tablet/provider sync status summary, with the same payload as the SSE `tablet-sync` event.
- **Params:** none. Any district/province params are ignored.
- **Fiscal year / date window:** none. The 7- and 30-day activity windows are relative to now (`:493-494`).
- **Scope enforcement:** **ignores district (returns all)**. No param is read and `req.user` is not used (`:646-657`).
- **Data source:** `getTabletSyncStatusData()`. Primary is `tablet_sync_status` plus `children` on `SupersetPG`; fallback is `children` on `FlatPGConnection` (`:551-618`). See the SSE entry above.
- **Server-side filtering / sort / pagination / limits:** primary filters `provider_name IS NOT NULL AND TRIM(provider_name) <> ''`; fallback filters `caseworker_name IS NOT NULL AND != ''`. Both use `ORDER BY last_activity DESC` and have no LIMIT. No caching.
- **Response:** `200` `{ status: "success", data }`

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | data.total | number | no | providers.length |
  | data.active_7d | number | no | providers with last_activity ≤ 7 days ago |
  | data.active_30d | number | no | ≤ 30 days ago, **includes** active_7d (`:518-523`) |
  | data.stale | number | no | between 7 and 30 days ago |
  | data.source | string | no | `"ecap_plus_superset_db.tablet_sync_status"` or `"ecap_plus_source.children"` |
  | data.refreshed_at | string (ISO) | yes | max `updated_at` from the primary query; always null on the fallback (`:579-591`, `:618`) |
  | data.providers[].provider | string | no | `provider_name` / `caseworker_name` (a person's name) |
  | data.providers[].location_id | string | yes | primary: `COALESCE(location_name, location_id, 'Unknown')`, so it is actually the facility **name**; fallback: `facility`, which can be null |
  | data.providers[].facility | string | no | `row.facility \|\| row.location_id \|\| "Unknown"` (`:531`) |
  | data.providers[].district | string | no | `row.district \|\| "Unknown"` (`:532`) |
  | data.providers[].last_activity | string | yes | passed through raw. Its type depends on the column types of `tablet_sync_status.last_activity` / `children.datecreated` (not defined in this repo), so it may be an ISO timestamp or a text date |
  | data.providers[].total_events | number | no | `parseInt(..) \|\| 0`, normalising the bigint COUNT string (`:534`) |
  | data.providers[].status | string | no | `active` / `stale` / `inactive` |
- **Errors:** `500` `{status:"error", message: err.message}` when the fallback query also fails (`:653-656`). The DB message leaks.
- **Issues:**
  - There is no district scoping, while it exposes caseworker names program-wide.
  - `location_id` is mislabelled: in the primary path it holds the location **name** (`:562`).
  - A null `last_activity` becomes `new Date(null)` = epoch, and an unparsable one gives `NaN`; both yield status `inactive` silently (`:512-526`).
  - `ORDER BY ... last_activity DESC` has no `NULLS LAST` (`:572`, `:612`). Postgres sorts NULLs first in DESC order, so providers with no activity date appear at the top of the list while being marked `inactive`.
  - `data.providers[].location_id` is declared as a non-null `string` in the legacy type (`legacy:src/lib/api.ts:773`), but the fallback path can return null.
  - The CTE scans the whole `children` table on every call (`:553-559`). Unbounded result.
  - The DB that `SupersetPG` connects to is configured by `SUPERSET_DB_NAME`. The hard-coded `source` label names a specific DB (`:589`), which may not match the configured one.
- **Used by:**
  - Wrapper: `getTabletSyncStatus` (`legacy:src/lib/api.ts:791-794`).
  - Callers: `legacy:src/pages/DataPipelinePage.tsx:198` (DataPipelinePage; key `["etl","tablet-sync"]`, 15 min refetch, `:196-201`). The SSE stream writes into the same key.
- **Fixture:** `test/fixtures/dqa-etl-pipeline.json` → `"GET /etl/tablet-sync"`

---

**Group: `/etl` performance and caseworkers** (performance, duplicate reviews, caseworker journeys; `backend:routes/etlRoutes.js`)

Router mounted at `/etl` (`backend:index.js:42`) behind the global `verifyDirectusToken` middleware (`backend:index.js:38`). None of these routes are in `PUBLIC_ROUTES` (`backend:middleware/verifyDirectusToken.js:22-26`). In `AUTH_MODE=log` unauthenticated requests are let through (`backend:middleware/verifyDirectusToken.js:62-68`). The middleware sets `req.user` (`backend:middleware/verifyDirectusToken.js:87`), but no handler in this group reads it. No handler in this group applies a server-side user scope.

Shared pieces:
- **Perf TTL cache** (`backend:controllers/etlController.js:761-777`): a process-global `Map`. The key is `req.path + "?" + URLSearchParams(req.query)`, the TTL is 5 min and it has no size cap. An expired entry is deleted only when its key is read again (`:769-771`), so distinct query strings pile up in memory. The key includes every query param, including the ignored `from`/`to` and `?token=` when a token is passed that way (`backend:middleware/verifyDirectusToken.js:36-38`). It is not per-user, which is harmless only because these handlers apply no user scope. Used in this group by facility-, caseworker- and service-performance (`:780,884,998`). The same `Map` is also shared by handlers outside this group (services summary/timeseries/distribution and action-queue, `backend:controllers/etlController.js:1425,1720,1816,1908`); keys do not collide because `req.path` differs.
- **Pools** (`backend:config/database.js:8-14,36-42`): `FlatPGConnection` is the app/warehouse DB. `RawPGConnection` connects directly to the raw `ecap_plus` DB, and its database name defaults to `"ecap_plus"`.
- **Date parsing** in the performance SQL is inlined: `CASE WHEN col ~ ISO THEN substring(...)::date WHEN col ~ DD-MM-YYYY THEN TO_DATE(...) END`. The handlers do not call `lib/fyClause.js` (`parseFyWindow`/`buildServiceFyClause`), although it is imported at `backend:controllers/etlController.js:7-11`.
- **"This month" / "last month"** are always relative to the DB server's `CURRENT_DATE` (`date_trunc('month', CURRENT_DATE)`). They are not tied to a fiscal-year window.

---

#### `GET /etl/facility-performance`
- **Handler:** `backend:controllers/etlController.js:779` · **Route:** `backend:routes/etlRoutes.js:28`
- **Purpose:** Per-facility enrolment counts (VCAs, households) plus this-month vs last-month service volume and trend.
- **Params:**
  - `district`: query, string, optional. Ignored when absent or `"all"`, otherwise exact match `district = $n` (`:791-794`). Only a single value is supported. A comma list is treated as one literal string. `"All"` (capital A) is **not** treated as "all" and filters on the literal value `All`.
  - `facility`: query, string, optional. Ignored when absent or `"all"`, otherwise exact match (`:795-798`).
  - `ward`: query, string, optional. Ignored when absent or `"all"`, otherwise exact match (`:799-802`).
  - The legacy frontend also sends `from` / `to` (FY window) (`legacy:src/lib/api.ts:824-827`). The handler **ignores** them. They only fragment the cache key (`:764-765`).
  - There is no `province` param.
- **Fiscal year / date window:** none. Enrolment counts cover every row in `children`, including de-registered VCAs. `lib/fyClause.js` is not used. Service counts are fixed to the current and previous calendar month by `CURRENT_DATE` (`:831-835`).
- **Scope enforcement:** **trusts district param**. The district comes only from the query string (`:786,791`) and `req.user` is not consulted. Omitting `district` returns every facility in all districts. There is no province param.
- **Data source:** `FlatPGConnection` (`:784`). Tables `children` (enrolment, `:806-814`) and `vca_services`⋈`children`, `household_services`⋈`all_households`, `caregiver_services`⋈`all_households` (services CTE, `:817-829`).
- **Server-side filtering / sort / pagination / limits:**
  - Enrolment: `WHERE facility IS NOT NULL AND facility != ''` plus the filters, `GROUP BY facility, district, ward` (`:810-812`).
  - Services: `UNION ALL` of the three services tables, then `WHERE` filters applied to the CTE output, `GROUP BY facility` (`:836-838`). Rows with an unparseable `service_date` get `d = NULL` and are not counted.
  - The JS merges the two result sets by facility name only (`:842-845`). It sorts by `services_this_month DESC, total_vcas DESC` (`:863-867`).
  - No LIMIT and no pagination: the whole set is returned. 5-min TTL cache (`:780-782,870`).
- **Response:** `200` `{ "status": "success", "data": FacilityRow[] }` (`:869-871`). The same object is served from the cache.

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `facility` | string | no | `children.facility`; empty and null values are excluded (`:811`) |
  | `district` | string | yes | `children.district`, raw value |
  | `ward` | string | yes | `children.ward`, raw value. Not COALESCEd in the enrolment query |
  | `total_vcas` | number | no | `COUNT(*)` (bigint→string), converted with `Number()` (`:856`) |
  | `households` | number | no | `COUNT(DISTINCT household_id)`, converted with `Number()` (`:857`) |
  | `services_this_month` | number | no | 0 when the facility has no services (`:846`) |
  | `services_last_month` | number | no | (`:847`) |
  | `trend_pct` | number (integer) | no | `round((this-last)/last*100)`. 100 if last=0 and this>0, else 0 (`:848-853`) |
- **Errors:** `500` `{ "status": "error", "message": err.message }` (`:872-874`). This **leaks raw pg error messages**.
- **Issues:**
  - The FY window sent by the frontend (`from`/`to`) is silently ignored. Enrolment is all-time and services are calendar-month (`:786`; `legacy:src/lib/api.ts:824-827`).
  - The merge is keyed on facility name only (`:842`), while enrolment is grouped by `(facility, district, ward)` (`:812`). If a facility has more than one district/ward group, each row repeats the facility's **full** service counts, which inflates totals. Facilities with the same name in different districts are also merged.
  - The ward filter matches raw `ward` in enrolment (`:799-801`) but `COALESCE(ward,'')` in services (`:818,822,826`). This is harmless for non-empty values, but the two queries are inconsistent.
  - `d >= date_trunc('month', CURRENT_DATE)` has no upper bound, so future-dated services count as "this month" (`:831`).
  - Each request with a new filter set does full scans of three services tables with regex date parsing and no index use (`:817-829`). The process cache mitigates this, but the cache is unbounded (`:762`).
  - Scope: no server-side jurisdiction check, so any authenticated user can request any district or all districts.
- **Used by:**
  - Wrapper: `getFacilityPerformance` (`legacy:src/lib/api.ts:812-832`).
  - Callers: `legacy:src/pages/Performance.tsx:567` (Performance; `{ district, ward, fy }`).
  - Params: the wrapper sends `from`/`to` (`legacy:src/lib/api.ts:824-827`), but the handler reads only `district`, `facility` and `ward` (`backend:controllers/etlController.js:786`). The wrapper strips only lower-case `"all"` (`legacy:src/lib/api.ts:819`). `facility` is never passed.
- **Fixture:** `test/fixtures/dqa-etl-performance.json` → `"GET /etl/facility-performance"`

---

#### `GET /etl/caseworker-journeys`
- **Handler:** `backend:controllers/etlController.js:1203` · **Route:** `backend:routes/etlRoutes.js:31`
- **Purpose:** GPS-tagged OpenSRP events (up to 500 most recent) for map and journey display: caseworker, timestamp, form type, lat/lng, location name and entity/household IDs.
- **Params:**
  - `caseworker`: query, string, optional. Ignored when absent or `"all"`. Otherwise it is matched against `e.json->>'providerId' = $n` (`:1216-1219`). This is the OpenSRP **username** (providerId), not the display name.
  - `from`: query, string, optional. Compared as **text**: `e.json->>'dateCreated' >= $n` (`:1220-1223`). No format validation and no `parseFyWindow`.
  - `to`: query, string, optional. Compared as text: `e.json->>'dateCreated' <= $n` (`:1224-1227`). Lexicographic, so `to=2026-04-15` **excludes** events created on 2026-04-15 after midnight (`"2026-04-15T08:..." > "2026-04-15"`).
  - `facility`: query, string, optional. Ignored when absent or `"all"`. Otherwise it is resolved via `core.location` with `LOWER(name) LIKE LOWER('%facility%') LIMIT 10` (`:1230-1234`), then `e.json->>'locationId' = ANY($n)` (`:1237-1238`). If nothing matches, the handler returns `200 { status:"success", data: [] }` early (`:1239-1241`). User-supplied `%`/`_` act as wildcards.
  - `district`: documented in the handler comment (`:1201`) but **never read**, so it is ignored.
  - At least one of caseworker/from/to/facility is required. Otherwise the response is `400` (`:1245-1250`).
- **Fiscal year / date window:** optional `from`/`to` as raw text comparison on `dateCreated` (`:1220-1227`). `lib/fyClause.js` is not used.
- **Scope enforcement:** **ignores district (returns all)**. There is no district or province filter at all (`:1212-1242`), so any authenticated user can fetch the GPS trail of any caseworker by username.
- **Data source:** `RawPGConnection` (direct raw `ecap_plus` DB, not FDW) (`:1209`). Tables `core.event` (JSON), `core.location` (JSON, name lookup plus LEFT JOIN for the facility name), `core.client` (JSON, correlated subquery for household_id) (`:1277-1300`). GPS field codes are hardcoded in `GPS_LAT_FIELDS` / `GPS_LNG_FIELDS` (`:1256-1275`), and they must match `backend:sql/mv_providers_with_gps.sql:45-62`.
- **Server-side filtering / sort / pagination / limits:**
  - The CTE `filtered_events` keeps events where any obs `fieldCode` is in the LAT list (`:1281-1283`), plus the filters. It applies `ORDER BY dateCreated DESC LIMIT 500` (`:1285-1286`).
  - The outer SELECT has **no ORDER BY**, so the output order after the LEFT JOIN is not guaranteed (`:1288-1298`).
  - Hard cap of 500 rows and no pagination. No cache.
- **Response:** `200` `{ "status": "success", "data": JourneyRow[] }` (`:1302-1305`). Early empty result: `200 { status, data: [] }` (`:1240`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `caseworker` | string | yes (in theory) | `ej->>'providerId'` |
  | `visit_date` | string | yes (in theory) | `ej->>'dateCreated'`, raw OpenSRP ISO timestamp text (not a pg date) |
  | `form_type` | string | yes | `ej->>'entityType'` |
  | `lat` | string | yes | first obs `values[0]` whose fieldCode is in the LAT list. Text, not a number. May be `""` |
  | `lng` | string | yes | first obs `values[0]` whose fieldCode is in the LNG list. Text. Null if the event has a lat field but no lng field |
  | `facility` | string | yes | `core.location` `properties.name` via LEFT JOIN on `locationId` |
  | `entity_id` | string | yes | `ej->>'baseEntityId'` |
  | `household_id` | string | yes | `core.client attributes.household_id`, falling back to `attributes.unique_id`. Null when no client matches |
- **Errors:** `400` `{ status:"error", message:"Select a caseworker, ward, or date range to load GPS data" }` (`:1246-1249`). `500` `{ status:"error", message: err.message }` (`:1306-1308`), which leaks pg messages.
- **Issues:**
  - **Privacy/scope:** precise GPS coordinates plus household IDs are returned for any caseworker with no jurisdiction check (`:1212-1242`). The `district` param is documented but ignored (`:1201`).
  - `lat` and `lng` are taken independently (`:1292-1293`), so they can come from **different field pairs** (for example a `vca_service_location` latitude with a `geopoint` longitude). The EXISTS filter only checks that a LAT field code exists, not that it has a non-empty value (`:1281-1283`), unlike the MV (`backend:sql/mv_providers_with_gps.sql:64`). Expect `""` or null coordinates.
  - The `from`/`to` text comparison excludes most of the `to` day and accepts any string (`:1220-1227`).
  - `facility` is a fuzzy `LIKE '%…%'` over location names capped at 10 IDs (`:1232`). This can match unrelated locations or miss some, and LIKE wildcards in the input are not escaped.
  - The result is silently truncated at 500 events (`:1286`), and the outer query does not keep the order (`:1288-1298`).
  - A correlated subquery against `core.client` per row is matched by `json->'baseEntityId' = to_jsonb(text)` (`:1296`). This is likely unindexed, so it is a performance risk.
  - SQL is parameterised (no injection). `$${idx}` and `$${idx+1}` correctly line up with the appended field arrays (`:1282,1292-1293,1299`).
- **Used by:**
  - Wrapper: `getCaseworkerJourneys` (`legacy:src/lib/api.ts:1142-1160`).
  - Callers: `legacy:src/pages/CaseworkerJourneys.tsx:268` (CaseworkerJourneys; enabled only when at least one filter is set, `:258-276`).
  - Params: no district is sent (`legacy:src/lib/api.ts:1148-1155`); `from`/`to` are bare `yyyy-MM-dd` (`legacy:src/pages/CaseworkerJourneys.tsx:400-401`) and the handler compares them as text against `dateCreated` (`backend:controllers/etlController.js:1220-1227`). `facility` carries a ward name from `/etl/facility-list`.
- **Fixture:** `test/fixtures/dqa-etl-caseworkers.json` → `"GET /etl/caseworker-journeys"`

---

#### `GET /etl/caseworker-list`
- **Handler:** `backend:controllers/etlController.js:1316` · **Route:** `backend:routes/etlRoutes.js:34`
- **Purpose:** Distinct active caseworkers (OpenSRP practitioners), each with one ward, district and province and a `has_gps` flag, for the journey-page dropdown.
- **Params:**
  - `district`: query, string, optional. Ignored when absent, `"all"` or `"All"`. Otherwise it is a case-insensitive trimmed match on `c.district` (`:1339-1342`). Single value only.
  - `province`: query, string, optional. Same rules, matched on `c.province` (`:1343-1346`).
  - The handler comment says these are "injected by the frontend based on the logged-in user's role" (`:1318-1319`). The frontend controls them.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param**, and the province param exists and is trusted too (`:1320,1339-1346`). `req.user` is not read. Without params it returns caseworkers in all districts.
- **Data source:** `FlatPGConnection` (`:1317`). `team.practitioner` and `mv_providers_with_gps` are postgres_fdw foreign tables pointing at the raw DB (`:1353-1360`; `backend:sql/mv_providers_with_gps.sql:6-14`). `children` provides location via a name join. The MV `mv_providers_with_gps(provider)` holds distinct providerIds with at least one non-empty GPS obs (`backend:sql/mv_providers_with_gps.sql:36-65`), refreshed with `REFRESH MATERIALIZED VIEW CONCURRENTLY` (`backend:sql/refresh_mv_providers_with_gps.sql:14`). No backend JS triggers that refresh (grep of the repo finds the MV name only in `controllers/etlController.js` and the two sql files), so the refresh must run in the external ETL.
- **Server-side filtering / sort / pagination / limits:**
  - Filters `p.username` non-empty and `p.active = true`. It hardcodes an exclusion list of 10 test usernames and 8 display-name patterns (`:1323-1337`).
  - `SELECT DISTINCT ON (p.username) … ORDER BY p.username, c.ward NULLS LAST, p.name` (`:1362,1377`) gives one row per username, picking the alphabetically first ward.
  - `LEFT JOIN children c ON LOWER(TRIM(c.caseworker_name)) = LOWER(TRIM(p.name))` (`:1372`) joins each practitioner to **every child row** they manage before the DISTINCT ON.
  - If the GPS query fails for **any** reason, the handler retries without the MV join and returns `has_gps=false` for everyone (`:1381-1392`).
  - No LIMIT, no pagination, no cache.
- **Response:** `200` `{ "status": "success", "data": CaseworkerRow[] }` (`:1394`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `caseworker` | string | no | `p.username`, the OpenSRP providerId. Pass this as `caseworker` to `/etl/caseworker-journeys` |
  | `display_name` | string | no (in practice) | `p.name`. A NULL `p.name` makes every `LOWER(TRIM(p.name)) NOT LIKE ...` predicate NULL, so those practitioners are excluded by the WHERE (`:1329-1336`) |
  | `facility` | string | yes | **actually `c.ward`** (`:1365`), mislabelled. Null when no child matches the name |
  | `district` | string | yes | `c.district` |
  | `province` | string | yes | `c.province` |
  | `has_gps` | boolean | no | `g.provider IS NOT NULL`, or the constant `false` in the fallback (`:1368-1370`) |
- **Errors:** `500` `{ status:"error", message: err.message }` (`:1395-1398`), which leaks pg messages. A GPS-join failure is swallowed and only logged (`:1387-1390`).
- **Issues:**
  - Location comes from joining practitioner **display name** to `children.caseworker_name` (`:1372`). This is fragile: same-named caseworkers share or mix locations, and renamed caseworkers lose theirs. A district/province filter on `c.*` turns the LEFT JOIN into an inner join, so caseworkers with no children are dropped from scoped lists but kept in unscoped ones.
  - The `facility` alias holds the ward (`:1365`). The legacy frontend type also expects `location_id` (`legacy:src/lib/api.ts:1128,1165`), which this endpoint never returns.
  - Performance: the join fans out to every child per practitioner before DISTINCT ON (`:1371-1377`), across FDW foreign tables.
  - The blanket fallback (`:1383-1392`) masks real errors such as timeouts and doubles the query time.
  - The test-account exclusion list is hardcoded in the SQL (`:1328-1336`).
  - Scope is trusted from client params (`:1318-1320`).
  - `has_gps` is matched case-insensitively (`LOWER(TRIM(g.provider)) = LOWER(TRIM(p.username))`, `:1374`), while `/etl/caseworker-journeys` matches `providerId` exactly and case-sensitively (`:1217`). The MV also counts a provider whose events have only a **longitude** field code (`backend:sql/mv_providers_with_gps.sql:45-62`), whereas journeys requires a latitude field code (`:1281-1283`). So `has_gps=true` does not guarantee that journeys returns any rows.
- **Used by:**
  - Wrapper: `getCaseworkerList` (`legacy:src/lib/api.ts:1162-1237`), with heavy field-name guessing (`:1189-1233`).
  - Callers: `legacy:src/pages/CaseworkerJourneys.tsx:242` (CaseworkerJourneys).
  - Params: the wrapper supports `district`/`province`, but the page calls it with no scope and filters the national list client-side by role strings (`legacy:src/pages/CaseworkerJourneys.tsx:230-256`).
- **Fixture:** `test/fixtures/dqa-etl-caseworkers.json` → `"GET /etl/caseworker-list"`

---

#### `GET /etl/caseworker-performance`
- **Handler:** `backend:controllers/etlController.js:883` · **Route:** `backend:routes/etlRoutes.js:68`
- **Purpose:** Per-caseworker service delivery stats: this/last month, unique entities, active days, last active date and a top/mid/bottom/inactive tier.
- **Params:**
  - `district`, `facility`, `ward`: query, string, optional. Each is ignored when absent or `"all"`, otherwise an exact match applied to the combined CTE (`:893-907`). Single value only, and `"All"` is not treated as "all".
  - The legacy frontend sends `from`/`to` (`legacy:src/lib/api.ts:862-865`). They are **ignored** and only fragment the cache key.
  - There is no `province` param.
- **Fiscal year / date window:** none from the request. A hardcoded activity window is used: `HAVING` requires at least one service on or after `date_trunc('month', CURRENT_DATE) - 3 months` (`:938`). Monthly counts are relative to `CURRENT_DATE` (`:927-933`).
- **Scope enforcement:** **trusts district param** (`:890,895-898`). `req.user` is not used, so omitting `district` returns all districts.
- **Data source:** `FlatPGConnection` (`:889`). `vca_services`⋈`children`, `household_services`⋈`all_households`, `caregiver_services`⋈`all_households` (`:910-925`). The caseworker is identified by the `caseworker_name` text on the child or household record.
- **Server-side filtering / sort / pagination / limits:**
  - `GROUP BY caseworker_name, facility, district, ward` (`:937`).
  - `ORDER BY services_this_month DESC, last_active DESC NULLS LAST LIMIT 500` (`:939-940`).
  - The tier thresholds are computed in JS from the ≤500 returned rows (`:944-951,962-965`). Non-zero `services_this_month` values are sorted descending; `topThreshold` is the value at position `floor(n*0.2)-1` (falls back to the maximum when that index is -1, i.e. n<5), `bottomThreshold` the value at position `floor(n*0.8)-1` (0 when n=1). `0` → `inactive`; `>= top` → `top`; `<= bottom` → `bottom`; otherwise `mid`. With 2–4 active rows the bottom threshold can equal the max, so every non-top row is `bottom`.
  - Caseworker groups with **no** service since the start of the month three months ago are dropped by the HAVING clause (`:938`), so `inactive` only covers groups active in that window but not this month.
  - 5-min TTL cache (`:884-886,986`).
- **Response:** `200` `{ "status": "success", "data": CaseworkerPerfRow[] }` (`:985-987`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `caseworker_name` | string | no | non-empty by the WHERE (`:914,919,924`) |
  | `facility` | string | yes | `r.facility \|\| null` (`:968`) |
  | `ward` | string | yes | `r.ward \|\| null`, so `""` becomes null (`:969`) |
  | `district` | string | yes | `r.district \|\| null` (`:970`) |
  | `services_this_month` | number | no | (`:954,971`) |
  | `services_last_month` | number | no | (`:955,972`) |
  | `trend_pct` | number (integer) | no | same formula as facility-performance (`:956-961`) |
  | `unique_entities_this_month` | number | no | distinct vcaid/household_id (`:932,974`) |
  | `active_days_this_month` | number | no | distinct service dates this month (`:933,975`) |
  | `services_per_active_day` | number | no | one decimal place. 0 when there are no active days (`:976-979`) |
  | `last_active` | string (ISO timestamp) | not in practice | `MAX(d)` is a pg `date`. node-pg parses it to a JS Date at local midnight, so the JSON looks like `"2026-10-14T00:00:00.000Z"` on a UTC server, and **the day can shift with the server's TZ**. The HAVING clause guarantees at least one non-null `d`, so it is never null (`:934,938,980`) |
  | `tier` | string enum | no | `"top" \| "mid" \| "bottom" \| "inactive"` (`:962-965`) |
- **Errors:** `500` `{ status:"error", message: err.message }` (`:988-991`), which leaks pg messages.
- **Issues:**
  - The FY window sent by the frontend is ignored (`:890`; `legacy:src/lib/api.ts:862-865`).
  - A caseworker is identified by free-text name. Same-named caseworkers are merged. One person splits into several rows when their records span facilities/wards. The VCA branch uses raw `c.ward` (`:911`) while the household branches use `COALESCE(h.ward,'')` (`:916,921`), so null-ward VCA services and empty-ward household services land in **different groups** for the same caseworker.
  - The `LIMIT 500` truncates silently, and the tier percentiles are computed on the truncated set (`:940,944-951`).
  - Future-dated services count as this month (no upper bound, `:927`).
  - `last_active` is serialised with TZ-dependent date handling (`:934,980`).
  - The same full-scan cost as facility-performance applies.
- **Used by:**
  - Wrapper: `getCaseworkerPerformance` (`legacy:src/lib/api.ts:850-870`).
  - Callers: `legacy:src/pages/Performance.tsx:572` (Performance).
  - Params: `from`/`to` sent (`legacy:src/lib/api.ts:862-865`) but ignored by the handler (`backend:controllers/etlController.js:890`). The wrapper strips only lower-case `"all"` (`legacy:src/lib/api.ts:857`).
- **Fixture:** `test/fixtures/dqa-etl-performance.json` → `"GET /etl/caseworker-performance"`

---

#### `GET /etl/service-performance`
- **Handler:** `backend:controllers/etlController.js:997` · **Route:** `backend:routes/etlRoutes.js:71`
- **Purpose:** Per-service-name (from the `health_services` lists) counts for this/last month by entity type, with coverage % and tier.
- **Params:**
  - `type`: query, string, default `"all"` (`:1005`). Any other value is **string-interpolated** into SQL as `WHERE type = '<type>'` after only doubling single quotes (`:1067`). It is not validated against `vca|household|caregiver`, and unknown values return `data: []`. If `type` is repeated (`?type=a&type=b`), Express gives an array, `.replace` throws a TypeError, and the response is a 500.
  - `district`, `facility`, `ward`: query, string, optional. Each is ignored when absent or `"all"`, otherwise an exact match applied inside the union subquery (`:1008-1022,1053`).
  - `from`/`to` sent by the legacy frontend (`legacy:src/lib/api.ts:900-903`) are ignored.
  - There is no province param.
- **Fiscal year / date window:** none. Hardcoded HAVING of activity within ~3 months (`:1069`). Months are relative to `CURRENT_DATE`.
- **Scope enforcement:** **trusts district param** (`:1005,1010-1013`). The denominators are **never** scoped (`:1024-1028`).
- **Data source:** `FlatPGConnection` (`:1003`). `children`, `all_households` (denominators, `:1024-1028`), and `vca_services`⋈`children`, `household_services`⋈`all_households`, `caregiver_services`⋈`all_households`, with `health_services` unnested by stripping `[]"{}` and splitting on `,` (`:1033-1058`).
- **Server-side filtering / sort / pagination / limits:**
  - `GROUP BY service_name, type`, `ORDER BY this_month DESC` (`:1068-1070`).
  - No LIMIT. The result size is bounded by the number of distinct service names × 3 types.
  - Tier thresholds are computed in JS as in caseworker-performance, plus trend rules: top requires `trend_pct >= 0`, and bottom also applies when `trend_pct < -20` (`:1074-1081,1096-1099`).
  - 5-min TTL cache (`:998-1000,1117`).
- **Response:** `200` `{ "status": "success", "data": ServicePerfRow[], "meta": { "total_vcas": number, "total_households": number } }` (`:1112-1118`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `service` | string | no | trimmed service name from `health_services` (`:1056-1059`) |
  | `type` | string enum | no | `"vca" \| "household" \| "caregiver"` (`:1038,1044,1050`) |
  | `this_month` | number | no | (`:1084,1103`) |
  | `last_month` | number | no | (`:1085,1104`) |
  | `trend_pct` | number (integer) | no | (`:1086-1091`) |
  | `unique_entities_this_month` | number | no | distinct vcaid or household_id (`:1065,1092`) |
  | `coverage_pct` | number | no | `unique / denom * 100`, rounded to one decimal place. The denominator is `total_vcas` for `vca`, otherwise `total_households` (`:1093-1095`) |
  | `tier` | string enum | no | `"top" \| "mid" \| "bottom" \| "inactive"` |
  | `meta.total_vcas` | number | no | `COUNT(*) FROM children`, unfiltered (`:1026,1029`) |
  | `meta.total_households` | number | no | `COUNT(DISTINCT household_id) FROM all_households`, unfiltered (`:1027,1030`) |
- **Errors:** `500` `{ status:"error", message: err.message }` (`:1119-1122`), which leaks pg messages.
- **Issues:**
  - **String-interpolated SQL** for `type` (`:1067`). Quote-doubling makes classic injection unlikely while `standard_conforming_strings` is on, but it is still unvalidated interpolation and should be an allow-list or a bind param.
  - **Coverage is wrong when filtered:** the numerator is district/facility/ward-filtered but the denominator is the national total (`:1024-1028,1093-1095`). The denominator is also all-time cohort, including de-registered entities. Caregiver coverage uses the household denominator and counts distinct `household_id` (`:1050,1093`).
  - Service names that contain commas are split into several services (`:1035-1037`).
  - The FY window is ignored, and future-dated services count as this month (`:1060`).
  - Full scan with unnest of three services tables per distinct filter set.
- **Used by:**
  - Wrapper: `getServicePerformance` (`legacy:src/lib/api.ts:883-911`).
  - Callers: `legacy:src/pages/Performance.tsx:577` (Performance; never passes `type`, so the backend default `"all"` applies).
  - Params: `from`/`to` sent (`legacy:src/lib/api.ts:900-903`) but ignored by the handler (`backend:controllers/etlController.js:1005`).
- **Fixture:** `test/fixtures/dqa-etl-performance.json` → `"GET /etl/service-performance"`

---

#### `GET /etl/duplicates/reviews`
- **Handler:** `backend:controllers/etlController.js:1141` · **Route:** `backend:routes/etlRoutes.js:74`
- **Purpose:** List the persisted "reviewed" marks for duplicate-service runs.
- **Params:** none read.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **no geographic data**. The table has no district column (`:1130-1137`), so every user sees all reviews nationwide.
- **Data source:** `FlatPGConnection`, table `duplicate_reviews`. It is created on demand with `CREATE TABLE IF NOT EXISTS` before every request (`:1128-1139,1143`). Schema: `id SERIAL PK, run_key TEXT UNIQUE NOT NULL, service_type TEXT, reviewed_by TEXT, reviewed_at TIMESTAMPTZ DEFAULT NOW(), note TEXT`.
- **Server-side filtering / sort / pagination / limits:** `ORDER BY reviewed_at DESC LIMIT 5000` (`:1145`). No pagination and no cache.
- **Response:** `200` `{ "status": "success", "data": ReviewRow[] }` (`:1147`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `run_key` | string | no | client-defined key identifying the duplicate run |
  | `service_type` | string | yes | free text from the client |
  | `reviewed_by` | string | yes | free text from the client (not the authenticated user) |
  | `reviewed_at` | string (ISO timestamp) | yes (in theory) | TIMESTAMPTZ → JS Date → ISO `"…Z"`. It has a default and is set on upsert, so it is null only if inserted explicitly |
  | `note` | string | yes | |
  `id` is not selected.
- **Errors:** `500` `{ status:"error", message: err.message }` (`:1148-1151`), which leaks pg messages, including DDL permission errors from `ensureDuplicateReviewsTable`.
- **Issues:**
  - DDL runs on every request (`:1143`). The app DB user needs CREATE privilege, and the call adds a round-trip each time.
  - The silent 5000-row cap has no pagination (`:1145`).
  - Reviews are not scoped by district, although duplicate runs are district data.
- **Used by:**
  - Wrapper: `listDuplicateReviews` (`legacy:src/lib/api.ts:1079-1082`).
  - Callers: `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:91` only. DuplicateDetectionCard is rendered only by `legacy:src/pages/VcaServicesDashboard.tsx:947`, and VcaServicesDashboard is never imported, so there is no live caller.
- **Fixture:** `test/fixtures/dqa-etl-duplicate-reviews.json` → `"GET /etl/duplicates/reviews"`

---

#### `POST /etl/duplicates/review`
- **Handler:** `backend:controllers/etlController.js:1154` · **Route:** `backend:routes/etlRoutes.js:75`
- **Purpose:** Mark (or re-mark) a duplicate run as reviewed. Upserts by `run_key`.
- **Params:** JSON body (`:1155`):
  - `run_key`: string, **required**. A falsy value gives a 400 (`:1156-1159`). There is no type, length or format validation. The legacy frontend builds it as `` `${entity_id}|${service_date}|${services}` `` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:410`, same format at `:123,160`).
  - `service_type`: string, optional. Falsy → null (`:1170`). The legacy frontend sends the duplicate type, `vca`, `caregiver` or `household` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:181`), and filters reviews by it on read; a review with a null `service_type` is treated as applying to every type (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:96-98`).
  - `reviewed_by`: string, optional. Falsy → null. **Client-supplied**; `req.user` is ignored. The legacy frontend never sends it (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:181`), so in practice it is always null.
  - `note`: string, optional. Falsy (including `""`) → null.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **no geographic data**. There is no permission or role check, so any authenticated user can mark any run.
- **Data source:** `FlatPGConnection`, `duplicate_reviews`. `INSERT … ON CONFLICT (run_key) DO UPDATE SET service_type, reviewed_by, reviewed_at = NOW(), note` (`:1162-1171`).
- **Server-side filtering / sort / pagination / limits:** n/a.
- **Response:** `200` `{ "status": "success" }` (`:1172`). The saved row is not echoed back.
- **Errors:** `400` `{ status:"error", message:"run_key is required" }` (`:1157-1159`). `500` `{ status:"error", message: err.message }` (`:1173-1176`), which leaks pg messages.
- **Issues:**
  - `reviewed_by` is trusted from the body, so it can be spoofed. It should come from `req.user`.
  - There is no authorisation beyond being logged in (`:1154-1177`).
  - Upsert overwrites the previous reviewer and note without history (`:1165-1169`).
  - The DDL runs on each call (`:1161`).
- **Used by:**
  - Wrapper: `upsertDuplicateReview` (`legacy:src/lib/api.ts:1084-1101`, raw `fetch`).
  - Callers: `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:181` only (sends `{ run_key, service_type }`); same dead-component chain as `GET /etl/duplicates/reviews`.
- **Fixture:** `test/fixtures/dqa-etl-duplicate-reviews.json` → `"POST /etl/duplicates/review"`

---

#### `DELETE /etl/duplicates/review/:run_key`
- **Handler:** `backend:controllers/etlController.js:1179` · **Route:** `backend:routes/etlRoutes.js:76-79`
- **Purpose:** Remove a review mark (un-review a duplicate run).
- **Params:** `run_key` is a path string, required (`:1180`). The legacy frontend URL-encodes it (`legacy:src/lib/api.ts:1107`). The `400` branch (`:1181-1184`) is effectively unreachable because Express does not match an empty segment; the request falls through to the catch-all 404 (`backend:index.js:55-60`). A `run_key` containing `/` must be encoded as `%2F`.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **no geographic data**. There is no permission check.
- **Data source:** `FlatPGConnection`, `DELETE FROM duplicate_reviews WHERE run_key = $1` (`:1187-1190`).
- **Server-side filtering / sort / pagination / limits:** n/a.
- **Response:** `200` `{ "status": "success" }` (`:1191`), returned **even when no row matched** (rowCount is not checked).
- **Errors:** `400` `{ status:"error", message:"run_key is required" }` (in practice unreachable). `500` `{ status:"error", message: err.message }` (`:1192-1195`), which leaks pg messages.
- **Issues:**
  - Any authenticated user can delete any review (`:1179-1196`).
  - The response does not distinguish deleted from not-found (`:1191`).
  - The DDL runs on each call (`:1186`).
- **Used by:**
  - Wrapper: `deleteDuplicateReview` (`legacy:src/lib/api.ts:1103-1114`, raw `fetch`).
  - Callers: `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:178` only; same dead-component chain.
- **Fixture:** `test/fixtures/dqa-etl-duplicate-reviews.json` → `"DELETE /etl/duplicates/review/:run_key"`

---

Legacy-caller grep (`old-ecap-pmp/src`): every endpoint in this group has a caller.
- `facility-performance`: `legacy:src/lib/api.ts:829`
- `caseworker-performance`: `legacy:src/lib/api.ts:867`
- `service-performance`: `legacy:src/lib/api.ts:905`
- `duplicates/reviews`: `legacy:src/lib/api.ts:1080`
- `duplicates/review` (POST): `legacy:src/lib/api.ts:1092`
- `duplicates/review/:run_key` (DELETE): `legacy:src/lib/api.ts:1107`
- `caseworker-journeys`: `legacy:src/lib/api.ts:1157`
- `caseworker-list`: `legacy:src/lib/api.ts:1171`

---

**Group: `/etl` services and DQA** (service KPIs, action queue, DQA checks, duplicates, facility list; `backend:routes/etlRoutes.js`)

Router mounted at `/etl` (`backend:index.js:42`). Every route goes through `verifyDirectusToken` first (`backend:index.js:38`). It sets `req.user` from the Directus JWT (`backend:middleware/verifyDirectusToken.js:87`) and also accepts the token as `?token=` (`backend:middleware/verifyDirectusToken.js:36-38`). With `AUTH_MODE=log`, requests without a token still get through (`backend:middleware/verifyDirectusToken.js:10-14`, behaviour at `:62-68`). **None of the eight handlers below reads `req.user`.** No user scope is applied anywhere in `backend:controllers/etlController.js:1424-2471`. The only `req.user` use in this controller is `triggerRun` (`backend:controllers/etlController.js:57`).

All eight handlers query `FlatPGConnection` (`backend:config/database.js:8`). That is the app database, where the core tables are postgres_fdw foreign tables (`backend:config/database.js:28-29`).

**Shared helpers used by this group**
- `PERF_CACHE` (`backend:controllers/etlController.js:762-777`): a process-wide `Map` with a 5-minute TTL. The key is `${req.path}?${URLSearchParams(req.query)}` (`:764-765`). It does not depend on the user, so it is shared across users. It has no size cap: an entry is only removed when it is read after expiry (`:769-771`). Any `?token=` query param becomes part of the key. The summary, timeseries, distribution and action-queue endpoints use it. dqa-checks, dqa-records, duplicates and facility-list do not.
- `CLHIV_PREDICATE` (`backend:controllers/etlController.js:1410-1413`): `calhiv = '1' / ILIKE 'true' / ILIKE 'yes' OR is_hiv_positive ILIKE '%true%'`. The inner OR group repeats the outer conditions. This is redundant but harmless. In this group only the action queue uses the constant (`:1947`, `:1950`, `:1956`); dqa-checks and dqa-records inline the equivalent predicate (e.g. `:2183`, `:2306`).
- `PARSE_DATE_TPL` / `parseDateExpr` (`backend:controllers/etlController.js:1664-1666`): a CASE that parses `YYYY-MM-DD…` or `DD-MM-YYYY` text into a date. **No `::text` cast** is applied to the column. `parseDateExpr` is defined but never called anywhere in the file (grep finds only the definitions at `:1664-1666`). `getServiceSummary` keeps its own identical copy, `parseDate` (`:1466-1467`).
- `TYPE_CFG` (`backend:controllers/etlController.js:1668-1714`): the map behind the accepted `:type` values (see table).
- `formatBytes` (`backend:controllers/etlController.js:2473-2479`): converts a byte count into B/KB/MB/GB text. No endpoint in this group uses it. Its only caller is the file listing (`backend:controllers/etlController.js:232`, `sizeFormatted`).
- `lib/fyClause.js`:
  - `parseFyWindow` reads `from`/`to`, both `YYYY-MM-DD`. Both must be valid, otherwise there is no window (`backend:lib/fyClause.js:8-17`).
  - `buildCohortFyClause` keeps records with `enrolled <= to AND (de_reg IS NULL OR de_reg >= from)` (`backend:lib/fyClause.js:29-57`).
  - `buildServiceFyClause` (`backend:lib/fyClause.js:64-78`) is not used by any handler in this group.

**SQL interpolation verdict for this group.** No user input reaches a SQL string unparameterised. `district`, `facility`, `ward` and `limit` always go in as `$n` parameters. The only interpolated fragments are table/column names from fixed config objects (`TYPE_CFG` `:1668-1714`, the duplicates `config` `:2344-2369`, the dqa-records `queries` map `:2299-2312`) and the `${where}` strings built from `$n` placeholders. The lookups are not own-property checked, so a crafted `:type`/`type`/`check` such as `constructor` resolves to an inherited `Object.prototype` member. That produces broken SQL or a non-string query and a 500, not injection (see each endpoint).

**`service_date` column type is uncertain.** The comment at `:1749-1753` says `vca_services.service_date` and `household_services.service_date` are `date` columns and `caregiver_services.service_date` is text. The comment at `:2044` says household `service_date` "is text in DD-MM-YYYY on ecap_plus". The two comments contradict each other for household, and there is no schema in `sql/` (it only holds `mv_providers_with_gps.sql` and its refresh script). Every claim below that depends on the column type is marked as unverified.

**Accepted `:type` values (`/etl/services/:type/*`)**. The value is lowercased (`:1430`, `:1725`, `:1821`).

| `:type` | Entity table (alias `c`) | Service table (alias) | Join | Pillars (label → column) | `source` string |
|---|---|---|---|---|---|
| `vca` | `children` | `vca_services` (`vs`) | `c.uid = vs.vcaid` | HIV→hiv_services, Health→health_services, Education→schooled_services, Safety→safe_services, Stability→stable_services | `ecap_plus.vca_services` (summary: `ecap_plus.children + vca_services`) |
| `caregiver` | `all_households` | `caregiver_services` (`cs`) | `c.household_id = cs.household_id` | same as vca | `ecap_plus.caregiver_services` (summary: `ecap_plus.all_households + caregiver_services`) |
| `household` | `all_households` | `household_services` (`hs`) | `c.household_id = hs.household_id` | Health→health_services, Household→hh_level_services, Education→schooled_services, Safety→safe_services, Stability→stable_services | `ecap_plus.household_services` (summary: `ecap_plus.all_households + household_services`) |

Any other value returns 400 `{status:"error", message:"Unknown service type: <type>"}` (`:1655-1657`, `:1727-1730`, `:1823-1826`). The summary handler uses its own `if` chain and not `TYPE_CFG` (`:1470`, `:1544`, `:1600`).

Endpoints are listed in route-file order (`backend:routes/etlRoutes.js`).

---

#### `GET /etl/facility-list`
- **Handler:** `backend:controllers/etlController.js:2459` · **Route:** `backend:routes/etlRoutes.js:35`
- **Purpose:** Returns a list of names for a dropdown. Despite the endpoint name, these are distinct **ward** names from `children`, not facility names (`:2463`).
- **Params:** none read. Any query params are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **ignores district (returns all)**. There is no filter. The query is `SELECT DISTINCT ward FROM children WHERE ward IS NOT NULL AND ward != '' ORDER BY ward` (`:2463`). No province param.
- **Data source:** `children` via `FlatPGConnection` (`:2460`).
- **Server-side filtering / sort / pagination / limits:** excludes null and empty wards; `ORDER BY ward`; no LIMIT; no cache.
- **Response:** 200 `{ status: "success", data: string[] }` (`:2465-2467`). `data` is a flat array of ward names: strings, never null, never empty.

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | `"success"` |
  | data | string[] | no | distinct ward names, sorted ascending |
- **Errors:** 500 `{status:"error", message: err.message}`. The DB error message is leaked (`:2469`).
- **Issues:**
  - The name is misleading: the endpoint returns wards, not facilities (`:2463`). The legacy frontend has a comment acknowledging this (`legacy:src/pages/Performance.tsx:563`).
  - It ignores district, so every user sees wards from every district.
  - No caching. It runs a DISTINCT scan of `children` over FDW on every call.
- **Used by:**
  - Wrapper: `getFacilityList` (`legacy:src/lib/api.ts:1239-1242`).
  - Callers: `legacy:src/pages/Performance.tsx:564` (Performance, key `["ward-list"]`); `legacy:src/pages/CaseworkerJourneys.tsx:286` (CaseworkerJourneys, key `["facility-list"]`); `legacy:src/pages/AddUser.tsx:240` and `legacy:src/pages/EditUser.tsx:133` (key `["etl","ward-list"]`, only for facility-level users, `AddUser.tsx:241`, `EditUser.tsx:134`).
- **Fixture:** `test/fixtures/dqa-etl-dqa.json` → `"GET /etl/facility-list"`

---

#### `GET /etl/duplicates`
- **Handler:** `backend:controllers/etlController.js:2339` · **Route:** `backend:routes/etlRoutes.js:36`
- **Purpose:** Finds groups of duplicate service records with the same entity, `service_date` and `health_services` value, plus summary counts by district, facility and caseworker.
- **Params:**
  - `type`: query, string, default `"vca"` (`:2340`). Accepted values: `vca` | `caregiver` | `household` (`:2344-2369`). It is **not lowercased**, so `VCA` returns 400 `{status:"error", message:"Invalid type"}` (`:2371-2373`). Config map:
    - vca → `vca_services.vcaid` joined to `children.uid`
    - caregiver → `caregiver_services.household_id` joined to `all_households.household_id`
    - household → `household_services.household_id` joined to `all_households.household_id`
    - All three group on `health_services` (`service_field`, `:2350`, `:2358`, `:2366`).
  - `district`: query, string, optional. The "all" sentinel is **`"All Districts"`** only (`:2379`). `all`/`All` are treated as literal district names and give an empty result.
  - `facility`: query, string, optional. Sentinel `"all"` (`:2383`).
  - Not supported: `ward`, `province`, `from`/`to`.
- **Fiscal year / date window:** none. All dates are included.
- **Scope enforcement:** **trusts district param**. The `c.district = $n` filter applies only when the client sends `district` (`:2379-2382`). No `req.user` use. No province param.
- **Data source:** `FlatPGConnection`. Tables: `vca_services`/`caregiver_services`/`household_services` joined to `children`/`all_households` (`:2391-2412`).
- **Server-side filtering / sort / pagination / limits:**
  - The CTE `dupe_groups` takes rows with a non-null, non-empty entity id and a non-null `service_date`, applies the optional district/facility filter, groups by (entity id, `service_date`, `health_services`) and keeps groups with `COUNT(*) > 1` (`:2392-2404`).
  - The outer query uses `SELECT DISTINCT ON (entity_id, service_date, services)`, joins the entity table again for caseworker/facility/district/province/ward, and applies `ORDER BY d.entity_id, d.service_date, d.services, d.duplicate_count DESC LIMIT 500` (`:2405-2412`).
  - After the query, JS sorts rows by `parseInt(duplicate_count)` descending (`:2416-2418`) and computes the summary over the returned rows only (`:2420-2436`).
  - No cache.
- **Response:** 200 `{ status:"success", data:{ type, entity_label, groups[], summary{} } }` (`:2438-2452`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | data.type | string | no | echoes the `type` query value |
  | data.entity_label | string | no | `"VCA"` / `"Caregiver"` / `"Household"` |
  | data.groups[].entity_id | string | no | `vcaid` or `household_id`; filtered non-empty |
  | data.groups[].service_date | string | no | Raw `service_date`. If the column is a date type (vca/household, per the comment at `:1749-1753`), pg serialises it as an ISO timestamp (`"2026-03-14T00:00:00.000Z"`, shifted by server TZ). If it is text (caregiver), the stored string is returned (`DD-MM-YYYY` or `YYYY-MM-DD`) |
  | data.groups[].services | string | yes | raw `health_services` value (a JSON-array-like string); NULL forms its own group |
  | data.groups[].duplicate_count | string | no | `COUNT(*)` bigint, **sent as a string** (e.g. `"3"`) |
  | data.groups[].caseworker_name | string | yes | from entity table |
  | data.groups[].facility | string | yes | |
  | data.groups[].district | string | yes | |
  | data.groups[].province | string | yes | |
  | data.groups[].ward | string | no | `COALESCE(NULLIF(c.ward,''),'')`, so `''` when missing, never null (`:2408`) |
  | data.summary.total_groups | number | no | `groups.length`, capped at 500 |
  | data.summary.total_redundant_records | number | no | Σ(duplicate_count − 1) |
  | data.summary.by_district | object<string,number> | no | group count per district; null districts skipped |
  | data.summary.by_facility | object<string,number> | no | |
  | data.summary.by_caseworker | object<string,number> | no | |
- **Errors:**
  - 400 `{status:"error", message:"Invalid type"}`.
  - 500 `{status:"error", message: err.message}`. The DB error is leaked (`:2453-2455`).
- **Issues:**
  - **False duplicates from fan-out.** `dupe_groups` joins the entity table before `COUNT(*)` (`:2398`). If an entity id appears more than once in `children`/`all_households` (the code admits duplicate uids in `children` at `:1471`), each service row is multiplied and reported as a duplicate.
  - The LIMIT of 500 is applied in `entity_id` order, not by severity (`:2411-2412`). The "top duplicates" are therefore the first 500 alphabetically, and `summary` totals are computed from that truncated set (`:2420-2436`).
  - Only `health_services` is compared (`:2350`, `:2358`, `:2366`). Rows with the same entity and date that differ only in other pillars count as duplicates; rows with the same entity and date but different `health_services` are not flagged.
  - `service_date` is grouped raw (`:2402`). Where it is text (caregiver), the same day stored as `DD-MM-YYYY` and `YYYY-MM-DD` falls into different groups.
  - The outer query re-joins the entity table **without** the district/facility filter (`:2410`). With duplicate entity rows, `DISTINCT ON` keeps an arbitrary one, so the `district`/`facility`/`caseworker_name` shown can come from a different entity row than the one that matched the filter.
  - The district sentinel `"All Districts"` (`:2379`) differs from the `all`/`All` used by the services endpoints (`:1436`). The legacy frontend sends `district` whenever it is truthy (`legacy:src/lib/api.ts:1277`).
  - `type` is not lowercased. A `type` like `constructor` resolves to an inherited property of the config object, which yields SQL with `undefined` table names and a 500 instead of a 400 (`:2371`).
  - `duplicate_count` is a string, but the legacy type declares `number` (`legacy:src/lib/api.ts:1249`).
  - Each call does a GROUP BY over the full service table through FDW, with no cache.
- **Used by:**
  - Wrapper: `getDuplicates` (`legacy:src/lib/api.ts:1270-1281`).
  - Callers: `legacy:src/components/dashboard/services/QualityReviewPanel.tsx:93` (QualityReviewPanel inside ServicesPage, `{ type, district }`). Dead: `legacy:src/components/dashboard/DuplicateDetectionCard.tsx:85`.
  - Params: the wrapper sends any truthy district unchanged (`legacy:src/lib/api.ts:1277`), while the handler's "all" value is `"All Districts"` (`backend:controllers/etlController.js:2379-2386`); the live caller passes `undefined` for all districts (`legacy:src/components/dashboard/services/ServicesPage.tsx:287-288`), so this only matters if a caller ever sends `"All"`.
- **Fixture:** `test/fixtures/dqa-etl-dqa.json` → `"GET /etl/duplicates"`

---

#### `GET /etl/dqa-checks`
- **Handler:** `backend:controllers/etlController.js:2099` · **Route:** `backend:routes/etlRoutes.js:37`
- **Purpose:** Returns a scalar count for each of 18 data-quality checks (completeness, timeliness, validity, accuracy, consistency, uniqueness, coverage, cross-validation), plus a list of overloaded caseworkers.
- **Params:**
  - `district`: query, optional. Sentinel `"All Districts"` (`:2106`).
  - `facility`: query, optional. Sentinel `"all"` (`:2110`).
  - Not supported: `ward`, `province`, `from`/`to`. The doc comment says `?district=X&facility=Y` (`:1404`).
- **Fiscal year / date window:** none. Some checks use fixed rolling windows relative to `NOW()`: 90 days for `stale_records_90d` (`:2154`) and 6 months for `stale_viral_loads` (`:2184`).
- **Scope enforcement:** **trusts district param**. `c.district = $1` applies only when `district` is supplied (`:2103-2115`). `orphan_vca_services` and `orphan_hh_services` **ignore** district/facility completely (`:2139-2149`). No province.
- **Data source:** `FlatPGConnection`. Tables: `children`, `vca_services`, `household_services`, `all_households`.
- **Server-side filtering / sort / pagination / limits:**
  - 18 `await`ed queries run **sequentially** (`:2123-2263`). The response has 18 scalar counts plus the `overloaded_caseworkers` array.
  - `overloaded_caseworkers` keeps caseworkers with more than 150 distinct households, `ORDER BY households DESC LIMIT 20` (`:2236-2245`).
  - No cache.
- **Response:** 200 `{ status:"success", data: checks }` (`:2265`). Every count is `COUNT(...)::int`, so it is a JSON number.

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | data.missing_hiv_status | number | no | children with calhiv and is_hiv_positive both null/''/'unknown' (`:2123-2126`) |
  | data.missing_age | number | no | `c.age` null/''/'0' (`:2128-2131`) |
  | data.missing_gender | number | no | `vca_gender` null/'' (`:2133-2136`) |
  | data.orphan_vca_services | number | no | vca_services rows with no matching child; **unfiltered** (`:2139-2143`) |
  | data.orphan_hh_services | number | no | household_services rows with no matching household; **unfiltered** (`:2145-2149`) |
  | data.stale_records_90d | number | no | children with `date_edited` null or older than 90 days (`:2152-2156`) |
  | data.future_dated_services | number | no | vca_services rows with parsed service_date after today (`:2159-2164`) |
  | data.service_before_enrollment | number | no | parsed service_date < `c.date_enrolled::date` (`:2166-2172`) |
  | data.invalid_age | number | no | numeric age < 0 or > 120 (`:2174-2178`) |
  | data.stale_viral_loads | number | no | CLHIV with `date_last_vl` null or older than 6 months (`:2181-2186`) |
  | data.missing_art_numbers | number | no | CLHIV with no art_number (`:2188-2193`) |
  | data.missing_mmd_level | number | no | CLHIV with no level_mmd (`:2195-2200`) |
  | data.unscreened_households | number | no | all_households.screened null/no/false/'' (`:2203-2207`) |
  | data.hiv_status_conflicts | number | no | uids that have more than one distinct `is_hiv_positive` value (`:2211-2220`) |
  | data.phone_collisions | number | no | caregiver_phone values shared by more than one household (`:2224-2232`) |
  | data.caseworker_overload | number | no | `overloaded_caseworkers.length`, so 0–20 (`:2246`) |
  | data.overloaded_caseworkers[].caseworker_name | string | no | filtered non-empty |
  | data.overloaded_caseworkers[].households | number | no | `COUNT(DISTINCT household_id)::int` |
  | data.hiv_positive_no_facility | number | no | CLHIV with facility null/'' (`:2250-2255`) |
  | data.calhiv_without_art | number | no | CLHIV with numeric age < 18 and no date_started_art (`:2257-2263`) |
- **Errors:** 500 `{status:"error", message: err.message}`. The DB error is leaked (`:2266-2268`). There is no per-check catch, so **one failing check fails the whole response**.
- **Issues:**
  - **Probably always fails with 500.** The action-queue code says "ECAP Plus children table has no `age` … column" (`:1939-1940`). This handler queries `c.age` in `missing_age` (`:2129`), `invalid_age` (`:2176`) and `calhiv_without_art` (`:2260`). If that comment is right, `missing_age` throws and the whole endpoint returns 500. Not verified against a schema: `sql/` holds only an MV definition.
  - `::date` casts on text columns (`c.date_edited::date` at `:2154`, `c.date_last_vl::date` at `:2184`, `c.date_enrolled::date` at `:2170`) fail on values that are not ISO. Without a catch, any such value also makes the endpoint return 500. Unlike the action queue (`:1950`), these checks have no `= ''` guard, so a single empty-string `date_edited` or `date_last_vl` is enough (`''::date` is an error in Postgres).
  - The orphan checks ignore filters (`:2139-2149`), so with a district filter the numbers mix district-level and national counts.
  - The phone-collision check applies the district filter inside the GROUP BY. Collisions across districts are therefore not counted when filtered (`:2224-2232`).
  - Performance: 17 sequential FDW queries with no cache.
  - No legacy frontend caller found (grep: `dqa-check|dqa_check|dqaCheck` in `old-ecap-pmp/src`).
- **Used by:**
  - No wrapper and no caller: a grep of `legacy:src` for `dqa-checks` finds nothing.
- **Fixture:** `test/fixtures/dqa-etl-dqa.json` → `"GET /etl/dqa-checks"`

---

#### `GET /etl/dqa-records`
- **Handler:** `backend:controllers/etlController.js:2277` · **Route:** `backend:routes/etlRoutes.js:38`
- **Purpose:** Returns the individual records that fail one DQA check (drill-down for dqa-checks).
- **Params:**
  - `check`: query, required. One of the 12 keys in the `queries` map (`:2299-2312`): `missing_hiv_status`, `missing_age`, `missing_gender`, `stale_records_90d`, `future_dated_services`, `invalid_age`, `stale_viral_loads`, `missing_art_numbers`, `missing_mmd_level`, `unscreened_households`, `hiv_positive_no_facility`, `calhiv_without_art`. Missing or unknown returns 400 (`:2314-2318`).
    - Not drillable (no drill-down query exists for these dqa-checks keys): `orphan_vca_services`, `orphan_hh_services`, `service_before_enrollment`, `hiv_status_conflicts`, `phone_collisions`, `caseworker_overload`.
    - Of the action-queue `filter.type` values, these also return 400 here: `pregnant_no_anc`, `cwlhiv_not_suppressed`, `stale_caregiver_services`, `stale_households`, `missing_partner` (`:2023-2080`).
  - `district`: query, optional. Sentinel `"All Districts"` (`:2286`).
  - `facility`: query, optional. Sentinel `"all"` (`:2290`).
  - `limit`: query, int. `Math.min(parseInt(limit) || 200, 500)` (`:2281`), so the default is 200 and the cap is 500. Negative values are not clamped.
- **Fiscal year / date window:** none. The 90-day and 6-month rolling windows are hard-coded in specific checks (`:2303`, `:2306`).
- **Scope enforcement:** **trusts district param** (`:2283-2297`). No `req.user`, no province.
- **Data source:** `FlatPGConnection`. Tables: `children`, `vca_services`, `all_households`.
- **Server-side filtering / sort / pagination / limits:** check predicate + optional district/facility + `LIMIT $n`. **No ORDER BY**, so which rows come back is not deterministic. No offset or pagination, no total count, no cache.
- **Response:** 200 `{ status:"success", data: row[] }` (`:2322`). The columns depend on `check`. All values are text columns from the flat tables, so strings, any of which can be null.

  | check | Columns (aliases) |
  |---|---|
  | missing_hiv_status, missing_age, missing_gender, missing_art_numbers | `id` (= c.uid), `household_id`, `caseworker_name`, `facility`, `district` |
  | stale_records_90d | `id`, `household_id`, `date_edited`, `caseworker_name`, `facility`, `district` |
  | future_dated_services | `id` (= vs.vcaid), `service_date`, `caseworker_name`, `facility`, `district` |
  | invalid_age | `id`, `age`, `caseworker_name`, `facility`, `district` |
  | stale_viral_loads | `id`, `art_number`, `date_last_vl`, `caseworker_name`, `facility`, `district` |
  | missing_mmd_level | `id`, `art_number`, `caseworker_name`, `facility`, `district` |
  | unscreened_households | `id` (= c.household_id), `caregiver_name`, `caseworker_name`, `facility`, `district` |
  | hiv_positive_no_facility | `id`, `household_id`, `caseworker_name`, `district` (no facility) |
  | calhiv_without_art | `id`, `age`, `household_id`, `caseworker_name`, `facility`, `district` |

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | data[].id | string | no (in practice) | child uid, vcaid or household_id, depending on check |
  | data[].household_id | string | yes | |
  | data[].caseworker_name | string | yes | |
  | data[].facility | string | yes | absent for hiv_positive_no_facility |
  | data[].district | string | yes | |
  | data[].date_edited / date_last_vl / service_date / age / art_number / caregiver_name | string | yes | check-specific. `service_date` is an ISO timestamp string if the column is a date type |
- **Errors:**
  - 400 `{status:"error", message:"Unknown check: <check>"}`. The input is echoed back.
  - 500 `{status:"error", message: err.message}`. The DB error is leaked (`:2323-2325`).
- **Issues:**
  - Checks `missing_age`, `invalid_age` and `calhiv_without_art` use `c.age`, which the code says does not exist (`:1939-1940`). If so, those checks always return 500.
  - `limit=-5` gives `LIMIT -5`, a Postgres error and a 500 (`:2281`).
  - No ORDER BY, so results are not stable.
  - `check` values such as `toString`/`constructor` resolve to inherited properties of the `queries` object (truthy functions), so the 400 guard is skipped and a function is passed to `query()` (`:2314-2321`). That fails inside the `try`, so the result is a 500 instead of a 400 (the exact pg error was not checked; `node_modules` is not present).
  - A missing `check` returns 400 `"Unknown check: undefined"`.
  - The person-level fields (`caregiver_name`, `art_number`) carry no user scope.
  - No legacy frontend caller found (grep: `dqa-record|dqaRecord` in `old-ecap-pmp/src`).
- **Used by:**
  - No wrapper and no caller: a grep of `legacy:src` for `dqa-records` finds nothing.
- **Fixture:** `test/fixtures/dqa-etl-dqa.json` → `"GET /etl/dqa-records"` (plus a variant `"GET /etl/dqa-records [check=stale_viral_loads]"`)

---

#### `GET /etl/action-queue`
- **Handler:** `backend:controllers/etlController.js:1907` · **Route:** `backend:routes/etlRoutes.js:41`
- **Purpose:** Returns a fixed list of priority work items for a service page, each with a count, severity and drill-down filter key.
- **Params:**
  - `type`: query, default `"vca"`, lowercased (`:1913`). Values: `vca` | `caregiver` | `household`. **An unknown type returns 200 with `data: []`**, and that response is cached (`:2083-2092`).
  - `district`: query, optional. Sentinel **`"all"` only** (`:1919`). `All` and `All Districts` are treated as literal district names.
  - `facility`: query, optional. Sentinel `"all"` (`:1923`).
  - `ward`: query, optional. Sentinel `"all"` (`:1927`).
  - Not supported: `from`/`to` (no FY), `province`.
- **Fiscal year / date window:** none. Hard-coded rolling windows: 90 days for staleness (`:1944`, `:2007`, `:2013`, `:2048`) and 6 months for VL (`:1950`).
- **Scope enforcement:** **trusts district param** (`:1917-1931`). No `req.user`. No province.
- **Data source:** `FlatPGConnection`.
  - vca: `children` and `vca_services`
  - caregiver: `all_households` and `caregiver_services`
  - household: `all_households` and `household_services`
- **Server-side filtering / sort / pagination / limits:**
  - Several `COUNT(*)::int` queries run in parallel through `Promise.all` (`:1941-1958`, `:2005-2015`, `:2046-2056`).
  - Each query has `.catch(() => 0)`, so **a failing query silently reports 0**.
  - Output order is fixed.
  - Cached in `PERF_CACHE` for 5 minutes (`:1908-1910`, `:2091`).
- **Response:** 200 `{ status:"success", type, generated_at, data: item[] }` (`:2085-2090`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | `"success"` |
  | type | string | no | lowercased type (also for unknown types) |
  | generated_at | string | no | ISO timestamp (cache time when served from cache) |
  | data[].key | string | no | vca: `stale_90d`, `clhiv_no_art`, `vl_overdue_6m`, `calhiv_no_art_started`, `missing_hiv_status`; caregiver: `pregnant_no_anc`, `cwlhiv_not_suppressed`, `stale_90d`; household: `stale_hh_90d`, `unscreened`, `missing_partner` |
  | data[].label | string | no | fixed English text |
  | data[].description | string | no | fixed English text |
  | data[].count | number | no | `COUNT(*)::int`; 0 also on query error |
  | data[].severity | string | no | `"red"` / `"orange"` / `"yellow"` when count > 0, otherwise `"slate"` |
  | data[].filter.type | string | no | vca: `stale_records_90d`, `missing_art_numbers`, `stale_viral_loads`, `calhiv_without_art`, `missing_hiv_status`; caregiver: `pregnant_no_anc`, `cwlhiv_not_suppressed`, `stale_caregiver_services`; household: `stale_households`, `unscreened_households`, `missing_partner` |
- **Errors:** 500 `{status:"error", message: err.message}` (`:2093-2096`). In practice this is rare, because each count query swallows its own errors.
- **Issues:**
  - Errors are swallowed and returned as `count: 0` (`:1945` etc.), and the zero result is cached for 5 minutes. A broken query looks like "no issues".
  - Casting caregiver `cs.service_date::date` (`:2007`, `:2013`) contradicts the note that `caregiver_services.service_date` is text in `DD-MM-YYYY` or `YYYY-MM-DD` (`:1749-1751`). Non-ISO values would make the cast error, so the item silently reads 0, or the day and month get swapped.
  - `c.date_last_vl::date` and `c.date_last_vl = ''` have the same risk (`:1950`).
  - `calhiv_no_art_started` is labelled "(<18)", but the SQL has no age filter (`:1955-1957`, `:1987-1993`; age column absent per `:1939-1940`).
  - The vca `stale_90d` counts **child rows**, not distinct uids (`:1944`). Duplicate children inflate it.
  - `type` is read and lowercased **before** the `try` (`:1913`, `try` at `:1916`). `?type=a&type=b` makes `req.query.type` an array, so `.toLowerCase` throws. Express 4 (`backend:package.json:27`) does not catch rejected async handlers, so the request gets no response until it times out.
  - The `filter.type` keys do not line up with the other DQA endpoints:
    - The vca `stale_records_90d` key means "no service in 90d" here, but in dqa-checks/dqa-records it means "`date_edited` older than 90d" (`:2152-2156`, `:2303`).
    - Five filter keys do not exist in `/etl/dqa-records` (see that endpoint).
    - Even where the key exists, the drill-down set differs from the queue count: `vl_overdue_6m` requires a non-empty `art_number` and treats `''` as overdue (`:1950`), while dqa-records `stale_viral_loads` has neither condition (`:2306`); `calhiv_no_art_started` has no age filter (`:1956`), while dqa-records `calhiv_without_art` requires `c.age < 18` (`:2311`).
  - The district sentinel `all` (`:1919`) differs from summary, which treats `all`/`All` as all (`:1436`), and from the DQA endpoints, which use `All Districts`.
- **Used by:**
  - Wrapper: `getActionQueue` (`legacy:src/lib/api.ts:1049-1068`).
  - Callers: `legacy:src/components/dashboard/services/QualityReviewPanel.tsx:87` (QualityReviewPanel inside ServicesPage, `{ type, district }`). Dead: `legacy:src/components/dashboard/ActionQueueBanner.tsx:27` (component never imported).
  - Params: the wrapper strips only lower-case `"all"` (`legacy:src/lib/api.ts:1057`), matching the handler (`backend:controllers/etlController.js:1919`).
- **Fixture:** `test/fixtures/dqa-etl-dqa.json` → `"GET /etl/action-queue"` (vca), plus `"GET /etl/action-queue [type=caregiver]"` and `"GET /etl/action-queue [type=household]"`

---

#### `GET /etl/services/:type/summary`
- **Handler:** `backend:controllers/etlController.js:1424` · **Route:** `backend:routes/etlRoutes.js:44`
- **Purpose:** Headline KPIs for one service type: enrolled and active counts, sub-population counts, and services this month vs last month with a trend.
- **Params:**
  - `:type`: path, required, lowercased (`:1430`). `vca` | `caregiver` | `household`; anything else returns 400 (`:1655-1657`).
  - `district`: query, optional. Sentinels `"all"` and `"All"` (`:1436`).
  - `facility`: query, optional. Sentinel `"all"` (`:1440`).
  - `ward`: query, optional. Sentinel `"all"` (`:1444`).
  - `from`, `to`: query, `YYYY-MM-DD`, both required for the window to apply (`:1432`, `backend:lib/fyClause.js:8-17`).
  - Not supported: `province`.
- **Fiscal year / date window:**
  - `buildCohortFyClause` runs on `c.date_enrolled`/`c.de_registration_date` (`:1449-1457`). It keeps entities active during the window: `enrolled <= to AND (de_reg IS NULL OR de_reg >= from)` (`backend:lib/fyClause.js:37-56`).
  - The same `where` also restricts the service-count and stale subqueries to that cohort (`:1500`, `:1508`, `:1567`, `:1622`).
  - The service counts themselves always cover the **calendar current and previous month relative to `CURRENT_DATE`**, not the FY (`:1494-1497`).
- **Scope enforcement:** **trusts district param**. `c.district = $n` applies only when supplied (`:1436-1439`). No `req.user`, no province.
- **Data source:** `FlatPGConnection` (`:1429`).
  - vca: `children` (CTE `base`) and `vca_services` JOIN `children`; stale check uses `children` NOT EXISTS `vca_services`.
  - caregiver: `all_households` and `caregiver_services` JOIN `all_households`.
  - household: `all_households` and `household_services` JOIN `all_households`.
- **Server-side filtering / sort / pagination / limits:**
  - Aggregates only, so there is a single row.
  - vca uses `COUNT(DISTINCT uid)` (`:1479-1483`). caregiver and household use `COUNT(DISTINCT household_id)` (`:1550-1553`, `:1605-1608`).
  - `active` = `LOWER(TRIM(case_status)) IN ('active','1')`.
  - Cached for 5 minutes in `PERF_CACHE`, keyed by path and query (`:1425-1427`, `:1540`, `:1596`, `:1651`).
- **Response:** 200 `{ status:"success", type, data:{…}, generated_at, source }`. All numbers are coerced in JS with `Number(...)`, so they are JSON numbers (`:1517-1539`, `:1576-1595`, `:1631-1650`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | `"success"` |
  | type | string | no | lowercased type |
  | generated_at | string | no | ISO timestamp |
  | source | string | no | `"ecap_plus.children + vca_services"` / `"ecap_plus.all_households + caregiver_services"` / `"ecap_plus.all_households + household_services"` |
  | data.enrolled | number | no | all types |
  | data.active | number | no | all types |
  | data.clhiv | number | no | **vca only** |
  | data.hei | number | no | **vca only** |
  | data.cwlhiv | number | no | vca: from `cwlhiv` flag; caregiver: from `caregiver_hiv_status` containing positive/true. Absent for household |
  | data.active_this_month | number | no | **vca only**: distinct vcaid served this month |
  | data.stale_90d | number | no | **vca only**: children with no service in 90 days |
  | data.pregnant | number | no | **caregiver only** (`pregnant_woment` column) |
  | data.screened | number | no | **household only** |
  | data.unscreened | number | no | **household only** |
  | data.services_this_month | number | no | all types |
  | data.services_last_month | number | no | all types |
  | data.mom_trend_pct | number | no | integer: `round((this−last)/last·100)`; 100 if last=0 and this>0; 0 if both are 0 |
- **Errors:**
  - 400 `{status:"error", message:"Unknown service type: <type>"}`.
  - 500 `{status:"error", message: err.message}`. The DB error is leaked (`:1658-1661`). Only the vca main query re-throws (`:1487-1489`). All other sub-queries `.catch(() => ({rows:[{}]}))`, which gives zeros with status 200.
- **Issues:**
  - **Service counts are probably always 0 for vca and household.** The inline `parseDate` applies the regex `~` to `vs.service_date`/`hs.service_date` **without a `::text` cast** (`:1467`, `:1494-1497`, `:1508`, `:1617-1619`). The handler's own sibling comment says vca_services and household_services `service_date` are real `date` columns and that `~` on them raises "operator does not exist: date ~ unknown" (`:1749-1753`). The error is caught (`:1503`, `:1511`, `:1625`), so `services_this_month`, `services_last_month`, `active_this_month`, `stale_90d` and `mom_trend_pct` silently become 0, and that zero result is cached. Timeseries and distribution fixed this with `::text` (`:1759-1765`); summary was not fixed. Not verified against a schema, and for household the comment at `:2044` says the column is text, which would make household unaffected.
  - For caregiver and household, an error in the main KPI query is swallowed, so a 200 response with all zeros gets cached (`:1557`, `:1612`).
  - Fan-out: the service-count queries JOIN the entity table (`:1499`, `:1566`, `:1621`). Duplicate entity rows, which exist in `children` (`:1471`), multiply `COUNT(*)`.
  - `stale_90d` counts child rows, not distinct uids (`:1507`).
  - The FY window does not apply to the service counts (current and previous calendar month only).
  - Shared cache across users. Unbounded cache size.
- **Used by:**
  - Wrapper: `getServiceSummary` (`legacy:src/lib/api.ts:921-947`).
  - Callers: `legacy:src/components/dashboard/CanonicalKpiStrip.tsx:90` (with FY); `legacy:src/components/dashboard/services/CohortStrip.tsx:39` (with FY); `legacy:src/components/dashboard/services/ServicesPage.tsx:304` (without FY). All three render inside ServicesPage, used by the HouseholdServices, VcaServices and CaregiverServices pages.
  - Params: ServicesPage keeps `fyKey` in its query key but sends no `from`/`to` (`legacy:src/components/dashboard/services/ServicesPage.tsx:295-305`), so the page makes a second, non-FY request to this endpoint and uses only its `source`/`generated_at` (`:535-536`).
- **Fixture:** `test/fixtures/dqa-etl-services-summary.json` → `"GET /etl/services/:type/summary [type=vca]"`, `"… [type=caregiver]"`, `"… [type=household]"`, `"… [type=unknown]"` (400)

---

#### `GET /etl/services/:type/timeseries`
- **Handler:** `backend:controllers/etlController.js:1719` · **Route:** `backend:routes/etlRoutes.js:47`
- **Purpose:** Monthly service volume for the last 12 calendar months, ending with the current month.
- **Params:**
  - `:type`: path, lowercased. Looked up in `TYPE_CFG`, 400 if unknown (`:1725-1730`).
  - `district`: query, optional. Sentinels `all`/`All` (`:1735`).
  - `facility`: query, optional. Sentinel `all` (`:1739`).
  - `ward`: query, optional. Sentinel `all` (`:1743`).
  - **`from`/`to` are ignored**, even though the legacy frontend sends them (`legacy:src/lib/api.ts:975`). They still split the cache key.
  - Not supported: `province`.
- **Fiscal year / date window:** none from the FY. The window is a fixed `generate_series(date_trunc('month', CURRENT_DATE - 11 months) … date_trunc('month', CURRENT_DATE))` (`:1770-1776`).
- **Scope enforcement:** **trusts district param** (`:1735-1738`). No `req.user`, no province.
- **Data source:** `FlatPGConnection`. Query: `months` LEFT JOIN `<svc table>` on the parsed month, then LEFT JOIN `<entity table>` on the join key (`:1781-1786`).
- **Server-side filtering / sort / pagination / limits:**
  - `GROUP BY m.month_start ORDER BY m.month_start` (`:1787-1788`).
  - The date is parsed with a `::text` cast before the regex (`:1759-1765`).
  - At most 12 rows. Cached for 5 minutes.
- **Response:** 200 `{ status:"success", type, data: point[], generated_at, source }` (`:1793-1803`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | |
  | type | string | no | |
  | data[].month | string | no | `to_char(..., 'YYYY-MM')` |
  | data[].label | string | no | `to_char(..., 'Mon YY')`, e.g. `"Jul 26"` |
  | data[].count | number | no | `COUNT(svc.*)` bigint, converted to a JS Number (`:1799`) |
  | generated_at | string | no | ISO timestamp |
  | source | string | no | `TYPE_CFG[type].source` |
- **Errors:**
  - 400 `{status:"error", message:"Unknown service type: <type>"}`.
  - 500 `{status:"error", message: err.message}`. The DB error is leaked (`:1806-1809`).
- **Issues:**
  - **Missing months when filtered.** The district/facility/ward filter is in the WHERE clause on the LEFT-JOINed entity (`:1786`). Months with no matching service rows have `c.district` NULL and are dropped, so the series can have fewer than 12 points instead of zero-filled months. Clients must zero-fill.
  - Fan-out: the LEFT JOIN to the entity table multiplies counts when entity ids are duplicated (`:1784-1785`, `:1471`).
  - Unfiltered calls include service rows with no matching entity (orphans), so the counts differ from filtered sums.
  - FY params are ignored.
  - With `:type` = `constructor` the `TYPE_CFG` lookup returns an inherited property, so SQL is built from `undefined` and gives a 500 (`:1726`).
- **Used by:**
  - Wrapper: `getServiceTimeseries` (`legacy:src/lib/api.ts:961-987`).
  - Callers: `legacy:src/components/dashboard/services/ServicesTimeSeriesChart.tsx:22` (inside ServicesPage).
  - Params: `from`/`to` sent (`legacy:src/lib/api.ts:974-977`) but ignored; the handler always uses the last 12 months (`backend:controllers/etlController.js:1732`).
- **Fixture:** `test/fixtures/dqa-etl-services-summary.json` → `"GET /etl/services/:type/timeseries"`

---

#### `GET /etl/services/:type/distribution`
- **Handler:** `backend:controllers/etlController.js:1815` · **Route:** `backend:routes/etlRoutes.js:50-53`
- **Purpose:** How services in the last 90 days split across the type's pillars.
- **Params:**
  - `:type`: path, lowercased, `TYPE_CFG` lookup, 400 if unknown (`:1821-1826`).
  - `district`: query, optional. Sentinels `all`/`All` (`:1831`).
  - `facility`: query, optional. Sentinel `all` (`:1835`).
  - `ward`: query, optional. Sentinel `all` (`:1839`).
  - **`from`/`to` are ignored**, even though the legacy frontend sends them (`legacy:src/lib/api.ts:1017`).
  - Not supported: `province`.
- **Fiscal year / date window:** none from the FY. Fixed `parsed service_date >= CURRENT_DATE - 90 days` (`:1874`). The response reports `window_days: 90` (`:1895`).
- **Scope enforcement:** **trusts district param** (`:1831-1834`). No `req.user`, no province.
- **Data source:** `FlatPGConnection`. Query: `<svc table>` JOIN `<entity table>` (`:1872-1873`).
- **Server-side filtering / sort / pagination / limits:**
  - Single row: `COUNT(*) AS total` plus one `COUNT(*) FILTER (WHERE <pillar col> non-empty and not '[]' / '["not applicable"]') AS "<Label>"` per pillar (`:1845-1846`, `:1860-1865`).
  - Cached for 5 minutes.
- **Response:** 200 `{ status:"success", type, data: slice[], total, window_days, generated_at, source }` (`:1890-1898`).

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | status | string | no | |
  | type | string | no | |
  | data[].pillar | string | no | pillar label from `TYPE_CFG` (5 per type, fixed order) |
  | data[].count | number | no | JS-coerced from bigint |
  | data[].pct | number | no | integer `round(count/total·100)`. Pillars overlap, so the sum can exceed 100 |
  | total | number | no | service rows in the window |
  | window_days | number | no | always `90` |
  | generated_at | string | no | ISO timestamp |
  | source | string | no | `TYPE_CFG[type].source` |
- **Errors:**
  - 400 `{status:"error", message:"Unknown service type: <type>"}`.
  - 500 `{status:"error", message: err.message}`. The DB error is leaked (`:1901-1904`).
- **Issues:**
  - The FY params sent by the legacy frontend are ignored.
  - Fan-out from the JOIN when entity ids are duplicated (`:1873`).
  - `pct` values are not shares of a whole, because one service row can count toward several pillars.
  - The same inherited-property lookup issue on `:type` as in timeseries (`:1822`).
- **Used by:**
  - Wrapper: `getServiceDistribution` (`legacy:src/lib/api.ts:1003-1031`).
  - Callers: `legacy:src/components/dashboard/services/ServicesDistributionChart.tsx:31` (inside ServicesPage).
  - Params: `from`/`to` sent (`legacy:src/lib/api.ts:1016-1019`) but ignored; the handler always uses the last 90 days (`backend:controllers/etlController.js:1828`).
- **Fixture:** `test/fixtures/dqa-etl-services-summary.json` → `"GET /etl/services/:type/distribution"`

---

**Group: `/etl` records and PMTCT** (`backend:routes/etlRoutes.js`)

Router mounted at `/etl` (`backend:index.js:42`). Every route passes through `verifyDirectusToken`
(`backend:index.js:38`) first: a valid Directus HS256 JWT in `Authorization: Bearer` **or `?token=`**
(`backend:middleware/verifyDirectusToken.js:31-40`); it sets `req.user` (`:87`) but none of the handlers
below read `req.user`. With `AUTH_MODE=log` requests with a missing, invalid or expired token are all let through (`:62-68`, `:81-83`, `:90-95`).
Missing/invalid token in enforce mode → `401 {status:"fail", message}` (`:69`); `DIRECTUS_SECRET` unset in enforce mode → `500 {status:"error", message:"Server authentication is not configured."}` (`:72-78`).

All five handlers use the `FlatPGConnection` pool (`backend:controllers/etlController.js:3`,
`backend:config/database.js:8-14`). None of them calls `parseFyWindow` / `buildCohortFyClause` /
`buildServiceFyClause`, although the controller imports them (`backend:controllers/etlController.js:7-11`) and other handlers in the same file use them (e.g. `backend:controllers/etlController.js:1432`). None of the five reads `req.user` or uses `lib/userScope`.

---

#### `GET /etl/services/:type/records`
- **Handler:** `backend:controllers/etlController.js:2506` · **Route:** `backend:routes/etlRoutes.js:56`
- **Purpose:** Server-side paginated, filtered list of individual **service records** (one row per service visit joined to its VCA / household) plus aggregate stats for the whole filtered set.
- **Params:**
  - `type` (path, string, required). Lower-cased (`:2508`); must be `vca` | `caregiver` | `household` else 400 (`:2510-2515`). Per-type config `:2544-2663`:
    - `vca`: `vca_services vs JOIN children c ON c.uid = vs.vcaid`; id `vs.vcaid`; name = `firstname || ' ' || lastname` or `'N/A'`; `entityLabel` "VCA"; pillars HIV / Health / Education / Safety / Stability; `service_date` is a date column (`:2545-2588`).
    - `caregiver`: `caregiver_services cs JOIN all_households c ON c.household_id = cs.household_id`; id `cs.household_id`; name `c.caregiver_name`; `entityLabel` "Household"; pillars HIV / Health / Education / Safety / Stability; `service_date` is **text** (`:2589-2625`, `:2605`).
    - `household`: `household_services hs JOIN all_households c ON c.household_id = hs.household_id`; id `hs.household_id`; name `c.caregiver_name`; `entityLabel` "Household"; pillars Health / **Household** / Education / Safety / Stability; `service_date` is a date column (`:2626-2662`, `:2642`).
  - `entityId` (query, string, default `""`). If non-blank after trim: exact case-insensitive, trimmed match on the entity id (`:2728-2732`) and **every other filter below is skipped** (district, domain, dateWindow, issue, search are all inside the `else` branch `:2733-2813`).
  - `district` (query, string, optional). Ignored when absent, `"All"` or `"all"` (`:2735`); otherwise exact, **case-sensitive** equality on `c.district::text` (`:2736`) — no trim, no lower. Single value only (no comma lists). Note `"All Districts"` would be treated as a literal district and return nothing.
  - `domain` (query, string, default `"all"`). Case-insensitive match against the type's pillar labels (`:2740-2746`). Match adds "pillar has services" = main column has a non-trivial value OR the `other_*` column is non-empty (`pillarHasExpr`, `:2697-2709`). **Unknown labels are silently ignored** — e.g. `HIV` on `household`, `Household` on `vca`/`caregiver` (legacy offers all six for every type: `legacy:src/components/dashboard/services/ServicesPage.tsx:103-111`).
  - `dateWindow` (query, string, default `"all"`). `parseInt(dateWindow,10)`; if a positive integer N: `service_date >= CURRENT_DATE - INTERVAL 'N days'` (`:2750-2756`). Rows whose date is null/unparseable are excluded. Rolling window from DB `CURRENT_DATE`, not a fiscal year. Legacy sends `30` / `90` / `365` (`legacy:src/components/dashboard/services/ServicesPage.tsx:113-118`). Non-numeric/≤0 → ignored.
  - `issue` (query, string, default `""`). One of (`:2760-2797`): `missing_date` (raw service_date null / blank / `'N/A'`), `no_service_details` (no pillar has services, main OR other column), `missing_caseworker` (`c.caseworker_name` null/blank), `missing_district` (`c.district` null/blank), `stale_90d` (parsed date not null and older than 90 days). Any other value → ignored (`:2794-2795`). Single value only.
  - `search` (query, string, default `""`). Trimmed, lower-cased, wrapped in `%…%` and bound as a parameter (`:2800-2801`). OR-matched with `LIKE` against: entity id, entity name, district, facility, caseworker, and the raw text of all 10 service columns concatenated (JSON brackets/quotes included) (`:2802-2811`, `:2712-2714`). `%`/`_` in user input are not escaped (act as wildcards).
  - `page` (query, int-as-string, default `"1"`): `max(1, parseInt||1)` (`:2528`); `0`/negative/non-numeric → `1`. No upper bound (a page past the end returns `data: []` with the full `stats`).
  - `pageSize` (query, int-as-string, default `"12"`): clamped to 1..100 (`:2529-2532`). `0`, empty or non-numeric → `12` (because `parseInt(...) || 12`), negative → `1`, >100 → `100`. The echoed `pageSize` in the response is the clamped value.
  - **Not accepted / ignored:** `from`, `to` (FY), `province`, `sort`/`order` (sort is fixed), multiple issues/domains. `token` is consumed by the auth middleware only.
- **Fiscal year / date window:** none — `lib/fyClause.js` is not used. Only the rolling `dateWindow` (days before `CURRENT_DATE`). Legacy does not send FY to this endpoint either (`legacy:src/lib/api.ts:1357-1367`).
- **Scope enforcement:** **trusts district param** — optional; omitted/`All` returns every district (`:2735`). `req.user` is never read. `entityId` mode ignores `district` entirely (`:2728-2733`), so any authenticated user can page through any entity's services. No province param.
- **Data source:** `vca_services`+`children`, `caregiver_services`+`all_households`, or `household_services`+`all_households` (inner JOIN, `:2885-2886`); `FlatPGConnection` (`:2507`).
- **Server-side filtering / sort / pagination / limits:** single CTE query (`:2865-2974`): `base` (filtered rows + computed flags), `stats` (COUNT, monthly COUNT where parsed date ≥ first day of current month, records with any issue, SUM of each flag; `:2890-2909`), `paged` (`ORDER BY service_date_parsed DESC NULLS LAST, entity_id LIMIT pageSize OFFSET (page-1)*pageSize`, `:2911-2915`), then `stats` sentinel row `UNION ALL` data rows (`:2917-2973`). Always requires a non-null, non-blank entity id (`:2725-2726`). No caching.
- **Response:** `200` (`:3098-3112`):
  ```
  { status: "success", type, page, pageSize, totalRecords, totalPages,
    stats: { loaded, monthly, recordsWithIssues, issueCounts: { missing_date, no_service_details, missing_caseworker, missing_district, stale_90d } },
    data: [ ...rows ] }
  ```
  Top-level: `type` string (lower-cased path param); `page`, `pageSize`, `totalRecords` (`Number(_total)`), `totalPages` (`max(1, ceil(total/pageSize))`, `:2983-2984`) all JSON numbers. `stats.loaded` = `totalRecords` (`:3106`); all stats numbers (bigint converted with `Number()`, `:3090-3110`).

  `data[]` row (`:3062-3087`):

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | `id` | string | no | `` `${type}-${entityId}-${serviceDate}-${offset+idx}` `` — synthetic, position-dependent, not stable across pages/filters (`:3063`) |
  | `type` | string | no | `vca` / `caregiver` / `household` |
  | `entityId` | string | no | `vcaid` or `household_id` as text; `"N/A"` fallback (`:3054`) |
  | `entityLabel` | string | no | `"VCA"` or `"Household"` (caregiver also `"Household"`) |
  | `name` | string | no | VCA first+last name or caregiver name; `"N/A"` when blank |
  | `district` | string | no | `"N/A"` when blank |
  | `facility` | string | no | `"N/A"` when blank |
  | `caseworker` | string | no | `"N/A"` when blank |
  | `serviceDate` | string | no | Raw `service_date::text`, unparsed: `YYYY-MM-DD` for vca/household (date columns); caregiver text may be `YYYY-MM-DD…` or `DD-MM-YYYY`; `"N/A"` when blank |
  | `serviceNames` | string[] | no | All 10 service columns concatenated, `[]"{}` stripped, split on `,`, trimmed, de-duplicated, dropping `not applicable`/`other`/`none`/length ≤ 1 (`:2854-2859`, `:3020-3030`). Names containing commas get split |
  | `pillars` | string[] | no | Pillar labels whose **main** column has services (other_* columns ignored here, `:2818-2823`), in config order |
  | `servicesByPillar` | object<string,string[]> | no | Each pillar key maps to the **same full `serviceNames` list** — not per pillar (`:3037-3040`) |
  | `status` | string | no | Raw `c.case_status` text (commonly `"1"` for active per `backend:controllers/etlController.js:1472`), `"Synced"` if blank; `"Missing date"` if blank status and `serviceDate === "N/A"` (`:2875`, `:3057-3060`) |
  | `issues` | string[] | no | Labels: `Missing date`, `No service details`, `Missing caseworker`, `Missing district`, `Older than 90d` (`:2986-2992`) |
  | `issueKeys` | string[] | no | Keys parallel to `issues` |
  | `ageDays` | number | yes | Whole days between now (Node clock) and parsed service date, floored and clamped to ≥ 0 (future dates → 0); `null` when date unparseable (`:3043-3052`) |
  | `raw` | object | no | `{ entity_id, district, facility, caseworker_name, service_date }` — all strings (already `"N/A"`-coalesced) (`:3080-3086`) |
- **Errors:** `400 {status:"error", message:"Unknown service type: <type>"}` (`:2512-2514`); `500 {status:"error", message: err.message}` — **leaks raw Postgres error text** (`:3113-3116`); `401` from auth middleware.
- **Issues:**
  - Query-string values are assumed to be strings. Express 4 (`backend:package.json:27`) uses the `qs` parser, so `?search[]=x` / `?entityId[]=x` / `?domain[]=x` make `.trim()` / `.toLowerCase()` throw at `:2728`/`:2742`/`:2800` — **before** the `try` (`:2977`). The async handler rejection is not caught by Express 4 → request hangs, unhandled rejection logged.
  - `dateWindow` is interpolated into SQL (`` INTERVAL '${days} days' ``, `:2754`). It is `parseInt`-sanitised so not injectable, but very large values (e.g. 23 digits → `1e+23`) produce invalid SQL → 500 with leaked DB message. `pageSize`/`offset` are interpolated too (`:2914`); `pageSize` is bounded, but `offset = (page-1)*pageSize` is not: a huge `page` (e.g. 21 digits) renders as `1e+21` → invalid SQL → 500 with leaked DB message.
  - Sort `service_date_parsed DESC NULLS LAST, entity_id` is not unique (an entity can have several services on one date) → rows can repeat/skip between pages (`:2913`).
  - Final result order depends on `UNION ALL` append order (`:2945`) — works in practice, not guaranteed by SQL; the code does find/filter by `_row_type` so only data-row order is affected.
  - Inconsistency: `domain`/`no_service_details` treat `other_*` columns as "has services" (`:2697-2709`) but the `pillars` output only checks main columns (`:2821`) → a row returned for `domain=HIV` can show no `HIV` pillar.
  - `servicesByPillar` is misleading (identical list per pillar, `:3037-3040`).
  - `district` match is case-sensitive and untrimmed (`:2736`) while PMTCT endpoints are case-insensitive — inconsistent.
  - Performance: every request runs COUNT/SUM over the full filtered join and `LIKE '%…%'` over a concatenation of 10 casted columns — full scans, no index use; no caching (`:2890-2909`, `:2802-2811`). Unbounded `page` → large OFFSET scans.
  - `stats.monthly` uses `date_trunc('month', CURRENT_DATE)` — calendar month, independent of any window.
  - `caregiver` text dates: any value matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}` is cast with `::date` and `^[0-9]{2}-[0-9]{2}-[0-9]{4}` with `TO_DATE` (`:2683-2689`); a regex-matching but impossible date (e.g. month 13) makes the cast raise, failing the whole query with a 500 (data-dependent, not verified against live data).
  - Searching `n/a` matches every row with a blank name, because the name expression already substitutes `'N/A'` before the LIKE (`:2561`, `:2598`, `:2805`).
  - No FY support at all (rule says scope + FY should be in every query key; this endpoint can only honour district).
- **Used by:**
  - Wrapper: `getServiceRecords` (`legacy:src/lib/api.ts:1346-1387`).
  - Callers: `legacy:src/components/dashboard/services/ServicesPage.tsx:323` (ServicesPage, `pageSize` 12).
  - Params: the wrapper strips only capital `"All"` from `district` (`legacy:src/lib/api.ts:1358`); the handler accepts both cases (`backend:controllers/etlController.js:2735`), and the caller already maps "All" to `undefined`. No FY is sent.
- **Fixture:** `test/fixtures/dqa-etl-service-records.json` → `"GET /etl/services/:type/records#vca"`, `"GET /etl/services/:type/records#caregiver"`, `"GET /etl/services/:type/records#household"`, `"GET /etl/services/:type/records#error-unknown-type"`

#### `GET /etl/services/:type/record-detail`
- **Handler:** `backend:controllers/etlController.js:3126` · **Route:** `backend:routes/etlRoutes.js:59`
- **Purpose:** Full raw joined row (service table `s.*` + entity table `c.*`) for one entity's **most recent** service, for a detail sheet.
- **Params:**
  - `type` (path, string, required): `vca` | `caregiver` | `household` (lower-cased, `:3128`; map `:3137-3162`), else 400 (`:3164-3169`). Checked **after** `entityId`.
  - `entityId` (query, string, required; 400 if falsy, `:3131-3135`). Matched case-insensitively and trimmed against `s.vcaid` (vca) or `s.household_id` (caregiver/household) (`:3183`).
  - `district` (query, string, optional). Ignored when absent/`All`/`all`; else exact case-sensitive equality on `c.district::text` (`:3174-3177`).
  - **Ignored:** everything else (no service-date or service-id param, so a specific service row cannot be requested).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param** — district is optional; without it any authenticated user gets any entity's full row (`:3172-3177`). No province param.
- **Data source:** `vca_services s JOIN children c` / `caregiver_services s JOIN all_households c` / `household_services s JOIN all_households c` (`:3179-3188`); `FlatPGConnection` (`:3127`).
- **Server-side filtering / sort / pagination / limits:** `ORDER BY s.service_date DESC NULLS LAST LIMIT 1` (`:3185-3186`). No caching.
- **Response:** `200 {status:"success", data:{...}}` (`:3196`). `data` is `SELECT s.*, c.*` — **dynamic columns**; no DDL for these tables exists in `backend:sql/`. Columns establishable from the controller SQL:

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | `vcaid` (vca) | string | no | join key `c.uid = s.vcaid` (`:3143`) |
  | `uid` (vca) | string | no | from `children` |
  | `household_id` (caregiver/household) | string | no | present in both tables; **`c.*` value overwrites `s.*` on name collision** (node-pg keeps the last duplicate column) |
  | `service_date` | string | yes | vca/household: date column → JSON ISO timestamp (`"YYYY-MM-DDT…Z"`, shifted by server TZ); caregiver: raw text (`:2605`, `:2642`) |
  | `hiv_services`, `health_services`, `schooled_services`, `safe_services`, `stable_services` (+ `hh_level_services` for household; the household config does not reference `hiv_services`) | string | yes | JSON-array-as-text, e.g. `["…","…"]` (`:2576-2587`, `:2613-2624`, `:2650-2661`) |
  | `other_*_services` (matching the above) | string | yes | free text |
  | `firstname`, `lastname` (vca) | string | yes | `children` (`:2555-2560`) |
  | `caregiver_name` (caregiver/household) | string | yes | `all_households` (`:2598`) |
  | `district`, `facility`, `caseworker_name`, `case_status` | string | yes | entity table (`:2563-2566`) |
  | any other column of the two tables | unknown | — | uncertain; includes PII from `children`/`all_households` |
- **Errors:** `400 {status:"error", message:"entityId is required"}` (`:3132-3134`); `400 {status:"error", message:"Unknown type: <type>"}` (`:3166-3168`); `404 {status:"error", message:"Record not found"}` (`:3190-3193`); `500 {status:"error", message: err.message}` (leaks DB message, `:3197-3200`).
- **Issues:**
  - Returns the entity's latest service, not the service row the user clicked — the detail sheet for an older service shows a different service's data (`:3185-3186`; caller passes only `entityId`+`district`, `legacy:src/components/dashboard/services/ServicesPage.tsx:424-428`).
  - For `caregiver`, `service_date` is text so `ORDER BY s.service_date DESC` sorts lexically — wrong for `DD-MM-YYYY` values (`:3185`, `:2605`).
  - `SELECT s.*, c.*` exposes every column of the entity table (names, PII) and silently drops colliding `s.*` columns (`:3180`).
  - No geographic scope check; record-level PII available to any authenticated user who knows/guesses an id.
  - `district` filter case-sensitive (`:3176`).
- **Used by:**
  - Wrapper: `getServiceRecordDetail` (`legacy:src/lib/api.ts:1389-1406`); every error becomes `null`.
  - Callers: `legacy:src/components/dashboard/services/ServicesPage.tsx:424` (ServicesPage; passes `record.district` unless `"N/A"`).
- **Fixture:** `test/fixtures/dqa-etl-service-records.json` → `"GET /etl/services/:type/record-detail#vca"`, `"GET /etl/services/:type/record-detail#caregiver"`, `"GET /etl/services/:type/record-detail#not-found"`, `"GET /etl/services/:type/record-detail#missing-entity-id"`

#### `GET /etl/services/:type/export`
- **Handler:** `backend:controllers/etlController.js:3216` · **Route:** `backend:routes/etlRoutes.js:65`
- **Purpose:** Streams a CSV of **all** service records matching the same filters as `/records` (no pagination).
- **Params:** identical to `/records` (`:3227-3234`, filter logic duplicated `:3392-3476`): `type` (path; 400 if invalid `:3220-3225`), `entityId` (overrides all other filters), `district`, `domain`, `dateWindow`, `issue`, `search` — same parsing and same silently-ignored values. `page`/`pageSize` are **not read** (`:3213-3214`). Legacy also sends `token` in the query string (`legacy:src/lib/api.ts:1438-1439`) even though it downloads with `fetch(url)` (`legacy:src/lib/api.ts:1446`), which could have sent an `Authorization` header instead (token accepted by `backend:middleware/verifyDirectusToken.js:36-38`). `from`/`to`/`province`/sort ignored.
- **Fiscal year / date window:** none (only rolling `dateWindow`, `:3420-3427`).
- **Scope enforcement:** **trusts district param** — optional; omitted → all districts (`:3407`). `entityId` ignores district (`:3402`).
- **Data source:** same tables/joins as `/records` (`:3528-3529`); `FlatPGConnection.connect()` dedicated client + `pg-cursor` (`:3535`, `:3575`, `:3595`).
- **Server-side filtering / sort / pagination / limits:** `ORDER BY <parsed service_date> DESC NULLS LAST, entity_id` (`:3531`); **no LIMIT** — unbounded, read in cursor batches of 1000 (`:3596-3608`). Domains/services/issues computed in SQL (`:3514-3527`): `services` = `string_agg(DISTINCT …, '; ')` (alphabetical, de-duplicated).
- **Response:** `200`, streamed, headers (`:3538-3542`):
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="<type>-services-<YYYY-MM-DD>.csv"` (server UTC date, `:3536`)
  - `Transfer-Encoding: chunked`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`
  - Body: CRLF-terminated rows; header row `Type,Entity ID,Name,District,Facility,Caseworker,Service Date,Domains,Services,Status,Issues` (`:3555-3567`). Cells quoted only when they contain `"`, `,` or `\n` (`:3544-3551`).

  | Column | Source | Notes |
  |---|---|---|
  | Type | constant | `VCA` / `Caregiver` / `Household` (`:3569-3573`) — differs from `/records` `entityLabel` |
  | Entity ID | `entity_id` | text id |
  | Name | `entity_name` | `N/A` when blank |
  | District / Facility / Caseworker | coalesced | `N/A` when blank |
  | Service Date | raw `service_date::text` | `N/A` when blank |
  | Domains | `ARRAY_TO_STRING(...,'; ')` | main columns only; empty cell when none |
  | Services | `string_agg(DISTINCT …,'; ')` | empty when none |
  | Status | `case_status` or `Synced` | **no** "Missing date" override (unlike `/records`) |
  | Issues | `CONCAT_WS(', ', …)` | e.g. `"Missing caseworker, Older than 90d"` (quoted, contains commas); empty when none |
  - While no data row has been written, a keep-alive line `# preparing data...\r\n` is written every 5 s **into the CSV body** (`:3580-3589`).
- **Errors:** `400 {status:"error", message:"Unknown service type: <type>"}` (JSON). After the header row has been written (`:3592`) headers are sent, so any later failure (SQL error, cursor error) ends the stream with **status 200 and a truncated CSV** (`:3644-3650`); the JSON 500 branch is effectively unreachable. DB error text is only logged.
- **Issues:**
  - Keep-alive comment lines end up inside the downloaded CSV (spreadsheet tools show them as data rows) (`:3583`); legacy just blobs the stream (`legacy:src/lib/api.ts:1461-1471`).
  - Failures after streaming starts are indistinguishable from success (200 + partial file) (`:3646-3650`).
  - `SourcePG.connect()` is awaited outside the `try` (`:3575`): pool exhaustion/connection error → unhandled rejection, request hangs.
  - No `req.on('close')` handling: if the client aborts, the loop keeps reading the cursor (`res.writableEnded` is only true after `res.end()`, `:3636`) → full query runs to completion holding a pool client.
  - Unbounded export of record-level PII (names) with no scope check; auth token travels in the URL (ends up in proxy/access logs).
  - Same array-param crash, `dateWindow` overflow, unescaped `LIKE` wildcards and case-sensitive district as `/records`.
  - Whole CFG/filter logic duplicated from `/records` (`:3237-3476` vs `:2544-2813`) — drift risk (already drifted: status override, Type label, and the Services filter keeps 1-character names that `/records` drops: `:3518-3519` vs `:3025`).
  - No CSV formula-injection guard: cells beginning with `=`, `+`, `-`, `@` are written as-is (`:3544-3551`), and names/services are free text.
- **Used by:**
  - Wrapper: `triggerServiceExport` (`legacy:src/lib/api.ts:1416-1486`), raw `fetch` with no `Authorization` header.
  - Callers: `legacy:src/components/dashboard/services/ServicesPage.tsx:442` (ServicesPage).
  - Params: the token is sent as `?token=` (`legacy:src/lib/api.ts:1438-1439`) even though `fetch` could send the header; same filter mapping as `getServiceRecords`, without `page`/`pageSize`.
- **Fixture:** `test/fixtures/dqa-etl-service-records.json` → `"GET /etl/services/:type/export#vca"`, `"GET /etl/services/:type/export#slow-keepalive"`

#### `GET /etl/pmtct-child-register/:district(*)`
- **Handler:** `backend:controllers/etlController.js:3660` · **Route:** `backend:routes/etlRoutes.js:82`
- **Purpose:** All PMTCT child (HEI) register rows for one district.
- **Params:**
  - `district` (path, `:district(*)`, required). Used verbatim (`:3661`); matched `LOWER(TRIM(district)) = LOWER(TRIM($1))` (`:3666`). **No `All` handling and no comma lists** — `All` matches nothing → `data: []`. Legacy fans out one request per district (`legacy:src/pages/PMTCTRegister.tsx:163-179`).
  - **Ignored:** `from`, `to` — legacy sends them (`legacy:src/lib/api.ts:241-245`, `:353`) and a legacy comment claims server-side FY filtering (`legacy:src/pages/PMTCTRegister.tsx:169-171`), but the handler never reads `req.query`.
- **Fiscal year / date window:** none (FY params sent by legacy are ignored).
- **Scope enforcement:** **trusts district param** (`:3661-3669`); `req.user` not read. No province param.
- **Data source:** `pmtct_child_register` (`SELECT *`, `:3664-3665`), `FlatPGConnection`. No DDL in the backend repo; the table is presumably populated by the external `pmtct` ETL pipeline, whose config only shows it producing `pmtct_child_ecapplus_register_*.csv` extracts (`backend:services/etlRunner.js:55-67`) — the load into the table is not visible in this repo.
- **Server-side filtering / sort / pagination / limits:** `ORDER BY COALESCE(NULLIF(dbs_at_birth_actual_date,''), NULLIF(dbs_at_birth_due_date,''), NULLIF(date_tested,'')) DESC NULLS LAST, COALESCE(NULLIF(ca_id,''), NULLIF(pmtct_id,'')) ASC` (`:3667-3668`). **No LIMIT**, no pagination, no caching.
- **Response:** `200 {status:"success", data:[...]}` (`:3671`). `SELECT *` → dynamic columns. Columns established from the SQL (all text: compared with `''` via `NULLIF`):

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | `district` | string | yes | filter column |
  | `pmtct_id` | string | yes | may be `""` |
  | `ca_id` | string | yes | may be `""` |
  | `dbs_at_birth_actual_date` | string | yes | text date, format not established (may be `""`) |
  | `dbs_at_birth_due_date` | string | yes | text date |
  | `date_tested` | string | yes | text date |
  | `facility` | string | yes | **uncertain** — only from legacy usage (`legacy:src/pages/PMTCTRegister.tsx:228`) |
  | `test_result_at_birth` | string | yes | **uncertain** — legacy says values `D` / `ND` / blank (`legacy:src/pages/PMTCTRegister.tsx:286-293`) |
- **Errors:** `500 {status:"error", message: err.message}` — leaks DB message (`:3672-3675`).
- **Issues:**
  - Unbounded `SELECT *` (all columns, all rows of the district) (`:3664-3668`).
  - Dates are text; `ORDER BY` on the COALESCEd text sorts lexically — wrong if values are `DD-MM-YYYY` (`:3667`).
  - FY params silently ignored though the legacy UI keys its cache on FY and claims server filtering.
  - No "All" support → N parallel requests for an all-district view.
- **Used by:**
  - Wrapper: `getPmtctChildRegisterByDistrict` (`legacy:src/lib/api.ts:348-356`).
  - Callers: `legacy:src/pages/PMTCTRegister.tsx:175` (PMTCTRegister; one query per district, "All Districts" fans out, `:163-167`).
  - Params: `from`/`to` sent (`legacy:src/lib/api.ts:353`) but the handler reads only `req.params.district` (`backend:controllers/etlController.js:3661`).
- **Fixture:** `test/fixtures/dqa-pmtct.json` → `"GET /etl/pmtct-child-register/:district"`, `"GET /etl/pmtct-child-register/:district#all-returns-empty"`

#### `GET /etl/pmtct-mother-register/:district(*)`
- **Handler:** `backend:controllers/etlController.js:3681` · **Route:** `backend:routes/etlRoutes.js:88`
- **Purpose:** All PMTCT mother register rows for one district.
- **Params:** `district` (path, `:district(*)`, required), case-insensitive trimmed equality (`:3687`); no `All`, no comma lists. `from`/`to` sent by legacy (`legacy:src/lib/api.ts:363`) are **ignored**.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **trusts district param** (`:3682-3691`). No province param.
- **Data source:** `pmtct_mother_register` (`SELECT *`, `:3685-3686`), `FlatPGConnection`; presumably populated by the external `pmtct` pipeline (CSV extract config only, `backend:services/etlRunner.js:55-67`).
- **Server-side filtering / sort / pagination / limits:** `ORDER BY COALESCE(NULLIF(date_enrolled_pmtct,''), NULLIF(date_1st_visit,''), NULLIF(date_tested,'')) DESC NULLS LAST, COALESCE(NULLIF(ecap_id,''), NULLIF(pmtct_id,'')) ASC` (`:3688-3689`). No LIMIT/pagination/caching.
- **Response:** `200 {status:"success", data:[...]}` (`:3692`). Dynamic `SELECT *`; established columns (text):

  | Field | Type (as JSON) | Nullable | Notes |
  |---|---|---|---|
  | `district` | string | yes | filter column |
  | `pmtct_id` | string | yes | may be `""` |
  | `ecap_id` | string | yes | may be `""` |
  | `date_enrolled_pmtct` | string | yes | text date |
  | `date_1st_visit` | string | yes | text date |
  | `date_tested` | string | yes | text date |
  | `facility` | string | yes | **uncertain** — legacy usage only (`legacy:src/pages/PMTCTRegister.tsx:251`) |
- **Errors:** `500 {status:"error", message: err.message}` (leaks DB message, `:3693-3696`).
- **Issues:** same as child register — unbounded `SELECT *`, lexical sort of text dates (`:3688`), FY params ignored, no `All`. Legacy hard-codes every mother's HIV status client-side rather than reading a column (`legacy:src/pages/PMTCTRegister.tsx:247-250`).
- **Used by:**
  - Wrapper: `getPmtctMotherRegisterByDistrict` (`legacy:src/lib/api.ts:358-366`).
  - Callers: `legacy:src/pages/PMTCTRegister.tsx:191` (PMTCTRegister; per-district fan-out).
  - Params: `from`/`to` sent (`legacy:src/lib/api.ts:363`) but the handler reads only `req.params.district` (`backend:controllers/etlController.js:3682`).
- **Fixture:** `test/fixtures/dqa-pmtct.json` → `"GET /etl/pmtct-mother-register/:district"`

---

Legacy caller grep (`legacy:src`): all five endpoints have a caller —
`/records` `legacy:src/lib/api.ts:1370`, `/record-detail` `legacy:src/lib/api.ts:1400`, `/export` `legacy:src/lib/api.ts:1441`,
`/pmtct-child-register/` `legacy:src/lib/api.ts:353`, `/pmtct-mother-register/` `legacy:src/lib/api.ts:363`.

---

**Group: `/agent`** (`backend:routes/agentRoutes.js`, mounted at `backend:index.js:44`). The notes below also apply to the `/superset` and root groups.

**Mounting and auth.** The routers are mounted at `/agent` (`backend:index.js:44`) and `/superset` (`backend:index.js:45`). Both are mounted after `express.json()` (`backend:index.js:34`) and the global `verifyDirectusToken` middleware (`backend:index.js:38`). `GET /` is registered at `backend:index.js:47-53` and the catch-all at `backend:index.js:55-60`, both after every router. Of this group's endpoints, only `GET /` and `GET /agent/health` are in `PUBLIC_ROUTES` (`backend:middleware/verifyDirectusToken.js:22-26`). `POST /agent/chat` and `POST /superset/guest-token` need a valid Directus token unless `AUTH_MODE=log`. `POST /superset/guest-token` re-checks `req.user` itself, so it needs a user even in log mode (`backend:controllers/supersetController.js:57-62`). The full middleware behaviour is in 3.1.

**None of these endpoints touches Postgres.** `agentController` talks to a local Ollama HTTP server (`backend:controllers/agentController.js:4-8`). `supersetController` talks to Directus (`backend:lib/userScope.js:66-70`) and Superset (`backend:lib/supersetClient.js:31-87`). The root route serves a file from disk.

#### `POST /agent/chat`
- **Handler:** `backend:controllers/agentController.js:12` · **Route:** `backend:routes/agentRoutes.js:5`
- **Purpose:** A thin proxy from the "Bumi" in-app assistant to a self-hosted Ollama server's OpenAI-compatible `/v1/chat/completions` endpoint.
- **Params (JSON body, all optional):**
  - `messages` (array of `{role, content}`). Anything that is not an array becomes `[]` (`backend:controllers/agentController.js:15`). Entries are not validated. If no entry has `role === "system"`, a hardcoded default system prompt is prepended. If any entry is a system message, the client's messages are forwarded unchanged and the default prompt is dropped (`backend:controllers/agentController.js:16-19`). The legacy frontend always sends its own system prompt (`legacy:src/lib/ai-service.ts:90-94`), so the backend default is never used by it.
  - `model` (string). It is forwarded as-is, and the default is the `OLLAMA_MODEL` env or `llama3.2:3b` (`backend:controllers/agentController.js:8,22`). The client can pick any model installed on the Ollama host.
  - `max_tokens` (number). `Math.min(Number(max_tokens) || 350, 600)` (`backend:controllers/agentController.js:24`). The default is 350 and the cap is 600. The legacy frontend sends 1024 (`legacy:src/lib/ai-service.ts:103`), which is silently capped to 600. There is no lower bound, so a negative number passes through.
  - `temperature` (number). It is used only if `typeof === "number"`; otherwise it is `0.4` (`backend:controllers/agentController.js:25`). It is not range-checked.
  - `stream` is always forced to `false` (`backend:controllers/agentController.js:26`). Streaming is not supported.
  - Any other body fields are ignored.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **no geographic data**. The proxy does not read `req.user` and does not query the database. Whatever data the frontend puts into the prompt is what the model sees.
- **Data source:** HTTP POST to `http://OLLAMA_HOST:OLLAMA_PORT/v1/chat/completions`. The defaults are `127.0.0.1:11434` (`backend:controllers/agentController.js:6-7,29-58`). The upstream timeout is 90 s (`backend:controllers/agentController.js:40,54`). It is Node's socket-inactivity timeout, not a total-duration cap; with `stream:false` Ollama sends nothing until it finishes, so in practice it acts as a 90 s cap.
- **Server-side filtering / sort / pagination / limits:** `max_tokens` is capped at 600. The request body is limited by `express.json()`'s default 100 kB (`backend:index.js:34`). There is no rate limiting, caching or conversation persistence.
- **Response:** `200` with the **Ollama response body passed through unchanged** (`backend:controllers/agentController.js:65`). Its shape is OpenAI chat-completion as produced by Ollama. That shape comes from the upstream server, not from this code, so treat any field other than `choices[].message.content` as indicative. The legacy frontend reads only `choices[0].message.content` (`legacy:src/lib/ai-service.ts:116,172`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `id` | string | no | Upstream completion id. |
  | `object` | string | no | `"chat.completion"`. |
  | `created` | number | no | Unix seconds. |
  | `model` | string | no | The model that answered. |
  | `system_fingerprint` | string | no | Upstream-specific. |
  | `choices` | array | no | `[{ index: number, message: { role: "assistant", content: string }, finish_reason: string }]`. `finish_reason` is `"stop"` or `"length"`. |
  | `usage` | object | no | `{ prompt_tokens, completion_tokens, total_tokens }` (numbers). |
- **Errors:**
  - Upstream HTTP ≥ 400 (with a JSON body): the **same status code** is passed through, with body `{"error":{"message":"Upstream LLM error","upstream":<raw Ollama body>}}` (`backend:controllers/agentController.js:60-64`).
  - Upstream returns non-JSON, times out (> 90 s), or the connection is refused: `500 {"error":{"message":"<err.message>"}}` (`backend:controllers/agentController.js:49,54-55,66-67`). Examples are `"connect ECONNREFUSED 127.0.0.1:11434"`, `"Ollama request timed out (>90s)"` and `"bad JSON from Ollama: <first 200 chars>"`. Internal host/port and raw upstream text leak to the client.
  - Malformed JSON request body: `express.json()` throws before the handler runs, and Express's default handler returns an **HTML** 400. A body over 100 kB gets an HTML 413.
  - Auth failures: `401 {"status":"fail","message":...}` from the middleware.
- **Issues:**
  - The **error envelope differs from the rest of the backend**: `{error:{message}}` here, `{status,message}` everywhere else. The frontend client must handle both shapes.
  - A client-controlled `model` and an unvalidated `messages` array allow any installed model to be invoked with arbitrary prompt sizes (up to 100 kB). There is no rate limit, and each call can tie up the single local LLM for up to 90 s (`backend:controllers/agentController.js:22,40`). Combined with `AUTH_MODE=log`, this is an unauthenticated compute-exhaustion vector.
  - The client can replace the system prompt (`backend:controllers/agentController.js:16-19`). The "never invent statistics" guardrail is therefore advisory only.
  - The default system prompt hardcodes branding, assistant name, program and country (`backend:controllers/agentController.js:10`). The new frontend must supply its own system prompt from `@/config`, and it already effectively does (legacy sends one).
  - The legacy caller has a hardcoded fallback backend URL when the env var is empty (`legacy:src/lib/ai-service.ts:10-12`). The rebuild must use `core/api` with env-configured base URLs only.
  - The legacy caller sends `max_tokens: 1024`, which is silently reduced to 600 (`backend:controllers/agentController.js:24`).
- **Used by:**
  - Wrappers: `getAiResponse` (`legacy:src/lib/ai-service.ts:84-121`, `fetch` at `:97`) and `getAiGreeting` (`legacy:src/lib/ai-service.ts:127-173`, `fetch` at `:154`), not in `api.ts`.
  - Callers: `legacy:src/components/dashboard/AiAssistant.tsx:79` (chat turn) and `:182` (greeting); AiAssistant is rendered by `legacy:src/components/dashboard/DashboardLayout.tsx:52`, so it is on every page that uses DashboardLayout.
  - Params: `getAiResponse` sends `max_tokens: 1024` (`legacy:src/lib/ai-service.ts:103`), which the handler caps at 600 (`backend:controllers/agentController.js:24`). The base URL falls back to the hardcoded production DQA host when the env var is empty (`legacy:src/lib/ai-service.ts:10-12`).
- **Fixture:** `test/fixtures/dqa-agent.json` → `"POST /agent/chat"` (plus `#upstream-error`, `#ollama-down`, `#timeout`, `#auth-missing-token`)

#### `GET /agent/health`
- **Handler:** `backend:controllers/agentController.js:71` · **Route:** `backend:routes/agentRoutes.js:6`
- **Purpose:** Checks whether the local Ollama server is reachable, by calling `GET /api/tags` with a 3 s socket-inactivity timeout (`backend:controllers/agentController.js:74,78`). The response body of `/api/tags` is not read; only the status code counts (`:75`).
- **Params:** none.
- **Fiscal year / date window:** none.
- **Scope enforcement:** **n/a**. The route is public (`backend:middleware/verifyDirectusToken.js:24`).
- **Data source:** HTTP GET `http://OLLAMA_HOST:OLLAMA_PORT/api/tags` (`backend:controllers/agentController.js:72-79`).
- **Server-side filtering / sort / pagination / limits:** none. There is no caching, so every call hits Ollama.
- **Response:** **always `200`** (`backend:controllers/agentController.js:80`). The status code does not reflect health.

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `ok` | boolean | no | `true` only if `/api/tags` answered with HTTP 200 within 3 s. |
  | `model` | string | no | The configured default model (`OLLAMA_MODEL` or `llama3.2:3b`), not proof that the model is installed. |
  | `host` | string | no | `"<OLLAMA_HOST>:<OLLAMA_PORT>"`. |
- **Errors:** none. Network errors and timeouts resolve to `ok:false` (`backend:controllers/agentController.js:77-78`).
- **Issues:**
  - The endpoint is public and discloses the internal LLM host:port and model name to unauthenticated callers (`backend:controllers/agentController.js:80`, `backend:middleware/verifyDirectusToken.js:24`).
  - It returns 200 when unhealthy, so uptime checkers that look only at the status code will never alert.
  - No legacy frontend caller found (grep: `agent/health` in `legacy:src`).
- **Used by:**
  - No wrapper and no caller: a grep of `legacy:src` for `agent/health` finds nothing.
- **Fixture:** `test/fixtures/dqa-agent.json` → `"GET /agent/health"` (plus `#down`)

---

**Group: `/superset`** (`backend:routes/supersetRoutes.js`, mounted at `backend:index.js:45`)

#### `POST /superset/guest-token`
- **Handler:** `backend:controllers/supersetController.js:49` · **Route:** `backend:routes/supersetRoutes.js:5`
- **Purpose:** Issues a Superset embedded-dashboard guest token. The row-level-security (RLS) rules are derived on the server from the caller's Directus profile.
- **Params:**
  - `dashboardId` (body, required). It is coerced with `String(...)` and trimmed, so a number is accepted if its string form is allowlisted. It must appear in the comma-separated `SUPERSET_DASHBOARD_IDS` env allowlist (`backend:controllers/supersetController.js:64-70`).
  - The legacy `fetchGuestToken(dashboardId, _user)` accepts a user argument but does not send it (`legacy:src/lib/superset.ts:18-35`). Any other body field (user, rls, district) is ignored.
  - There is no `district` or `province` param. Scope comes only from the server-side profile.
- **Fiscal year / date window:** none. Any FY filtering happens inside the Superset dashboard.
- **Scope enforcement:** **userScope enforced**. `getUserProfile(req.user.id, req.accessToken)` loads the caller's Directus `/users/me` profile (`backend:controllers/supersetController.js:72`, `backend:lib/userScope.js:59-79`). `deriveScope(profile, req.user)` then maps the profile to `national` / `province` / `district` / `none` (`backend:controllers/supersetController.js:73`, `backend:lib/userScope.js:18-49`). `buildRls(scope)` turns that into Superset RLS (`backend:controllers/supersetController.js:35-47`):
  - national → `[]`, meaning no RLS and all rows (`:37`)
  - district → `` `${column} = '<district>'` `` (`:41-42`)
  - province → `` `${column} IN ('<d1>', '<d2>', ...)` ``, using the province's district list from `config/geography.js` (`:43`, `backend:lib/userScope.js:39`)
  - `SUPERSET_RLS_DATASET_IDS` set → one rule per dataset `{dataset, clause}`; otherwise one global `{clause}` (`:45-46`)
  - `SUPERSET_RLS_ENABLED=false` → `[]` for **everyone** (`:36`)
  - the column defaults to `district` (`SUPERSET_RLS_DISTRICT_COLUMN`) and is checked against an identifier regex (`:27-33`)

  A `none` scope is refused with 403 (`:74-79`).
- **Data source:** no DB. The handler calls Directus `GET {DIRECTUS_URL}/users/me?fields=id,email,first_name,last_name,description,title,location,role.name` with the caller's token and a 10 s timeout (`backend:lib/userScope.js:66-70`). It then calls Superset `POST /api/v1/security/login` with the service account and a 15 s timeout (`backend:lib/supersetClient.js:31-48`), optionally `GET /api/v1/security/csrf_token/` (`backend:lib/supersetClient.js:55-63`), and `POST /api/v1/security/guest_token/` with body `{user:{username,first_name,last_name}, resources:[{type:"dashboard",id}], rls}` and a 15 s timeout (`backend:lib/supersetClient.js:65-78`). `username` is the profile email, or the user id if there is no email (`backend:controllers/supersetController.js:84`).
- **Server-side filtering / sort / pagination / limits / caching:**
  - The Directus profile is cached in memory per user id for **5 min** (`backend:lib/userScope.js:52-53,60-61,77`). A change to a user's description, title or location takes up to 5 min to affect their RLS. The cache is a process-wide `Map` and expired entries are only overwritten, never swept.
  - The Superset service-account access token is cached process-wide until 60 s before its JWT `exp`, or 10 min if there is no `exp` (`backend:lib/supersetClient.js:20,44-53`). On an upstream 401 the token is cleared and the request is retried once (`backend:lib/supersetClient.js:80-84`).
  - Guest tokens themselves are not cached.
- **Response:** `200 {"status":"success","token":"<guest JWT>"}` (`backend:controllers/supersetController.js:91`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `status` | string | no | `"success"`. |
  | `token` | string | no | The Superset guest token (a JWT), passed to the embedded SDK's `fetchGuestToken` callback (`legacy:src/components/dashboard/EmbeddedDashboard.tsx:36,40-45`). |
- **Errors** (checked in this order; before any of them the middleware can answer `401` for a missing/invalid/expired token or `500 {"status":"error","message":"Server authentication is not configured."}` when `DIRECTUS_SECRET` is unset in enforce mode, `backend:middleware/verifyDirectusToken.js:72-78`):
  1. `503 {"status":"error","message":"Embedded dashboards are not configured."}` when `SUPERSET_URL`, `SUPERSET_EMBED_USERNAME` or `SUPERSET_EMBED_PASSWORD` is missing (`backend:controllers/supersetController.js:51-55`, `backend:lib/supersetClient.js:89-90`).
  2. `401 {"status":"fail","message":"You are not logged in! Please log in to get access."}` when `req.user` or `req.accessToken` is absent. This only happens under `AUTH_MODE=log`; in enforce mode the middleware's 401 fires first (`backend:controllers/supersetController.js:58-62`).
  3. `400 {"status":"fail","message":"Unknown or non-embeddable dashboard."}` when `dashboardId` is missing or not in the allowlist (`backend:controllers/supersetController.js:66-70`).
  4. `403 {"status":"fail","message":"Your account has no data scope assigned. Please contact an administrator."}` when the scope is `none` (`backend:controllers/supersetController.js:74-79`).
  5. `502 {"status":"error","message":"Could not load the dashboard. Please try again."}` on **any** thrown error (`backend:controllers/supersetController.js:92-98`). That includes a Directus profile fetch failure or mismatch (`backend:lib/userScope.js:64,73-75`), Superset login or guest-token failure (`backend:lib/supersetClient.js:43,77`), and an invalid `SUPERSET_RLS_DISTRICT_COLUMN` (`backend:controllers/supersetController.js:30`). The body is generic and nothing leaks; details are logged server-side only (`:93-94`).
- **Issues:**
  - **The scope derivation is heuristic and fails open** (`backend:lib/userScope.js:27-35`). Any profile whose free-text `description` *contains* `"admin"` gets national scope with no RLS. So does any profile with a blank description, a role, `location` = All/empty and `title` = All/empty (asserted as intended in `backend:tests/security.test.js:98`). If Directus lets users edit their own `description`, `title` or `location` on `/users/me`, a user could widen their own Superset scope. That must be verified against the Directus role permissions → Backend ask.
  - Province users whose `title` is not a key of `config/geography.js` get `none` → 403 (`backend:lib/userScope.js:38-42`). Geography in the backend has to be kept in sync with the frontend's program config by hand (`backend:config/geography.js:1-3`).
  - `SUPERSET_RLS_ENABLED=false` (case-insensitive) silently removes RLS for every user (`backend:controllers/supersetController.js:36`).
  - A district user's `location` is not checked against `config/geography.js`; any non-`All` string becomes the RLS value (`backend:lib/userScope.js:24,46`). A misspelt location gives an RLS clause that matches no rows (an empty dashboard, not an error).
  - Non-integer entries in `SUPERSET_RLS_DATASET_IDS` are dropped silently; if all are dropped, one global rule is emitted (`backend:controllers/supersetController.js:45-46`).
  - The RLS clause is built by string interpolation, but values come from the server-side profile and are quote-escaped (`backend:controllers/supersetController.js:25,41-43`, tested at `backend:tests/security.test.js:103`). The column name is regex-validated. Injection risk is low.
  - The 503 "not configured" check runs before the auth check (`backend:controllers/supersetController.js:51` vs `:58`). Under `AUTH_MODE=log` an anonymous caller can find out whether embedding is configured. This is minor.
  - The profile cache keeps entries for up to 5 min after a role or scope downgrade (`backend:lib/userScope.js:52`).
  - The dashboard IDs embedded by the legacy frontend come from `VITE_SUPERSET_DASHBOARD_ID_1..3` (`legacy:src/pages/Charts.tsx:16-26`) and must match the backend allowlist `SUPERSET_DASHBOARD_IDS`. They are not secrets, but they are configuration that must be kept in parity.
- **Used by:**
  - Wrapper: `fetchGuestToken` (`legacy:src/lib/superset.ts:21-42`, `fetch` at `:28`), not in `api.ts`.
  - Callers: `legacy:src/components/dashboard/EmbeddedDashboard.tsx:40-45` (the embed SDK's `fetchGuestToken` callback); EmbeddedDashboard is rendered by `legacy:src/pages/Charts.tsx:94-99` (Charts), re-embedding on every tab switch.
  - Params: body `{ dashboardId }` only. EmbeddedDashboard still passes a user object, which the patched wrapper ignores (`legacy:src/lib/superset.ts:23`); scope is derived on the server.
- **Fixture:** `test/fixtures/dqa-superset.json` → `"POST /superset/guest-token"` (plus `#not-configured`, `#auth-missing-token`, `#auth-expired-token`, `#no-user-log-mode`, `#unknown-dashboard`, `#missing-dashboard-id`, `#no-scope`, `#upstream-failure`)

---

**Group: root** (`backend:index.js`)

#### `GET /`
- **Handler:** `backend:index.js:47` (inline) · **Route:** `backend:index.js:47`
- **Purpose:** Sends the organisation's logo JPEG (the file in `assets/`). It is the de-facto liveness or "landing" response.
- **Params:** none. Query strings are ignored. Because the route is public, a `?token=` value is not checked (`backend:middleware/verifyDirectusToken.js:59`).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **n/a**. The route is public (`backend:middleware/verifyDirectusToken.js:23`).
- **Data source:** a static file. The path is built with `path.join(__dirname, "assets/<logo>.jpeg")` (`backend:index.js:48-51`) and sent with `res.sendFile` (`backend:index.js:52`). No DB.
- **Server-side filtering / sort / pagination / limits:** none. Express `sendFile` sets ETag/Last-Modified. `compression()` (`backend:index.js:18`) runs but does not gzip it, because `image/jpeg` is not a compressible type.
- **Response:** `200` with `Content-Type: image/jpeg` and a binary body (about 7 KB file).
- **Errors:** there is no custom error handler in `index.js`. If the file is missing, `sendFile` passes the error to Express's default handler, which returns an HTML 404/500 page, not JSON.
- **Issues:**
  - The response is branding hardcoded in the backend: an organisation-specific logo filename is baked into `backend:index.js:50`. The new frontend must not use this endpoint for its logo. Logos come from `@/config`.
  - The public allow-list matches `req.method === "GET"` exactly (`backend:middleware/verifyDirectusToken.js:28-29`). A `HEAD /` request is therefore not public and gets 401 in enforce mode. Uptime monitors that use HEAD would see 401.
  - No legacy frontend caller found (grep in `legacy:src` for the logo file name, `logo\.jpe?g` and fetches of the bare backend base URL).
- **Used by:**
  - No caller in `legacy:src`. The login image slider loads same-origin static files, not this route (`legacy:src/components/RightImageSlider.tsx:32-42`).
- **Fixture:** `test/fixtures/dqa-errors.json` → `"GET /"`

#### `ALL *` (404 catch-all)
- **Handler:** `backend:index.js:55` (inline) · **Route:** `backend:index.js:55`
- **Purpose:** Returns a JSON 404 for any method or path that no router matched.
- **Params:** none. The response echoes `req.originalUrl` (`backend:index.js:58`).
- **Fiscal year / date window:** none.
- **Scope enforcement:** **n/a**.
- **Data source:** none.
- **Server-side filtering / sort / pagination / limits:** none.
- **Response:** `404 {"status":"error","message":"Can't find <originalUrl> on this server"}` (`backend:index.js:56-59`).

  | Field | Type (as JSON) | Nullable | Notes |
  | --- | --- | --- | --- |
  | `status` | string | no | Always `"error"`. |
  | `message` | string | no | `` `Can't find ${req.originalUrl} on this server` ``. Includes the query string. |
- **Errors:** n/a.
- **Issues:**
  - The catch-all sits **after** the auth middleware (`backend:index.js:38` vs `:55`). In enforce mode an unauthenticated request to an unknown path gets **401**, not 404. Only authenticated callers (or any caller under `AUTH_MODE=log`) see the 404.
  - `req.originalUrl` includes the query string, so a request such as `GET /typo?token=<jwt>` echoes the caller's own token in the 404 body (`backend:index.js:58`). This is low risk because the token is the caller's own, but it ends up in any proxy or response logging.
  - Paths that miss the slash before a wildcard param (for example `/household/all-households` with no `/:district`) fall through to this 404 (see the `/household` group notes).
  - The status vocabulary is inconsistent: the 404 uses `"error"`, the auth 401 uses `"fail"`.
- **Used by:**
  - No wrapper targets it on purpose. Live calls that land here because no route matches: `legacy:src/pages/Documentation.tsx:77,82` (no-district counts, `legacy:src/lib/api.ts:254-256,265-267`) and `legacy:src/pages/Referrals.tsx:170,176` through `getCaregiverReferralsByDistrict` / `getVcaReferralsByDistrict` (`legacy:src/lib/api.ts:456,461,480,484`); the referral 404s are caught and replaced by the services-list fallback (`legacy:src/lib/api.ts:464,487`).
  - Unused wrappers that would also land here: `getCaseworkerCountByDistrict`, `getHouseholdCountByDistrict`, `getVcaCountByDistrict` (`legacy:src/lib/api.ts:280-299`), `getVcaCasePlansByDistrict` (`:581-585`) and the no-district form of `getCaregiverCasePlansByDistrict` (`:543-549`).
- **Fixture:** `test/fixtures/dqa-errors.json` → `"ALL *"`

---

#### Coverage check

The route list comes from reading `backend:index.js` and every file in `backend:routes/`: `agentRoutes.js`, `childRoutes.js`, `etlRoutes.js`, `householdRoutes.js`, `motherRoutes.js` and `supersetRoutes.js`. Every route below has a #### detail block above. The `app.use` lines at `backend:index.js:18-45` are middleware and router mounts, not endpoints; 3.1 covers them.
- **`backend:routes/householdRoutes.js` (14):**
  - `:6` households-count
  - `:10` all-households
  - `:14` all-households-archived
  - `:18` all-household-members-register
  - `:22` caregiver-services
  - `:26` caregiver-services-by-month
  - `:33` caregiver-services-by-district
  - `:37` caregiver-referrals-by-month
  - `:44` household-services-by-district
  - `:51` hts-register-by-district
  - `:55` caregiver-referrals
  - `:59` caregiver-caseplans
  - `:63` caregiver-caseplan-domains
  - `:67` members
- **`backend:routes/childRoutes.js` (11):**
  - `:6` vcas-count
  - `:10` vcas-assessed-register
  - `:14` vcas-archived-register
  - `:17` vca-profile
  - `:20` vca-services-by-month
  - `:27` vca-services-by-district
  - `:30` vca-services
  - `:33` vca-caseplans
  - `:37` vca-caseplan-domains
  - `:41` vca-referrals
  - `:45` vca-referrals-by-month
- **`backend:routes/motherRoutes.js` (6):**
  - `:5` `/district/:district(*)/filtered`
  - `:6` `/district/:district(*)`
  - `:7` `/total/count`
  - `:8` `/district/count/:district(*)`
  - `:9` `/count/:district(*)`
  - `:10` `/members-count/:district(*)`
- **`backend:routes/etlRoutes.js` (33):**
  - `:7` last-success
  - `:9` POST run
  - `:10` runs
  - `:11` runs/:runId
  - `:12` POST cancel/:runId
  - `:13` pipelines
  - `:14` files/:pipeline
  - `:15` POST send-report
  - `:16` download/:pipeline/:fileName
  - `:19` tablet-sync/stream
  - `:22` POST tablet-sync/notify
  - `:25` tablet-sync
  - `:28` facility-performance
  - `:31` caseworker-journeys
  - `:34` caseworker-list
  - `:35` facility-list
  - `:36` duplicates
  - `:37` dqa-checks
  - `:38` dqa-records
  - `:41` action-queue
  - `:44` services/:type/summary
  - `:47` services/:type/timeseries
  - `:50-53` services/:type/distribution
  - `:56` services/:type/records
  - `:59-62` services/:type/record-detail
  - `:65` services/:type/export
  - `:68` caseworker-performance
  - `:71` service-performance
  - `:74` duplicates/reviews
  - `:75` POST duplicates/review
  - `:76-79` DELETE duplicates/review/:run_key
  - `:82-85` pmtct-child-register/:district(*)
  - `:88-91` pmtct-mother-register/:district(*)
- **`backend:routes/agentRoutes.js` (2):**
  - `:5` POST /chat
  - `:6` GET /health
- **`backend:routes/supersetRoutes.js` (1):**
  - `:5` POST /guest-token
- **`backend:index.js` (2):**
  - `:47` GET /
  - `:55` ALL * (catch-all)

**Result:** 69 registered routes and 69 detail blocks (route lines are relative to each route file). **There are no coverage gaps.** One correction was made while assembling: the PMTCT routes are registered as `:district(*)` (`backend:routes/etlRoutes.js:83,89`), so their detail headings now use that form. The fixture keys still say `:district`. Legacy also calls paths that have no backend route; those are listed under "Dead legacy wrappers" in the `/mother` group and in the `/household` entries. They are not backend gaps.

### 3.3 Directus

Legacy talks to Directus directly from the browser for authentication, user management, notifications,
calendar, flags, files and the activity feed. None of these calls goes through the DQA backend, so §3.2 does not
cover them. No Directus server configuration (roles, policies, permissions, flows) is in either repo. Everything
below comes from client code and from two admin setup scripts in `legacy:scripts/`. **Decision #4** (support chat,
calls and voice notes are not used) means the chat rows below are documented for completeness and are **not to be
ported**.

#### Client and auth

##### Client

- **No SDK.** Every call is a plain `fetch`. The shared helper is `directusRequest(path, options)`
  (`legacy:src/lib/directus.ts:21-57`). No file uses the Directus SDK or axios.
- **Base URL:** env var **`REACT_APP_BASE_URL`**, read by `getDirectusBaseUrl()` (`legacy:src/lib/env.ts:13-14`). It
  is not a `VITE_*` name. It reaches the browser because `envPrefix` is `["VITE_", "REACT_"]`
  (`legacy:vite.config.ts:7`), so **every** `REACT_*` variable is public.
  - `requireDirectusUrl()` throws `"REACT_APP_BASE_URL is not set"`. It is defined twice:
    `legacy:src/lib/directus.ts:5-11` and `legacy:src/context/AuthContext.tsx:44-50`.
  - `directusRequest` strips a trailing slash (`legacy:src/lib/directus.ts:26`). `fetchProfile` and `login` do not
    (`legacy:src/context/AuthContext.tsx:54,114`).
  - `ForgotPassword`, `ResetPassword` and the three flag wrappers in `api.ts` call `getDirectusBaseUrl()` with no
    "not set" check. With the variable empty they post to a relative path on the SPA's own origin
    (`legacy:src/pages/ForgotPassword.tsx:30-32`, `legacy:src/pages/ResetPassword.tsx:41`,
    `legacy:src/lib/api.ts:615,635,1288`).
- **Auth header:** `Authorization: Bearer <token>` (`legacy:src/lib/directus.ts:30-32`). Caller headers are merged in
  (`:34-39`). `Content-Type: application/json` is set unless the body is `FormData` (`:29,41-43`).
- **Errors:** the body is parsed with `safeJson`, which returns `null` on a parse failure (`:13-19`). A non-2xx
  response throws `Error(errors[0].message ?? "Directus request failed")` (`:52-54`). **The HTTP status is
  discarded**, so callers cannot tell 401, 403 and 404 apart. The one exception is `deleteUser`, which matches
  foreign-key error *message strings* (`:359-367`).
- **No timeout, abort signal, retry or de-duplication** in the helper (`:45-48`). The only retry is React Query's
  global `retry: 1` (`legacy:src/App.tsx:131`).
- **Six separate Directus code paths** use different error handling:
  1. `directusRequest` (`legacy:src/lib/directus.ts:21-57`)
  2. raw `fetch` in `AuthContext` for profile and login (`legacy:src/context/AuthContext.tsx:52-69,109-146`)
  3. raw `fetch` in `requestPasswordReset` (`legacy:src/lib/directus.ts:268-286`)
  4. `publicBackendRequest`, which never reads the response (`legacy:src/lib/directus.ts:288-301`)
  5. raw `fetch` in the two auth pages (`legacy:src/pages/ForgotPassword.tsx:32`, `legacy:src/pages/ResetPassword.tsx:41`)
  6. raw `fetch` in the flag wrappers in `api.ts`, which read a DQA-style `message` key that Directus never sends
     (`legacy:src/lib/api.ts:604-652,1283-1305`)
- **Other env names** read by the Directus code:
  - `VITE_DIRECTUS_USER_ROLE` is a role **id**. It is used as a filter by `listUserActivity` and `listPmpUsers`
    (`legacy:src/lib/directus.ts:791,827`). It is also read into a constant at `:3` that is only used inside a
    commented-out block (`:85-94`).
  - `VITE_RESET_PASSWORD_URL` is the origin for reset links. It falls back to `window.location.origin`
    (`legacy:src/pages/ForgotPassword.tsx:28`, `legacy:src/pages/Users.tsx:123-126`, `legacy:src/pages/Profile.tsx:233`,
    `legacy:src/pages/AddUser.tsx:407`). AddUser does not strip a trailing slash.

##### Token

- **Storage key:** `localStorage["ecap.access_token"]` (`legacy:src/lib/auth.ts:1,20,31,40`).
- **In-memory memo:** `getStoredToken()` caches the value in a module variable. `undefined` means "not read yet", and
  a cached `null` is kept too (`legacy:src/lib/auth.ts:7,15-17`). Nothing listens for the `storage` event, so a login
  or logout in another tab is not seen until reload.
- **Only the access token is kept.** `refresh_token` and `expires` from `/auth/login` are thrown away
  (`legacy:src/context/AuthContext.tsx:128`). Nothing in `legacy:src` calls `/auth/refresh` or `/auth/logout`.
- **The same token is the DQA bearer.** The backend verifies it locally with the shared secret (§3.1 item 2).
  Consumers: `legacy:src/lib/api.ts:186,605,631,684,702,754,1090,1104,1284,1438`, `legacy:src/lib/superset.ts:25`,
  `legacy:src/lib/ai-service.ts:15` and `legacy:src/components/EtlInvalidator.tsx:33`. The last three were added by the
  uncommitted security patch.
- **Token in URLs:**
  - `?access_token=<token>` on every Directus asset URL, unencoded (`getFileUrl`, `legacy:src/lib/directus.ts:215-221`).
    These URLs are used for avatars and chat attachments.
  - `?token=` on DQA download, SSE and export URLs (`legacy:src/lib/api.ts:751-766,796-798,1438-1439`).

##### Auth flow

| Step | Behaviour | Evidence |
| --- | --- | --- |
| Bootstrap | If no token is stored, `user = null`. If one is, `fetchProfile(token)` runs (`GET /users/me`). On any error it calls `clearStoredToken()` and leaves the user null. | `legacy:src/context/AuthContext.tsx:87-107` |
| Login | `POST /auth/login {email, password}`. The email is sent as typed: not trimmed or lower-cased. No `mode`, so Directus uses the JSON default. The token is read as `data.data.access_token ?? data.access_token`, stored, then the profile is fetched. On failure it sets the error, clears the token and re-throws. | `legacy:src/context/AuthContext.tsx:109-146` |
| After login | `LoginCard` writes `sessionStorage["ecap.first_login"]`, `localStorage["ecap.known_users"]` (a JSON array of lower-cased **emails**) and `localStorage["ecap.returning_user"]`. It then goes to `/change-password` if `password_change_required`, otherwise to `/dashboard`. | `legacy:src/components/LoginCard.tsx:34-44` |
| Route guard | Renders `null` while loading. No user → redirect to `/`. If `password_change_required` and the path is not `/change-password` → redirect there. **No role or permission check.** Public routes are `/`, `/forgot-password`, `/reset-password` and `/accept-invite`. The admin pages `/users`, `/users/new`, `/users/:id/edit` and `/data-pipeline` are reachable by URL for any logged-in user; the sidebar only hides their links. | `legacy:src/components/auth/ProtectedRoute.tsx:4-21`, `legacy:src/App.tsx:237-243,414,430,438,526`, `legacy:src/components/dashboard/AppSidebar.tsx:153-173` |
| Expiry / refresh | **None.** The expiry is never read and the refresh token is discarded. After the access token expires, every Directus and DQA call throws the server's message. The user stays "logged in" until a reload, when bootstrap fails and clears the token. | `legacy:src/context/AuthContext.tsx:95-101,128`, `legacy:src/lib/directus.ts:52-54` |
| Logout | `clearStoredToken()` and `setUser(null)`. **No network call**, so the session is not revoked. The DQA backend would keep accepting the JWT until it expires anyway, because it verifies tokens locally. Two callers then navigate to `/`. The "Sign out instead" button on the forced-password page relies on `ProtectedRoute` to redirect. | `legacy:src/context/AuthContext.tsx:148-151`, `legacy:src/components/dashboard/AppSidebar.tsx:185-188`, `legacy:src/components/dashboard/DashboardHeader.tsx:521-523`, `legacy:src/pages/ChangePassword.tsx:188-190` |
| Forced password change | `PATCH /users/me {password, password_change_required:false}`, then `refreshProfile()`, then `/dashboard`. The client checks for at least 8 characters and that both entries match. A user without the flag is sent to `/dashboard`. | `legacy:src/pages/ChangePassword.tsx:36-64`, `legacy:src/lib/directus.ts:333-342` |
| Forgot password | Inline `POST /auth/password/request {email (trimmed, lower-cased), reset_url: <VITE_RESET_PASSWORD_URL or origin>/reset-password}`. No auth. In production it always shows the same success toast, even on failure (no account enumeration). In dev it throws `[DEV-ONLY] <message>`. It logs the Directus error body in every build. | `legacy:src/pages/ForgotPassword.tsx:16-65` |
| Reset password | Reads `?token=` from the URL (toast and stop if missing). Checks that the entries match and are at least 8 characters. `POST /auth/password/reset {token, password}`, then navigates to `/` after 3 s. Throws `errors[0].message ?? "Reset failed"`. | `legacy:src/pages/ResetPassword.tsx:15-65` |
| Admin-created account | `getUserByEmail`, then `updateUser` if the user exists, otherwise `createUser`. Both set `status:"active", password_change_required:false`. Then `requestPasswordReset(email, resetUrl)`, so the **reset email doubles as the invite**. `ActivationMode` is fixed to `"invite"`, so the temporary-password branch is dead. An existing email is silently overwritten and set back to `active`. | `legacy:src/pages/AddUser.tsx:30,173,306-338` |
| Other reset triggers | An admin can send a reset from the user list. A user can send one to themselves from Profile. Both use `requestPasswordReset`, which throws the Directus error. | `legacy:src/pages/Users.tsx:121-133`, `legacy:src/pages/Profile.tsx:231-236` |
| Invite accept | `/accept-invite` calls `acceptUserInvite`, which posts to `/directus/users/invite/accept`. That path does not exist (see §3.5 a). The response is never read, so the page **always** shows "Invitation accepted". The native `inviteUser` (`POST /users/invite`) is unused. | `legacy:src/lib/directus.ts:256-266,288-308`, `legacy:src/pages/AcceptInvite.tsx:49-53` |

**What logout does not clear:**
- the React Query cache, in memory and its 24 h IndexedDB copy under `ecap-plus-pmp-react-query`
  (`legacy:src/App.tsx:140-148,214-224`). This copy includes the full user directory, notifications, calendar events,
  flags and activity.
- the auxiliary IndexedDB list cache `ecap_plus_cache_db` (`legacy:src/lib/indexedDbCache.ts:6-8`)
- `ecap.known_users`, `ecap.returning_user` and `ecap.first_login`
- the AI chat history `ecap.chat_history.<userId>` (`legacy:src/components/dashboard/AiAssistant.tsx:118`)
- the token memo in other tabs

None of these React Query keys contains a user id: `["directus","users"]`, `["users-list-chat"]` and
`["flagged-records"]`. The next person on the same browser therefore sees the previous user's data rendered from disk
before the refetch completes.

#### User profile fields

The session profile is `GET /users/me?fields=id,email,first_name,last_name,role.id,role.name,location,avatar,description,title,password_change_required`
(`legacy:src/context/AuthContext.tsx:54`), typed as `AuthUser` (`:12-23`). The user-management wrappers fetch more
fields (`legacy:src/lib/directus.ts:82,104,833`). The meaning of `description`, `title` and `location` is
documented only in comments (`legacy:src/lib/directus.ts:769-770,815-816`). The DQA backend derives Superset scope
from the same fields (§3.1 item 3), but no data endpoint uses them.

| Field | Read / written by | Used for | Evidence |
| --- | --- | --- | --- |
| `id` | session, all user wrappers | identity; filter value for notifications and calendar; PeerJS peer id (chat, not ported) | `legacy:src/context/AuthContext.tsx:54`, `legacy:src/lib/directus.ts:116-131,722-732`, `legacy:src/pages/SupportCenter.tsx:298` |
| `email` | session; listUsers/getUser; written by createUser/updateUser | display; login; AddUser duplicate lookup (exact, case-sensitive); stored in `ecap.known_users` | `legacy:src/lib/directus.ts:228-234,236-254,310-331`, `legacy:src/components/LoginCard.tsx:39-40` |
| `first_name`, `last_name` | session; user wrappers; written by create/update | display; greeting; Superset user (pre-patch) | `legacy:src/components/dashboard/WelcomeBanner.tsx:9`, `legacy:src/components/dashboard/EmbeddedDashboard.tsx:41-45` |
| `role` (`{id,name}` or a string) | session (`role.id,role.name`); written by create/update | **access**: menu visibility; client-side hiding of administrator and legacy-program roles from user lists; flag-notification recipients by role-name substring; display | `legacy:src/components/dashboard/AppSidebar.tsx:150-158`, `legacy:src/pages/Users.tsx:157-175`, `legacy:src/pages/SupportCenter.tsx:77-106`, `legacy:src/lib/directus.ts:638-655`, `legacy:src/pages/Profile.tsx:73` |
| `description` | session; written by create/update | **user level** (access). Exact compares against `"District User"`, `"Provincial User"`, `"Administrator"`, `"Support User"`, plus substring checks for `admin`, `provincial`, `province` and `district`. More than 20 call sites; §4.4 lists them all. | `legacy:src/components/dashboard/AppSidebar.tsx:155-160`, `legacy:src/hooks/useEffectiveDistrict.ts:7-10`, `legacy:src/components/dashboard/MetricsGrid.tsx:124`, `legacy:src/pages/Flags.tsx:37-38`, `legacy:src/pages/HouseholdProfile.tsx:150` |
| `title` | session; written by create/update | **province** (scope) | `legacy:src/components/dashboard/MetricsGrid.tsx:125`, `legacy:src/hooks/useEffectiveDistrict.ts:11`, `legacy:src/pages/Flags.tsx:39` |
| `location` | session; written by create/update | **district** (scope). `"All"` means unrestricted. | `legacy:src/hooks/useEffectiveDistrict.ts:12`, `legacy:src/components/dashboard/DashboardHeader.tsx:90`, `legacy:src/components/dashboard/GlobalSearch.tsx:52`, `legacy:src/pages/Districts.tsx:52` |
| `facility` | listUsers/getUser/listPmpUsers; written by create/update | facility-level users' ward. **Not** in the session profile. May hold a CSV list. | `legacy:src/lib/directus.ts:82,104,769-770,833` |
| `district` | listPmpUsers and the activity feed only | display on the data-pipeline page. May hold a CSV list. | `legacy:src/lib/directus.ts:797,833` |
| `province`, `district` on the session user | read by `useEffectiveDistrict` but **never fetched**: always `undefined`, so the hook falls back to `DEFAULT_DISTRICT` | — | `legacy:src/hooks/useEffectiveDistrict.ts:11-12` |
| `avatar` | session; written by `updateUserAvatar` | Directus file id, rendered through `getFileUrl`. The old file is never deleted. | `legacy:src/components/dashboard/AppSidebar.tsx:306`, `legacy:src/components/dashboard/DashboardHeader.tsx:432,467`, `legacy:src/lib/directus.ts:203-212` |
| `password_change_required` | session; written by create/update and `PATCH /users/me` | forced password change gate | `legacy:src/components/auth/ProtectedRoute.tsx:16`, `legacy:src/components/LoginCard.tsx:42` |
| `password` | written by createUser, updateUser (EditUser) and `PATCH /users/me` | set or change password | `legacy:src/pages/EditUser.tsx:278-293`, `legacy:src/lib/directus.ts:333-342` |
| `status` | listUsers/getUser/listPmpUsers; written by create/update/deleteUser | `active` / `suspended`. Chat presence uses `active`. Suspend and reactivate actions. | `legacy:src/pages/Users.tsx:100,112`, `legacy:src/pages/EditUser.tsx:233`, `legacy:src/lib/directus.ts:462-470` |
| `last_access` | listUsers/getUser/listPmpUsers | display on the user list and the activity tab | `legacy:src/lib/directus.ts:82,833` |

#### Endpoints and collections

All paths are relative to `REACT_APP_BASE_URL`. "Bearer" means through `directusRequest` unless the wrapper column
says otherwise. Line numbers are in `legacy:src/lib/directus.ts` unless a file is named.

| Method | Directus endpoint / collection | Purpose | Fields read / written | Filters / sort / limit | Legacy wrapper (file:line) | Used by |
| --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | Login | writes `{email, password}`; reads `access_token` | — | `login`, raw fetch, `legacy:src/context/AuthContext.tsx:109-146` | `legacy:src/components/LoginCard.tsx:34` |
| GET | `/users/me` (`directus_users`) | Session profile | `id,email,first_name,last_name,role.id,role.name,location,avatar,description,title,password_change_required` | — | `fetchProfile`, raw fetch, `legacy:src/context/AuthContext.tsx:52-69` | bootstrap, `login`, `refreshProfile` (`legacy:src/context/AuthContext.tsx:76-107,134`) |
| GET | `/users/me` | Sender id for chat | `id` | — | `sendChatMessage` `:143-146` | `legacy:src/pages/SupportCenter.tsx:125,315,327` (chat, not ported) |
| PATCH | `/users/me` | Forced or voluntary password change | writes `password`, `password_change_required:false` | — | `updateCurrentUserPassword` `:333-342` | `legacy:src/pages/ChangePassword.tsx:59` |
| POST | `/auth/password/request` | Send reset email; also the onboarding invite | writes `{email, reset_url}` | — | `requestPasswordReset`, raw fetch, no token, `:268-286`; duplicate inline call at `legacy:src/pages/ForgotPassword.tsx:32-38` | `legacy:src/pages/AddUser.tsx:321`, `legacy:src/pages/Profile.tsx:236`, `legacy:src/pages/Users.tsx:126`, `/forgot-password` page |
| POST | `/auth/password/reset` | Set a new password from the emailed token | writes `{token, password}` | — | inline only, `legacy:src/pages/ResetPassword.tsx:41-47` | `/reset-password` page |
| POST | `/directus/users/invite/accept` | Accept invite (**no such route**, §3.5 a) | writes `{token, password}` | — | `acceptUserInvite` via `publicBackendRequest` `:288-308` | `legacy:src/pages/AcceptInvite.tsx:49` |
| POST | `/users/invite` | Native Directus invite | writes `{email, role, invite_url}` | — | `inviteUser` `:256-266` | **unused** |
| GET | `/users` | Full user directory | `id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required` | `limit=-1` (all); optional `filter[status][_eq]`. The role filter is commented out (`:85-94`). | `listUsers` `:79-100` | `legacy:src/pages/Users.tsx:81`; `legacy:src/pages/SupportCenter.tsx:69` (chat, 30 s poll); internally by both flag notifiers `:663,690` |
| GET | `/users` | Look up by email before create | `id,email,first_name,last_name,role` | `filter[email][_eq]` (exact) | `getUserByEmail` `:228-234` | `legacy:src/pages/AddUser.tsx:307` |
| GET | `/users` | PMP users for the activity tab | `id,first_name,last_name,email,title,location,district,facility,description,last_access,status` | `filter[role][_eq]=<VITE_DIRECTUS_USER_ROLE>`, `sort=first_name`, `limit=500` | `listPmpUsers` `:826-840` | `legacy:src/pages/DataPipelinePage.tsx:259` |
| GET | `/users/:id` | Edit form | same as `listUsers` | — | `getUser` `:102-107` (id encoded) | `legacy:src/pages/EditUser.tsx:168` |
| POST | `/users` | Create a user | writes `email, first_name, last_name, role, status, password, password_change_required, description, title, location, facility` | — | `createUser` `:236-254` | `legacy:src/pages/AddUser.tsx:317` |
| PATCH | `/users/:id` | Edit, suspend or reactivate a user | writes any subset of the `createUser` fields | — | `updateUser` `:310-331` (id **not** encoded) | `legacy:src/pages/EditUser.tsx:220,233`, `legacy:src/pages/Users.tsx:100,112`, `legacy:src/pages/AddUser.tsx:315` |
| PATCH | `/users/:id` | Set or clear avatar | writes `avatar` | — | `updateUserAvatar` `:203-212` (not encoded) | `legacy:src/components/chat/ProfilePictureModal.tsx:59,82`, `legacy:src/pages/Profile.tsx:35,54` |
| DELETE | `/users/:id` | Delete a user, with a cascade on FK errors | on an FK error: purge notifications, scrub flag and calendar rows, retry; last resort `PATCH {status:"suspended"}` | — | `deleteUser` `:426-472` | `legacy:src/pages/Users.tsx:136` |
| GET | `/roles` (`directus_roles`) | Role pickers and labels | `id,name` | `limit=100` | `listRoles` `:223-226` | `legacy:src/pages/Users.tsx:86`, `legacy:src/pages/AddUser.tsx:235`, `legacy:src/pages/EditUser.tsx:128` |
| POST | `/files` (`directus_files`) | Upload avatar or chat attachment | multipart field `file`; no folder or title | — | `uploadFile` `:190-200` | `legacy:src/pages/Profile.tsx:34`, `legacy:src/components/chat/ProfilePictureModal.tsx:58`, `legacy:src/pages/SupportCenter.tsx:314,325` (chat) |
| GET | `/assets/:id` | Render avatar or attachment (URL only, no fetch) | — | `?access_token=<token>` | `getFileUrl` `:215-221` | `legacy:src/components/dashboard/AppSidebar.tsx:306`, `legacy:src/components/dashboard/DashboardHeader.tsx:432,467`, `legacy:src/pages/Profile.tsx:74`, `legacy:src/components/chat/CallOverlay.tsx:62`, `legacy:src/pages/SupportCenter.tsx:377,539,597,835` |
| GET | `/notifications` (`directus_notifications`) | Bell inbox | `id,subject,message,timestamp,collection,sender,recipient,item` | `filter[status][_eq]=inbox`, `filter[recipient][_eq]=<me>`, `sort=-timestamp`, `limit=100`. No collection filter, so chat messages also appear in the bell. | `getNotifications` `:486-501` | `legacy:src/components/dashboard/DashboardHeader.tsx:95-96` (30 s poll) |
| GET | `/notifications` | Chat history | `id,status,timestamp,sender,recipient,subject,message,collection,item` | `filter[recipient][_eq]`, `filter[sender][_nnull]`, `filter[collection][_in]=support_chat,support_chat_outbox`, `sort=timestamp` (ascending), `limit=500`, so the **newest** messages are cut off | `getChatMessages` `:116-131` | `legacy:src/pages/SupportCenter.tsx:61` (3 s poll; chat, not ported) |
| POST | `/notifications` | Create a notification: chat inbox and outbox copies, flag raised, flag resolved | writes `recipient, sender?, subject, message?, collection?, item?` | — | `createNotification` `:514-527`, called by `sendChatMessage` `:133-179`, `notifyUsersOfFlag` `:657-682` and `notifyUsersOfFlagResolution` `:684-709` | `legacy:src/pages/FlaggedRecordForm.tsx:75`, `legacy:src/pages/HouseholdProfile.tsx:282,308`, `legacy:src/pages/VcaProfile.tsx:334,364`, `legacy:src/pages/Flags.tsx:175`, `legacy:src/pages/SupportCenter.tsx:125` |
| PATCH | `/notifications/:id` | Mark one read | writes `status:"archived"` | — | `markNotificationRead` `:503-512` | `legacy:src/components/dashboard/DashboardHeader.tsx:198` |
| PATCH | `/notifications` (batch) | Clear all | body `{status:"archived"}` | filters in the **URL** (`recipient`, `status=inbox`). Probably rejected: see §3.5 e. | `clearAllNotifications` `:550-561`; alias `markAllNotificationsReadForUser` `:568` (unused) | `legacy:src/components/dashboard/DashboardHeader.tsx:211` |
| DELETE | `/notifications/:id` | Delete a chat message; purge on user delete | — | purge: `filter[recipient\|sender][_eq]`, `limit=200` | `deleteChatMessage` `:182-187`; `purgeUserNotifications` `:406-424` | `legacy:src/pages/SupportCenter.tsx:352` (chat); `deleteUser` |
| GET | `/activity` (`directus_activity`) | User activity feed | `id,action,collection,timestamp,user.id,user.first_name,user.last_name,user.email,user.district,user.facility,user.location,user.title,user.description` | `filter[user][role][_eq]=<VITE_DIRECTUS_USER_ROLE>`, `filter[collection][_nin]=` five non-PMP collections, `sort=-timestamp`, `limit=500` | `listUserActivity` `:788-808` | `legacy:src/pages/DataPipelinePage.tsx:251` |
| GET | `/items/calendar_events` | My events | `id,title,description,start_time,end_time,category,user_id,status` | `filter[user_id][_eq]=<me>`, `sort=start_time`, **no limit** (Directus default) | `getCalendarEvents` `:722-732` | `legacy:src/pages/Calendar.tsx:108`, `legacy:src/components/dashboard/CalendarWidget.tsx:18`, `legacy:src/hooks/useCalendarNotifications.ts:14` (30 s, every `DashboardLayout` page) |
| POST | `/items/calendar_events` | Create an event | writes `title, description, category, status:"scheduled", start_time, end_time, user_id` (client-supplied) | — | `createCalendarEvent` `:734-740` | `legacy:src/pages/Calendar.tsx:113` |
| PATCH | `/items/calendar_events/:id` | Edit an event | writes the same fields minus `status` | — | `updateCalendarEvent` `:742-751` (not encoded) | `legacy:src/pages/Calendar.tsx:139` |
| DELETE | `/items/calendar_events/:id` | Delete an event | — | — | `deleteCalendarEvent` `:753-757` (not encoded) | `legacy:src/pages/Calendar.tsx:123` |
| GET | `/items/flagged_forms_ecapplus_pmp` | Flag list | `*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name` | **no filter, sort or limit** (Directus default page size) | `getFlaggedRecords`, raw fetch, `legacy:src/lib/api.ts:604-628` | `legacy:src/pages/Flags.tsx:44`, `legacy:src/pages/HouseholdProfile.tsx:214`, `legacy:src/pages/VcaProfile.tsx:259`; unmounted `legacy:src/components/dashboard/RecentActivity.tsx:100` |
| POST | `/items/flagged_forms_ecapplus_pmp` | Raise a flag | writes `household_id, vca_id, caseworker_phone, caseworker_name, caregiver_name, facility, comment, verifier, status:"pending"`; the profile pages add `category, severity` | — | `createFlaggedRecord`, raw fetch, `payload: any`, `legacy:src/lib/api.ts:630-652` | `legacy:src/pages/FlaggedRecordForm.tsx:69`, `legacy:src/pages/HouseholdProfile.tsx:276`, `legacy:src/pages/VcaProfile.tsx:358` |
| PATCH | `/items/flagged_forms_ecapplus_pmp/:id` | Resolve a flag | writes `status:"resolved"` | — | `updateFlagStatus`, raw fetch, `legacy:src/lib/api.ts:1283-1305` (not encoded) | `legacy:src/pages/Flags.tsx:173`, `legacy:src/pages/HouseholdProfile.tsx:302`, `legacy:src/pages/VcaProfile.tsx:328` |
| GET | `/items/flagged_forms_ecapii` | Flag counts per facility (activity tab) | `id,facility` | `limit=1000` | `listFlaggedFormFacilities` `:861-869` | `legacy:src/pages/DataPipelinePage.tsx:267` |
| GET, DELETE, PATCH | `/items/{flagged_forms_ecapplus_pmp, flagged_forms_ecapii, calendar_events}` | Remove a deleted user's references | reads `id`; deletes the row, or falls back to `PATCH {<field>: null}` | `filter[<field>][_eq]=<userId>`, `limit=200` per field | `scrubUserReferences` `:371-404` | `deleteUser` only |
| POST | `/items/weekly_extracts` | Fire the weekly-extract flow | writes `{}` | — | `triggerWeeklyFlow` `:575-594` | **unused** |
| POST | `/mail` | Send email (**not a core Directus endpoint**) | writes `{to, subject, text?, html?}` | — | `sendMail` `:532-543` | **unused** (only `notifyAllUsers`, itself unused) |

##### Per-collection details

- **`directus_users`.** These fields are custom: `description`, `title`, `location`, `facility` and `district` (the
  scope fields above), plus `password_change_required`. The app creates, updates, suspends, reactivates and deletes
  users from the browser.
  - **The whole directory is downloaded.** `listUsers` uses `limit=-1` and includes `email`, `location`,
    `last_access` and `password_change_required`. Administrator and legacy-program roles are hidden **only in the
    browser** (`legacy:src/pages/Users.tsx:162-178`, `legacy:src/pages/SupportCenter.tsx:67-106`).
  - **AddUser overwrites existing accounts.** An existing email is overwritten and reactivated without a warning
    (`legacy:src/pages/AddUser.tsx:307-318`).
  - **`deleteUser` deletes domain data from the browser.** When the delete hits a foreign-key error, it deletes
    flagged-form rows in which the user is `caseworker`, `flagged_by`, `created_by` or `user_created`, and calendar
    rows in which the user is `user_id`, `user_created` or `created_by` (`:437-454`). Every error is swallowed, and
    only 200 rows per field are handled (`:379,410`).
- **`directus_roles`.** Only `id` and `name` are read. Role ids are submitted as `role` on create and update.
- **`directus_files` / `/assets`.** Upload has no folder, title or type restriction (`:190-200`). Replaced avatars
  stay as orphan files.
- **`directus_notifications`** is used both as the in-app inbox **and** as chat storage. Fields: `id, status
  (inbox|archived), timestamp, sender, recipient, subject, message, collection, item` (`:474-484`).
  - `collection` holds logical tags, not real collection names: `support_chat`, `support_chat_outbox`,
    `weekly_extracts`, `flagged_forms_ecapplus_pmp`, or none for announcements.
  - For chat, `subject` holds the priority. `item` holds a file id on the inbox copy and the partner's user id on
    the outbox copy (`:156-172`).
  - Flag notifications go to active users whose **role name** contains admin, administrator, supervisor, qa, data
    quality or manager (`:638-655`). The browser sends one POST per recipient and swallows failures with
    `allSettled`.
  - The bell links a `weekly_extracts` notification to `/data-pipeline` and a `support*` notification to
    `/support?userId=<sender>`. Everything else, including flag notifications, has no link
    (`legacy:src/components/dashboard/DashboardHeader.tsx:112-134`).
- **`directus_activity`.** Read-only, filtered through the `user.role` relation. Normally this needs admin-level
  read access (see Server-side permissions).
- **`calendar_events`** is created by `legacy:scripts/setup-calendar-collection.mjs:58-134`. The primary key is the
  Directus default auto-increment integer, although the TS type says `id: string`
  (`legacy:src/lib/directus.ts:712`).

  | Field | Type | Interface / notes |
  | --- | --- | --- |
  | `title` | string | input, required |
  | `description` | text | textarea |
  | `start_time` | timestamp | datetime |
  | `end_time` | timestamp | datetime |
  | `category` | string | select: `Meeting`, `Field Visit`, `Deadline`, `Personal` |
  | `user_id` | uuid | m2o interface to `directus_users` only. There is **no `/relations` call**, so there is no real FK. |
  | `status` | string, default `scheduled` | select: `scheduled`, `cancelled`, `completed` |

  The script's permissions are read, update and delete limited to `user_id = $CURRENT_USER`. **Create has no
  preset or validation**, so a user can create events owned by someone else. The permissions are posted per role,
  which Directus 11 rejects because it attaches permissions to policies. The responses are never checked, and a
  re-run adds duplicates (`legacy:scripts/setup-calendar-collection.mjs:139-194`). `deleteUser` also scrubs
  `user_created` and `created_by`, which the script never creates.
- **`flagged_forms_ecapplus_pmp`.** No script creates it. The fields written by the app are listed in the table
  above. Read-side field guessing is in §3.5 f.
  - **No geography is written.** No create call sends `district` or `province`, yet the Flags page scopes
    district and provincial users by `r.district` / `r.province` (`legacy:src/pages/Flags.tsx:53-63`).
  - **Placeholder strings differ.** `FlaggedRecordForm` defaults missing values to `"Not Available"`, the profile
    pages to `"N/A"` (`legacy:src/pages/FlaggedRecordForm.tsx:50-57,94-104`, `legacy:src/pages/HouseholdProfile.tsx:335-347`,
    `legacy:src/pages/VcaProfile.tsx:387-399`).
- **`flagged_forms_ecapii`** belongs to another program. Legacy reads only `id` and `facility`, so the activity tab
  counts flags from a **different collection** than the flag pages write to (`:861-869` vs
  `legacy:src/lib/api.ts:615,634,1288`).
- **`weekly_extracts` and the "Weekly Extract Notifications" flow** are created by
  `legacy:scripts/setup-weekly-extract-flow.mjs`. The collection gets meta only and has no `schema` key (`:150-157`).
  It has one hidden field, `triggered_at`. The flow has two operations: an exec script `notify_team`, which notifies
  active users on a **hardcoded 3-address distribution list**, then a mail operation `send_weekly_email` with
  hardcoded brand HTML (`:32-36,214-314`).
  - **No schedule.** The comments claim every Monday at 08:00, but no schedule trigger is configured.
  - **The trigger shape is wrong.** `trigger:"action"` is not Directus's event-trigger shape, so the flow probably
    never fires.
  - **Any user can trigger it.** Every non-admin role gets `create` on the collection.
  - **Not idempotent.** Each run creates another flow.

  The app's trigger (`triggerWeeklyFlow`) is unused. None of this may be carried over: the scripts need Directus
  admin credentials (`DIRECTUS_EMAIL`, `DIRECTUS_PASSWORD`, `legacy:scripts/setup-calendar-collection.mjs:15-17`) in
  the frontend repo's env file, which breaks hard rule 5. Such scripts belong in an ops repo.

#### Server-side permissions

**Unverifiable.** Neither repo contains Directus roles, policies, permissions or flow configuration. The only
permission writes in the repos are the two setup scripts above, and their effect on the live instance cannot be
confirmed. The frontend assumes that the operations below succeed for a **non-admin** user. A developer with
Directus admin access must check each one before the matching feature is ported. Record any gap in PROGRESS.md under
"Backend asks".

| # | Operation the frontend performs | Who triggers it in legacy | Assumption to check in Directus |
| --- | --- | --- | --- |
| 1 | `GET /users?limit=-1` with email, location, `last_access`, `password_change_required` | **every role that raises or resolves a flag** (`legacy:src/lib/directus.ts:663,690`), plus chat users | Can non-admins read **all** users and those fields? If not, flag resolution reports failure after the status already changed (`legacy:src/pages/Flags.tsx:172-176`). If yes, the full directory is exposed to everyone. |
| 2 | `POST /users`, `PATCH /users/:id` (role, status, password, `description`, `title`, `location`, `facility`), `DELETE /users/:id` | admin UI. **No route guard**: any logged-in user can open `/users/new` and `/users/:id/edit` by URL (`legacy:src/App.tsx:430,438`). | Restricted to administrators? Can a role other than admin create a user with an admin role? |
| 3 | `PATCH /users/me` | every user (password change) | Is the self-update field allowlist limited to `password` (and `password_change_required`, `avatar`)? If `description`, `title` or `location` are writable, a user can **widen their own scope**: the Superset RLS heuristic fails open on these fields (§3.2 `POST /superset/guest-token`). |
| 4 | `PATCH /users/:id {avatar}` with an arbitrary id | every user | Can a user update another user's avatar? The wrapper accepts any id (`legacy:src/lib/directus.ts:203-212`). |
| 5 | `GET /roles` | admin pages | Readable by the roles that open those pages? |
| 6 | `POST /notifications` with any `recipient` and a client-chosen `sender` | flags and chat | Is `sender` preset to `$CURRENT_USER`? Without that, notifications can be spoofed (`legacy:src/lib/directus.ts:153-160`). Can any user notify any user? |
| 7 | `GET`/`PATCH`/`DELETE /notifications` | every user | Limited to `recipient = $CURRENT_USER`? The batch `PATCH` (`:550-561`) must not touch other users' rows. |
| 8 | `GET /activity` filtered by role | data-pipeline page (any logged-in user by URL) | Readable by non-admins at all? It exposes other users' emails. |
| 9 | `GET`/`POST`/`PATCH /items/flagged_forms_ecapplus_pmp` with no filter | every user | Read all flags nationally? Is create limited (no preset for `flagged_by`)? Can anyone resolve any flag? |
| 10 | `GET /items/flagged_forms_ecapii` | data-pipeline page | Should PMP users read another program's collection? |
| 11 | `DELETE` / `PATCH` on `flagged_forms_*`, `calendar_events` and `notifications` rows owned by **another** user | `deleteUser` cascade (admin UI) | Should audit data ever be deleted from the browser? This needs a server-side "archive user" operation instead (Backend ask). |
| 12 | `calendar_events` CRUD | every user | Is create restricted to `user_id = $CURRENT_USER`? The script leaves create open. |
| 13 | `POST /items/weekly_extracts` | nobody in the app (unused) | The script grants create to every non-admin role, so any user can trigger the mail flow. Revoke it. |
| 14 | `POST /files` and `GET /assets/:id` | every user | Upload limits and allowed types? Are assets readable by all authenticated users (the token is in the URL)? |
| 15 | `POST /auth/password/request` with any `reset_url` | public | Is `PASSWORD_RESET_URL_ALLOW_LIST` set? Otherwise the reset link host is attacker-controlled. |

### 3.4 External services

The working tree carries an uncommitted security patch. It touches four legacy files: `src/lib/api.ts`,
`src/lib/superset.ts`, `src/lib/ai-service.ts` and `src/components/EtlInvalidator.tsx` (`git diff --stat`). Two of
them matter for this section. None of the external calls below uses a timeout, an `AbortController` or a retry
(`legacy:src/lib/superset.ts:28`, `legacy:src/lib/ai-service.ts:97,154`), and none handles a 401.

#### Superset (embedded dashboards)

- **Env var names.**
  - Frontend: `VITE_SUPERSET_DOMAIN`, the embed SDK's `supersetDomain` (`legacy:src/lib/superset.ts:12`,
    `legacy:src/components/dashboard/EmbeddedDashboard.tsx:36-53`).
  - Frontend: `VITE_SUPERSET_DASHBOARD_ID_1`, `_2` and `_3` (`legacy:src/pages/Charts.tsx:16,21,26`). A tab whose
    variable is unset is dropped (`:28`).
  - Backend: `SUPERSET_DASHBOARD_IDS`, the allowlist. It must contain the same IDs as the frontend variables; nothing
    enforces this (`backend:.env.example:38-39`). The other backend Superset variables are in §3.2
    `POST /superset/guest-token`.
- **Old flow (pre-patch, from `git diff -- src/lib/superset.ts`).**
  - The **browser** logged in to Superset itself: `POST {VITE_SUPERSET_DOMAIN}/api/v1/security/login` with
    `VITE_SUPERSET_USERNAME` / `VITE_SUPERSET_PASSWORD`, `provider:"db"`, `refresh:true`.
  - It then called `POST /api/v1/security/guest_token/` with `{user, resources:[{type:"dashboard", id}], rls}`.
  - `rls` defaulted to `[]` and no caller passed it, so **no row-level security applied to anyone**: every viewer
    saw national data.
  - The service-account password was shipped in the bundle. **Any bundle built before the patch leaks it, so it
    must be rotated** (Backend ask).
  - Login was repeated on every guest-token request.
- **Patched flow.** `fetchGuestToken(dashboardId, _user?)` sends one `POST {REACT_PUBLIC_API_URL}/superset/guest-token`
  with `Authorization: Bearer <Directus token>` and body `{dashboardId}`. It throws `"Not authenticated."` when there
  is no token (`legacy:src/lib/superset.ts:21-42`).
  - The `_user` argument is ignored, but `EmbeddedDashboard` still builds and passes a user object
    (`legacy:src/components/dashboard/EmbeddedDashboard.tsx:41-45`).
  - The backend logs in to Superset, derives RLS from the caller's Directus profile and returns
    `{status, token}`. That contract and its fail-open scope heuristic are documented in §3.2
    `POST /superset/guest-token`.
  - Errors read `data.message`, which matches the backend `{status,message}` envelope
    (`legacy:src/lib/superset.ts:37-41`).
  - There is no base-URL fallback. With `REACT_PUBLIC_API_URL` empty, the request goes to a relative path and fails.
- **Dashboards and mounting.**
  - `/charts` has three tabs with brand-text labels (`legacy:src/pages/Charts.tsx:13-28`). Only the active tab's
    dashboard is mounted (`key={activeDashboard.key}`, `:94-99`), so **every tab switch re-embeds and requests a new
    guest token**.
  - The route has no permission or feature flag, only `ProtectedRoute` (`legacy:src/App.tsx:405-411`).
  - The empty-state copy tells end users to edit env vars (`legacy:src/pages/Charts.tsx:107-110`).
- **Embed options:** `dashboardUiConfig {hideTitle:true, hideChartControls:false, hideTab:false, filters:{expanded:false}}`
  (`legacy:src/components/dashboard/EmbeddedDashboard.tsx:36-53`). Errors show a message and a Retry button (`:56-62,118-133`).
  - The SDK's `unmount` handle is never called (`:36`).
  - `user` is a `useCallback` dependency (`:63`), so a change of `user` object identity reloads the iframe.
- **Token refresh.** No guest token is cached on the client or the backend. Refresh before expiry is left to
  `@superset-ui/embedded-sdk ^0.3.0` (`legacy:package.json:47`), which calls the `fetchGuestToken` callback.
  `node_modules` is not installed, so this was not verified.
- **Dev proxy** `/superset-api` → a hardcoded localhost port (`legacy:vite.config.ts:14-21`) is **unused**: nothing
  in `legacy:src` references it. It is a leftover of the old flow. Drop it.

#### AI assistant

- **Contract.** `POST {AGENT_BASE_URL}/agent/chat` with an OpenAI-style body. The backend handler is §3.2
  `POST /agent/chat`.
  - **Chat turn** (`getAiResponse`, `legacy:src/lib/ai-service.ts:84-121`). Body:
    `{messages:[system SYSTEM_PROMPT, system page-context, ...history], temperature:0.7, max_tokens:1024}`. The
    backend silently caps `max_tokens` to 600.
  - **Greeting** (`getAiGreeting`, `:127-173`). Body:
    `{messages:[system greeting prompt, user context], max_tokens:220, temperature:0.6}`.
  - No `model` and no `stream` field are sent. The backend forces `stream:false`, so responses are **not streamed**.
  - The response is read as `choices[0].message.content` only, with no schema (`:116,172`).
- **Base URL:** `AGENT_BASE_URL = getBackendBaseUrl() || <hardcoded production DQA host>`
  (`legacy:src/lib/ai-service.ts:10-12`). The patch did not remove the fallback. It is inconsistent with every other
  DQA call, which has no fallback.
- **Auth.** The patch added `agentHeaders()`: `Authorization: Bearer <token>` only when a token exists
  (`legacy:src/lib/ai-service.ts:14-20,99,156`). Before the patch no auth was sent, so the assistant worked only with
  backend `AUTH_MODE=log`.
- **Errors.**
  - `getAiResponse` reads `error.message`, which matches the agent's `{error:{message}}` envelope but not the
    middleware's 401 `{status,message}` (`:107-113`). It logs to the console and re-throws.
  - `getAiGreeting` throws a fixed string (`:170`).
  - The UI shows one fixed "connection issue" text and **stores it in the history** (`legacy:src/components/dashboard/AiAssistant.tsx:107-112`).
- **Prompt location (do not port the text):**
  - chat system prompt: `legacy:src/lib/ai-service.ts:27-82`
  - page-context message: `:85-88`
  - greeting prompt: `:140-152`
  - fallback greetings: `:172` and `legacy:src/components/dashboard/AiAssistant.tsx:187,191,195`
  - suggestion chips: `legacy:src/components/dashboard/AiAssistant.tsx:29-34`

  All of these hardcode branding, country and sub-population terms, so the rebuild must build them from `@/config`.
  Because the client always sends a system message, the backend's default prompt is never used (§3.2).
- **Context sent.** `currentPage` comes from `document.title` (`legacy:src/components/dashboard/AiAssistant.tsx:78`).
  Nothing ever sets the title, so it is always the static `<title>` from `legacy:index.html:16`, and the page-context
  message is useless. The greeting sends first name, role name, the away duration and `location.pathname` (`:157-189`).
- **History and storage.**
  - The full history is resent on every turn, unbounded (`:79`). Past the backend's 100 kB body limit it gets an
    HTML 413, which the client cannot parse.
  - Stored keys: `localStorage["ecap.chat_history.<userId|guest>"]`, `["ai_assistant_open"]` and
    `["bumi.snapshot.<id>"]` (`:37-42,118,125-142,157-179`). The history survives logout.
  - `AiAssistant` is rendered by each page's `DashboardLayout`, so it remounts on every route change
    (`legacy:src/components/dashboard/DashboardLayout.tsx:23,52`). With the panel open, each remount fires a new
    greeting call that **overwrites the stored history** (`legacy:src/components/dashboard/AiAssistant.tsx:125-156,190-196`).
    This was found by reading the code, not reproduced.
- **Model-driven UI command.** A `json` block with `action:"change_color"` and an allowlisted `target` calls
  `updateColor(target, value)`. `value` is not validated (`:51-53,83-101`).
- **Not called:** `GET /agent/health` (no hit in `legacy:src`).

#### PeerJS / WebRTC (calls, screen share)

- **Not used: decision #4** (PROGRESS.md) drops support chat, calls and voice notes. Do not port. This entry records
  what legacy does so the removal is deliberate.
- `new Peer(userId, {debug: 2})` sets no host, port, path, key or `iceServers` (`legacy:src/hooks/useWebRTC.ts:34-39`).
  The library defaults apply: the **public PeerJS cloud signalling broker** and the library's default STUN/TURN list
  (`peerjs ^1.5.5`, `legacy:package.json:68`; not verified because `node_modules` is absent). The backend has no
  PeerServer and no TURN configuration (grep `peerjs|ExpressPeerServer|stun:|turn:` finds nothing).
- **The peer ID is the Directus user id** and there is no auth (`legacy:src/hooks/useWebRTC.ts:37`,
  `legacy:src/pages/SupportCenter.tsx:298`). Anyone who knows a user id can register that peer ID first or ring that
  user. Call metadata goes through a third-party service. Peer IDs are logged to the console (`:38,42,46`).
- **Media.** `startCall` uses `getUserMedia({video: type==="video", audio:true})` (`:79-116`). `acceptCall` always
  requests video, even for audio calls (`:118-138`). Screen share swaps the track with `replaceTrack` (`:144-210`).
- **Bugs** (relevant only if the feature ever returns):
  - Camera and microphone stay on after a remote hang-up, because the close and error handlers capture a stale
    `cleanup` (`:17-31,57-65,102-110`).
  - `stopScreenShare` never stops the screen track (`:191-203`).
- The call overlay avatar uses `getFileUrl`, so the Directus token goes in the URL
  (`legacy:src/components/chat/CallOverlay.tsx:62`).

#### Map tile providers

`TILE_LAYERS` is hardcoded, with no env var (`legacy:src/pages/CaseworkerJourneys.tsx:50-72`). It is used only by the
caseworker-journeys map (`:837-845,862-867`).

| Layer | Provider | Zoom | Attribution in code | Evidence |
| --- | --- | --- | --- | --- |
| "map" (default, `:205`) | CARTO Voyager raster basemap (OSM data) | `maxNativeZoom 19`, `maxZoom 20` | OpenStreetMap contributors and CARTO, with links | `legacy:src/pages/CaseworkerJourneys.tsx:51-59` |
| "satellite" | Esri World Imagery | `maxNativeZoom 17`, `maxZoom 20` | Esri plus imagery sources (text only) | `legacy:src/pages/CaseworkerJourneys.tsx:60-71` |

- Both are anonymous third-party requests. They leak user IPs and referrers and fail offline.
- The providers' terms of use are not recorded in the repo. Check them before production use, especially Esri
  imagery.
- The default map centre and zoom hardcode the country (`legacy:src/pages/CaseworkerJourneys.tsx:38-39`).
- Tile URLs, attribution and the default view must come from `@/config`.

#### Fonts and CDNs

- **Google Fonts:** preconnects plus a stylesheet for Inter 400/500/600/700 with `display=swap`
  (`legacy:index.html:29-31`). It is requested on every page and is a third-party dependency. The family is named in
  `legacy:tailwind.config.ts:66-68`. No CSS file in `legacy:src` has `@import`, `@font-face` or an absolute URL.
- **No other CDN.** There is no `unpkg`, `jsdelivr` or `cdnjs`, no direct `WebSocket`/`wss:` and no socket.io in
  `legacy:src` (grep). PeerJS opens its own socket internally. The only `EventSource` is the DQA SSE stream
  (`legacy:src/pages/DataPipelinePage.tsx:295`).

#### External images

- **The login-side slider** (`legacy:src/components/RightImageSlider.tsx:32-42`) references same-origin files
  `/pic-1.jpg`, `/pic-3.jpg`, `/pic-4.jpg` and two `/pexels-<photographer>-<id>.jpg` files, rotating every 7 s
  (`:15,23-25`). It is used on the login, forgot, change, reset and accept-invite pages (`legacy:src/pages/Index.tsx:22-27`,
  `legacy:src/pages/ForgotPassword.tsx:119-124`, `legacy:src/pages/ChangePassword.tsx:199-202`,
  `legacy:src/pages/ResetPassword.tsx:144-147`, `legacy:src/pages/AcceptInvite.tsx:155-180`).
  - **None of these files is in `legacy:public/`**. It contains only `assets/no-results-document.png`, a logo,
    `favicon.ico`, `placeholder.svg` and `robots.txt` (`git ls-files public`). Unless the files are supplied at
    deploy time, they 404.
- **Licence and attribution.** The credit link (`legacy:src/components/RightImageSlider.tsx:44-52`) is hardcoded to
  **one** stock photo whatever image is shown. `AcceptInvite` passes per-image `credit` objects that the component
  type does not declare, so they are never rendered (`legacy:src/pages/AcceptInvite.tsx:160-179` vs
  `legacy:src/components/RightImageSlider.tsx:4-7`).
  - The repo records no licence for the `pic-*` images.
  - **Rebuild rule:** login imagery and credits come from `@/config` (site config), with a recorded licence per
    image. Do not copy the legacy photographer and credit strings.

#### Hardcoded hosts

Hostnames are not written here. Each one must move to env or `@/config`.

| Where | What | Notes |
| --- | --- | --- |
| `legacy:src/lib/ai-service.ts:12` | hardcoded production DQA host | Fallback for `AGENT_BASE_URL`. Live code; the patch kept it. |
| `legacy:index.html:11-14` | hardcoded production DQA host and production Directus host | `preconnect` + `dns-prefetch`. Brand strings in meta tags at `:16-21`. |
| `legacy:index.html:29-31` | Google Fonts hosts | Fonts, see above |
| `legacy:vite.config.ts:22,27` | hardcoded production and staging PMP hostnames | `allowedHosts` for dev and preview |
| `legacy:vite.config.ts:17` | localhost Superset proxy target | Unused proxy |
| `legacy:src/pages/CaseworkerJourneys.tsx:54,56,63` | CARTO and Esri tile hosts; OSM and CARTO attribution links | Map tiles, see above |
| `legacy:src/components/RightImageSlider.tsx:45`, `legacy:src/pages/AcceptInvite.tsx:162,170,178` | stock-photo site links | Credits, see above |
| `legacy:scripts/setup-weekly-extract-flow.mjs:32-36,243-253` | hardcoded email distribution list and company strings | Admin script, §3.3 |
| `legacy:src/components/chat/CallOverlay.tsx:181` | SVG `xmlns` namespace | Not a request; ignore |

This is the complete absolute-URL inventory of `legacy:src` (grep `https?://`). Backend hardcoded hosts and
addresses are covered in §3.1 and §3.2.

### 3.5 Mismatches and duplicates

The "no trailing segment → 404" verdicts below follow from Express 4 path matching. A route
`/x/:district(*)` needs the slash, so `/x` falls through to the `ALL *` catch-all, while `/x/` matches with an empty
param (§3.2 `/household` group notes). This comes from reading the routing rules; nothing was executed.

#### a. Frontend calls with no backend route

| # | Wrapper (file:line) | URL built | Why it fails | What happens at runtime | Live? |
| --- | --- | --- | --- | --- | --- |
| 1 | `getTotalHouseholdsCount()` with no district, `legacy:src/lib/api.ts:261-270` | `GET /household/households-count` | No `/:district(*)` segment (`backend:routes/householdRoutes.js:6`) | `404 "Can't find … on this server"` (`backend:index.js:55-60`). `dqaGet` throws, and the stat fails on the Documentation page (`legacy:src/pages/Documentation.tsx:77`). Fix: send `/All`. | **yes** (`/documentation`) |
| 2 | `getTotalVcasCount()` with no district, `legacy:src/lib/api.ts:253-259` | `GET /child/vcas-count` | Same (`backend:routes/childRoutes.js:6`) | Same; `legacy:src/pages/Documentation.tsx:82` | **yes** |
| 3 | `getCaregiverReferralsByDistrict(d?)`, `legacy:src/lib/api.ts:451-474` | `GET /household/district/caregiver-referrals[/<d>]` | No such route in any form | 404, caught (`:464`). It falls back to `getCaregiverServicesByDistrict(district)` and keeps rows whose `service \|\| form_name \|\| type` contains "referral" (`:466-472`). **The Referrals page never shows real referral rows** from `all_referrals`. With "All Districts" it passes `undefined`, so the fallback requests `/…-by-district/undefined`, gets `[]` and **stores it under the national `:ALL` IndexedDB key**. The caregiver and VCA risk registers and the caseworker profile can then show an empty national list for up to 5 min (`:411-415`). | **yes** (`legacy:src/pages/Referrals.tsx:170`) |
| 4 | `getVcaReferralsByDistrict(d?)`, `legacy:src/lib/api.ts:476-497` | `GET /child/district/vcareferrals[/<d>]` | No such route | Same fallback to `getVcaServicesByDistrict` (`:487-495`) and the same cache poisoning (`:500-504`) | **yes** (`legacy:src/pages/Referrals.tsx:176`) |
| 5 | `acceptUserInvite`, `legacy:src/lib/directus.ts:303-308` | `POST {REACT_APP_BASE_URL}/directus/users/invite/accept` | Directus serves `/users/invite/accept` with no `/directus` prefix. There is no DQA route either (`backend:index.js:40-45`), and no dev proxy rewrites it (`legacy:vite.config.ts:14-21`). | Expected 404 (inferred; the live server was not called). `publicBackendRequest` never reads the response, so the page **always shows "Invitation accepted"** and no password is set (`legacy:src/pages/AcceptInvite.tsx:49-53`). | **yes** (`/accept-invite`, old invite links only) |
| 6 | `getCaregiverCasePlansByDistrict("")`, `legacy:src/lib/api.ts:543-549` | `GET /household/caregiver-caseplans` | No id segment | 404 → throws. With a district it hits the **by-household-ID** route with a district name and gets `[]` (`backend:controllers/householdController.js:474-480`). | no (import only, `legacy:src/pages/HouseholdProfile.tsx:11`) |
| 7 | `getVcaCasePlansByDistrict`, `legacy:src/lib/api.ts:581-585` | `GET /child/vca-caseplans` (argument ignored) | No id segment | 404 → throws | no |
| 8 | `getCaseworkerCountByDistrict`, `legacy:src/lib/api.ts:280-285` | `GET /child/caseworker/count/<d>` | No such route | 404 → throws | no |
| 9 | `getHouseholdCountByDistrict`, `legacy:src/lib/api.ts:287-292` | `GET /household/district/count/<d>` | No such route | 404 → throws | no |
| 10 | `getVcaCountByDistrict`, `legacy:src/lib/api.ts:294-299` | `GET /child/district/count/<d>` | No such route | 404 → throws | no |
| 11 | `sendMail`, `legacy:src/lib/directus.ts:532-543` | `POST {REACT_APP_BASE_URL}/mail` | Not a core Directus endpoint. No custom extension is visible (unverifiable). | Expected 404 → throws | no (only from the unused `notifyAllUsers`) |

Related cases, not counted above:
- The training log has no API. The comment names a future `dqaGet("/training/log")` that does not exist
  (`legacy:src/constants/api.ts:13-29`). It stays as labelled demo data (hard rule 2).
- The `/superset-api` dev proxy points at nothing in use (§3.4).
- `clearAllNotifications` targets a real route with a probably invalid body (see e).

#### b. Backend endpoints with no legacy caller

These are the 20 endpoints from §3.2. They are kept here so the rebuild knows which contracts no screen exercises
today.

| Reason | Endpoints (route file:line) |
| --- | --- |
| No wrapper at all (7) | `GET /household/all-household-members-register` (`backend:routes/householdRoutes.js:18`); `GET /mother/count/:district(*)` (`backend:routes/motherRoutes.js:9`); `POST /etl/tablet-sync/notify` (`backend:routes/etlRoutes.js:22`, called by Mage, not the app); `GET /etl/dqa-checks` (`:37`); `GET /etl/dqa-records` (`:38`); `GET /agent/health` (`backend:routes/agentRoutes.js:6`); `GET /` (`backend:index.js:47`) |
| Route shapes legacy never requests (2) | `GET /mother/district/:district(*)` without `/filtered` (`backend:routes/motherRoutes.js:6`); `GET /mother/district/count/:district(*)`, which is shadowed by the previous route and unreachable (`:8`) |
| Wrapper never imported (3) | `GET /child/vca-profile/:unique_id(*)` → `getVcaProfileById` (`backend:routes/childRoutes.js:17`; the handler is broken, §3.2); `POST /etl/run` → `triggerEtlPipeline` (`backend:routes/etlRoutes.js:9`); `POST /etl/cancel/:runId` → `cancelEtlRun` (`:12`) |
| Called only from unmounted components (7) | The four `*-by-month` routes (`backend:routes/householdRoutes.js:26,37`, `backend:routes/childRoutes.js:20,45`), whose only caller is `DataQualityChart` (`legacy:src/components/dashboard/DataQualityChart.tsx:59,64,69,74`). The three `/etl/duplicates/review*` routes (`backend:routes/etlRoutes.js:74,75,76-79`), whose only caller is `DuplicateDetectionCard` (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:91,178,181`). That card is rendered only by the unrouted `VcaServicesDashboard` (`legacy:src/pages/VcaServicesDashboard.tsx:32,947`). |
| Wrapper branch never taken (1) | `GET /mother/members-count/:district(*)` (`backend:routes/motherRoutes.js:10`). Both callers of `getTotalMothersCount` pass no district (`legacy:src/pages/MotherIndexRegister.tsx:85`, `legacy:src/pages/Documentation.tsx:87`). |

#### c. Wrappers defined but never called

A whole-word grep of `legacy:src` for each name finds only its definition, or an import that is never used.

- **`legacy:src/lib/api.ts` (8):**
  - `getCaseworkerCountByDistrict` (`:280`), `getHouseholdCountByDistrict` (`:287`) and `getVcaCountByDistrict`
    (`:294`), all with no route
  - `getVcaProfileById` (`:381`)
  - `getCaregiverCasePlansByDistrict` (`:543`; imported but unused at `legacy:src/pages/HouseholdProfile.tsx:11`)
  - `getVcaCasePlansByDistrict` (`:581`)
  - `triggerEtlPipeline` (`:714`) and `cancelEtlRun` (`:738`). The data-pipeline page therefore cannot start or
    cancel runs, despite its `runningPipelines` state (`legacy:src/pages/DataPipelinePage.tsx:229-235`).
- **`legacy:src/lib/directus.ts` (6):**
  - `inviteUser` (`:256`)
  - `sendMail` (`:532`; only `notifyAllUsers` calls it)
  - `markAllNotificationsReadForUser` (`:568`)
  - `triggerWeeklyFlow` (`:575`)
  - `notifyAllUsers` (`:596`)
  - `broadcastAnnouncement` (`:843`; imported at `legacy:src/pages/DataPipelinePage.tsx:69` and referenced only in a
    JSX comment at `:2246`)
- **`legacy:src/components/dashboard/services/service-records.ts` (2):** `fetchRawServices` (`:168`) and
  `fetchHouseholdRegister` (`:174`). The other modules import only the `ISSUE_META` / `SERVICE_TYPE_META` constants
  and the `ServiceType` type from this file (`legacy:src/components/dashboard/services/QualityReviewPanel.tsx:28`,
  `legacy:src/components/dashboard/services/ServicesPageHeader.tsx:11`). Its whole record-normalising section is
  therefore dead code, including the `pickValue` described in f.

**Effectively unused (7 more):** their only callers are components that are never mounted.
- `getCaregiverServicesByMonth`, `getVcaServicesByMonth`, `getCaregiverReferralsByMonth` and `getVcaReferralsByMonth`
  (`legacy:src/lib/api.ts:515-541`), called only by `DataQualityChart`
- `listDuplicateReviews`, `upsertDuplicateReview` and `deleteDuplicateReview` (`:1079-1114`), called only by
  `DuplicateDetectionCard`

Also unmounted, but their wrappers have live callers elsewhere:
- `ActionQueueBanner` calls `getActionQueue` (`legacy:src/components/dashboard/ActionQueueBanner.tsx:27`).
- `RecentActivity` calls `getFlaggedRecords` (`legacy:src/components/dashboard/RecentActivity.tsx:100`).
- `ProvincialBreakdown` calls `getHouseholdsByDistrict` (`legacy:src/components/dashboard/ProvincialBreakdown.tsx:16`).

#### d. Several wrappers or call sites for one endpoint

| Endpoint | Duplicates | Evidence |
| --- | --- | --- |
| `GET /household/all-households/:district(*)` | One wrapper, but at least 6 React Query keys for the same national URL, for example `["households","district",""]`, `["hh-districts-discovery-services",fyKey]` and `["districts-discovery","All"]`. Two IndexedDB keys for the same data: `""` is stored as `:ALL` and `"All"` as `:All`. AddUser and EditUser download it only to build pickers. | `legacy:src/pages/HouseholdProfile.tsx:154-158`, `legacy:src/pages/HouseholdServicesPage.tsx:52-56`, `legacy:src/pages/AddUser.tsx:178-182`, `legacy:src/pages/EditUser.tsx:61-65`, `legacy:src/lib/api.ts:305-308` |
| `GET /child/vcas-assessed-register/:district(*)` | Fetched twice under two keys on one page (an unmounted page); profile pages download the whole register to find one VCA | `legacy:src/pages/VcaServicesDashboard.tsx:248-252,275-279`, `legacy:src/pages/VcaProfile.tsx:205` |
| `GET /household/caregiver-caseplans/:household_id(*)` | `getCaregiverCasePlansByHousehold` (correct) and `getCaregiverCasePlansByDistrict`, which sends a district as the id (unused) | `legacy:src/lib/api.ts:543-556` |
| `GET /household/hts-register-by-district/:district(*)` | `getHTSRegisterByDistrict` plus the alias `getHtsRegisterByDistrict`, with callers split between them | `legacy:src/lib/api.ts:428-442` |
| `/mother` count | One handler behind three routes, plus two `/mother/district` routes on one handler (backend side) | `backend:routes/motherRoutes.js:5-10` |
| `GET /etl/last-success` | No wrapper. A raw `fetch` in `EtlInvalidator` with its own headers, although `dqaGetSkipCache` would fit. | `legacy:src/components/EtlInvalidator.tsx:31-47`, `legacy:src/lib/api.ts:701` |
| `GET /etl/services/:type/summary` | `CanonicalKpiStrip` and `CohortStrip` share a key and send FY. `ServicesPage` uses another key and sends **no** FY, so it makes a second request with different semantics. | `legacy:src/components/dashboard/CanonicalKpiStrip.tsx:89`, `legacy:src/components/dashboard/services/CohortStrip.tsx:38`, `legacy:src/components/dashboard/services/ServicesPage.tsx:295-305` |
| `GET /etl/facility-list` | Three keys: `["ward-list"]`, `["facility-list"]` and `["etl","ward-list"]`. `EtlInvalidator` never invalidates the last one. | `legacy:src/pages/Performance.tsx:564`, `legacy:src/pages/CaseworkerJourneys.tsx:285`, `legacy:src/pages/AddUser.tsx:239`, `legacy:src/pages/EditUser.tsx:132`, `legacy:src/components/EtlInvalidator.tsx:79` |
| `GET /etl/services/:type/records` and `/export` | The same filter-to-query mapping is written twice | `legacy:src/lib/api.ts:1357-1367` vs `:1428-1436` |
| `GET /etl/tablet-sync` and `/stream` | Both write the cache key `["etl","tablet-sync"]` (intentional) | `legacy:src/pages/DataPipelinePage.tsx:198,301-321` |
| 7 performance and service GETs | The same `district/facility/ward/from/to` query building is copied seven times, each with different "all" sentinels | `legacy:src/lib/api.ts:818-827,856-865,893-903,928-937,968-977,1010-1019,1055-1061` |
| DQA helpers | `dqaGet`, `dqaGetSkipCache` and `dqaPost` differ only in error text and logging. Raw `fetch` is used in 4 more DQA wrappers. | `legacy:src/lib/api.ts:185-210,683-712,1092-1113,1446` |
| Directus `POST /auth/password/request` | `requestPasswordReset` (throws) vs the inline `ForgotPassword` call (swallows errors in production) | `legacy:src/lib/directus.ts:268-286`, `legacy:src/pages/ForgotPassword.tsx:32-38` |
| Directus `/users/me` | Three call sites with different field sets: the profile, `fields=id`, and the PATCH | `legacy:src/context/AuthContext.tsx:54`, `legacy:src/lib/directus.ts:144,334` |
| Directus `GET /users` | `listUsers` under `["directus","users"]` and `["users-list-chat"]`; it is re-fetched on **every** flag notification; `listPmpUsers` and `getUserByEmail` are separate queries | `legacy:src/pages/Users.tsx:80`, `legacy:src/pages/SupportCenter.tsx:68`, `legacy:src/lib/directus.ts:663,690,826-840,228-234` |
| Directus `PATCH /users/:id` | `updateUser` and `updateUserAvatar`. The avatar upload flow is duplicated in Profile and ProfilePictureModal. | `legacy:src/lib/directus.ts:203-212,310-331`, `legacy:src/pages/Profile.tsx:34-58`, `legacy:src/components/chat/ProfilePictureModal.tsx:58-86` |
| Directus `/notifications` | The bell and chat both read the same collection with different filters, so chat messages show in the bell. `markNotificationRead` overlaps `clearAllNotifications`, which also has an alias. | `legacy:src/lib/directus.ts:116-131,486-512,550-568` |
| Directus `/items/calendar_events` | `["calendar-events",id]` (page and reminder hook) vs `["calendar-events-widget",id]`, which mutations never invalidate | `legacy:src/pages/Calendar.tsx:107,115,125,141`, `legacy:src/components/dashboard/CalendarWidget.tsx:17` |
| Directus `flagged_forms_ecapplus_pmp` | Raw `fetch` instead of `directusRequest`; cached under `["flagged-records"]` and `["recent-flags"]` | `legacy:src/lib/api.ts:604-652,1283-1305`, `legacy:src/components/dashboard/RecentActivity.tsx:98-101` |
| `safeJson`, `requireDirectusUrl` | Defined in `directus.ts`, again in `AuthContext.tsx` and again in `api.ts` (`safeJson`) | `legacy:src/lib/directus.ts:5-19`, `legacy:src/context/AuthContext.tsx:36-50`, `legacy:src/lib/api.ts:18-24` |

#### e. Params: sent but ignored, read but never sent, unrecognised values

**Sent by the frontend, ignored by the backend:**
- `from` / `to` (FY):
  - `getMothersByDistrict` (`legacy:src/lib/api.ts:343`; `backend:controllers/motherController.js:14-26`)
  - the PMTCT child and mother registers (`legacy:src/lib/api.ts:353,363`; `backend:controllers/etlController.js:3661,3682`)
  - facility, caseworker and service performance (`legacy:src/lib/api.ts:824-827,862-865,900-903`;
    `backend:controllers/etlController.js:786,890,1005`)
  - services timeseries and distribution (`legacy:src/lib/api.ts:974-977,1016-1019`, fixed 12-month and 90-day
    windows)

  Callers key their queries on FY, so changing the FY refetches identical data.
- `_fy` is accepted by `getHTSRegisterByDistrict` and **dropped by the wrapper itself** (`legacy:src/lib/api.ts:428-430`).
- `fyKey` sits in query keys but is never sent: Referrals, HouseholdServicesPage and VcaServicesDashboard
  (`legacy:src/pages/Referrals.tsx:170`, `legacy:src/pages/HouseholdServicesPage.tsx:69-71`,
  `legacy:src/pages/VcaServicesDashboard.tsx:282-285`).
- `user` is passed to `fetchGuestToken` and ignored (`legacy:src/lib/superset.ts:23`). Any other body field is ignored
  by the backend (§3.2).
- `facility` on `/etl/caseworker-journeys` is a ward name. The backend matches it with a fuzzy `LIKE` on location
  names, and the page filters the points again by substring (`legacy:src/pages/CaseworkerJourneys.tsx:312-321`).
- `clearAllNotifications` sends filters in the URL and a bare `{status}` body. Directus batch updates expect
  `{keys, data}` or `{query, data}` in the body, so the request is probably rejected (400) and the UI shows its
  error toast (`legacy:src/lib/directus.ts:550-561`, `legacy:src/components/dashboard/DashboardHeader.tsx:211-220`).
  This needs checking against the live Directus version.

**Read by the backend (or supported by the wrapper), never sent:**
- FY on the cohort registers from several callers:
  - archived registers from the profile pages (`legacy:src/pages/HouseholdProfile.tsx:162`, `legacy:src/pages/VcaProfile.tsx:211`)
  - `getHouseholdsByDistrict` from `MetricsGrid`. Its KPI counts on the same card *are* FY-scoped, so the count and
    the list disagree (`legacy:src/components/dashboard/MetricsGrid.tsx:133,139,146`).
  - the district export (`legacy:src/pages/Districts.tsx:234`)
  - more lookups: `CaregiverRiskRegister:80`, `CaseworkerProfile:79`, `Performance:548`, `AddUser:180`, `EditUser:63`,
    `ServicesPage:269`, `GlobalSearch:68,74`, `HouseholdProfile:156,208`, `VcaProfile:205`, `VcaRiskRegister:84`,
    `MotherIndexDetails:84`
- `getServiceSummary` from `ServicesPage` sends no FY (`legacy:src/components/dashboard/services/ServicesPage.tsx:304`).
- `district` / `province` on `/etl/caseworker-list`: `getCaseworkerList` is called with no scope, and role scoping is
  done in the browser by comparing `description` strings. When nothing matches, it falls back to the **full national
  list** (`legacy:src/pages/CaseworkerJourneys.tsx:230-256`).
- `district` on `/etl/caseworker-journeys` is never sent and the backend ignores it anyway. Any user can load any
  caseworker's GPS points (§3.2).
- `facility` on the three performance endpoints and `type` on `/etl/service-performance` are never passed
  (`legacy:src/pages/Performance.tsx:567-577`).
- `pipeline` and `status` on `/etl/runs` are never passed (`legacy:src/pages/DataPipelinePage.tsx:192`).
- `model` on `/agent/chat` is never sent, so the backend default applies.
- `limit` on Directus `getFlaggedRecords` and `getCalendarEvents` is not sent, so the Directus default page size
  silently truncates (`legacy:src/lib/api.ts:612-616`, `legacy:src/lib/directus.ts:722-732`).

**Sentinels and values the endpoint does not recognise:**
- **`"*"` as "all"**:
  - On `/household/household-services-by-district` it returns `[]`
    (`legacy:src/pages/HouseholdServicesPage.tsx:71`; `backend:controllers/householdController.js:379`).
  - On `/household/hts-register-by-district` it also returns `[]` (`legacy:src/pages/HTSRiskRegister.tsx:125`,
    `legacy:src/pages/HTSProfile.tsx:86`; `backend:controllers/householdController.js:420-431`).
- **`undefined`** is stringified into the referral fallback URL (a, row 3).
- **`"None"`** is sent as the district for district users with an empty `location`
  (`legacy:src/pages/HouseholdProfile.tsx:150-152`, `legacy:src/pages/VcaProfile.tsx:199-201`).
- **The "all" sentinel differs per endpoint, and the wrappers do not hide it:**
  - household and child routes: `""` or `All`, exact case
  - mother: `""`, `all` or `all districts`, any case
  - HTS: `""` or `all districts`
  - PMTCT: no sentinel at all, so the page fans out one request per district (`legacy:src/pages/PMTCTRegister.tsx:163-167`)
  - performance and action queue: lower-case `all` only
  - summary, timeseries and distribution: `all` or `All`
  - `/etl/duplicates`: `All Districts`; `getDuplicates` strips nothing
  - service records, detail and export: the wrappers strip only `All`

  Evidence: `legacy:src/lib/api.ts:819,857,895,929,969,1011,1057,1277,1358,1396,1429`;
  `backend:controllers/etlController.js:791,1436,1919,2379,2735`. Case-sensitive district matching also makes
  `Districts.tsx` send one request per spelling variant (`legacy:src/pages/Districts.tsx:147,234`).
- **Reason param name:** the household archive sends `de_registration_reason` while the VCA archive sends `reason`.
  The backend accepts both, so this is harmless; unify it (`legacy:src/lib/api.ts:324-326,393-395`).

#### f. Inconsistent response handling and field-name guessing

**Error and envelope handling.** There are three error envelopes:
- DQA: `{status:"error"|"fail", message}`
- the agent: `{error:{message}}`
- Directus: `{errors:[{message}]}`

Each wrapper reads one of them, sometimes the wrong one:
- **Correct readers:**
  - `dqaGet` / `dqaPost` / `dqaGetSkipCache` and `fetchGuestToken` read `message` (`legacy:src/lib/api.ts:205-207,696-697,709-710`;
    `legacy:src/lib/superset.ts:37-41`).
  - `directusRequest`, `fetchProfile`, `login` and `ResetPassword` read `errors[0].message`.
- **Wrong reader:** `createFlaggedRecord` and `updateFlagStatus` read `message` from **Directus**, so users always
  see the fallback text (`legacy:src/lib/api.ts:646-649,1299-1302`).
- **No `response.ok` check:**
  - `getFlaggedRecords`: a Directus 401 or 403 body `{errors:[…]}` goes to `getListValue`, which returns the
    `errors` array **as the flag list** (`legacy:src/lib/api.ts:614-623,166-172`).
  - `publicBackendRequest` (`legacy:src/lib/directus.ts:288-301`).
- **Errors swallowed into data:**
  - `getFlaggedRecords` returns `[]` (`legacy:src/lib/api.ts:624-627`).
  - `getServiceRecordDetail` returns `null` (`:1398-1405`).
  - `EtlInvalidator` returns `null`, so a 401 means "no new run" (`legacy:src/components/EtlInvalidator.tsx:41-46`).
  - `getListFromApiWithCache` returns an expired cache entry on error (`legacy:src/lib/api.ts:229-235`).
- **Fixed strings that drop the server message:** `upsertDuplicateReview` and `deleteDuplicateReview`
  (`legacy:src/lib/api.ts:1100,1113`), and `getAiGreeting` (`legacy:src/lib/ai-service.ts:170`).
- **`data?.data` with no fallback**, typed as non-optional: `getEtlRunById`, `getTabletSyncStatus` and `getDuplicates`
  (`legacy:src/lib/api.ts:735,793,1280`).
- **Unnormalised body:** `getVcaProfileById` returns the raw body (`:385`).
- **The HTTP status is lost everywhere** (§3.3), and nothing parses responses with a schema. Every DQA wrapper casts
  to a hand-written interface.
- **Type drift:**
  - `DuplicateGroup.duplicate_count` is typed `number` but arrives as a string (`legacy:src/lib/api.ts:1249`).
  - `JourneyPoint` lacks `facility`, `entity_id` and `household_id`, which the backend sends and the page reads
    through `any` (`:1117-1123`; `backend:controllers/etlController.js:1294-1296`).
  - `getCaseworkerList` declares `location_id`, which the backend never returns (`legacy:src/lib/api.ts:1165`).

**Field-name guessing helpers.** Each of these becomes **one** zod normaliser in the owning module's
`api/schemas.ts`. "Real field" is the key the backend actually returns, where §3.2 or the backend code shows it.
Where the real field is unknown, the new schema must be written from a fixture, not from the guess list.

| Helper (definition) | Candidate keys | Real field | Live? |
| --- | --- | --- | --- |
| `getCountValue` `legacy:src/lib/api.ts:26-114` | the value itself; `count` (also nested `count.count`); then `total`, `totalCount`, `total_count`, `totalVcaCount`, `total_vca_count`, `data`; then `data` array length; then the same keys inside `data`. **Bug:** `if (record.count)` drops a numeric `0` (`:43`). | `count`. It is a **string** for household and child (pg bigint) and a **number** for mother. | yes |
| `getListValue` `legacy:src/lib/api.ts:116-183` | the array itself; then 16 keys: `data`, `results`, `records`, `referrals`, `referral`, `caregiver_referrals`, `caregiver_referral`, `caregiver_services`, `caregiver_services_by_district`, `household_services`, `services`, `caseplans`, `members`, `vca_services`, `vca_services_by_district`, `household_services_by_district`; then the same keys one level down; then **the first non-empty array under any key**; then any array | `data` on every §3.2 list endpoint | yes (every list wrapper, plus Directus flags) |
| `getCaseworkerList` row mapper `legacy:src/lib/api.ts:1177-1233` | caseworker ← `caseworker, provider, provider_id, providerId, username, user_name, caseworker_name, display_name, name`; display ← `display_name, caseworker_name, full_name, name`; `location_id` ← `location_id, locationId`; facility ← `facility, ward, location_name`; has_gps ← `has_gps, hasGps, gps_available, has_gps_data, gps_count, gps_points, gps_events, journey_points` | `caseworker, display_name, facility` (holding the ward), `district, province, has_gps` (boolean) (`backend:controllers/etlController.js:1361-1369`) | yes |
| `hasGpsData` `legacy:src/pages/CaseworkerJourneys.tsx:169-181` | the same 8 `has_gps` candidates again, plus string truthiness parsing | `has_gps` (boolean) | yes |
| `login` token `legacy:src/context/AuthContext.tsx:128` | `data.data.access_token`, `data.access_token` | `data.access_token` (Directus JSON mode) | yes |
| Referral fallback filter `legacy:src/lib/api.ts:466-472,489-495` | `service, form_name, type` | unknown (services are `SELECT *`) | yes |
| `pickValue(records[], keys, fallback, fuzzyHints)` `legacy:src/components/dashboard/services/service-records.ts:201-230` | case-insensitive lookup, then fuzzy **substring of any key name**. Key sets at `:60-133`: household id (10 keys), VCA entity id (10), name (4–7), date (7), district (4), facility (10), caseworker (20), status (6), service name (7) | unknown | **no** (dead, see c) |
| `pickValue` `legacy:src/components/dashboard/GlobalSearch.tsx:83` | VCA id `vca_id, vcaid, child_id, unique_id, uid` (`:127`); household id `household_id, householdId, hh_id, unique_id, id` (`:153`) | unknown | yes |
| `pickValue` `legacy:src/pages/HouseholdRegister.tsx:61` | `household_id, householdId` (`:511`); `caseworker_name, cwac_member_name` (`:529,539`) | unknown | yes |
| `pickValue` `legacy:src/pages/HouseholdArchivedRegister.tsx:75`; `getValue` `:310` | reason `de_registration_reason, reason, archived_reason[, case_status, status]` (`:312,667,690`); date `de_registration_date, archived_on[, archivedOn], date_archived, updated_at` (`:321,659,681`); id `household_id, householdId, hh_id, id` (`:636`) | unknown | yes |
| `pickValue` `legacy:src/pages/VcaRegister.tsx:75` | `uid, unique_id, vca_id` (`:575`); `vca_gender, gender` (`:594,604`) | unknown | yes |
| `pickValue` `legacy:src/pages/VcaArchivedRegister.tsx:90`; `getValue` `:369` | id `uid, unique_id, vca_id, vcaid, id, child_id` (`:372,736`); reason and date as in the household archive (`:383,391,770,792,801`) | unknown | yes |
| `pickValue` `legacy:src/pages/HTSRegister.tsx:70` | id `client_number, unique_id, uid, vca_id, mother_id, id, hts_id` (`:187`); caseworker `caseworker_name, caseworker, cw_name, assigned_to, provider` (`:196`); `type, record_type` (`:204-205`); HIV `hiv_result, hiv_status, status, art_status, current_hiv_status` (`:211`); facility `health_facility, facility, facility_name` (`:218`); `district, district_name` (`:223`); ART `case_art_number, art_number, art_no, vca_art_number, art_status` (`:380,444`) | unknown | yes |
| `pickVal` `legacy:src/pages/HTSRiskRegister.tsx:63` | `client_number, ecap_id` (`:307`) | unknown | yes |
| `pickValue` `legacy:src/pages/MotherIndexRegister.tsx:34` | id `mother_id, household_id, ecap_id, id, unique_id` (`:96,131,166,284,295`); dates `updated_at, last_service_date, last_edited, anc_date, registration_date` (`:117`) and `updated_at, last_edited, date_updated, registration_date` (`:308`); `facility, facility_name`; `district, district_name`; HIV `art_status, caregiver_hiv_status, hiv_status` (`:169,286`) | unknown | yes |
| `pick` `legacy:src/pages/MotherIndexDetails.tsx:13` | 15 groups (`:33-48`), for example id `household_id, hh_id, id, unique_id`; name `caregiver_name, full_name, name, mother_name`; phone (7 keys); DOB (4); HIV (3); last-interaction date (6) | unknown | yes |
| `pickValue` / `pickPmctctId` `legacy:src/pages/PMTCTRegister.tsx:79,88` | id: **15 keys**, from `pmtct_id` to `id` (`:89`); child id `ca_id, child_id, unique_id` (`:222`); HIV `test_result_at_birth, infant_hiv_status, hiv_status` (`:223`); dates (`:231,254`); `ecap_id, household_id, hh_id` (`:246`) | unknown | yes |
| `pick` / `pickPmctctId` `legacy:src/pages/PMTCTProfile.tsx:10,18` | 33 call sites (`:58-155`). Multi-key groups: name (4), phone (4), HIV result (5), ART date (3), recency result (3), milestone results (3 each, `:151-155`) | unknown | yes |
| `pickValue` `legacy:src/pages/Referrals.tsx:67` | name `caregiver_name, full_name, name, mother_name, guardian_name` (`:120`); `referred_date, date_referred` (`:129`) | unknown (the rows are services, see a) | yes |
| `pickValue` `legacy:src/pages/Flags.tsx:106`; inline `:48,72` | flagger `flagged_by, user_created, created_by, verifier, supervisor` (`:414`); status `status, flag_status, state` (`:48`); date `date_created, created_at, flagged_date, date` (`:72`) | the app writes `status`, and Directus adds `date_created` / `user_created` only if those system fields exist (unverifiable) | yes |
| `pickValue` `legacy:src/pages/HouseholdServicesPage.tsx:102`; inline `:93-99` | `service, service_name, form_name`; `service_date, visit_date, date`; `status, state, outcome` (`:308-322`); `household_id, hh_id` | unknown | yes |
| `pickValue` `legacy:src/pages/VcaServicesDashboard.tsx:417`; inline `:353-386` | VCA id `vca_id, vcaid, child_id[, unique_id]`; join `uid, unique_id, vca_id, child_id, id`; service (3); caseworker `caseworker_name, cwac_member_name, caseworker`; date (5) | unknown | **no** (unrouted page) |
| `pickValue` `legacy:src/components/dashboard/RecentActivity.tsx:30` | single keys only | — | **no** (unmounted) |
| Inline chains in `HouseholdProfile` | record id `uid, unique_id, household_code, household_id, id` (`:227-239`); VCA link `household_code, household_id` (`:391-399`); service `household_id, householdId, hh_id` and date `service_date, visit_date, date` (`:351-367`); case-plan date `case_plan_date, date_of_caseplan, date` (`:369-379`); referral date (+ `referral_date`) (`:408-418`); flag `household_id, hh_id` (`:386`); flag payload `caseworker_name, cwac_member_name`, `facility, health_facility` (`:335-347`) | unknown | yes |
| Inline chains in `VcaProfile` | record id `uid, unique_id, vca_id, id` (`:293-303`); flag `vca_id, child_id` (`:267`); case-plan, service and referral dates (`:272-315`); flag payload caseworker and facility (`:387-399`) | unknown | yes |

**Migration rule.** Write each new `schemas.ts` against the single real key from §3.2 or a sanitised fixture.
Unknown columns from `SELECT *` endpoints are typed from fixtures (Phase 1 step 5), never from these guess lists.

#### g. Direct network calls that bypass the lib wrappers

**Outside `src/lib`:**

| Call site | Request | Notes |
| --- | --- | --- |
| `legacy:src/components/EtlInvalidator.tsx:31-47` | `GET {REACT_PUBLIC_API_URL}/etl/last-success`, raw `fetch` with Bearer (added by the patch) | Polled every 30 s at the app root. Every failure becomes `null`. |
| `legacy:src/context/AuthContext.tsx:52-69,109-146` | Directus `GET /users/me`, `POST /auth/login`, raw `fetch` | Separate copies of `safeJson` / `requireDirectusUrl`. |
| `legacy:src/pages/ForgotPassword.tsx:32` | Directus `POST /auth/password/request` | Duplicates `requestPasswordReset`, with no base-URL guard. |
| `legacy:src/pages/ResetPassword.tsx:41` | Directus `POST /auth/password/reset` | No wrapper exists. |
| `legacy:src/pages/DataPipelinePage.tsx:281-354` | `new EventSource(…/etl/tablet-sync/stream?token=…)` | The token is baked in at connect time. A 401 after expiry leaves the badge on "reconnecting" forever. |
| `legacy:src/pages/DataPipelinePage.tsx:392-399` | anchor `GET …/etl/download/:pipeline/:file?token=…`, `target="_blank"` | The token appears in the address bar and history. Errors open raw JSON in a new tab. |
| `getFileUrl` URLs in `<img>`, `<audio>` and `<a download>` | Directus `GET /assets/:id?access_token=…` | `legacy:src/pages/SupportCenter.tsx:376-420`, avatars (§3.3) |
| `legacy:src/hooks/useWebRTC.ts:34-210` | PeerJS cloud signalling and WebRTC media | Not ported (decision #4). |
| `legacy:src/pages/CaseworkerJourneys.tsx:862-867` | Leaflet tile GETs | §3.4 |
| `legacy:index.html:11-14,29-31` | preconnects and Google Fonts | §3.4 |

**Inside `src/lib`, bypassing that file's own shared helper:**
- Flag wrappers use raw `fetch` to Directus from `api.ts` instead of `directusRequest`
  (`legacy:src/lib/api.ts:604-652,1283-1305`).
- `upsertDuplicateReview` and `deleteDuplicateReview` use raw `fetch` (`:1084-1114`).
- `triggerServiceExport` uses raw `fetch` with the token in the query and **no token check**. It buffers the whole
  CSV in memory (`:1416-1486`).
- `requestPasswordReset` and `publicBackendRequest` use raw `fetch` (`legacy:src/lib/directus.ts:268-308`).
- `fetchGuestToken` uses raw `fetch` (`legacy:src/lib/superset.ts:28`).
- `getAiResponse` and `getAiGreeting` use raw `fetch` (`legacy:src/lib/ai-service.ts:97,154`).

No file uses axios, the Directus SDK, `XMLHttpRequest` or `window.open` (grep of `legacy:src`). In the rebuild every
one of these goes through `core/api` clients. The only exceptions are browser-native downloads and SSE, which need a
short-lived signed URL or a cookie instead of the session token in the query string (Backend ask).

## 4. Cross-cutting inventories

### 4.1 Hardcoded brand and program strings

<!-- PENDING: step 4 -->

### 4.2 Storage keys

<!-- PENDING: step 4 -->

### 4.3 Polling, timers and streams

<!-- PENDING: step 4 -->

### 4.4 Access rules and disagreements

<!-- PENDING: step 4 -->

### 4.5 Environment variables

<!-- PENDING: step 4 -->

### 4.6 Dead and unreferenced code

<!-- PENDING: step 4 -->

### 4.7 Duplicated helpers

<!-- PENDING: step 4 -->

## 5. Verification of MIGRATION_PLAN.md section 2

<!-- PENDING: step 4 -->

## 6. Surprises

<!-- PENDING: step 4 -->

## 7. Test fixtures index

<!-- PENDING: step 5 -->

## 8. Appendix: legacy file → module map

<!-- PENDING: step 3 -->
