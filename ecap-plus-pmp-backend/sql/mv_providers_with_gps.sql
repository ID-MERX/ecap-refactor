-- mv_providers_with_gps
-- ---------------------------------------------------------------------------
-- Materialized view of distinct OpenSRP providers (caseworkers) that have at
-- least one GPS-tagged observation in core.event.
--
-- WHERE THIS RUNS: in this deployment core.event / team.practitioner live in
-- the remote `ecap_plus` database and are exposed to the app DB
-- (`ecap_plus_superset_db`) as FOREIGN TABLES via postgres_fdw (server
-- `ecap_plus_raw`). A matching FOREIGN TABLE `public.mv_providers_with_gps`
-- (column: provider) already exists in the app DB and points here. Therefore
-- this matview MUST be created on the REMOTE `ecap_plus` database, in schema
-- public, so the pushed-down join in GET /etl/caseworker-list can resolve it:
--
--     psql -h localhost -p 5432 -U <user> -d ecap_plus -f mv_providers_with_gps.sql
--
-- WHY A VIEW: getCaseworkerList needs a per-caseworker has_gps flag, but
-- scanning core.event's JSON inline is a 2+ minute operation (the obs array has
-- to be expanded per row). We precompute the set of providers-with-GPS once
-- here and refresh it from the ETL, so the list endpoint is just a fast
-- LEFT JOIN. This mirrors the production backend, which JOINs the same view.
--
-- CONTRACT: the foreign table exposes only `provider`, and getCaseworkerList
-- derives has_gps from `provider IS NOT NULL`. Keep `provider` as the single
-- column (adding columns here is fine, but the app only reads `provider`).
--
-- The GPS fieldCode list MUST stay in sync with GPS_LAT_FIELDS / GPS_LNG_FIELDS
-- in controllers/etlController.js (getCaseworkerJourneys). If a new GPS field
-- code is added there, add it here and REFRESH.
--
-- Columns:
--   provider    OpenSRP providerId (== team.practitioner.username, the value
--               core.event stores under 'providerId')
--
-- Run once to create, then schedule REFRESH (see refresh_mv_providers_with_gps.sql).

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_providers_with_gps AS
SELECT DISTINCT
  e.json->>'providerId' AS provider
FROM core.event e
WHERE e.json->>'providerId' IS NOT NULL
  AND e.json->>'providerId' <> ''
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(e.json->'obs') o
    WHERE o->>'fieldCode' = ANY (ARRAY[
      'vca_service_location_latitude',
      'hh_service_location_latitude',
      'vca_visit_location_latitude',
      'visit_location_latitude',
      'household_location_latitude',
      'referral_location_latitude',
      'geopoint_latitude',
      'user_gps_latitude',
      'vca_service_location_longitude',
      'hh_service_location_longitude',
      'vca_visit_location_longitude',
      'visit_location_longitude',
      'household_location_longitude',
      'referral_location_longitude',
      'geopoint_longitude',
      'user_gps_longitude'
    ])
      -- Require a non-empty coordinate value, not just the field's presence.
      AND COALESCE(o->'values'->>0, '') <> ''
  );

-- Unique index lets us REFRESH ... CONCURRENTLY (no read lock during refresh).
CREATE UNIQUE INDEX IF NOT EXISTS mv_providers_with_gps_provider_idx
  ON public.mv_providers_with_gps (provider);
