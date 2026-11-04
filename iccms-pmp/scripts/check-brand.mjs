#!/usr/bin/env node
/**
 * `pnpm check:brand` — fails if branding or program detail is hardcoded outside `src/config/`.
 *
 * `CLAUDE.md` hard rule 4. The legacy app is full of `ECAP+`, `` and the vendor address
 * scattered across 182 files; the whole point of `siteConfig` / `programConfig` is that changing the
 * programme name is a one-file edit.
 *
 * Two escapes, both narrow:
 *  - files inside `src/config/` (that is where the values live)
 *  - lines carrying an inline `// brand-ok: <reason>` marker (API contracts, tests, docs)
 *
 * Backend table names such as `flagged_forms_ecapplus`, `hts_register_ecapplus` and
 * `date_enrolled_ecap` are API contracts, not branding. They are allow-listed by pattern below.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_DIRS = ["src", "scripts", "index.html"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".html", ".css", ".json"]);
const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);

/** The values that may only appear in `src/config/`. */
const DENY = [
  { name: "app name", re: /\bECAP\+?\b/gi },
  { name: "app name (lowercase)", re: /\becapplus\b/gi },
  { name: "legacy platform phrase", re: /Program\s+Management\s+Platform/gi },
  { name: "support address", re: /info@bluecodeltd\.com/gi },
  { name: "assistant name", re: /\bBumi\b/g },
  { name: "programme wordmark", re: /ECAP\s*\+/gi },
];

/**
 * API contracts and fixture data that legitimately contain a denylisted token. Keep each entry
 * narrow and commented — an over-broad allow-list makes the whole check decorative.
 */
const ALLOW_LINE = [
  // Backend table / column names carrying the legacy prefix.
  /\b(?:flagged_forms_ecapplus\w*|hts_register_ecapplus|date_enrolled_ecap|ecapplus_[\w]*)\b/,
  // Directus collection paths for the same.
  /\/items\/(?:flagged_forms_ecapplus\w*|hts_register_ecapplus)/,
  // Environment variable names inherited from the backend.
  /\b(?:VITE|REACT_APP)_[A-Z0-9_]*ECAP[A-Z0-9_]*\b/,
];

const MARKER = /\/\/\s*brand-ok:|#\s*brand-ok:/;

function* walk(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return;
  }
  if (stat.isFile()) {
    if (EXTENSIONS.has(extname(path))) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (IGNORED_DIRS.has(entry)) continue;
    yield* walk(join(path, entry));
  }
}

const problems = [];
let scanned = 0;

for (const target of SCAN_DIRS) {
  for (const file of walk(resolve(ROOT, target))) {
    const rel = relative(ROOT, file).split("\\").join("/");
    // The config layer is where these values are defined.
    if (rel.startsWith("src/config/")) continue;
    // This script defines the denylist, so it necessarily contains every denied token.
    if (rel === "scripts/check-brand.mjs") continue;
    scanned += 1;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (MARKER.test(line)) return;
      if (ALLOW_LINE.some((re) => re.test(line))) return;

      for (const { name, re } of DENY) {
        re.lastIndex = 0;
        const match = re.exec(line);
        if (!match) continue;
        problems.push({
          file: rel,
          line: index + 1,
          name,
          text: line.trim().slice(0, 120),
          match: match[0],
        });
      }
    });
  }
}

if (problems.length === 0) {
  console.log(`check:brand — ${scanned} files scanned, no hardcoded branding.`);
  process.exit(0);
}

console.error(`check:brand — ${problems.length} hardcoded value(s) outside src/config:\n`);
for (const p of problems) {
  console.error(`  ${p.file}:${p.line}  [${p.name}]  "${p.match}"`);
  console.error(`      ${p.text}`);
}
console.error(
  `
Import the value from \`@/config\` instead:
  siteConfig.appName, siteConfig.organization.supportEmail, siteConfig.assistant.name, ...
If the string is an API contract rather than branding, append \`// brand-ok: <reason>\` to the line
or extend ALLOW_LINE in scripts/check-brand.mjs with a narrow pattern.
`,
);
process.exit(1);
