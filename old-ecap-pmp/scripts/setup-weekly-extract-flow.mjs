#!/usr/bin/env node

/**
 * One-time setup: creates a Directus Flow that every Monday at 08:00:
 *   1. Sends in-app notifications to distribution list members who are Directus users
 *   2. Sends an email to everyone on the distribution list
 *
 * Usage
 * -----
 *   node --env-file=.env scripts/setup-weekly-extract-flow.mjs
 *   npm run setup:weekly-flow
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

// ---------------------------------------------------------------------------
// Distribution list — edit this to add/remove email recipients
// ---------------------------------------------------------------------------
const DISTRIBUTION_LIST = [
  "jphiri@bluecodeltd.com",
  "bkapamulomo@bluecodeltd.com",
  "robinsdev2@gmail.com",
];

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
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
    throw new Error(
      `Login failed: ${err?.errors?.[0]?.message || res.statusText}`
    );
  }

  const token = (await res.json()).data?.access_token;
  if (!token) throw new Error("No access_token returned.");
  console.log("  Authenticated.\n");
  return token;
}

// ---------------------------------------------------------------------------
// Operation 1 — "Run Script": send in-app notifications + return subject
// ---------------------------------------------------------------------------
function buildExecCode(distributionList) {
  // The list is embedded as a JSON array in the script string
  const listJson = JSON.stringify(distributionList);

  return `
module.exports = async function (data) {
  var directusUrl =
    (data.$env.PUBLIC_URL || data.$env.DIRECTUS_URL || "${DIRECTUS_URL}").replace(/\/$/, "");

  var token = data.$accountability && data.$accountability.token;
  if (!token) throw new Error("No accountability token.");

  var headers = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
  };

  var distributionList = ${listJson};

  // Look up which emails are Directus users (optional, don't fail if this fails)
  var matched = [];
  try {
    var usersRes = await fetch(
      directusUrl + "/users?filter[status][_eq]=active&fields[]=id,email&limit=-1",
      { headers: headers }
    );
    if (usersRes.ok) {
      var allUsers = ((await usersRes.json()).data) || [];
      var listEmails = {};
      distributionList.forEach(function (e) { listEmails[e.toLowerCase()] = true; });
      matched = allUsers.filter(function (u) {
        return u.email && listEmails[u.email.toLowerCase()];
      });
    }
  } catch (e) {
    // Continue even if user lookup fails - email is more important
  }

  // Build date: "10th February, 2026"
  var now = new Date();
  var day = now.getDate();
  var suffixes = ["th", "st", "nd", "rd"];
  var s = (day % 100 >= 11 && day % 100 <= 13) ? "th" : (suffixes[day % 10] || "th");
  var month = now.toLocaleDateString("en-GB", { month: "long" });
  var year = now.getFullYear();
  var dateStr = day + s + " " + month + ", " + year;
  var subject = "ECAP+ weekly data extracts - " + dateStr;

  // Send in-app notifications
  var sent = 0;
  for (var i = 0; i < matched.length; i++) {
    try {
      var res = await fetch(directusUrl + "/notifications", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          recipient: matched[i].id,
          subject: subject,
          message: "The weekly data extracts are ready for download. Go to Data Pipeline > Weekly Extracts to get the latest CSV files for your district.",
          collection: "weekly_extracts",
        }),
      });
      if (res.ok) sent++;
    } catch (e) {}
  }

  return { subject: subject, dateStr: dateStr, sent: sent, matched: matched.length };
};
`.trim();
}

// ---------------------------------------------------------------------------
// Create Flow with 2 chained operations
// ---------------------------------------------------------------------------
async function createFlow(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  console.log("Creating Weekly Extract Notifications flow...\n");

  // 1. Ensure Trigger Collection exists (hidden if created new, but usually weekly_extracts exists)
  await fetch(`${DIRECTUS_URL}/collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      collection: "weekly_extracts",
      meta: { icon: "bolt", note: "Used for weekly data extracts and triggering notifications" },
    }),
  }).catch(() => { });

  // 1a. Ensure triggered_at field exists in weekly_extracts
  await fetch(`${DIRECTUS_URL.replace(/\/$/, "")}/fields/weekly_extracts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      field: "triggered_at",
      type: "timestamp",
      meta: { hidden: true, note: "Timestamp of manual trigger" }
    }),
  }).catch(() => { });


  // 1b. Grant 'create' and 'read' permissions to all roles for weekly_extracts
  const rolesRes = await fetch(`${DIRECTUS_URL}/roles`, { headers });
  if (rolesRes.ok) {
    const roles = (await rolesRes.json()).data;
    const existingPermsRes = await fetch(`${DIRECTUS_URL}/permissions?filter[collection][_eq]=weekly_extracts`, { headers });
    const existingPerms = existingPermsRes.ok ? (await existingPermsRes.json()).data : [];

    for (const role of roles) {
      if (role.name === "Administrator") continue;

      const hasCreate = existingPerms.find(p => p.role === role.id && p.action === "create");
      if (!hasCreate) {
        await fetch(`${DIRECTUS_URL}/permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            role: role.id,
            collection: "weekly_extracts",
            action: "create",
            permissions: {},
            validation: {}
          })
        }).catch(() => { });
      }

      const hasRead = existingPerms.find(p => p.role === role.id && p.action === "read");
      if (!hasRead) {
        await fetch(`${DIRECTUS_URL}/permissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            role: role.id,
            collection: "weekly_extracts",
            action: "read",
            permissions: {},
            validation: {}
          })
        }).catch(() => { });
      }
    }
  }

  // 2. Create Flow
  const flowRes = await fetch(`${DIRECTUS_URL}/flows`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Weekly Extract Notifications",
      description:
        "Triggered by creating a record in weekly_extracts. " +
        "Sends in-app notifications and emails to the distribution list.",
      status: "active",
      trigger: "action",
      accountability: "all",
      options: {
        collection: "weekly_extracts",
        action: "create"
      },
    }),
  });


  if (!flowRes.ok) {
    const err = await flowRes.json().catch(() => null);
    throw new Error(`Failed to create flow: ${err?.errors?.[0]?.message || flowRes.statusText}`);
  }

  const flow = (await flowRes.json()).data;
  console.log(`  Flow:      ${flow.id} (${flow.name})`);
  console.log(`  Schedule:  Every Monday at 08:00\n`);

  // 2. Create "Send Email" operation (will be 2nd in chain)
  const emailBody =
    "<p>Dear Team,</p>" +
    "<p>Please find ECAP+ data extracts for this week available for download on the PMP dashboard.</p>" +
    "<p>To access the extracts:</p>" +
    "<ol>" +
    "<li>Log in to the <strong>ECAP+ PMP Dashboard</strong></li>" +
    "<li>Navigate to <strong>Data Pipeline &gt; Weekly Extracts</strong></li>" +
    "<li>Click <strong>Download All</strong> to get all CSV files, or download individual datasets</li>" +
    "</ol>" +
    "<p>Should you have any concerns or questions please let us know.</p>" +
    "<p>Best regards,<br/><strong>ECAP+ PMP System</strong><br/>BlueCode Systems</p>";

  const mailOpRes = await fetch(`${DIRECTUS_URL}/operations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Send Email to Distribution List",
      key: "send_weekly_email",
      flow: flow.id,
      type: "mail",
      position_x: 37,
      position_y: 1,
      options: {
        to: DISTRIBUTION_LIST.join(","),
        subject: "{{notify_team.subject}}",
        body: emailBody,
        type: "html",
      },
    }),
  });

  if (!mailOpRes.ok) {
    const err = await mailOpRes.json().catch(() => null);
    throw new Error(`Failed to create mail operation: ${err?.errors?.[0]?.message || mailOpRes.statusText}`);
  }

  const mailOp = (await mailOpRes.json()).data;
  console.log(`  Op 2 (mail):  ${mailOp.id} — Send Email to Distribution List`);

  // 3. Create "Run Script" operation (will be 1st, chains to mail op)
  const execOpRes = await fetch(`${DIRECTUS_URL}/operations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Send In-App Notifications",
      key: "notify_team",
      flow: flow.id,
      type: "exec",
      position_x: 19,
      position_y: 1,
      options: {
        code: buildExecCode(DISTRIBUTION_LIST),
      },
      resolve: mailOp.id, // on success → run the mail operation
    }),
  });

  if (!execOpRes.ok) {
    const err = await execOpRes.json().catch(() => null);
    throw new Error(`Failed to create exec operation: ${err?.errors?.[0]?.message || execOpRes.statusText}`);
  }

  const execOp = (await execOpRes.json()).data;
  console.log(`  Op 1 (exec): ${execOp.id} — Send In-App Notifications`);
  console.log(`  Chain:       exec → mail (on success)\n`);

  // 4. Link exec operation as the flow's entry point
  const linkRes = await fetch(`${DIRECTUS_URL}/flows/${flow.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ operation: execOp.id }),
  });

  if (!linkRes.ok) {
    const err = await linkRes.json().catch(() => null);
    throw new Error(`Failed to link: ${err?.errors?.[0]?.message || linkRes.statusText}`);
  }

  console.log("--------------------------------------------------");
  console.log("  Flow is ACTIVE.");
  console.log("  Schedule: Every Monday at 08:00 (server time)");
  console.log(`  Manage:   ${DIRECTUS_URL}/admin/settings/flows/${flow.id}`);
  console.log("--------------------------------------------------\n");

  return flow.id;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const token = await login();
  await createFlow(token);
}

main().catch((err) => {
  console.error("\nSetup failed:", err.message);
  process.exit(1);
});
