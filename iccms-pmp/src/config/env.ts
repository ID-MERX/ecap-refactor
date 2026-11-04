/**
 * The only module allowed to read `import.meta.env`.
 *
 * Every variable is validated at startup with zod, so a missing or malformed value fails loudly on
 * the first request instead of surfacing as `undefined` deep inside an API client.
 *
 * Rule (`CLAUDE.md` hard rule 5): **no secrets here.** Every `VITE_*` value is compiled into the
 * browser bundle. Service accounts, API keys and passwords belong on the backend.
 */

import { z } from "zod";

/** Empty string counts as absent — `.env` files routinely ship `VITE_FOO=` placeholders. */
const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .refine((v) => v === undefined || /^https?:\/\//.test(v), {
    message: "must be an absolute http(s) URL",
  });

const requiredUrl = z
  .string()
  .trim()
  .min(1, "is required")
  .refine((v) => /^https?:\/\//.test(v), { message: "must be an absolute http(s) URL" });

/** The Superset dashboard map is a JSON object of `{ key: uuid }`, passed as one variable. */
const dashboardMap = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(v);
    } catch {
      ctx.addIssue({ code: "custom", message: "must be valid JSON" });
      return z.NEVER;
    }
    const result = z.record(z.string(), z.string()).safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: "must be an object of { key: dashboard-uuid }" });
      return z.NEVER;
    }
    return result.data;
  });

const truthy = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v === "true" || v === "1" || v === "yes");

const commaList = z
  .string()
  .trim()
  .transform((v) =>
    v === ""
      ? []
      : v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
  );

const schema = z.object({
  /** DQA backend base URL. */
  VITE_API_URL: requiredUrl,
  /** Directus REST base. */
  VITE_DIRECTUS_URL: requiredUrl,
  /** Superset embed origin. Required only when analytics is enabled. */
  VITE_SUPERSET_URL: optionalUrl,
  /** `{ "dashboard-key": "uuid" }` — replaces the legacy `VITE_SUPERSET_DASHBOARD_ID_1..3`. */
  VITE_SUPERSET_DASHBOARDS: dashboardMap,
  /** Directus role UUID granted to invited users. Public by design, not a secret. */
  VITE_DIRECTUS_INVITE_ROLE: z.string().trim().min(1, "is required"),
  /** Logs API requests in the console. Never enable in production. */
  VITE_DEBUG_API: truthy.default(false),
  /** Comma-separated feature keys to force off, e.g. `assistant,support.calls`. */
  VITE_FEATURES_OFF: commaList.default([]),
});

export type Env = {
  readonly apiUrl: string;
  readonly directusUrl: string;
  readonly supersetUrl: string | undefined;
  readonly supersetDashboards: Readonly<Record<string, string>> | undefined;
  readonly directusInviteRole: string;
  readonly debugApi: boolean;
  readonly featuresOff: ReadonlyArray<string>;
  readonly isDev: boolean;
  readonly isProd: boolean;
  readonly appVersion: string;
};

/**
 * Variables that were removed in the rebuild and must never come back. Listing them converts a
 * stale `.env` into a clear startup error instead of a silently ignored setting.
 *
 * - `VITE_SUPERSET_USERNAME` / `VITE_SUPERSET_PASSWORD` — guest tokens come from the backend.
 * - `VITE_GROQ_API_KEY` — the assistant proxy lives on the backend.
 * - `VITE_RESET_PASSWORD_URL` — derive from `window.location.origin`.
 * - `VITE_DEFAULT_DISTRICT` — scope comes from the user's access, not a hardcoded district.
 * - `VITE_DIRECTUS_USER_ROLE` — renamed `VITE_DIRECTUS_INVITE_ROLE`.
 * - `VITE_SUPERSET_DOMAIN` — renamed `VITE_SUPERSET_URL`.
 * - `VITE_SUPERSET_DASHBOARD_ID_1..3` — replaced by `VITE_SUPERSET_DASHBOARDS`.
 */
export const REMOVED_VARS = [
  "VITE_SUPERSET_USERNAME",
  "VITE_SUPERSET_PASSWORD",
  "VITE_GROQ_API_KEY",
  "VITE_RESET_PASSWORD_URL",
  "VITE_DEFAULT_DISTRICT",
  "VITE_DIRECTUS_USER_ROLE",
  "VITE_SUPERSET_DOMAIN",
  "VITE_SUPERSET_DASHBOARD_ID_1",
  "VITE_SUPERSET_DASHBOARD_ID_2",
  "VITE_SUPERSET_DASHBOARD_ID_3",
] as const;

function fail(message: string): never {
  // A thrown error in dev gets the Vite error overlay; in production it lands in the browser console.
  // Both are far better than a mystery 401 later.
  throw new Error(`Invalid environment configuration.\n${message}`);
}

function parseEnv(raw: Record<string, unknown>): Env {
  const stale = REMOVED_VARS.filter((name) => raw[name] !== undefined && raw[name] !== "");
  if (stale.length > 0) {
    fail(
      `These variables were removed and are ignored; delete them from your .env:\n` +
        stale.map((n) => `  - ${n}`).join("\n"),
    );
  }

  // `REACT_APP_*` was a legacy prefix. Vite would happily ship every one of them to the browser.
  const reactPrefixed = Object.keys(raw).filter((k) => k.startsWith("REACT_"));
  if (reactPrefixed.length > 0) {
    fail(
      `Legacy REACT_* variables found. Rename them to VITE_* (see .env.example):\n` +
        reactPrefixed.map((n) => `  - ${n}`).join("\n"),
    );
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const name = issue.path.join(".") || "(root)";
      return `  - ${name}: ${issue.message}`;
    });
    fail(lines.join("\n"));
  }

  const data = result.data;

  // Superset is either fully configured or not at all — a half-configuration renders an empty
  // dashboard with no explanation.
  const hasSuperset = data.VITE_SUPERSET_URL !== undefined;
  if (hasSuperset && data.VITE_SUPERSET_DASHBOARDS === undefined) {
    fail("  - VITE_SUPERSET_DASHBOARDS: required when VITE_SUPERSET_URL is set");
  }
  if (!hasSuperset && data.VITE_SUPERSET_DASHBOARDS !== undefined) {
    fail("  - VITE_SUPERSET_URL: required when VITE_SUPERSET_DASHBOARDS is set");
  }

  return {
    apiUrl: data.VITE_API_URL.replace(/\/+$/, ""),
    directusUrl: data.VITE_DIRECTUS_URL.replace(/\/+$/, ""),
    supersetUrl: data.VITE_SUPERSET_URL?.replace(/\/+$/, ""),
    supersetDashboards: data.VITE_SUPERSET_DASHBOARDS,
    directusInviteRole: data.VITE_DIRECTUS_INVITE_ROLE,
    debugApi: data.VITE_DEBUG_API,
    featuresOff: data.VITE_FEATURES_OFF,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    appVersion: import.meta.env.VITE_APP_VERSION ?? "dev",
  };
}

export const env = parseEnv(import.meta.env as unknown as Record<string, unknown>);
