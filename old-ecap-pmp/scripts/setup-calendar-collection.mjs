#!/usr/bin/env node

/**
 * One-time setup: creates the 'calendar_events' collection in Directus
 * and sets up the necessary fields and permissions.
 *
 * Usage
 * -----
 *   node --env-file=.env scripts/setup-calendar-collection.mjs
 *
 * Required .env vars:
 *   REACT_APP_BASE_URL, DIRECTUS_EMAIL, DIRECTUS_PASSWORD
 */

const DIRECTUS_URL = process.env.REACT_APP_BASE_URL;
const EMAIL = process.env.DIRECTUS_EMAIL;
const PASSWORD = process.env.DIRECTUS_PASSWORD;

if (!DIRECTUS_URL || !EMAIL || !PASSWORD) {
  console.error("\nMissing required environment variables:\n");
  console.error("  REACT_APP_BASE_URL   — Your Directus instance URL");
  console.error("  DIRECTUS_EMAIL       — Admin email");
  console.error("  DIRECTUS_PASSWORD    — Admin password\n");
  process.exit(1);
}

async function login() {
  console.log(`\nDirectus instance: ${DIRECTUS_URL}`);
  console.log(`Logging in as ${EMAIL}...`);

  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(`Login failed: ${err?.errors?.[0]?.message || res.statusText}`);
  }

  const token = (await res.json()).data?.access_token;
  if (!token) throw new Error("No access_token returned.");
  console.log("  Authenticated.\n");
  return token;
}

async function setupCalendarCollection(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  console.log("Setting up 'calendar_events' collection...");

  // 1. Create Collection
  try {
    const colRes = await fetch(`${DIRECTUS_URL}/collections`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        collection: "calendar_events",
        meta: {
          icon: "calendar_month",
          note: "Collection for user-scheduled events and meetings",
          display_template: "{{title}}",
        },
        schema: {},
      }),
    });
    if (colRes.ok) console.log("  Collection created.");
    else {
      const err = await colRes.json();
      if (err.errors?.[0]?.extensions?.code === "RECORD_NOT_UNIQUE" || colRes.status === 400) {
        console.log("  Collection already exists.");
      } else {
        console.warn("  Failed to create collection:", err.errors?.[0]?.message);
      }
    }
  } catch (e) {
    console.error("  Error creating collection:", e.message);
  }

  // 2. Add Fields
  const fields = [
    { field: "title", type: "string", meta: { interface: "input", required: true } },
    { field: "description", type: "text", meta: { interface: "textarea" } },
    { field: "start_time", type: "timestamp", meta: { interface: "datetime" } },
    { field: "end_time", type: "timestamp", meta: { interface: "datetime" } },
    {
      field: "category",
      type: "string",
      meta: {
        interface: "select-dropdown",
        options: {
          choices: [
            { text: "Meeting", value: "Meeting" },
            { text: "Field Visit", value: "Field Visit" },
            { text: "Deadline", value: "Deadline" },
            { text: "Personal", value: "Personal" },
          ]
        }
      }
    },
    { field: "user_id", type: "uuid", meta: { interface: "select-dropdown-m2o", options: { collection: "directus_users" } } },
    {
      field: "status",
      type: "string",
      schema: { default_value: "scheduled" },
      meta: {
        interface: "select-dropdown",
        options: {
          choices: [
            { text: "Scheduled", value: "scheduled" },
            { text: "Cancelled", value: "cancelled" },
            { text: "Completed", value: "completed" },
          ]
        }
      }
    },
  ];

  for (const fieldData of fields) {
    try {
      const fRes = await fetch(`${DIRECTUS_URL}/fields/calendar_events`, {
        method: "POST",
        headers,
        body: JSON.stringify(fieldData),
      });
      if (fRes.ok) console.log(`  Field '${fieldData.field}' created.`);
    } catch (e) {
      // Ignore if field exists
    }
  }

  // 3. Grant Permissions
  console.log("\nUpdating permissions for all roles...");
  try {
    const rolesRes = await fetch(`${DIRECTUS_URL}/roles`, { headers });
    if (rolesRes.ok) {
      const roles = (await rolesRes.json()).data;
      for (const role of roles) {
        if (role.name === "Administrator") continue;

        // Create Read Permission (User isolated)
        await fetch(`${DIRECTUS_URL}/permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            role: role.id,
            collection: "calendar_events",
            action: "read",
            permissions: { user_id: { _eq: "$CURRENT_USER" } },
          }),
        }).catch(() => { });

        // Create Create Permission
        await fetch(`${DIRECTUS_URL}/permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            role: role.id,
            collection: "calendar_events",
            action: "create",
            permissions: {},
          }),
        }).catch(() => { });

        // Create Update Permission (User isolated)
        await fetch(`${DIRECTUS_URL}/permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            role: role.id,
            collection: "calendar_events",
            action: "update",
            permissions: { user_id: { _eq: "$CURRENT_USER" } },
          }),
        }).catch(() => { });

        // Create Delete Permission (User isolated)
        await fetch(`${DIRECTUS_URL}/permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            role: role.id,
            collection: "calendar_events",
            action: "delete",
            permissions: { user_id: { _eq: "$CURRENT_USER" } },
          }),
        }).catch(() => { });

        console.log(`  Permissions updated for role: ${role.name}`);
      }
    }
  } catch (e) {
    console.error("  Error updating permissions:", e.message);
  }

  console.log("\n--------------------------------------------------");
  console.log("  Calendar setup completed successfully!");
  console.log("--------------------------------------------------\n");
}

async function main() {
  const token = await login();
  await setupCalendarCollection(token);
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  process.exit(1);
});
