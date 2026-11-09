# Progress

Updated at the end of every session. Newest entries at the top of each section.

## Current phase

**Phase 1 — Audit, Phase 2 — Scaffold, Phase 3 — Core/shell, and Phase 4 — Platform/pilot: COMPLETE.**
**Phase 5 — Remaining modules: in progress.** The `households` extension and VCAS module are merged.
The `caregivers` service-gap register (`/caregivers/risk`) is implemented on this branch. The next
module in the plan is `services`; live/manual parity, MSW/Playwright, audit checkbox review, backend
pagination/enforcement, and the shared search-provider gap remain open across modules.

## Phase 1 checkpoints

- [x] Step 0 — Outline approved (2026-11-02)
- [x] Step 0b — `docs/AUDIT.md` skeleton written (2026-11-02)
- [x] Step 1 — Backend: conventions + endpoint catalogue (§3.1–3.2). 69/69 routes, each checked by a
      second reader (2026-11-02)
- [x] Step 2 — Frontend API layer (§3.3–3.5): 37 Directus operations, 11 calls with no backend route,
      16 unused wrappers (2026-11-02)
- [x] Step 3 — Module files (2026-11-03, **completed this session**). See "Step 3 outcome" below
- [x] Step 4 — Cross-cutting inventories (§4.1–4.7), section-2 verification (§5), surprises (§6)
      (2026-11-03)
- [x] Step 5 — Coverage review, summary (§1), fixtures (§7, 17 files), file map (§8), final PROGRESS
      update (2026-11-03)

### Step 3 outcome (2026-11-03)

The workflow that stalled at "31/32 readers, 1/24 checkers" was finished without rerunning it:

- **32 drafts preserved** in `docs/audit/_drafts/step3/` (~13,000 lines). The missing reader,
  `support`, was audited in this session (`support--all.md`).
- **All 23 module files are now final** in `docs/audit/`: `scripts/merge-audit-drafts.py` assembles
  each module from its parts, carrying content verbatim (only heading levels, the header blockquote
  and the shared "Legacy files" table are consolidated). Re-running it is safe.
- **2,681 checkboxes** across 23 files (2,402 in the 22 feature modules + 279 in `shell`); §2 of `AUDIT.md` indexes them with route mapping and size.
- **Citation verification** replaced the 23 "checker" agents with a deterministic script:
  `scripts/check-citations.py` checks **6,863** citations. **6,731 resolve**; the 132 that do not are
  fully explained by the source-tree mismatch below (see "Known issue"). Fifteen load-bearing claims
  were additionally spot-checked by hand — two of them **failed** and were corrected before merge.
  Full detail: `docs/audit/CITATION_REPORT.md`.

**Cost note for future sessions:** the checker pass was the expensive half of step 3. Automating it
cost nothing and found the same class of error. Keep using the script.

### Fixtures (2026-11-03)

The 24 fixture files that steps 1–2 reported were **absent from this checkout** (they were lost with
the interrupted session's scratch space). They are now regenerated:

- `scripts/draft-fixtures.py` drafts **17 files covering all 69 DQA endpoints** plus the 29 Directus
  operations, from the response envelopes and field tables in §3.2/§3.3 — not from live data.
- Deterministic (seeded), so `--check` can gate `pnpm check` in Phase 2.
- Invented names/IDs/phones/dates; **field names, JSON types and nullability preserved exactly**,
  including the quirks (bigint counts as strings, `/mother/total/count` as a number, `DD-MM-YYYY`
  text dates).
- Index and conventions: `AUDIT.md` §7.

### Repo layout change (2026-11-03)

The migration docs originally lived **inside `old-ecap-pmp/docs/`**, which that repo's own CLAUDE.md
declares read-only. They have moved to a new sibling project folder, matching what
`MIGRATION_PLAN.md` §4.1 assumes:

```
ecap-refactor/
  iccms-pmp/            ← the new project (CLAUDE.md, docs/, scripts/, test/fixtures/)
  old-ecap-pmp/         ← legacy frontend, read-only reference (now pristine)
  ecap-plus-pmp-backend/← DQA API, read-only reference
```

So `../old-ecap-pmp` and `../ecap-plus-pmp-backend` in the docs resolve exactly as written when you
work from `iccms-pmp/`. `old-ecap-pmp` retains its own untracked `README.md` and
`FY_FILTER_REVIEW.md`, which the audit cites.

### Known issue — the audited source tree is not the tree in the workspace

The `security-fix` patch was **uncommitted** when the audit was written. This checkout has the trees
**without** it:

- Seven backend files are absent: `lib/userScope.js`, `lib/supersetClient.js`,
  `controllers/supersetController.js`, `routes/supersetRoutes.js`, `config/geography.js`,
  `tests/security.test.js`, `.env.example`.
- `middleware/verifyDirectusToken.js` is the 47-line **pre-patch** version (no `AUTH_MODE`, no
  `PUBLIC_ROUTES`), and `index.js` is 2 lines shorter.

**Nothing in the audit is wrong**; only line numbers in those specific files drift, and the audit now
says so in §0. The new frontend must be built against the *patched* behaviour that §3.1 documents.
Full record: `docs/audit/_SOURCE_BASELINE.md`.

**Action for the developer:** restore those seven files from `old-ecap-pmp/README.md`'s `backend/`
folder if you still have them. 99 of the 132 unresolved citations then resolve with **no audit edit**.

## Decisions

Answers to `MIGRATION_PLAN.md` §10, plus decisions taken later.

| # | Question | Answer | Date |
|---|---|---|---|
| 1 | App name / program | "ICCMS PMP" / "ICCMS" / organisation "PCZ"; logo later; same program | 2026-11-02 |
| 2 | Unreferenced dashboard widgets | Port them (incl. `VcaServicesDashboard`) | 2026-11-02 |
| 3 | `/services/household-services` | Still needed | 2026-11-02 |
| 4 | Support chat / calls / voice notes | Chat **used**; calls and voice notes **not used** | 2026-11-02 |
| 5 | AI assistant | Keep | 2026-11-02 |
| 6 | IndexedDB persistence of beneficiary data | Acceptable, with logout wipe | 2026-11-02 |
| 7 | Backend asks owner/timing | Backend stays exactly as the old project for now | 2026-11-02 |
| 8 | Largest register size | ~260,000 records | 2026-11-02 |
| 9 | Audit layout | Split: `AUDIT.md` index + `docs/audit/<module>.md` | 2026-11-02 |
| 10 | Where does the new project live? | New sibling `iccms-pmp/`; docs moved out of `old-ecap-pmp` | 2026-11-03 |
| 11 | Scope of this session | Finish Phase 1 only | 2026-11-03 |
| 12 | Missing fixtures | Regenerate from the endpoint catalogue | 2026-11-03 |
| 13 | Sub-population vocabulary | **Unify**: 14 keys, unprefixed labels (`CALHIV`, `CWLHIV`, …) on every screen, with `dataKey` for the long-form columns and `registers` for per-screen visibility | 2026-11-03 |
| 14 | Geography | **Confirmed**: 2 provinces / 12 districts as in `districts.ts` and `backend:config/geography.js` | 2026-11-03 |
| 15 | Assistant name | **Keep "Bumi"**, set once as `siteConfig.assistant.name` | 2026-11-03 |
| 16 | Support e-mail | **Keep `info@bluecodeltd.com`** for now as `siteConfig.organization.supportEmail` | 2026-11-03 |
| 17 | Patch files | **Supplied and verified** — applied to scratch trees; all 6,863 citations resolve | 2026-11-04 |
| 18 | Brand assets | **Neutral placeholders** for now; real assets supplied later | 2026-11-04 |
| 19 | Access tiers | **Three disjoint tiers**: `admin` (everything, a separate user), `province` (assigned provinces only), `district` (assigned districts only). No union of the nine legacy inference sites — see open question 5 | 2026-11-04 |
| 20 | Build tool | **Vite 8** + `@vitejs/plugin-react-swc`; CRA/CRACO retired | 2026-11-04 |
| 21 | Server state | **TanStack Query v5** as the single server-state layer; no hand-rolled `useEffect` fetching | 2026-11-04 |
| 22 | TypeScript | **`strict: true` from day one**, plus `noUncheckedIndexedAccess`. Pinned to **TS 6.0.3**, not 7.0 — `typescript-eslint` refuses to run against TS 7 | 2026-11-04 |
| 23 | Env vars | `VITE_`-only, zod-validated in `src/config/env.ts`; missing/malformed values throw at startup; removed vars and any `REACT_*` var abort startup | 2026-11-04 |
| 24 | Sub-population shape | **Flat array** with one optional `registers` field per row (7 on household, 14 on VCA). Simpler to read than a grouped map and the per-screen split stays data, not code | 2026-11-04 |
| 25 | District scope | **A district user sees only data tagged with their assigned district** — no cross-district visibility, no "all districts" option | 2026-11-04 |
| 26 | `/districts` module | **Hidden from the sidebar AND route-guarded** for district users. Compare-across-districts has no meaning for a user who may only see one | 2026-11-04 |
| 27 | District switcher | **Fixed label, not a dropdown.** A district user's scope *is* their district (decision 25), so there is nothing to switch to | 2026-11-04 |
| 28 | PCZ website | **Not needed.** No website link is rendered anywhere; `siteConfig.organization.website` is removed rather than shipped as `example.org` | 2026-11-04 |
| 29 | Brand assets | **Placeholders stay.** The developer replaces the four files in `public/brand/` later; no code change will be needed | 2026-11-04 |
| 30 | Contract fixtures | Backend rule sets are copied **verbatim** from `backend.patch` into `test/contract/*.cjs` by `scripts/sync-backend-contract.mjs`; only the two `require` targets are rewritten so the frontend does not depend on `axios` | 2026-11-04 |
| 31 | Access parity | `deriveAccess` mirrors `lib/userScope.js` rule for rule, and **82 tests run the backend's real code** against ours. The single deliberate divergence: an unknown `location` is `level:"none"` here and a raw district on the server | 2026-11-04 |
| 32 | Router rebuild | The router is rebuilt and remounted when the access level changes, so a sign-out cannot leave the previous user's routes mounted | 2026-11-04 |
| 33 | Pagination | **Server-side pagination is required** (developer decision, 2026-11-04). Registers send `page`/`pageSize`/`sort`/`order` and hold one page. Until backend ask #8 lands, `households/api/client.ts` slices locally behind a `MAX_ROWS` cap and **renders that it truncated** | 2026-11-04 |
| 34 | Backend-leaning work | **Standing principle:** any function that requires downloading whole registers (global search, district aggregates, dashboard rollups, exports over 260k rows) moves to the backend rather than being optimised in the browser. Recorded as backend asks, not worked around | 2026-11-04 |
| 35 | Module manifest types | `ModuleManifest` types live in `src/core/modules` (types only), because a module cannot import `app` without breaking the layer rule. The registry that assembles routes stays in `app` | 2026-11-04 |
| 36 | Table state | Filters, sort and page live in the URL (`nuqs`). `district` and `search` are no longer read-only-on-mount | 2026-11-04 |
| 37 | Household profile PII | Mask caregiver/member names and phone numbers in the household profile; do not include those fields in new flag payloads | 2026-11-03 |
| 38 | Household profile flags | Any signed-in user may create/resolve flags **only after** the household has been matched in their scoped active/archive register. Flag list is filtered by household ID. No client-side notification fan-out; defer to a backend flow | 2026-11-03 |
| 39 | VCA profile privacy and flags | Reuse the household profile policy: mask VCA/caregiver/member names and phone numbers; allow signed-in users to create/resolve only after scoped VCA discovery; omit PII from payloads and do not fan out notifications client-side | 2026-11-03 |
| 40 | VCA province and district access | Query only exact configured districts within a user's effective scope (one request per district); never use the empty district path for district/province users | 2026-11-03 |
| 41 | VCA risk service window | Match service events to the selected FY/custom window. Exclude events with missing or unrecognized dates and disclose this; All time mode includes all available history | 2026-11-03 |
| 42 | Caregiver risk navigation | Add a Registers sidebar entry for the otherwise orphaned caregiver service-gap route; add a link from the caregiver services page when that Phase 5 module is built | 2026-11-03 |
| 43 | Caregiver risk service window | Count caregiver service domains only when event dates fall inside the selected FY/custom range; exclude and disclose unparseable/missing dates. All time includes all available history | 2026-11-03 |
| 44 | Caregiver risk privacy | Mask caregiver names in the table and omit names from CSV exports; rows remain household-level and link to the existing scoped household profile | 2026-11-03 |
| 45 | Caregiver risk domain model | Keep the four configured service domains; exclude HIV and other service columns from this risk model | 2026-11-03 |

## Access-rule resolutions

Where the nine legacy rule sites disagreed (`docs/AUDIT.md` §4.4), `deriveAccess` follows the
**backend**, because the backend is what actually enforces the data boundary. Every row below is
pinned by a test in `src/core/access/__tests__/deriveAccess.test.ts`.

| # | Legacy disagreement | Resolution |
|---|---|---|
| 1 | Case sensitivity of `description` | Normalised to lower case everywhere, as the backend does |
| 2 | Role name vs description for admin | Union of both, plus `admin_access`, plus "role but no description and no location/province" — the backend's five conditions |
| 3 | Three definitions of "support" | Only the literal `ecap+ support` grants national access; `Role: support` also lands national via the role-name path, as on the server |
| 4 | `"Provincial Officer"` | Accepted — any description containing `province`/`provincial` makes a province user |
| 5 | `VITE_DEFAULT_DISTRICT` fallback | **Removed.** No scope means `level:"none"` and a "no data scope assigned" screen |
| 6 | Route guards | Permissions gate routes; unregistered means unreachable (finding S2) |
| 7 | Sidebar group filter | Groups are derived from manifests; a fully hidden group disappears (finding S3) |

## Installed versions

Installed 2026-11-04, pinned exactly, per the version policy in `MIGRATION_PLAN.md` §3 (latest
stable whose release is **older than 14 days**). Where the newest release was too fresh, the last
compliant version was taken and is noted.

| Package | Version | Note |
|---|---|---|
| node | 22 (`.nvmrc`) | |
| pnpm | 12.16.1 | build approvals live in `pnpm-workspace.yaml` |
| react / react-dom | 19.3.1 | |
| vite | 8.3.5 | released 2026-10-21, on the 14-day boundary |
| @vitejs/plugin-react-swc | 4.3.3 | |
| typescript | **6.0.3** | **not 7.0.2** — `typescript-eslint` (8.72.0) hard-errors on TS 7.0 |
| tailwindcss / @tailwindcss/vite | 4.3.3 | 4.3.4 was 2 days old; skipped |
| zod | 4.6.7 | |
| @tanstack/react-query | not installed yet | wired in Phase 3 with the query client |
| react-router | not installed yet | Phase 3 |
| vitest | 4.1.12 | 5.1.0 was too fresh |
| @testing-library/react / jest-dom | 16.3.3 / 7.0.1 | |
| jsdom | 30.1.3 | |
| eslint | 10.13.0 | |
| @eslint/js | 10.0.1 | |
| typescript-eslint | 8.72.0 | |
| eslint-plugin-boundaries | 7.2.1 | uses the v7 `dependencies` rule; v5 names are deprecated |
| eslint-plugin-react-hooks | 7.1.0 | |
| eslint-import-resolver-typescript | 4.4.5 | resolves `@/` for the boundaries plugin |
| prettier | 3.9.10 | |
| knip | 6.42.1 | |
| @playwright/test | not installed yet | Phase 3 |
| msw | not installed yet | Phase 3, tests only |

Deferred to Phase 3 on purpose: `@tanstack/react-query`, `react-router`, `nuxt`/`nuqs`,
`react-hook-form`, `@directus/sdk`, `date-fns`, `lucide-react`, `sonner`,
`@superset-ui/embedded-sdk`, `@tanstack/react-table`, `@tanstack/react-virtual`, Playwright, MSW.
This phase proves the toolchain with the smallest possible dependency set.

## Phase log

| Phase / module | Status | Session date | Notes |
|---|---|---|---|
| 1 Audit | **done + verified** | 2026-11-04 | 23 module files, §1–§8 complete, 17 fixtures; **6,863/6,863 citations resolve** against the patched trees (`scripts/verify-audit.sh`) |
| 0 Preparation | done | 2026-11-04 | `backend.patch` + `legacy-frontend.patch` verified |
| 2 Scaffold | **done** | 2026-11-04 | `pnpm check` green: typecheck, lint (with layer boundaries), prettier, 17 tests, brand check, contract check, fixtures, build |
| 3 Core and shell | **done** | 2026-11-04 | `core/access` (with backend parity tests), `core/api`, `core/auth`, module registry, shell, guards |
| 4 Platform + pilot | **done** | 2026-11-04 | `platform/scope` (FY, URL-first precedence), `platform/filters` (one `applyFilters` for table/count/export), `platform/data-table` (server mode, pagination, column picker), `platform/export` (RFC-4180 + CSV-injection guard); pilot `/households` register end to end; `docs/ADDING_A_MODULE.md`; **192 tests** |
| 5 Remaining modules | **in progress** | 2026-11-03 | Households and VCAS merged. Caregivers and Services are implemented on this branch. Services includes district-fanned registers, selected/latest detail semantics, rolling filters plus FY cohort summaries, safe export, a read-only VCA overview, and legacy redirects. **Still open:** live parity, MSW/Playwright, shared search provider, manual audit review, and backend authorization/scope/pagination follow-ups. |

## Module checklist — households extension (Phase 5)

- [x] `docs/audit/households.md` and the household endpoint catalogue re-read; legacy pages identified in the audit.
- [x] Archived register and profile API calls, normalisation, query keys; scoped before profile by-ID calls.
- [x] Archived register table/filters/export and risk table/export; profile sections and flags.
- [x] Route params, legacy profile query redirect, archived/risk legacy redirects; route pages remain below ~250 lines.
- [x] Manifest feature flag, nav for archived register, and module routes. Risk register remains URL-only, as in legacy.
- [x] Unit/model and rendered-route tests; confirms profile PII masking and no detail/flag requests for out-of-scope IDs.
- [ ] MSW handlers from `test/fixtures` (tests currently use `vi.stubGlobal`; MSW is not installed in this checkout).
- [ ] Playwright smoke test (Playwright/browser not installed in this checkout).
- [ ] Manual comparison against a live legacy/backend session (not available during this implementation).
- [ ] Household search provider (platform search palette/provider is still a Phase 4 gap).
- [ ] Tick the relevant audit-file boxes after the live parity review; notifications require backend Flow.
- [x] `pnpm check` green on the current tree (212 tests; typecheck, lint, format, brand/contract/fixtures checks, and production build included).

## Module checklist — VCAS (Phase 5)

- [x] `docs/audit/vcas.md`, module plan row and VCA endpoint catalogue reviewed; routes and legacy redirects mapped.
- [x] Scoped active/archive API, schemas, normalization, query keys, filters and exports implemented; requests are made per configured allowed district and never use the empty/national endpoint for district or provincial users.
- [x] VCA risk join and domain status/export implemented; service rows are filtered to the selected FY window. Missing/unrecognized service dates are excluded and disclosed; all-time mode is explicitly labeled.
- [x] Profile loads only after matching the VCA in scoped active/archive data, then lazily reads case-plan domains; caregiver/member names and phone numbers are masked and omitted from flag payloads.
- [x] Feature/nav/routes, legacy risk-query redirect, profile query redirect and unit/rendered-route tests implemented. Route pages remain below ~250 lines.
- [ ] MSW handlers from `test/fixtures` (tests use fetch stubs; MSW is not installed in this checkout).
- [ ] Playwright smoke test and live side-by-side comparison (browser/backend session unavailable).
- [ ] Search provider remains blocked on the shared Phase 4 search-provider gap.
- [ ] Review/tick `docs/audit/vcas.md` parity items after manual comparison; flag permission enforcement and notification fan-out require backend work.
- [ ] Decide the VCA derived PBFW labels: current profile shows directly configured sub-populations and deliberately does not infer PBFW from AGYW.
- [x] `pnpm check` green on the current tree (231 tests; typecheck, lint, format, brand/contract/fixture checks, and production build included).

## Module checklist — Caregivers (Phase 5)

- [x] `docs/audit/caregivers.md`, the module inventory row, and caregiver endpoint catalogue reviewed; only the risk register is in this module.
- [x] Scoped household query reused from the public households module surface; caregiver services queried by exact effective-scope districts and response rows validated against their requested district.
- [x] Four-domain coverage join, date parser for ISO and legacy `DD-MM-YYYY`, five risk views, filters, pagination, sorting, and RFC-safe CSV implemented. HIV/other service fields are excluded.
- [x] Service dates are filtered to the selected FY/custom range; missing/invalid dates are excluded and disclosed. All-time mode includes all returned history.
- [x] Caregiver names display as a privacy placeholder and are omitted from CSV. Household IDs link through the existing scoped `/households/:householdId` profile path.
- [x] Route `/caregivers/risk`, legacy query-preserving redirect, authenticated scope guard, Registers navigation, and model/route tests implemented. The planned link back to `/services/caregiver` is deferred until the Services module exists.
- [ ] Shared backend aggregate/pagination endpoint; current client-side safety cap does not bound response bytes downloaded from each endpoint.
- [ ] MSW fixture handlers and Playwright smoke test (not installed in this checkout); live/manual parity and audit checkboxes await a legacy/backend session.
- [ ] Shared search provider remains a platform follow-up; do not search caregiver names.
- [ ] Review caregiver endpoint permissions and district parameter enforcement with backend owners; backend is unchanged in this migration.
- [ ] Confirm treatment of empty/JSON-object category values against production payloads; current helper recursively counts meaningful values.
- [x] `pnpm check` green on the complete caregivers tree (240 tests; typecheck, lint, format, brand/contract/fixture checks, and production build included).

## Open questions for the developer (carried from the audit)

These were raised by the module audits. The ones marked **before Phase 2/3** block writing
`program.config.ts` or `derive-access.ts`.

**Answered (2026-11-03)** — see decisions 13–16 above. Phase 2 can write `src/config` as specified in
`docs/PHASE_2_CONFIG_SPEC.md`.

- ~~Sub-population vocabulary~~ → **unify** on 14 keys, unprefixed labels, `dataKey` + `registers` fields.
- ~~Geography~~ → **confirmed** as 2 provinces / 12 districts.
- ~~Assistant name~~ → **"Bumi"**, from `siteConfig.assistant.name`.
- ~~Support e-mail~~ → **`info@bluecodeltd.com`** for now, from `siteConfig.organization.supportEmail`.

**Answered (2026-11-04) — Phase 3 can write `deriveAccess`**

5. ~~Who is an admin, a province user, a district user?~~ → **three disjoint tiers**, confirmed by the
   developer: an **admin** sees everything in the dashboard and is a *separate user* from the other
   tiers; a **province user** sees only their assigned province(s); a **district user** sees only
   their assigned district(s). No overlap, no inheritance. This matches `backend:lib/userScope.js`
   (`deriveScope` returns exactly one `level` — `all` / `province` / `district` / `none`) and means
   the frontend should **not** union the nine legacy rule sites, which disagreed precisely because
   they tried to infer the tier from free text. See decision 19.
6. ~~Should `/districts` be national + province only?~~ → **answered 2026-11-04**: hidden *and* guarded for district users (decision 26).
7. ~~Should a district user be able to change district within their province?~~ → **answered
   2026-11-04**: no. A district user's scope is their assigned district, so the selector is a fixed
   label (decision 27).

**Before Phase 5 (per module)** — collected in each `docs/audit/<module>.md` under "Open questions",
and in `AUDIT.md` §6 (Surprises). The highest-impact ones:

8. **`/referrals` needs a backend endpoint** before it can reach parity (§6.2).
9. **`/households` and `/vcas` at 260,000 rows** need server pagination or a hard cap (§6.6).
10. **Chat backend** — real table vs Directus notifications; and who may message whom (§6.5,
    `docs/audit/support.md` questions 1–2).

## Follow-ups

Things noticed out of scope, to handle later.

- Phase 2 `check:brand`: scan `src/` only. Fixtures legitimately contain backend field names
  (`ecap_id`) and table names (`*_ecapplus_*`); these are API contracts, not branding. `AUDIT.md` §4.1
  item 10 lists them for the allow-list.
- `old-ecap-pmp/README.md` and `old-ecap-pmp/FY_FILTER_REVIEW.md` are untracked files in the legacy
  repo. The audit cites both. Leave them alone (hard rule 1) but do not rely on them surviving.
- The step-2 drafts (`docs/audit/_drafts/step2/`) still contain 5 stale line citations from the same
  `index.js`/`directus.ts` drift. They are already merged into `AUDIT.md` §3.3–3.5 and are not read by
  later phases, so they were left as-is rather than rewritten.
- Phase 2 has a full config specification in `docs/PHASE_2_CONFIG_SPEC.md` (decisions 13–16 applied),
  including the unified 14-key sub-population list and the two config values still marked
  TODO(dev): the PCZ website URL and the brand asset files.
- `_drafts/` is meant to be deleted at the end of step 5 per the original plan. **Kept deliberately**:
  they are the provenance of the merged module files and cost nothing. Delete them when Phase 6
  starts, after the module files have been used in anger at least once.
- Assistant-driven theme changes: the AI can emit a `change_color` JSON block that `ThemeContext`
  applies and **persists in `localStorage`** (`AUDIT.md` §6.11). Decide in Phase 5 whether to keep it.

## Backend asks

Gaps found that need backend work (`MIGRATION_PLAN.md` §8). Status as of this session.

| # | Ask | Status | Evidence |
|---|---|---|---|
| 1 | Superset guest tokens issued by the backend; auth required everywhere | **Patched** — but the patch files are missing from this workspace | `AUDIT.md` §3.1.2, §3.2; `_SOURCE_BASELINE.md` |
| 2 | Enforce data scope server-side (S9) | **Open.** 35/69 endpoints trust a caller-supplied district, 7 ignore district, 10 are by-ID with no ownership check | `AUDIT.md` §3.2 |
| 3 | Explicit roles and scopes on the Directus user instead of free text | **Open.** 9 client-side rule sites infer scope from `description`/`title`/`location` | `AUDIT.md` §4.4 |
| 4 | `GET /search?q=&types=&limit=` scoped to the caller | **Open.** Global search downloads whole registers today | `AUDIT.md` §5.3 |
| 5 | By-ID endpoints for records passed through `location.state` (mother index, service records, caseworkers) | **Open.** Household profile still has to discover the row in the scoped active/archive lists; only then are detail requests enabled. Ask for a household-by-ID endpoint with server-side ownership checks | `docs/audit/households.md`, profile questions 1–2 |
| 6 | Refresh tokens or cookie-mode sessions | **Open.** Only the access token is kept; no refresh call exists | `AUDIT.md` §4.2, S6 |
| 7 | Assistant system prompt moved server-side | **Open.** Prompt is in `src/lib/ai-service.ts:30-70` and includes off-programme districts | `AUDIT.md` §6.11 |
| 8 | Server-side pagination/filtering for large registers | **Open, and now urgent**: `/household/all-households` and `/child/vcas-assessed-register` have no ORDER BY/LIMIT at 260k rows | `AUDIT.md` §6.6 |
| 9 | **New:** a district-scoped, FY-aware referrals endpoint | **Open, blocks `/referrals` parity** | `AUDIT.md` §6.2, `docs/audit/referrals.md` |
| 10 | **New:** a real chat table (sender, recipient, body, file, priority, read_at) to replace Directus notifications, and a rule for who may message whom | **Open** | `docs/audit/support.md` questions 1–2 |
| 11 | **New:** a per-district aggregate endpoint so `/districts` need not download every register plus N count calls | **Open** | `docs/audit/districts.md` |
| 12 | **New:** signed short-lived URLs for downloads, SSE and assets instead of `?token=` / `?access_token=` | **Open** — the token leaks into logs and history today | `AUDIT.md` §3.1.2, §4.2 |
| 13 | **New:** server-side scope enforcement on Directus flag list/create/resolve and notification fan-out via a backend Flow | **Open.** The UI verifies the household is in the user's scoped register and filters flags by household ID, but Directus permissions must enforce ownership too | `docs/audit/households.md`, profile flag form and Backend asks |
| 14 | **New:** repair the broken VCA profile-by-ID endpoint and enforce scope/ownership on VCA service, case-plan, domain, referral and flag reads/writes | **Open.** The profile verifies membership in scoped active/archive registers before issuing by-ID reads, but the current backend endpoints lack server-side ownership checks and the profile endpoint reads the wrong route parameter | `docs/audit/vcas.md` profile endpoints and questions 1–3 |
| 15 | **New:** provide a scoped server-side caregiver domain-coverage/pagination endpoint (or pagination on household and caregiver-service reads) | **Open.** The new screen scopes district requests and caps retained rows, but existing handlers return unbounded service collections; a client cap cannot constrain response transfer | `docs/audit/caregivers.md` performance question 6 |

## Scripts added this session

All in `iccms-pmp/scripts/`. None is part of the app bundle; all are developer aids.

| Script | Purpose |
| --- | --- |
| `check-citations.py` | Re-opens every `legacy:`/`backend:` citation; reports missing files, out-of-range lines, blank lines and implausibly wide ranges |
| `merge-audit-drafts.py` | Assembles `docs/audit/<module>.md` from the step-3 part drafts, verbatim |
| `build-file-map.py` | Regenerates `AUDIT.md` §8 from the modules' "Legacy files" tables, so it cannot drift |
| `draft-fixtures.py` | Regenerates `test/fixtures/*.json` from the endpoint catalogue, deterministically |

## Module checklist — Services (Phase 5)

- [x] Config-driven `/services/:type` VCA, household, caregiver registers and query-preserving legacy redirects; preserve `/services/household-services` as a static compatibility route.
- [x] `/services/:type/:entityId?date=…` uses the entity ID as route key, resolves the selected row inside scope, keeps the selected visit date, and discloses when the backend's allowlisted detail belongs to the latest service instead.
- [x] District users remain fixed to their district; provincial queries fan out per configured allowed district; rows are revalidated against requested district and all-district sentinels are avoided for scoped users.
- [x] Platform FY/custom cohort summary and separate rolling 30/90/365/all records control are clearly distinguished. Summary dates are sent; record queries use rolling windows only, matching backend behavior.
- [x] Type-specific domain options/column mappings, supported Active mapping, safe field-allowlist detail, privacy-conscious CSV, read-only `/services/vca/overview`, no duplicate-review writes.
- [x] React Query module keys and transient non-persisted service payloads; schema/scope/fan-out tests added.
- [ ] Backend follow-ups recorded in `docs/audit/services.md`: handler authorization and scope enforcement, exact historical visit lookup, duplicate-review write permission/scope, and bounded server pagination/aggregation.
- [x] Complete validation passed: `pnpm check` (246 tests; typecheck, lint, formatting, brand/contract/fixture checks, and production build).
- [ ] Review actual response parity with a live backend and add MSW/Playwright coverage when those test handlers are available.
