// customViews.js — AI Code Interpreter / Interpreter Views
// Domain: AI code execution interpreter
// Features:
//   VIZ 1: GET /execution-timeline       — per-session execution timeline
//   VIZ 2: GET /language-distribution    — donut chart payload (executions by language)
//   NON-VIZ 1: POST /notebook-pdf-export — export notebook session as printable PDF/HTML report
//   NON-VIZ 2: GET/PUT/DELETE /execution-policy — CRUD CPU / memory / timeout policies & limits

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// -------- helper: ensure custom_views_config table -------------------
let _cfgEnsured = false;
async function ensureConfigTable() {
  if (_cfgEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_views_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(120) UNIQUE NOT NULL,
        value JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    _cfgEnsured = true;
  } catch (_) { _cfgEnsured = true; }
}

// =====================================================================
// VIZ 1 — Per-Session Execution Timeline
// GET /api/custom-views/execution-timeline?session_id=...&limit=50
// A "session" is synthesized from notebooks (each notebook = a session).
// Returns: sessions[], events[] keyed by session.
// =====================================================================
router.get('/execution-timeline', auth, async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit) || 60);
    const wantedSession = req.query.session_id ? String(req.query.session_id) : null;

    // Pull recent notebooks as sessions
    let sessions = [];
    try {
      const r = await pool.query(
        `SELECT id, title, language, status, created_at, updated_at
         FROM notebooks ORDER BY updated_at DESC NULLS LAST LIMIT 20`
      );
      sessions = r.rows;
    } catch (_) { sessions = []; }

    // Pull recent executions
    let execRows = [];
    try {
      const r = await pool.query(
        `SELECT id, snippet_id, language, status, exit_code,
                execution_time_ms, memory_used_mb, created_at
         FROM executions ORDER BY created_at DESC LIMIT $1`, [limit]
      );
      execRows = r.rows;
    } catch (_) { execRows = []; }

    // Bucket executions into synthetic sessions (round-robin by index mod N)
    const sessionsOut = (sessions.length ? sessions : [{
      id: 'default', title: 'Default Session', language: 'python', status: 'active',
      created_at: new Date(), updated_at: new Date(),
    }]).map(s => ({
      session_id: s.id,
      title: s.title,
      language: s.language || 'python',
      status: s.status || 'active',
      started_at: s.created_at,
      last_active: s.updated_at,
      events: [],
    }));

    execRows.slice().reverse().forEach((e, i) => {
      const bucket = sessionsOut[i % sessionsOut.length];
      bucket.events.push({
        idx: bucket.events.length,
        id: e.id,
        snippet_id: e.snippet_id,
        language: e.language || 'unknown',
        status: e.status || 'completed',
        exit_code: e.exit_code,
        duration_ms: Number(e.execution_time_ms || 0),
        memory_mb: Number(e.memory_used_mb || 0),
        timestamp: e.created_at,
        label: `#${e.id} ${e.language || ''}`,
      });
    });

    // Per-session summary
    sessionsOut.forEach(s => {
      const evs = s.events;
      const failed = evs.filter(e => e.status === 'failed' || (e.exit_code != null && e.exit_code > 0)).length;
      s.summary = {
        total: evs.length,
        failed,
        success: evs.length - failed,
        avg_ms: evs.length ? Math.round(evs.reduce((a, e) => a + e.duration_ms, 0) / evs.length) : 0,
        max_ms: evs.reduce((a, e) => Math.max(a, e.duration_ms), 0),
      };
    });

    let payload = sessionsOut;
    if (wantedSession) {
      payload = sessionsOut.filter(s => String(s.session_id) === wantedSession);
    }

    // Global summary
    const allEvents = sessionsOut.flatMap(s => s.events);
    const failedAll = allEvents.filter(e => e.status === 'failed' || (e.exit_code != null && e.exit_code > 0)).length;

    res.json({
      summary: {
        sessions: sessionsOut.length,
        total: allEvents.length,
        failed: failedAll,
        success: allEvents.length - failedAll,
        avg_ms: allEvents.length ? Math.round(allEvents.reduce((a, e) => a + e.duration_ms, 0) / allEvents.length) : 0,
      },
      sessions: payload,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// VIZ 2 — Language Distribution Donut Chart
// GET /api/custom-views/language-distribution
// =====================================================================
router.get('/language-distribution', auth, async (req, res) => {
  try {
    let rows = [];
    try {
      const r = await pool.query(`
        SELECT COALESCE(language,'unknown') AS language,
               COUNT(*)::int AS runs,
               COALESCE(AVG(execution_time_ms),0)::float AS avg_time_ms,
               COALESCE(SUM(execution_time_ms),0)::bigint AS total_time_ms,
               COALESCE(AVG(memory_used_mb),0)::float AS avg_memory_mb
        FROM executions
        GROUP BY language
        ORDER BY runs DESC
      `);
      rows = r.rows;
    } catch (_) { rows = []; }

    // Fallback synthesized data if no executions
    if (!rows.length) {
      try {
        const r2 = await pool.query(
          `SELECT COALESCE(language,'unknown') AS language, COUNT(*)::int AS runs,
                  0::float AS avg_time_ms, 0::bigint AS total_time_ms, 0::float AS avg_memory_mb
           FROM code_snippets GROUP BY language ORDER BY runs DESC`);
        rows = r2.rows;
      } catch (_) {}
    }

    const total = rows.reduce((a, r) => a + Number(r.runs || 0), 0);
    // Color palette for donut slices
    const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#a855f7'];
    let acc = 0;
    const slices = rows.map((r, i) => {
      const pct = total ? (Number(r.runs) / total) : 0;
      const slice = {
        language: r.language,
        runs: Number(r.runs),
        percent: +(pct * 100).toFixed(2),
        avg_time_ms: Math.round(Number(r.avg_time_ms || 0)),
        total_time_ms: Number(r.total_time_ms || 0),
        avg_memory_mb: +Number(r.avg_memory_mb || 0).toFixed(2),
        color: PALETTE[i % PALETTE.length],
        start_pct: +(acc * 100).toFixed(4),
      };
      acc += pct;
      slice.end_pct = +(acc * 100).toFixed(4);
      return slice;
    });

    res.json({
      summary: {
        total_runs: total,
        languages: slices.length,
        top: slices[0] ? slices[0].language : null,
        top_share_pct: slices[0] ? slices[0].percent : 0,
      },
      slices,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// NON-VIZ 1 — Notebook Session PDF Export (HTML-printable bundle)
// POST /api/custom-views/notebook-pdf-export
// body: { notebook_id?: number, include_executions?: bool, format?: 'html'|'json' }
// Returns: downloadable HTML (print-to-PDF friendly) or JSON bundle.
// =====================================================================
router.post('/notebook-pdf-export', auth, async (req, res) => {
  try {
    const { notebook_id, include_executions = true, format = 'html' } = req.body || {};

    let notebook = null;
    if (notebook_id) {
      try {
        const r = await pool.query('SELECT * FROM notebooks WHERE id = $1', [notebook_id]);
        notebook = r.rows[0] || null;
      } catch (_) {}
    }
    if (!notebook) {
      // Fallback to most recent notebook
      try {
        const r = await pool.query('SELECT * FROM notebooks ORDER BY updated_at DESC LIMIT 1');
        notebook = r.rows[0] || null;
      } catch (_) {}
    }
    if (!notebook) {
      notebook = {
        id: 0, title: 'Empty Notebook', description: '', language: 'python',
        cells: [], created_at: new Date(), updated_at: new Date(),
      };
    }

    // Parse cells (jsonb column on notebooks)
    let cells = [];
    if (Array.isArray(notebook.cells)) cells = notebook.cells;
    else if (typeof notebook.cells === 'string') {
      try { cells = JSON.parse(notebook.cells); } catch (_) { cells = []; }
    }

    // Try to pull notebook_cells too (separate table from notebooks.js)
    try {
      const r = await pool.query(
        `SELECT cell_type, source, content, output, position
         FROM notebook_cells WHERE notebook_id = $1 ORDER BY position ASC`,
        [notebook.id]
      );
      if (r.rows && r.rows.length) cells = r.rows;
    } catch (_) {}

    // Pull recent executions to attach
    let executions = [];
    if (include_executions) {
      try {
        const r = await pool.query(
          `SELECT id, language, status, exit_code, execution_time_ms,
                  memory_used_mb, stdout, stderr, created_at
           FROM executions ORDER BY created_at DESC LIMIT 25`
        );
        executions = r.rows;
      } catch (_) { executions = []; }
    }

    const bundle = {
      schema: 'aicodeinterpreter.notebook-session-pdf-export.v1',
      exported_at: new Date().toISOString(),
      notebook: {
        id: notebook.id,
        title: notebook.title,
        description: notebook.description,
        language: notebook.language,
        cell_count: cells.length,
        created_at: notebook.created_at,
        updated_at: notebook.updated_at,
      },
      cells,
      executions,
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="notebook-${notebook.id}-session-${Date.now()}.json"`
      );
      return res.json(bundle);
    }

    // HTML / print-to-PDF output
    const esc = (s) => String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const cellHtml = cells.map((c, i) => {
      const ctype = c.cell_type || (c.source ? 'code' : 'markdown');
      const body = c.source || c.content || c.code || '';
      const out = c.output ? (typeof c.output === 'string' ? c.output : JSON.stringify(c.output, null, 2)) : '';
      return `<section class="cell ${ctype}">
        <div class="cell-meta">Cell ${i+1} · ${esc(ctype)}</div>
        <pre class="cell-body">${esc(body)}</pre>
        ${out ? `<pre class="cell-output">${esc(out)}</pre>` : ''}
      </section>`;
    }).join('\n');

    const execHtml = executions.map(e => `
      <tr>
        <td>#${esc(e.id)}</td>
        <td>${esc(e.language)}</td>
        <td>${esc(e.status)}</td>
        <td>${esc(e.execution_time_ms)} ms</td>
        <td>${esc(e.memory_used_mb)} MB</td>
        <td>${esc(new Date(e.created_at).toLocaleString())}</td>
      </tr>`).join('');

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Notebook Session Export — ${esc(notebook.title)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 32px; color:#111; }
  h1 { margin:0 0 6px; } h2 { margin-top: 28px; }
  .meta { color:#666; font-size: 12px; margin-bottom: 18px; }
  .cell { border:1px solid #ddd; border-radius:6px; padding:10px 12px; margin:10px 0; page-break-inside: avoid; }
  .cell.markdown { background:#fafafa; }
  .cell.code { background:#f5f7fa; }
  .cell-meta { font-size: 10px; text-transform: uppercase; color:#666; margin-bottom: 6px; }
  .cell-body, .cell-output { white-space: pre-wrap; font-family: ui-monospace,monospace; font-size: 12px; margin:0; }
  .cell-output { background:#fff; border-top:1px dashed #ccc; margin-top:8px; padding-top:6px; color:#333; }
  table { width:100%; border-collapse: collapse; font-size: 12px; }
  th, td { border:1px solid #ddd; padding:4px 8px; text-align:left; }
  th { background:#f0f0f0; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <h1>${esc(notebook.title)}</h1>
  <div class="meta">
    Notebook #${esc(notebook.id)} · ${esc(notebook.language)} ·
    ${cells.length} cells · Exported ${esc(new Date().toISOString())}
  </div>
  ${notebook.description ? `<p>${esc(notebook.description)}</p>` : ''}
  <h2>Cells</h2>
  ${cellHtml || '<p><em>No cells</em></p>'}
  ${include_executions ? `
    <h2>Recent Executions (${executions.length})</h2>
    <table>
      <thead><tr><th>ID</th><th>Lang</th><th>Status</th><th>Time</th><th>Memory</th><th>When</th></tr></thead>
      <tbody>${execHtml || '<tr><td colspan="6"><em>No executions</em></td></tr>'}</tbody>
    </table>` : ''}
  <p class="meta">aicodeinterpreter.notebook-session-pdf-export.v1</p>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="notebook-${notebook.id}-session-${Date.now()}.html"`
    );
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// NON-VIZ 2 — Execution Policy / Limits Editor (CRUD)
// GET    /api/custom-views/execution-policy       — list policies
// POST   /api/custom-views/execution-policy       — create policy
// PUT    /api/custom-views/execution-policy/:name — update policy
// DELETE /api/custom-views/execution-policy/:name — remove policy
//
// Each policy persists under custom_views_config with key 'policy:<name>'.
// Controls CPU, memory, timeouts, max processes, etc.
// =====================================================================
const DEFAULT_POLICY = {
  cpu_limit: '1',           // CPU cores
  memory_limit_mb: 512,     // RAM
  timeout_seconds: 30,      // wall-clock kill
  max_processes: 32,
  network_enabled: false,
  filesystem_writable: true,
  output_limit_kb: 1024,
  default_language: 'python',
  description: '',
};

function validatePolicy(p) {
  if (p.memory_limit_mb != null && (p.memory_limit_mb < 16 || p.memory_limit_mb > 65536)) {
    return 'memory_limit_mb out of range (16-65536)';
  }
  if (p.timeout_seconds != null && (p.timeout_seconds < 1 || p.timeout_seconds > 3600)) {
    return 'timeout_seconds out of range (1-3600)';
  }
  if (p.max_processes != null && (p.max_processes < 1 || p.max_processes > 4096)) {
    return 'max_processes out of range (1-4096)';
  }
  return null;
}

router.get('/execution-policy', auth, async (req, res) => {
  await ensureConfigTable();
  try {
    let rows = [];
    try {
      const r = await pool.query(
        `SELECT key, value, updated_at FROM custom_views_config
         WHERE key LIKE 'policy:%' ORDER BY key ASC`
      );
      rows = r.rows;
    } catch (_) { rows = []; }

    const policies = rows.map(r => ({
      name: r.key.replace(/^policy:/, ''),
      policy: { ...DEFAULT_POLICY, ...(r.value || {}) },
      updated_at: r.updated_at,
    }));

    // Always ensure a 'default' shows up
    if (!policies.find(p => p.name === 'default')) {
      policies.unshift({ name: 'default', policy: DEFAULT_POLICY, updated_at: null });
    }

    res.json({
      defaults: DEFAULT_POLICY,
      policies,
      count: policies.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/execution-policy', auth, async (req, res) => {
  await ensureConfigTable();
  try {
    const { name, policy } = req.body || {};
    if (!name || !/^[a-z0-9_-]{1,60}$/i.test(name)) {
      return res.status(400).json({ error: 'name required (alnum, _-, max 60 chars)' });
    }
    const merged = { ...DEFAULT_POLICY, ...(policy || {}) };
    const vErr = validatePolicy(merged);
    if (vErr) return res.status(400).json({ error: vErr });

    const r = await pool.query(
      `INSERT INTO custom_views_config (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING value, updated_at`,
      [`policy:${name}`, JSON.stringify(merged)]
    );
    res.json({ name, policy: r.rows[0].value, updated_at: r.rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/execution-policy/:name', auth, async (req, res) => {
  await ensureConfigTable();
  try {
    const name = req.params.name;
    if (!/^[a-z0-9_-]{1,60}$/i.test(name)) {
      return res.status(400).json({ error: 'invalid name' });
    }
    const incoming = (req.body && req.body.policy) || req.body || {};
    const merged = { ...DEFAULT_POLICY, ...incoming };
    const vErr = validatePolicy(merged);
    if (vErr) return res.status(400).json({ error: vErr });

    const r = await pool.query(
      `INSERT INTO custom_views_config (key, value, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING value, updated_at`,
      [`policy:${name}`, JSON.stringify(merged)]
    );
    res.json({ name, policy: r.rows[0].value, updated_at: r.rows[0].updated_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/execution-policy/:name', auth, async (req, res) => {
  await ensureConfigTable();
  try {
    const name = req.params.name;
    if (name === 'default') {
      return res.status(400).json({ error: 'cannot delete default policy' });
    }
    await pool.query(`DELETE FROM custom_views_config WHERE key = $1`, [`policy:${name}`]);
    res.json({ deleted: name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
