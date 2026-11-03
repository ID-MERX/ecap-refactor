const { spawn } = require("child_process");
const { Pool } = require("pg");

// Separate connection for ETL runs table (superset_db).
// All credentials must come from ecap-plus-pmp-backend/.env. Required keys:
//   SUPERSET_DB_HOST, SUPERSET_DB_PORT, SUPERSET_DB_USER,
//   SUPERSET_DB_PASSWORD, SUPERSET_DB_NAME
const SupersetPG = new Pool({
  user:     process.env.SUPERSET_DB_USER,
  host:     process.env.SUPERSET_DB_HOST,
  database: process.env.SUPERSET_DB_NAME,
  password: process.env.SUPERSET_DB_PASSWORD,
  port:     process.env.SUPERSET_DB_PORT ? Number(process.env.SUPERSET_DB_PORT) : undefined,
});

// Run-date stamp (DDMMYY). Matches the bash exporters so the dashboard surfaces
// today's project-stamped filenames for each completed run.
function currentFileStamp() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lusaka",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date()).replace(/\D/g, "");
}

// Pipeline configurations for ECAP Plus. `downloadFiles` is a function so
// the filenames auto-update each day without restarting the backend.
const PIPELINES = {
  ecap_plus: {
    name: "ECAP Plus Monthly Aggregation",
    dir: "/home/bluecode2022/mvaccbackup/ecapbackup/scripts/monthly_aggregation_scripts_ecap_plus",
    envScript: "set_ecap_plus_env_varables.sh",
    runScript: "generate_all_tables_ecap_plus.sh",
    downloadFiles: () => {
      const s = currentFileStamp();
      return [
        { name: `monthly_caregiver_ecapplus_services_${s}.csv`, path: `cleaned_csv/monthly_caregiver_ecapplus_services_${s}.csv` },
        { name: `monthly_vca_ecapplus_services_${s}.csv`, path: `cleaned_csv/monthly_vca_ecapplus_services_${s}.csv` },
      ];
    },
  },
  hts_register: {
    name: "HTS Register Extract",
    dir: "/home/bluecode2022/mvaccbackup/ecapbackup/scripts/monthly_aggregation_scripts_ecap_plus",
    envScript: "set_ecap_plus_env_varables.sh",
    runScript: "extract_everything_hts.sh",
    downloadFiles: () => {
      const s = currentFileStamp();
      return [
        { name: `hts_register_ecapplus_${s}.csv`, path: `cleaned_csv_hts/hts_register_ecapplus_${s}.csv` },
      ];
    },
  },
  pmtct: {
    name: "Prevention of Mother-to-Child Transmission Register Extract",
    dir: "/home/bluecode2022/mvaccbackup/ecapbackup/scripts/monthly_aggregation_scripts_ecap_plus",
    envScript: "set_ecap_plus_env_varables.sh",
    runScript: "generate_all_tables_pmtct.sh",
    downloadFiles: () => {
      const s = currentFileStamp();
      return [
        { name: `pmtct_mother_ecapplus_register_${s}.csv`, path: `cleaned_csv_pmtct/pmtct_mother_ecapplus_register_${s}.csv` },
        { name: `pmtct_child_ecapplus_register_${s}.csv`, path: `cleaned_csv_pmtct/pmtct_child_ecapplus_register_${s}.csv` },
      ];
    },
  },
};

function getDownloadFiles(pipelineConfig) {
  const v = pipelineConfig.downloadFiles;
  return typeof v === "function" ? v() : v;
}

// Track active processes so they can be cancelled
const activeProcesses = new Map();

/**
 * Ensure the etl_runs_ecap_plus table exists in superset_db
 */
async function ensureTable() {
  await SupersetPG.query(`
    CREATE TABLE IF NOT EXISTS etl_runs_ecap_plus (
      id            SERIAL PRIMARY KEY,
      run_id        VARCHAR(20) UNIQUE NOT NULL,
      pipeline      VARCHAR(50) NOT NULL,
      pipeline_name VARCHAR(100),
      status        VARCHAR(20) DEFAULT 'pending',
      triggered_by  VARCHAR(100),
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ,
      duration_sec  INTEGER,
      logs          TEXT DEFAULT '',
      error         TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// Run once on startup
ensureTable()
  .then(async () => {
    // Only clean up rows this backend owns. Mage-triggered rows are managed
    // by Mage's own scheduler — touching them on a dashboard restart can
    // falsely fail a still-running pipeline.
    const result = await SupersetPG.query(
      `UPDATE etl_runs_ecap_plus SET status = 'failed', completed_at = NOW(), error = 'Process lost: server was restarted while pipeline was running' WHERE (status = 'running' OR status = 'pending') AND (triggered_by IS NULL OR triggered_by NOT LIKE 'scheduled:mage%')`
    );
    if (result.rowCount > 0) {
      console.log(`[ETL] Cleaned up ${result.rowCount} stale running/pending record(s) from prior restart.`);
    }
  })
  .catch((err) => console.error("Failed to create etl_runs_ecap_plus table:", err));

/**
 * Daily midnight cron scheduler
 * Runs all pipelines sequentially every day at 00:00
 */
function scheduleDailyRuns() {
  function msUntilNextMidnight() {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next.getTime() - now.getTime();
  }

  async function runAllPipelines() {
    const pipelineKeys = ["ecap_plus", "hts_register", "pmtct"];
    console.log("[CRON] Daily midnight: starting ECAP Plus ETL pipelines sequentially...");

    for (const key of pipelineKeys) {
      try {
        const run = await startPipeline(key, "scheduled:daily-cron");
        console.log(`[CRON] Started ${key} -> ${run.run_id}`);

        await new Promise((resolve) => {
          const checkInterval = setInterval(async () => {
            try {
              const result = await SupersetPG.query(
                `SELECT status FROM etl_runs_ecap_plus WHERE run_id = $1`,
                [run.run_id]
              );
              const status = result.rows[0]?.status;
              if (status && status !== "running" && status !== "pending") {
                clearInterval(checkInterval);
                console.log(`[CRON] ${key} (${run.run_id}) finished with status: ${status}`);
                resolve();
              }
            } catch {
              clearInterval(checkInterval);
              resolve();
            }
          }, 30000);
        });
      } catch (err) {
        console.error(`[CRON] Failed to start ${key}: ${err.message}`);
      }
    }

    console.log("[CRON] All ECAP Plus pipelines completed.");
  }

  function scheduleNext() {
    const ms = msUntilNextMidnight();
    const nextDate = new Date(Date.now() + ms);
    console.log(`[CRON] Next Daily midnight ECAP Plus ETL run scheduled for: ${nextDate.toLocaleString()}`);

    setTimeout(() => {
      runAllPipelines().finally(() => {
        scheduleNext();
      });
    }, ms);
  }

  scheduleNext();
}

// Gate: Mage now owns daily orchestration. Set NODE_ETL_SCHEDULER=1 to re-enable.
if (process.env.NODE_ETL_SCHEDULER === "1") {
  scheduleDailyRuns();
  console.log("[CRON] Node-side ECAP Plus daily scheduler ENABLED via NODE_ETL_SCHEDULER=1");
} else {
  console.log("[CRON] Node-side ECAP Plus daily scheduler DISABLED; Mage AI owns the schedule.");
}

function generateRunId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `RUN-${num}`;
}

async function appendLog(runId, text) {
  await SupersetPG.query(
    `UPDATE etl_runs_ecap_plus SET logs = logs || $1 WHERE run_id = $2`,
    [text, runId]
  );
}

async function updateRun(runId, fields) {
  const sets = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(fields)) {
    sets.push(`${key} = $${idx}`);
    values.push(val);
    idx++;
  }
  values.push(runId);

  await SupersetPG.query(
    `UPDATE etl_runs_ecap_plus SET ${sets.join(", ")} WHERE run_id = $${idx}`,
    values
  );
}

async function startPipeline(pipelineKey, triggeredBy) {
  const pipeline = PIPELINES[pipelineKey];
  if (!pipeline) {
    throw new Error(`Unknown pipeline: ${pipelineKey}`);
  }

  const running = await SupersetPG.query(
    `SELECT run_id FROM etl_runs_ecap_plus WHERE pipeline = $1 AND status = 'running' LIMIT 1`,
    [pipelineKey]
  );
  if (running.rows.length > 0) {
    throw new Error(
      `Pipeline "${pipeline.name}" is already running (${running.rows[0].run_id}). Wait for it to finish or cancel it.`
    );
  }

  const runId = generateRunId();
  const startedAt = new Date();

  await SupersetPG.query(
    `INSERT INTO etl_runs_ecap_plus (run_id, pipeline, pipeline_name, status, triggered_by, started_at)
     VALUES ($1, $2, $3, 'running', $4, $5)`,
    [runId, pipelineKey, pipeline.name, triggeredBy, startedAt]
  );

  const command = `source ${pipeline.envScript} && ./${pipeline.runScript}`;
  const child = spawn("bash", ["-c", command], {
    cwd: pipeline.dir,
    env: { ...process.env, HOME: "/home/bluecode2022" },
  });

  activeProcesses.set(runId, child);

  child.stdout.on("data", (data) => {
    const text = data.toString();
    console.log(`[${runId}] ${text}`);
    appendLog(runId, text).catch(() => {});
  });

  child.stderr.on("data", (data) => {
    const text = `[stderr] ${data.toString()}`;
    console.error(`[${runId}] ${text}`);
    appendLog(runId, text).catch(() => {});
  });

  child.on("close", async (code) => {
    activeProcesses.delete(runId);
    const completedAt = new Date();
    const durationSec = Math.round((completedAt - startedAt) / 1000);

    if (code === 0) {
      await updateRun(runId, {
        status: "success",
        completed_at: completedAt,
        duration_sec: durationSec,
      }).catch(console.error);
      console.log(`[${runId}] Pipeline completed successfully in ${durationSec}s`);
    } else {
      await updateRun(runId, {
        status: "failed",
        completed_at: completedAt,
        duration_sec: durationSec,
        error: `Process exited with code ${code}`,
      }).catch(console.error);
      console.error(`[${runId}] Pipeline failed with exit code ${code}`);
    }
  });

  child.on("error", async (err) => {
    activeProcesses.delete(runId);
    await updateRun(runId, {
      status: "failed",
      completed_at: new Date(),
      error: err.message,
    }).catch(console.error);
  });

  return {
    run_id: runId,
    pipeline: pipelineKey,
    pipeline_name: pipeline.name,
    status: "running",
    started_at: startedAt,
  };
}

function cancelPipeline(runId) {
  const child = activeProcesses.get(runId);
  if (!child) return false;
  child.kill("SIGTERM");
  activeProcesses.delete(runId);
  updateRun(runId, {
    status: "cancelled",
    completed_at: new Date(),
    error: "Cancelled by user",
  }).catch(console.error);
  return true;
}

function getPipelines() {
  return Object.entries(PIPELINES).map(([key, p]) => ({
    id: key,
    name: p.name,
    downloadFiles: getDownloadFiles(p).map((f) => f.name),
  }));
}

function getDownloadFilePath(pipelineKey, fileName) {
  const pipeline = PIPELINES[pipelineKey];
  if (!pipeline) return null;

  const file = getDownloadFiles(pipeline).find((f) => f.name === fileName);
  if (!file) return null;

  const path = require("path");
  return path.join(pipeline.dir, file.path);
}

module.exports = {
  startPipeline,
  cancelPipeline,
  getPipelines,
  getDownloadFilePath,
  PIPELINES,
  SupersetPG,
};
