# training-log — legacy audit
> New module `training-log` · Legacy routes → new routes: `/training-log` → `/training-log` · Plan: MIGRATION_PLAN.md §5 row "training-log" (flag `module.trainingLog`, off in production until a real endpoint exists; demo data only per hard rule 2 and decision "training log stays demo data behind a flag")

The whole module runs on **client-generated demo data**. There is no DQA or Directus endpoint (AUDIT.md §2.3 "Related cases"; no training route exists in the backend — a grep of `../ecap-plus-pmp-backend` for "training" found no matches). This document therefore focuses on (a) the UI behaviour to port and (b) the data model, so a future API can be designed against it.

## Legacy files
| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/pages/TrainingLog.tsx` | 510 | Route page: KPIs, filters, table, pagination, CSV export, opens the trainee modal. Includes the `EnrollmentRow` sub-component (`:437-508`). |
| `legacy:src/components/TraineeRecordModal.tsx` | 285 | Dialog: one trainee's record across every training they attended; per-training collapsible section; PDF download. Sub-components `TrainingSection`, `Stat`, `Detail`, `Legend`. |
| `legacy:src/constants/mockData.ts` | 384 | Seeded generator `generateMockTrainingLog()` producing `{ trainings, participants }`. |
| `legacy:src/constants/api.ts` | 29 | `TRAINING_LOG_IS_MOCK = true` and `getTrainingLog()` (300 ms delay + mock). Contains the intended future-endpoint comment. |
| `legacy:src/constants/types.ts` | 96 | Data model mirroring the paper "Training Attendance Log" form; `PARTNERS`, `TARGET_AUDIENCES`, `MAX_SESSIONS`. |
| `legacy:src/constants/utils.ts` | 235 | Derived `Enrollment` model, status rules, formatters, search, CSV headers/rows. |
| `legacy:src/constants/pdf.ts` | 215 | jsPDF + jspdf-autotable trainee record PDF (lazy-imported). |
| `legacy:src/lib/csv.ts` | 29 | Generic `downloadCsv` (shared app-wide helper). |
| `legacy:src/App.tsx` (lines 1-30, 136-235, 400-440) | 602 | Eager import (`:21`) and route (`:421-427`). |
| `legacy:src/components/dashboard/AppSidebar.tsx` | 346 | Nav entry `:94`. |
| `legacy:src/components/dashboard/MobileBottomNav.tsx` | 52 | No entry. |
| `legacy:src/components/dashboard/DashboardLayout.tsx` (lines 1-60) | 110 | Mobile menu list has no entry. |
| `legacy:src/components/dashboard/GlobalSearch.tsx` (nav list) | 212 | No entry. |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | **Not used** by this module. |
| `legacy:src/components/auth/ProtectedRoute.tsx` | 23 | Route guard. |

Note: `constants/api.ts`, `types.ts`, `utils.ts`, `pdf.ts` and `mockData.ts` live under the generic `src/constants/` folder but are used **only** by this module (grep: only `TrainingLog.tsx` and `TraineeRecordModal.tsx` import them). In the rebuild they all belong inside `src/modules/training-log/` (model/, api/, a demo-data file).

## Route `/training-log` → `/training-log`

### Purpose
"Training Attendance Log" (`legacy:src/pages/TrainingLog.tsx:191`), subtitle "Trainees, session attendance and test results from the training log form." (`:199`). Lists one row per trainee per training (an "enrolment"), with KPIs, filters, CSV export and a per-trainee drill-down modal with PDF.

### Access
- [ ] Route guard: `ProtectedRoute` only, no role check (`legacy:src/App.tsx:421-427`). `ProtectedRoute` returns `null` while auth loads, redirects to `/` with no user, and to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`).
- [ ] Sidebar: section "Services", item `{ title: "Training Log", url: "/training-log", icon: ClipboardCheck }` (`legacy:src/components/dashboard/AppSidebar.tsx:94`). No item-specific rule; visible to every logged-in user (filters at `:164-176` only touch `/districts`, "Admin" and "Data Pipeline"). In the rebuild, visibility must additionally depend on the `module.trainingLog` feature flag.
- [ ] Mobile bottom nav: no entry (`legacy:src/components/dashboard/MobileBottomNav.tsx:5-11`). DashboardLayout mobile menu: no entry (`legacy:src/components/dashboard/DashboardLayout.tsx:33-45`). Global search nav: no entry (`legacy:src/components/dashboard/GlobalSearch.tsx:34-45`).
- [ ] In-page role/permission checks: **none**. No `isAdmin`, `description`, `title` or `location` comparison in any of the module files.
- [ ] Data scope: **none**. The page does not call `useEffectiveDistrict` or the FY filter; `getTrainingLog()` takes no arguments (`legacy:src/constants/api.ts:25`). A district user sees every district's trainings. The only district control is the in-page client-side District filter (below). **QUESTION**: when a real API exists, should the list be scoped by the user's province/district and FY window like other modules (the api.ts comment suggests `fyQs(fy)`, `legacy:src/constants/api.ts:17`)? Recommend yes: scope + FY in the query key per CLAUDE.md data rules, with backend enforcement.

### Endpoints
- [ ] **No HTTP call.** `getTrainingLog()` waits 300 ms (`legacy:src/constants/api.ts:27`, "so loading states are visible while testing") then returns `generateMockTrainingLog()` with default options (`:28`).
- [ ] React Query: key `["training-log"]`, `queryFn: getTrainingLog`, `staleTime: 5 * 60 * 1000`; no gcTime/refetchInterval/meta (`legacy:src/pages/TrainingLog.tsx:75-79`). Always enabled.
- [ ] Persistence quirk: the app-wide persister dehydrates every successful query (`legacy:src/App.tsx:220-222`) into IndexedDB key `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`), max age 24 h (`:218`) — so the demo log is persisted too. In the rebuild, set `meta: { persist: false }` (contains personal data: names, NRCs) and do not set `etl: true` until a warehouse-backed API exists.
- [ ] Intended future endpoint (comment only, does not exist): `dqaGet(\`/training/log${fyQs(fy)}\`)` returning `{ trainings: Training[], participants: TrainingParticipant[] }` (`legacy:src/constants/api.ts:13-23`; AUDIT.md §2.3). Record as a **Backend ask**.
- [ ] Client-side post-processing: `buildEnrollments(data)` (`legacy:src/pages/TrainingLog.tsx:90-93`, `legacy:src/constants/utils.ts:106-150`) joins each participant to its training by `trainingId` (participants with unknown training are dropped, `:115-116`), derives `status`, `held`, `attended`, `scoreChange`, `personKey`, `searchText`, then sorts by training `startDate` desc, then training `id` asc, then `rowNumber` asc (`:144-149`).

### Data model (for a future API)
Paper form has two levels: a training header block and one numbered row per trainee (`legacy:src/constants/types.ts:1-10`).

**`Training`** (`legacy:src/constants/types.ts:33-62`)
| Field | Type | Paper-form label (comment) |
| --- | --- | --- |
| `id` | string | — (mock format `TRN-<startYear>-<NNNN>`, `legacy:src/constants/mockData.ts:295`) |
| `title` | string | "Title of Training" |
| `materials` | string | "Name of the training materials / manual used" |
| `partner` | `Partner` (one of `PARTNERS`) | "Partner Supporting Training" |
| `healthFacility` | string | — |
| `site` | string | "Training / Activity Site" |
| `district` | string | "District of Training Site" |
| `trainers` | string[] | "Name(s) of Trainer(s)/Facilitator(s)" — "Surname, First name" each |
| `startDate`, `endDate` | ISO `YYYY-MM-DD` strings | — |
| `isMasterTrainerTraining` | boolean | "Is it Training of Master Trainers?" |
| `targetAudience` | `TargetAudience[]` | multi-tick |
| `targetAudienceOther?` | string | free text when "Other (specify)" ticked |
| `totalSessions` | number | "Total Number of Sessions to be Covered" |
| `totalHours` | number | "Number of Training Hours Total" (mock uses half-hour steps, `mockData.ts:316`) |
| `sessions` | `{ number: number /* 1-based */, title: string }[]` | "Session N" |

**`TrainingParticipant`** (`legacy:src/constants/types.ts:64-91`)
| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | mock `<trainingId>-P<NN>` (`mockData.ts:366`) |
| `trainingId` | string | FK to `Training.id` |
| `rowNumber` | number | "#" column |
| `name` | string | "Surname, First name" |
| `nrc` | string | "NRC #" — national registration card number, format `NNNNNN/NN/N` (comment `types.ts:71`) |
| `sex` | `"Male" \| "Female"` | |
| `designation` | string | "Designation / Institution", single free-text field |
| `attendance` | `(boolean \| null)[]` | index 0 = Session 1, length = `totalSessions`; `true` signed/present, `false` held but absent, `null` not held yet (`types.ts:76-82`) |
| `completedTraining` | boolean \| null | "Completed Training (Yes/No)", null until the training ends |
| `preTest`, `postTest` | number \| null | percentage 0-100 |
| `certified` | boolean \| null | "Certified? (Yes/No)", null until the training ends |

**`TrainingLog`** = `{ trainings: Training[]; participants: TrainingParticipant[] }` (`types.ts:93-96`).

Constants (`legacy:src/constants/types.ts`):
- [ ] `PARTNERS = ["PCZ", "BISO", "ZCCB", "Blue Code"]` (`:12`) — program-specific; must move to `program.config.ts`.
- [ ] `TARGET_AUDIENCES = ["Trainer of Trainers", "MOH/DHO Staff", "HF Staff", "CHW", "Other"]` (`:15-21`) — program/domain terms; config.
- [ ] `MAX_SESSIONS = 22` ("The form has room for 22 sessions", `:24-25`) — drives CSV session columns.

**Derived `Enrollment`** (`legacy:src/constants/utils.ts:37-51`): `{ id (=participant.id), participant, training, status, held, attended, scoreChange, personKey, searchText }`.
- [ ] `held` = count of non-null attendance entries; `attended` = count of `true` (`utils.ts:123-124`).
- [ ] `scoreChange` = `postTest - preTest` when both non-null, else null (`:125-126`).
- [ ] `personKey` (`getPersonKey`, `:90-93`): `nrc:<digits of NRC>` if NRC has any digit, else `name:<trimmed lowercase name>`. Groups one person across trainings.
- [ ] Status (`getEnrollmentStatus`, `:95-104`), evaluated in order: `certified` truthy → `"certified"`; `completedTraining` truthy → `"completed"`; `training.endDate >= todayIso` → `"in_progress"`; else `"not_completed"`. `todayIso` is local date (`toIsoDate(new Date())`, `:55-56`, `:110`).
- [ ] `STATUS_META` labels (`:14-34`): certified "Certified" (emerald), completed "Completed" (sky), in_progress "In progress" (amber), not_completed "Did not complete" (rose). Order of keys = order of status filter options.
- [ ] `attendancePct` = `round(attended/held*100)` or null when `held === 0` (`:80-81`).
- [ ] Formatters: `formatDate` → `en-GB` "d MMM yyyy" (e.g. "3 Nov 2026"), returns input unchanged if not parseable (`:58-66`); `formatDateRange` → single date if equal else `"<start> – <end>"` (en dash, `:68-69`); `yesNo` → "—"/"Yes"/"No" (`:71-72`); `formatScore` → "—" or `"<n>%"` (`:74-75`); `formatChange` → "—", "+n", "n" (`:77-78`); `audienceLabel` joins with ", ", rendering "Other (<text>)" when `targetAudienceOther` set (`:83-88`). In the rebuild, format dates through `core/lib/format.ts`.

**Future API design notes** (recommendations, not legacy behaviour): return normalised trainings + participants exactly as above (types.ts:9 "aim for the API to return exactly `TrainingLog`"); include scope fields (province/district) for backend filtering; consider server-side `status` or at least `endDate` comparisons in a fixed timezone; NRC is personal data — treat the query as `persist: false`.

### Fields used (table row, `EnrollmentRow`, `legacy:src/pages/TrainingLog.tsx:437-508`)
| Field | Raw keys tried | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| `participant.name` | `name` only (typed, no pickValue) | "Trainee" col, bold (`:462`); row aria-label "Open training record for <name>" (`:458`) | as-is |
| `participant.nrc` | `nrc` | "Trainee" col, under name, mono (`:463`) | as-is |
| `participant.sex` | `sex` | "Sex" col, hidden below `md` (`:465`) | as-is |
| `participant.designation` | `designation` | "Designation / Institution", hidden below `lg`, 2-line clamp + title tooltip (`:466-468`) | as-is |
| `training.title` | `title` | "Training" col, truncated with tooltip (`:470`) | as-is |
| `training.startDate/endDate/district` | | under title: `"<dateRange>, <district>"` (`:471-473`) | `formatDateRange` |
| `attended/held`, `attendancePct` | derived | "Attendance": "Not started" if pct null (`:476-477`); else `"<attended>/<held>"` + `"<pct>%"` + progress bar; pct < 80 → rose text/bar, else emerald (`:479-490`) | 80 % threshold |
| `preTest`, `postTest`, `scoreChange` | | "Pre → Post", hidden below `sm`: `"<pre ?? —> → <post ?? —>"` and, if change non-null, `formatChange` coloured emerald (>= 0) / rose (`:493-502`) | numbers without "%" in table |
| `status` | derived | "Status" badge with `STATUS_META` label/class (`:503-505`) | |

Table headers in order (`:350-356`): "Trainee", "Sex", "Designation / Institution", "Training", "Attendance", "Pre → Post", "Status".

### Filters / sort / pagination / search
All filter state is plain `useState`; **nothing persisted** (no URL params, no storage) (`legacy:src/pages/TrainingLog.tsx:81-87`). The rebuild must use declarative `platform/filters` synced to the URL.
- [ ] Training (`Select`, aria-label "Training", `:284-296`): "All trainings" (value `all`) + one option per training in `data.trainings` order (training startDate desc, `mockData.ts:382`); label `"<title>, <district> (<formatDateRange>)"` (`:96-104`, `:292`). Matches `e.training.id`. Default all.
- [ ] District (`:297-307`): "All districts" + unique `training.district` values, sorted alphabetically (`:105-108`). Matches `e.training.district` (the training's district, not the trainee's). Default all.
- [ ] Partner (`:308-318`): "All partners" + hardcoded `PARTNERS` list (`legacy:src/constants/types.ts:12`), **not** derived from data (inconsistent with the comment at `TrainingLog.tsx:95` "built from the data so they never list empty choices"). Matches `e.training.partner`.
- [ ] Status (`:319-329`): "All statuses" + `STATUS_META` keys in order: "Certified", "Completed", "In progress", "Did not complete". Matches `e.status`.
- [ ] Filters are independent: choosing a district does not narrow the Training options. **QUESTION**: cascade them in the rebuild?
- [ ] "Clear filters" ghost button (`:330-338`), disabled when `!hasFilters`; resets search + all four selects (`:130-136`). `hasFilters` = search non-blank (trimmed) or any select ≠ all (`:123-128`).
- [ ] Filters apply to: table, KPIs ("KPIs follow the filters", `:146`), pagination, CSV export (exports `filtered`, `:179`). They do **not** apply to the modal (modal shows all of the person's enrolments, `:166-172`).
- [ ] Search (`:263-282`): input placeholder "Search by name, NRC, designation, facility or training…", aria-label "Search trainees", clear (X) button aria-label "Clear search" when non-empty. Debounce via `useDeferredValue` (`:88`), no timer. Match (`matchesSearch`, `legacy:src/constants/utils.ts:153-157`): query trimmed, lowercased, split on whitespace; **every** term must be a substring of `searchText`. `searchText` = lowercase join of participant name, NRC, NRC digits only (so NRC typed without slashes matches), designation, training title, healthFacility, site, district, training id (`utils.ts:128-140`).
- [ ] Sort: fixed (training startDate desc, training id asc, rowNumber asc, `utils.ts:144-149`); no sortable columns.
- [ ] Pagination: client-side, fixed 25 per page (`ITEMS_PER_PAGE`, `TrainingLog.tsx:71`), no page-size selector. Resets to page 1 when search/any filter changes (`:138`); clamps to `totalPages` when it shrinks (`:140-141`). Footer shown when not loading and rows > 0: "Showing <first>–<last> of <total>" (toLocaleString numbers, `:395-398`); Previous / "<page> / <totalPages>" / Next controls only when `totalPages > 1`, disabled styling at ends (`:399-421`).
- [ ] Count line under export button: "<n> rows, one per trainee per training" (`:213-215`).

### Exports
- [ ] **CSV** (`handleExport`, `legacy:src/pages/TrainingLog.tsx:174-181`): button label "Export all as CSV" or, when `hasFilters`, "Export filtered CSV" (`:211`); disabled when `filtered.length === 0` (`:208`). Filename `training-log-${scope}-${toIsoDate(new Date())}.csv` with scope `"filtered"` | `"all"` (`:175-177`), local date. Rows = all filtered rows (all pages). Library: `downloadCsv` (`legacy:src/lib/csv.ts:18-29`) — comma-separated, quotes values containing `"`, `,` or `\n`, `\n` line endings, trailing newline, no BOM, MIME `text/csv;charset=utf-8;`. Rebuild: use `platform/export`.
  Exact headers in order (`legacy:src/constants/utils.ts:163-193`) with source (`:198-235`):
  1. "Training ID" — `t.id`
  2. "Training Title" — `t.title`
  3. "Training Materials / Manual" — `t.materials`
  4. "Partner" — `t.partner`
  5. "Health Facility" — `t.healthFacility`
  6. "Training Site" — `t.site`
  7. "District" — `t.district`
  8. "Trainers" — `t.trainers.join("; ")`
  9. "Start Date" — `t.startDate` (raw ISO)
  10. "End Date" — `t.endDate` (raw ISO)
  11. "Training of Master Trainers" — "Yes"/"No"
  12. "Target Audience" — `audienceLabel(t)`
  13. "Total Sessions" — `t.totalSessions`
  14. "Total Hours" — `t.totalHours`
  15. "#" — `p.rowNumber`
  16. "Name" — `p.name`
  17. "NRC" — `p.nrc`
  18. "Sex" — `p.sex`
  19. "Designation / Institution" — `p.designation`
  20. "Sessions Held" — `e.held`
  21. "Sessions Attended" — `e.attended`
  22. "Attendance %" — pct or "" when null
  23. "Pre-test %" — number or ""
  24. "Post-test %" — number or ""
  25. "Score Change" — number or "" (no "+" sign)
  26. "Completed Training" — "Yes"/"No" or "" when null
  27. "Certified" — "Yes"/"No" or "" when null
  28. "Status" — `STATUS_META[status].label`
  29-50. "Session 1" … "Session 22" — for `i < totalSessions`: `sessionCell(attendance[i])` = "Present" / "Absent" / "Not held" (null) / "" (undefined); beyond `totalSessions`: "" (`:195-196`, `:231-233`).
- [ ] **PDF** — per trainee, from the modal (see "Other behaviour").

### Charts
- [ ] Four KPI cards (`GlowCard`, `framer-motion` fade/slide-in staggered 0.05 s, `legacy:src/pages/TrainingLog.tsx:236-258`), computed from `filtered` (`:147-163`). `ended` = filtered rows with status ≠ `in_progress`.
  1. "Trainees" — distinct `personKey` count; note "<filtered.length> enrolments"; icon Users, emerald.
  2. "Trainings" — distinct training id count; note "with trainees in this view"; icon CalendarDays, teal.
  3. "Completion rate" — `(completed + certified) / ended` rounded %, "—" if no ended rows; note "<completed> of <ended> finished"; icon CheckCircle2, blue.
  4. "Certified" — certified count among ended; note "<pct(certified)> of finished"; icon Award, violet.
  While loading: value shows `LoadingDots`, note hidden (`:249-251`). Numbers use `toLocaleString()`. Colours are Tailwind classes — rebuild uses theme tokens. No other charts.

### Links in / out
- [ ] In: only the sidebar item (`legacy:src/components/dashboard/AppSidebar.tsx:94`). Grep of `src` for `training-log` finds only `App.tsx:422` and `AppSidebar.tsx:94`. No query params, no `location.state`, no storage written before navigating.
- [ ] Out: none. Row click / Enter / Space opens the modal in place (`legacy:src/pages/TrainingLog.tsx:449-457`); no navigation. **QUESTION**: rebuild could give the trainee a route-param deep link (e.g. `/training-log/:personKey`) instead of a modal-only state; legacy has none.

### Loading / empty / error
- [ ] Loading: KPI values `LoadingDots`; table body single row with `LoadingDots` (`:360-365`); pagination hidden. Rebuild: skeletons.
- [ ] Empty: table row text "No trainees match these filters." + "Clear filters" link button when `hasFilters`, else "No training records have been submitted yet." (`:366-380`). Rebuild: `<EmptyState>`.
- [ ] Error: amber inline banner "The training log didn't load" + `error.message` + "Try again" button calling `refetch()`, disabled and icon spinning while `isFetching` (`:219-233`). The page still renders (KPIs, empty table) beneath. Rebuild: `<ErrorState>` with retry. (The mock never errors.)
- [ ] "Test data" amber outline badge next to the H1 whenever `TRAINING_LOG_IS_MOCK` (`:192-196`, `legacy:src/constants/api.ts:8`). Rebuild must keep a clear demo-data label (MIGRATION_PLAN.md §1 / hard rule 2).

### Bugs and quirks
- [ ] **BUG** No data scope at all: a district/provincial user sees all districts' trainees (personal data incl. NRC), and the FY filter is ignored (`legacy:src/constants/api.ts:25`; no `useEffectiveDistrict` in `TrainingLog.tsx`). Port intended behaviour: scope + FY in query key; backend enforcement when the API exists.
- [ ] **BUG** Mock geography does not match program geography: `DISTRICT_FACILITIES` keys are "Lusaka", "Chipata", "Kabwe", "Ndola", "Kitwe", "Livingstone", "Mansa", "Kasama", "Solwezi", "Mongu" (`legacy:src/constants/mockData.ts:28-39`), while the program has only Central and Southern Province districts (`legacy:src/constants/districts.ts:1-6`; only Kabwe and Livingstone overlap). Rebuild demo data should draw districts from `@/config` geography.
- [ ] **BUG** PDF "Generated <date>" uses `generatedAt.toISOString().slice(0, 10)` (UTC) (`legacy:src/constants/pdf.ts:89`), so between local midnight and the UTC offset it prints the previous day; CSV filename uses local date (`utils.ts:55-56`). Use the local date consistently.
- [ ] **BUG** Partner filter lists all hardcoded partners even when no training has them, contradicting `TrainingLog.tsx:95`. Derive from data (or config) consistently.
- [ ] Quirk: the page is **eagerly** imported (`legacy:src/App.tsx:21`) while other pages are lazy; it pulls framer-motion etc. into the initial bundle. Rebuild: lazy like every module.
- [ ] Quirk: demo data is persisted to IndexedDB for 24 h by the global persister (`legacy:src/App.tsx:146,218-222`).
- [ ] Quirk: mock data is regenerated relative to `new Date()` on every fetch (`mockData.ts:211`), so with a 5-min staleTime the "in progress" trainings shift by day; the seed (`20261014`, `:210`) keeps names stable.
- [ ] Quirk (mock): session titles can repeat closing items — `SHARED_TAIL` contains "Post-test and evaluation" and "Closing and certification" (`mockData.ts:71-72`) and the last session is always "Post-test and closing" (`:279-282`); sessions past the topic list are "Practical session <n>".
- [ ] Quirk: the modal's `useEffect` depends on `enrollments`, which is a new array whenever `selectedRecords` recomputes (`TrainingLog.tsx:166-172`); a background refetch while open would reset expansion to the first training (`TraineeRecordModal.tsx:42-45`).
- [ ] Quirk: `TraineeRecordModal` returns `null` when there is no person (`:67`), so the dialog unmounts instantly on close (no close animation) because `selected` is cleared (`TrainingLog.tsx:428`).

## Component `TraineeRecordModal` (opened from `/training-log`)
`legacy:src/components/TraineeRecordModal.tsx`. Props: `open`, `onOpenChange`, `enrollments` (clicked enrolment first, then all other enrolments with the same `personKey`, in global sort order — `legacy:src/pages/TrainingLog.tsx:166-172`).
- [ ] Opens when a row is clicked or Enter/Space pressed on a focused row (rows `tabIndex=0`, `TrainingLog.tsx:449-459`). Closing clears `selected` (`:428`).
- [ ] Header (sticky, `:74-112`): title = `person.name`; description "NRC <nrc> | <sex>"; designation line; summary "1 training" / "<n> trainings" + ", certified in <count of status certified>" (`:106-111`).
- [ ] "Download PDF" button (`:86-98`): state `idle | working | error`; spinner + disabled while working; on failure `console.error("Trainee PDF export failed:", error)` and inline text "The PDF couldn't be created. Try again." (`:99-103`). Reset to idle whenever opened (`:44`). PDF module is lazy-imported (`await import("@/constants/pdf")`, `:58`).
- [ ] One collapsible `TrainingSection` per enrolment; the clicked one starts expanded, others collapsed (`:40-45`); toggling is independent (Set of ids, `:47-53`). Header button: title (truncated), "<dateRange>, <district>", status badge, chevron rotating 180° when open; `aria-expanded`, `aria-controls="training-panel-<id>"` (`:148-165`).
- [ ] Expanded panel — Stat cards (`:170-190`):
  - "Attendance": value "<attended> of <held>"; note "No sessions held yet" (pct null) / "<pct>%, <totalSessions - held> sessions to go" (held < totalSessions) / "<pct>%"; warn tone (rose) when pct < 80.
  - "Test scores": "<formatScore(pre)> → <formatScore(post)>"; note "Pre-test to post-test" if change null else "<formatChange> points".
  - "Completed": `yesNo(completedTraining)`; note "Recorded when it ends" when null.
  - "Certified": `yesNo(certified)`; note "Recorded when it ends" when null.
- [ ] "Attendance by session" (`:193-230`): legend "Present" / "Absent" / "Not held yet"; one numbered square per `training.sessions` entry, state from `attendance[number-1]` (`true` Present filled emerald, `false` Absent rose outline, `null`/`undefined` Not held yet dashed); title tooltip "Session <n>: <title> — <state>", aria-label "Session <n>, <title>: <state>". If any absent: "Missed: <n>. <title>; …" (`:143`, `:224-229`).
- [ ] Training details `<dl>` (`:233-244`) in order: "Training ID" (mono), "Partner", "Health facility", "Training site", "Dates" ("<formatDate start> to <formatDate end>"), "Sessions and hours" ("<n> sessions, <h> hours"), "Target audience" (`audienceLabel`), "Master trainers" (Yes/No), "Trainers" (joined "; "), "Materials".

### PDF export (`legacy:src/constants/pdf.ts`)
- [ ] Library jsPDF + jspdf-autotable (`:9-10`; `legacy:package.json:61-62`), A4 portrait, mm units, margin 14 (`:28`, `:75`). Throws "No training records to export." if empty (`:73`).
- [ ] Filename: `training-record-<name slug>-<NRC digits or "no-nrc">.pdf`, lowercased; name slug replaces non-alphanumerics with "-" and trims dashes (`:206-210`). Contains personal data in the filename — **QUESTION** keep?
- [ ] Header: bold 16pt "Training Attendance Record" left; right-aligned "Generated <formatDate>" (see BUG above); emerald rule under (`:80-97`). **No branding/logo/organisation strings.**
- [ ] Trainee key/value table, 2 pairs per row (`:101-108`): "Name", "NRC", "Sex", "Designation", "Trainings" (count), "Certified in" ("<certified> of <n>").
- [ ] Per enrolment, in modal order (`:111-189`), starting a new page if < 70 mm remain (`:33-40`, `:114`): grey band "<index+1>. <title>" with status label right-aligned; key/value table: "Training ID", "Partner", "Start date", "End date", "Health facility", "District", "Training site", "Master trainers", "Target audience", "Sessions / hours" ("<n> sessions, <h> hours"), "Trainers", "Materials"; results grid table head `["Attendance", "Pre-test", "Post-test", "Change", "Completed", "Certified"]`, body `"<attended> of <held>[ (<pct>%)]"`, formatScore, formatScore, formatChange, yesNo, yesNo (emerald header); sessions striped table head `["#", "Session", "Attendance"]`, attendance "Present" (emerald) / "Absent" (rose, bold) / "Not held yet" (slate) (`:162-186`).
- [ ] Footer on every page: left "<name>, NRC <nrc>", right "Page <i> of <n>" (`:192-201`).
- [ ] Colours are hardcoded RGB triples (`:22-26`) — rebuild should source them from theme/config via `platform/export`.

## Other behaviour
- [ ] Mutations: none (read-only page; no create/edit of trainings or attendance).
- [ ] Toasts: none. Keyboard: Enter/Space on a row opens the modal (`TrainingLog.tsx:451-456`); dialog Escape/close from shadcn Dialog.
- [ ] Timers: `getTrainingLog` 300 ms `setTimeout` artificial delay (`legacy:src/constants/api.ts:27`). No polling, no refetchInterval.
- [ ] Storage keys: none read/written by the module itself; indirectly persisted in IndexedDB `ecap-plus-pmp-react-query` (`legacy:src/App.tsx:146`).
- [ ] Browser APIs: `URL.createObjectURL` + temporary `<a download>` for CSV (`legacy:src/lib/csv.ts:20-28`); jsPDF `doc.save` for PDF (`pdf.ts:214`).
- [ ] Mock generator (`legacy:src/constants/mockData.ts:207-384`), for reproducing demo data:
  - Defaults `trainingCount = 32`, `peopleCount = 540`, `seed = 20261014`, `today = new Date()` (`:207-212`); PRNG mulberry32 (`:21-26`).
  - People: 62 % female (`:232`), name "Surname, First" from fixed name lists, unique random NRC `NNNNNN/NN/1` (`:235-239`), home district, role from `ROLES` (`:56-61`): "Community Health Worker", "Community Caseworker", "Adherence Supporter", "Nurse", "Clinical Officer", "Midwife", "Psychosocial Counsellor", "Data Associate", "District M&E Officer", "Social Welfare Officer", "Case Management Supervisor"; institution "<district> District Health Office" for "District…" roles, "<district> Social Welfare Office" for social welfare, else a facility (`:242-246`); designation "<role>, <institution>".
  - Trainings: 7 curricula (`:84-175`), titles "Case Management for OVC Caseworkers", "HIV Testing Services Refresher", "PMTCT Mother-Baby Pair Follow-up", "Child Protection and Safeguarding", "Data Quality and Mobile Data Collection", "Psychosocial Support Fundamentals", "Training of Trainers: Case Management" (ToT, audience fixed "Trainer of Trainers"); first 3 trainings start 1-4 days ago (in progress), others 12-310 days ago; duration 2-9 days; sessions within the curriculum's range; 1-3 trainers; site one of "<district> District Health Office boardroom", "<facility> conference room", "<district> Civic Centre", "<district> Community Hall" (`:302-307`); "Other" audience text "Community volunteers" (`:314`).
  - Participants: 12-34 per training, ~90 % local, nobody in two overlapping trainings (`:328-347`); held sessions proportional to elapsed days (`:322-326`); pre-test present 96 %, post-test only when finished (94 %); `completedTraining = attendedRatio >= 0.8 && postTest !== null` and `certified = completed && postTest >= 70` when finished, else null (`:355-363`). These rules (80 % attendance, 70 % post-test pass mark) are **mock-only assumptions** — **QUESTION** are they the real programme rules (and should they live in config)?
- [ ] Real-looking data in mockData (do not copy into the rebuild): first-name and surname lists of common regional names (`mockData.ts:42-55`) combined randomly for trainees and trainers (`:249`, `:290-293`); facility names that appear to be real public health facilities (`:28-39`); random NRC-format numbers that could coincide with real NRCs (`:237`). The file header states everything is invented (`:9`). Rebuild demo data should use obviously fictitious names and an NRC-like pattern that cannot be valid, and draw districts from config.
- [ ] Brand / program strings to move to config (or drop from demo data): `PARTNERS` "PCZ", "BISO", "ZCCB", "Blue Code" (`types.ts:12`); target audiences incl. "MOH/DHO Staff", "HF Staff", "CHW" (`types.ts:15-21`); "NRC" label throughout (`TrainingLog.tsx:268`, `TraineeRecordModal.tsx:79`, `utils.ts:180`, `pdf.ts:103,199`) — national ID term, should be a config domain term; mock strings "ECAP+ Case Management Training Manual (2025)" (`mockData.ts:87`), "Using the ECAP+ mobile app" (`:95`, `:170`), "ECAP+ Data Quality Assessment Toolkit" (`:139`), "ECAP+ Case Management ToT Facilitator Guide" (`:163`), "Using the PMP dashboard" (`:146`), "MOH Consolidated HIV Guidelines, HTS chapter" (`:101`), "REPSSI Psychosocial Support Facilitator Guide" (`:151`), "OVC" (`:86`).

## Open questions for the developer
1. **QUESTION** Should the future API (and the demo) be scoped by the user's province/district and FY window like every other module? (Legacy ignores scope.)
2. **QUESTION** Are "80 % attendance" (UI warning threshold `TrainingLog.tsx:482,486`, `TraineeRecordModal.tsx:181`, and mock completion rule) and "70 % post-test" (mock certification rule) real programme rules? If so, put them in `program.config.ts`.
3. **QUESTION** Partner list and target-audience list: config values, or will the API supply them?
4. **QUESTION** Should the trainee drill-down get a deep-linkable route (route param) instead of modal-only state?
5. **QUESTION** Keep personal data (name + NRC) in the PDF filename and footer?
6. **QUESTION** Should the Training filter cascade from the District/Partner filters?
7. Backend ask: an endpoint returning `{ trainings, participants }` per the model above (suggested `GET /training/log` with FY window, per `legacy:src/constants/api.ts:17`), with server-side scope enforcement.
