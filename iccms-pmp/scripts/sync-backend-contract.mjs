#!/usr/bin/env node
/**
 * Regenerate `test/contract/backend-geography.js` from `backend.patch` at the repo root.
 *
 * Why a copy instead of reading the backend directly: the reference backend checkout in this
 * workspace is intentionally left unpatched, and `config/geography.js` only exists in the patch.
 * The copy is a *contract fixture* — the test parses it and asserts the frontend map is identical.
 *
 * Usage: node scripts/sync-backend-contract.mjs           # write
 *        node scripts/sync-backend-contract.mjs --check   # fail if stale (runs in `pnpm check`)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PATCH = resolve(ROOT, "../backend.patch");

/** Each contract fixture: the file in the patch, and where the verbatim copy goes. */
const FIXTURES = [
  { patchPath: "config/geography.js", target: "test/contract/backend-geography.cjs" },
  {
    patchPath: "lib/userScope.js",
    target: "test/contract/backend-userScope.cjs",
    /**
     * The rules are copied byte for byte; only the two `require` targets are rewritten, so the
     * frontend does not take a runtime dependency on the backend's packages:
     *  - `axios` is only used by `getUserProfile`, which is not under test -> a throwing stub.
     *  - `../config/geography` -> the verbatim extract in this folder, i.e. the backend's own map.
     */
    rewrite: (body) =>
      body
        .replace('require("axios")', 'require("./stubs/axios.cjs")')
        .replace('require("../config/geography")', 'require("./backend-geography.cjs")'),
    note:
      "**Only the two `require` targets are rewritten** (to `./stubs/axios.cjs` and " +
      "`./backend-geography.cjs`); the rule code below is byte-for-byte the backend's.",
  },
];

function readPatch() {
  try {
    return readFileSync(PATCH, "utf8");
  } catch {
    throw new Error(`Cannot read ${PATCH}. The backend patch is required to derive the contracts.`);
  }
}

function extract(patch, patchPath) {
  const start = patch.indexOf(`diff --git a/${patchPath} b/${patchPath}`);
  if (start === -1) throw new Error(`${patchPath} not found in backend.patch`);

  const rest = patch.slice(start + 1);
  const end = rest.indexOf("\ndiff --git ");
  const section = end === -1 ? rest : rest.slice(0, end);

  const body = section
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");

  if (body.trim() === "") throw new Error(`Extracted ${patchPath} is empty`);
  return body;
}

function header(patchPath, consumer, extra = "") {
  return `/**
 * VERBATIM copy of \`${patchPath}\` as added by \`backend.patch\` at the repo root.
 *
 * The backend checkout in this workspace is deliberately left unpatched (patch-only files are
 * applied to throwaway copies, see \`scripts/verify-audit.sh\`), so this file is the *contract* the
 * frontend must satisfy — not a re-implementation. ${consumer}${extra}
 *
 * Regenerate with:  node scripts/sync-backend-contract.mjs
 */
`;
}

const CONSUMERS = {
  "config/geography.js":
    "`src/config/program.config.test.ts` parses it and asserts `programConfig.geography` is identical.",
  "lib/userScope.js":
    "`src/core/access/__tests__/deriveAccess.test.ts` runs its `deriveScope` against the same fixtures as ours.",
};

const check = process.argv.includes("--check");
const patch = readPatch();
let stale = [];

for (const { patchPath, target, rewrite, note } of FIXTURES) {
  let body = extract(patch, patchPath).trimEnd();
  if (rewrite) body = rewrite(body);
  const extra = note ? `\n * ${note}` : "";
  const next = header(patchPath, CONSUMERS[patchPath] ?? "", extra) + body + "\n";

  if (check) {
    let current = "";
    try {
      current = readFileSync(target, "utf8");
    } catch {
      /* missing counts as stale */
    }
    if (current !== next) stale.push(target);
  } else {
    writeFileSync(target, next);
    console.log(`wrote ${target}`);
  }
}

if (check) {
  if (stale.length > 0) {
    console.error(`Stale contract fixture(s):\n  ${stale.join("\n  ")}`);
    console.error("Run: node scripts/sync-backend-contract.mjs");
    process.exit(1);
  }
  console.log(`backend contracts up to date (${FIXTURES.length} files)`);
}
