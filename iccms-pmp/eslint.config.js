import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Flat config.
 *
 * The important part is `boundaries/dependencies`: it enforces the layer table in `CLAUDE.md` at
 * lint time, so an accidental `import { x } from "@/modules/vcas/api/endpoints"` fails the build
 * instead of quietly coupling two modules together.
 *
 * Plugin version: eslint-plugin-boundaries v7 (rule `dependencies`, option `policies`, object
 * selectors). The v5-era `element-types` / `rules` / bare-string names are deprecated and warn.
 */

/** Which layer each file belongs to, from its path. First match wins. */
const ELEMENTS = [
  // Element patterns match FOLDERS and everything beneath them, so these are folder paths, not
  // globs. `src/main.tsx` is covered because it sits outside every folder listed here and is
  // treated as the app entry (see `boundaries/files` below).
  { type: "config", pattern: "src/config" },
  { type: "core", pattern: "src/core" },
  { type: "platform", pattern: "src/platform" },
  { type: "module", pattern: "src/modules/*", capture: ["moduleName"] },
  { type: "app", pattern: "src/app" },
  // Vite's entry point lives directly in src/; classify it as the top layer so it is not "unknown".
  { type: "app", pattern: "src" },
];

/**
 * The allowed import graph from `CLAUDE.md`.
 *
 * `allow` policies grant an edge; `disallow` policies then carve exceptions out of an edge that was
 * granted too broadly. Both are needed: the plugin reports "no policy allowing" for an unlisted
 * combination, so the graph has to be stated positively, and the two hard rules (config imports
 * nothing app-side; a module only ever sees another module's index.ts) are stated negatively.
 */
const POLICIES = [
  // --- Granted edges ---------------------------------------------------------------------------
  { from: { element: { type: "core" } }, allow: { to: { element: { type: "config" } } } },
  {
    from: { element: { type: "platform" } },
    allow: { to: { element: { type: ["core", "config"] } } },
  },
  {
    from: { element: { type: "module" } },
    allow: { to: { element: { type: ["platform", "core", "config"] } } },
  },
  // A module may import ANOTHER module, but only through its public entry point.
  {
    from: { element: { type: "module" } },
    allow: { to: { element: { type: "module" } } },
  },
  {
    from: { element: { type: "app" } },
    allow: { to: { element: { type: ["config", "core", "platform", "module", "app"] } } },
  },

  // --- Hard restrictions -----------------------------------------------------------------------
  // config is the bottom of the graph: packages only (zod), never an app layer.
  {
    from: { element: { type: "config" } },
    disallow: { to: { element: { type: ["core", "platform", "module", "app"] } } },
  },
  // Reaching into another module's internals is always wrong: `@/modules/vcas/api/x` is forbidden,
  // `@/modules/vcas` is not.
  {
    from: { element: { type: "module" } },
    disallow: { to: { element: { type: "module", fileInternalPath: "!index.*" } } },
  },
  // Nothing but the app layer may import the app layer.
  {
    from: { element: { type: "!app" } },
    disallow: { to: { element: { type: "app" } } },
  },
];

export default tseslint.config(
  {
    ignores: [
      "dist",
      "node_modules",
      "coverage",
      "playwright-report",
      "test-results",
      // A verbatim extract of the backend's CommonJS module, not app source.
      "test/contract/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "react-hooks": reactHooks,
      boundaries,
    },
    settings: {
      // Let the plugin resolve the `@/` alias through tsconfig `paths`.
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
        node: true,
      },
      "boundaries/elements": ELEMENTS,
      "boundaries/ignore": ["**/*.test.{ts,tsx}", "test/**", "e2e/**"],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "boundaries/dependencies": ["error", { default: "disallow", policies: POLICIES }],

      // Belt and braces: the same index-only rule, expressed as a plain import restriction so a
      // misconfigured resolver can never make the architecture check silently pass.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/*/**"],
              message:
                "Deep import into a module is forbidden. Import from '@/modules/<name>' (its index.ts) instead.",
            },
            {
              group: ["@/config/*"],
              message: "Import from '@/config', not a file inside it.",
            },
          ],
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Entry point and app shell are allowed the deep config path (it configures the provider tree).
  {
    files: ["src/main.tsx", "src/app/**/*.tsx"],
    rules: { "no-restricted-imports": "off" },
  },

  // Scripts are plain Node ESM.
  {
    files: ["scripts/**/*.{js,mjs}"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
    rules: { "no-restricted-imports": "off" },
  },

  // Config files at the root are tooling, not app source.
  {
    files: ["*.config.{js,ts}"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
