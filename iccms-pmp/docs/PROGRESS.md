# Progress

Updated at the end of every session. Newest entries at the top of each section.

## Current phase

**Phase 1 — Audit: COMPLETE (2026-11-03).** Next: **Phase 2 — Scaffold and tooling**.
Phase 0 items are assumed done by the developer (§Phase 0), with one exception recorded under
"Backend asks".

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
| 17 | Patch files | Developer has `backend.patch` and `legacy-frontend.patch`; to be supplied for citation verification | 2026-11-03 |

## Installed versions

(filled in Phase 2)

## Phase log

| Phase / module | Status | Session date | Notes |
|---|---|---|---|
| 1 Audit | **done** | 2026-11-03 | 23 module files, §1–§8 complete, 17 fixtures, 6,863 citations checked |
| 0 Preparation | assumed done | | Backend source present; **patch files missing** — see "Known issue" |
| 2 Scaffold | not started | | Next session |

## Module checklist

(copy the Phase 5 per-module checklist here for each module as it starts)

## Open questions for the developer (carried from the audit)

These were raised by the module audits. The ones marked **before Phase 2/3** block writing
`program.config.ts` or `derive-access.ts`.

**Answered (2026-11-03)** — see decisions 13–16 above. Phase 2 can write `src/config` as specified in
`docs/PHASE_2_CONFIG_SPEC.md`.

- ~~Sub-population vocabulary~~ → **unify** on 14 keys, unprefixed labels, `dataKey` + `registers` fields.
- ~~Geography~~ → **confirmed** as 2 provinces / 12 districts.
- ~~Assistant name~~ → **"Bumi"**, from `siteConfig.assistant.name`.
- ~~Support e-mail~~ → **`info@bluecodeltd.com`** for now, from `siteConfig.organization.supportEmail`.

**Still open — blocks Phase 3 (`deriveAccess`)**

5. **Who is an admin, a province user, a district user?** Nine rule sites disagree (§4.4). The audit
   proposes a resolution — union of the admin rules, no `VITE_DEFAULT_DISTRICT` fallback, unscoped
   users get `level: "none"` and a "no data scope assigned" state. Confirm or override per row.
6. **Should `/districts` be national + province only?** Legacy hides it from district users in the
   sidebar but leaves the route open and serving national data.
7. **Should a district user be able to change district within their province?** Legacy's province
   branch allows it and the district branch does not; the Referrals page has a bug that makes the
   selector snap back either way.

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
| 5 | By-ID endpoints for records passed through `location.state` (mother index, service records, caseworkers) | **Open** — blocked only for some records; `/etl/services/:type/record-detail` may cover service records | each module's "Links in / out" |
| 6 | Refresh tokens or cookie-mode sessions | **Open.** Only the access token is kept; no refresh call exists | `AUDIT.md` §4.2, S6 |
| 7 | Assistant system prompt moved server-side | **Open.** Prompt is in `src/lib/ai-service.ts:30-70` and includes off-programme districts | `AUDIT.md` §6.11 |
| 8 | Server-side pagination/filtering for large registers | **Open, and now urgent**: `/household/all-households` and `/child/vcas-assessed-register` have no ORDER BY/LIMIT at 260k rows | `AUDIT.md` §6.6 |
| 9 | **New:** a district-scoped, FY-aware referrals endpoint | **Open, blocks `/referrals` parity** | `AUDIT.md` §6.2, `docs/audit/referrals.md` |
| 10 | **New:** a real chat table (sender, recipient, body, file, priority, read_at) to replace Directus notifications, and a rule for who may message whom | **Open** | `docs/audit/support.md` questions 1–2 |
| 11 | **New:** a per-district aggregate endpoint so `/districts` need not download every register plus N count calls | **Open** | `docs/audit/districts.md` |
| 12 | **New:** signed short-lived URLs for downloads, SSE and assets instead of `?token=` / `?access_token=` | **Open** — the token leaks into logs and history today | `AUDIT.md` §3.1.2, §4.2 |

## Scripts added this session

All in `iccms-pmp/scripts/`. None is part of the app bundle; all are developer aids.

| Script | Purpose |
| --- | --- |
| `check-citations.py` | Re-opens every `legacy:`/`backend:` citation; reports missing files, out-of-range lines, blank lines and implausibly wide ranges |
| `merge-audit-drafts.py` | Assembles `docs/audit/<module>.md` from the step-3 part drafts, verbatim |
| `build-file-map.py` | Regenerates `AUDIT.md` §8 from the modules' "Legacy files" tables, so it cannot drift |
| `draft-fixtures.py` | Regenerates `test/fixtures/*.json` from the endpoint catalogue, deterministically |
