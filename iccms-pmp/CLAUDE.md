# ICCMS PMP — Rules for Claude Code

This is the frontend (React SPA) of a program management platform. It is a clean rebuild of
the legacy app in `../old-ecap-pmp`. Read these files at the start of every session:

- `docs/MIGRATION_PLAN.md` — the full plan, architecture and phases
- `docs/PROGRESS.md` — what is done, what is in progress, decisions made (update it at the end of every session)
- `docs/AUDIT.md` — audit index of the legacy app (created in Phase 1): table of contents, endpoint
  catalogue, cross-cutting inventories (brand strings, storage keys, polling, access rules, dead code),
  section-2 verification and surprises
- `docs/audit/<module>.md` — feature-by-feature inventory for one module (same names as `src/modules/`;
  app-wide shell behaviour is in `docs/audit/shell.md`). Read only the file(s) for the module you are working on.

Phase 1 is complete. Before trusting a backend line number, read `docs/audit/_SOURCE_BASELINE.md`:
the audited tree carried the `security-fix` patch, and this workspace does not. The *behaviour* in
`docs/AUDIT.md` §3.1 is authoritative; the local `middleware/verifyDirectusToken.js` is not.

## Hard rules

1. **`../old-ecap-pmp` is read-only reference material.** Never edit, delete, move, format,
   install packages in, or run git commands that change anything there. The same applies to
   `../ecap-plus-pmp-backend`. All new work, docs and scripts live in this folder.
2. **Real backend, no mock data.** The app always talks to the existing live backend (DQA API +
   Directus) configured in `.env`; endpoints and response shapes do not change during this migration.
   The only exception is the training log, which has no API yet and keeps clearly labelled demo data.
   MSW and `test/fixtures/` are for automated tests only and must never be wired into `pnpm dev` or the build.
   Backend source (`../ecap-plus-pmp-backend`) is read-only reference.
3. **Port behaviour, not code.** Read the legacy implementation to learn *what* it does
   (endpoints, params, fields, filters, edge cases, permissions), then write it fresh using the
   patterns in this file. Never copy large blocks of legacy code.
4. **Never hardcode branding or program details.** App name, organisation, logos, contact
   details, country, geography, fiscal-year rules, sub-populations and domain terms come from
   `@/config`. `pnpm check:brand` must pass.
5. **No secrets in `VITE_*` variables.** Every `VITE_*` value is shipped to the browser.
   Service-account credentials, API keys and passwords never go in this repo or its env files.
6. **Respect module boundaries** (see below). Lint enforces them. Never disable a lint rule
   to make code pass; fix the design instead, or ask.
7. **Stay in scope.** Work only on the current phase or module named in the prompt. Note
   anything else you notice in `docs/PROGRESS.md` under "Follow-ups" instead of fixing it.
8. **Ask before adding a dependency** that is not listed in the plan's stack section.
9. **Definition of done:** `pnpm check` passes (typecheck, lint, unit tests, brand check,
   build), the module's Playwright smoke test passes, its `docs/audit/<module>.md` items are ticked, and
   PROGRESS.md is updated.

## Commands

```
pnpm dev            # dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint (includes boundary rules)
pnpm test           # vitest
pnpm test:e2e       # playwright
pnpm check:brand    # fails if branding/program strings are hardcoded outside src/config
pnpm check          # all of the above except e2e — run before declaring anything done
```

Audit maintenance (Phase 1 tooling, kept for later phases — none of it ships):

```
python3 scripts/check-citations.py          # re-open every legacy:/backend: citation in docs/
python3 scripts/check-citations.py --strict # also flag blank lines and >120-line ranges
python3 scripts/merge-audit-drafts.py       # rebuild docs/audit/<module>.md from _drafts/step3/
python3 scripts/build-file-map.py --write   # regenerate AUDIT.md section 8
python3 scripts/draft-fixtures.py           # regenerate test/fixtures/ (deterministic)
python3 scripts/draft-fixtures.py --check   # fail if fixtures are stale
```

Run `check-citations.py` after editing any audit file; it takes under a second. An unresolved
citation is only acceptable if it names one of the patch-only backend files listed in
`docs/audit/_SOURCE_BASELINE.md`.

## Structure and import rules

```
src/
  app/        Shell: providers, router assembly, layouts, error boundaries, module loader
  config/     site.config.ts, program.config.ts, env.ts, features.ts
  core/       Shared kernel: api clients, auth, access control, ui (shadcn), lib, hooks
  platform/   Cross-cutting capabilities: data-table, filters, export, search,
              notifications, scope (geography + fiscal year), freshness, charts, states
  modules/    One folder per feature (households, vcas, services, ...)
```

| Layer          | May import from                                                        |
| -------------- | ---------------------------------------------------------------------- |
| `config`       | nothing (pure data + zod)                                              |
| `core`         | `config`                                                               |
| `platform`     | `core`, `config`                                                       |
| `modules/<x>`  | `platform`, `core`, `config`, and **only the `index.ts`** of another module |
| `app`          | everything                                                             |

No layer imports `app`. No deep imports into another module (`@/modules/vcas/api/...` is forbidden;
`@/modules/vcas` is allowed). Shared business logic never goes in `core` or `platform`: if it
mentions a domain concept (household, VCA, service, flag), it belongs in a module.

## Module anatomy

```
src/modules/households/
  index.ts        Public API: the manifest + anything other modules may use (path builders, types)
  manifest.ts     Routes, nav items, permissions, feature flag, search providers, widgets, legacy redirects
  routes/         Page components. Thin: compose hooks + platform components. Target < 250 lines.
  components/     Module-specific UI pieces
  api/
    endpoints.ts  Fetch functions using core api clients
    schemas.ts    Zod schemas for raw responses + normalisers into domain types
    queries.ts    Query key factory + queryOptions()
  model/          Domain types and pure helpers, with unit tests
  table.tsx       Column, filter and export definitions for the module's tables
  __tests__/      Unit tests; e2e smoke test lives in /e2e/<module>.spec.ts
```

Keep files under ~400 lines. If a page grows past ~250 lines, extract components or hooks.

## Data rules

- All HTTP goes through `core/api` clients. No raw `fetch` in modules.
- Every response is parsed with zod in the module's `api/schemas.ts` and normalised into a
  domain type. Components never see raw API shapes and never guess field names
  (no `pickValue(record, ["vca_id", "vcaid", "child_id"])` in UI code; that belongs in a normaliser, once).
- Query keys come from the module's key factory. Export `queryOptions` and reuse them
  (the search provider and the register page must share the same cache entry).
- Scope (province/district) and fiscal-year window come from `platform/scope` hooks and are
  always part of the query key.
- Queries backed by warehouse/ETL data set `meta: { etl: true }` so the freshness service can
  invalidate them. Queries containing user-private data set `meta: { persist: false }`.
- Detail pages read IDs from **route params** (`/households/:householdId`), never from
  `location.state` or `sessionStorage`.

## Access control

- Use `useAccess()` / `can(permission)` from `core/access`. Never compare role names,
  `description`, `title` or `location` strings anywhere else.
- Route-level permissions are declared in the manifest; the shell enforces them.
- Frontend checks are UX only. Data restrictions must also be enforced by the backend; record
  any gap you find in PROGRESS.md under "Backend asks".

## UI rules

- shadcn/ui components live in `src/core/ui`. Add them with the shadcn CLI only when needed.
- Colours and radii come from theme tokens in `src/app/styles/theme.css`. No hex colours in components.
- Every table uses `platform/data-table`. Every export uses `platform/export`. Every filter is a
  declarative filter definition synced to the URL via `platform/filters`.
- Loading → skeletons. Empty → `<EmptyState>`. Error → `<ErrorState>` with retry.
- The shell wraps every route and every dashboard widget in an error boundary. Don't remove them.
- Decorative animation only where it aids understanding. No new animation libraries.

## TypeScript and style

- `strict: true`. No `any`; use `unknown` and zod. No non-null assertions without a comment.
- Files: kebab-case. Components: PascalCase. Hooks: `useX`. Named exports, except route
  modules where the router's lazy loader expects a specific export.
- Dates: `date-fns` only. Format through `core/lib/format.ts` so formats come from config.

## Testing

- Pure helpers in `model/` and `platform/` need unit tests.
- API layers are tested against MSW handlers that use sanitised fixtures in `test/fixtures/`
  (test-only; development always uses the real backend).
- Each module gets one Playwright smoke test (page loads, table renders, a filter works, export triggers).

## Feature flags

Modules and sub-features are toggled in `src/config/features.ts` (overridable per environment).
Read them with `useFeature()`. When a flag becomes permanent, remove it and note it in PROGRESS.md.
