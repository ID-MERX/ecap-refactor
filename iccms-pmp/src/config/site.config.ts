/**
 * Branding for the whole application.
 *
 * Rule (`CLAUDE.md` hard rule 4): nothing in this file's domain may be hardcoded anywhere else.
 * `pnpm check:brand` fails the build if an app name, organisation, support address, assistant name
 * or program term appears outside `src/config/`. Import from `@/config` instead.
 *
 * Source of truth for the values: `docs/AUDIT.md` §4.1 (brand strings) and the decisions recorded
 * in `docs/PROGRESS.md`.
 */

const appShortName = "ICCMS";

export const siteConfig = {
  appName: "ICCMS PMP",
  appShortName,
  appDescription: "Program management platform",
  organization: {
    name: "PCZ",
    shortName: "PCZ",
    /**
     * Vendor address, kept from the legacy app (decision 16). Revisit post-launch — the programme
     * may want its own domain here.
     */
    supportEmail: "info@bluecodeltd.com",
    /**
     * Deliberately absent (decision 28): there is no website to link to, and shipping a placeholder
     * URL is worse than rendering nothing. When a real URL exists, add it here and render it from
     * this field — never inline it in a component.
     */
  },
  brand: {
    /** Neutral placeholders generated in Phase 2 — replace when the real brand assets arrive. */
    logo: "/brand/logo.svg",
    logoMark: "/brand/logo-mark.svg",
    favicon: "/brand/favicon.svg",
    loginBackground: "/brand/login-background.svg",
  },
  assistant: {
    name: "Bumi",
    enabled: true,
  },
  /**
   * Every localStorage / IndexedDB / sessionStorage key must be written through
   * `@/core/lib/storage`, which prefixes it with this. Keeps the new app's storage from colliding
   * with the legacy app's on the same origin during the transition.
   */
  storageNamespace: "iccms-pmp",
  pageTitle: (page?: string): string => (page ? `${page} · ${appShortName}` : "ICCMS PMP"),
} as const;

export type SiteConfig = typeof siteConfig;
