# ICCMS PMP — frontend

Clean rebuild of the legacy `ECAP+` React SPA. The legacy app and the backend live beside this
folder as **read-only reference**:

```
ecap-refactor/
  iccms-pmp/                 <- this project (the rebuild)
  old-ecap-pmp/              <- legacy frontend, read-only
  ecap-plus-pmp-backend/     <- backend, read-only
  backend.patch              <- the backend changes the audit was written against
  legacy-frontend.patch      <- the legacy-frontend changes the audit was written against
```

## Quick start

```bash
pnpm install                 # Node 22; pnpm 12 (build approvals are in pnpm-workspace.yaml)
cp .env.example .env.local   # then fill in the real API / Directus URLs
pnpm dev                     # http://localhost:5173
```

`pnpm dev` fails fast with a readable error if a required environment variable is missing or
malformed, or if a removed (`REACT_*`, `VITE_SUPERSET_PASSWORD`, …) variable is still present. That is
deliberate: a half-migrated `.env` reaching production is exactly how the legacy app broke.

## Commands

| Command               | What it does                                                |
| --------------------- | ----------------------------------------------------------- |
| `pnpm dev`            | Dev server on `0.0.0.0:5173`                                |
| `pnpm build`          | Typecheck + production build                                |
| `pnpm preview`        | Serve the build on `0.0.0.0:3040`                           |
| `pnpm typecheck`      | `tsc --noEmit`, `strict` + `noUncheckedIndexedAccess`       |
| `pnpm lint`           | ESLint, including the layer-boundary rules                  |
| `pnpm test`           | Vitest                                                      |
| `pnpm check:brand`    | Fails on hardcoded branding outside `src/config/`           |
| `pnpm check:contract` | Fails if the geography contract drifts from `backend.patch` |
| `pnpm check:fixtures` | Fails if `test/fixtures/` is stale                          |
| `pnpm check`          | All of the above. Run before declaring anything done.       |

## Layout

```
src/
  config/     site.config.ts, program.config.ts, env.ts, features.ts — the only home for
              branding, geography, fiscal year, sub-populations and domain terms
  core/       Shared kernel: api clients, auth, access control, ui, lib, hooks
  platform/   Cross-cutting capabilities: data-table, filters, export, scope, charts, states
  modules/    One folder per feature; other modules may only import its index.ts
  app/        Shell: providers, router, layouts, error boundaries
```

`pnpm lint` enforces the layer table (`config` → nothing, `core` → `config`, `platform` → `core` +
`config`, `modules` → `platform` + `core` + `config` + another module's `index.ts`, `app` → all).
See `CLAUDE.md` for the full rules.

## Documentation

Read in this order:

1. `CLAUDE.md` — how to work in this repo, hard rules, module anatomy
2. `docs/MIGRATION_PLAN.md` — the full plan, target stack and phases
3. `docs/PROGRESS.md` — what is done, decisions 1–24, open questions
4. `docs/AUDIT.md` + `docs/audit/<module>.md` — the legacy behaviour, feature by feature
5. `docs/PHASE_2_CONFIG_SPEC.md` — how `src/config` was derived

Audit tooling (none of it ships):

```bash
./scripts/verify-audit.sh                # apply both patches to a temp dir and re-open all 6,863 citations
python3 scripts/check-citations.py       # same, against the unpatched trees (expects 0 after a patch)
node scripts/sync-backend-contract.mjs   # regenerate test/contract/backend-geography.cjs
python3 scripts/draft-fixtures.py --check
```

## Status

Phase 1 (audit) and Phase 2 (scaffold + config) are complete. Phase 3 (core and shell) is next, and
nothing blocks it.
