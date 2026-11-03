# households — legacy audit (part: profile)

> New module `households` · Legacy routes → new routes: `/profile/household-details` → `/households/:householdId` (this part only; `/households`, `/households/archived` and `/registers/household-risk` are covered by the other households parts) · Plan: MIGRATION_PLAN.md §5 row "households"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/HouseholdProfile.tsx` | 1964 | The whole household profile page, read in full. It also defines the local components `HouseholdServicesDetailTable` (`:1696-1819`), `ActivityTable` (`:1821-1905`), `InfoCard` (`:1908-1937`), `InfoItem` (`:1940-1962`) and the helpers `parseMomentDate`, `safeParseDate`, `formatServiceDate`, `formatBirthDate` (`:101-131`) and `cleanArrayString` (`:1685-1694`). |
| `src/App.tsx` | 602 | Partial: route `:453-460`, lazy import `:48-50`, QueryClient defaults `:112-134`, IndexedDB persister `:136-161,214-224`. |
| `src/components/auth/ProtectedRoute.tsx` | 23 | Full: the only guard on this route. |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Partial: nav sections `:58,72`, role filter `:147-181`, `isActive` `:183`. The profile route has no nav entry. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Partial (`:1-30`): no entry for this route. |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | Partial (`:48-100,140-165`): the "Recent Households (District)" link in. |
| `src/hooks/useEffectiveDistrict.ts` | 18 | Full. **Not used** by this page; read for comparison. |
| `src/lib/api.ts` | 1486 | Partial: `dqaGet` `:185-210`, `getListValue` `:116-183`, IndexedDB list cache `:212-238`, wrappers `:301-339,368-379,444-449,529-534,543-572,604-652,1283-1305`. |
| `src/lib/directus.ts` | 869 | Partial: `listUsers` `:79-100`, `createNotification` `:514-527`, flag notification helpers `:635-709`. |
| `src/lib/utils.ts` | 64 | Partial: `toTitleCase` `:18-21`. |
| `src/lib/indexedDbCache.ts` | 92 | Partial: DB and store names `:6-7`. |
| `src/components/EmptyState.tsx` | 51 | Partial: props `title`, `description`, `action`. |
| Inbound callers (context only) | — | `GlobalSearch.tsx:150-158`, `HouseholdRegister.tsx:511,541-547`, `HouseholdArchivedRegister.tsx:636-640,698-705`, `HouseholdRiskRegister.tsx:375-380`, `CaregiverRiskRegister.tsx:132,173,354-360`, `Flags.tsx:167-169,393`, `CaseworkerProfile.tsx:187-192,381-384`, `MotherIndexDetails.tsx:33,128-131`, `VcaProfile.tsx:188-196,536-555`. |

Unused code inside `HouseholdProfile.tsx`, which does not need porting:
- the `subPopulationFilterLabels` map (`legacy:src/pages/HouseholdProfile.tsx:83-91`)
- the imports `DEFAULT_DISTRICT`, `getCaregiverReferralsByMonth` and `getCaregiverCasePlansByDistrict` (`:6,8,11`)
- the icons `ClipboardList`, `Layers`, `ShieldCheck`, `Link2`, `Archive` and `Sparkles` (`:28,30,31,35,39,81`)
- the local `caregiverName` (`:460-462`), computed but never rendered
- the `type` prop of `ActivityTable` (`:1829`), accepted but never read

---

## Route `/profile/household-details` → `/households/:householdId`

### Purpose
This is the read-only profile of one household (one caregiver), plus a data-quality flag form. It has:
- a hero header
- three stat cards
- six tabs: Summary, Family members, Case plans (with inline vulnerabilities), Caregiver services, Referrals and Flag record form, which also lists open flags and lets the user resolve them

The page works for both active and archived households (`legacy:src/pages/HouseholdProfile.tsx:227-264`).

### Access
- [ ] **Route guard:** `ProtectedRoute` only, with no role check (`legacy:src/App.tsx:453-460`; `legacy:src/components/auth/ProtectedRoute.tsx:4-21`).
  - It renders `null` while auth loads.
  - With no user it redirects to `/`.
  - If `password_change_required` is set, it redirects to `/change-password`.
- [ ] **Sidebar:** no entry. The sidebar items are `/households` (`legacy:src/components/dashboard/AppSidebar.tsx:58`) and `/households/archived` (`:72`). `isActive` is an exact path match (`:183`), so no sidebar item is highlighted on this page. The new shell should highlight "Households" for `/households/:householdId`.
- [ ] **Mobile nav:** no entry. "Registers" points to `/households` and also uses an exact match (`legacy:src/components/dashboard/MobileBottomNav.tsx:8,20`).
- [ ] **Global search:** the "Recent Households (District)" group links here. See Links in.
- [ ] **In-page role checks.** There is exactly one:
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/HouseholdProfile.tsx:150`).
  - It only chooses the district sent to the register endpoints (next item).
  - Nothing is hidden by role: the flag form, the Resolve buttons and all tabs are shown to every logged-in user (`:1391-1676`).
  - Port with `can(...)` permissions. **QUESTION:** should raising and resolving flags need a permission (e.g. `flags.create` / `flags.resolve`)? Legacy allows anyone.
- [ ] **Data scope:**
  - The code is `const district = isDistrictUser ? user?.location || "None" : "";` (`legacy:src/pages/HouseholdProfile.tsx:152`). The comment at `:151` says: "Admins and Provincial Users have global view access at the profile level".
  - A district user sends their `location`, or the literal `"None"` when it is empty.
  - Everyone else (admins, provincial users, support users, users with no description) sends `""`. Both register endpoints treat `""` as all districts (AUDIT.md §3.2), so a provincial user gets national data.
  - `useEffectiveDistrict` is **not** used here (compare `legacy:src/hooks/useEffectiveDistrict.ts:5-17`, which would restrict provincial users to their province). The new page must take scope from `platform/scope`.
  - The scope only affects whether the household is found in the register lists. The five by-ID endpoints have no scope check on the backend (AUDIT.md §3.2: "by ID"). They are called whenever an id is present, even if the household is outside the user's district.
  - **Backend ask:** enforce household ownership/scope on the `/household/...:household_id(*)` routes.
- [ ] **QUESTION:** if the household is not in the user's scoped registers but `location.state` carries a matching record, the page still renders it from the state (`:243-261`). That bypasses the client-side scope. The new page has no `location.state`; decide whether a scoped "not found" or a by-ID fetch is the intended behaviour.

### How the household ID arrives
- [ ] The id is resolved in `useMemo` at `legacy:src/pages/HouseholdProfile.tsx:140-147`, in this precedence:
  1. `location.state.id`
  2. the query param `?id=`
  3. `sessionStorage["ecap_last_household_id"]`
- [ ] When 1 or 2 is present, the value is **written** to `sessionStorage["ecap_last_household_id"]` (`:143`), as a side effect inside `useMemo`.
- [ ] The new page reads `:householdId` from the route param only (CLAUDE.md data rules). Legacy redirects must map `/profile/household-details?id=X` to `/households/X`. A link that carried only `location.state` cannot be redirected, so the legacy redirect for a bare `/profile/household-details` should go to `/households`.
- [ ] **BUG:** opening `/profile/household-details` with no state and no `?id` silently shows the **last viewed** household from sessionStorage (`:146`). Do not port this.
- [ ] Resolving the household record (`:227-264`):
  - The page concatenates the active register and then the archived register, and takes the first row where any of `uid`, `unique_id`, `household_code`, `household_id` or `id` equals the id, case-insensitively (`:228-239`).
  - If none matches, but `location.state` exists and its `id` / `household_id` / `unique_id` equals the id (case-insensitive), it builds the household from the **state object itself**. It adds `id`, `household_id` (state's or id), `unique_id` (state's or id) and `household_code` (state's `household_code`, then `household_id`, then id) (`:243-260`).
  - Otherwise the household is `undefined`, which shows "not found".
- [ ] **QUESTION:** the state fallback lets `MotherIndexDetails` pass a mother record spread into state (`legacy:src/pages/MotherIndexDetails.tsx:130`). The Summary tab then shows mother-row fields under household labels. The new page should not render from a foreign record. Decide whether to fetch by id instead. There is no single-household endpoint today (AUDIT.md §3.2), so the new page still has to find the row in the register lists. The register normaliser should expose a `findHousehold(id)` that matches `household_id` (and any alias the normaliser settles on) once.

### Endpoints
The DQA wrappers use `dqaGet` (`legacy:src/lib/api.ts:185-210`): a Bearer token, and it throws `data.message ?? "DQA request failed"` on a non-2xx response. Responses are unwrapped by the heuristic `getListValue` (`:116-183`). No query on this page overrides the global defaults (`legacy:src/App.tsx:112-134`): `staleTime` 60 s, `gcTime` 24 h, `retry: 1`, refetch on mount, focus and reconnect. Every successful query is persisted to IndexedDB for 24 h (`legacy:src/App.tsx:214-224`), including flags and household members.

- [ ] `GET /household/all-households/:district(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdsByDistrict(district)` (`legacy:src/lib/api.ts:301-312`).
  - Called with `district` from the Access section (`legacy:src/pages/HouseholdProfile.tsx:154-158`). No FY window is sent, so the endpoint returns all active households, not an FY cohort.
  - Key `["households","district",district]`; `enabled: true` (always fires, even without an id).
  - The wrapper adds an IndexedDB list cache: key `households_by_district:<district or "ALL">`, TTL 60 s, stale data served on fetch error (`legacy:src/lib/api.ts:212-238,305-310`; DB `ecap_plus_cache_db`, store `api_cache`, `legacy:src/lib/indexedDbCache.ts:6-7`).
  - Post-processing: only used to find one row (see "How the household ID arrives").
  - **BUG (performance):** it downloads the whole national active register (for non-district users) to show one household.
- [ ] `GET /household/all-households-archived/:district(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdArchivedRegister(district)` (`legacy:src/lib/api.ts:319-339`). No reason and no FY are sent (`legacy:src/pages/HouseholdProfile.tsx:160-164`).
  - Key `["households","archived","district",district]`; `enabled: true`. No wrapper cache.
  - Post-processing: concatenated after the active list for the lookup. Same performance BUG as above.
- [ ] `GET /household/caregiver-services/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getCaregiverServicesByHousehold(id)` (`legacy:src/lib/api.ts:444-449`).
  - Key `["caregiver-services","household",id]`; `enabled: Boolean(id)` (`legacy:src/pages/HouseholdProfile.tsx:166-170`).
  - Post-processing (`:351-367`):
    - Rows are filtered again on the client, keeping those where `household_id || householdId || hh_id` equals `household.household_id || id`, case-insensitively.
    - They are then sorted newest first by `service_date || visit_date || date`, using `safeParseDate` (unparseable dates become `0`, so they sort last).
  - **QUESTION:** the client re-filter is redundant, since the server already filters by `household_id`. It also drops every row when the id in the URL is a non-`household_id` alias (`uid` / `household_code`) that matched the household in the register. In that case the request was already sent with the wrong id. The new page should call every by-ID endpoint with the normalised `household.householdId`, not the raw URL value. Better still, the route param *is* the `household_id`.
- [ ] `GET /household/caregiver-caseplans/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getCaregiverCasePlansByHousehold(id)` (`legacy:src/lib/api.ts:551-556`).
  - Key `["caregiver-caseplans","household",id]`; `enabled: Boolean(id)`; default `[]` (`legacy:src/pages/HouseholdProfile.tsx:172-177`).
  - Post-processing: sorted newest first by `case_plan_date || date_of_caseplan || date` (`:369-379`).
- [ ] `GET /household/caregiver-caseplan-domains/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getCaregiverCasePlanDomainsByHousehold(id)` (`legacy:src/lib/api.ts:558-565`).
  - Key `["caregiver-caseplan-domains","household",id]`.
  - **Lazy:** `enabled: Boolean(id) && expandedVulnPlanDate !== null`, so it fires the first time any case-plan row is expanded (`legacy:src/pages/HouseholdProfile.tsx:184-194`).
  - Post-processing (`:195-204`):
    - Keeps the rows where `String(v.case_plan_date ?? "") === expandedVulnPlanDate`.
    - **If none match, it shows all of the household's domain rows.** This is deliberate: the comment at `:200-202` describes it as handling "date drift in the source data".
- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2)
  - Wrapper: `getChildrenByDistrict(district)` (`legacy:src/lib/api.ts:368-379`; IndexedDB cache key `children_by_district:<district or "ALL">`, 60 s).
  - Key `["vcas","district",district]`; `enabled: true` (`legacy:src/pages/HouseholdProfile.tsx:206-210`). The same key and function are used by `VcaProfile`, so the cache is shared (`legacy:src/pages/VcaProfile.tsx:204`).
  - Post-processing: only used to count the household's VCAs. It filters rows where `household_code || household_id` equals `id`, case-insensitively (`legacy:src/pages/HouseholdProfile.tsx:391-399`).
  - **BUG (performance):** it downloads the whole national active VCA register to show one count badge.
  - **QUESTION:** the badge counts active VCAs only, while the Family members tab lists every `children` row, both active and closed. The two numbers can disagree. The new page could derive the count from the members list (filtered by status if wanted) and drop this request.
- [ ] `GET /items/flagged_forms_ecapplus_pmp?fields=*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name` (Directus, AUDIT.md §3.3)
  - Wrapper: `getFlaggedRecords()` (`legacy:src/lib/api.ts:604-628`). It is a raw `fetch` with a Bearer token, and returns `[]` when there is no token or on a thrown error.
  - Key `["flagged-records"]`; no `enabled` condition (`legacy:src/pages/HouseholdProfile.tsx:212-215`). The key is shared with `Flags.tsx:43` and `VcaProfile.tsx:258`.
  - Post-processing (`:381-389`): keeps the rows where `household_id || hh_id` equals `household.household_id || id` (case-insensitive) **and** `status !== "resolved"`.
  - **BUG:** there is no filter, sort or limit, so it fetches every flag nationally (only the Directus default page size, AUDIT.md §3.3) and filters on the client. Flags beyond the first page never appear. Port it as `filter[household_id][_eq]=<id>`.
  - **BUG:** `response.ok` is never checked (`legacy:src/lib/api.ts:622-623`). On a 4xx/5xx, `getListValue` falls through to "the first non-empty array" (`:166-172`) and returns the Directus `errors` array as if it were flags.
- [ ] `GET /household/members/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdMembers(id)` (`legacy:src/lib/api.ts:314-317`).
  - Key `["household-members",id]`; `enabled: Boolean(id)`; default `[]` (`legacy:src/pages/HouseholdProfile.tsx:217-223`).
  - Post-processing: none. The order is as returned; the backend has no ORDER BY.
- [ ] `GET /household/caregiver-referrals/:household_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getHouseholdReferralsById(id)` (`legacy:src/lib/api.ts:567-572`).
  - Key `["caregiver-referrals",id]`; `enabled: Boolean(id)`; default `[]` (`legacy:src/pages/HouseholdProfile.tsx:401-406`).
  - Post-processing: sorted newest first by `service_date || visit_date || date || referral_date` (`:408-418`).
  - **BUG:** the backend date column is `referred_date` (AUDIT.md §3.2), which is not in this candidate list, nor in the display list at `:1883-1890`. The sort is effectively a no-op and the Date column probably shows "N/A". The normaliser should map `referred_date`.
  - **QUESTION:** key prefix `["caregiver-referrals", …]` is also used by `Referrals.tsx:169` with a different shape. Use the module key factory to keep them apart.
- [ ] `POST /items/flagged_forms_ecapplus_pmp` (Directus, AUDIT.md §3.3)
  - Wrapper: `createFlaggedRecord(payload)` (`legacy:src/lib/api.ts:630-652`). It throws `errorData.message || "Failed to create flagged record"`.
  - Fired by submitting the flag form (`legacy:src/pages/HouseholdProfile.tsx:275-298,331-349`). The payload is listed under Other behaviour.
- [ ] `PATCH /items/flagged_forms_ecapplus_pmp/:id` with body `{status:"resolved"}` (Directus, AUDIT.md §3.3)
  - Wrapper: `updateFlagStatus(flagId,"resolved")` (`legacy:src/lib/api.ts:1283-1305`; the id is not URL-encoded).
  - Fired by "Resolve" (`legacy:src/pages/HouseholdProfile.tsx:300-329`).
- [ ] `GET /users?fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required&limit=-1&filter[status][_eq]=active`, then N × `POST /notifications` (Directus, AUDIT.md §3.3)
  - Wrappers: `notifyUsersOfFlag` / `notifyUsersOfFlagResolution` → `listUsers("active")` + `createNotification` (`legacy:src/lib/directus.ts:79-100,514-527,657-709`).
  - They run after a flag is created or resolved. See Other behaviour.

### Fields used
The household row comes from `all_households` (active or archived register), or from `location.state` (see above). "N/A" is the fallback unless stated otherwise. Every value is shown through `String(...)`, so falsy values (`0`, `""`, `false`) show the fallback.

**Hero and stat cards** (`legacy:src/pages/HouseholdProfile.tsx:463-636`)

| Field | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| isArchived | `de_registration_date` (truthy) | Status badge: "Archived" (amber) or "Active" (emerald, glowing dot) (`:463-509`) | — |
| id | route id | Badge `#{id}` (`:514`); layout subtitle `Household: {id}` (`:472`) | mono |
| householdVcaCount | count of `vcas` where `household_code \|\| household_id` = id (`:391-399`) | Badge `{n} VCAs` (`:520`) | — |
| caregiver name | **not shown**: the literal `"Caregiver Name – Confidential"` is the H1 (`:525`) | H1 | gradient text |
| district | `district` | Hero meta line `{district} · {facility}` (`:531-532`) | — |
| facility | `facility` | Hero meta; stat card "Facility" (`:590`) | — |
| lastServiceDate | `householdServices[0].service_date`, then `household.last_service_date` (`:467-469`) | Hero "Last updated: …" (`:536`); stat card "Last service date" (`:597`) | `DD MMM YYYY`, else "N/A" |
| caseworker | `caseworker_name` | Hero meta (`:540`) | — |
| ward | `ward` | Stat card "Ward" (`:583`) | — |

**Summary tab → card "Caregiver Personal Information"** (`:665-739`)

| Label (exact) | Raw keys (in order) | Formatting |
| --- | --- | --- |
| Caregiver name | literal `"Caregiver Name – Confidential"` | — |
| Caregiver sex | `caregiver_sex`, `sex`, `gender` | raw |
| Date of birth | `caregiver_birthdate`, `caregiver_birth_date`, `dob` | `DD MMM YYYY` via `formatBirthDate` |
| HIV status | `caregiver_hiv_status`, `hiv_status` | raw |
| ART Number | `caregiver_art_number`, `art_number` | raw |
| On HIV Treatment? | `is_on_hiv_treatment`, `active_on_treatment` | raw |
| Date Started ART | `date_started_art` | **raw string**, not formatted |
| Date HIV Known | `date_hiv_known` | raw string |
| Marital status | `marital_status` | raw |
| Education | `education` | raw |
| Relation | `relation`, `relationship` | raw |
| Phone number | literal `"Phone – Confidential"` | — |

**Summary tab → card "Household Information"** (`:741-947`). Every value is a raw string; the date fields are **not** formatted.

| Label (exact) | Raw keys (in order) |
| --- | --- |
| Home Address | `homeaddress`, `home_address` |
| Family Source of Income | `fam_source_income` |
| Monthly Expenses | `monthlyexpenses` |
| Number of Beds | `beds` |
| Malaria ITNs | `malaria_itns` |
| Number of Pregnant Women | `number_of_pregnant_women`, `pregnant_woment` |
| Biological Children | `biological_children` |
| Approved Family? | `approved_family` |
| Acceptance | `acceptance` |
| Screening Location | `screening_location`, `screening_location_home` |
| Screening Date | `screening_date` |
| Enrolled Date | `enrolled_date` |
| Date Offered Enrollment | `date_offered_enrollment` |
| Date Referred | `date_referred` |
| Last Service Date | `last_service_date` |
| Client Screened | `client_screened`, `screened` |
| Client Result | `client_result` |
| HEI | `hei` |
| CALHIV | `calhiv` |
| Child MMD | `child_mmd` |
| VL Results on File? | `viral_load_results_on_file` |
| TPT Client Eligibility | `tpt_client_eligibility` |
| TPT Client Initiated | `tpt_client_initiated` |
| Takes Drugs to Prevent Other Diseases? | `takes_drugs_to_prevent_other_diseases` |
| Is Child's Caregiver an FSW? | `is_the_child_caregiver_an_fsw` |
| Is Biological Mother of Child Living with HIV? | `is_biological_mother_of_child_living_with_hiv` |
| Child Experienced Sexual Violence? | `child_ever_experienced_sexual_violence` |
| Violence in Last 6 Months? | `violence_six_months` |
| Children with Violence (6 Months)? | `children_violence_six_months` |
| VCA Gender | `vca_gender` |
| Adolescent Birthdate | `adolescent_birthdate` |
| Emergency Contact | `emergency_name` |
| School | `school` |
| Service | `service` |
| Quarter | `quarter` |
| Index Check Box | `index_check_box` |
| Consent Check Box | `consent_check_box` |
| ART Check Box | `art_check_box` |
| VL Check Box | `vl_check_box` |
| De-Registration Date | `de_registration_date` |
| De-Registration Reason | `de_registration_reason` |
| Exited / Graduation Reason | `exited_graduation_reason` |
| Active on Treatment? | `active_on_treatment` |

**Summary tab → card "Location & Facility"** (`:950-976`): Province `province`; District `district`; Ward `ward`; Health facility `facility`; Community entry `entry_type`; Partner `partner`, falling back to the hardcoded **`"PCZ"`** (`:974`).

**Summary tab → card "Caseworker Details"** (`:978-998`): Caseworker Name `caseworker_name`; Caseworker Phone `caseworker_phone`; Caseworker Username `provider_id`; Case Status `case_status`, then `status`, falling back to **`"Active"`** (`:995`).

**Family Members tab** (`:1002-1109`), from `/household/members` rows

| Column header (exact, in order) | Raw keys | Formatting |
| --- | --- | --- |
| Member Details | `uid`, `vca_id` | mono-ish chip |
| Birthdate | `birthdate` | `DD MMM YYYY`, else "N/A" |
| Gender | `vca_gender`, `gender` | raw |
| Disability | `disability` | raw, fallback **"None"** |
| Relationship | `relation`, `relationship` → `normalizeRelationship` | "Guardian" for `guardian`/`gardian`, "Parent" for `parent`, otherwise "N/A" (`:448-458`) |
| (blank header) | `uid`, `vca_id`, `unique_id` | "View profile" button → VCA profile |

**Case plans tab** (`:1111-1339`), from `/household/caregiver-caseplans` rows

| Column header (exact) | Raw keys | Formatting |
| --- | --- | --- |
| Case Plan Date | `case_plan_date` ?? `date_of_caseplan` ?? `date` | `DD MMM YYYY` |
| Status | `case_plan_status` ?? `status` | `1` → "Active" (emerald), `0` → "Closed" (slate); string "active"/"closed" (case-insensitive) gets the same colours; anything else shows as-is (sky) (`:1152-1179`) |
| Date Created | `date_created`, `created_at` | `DD MMM YYYY` |
| Date Edited | `date_edited` | `DD MMM YYYY` |
| Action | — | "View Vulnerabilities" / "Hide Vulnerabilities" toggle |

**Vulnerabilities sub-table** (`:1226-1312`), from `/household/caregiver-caseplan-domains` rows. Every cell except Due Date goes through `cleanArrayString`.

| Column header (exact) | Raw key |
| --- | --- |
| Domain | `vulnerability_type` (capitalised by CSS) |
| Vulnerability | `vulnerability` |
| Goal | `goal` |
| Services | `services` |
| Service Referred | `service_referred` |
| Institution | `institution` |
| Due Date | `due_date` (`DD MMM YYYY`) |
| Status | `status` |
| Comment | `vulnerability_comment` |

**Caregiver Services tab** (`HouseholdServicesDetailTable`, `:1696-1819`). The table is fixed-layout, `min-w-[1800px]`, with horizontal scroll. Every pillar column goes through `cleanArrayString`.

| Column header (exact, in order) | Raw key |
| --- | --- |
| Service Date | `service_date`, `visit_date`, `date` (`DD MMM YYYY`) |
| HIV status | `is_hiv_positive` (raw) |
| Viral Load | `vl_last_result` (raw) |
| Health Services | `health_services` |
| HIV Services | `hiv_services` |
| Other Health | `other_health_services` |
| Safe | `safe_services` |
| Other Safe | `other_safe_services` |
| Schooled | `schooled_services` |
| Other Schooled | `other_schooled_services` |
| Stable | `stable_services` |
| Other Stable | `other_stable_services` |

Row key: `id`, then `unique_id`, then `${service_date||visit_date||"service"}-${i}` (`:1767-1772`). **QUESTION:** `is_hiv_positive` and `vl_last_result` are not established columns of `caregiver_services` (AUDIT.md §3.2 lists only the pillar columns). Confirm them against a fixture.

**Referrals tab** (`ActivityTable`, `:1821-1905`)

| Column header (exact) | Raw keys (in order) | Formatting |
| --- | --- | --- |
| Record Name | `service`, `service_name`, `form_name`, `referral`, `referral_type`, `referral_name` | raw, bold |
| Date | `service_date`, `visit_date`, `date`, `referral_date`, `date_created`, `created_at` (**`referred_date` missing**) | `DD MMM YYYY` |
| Status | `status`, `state` | outline badge |

**Flags (open flags for this household)** (`:1536-1675`)

| Field | Raw keys | Where shown | Formatting |
| --- | --- | --- | --- |
| comment | `comment` (fallback "Suspicious data entry") | Attention card title | `toTitleCase` (`legacy:src/lib/utils.ts:18-21`) |
| verifier | `verifier` | "Flagged by {verifier} • {date}" | raw |
| date | `date_created` | Attention card | date-fns `MMM d, yyyy` (**no guard**, see Bugs) |
| category | `category`, `form_type` (fallback "General") | History table "Category" | bold |
| severity | `severity` (fallback "Normal") | `{severity} priority` under the category; red when `=== "Critical"`, otherwise slate | uppercase |
| date flagged | `date_created`, `created_at` | History table "Date flagged" | date-fns `dd MMM yyyy`, else "N/A" |
| observations | `comment`, `description`, `reason` (fallback "No description provided") | History table "Observations" | italic |
| status | — | History table "Status": always the literal badge **"Flagged"** | rose badge |

### Section headings and counters (exact copy)
- [ ] Hero eyebrow "Household profile" (`legacy:src/pages/HouseholdProfile.tsx:488-490`).
- [ ] Family tab heading "Family Members" (`:1004-1006`).
- [ ] Case plans tab heading "Caregiver Caseplans" (`:1112-1114`); expanded row caption "Vulnerabilities recorded against the case plan dated {DD MMM YYYY}" (`:1210-1214`).
- [ ] Services tab heading "Caregiver Services" with a badge "{n} Records", where n = rows after the client re-filter (`:1344-1352`).
- [ ] Referrals tab heading "Household Referrals" plus the dead "Export" button (`:1366-1375`).
- [ ] Flags tab: card heading "Record New Flag" (`:1399-1401`); attention block eyebrow "Active attention required" (`:1538-1540`); history heading "Flagging history" with badge "{n} records" (`:1581-1589`).

### Formatting helpers (port to `core/lib/format.ts` + date-fns)
- [ ] `parseMomentDate` (`:101-116`):
  - `null`/`""`/`"N/A"` → `null`.
  - Otherwise it does a **strict** moment parse against `[ISO_8601, "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD"]`.
  - If that fails it falls back to a lenient `moment(String(value))` (deprecated, and browser-dependent).
- [ ] `formatServiceDate` / `formatBirthDate` (`:123-131`): `DD MMM YYYY`, else `"N/A"`. They are identical. The new code should take the format from config via `core/lib/format.ts`.
- [ ] `safeParseDate` (`:118-121`): epoch ms, or `0` when unparseable. Used for the newest-first sorts.
- [ ] `cleanArrayString` (`:1685-1694`): falsy → "N/A". Otherwise it strips `[`, `]` and `"`, and replaces every `,` with `, `. The pillar columns hold JSON-array-like text. Port this as a normaliser (`string[]`) in `api/schemas.ts`, not as a display hack. Note that it also inserts a space after commas that are inside values.

### Filters / sort / pagination / search
- [ ] **Filters:** none on any tab.
- [ ] **Search:** none.
- [ ] **Sort.** None of the tables can be re-sorted by the user. The fixed sorts are:
  - services newest first (`:362-366`)
  - case plans newest first (`:369-379`)
  - referrals newest first (`:408-418`; broken, see the `referred_date` BUG)
  - members, flags and vulnerabilities in server order
- [ ] **Pagination:** none.
  - Every table renders all rows.
  - Referrals sit in a `ScrollArea` with a fixed `h-[500px]` and a horizontal scrollbar (`:1378-1386`).
  - Services scroll horizontally (`:1723-1724`).
  - The new tables use `platform/data-table` with client-side pagination.
- [ ] **Tabs:** `defaultValue="overview"`. The active tab is not in the URL and is not persisted (`:639`). The tabs, with internal id → label in order: `overview` "SUMMARY", `family` "FAMILY MEMBERS", `history` "CASEPLANS", `services` "SERVICES", `audit` "REFERRALS", `flags` "FLAG RECORD FORM" (`:643-650`). **QUESTION:** sync the tab to a `?tab=` URL param in the new page? (Recommended.)

### Exports
- [ ] **BUG:** the Referrals tab has an "Export" button (`legacy:src/pages/HouseholdProfile.tsx:1369-1375`) with **no `onClick`**, so it does nothing. **QUESTION:** implement it via `platform/export` (CSV of the referrals table: Record Name, Date, Status), or drop it? Nothing else on the page exports.

### Charts
- [ ] None. The only "KPIs" are the three stat cards (Ward, Facility, Last service date) and the hero badges (status, `#id`, `{n} VCAs`). Their sources are under Fields used.

### Links in / out
- [ ] **In** (grep of `household-details` in `legacy:src`). For each, the id key it carries and the new link to use:
  - `GlobalSearch` "Recent Households (District)":
    - `navigate("/profile/household-details", { state: { id } })`, where `id = pickValue(hh, ["household_id","householdId","hh_id","unique_id","id"])` (`legacy:src/components/dashboard/GlobalSearch.tsx:153,158`).
    - The list comes from `getHouseholdsByDistrict(user.location ?? DEFAULT_DISTRICT)`, sliced to 10 (`:51,72-76,152`).
    - New: `/households/:householdId`.
  - `HouseholdRegister` "View": `state: { id: String(id) }`, with `id = pickValue(household, ["household_id","householdId"])` (`legacy:src/pages/HouseholdRegister.tsx:511,546`).
  - `HouseholdArchivedRegister` "View": `state: { id: String(id) }`, with `id = pickValue(household, ["household_id","householdId","hh_id","id", …])` (`legacy:src/pages/HouseholdArchivedRegister.tsx:636-640,702-704`).
  - `HouseholdRiskRegister` "View profile": query `?id=${item.household_id}` (`legacy:src/pages/HouseholdRiskRegister.tsx:379`).
  - `CaregiverRiskRegister` "View profile":
    - query `?id=${item.displayId}`, where `displayId = household_id || hh_id` (trimmed), or the literal `"N/A"` (`legacy:src/pages/CaregiverRiskRegister.tsx:132,173,359`).
    - **BUG:** a row with no id links to `?id=N/A`.
  - `Flags` row click: `state: { id: record.household_id }` (`legacy:src/pages/Flags.tsx:167-169,393`).
  - `CaseworkerProfile` household row click: `state: { id: hh.id }`, where `hh.id = s.household_id || s.hh_id` from caseworker services (`legacy:src/pages/CaseworkerProfile.tsx:190-192,384`).
  - `MotherIndexDetails` "View Household Profile":
    - `state: { id: householdId, household_id: householdId, district, ...mother }`, where `householdId = pick(mother, ["household_id","hh_id","id","unique_id"])`.
    - The button is shown only when `householdId && householdId !== "N/A"` (`legacy:src/pages/MotherIndexDetails.tsx:33,128-131`).
  - `VcaProfile` "Household ID" stat card click: `state: { id: String(hhId) }` (`legacy:src/pages/VcaProfile.tsx:536-555`).
  - None of these callers writes sessionStorage or localStorage before navigating. The profile itself writes `ecap_last_household_id` (`legacy:src/pages/HouseholdProfile.tsx:143`).
  - All of them become `/households/<household_id>`. They should use a path builder exported from `@/modules/households` (e.g. `householdPath(id)`).
- [ ] **Out:**
  - Hero "View Household Profile":
    - `navigate("/profile/household-details", { state: { id, household_id: id, ...household } })` (`:546-557`).
    - **BUG:** it navigates to **this same page**, a no-op apart from re-pushing history. Drop it, or **QUESTION:** was it meant to go somewhere else?
  - Hero "Back to register": `navigate(-1)` (`:558-565`).
    - **BUG:** on direct entry (deep link, new tab) this leaves the app or does nothing.
    - New: go back to the referring register if one is in history, otherwise to `/households` (or `/households/archived` when the household is archived).
  - Not-found state "Back to Register" → `/households` (`:437-440`).
  - Family members "View profile":
    - `navigate("/profile/vca-details", { state: { id: String(m.uid || m.vca_id || m.unique_id) } })` (`:1072-1079`).
    - New: `/vcas/:vcaId`, via the `@/modules/vcas` path builder.
  - No link to `/flagged-record-form` or `/flags`. The flag form is embedded in the tab. **QUESTION:** in the new app, should the profile's flag tab reuse the flags module's form component (exported from `@/modules/flags`) rather than duplicate it? The plan maps `/flagged-record-form` → `/flags/new?householdId=`.

### Loading / empty / error
- [ ] **Page-level loading:** while **either** register query is loading, the page shows `DashboardLayout` (subtitle "Household profile") with a centred `LoadingDots`, `h-[50vh]` (`:420-428`). The by-ID queries do **not** block the page; each tab shows its own `LoadingDots` row.
- [ ] **Not found:**
  - When `household` is undefined: `DashboardLayout` with subtitle "Household not found", then `EmptyState` with the Home icon.
  - Title "Household not found"; description "The household record you're looking for doesn't exist or has been moved."; action "Back to Register" → `/households` (`:430-445`).
- [ ] **Empty states per tab:**
  - Family: "No family members have been registered for this household." (`:1098-1099`)
  - Case plans: "No case plans have been created for this household yet." (`:1329-1330`)
  - Vulnerabilities: "No vulnerabilities recorded for this case plan." (`:1222-1223`)
  - Services: "No caregiver services found." (`:1715`)
  - Referrals: "No referral tracking found" (`:1383`)
  - Flags history: `EmptyState` with title "No flagged records" and description "This household has no documented data quality issues." (`:1669-1673`)
  - The "Active attention required" block is hidden when there are no open flags (`:1536`).
- [ ] **Loading per tab:** `LoadingDots` in a full-width table row (members `:1030-1038`, case plans `:1137-1142`), in a block (services `:1703-1708`, referrals `:1832-1837`), or inline in the expanded vulnerabilities row (`:1215-1218`).
- [ ] **Error handling:** **none.** No query reads `isError`/`error`.
  - **BUG:** if a register request fails, the page shows "Household not found" (or a household built from state) instead of an error with retry.
  - **BUG:** if a by-ID request fails, the tab shows its *empty* message.
  - The new page needs an `<ErrorState>` with retry per section, and a page-level error when the household lookup fails.
- [ ] **Partial failure:** active and archived lookups are independent. If only one of them fails, a household in the other list still renders.

### Bugs and quirks
- [ ] **BUG:** `format(new Date(flag.date_created), "MMM d, yyyy")` has no guard (`:1558-1561`). A flag with a missing or invalid `date_created` throws `RangeError: Invalid time value` and crashes the profile. The history table, by contrast, guards and falls back to `created_at` (`:1638-1645`).
- [ ] **BUG:** "Flagging history" shows only **unresolved** flags, because `householdFlags` filters out `status === "resolved"` (`:387`). Its Status column always shows the literal "Flagged" (`:1660`), whatever the actual status (e.g. `pending`). **QUESTION:** should history list every flag with its real status, while the attention block lists the open ones?
- [ ] **BUG:** the flag form's Selects use `defaultValue={field.value}` (`:1420-1421,1461-1462`). After `form.reset()` on success (`:291`), the trigger keeps showing the previous category and severity while the form value is `""`. Use controlled `value`.
- [ ] **BUG:** `normalizeRelationship` maps anything other than guardian/gardian/parent to "N/A" (`:448-458`), which hides real values. Port it as a normaliser that keeps the raw value (title-cased) and only fixes the "gardian" typo.
- [ ] **BUG:** the falsy-to-"N/A" pattern (`String(x || "N/A")`) turns a numeric `0` into "N/A". This affects counts like `beds`, `biological_children` and `number_of_pregnant_women` if the API returns numbers (`:759,769,775`). Use `??` semantics in the normaliser.
- [ ] **BUG:** the Disability column falls back to "None" when the field is missing (`:1057`). That presents unknown data as a negative answer. Use the standard empty placeholder instead.
- [ ] **QUESTION:** the Summary tab shows raw, unformatted strings for most date fields (Date Started ART, Date HIV Known, Screening Date, Enrolled Date, Date Offered Enrollment, Date Referred, Last Service Date, Adolescent Birthdate, De-Registration Date), but formats Date of birth. The new page should format every date through `core/lib/format.ts`.
- [ ] **QUESTION:** the hero label "Last updated:" shows the latest service date, not a record-updated timestamp (`:536`). Rename it to "Last service"?
- [ ] **QUESTION (brand):** the Partner fallback is the hardcoded `"PCZ"` (`legacy:src/pages/HouseholdProfile.tsx:974`). It must come from `@/config` (program partner name), or the field shows the empty placeholder.
- [ ] **QUESTION (copy):** "Submitted flags will be reviewed by district monitors within 24 hours." (`:1513-1514`) is a program-specific SLA claim. Move it to config or drop it.
- [ ] **QUESTION (PII):**
  - Caregiver name and phone are masked with the literals "Caregiver Name – Confidential" (`:525,668`) and "Phone – Confidential" (`:738`).
  - Yet the page shows the caseworker phone in clear (`:986`) and sends `caregiver_name` into the flag record (`:340`).
  - The full register rows (with names) are also persisted to IndexedDB (`legacy:src/App.tsx:214-224`; `legacy:src/lib/api.ts:227`).
  - Confirm the masking policy. Should it be a config/permission (e.g. `households.viewPii`)? Mark the profile queries `meta: { persist: false }`.
- [ ] **QUESTION:** case-plan expansion is keyed by the plan **date string** (`:1151`), so two plans on the same date (or two with empty dates) expand together. Key it by plan id in the new page. The "no match → show all domains" fallback (`:203`) can show another plan's vulnerabilities under the wrong date. Keep it only with a visible notice, or drop it.
- [ ] **QUESTION:** the "VCAs" badge counts active VCAs from the national register by `household_code || household_id` against the raw id (`:391-399`), while the Family tab lists every `children` row (active and closed) from `/household/members`. The two can disagree.
- [ ] **Quirk:** `InfoItem` falls back to "Not Provided" (`:1958`), but every caller already passes "N/A", so "Not Provided" never shows.
- [ ] **Quirk:** the subtitle in the layout header is `Household: {id}` (`:472`); `id` may be `null`, which renders as "Household: null".
- [ ] **Quirk:** the household lookup also matches `uid` / `unique_id` / `id` (`:231-236`). VCA rows are not in these lists, but a household whose `household_code` equals another household's `household_id` would match first. The new code should match on the canonical `household_id` only.

---

## Other behaviour

### Flag form (tab "FLAG RECORD FORM", `:1391-1534`)
- [ ] Heading "Record New Flag" with a Flag icon.
- [ ] **Schema** (`:93-99`):
  - `category`: optional string.
  - `severity`: optional string.
  - `comment`: required, `min(10)`, with the message **"Flag observations must be at least 10 characters long."**
  - Default values are all `""` (`:266-273`).
- [ ] **"Flag category"** Select. Placeholder "Choose category...(optional)". Options (value → label) in order:
  - `"Missing Data"` → "Missing data"
  - `"Invalid Data"` → "Invalid data"
  - `"Duplicate Record"` → "Duplicate record"
  - `"Incorrect Service"` → "Incorrect service logging"
  - `"Case Plan Mismatch"` → "Case plan mismatch"
  - `"Other"` → "Other"

  (`:1419-1446`)
- [ ] **"Priority severity"** Select. Placeholder "Select severity... (optional)". Options:
  - `"Low"` → "Low severity"
  - `"Medium"` → "Medium severity"
  - `"High"` → "High severity"
  - `"Critical"` → "Critical issue"

  (`:1460-1483`)
- [ ] **"Flag observations & action details"** Textarea. Placeholder "Provide detailed observations about the data quality issue, any suspected causes, and recommended immediate actions..." (`:1495-1503`).
- [ ] Footer note: "Submitted flags will be reviewed by district monitors within 24 hours." (see the QUESTION above).
- [ ] Submit button: "Submit flag record". While pending it is disabled and shows "Submitting..." with `LoadingDots` (`:1516-1529`).
- [ ] **Payload** (`:331-349`):
  ```
  { household_id: id,
    caseworker_phone: household.caseworker_phone || "N/A",
    caseworker_name: household.caseworker_name || household.cwac_member_name || "N/A",
    caregiver_name: household.caregiver_name || "N/A",
    facility: household.facility || household.health_facility || "N/A",
    comment, category, severity,
    verifier: `${user.first_name} ${user.last_name}` (or "Unknown Verifier"),
    status: "pending" }
  ```
  - No `vca_id`, no `flagged_by`, and no district/province.
  - `household_id` is the raw route id, not `household.household_id`.
  - Empty category and severity are sent as `""`.
  - **QUESTION:** add `district` / `province` so that flags can be scoped on the backend (**Backend ask**: Directus permission on `flagged_forms_ecapplus_pmp`, AUDIT.md §3.3 item 9).
- [ ] **On success** (`:277-292`):
  1. Invalidate `["flagged-records"]`.
  2. Fire `notifyUsersOfFlag(id || "N/A", verifier, comment)` **without awaiting it**. Its errors are swallowed by `Promise.allSettled`.
  3. Toast success: "Flag submitted successfully", description "The record has been flagged for review."
  4. `form.reset()`.
- [ ] **On error** (`:293-297`): toast error "Submission failed", with the description `err.message || "Please try again later."`.

### Resolve flag (`:300-329,1565-1573`)
- [ ] Each card in "Active attention required" has a "Resolve" button. It calls `updateFlagStatus(flag.id, "resolved")`, then, if the flag is found in `householdFlags`, **awaits** `notifyUsersOfFlagResolution(String(record.household_id ?? ""), resolver, "Resolved from Household profile.", String(record.vca_id ?? ""))`.
- [ ] **On success:** invalidate `["flagged-records"]`, then toast "Flag resolved" with the description "Caseworker and admins have been notified."
  - **QUESTION:** the caseworker is not notified. Recipients are role-filtered admins and supervisors only (next item), so the description is inaccurate.
- [ ] **On error:** toast "Failed to resolve flag" with the description `err.message`. If the PATCH succeeded but the notification failed, the user sees an error even though the flag is resolved.
- [ ] While any resolve is pending, **every** Resolve button is disabled (shared `resolveMutation.isPending`).
- [ ] There is no confirmation dialog and no permission check.

### Flag notifications (`legacy:src/lib/directus.ts:635-709`)
- [ ] Recipients: `listUsers("active")`, which fetches **every** active user with `limit=-1` (`:79-100`), then a client-side filter `isFlagNotifyRecipient`. A user qualifies when `role.name` (lower-cased) **contains** any of `["admin","administrator","supervisor","qa","data quality","manager"]` (`:638-655`).
  - This is a role-name comparison, so in the new code it must move behind `core/access` or, better, to the backend (a Directus Flow on create/update).
  - **Backend ask:** server-side notification on flag create/resolve. The browser should not list all users.
- [ ] Entity label: `vcaId && vcaId !== "Not Available" ? "VCA {vcaId} (HH {hhId})" : "Household {hhId}"` (`:665-668,692-695`).
- [ ] On create: subject `Record Flagged: {entity}`; message `A record for {entity} has been flagged by {verifier}. \n\nComment: {comment}` (`:669-670`).
- [ ] On resolve: subject `Flag Resolved: {entity}`; message `The flag for {entity} has been resolved by {resolver}. \n\nResolution/Comment: {comment}` (`:696-697`).
- [ ] Each recipient gets one `POST /notifications` with `{recipient, subject, message, collection:"flagged_forms_ecapplus_pmp"}`. No `item` is sent, so a notification cannot deep-link to the flag. **QUESTION:** send `item`?

### Storage
- [ ] `sessionStorage["ecap_last_household_id"]`: written at `:143`, read at `:146`. **Drop it** (route param).
- [ ] IndexedDB `ecap_plus_cache_db` / `api_cache`, keys `households_by_district:<district|ALL>` and `children_by_district:<district|ALL>` (via the wrappers, `legacy:src/lib/api.ts:305-310,372-377`).
- [ ] React Query persisted cache (IndexedDB, key `ecap-plus-pmp-react-query`, 24 h; `legacy:src/App.tsx:136-161,214-224`). It includes `["flagged-records"]`, `["household-members",id]`, services, case plans and referrals.

### Timers / polling / browser APIs
- [ ] No page-specific timers or polling. Refresh comes from the global `refetchOnWindowFocus`/`refetchOnMount` with a 60 s `staleTime` (`legacy:src/App.tsx:126-131`), plus `EtlInvalidator` invalidating every query after an ETL run (shell).
- [ ] Decorative: a pulsing blurred hero background (`animate-pulse`, 6 s / 8 s, `:478-479`), a fade-in on mount (`:473`) and hover lift on the stat cards. Per the UI rules, this animation is decorative and can be dropped.

### Keyboard
- [ ] No page shortcuts. Global ⌘/Ctrl+K opens GlobalSearch, which links here (shell).

---

## Open questions for the developer
1. Scope: should provincial users be limited to their province on the profile (legacy gives them national access at `:151-152`, unlike `useEffectiveDistrict`)? And should an out-of-scope household id show "not found" (the legacy state fallback bypasses scope)?
2. There is no single-household endpoint: the new page must still find the household in the active and archived register lists, which are national for most users. Should the backend add `GET /household/:household_id`? (**Backend ask.**)
3. Flags: filter server-side by `household_id`. Should "Flagging history" include resolved flags with their real status? Who may raise or resolve a flag (permissions)?
4. Referrals "Export" button: implement it (CSV via `platform/export`) or remove it?
5. The hero "View Household Profile" button links to itself: remove it?
6. PII masking of caregiver name and phone: is it a fixed rule, a config flag, or a permission? Should the caseworker phone be masked too?
7. The `"PCZ"` partner fallback and the "within 24 hours" review promise: move them to `@/config` or drop them?
8. Case-plan vulnerabilities: keep the "show all domains when no date matches" fallback?
9. The "{n} VCAs" badge: count active VCAs from the members response instead of loading the national VCA register?
10. Notifications: move recipient selection to a Directus Flow (server-side)? Fix the resolve toast copy, which says "Caseworker … notified"?
11. Confirm the `caregiver_services` fields `is_hiv_positive` and `vl_last_result`, and the referral fields (`referred_date`, name/status columns), against the fixtures before writing the zod schemas.
