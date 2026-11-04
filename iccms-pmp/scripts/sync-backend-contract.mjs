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
const TARGET = resolve(ROOT, "test/contract/backend-geography.js");

const PATCH_PATH = "config/geography.js";

function extract() {
  let patch;
  try {
    patch = readFileSync(PATCH, "utf8");
  } catch {
    throw new Error(
      `Cannot read ${PATCH}. The backend patch is required to derive the geography contract.`,
    );
  }

  const start = patch.indexOf(`diff --git a/${PATCH_PATH} b/${PATCH_PATH}`);
  if (start === -1) throw new Error(`${PATCH_PATH} not found in backend.patch`);

  const rest = patch.slice(start + 1);
  const end = rest.indexOf("\ndiff --git ");
  const section = end === -1 ? rest : rest.slice(0, end);

  const body = section
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");

  if (!body.includes("DISTRICTS_BY_PROVINCE")) {
    throw new Error(`Extracted ${PATCH_PATH} does not define DISTRICTS_BY_PROVINCE`);
  }
  return body;
}

const HEADER = `/**
 * VERBATIM copy of \`config/geography.js\` as added by \`backend.patch\` at the repo root.
 *
 * The backend checkout in this workspace is deliberately left unpatched (patch-only files are
 * applied to throwaway copies, see \`scripts/verify-audit.sh\`), so this file is the *contract* the
 * frontend must satisfy — not a re-implementation. \`src/config/program.config.test.ts\` parses it and
 * asserts \`programConfig.geography\` is identical.
 *
 * Regenerate with:  node scripts/sync-backend-contract.mjs
 */
`;

const next = HEADER + extract().trimEnd() + "\n";
const check = process.argv.includes("--check");

if (check) {
  let current = "";
  try {
    current = readFileSync(TARGET, "utf8");
  } catch {
    /* missing counts as stale */
  }
  if (current !== next) {
    console.error(
      "test/contract/backend-geography.js is stale. Run: node scripts/sync-backend-contract.mjs",
    );
    process.exit(1);
  }
  console.log("backend geography contract is up to date");
} else {
  writeFileSync(TARGET, next);
  console.log(`wrote ${TARGET}`);
}
