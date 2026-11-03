# Source baseline — which tree the audit describes

Phase 1 cites every claim as `legacy:<path>:<line>` (frontend, `../old-ecap-pmp`) or
`backend:<path>:<line>` (DQA API, `../ecap-plus-pmp-backend`). This note records **exactly which
working tree those line numbers refer to**, because the audit was written against a tree that
carries the uncommitted `security-fix` patch.

## The problem

`PROGRESS.md` and `AUDIT.md` §0 say both repos were audited on branch `security-fix` with the patch
**applied but uncommitted**. The trees present in this workspace are **without** that patch:

| Expected by the audit | Present here | Consequence |
| --- | --- | --- |
| `backend/lib/userScope.js` (scope derivation, 79 lines) | **absent** | `backend:lib/userScope.js:*` citations cannot be verified |
| `backend/lib/supersetClient.js` | **absent** | ditto |
| `backend/controllers/supersetController.js` | **absent** | ditto |
| `backend/routes/supersetRoutes.js` | **absent** | ditto |
| `backend/config/geography.js` (`DISTRICTS_BY_PROVINCE`) | **absent** | ditto |
| `backend/tests/security.test.js` | **absent** | ditto |
| `backend/middleware/verifyDirectusToken.js` with `AUTH_MODE`, `PUBLIC_ROUTES`, issuer check, 500 misconfiguration branch | present, but a **plain JWT check**: no `AUTH_MODE`, no `PUBLIC_ROUTES`, no `?token` logging mode, no `DIRECTUS_SECRET` guard | citations to `:22-26`, `:42-45`, `:59`, `:63-78`, `:82`, `:87-88` are off by tens of lines and describe behaviour not in this file |
| Frontend `src/lib/api.ts`, `superset.ts`, `ai-service.ts`, `components/EtlInvalidator.tsx` patched to send the Bearer token | present in the **unpatched** ("before") form | line numbers in those four files may drift by a few lines |

So the audit is internally consistent about a tree the developer had locally, and this workspace has
the pre-patch tree. The **findings are not wrong**; their line numbers largely are, for those files.

## Rules for later phases

1. **Behaviour over line numbers.** Read the legacy implementation for *what* it does, then write it
   fresh. A citation is a hint to find the code, not a contract. `CLAUDE.md` rule 3 already says this.
2. **Never port from this tree's `verifyDirectusToken.js`.** The rebuild must assume the patched
   behaviour (every endpoint requires a token, `AUTH_MODE` rollout, 401 bodies quoted in AUDIT.md
   §3.1.2), because that is what is deployed and what the new frontend must interoperate with.
3. **Treat the scope model as specified, not present.** `lib/userScope.js` is the intended single
   place for server-side scope (`deriveScope`). Its rules are quoted in full in AUDIT.md §3.1.3 and
   in `docs/audit/shell.md` §"Access rules", so `core/access/derive-access.ts` can be written from
   the audit without the file.
4. **Backend asks stay open.** Items 2–8 of `MIGRATION_PLAN.md` §8 are unaffected: no data
   controller applies user scope in either tree, so S9 remains true.

## Verification performed

`scripts/check-citations.py` re-opens every `legacy:` / `backend:` citation and reports missing
files, out-of-range line numbers and (with `--strict`) citations whose prose shares no token with the
cited lines. Results are recorded in `docs/audit/CITATION_REPORT.md`.

Known limitations of that check, recorded so nobody over-trusts it:

- It verifies that a line **exists** and, in strict mode, that it is *plausibly* the right line
  (shared token). It cannot prove a claim is true. Human review of high-risk modules is still the
  gate, exactly as the original workflow intended.
- Files modified by the absent patch will report drift even when the claim is correct.

## Action for the developer

If the patched trees are still available, drop the seven backend files listed above back into
`../ecap-plus-pmp-backend` (they are in that repo's `backend.patch` / `backend/` folder, see
`old-ecap-pmp/README.md`) and re-run `scripts/check-citations.py`. No audit content needs to change;
only the confidence of a handful of backend citations improves.
