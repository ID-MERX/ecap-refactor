const { Pool } = require("pg");
const dotenv = require("dotenv");

// Initialize dotenv
dotenv.config();

// Configure Postgres connection
const FlatPGConnection = new Pool({
  user: process.env.FlatPGUSER,
  host: process.env.FlatPGHOST,
  database: process.env.FlatPGDATABASE,
  password: process.env.FlatPGPASSWORD,
  port: process.env.FlatPGPORT,
});

FlatPGConnection.connect((err, client, release) => {
  if (err) {
    console.error("❌ Failed to connect to database:", err.message);
    process.exit(1); // Kill the server, something is seriously wrong
  }
  console.log("✅ Database connected successfully");
  release(); // Return the connection back to the pool
});

// Direct connection to the raw OpenSRP database (ecap_plus).
//
// WHY THIS EXISTS: after the May 14 2026 split, core.* / team.* live in
// `ecap_plus` and are exposed to the app DB (FlatPGConnection ->
// ecap_plus_superset_db) as postgres_fdw foreign tables. That FDW layer cannot
// push down JSON predicates like `EXISTS (jsonb_array_elements(json->'obs')...)`
// or `ORDER BY json->>'dateCreated'`, so a caseworker-journeys query that runs
// in ~0.16s against ecap_plus directly takes 27-60s (504) through the foreign
// table. Endpoints that scan core.event's JSON heavily should use this pool to
// hit ecap_plus directly and bypass the FDW. Defaults mirror the Flat creds
// (same Postgres instance, dbname ecap_plus) and can be overridden via env.
const RawPGConnection = new Pool({
  user: process.env.RawPGUSER || process.env.FlatPGUSER,
  host: process.env.RawPGHOST || process.env.FlatPGHOST,
  database: process.env.RawPGDATABASE || "ecap_plus",
  password: process.env.RawPGPASSWORD || process.env.FlatPGPASSWORD,
  port: process.env.RawPGPORT || process.env.FlatPGPORT,
});

RawPGConnection.on("error", function (err) {
  console.error("raw (ecap_plus) idle client error", err.message, err.stack);
});

module.exports = { FlatPGConnection, RawPGConnection };
