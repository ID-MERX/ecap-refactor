/**
 * VERBATIM copy of `config/geography.js` as added by `backend.patch` at the repo root.
 *
 * The backend checkout in this workspace is deliberately left unpatched (patch-only files are
 * applied to throwaway copies, see `scripts/verify-audit.sh`), so this file is the *contract* the
 * frontend must satisfy — not a re-implementation. `src/config/program.config.test.ts` parses it and
 * asserts `programConfig.geography` is identical.
 *
 * Regenerate with:  node scripts/sync-backend-contract.mjs
 */
// Program geography, used to turn a province-level user into a district list
// (e.g. for Superset row-level security). Keep in sync with the frontend's
// program config until this moves into the database.
const DISTRICTS_BY_PROVINCE = {
  "Central Province": ["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"],
  "Southern Province": ["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"],
};

module.exports = { DISTRICTS_BY_PROVINCE };
