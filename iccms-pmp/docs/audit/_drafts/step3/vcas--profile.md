# vcas — legacy audit (part: profile)
> New module `vcas` · Legacy routes → new routes: `/profile/vca-details` → `/vcas/:vcaId` (this part only; `/vcas`, `/vcas/archived`, `/registers/vca-risk` are covered by other parts) · Plan: MIGRATION_PLAN.md §5 row "vcas"

## Legacy files

| File | Lines | Role |
| --- | --- | --- |
| `src/pages/VcaProfile.tsx` | 1807 | The VCA profile page (route `/profile/vca-details`). It also defines the local components `ActivityTable` (`:1567-1641`), `cleanArrayString` (`:1643-1652`), `VcaServicesDetailTable` (`:1654-1747`), `InfoCard` (`:1750-1779`) and `InfoItem` (`:1782-1805`). Read in full. |
| `src/App.tsx` | 602 | Lazy import (`:51`), route (`:461-468`), QueryClient defaults (`:113-132`). Relevant parts read. |
| `src/components/auth/ProtectedRoute.tsx` | ~23 | Route guard. Read in full. |
| `src/components/dashboard/AppSidebar.tsx` | 346 | Nav sections (`:50-112`), role filtering (`:147-180`). Relevant parts read. Has no entry for this route. |
| `src/components/dashboard/MobileBottomNav.tsx` | 52 | Has no entry for this route (grep `:9-10`). |
| `src/components/dashboard/GlobalSearch.tsx` | 212 | VCA record links into this route (`:126-145`). Read in full. |
| `src/hooks/useEffectiveDistrict.ts` | 18 | **Not used by this page.** The page computes its own district (`legacy:src/pages/VcaProfile.tsx:198-201`). Read in full for comparison. |
| `src/lib/api.ts` | 1486 | Wrappers used here: `dqaGet` (`:185-210`), `getListFromApiWithCache` (`:212-238`), `getChildrenByDistrict` (`:368-379`), `getChildrenArchivedRegister` (`:388-409`), `getVcaServicesByChildId` (`:508-513`), `getVcaReferralsById` (`:574-579`), `getVcaCasePlansById` (`:587-592`), `getVcaCasePlanDomainsById` (`:594-602`), `getFlaggedRecords` (`:604-628`), `createFlaggedRecord` (`:630-652`), `updateFlagStatus` (`:1283-1300`). Imported but unused here: `DEFAULT_DISTRICT`, `getVcaServicesByDistrict` (`legacy:src/pages/VcaProfile.tsx:6-7`). Relevant parts read. |
| `src/lib/directus.ts` | 869 | `listUsers` (`:79-100`), `createNotification` (`:514-528`), `FLAG_NOTIFY_ROLE_KEYWORDS`/`isFlagNotifyRecipient` (`:637-655`), `notifyUsersOfFlag` (`:657-682`), `notifyUsersOfFlagResolution` (`:684-709`). Relevant parts read. |
| Inbound callers: `src/pages/VcaRegister.tsx:617-620`, `src/pages/VcaArchivedRegister.tsx:810-816`, `src/pages/VcaRiskRegister.tsx:365-370`, `src/pages/HouseholdProfile.tsx:1070-1080`, `src/pages/MotherIndexDetails.tsx:245` | — | Snippets read for the navigation payload only. |
| `backend:controllers/childController.js` | — | Handlers `getAllVCAsAssessedRegister` (`:43-78`), `getAllVCAsArchivedRegister` (`:80-132`), `getVcaServices` (`:155-179`), `getVcaCasePlans` (`:277-304`), `getVcaCasePlanDomains` (`:306-329`), `getAllReferrals` (`:331-356`). Read for the lookup columns. |

## Route `/profile/vca-details` → `/vcas/:vcaId`

### Purpose
A detail page for one VCA (child). It shows:
- a hero with active/deregistered status, a suppression badge and the ID
- 3 quick-stat cards: Household ID (links to the household), Facility, Last service date
- 5 tabs: **SUMMARY** (demographics, clinical and vulnerability fields, sub-populations), **CASEPLANS** (case plans, with vulnerabilities expanding inline), **SERVICES**, **REFERRALS**, and **FLAG RECORD FORM** (create a data-quality flag, list and resolve open flags)

Tab definitions are at `legacy:src/pages/VcaProfile.tsx:621-641`.

### Access
- [ ] **Route guard:** `ProtectedRoute` only, with no role check (`legacy:src/App.tsx:461-468`). `ProtectedRoute` renders `null` while auth loads, redirects to `/` with no user, and redirects to `/change-password` when `user.password_change_required` (`legacy:src/components/auth/ProtectedRoute.tsx:8-18`). The component is lazy-loaded via `lazyWithRetry` (`legacy:src/App.tsx:51`).
- [ ] **Sidebar / nav:** no entry in the sidebar (sections at `legacy:src/components/dashboard/AppSidebar.tsx:50-112`) or in the mobile bottom nav (`legacy:src/components/dashboard/MobileBottomNav.tsx:9-10` has only `/vca-services` and `/profile`). It is not in GlobalSearch's `navigationItems` (`legacy:src/components/dashboard/GlobalSearch.tsx:33-46`). GlobalSearch reaches it only as a **record link**: the "Recent VCAs (District)" group shows the first 10 VCAs of `user?.location ?? DEFAULT_DISTRICT` and navigates with `state: { id }`. The id is `pickValue(vca, ["vca_id","vcaid","child_id","unique_id","uid"])` (`legacy:src/components/dashboard/GlobalSearch.tsx:50,62-66,126-133`). In the new app, the `vcas` search provider should link to `/vcas/:vcaId`.
- [ ] **In-page role checks:**
  - `const isDistrictUser = user?.description === "District User";` (`legacy:src/pages/VcaProfile.tsx:199`)
  - `const district = isDistrictUser ? user?.location || "None" : "";` (`legacy:src/pages/VcaProfile.tsx:201`). The code comment says "Admins and Provincial Users have global view access at the profile level" (`:200`).
  - Nothing else is hidden by role. The flag form and the Resolve buttons show for every signed-in user (`legacy:src/pages/VcaProfile.tsx:1271-1457`).
  - Port as `can()` checks: e.g. a `flags.create` / `flags.resolve` permission, plus a scope rule derived from `core/access`.
- [ ] **Data scope:**
  - District users get `user.location`, or the literal `"None"` if `location` is empty. Every other user gets `""` (`legacy:src/pages/VcaProfile.tsx:199-201`). `useEffectiveDistrict` is **not** used.
  - With `""`, the wrappers call `/child/vcas-assessed-register/` and `/child/vcas-archived-register/`. The backend treats an empty district as "no filter" and returns every district (`backend:controllers/childController.js:56-60,98-105`).
  - No FY window is sent: neither wrapper gets a `fy` (`legacy:src/pages/VcaProfile.tsx:205,211`).
  - So provincial users can open any VCA nationally, and a district user can open only VCAs in their own district. For a district user, any other VCA shows "Vca not found".
  - The per-VCA endpoints (services, case plans, domains, referrals) are by-ID lookups with **no scope check** on the backend (AUDIT.md §3.2: "by ID"). → Backend ask.
  - **QUESTION:** the new app should load the VCA by ID and enforce scope on the server. Should a provincial user see VCAs outside their province (legacy allows it)?

### Endpoints
All DQA GETs go through `dqaGet`. It sends a `Bearer` token and throws `data?.message ?? "DQA request failed"` on non-2xx (`legacy:src/lib/api.ts:185-210`). Lists are unwrapped by `getListValue` (`legacy:src/lib/api.ts:116+`). Global query defaults: `staleTime` 60 s, `gcTime` 24 h, refetch on mount/focus/reconnect, `retry: 1` (`legacy:src/App.tsx:126-131`). No query on this page overrides them, and none sets `refetchInterval`.

- [ ] `GET /child/vcas-assessed-register/:district(*)` (AUDIT.md §3.2), active VCA register
  - Wrapper: `getChildrenByDistrict(district)` (`legacy:src/lib/api.ts:368-379`)
  - Params: district as above, no `from`/`to`
  - Fires on mount, always (`enabled: true`)
  - Key: `["vcas","district",district]` (`legacy:src/pages/VcaProfile.tsx:203-207`). The same key is used by `HouseholdProfile` (`legacy:src/pages/HouseholdProfile.tsx:207`).
  - Extra IndexedDB cache: key `children_by_district:<district||"ALL">`, 60 s TTL (`LIST_CACHE_TTL_MS`, `legacy:src/lib/api.ts:14`), stale-on-error (`legacy:src/lib/api.ts:212-238`)
  - **The whole register is downloaded only to find one VCA client-side** (see the lookup below)
- [ ] `GET /child/vcas-archived-register/:district(*)` (AUDIT.md §3.2), archived VCA register
  - Wrapper: `getChildrenArchivedRegister(district)`, no `reason`, no FY (`legacy:src/lib/api.ts:388-409`)
  - Fires always
  - Key: `["vcas","archived","district",district]` (`legacy:src/pages/VcaProfile.tsx:209-213`)
  - No IndexedDB cache
- [ ] **Client-side lookup** (`legacy:src/pages/VcaProfile.tsx:293-303`)
  - `vca = [...active, ...archived].find(v => uid|unique_id|vca_id|id (lower-cased) === id.toLowerCase())`. The match is case-insensitive.
  - The first match wins, and active rows come first.
  - The new app should replace this with a by-ID fetch. The existing `/child/vca-profile/:unique_id(*)` is **broken** (it never returns data, AUDIT.md §3.2; handler reads `req.params.uid` while the route param is `unique_id`, `backend:controllers/childController.js:134-153`). Until the backend fixes it, the rebuild must keep the register lookup (QUESTION / Backend ask).
- [ ] `GET /child/vca-services/:vcaid(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaServicesByChildId(id)` (`legacy:src/lib/api.ts:508-513`)
  - Key: `["vca-services","vca",id]`, `enabled: Boolean(id)` (`legacy:src/pages/VcaProfile.tsx:215-219`)
  - The backend matches `vca_services.vcaid = $1` (`backend:controllers/childController.js:155-163`)
  - Post-processing: sorted by date, newest first (see Sort)
- [ ] `GET /child/vca-referrals/:unique_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaReferralsById(id)` (`legacy:src/lib/api.ts:574-579`)
  - Key: `["vca-referrals",id]`, `enabled: Boolean(id)` (`legacy:src/pages/VcaProfile.tsx:221-225`)
  - The backend matches `all_referrals.unique_id` (`backend:controllers/childController.js:331-340`)
  - Sorted newest first
- [ ] `GET /child/vca-caseplans/:unique_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaCasePlansById(id)` (`legacy:src/lib/api.ts:587-592`)
  - Key: `["vca-caseplans","vca",id]`, `enabled: Boolean(id)` (`legacy:src/pages/VcaProfile.tsx:227-231`)
  - The backend matches `ec_vca_case_plan.unique_id` (`backend:controllers/childController.js:277-286`)
  - Sorted newest first
- [ ] `GET /child/vca-caseplan-domains/:unique_id(*)` (AUDIT.md §3.2)
  - Wrapper: `getVcaCasePlanDomainsById(id)` (`legacy:src/lib/api.ts:594-602`)
  - Key: `["vca-caseplan-domains",id]`
  - **Lazy:** `enabled: Boolean(id) && expandedVulnPlanDate !== null`, so it first fires when "View Vulnerabilities" is clicked (`legacy:src/pages/VcaProfile.tsx:237-245`)
  - The backend matches `ec_vca_case_plan_domain.unique_id` (`backend:controllers/childController.js:306-314`)
  - Post-processing: rows are filtered to `String(v.case_plan_date ?? "") === expandedVulnPlanDate`. **If none match, all of the VCA's domain rows are shown** ("date drift" fallback, `legacy:src/pages/VcaProfile.tsx:246-255`).
- [ ] Directus `GET /items/flagged_forms_ecapplus_pmp?fields=*,flagged_by.first_name,flagged_by.last_name,user_created.first_name,user_created.last_name,created_by.first_name,created_by.last_name`
  - Wrapper: `getFlaggedRecords` (`legacy:src/lib/api.ts:604-628`). It returns `[]` with no token and swallows errors to `[]`, so a failure looks the same as an empty list.
  - Key: `["flagged-records"]`, no `enabled` (`legacy:src/pages/VcaProfile.tsx:257-260`). The key is shared with `Flags.tsx:43` and `HouseholdProfile.tsx:213`.
  - **Fetches every flag in the collection** (no filter, default Directus limit), then filters client-side: `String(f.vca_id || f.child_id || "").toLowerCase() === id.toLowerCase() && f.status !== "resolved"` (`legacy:src/pages/VcaProfile.tsx:262-270`)
  - The rebuild should filter on the server: `filter[vca_id][_eq]=…`.
- [ ] Directus `POST /items/flagged_forms_ecapplus_pmp`: create a flag
  - Wrapper: `createFlaggedRecord` (`legacy:src/lib/api.ts:630-652`). It throws `errorData?.message || "Failed to create flagged record"`.
  - Payload (`legacy:src/pages/VcaProfile.tsx:387-399`):
    - `household_id: vca.household_id || "N/A"`
    - `vca_id: id` (the raw id from navigation, not a normalised field)
    - `caseworker_phone: vca.caseworker_phone || "N/A"`
    - `caseworker_name: vca.caseworker_name || vca.cwac_member_name || "N/A"`
    - `caregiver_name: vca.caregiver_name || "N/A"`
    - `facility: vca.facility || vca.health_facility || "N/A"`
    - `comment`, `category`, `severity` (form values; `category`/`severity` may be `""`)
    - `verifier: "<first_name> <last_name>"` or `"Unknown Verifier"`
    - `status: "pending"`
  - On success: invalidate `["flagged-records"]`, call `notifyUsersOfFlag` (not awaited), toast, reset the form (`legacy:src/pages/VcaProfile.tsx:357-381`).
- [ ] Directus `PATCH /items/flagged_forms_ecapplus_pmp/:id` with body `{ status: "resolved" }`: resolve a flag
  - Wrapper: `updateFlagStatus(flagId,"resolved")` (`legacy:src/lib/api.ts:1283-1300`)
  - Then awaits `notifyUsersOfFlagResolution(String(record.household_id ?? ""), resolver, "Resolved from VCA profile.", String(record.vca_id ?? ""))`. The resolver is `"<first> <last>"` or `"Unknown Resolver"` (`legacy:src/pages/VcaProfile.tsx:326-351`).
  - On success: invalidate `["flagged-records"]` and toast.
  - **Note:** the DQA backend CORS does not allow `PATCH`, but this call goes to Directus, so that is irrelevant here.
- [ ] Directus `GET /users?fields=id,email,first_name,last_name,role.id,role.name,status,description,title,location,facility,avatar,last_access,password_change_required&limit=-1&filter[status][_eq]=active`
  - Called inside both notify functions via `listUsers("active")` (`legacy:src/lib/directus.ts:79-100`)
  - Recipients are users whose `role.name` (lower-cased) includes any of `"admin","administrator","supervisor","qa","data quality","manager"` (`legacy:src/lib/directus.ts:637-655`). **This is a role-name comparison;** port it to a backend or Directus Flow, or to an access rule.
- [ ] Directus `POST /notifications`, one request per recipient, via `Promise.allSettled` (`legacy:src/lib/directus.ts:514-528,657-709`). Body: `{recipient, subject, message, collection:"flagged_forms_ecapplus_pmp"}`.
  - `entityId` = `VCA <vcaId> (HH <hhId>)`, or `Household <hhId>` when the vcaId is falsy or `"Not Available"`
  - Create: subject `Record Flagged: <entityId>`, message `A record for <entityId> has been flagged by <verifier>. \n\nComment: <comment>`
  - Resolve: subject `Flag Resolved: <entityId>`, message `The flag for <entityId> has been resolved by <resolver>. \n\nResolution/Comment: <comment>`

### Fields used

**VCA record** (a row from the active/archived register; `children` table):

| Field (normalised) | Raw keys tried (in order) | Where shown / how used | Formatting |
| --- | --- | --- | --- |
| id (lookup) | `uid`, `unique_id`, `vca_id`, `id` | Match against the navigation id (`:293-303`) | case-insensitive |
| displayId | navigation `id` itself | Hero badge `#{id}` (`:490`), layout subtitle `Vca: ${id}` (`:440`) | raw |
| isArchived | `de_registration_date` OR `reason` truthy | Badge "Deregistered" (amber) vs "Active" (green) (`:431,459-477`) | — |
| virallySuppressed (hero) | `virally_suppressed === "YES"` (strict, upper-case) | "Suppressed" badge (`:478-485`) | — |
| gender | `vca_gender`, `gender` | Hero line `"<gender> · <age> years"` (`:508`); Summary "Gender" (`:654`) | raw, fallback "N/A" |
| age | `calculateAge(birthdate)` | Hero line (`:508`) | integer years; 0 when the date can't be parsed (`:98-141`) |
| ageDisplay | `age`, then `${calcAge} Years` | Summary "Age" (`:658`) | raw |
| location (hero) | `ward`, `district` | Hero MapPin (`:513`) | raw |
| householdId (card) | `household_id`, `household_code`, `householdid`, `hh_id` | Quick card "Household ID", clickable (`:538-556`) | raw |
| householdId (summary / flag) | `household_id` only | Summary "Household ID" (`:677`), flag payload (`:388`), notify (`:365`) | raw |
| facility | `facility` (card/summary); `facility`, `health_facility` (flag payload) | Card "Facility" (`:560`), Summary "Facility" (`:696`), flag payload (`:393`) | raw |
| lastServiceDate (card) | `sortedServices[0].service_date`, `vca.last_service_date` | Card "Last service date" (`:435-437,567-569`) | `DD MMM YYYY` (moment), else "N/A" |
| birthdate | `birthdate` | Summary "Date of birth" (`:649`) | `DD MMM YYYY` via `parseMomentDate` (strict formats ISO_8601, `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY/MM/DD`, then lenient fallback) (`:143-173`) |
| ageGroup | `age_group` | Summary "Age Group" | raw |
| school | `school_name`, `school` | "School" | raw |
| relation | `relation` | "Caregiver Relationship" | raw |
| province / district / ward | `province` / `district` / `ward` | "Province" / "District" / "Ward" | raw |
| partner | `partner` | "Partner" | raw |
| caseStatus | `case_status` | "Case Status" | raw |
| memberType | `member_type` | "Member Type" | raw |
| dateEnrolled / dateReferred / dateScreened | `date_enrolled` / `date_referred` / `date_screened` | same labels | **raw string, not formatted** |
| lastServiceDate (summary) | `last_service_date` | "Last Service Date" | raw (differs from the card, which uses the newest service row) |
| screeningLocation | `screening_location` | "Screening Location" | raw |
| caseworkerName | `caseworker_name` (summary); `caseworker_name`, `cwac_member_name` (flag payload) | "Caseworker Name" | raw |
| caseworkerPhone | `caseworker_phone` | "Caseworker Phone", flag payload | raw (PII) |
| caregiverName | `caregiver_name` | flag payload only | — |
| hivStatus | `is_hiv_positive` | "HIV Status" | raw |
| onArt | `receiving_art` | "On HIV Treatment?" | raw |
| artNumber | `art_number` | "ART Number" | raw |
| hivTestDate | `hiv_test_date` | "Date HIV Known" | raw |
| dateStartedArt | `date_started_art` | "Date Started ART" | raw |
| mmdLevel | `level_mmd`, `child_mmd` | "MMD Level" | raw |
| lastVlDate / nextVlDate | `date_last_vl` / `date_next_vl` | "Last VL Date" / "Next VL Date" | raw |
| vlLastResult / vlNextResult | `vl_last_result` / `vl_next_result` | "VL Last Result" / "VL Next Result" | raw |
| virallySuppressed (summary) | `vl_suppressed`, `virally_suppressed` | "Virally Suppressed?" | raw |
| testedForHiv | `child_been_tested_for_hiv` | "Child Tested for HIV?" | raw |
| testedLastYear | `been_tested_last_year` | "Tested Last Year?" | raw |
| receivedResults | `received_results_last_hiv_test` | "Received Results (Last HIV Test)?" | raw |
| tbScreening | `tb_screening` | "TB Screening" | raw |
| tpt | `takes_tb_preventive_therapy` | "Takes TB Preventive Therapy?" | raw |
| otherProphylaxis | `takes_drugs_to_prevent_other_diseases` | "Takes Drugs to Prevent Other Diseases?" | raw |
| birthCertificate | `received_birth_certificate` | "Received Birth Certificate?" | raw |
| pregnantBreastfeeding | `is_pregnant_breastfeeding` | "Pregnant / Breastfeeding?" | raw |
| under5Malnourished | `under_5_malnourished` | "Under-5 Malnourished?" | raw |
| isBiologicalChild | `is_biological_child`, `is_biological` | "Is Biological Child?" | raw |
| isIndex | `is_index` | "Is Index Case?" | raw |
| caregiverFsw | `is_the_child_caregiver_an_fsw`, `cfsw` | "Caregiver an FSW?" | raw |
| motherOnTreatment | `is_mother_currently_on_treatment_wlhiv` | "Mother Currently on Treatment?" | raw |
| motherAdhering | `is_mother_adhering_to_treatment_wlhiv` | "Mother Adhering to Treatment?" | raw |
| motherSuppressed | `is_mother_virally_suppressed_wlhiv` | "Mother Virally Suppressed?" | raw |
| motherArtNumber | `mother_art_number_wlhiv` | "Mother ART Number (WLHIV)" | raw |
| sexualViolence | `child_ever_experienced_sexual_violence` | "Child Experienced Sexual Violence?" | raw |
| otherViolence | `survivors_of_other_form_of_violence` | "Survivor of Other Form of Violence?" | raw |
| disability | `child_adolescent_living_with_disability` | "Living with Disability?" | raw |
| agedHeadedHh | `child_adolescent_in_aged_headed_household` | "Aged-Headed Household?" | raw |
| childHeadedHh | `child_adolescent_in_child_headed_household` | "Child-Headed Household?" | raw |
| chronicallyIllHeadedHh | `child_adolescent_in_chronically_ill_headed_household` | "Chronically-Ill-Headed Household?" | raw |
| femaleHeadedHh | `child_adolescent_in_female_headed_household` | "Female-Headed Household?" | raw |
| service | `service` | "Service" | raw |
| quarter | `quarter` | "Quarter" | raw |
| updatedStatus | `updated_status` | "Updated Status" | raw |
| dateEdited | `date_edited`, `dateedited` | "Date Edited" | raw |
| timeOnArt / timeSinceVl / timeSinceResult | `time_art` / `time_vl` / `time_result` | "Time on ART" / "Time since Last VL" / "Time since Last Result" | raw |
| subPopulations | every key in `subPopulationFilterLabels` whose value `isTrue`; plus derived flags from `pbfw`, `agyw`, `is_hiv_positive`, `calhiv`, `is_biological_mother_of_child_living_with_hiv`, `mother_pbfw`, `caregiver_pbfw` | "Sub Population Details" card (`:944-986`) | see Other behaviour |

Summary InfoItems are at `legacy:src/pages/VcaProfile.tsx:646-942`, in the order listed: "VCA Details" card (DOB, Gender, Age, Age Group), then the "Other Details" card (School … Time since Last Result). `InfoItem` shows `value || "Not Provided"`, but every caller already passes `"N/A"` as the fallback (`:1801`). Values are truncated, with the full value in a `title` tooltip (`:1797-1800`).

**Case plan row** (`ec_vca_case_plan`):

| Field | Raw keys (in order) | Where | Formatting |
| --- | --- | --- | --- |
| planDate | `case_plan_date` ?? `date_of_caseplan` ?? `date` (`??` for display; `\|\|` for sort) | "Case Plan Date"; key for vulnerability expansion | `DD MMM YYYY` |
| status | `case_plan_status` ?? `status` ?? "N/A" | "Status" badge: `1` → "Active", `0` → "Closed", else raw. Colour: active (string "active" or 1) green, closed (string "closed" or 0) grey, else sky. | — |
| dateCreated | `date_created`, `created_at` | "Date Created" | `DD MMM YYYY` |
| dateEdited | `date_edited`, `dateedited` | "Date Edited" | `DD MMM YYYY` |

**Case-plan domain / vulnerability row** (`ec_vca_case_plan_domain`, `:1140-1191`). Every text field goes through `cleanArrayString`: strip `[`, `]` and `"`, replace `,` with `", "`, `"N/A"` if empty (`:1643-1652`).

| Column | Raw key |
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
| (match key) | `case_plan_date` |

**Service row** (`vca_services`, `:1654-1747`): Service Date = `service_date`, `visit_date`, `date` (`DD MMM YYYY`). Health Services = `health_services`; HIV Services = `hiv_services`; Other Health = `other_health_services`; Safe = `safe_services`; School Services = `schooled_services`; Stable = `stable_services`, all through `cleanArrayString`. Row key: `id`, `unique_id`, or `<date>-<i>`.

**Referral row** (`all_referrals`, `ActivityTable`, `:1567-1641`):
- Record Name = `service`, `service_name`, `form_name`, `referral_type`, then "N/A"
- Date = `service_date`, `visit_date`, `date` (**not `referral_date`**), shown as `DD MMM YYYY`
- Status = `status`, `state`, then "N/A", shown in an outline badge

**Flag row** (`flagged_forms_ecapplus_pmp`):
- `id`, `vca_id`/`child_id` (match), `status` (exclude "resolved")
- `comment` (alert title through `toTitleCase`, fallback "Suspicious data entry")
- `verifier`
- `date_created`/`created_at`
- `category`/`form_type` (fallback "General")
- `severity` (fallback "Normal"; "Critical" in red)
- `comment`/`description`/`reason` (fallback "No description provided")
- `household_id` (resolution notify)

These are used at `legacy:src/pages/VcaProfile.tsx:1421-1546`.

### Filters / sort / pagination / search
- [ ] No filters or search on this page.
- [ ] **Tabs:** `defaultValue="overview"`. They are uncontrolled and not persisted to the URL or storage (`legacy:src/pages/VcaProfile.tsx:621`). Tab order and labels: `SUMMARY` (overview), `CASEPLANS` (history), `SERVICES` (services), `REFERRALS` (audit), `FLAG RECORD FORM` (flags) (`:625-631`). The new app could sync the tab to `?tab=` (UX improvement, optional).
- [ ] **Sort** (client-side, newest first, via `safeParseDate` → moment epoch, 0 if unparsable):
  - case plans by `case_plan_date || date_of_caseplan || date` (`:272-282`)
  - services by `service_date || visit_date || date` (`:284-291`)
  - referrals by `service_date || visit_date || date || referral_date` (`:305-315`)
  - flags are unsorted (Directus order)
  - no column is user-sortable
- [ ] **Pagination:** none. Every table renders all rows. Referrals sit in a `ScrollArea` 500 px tall with a horizontal scrollbar (`:1258-1266`). The services table is `min-w-[1200px] table-fixed`, with horizontal scroll (`:1681-1682`).

### Exports
- [ ] **BUG:** the REFERRALS tab has an "Export" button with **no `onClick`**, so it does nothing (`legacy:src/pages/VcaProfile.tsx:1249-1255`). The intended behaviour is presumably a CSV of the referrals table via `platform/export`: columns "Record Name", "Date", "Status", filename to be decided. **QUESTION:** implement it, or drop it?
- No other exports on this page.

### Charts
- [ ] No charts.
- [ ] Quick-stat cards (3, `:536-618`):
  - "Household ID" (clickable when present)
  - "Facility"
  - "Last service date"
- [ ] Count badges: "`<n>` Records" for services (`:1227-1232`) and "`<n>` records" for flags (`:1464-1469`).

### Links in / out
- [ ] **In.** Every caller passes the id in `location.state.id`, except VcaRiskRegister:
  - `VcaRegister`: `navigate("/profile/vca-details", { state: { id: String(id) } })` (`legacy:src/pages/VcaRegister.tsx:617-620`)
  - `VcaArchivedRegister`: `state: { id: String(id) }` (`legacy:src/pages/VcaArchivedRegister.tsx:810-816`)
  - `HouseholdProfile` members table: `state: { id: String(m.uid || m.vca_id || m.unique_id) }` (`legacy:src/pages/HouseholdProfile.tsx:1070-1080`)
  - `MotherIndexDetails` children list: `state: { id: String(cid), district: child.district || district }`. The `district` key is **ignored** by VcaProfile (`legacy:src/pages/MotherIndexDetails.tsx:245`).
  - `GlobalSearch`: `state: { id }`, where id = `vca_id → vcaid → child_id → unique_id → uid` (`legacy:src/components/dashboard/GlobalSearch.tsx:128-132`)
  - `VcaRiskRegister`: **query param** `navigate("/profile/vca-details?id=${id}")` (`legacy:src/pages/VcaRiskRegister.tsx:369`). See BUG.
- [ ] **ID resolution:** `location.state?.id` first. If present, it is written to `sessionStorage["ecap_last_vca_id"]`; otherwise that key is read back (`legacy:src/pages/VcaProfile.tsx:188-196`). The new app reads `:vcaId` from route params only (CLAUDE.md data rules). Legacy redirect: `/profile/vca-details?id=X` → `/vcas/X`. A state-only legacy link cannot be redirected; fall back to `/vcas`.
- [ ] **Out:**
  - "Household ID" quick card → `navigate("/profile/household-details", { state: { id: String(hhId) } })`, only when hhId is truthy (`:550-555`). New: `/households/:householdId` via the households module's path builder (`@/modules/households`).
  - "Back to register" button → `navigate(-1)` (`:518-525`). New: history back, falling back to `/vcas`.
  - Not-found EmptyState action "Back to Register" → `navigate("/vcas")` (`:420-423`).
  - No links out from service, referral or case-plan rows: there is no service detail link to `/services/vca/:recordId`. **QUESTION:** add one?

### Loading / empty / error
- [ ] **Page loading:** while *either* register query is loading, a centred `LoadingDots` fills a 50vh area, with layout subtitle "Vca profile" (`:403-411`). New: skeleton.
- [ ] **Not found:** when no VCA matches, including when there is no id at all, `EmptyState` shows (`:413-428`):
  - icon User
  - title "Vca not found"
  - description "The VCA record you're looking for doesn't exist or has been moved."
  - action "Back to Register" → `/vcas`
  - layout subtitle "Vca not found"
- [ ] **Case plans:**
  - loading: `LoadingDots` in a row spanning 5 columns
  - empty: FileText icon + "No case plans have been created for this VCA yet." (`:1015-1020,1203-1215`)
- [ ] **Vulnerabilities (expanded row):**
  - heading "Vulnerabilities recorded against the case plan dated `<DD MMM YYYY>`"
  - loading: `LoadingDots`
  - empty: "No vulnerabilities recorded for this case plan." (`:1089-1104`)
- [ ] **Services:** loading `LoadingDots`; empty "No VCA services found." (`:1661-1678`)
- [ ] **Referrals:** loading `LoadingDots`; empty "No referral tracking for this VCA." (`:1263,1578-1594`)
- [ ] **Flags:**
  - empty history: `EmptyState` with title "No flagged records" and description "This child has no documented data quality issues." (`:1551-1555`)
  - the "Active attention required" panel is hidden when there are no flags (`:1416`)
  - `isLoadingFlags` is destructured but never used (`:257`)
- [ ] **Errors:** none of the read queries render an error state. A failed sub-query looks like "empty", and a failed register query looks like "Vca not found". Flag fetch errors are swallowed to `[]` in the wrapper (`legacy:src/lib/api.ts:624-627`). Mutation errors use toasts (see Other behaviour). New: `<ErrorState>` with retry, per tab.

### Bugs and quirks
- [ ] **BUG:** `VcaRiskRegister` passes the id as `?id=` (`legacy:src/pages/VcaRiskRegister.tsx:369`), but VcaProfile reads only `location.state.id` (`legacy:src/pages/VcaProfile.tsx:189-196`). The page therefore shows the **last VCA viewed in this tab** (from sessionStorage) or "Vca not found". Route params fix this.
- [ ] **BUG:** the "Flagging history" table lists `vcaFlags`, which already **excludes resolved flags** (`:262-270,1491`). Resolved flags never appear in "history", and every row's status badge is hard-coded "Flagged" (`:1538-1543`). Intended: show all flags for the VCA, with the real status (pending/resolved).
- [ ] **BUG:** the flag date uses `format(new Date(flag.date_created), …)` with no guard (`:1438-1441`). In the history table, `String(... || "N/A") && format(new Date(item.date_created || item.created_at))` (`:1518-1527`) always calls `format`, because `"N/A"` is truthy. A missing or invalid date makes date-fns throw `RangeError: Invalid time value`, and the page crashes. Intended: show "N/A".
- [ ] **BUG:** the Referrals "Export" button is dead (no handler) (`:1249-1255`).
- [ ] **BUG:** referrals are sorted with `referral_date` as a fallback, but the Date column does not use `referral_date`, so rows sorted by it show "N/A" (`:308-311` vs `:1627-1629`).
- [ ] **BUG:** the hero title is a hard-coded placeholder, "VCA Name – Confidential", next to a decorative badge "Caseplans · Referrals · Services" (`:493-504`). The name is never shown. **QUESTION:** keep it confidential (no name), or show `firstname lastname`?
- [ ] **BUG:** the district role check is a strict `user?.description === "District User"` (`:199`). This differs from `useEffectiveDistrict` (includes "district", plus a location fallback, `legacy:src/hooks/useEffectiveDistrict.ts:9`). A district user whose description differs in case or wording gets national scope. Its sibling falls back to `"None"` when `location` is empty, which then 404s every VCA.
- [ ] **BUG:** ID mismatches across endpoints. The page sends the same navigation `id` to services (`vca_services.vcaid`), referrals, case plans and domains (`unique_id` columns), but callers pass different identifiers: GlobalSearch prefers `vca_id`, and HouseholdProfile prefers `uid`. If `uid ≠ unique_id`, the record is found (the lookup tries 4 keys), but services, case plans and referrals come back empty. Intended: normalise to the VCA's canonical `unique_id` (from the found record) before calling the by-ID endpoints. **QUESTION:** which field is canonical, and are `uid`/`unique_id`/`vcaid` always equal?
- [ ] **BUG:** the flag payload uses `vca_id: id` (the navigation id, not the normalised record id) (`:389`). Flags match by `vca_id || child_id` against that same raw id (`:267`), so a flag created from one entry point may not show from another.
- [ ] **BUG:** `calculateAge` returns `0` for missing or unparsable birthdates, shown as "0 years" in the hero (`:98-141,508`). Intended: "N/A".
- [ ] **BUG (perf):** the page downloads the full active **and** archived national registers (for non-district users) to show one VCA (`:203-213,293-303`). Use a by-ID endpoint (Backend ask: fix `/child/vca-profile/:unique_id(*)`).
- [ ] **BUG (perf):** it fetches the whole flags collection to filter client-side (`:257-270`).
- [ ] Quirk: the "Last service date" card uses the newest service row's `service_date`. The Summary "Last Service Date" item uses the record's raw `last_service_date` and is unformatted, so the two can disagree (`:435-437` vs `:727-729`).
- [ ] Quirk: most date fields in Summary are shown raw (unformatted strings). Only DOB is formatted (`:649,712-778`). New: format through `core/lib/format.ts`.
- [ ] Quirk: the hero suppression badge checks `virally_suppressed === "YES"` (case-sensitive), while Summary shows `vl_suppressed || virally_suppressed` (`:478,790-792`).
- [ ] Quirk: `isArchived` = `de_registration_date || reason` (`:431`). When the same VCA is in both lists, the active row wins (`:294`).
- [ ] Quirk: expanding vulnerabilities is keyed by plan **date**. Two case plans with the same date expand together, and a date mismatch shows *all* domains (`:246-255,1029`).
- [ ] Quirk: `ActivityTable`'s `type` prop is unused (`:1575`).
- [ ] **QUESTION:** the derived "HIV+ PBFW" / "HIV- PBFW" counts **`agyw` truthy as PBFW** (`pbfwFlag = isTrue(pbfw) || isTrue(agyw)`, `:951-952`). This looks wrong: AGYW is not PBFW.
- [ ] Quirk: `notifyUsersOfFlag` in the create `onSuccess` is not awaited, and notification failures are silent (`Promise.allSettled`) (`:364-369`). In resolve, notification is awaited inside `mutationFn`, so a `/users` failure makes the resolve show "Failed to resolve flag" even though the PATCH succeeded (`:327-340`).

## Other behaviour

- [ ] **Sub Population Details card** (`legacy:src/pages/VcaProfile.tsx:944-986`). Shown only when at least one label applies. Each label renders as an InfoItem with value `"True"`.
  - `isTrue(v)` = `v === "1" || v === "true" || v === 1 || v === true || String(v).toLowerCase() === "yes"`.
  - Generic labels (`subPopulationFilterLabels`, `:82-96`), shown when `isTrue(vca[key])`, in object-entry order: `calhiv: "C/ALHIV"`, `hei: "HEI"`, `cwlhiv: "C/WLHIV"`, `agyw: "AGYW"`, `csv: "C/SV"`, `cfsw: "CFSW"`, `abym: "ABYM"`, `caahh: "CAAHH"`, `caichh: "CAICHH"`, `caich: "CAICH"`, `calwd: "CALWD"`, `caifhh: "CAIFHH"`, `muc: "MUC"`. These are **sub-population program strings** and must come from `@/config` (program.config sub-populations).
  - Derived labels:
    - `"HIV+ PBFW"` if pbfwFlag && hivPos
    - `"HIV- PBFW"` if pbfwFlag && !hivPos
    - `"Children of PBFW"` if `is_biological_mother_of_child_living_with_hiv || mother_pbfw || caregiver_pbfw`
    - where pbfwFlag = `pbfw || agyw` and hivPos = `is_hiv_positive || calhiv`, all via `isTrue`
  - Code comment: "PBFW removed; the three derived PBFW sub-populations are computed per-VCA at render time" (`:80-81`).
- [ ] **Flag form** (react-hook-form + zod, `:175-181,317-324,1285-1412`):
  - Heading "Record New Flag".
  - Field `category` (optional) is a Select labelled "Flag category", placeholder "Choose category...(optional)". Options as value → label:
    - `Missing Data` → "Missing data"
    - `Invalid Data` → "Invalid data"
    - `Duplicate Record` → "Duplicate record"
    - `Incorrect Service` → "Incorrect service logging"
    - `Case Plan Mismatch` → "Case plan mismatch"
    - `Other` → "Other"
  - Field `severity` (optional) is a Select labelled "Priority severity", placeholder "Select severity... (optional)". Options:
    - `Low` → "Low severity"
    - `Medium` → "Medium severity"
    - `High` → "High severity"
    - `Critical` → "Critical issue"
  - Field `comment` (required) is a Textarea labelled "Flag observations & action details". Placeholder: "Provide detailed observations about the data quality issue, any suspected causes, and recommended immediate actions...". Validation: `min(10)` with message "Observation details must be at least 10 characters".
  - Footer hint: "Submitted flags will be reviewed by district monitors within 24 hours." (`:1393-1394`). This is a program/process claim; **QUESTION:** move it to config?
  - Submit button: "Submit flag record". While pending it shows "Submitting..." with LoadingDots and is disabled.
  - Defaults are `""` for all three fields. `form.reset()` on success.
  - **Quirk:** the Selects use `defaultValue={field.value}` (uncontrolled), so after `form.reset()` they may keep showing the previous choice.
  - The new app should share this flag form and the flag option lists with the `flags` module (export from `@/modules/flags`), not duplicate them. HouseholdProfile has the same feature.
- [ ] **Toasts** (sonner):
  - Create success: "Flag submitted successfully", description "The record has been flagged for review."
  - Create error: "Submission failed", description `err.message || "Please try again later."`
  - Resolve success: "Flag resolved", description "Caseworker and admins have been notified."
  - Resolve error: "Failed to resolve flag", description `err.message`
  - Citations: `:344-349,371-379`
- [ ] **Active attention panel** (`:1416-1457`):
  - Heading "Active attention required".
  - One card per unresolved flag:
    - title: `toTitleCase(flag.comment || "Suspicious data entry")`
    - line: "Flagged by `<verifier>` • `<MMM d, yyyy>`"
    - "Resolve" button, disabled while any resolve is pending
- [ ] **Flagging history table** (`:1459-1557`):
  - Heading "Flagging history", badge "`<n>` records".
  - Columns:
    - "Category": category, or form_type, or "General"; plus "`<severity||Normal>` priority" underneath, red when Critical
    - "Date flagged": `dd MMM yyyy`
    - "Observations"
    - "Status": always "Flagged"
- [ ] **Storage keys:**
  - `sessionStorage["ecap_last_vca_id"]`, written and read (`:192,195`). Drop it in the rebuild, because the route param replaces it.
  - IndexedDB list cache entry `children_by_district:<district||"ALL">`, written via `getListFromApiWithCache` (`legacy:src/lib/api.ts:368-379`).
  - React Query persistence to IndexedDB, app-wide (`legacy:src/App.tsx:122-123` comment). In the new app, flags are user-private workflow data, so mark them `meta: { persist: false }` as appropriate.
- [ ] **Timers / polling:** none on this page beyond the global refetch-on-focus/mount/reconnect defaults (`legacy:src/App.tsx:128-130`). There are decorative CSS `animate-pulse` blobs in the hero (`:446-447`); drop them per the UI rules.
- [ ] **Query meta for the new app:** the register and by-ID DQA endpoints read warehouse tables (`children`, `vca_services`, `ec_vca_case_plan*`, `all_referrals`), so set `meta: { etl: true }`. Scope belongs in the key wherever district is sent.
- [ ] **Keyboard / browser APIs:** none specific to this page. GlobalSearch's Ctrl/Cmd+K, which links here, belongs to the shell.

## Open questions for the developer
1. **By-ID lookup.** `/child/vca-profile/:unique_id(*)` is broken (handler reads `req.params.uid`, `backend:controllers/childController.js:135`). Can the backend fix it, so the profile stops downloading both national registers? Until then, should the rebuild keep the register-scan lookup?
2. **Canonical VCA id.** Which identifier is canonical in the route (`/vcas/:vcaId`): `unique_id`, `uid`, `vca_id` or `vcaid`? Are they always equal? Different endpoints filter on different columns (`vcaid` vs `unique_id`).
3. **Scope.** Should provincial users be limited to their province on the profile? Legacy gives every non-district user national access (`legacy:src/pages/VcaProfile.tsx:200-201`). The by-ID endpoints have no server-side scope check (Backend ask).
4. **Flag history.** Should it include resolved flags, with their real status? Legacy hides them (BUG above).
5. **Referrals "Export".** Implement it as a CSV, or remove it?
6. **Hero name.** Show the VCA name, or keep the "VCA Name – Confidential" placeholder?
7. **AGYW and PBFW.** Is counting `agyw` as PBFW in the derived sub-populations intended?
8. **Footer hint.** Should "reviewed by district monitors within 24 hours" become config-driven, or be removed?
9. **Notification recipients.** Recipients are chosen by role-name keyword matching on the client (`legacy:src/lib/directus.ts:637-655`). Should this move to a Directus Flow or a backend endpoint, and use permissions instead of role names?
10. **Service rows.** Should service rows link to `/services/vca/:recordId`? Legacy has no such link.
