import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Brand injection: `index.html` carries `%APP_NAME%`, `%APP_DESCRIPTION%`, `%FAVICON%` and
 * `%THEME_COLOR%` placeholders, filled here from `src/config/site.config.ts` so the HTML never
 * hardcodes a name (`CLAUDE.md` hard rule 4).
 *
 * The config file is read as text and the three values plucked out with a regex rather than imported,
 * because `vite.config.ts` runs before the TS module graph exists. `siteConfig` is a plain object
 * literal, so this is reliable; `src/config/__tests__` asserts the same values, so a restyle of the
 * config file fails a test rather than silently blanking the page title.
 */
function brandVariables(): Record<string, string> {
  const source = readFileSync(resolve(import.meta.dirname, "src/config/site.config.ts"), "utf8");
  const pick = (key: string, fallback: string): string => {
    const match = new RegExp(`${key}:\\s*["'\`]([^"'\`]+)["'\`]`).exec(source);
    return match?.[1] ?? fallback;
  };
  const pageTitle = /pageTitle:[^\n]*?:\s*page\s*\?\s*`\$\{page\}\s*·\s*([^`]+)`/.exec(source);
  const shortName = pick("appShortName", "ICCMS");
  return {
    APP_NAME: pick("appName", shortName),
    APP_SHORT_NAME: shortName,
    APP_DESCRIPTION: pick("appDescription", ""),
    FAVICON: pick("favicon", "/brand/favicon.svg"),
    THEME_COLOR: "#2563eb",
    TITLE_SEPARATOR: pageTitle?.[1]?.trim() ?? shortName,
  };
}

export default defineConfig(({ mode }) => {
  const brand = brandVariables();

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "iccms-brand-html",
        transformIndexHtml(html: string) {
          return html.replace(/%([A-Z_]+)%/g, (whole: string, name: string) => {
            const value = brand[name];
            return value === undefined ? whole : value;
          });
        },
      },
    ],
    resolve: {
      alias: { "@": resolve(import.meta.dirname, "src") },
    },
    server: {
      // Must bind 0.0.0.0 so the sandbox/preview host can reach it; a 127.0.0.1 bind is unreachable
      // from outside the container.
      host: "0.0.0.0",
      port: 5173,
      // Vite rejects unknown Host headers by default, which breaks proxied preview URLs.
      allowedHosts: true,
      fs: { strict: false },
    },
    preview: {
      host: "0.0.0.0",
      port: 3040,
      allowedHosts: true,
    },
    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
      rollupOptions: {
        output: {
          // Keep the initial bundle small: heavy features load on demand in later phases.
          manualChunks(id: string) {
            if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
              return "react";
            }
            return undefined;
          },
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      coverage: { reporter: ["text", "html"] },
      // `src/config/env.ts` validates eagerly and throws on a missing variable, by design. Tests get
      // explicit dummy values rather than relying on whatever `.env.local` happens to be on the
      // machine — a test suite that only passes on the author's laptop is worse than no suite.
      env: {
        VITE_API_URL: "http://api.test",
        VITE_DIRECTUS_URL: "http://directus.test",
        VITE_DIRECTUS_INVITE_ROLE: "00000000-0000-0000-0000-000000000000",
      },
    },
  };
});
