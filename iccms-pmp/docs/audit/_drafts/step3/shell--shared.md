# shell — legacy audit (part: shared building blocks)

> New module `shell` (this part feeds `platform/` + `core/` + `config/`, not a route) · Legacy routes → new routes: app-wide, no routes of its own (the `*` NotFound route is covered by another part) · Plan: MIGRATION_PLAN.md §5 row "shell"
>
> This part covers the shared components and helpers that the new `platform/` layer replaces: the
> sub-population filter, the multi-facility (ward) picker, CSV export helpers, the trainee-record PDF
> builder, the geography constants, the training-log constants and types, the generic helpers in
> `lib/utils.ts`, the service-category validator and the animated KPI counter. None of these files
> owns a route or calls an endpoint directly; endpoint and route context is given for their callers.

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `legacy:src/components/dashboard/SubPopulationFilter.tsx` | 67 | Presentational all/yes/no toggle grid for sub-population flags. Used by 4 registers; MotherIndexRegister re-implements it inline. |
| `legacy:src/components/MultiFacilityPicker.tsx` | 174 | Multi-select chip picker for wards ("facilities") stored as a CSV string on the Directus user. Plus `parseFacilitiesCsv` / `serializeFacilitiesCsv`. Used by AddUser / EditUser only. |
| `legacy:src/lib/exportUtils.ts` | 29 | CSV export helper #1 (`escapeCsvField`, `downloadCsv(headers, rows, filename)`) via a `data:` URI. Used by Districts and HTSRiskRegister. |
| `legacy:src/lib/csv.ts` | 29 | CSV export helper #2 (`downloadCsv(filename, headers, rows)`) via a Blob. Used by 7 files (one import unused). |
| `legacy:src/constants/pdf.ts` | 215 | Trainee record PDF (jsPDF + jspdf-autotable), lazy-loaded by `TraineeRecordModal`. Only PDF export in the app. |
| `legacy:src/constants/utils.ts` | 235 | Training-log domain helpers: enrollment status, formatting, search, CSV headers/rows. |
| `legacy:src/constants/districts.ts` | 8 | Hardcoded provinces and districts. |
| `legacy:src/constants/types.ts` | 96 | Training-log domain types, partner list, target audiences, `MAX_SESSIONS`. |
| `legacy:src/lib/utils.ts` | 64 | `cn`, caregiver-name masking, `toTitleCase`, `toSentenceCase`, `normalizePlaceName`, `dedupePlaceNames`. |
| `legacy:src/lib/data-validation.ts` | 70 | `isCategoryProvided` (does a service record contain a meaningful service in a domain). |
| `legacy:src/components/AnimatedCounter.tsx` | 59 | Count-up animation for KPI numbers. Used by MetricsGrid and Districts. |
| `legacy:src/hooks/useEffectiveDistrict.ts` | 18 | Read in full: the only consumer of `DISTRICTS_BY_PROVINCE` (scope derivation). Primary audit belongs to the access/scope part. |
| Callers read in part for context | — | `HouseholdRegister.tsx:40-80,170-250,395-460`; `VcaRegister.tsx:44-80,225-270`; `HouseholdArchivedRegister.tsx:50-70,195-230`; `VcaArchivedRegister.tsx:50-82,250-285`; `MotherIndexRegister.tsx:17-60,95-125,155-175,230-260`; `VcaProfile.tsx:75-100,940-975`; `HouseholdProfile.tsx:80-95`; `VcaServicesDashboard.tsx:130-160`; `AddUser.tsx:205-300,680-700`; `EditUser.tsx:100-160,185-210,465-485`; `TraineeRecordModal.tsx:1-75`; `TrainingLog.tsx:50-75,170-190`; `MetricsGrid.tsx:75-90,178-192`; `Districts.tsx:185-195,278-290,555-570`; `PMTCTRegister.tsx:155-170`; `CohortStrip.tsx:1-40`; `ai-service.ts:38-55`; `backend:config/geography.js:1-9`; `backend:lib/userScope.js:1-60` |

Unreferenced / dead exports found:
- `PROVINCES` (`legacy:src/constants/districts.ts:1`): no importer anywhere in `src`.
- `escapeCsvField` (`legacy:src/lib/exportUtils.ts:4`): exported but only used inside the same file (`:19`).
- `subPopulationFilterLabels` in `legacy:src/pages/HouseholdProfile.tsx:83-91`: defined, never referenced.
- `ALL_DISTRICTS` import in `legacy:src/pages/MotherIndexRegister.tsx:17`: imported, never used.
- `downloadCsv` import in `legacy:src/components/dashboard/services/ServicesPage.tsx:73`: imported, never called (export goes through `triggerServiceExport`, `:441`).
- `SubPopulationFilterProps.onClear` (`legacy:src/components/dashboard/SubPopulationFilter.tsx:7`): declared and passed by every caller, never read (not destructured at `:11-16`).

---

## Component `SubPopulationFilter` (unrouted)

### Purpose
A grid of tri-state toggles, one per sub-population flag, with the options `all` / `yes` / `no`. Purely presentational: the label list, state and matching rule live in each calling page (`legacy:src/components/dashboard/SubPopulationFilter.tsx:3-9`). The new platform should ship one declarative tri-state "flag filter" type in `platform/filters`, with the sub-population list coming from `program.config.ts`.

### Access
- [ ] No access logic in the component. Visible to everyone who can open the host register.
- [ ] Hosts: `/households` (`legacy:src/pages/HouseholdRegister.tsx:425-430`), `/vcas` (`legacy:src/pages/VcaRegister.tsx:486-491`), `/households/archived` (`legacy:src/pages/HouseholdArchivedRegister.tsx:529-534`), `/vcas/archived` (`legacy:src/pages/VcaArchivedRegister.tsx:607-612`). `/registers/mother-index` has an inline copy (`legacy:src/pages/MotherIndexRegister.tsx:239-254`).

### Rendering (behaviour to reproduce)
- [ ] Section caption "Sub-population" (`:19-21`). The MotherIndex copy captions it "Mother category" (`legacy:src/pages/MotherIndexRegister.tsx:240`).
- [ ] One cell per entry of `labels`, in object order. The label is shown truncated, with the full label as `title` tooltip (`:23-35`).
- [ ] Options are exactly `["all", "yes", "no"]`, rendered upper-case (`:37`, CSS `uppercase` at `:52`). A missing value counts as `"all"` (`:24`).
- [ ] Active-state colours: `yes` → green filled, `no` → red filled, `all` → neutral (`:39-45`). In the new app these come from theme tokens (success / destructive / muted).
- [ ] Clicking calls `onChange(key, option)` (`:50`). There is no "clear" control in the component. Clearing is done by the host's Clear button, which resets every key to `"all"` (`legacy:src/pages/HouseholdRegister.tsx:241-246`).
- [ ] Responsive grid: 1 / 2 / 3 / 5 columns at sm / lg / xl (`:22`).

### Sub-population definitions (config parity — quote exactly)

**Household registers** (active + archived). The same 7 keys and labels appear in `legacy:src/pages/HouseholdRegister.tsx:45-53`, `legacy:src/pages/HouseholdArchivedRegister.tsx:52-60` and (unused) `legacy:src/pages/HouseholdProfile.tsx:83-91`:

| Key | Label | Data field matched |
| --- | --- | --- |
| `calhiv` | `CALHIV` | `calhiv` |
| `hei` | `HEI` | `hei` |
| `cwlhiv` | `CWLHIV` | `cwlhiv` |
| `agyw` | `AGYW` | `agyw` |
| `csv` | `C/SV` | `csv` |
| `cfsw` | `CFSW` | `cfsw` |
| `abym` | `ABYM` | `abym` |

`filterKeyToDataKey` is empty for households (`legacy:src/pages/HouseholdRegister.tsx:57-59` has only the comment `// e.g. csv: 'child_sv' — add mappings here`; `legacy:src/pages/HouseholdArchivedRegister.tsx:62`), so each key is read from the record field with the same name.

**VCA registers** (active + archived). 14 keys in `legacy:src/pages/VcaRegister.tsx:47-62` (comment: "Full list of 14 filters from legacy TreeTable.tsx") and `legacy:src/pages/VcaArchivedRegister.tsx:52-67`:

| Key | Label | Data field matched (`filterKeyToDataKey`, `legacy:src/pages/VcaRegister.tsx:65-73`, `legacy:src/pages/VcaArchivedRegister.tsx:69-77`) |
| --- | --- | --- |
| `calhiv` | `C/ALHIV` | `calhiv` |
| `hei` | `HEI` | `hei` |
| `cwlhiv` | `C/WLHIV` | `cwlhiv` |
| `agyw` | `AGYW` | `agyw` |
| `csv` | `C/SV` | `csv` |
| `cfsw` | `CFSW` | `cfsw` |
| `abym` | `ABYM` | `abym` |
| `caahh` | `CAAHH` | `child_adolescent_in_aged_headed_household` |
| `caichh` | `CAICHH` | `child_adolescent_in_chronically_ill_headed_household` |
| `caich` | `CAICH` | `child_adolescent_in_child_headed_household` |
| `calwd` | `CALWD` | `child_adolescent_living_with_disability` |
| `caifhh` | `CAIFHH` | `child_adolescent_in_female_headed_household` |
| `muc` | `MUC` | `under_5_malnourished` |
| `pbfw` | `PBFW` | `pbfw` |

The same `filterKeyToDataKey` map is copied a third time in `legacy:src/pages/VcaServicesDashboard.tsx:145-153`.

**VCA profile badges** (`legacy:src/pages/VcaProfile.tsx:82-96`): the same 13 keys as the VCA register, without `pbfw` (comment at `:80-81`: "PBFW removed; the three derived PBFW sub-populations are computed per-VCA at render time"). The profile shows a badge for every record key that is truthy **and** is in this label map. It looks the key up directly, **not** through `filterKeyToDataKey`, so the long-named fields (`caahh` … `muc`) never match (`legacy:src/pages/VcaProfile.tsx:963-969`). It then adds derived badges (`:946-974`):
- `isTrue(v)` = `v === "1" || v === "true" || v === 1 || v === true || String(v).toLowerCase() === "yes"` (`:945-950`)
- `pbfwFlag = isTrue(pbfw) || isTrue(agyw)`; `hivPos = isTrue(is_hiv_positive) || isTrue(calhiv)`; `motherPbfw = isTrue(is_biological_mother_of_child_living_with_hiv) || isTrue(mother_pbfw) || isTrue(caregiver_pbfw)` (`:951-962`)
- `pbfwFlag && hivPos` → `"HIV+ PBFW"`; `pbfwFlag && !hivPos` → `"HIV- PBFW"`; `motherPbfw` → `"Children of PBFW"` (`:971-973`)

**Mother index register** ("Mother category", `legacy:src/pages/MotherIndexRegister.tsx:27-32`). Each key is matched against several fields with `pickValue` (first non-empty, non-zero value; `:34-40`) and a string vocabulary (`:103-116`):

| Key | Label | Fields tried in order | `yes` passes when the value (lower-cased) is one of | `no` passes when the value is one of |
| --- | --- | --- | --- | --- |
| `hei` | `HEI Status` | `hei`, `hei_status` | `yes, true, 1, active, positive` | `no, false, 0, "", n/a, negative` |
| `hiv_pos` | `HIV Positive` | `art_status`, `caregiver_hiv_status`, `hiv_status` | same | same |
| `on_art` | `On ART` | `on_art`, `art_linkage` | same | same |
| `linked` | `Linked` | `linked`, `linkage_status` | same | same |

`pickValue` returns `"N/A"` when nothing matches, so a missing field passes `no` (`:39`, `:115`).

**Descriptions.** The filter UI shows no descriptions. The only expansions in the codebase are the AI-assistant system prompt (`legacy:src/lib/ai-service.ts:42-49`): "CALHIV: Children/Adolescents Living with HIV", "HEI: HIV Exposed Infants", "AGYW: Adolescent Girls and Young Women", "CALWD: Child/Adolescent Living with Disability", "PBFW: Pregnant and Breastfeeding Women", "CAAHH: Child/Adolescent in Aged Headed Household", "(And others like CFSW, ABYM, CAICHH, CAICH, CAIFHH, MUC)". The services cohort strip has its own tooltips (`legacy:src/components/dashboard/services/CohortStrip.tsx:17-19`): "CLHIV" = "Children Living with HIV — VCAs with a positive HIV status on file.", "CWLHIV" = "Children/Caregivers Whose Mother is Living with HIV — VCAs whose caregiver has HIV+.", "HEI" = "HIV-Exposed Infant — children under 24 months born to an HIV+ mother and not yet final-tested.". The rest have no description anywhere in the code (see Open questions).

### Matching rule (household + VCA registers)
- [ ] All active toggles are combined with AND (`.every(...)`) (`legacy:src/pages/HouseholdRegister.tsx:181-191`, `legacy:src/pages/VcaRegister.tsx:238-249`, `legacy:src/pages/HouseholdArchivedRegister.tsx:199-216`, `legacy:src/pages/VcaArchivedRegister.tsx:253-270`).
- [ ] `all` → no constraint.
- [ ] `yes` → `recordValue` is `"1"`, `"true"`, `1` or `true` (strict equality).
- [ ] `no` → `recordValue` is `"0"`, `"false"`, `0`, `false`, `null` or `undefined`.
- [ ] Filtering is client-side over the already-fetched register list. The state is plain `useState`, initialised with every key = `"all"` (`legacy:src/pages/HouseholdRegister.tsx:78-80`, `legacy:src/pages/VcaRegister.tsx:142-144`), and is **not persisted** (no URL param, no storage). The new app must sync it to the URL via `platform/filters`.
- [ ] Changing a toggle resets the page to 1 (`legacy:src/pages/HouseholdRegister.tsx:210-212`).
- [ ] Each active toggle shows a removable chip labelled `` `${label}: ${value}` `` (e.g. "HEI: yes") (`legacy:src/pages/HouseholdRegister.tsx:445-452`, `legacy:src/pages/VcaRegister.tsx:506-513`). The Clear button's badge counts the active toggles plus the search (`legacy:src/pages/HouseholdRegister.tsx:402-404`).
- [ ] Exports from these registers use the filtered set (comment at `legacy:src/pages/HouseholdRegister.tsx:248-249`: "Exports exactly what is currently visible after all active filters"). Details are in the households/vcas audits.

### Bugs and quirks
- [ ] **BUG** Values such as `"Yes"` / `"yes"` / `"No"` / `""` match **neither** `yes` nor `no` in the household/VCA matcher (strict comparison against `"1"`/`"true"`/`"0"`/`"false"` only; `legacy:src/pages/HouseholdRegister.tsx:187-189`). The VCA profile's `isTrue` does accept `"yes"` (`legacy:src/pages/VcaProfile.tsx:950`). Port one normaliser (in the module's `api/schemas.ts`) that turns each flag into `boolean | null`, and match on that.
- [ ] **BUG** Labels differ for the same key: households use `CALHIV` / `CWLHIV`, VCAs use `C/ALHIV` / `C/WLHIV` (`legacy:src/pages/HouseholdRegister.tsx:46,48` vs `legacy:src/pages/VcaRegister.tsx:48,50`). Use one config list with per-entity applicability.
- [ ] **BUG** VcaProfile looks up the raw key without `filterKeyToDataKey`, so CAAHH/CAICHH/CAICH/CALWD/CAIFHH/MUC badges can never appear (`legacy:src/pages/VcaProfile.tsx:963-969` vs `legacy:src/pages/VcaRegister.tsx:65-73`).
- [ ] **BUG** The `onClear` prop is ignored (`legacy:src/components/dashboard/SubPopulationFilter.tsx:7,11-16`).
- [ ] **BUG** The `pbfwFlag` derivation treats every `agyw` VCA as PBFW (`legacy:src/pages/VcaProfile.tsx:951-952`). **QUESTION** Is that intended?
- [ ] **QUESTION** For `no`, the household/VCA matcher counts a missing field (`undefined`/`null`) as "no". For MotherIndex, `"N/A"` counts as "no". Should "unknown" be its own state?
- [ ] Duplicate: MotherIndexRegister re-implements the component inline instead of importing it (`legacy:src/pages/MotherIndexRegister.tsx:239-254`).

---

## Component `MultiFacilityPicker` (unrouted)

### Purpose
A multi-select chip picker used on the Add User / Edit User forms to pick the **wards** a facility-level user covers. It reads and writes a comma-separated string that is stored in the Directus user field `facility` (`legacy:src/components/MultiFacilityPicker.tsx:5-6`). Despite the name, the options are ward names: callers label it "Ward" and the option source `GET /etl/facility-list` returns distinct ward names (AUDIT.md §3.2: "Distinct ward names (misnamed)").

### Access
- [ ] Shown only when the user being created/edited is facility-level: `selectedLevel === "facility"` (`legacy:src/pages/AddUser.tsx:677`), `formState.custom_role === "Facility User"` (`legacy:src/pages/EditUser.tsx:469`). The pages themselves are admin-only by sidebar visibility (see users audit). The new app should use `can("users.manage")` and not compare role names.
- [ ] Callers derive the pseudo-role from free-text: EditUser infers "Facility User" when a `facility` value is stored (`legacy:src/pages/EditUser.tsx:191-206`). AddUser/EditUser find Directus role ids by name: `r.name.toLowerCase().includes("ecap+") && !r.name.toLowerCase().includes("support")` / `... && r.name.toLowerCase().includes("support")` (`legacy:src/pages/AddUser.tsx:262-270`, `legacy:src/pages/EditUser.tsx:155,158`). The brand string `ecap+` is hardcoded in this role lookup.

### Endpoints (via callers)
- [ ] `GET /etl/facility-list` (AUDIT.md §3.2). Wrapper: `getFacilityList` (`legacy:src/lib/api.ts:1239-1242`), which calls `dqaGetSkipCache("/etl/facility-list")` and returns `data?.data ?? []`. Query key `["etl", "ward-list"]`, `staleTime: 10 * 60 * 1000`. Enabled only for facility-level (`legacy:src/pages/AddUser.tsx:238-243`, `legacy:src/pages/EditUser.tsx:131-136`). No district param is sent.
- [ ] The option list is filtered client-side to the wards of the chosen district. The ward→district mapping is built from the households list (`normalizePlaceName(h.district)` / `normalizePlaceName(h.ward)`, `legacy:src/pages/AddUser.tsx:218-231`, `legacy:src/pages/EditUser.tsx:111-124`). Facility-list entries are kept if their lower-cased name is in that district's ward set, then `normalizePlaceName` is applied (`legacy:src/pages/AddUser.tsx:245-253`, `legacy:src/pages/EditUser.tsx:138-146`).
- [ ] Persisted through the Directus `PATCH /users/:id` / `POST /users` payload field `facility` (callers `legacy:src/pages/EditUser.tsx:286`, `legacy:src/pages/AddUser.tsx:404`).

### Behaviour
- [ ] `parseFacilitiesCsv(raw)`: `""`/null/undefined → `[]`. Otherwise split on `,`, trim each part, drop empties (`:7-13`). Exported and also used by AddUser/EditUser validation (`legacy:src/pages/AddUser.tsx:290,390`, `legacy:src/pages/EditUser.tsx:267`).
- [ ] `serializeFacilitiesCsv(list)`: trim, drop empties, de-duplicate (case-**sensitive** `Set`), join with `", "` (comma + space) (`:15-17`).
- [ ] Props: `options: string[]`, `value: string` (CSV), `onChange(csv)`, `loading?`, `disabled?`, `placeholder?` (`:19-26`).
- [ ] Trigger area: no selection → button with a building icon and the text `loading ? "Loading facilities…" : placeholder ?? "Select one or more facilities"` (`:64-72`). Callers pass `"Select a district first"` when no district is chosen, otherwise `"Select one or more wards"` (`legacy:src/pages/AddUser.tsx:690`, `legacy:src/pages/EditUser.tsx:479`).
- [ ] With a selection: one chip per selected name with a remove button (`aria-label` `` `Remove ${name}` ``), then "+ Add more" (toggles the panel) and "Clear all" (`onChange("")`) (`:74-106`).
- [ ] Panel (only when `open && !disabled`): a search input (placeholder "Search facilities…", `autoFocus`) that filters options with a case-insensitive substring match, no debounce (`:34-38,112-123`). The list is capped at 220px with scrolling. It shows "Loading…" while loading and "No matches" when empty (`:125-130`). Clicking an option toggles it; selected items get a check icon (`:131-153`). The footer shows `{n} selected` and a "Done" button that closes the panel (`:156-167`).
- [ ] The panel does **not** close on outside click or Escape (no handler). The new implementation should use a shadcn `Popover` + `Command` multi-select.
- [ ] Validation (in the callers): at least one ward is required for facility-level, toast `"Please select at least one facility"` (`legacy:src/pages/AddUser.tsx:390`, `legacy:src/pages/EditUser.tsx:267`). Changing the district clears `facility` (`legacy:src/pages/AddUser.tsx:651`, `legacy:src/pages/EditUser.tsx:446`).

### Bugs and quirks
- [ ] **BUG** Case mismatch: options are run through `normalizePlaceName` (Title Case), but the stored CSV is loaded raw from Directus (`legacy:src/pages/EditUser.tsx:191,206`). Selection is checked with case-sensitive `includes` (`:41,132`), so a stored `"chibale"` does not show as selected for option `"Chibale"`. Selecting it then stores both (`serializeFacilitiesCsv` de-dupes case-sensitively, `:16`). Normalise and compare case-insensitively.
- [ ] **BUG** The caller help text says "User will only see data from the wards below" (`legacy:src/pages/AddUser.tsx:683`, `legacy:src/pages/EditUser.tsx:472`), but nothing enforces ward scope: no frontend code reads `user.facility` for scoping (grep: only `legacy:src/lib/directus.ts:797` selects it for the activity log), and `backend:lib/userScope.js:18-49` derives only national/province/district scope. → **Backend ask**: ward-level scope.
- [ ] **QUESTION** Should the stored value stay a CSV string in `facility`, or move to a proper array/relation? The migration plan keeps Directus shapes unchanged, so keep the CSV and isolate it in the users module's normaliser.

---

## Component CSV export helpers (`lib/exportUtils.ts`, `lib/csv.ts`) (unrouted)

### Purpose
Two competing CSV download helpers, plus at least 13 hand-written CSV builders inside pages. All of them are replaced by `platform/export`.

### `legacy:src/lib/exportUtils.ts`
- [ ] `escapeCsvField(value: string)`: if the value contains `,`, `"` or `\n`, wrap it in `"…"` and double the inner quotes. Otherwise return it unchanged (`:4-9`).
- [ ] `downloadCsv(headers, rows, filename)` (note the argument order): builds `"data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(escape).join(",")].join("\n")`, runs `encodeURI`, and clicks a temporary `<a download>` (`:14-29`). No BOM, no trailing newline. **Headers are not escaped** (`:18`).
- [ ] Callers: Districts summary `districts_summary_${dateStr}.csv` (`legacy:src/pages/Districts.tsx:210`); Districts detail `` `${districtName}_detailed_report_${dateStr}.csv` `` (`legacy:src/pages/Districts.tsx:282-286`); HTS risk `` `hts_register_${type}_${selectedDistrict}_${dateStr}.csv` `` (`legacy:src/pages/HTSRiskRegister.tsx:181`).

### `legacy:src/lib/csv.ts`
- [ ] `CsvValue = string | number | boolean | null | undefined`. `null`/`undefined` → `""`, everything else `String(v)` (`:1-3`).
- [ ] The escape rule is the same as above (quote when the value contains `"`, `,` or `\n`) and is applied to headers **and** cells (`:5-14`).
- [ ] Lines joined with `\n`, plus a trailing `\n` (`:15`).
- [ ] `downloadCsv(filename, headers, rows)`: `Blob` of type `text/csv;charset=utf-8;` → object URL → `<a download>` click → remove → `revokeObjectURL` (`:18-29`). No BOM.
- [ ] Callers and filename patterns: QualityReviewPanel `` `${type}-duplicate-groups-${scope}-${YYYY-MM-DD}.csv` `` (`legacy:src/components/dashboard/services/QualityReviewPanel.tsx:140`); MotherIndexRegister `` `index-mothers-${district-slug}.csv` `` (`legacy:src/pages/MotherIndexRegister.tsx:172`); Referrals `` `referrals-${selectedDistrict || "all"}-${activeTab}.csv` `` (`legacy:src/pages/Referrals.tsx:277-279`); HTSRegister `` `hts-register-${district-slug}.csv` `` (`legacy:src/pages/HTSRegister.tsx:572-574`); PMTCTRegister `` `pmtct-register-${district-slug}.csv` `` (`legacy:src/pages/PMTCTRegister.tsx:431-433`); TrainingLog `` `training-log-${"filtered"|"all"}-${toIsoDate(today)}.csv` `` (`legacy:src/pages/TrainingLog.tsx:174-180`). Here district-slug = `selectedDistrict.toLowerCase().replace(/\s+/g, "-")`. ServicesPage imports it but does not use it (`legacy:src/components/dashboard/services/ServicesPage.tsx:73`).

### Page-local CSV builders (duplicates to fold into `platform/export`)
- [ ] Always-quote escapers that add a UTF-8 BOM `"﻿"`: HouseholdRegister (`legacy:src/pages/HouseholdRegister.tsx:267,282`), VcaRegister (`legacy:src/pages/VcaRegister.tsx:328,345`), HouseholdArchivedRegister (`legacy:src/pages/HouseholdArchivedRegister.tsx:333,349`), VcaArchivedRegister (`legacy:src/pages/VcaArchivedRegister.tsx:404,421-423`).
- [ ] Always-quote without BOM: Performance `exportCsv` (`legacy:src/pages/Performance.tsx:154-161`), DuplicateDetectionCard (`legacy:src/components/dashboard/DuplicateDetectionCard.tsx:201-209`).
- [ ] Other hand-rolled Blob builders: CaregiverRiskRegister (`:194-210`), HouseholdRiskRegister (`:208-225`), VcaRiskRegister (`:196-213`), DataQualityChart (`legacy:src/components/dashboard/DataQualityChart.tsx:148-165`), ServiceInsights (`legacy:src/components/dashboard/ServiceInsights.tsx:105-109`), CaseworkerJourneys (`legacy:src/pages/CaseworkerJourneys.tsx:416-423`), DataPipelinePage (`legacy:src/pages/DataPipelinePage.tsx:1213-1229,1739-1758`).
- [ ] A `data:` URI builder that only escapes the comment column: Flags (`legacy:src/pages/Flags.tsx:125-147`).
- [ ] A server-streamed CSV: `triggerServiceExport` assembles chunks into a Blob (`legacy:src/lib/api.ts:1462-1471`). This is a server export, not a client one, and belongs to the services module.

### Rules for `platform/export` (from the union of legacy behaviour)
- [ ] RFC-4180 quoting of headers and cells (quote when the value contains `,`, `"`, `\r` or `\n`; double inner quotes). `null`/`undefined` → empty.
- [ ] Prepend a UTF-8 BOM so Excel opens the file correctly. The 4 core registers do this today; the shared helpers don't.
- [ ] Download through a Blob + object URL (never a `data:` URI), then revoke the URL.
- [ ] Filename = `<slug>-<scope>-<yyyy-MM-dd>.csv`, built in one helper. The date comes from local time via `core/lib/format.ts`.
- [ ] Rows = the currently filtered set (not the current page), as the registers do today.

### Bugs and quirks
- [ ] **BUG** `exportUtils.downloadCsv` uses a `data:` URI + `encodeURI`. `encodeURI` leaves `#` unescaped, so any `#` in a cell starts a URL fragment and **silently truncates the file** from that point (`legacy:src/lib/exportUtils.ts:15-24`). Flags has the same issue (`legacy:src/pages/Flags.tsx:138`). Large exports can also exceed URL length limits.
- [ ] **BUG** `exportUtils` does not escape headers (`:18`). Neither helper quotes values containing `\r`.
- [ ] **BUG** Date stamps come from `new Date().toISOString().slice(0, 10)` (UTC) in QualityReviewPanel (`:140`) and Districts. Between local midnight and the UTC offset, the file is stamped with yesterday's date.
- [ ] **QUESTION** No helper protects against CSV formula injection (cells starting with `=`, `+`, `-`, `@`). Should `platform/export` prefix such cells with `'`? The data is free text typed by field staff.
- [ ] **QUESTION** Two signatures with reversed argument order (`(headers, rows, filename)` vs `(filename, headers, rows)`) make it easy to mix them up. The new API should take one options object.

---

## Component Trainee record PDF (`constants/pdf.ts`) (unrouted)

### Purpose
Builds and downloads a per-person "Training Attendance Record" PDF. This is the **only** PDF export in the legacy app (jsPDF is imported nowhere else; grep). It belongs to the training-log module (demo data behind a flag, per decision). The layout primitives (title bar, key-value table, grid table, page footer) are what `platform/export` PDF support must provide.

### Trigger
- [ ] Lazy-loaded on click from `TraineeRecordModal` (`await import("@/constants/pdf")`, `legacy:src/components/TraineeRecordModal.tsx:55-66`). The modal tracks `pdfState` `working` / `idle` / `error`. Errors are logged with `console.error("Trainee PDF export failed:", error)` and the state set to `error` (no toast).
- [ ] Libraries: `jspdf` ^4.2.1, `jspdf-autotable` ^5.0.9 (`legacy:package.json:61-62`). The file comment still says "Requires: npm i jspdf jspdf-autotable" (`:7`).

### Layout (A4 portrait, mm, margin 14) — reproduce
- [ ] Throws `"No training records to export."` when the list is empty (`:73`).
- [ ] Title, top-left: "Training Attendance Record", helvetica bold 16 (`:80-83`). Top-right: `` `Generated ${formatDate(today)}` ``, 9pt grey (`:85-93`). A green rule under the header at y=24 (`:95-97`).
- [ ] Person block (2-column key-value table): Name, NRC, Sex, Designation, Trainings (count), Certified in (`` `${certified} of ${total}` ``) (`:100-108`).
- [ ] One section per enrollment. Before each section, start a new page if fewer than 70mm remain (`ensureSpace`, page bottom margin 20; `:33-40,114`). Grey bar with `` `${index+1}. ${title}` `` on the left and the status label on the right (`:116-125`).
- [ ] Training key-values: Training ID, Partner, Start date, End date, Health facility, District, Training site, Master trainers (Yes/No), Target audience (`audienceLabel`), Sessions / hours (`` `${n} sessions, ${h} hours` ``), Trainers (joined `"; "`), Materials (`:127-140`).
- [ ] Results grid table, header row filled green. Headers in order: `Attendance`, `Pre-test`, `Post-test`, `Change`, `Completed`, `Certified`. Values: `` `${attended} of ${held}` `` + `` ` (${pct}%)` `` when held > 0; `formatScore` (`—` or `N%`); `formatChange` (`+N` / `N` / `—`); `yesNo` (`Yes` / `No` / `—`) (`:143-159`).
- [ ] Sessions striped table, headers `#`, `Session`, `Attendance`. Attendance is `"Present"` (green), `"Absent"` (red bold) or `"Not held yet"` (grey) (`:162-186`).
- [ ] Footer on every page: left `` `${name}, NRC ${nrc}` ``, right `` `Page ${i} of ${pages}` `` (`:192-201`). **No organisation or app branding** anywhere in the PDF.
- [ ] Filename: `` `training-record-${name}-${nrcDigits || "no-nrc"}.pdf` ``, lower-cased. The name has runs of non-alphanumerics replaced by `-` and leading/trailing `-` trimmed (`:206-210`).

### Bugs and quirks
- [ ] **BUG** The "Generated" date uses `generatedAt.toISOString().slice(0, 10)` (UTC), so it can show yesterday's date shortly after local midnight (`:89`).
- [ ] **BUG** The "not held" wording differs: the PDF says `"Not held yet"` (`:167`) and the CSV says `"Not held"` (`legacy:src/constants/utils.ts:196`).
- [ ] Colours are hardcoded RGB triples (`:22-26`). In the new app they come from theme tokens or a config palette.
- [ ] **QUESTION** The PDF footer prints the NRC (national ID) on every page. Is this PII acceptable in an exported file?

---

## Component Training-log constants and helpers (`constants/utils.ts`, `constants/types.ts`) (unrouted)

### Purpose
Domain types and pure helpers for the training log (`/training-log`, demo data). Despite the `constants/` path they are training-log module code and should move to `src/modules/training-log/model/`. Consumers: `legacy:src/pages/TrainingLog.tsx:54-72`, `legacy:src/components/TraineeRecordModal.tsx:12-22`, `legacy:src/constants/mockData.ts:13-15` (demo generator), `legacy:src/constants/pdf.ts:11-20`.

### Types (`legacy:src/constants/types.ts`) — reproduce shape
- [ ] `PARTNERS = ["PCZ", "BISO", "ZCCB", "Blue Code"]` (`:12`). These are partner organisation names, so they belong in program config. Used for the TrainingLog partner filter (`legacy:src/pages/TrainingLog.tsx:314`) and the demo generator.
- [ ] `TARGET_AUDIENCES = ["Trainer of Trainers", "MOH/DHO Staff", "HF Staff", "CHW", "Other"]` (`:15-21`).
- [ ] `MAX_SESSIONS = 22` ("The form has room for 22 sessions", `:24-25`).
- [ ] `Training` fields: `id, title, materials, partner, healthFacility, site, district, trainers[], startDate, endDate (ISO YYYY-MM-DD), isMasterTrainerTraining, targetAudience[], targetAudienceOther?, totalSessions, totalHours, sessions[{number,title}]` (`:33-62`).
- [ ] `TrainingParticipant` fields: `id, trainingId, rowNumber, name ("Surname, First name"), nrc ("Zambian NRC, e.g. 123456/10/1"), sex ("Male"|"Female"), designation, attendance[] (true=present, false=absent, null=not held), completedTraining|null, preTest|null (0-100), postTest|null, certified|null` (`:64-91`). The "Zambian NRC" comment and the NRC term are country-specific and must come from config (`:71`).
- [ ] `TrainingLog = { trainings, participants }`. Intended to be the future API response shape (`:8-10,93-96`).

### Helpers (`legacy:src/constants/utils.ts`)
- [ ] `STATUS_META`: `certified` → "Certified", `completed` → "Completed", `in_progress` → "In progress", `not_completed` → "Did not complete", each with badge colours (`:14-34`).
- [ ] `getEnrollmentStatus(p, t, todayIso)`: certified → `certified`; else completedTraining → `completed`; else `t.endDate >= todayIso` (string compare) → `in_progress`; else `not_completed` (`:95-104`).
- [ ] `buildEnrollments(log, today)`: one enrollment per participant whose training exists (orphans are dropped, `:115-116`). `held` = count of non-null attendance; `attended` = count of `true`; `scoreChange = post - pre` when both are present; `personKey = "nrc:<digits>"` or `"name:<lower-trimmed name>"` (`getPersonKey`, `:90-93`). `searchText` = lower-cased join of name, nrc, nrc digits, designation, title, healthFacility, site, district, training id (`:128-140`). Sort order: training startDate desc, then training id asc, then rowNumber asc (`:144-149`).
- [ ] `matchesSearch(e, query)`: trim + lower-case, split on whitespace, **every** term must be a substring of `searchText`. This makes an NRC typed without slashes match (`:153-157`).
- [ ] Formatters: `toIsoDate` (local date, `:55-56`); `formatDate(iso)` → `toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"})`, or the input unchanged if it cannot be parsed (`:58-66`); `formatDateRange` → a single date when start === end, otherwise `"A – B"` (`:68-69`); `yesNo` (`null`→`—`); `formatScore` (`N%`/`—`); `formatChange` (`+N`/`N`/`—`); `attendancePct` (rounded %, `null` when held = 0) (`:71-81`); `audienceLabel` (joins audiences, `"Other (<text>)"` when `targetAudienceOther` is set) (`:83-88`).
- [ ] CSV export (`CSV_HEADERS`, `:163-193`), exact order: `Training ID`, `Training Title`, `Training Materials / Manual`, `Partner`, `Health Facility`, `Training Site`, `District`, `Trainers`, `Start Date`, `End Date`, `Training of Master Trainers`, `Target Audience`, `Total Sessions`, `Total Hours`, `#`, `Name`, `NRC`, `Sex`, `Designation / Institution`, `Sessions Held`, `Sessions Attended`, `Attendance %`, `Pre-test %`, `Post-test %`, `Score Change`, `Completed Training`, `Certified`, `Status`, `Session 1` … `Session 22`.
- [ ] `enrollmentsToCsvRows` (`:198-235`): sources in header order are t.id, t.title, t.materials, t.partner, t.healthFacility, t.site, t.district, trainers joined `"; "`, startDate, endDate (ISO), Yes/No, audienceLabel, totalSessions, totalHours, p.rowNumber, p.name, p.nrc, p.sex, p.designation, held, attended, pct or `""`, preTest or `""`, postTest or `""`, scoreChange or `""`, completedTraining Yes/No or `""`, certified Yes/No or `""`, status label, then session cells. A session cell is `""` beyond `totalSessions`; otherwise `undefined` → `""`, `null` → `"Not held"`, `true` → `"Present"`, `false` → `"Absent"` (`:195-196,231-233`).

### Bugs and quirks
- [ ] **QUESTION** `formatDate` uses the `en-GB` locale directly (`:61`). The new app must format through `core/lib/format.ts` (config-driven format).
- [ ] The `"Not held"` vs `"Not held yet"` wording mismatch (see PDF).

---

## Component Geography constants (`constants/districts.ts`) (unrouted)

### Purpose
The hardcoded program geography. It moves to `program.config.ts` (`geography`), which `platform/scope` reads.

### Values (quote exactly, `legacy:src/constants/districts.ts:1-8`)
- [ ] `PROVINCES = ["Central Province", "Southern Province"]`. Unused.
- [ ] `DISTRICTS_BY_PROVINCE`:
  - `"Central Province"`: `["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"]`
  - `"Southern Province"`: `["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"]`
- [ ] `ALL_DISTRICTS` = flattened, in that order (12 districts).
- [ ] The backend has an identical copy, with a comment to keep it in sync with the frontend's program config (`backend:config/geography.js:1-7`). It is used by `backend:lib/userScope.js:2,39` for province scope. Any change to `program.config.ts` must also be made there.

### Consumers
- [ ] `useEffectiveDistrict` (`legacy:src/hooks/useEffectiveDistrict.ts:3,13-16`):
  - province users get `["All Districts", ...DISTRICTS_BY_PROVINCE[province]]`
  - district users get `[district]`
  - admins get `["All Districts", ...ALL_DISTRICTS]`
  - everyone else gets `ALL_DISTRICTS` with no "All Districts" entry
- [ ] PMTCTRegister: when "All Districts" is selected, it fetches each available district. If there are none, it falls back to `ALL_DISTRICTS` (`legacy:src/pages/PMTCTRegister.tsx:163-167`).
- [ ] MotherIndexRegister: imported, unused (`legacy:src/pages/MotherIndexRegister.tsx:17`). Its select lists `availableDistricts` minus "All Districts" (`:219`).

### Access (role conditions in the consumer, quoted for the access part)
- [ ] `isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support"` (`legacy:src/hooks/useEffectiveDistrict.ts:8`). This hardcodes a brand string.
- [ ] `isProvinceUser = description.includes("provincial") || description.includes("province")` (`:9`)
- [ ] `isDistrictUser = description.includes("district") || (!!user?.location && user.location !== "All" && !isAdmin && !isProvinceUser)` (`:10`)
- [ ] `province = user?.title && user.title !== "All" ? user.title : user?.province` (`:11`). `district = user?.location && user.location !== "All" ? user.location : (user?.district || DEFAULT_DISTRICT || "")` (`:12`).

### Bugs and quirks
- [ ] **BUG** The "all districts" sentinel is inconsistent: `"All Districts"` here (`legacy:src/hooks/useEffectiveDistrict.ts:14,16`) and `"All"` in the household/VCA registers (`legacy:src/pages/HouseholdRegister.tsx:437-441` sets `"All"`). The new scope hook should use one typed value (e.g. `null` = all).
- [ ] **BUG** Users who match no rule fall through to the full `ALL_DISTRICTS` list (`:13`), while the backend returns `{ level: "none" }` → deny (`backend:lib/userScope.js:16,48`). The UI offers districts whose data the API will refuse.
- [ ] Registers rebuild district lists from data with `toTitleCase(raw.trim())` instead of using these constants (e.g. `legacy:src/pages/HouseholdRegister.tsx:122-126`, `legacy:src/pages/Districts.tsx:89`). See helpers below.

---

## Component Generic helpers (`lib/utils.ts`) (unrouted)

| Export | Behaviour | Users (grep) | New home |
| --- | --- | --- | --- |
| `cn(...inputs)` | `twMerge(clsx(inputs))` (`:4-6`) | ~92 files | `core/lib/cn.ts` (shadcn standard) |
| `CAREGIVER_CONFIDENTIAL_LABEL` | `"Caregiver Name - Confidential"` (`:8`) | only via `anonymizeCaregiverName` | config / i18n string |
| `anonymizeCaregiverName(value)` | **Always** returns the label, whatever the input. The empty/"N/A" branch and the fall-through return the same thing (`:10-16`). | MotherIndexDetails (`legacy:src/pages/MotherIndexDetails.tsx:35`), Referrals (`legacy:src/pages/Referrals.tsx:119`) | a `core/lib/masking` helper with config labels |
| `toTitleCase(str)` | `""` for falsy input; lower-case, split on single spaces, capitalise the first character of each word (no whitespace collapsing, not hyphen-aware) (`:18-21`) | RecentActivity `:161-163`; district normalisation `toTitleCase(raw.trim())` in CaregiverRiskRegister `:90`, HTSRiskRegister `:109`, HouseholdArchivedRegister `:148`, VcaServicesDashboard `:261`, HouseholdRegister `:126`, VcaRiskRegister `:94`, VcaArchivedRegister `:202`, VcaRegister `:178`, HouseholdRiskRegister `:99`, Districts `:89`; display in HouseholdProfile `:1552`, VcaProfile `:1432` | merge into `normalizePlaceName` for places; a generic `titleCase` in `core/lib/format.ts` |
| `toSentenceCase(str)` | trim; first char upper, rest lower (`:23-27`) | Service profiles (field labels from `key.replace(/_/g," ")`): CaregiverServiceProfile `:254`, HouseholdServiceProfile `:203`, VcaServiceProfile `:237`; risk-register headings/options: CaregiverRiskRegister `:240,259`, VcaRiskRegister `:243,262`, HouseholdRiskRegister `:255,274` | `core/lib/format.ts` |
| `normalizePlaceName(raw)` | null/undefined → `""`; trim; collapse whitespace; lower-case; capitalise each space- and hyphen-separated part (`:35-49`) | AddUser `:222-223,252`; EditUser `:115-116,145`; CaseworkerJourneys `:147,579,747,826,884` | `core/lib/format.ts` (place names) or a normaliser in each module's schemas |
| `dedupePlaceNames(values)` | normalise each value, drop empties, de-dupe case-insensitively keeping the first, stable order (`:55-64`) | CaseworkerJourneys `:308` (then sorted with `localeCompare`) | same |

- [ ] Hardcoded masking duplicates use other wording and an en/em dash instead of a hyphen:
  - `"Caregiver Name – Confidential"` (`legacy:src/pages/HTSProfile.tsx:194,356`, `legacy:src/pages/HouseholdProfile.tsx:525,668`)
  - `"Mother Index Name — Confidential"` (`legacy:src/pages/MotherIndexDetails.tsx:119`)
  - `"Phone – Confidential"` (`legacy:src/pages/HTSProfile.tsx:380-381`, `legacy:src/pages/HouseholdProfile.tsx:738`)
  - `"Address – Confidential"` (`legacy:src/pages/HTSProfile.tsx:382`)

  Port as one masking helper with config-driven labels.
- [ ] **BUG** Two place-name normalisers disagree: `toTitleCase` gives `"St-anne's"` and keeps double spaces, while `normalizePlaceName` gives `"St-Anne's"` (`:18-21` vs `:35-49`). District dropdowns built with `toTitleCase` and user-form lists built with `normalizePlaceName` can end up with differently cased names for the same place.
- [ ] **QUESTION** Is it intended that `anonymizeCaregiverName` ignores its input and always masks? The dead branch suggests it once returned the real name.

---

## Component `isCategoryProvided` (`lib/data-validation.ts`) (unrouted)

### Rule (reproduce exactly; belongs in the services module `model/`, exported via its `index.ts`)
- [ ] `isCategoryProvided(record, key)` reads `record[key]`. Falsy (`undefined`, `null`, `""`, `0`, `false`) → `false` (`:10-12`).
- [ ] If the value is a string starting with `[` or `{`, it is `JSON.parse`d (`:16-18`).
- [ ] Array → `false` if empty. Otherwise each item goes through `String(v).trim().toLowerCase()`, and items in {`not applicable`, `none`, `null`, `n/a`, `na`, `no`, `false`, `0`, `""`} are dropped. Returns true if anything remains (`:21-39`).
- [ ] Non-array → `String(parsed).trim().toLowerCase()` must be non-empty and not in {`not applicable`, `n/a`, `na`, `none`, `no`, `false`, `0`, `[]`, `{}`, `null`} (`:42-54`).
- [ ] On JSON parse failure → the same single-value check without `[]`/`{}` (`:56-68`).
- [ ] Used with keys `health_services`, `schooled_services`, `safe_services`, `stable_services` to decide domain coverage (Health / Schooled / Safe / Stable):
  - CaregiverRiskRegister (`:155-158`), VcaRiskRegister (`:156-159`), HouseholdRiskRegister (`:162-165`)
  - VcaServicesDashboard (`:462-465`)
  - CaseworkerProfile (`:155-158` counts, `:196-199` per household, `:455-458` badge labels "Health" / "Schooled" / "Safe" / "Stable")

### Duplicates
- [ ] `isNotApplicable` (`legacy:src/pages/VcaServicesDashboard.tsx:155-159`), `NOT_APPLICABLE` lists (`legacy:src/pages/VcaServicesDashboard.tsx:81`, `legacy:src/components/dashboard/ServiceInsights.tsx:373`), a page-local `isEmpty` (`legacy:src/pages/VcaServicesDashboard.tsx:523`) and the exclusion in `legacy:src/components/dashboard/services/service-records.ts:249` (also drops `"other"`). Each uses a slightly different vocabulary. Consolidate into one services-module helper.

### Bugs and quirks
- [ ] **BUG** A JSON-object string such as `"{}"` or `'{"a":"none"}'` is parsed to an object, and `String(obj)` is `"[object object]"`, which is not in the exclusion list. So `"{}"` counts as **provided** (`:16-18,42-54`), although the single-value list clearly intends `{}` to mean empty.
- [ ] **BUG** Arrays of objects behave the same way (each item stringifies to `"[object object]"` → provided) (`:24-25`).
- [ ] **QUESTION** A plain comma-separated string like `"none, none"` counts as provided (no split). Confirm the field format with the backend fixtures.

---

## Component `AnimatedCounter` (unrouted)

### Purpose
Animates a KPI number counting up from its previous value. Used by the dashboard metric cards (`legacy:src/components/dashboard/MetricsGrid.tsx:85`) and the Districts stat cards (`legacy:src/pages/Districts.tsx:566`). Both pass pre-formatted strings (`Intl.NumberFormat("en-GB")`, `"N/A"` or `"0"`; `legacy:src/components/dashboard/MetricsGrid.tsx:180-185`, `legacy:src/pages/Districts.tsx:187-192`).

### Behaviour
- [ ] Strips commas from the value, then `parseInt(…, 10)`. If the result is NaN (e.g. `"N/A"`), the value is shown as-is with no animation (`:15-24`).
- [ ] Animates with `requestAnimationFrame` from the previous target to the new one with ease-out-cubic over `duration` (default 1200 ms). Each frame is formatted with `Intl.NumberFormat("en-GB")` (`:26-47`). The rAF is cancelled on unmount/change (`:49-53`). The initial display is `"0"` (`:10`).
- [ ] While loading, the callers show `LoadingDots` instead of the counter (`legacy:src/components/dashboard/MetricsGrid.tsx:85`, `legacy:src/pages/Districts.tsx:563-567`).

### Bugs and quirks
- [ ] **BUG** `parseInt` drops decimals and suffixes: `"12.5%"` animates to `"12"` and loses the `%`. Today's callers only pass integers, but the component would silently break other values.
- [ ] **BUG** `prevValue` is only updated when an animation finishes (`:42-44`). If a new value arrives mid-animation, the next run restarts from the old start value and visibly jumps.
- [ ] **BUG** It ignores `prefers-reduced-motion`.
- [ ] **QUESTION** CLAUDE.md allows "decorative animation only where it aids understanding". Should the KPI count-up be kept, and if so with reduced-motion support and config-driven number formatting (`core/lib/format.ts`) instead of hardcoded `en-GB`?

---

## Other behaviour
- [ ] Storage keys: none of the files in this part read or write localStorage, sessionStorage or IndexedDB.
- [ ] Timers: only `AnimatedCounter`'s `requestAnimationFrame` loop (`legacy:src/components/AnimatedCounter.tsx:41,47`). No polling or intervals.
- [ ] Browser APIs: `document.createElement("a")` + `click()` downloads (`legacy:src/lib/exportUtils.ts:23-28`, `legacy:src/lib/csv.ts:22-27`); `URL.createObjectURL` / `revokeObjectURL` (`legacy:src/lib/csv.ts:21,28`); jsPDF `doc.save` (`legacy:src/constants/pdf.ts:214`); dynamic `import()` for code splitting (`legacy:src/components/TraineeRecordModal.tsx:58`).
- [ ] Hardcoded program/brand strings in this part (move to `@/config`):
  - geography lists (`legacy:src/constants/districts.ts:1-6`)
  - partner names `PCZ`, `BISO`, `ZCCB`, `Blue Code` (`legacy:src/constants/types.ts:12`)
  - target audiences incl. `MOH/DHO Staff`, `HF Staff`, `CHW` (`legacy:src/constants/types.ts:15-21`)
  - the "Zambian NRC" term (`legacy:src/constants/types.ts:71`; NRC labels in `legacy:src/constants/pdf.ts:103,199`, `legacy:src/constants/utils.ts:180`)
  - the sub-population key/label lists (register files above)
  - `"ecap+ support"` admin check (`legacy:src/hooks/useEffectiveDistrict.ts:8`) and the `"ecap+"` role-name lookup (`legacy:src/pages/AddUser.tsx:263,268`, `legacy:src/pages/EditUser.tsx:155,158`)
  - the `en-GB` locale (`legacy:src/components/AnimatedCounter.tsx:38`, `legacy:src/constants/utils.ts:61`)
  - the confidential-label strings (`legacy:src/lib/utils.ts:8`)
- [ ] Backend asks:
  1. Ward/facility-level data scope. The `facility` CSV on the Directus user is never enforced (`backend:lib/userScope.js:18-49`).
  2. Geography is duplicated in `backend:config/geography.js` and must be kept in sync with `program.config.ts`.

## Open questions for the developer
1. **Sub-population list**: confirm one canonical list with labels (`CALHIV` vs `C/ALHIV`, `CWLHIV` vs `C/WLHIV`), which entities each applies to (household: 7; VCA: 14), and the long-form descriptions for CFSW, ABYM, C/SV, CWLHIV, CAICHH, CAICH, CAIFHH, MUC, which appear nowhere in the code.
2. Should the sub-population tri-state treat a missing flag as "no" (legacy behaviour) or as unknown? Should `"yes"`/`"no"` strings be accepted? Legacy rejects them in registers but accepts `"yes"` in VcaProfile.
3. Should the derived PBFW badges (`HIV+ PBFW`, `HIV- PBFW`, `Children of PBFW`) be kept, and should `agyw` really imply PBFW (`legacy:src/pages/VcaProfile.tsx:951-952`)?
4. CSV conventions for `platform/export`: always add a BOM? Guard against formula injection? Use one filename pattern (`<slug>-<scope>-<yyyy-MM-dd>.csv`) for all exports, or keep each page's legacy filename?
5. Should PDF exports carry organisation branding (from `site.config.ts`) in the header/footer? The only legacy PDF has none and prints the participant's NRC on every page.
6. Keep the animated KPI counter?
7. Should ward-scoped ("facility") users exist at all until the backend enforces ward scope? The UI promises scoping that nothing implements.
8. `anonymizeCaregiverName` always masks. Confirm caregiver names must never be shown anywhere in the app.
