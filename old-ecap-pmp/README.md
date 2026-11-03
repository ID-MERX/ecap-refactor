# Security fix: backend authentication + Superset guest tokens

Two changes, deployed together:

1. **The backend now requires a valid Directus login token on every endpoint.** Before this, the
   middleware existed but was never attached to any route, so every endpoint (registers, profiles, HTS,
   caseworker GPS journeys, ETL run/cancel/download, email reports) answered anyone who knew the URL.
2. **Superset guest tokens are issued by the backend** (`POST /superset/guest-token`). The Superset
   service-account credentials leave the frontend bundle, and row-level security is built on the server
   from the logged-in user's scope.

The legacy frontend needs a small patch so the four call sites that never sent a token
(ETL freshness poll, ETL file downloads, tablet-sync live stream, AI assistant) keep working.

## What's in this folder

| Path | What it is |
|---|---|
| `backend.patch` | All backend changes as one git patch (`git apply backend.patch`) |
| `legacy-frontend.patch` | All legacy frontend changes as one git patch |
| `backend/`, `legacy-frontend/` | The same changed files in full, if you'd rather copy them over |
| `backend/tests/security.test.js` | Tests for the middleware and endpoint, with Directus and Superset mocked (no database needed) |

Backend files changed: `index.js`, `middleware/verifyDirectusToken.js`; added `lib/userScope.js`,
`lib/supersetClient.js`, `controllers/supersetController.js`, `routes/supersetRoutes.js`,
`config/geography.js`, `.env.example`, `tests/security.test.js`. The broken `/clear-cache` route was
removed (it called an undefined `redisClient` and could only ever throw).

Legacy frontend files changed: `src/lib/superset.ts`, `src/lib/api.ts`, `src/lib/ai-service.ts`,
`src/components/EtlInvalidator.tsx`. Type errors are unchanged from before (8 pre-existing, none in
these files) and `vite build` succeeds.

## Rollout (staged so nothing breaks)

**1. Backend environment.** Add to the backend's `.env` (see `.env.example`):

- `DIRECTUS_SECRET`: the exact value of `SECRET` from your Directus server's environment.
  Directus signs its access tokens with it.
- `DIRECTUS_URL`: the Directus base URL (same as the frontend's `REACT_APP_BASE_URL`).
- `AUTH_MODE=log`: let requests through for now, but log any request without a valid token.
- `SUPERSET_URL`, `SUPERSET_EMBED_USERNAME`, `SUPERSET_EMBED_PASSWORD`: use the **new, rotated**
  embedder password (step 4).
- `SUPERSET_DASHBOARD_IDS`: comma-separated list of the dashboard UUIDs from the frontend's
  `VITE_SUPERSET_DASHBOARD_ID_*` variables. Only these can be embedded.
- `TABLET_SYNC_WEBHOOK_SECRET`: currently unset, so anyone can trigger that webhook. Only set it once
  whatever calls `/etl/tablet-sync/notify` is updated to send the same value in an `x-webhook-secret` header.

**2. Deploy the backend.**

```
git apply backend.patch
node tests/security.test.js      # should print "All backend tests passed"
pm2 restart ecap-plus-pmp-backend
```

**3. Deploy the legacy frontend.**

```
git apply legacy-frontend.patch
```

Remove `VITE_SUPERSET_USERNAME` and `VITE_SUPERSET_PASSWORD` from every frontend env file (local,
staging, production build machines), then rebuild and deploy. To confirm the credentials are gone,
`grep -l "security/login" dist/assets/*.js` should print nothing.

**4. Rotate the Superset embedder password** at the same time as step 3. Every bundle built before
this fix contains the old password, and browsers or proxies may have cached those bundles. Put the new
password only in the backend `.env`.

**5. Watch, then enforce.** Leave `AUTH_MODE=log` for a day or two and check the backend logs for
`[auth:log-only]` lines. With the patched frontend there should be none during normal use. Then set
`AUTH_MODE=enforce` and restart. To verify:

```
curl -i https://<backend>/child/vcas-count/All      # expect 401
```

**Rollback:** set `AUTH_MODE=log` and restart (instant), or revert the patches.

## Behaviour change to expect in Superset

Until now, the frontend requested guest tokens with **no** row-level security, so every user saw every
district in embedded dashboards. The backend now applies RLS from the user's profile, using the same
rules as the frontend's `useEffectiveDistrict`:

- Admins and support see everything.
- Provincial users see their province's districts.
- District users see their district.
- Users with no scope get a clear "no data scope assigned" error instead of all data.

This assumes the Superset datasets have a `district` column. If the column has a different name, set
`SUPERSET_RLS_DISTRICT_COLUMN`. If only some datasets have it, list those in `SUPERSET_RLS_DATASET_IDS`.
To keep the old see-everything behaviour temporarily, set `SUPERSET_RLS_ENABLED=false`.

If Superset rejects guest-token requests with a CSRF error, set `SUPERSET_USE_CSRF=true`.

## Not fixed yet (for the backend refactor)

- **Data scope is still not enforced per endpoint.** Any logged-in user can still request any district
  by changing the URL. `/household/hts-register-by-district` ignores the district entirely and returns
  everything. `lib/userScope.js` is ready to be reused for this; it's the natural next step.
- Download and live-stream URLs carry the token as `?token=`, so it can appear in access logs. Replace
  these with short-lived signed download tokens later.
- `/agent/chat` accepts a client-supplied system prompt and model. It now requires login, but should
  only accept user messages.
- Roles are still inferred from free-text profile fields (`description`, `title`, `location`).
  `deriveScope` in `lib/userScope.js` is the single place to change when explicit roles exist.
