const etlRunner = require("../services/etlRunner");
const { SupersetPG } = etlRunner;
const { FlatPGConnection, RawPGConnection } = require("../config/database");
const path = require("path");
const fs = require("fs");
const { EventEmitter } = require("events");
const {
  parseFyWindow,
  buildCohortFyClause,
  buildServiceFyClause,
} = require("../lib/fyClause");

const tabletSyncBus = new EventEmitter();
tabletSyncBus.setMaxListeners(0);

/**
 * GET /etl/last-success
 * Lightweight endpoint the frontend polls every ~30s. Returns the timestamp
 * of the most recent Mage AI ETL run that ended successfully. The frontend
 * stores this value in memory; when it advances forward on a subsequent
 * poll, the React Query cache is wholesale invalidated so users see fresh
 * data right after Mage finishes a run. If Mage fails or never runs, this
 * value doesn't change and the frontend keeps showing its last cached data.
 */
exports.getLastSuccessfulEtlRun = async (req, res) => {
  try {
    const result = await SupersetPG.query(
      `SELECT MAX(completed_at) AS last_success_at FROM etl_runs_ecap_plus WHERE status = 'success'`,
    );
    return res.status(200).json({
      status: "success",
      last_success_at: result.rows[0]?.last_success_at ?? null,
    });
  } catch (err) {
    // Fail-soft: a missing/unreachable etl_runs table returns null so the
    // frontend stays on its cached data.
    return res.status(200).json({
      status: "success",
      last_success_at: null,
      note: err.message,
    });
  }
};

exports.triggerRun = async (req, res) => {
  try {
    const { pipeline } = req.body;

    if (!pipeline) {
      return res.status(400).json({
        status: "error",
        message:
          "Missing 'pipeline' in request body. Options: ecap_plus, hts_register, pmtct",
      });
    }

    const triggeredBy = req.user ? req.user.email || req.user.name : "api";
    const run = await etlRunner.startPipeline(pipeline, triggeredBy);

    return res.status(202).json({
      status: "accepted",
      message: `Pipeline "${run.pipeline_name}" started. Poll GET /etl/runs/${run.run_id} for status.`,
      data: run,
    });
  } catch (err) {
    const statusCode = err.message.includes("already running") ? 409 : 500;
    return res
      .status(statusCode)
      .json({ status: "error", message: err.message });
  }
};

exports.getRuns = async (req, res) => {
  try {
    // Self-healing sweep: rows stuck at status='running' for > 4 hours are
    // declared stale and auto-marked failed. ECAP Plus ETL finishes in ~10–15
    // minutes so 4h is a generous timeout. Eliminates the stuck-spinner UI.
    await SupersetPG.query(`
      UPDATE etl_runs_ecap_plus
      SET status = 'failed',
          completed_at = COALESCE(completed_at, NOW()),
          duration_sec = COALESCE(duration_sec, EXTRACT(EPOCH FROM (NOW() - started_at))::int),
          error = COALESCE(NULLIF(error, ''), 'Stale running row — auto-marked failed after 4h timeout. Check Mage AI for the actual run state.')
      WHERE status = 'running'
        AND started_at < NOW() - INTERVAL '4 hours';
    `);

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const conditions = [];
    const values = [];
    let idx = 1;

    if (req.query.pipeline) {
      conditions.push(`pipeline = $${idx++}`);
      values.push(req.query.pipeline);
    }
    if (req.query.status) {
      conditions.push(`status = $${idx++}`);
      values.push(req.query.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await SupersetPG.query(
      `SELECT run_id, pipeline, pipeline_name, status, triggered_by,
              started_at, completed_at, duration_sec, error, created_at
       FROM etl_runs_ecap_plus ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      [...values, limit],
    );

    return res.status(200).json({
      status: "success",
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getRunById = async (req, res) => {
  try {
    const { runId } = req.params;
    const result = await SupersetPG.query(
      `SELECT * FROM etl_runs_ecap_plus WHERE run_id = $1`,
      [runId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "Run not found" });
    }

    return res.status(200).json({ status: "success", data: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.cancelRun = async (req, res) => {
  try {
    const { runId } = req.params;
    const cancelled = etlRunner.cancelPipeline(runId);

    if (!cancelled) {
      return res.status(404).json({
        status: "error",
        message:
          "No active process found for this run. It may have already completed.",
      });
    }

    return res
      .status(200)
      .json({ status: "success", message: `Run ${runId} cancelled.` });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getPipelines = (req, res) => {
  const pipelines = etlRunner.getPipelines();
  return res.status(200).json({ status: "success", data: pipelines });
};

exports.downloadFile = (req, res) => {
  try {
    const { pipeline, fileName } = req.params;
    const filePath = etlRunner.getDownloadFilePath(pipeline, fileName);

    if (!filePath) {
      return res.status(404).json({
        status: "error",
        message: `File "${fileName}" not found for pipeline "${pipeline}"`,
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: "error",
        message: `File not yet generated. Run the pipeline first.`,
      });
    }

    const stat = fs.statSync(filePath);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getFiles = (req, res) => {
  try {
    const { pipeline } = req.params;
    const pipelineConfig = etlRunner.PIPELINES[pipeline];

    if (!pipelineConfig) {
      return res
        .status(404)
        .json({ status: "error", message: "Pipeline not found" });
    }

    const downloadFiles =
      typeof pipelineConfig.downloadFiles === "function"
        ? pipelineConfig.downloadFiles()
        : pipelineConfig.downloadFiles;

    const files = downloadFiles.map((f) => {
      const resolvedPath = path.join(pipelineConfig.dir, f.path);
      const exists = fs.existsSync(resolvedPath);

      let size = null;
      let lastModified = null;
      if (exists) {
        const stat = fs.statSync(resolvedPath);
        size = stat.size;
        lastModified = stat.mtime;
      }

      return {
        name: f.name,
        exists,
        size,
        sizeFormatted: size ? formatBytes(size) : null,
        lastModified,
      };
    });

    return res.status(200).json({ status: "success", data: files });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.sendReport = async (req, res) => {
  const nodemailer = require("nodemailer");
  return _sendUnifiedEtlReport(res, {
    transport: SupersetPG,
    nodemailer,
    dashboardUrl: "https://ecapplus.pmp.bluecodeltd.com",
    dashboardLabel: "ECAP Plus Dashboard",
  });
};

// ── Unified ETL email report (ECAP II + ECAP Plus, in Mage DAG order) ───────
// Both ecap-plus-pmp-backend and ecapbackend use the same template; only the
// dashboard link changes. Pulls today's latest run for each pipeline from
// etl_runs and etl_runs_ecap_plus (both live in superset_db).
const DAG_PIPELINES = [
  { key: "ecap_plus", name: "ECAP Plus Monthly Aggregation" },
  { key: "hts_register_plus", name: "HTS Register Extract (ECAP Plus)" },
  { key: "pmtct_plus", name: "Prevention of Mother-to-Child Transmission Register Extract (ECAP Plus)" },
  { key: "ecap_ii", name: "ECAP II Monthly Aggregation" },
  { key: "health_domain", name: "ECAP II Health Domain Only" },
  { key: "hts_register_ii", name: "HTS Register Extract (ECAP II)" },
  { key: "pmtct_ii", name: "Prevention of Mother-to-Child Transmission Register Extract (ECAP II)" },
];

async function _sendUnifiedEtlReport(
  res,
  { transport, nodemailer, dashboardUrl, dashboardLabel },
) {
  const recipients = ["jphiri@bluecodeltd.com", "bkapamulomo@bluecodeltd.com"];

  try {
    // Pull the most-recent run per pipeline_name from both tables.
    const sql = `
      WITH ranked AS (
        SELECT pipeline_name, status, started_at, completed_at, duration_sec, error,
               ROW_NUMBER() OVER (PARTITION BY pipeline_name ORDER BY started_at DESC NULLS LAST, created_at DESC) AS rn
        FROM (
          SELECT pipeline_name, status, started_at, completed_at, duration_sec, error, created_at FROM etl_runs
          UNION ALL
          SELECT pipeline_name, status, started_at, completed_at, duration_sec, error, created_at FROM etl_runs_ecap_plus
        ) all_runs
      )
      SELECT pipeline_name, status, started_at, completed_at, duration_sec, error
      FROM ranked WHERE rn = 1
    `;
    const { rows } = await transport.query(sql);
    const latestByName = Object.fromEntries(
      rows.map((r) => [r.pipeline_name, r]),
    );

    const now = new Date();
    const day = now.getDate();
    const ord = (() => {
      if (day % 100 >= 11 && day % 100 <= 13) return "th";
      return ["th", "st", "nd", "rd"][day % 10] || "th";
    })();
    const dateStr = `${day}${ord} ${now.toLocaleDateString("en-GB", { month: "long" })}, ${now.getFullYear()}`;

    const reportRows = DAG_PIPELINES.map((p, idx) => {
      const r = latestByName[p.name];
      const status = r?.status ?? "pending";
      const started = r?.started_at
        ? new Date(r.started_at).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";
      const dur =
        r?.duration_sec != null
          ? `${Math.floor(r.duration_sec / 60)}m ${r.duration_sec % 60}s`
          : "—";
      return { idx: idx + 1, name: p.name, status, started, dur };
    });

    const successCount = reportRows.filter(
      (r) => r.status === "success",
    ).length;
    const failedCount = reportRows.filter((r) => r.status === "failed").length;
    const runningCount = reportRows.filter(
      (r) => r.status === "running",
    ).length;
    const totalSec = reportRows.reduce((acc, r) => {
      const m = (r.dur || "").match(/^(\d+)m\s+(\d+)s$/);
      return acc + (m ? Number(m[1]) * 60 + Number(m[2]) : 0);
    }, 0);
    const totalDur =
      totalSec >= 60
        ? `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`
        : `${totalSec}s`;

    const html = _renderEtlReportHtml({
      dateStr,
      dashboardUrl,
      dashboardLabel,
      reportRows,
      summary: {
        success: successCount,
        failed: failedCount,
        running: runningCount,
        totalDur,
      },
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: "BlueCode Systems Limited <bkapamulomo@bluecodeltd.com>",
      to: recipients.join(", "),
      subject: `ECAP Daily ETL Pipeline Report — ${dateStr}`,
      html,
    });

    return res.status(200).json({
      status: "success",
      message: `Report email sent to ${recipients.join(", ")}`,
    });
  } catch (err) {
    console.error("Failed to send report email:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
}

function _renderEtlReportHtml({
  dateStr,
  dashboardUrl,
  dashboardLabel,
  reportRows,
  summary,
}) {
  const STATUS = {
    success: { bg: "#dcfce7", fg: "#166534", label: "Success" },
    failed: { bg: "#fee2e2", fg: "#991b1b", label: "Failed" },
    running: { bg: "#dbeafe", fg: "#1e40af", label: "Running" },
    pending: { bg: "#f1f5f9", fg: "#475569", label: "Pending" },
  };

  const rowsHtml = reportRows
    .map((r) => {
      const st = STATUS[r.status] || STATUS.pending;
      return `<tr>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#94a3b8;font-size:12px;font-weight:600;">${r.idx}.</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:500;">${r.name}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;">
        <span style="display:inline-block;padding:4px 10px;border-radius:9999px;background:${st.bg};color:${st.fg};font-size:11px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;">${st.label}</span>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-variant-numeric:tabular-nums;">${r.started}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:13px;font-variant-numeric:tabular-nums;">${r.dur}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>ECAP Daily ETL Pipeline Report</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <div style="border-radius:16px 16px 0 0;background:linear-gradient(135deg,#047857 0%,#064e3b 100%);padding:32px 32px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Daily ETL Report</div>
      <div style="font-size:24px;font-weight:700;margin-top:8px;line-height:1.2;">ECAP Pipeline Run Summary</div>
      <div style="font-size:14px;margin-top:6px;opacity:0.9;">${dateStr}</div>
    </div>

    <div style="background:#ffffff;padding:24px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px;">
        <tr>
          <td style="width:25%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:11px;color:#166534;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Succeeded</div>
            <div style="font-size:28px;color:#15803d;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums;">${summary.success}</div>
          </td>
          <td style="width:25%;background:${summary.failed > 0 ? "#fef2f2" : "#f8fafc"};border:1px solid ${summary.failed > 0 ? "#fecaca" : "#e2e8f0"};border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:11px;color:${summary.failed > 0 ? "#991b1b" : "#64748b"};font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Failed</div>
            <div style="font-size:28px;color:${summary.failed > 0 ? "#b91c1c" : "#94a3b8"};font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums;">${summary.failed}</div>
          </td>
          <td style="width:25%;background:${summary.running > 0 ? "#eff6ff" : "#f8fafc"};border:1px solid ${summary.running > 0 ? "#bfdbfe" : "#e2e8f0"};border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:11px;color:${summary.running > 0 ? "#1e40af" : "#64748b"};font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Running</div>
            <div style="font-size:28px;color:${summary.running > 0 ? "#1d4ed8" : "#94a3b8"};font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums;">${summary.running}</div>
          </td>
          <td style="width:25%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Total time</div>
            <div style="font-size:18px;color:#0f172a;font-weight:700;margin-top:8px;font-variant-numeric:tabular-nums;">${summary.totalDur}</div>
          </td>
        </tr>
      </table>
    </div>

    <div style="background:#ffffff;padding:8px 32px 4px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      <p style="margin:16px 0 8px;color:#334155;font-size:14px;line-height:1.6;">Dear Team,</p>
      <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">Below is the orchestrated pipeline run summary for <strong>${dateStr}</strong>. Pipelines run in this exact order each day via the Mage AI scheduler.</p>
    </div>

    <div style="background:#ffffff;padding:8px 32px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Pipeline Run Status</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;width:40px;">#</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Pipeline</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Status</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Started</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.5px;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Duration</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <div style="background:#ffffff;padding:8px 32px 24px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">Output Files</div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
        <ul style="margin:0;padding-left:20px;color:#334155;font-size:13px;line-height:1.9;">
          <li><strong style="color:#0f172a;">ECAP Plus aggregation:</strong> monthly_caregiver_ecapplus_services_DDMMYY.csv, monthly_vca_ecapplus_services_DDMMYY.csv</li>
          <li><strong style="color:#0f172a;">HTS Register (ECAP Plus):</strong> hts_register_ecapplus_DDMMYY.csv</li>
          <li><strong style="color:#0f172a;">Prevention of Mother-to-Child Transmission (ECAP Plus):</strong> pmtct_mother_ecapplus_register_DDMMYY.csv, pmtct_child_ecapplus_register_DDMMYY.csv</li>
          <li><strong style="color:#0f172a;">ECAP II aggregation:</strong> monthly_caregiver_ecap_ii_services_DDMMYY.csv, monthly_vca_ecap_ii_services_DDMMYY.csv</li>
          <li><strong style="color:#0f172a;">ECAP II Health Domain:</strong> healthy_monthly_caregiver_services_DDMMYY.csv, healthy_monthly_vca_services_DDMMYY.csv</li>
          <li><strong style="color:#0f172a;">HTS Register (ECAP II):</strong> hts_register_ecap_ii_DDMMYY.csv</li>
          <li><strong style="color:#0f172a;">Prevention of Mother-to-Child Transmission (ECAP II):</strong> pmtct_mother_ecap_ii_register_DDMMYY.csv, pmtct_child_ecap_ii_register_DDMMYY.csv</li>
        </ul>
      </div>
    </div>

    <div style="background:#ffffff;padding:8px 32px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-radius:0 0 16px 16px;border-bottom:1px solid #e2e8f0;text-align:center;">
      <table role="presentation" style="margin:0 auto;border-collapse:separate;border-spacing:8px;">
        <tr>
          <td>
            <a href="https://ecap.pmp.bluecodeltd.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0ea5e9 0%,#1e40af 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;letter-spacing:0.3px;">Open ECAP II Dashboard &rarr;</a>
          </td>
          <td>
            <a href="https://ecapplus.pmp.bluecodeltd.com" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#10b981 0%,#047857 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:10px;letter-spacing:0.3px;">Open ECAP Plus Dashboard &rarr;</a>
          </td>
        </tr>
      </table>
      <div style="margin-top:14px;color:#64748b;font-size:12px;">Navigate to <strong>Data Pipeline</strong> to download outputs.</div>
    </div>

    <div style="text-align:center;margin-top:24px;padding:0 16px;">
      <div style="font-size:13px;color:#475569;font-weight:600;">BlueCode Systems Limited</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Automated daily report — please do not reply.</div>
    </div>
  </div>
</body></html>`;
}

const getTabletSyncStatusData = async () => {
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const withTimeout = (promise, timeoutMs, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);

  const buildPayload = (rows, source, refreshedAt = null) => {
    let active_7d = 0;
    let active_30d = 0;
    let stale = 0;

    const providers = rows.map((row) => {
      const lastActivity = new Date(row.last_activity);
      const age = Date.now() - lastActivity.getTime();
      let status;

      if (age <= SEVEN_DAYS) {
        status = "active";
        active_7d++;
        active_30d++;
      } else if (age <= THIRTY_DAYS) {
        status = "stale";
        active_30d++;
        stale++;
      } else {
        status = "inactive";
      }

      return {
        provider: row.provider,
        location_id: row.location_id,
        facility: row.facility || row.location_id || "Unknown",
        district: row.district || "Unknown",
        last_activity: row.last_activity,
        total_events: parseInt(row.total_events, 10) || 0,
        status,
      };
    });

    return {
      total: providers.length,
      active_7d,
      active_30d,
      stale,
      providers,
      source,
      refreshed_at: refreshedAt,
    };
  };

  try {
    const summaryRes = await withTimeout(
      SupersetPG.query(`
        WITH facility_district AS (
          SELECT facility, MAX(district) AS district
          FROM children
          WHERE facility IS NOT NULL AND TRIM(facility) <> ''
            AND district IS NOT NULL AND TRIM(district) <> ''
          GROUP BY facility
        )
        SELECT
          t.provider_name AS provider,
          COALESCE(t.location_name, t.location_id, 'Unknown') AS location_id,
          COALESCE(t.location_name, t.location_id, 'Unknown') AS facility,
          fd.district AS district,
          t.last_activity,
          t.total_events,
          t.updated_at
        FROM tablet_sync_status t
        LEFT JOIN facility_district fd ON fd.facility = t.location_name
        WHERE t.provider_name IS NOT NULL
          AND TRIM(t.provider_name) <> ''
        ORDER BY t.last_activity DESC
      `),
      Number(process.env.TABLET_SYNC_STATUS_QUERY_TIMEOUT_MS || 5000),
      "Tablet sync status query",
    );

    if (summaryRes.rows.length > 0) {
      const refreshedAt = summaryRes.rows.reduce((latest, row) => {
        if (!row.updated_at) return latest;
        const current = new Date(row.updated_at).getTime();
        return !latest || current > new Date(latest).getTime()
          ? row.updated_at
          : latest;
      }, null);

      return buildPayload(
        summaryRes.rows,
        "ecap_plus_superset_db.tablet_sync_status",
        refreshedAt,
      );
    }
  } catch (err) {
    console.warn(
      "[TabletSync] tablet_sync_status unavailable; falling back to children:",
      err.message,
    );
  }

  const snapshotRes = await withTimeout(
    FlatPGConnection.query(`
      SELECT
        caseworker_name as provider,
        facility as location_id,
        facility as facility,
        MAX(district) as district,
        MAX(datecreated) as last_activity,
        COUNT(*) as total_events
      FROM children
      WHERE caseworker_name IS NOT NULL AND caseworker_name != ''
      GROUP BY caseworker_name, facility
      ORDER BY last_activity DESC
    `),
    Number(process.env.TABLET_SYNC_SNAPSHOT_QUERY_TIMEOUT_MS || 7000),
    "Tablet sync snapshot query",
  );

  return buildPayload(snapshotRes.rows, "ecap_plus_source.children");
};

const tabletSyncFingerprint = (data) =>
  JSON.stringify({
    total: data.total,
    active_7d: data.active_7d,
    active_30d: data.active_30d,
    stale: data.stale,
    providers: data.providers.map((provider) => [
      provider.provider,
      provider.location_id,
      provider.last_activity,
      provider.total_events,
      provider.status,
    ]),
  });

const writeSse = (res, event, payload) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === "function") res.flush();
};

/**
 * GET /etl/tablet-sync
 * Returns tablet/provider sync status from the latest processed tablet data.
 */
exports.getTabletSyncStatus = async (req, res) => {
  try {
    const data = await getTabletSyncStatusData();
    return res.status(200).json({
      status: "success",
      data,
    });
  } catch (err) {
    console.error("Failed to get tablet sync status:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/tablet-sync/stream
 * Streams tablet/provider sync status to the dashboard via Server-Sent Events.
 */
exports.streamTabletSyncStatus = async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  let lastFingerprint = "";
  let closed = false;
  const onWake = () => {
    pushLatest(true);
  };

  const pushLatest = async (force = false) => {
    if (closed) return;
    try {
      const data = await getTabletSyncStatusData();
      const fingerprint = tabletSyncFingerprint(data);
      if (force || fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        writeSse(res, "tablet-sync", {
          status: "success",
          data,
          emitted_at: new Date().toISOString(),
        });
      } else {
        writeSse(res, "heartbeat", {
          status: "ok",
          emitted_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("Failed to stream tablet sync status:", err);
      writeSse(res, "tablet-sync-error", {
        status: "error",
        message: err.message,
        emitted_at: new Date().toISOString(),
      });
    }
  };

  tabletSyncBus.on("refresh", onWake);
  writeSse(res, "heartbeat", {
    status: "connected",
    emitted_at: new Date().toISOString(),
  });
  pushLatest(true);

  const configuredInterval = Number(
    process.env.TABLET_SYNC_STREAM_INTERVAL_MS || 10000,
  );
  const intervalMs = Number.isFinite(configuredInterval)
    ? Math.max(configuredInterval, 10000)
    : 30000;
  const interval = setInterval(() => {
    pushLatest(false);
  }, intervalMs);

  req.on("close", () => {
    closed = true;
    clearInterval(interval);
    tabletSyncBus.off("refresh", onWake);
    res.end();
  });
};

/**
 * POST /etl/tablet-sync/notify
 * Called by the ECAP+ tablet-sync Mage pipeline after a refresh.
 */
exports.notifyTabletSyncStatus = async (req, res) => {
  const expectedSecret = String(
    process.env.TABLET_SYNC_WEBHOOK_SECRET ?? "",
  ).trim();
  if (expectedSecret) {
    const providedSecret = String(req.headers["x-webhook-secret"] ?? "").trim();
    if (providedSecret !== expectedSecret) {
      return res.status(401).json({
        status: "error",
        message: "Invalid webhook secret.",
      });
    }
  }

  tabletSyncBus.emit("refresh");
  return res.status(202).json({
    status: "accepted",
    message: "Tablet sync refresh queued.",
  });
};

/**
 * GET /etl/facility-performance
 * Returns facility-level VCA and household counts from the ecap_plus database
 * plus this-month / last-month service volumes.
 */
// TTL cache for expensive aggregation endpoints (5 min).
const PERF_CACHE = new Map();
const PERF_CACHE_TTL_MS = 5 * 60 * 1000;
const perfCacheKey = (req) =>
  `${req.path}?${new URLSearchParams(req.query).toString()}`;
const perfCacheGet = (key) => {
  const e = PERF_CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.at > PERF_CACHE_TTL_MS) {
    PERF_CACHE.delete(key);
    return null;
  }
  return e.data;
};
const perfCacheSet = (key, data) => {
  PERF_CACHE.set(key, { at: Date.now(), data });
};

exports.getFacilityPerformance = async (req, res) => {
  const cacheKey = perfCacheKey(req);
  const cached = perfCacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);
  // Reuse shared env-configured pool (ecap_plus)
  const SourcePG = FlatPGConnection;

  const { district, facility, ward } = req.query;

  try {
    const filters = [];
    const vals = [];
    if (district && district !== "all") {
      filters.push(`district = $${vals.length + 1}`);
      vals.push(district);
    }
    if (facility && facility !== "all") {
      filters.push(`facility = $${vals.length + 1}`);
      vals.push(facility);
    }
    if (ward && ward !== "all") {
      filters.push(`ward = $${vals.length + 1}`);
      vals.push(ward);
    }
    const enrolFilter = filters.length ? ` AND ${filters.join(" AND ")}` : "";
    const svcWhere = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const enrolment = await SourcePG.query(
      `SELECT facility, district, ward,
         COUNT(*) AS total_vcas,
         COUNT(DISTINCT household_id) AS households
       FROM children
       WHERE facility IS NOT NULL AND facility != ''${enrolFilter}
       GROUP BY facility, district, ward`,
      vals,
    );

    const svc = await SourcePG.query(
      `WITH all_services AS (
        SELECT c.facility, c.district, COALESCE(c.ward, '') AS ward, (CASE WHEN vs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(vs.service_date::text, 1, 10)::date WHEN vs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(vs.service_date::text, 'DD-MM-YYYY') END) AS d FROM vca_services vs
          JOIN children c ON c.uid = vs.vcaid
         WHERE c.facility IS NOT NULL AND c.facility != ''
        UNION ALL
        SELECT h.facility, h.district, COALESCE(h.ward, '') AS ward, (CASE WHEN hs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(hs.service_date::text, 1, 10)::date WHEN hs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(hs.service_date::text, 'DD-MM-YYYY') END) AS d FROM household_services hs
          JOIN all_households h ON h.household_id = hs.household_id
         WHERE h.facility IS NOT NULL AND h.facility != ''
        UNION ALL
        SELECT h.facility, h.district, COALESCE(h.ward, '') AS ward, (CASE WHEN cs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(cs.service_date::text, 1, 10)::date WHEN cs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(cs.service_date::text, 'DD-MM-YYYY') END) AS d FROM caregiver_services cs
          JOIN all_households h ON h.household_id = cs.household_id
         WHERE h.facility IS NOT NULL AND h.facility != ''
      )
      SELECT facility,
        COUNT(*) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)) AS services_this_month,
        COUNT(*) FILTER (
          WHERE d >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND d < date_trunc('month', CURRENT_DATE)
        ) AS services_last_month
      FROM all_services
      ${svcWhere}
      GROUP BY facility`,
      vals,
    );

    const byFacility = new Map(svc.rows.map((r) => [r.facility, r]));
    const rows = enrolment.rows
      .map((r) => {
        const s = byFacility.get(r.facility) || {};
        const thisM = Number(s.services_this_month || 0);
        const lastM = Number(s.services_last_month || 0);
        const trend_pct =
          lastM > 0
            ? Math.round(((thisM - lastM) / lastM) * 100)
            : thisM > 0
              ? 100
              : 0;
        return {
          ...r,
          total_vcas: Number(r.total_vcas),
          households: Number(r.households),
          services_this_month: thisM,
          services_last_month: lastM,
          trend_pct,
        };
      })
      .sort(
        (a, b) =>
          b.services_this_month - a.services_this_month ||
          b.total_vcas - a.total_vcas,
      );

    const payload = { status: "success", data: rows };
    perfCacheSet(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Failed to get facility performance:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/caseworker-performance (ecap-plus)
 * Per-caseworker delivery stats with their ward (primary location label for ECAP Plus).
 * Optional filters: ?district=...&facility=...&ward=...
 */
exports.getCaseworkerPerformance = async (req, res) => {
  const cacheKey = perfCacheKey(req);
  const cached = perfCacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);

  // Reuse shared env-configured pool (ecap_plus)
  const SourcePG = FlatPGConnection;
  const { district, facility, ward } = req.query;

  try {
    const conds = [];
    const vals = [];
    if (district && district !== "all") {
      conds.push(`district = $${vals.length + 1}`);
      vals.push(district);
    }
    if (facility && facility !== "all") {
      conds.push(`facility = $${vals.length + 1}`);
      vals.push(facility);
    }
    if (ward && ward !== "all") {
      conds.push(`ward = $${vals.length + 1}`);
      vals.push(ward);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const q = `
      WITH combined AS (
        SELECT c.caseworker_name, c.facility, c.district, c.ward, vs.vcaid AS entity_id,
               (CASE WHEN vs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(vs.service_date::text, 1, 10)::date WHEN vs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(vs.service_date::text, 'DD-MM-YYYY') END) AS d
          FROM vca_services vs JOIN children c ON c.uid = vs.vcaid
         WHERE c.caseworker_name IS NOT NULL AND c.caseworker_name != ''
        UNION ALL
        SELECT h.caseworker_name, h.facility, h.district, COALESCE(h.ward, ''), hs.household_id,
               (CASE WHEN hs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(hs.service_date::text, 1, 10)::date WHEN hs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(hs.service_date::text, 'DD-MM-YYYY') END)
          FROM household_services hs JOIN all_households h ON h.household_id = hs.household_id
         WHERE h.caseworker_name IS NOT NULL AND h.caseworker_name != ''
        UNION ALL
        SELECT h.caseworker_name, h.facility, h.district, COALESCE(h.ward, ''), cs.household_id,
               (CASE WHEN cs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(cs.service_date::text, 1, 10)::date WHEN cs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(cs.service_date::text, 'DD-MM-YYYY') END)
          FROM caregiver_services cs JOIN all_households h ON h.household_id = cs.household_id
         WHERE h.caseworker_name IS NOT NULL AND h.caseworker_name != ''
      )
      SELECT caseworker_name, facility, district, ward,
        COUNT(*) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)) AS services_this_month,
        COUNT(*) FILTER (
          WHERE d >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND d < date_trunc('month', CURRENT_DATE)
        ) AS services_last_month,
        COUNT(DISTINCT entity_id) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)) AS unique_entities_this_month,
        COUNT(DISTINCT d) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)) AS active_days_this_month,
        MAX(d) AS last_active
      FROM combined
      ${where}
      GROUP BY caseworker_name, facility, district, ward
      HAVING COUNT(*) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE) - INTERVAL '3 months') > 0
      ORDER BY services_this_month DESC, last_active DESC NULLS LAST
      LIMIT 500
    `;

    const result = await SourcePG.query(q, vals);
    const counts = result.rows
      .map((r) => Number(r.services_this_month || 0))
      .filter((n) => n > 0)
      .sort((a, b) => b - a);
    const n = counts.length;
    const topThreshold =
      n > 0 ? counts[Math.floor(n * 0.2) - 1] || counts[0] : 0;
    const bottomThreshold = n > 0 ? counts[Math.floor(n * 0.8) - 1] || 0 : 0;

    const rows = result.rows.map((r) => {
      const thisM = Number(r.services_this_month || 0);
      const lastM = Number(r.services_last_month || 0);
      const trend_pct =
        lastM > 0
          ? Math.round(((thisM - lastM) / lastM) * 100)
          : thisM > 0
            ? 100
            : 0;
      let tier = "mid";
      if (thisM === 0) tier = "inactive";
      else if (thisM >= topThreshold) tier = "top";
      else if (thisM <= bottomThreshold) tier = "bottom";
      return {
        caseworker_name: r.caseworker_name,
        facility: r.facility || null,
        ward: r.ward || null,
        district: r.district || null,
        services_this_month: thisM,
        services_last_month: lastM,
        trend_pct,
        unique_entities_this_month: Number(r.unique_entities_this_month || 0),
        active_days_this_month: Number(r.active_days_this_month || 0),
        services_per_active_day:
          r.active_days_this_month > 0
            ? Math.round((thisM / Number(r.active_days_this_month)) * 10) / 10
            : 0,
        last_active: r.last_active,
        tier,
      };
    });

    const payload = { status: "success", data: rows };
    perfCacheSet(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Failed to get caseworker performance:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/service-performance (ecap-plus)
 */
exports.getServicePerformance = async (req, res) => {
  const cacheKey = perfCacheKey(req);
  const cached = perfCacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);

  // Reuse shared env-configured pool (ecap_plus)
  const SourcePG = FlatPGConnection;

  const { type = "all", district, facility, ward } = req.query;

  try {
    const conds = [];
    const vals = [];
    if (district && district !== "all") {
      conds.push(`district = $${vals.length + 1}`);
      vals.push(district);
    }
    if (facility && facility !== "all") {
      conds.push(`facility = $${vals.length + 1}`);
      vals.push(facility);
    }
    if (ward && ward !== "all") {
      conds.push(`ward = $${vals.length + 1}`);
      vals.push(ward);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const denomQ = await SourcePG.query(`
      SELECT
        (SELECT COUNT(*) FROM children) AS total_vcas,
        (SELECT COUNT(DISTINCT household_id) FROM all_households) AS total_households
    `);
    const totalVcas = Number(denomQ.rows[0]?.total_vcas || 0);
    const totalHouseholds = Number(denomQ.rows[0]?.total_households || 0);

    const serviceCte = `
      WITH raw AS (
        SELECT trim(both '"' from x) AS service_name, d, entity_id, type FROM (
          SELECT unnest(string_to_array(
            regexp_replace(COALESCE(vs.health_services, ''), '[\\[\\]"\\{\\}]', '', 'g'),
            ','
          )) AS x, (CASE WHEN vs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(vs.service_date::text, 1, 10)::date WHEN vs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(vs.service_date::text, 'DD-MM-YYYY') END) AS d, vs.vcaid AS entity_id, 'vca' AS type, c.district, c.facility, COALESCE(c.ward, '') AS ward
          FROM vca_services vs JOIN children c ON c.uid = vs.vcaid
          UNION ALL
          SELECT unnest(string_to_array(
            regexp_replace(COALESCE(hs.health_services, ''), '[\\[\\]"\\{\\}]', '', 'g'),
            ','
          )) AS x, (CASE WHEN hs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(hs.service_date::text, 1, 10)::date WHEN hs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(hs.service_date::text, 'DD-MM-YYYY') END) AS d, hs.household_id, 'household' AS type, h.district, h.facility, COALESCE(h.ward, '') AS ward
          FROM household_services hs JOIN all_households h ON h.household_id = hs.household_id
          UNION ALL
          SELECT unnest(string_to_array(
            regexp_replace(COALESCE(cs.health_services, ''), '[\\[\\]"\\{\\}]', '', 'g'),
            ','
          )) AS x, (CASE WHEN cs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(cs.service_date::text, 1, 10)::date WHEN cs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(cs.service_date::text, 'DD-MM-YYYY') END) AS d, cs.household_id, 'caregiver' AS type, h.district, h.facility, COALESCE(h.ward, '') AS ward
          FROM caregiver_services cs JOIN all_households h ON h.household_id = cs.household_id
        ) s
        ${where}
      ),
      clean AS (
        SELECT trim(service_name) AS service_name, d, entity_id, type FROM raw
         WHERE trim(service_name) != '' AND trim(service_name) IS NOT NULL
      )
      SELECT service_name AS service, type,
        COUNT(*) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)) AS this_month,
        COUNT(*) FILTER (
          WHERE d >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            AND d < date_trunc('month', CURRENT_DATE)
        ) AS last_month,
        COUNT(DISTINCT entity_id) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE)) AS unique_entities_this_month
      FROM clean
      ${type !== "all" ? `WHERE type = '${type.replace(/'/g, "''")}'` : ""}
      GROUP BY service_name, type
      HAVING COUNT(*) FILTER (WHERE d >= date_trunc('month', CURRENT_DATE) - INTERVAL '3 months') > 0
      ORDER BY this_month DESC
    `;

    const result = await SourcePG.query(serviceCte, vals);
    const counts = result.rows
      .map((r) => Number(r.this_month || 0))
      .filter((n) => n > 0)
      .sort((a, b) => b - a);
    const n = counts.length;
    const topThreshold =
      n > 0 ? counts[Math.floor(n * 0.2) - 1] || counts[0] : 0;
    const bottomThreshold = n > 0 ? counts[Math.floor(n * 0.8) - 1] || 0 : 0;

    const rows = result.rows.map((r) => {
      const thisM = Number(r.this_month || 0);
      const lastM = Number(r.last_month || 0);
      const trend_pct =
        lastM > 0
          ? Math.round(((thisM - lastM) / lastM) * 100)
          : thisM > 0
            ? 100
            : 0;
      const unique = Number(r.unique_entities_this_month || 0);
      const denom = r.type === "vca" ? totalVcas : totalHouseholds;
      const coverage_pct =
        denom > 0 ? Math.round((unique / denom) * 1000) / 10 : 0;
      let tier = "mid";
      if (thisM === 0) tier = "inactive";
      else if (thisM >= topThreshold && trend_pct >= 0) tier = "top";
      else if (thisM <= bottomThreshold || trend_pct < -20) tier = "bottom";
      return {
        service: r.service,
        type: r.type,
        this_month: thisM,
        last_month: lastM,
        trend_pct,
        unique_entities_this_month: unique,
        coverage_pct,
        tier,
      };
    });

    const payload = {
      status: "success",
      data: rows,
      meta: { total_vcas: totalVcas, total_households: totalHouseholds },
    };
    perfCacheSet(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Failed to get service performance:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * Duplicate review persistence (ecap-plus)
 */
async function ensureDuplicateReviewsTable() {
  await FlatPGConnection.query(`
    CREATE TABLE IF NOT EXISTS duplicate_reviews (
      id SERIAL PRIMARY KEY,
      run_key TEXT UNIQUE NOT NULL,
      service_type TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ DEFAULT NOW(),
      note TEXT
    );
  `);
}

exports.listDuplicateReviews = async (req, res) => {
  try {
    await ensureDuplicateReviewsTable();
    const result = await FlatPGConnection.query(
      `SELECT run_key, service_type, reviewed_by, reviewed_at, note FROM duplicate_reviews ORDER BY reviewed_at DESC LIMIT 5000`,
    );
    return res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Failed to list duplicate reviews:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.upsertDuplicateReview = async (req, res) => {
  const { run_key, service_type, reviewed_by, note } = req.body || {};
  if (!run_key)
    return res
      .status(400)
      .json({ status: "error", message: "run_key is required" });
  try {
    await ensureDuplicateReviewsTable();
    await FlatPGConnection.query(
      `INSERT INTO duplicate_reviews (run_key, service_type, reviewed_by, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (run_key) DO UPDATE
         SET service_type = EXCLUDED.service_type,
             reviewed_by = EXCLUDED.reviewed_by,
             reviewed_at = NOW(),
             note = EXCLUDED.note`,
      [run_key, service_type || null, reviewed_by || null, note || null],
    );
    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("Failed to upsert duplicate review:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.deleteDuplicateReview = async (req, res) => {
  const { run_key } = req.params;
  if (!run_key)
    return res
      .status(400)
      .json({ status: "error", message: "run_key is required" });
  try {
    await ensureDuplicateReviewsTable();
    await FlatPGConnection.query(
      `DELETE FROM duplicate_reviews WHERE run_key = $1`,
      [run_key],
    );
    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.error("Failed to delete duplicate review:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/caseworker-journeys
 * Returns GPS journey data for caseworkers from the source OpenSRP database
 * Query params: ?caseworker=xxx&from=2026-01-01&to=2026-04-15&district=Kabwe
 */
exports.getCaseworkerJourneys = async (req, res) => {
  // Use the direct ecap_plus connection, NOT the FDW foreign tables. This
  // query scans core.event's JSON obs array and sorts by dateCreated — neither
  // predicate is pushable through postgres_fdw, so via the foreign table it
  // takes 27-60s (504); against ecap_plus directly it's ~0.16s. core.event,
  // core.location and core.client all live in ecap_plus. See RawPGConnection.
  const SourcePG = RawPGConnection;

  try {
    const conditions = [];
    const values = [];
    let idx = 1;

    if (req.query.caseworker && req.query.caseworker !== "all") {
      conditions.push(`e.json->>'providerId' = $${idx++}`);
      values.push(req.query.caseworker);
    }
    if (req.query.from) {
      conditions.push(`e.json->>'dateCreated' >= $${idx++}`);
      values.push(req.query.from);
    }
    if (req.query.to) {
      conditions.push(`e.json->>'dateCreated' <= $${idx++}`);
      values.push(req.query.to);
    }

    // Facility/ward filter: resolve name to locationId(s) via fuzzy match
    if (req.query.facility && req.query.facility !== "all") {
      const locResult = await SourcePG.query(
        `SELECT json->>'id' as loc_id FROM core.location WHERE LOWER(json->'properties'->>'name') LIKE LOWER($1) LIMIT 10`,
        [`%${req.query.facility}%`],
      );
      if (locResult.rows.length > 0) {
        const locIds = locResult.rows.map((r) => r.loc_id);
        conditions.push(`e.json->>'locationId' = ANY($${idx++})`);
        values.push(locIds);
      } else {
        return res.status(200).json({ status: "success", data: [] });
      }
    }

    // Require at least one filter to prevent full table scan
    if (conditions.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Select a caseworker, ward, or date range to load GPS data",
      });
    }

    const whereExtra = conditions.length
      ? " AND " + conditions.join(" AND ")
      : "";

    const GPS_LAT_FIELDS = [
      "vca_service_location_latitude",
      "hh_service_location_latitude",
      "vca_visit_location_latitude",
      "visit_location_latitude",
      "household_location_latitude",
      "referral_location_latitude",
      "geopoint_latitude",
      "user_gps_latitude",
    ];
    const GPS_LNG_FIELDS = [
      "vca_service_location_longitude",
      "hh_service_location_longitude",
      "vca_visit_location_longitude",
      "visit_location_longitude",
      "household_location_longitude",
      "referral_location_longitude",
      "geopoint_longitude",
      "user_gps_longitude",
    ];

    const result = await SourcePG.query(
      `WITH filtered_events AS (
        SELECT e.json as ej
        FROM core.event e
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(e.json->'obs') o WHERE o->>'fieldCode' = ANY($${idx})
        )
        ${whereExtra}
        ORDER BY e.json->>'dateCreated' DESC
        LIMIT 500
      )
      SELECT
        fe.ej->>'providerId' as caseworker,
        fe.ej->>'dateCreated' as visit_date,
        fe.ej->>'entityType' as form_type,
        (SELECT o->'values'->>0 FROM jsonb_array_elements(fe.ej->'obs') o WHERE o->>'fieldCode' = ANY($${idx}) LIMIT 1) as lat,
        (SELECT o->'values'->>0 FROM jsonb_array_elements(fe.ej->'obs') o WHERE o->>'fieldCode' = ANY($${idx + 1}) LIMIT 1) as lng,
        l.json->'properties'->>'name' as facility,
        fe.ej->>'baseEntityId' as entity_id,
        (SELECT COALESCE(c.json->'attributes'->>'household_id', c.json->'attributes'->>'unique_id') FROM core.client c WHERE c.json->'baseEntityId' = to_jsonb(fe.ej->>'baseEntityId') LIMIT 1) as household_id
      FROM filtered_events fe
      LEFT JOIN core.location l ON l.json->>'id' = fe.ej->>'locationId'`,
      [...values, GPS_LAT_FIELDS, GPS_LNG_FIELDS],
    );

    return res.status(200).json({
      status: "success",
      data: result.rows,
    });
  } catch (err) {
    console.error("Failed to get caseworker journeys:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/caseworker-list
 * Returns distinct caseworkers with their location IDs from the source OpenSRP database
 */
exports.getCaseworkerList = async (req, res) => {
  const SourcePG = FlatPGConnection;
  // Optional jurisdiction filters injected by the frontend based on the
  // logged-in user's role (Provincial / District users only see their scope).
  const { district, province } = req.query;

  try {
    const filters = [
      `p.username IS NOT NULL AND p.username != ''`,
      `p.active = true`,
      // Drop test / system / placeholder accounts. These are easy to spot by
      // either username or display name; both checks are case-insensitive.
      `LOWER(TRIM(p.username)) NOT IN ('devtest','pcz','ecapplus','caseworker','johnq','test','testlimu','testing','wardsync','wardsync1')`,
      `LOWER(TRIM(p.name)) NOT LIKE '%devtest%'`,
      `LOWER(TRIM(p.name)) NOT LIKE '%john doe%'`,
      `LOWER(TRIM(p.name)) NOT LIKE '%pcz pcz%'`,
      `LOWER(TRIM(p.name)) NOT LIKE '%ecap ecap%'`,
      `LOWER(TRIM(p.name)) NOT LIKE '%project pcz%'`,
      `LOWER(TRIM(p.name)) NOT LIKE '%test test%'`,
      `LOWER(TRIM(p.name)) NOT LIKE '%testlimu%'`,
      `LOWER(TRIM(p.name)) NOT LIKE '%testing wardsync%'`,
    ];
    const params = [];
    if (district && district !== "all" && district !== "All") {
      params.push(district);
      filters.push(`LOWER(TRIM(c.district)) = LOWER(TRIM($${params.length}))`);
    }
    if (province && province !== "all" && province !== "All") {
      params.push(province);
      filters.push(`LOWER(TRIM(c.province)) = LOWER(TRIM($${params.length}))`);
    }

    // `has_gps` is sourced from mv_providers_with_gps — a view of distinct
    // providerIds that have at least one GPS-tagged obs in core.event. We use
    // the view (not a live core.event scan) because scanning the JSON event
    // table inline is a 2+ minute operation; the view is refreshed by the ETL.
    //
    // NOTE ON TOPOLOGY: in this DB, core.event / team.practitioner /
    // mv_providers_with_gps are all FOREIGN TABLES (postgres_fdw server
    // `ecap_plus_raw` -> remote `ecap_plus`), so the join is pushed down and
    // executed on the remote server where the matview physically lives. The
    // foreign table only exposes `provider`, so — matching the production
    // backend — we derive has_gps purely from `g.provider IS NOT NULL` and do
    // NOT select a count column. The join matches `provider` against
    // p.username, the value core.event stores under 'providerId'.
    const buildQuery = (withGps) => `
      SELECT DISTINCT ON (p.username)
        p.username as caseworker,
        p.name as display_name,
        c.ward as facility,
        c.district as district,
        c.province as province,
        ${withGps
          ? "CASE WHEN g.provider IS NOT NULL THEN true ELSE false END as has_gps"
          : "false as has_gps"}
      FROM team.practitioner p
      LEFT JOIN children c ON LOWER(TRIM(c.caseworker_name)) = LOWER(TRIM(p.name))
      ${withGps
        ? "LEFT JOIN mv_providers_with_gps g ON LOWER(TRIM(g.provider)) = LOWER(TRIM(p.username))"
        : ""}
      WHERE ${filters.join(" AND ")}
      ORDER BY p.username, c.ward NULLS LAST, p.name
    `;

    let result;
    try {
      result = await SourcePG.query(buildQuery(true), params);
    } catch (gpsErr) {
      // mv_providers_with_gps may not exist yet on this DB — fall back to the
      // GPS-less query so the dropdown stays populated regardless of deploy
      // order. has_gps comes back false for everyone until the view is created.
      console.warn(
        "caseworker-list: GPS view unavailable, falling back without has_gps:",
        gpsErr.message,
      );
      result = await SourcePG.query(buildQuery(false), params);
    }

    return res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Failed to get caseworker list:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/dqa-checks
 * Runs comprehensive DQA checks across completeness, consistency, timeliness, validity, accuracy, uniqueness, coverage, behavioral, cross-validation
 * Query params: ?district=X&facility=Y
 */
/**
 * Normalized predicate for "child living with HIV" — calhiv is source of truth
 * because is_hiv_positive is not consistently populated on the flat tables.
 */
const CLHIV_PREDICATE = `(
  c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes'
  OR (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%')
)`;

/**
 * GET /etl/action-queue
 * Priority actionable items per service type (vca|caregiver|household).
 */
/**
 * GET /etl/services/:type/summary
 * Canonical DB-backed KPI numbers per service type.
 * type ∈ { vca | caregiver | household }
 */
exports.getServiceSummary = async (req, res) => {
  const cacheKey = perfCacheKey(req);
  const cached = perfCacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);

  const SourcePG = FlatPGConnection;
  const type = (req.params.type || "").toLowerCase();
  const { district, facility, ward } = req.query;
  const window = parseFyWindow(req.query);

  const filters = [];
  const vals = [];
  if (district && district !== "all" && district !== "All") {
    filters.push(`c.district = $${vals.length + 1}`);
    vals.push(district);
  }
  if (facility && facility !== "all") {
    filters.push(`c.facility = $${vals.length + 1}`);
    vals.push(facility);
  }
  if (ward && ward !== "all") {
    filters.push(`c.ward = $${vals.length + 1}`);
    vals.push(ward);
  }
  // FY cohort filter — same handling as dqa's getServiceSummary.
  const { clause: cohortClause, params: cohortParams } = buildCohortFyClause(
    window,
    {
      enrolledCol: "c.date_enrolled",
      deRegCol: "c.de_registration_date",
      startParamIndex: vals.length + 1,
    },
  );
  vals.push(...cohortParams);
  const where =
    filters.length || cohortClause
      ? `AND ${[filters.join(" AND "), cohortClause.replace(/^\s*AND\s*/, "")].filter(Boolean).join(" AND ")}`
      : "";
  const wherePure =
    filters.length || cohortClause
      ? `WHERE ${[filters.join(" AND "), cohortClause.replace(/^\s*AND\s*/, "")].filter(Boolean).join(" AND ")}`
      : "";
  const parseDate =
    "(CASE WHEN $X ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring($X, 1, 10)::date WHEN $X ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE($X, 'DD-MM-YYYY') END)";

  try {
    if (type === "vca") {
      // COUNT(DISTINCT uid) — duplicates in children no longer inflate.
      // case_status: ecap_plus uses '1' for Active (not the string 'Active'
      // that dqa uses); '0' = closed, '2'/'3' = other. Without this fix
      // the Services Headline showed Active=0 for every type.
      const q = await SourcePG.query(
        `
        WITH base AS (SELECT * FROM children c WHERE 1=1 ${where})
        SELECT
          COUNT(DISTINCT uid) AS enrolled,
          COUNT(DISTINCT uid) FILTER (WHERE LOWER(TRIM(case_status)) IN ('active','1')) AS active,
          COUNT(DISTINCT uid) FILTER (WHERE calhiv = '1' OR calhiv ILIKE 'true' OR calhiv ILIKE 'yes' OR is_hiv_positive ILIKE '%true%') AS clhiv,
          COUNT(DISTINCT uid) FILTER (WHERE hei = '1' OR hei ILIKE 'true') AS hei,
          COUNT(DISTINCT uid) FILTER (WHERE cwlhiv = '1' OR cwlhiv ILIKE 'true') AS cwlhiv
        FROM base
      `,
        vals,
      ).catch((e) => {
        throw e;
      });

      const svc = await SourcePG.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE ${parseDate.replace(/\$X/g, "vs.service_date")} >= date_trunc('month', CURRENT_DATE)) AS services_this_month,
          COUNT(*) FILTER (WHERE ${parseDate.replace(/\$X/g, "vs.service_date")} >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                            AND ${parseDate.replace(/\$X/g, "vs.service_date")} < date_trunc('month', CURRENT_DATE)) AS services_last_month,
          COUNT(DISTINCT vs.vcaid) FILTER (WHERE ${parseDate.replace(/\$X/g, "vs.service_date")} >= date_trunc('month', CURRENT_DATE)) AS active_this_month
        FROM vca_services vs
          JOIN children c ON c.uid = vs.vcaid
        WHERE 1=1 ${where}
      `,
        vals,
      ).catch(() => ({ rows: [{}] }));

      const stale = await SourcePG.query(
        `
        SELECT COUNT(*) AS stale_90d FROM children c
        WHERE NOT EXISTS (SELECT 1 FROM vca_services vs WHERE vs.vcaid = c.uid AND ${parseDate.replace(/\$X/g, "vs.service_date")} >= (NOW() - INTERVAL '90 days')::date) ${where}
      `,
        vals,
      ).catch(() => ({ rows: [{}] }));

      const r = q.rows[0] || {};
      const s = svc.rows[0] || {};
      const thisM = Number(s.services_this_month || 0);
      const lastM = Number(s.services_last_month || 0);
      const payload = {
        status: "success",
        type,
        data: {
          enrolled: Number(r.enrolled || 0),
          active: Number(r.active || 0),
          clhiv: Number(r.clhiv || 0),
          hei: Number(r.hei || 0),
          cwlhiv: Number(r.cwlhiv || 0),
          active_this_month: Number(s.active_this_month || 0),
          stale_90d: Number(stale.rows[0]?.stale_90d || 0),
          services_this_month: thisM,
          services_last_month: lastM,
          mom_trend_pct:
            lastM > 0
              ? Math.round(((thisM - lastM) / lastM) * 100)
              : thisM > 0
                ? 100
                : 0,
        },
        generated_at: new Date().toISOString(),
        source: "ecap_plus.children + vca_services",
      };
      perfCacheSet(cacheKey, payload);
      return res.status(200).json(payload);
    }

    if (type === "caregiver") {
      // COUNT(DISTINCT household_id) — one caregiver per household;
      // case_status uses '1' for Active in ecap_plus.
      const q = await SourcePG.query(
        `
        SELECT
          COUNT(DISTINCT household_id) AS enrolled,
          COUNT(DISTINCT household_id) FILTER (WHERE LOWER(TRIM(case_status)) IN ('active','1')) AS active,
          COUNT(DISTINCT household_id) FILTER (WHERE caregiver_hiv_status ILIKE '%positive%' OR caregiver_hiv_status ILIKE '%true%') AS cwlhiv,
          COUNT(DISTINCT household_id) FILTER (WHERE pregnant_woment ILIKE '%yes%' OR pregnant_woment = '1' OR pregnant_woment ILIKE 'true') AS pregnant
        FROM all_households c ${wherePure}
      `,
        vals,
      ).catch(() => ({ rows: [{}] }));

      const svc = await SourcePG.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE ${parseDate.replace(/\$X/g, "cs.service_date")} >= date_trunc('month', CURRENT_DATE)) AS services_this_month,
          COUNT(*) FILTER (WHERE ${parseDate.replace(/\$X/g, "cs.service_date")} >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                            AND ${parseDate.replace(/\$X/g, "cs.service_date")} < date_trunc('month', CURRENT_DATE)) AS services_last_month
        FROM caregiver_services cs
          JOIN all_households c ON c.household_id = cs.household_id
        WHERE 1=1 ${where}
      `,
        vals,
      ).catch(() => ({ rows: [{}] }));

      const r = q.rows[0] || {};
      const s = svc.rows[0] || {};
      const thisM = Number(s.services_this_month || 0);
      const lastM = Number(s.services_last_month || 0);
      const payload = {
        status: "success",
        type,
        data: {
          enrolled: Number(r.enrolled || 0),
          active: Number(r.active || 0),
          cwlhiv: Number(r.cwlhiv || 0),
          pregnant: Number(r.pregnant || 0),
          services_this_month: thisM,
          services_last_month: lastM,
          mom_trend_pct:
            lastM > 0
              ? Math.round(((thisM - lastM) / lastM) * 100)
              : thisM > 0
                ? 100
                : 0,
        },
        generated_at: new Date().toISOString(),
        source: "ecap_plus.all_households + caregiver_services",
      };
      perfCacheSet(cacheKey, payload);
      return res.status(200).json(payload);
    }

    if (type === "household") {
      // COUNT(DISTINCT household_id); case_status uses '1' for Active in ecap_plus.
      const q = await SourcePG.query(
        `
        SELECT
          COUNT(DISTINCT household_id) AS enrolled,
          COUNT(DISTINCT household_id) FILTER (WHERE LOWER(TRIM(case_status)) IN ('active','1')) AS active,
          COUNT(DISTINCT household_id) FILTER (WHERE screened ILIKE '%yes%' OR screened = 'true' OR screened = '1') AS screened,
          COUNT(DISTINCT household_id) FILTER (WHERE screened IS NULL OR screened ILIKE '%no%' OR screened ILIKE '%false%' OR screened = '') AS unscreened
        FROM all_households c ${wherePure}
      `,
        vals,
      ).catch(() => ({ rows: [{}] }));

      const svc = await SourcePG.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE ${parseDate.replace(/\$X/g, "hs.service_date")} >= date_trunc('month', CURRENT_DATE)) AS services_this_month,
          COUNT(*) FILTER (WHERE ${parseDate.replace(/\$X/g, "hs.service_date")} >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                            AND ${parseDate.replace(/\$X/g, "hs.service_date")} < date_trunc('month', CURRENT_DATE)) AS services_last_month
        FROM household_services hs
          JOIN all_households c ON c.household_id = hs.household_id
        WHERE 1=1 ${where}
      `,
        vals,
      ).catch(() => ({ rows: [{}] }));

      const r = q.rows[0] || {};
      const s = svc.rows[0] || {};
      const thisM = Number(s.services_this_month || 0);
      const lastM = Number(s.services_last_month || 0);
      const payload = {
        status: "success",
        type,
        data: {
          enrolled: Number(r.enrolled || 0),
          active: Number(r.active || 0),
          screened: Number(r.screened || 0),
          unscreened: Number(r.unscreened || 0),
          services_this_month: thisM,
          services_last_month: lastM,
          mom_trend_pct:
            lastM > 0
              ? Math.round(((thisM - lastM) / lastM) * 100)
              : thisM > 0
                ? 100
                : 0,
        },
        generated_at: new Date().toISOString(),
        source: "ecap_plus.all_households + household_services",
      };
      perfCacheSet(cacheKey, payload);
      return res.status(200).json(payload);
    }

    return res
      .status(400)
      .json({ status: "error", message: `Unknown service type: ${type}` });
  } catch (err) {
    console.error("Failed to get service summary:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

const PARSE_DATE_TPL =
  "(CASE WHEN $X ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring($X, 1, 10)::date WHEN $X ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE($X, 'DD-MM-YYYY') END)";
const parseDateExpr = (col) => PARSE_DATE_TPL.replace(/\$X/g, col);

const TYPE_CFG = {
  vca: {
    svc: "vca_services",
    svcAlias: "vs",
    entity: "children",
    entityAlias: "c",
    joinKey: "c.uid = vs.vcaid",
    source: "ecap_plus.vca_services",
    pillars: [
      ["HIV", "hiv_services"],
      ["Health", "health_services"],
      ["Education", "schooled_services"],
      ["Safety", "safe_services"],
      ["Stability", "stable_services"],
    ],
  },
  caregiver: {
    svc: "caregiver_services",
    svcAlias: "cs",
    entity: "all_households",
    entityAlias: "c",
    joinKey: "c.household_id = cs.household_id",
    source: "ecap_plus.caregiver_services",
    pillars: [
      ["HIV", "hiv_services"],
      ["Health", "health_services"],
      ["Education", "schooled_services"],
      ["Safety", "safe_services"],
      ["Stability", "stable_services"],
    ],
  },
  household: {
    svc: "household_services",
    svcAlias: "hs",
    entity: "all_households",
    entityAlias: "c",
    joinKey: "c.household_id = hs.household_id",
    source: "ecap_plus.household_services",
    pillars: [
      ["Health", "health_services"],
      ["Household", "hh_level_services"],
      ["Education", "schooled_services"],
      ["Safety", "safe_services"],
      ["Stability", "stable_services"],
    ],
  },
};

/**
 * GET /etl/services/:type/timeseries — last 12 months of service volume.
 */
exports.getServiceTimeseries = async (req, res) => {
  const cacheKey = perfCacheKey(req);
  const cached = perfCacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);

  const SourcePG = FlatPGConnection;
  const type = (req.params.type || "").toLowerCase();
  const cfg = TYPE_CFG[type];
  if (!cfg)
    return res
      .status(400)
      .json({ status: "error", message: `Unknown service type: ${type}` });

  const { district, facility, ward } = req.query;
  const filters = [];
  const vals = [];
  if (district && district !== "all" && district !== "All") {
    filters.push(`c.district = $${vals.length + 1}`);
    vals.push(district);
  }
  if (facility && facility !== "all") {
    filters.push(`c.facility = $${vals.length + 1}`);
    vals.push(facility);
  }
  if (ward && ward !== "all") {
    filters.push(`c.ward = $${vals.length + 1}`);
    vals.push(ward);
  }
  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

  // Build a date truncation expression that works for BOTH text and date
  // column types. caregiver_services.service_date is text (DD-MM-YYYY or
  // YYYY-MM-DD); vca_services.service_date and household_services.service_date
  // are actual date columns. Using the regex ~ operator on a date column
  // raises "operator does not exist: date ~ unknown".
  // Solution: cast to text first, then apply the CASE/regex for text cols,
  // or just cast directly to date for date cols.
  // We detect the type per service table via a safe CASE that first casts to
  // text, so it works universally without needing schema introspection.
  const svcAlias = cfg.svcAlias;
  const svcDateTextExpr =
    `(CASE ` +
    `WHEN ${svcAlias}.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' ` +
    `THEN substring(${svcAlias}.service_date::text, 1, 10)::date ` +
    `WHEN ${svcAlias}.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' ` +
    `THEN TO_DATE(${svcAlias}.service_date::text, 'DD-MM-YYYY') ` +
    `END)`;

  try {
    const q = await SourcePG.query(
      `
      WITH months AS (
        SELECT generate_series(
                 date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
                 date_trunc('month', CURRENT_DATE),
                 INTERVAL '1 month'
               )::date AS month_start
      )
      SELECT
        to_char(m.month_start, 'YYYY-MM') AS month,
        to_char(m.month_start, 'Mon YY')  AS label,
        COUNT(${cfg.svcAlias}.*) AS count
      FROM months m
        LEFT JOIN ${cfg.svc} ${cfg.svcAlias}
      ON date_trunc('month', ${svcDateTextExpr}) = m.month_start
        LEFT JOIN ${cfg.entity} ${cfg.entityAlias}
        ON ${cfg.joinKey}
      WHERE 1=1 ${where}
      GROUP BY m.month_start
      ORDER BY m.month_start
    `,
      vals,
    );

    const payload = {
      status: "success",
      type,
      data: q.rows.map((r) => ({
        month: r.month,
        label: r.label,
        count: Number(r.count || 0),
      })),
      generated_at: new Date().toISOString(),
      source: cfg.source,
    };
    perfCacheSet(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Failed to get service timeseries:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/services/:type/distribution — pillar mix in last 90 days.
 */
exports.getServiceDistribution = async (req, res) => {
  const cacheKey = perfCacheKey(req);
  const cached = perfCacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);

  const SourcePG = FlatPGConnection;
  const type = (req.params.type || "").toLowerCase();
  const cfg = TYPE_CFG[type];
  if (!cfg)
    return res
      .status(400)
      .json({ status: "error", message: `Unknown service type: ${type}` });

  const { district, facility, ward } = req.query;
  const filters = [];
  const vals = [];
  if (district && district !== "all" && district !== "All") {
    filters.push(`c.district = $${vals.length + 1}`);
    vals.push(district);
  }
  if (facility && facility !== "all") {
    filters.push(`c.facility = $${vals.length + 1}`);
    vals.push(facility);
  }
  if (ward && ward !== "all") {
    filters.push(`c.ward = $${vals.length + 1}`);
    vals.push(ward);
  }
  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

  const hasPillarExpr = (col) =>
    `${col} IS NOT NULL AND length(trim(${col}::text)) > 0 AND trim(${col}::text) NOT IN ('[]','["not applicable"]')`;

  // Universal date expression — cast to text first so regex works on both
  // text columns (caregiver_services) and date columns (vca/household_services).
  const svcAlias = cfg.svcAlias;
  const svcDateTextExpr =
    `(CASE ` +
    `WHEN ${svcAlias}.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' ` +
    `THEN substring(${svcAlias}.service_date::text, 1, 10)::date ` +
    `WHEN ${svcAlias}.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' ` +
    `THEN TO_DATE(${svcAlias}.service_date::text, 'DD-MM-YYYY') ` +
    `END)`;

  try {
    const selects = cfg.pillars
      .map(
        ([label, col]) =>
          `COUNT(*) FILTER (WHERE ${hasPillarExpr(col)}) AS "${label}"`,
      )
      .join(",\n          ");

    const q = await SourcePG.query(
      `
      SELECT
        COUNT(*) AS total,
        ${selects}
      FROM ${cfg.svc} ${cfg.svcAlias}
             JOIN ${cfg.entity} ${cfg.entityAlias} ON ${cfg.joinKey}
      WHERE ${svcDateTextExpr} >= (CURRENT_DATE - INTERVAL '90 days') ${where}
    `,
      vals,
    );

    const r = q.rows[0] || {};
    const total = Number(r.total || 0);
    const data = cfg.pillars.map(([label]) => {
      const count = Number(r[label] || 0);
      return {
        pillar: label,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });

    const payload = {
      status: "success",
      type,
      data,
      total,
      window_days: 90,
      generated_at: new Date().toISOString(),
      source: cfg.source,
    };
    perfCacheSet(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Failed to get service distribution:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getActionQueue = async (req, res) => {
  const cacheKey = perfCacheKey(req);
  const cached = perfCacheGet(cacheKey);
  if (cached) return res.status(200).json(cached);

  const SourcePG = FlatPGConnection;
  const type = (req.query.type || "vca").toLowerCase();
  const { district, facility, ward } = req.query;

  try {
    const filters = [];
    const vals = [];
    if (district && district !== "all") {
      filters.push(`c.district = $${vals.length + 1}`);
      vals.push(district);
    }
    if (facility && facility !== "all") {
      filters.push(`c.facility = $${vals.length + 1}`);
      vals.push(facility);
    }
    if (ward && ward !== "all") {
      filters.push(`c.ward = $${vals.length + 1}`);
      vals.push(ward);
    }
    const where = filters.length ? `AND ${filters.join(" AND ")}` : "";

    const run = (sql) =>
      SourcePG.query(sql, vals).then((r) => Number(r.rows[0]?.c || 0));

    const items = [];

    if (type === "vca") {
      // ECAP Plus children table has no `age` or `last_service_date` columns.
      // Derive staleness from vca_services and skip the age<18 subset for CALHIV.
      const [stale90, clhivNoArt, vlOverdue, missingHiv, calhivNoArt] =
        await Promise.all([
          run(
            `SELECT COUNT(*)::int AS c FROM children c WHERE NOT EXISTS (SELECT 1 FROM vca_services vs WHERE vs.vcaid = c.uid AND (CASE WHEN vs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(vs.service_date::text, 1, 10)::date WHEN vs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(vs.service_date::text, 'DD-MM-YYYY') END) >= (NOW() - INTERVAL '90 days')::date) ${where}`,
          ).catch(() => 0),
          run(
            `SELECT COUNT(*)::int AS c FROM children c WHERE ${CLHIV_PREDICATE} AND (c.art_number IS NULL OR c.art_number = '') ${where}`,
          ).catch(() => 0),
          run(
            `SELECT COUNT(*)::int AS c FROM children c WHERE ${CLHIV_PREDICATE} AND c.art_number IS NOT NULL AND c.art_number != '' AND (c.date_last_vl IS NULL OR c.date_last_vl = '' OR c.date_last_vl::date < (NOW() - INTERVAL '6 months')::date) ${where}`,
          ).catch(() => 0),
          run(
            `SELECT COUNT(*)::int AS c FROM children c WHERE (c.calhiv IS NULL OR c.calhiv = '' OR c.calhiv = 'unknown') AND (c.is_hiv_positive IS NULL OR c.is_hiv_positive = '' OR c.is_hiv_positive = 'unknown') ${where}`,
          ).catch(() => 0),
          run(
            `SELECT COUNT(*)::int AS c FROM children c WHERE ${CLHIV_PREDICATE} AND (c.date_started_art IS NULL OR c.date_started_art = '') ${where}`,
          ).catch(() => 0),
        ]);
      items.push(
        {
          key: "stale_90d",
          label: "Stale 90+ days",
          description: "VCAs with no recorded service in the last 90 days.",
          count: stale90,
          severity: stale90 > 0 ? "red" : "slate",
          filter: { type: "stale_records_90d" },
        },
        {
          key: "clhiv_no_art",
          label: "CLHIV without ART number",
          description:
            "Children flagged as living with HIV but no ART number on file.",
          count: clhivNoArt,
          severity: clhivNoArt > 0 ? "red" : "slate",
          filter: { type: "missing_art_numbers" },
        },
        {
          key: "vl_overdue_6m",
          label: "Viral load overdue (6m+)",
          description:
            "CLHIV on ART whose last viral load is older than 6 months.",
          count: vlOverdue,
          severity: vlOverdue > 0 ? "orange" : "slate",
          filter: { type: "stale_viral_loads" },
        },
        {
          key: "calhiv_no_art_started",
          label: "CALHIV (<18) not started on ART",
          description:
            "Children living with HIV under 18 with no ART start date.",
          count: calhivNoArt,
          severity: calhivNoArt > 0 ? "red" : "slate",
          filter: { type: "calhiv_without_art" },
        },
        {
          key: "missing_hiv_status",
          label: "Missing HIV status",
          description: "Children with no HIV status recorded.",
          count: missingHiv,
          severity: missingHiv > 0 ? "yellow" : "slate",
          filter: { type: "missing_hiv_status" },
        },
      );
    } else if (type === "caregiver") {
      const [pregnantNoAnc, cwlhivNoVl, stale90] = await Promise.all([
        run(
          `SELECT COUNT(*)::int AS c FROM all_households c WHERE (c.pregnant_woment ILIKE '%yes%' OR c.pregnant_woment = 'true' OR c.pregnant_woment = '1') AND NOT EXISTS (SELECT 1 FROM caregiver_services cs WHERE cs.household_id = c.household_id AND cs.service_date::date >= (NOW() - INTERVAL '90 days')::date) ${where}`,
        ).catch(() => 0),
        run(
          `SELECT COUNT(*)::int AS c FROM all_households c WHERE (c.caregiver_hiv_status ILIKE '%positive%' OR c.caregiver_hiv_status ILIKE '%true%') AND (c.is_mother_virally_suppressed_wlhiv IS NULL OR c.is_mother_virally_suppressed_wlhiv = '' OR c.is_mother_virally_suppressed_wlhiv ILIKE '%false%' OR c.is_mother_virally_suppressed_wlhiv ILIKE '%no%') ${where}`,
        ).catch(() => 0),
        run(
          `SELECT COUNT(*)::int AS c FROM all_households c WHERE NOT EXISTS (SELECT 1 FROM caregiver_services cs WHERE cs.household_id = c.household_id AND cs.service_date::date >= (NOW() - INTERVAL '90 days')::date) ${where}`,
        ).catch(() => 0),
      ]);
      items.push(
        {
          key: "pregnant_no_anc",
          label: "Pregnant caregivers — no service 90d+",
          description: "Pregnant women with no caregiver service in 90 days.",
          count: pregnantNoAnc,
          severity: pregnantNoAnc > 0 ? "red" : "slate",
          filter: { type: "pregnant_no_anc" },
        },
        {
          key: "cwlhiv_not_suppressed",
          label: "CWLHIV not virally suppressed",
          description:
            "Caregivers living with HIV whose last VL was not suppressed or missing.",
          count: cwlhivNoVl,
          severity: cwlhivNoVl > 0 ? "red" : "slate",
          filter: { type: "cwlhiv_not_suppressed" },
        },
        {
          key: "stale_90d",
          label: "Stale 90+ days",
          description: "Caregivers with no service in the last 90 days.",
          count: stale90,
          severity: stale90 > 0 ? "orange" : "slate",
          filter: { type: "stale_caregiver_services" },
        },
      );
    } else if (type === "household") {
      // service_date is text in DD-MM-YYYY on ecap_plus — parse via CASE
      const parsed = `(CASE WHEN hs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(hs.service_date::text,1,10)::date WHEN hs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(hs.service_date::text,'DD-MM-YYYY') END)`;
      const [stale90, unscreened, noPartner] = await Promise.all([
        run(
          `SELECT COUNT(*)::int AS c FROM all_households c WHERE NOT EXISTS (SELECT 1 FROM household_services hs WHERE hs.household_id = c.household_id AND ${parsed} >= (NOW() - INTERVAL '90 days')::date) ${where}`,
        ).catch(() => 0),
        run(
          `SELECT COUNT(*)::int AS c FROM all_households c WHERE (c.screened IS NULL OR c.screened ILIKE '%no%' OR c.screened ILIKE '%false%' OR c.screened = '') ${where}`,
        ).catch(() => 0),
        run(
          `SELECT COUNT(*)::int AS c FROM all_households c WHERE (c.partner IS NULL OR c.partner = '') ${where}`,
        ).catch(() => 0),
      ]);
      items.push(
        {
          key: "stale_hh_90d",
          label: "Households — no service 90d+",
          description: "Households with no household service in 90 days.",
          count: stale90,
          severity: stale90 > 0 ? "red" : "slate",
          filter: { type: "stale_households" },
        },
        {
          key: "unscreened",
          label: "Unscreened households",
          description: "Households marked as not-yet-screened.",
          count: unscreened,
          severity: unscreened > 0 ? "orange" : "slate",
          filter: { type: "unscreened_households" },
        },
        {
          key: "missing_partner",
          label: "Missing partner assignment",
          description: "Enrolled households with no implementing partner set.",
          count: noPartner,
          severity: noPartner > 0 ? "yellow" : "slate",
          filter: { type: "missing_partner" },
        },
      );
    }

    const payload = {
      status: "success",
      type,
      generated_at: new Date().toISOString(),
      data: items,
    };
    perfCacheSet(cacheKey, payload);
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Failed to get action queue:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getDqaChecks = async (req, res) => {
  const district = req.query.district;
  const facility = req.query.facility;

  const filterSql = (alias = "c") => {
    const c = [];
    const v = [];
    if (district && district !== "All Districts") {
      c.push(`${alias}.district = $${v.length + 1}`);
      v.push(district);
    }
    if (facility && facility !== "all") {
      c.push(`${alias}.facility = $${v.length + 1}`);
      v.push(facility);
    }
    return { where: c.length ? ` AND ${c.join(" AND ")}` : "", values: v };
  };

  try {
    const { where, values } = filterSql("c");
    const checks = {};

    // ── COMPLETENESS ──
    // Missing required fields on children
    checks.missing_hiv_status = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c WHERE (c.calhiv IS NULL OR c.calhiv = '' OR c.calhiv = 'unknown') AND (c.is_hiv_positive IS NULL OR c.is_hiv_positive = '' OR c.is_hiv_positive = 'unknown') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    checks.missing_age = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c WHERE (c.age IS NULL OR c.age = '' OR c.age = '0') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    checks.missing_gender = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c WHERE (c.vca_gender IS NULL OR c.vca_gender = '') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    // Orphan services -- vca_services with vcaid not in children
    checks.orphan_vca_services = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM vca_services vs
       LEFT JOIN children c ON c.uid = vs.vcaid
       WHERE vs.vcaid IS NOT NULL AND c.uid IS NULL`,
    ).then((r) => r.rows[0].c);

    checks.orphan_hh_services = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM household_services hs
       LEFT JOIN all_households ah ON ah.household_id = hs.household_id
       WHERE hs.household_id IS NOT NULL AND ah.household_id IS NULL`,
    ).then((r) => r.rows[0].c);

    // ── TIMELINESS ──
    checks.stale_records_90d = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c
       WHERE (c.date_edited IS NULL OR c.date_edited::date < (NOW() - INTERVAL '90 days')::date) ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    // ── VALIDITY ──
    checks.future_dated_services = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM vca_services vs
       JOIN children c ON c.uid = vs.vcaid
       WHERE (CASE WHEN vs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(vs.service_date::text, 1, 10)::date WHEN vs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(vs.service_date::text, 'DD-MM-YYYY') END) > CURRENT_DATE ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    checks.service_before_enrollment = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM vca_services vs
       JOIN children c ON c.uid = vs.vcaid
       WHERE c.date_enrolled IS NOT NULL AND vs.service_date IS NOT NULL
         AND (CASE WHEN vs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(vs.service_date::text, 1, 10)::date WHEN vs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(vs.service_date::text, 'DD-MM-YYYY') END) < c.date_enrolled::date ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    checks.invalid_age = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c
       WHERE c.age ~ '^[0-9]+$' AND (c.age::int < 0 OR c.age::int > 120) ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    // ── ACCURACY / CLINICAL ──
    checks.stale_viral_loads = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c
       WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%')
         AND (c.date_last_vl IS NULL OR c.date_last_vl::date < (NOW() - INTERVAL '6 months')::date) ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    checks.missing_art_numbers = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c
       WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%')
         AND (c.art_number IS NULL OR c.art_number = '') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    checks.missing_mmd_level = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c
       WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%')
         AND (c.level_mmd IS NULL OR c.level_mmd = '') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    // Unscreened households
    checks.unscreened_households = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM all_households c
       WHERE (c.screened IS NULL OR c.screened ILIKE '%no%' OR c.screened ILIKE '%false%' OR c.screened = '') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    // ── CONSISTENCY ──
    // HIV status conflicts -- same uid appears with both positive and not-positive
    checks.hiv_status_conflicts = await FlatPGConnection.query(
      `SELECT COUNT(DISTINCT c.uid)::int AS c FROM children c
       WHERE c.uid IN (
         SELECT uid FROM children
         WHERE uid IS NOT NULL
         GROUP BY uid
         HAVING COUNT(DISTINCT LOWER(COALESCE(is_hiv_positive, ''))) > 1
       ) ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    // ── UNIQUENESS ──
    // Phone number collisions -- same phone across multiple households
    checks.phone_collisions = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM (
         SELECT caregiver_phone FROM all_households c
         WHERE caregiver_phone IS NOT NULL AND caregiver_phone != '' ${where}
         GROUP BY caregiver_phone
         HAVING COUNT(DISTINCT household_id) > 1
       ) x`,
      values,
    ).then((r) => r.rows[0].c);

    // ── COVERAGE ──
    // Caseworker overload (>150 households)
    const caseworkerLoad = await FlatPGConnection.query(
      `SELECT caseworker_name, COUNT(DISTINCT household_id)::int AS households
       FROM all_households c
       WHERE caseworker_name IS NOT NULL AND caseworker_name != '' ${where}
       GROUP BY caseworker_name
       HAVING COUNT(DISTINCT household_id) > 150
       ORDER BY households DESC
       LIMIT 20`,
      values,
    );
    checks.caseworker_overload = caseworkerLoad.rows.length;
    checks.overloaded_caseworkers = caseworkerLoad.rows;

    // ── CROSS-VALIDATION ──
    checks.hiv_positive_no_facility = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c
       WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%')
         AND (c.facility IS NULL OR c.facility = '') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    checks.calhiv_without_art = await FlatPGConnection.query(
      `SELECT COUNT(*)::int AS c FROM children c
       WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%')
         AND c.age ~ '^[0-9]+$' AND c.age::int < 18
         AND (c.date_started_art IS NULL OR c.date_started_art = '') ${where}`,
      values,
    ).then((r) => r.rows[0].c);

    return res.status(200).json({ status: "success", data: checks });
  } catch (err) {
    console.error("Failed to run DQA checks:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/dqa-records
 * Returns specific records that failed a given DQA check
 * Query params: ?check=missing_hiv_status&district=X&facility=Y&limit=200
 */
exports.getDqaRecords = async (req, res) => {
  const check = req.query.check;
  const district = req.query.district;
  const facility = req.query.facility;
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);

  const filterSql = (alias = "c") => {
    const c = [];
    const v = [];
    if (district && district !== "All Districts") {
      c.push(`${alias}.district = $${v.length + 1}`);
      v.push(district);
    }
    if (facility && facility !== "all") {
      c.push(`${alias}.facility = $${v.length + 1}`);
      v.push(facility);
    }
    return { where: c.length ? ` AND ${c.join(" AND ")}` : "", values: v };
  };

  const { where, values } = filterSql("c");

  const queries = {
    missing_hiv_status: `SELECT c.uid AS id, c.household_id, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.calhiv IS NULL OR c.calhiv = '' OR c.calhiv = 'unknown') AND (c.is_hiv_positive IS NULL OR c.is_hiv_positive = '' OR c.is_hiv_positive = 'unknown') ${where} LIMIT $${values.length + 1}`,
    missing_age: `SELECT c.uid AS id, c.household_id, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.age IS NULL OR c.age = '' OR c.age = '0') ${where} LIMIT $${values.length + 1}`,
    missing_gender: `SELECT c.uid AS id, c.household_id, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.vca_gender IS NULL OR c.vca_gender = '') ${where} LIMIT $${values.length + 1}`,
    stale_records_90d: `SELECT c.uid AS id, c.household_id, c.date_edited, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.date_edited IS NULL OR c.date_edited::date < (NOW() - INTERVAL '90 days')::date) ${where} LIMIT $${values.length + 1}`,
    future_dated_services: `SELECT vs.vcaid AS id, vs.service_date, c.caseworker_name, c.facility, c.district FROM vca_services vs JOIN children c ON c.uid = vs.vcaid WHERE (CASE WHEN vs.service_date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(vs.service_date::text, 1, 10)::date WHEN vs.service_date::text ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' THEN TO_DATE(vs.service_date::text, 'DD-MM-YYYY') END) > CURRENT_DATE ${where} LIMIT $${values.length + 1}`,
    invalid_age: `SELECT c.uid AS id, c.age, c.caseworker_name, c.facility, c.district FROM children c WHERE c.age ~ '^[0-9]+$' AND (c.age::int < 0 OR c.age::int > 120) ${where} LIMIT $${values.length + 1}`,
    stale_viral_loads: `SELECT c.uid AS id, c.art_number, c.date_last_vl, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%') AND (c.date_last_vl IS NULL OR c.date_last_vl::date < (NOW() - INTERVAL '6 months')::date) ${where} LIMIT $${values.length + 1}`,
    missing_art_numbers: `SELECT c.uid AS id, c.household_id, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%') AND (c.art_number IS NULL OR c.art_number = '') ${where} LIMIT $${values.length + 1}`,
    missing_mmd_level: `SELECT c.uid AS id, c.art_number, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%') AND (c.level_mmd IS NULL OR c.level_mmd = '') ${where} LIMIT $${values.length + 1}`,
    unscreened_households: `SELECT c.household_id AS id, c.caregiver_name, c.caseworker_name, c.facility, c.district FROM all_households c WHERE (c.screened IS NULL OR c.screened ILIKE '%no%' OR c.screened ILIKE '%false%' OR c.screened = '') ${where} LIMIT $${values.length + 1}`,
    hiv_positive_no_facility: `SELECT c.uid AS id, c.household_id, c.caseworker_name, c.district FROM children c WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%') AND (c.facility IS NULL OR c.facility = '') ${where} LIMIT $${values.length + 1}`,
    calhiv_without_art: `SELECT c.uid AS id, c.age, c.household_id, c.caseworker_name, c.facility, c.district FROM children c WHERE (c.calhiv = '1' OR c.calhiv ILIKE 'true' OR c.calhiv ILIKE 'yes' OR c.is_hiv_positive ILIKE '%true%') AND c.age ~ '^[0-9]+$' AND c.age::int < 18 AND (c.date_started_art IS NULL OR c.date_started_art = '') ${where} LIMIT $${values.length + 1}`,
  };

  const sql = queries[check];
  if (!sql)
    return res
      .status(400)
      .json({ status: "error", message: `Unknown check: ${check}` });

  try {
    const result = await FlatPGConnection.query(sql, [...values, limit]);
    return res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    console.error(`Failed DQA records for ${check}:`, err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/duplicates
 * Returns duplicate service records grouped by entity+date+services
 * Query params: ?type=vca|caregiver|household&district=X&facility=Y
 */
/**
 * GET /etl/duplicates
 * Returns duplicate service records grouped by entity+date+services
 * Query params: ?type=vca|caregiver|household&district=X&facility=Y
 */
exports.getDuplicates = async (req, res) => {
  const type = req.query.type || "vca";
  const district = req.query.district;
  const facility = req.query.facility;

  const config = {
    vca: {
      table: "vca_services",
      entity_table: "children",
      entity_id: "uid",
      service_id: "vcaid",
      service_field: "health_services",
      entity_label: "VCA",
    },
    caregiver: {
      table: "caregiver_services",
      entity_table: "all_households",
      entity_id: "household_id",
      service_id: "household_id",
      service_field: "health_services",
      entity_label: "Caregiver",
    },
    household: {
      table: "household_services",
      entity_table: "all_households",
      entity_id: "household_id",
      service_id: "household_id",
      service_field: "health_services",
      entity_label: "Household",
    },
  };

  const cfg = config[type];
  if (!cfg)
    return res.status(400).json({ status: "error", message: "Invalid type" });

  try {
    const conditions = [];
    const values = [];
    let idx = 1;
    if (district && district !== "All Districts") {
      conditions.push(`c.district = $${idx++}`);
      values.push(district);
    }
    if (facility && facility !== "all") {
      conditions.push(`c.facility = $${idx++}`);
      values.push(facility);
    }
    const whereExtra = conditions.length
      ? ` AND ${conditions.join(" AND ")}`
      : "";

    const result = await FlatPGConnection.query(
      `WITH dupe_groups AS (
        SELECT s.${cfg.service_id} as entity_id,
               s.service_date,
               s.${cfg.service_field} as services,
               COUNT(*) as duplicate_count
        FROM ${cfg.table} s
        JOIN ${cfg.entity_table} c ON c.${cfg.entity_id} = s.${cfg.service_id}
        WHERE s.${cfg.service_id} IS NOT NULL AND s.${cfg.service_id} != ''
          AND s.service_date IS NOT NULL
          ${whereExtra}
        GROUP BY s.${cfg.service_id}, s.service_date, s.${cfg.service_field}
        HAVING COUNT(*) > 1
      )
      SELECT DISTINCT ON (d.entity_id, d.service_date, d.services)
        d.entity_id, d.service_date, d.services, d.duplicate_count,
        c.caseworker_name, c.facility, c.district, c.province,
        COALESCE(NULLIF(c.ward, ''), '') AS ward
      FROM dupe_groups d
      JOIN ${cfg.entity_table} c ON c.${cfg.entity_id} = d.entity_id
      ORDER BY d.entity_id, d.service_date, d.services, d.duplicate_count DESC
      LIMIT 500`,
      values,
    );

    result.rows.sort(
      (a, b) => parseInt(b.duplicate_count) - parseInt(a.duplicate_count),
    );

    const total_groups = result.rows.length;
    const total_dupes = result.rows.reduce(
      (sum, r) => sum + (parseInt(r.duplicate_count) - 1),
      0,
    );
    const by_district = {};
    const by_facility = {};
    const by_caseworker = {};
    result.rows.forEach((r) => {
      if (r.district)
        by_district[r.district] = (by_district[r.district] || 0) + 1;
      if (r.facility)
        by_facility[r.facility] = (by_facility[r.facility] || 0) + 1;
      if (r.caseworker_name)
        by_caseworker[r.caseworker_name] =
          (by_caseworker[r.caseworker_name] || 0) + 1;
    });

    return res.status(200).json({
      status: "success",
      data: {
        type,
        entity_label: cfg.entity_label,
        groups: result.rows,
        summary: {
          total_groups,
          total_redundant_records: total_dupes,
          by_district,
          by_facility,
          by_caseworker,
        },
      },
    });
  } catch (err) {
    console.error("Failed to get duplicates:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getFacilityList = async (req, res) => {
  const SourcePG = FlatPGConnection;
  try {
    const result = await SourcePG.query(
      `SELECT DISTINCT ward FROM children WHERE ward IS NOT NULL AND ward != '' ORDER BY ward`,
    );
    return res
      .status(200)
      .json({ status: "success", data: result.rows.map((r) => r.ward) });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ─── Service Records — paginated, filtered, server-side ─────────────────────
/**
 * GET /etl/services/:type/records
 *
 * Replaces the pattern of fetching all 96k raw rows to the browser and
 * filtering/sorting/paginating in JS. All heavy work stays in PostgreSQL.
 *
 * Query params:
 *   district    - district name or omit for all
 *   search      - free-text (entity_id, name, facility, caseworker, service)
 *   domain      - pillar name: HIV | Health | Education | Safety | Stability | Household
 *   issue       - issue key: missing_date | no_service_details | missing_caseworker |
 *                            missing_district | stale_90d
 *   dateWindow  - 30 | 90 | 365 | all
 *   page        - 1-based page number (default 1)
 *   pageSize    - rows per page (default 12, max 100)
 *   entityId    - exact entity id focus (overrides all other filters)
 *
 * Response:
 *   {
 *     status, type, page, pageSize, totalRecords, totalPages,
 *     stats: { loaded, monthly, recordsWithIssues, issueCounts },
 *     data: NormalizedServiceRecord[]
 *   }
 */
exports.getServiceRecords = async (req, res) => {
  const SourcePG = FlatPGConnection;
  const type = (req.params.type || "").toLowerCase();

  const VALID_TYPES = ["vca", "caregiver", "household"];
  if (!VALID_TYPES.includes(type)) {
    return res
      .status(400)
      .json({ status: "error", message: `Unknown service type: ${type}` });
  }

  const {
    district,
    search = "",
    domain = "all",
    issue = "",
    dateWindow = "all",
    entityId = "",
    page: pageParam = "1",
    pageSize: pageSizeParam = "12",
  } = req.query;

  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(pageSizeParam, 10) || 12),
  );
  const offset = (page - 1) * pageSize;

  // ── Per-type configuration ───────────────────────────────────────────────
  // ALL column references that touch TRIM / NULLIF / LIKE / regex must be
  // ::text-cast here so PostgreSQL never tries btrim(date) or date ~ unknown.
  //
  // entityNameExpr  — full SQL expression for the display name; kept separate
  //                   from entityNameCol so complex COALESCE chains don't get
  //                   double-wrapped by the outer COALESCE(NULLIF(...)).
  // serviceDateIsDate — true when the underlying column is a date type;
  //                   switches dateExpr() from regex-CASE to direct ::date cast.
  const CFG = {
    vca: {
      svcTable: "vca_services",
      svcAlias: "vs",
      entityTable: "children",
      entityAlias: "c",
      joinCond: "c.uid = vs.vcaid",
      entityIdCol: "vs.vcaid::text",
      entityIdRaw: "vs.vcaid",
      // children stores the VCA name split across firstname + lastname
      entityNameExpr:
        "COALESCE(NULLIF(TRIM(" +
        "COALESCE(TRIM(c.firstname::text), '') || " +
        "CASE WHEN c.lastname IS NOT NULL AND TRIM(c.lastname::text) <> '' " +
        "THEN ' ' || TRIM(c.lastname::text) " +
        "ELSE '' " +
        "END" +
        "), ''), 'N/A')",
      entityLabel: "VCA",
      districtCol: "c.district::text",
      facilityCol: "c.facility::text",
      caseworkerCol: "c.caseworker_name::text",
      statusCol: "c.case_status::text",
      serviceDateCol: "vs.service_date::text",
      serviceDateIsDate: true,
      pillars: [
        ["HIV", "vs.hiv_services", "vs.other_hiv_services"],
        ["Health", "vs.health_services", "vs.other_health_services"],
        ["Education", "vs.schooled_services", "vs.other_schooled_services"],
        ["Safety", "vs.safe_services", "vs.other_safe_services"],
        ["Stability", "vs.stable_services", "vs.other_stable_services"],
      ],
      serviceFields: [
        "vs.hiv_services",
        "vs.health_services",
        "vs.schooled_services",
        "vs.safe_services",
        "vs.stable_services",
        "vs.other_hiv_services",
        "vs.other_health_services",
        "vs.other_schooled_services",
        "vs.other_safe_services",
        "vs.other_stable_services",
      ],
    },
    caregiver: {
      svcTable: "caregiver_services",
      svcAlias: "cs",
      entityTable: "all_households",
      entityAlias: "c",
      joinCond: "c.household_id = cs.household_id",
      entityIdCol: "cs.household_id::text",
      entityIdRaw: "cs.household_id",
      entityNameExpr:
        "COALESCE(NULLIF(TRIM(c.caregiver_name::text), ''), 'N/A')",
      entityLabel: "Household",
      districtCol: "c.district::text",
      facilityCol: "c.facility::text",
      caseworkerCol: "c.caseworker_name::text",
      statusCol: "c.case_status::text",
      serviceDateCol: "cs.service_date::text",
      serviceDateIsDate: false, // caregiver_services.service_date is text
      pillars: [
        ["HIV", "cs.hiv_services", "cs.other_hiv_services"],
        ["Health", "cs.health_services", "cs.other_health_services"],
        ["Education", "cs.schooled_services", "cs.other_schooled_services"],
        ["Safety", "cs.safe_services", "cs.other_safe_services"],
        ["Stability", "cs.stable_services", "cs.other_stable_services"],
      ],
      serviceFields: [
        "cs.hiv_services",
        "cs.health_services",
        "cs.schooled_services",
        "cs.safe_services",
        "cs.stable_services",
        "cs.other_hiv_services",
        "cs.other_health_services",
        "cs.other_schooled_services",
        "cs.other_safe_services",
        "cs.other_stable_services",
      ],
    },
    household: {
      svcTable: "household_services",
      svcAlias: "hs",
      entityTable: "all_households",
      entityAlias: "c",
      joinCond: "c.household_id = hs.household_id",
      entityIdCol: "hs.household_id::text",
      entityIdRaw: "hs.household_id",
      entityNameExpr:
        "COALESCE(NULLIF(TRIM(c.caregiver_name::text), ''), 'N/A')",
      entityLabel: "Household",
      districtCol: "c.district::text",
      facilityCol: "c.facility::text",
      caseworkerCol: "c.caseworker_name::text",
      statusCol: "c.case_status::text",
      serviceDateCol: "hs.service_date::text",
      serviceDateIsDate: true, // household_services.service_date is a date column
      pillars: [
        ["Health", "hs.health_services", "hs.other_health_services"],
        ["Household", "hs.hh_level_services", "hs.other_hh_level_services"],
        ["Education", "hs.schooled_services", "hs.other_schooled_services"],
        ["Safety", "hs.safe_services", "hs.other_safe_services"],
        ["Stability", "hs.stable_services", "hs.other_stable_services"],
      ],
      serviceFields: [
        "hs.health_services",
        "hs.hh_level_services",
        "hs.schooled_services",
        "hs.safe_services",
        "hs.stable_services",
        "hs.other_health_services",
        "hs.other_hh_level_services",
        "hs.other_schooled_services",
        "hs.other_safe_services",
        "hs.other_stable_services",
      ],
    },
  };

  const cfg = CFG[type];

  // ── Helpers ──────────────────────────────────────────────────────────────

  const safeText = (col) => `COALESCE(TRIM(${col}), '')`;

  // Convert service_date to a SQL date value.
  // When the column is already a date type we just cast it directly —
  // the ::text intermediary in serviceDateCol is used only for text ops
  // (TRIM, NULLIF, search LIKE). For date arithmetic we go back to the
  // raw column and cast to ::date directly.
  const dateExpr = (col, isDateType) => {
    if (isDateType) {
      // Strip the ::text suffix we added for text operations and cast to date
      const base = col.replace(/::text$/i, "");
      return `${base}::date`;
    }
    // Text column — use regex CASE to handle both YYYY-MM-DD and DD-MM-YYYY
    return (
      `(CASE ` +
      `WHEN ${col} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' ` +
      `THEN substring(${col}, 1, 10)::date ` +
      `WHEN ${col} ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' ` +
      `THEN TO_DATE(${col}, 'DD-MM-YYYY') ` +
      `END)`
    );
  };

  const svcDate = dateExpr(cfg.serviceDateCol, cfg.serviceDateIsDate);

  // Pillar "has services" — checks text after stripping JSON array noise.
  // Always cast pillar columns to ::text before calling trim().
  const pillarHasExpr = (mainCol, otherCol) => {
    const mainText = `${mainCol}::text`;
    const main =
      `(${mainText} IS NOT NULL ` +
      `AND length(trim(${mainText})) > 2 ` +
      `AND trim(${mainText}) NOT IN ` +
      `('[]','["not applicable"]','["other"]','["none"]','""',''))`;
    const other = otherCol
      ? ` OR (${otherCol}::text IS NOT NULL ` +
        `AND length(trim(${otherCol}::text)) > 0)`
      : "";
    return `(${main}${other})`;
  };

  // All service fields concatenated for full-text search
  const allServiceConcat = cfg.serviceFields
    .map((f) => `COALESCE(${f}::text, '')`)
    .join(" || ' ' || ");

  // ── Build WHERE conditions ───────────────────────────────────────────────
  const conditions = [];
  const vals = [];
  const push = (val) => {
    vals.push(val);
    return `$${vals.length}`;
  };

  // Always require a non-null, non-empty entity id
  conditions.push(`${cfg.entityIdCol} IS NOT NULL`);
  conditions.push(`TRIM(${cfg.entityIdCol}) <> ''`);

  if (entityId && entityId.trim()) {
    // Exact entity focus
    conditions.push(
      `LOWER(TRIM(${cfg.entityIdCol})) = LOWER(TRIM(${push(entityId.trim())}))`,
    );
  } else {
    // District
    if (district && district !== "All" && district !== "all") {
      conditions.push(`${cfg.districtCol} = ${push(district)}`);
    }

    // Domain / pillar
    if (domain && domain !== "all") {
      const pillarCfg = cfg.pillars.find(
        ([label]) => label.toLowerCase() === domain.toLowerCase(),
      );
      if (pillarCfg) {
        conditions.push(pillarHasExpr(pillarCfg[1], pillarCfg[2]));
      }
    }

    // Date window
    if (dateWindow && dateWindow !== "all") {
      const days = parseInt(dateWindow, 10);
      if (!isNaN(days) && days > 0) {
        conditions.push(
          `${svcDate} >= (CURRENT_DATE - INTERVAL '${days} days')`,
        );
      }
    }

    // Issue filter
    if (issue) {
      switch (issue) {
        case "missing_date":
          conditions.push(
            `(${cfg.serviceDateCol} IS NULL ` +
              `OR TRIM(${cfg.serviceDateCol}) = '' ` +
              `OR TRIM(${cfg.serviceDateCol}) = 'N/A')`,
          );
          break;
        case "no_service_details":
          conditions.push(
            cfg.pillars
              .map(([, main, other]) => `NOT ${pillarHasExpr(main, other)}`)
              .join(" AND "),
          );
          break;
        case "missing_caseworker":
          conditions.push(
            `(${cfg.caseworkerCol} IS NULL ` +
              `OR TRIM(${cfg.caseworkerCol}) = '')`,
          );
          break;
        case "missing_district":
          conditions.push(
            `(${cfg.districtCol} IS NULL ` +
              `OR TRIM(${cfg.districtCol}) = '')`,
          );
          break;
        case "stale_90d":
          conditions.push(
            `${svcDate} IS NOT NULL ` +
              `AND ${svcDate} < (CURRENT_DATE - INTERVAL '90 days')`,
          );
          break;
        default:
          break;
      }
    }

    // Free-text search
    if (search && search.trim()) {
      const term = push(`%${search.trim().toLowerCase()}%`);
      conditions.push(
        `(` +
          `LOWER(${cfg.entityIdCol}) LIKE ${term}` +
          ` OR LOWER(${safeText(cfg.entityNameExpr)}) LIKE ${term}` +
          ` OR LOWER(${safeText(cfg.districtCol)}) LIKE ${term}` +
          ` OR LOWER(${safeText(cfg.facilityCol)}) LIKE ${term}` +
          ` OR LOWER(${safeText(cfg.caseworkerCol)}) LIKE ${term}` +
          ` OR LOWER(${allServiceConcat}) LIKE ${term}` +
          `)`,
      );
    }
  }

  const WHERE = `WHERE ${conditions.join(" AND ")}`;

  // ── Pillar CASE expressions for SELECT ───────────────────────────────────
  const pillarCaseExpr = cfg.pillars
    .map(
      ([label, main]) =>
        `CASE WHEN ${pillarHasExpr(main, null)} THEN '${label}' END`,
    )
    .join(",\n        ");

  // ── Per-row issue flag expressions ───────────────────────────────────────
  const noServiceDetailsParts = cfg.pillars
    .map(([, main, other]) => `NOT ${pillarHasExpr(main, other)}`)
    .join(" AND ");

  const flagMissingDate =
    `CASE WHEN (${cfg.serviceDateCol} IS NULL ` +
    `OR TRIM(${cfg.serviceDateCol}) = '' ` +
    `OR TRIM(${cfg.serviceDateCol}) = 'N/A') ` +
    `THEN 1 ELSE 0 END`;

  const flagNoServiceDetails = `CASE WHEN (${noServiceDetailsParts}) THEN 1 ELSE 0 END`;

  const flagMissingCaseworker =
    `CASE WHEN (${cfg.caseworkerCol} IS NULL ` +
    `OR TRIM(${cfg.caseworkerCol}) = '') ` +
    `THEN 1 ELSE 0 END`;

  const flagMissingDistrict =
    `CASE WHEN (${cfg.districtCol} IS NULL ` +
    `OR TRIM(${cfg.districtCol}) = '') ` +
    `THEN 1 ELSE 0 END`;

  const flagStale90d =
    `CASE WHEN ${svcDate} IS NOT NULL ` +
    `AND ${svcDate} < (CURRENT_DATE - INTERVAL '90 days') ` +
    `THEN 1 ELSE 0 END`;

  // ── Cleaned service names expression (IMPROVED) ─────────────────────────
  const svcNamesExpr = cfg.serviceFields
    .map(
      (f) =>
        `regexp_replace(regexp_replace(COALESCE(${f}::text,''),'[\\[\\]"{}]','','g'),',{2,}',',','g')`,
    )
    .join(" || ',' || ");

  // ── Main query ───────────────────────────────────────────────────────────
  // Built as a plain string (not a template literal with embedded template
  // literals) to avoid any "syntax error at or near 'with'" issues that arise
  // when JS template literal nesting produces unexpected whitespace or quotes.
  const mainQuery = [
    "WITH base AS (",
    "  SELECT",
    `    ${cfg.entityIdCol}                          AS entity_id,`,
    `    ${cfg.entityNameExpr}                       AS entity_name,`,
    `    COALESCE(NULLIF(TRIM(${cfg.districtCol}),   ''), 'N/A') AS district,`,
    `    COALESCE(NULLIF(TRIM(${cfg.facilityCol}),   ''), 'N/A') AS facility,`,
    `    COALESCE(NULLIF(TRIM(${cfg.caseworkerCol}), ''), 'N/A') AS caseworker,`,
    `    COALESCE(NULLIF(TRIM(${cfg.serviceDateCol}),''), 'N/A') AS service_date,`,
    `    ${svcDate}                                  AS service_date_parsed,`,
    `    COALESCE(NULLIF(TRIM(${cfg.statusCol}),     ''), 'Synced') AS status,`,
    `    ARRAY_REMOVE(ARRAY[`,
    `      ${pillarCaseExpr}`,
    `    ], NULL)                                    AS pillars,`,
    `    ${svcNamesExpr}                             AS service_names_raw,`,
    `    ${flagMissingDate}                          AS flag_missing_date,`,
    `    ${flagNoServiceDetails}                     AS flag_no_service_details,`,
    `    ${flagMissingCaseworker}                    AS flag_missing_caseworker,`,
    `    ${flagMissingDistrict}                      AS flag_missing_district,`,
    `    ${flagStale90d}                             AS flag_stale_90d`,
    `  FROM ${cfg.svcTable} ${cfg.svcAlias}`,
    `  JOIN ${cfg.entityTable} ${cfg.entityAlias} ON ${cfg.joinCond}`,
    `  ${WHERE}`,
    "),",

    "stats AS (",
    "  SELECT",
    "    COUNT(*)                                                         AS total_records,",
    "    COUNT(*) FILTER (",
    "      WHERE service_date_parsed >= date_trunc('month', CURRENT_DATE)",
    "    )                                                                AS monthly_records,",
    "    COUNT(*) FILTER (",
    "      WHERE flag_missing_date      = 1",
    "         OR flag_no_service_details = 1",
    "         OR flag_missing_caseworker = 1",
    "         OR flag_missing_district   = 1",
    "         OR flag_stale_90d          = 1",
    "    )                                                                AS records_with_issues,",
    "    SUM(flag_missing_date)        AS cnt_missing_date,",
    "    SUM(flag_no_service_details)  AS cnt_no_service_details,",
    "    SUM(flag_missing_caseworker)  AS cnt_missing_caseworker,",
    "    SUM(flag_missing_district)    AS cnt_missing_district,",
    "    SUM(flag_stale_90d)           AS cnt_stale_90d",
    "  FROM base",
    "),",

    "paged AS (",
    "  SELECT * FROM base",
    "  ORDER BY service_date_parsed DESC NULLS LAST, entity_id",
    `  LIMIT ${pageSize} OFFSET ${offset}`,
    ")",

    // Stats sentinel row
    "SELECT",
    "  'stats'::text   AS _row_type,",
    "  NULL::text      AS entity_id,",
    "  NULL::text      AS entity_name,",
    "  NULL::text      AS district,",
    "  NULL::text      AS facility,",
    "  NULL::text      AS caseworker,",
    "  NULL::text      AS service_date,",
    "  NULL::date      AS service_date_parsed,",
    "  NULL::text      AS status,",
    "  NULL::text[]    AS pillars,",
    "  NULL::text      AS service_names_raw,",
    "  0::int          AS flag_missing_date,",
    "  0::int          AS flag_no_service_details,",
    "  0::int          AS flag_missing_caseworker,",
    "  0::int          AS flag_missing_district,",
    "  0::int          AS flag_stale_90d,",
    "  total_records::bigint          AS _total,",
    "  monthly_records::bigint        AS _monthly,",
    "  records_with_issues::bigint    AS _with_issues,",
    "  cnt_missing_date::bigint       AS _cnt_missing_date,",
    "  cnt_no_service_details::bigint AS _cnt_no_service_details,",
    "  cnt_missing_caseworker::bigint AS _cnt_missing_caseworker,",
    "  cnt_missing_district::bigint   AS _cnt_missing_district,",
    "  cnt_stale_90d::bigint          AS _cnt_stale_90d",
    "FROM stats",

    "UNION ALL",

    // Data rows
    "SELECT",
    "  'data'::text    AS _row_type,",
    "  entity_id,",
    "  entity_name,",
    "  district,",
    "  facility,",
    "  caseworker,",
    "  service_date,",
    "  service_date_parsed,",
    "  status,",
    "  pillars,",
    "  service_names_raw,",
    "  flag_missing_date,",
    "  flag_no_service_details,",
    "  flag_missing_caseworker,",
    "  flag_missing_district,",
    "  flag_stale_90d,",
    "  NULL::bigint    AS _total,",
    "  NULL::bigint    AS _monthly,",
    "  NULL::bigint    AS _with_issues,",
    "  NULL::bigint    AS _cnt_missing_date,",
    "  NULL::bigint    AS _cnt_no_service_details,",
    "  NULL::bigint    AS _cnt_missing_caseworker,",
    "  NULL::bigint    AS _cnt_missing_district,",
    "  NULL::bigint    AS _cnt_stale_90d",
    "FROM paged",
  ].join("\n");

  // ── Execute ──────────────────────────────────────────────────────────────
  try {
    const result = await SourcePG.query(mainQuery, vals);

    const statsRow = result.rows.find((r) => r._row_type === "stats");
    const dataRows = result.rows.filter((r) => r._row_type === "data");

    const totalRecords = Number(statsRow?._total || 0);
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

    const ISSUE_LABEL = {
      missing_date: "Missing date",
      no_service_details: "No service details",
      missing_caseworker: "Missing caseworker",
      missing_district: "Missing district",
      stale_90d: "Older than 90d",
    };

    const data = dataRows.map((row, idx) => {
      const issueKeys_row = [];
      const issues_row = [];

      if (row.flag_missing_date) {
        issueKeys_row.push("missing_date");
        issues_row.push(ISSUE_LABEL.missing_date);
      }
      if (row.flag_no_service_details) {
        issueKeys_row.push("no_service_details");
        issues_row.push(ISSUE_LABEL.no_service_details);
      }
      if (row.flag_missing_caseworker) {
        issueKeys_row.push("missing_caseworker");
        issues_row.push(ISSUE_LABEL.missing_caseworker);
      }
      if (row.flag_missing_district) {
        issueKeys_row.push("missing_district");
        issues_row.push(ISSUE_LABEL.missing_district);
      }
      if (row.flag_stale_90d) {
        issueKeys_row.push("stale_90d");
        issues_row.push(ISSUE_LABEL.stale_90d);
      }

      // Parse service names from concatenated text
      const rawServices = (row.service_names_raw || "")
        .split(",")
        .map((s) => s.trim())
        .filter(
          (s) =>
            s.length > 1 &&
            !["not applicable", "other", "none", "[]", ""].includes(
              s.toLowerCase(),
            ),
        );
      const serviceNames = [...new Set(rawServices)];

      // Pillars arrive as a JS array from the pg driver
      const pillars = Array.isArray(row.pillars)
        ? row.pillars.filter(Boolean)
        : [];

      const servicesByPillar = {};
      pillars.forEach((pillar) => {
        servicesByPillar[pillar] = serviceNames;
      });

      // Days since service date
      let ageDays = null;
      if (row.service_date_parsed) {
        const d = new Date(row.service_date_parsed);
        if (!isNaN(d.getTime())) {
          ageDays = Math.max(
            0,
            Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)),
          );
        }
      }

      const entityId = row.entity_id || "N/A";
      const serviceDate = row.service_date || "N/A";

      let statusLabel = row.status || "Synced";
      if (serviceDate === "N/A" && statusLabel === "Synced") {
        statusLabel = "Missing date";
      }

      return {
        id: `${type}-${entityId}-${serviceDate}-${offset + idx}`,
        type,
        entityId,
        entityLabel: cfg.entityLabel,
        name: row.entity_name || "N/A",
        district: row.district || "N/A",
        facility: row.facility || "N/A",
        caseworker: row.caseworker || "N/A",
        serviceDate,
        serviceNames,
        pillars,
        servicesByPillar,
        status: statusLabel,
        issues: issues_row,
        issueKeys: issueKeys_row,
        ageDays,
        // Lightweight raw — full payload fetched on demand via record-detail
        raw: {
          entity_id: entityId,
          district: row.district,
          facility: row.facility,
          caseworker_name: row.caseworker,
          service_date: serviceDate,
        },
      };
    });

    const issueCounts = {
      missing_date: Number(statsRow?._cnt_missing_date || 0),
      no_service_details: Number(statsRow?._cnt_no_service_details || 0),
      missing_caseworker: Number(statsRow?._cnt_missing_caseworker || 0),
      missing_district: Number(statsRow?._cnt_missing_district || 0),
      stale_90d: Number(statsRow?._cnt_stale_90d || 0),
    };

    return res.status(200).json({
      status: "success",
      type,
      page,
      pageSize,
      totalRecords,
      totalPages,
      stats: {
        loaded: totalRecords,
        monthly: Number(statsRow?._monthly || 0),
        recordsWithIssues: Number(statsRow?._with_issues || 0),
        issueCounts,
      },
      data,
    });
  } catch (err) {
    console.error("Failed to get service records:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/services/:type/record-detail
 * Returns the full raw row for a single entity so the detail Sheet can show
 * the complete source payload without loading all 96k records.
 *
 * Query params: entityId (required), district (optional)
 */
exports.getServiceRecordDetail = async (req, res) => {
  const SourcePG = FlatPGConnection;
  const type = (req.params.type || "").toLowerCase();
  const { entityId, district } = req.query;

  if (!entityId) {
    return res
      .status(400)
      .json({ status: "error", message: "entityId is required" });
  }

  const TABLE_MAP = {
    vca: {
      svcTable: "vca_services",
      entityTable: "children",
      svcIdCol: "vcaid",
      entityIdCol: "uid",
      joinCond: "c.uid = s.vcaid",
      districtCol: "c.district",
    },
    caregiver: {
      svcTable: "caregiver_services",
      entityTable: "all_households",
      svcIdCol: "household_id",
      entityIdCol: "household_id",
      joinCond: "c.household_id = s.household_id",
      districtCol: "c.district",
    },
    household: {
      svcTable: "household_services",
      entityTable: "all_households",
      svcIdCol: "household_id",
      entityIdCol: "household_id",
      joinCond: "c.household_id = s.household_id",
      districtCol: "c.district",
    },
  };

  const tm = TABLE_MAP[type];
  if (!tm) {
    return res
      .status(400)
      .json({ status: "error", message: `Unknown type: ${type}` });
  }

  try {
    const vals = [entityId];
    let districtCond = "";
    if (district && district !== "All" && district !== "all") {
      vals.push(district);
      districtCond = `AND ${tm.districtCol}::text = $${vals.length}`;
    }

    const result = await SourcePG.query(
      `SELECT s.*, c.*
       FROM   ${tm.svcTable}    s
       JOIN   ${tm.entityTable} c ON ${tm.joinCond}
       WHERE  LOWER(TRIM(s.${tm.svcIdCol}::text)) = LOWER(TRIM($1::text))
         ${districtCond}
       ORDER  BY s.service_date DESC NULLS LAST
       LIMIT  1`,
      vals,
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "Record not found" });
    }

    return res.status(200).json({ status: "success", data: result.rows[0] });
  } catch (err) {
    console.error("Failed to get record detail:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

/**
 * GET /etl/services/:type/export
 *
 * Streams a CSV of all records matching the current filters directly to the
 * client. Identical filter logic to getServiceRecords but:
 *   - No pagination (returns every matching row)
 *   - Streams the response row-by-row so memory stays flat on both server
 *     and client regardless of result size
 *   - Sets Content-Disposition so the browser triggers a file download
 *
 * Query params: same as getServiceRecords (district, search, domain, issue,
 *               dateWindow, entityId) — page/pageSize are ignored.
 */
exports.exportServiceRecords = async (req, res) => {
  const SourcePG = FlatPGConnection;
  const type = (req.params.type || "").toLowerCase();

  const VALID_TYPES = ["vca", "caregiver", "household"];
  if (!VALID_TYPES.includes(type)) {
    return res
      .status(400)
      .json({ status: "error", message: `Unknown service type: ${type}` });
  }

  const {
    district,
    search = "",
    domain = "all",
    issue = "",
    dateWindow = "all",
    entityId = "",
  } = req.query;

  // ── Same CFG as getServiceRecords ────────────────────────────────────────
  const CFG = {
    vca: {
      svcTable: "vca_services",
      svcAlias: "vs",
      entityTable: "children",
      entityAlias: "c",
      joinCond: "c.uid = vs.vcaid",
      entityIdCol: "vs.vcaid::text",
      entityNameExpr:
        "COALESCE(NULLIF(TRIM(" +
        "COALESCE(TRIM(c.firstname::text), '') || " +
        "CASE WHEN c.lastname IS NOT NULL AND TRIM(c.lastname::text) <> '' " +
        "THEN ' ' || TRIM(c.lastname::text) " +
        "ELSE '' " +
        "END" +
        "), ''), 'N/A')",
      entityLabel: "VCA",
      districtCol: "c.district::text",
      facilityCol: "c.facility::text",
      caseworkerCol: "c.caseworker_name::text",
      statusCol: "c.case_status::text",
      serviceDateCol: "vs.service_date::text",
      serviceDateIsDate: true,
      pillars: [
        ["HIV", "vs.hiv_services", "vs.other_hiv_services"],
        ["Health", "vs.health_services", "vs.other_health_services"],
        ["Education", "vs.schooled_services", "vs.other_schooled_services"],
        ["Safety", "vs.safe_services", "vs.other_safe_services"],
        ["Stability", "vs.stable_services", "vs.other_stable_services"],
      ],
      serviceFields: [
        "vs.hiv_services",
        "vs.health_services",
        "vs.schooled_services",
        "vs.safe_services",
        "vs.stable_services",
        "vs.other_hiv_services",
        "vs.other_health_services",
        "vs.other_schooled_services",
        "vs.other_safe_services",
        "vs.other_stable_services",
      ],
    },
    caregiver: {
      svcTable: "caregiver_services",
      svcAlias: "cs",
      entityTable: "all_households",
      entityAlias: "c",
      joinCond: "c.household_id = cs.household_id",
      entityIdCol: "cs.household_id::text",
      entityNameExpr:
        "COALESCE(NULLIF(TRIM(c.caregiver_name::text), ''), 'N/A')",
      entityLabel: "Household",
      districtCol: "c.district::text",
      facilityCol: "c.facility::text",
      caseworkerCol: "c.caseworker_name::text",
      statusCol: "c.case_status::text",
      serviceDateCol: "cs.service_date::text",
      serviceDateIsDate: false,
      pillars: [
        ["HIV", "cs.hiv_services", "cs.other_hiv_services"],
        ["Health", "cs.health_services", "cs.other_health_services"],
        ["Education", "cs.schooled_services", "cs.other_schooled_services"],
        ["Safety", "cs.safe_services", "cs.other_safe_services"],
        ["Stability", "cs.stable_services", "cs.other_stable_services"],
      ],
      serviceFields: [
        "cs.hiv_services",
        "cs.health_services",
        "cs.schooled_services",
        "cs.safe_services",
        "cs.stable_services",
        "cs.other_hiv_services",
        "cs.other_health_services",
        "cs.other_schooled_services",
        "cs.other_safe_services",
        "cs.other_stable_services",
      ],
    },
    household: {
      svcTable: "household_services",
      svcAlias: "hs",
      entityTable: "all_households",
      entityAlias: "c",
      joinCond: "c.household_id = hs.household_id",
      entityIdCol: "hs.household_id::text",
      entityNameExpr:
        "COALESCE(NULLIF(TRIM(c.caregiver_name::text), ''), 'N/A')",
      entityLabel: "Household",
      districtCol: "c.district::text",
      facilityCol: "c.facility::text",
      caseworkerCol: "c.caseworker_name::text",
      statusCol: "c.case_status::text",
      serviceDateCol: "hs.service_date::text",
      serviceDateIsDate: true,
      pillars: [
        ["Health", "hs.health_services", "hs.other_health_services"],
        ["Household", "hs.hh_level_services", "hs.other_hh_level_services"],
        ["Education", "hs.schooled_services", "hs.other_schooled_services"],
        ["Safety", "hs.safe_services", "hs.other_safe_services"],
        ["Stability", "hs.stable_services", "hs.other_stable_services"],
      ],
      serviceFields: [
        "hs.health_services",
        "hs.hh_level_services",
        "hs.schooled_services",
        "hs.safe_services",
        "hs.stable_services",
        "hs.other_health_services",
        "hs.other_hh_level_services",
        "hs.other_schooled_services",
        "hs.other_safe_services",
        "hs.other_stable_services",
      ],
    },
  };

  const cfg = CFG[type];

  // ── Shared helpers (identical to getServiceRecords) ──────────────────────
  const pillarHasExpr = (mainCol, otherCol) => {
    const mainText = `${mainCol}::text`;
    const main =
      `(${mainText} IS NOT NULL ` +
      `AND length(trim(${mainText})) > 2 ` +
      `AND trim(${mainText}) NOT IN ` +
      `('[]','["not applicable"]','["other"]','["none"]','""',''))`;
    const other = otherCol
      ? ` OR (${otherCol}::text IS NOT NULL AND length(trim(${otherCol}::text)) > 0)`
      : "";
    return `(${main}${other})`;
  };

  const dateExpr = (col, isDateType) => {
    if (isDateType) {
      const base = col.replace(/::text$/i, "");
      return `${base}::date`;
    }
    return (
      `(CASE ` +
      `WHEN ${col} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' ` +
      `THEN substring(${col}, 1, 10)::date ` +
      `WHEN ${col} ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}' ` +
      `THEN TO_DATE(${col}, 'DD-MM-YYYY') ` +
      `END)`
    );
  };

  const svcDate = dateExpr(cfg.serviceDateCol, cfg.serviceDateIsDate);

  const allServiceConcat = cfg.serviceFields
    .map((f) => `COALESCE(${f}::text, '')`)
    .join(" || ' ' || ");

  // ── Build WHERE (same logic as getServiceRecords) ────────────────────────
  const conditions = [];
  const vals = [];
  const push = (val) => {
    vals.push(val);
    return `$${vals.length}`;
  };

  conditions.push(`${cfg.entityIdCol} IS NOT NULL`);
  conditions.push(`TRIM(${cfg.entityIdCol}) <> ''`);

  if (entityId && entityId.trim()) {
    conditions.push(
      `LOWER(TRIM(${cfg.entityIdCol})) = LOWER(TRIM(${push(entityId.trim())}))`,
    );
  } else {
    if (district && district !== "All" && district !== "all") {
      conditions.push(`${cfg.districtCol} = ${push(district)}`);
    }

    if (domain && domain !== "all") {
      const pillarCfg = cfg.pillars.find(
        ([label]) => label.toLowerCase() === domain.toLowerCase(),
      );
      if (pillarCfg) {
        conditions.push(pillarHasExpr(pillarCfg[1], pillarCfg[2]));
      }
    }

    if (dateWindow && dateWindow !== "all") {
      const days = parseInt(dateWindow, 10);
      if (!isNaN(days) && days > 0) {
        conditions.push(
          `${svcDate} >= (CURRENT_DATE - INTERVAL '${days} days')`,
        );
      }
    }

    if (issue) {
      switch (issue) {
        case "missing_date":
          conditions.push(
            `(${cfg.serviceDateCol} IS NULL ` +
              `OR TRIM(${cfg.serviceDateCol}) = '' ` +
              `OR TRIM(${cfg.serviceDateCol}) = 'N/A')`,
          );
          break;
        case "no_service_details":
          conditions.push(
            cfg.pillars
              .map(([, main, other]) => `NOT ${pillarHasExpr(main, other)}`)
              .join(" AND "),
          );
          break;
        case "missing_caseworker":
          conditions.push(
            `(${cfg.caseworkerCol} IS NULL OR TRIM(${cfg.caseworkerCol}) = '')`,
          );
          break;
        case "missing_district":
          conditions.push(
            `(${cfg.districtCol} IS NULL OR TRIM(${cfg.districtCol}) = '')`,
          );
          break;
        case "stale_90d":
          conditions.push(
            `${svcDate} IS NOT NULL AND ${svcDate} < (CURRENT_DATE - INTERVAL '90 days')`,
          );
          break;
        default:
          break;
      }
    }

    if (search && search.trim()) {
      const term = push(`%${search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(${cfg.entityIdCol}) LIKE ${term}` +
          ` OR LOWER(COALESCE(TRIM(${cfg.entityNameExpr}), '')) LIKE ${term}` +
          ` OR LOWER(COALESCE(TRIM(${cfg.districtCol}), '')) LIKE ${term}` +
          ` OR LOWER(COALESCE(TRIM(${cfg.facilityCol}), '')) LIKE ${term}` +
          ` OR LOWER(COALESCE(TRIM(${cfg.caseworkerCol}), '')) LIKE ${term}` +
          ` OR LOWER(${allServiceConcat}) LIKE ${term})`,
      );
    }
  }

  const WHERE = `WHERE ${conditions.join(" AND ")}`;

  // ── Pillar presence expression (for the Domains column) ──────────────────
  const pillarCaseExpr = cfg.pillars
    .map(
      ([label, main]) =>
        `CASE WHEN ${pillarHasExpr(main, null)} THEN '${label}' END`,
    )
    .join(",\n    ");

  // ── Issue flag expressions ───────────────────────────────────────────────
  const noServiceDetailsParts = cfg.pillars
    .map(([, main, other]) => `NOT ${pillarHasExpr(main, other)}`)
    .join(" AND ");

  // ── Build the export SELECT query ────────────────────────────────────────
  // Returns one row per service record, all columns needed for CSV.
  // Ordered by service_date DESC then entity_id for a consistent file.

  // ── Cleaned service names expression (IMPROVED) ─────────────────────────
  const svcNamesExpr = cfg.serviceFields
    .map(
      (f) =>
        `regexp_replace(regexp_replace(COALESCE(${f}::text,''),'[\\[\\]"{}]','','g'),',{2,}',',','g')`,
    )
    .join(" || ',' || ");

  // ── Build the export SELECT query (REORDERED COLUMNS) ───────────────────
  const exportQuery = [
    "SELECT",
    `  ${cfg.entityIdCol}        AS entity_id,`,
    `  ${cfg.entityNameExpr}     AS entity_name,`,
    `  COALESCE(NULLIF(TRIM(${cfg.districtCol}),   ''), 'N/A') AS district,`,
    `  COALESCE(NULLIF(TRIM(${cfg.facilityCol}),   ''), 'N/A') AS facility,`,
    `  COALESCE(NULLIF(TRIM(${cfg.caseworkerCol}), ''), 'N/A') AS caseworker,`,
    `  COALESCE(NULLIF(TRIM(${cfg.serviceDateCol}),''), 'N/A') AS service_date,`,
    `  ARRAY_TO_STRING(ARRAY_REMOVE(ARRAY[${pillarCaseExpr}], NULL), '; ') AS domains,`,
    // Improved Services column
    `  (SELECT string_agg(DISTINCT trim(svc), '; ') ` +
      `     FROM unnest(string_to_array(${svcNamesExpr}, ',')) AS svc ` +
      `    WHERE trim(svc) <> '' ` +
      `      AND lower(trim(svc)) NOT IN ('not applicable','other','none','[]')) AS services,`,
    `  COALESCE(NULLIF(TRIM(${cfg.statusCol}),     ''), 'Synced') AS status,`,
    `  TRIM(BOTH ', ' FROM CONCAT_WS(', ',`,
    `    CASE WHEN (${cfg.serviceDateCol} IS NULL OR TRIM(${cfg.serviceDateCol}) = '' OR TRIM(${cfg.serviceDateCol}) = 'N/A') THEN 'Missing date' END,`,
    `    CASE WHEN (${noServiceDetailsParts}) THEN 'No service details' END,`,
    `    CASE WHEN (${cfg.caseworkerCol} IS NULL OR TRIM(${cfg.caseworkerCol}) = '') THEN 'Missing caseworker' END,`,
    `    CASE WHEN (${cfg.districtCol} IS NULL OR TRIM(${cfg.districtCol}) = '') THEN 'Missing district' END,`,
    `    CASE WHEN ${svcDate} IS NOT NULL AND ${svcDate} < (CURRENT_DATE - INTERVAL '90 days') THEN 'Older than 90d' END`,
    `  )) AS issues`,
    `FROM ${cfg.svcTable} ${cfg.svcAlias}`,
    `JOIN ${cfg.entityTable} ${cfg.entityAlias} ON ${cfg.joinCond}`,
    WHERE,
    `ORDER BY ${svcDate} DESC NULLS LAST, ${cfg.entityIdCol}`,
  ].join("\n");

  // ── Streaming Setup ──────────────────────────────────────────────────────
  const Cursor = require("pg-cursor");
  const filename = `${type}-services-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  const csvCell = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRow = (cells) => cells.map(csvCell).join(",") + "\r\n";

  const headers = [
    "Type",
    "Entity ID",
    "Name",
    "District",
    "Facility",
    "Caseworker",
    "Service Date",
    "Domains",
    "Services",
    "Status",
    "Issues",
  ];

  const typeLabel = {
    vca: "VCA",
    caregiver: "Caregiver",
    household: "Household",
  }[type];

  const client = await SourcePG.connect();

  let keepaliveInterval = null;
  let firstRowSent = false;

  const startKeepalive = () => {
    keepaliveInterval = setInterval(() => {
      if (!firstRowSent && !res.writableEnded) {
        res.write("# preparing data...\r\n");
      } else {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }
    }, 5000);
  };

  try {
    res.write(csvRow(headers));
    startKeepalive();

    const cursor = client.query(new Cursor(exportQuery, vals));
    const BATCH = 1000;

    const readBatch = () =>
      new Promise((resolve, reject) => {
        cursor.read(BATCH, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });

    while (true) {
      const rows = await readBatch();
      if (rows.length === 0) break;

      if (!firstRowSent) {
        firstRowSent = true;
        if (keepaliveInterval) {
          clearInterval(keepaliveInterval);
          keepaliveInterval = null;
        }
      }

      for (const row of rows) {
        res.write(
          csvRow([
            typeLabel,
            row.entity_id || "",
            row.entity_name || "",
            row.district || "",
            row.facility || "",
            row.caseworker || "",
            row.service_date || "",
            row.domains || "",
            row.services || "", // ← now cleaned
            row.status || "",
            row.issues || "",
          ]),
        );
      }

      if (res.writableEnded) break;
    }

    await new Promise((resolve, reject) => {
      cursor.close((err) => (err ? reject(err) : resolve()));
    });

    res.end();
  } catch (err) {
    console.error("Export stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ status: "error", message: err.message });
    } else {
      res.end();
    }
  } finally {
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    client.release();
  }
};

// GET /etl/pmtct-child-register/:district - PMTCT child register rows for a district.
// Filters case-insensitively by district and orders by the most recent DBS/test
// date, then by CA/PMTCT id so the register reads chronologically.
exports.getPmtctChildRegisterByDistrict = async (req, res) => {
  const district = req.params.district;
  try {
    const result = await FlatPGConnection.query(
      `SELECT *
       FROM pmtct_child_register
       WHERE LOWER(TRIM(district)) = LOWER(TRIM($1))
       ORDER BY COALESCE(NULLIF(dbs_at_birth_actual_date, ''), NULLIF(dbs_at_birth_due_date, ''), NULLIF(date_tested, '')) DESC NULLS LAST,
                COALESCE(NULLIF(ca_id, ''), NULLIF(pmtct_id, '')) ASC`,
      [district],
    );
    return res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Failed to get PMTCT child register:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

// GET /etl/pmtct-mother-register/:district - PMTCT mother register rows for a district.
// Filters case-insensitively by district and orders by enrollment/first-visit/test
// date, then by ECAP/PMTCT id.
exports.getPmtctMotherRegisterByDistrict = async (req, res) => {
  const district = req.params.district;
  try {
    const result = await FlatPGConnection.query(
      `SELECT *
       FROM pmtct_mother_register
       WHERE LOWER(TRIM(district)) = LOWER(TRIM($1))
       ORDER BY COALESCE(NULLIF(date_enrolled_pmtct, ''), NULLIF(date_1st_visit, ''), NULLIF(date_tested, '')) DESC NULLS LAST,
                COALESCE(NULLIF(ecap_id, ''), NULLIF(pmtct_id, '')) ASC`,
      [district],
    );
    return res.status(200).json({ status: "success", data: result.rows });
  } catch (err) {
    console.error("Failed to get PMTCT mother register:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};
