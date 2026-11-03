-- refresh_mv_providers_with_gps
-- ---------------------------------------------------------------------------
-- Refreshes mv_providers_with_gps (see mv_providers_with_gps.sql). Run this
-- from the ETL after core.event is updated so the caseworker-list has_gps flag
-- stays current.
--
-- CONCURRENTLY avoids taking a read lock on the view during refresh, so
-- GET /etl/caseworker-list keeps serving the old snapshot until the new one is
-- ready. It REQUIRES the unique index created in mv_providers_with_gps.sql.
--
-- If the view has never been created, CONCURRENTLY errors ("cannot refresh ...
-- has not been populated") — create it first via mv_providers_with_gps.sql.

REFRESH MATERIALIZED VIEW CONCURRENTLY mv_providers_with_gps;
