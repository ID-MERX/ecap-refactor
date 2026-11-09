/**
 * Programme and domain configuration: country, geography, fiscal year, sub-populations, terms.
 *
 * Rule (`CLAUDE.md` hard rule 4): no program detail may be hardcoded outside `src/config/`.
 *
 * ⚠️ `geography` is a hard runtime constraint. The backend (`lib/userScope.js`) expands a province
 * user's scope by looking their province up as an exact, case-sensitive key in its own copy of this
 * map (`config/geography.js`). A typo here returns `level: "none"` on the server and the user gets
 * 403 on every dashboard call. `src/config/__tests__/program.config.test.ts` asserts the two maps are
 * equal; keep them that way.
 */

/** PEPFAR fiscal years run 1 October – 30 September and are named for the year they end in. */
const FISCAL_YEAR_START_MONTH = 10; // 1-based; October

/**
 * Current fiscal year, from a `Date`. Oct–Dec belong to the *next* FY, Jan–Sep to the current one.
 * Ported from the legacy `src/lib/fiscalYear.ts` and covered by unit tests, because every register's
 * default date filter depends on it.
 */
export function getCurrentFy(now: Date = new Date()): number {
  const month = now.getMonth() + 1; // 1-based
  return month >= FISCAL_YEAR_START_MONTH ? now.getFullYear() + 1 : now.getFullYear();
}

/** First and last day of an FY (inclusive, as `yyyy-MM-dd` strings for API params). */
export function fiscalYearRange(fy: number): { start: string; end: string } {
  return {
    start: `${fy - 1}-${String(FISCAL_YEAR_START_MONTH).padStart(2, "0")}-01`,
    end: `${fy}-09-30`,
  };
}

export type GeographyLevel = "province" | "district";

/**
 * The two programme provinces and their districts, in the order the registers and filters show them.
 * MUST equal `backend:config/geography.js` (verified 2026-11-04 — 2 provinces, 12 districts).
 */
export const geography = {
  levels: ["province", "district"] as const satisfies ReadonlyArray<GeographyLevel>,
  provinces: {
    "Central Province": [
      "Chibombo",
      "Kabwe",
      "Kapiri Mposhi",
      "Mkushi",
      "Mumbwa",
      "Chisamba",
      "Serenje",
    ],
    "Southern Province": ["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"],
  },
} as const;

export type Province = keyof typeof geography.provinces;
export type District = (typeof geography.provinces)[Province][number];

export const provinces = Object.keys(geography.provinces) as ReadonlyArray<Province>;

export const districtsByProvince = geography.provinces satisfies Record<
  Province,
  ReadonlyArray<string>
>;

/** Every district, province implied. */
export const allDistricts: ReadonlyArray<{ district: District; province: Province }> =
  provinces.flatMap((province) =>
    geography.provinces[province].map((district) => ({ district, province })),
  );

/**
 * A sub-population filter chip.
 *
 * `key` is both the filter key and, by default, the field name read from the API. Where the legacy
 * VCA registers read a different (long-form) column, `dataKey` records it — see
 * `docs/AUDIT.md` §4.1 item 5.
 */
export type SubPopulation = {
  readonly key: SubPopulationKey;
  /** Shown in the UI on every screen. Unprefixed: no legacy `C/` anywhere. */
  readonly label: string;
  /** Used by the assistant prompt and in documentation. */
  readonly description: string;
  /** Column to read when it differs from `key`. */
  readonly dataKey?: string;
  /**
   * Which registers show this chip. Omitted means both.
   *
   * ⚠️ Open sub-question (Phase 4): the seven `dataKey` columns below appear nowhere in the backend
   * source. They may be ETL-only columns that no handler queries. Confirm they exist on `children`
   * before wiring the VCA filter to them — until then that filter matches nothing.
   */
  readonly registers?: ReadonlyArray<"household" | "vca">;
};

export const subPopulations: ReadonlyArray<SubPopulation> = [
  {
    key: "calhiv",
    label: "CALHIV",
    description: "Children/Adolescents Living with HIV",
  },
  {
    key: "hei",
    label: "HEI",
    description: "HIV Exposed Infants",
  },
  {
    key: "cwlhiv",
    label: "CWLHIV",
    description: "Children/Adolescents Living with a HIV-positive caregiver",
  },
  {
    key: "agyw",
    label: "AGYW",
    description: "Adolescent Girls and Young Women",
  },
  {
    key: "csv",
    label: "C/SV",
    description: "Child Survivors of Violence",
  },
  {
    key: "cfsw",
    label: "CFSW",
    description: "Children in Female Sex Work households",
  },
  {
    key: "abym",
    label: "ABYM",
    description: "Adolescent Boys and Young Men",
  },
  {
    key: "caahh",
    label: "CAAHH",
    description: "Child/Adolescent in an Aged-Headed Household",
    dataKey: "child_adolescent_in_aged_headed_household",
    registers: ["vca"],
  },
  {
    key: "caichh",
    label: "CAICHH",
    description: "Child/Adolescent in a Chronically-Ill-Headed Household",
    dataKey: "child_adolescent_in_chronically_ill_headed_household",
    registers: ["vca"],
  },
  {
    key: "caich",
    label: "CAICH",
    description: "Child/Adolescent in a Child-Headed Household",
    dataKey: "child_adolescent_in_child_headed_household",
    registers: ["vca"],
  },
  {
    key: "calwd",
    label: "CALWD",
    description: "Child/Adolescent Living with Disability",
    dataKey: "child_adolescent_living_with_disability",
    registers: ["vca"],
  },
  {
    key: "caifhh",
    label: "CAIFHH",
    description: "Child/Adolescent in a Female-Headed Household",
    dataKey: "child_adolescent_in_female_headed_household",
    registers: ["vca"],
  },
  {
    key: "muc",
    label: "MUC",
    description: "Malnourished Under-5",
    dataKey: "under_5_malnourished",
    registers: ["vca"],
  },
  {
    key: "pbfw",
    label: "PBFW",
    description: "Pregnant and Breastfeeding Women",
    dataKey: "pbfw",
    registers: ["vca"],
  },
];

/** The 14 keys, spelled out so the type does not depend on the array's own inference. */
export type SubPopulationKey =
  | "calhiv"
  | "hei"
  | "cwlhiv"
  | "agyw"
  | "csv"
  | "cfsw"
  | "abym"
  | "caahh"
  | "caichh"
  | "caich"
  | "calwd"
  | "caifhh"
  | "muc"
  | "pbfw";

/** Sub-population chips for a given register. Household registers get 7, VCA registers get 14. */
export function subPopulationsFor(register: "household" | "vca"): ReadonlyArray<SubPopulation> {
  return subPopulations.filter(
    (sp) => !sp.registers || (sp.registers as ReadonlyArray<string>).includes(register),
  ) as ReadonlyArray<SubPopulation>;
}

/** The API column backing a sub-population filter, when it is not simply the key. */
export function subPopulationDataKey(key: SubPopulationKey): string {
  const found = (subPopulations as ReadonlyArray<SubPopulation>).find((sp) => sp.key === key);
  return found?.dataKey ?? key;
}

const SERVICE_DOMAIN_RISK_TYPES = [
  { value: "health_domain", label: "Missing health services", domain: "health_services" },
  { value: "schooled_domain", label: "Missing schooled services", domain: "schooled_services" },
  { value: "safe_domain", label: "Missing safe services", domain: "safe_services" },
  { value: "stable_domain", label: "Missing stable services", domain: "stable_services" },
  { value: "graduation_path", label: "Graduation ready (all 4)", domain: null },
] as const;

export const programConfig = {
  country: "Zambia",

  fiscalYear: {
    startMonth: FISCAL_YEAR_START_MONTH,
    label: (fy: number): string => `FY${fy}`,
    current: getCurrentFy,
    range: fiscalYearRange,
  },

  geography,

  subPopulations,

  /** Backend-stored de-registration values; keep exact spelling because the endpoint matches exactly. */
  householdArchiveReasons: [
    "Graduated (Household has met the graduation benchmarks in ALL domains)",
    "Exited without graduation",
    "Transferred to other OVC program",
    "Lost to follow-up",
    "Passed on",
    "Aging without transition plan",
    "Moved (Relocated)",
    "Other",
  ] as const,

  /** Shared service-domain gaps used by household and VCA risk registers. */
  householdRiskTypes: SERVICE_DOMAIN_RISK_TYPES,
  vcaRiskTypes: SERVICE_DOMAIN_RISK_TYPES,

  flagCategories: [
    "Missing Data",
    "Invalid Data",
    "Duplicate Record",
    "Incorrect Service",
    "Case Plan Mismatch",
    "Other",
  ] as const,
  flagSeverities: ["Low", "Medium", "High", "Critical"] as const,

  /** The four service domains; every service page is one of these. */
  serviceDomains: ["Schooled", "Healthy", "Safe", "Stable"] as const,

  terms: {
    child: "VCA",
    children: "VCAs",
    household: "Household",
    caseworker: "Caseworker",
  },

  dateFormats: {
    display: "dd MMM yyyy",
    input: "yyyy-MM-dd",
  },

  /**
   * Loose date parsing formats, in priority order. The legacy profile pages accepted any of these
   * via `moment`, and several register columns are free text (`docs/AUDIT.md` §6.10).
   *
   * `dd/MM/yyyy` MUST stay before `MM/yyyy` and before `MM/dd/yyyy`: Zambian data is day-first, and
   * reordering silently flips the day and month of every ambiguous value.
   */
  looseDateFormats: [
    "yyyy-MM-dd",
    "dd/MM/yyyy",
    "dd-MM-yyyy",
    "dd MMM yyyy",
    "MM/yyyy",
    "yyyy",
  ] as const,
} as const;

export type ProgramConfig = typeof programConfig;
export type ServiceDomain = (typeof programConfig.serviceDomains)[number];
