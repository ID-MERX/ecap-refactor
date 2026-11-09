# Next-session handoff

Updated: 2026-11-03 (UTC)

## Repository and current slice

- Work only on branch `arena/7dcfbc01-ecap-refactor`; Arena fixes this branch name.
- PR #7: https://github.com/ID-MERX/ecap-refactor/pull/7. It contains caregiver commit `61eba9b` and Services commit `120c308`. Check `gh pr view 7` for the live state; the user authorized merging PR #7 in the current session. Do not infer merge status from an earlier note.
- Services and Caregivers are the current Phase 5 slices. Both are implemented; do not start a second new module without first proposing its structure, routes, permissions, and by-ID requirements and obtaining approval. Phase 5 remains one module per session.
- The implementation and tests live under `src/modules/services/` and `src/modules/caregivers/`. The service-specific implementation decisions and backend follow-ups are in `docs/audit/services.md`; caregiver residuals are in `docs/audit/caregivers.md`.

## Verification

The latest complete validation for the combined branch passed: `corepack enable pnpm && pnpm check` from `iccms-pmp/` (246 tests; typecheck, lint, Prettier, brand, backend-contract and fixture checks, and production build). No live backend parity, MSW handlers, or Playwright smoke tests were run.

## Remaining work

1. Check and record PR #7's current merge state and merge commit in the next progress update if needed.
2. Validate Services responses against an available live backend; inspect the per-type summary, time-series, distribution, record, and detail shapes, especially caregiver date parsing and the latest-service detail behavior.
3. Add MSW and Playwright coverage when those test harnesses are available; keep tests and fixtures test-only and regenerate sanitized fixtures from the endpoint catalogue when changing fixtures.
4. Track backend work in `docs/audit/services.md` and PROGRESS: authorization and effective-scope enforcement for Services endpoints; exact historical visit lookup; duplicate-review write permissions/scope; bounded server pagination/aggregation. Do not change the backend in this migration unless explicitly requested.
5. Complete manual audit/parity review and address the shared search-provider gap where planned.
6. For any next Phase 5 module, first present the module proposal and wait for user approval.

## Standing constraints

- District users must remain fixed to their assigned district; province-scoped reads fan out by configured district. Never call a national/all-district endpoint for province- or district-scoped users. Client checks are not backend authorization.
- Keep PII/raw joined payloads out of the Services UI, exports, and query cache. The VCA service overview remains read-only until duplicate-review write safety exists.
- Do not edit the read-only reference repositories. Keep neutral brand placeholders, stable `siteConfig.brand.*` paths, and do not reintroduce the removed website URL or `example.org`.
- The user controls merge authority. The current authorization applies to PR #7 only; do not treat it as blanket permission for future merges.
