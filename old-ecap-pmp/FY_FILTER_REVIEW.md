# FY Filter — Codex Review Checklist

Audit the implementation of the **fiscal-year (FY) filter** across both apps. PEPFAR FY runs **Oct 1 → Sep 30**; current FY at audit time = **FY2026** (Oct 1, 2025 → Sep 30, 2026).

Both apps live under `/home/bluecode2022/mvaccbackup/ecapbackup/`:
- `production/dqa-dashboard` (ECAP II) + backend `production/ecapbackend`
- `ecap-plus-pmp` (ECAP Plus) + backend `ecap-plus-pmp-backend`

---

## 1. Shared primitives (must match in both apps)

Read both copies side-by-side and confirm they're identical or compatible:

| File | dqa-dashboard | ecap-plus-pmp |
|---|---|---|
| FY math helpers | `src/lib/fiscalYear.ts` | `src/lib/fiscalYear.ts` |
| Context provider | `src/context/FyFilterContext.tsx` | `src/context/FyFilterContext.tsx` |
| Header dropdown chip | `src/components/FyFilter.tsx` | `src/components/FyFilter.tsx` |
| Backend cohort helper | `production/ecapbackend/lib/fyClause.js` | `ecap-plus-pmp-backend/lib/fyClause.js` |

Checks:
- [ ] `getCurrentFy(date)` returns `2026` for any date Oct 2025–Sep 2026, `2025` for Oct 2024–Sep 2025, etc.
- [ ] `getFyBounds(fy)` returns `{ from: "${fy-1}-10-01", to: "${fy}-09-30" }`.
- [ ] `resolveFy({mode:"fy", fy})` produces `fromDate`, `toDate`, `label`.
- [ ] `FyState` shape: `{ mode: "fy"|"all"|"custom", fy?, from?, to? }`.
- [ ] `fyToParams` ↔ `fyFromParams` round-trip preserves state.

## 2. Context provider wiring

In each `src/App.tsx`:
- [ ] `<FyFilterProvider>` is mounted **inside** `<BrowserRouter>` (because it calls `useLocation`/`useNavigate`).
- [ ] All `<Route>`s are inside `<FyFilterProvider>`.

`FyFilterContext.tsx`:
- [ ] On mount, initial state comes from **URL params first**, then **`localStorage`** (`fy_filter_state_v1`), then the default `{ mode: "fy", fy: getCurrentFy() }`.
- [ ] `setState(next)` writes to localStorage **and** reflects into URL via `navigate({ pathname, search }, { replace: true })`.
- [ ] When the URL changes externally (pasted link), `useEffect` on `location.search` syncs state — without infinite re-render.

## 3. Header chip

`src/components/FyFilter.tsx`:
- [ ] Trigger button shows `resolved.label` (e.g. "FY2026", "All time", "Custom: …").
- [ ] Dropdown uses **shadcn `Popover` + `Calendar`** components (NOT raw `<input type="date">`).
- [ ] Popover content has `z-[100]` to sit above hero/banner stacking contexts.
- [ ] Options listed: Current FY, Previous FY, full FY list (3 most recent), All time, Custom range.
- [ ] Custom range opens an inline two-field date picker (Aceternity-styled, using `<Calendar>` inside `<Popover>`).
- [ ] "Apply custom range" is disabled until both dates are picked.

Mount points:
- dqa: `src/components/dashboard/DashboardHeader.tsx` — right side, before NotificationCenter
- ecap-plus: `src/components/dashboard/DashboardHeader.tsx` — same position
- [ ] Both mounts wrap with `<div className="hidden md:block">` so mobile uses other controls.

Layout z-index (ecap-plus only — dqa already correct):
- [ ] `src/components/dashboard/DashboardLayout.tsx`: `<GlowHeader className="sticky top-0 z-40 sm:relative sm:z-30">`. Earlier value `sm:static sm:z-auto` would let WelcomeBanner overlap.

## 4. Backend helper (`lib/fyClause.js` — both backends)

Exports: `parseFyWindow(query)`, `buildCohortFyClause(window, opts)`, `buildServiceFyClause(window, opts)`.

- [ ] `parseFyWindow` only treats `from` + `to` as windowed if BOTH match `^\d{4}-\d{2}-\d{2}$`.
- [ ] `buildCohortFyClause` returns `{ clause, params: [to, from] }`. The clause uses parameterised `$N::date` placeholders.
- [ ] Cohort semantics:
  ```
  date_enrolled <= TO_DATE
  AND (de_registration_date IS NULL OR de_registration_date >= FROM_DATE)
  ```
- [ ] Handles both `YYYY-MM-DD…` and `DD-MM-YYYY` date string formats (ECAP tables mix them).
- [ ] `opts.enrolledCol` / `opts.deRegCol` allow alias-prefixed columns (e.g. `c.date_enrolled`).
- [ ] `opts.startParamIndex` is honoured so multiple clauses can share a `vals` array.

## 5. Endpoints — must accept `?from=&to=`

Spot-check by curling each:

```bash
# dqa
curl -s 'http://localhost:5000/child/total/vcas/count?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/household/hh/total/count?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/child/district/Livingstone?from=2023-10-01&to=2024-09-30'
curl -s 'http://localhost:5000/household/district/Livingstone?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/etl/services/vca/summary?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/etl/facility-performance?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/etl/caseworker-performance?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/etl/service-performance?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/etl/services/vca/timeseries?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:5000/etl/services/vca/distribution?from=2025-10-01&to=2026-09-30'

# ecap-plus
curl -s 'http://localhost:9003/child/vcas-count/All?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:9003/household/households-count/All?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:9003/child/vcas-assessed-register/All?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:9003/household/all-households/All?from=2025-10-01&to=2026-09-30'
curl -s 'http://localhost:9003/etl/services/vca/summary?from=2025-10-01&to=2026-09-30'
```

For each:
- [ ] HTTP 200, no SQL errors.
- [ ] Count under FY2026 is **lower than or equal to** all-time (sanity check).
- [ ] Count under FY2024 differs from FY2026 (cohort math is actually active).
- [ ] No pages return `bind message supplies N parameters` — that's a param-index bug in cohort clause.

## 6. Frontend API helpers — accept `fy?: FyWindow`

Each helper must append `?from=&to=` when the window is set:

dqa `src/lib/api.ts`:
- [ ] `getTotalVcasCount`, `getTotalHouseholdsCount`
- [ ] `getVcaCountByDistrict`, `getHouseholdCountByDistrict`
- [ ] `getChildrenByDistrict`, `getHouseholdsByDistrict`, `getHtsRegisterByDistrict`
- [ ] `getChildrenArchivedRegister`, `getHouseholdArchivedRegister`
- [ ] `getFacilityPerformance`, `getCaseworkerPerformance`, `getServicePerformance`
- [ ] `getServiceSummary`, `getServiceTimeseries`, `getServiceDistribution`

ecap-plus `src/lib/api.ts` — same helpers as above plus:
- [ ] `getHouseholdsByDistrict` (CSV cache key includes the fy fragment, e.g. `households_by_district:ALL:2025-10-01_2026-09-30`)
- [ ] `getChildrenByDistrict` (same cache-key pattern)
- [ ] `getHouseholdArchivedRegister` accepts `{ de_registration_reason, fy }`
- [ ] `getChildrenArchivedRegister` accepts `{ reason, fy }`

## 7. Pages — consume FY context

Every page that lists data should:
1. `import { useFyFilter } from "@/context/FyFilterContext";`
2. Pull `const { resolved: fy } = useFyFilter();` plus derive `fyArg` + `fyKey`.
3. Include `fyKey` in **every** affected `useQuery`/`useQueries` queryKey.
4. Pass `fyArg` as the `fy` param to API helpers.

| Page | dqa | ecap-plus | Status |
|---|---|---|---|
| Home `MetricsGrid` | ✅ | ✅ | done |
| Services (`ServicesPage` + KPI strip + Cohort strip + chart components) | ✅ | ✅ | done |
| Performance | ✅ | ✅ | done |
| Flags | ✅ | ✅ | done (client-side filter on `date_created`) |
| VCA Register | ✅ | ✅ | done |
| Household Register | ✅ | ✅ | done |
| VCA Archived Register | ✅ | ✅ | done |
| Household Archived Register | ✅ | ✅ | done |
| HTS Register | ✅ | ✅ | done |
| HTS Risk Register | n/a | ✅ | done |
| Index Mother Register | ✅ | n/a | done |
| PMTCT Register | ✅ | n/a | done |
| Household Risk Register | ✅ | ✅ | done |
| VCA Risk Register | n/a | ✅ | done |
| Caregiver Risk Register | n/a | ✅ | done |
| VCA Services Dashboard | n/a | ✅ | done |
| Household Services Page | n/a | ✅ | done |
| Districts (aggregate) | ✅ | ✅ | done |
| **Profile pages** (VcaProfile, HouseholdProfile, HtsProfile, PmtctProfile, CaregiverDetailedPage, VcaServiceDetailedPage, IndexMotherDetails, CaseworkerProfile) | exempt | exempt | by design — single entity |
| **Admin / static** (AddUser, EditUser, Users, Documentation, WeeklyExtracts, DataPipeline, CaseworkerJourneys, FlaggedRecordForm) | exempt | exempt | not data lists |

For each "⚠️ verify" cell:
- [ ] grep for `useFyFilter` — if missing, the page does not respect FY.
- [ ] If the page consumes `getXByDistrict` style helpers, it should pass `fyArg`.
- [ ] Decide if the page is in or out of scope; record in the "Status" column.

## 8. URL + persistence round-trip

In the browser:
- [ ] Open dqa home. Default FY chip = current FY.
- [ ] Open dropdown, pick **FY2024**. URL becomes `?fy=2024`. Numbers refresh.
- [ ] Reload (no URL change). Chip still says FY2024 (localStorage win).
- [ ] Manually change URL to `?fy=all`. Chip flips to "All time".
- [ ] Manually change URL to `?fy=custom&from=2024-01-01&to=2024-12-31`. Chip flips to "Custom: 2024-01-01 → 2024-12-31" and the page refetches.
- [ ] Open the same custom URL in ecap-plus — independent state (different localStorage key prefix; reading isolation is fine).

## 9. Smoke-test the cohort math

Pick a known facility (e.g. **Monze Mission Hospital**) and verify both apps:
- All-time VCA count ≥ FY2026 count.
- FY2024 count != FY2026 count.
- FY2023 should return zero or near-zero (most ECAP II data is post-Oct 2023).

For services:
- `services_this_month` semantics under FY: cohort metric (`enrolled` / `active` / `clhiv` / `hei` / `cwlhiv`) **does** narrow to FY-active cohort.
- Service-window metric (`services_this_month` / `services_last_month`) currently keeps calendar-month semantics — that's an explicit design choice. Surface in UI copy?

## 10. Edge cases to break

Try these and confirm graceful behaviour:
- [ ] `?fy=99999` → falls back to default (current FY).
- [ ] `?fy=custom` with no `from`/`to` → falls back to default.
- [ ] `?fy=custom&from=2026-09-30&to=2024-01-01` (reversed range) → either rejected (Apply button stays disabled) or returns zero rows (no crash).
- [ ] Backend hit without any `from`/`to` → returns all-time data (no FY clause appended).
- [ ] Backend hit with only `from` or only `to` → `parseFyWindow` should treat as `hasWindow=false`.

## 11. Visual / accessibility

- [ ] The FY chip dropdown is keyboard-navigable (Tab + Enter).
- [ ] Calendar opens with focus trap (shadcn handles this).
- [ ] Dropdown z-index `[100]` clears the WelcomeBanner's `backdrop-blur-xl` stacking context.
- [ ] On mobile (< md) the chip is hidden (we have other selectors there).

---

## How to run a full pass

```bash
# 1. Build both
cd /home/bluecode2022/mvaccbackup/ecapbackup/production/dqa-dashboard && npm run build
cd /home/bluecode2022/mvaccbackup/ecapbackup/ecap-plus-pmp && npm run build

# 2. Restart everything
pm2 restart ecapbackend ecap-plus-pmp-backend dqa-dashboard ecap-plus-pmp

# 3. Smoke endpoints (see section 5)

# 4. Open both apps in a browser, verify chip + numbers change on each FY pick

# 5. Static gap audit — pages that should but don't use FY:
for f in production/dqa-dashboard/src/pages/*.tsx; do
  grep -qE "useQuery|useQueries" "$f" && grep -qE 'from "@/lib/api"' "$f" \
    && ! grep -q useFyFilter "$f" \
    && echo "  dqa NO FY: $(basename $f)"
done
for f in ecap-plus-pmp/src/pages/*.tsx; do
  grep -qE "useQuery|useQueries" "$f" && grep -qE 'from "@/lib/api"' "$f" \
    && ! grep -q useFyFilter "$f" \
    && echo "  ecap NO FY: $(basename $f)"
done
```

## Status: complete

All page-level gaps from the original audit are now wired (Section 7). The only
pages NOT consuming `useFyFilter` are intentionally exempt:

- **Profile / detail pages** (single entity) — VcaProfile, HouseholdProfile,
  HtsProfile, PmtctProfile, CaregiverDetailedPage, VcaServiceDetailedPage,
  IndexMotherDetails, CaseworkerProfile (and ecap-plus equivalents). A profile
  is the history of one entity; filtering would blank it out.
- **Admin/static** — AddUser, EditUser, Documentation, WeeklyExtracts,
  DataPipeline (ETL monitoring), CaseworkerJourneys (GPS), FlaggedRecordForm
  (single record).

To confirm with one command:

```bash
for f in production/dqa-dashboard/src/pages/*.tsx ecap-plus-pmp/src/pages/*.tsx; do
  if grep -qE "useQuery|useQueries" "$f" && grep -qE 'from "@/lib/api"' "$f" \
     && ! grep -q useFyFilter "$f"; then
    echo "NOT FY-aware: $f"
  fi
done
```

Compare the result against the exempt list above. Any new page added later
that produces a data list must include the FY hook to stay compliant.
