# Progress

Updated by Claude Code at the end of every session. Newest entries at the top of each section.

## Current phase

Phase 1 — Audit (in progress; PAUSED at step 3 — see "Step 3 checkpoint")

## Phase 1 checkpoints

Resume from the first unticked step. The audit is split: `docs/AUDIT.md` is the index (TOC, endpoint
catalogue, cross-cutting inventories, section-2 verification, surprises); each module has
`docs/audit/<module>.md` (app-wide behaviour in `docs/audit/shell.md`). Draft fixtures go in `test/fixtures/`.

Sources audited (working tree as found, read-only): `../old-ecap-pmp` and `../ecap-plus-pmp-backend`,
both on branch `security-fix` with the patch **uncommitted** in the working tree.

- [x] Step 0 — Outline approved (split audit; 1 verifier per section-2 finding, 3 for S1–S9). CLAUDE.md and
      MIGRATION_PLAN.md (folder tree, Phase 1/4/5/6 text, section 9 prompts) now point to `docs/AUDIT.md` + `docs/audit/<module>.md`. (2026-11-02)
- [x] Step 0b — `docs/AUDIT.md` skeleton written; unfilled sections are marked `<!-- PENDING: step N -->`. (2026-11-02)
- [x] Step 1 — Backend: DQA conventions + endpoint catalogue (AUDIT.md §3.1–3.2) + DQA fixtures. (2026-11-02)
      69/69 registered routes documented, each checked by a second agent (93 corrections applied). 16 fixture files
      `test/fixtures/dqa-*.json` (valid JSON, invented data; `ecap_id` etc. are backend field names, kept).
      "Used by" column in §3.2 still says "step 2".
- [~] Steps 2 and 3 running in parallel (2026-11-02; restarted after a session interruption lost the first run's
      session-scratch drafts). Intermediate drafts now live in `docs/audit/_drafts/step{2,3}/` so they survive
      interruptions; `_drafts/` is deleted at the end of step 5. Step 3 writes `docs/audit/<module>.md` directly; its
      §2/§8 drafts are spliced into AUDIT.md after step 2's writers finish. If interrupted again: any
      `docs/audit/<module>.md` that exists has already been citation-checked; re-run only the missing modules.
      2026-11-03: step 3 relaunched from scratch (previous attempt hit the usage limit before writing anything).
      2026-11-03: second attempt hit the usage limit after 17 readers (19 drafts in `_drafts/step3/`); resumed with
      max 5 concurrent agents. Developer will decide on step 4 after step 3, depending on remaining usage.

### Step 3 checkpoint — PAUSED by developer (2026-11-03, ~80% of usage window spent)

State on disk:
- **Readers: 31/32 done.** Drafts in `docs/audit/_drafts/step3/<module>--<part>.md` for every part except
  `support--all` (not started/finished).
- **Checkers (verify + merge → `docs/audit/<module>.md`): 1/24 done** — `docs/audit/shell.md` is final.
- Remaining: reader `support/all`; checkers for auth, dashboard, districts, analytics, households, vcas,
  caregivers, services, hts, pmtct, mother-index, referrals, flags, performance, caseworkers, training-log,
  calendar, users, account, data-pipeline, support, docs, assistant (23); then the index agent (§2/§8 drafts →
  `_drafts/step3/section-2.md`, `section-8.md`).
- Estimated remaining cost: 1 reader + 23 checkers (each re-reads its module source) + 1 index ≈ more than the
  readers cost so far; consider running checkers on a cheaper model or checking only high-risk modules
  (shell ✓, auth, households, vcas, services, data-pipeline) — developer to decide.

How to resume (in order of preference):
1. Same workflow run, if the session still has it: `Workflow({scriptPath: "~/.claude/projects/-home-merx-WebstormProjects-iccms-pmp/e2044865-fd95-4cc4-b905-4cdc2a1a8132/workflows/scripts/audit-step3-modules-wf_31aa2785-457.js", resumeFromRunId: "wf_31aa2785-457"})`
   — the 31 readers and check:shell replay from cache; limiter is set to 5 concurrent agents (`MAX_CONCURRENT`).
   Do not edit reader/checker prompt text, or cached work is re-run.
2. If the run cache is gone: run a new "checkers only" workflow over the drafts already on disk (one agent per
   missing module: read `_drafts/step3/<module>--*.md`, verify citations against legacy source, write
   `docs/audit/<module>.md`), plus one reader for `support`. Skip `shell` (done).
After step 3: splice `section-2.md` → AUDIT.md §2 and `section-8.md` → AUDIT.md §8, tick step 3, then stop
(developer decides on step 4).
- [x] Step 2 — Frontend API layer: Directus, external services, mismatches (AUDIT.md §3.3–3.5) + Directus fixtures. (2026-11-02)
      §3.2 "Used by" filled for 69/69 endpoints (20 have no live legacy caller). §3.3 covers 37 Directus operations;
      §3.5 lists 11 frontend calls with no backend route and 16 unused wrappers. 8 fixture files
      `test/fixtures/directus-*.json` (29 endpoints, incl. one fixture user per legacy role pattern), checked.
- [ ] Step 3 — Module files `docs/audit/*.md` + `shell.md` (+ citation checks), module index (§2), file map (§8)
- [ ] Step 4 — Cross-cutting inventories (§4), section-2 verification (§5), surprises (§6)
- [ ] Step 5 — Coverage review, summary (§1), fixtures index (§7), final PROGRESS update

## Decisions (answers to MIGRATION_PLAN.md section 10, plus later decisions)

| # | Question | Answer | Date |
|---|---|---|---|
| 1 | App name / program | App name "ICCMS PMP", short name "ICCMS", organisation "PCZ"; logo to be provided later; same program (geography, sub-populations, fiscal year) | 2026-11-02 (from plan §10) |
| 2 | Unreferenced dashboard widgets | Port them (incl. `VcaServicesDashboard`) | 2026-11-02 (from plan §10) |
| 3 | `/services/household-services` | Still needed | 2026-11-02 (from plan §10) |
| 4 | Support chat / calls / voice notes | Not used (calls, chat, voice notes) | 2026-11-02 (from plan §10) |
| 5 | AI assistant | Keep | 2026-11-02 (from plan §10) |
| 6 | IndexedDB persistence of beneficiary data | Acceptable (shared computers unlikely), with logout wipe | 2026-11-02 (from plan §10) |
| 7 | Backend asks owner and timing | Backend stays exactly as the old project for now | 2026-11-02 (from plan §10) |
| 8 | Largest register size | ~260,000 records | 2026-11-02 (from plan §10) |
| 9 | Audit layout | Split: `docs/AUDIT.md` index + `docs/audit/<module>.md` | 2026-11-02 |

## Installed versions

(filled in Phase 2)

## Phase log

| Phase / module | Status | Session date | Notes |
|---|---|---|---|
| 1 Audit | in progress | 2026-11-02 | See "Phase 1 checkpoints" |
| 0 Preparation | done by developer (assumed) | | Backend source present at `../ecap-plus-pmp-backend` |

## Module checklist

(copy the Phase 5 per-module checklist here for each module as it starts)

## Follow-ups

Things noticed out of scope, to handle later.

- Phase 2 `check:brand`: scan `src/` only (as the plan says). Fixtures legitimately contain backend field
  names such as `ecap_id` and table/file names such as `*_ecapplus_*`; these are API contracts, not branding.

## Backend asks

Gaps found that need backend changes (see MIGRATION_PLAN.md section 8).
