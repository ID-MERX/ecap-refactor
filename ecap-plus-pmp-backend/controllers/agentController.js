// Local agent / chat proxy → Ollama (Llama 3.2 3B on 127.0.0.1:11434).
// Mirrors ecapbackend/controllers/agentController.js so both apps share the
// same self-hosted LLM. PII never leaves the box; key stays server-side.
const http = require("http");

const OLLAMA_HOST = process.env.OLLAMA_HOST || "127.0.0.1";
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

const DEFAULT_SYSTEM_PROMPT = `You are Bumi, the ECAP+ PMP Assistant, helping users navigate a Zambian PEPFAR Performance Management Platform (households, VCAs, caregivers, PMTCT, services, flags, charts). Be concise, factual, and never invent statistics. If you don't know, say so. Use plain English at an 8th-grade reading level.`;

const chat = async (req, res) => {
  try {
    const body = req.body || {};
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const hasSystem = incomingMessages.some((m) => m && m.role === "system");
    const messages = hasSystem
      ? incomingMessages
      : [{ role: "system", content: DEFAULT_SYSTEM_PROMPT }, ...incomingMessages];

    const payload = JSON.stringify({
      model: body.model || OLLAMA_MODEL,
      messages,
      max_tokens: Math.min(Number(body.max_tokens) || 350, 600),
      temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
      stream: false,
    });

    const upstream = await new Promise((resolve, reject) => {
      const r = http.request(
        {
          hostname: OLLAMA_HOST,
          port: OLLAMA_PORT,
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 90_000,
        },
        (resp) => {
          let data = "";
          resp.on("data", (c) => (data += c));
          resp.on("end", () => {
            try {
              resolve({ status: resp.statusCode, body: JSON.parse(data) });
            } catch (e) {
              reject(new Error(`bad JSON from Ollama: ${data.slice(0, 200)}`));
            }
          });
        }
      );
      r.on("timeout", () => r.destroy(new Error("Ollama request timed out (>90s)")));
      r.on("error", reject);
      r.write(payload);
      r.end();
    });

    if (upstream.status >= 400) {
      return res.status(upstream.status).json({
        error: { message: "Upstream LLM error", upstream: upstream.body },
      });
    }
    return res.json(upstream.body);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message || "Agent proxy failure" } });
  }
};

const health = async (_req, res) => {
  const ok = await new Promise((resolve) => {
    const r = http.get(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: "/api/tags", timeout: 3000 },
      (resp) => resolve(resp.statusCode === 200)
    );
    r.on("error", () => resolve(false));
    r.on("timeout", () => { r.destroy(); resolve(false); });
  });
  res.json({ ok, model: OLLAMA_MODEL, host: `${OLLAMA_HOST}:${OLLAMA_PORT}` });
};

exports.chat = chat;
exports.health = health;
