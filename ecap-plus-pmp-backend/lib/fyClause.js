// FY date-range clause helpers — shared across controllers so every
// list/count endpoint applies identical cohort + service-window semantics.

/**
 * Parses `from` and `to` (YYYY-MM-DD) from a request's query object.
 * Returns {from, to, hasWindow}. Both must be present; otherwise hasWindow=false.
 */
const parseFyWindow = (query = {}) => {
  const from = typeof query.from === "string" ? query.from.trim() : "";
  const to = typeof query.to === "string" ? query.to.trim() : "";
  const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  return {
    from: isIso(from) ? from : null,
    to: isIso(to) ? to : null,
    hasWindow: isIso(from) && isIso(to),
  };
};

/**
 * Builds a cohort-active-during-FY clause. Pass column names — works for both
 * children + all_households (both have date_enrolled + de_registration_date).
 * Returns { clause, params } where clause starts with " AND ..." or is "".
 *
 *   cohort active = date_enrolled <= to AND (de_reg IS NULL OR de_reg >= from)
 *
 * Date columns are often stored as strings in ECAP tables, so the helper
 * accepts both ISO (YYYY-MM-DD…) and DD-MM-YYYY representations.
 */
const buildCohortFyClause = (window, opts = {}) => {
  const {
    enrolledCol = "date_enrolled",
    deRegCol = "de_registration_date",
    startParamIndex = 1,
  } = opts;
  if (!window?.hasWindow) return { clause: "", params: [] };
  const i = startParamIndex;
  const clause = `
    AND (
      CASE
        WHEN ${enrolledCol}::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${enrolledCol}::text, 1, 10)::date
        WHEN ${enrolledCol}::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(${enrolledCol}::text, 'DD-MM-YYYY')
        ELSE NULL
      END
    ) <= $${i}::date
    AND (
      ${deRegCol} IS NULL
      OR (
        CASE
          WHEN ${deRegCol}::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${deRegCol}::text, 1, 10)::date
          WHEN ${deRegCol}::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(${deRegCol}::text, 'DD-MM-YYYY')
          ELSE NULL
        END
      ) >= $${i + 1}::date
    )
  `;
  return { clause, params: [window.to, window.from] };
};

/**
 * Builds a service-window clause. Used for services tables (vca_services,
 * caregiver_services, household_services) where the date column is the
 * service_date. Returns " AND service_date BETWEEN from AND to" semantics.
 */
const buildServiceFyClause = (window, opts = {}) => {
  const { dateCol = "service_date", startParamIndex = 1 } = opts;
  if (!window?.hasWindow) return { clause: "", params: [] };
  const i = startParamIndex;
  const clause = `
    AND (
      CASE
        WHEN ${dateCol}::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${dateCol}::text, 1, 10)::date
        WHEN ${dateCol}::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(${dateCol}::text, 'DD-MM-YYYY')
        ELSE NULL
      END
    ) BETWEEN $${i}::date AND $${i + 1}::date
  `;
  return { clause, params: [window.from, window.to] };
};

module.exports = { parseFyWindow, buildCohortFyClause, buildServiceFyClause };
