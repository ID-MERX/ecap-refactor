# Phase 2 — `src/config` specification

Everything Phase 2 needs to write the five config files, with the developer's answers from
2026-11-03 already applied. Read this with `MIGRATION_PLAN.md` §4.2 and `AUDIT.md` §4.1/§4.5.

The rule that governs all of it (`CLAUDE.md` hard rule 4): **no branding or program detail anywhere
outside `src/config`.** `pnpm check:brand` fails the build otherwise.

---

## 1. `site.config.ts` — branding

```ts
export const siteConfig = {
  appName: "ICCMS PMP",                    // decision 1
  appShortName: "ICCMS",                   // decision 1
  appDescription: "Program management platform",
  organization: {
    name: "PCZ",                           // decision 1
    shortName: "PCZ",
    supportEmail: "info@bluecodeltd.com",  // decision 16 — vendor address, revisit post-launch
    // no website field — decision 28
  },
  brand: {
    logo: "/brand/logo.svg",               // TODO(dev): files not supplied yet
    logoMark: "/brand/logo-mark.svg",
    favicon: "/brand/favicon.ico",
    loginBackground: "/brand/login-background.jpg",
  },
  assistant: { name: "Bumi", enabled: true },   // decision 15
  storageNamespace: "iccms-pmp",                // every localStorage/IndexedDB key is prefixed
  pageTitle: (page?: string) => (page ? `${page} · ICCMS` : "ICCMS PMP"),
} as const;
```

**Placeholder brand assets.** No logo files were supplied. Phase 2 should generate neutral
placeholders (a wordmark SVG using the theme's primary colour, a square mark, a 32×32 favicon and a
plain gradient login background) and record them in `PROGRESS.md` under Follow-ups. `check:brand`
must still pass, so the placeholders must not contain any denylisted string.

**Strings that must migrate here** (`AUDIT.md` §4.1): `ECAP+`, `ECAP+ PMP`, `ECAP+ Program
Management Platform`, `ECAP +` (watermark in `SupportCenter.tsx:688`), `ecapplus`, `Bumi`, and the
support e-mail. **Do not migrate backend table names** (`flagged_forms_ecapplus*`,
`hts_register_ecapplus`, `date_enrolled_ecap`, …) — those are API contracts. Allow-list them in
`scripts/check-brand.mjs`.

---

## 2. `program.config.ts` — program and domain

```ts
export const programConfig = {
  country: "Zambia",

  fiscalYear: {
    startMonth: 10,                        // PEPFAR: 1 Oct – 30 Sep
    label: (fy: number) => `FY${fy}`,
    // getCurrentFy: month >= 9 → year + 1; else year  (port src/lib/fiscalYear.ts verbatim)
  },

  geography: {
    levels: ["province", "district"] as const,
    provinces: {
      "Central Province":  ["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"],
      "Southern Province": ["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"],
    },
  },                                       // decision 14 — must equal backend:config/geography.js

  subPopulations: [ /* see §3 */ ],

  serviceDomains: ["Schooled", "Healthy", "Safe", "Stable"],
  terms: { child: "VCA", children: "VCAs", household: "Household", caseworker: "Caseworker" },
  dateFormats: { display: "dd MMM yyyy", input: "yyyy-MM-dd" },
} as const;
```

**Geography is a hard constraint.** `backend:lib/userScope.js` expands a province user's `title` by
looking it up as an exact, case-sensitive key in its own copy of this map; a mismatch returns
`level: "none"` and the user gets **403 on every dashboard**. Add a Phase 2 test that asserts the
frontend map equals the backend's, and a note in `REBRANDING.md`.

**Date parsing.** `moment` is still used by two profile pages for a six-format loose parse
(`AUDIT.md` §6.10). Phase 2 only needs `core/lib/format.ts` to declare the formats; the parser lands
in Phase 3. Keep the format order — `DD/MM/YYYY` before `MM/DD/YYYY`.

---

## 3. `subPopulations` — the unified list (decision 13)

14 keys, unprefixed labels, used on every screen. Three optional fields preserve legacy behaviour
where the audit found it: `dataKey` (the long-form column the VCA registers read), `registers`
(which screens show the key), and `description` (only the assistant prompt had one).

```ts
type SubPopulation = {
  key: string;                    // the filter key and, by default, the column name
  label: string;                  // shown in the UI on every screen
  description?: string;           // for the assistant prompt and documentation
  dataKey?: string;               // column to read when it differs from `key`
  registers?: ReadonlyArray<"household" | "vca">;  // omit = both
};
```

| key | label | dataKey (legacy VCA mapping) | description |
| --- | --- | --- | --- |
| `calhiv` | `CALHIV` | — | Children/Adolescents Living with HIV |
| `hei` | `HEI` | — | HIV Exposed Infants |
| `cwlhiv` | `CWLHIV` | — | Children/Adolescents Living with a HIV-positive caregiver |
| `agyw` | `AGYW` | — | Adolescent Girls and Young Women |
| `csv` | `C/SV` | — | Child Survivors of Violence |
| `cfsw` | `CFSW` | — | Children in Female Sex Work households |
| `abym` | `ABYM` | — | Adolescent Boys and Young Men |
| `caahh` | `CAAHH` | `child_adolescent_in_aged_headed_household` | Child/Adolescent in an Aged-Headed Household |
| `caichh` | `CAICHH` | `child_adolescent_in_chronically_ill_headed_household` | … in a Chronically-Ill-Headed Household |
| `caich` | `CAICH` | `child_adolescent_in_child_headed_household` | … in a Child-Headed Household |
| `calwd` | `CALWD` | `child_adolescent_living_with_disability` | Child/Adolescent Living with Disability |
| `caifhh` | `CAIFHH` | `child_adolescent_in_female_headed_household` | … in a Female-Headed Household |
| `muc` | `MUC` | `under_5_malnourished` | Malnourished Under-5 |
| `pbfw` | `PBFW` | `pbfw` | Pregnant and Breastfeeding Women |

Per-screen visibility (`registers`) as legacy had it: the **first seven** appear on the household
registers *and* the VCA registers; the **last seven** appear on the VCA registers only. Household
registers therefore get 7 chips, VCA registers get 14 — same labels, same order, no `C/` prefix
anywhere. If the developer would rather show all 14 everywhere, delete the `registers` field.

> ⚠️ **Open sub-question for Phase 4.** The seven long-form `child_adolescent_in_*` /
> `under_5_malnourished` columns appear **nowhere in the backend source** (grep of
> `ecap-plus-pmp-backend/controllers/`). They may be ETL-only columns that simply are not queried in
> the handlers. Confirm they exist on `children` before the VCA register filter is wired to them;
> until then the filter will silently match nothing for those seven keys.

**Also fix the value matching.** Both registers treat a "yes" as `"1" | "true" | 1 | true` and a "no"
as `"0" | "false" | 0 | false | null | undefined`, so a column storing `"Yes"`/`"No"` — which is what
`/etl/services/:type/summary` filters on — matches **neither** button. Phase 4 should normalise
through one `toBoolean()` helper that accepts `1/0`, `true/false`, `yes/no`, case-insensitively.

---

## 4. `env.ts` — zod-validated environment

Only `env.ts` may read `import.meta.env`. Fail fast at startup with a readable error.

| Variable | Replaces | Required | Notes |
| --- | --- | --- | --- |
| `VITE_API_URL` | `REACT_PUBLIC_API_URL` | yes | DQA backend base URL |
| `VITE_DIRECTUS_URL` | `REACT_APP_BASE_URL` | yes | Directus REST base |
| `VITE_SUPERSET_URL` | `VITE_SUPERSET_DOMAIN` | when analytics on | |
| `VITE_SUPERSET_DASHBOARDS` | `VITE_SUPERSET_DASHBOARD_ID_1..3` | when analytics on | JSON map `{ key: uuid }` |
| `VITE_DIRECTUS_INVITE_ROLE` | `VITE_DIRECTUS_USER_ROLE` | yes | role UUID, not a secret |
| `VITE_DEBUG_API` | same | no | dev only |
| `VITE_FEATURES_OFF` | — | no | comma list, e.g. `assistant,support.calls` |

**Removed, never to return:** `VITE_SUPERSET_USERNAME`, `VITE_SUPERSET_PASSWORD`,
`VITE_GROQ_API_KEY`, `VITE_RESET_PASSWORD_URL` (derive from `window.location.origin`),
`VITE_DEFAULT_DISTRICT` (scope comes from access — see `AUDIT.md` §4.4 item 5), and the
`REACT_` prefix in `vite.config.ts` (it ships every `REACT_*` variable to the browser).

`.env.example` documents all of the above with empty or obviously-fake values. `.env*` is git-ignored
except the example (already in the repo-root `.gitignore`).

---

## 5. `features.ts` — flags

```ts
export const features = {
  "module.households": true,
  "module.vcas": true,
  "module.caregivers": true,
  "module.services": true,
  "module.hts": true,
  "module.pmtct": true,
  "module.motherIndex": true,
  "module.referrals": false,   // no working backend endpoint yet — AUDIT.md §6.2
  "module.flags": false,    // unscoped backend list/mutations; keep off until caller scope is enforced
  "module.performance": false,   // endpoints trust caller-supplied district; keep off until scoped auth is enforced
  "module.caseworkers": true,
  "module.districts": true,
  "module.dashboard": true,
  "module.calendar": true,
  "module.users": true,
  "module.account": true,
  "module.dataPipeline": true,
  "module.support": true,
  "module.docs": true,
  "module.assistant": true,
  "module.analytics": true,
  "module.trainingLog": false, // no API exists: demo data only — AUDIT.md §6.9
  "support.chat": true,
  "support.calls": false,      // decision 4
} as const;
```

`module.referrals` defaults **off** because the page cannot show real data until the backend gains an
endpoint (`AUDIT.md` §6.2, backend ask #9). `module.trainingLog` defaults **off** so "Test data"
badges never appear in production. Both are overridable per environment via `VITE_FEATURES_OFF`.

---

## 6. Definition of done for Phase 2

- `pnpm check` passes on an app that renders one placeholder page whose title comes from
  `siteConfig.pageTitle`.
- A deliberate deep import across modules fails lint (`eslint-plugin-boundaries`).
- A deliberate `"ECAP"` string in a component fails `pnpm check:brand`.
- `python3 scripts/draft-fixtures.py --check` passes, wired into `pnpm check`.
- A unit test asserts `programConfig.geography` equals the backend's map.
- `PROGRESS.md` updated with the resolved versions (per the version policy in
  `MIGRATION_PLAN.md` §3) and the placeholder-asset follow-up.
