/**
 * Advanced AI routes — proposed NEW custom non-CRUD features for AICodeInterpreter.
 *
 *  POST /api/ai-advanced/sandbox-execute     — call out to a JS/Python sandbox endpoint OR fallback to AI
 *  POST /api/ai-advanced/review-diff         — compare current vs previous code; track improvement
 *  POST /api/ai-advanced/performance-profile — profile + rank optimisations + benchmark estimate
 *  POST /api/ai-advanced/clone-detect        — detect duplicated logic across snippets
 *  POST /api/ai-advanced/docs-refresh        — refresh stale docstrings/README
 *  POST /api/ai-advanced/collab-review       — multi-reviewer consensus aggregation
 *  GET  /api/ai-advanced/clone-detect/run-all — scan whole library
 */
const express = require('express');
const axios = require('axios');
const pool = require('../db');
const auth = require('../middleware/auth');
const aiRateLimiter = require('../middleware/rateLimiter');
const router = express.Router();

const MAX_CODE_BYTES = 50 * 1024;
const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

// 3-strategy JSON parser
function parseAIJson(text) {
  if (typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch (e) {}
  const stripped = text
    .replace(/```(?:json)?\n?/g, '')
    .replace(/```/g, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch (e) {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {}
  }
  return null;
}

async function aiCall(system, user, temp = 0.4, maxTokens = 4096) {
  const r = await axios.post(
    `${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: temp,
      max_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Code Interpreter',
      },
    }
  );
  return r.data;
}

function validateCode(code, res) {
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'code (string) is required.' });
    return false;
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    res
      .status(400)
      .json({ error: `code must not exceed ${MAX_CODE_BYTES / 1024}KB (${MAX_CODE_BYTES} bytes).` });
    return false;
  }
  return true;
}

/**
 * POST /api/ai-advanced/sandbox-execute
 * Body: { code, language, stdin? }
 * If SANDBOX_URL env var is set, posts to it; otherwise falls back to AI simulation
 * but tags the response so callers can distinguish actual vs simulated execution.
 */
router.post('/sandbox-execute', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language = 'python', stdin = '' } = req.body || {};
    if (!validateCode(code, res)) return;

    if (process.env.SANDBOX_URL) {
      try {
        const sb = await axios.post(
          process.env.SANDBOX_URL,
          { code, language, stdin },
          { timeout: 30000 }
        );
        await pool.query(
          'INSERT INTO executions (language, code, status, exit_code, stdout, stderr, execution_time_ms) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            language,
            code,
            sb.data.exit_code === 0 ? 'completed' : 'failed',
            sb.data.exit_code ?? 0,
            sb.data.stdout || '',
            sb.data.stderr || '',
            sb.data.execution_time_ms || 0,
          ]
        );
        return res.json({ source: 'sandbox', ...sb.data });
      } catch (e) {
        // fall through to AI simulation if sandbox unreachable
        console.error('[sandbox] failed, falling back to simulation:', e.message);
      }
    }

    // AI fallback: simulate execution but explicitly mark as simulated
    const data = await aiCall(
      'You simulate code execution. Be faithful to language semantics. Respond with valid JSON only, no markdown.',
      `Simulate executing this ${language} code (stdin: ${JSON.stringify(stdin)}):\n\n${code}\n\nReturn JSON: { "stdout": string, "stderr": string, "exit_code": number, "execution_time_ms_estimate": number, "trace": [{ "step": number, "line": number, "action": string, "state": object }], "warnings": [string] }`,
      0.2
    );
    const parsed = parseAIJson(data.choices?.[0]?.message?.content || '') || {};

    res.json({
      source: 'ai_simulated',
      warning:
        'Simulated by LLM — set SANDBOX_URL to a real Judge0/Replit-style sandbox to get actual execution.',
      ...parsed,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * POST /api/ai-advanced/review-diff
 * Body: { previous_code, current_code, language? }
 * Compare two code versions and track improvements.
 */
router.post('/review-diff', auth, aiRateLimiter, async (req, res) => {
  try {
    const { previous_code, current_code, language = 'unknown' } = req.body || {};
    if (!previous_code || !current_code) {
      return res.status(400).json({ error: 'previous_code and current_code are required.' });
    }
    if (!validateCode(previous_code, res)) return;
    if (!validateCode(current_code, res)) return;

    const data = await aiCall(
      'You compare two versions of code and produce a structured improvement report. Respond with valid JSON only.',
      `Compare these two ${language} versions and report improvements/regressions.\n\nPREVIOUS:\n${previous_code}\n\nCURRENT:\n${current_code}\n\nReturn JSON: { "summary": string, "changes": [ { "type": "added|removed|modified|renamed", "scope": "function|variable|import|comment|control_flow|other", "description": string, "impact": "improvement|regression|neutral", "severity": "critical|high|medium|low" } ], "metrics_estimate": { "complexity_delta": number, "readability_delta_pct": number, "performance_delta_pct": number }, "refactor_suggestions": [string], "overall_score_change": number }`,
      0.3
    );
    const parsed = parseAIJson(data.choices?.[0]?.message?.content || '') || {
      raw: data.choices?.[0]?.message?.content,
    };

    res.json({
      language,
      diff: parsed,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * POST /api/ai-advanced/performance-profile
 * Body: { code, language, target_input_size? }
 * Profile + rank optimisations + estimate benchmarks.
 */
router.post('/performance-profile', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language = 'python', target_input_size } = req.body || {};
    if (!validateCode(code, res)) return;

    const data = await aiCall(
      'You are a senior performance engineer. Profile code, estimate hot paths, predict speed-ups, and rank optimisations by impact. Respond with valid JSON only.',
      `Profile this ${language} code${target_input_size ? ` against an input size of ${target_input_size}` : ''}:\n\n${code}\n\nReturn JSON: { "hotspots": [ { "location": string, "estimated_pct_of_runtime": number, "reason": string } ], "complexity": { "time": string, "space": string }, "optimisations": [ { "rank": number, "title": string, "description": string, "estimated_speedup_pct": number, "implementation_difficulty": "low|medium|high", "code_change_example": string } ], "benchmark_estimate_ms": { "before": number, "after_top_optimisation": number }, "memory_estimate_mb": number, "summary": string }`,
      0.3
    );
    const parsed = parseAIJson(data.choices?.[0]?.message?.content || '') || {
      raw: data.choices?.[0]?.message?.content,
    };

    res.json({
      language,
      profile: parsed,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * POST /api/ai-advanced/clone-detect
 * Body: { snippet_ids?: number[], min_similarity?: 0.6 }
 * Group similar snippets and propose extraction.
 */
router.post('/clone-detect', auth, aiRateLimiter, async (req, res) => {
  try {
    const { snippet_ids, min_similarity = 0.6 } = req.body || {};
    let rows;
    if (Array.isArray(snippet_ids) && snippet_ids.length > 0) {
      const params = snippet_ids.map((_, i) => `$${i + 1}`).join(',');
      const r = await pool.query(
        `SELECT id, title, language, code FROM code_snippets WHERE id IN (${params})`,
        snippet_ids
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        'SELECT id, title, language, code FROM code_snippets ORDER BY created_at DESC LIMIT 25'
      );
      rows = r.rows;
    }
    if (rows.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 snippets to detect clones.' });
    }

    const summary = rows
      .map((r) => `--- id=${r.id} title="${r.title}" lang=${r.language} ---\n${(r.code || '').slice(0, 1000)}`)
      .join('\n\n');

    const data = await aiCall(
      'You identify duplicated logic across code snippets and propose extractions. Respond with valid JSON only.',
      `Find clusters of similar logic in these snippets (min similarity threshold: ${min_similarity}).\n\n${summary}\n\nReturn JSON: { "clusters": [ { "snippet_ids": [number], "similarity_estimate": number, "shared_logic": string, "suggested_abstraction": { "name": string, "signature": string, "description": string } } ], "isolated_snippets": [number], "total_clusters": number }`,
      0.3,
      4096
    );
    const parsed = parseAIJson(data.choices?.[0]?.message?.content || '') || {
      raw: data.choices?.[0]?.message?.content,
    };

    res.json({
      snippets_analysed: rows.length,
      min_similarity,
      result: parsed,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * GET /api/ai-advanced/clone-detect/run-all
 * Run clone detection across the whole snippet library (paginated to avoid token blow-up).
 */
router.get('/clone-detect/run-all', auth, aiRateLimiter, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, title, language, LEFT(code, 800) AS code FROM code_snippets ORDER BY id ASC LIMIT 30'
    );
    if (r.rows.length < 2) {
      return res.json({ snippets_analysed: r.rows.length, message: 'Not enough snippets.' });
    }

    const summary = r.rows
      .map((row) => `id=${row.id} title="${row.title}" lang=${row.language}\n${row.code}`)
      .join('\n\n');

    const data = await aiCall(
      'You identify duplicated logic across code snippets. Respond with valid JSON only.',
      `Find duplicate logic clusters across these snippets.\n\n${summary}\n\nReturn JSON: { "clusters": [ { "snippet_ids": [number], "shared_logic": string, "suggested_abstraction": string } ], "total_clusters": number }`,
      0.3,
      4096
    );
    const parsed = parseAIJson(data.choices?.[0]?.message?.content || '') || {};

    res.json({
      snippets_analysed: r.rows.length,
      result: parsed,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * POST /api/ai-advanced/docs-refresh
 * Body: { code, current_docs? string, language?, file_path? }
 * Refresh stale docstrings/README sections; report what changed.
 */
router.post('/docs-refresh', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, current_docs = '', language = 'unknown', file_path = '' } = req.body || {};
    if (!validateCode(code, res)) return;

    const data = await aiCall(
      'You refresh and align technical documentation to source code. Respond with valid JSON only.',
      `Update the docs to match this code. Flag staleness and missing items.\n\nFILE: ${file_path}\nLANG: ${language}\n\nCODE:\n${code}\n\nCURRENT DOCS:\n${current_docs || '(none)'}\n\nReturn JSON: { "updated_docs": string, "staleness_score_0_100": number, "stale_sections": [string], "added_sections": [string], "removed_sections": [string], "alignment_score_pct": number, "recommended_review": boolean }`,
      0.3,
      4096
    );
    const parsed = parseAIJson(data.choices?.[0]?.message?.content || '') || {
      raw: data.choices?.[0]?.message?.content,
    };

    res.json({
      language,
      file_path,
      docs: parsed,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

/**
 * POST /api/ai-advanced/collab-review
 * Body: { code, language, reviews: [{ reviewer, comment }] }
 * Aggregate multi-reviewer feedback into consensus + conflicts + resolution suggestions.
 */
router.post('/collab-review', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language = 'unknown', reviews } = req.body || {};
    if (!validateCode(code, res)) return;
    if (!Array.isArray(reviews) || reviews.length < 2) {
      return res
        .status(400)
        .json({ error: 'reviews must be an array of at least 2 { reviewer, comment } items.' });
    }

    const reviewSummary = reviews
      .map((r, i) => `[${i + 1}] ${r.reviewer || 'anon'}: ${r.comment || ''}`)
      .join('\n');

    const data = await aiCall(
      'You aggregate code review feedback. Identify consensus, conflicts, and propose compromise actions. Respond with valid JSON only.',
      `Code (${language}):\n${code}\n\nReviews:\n${reviewSummary}\n\nReturn JSON: { "consensus_points": [string], "conflicts": [ { "topic": string, "positions": [string], "compromise_suggestion": string } ], "action_items": [ { "owner_hint": string, "action": string, "priority": "high|medium|low" } ], "compromise_code_excerpt": string, "resolution_status": "agreed|partial|disagreed", "summary": string }`,
      0.4,
      4096
    );
    const parsed = parseAIJson(data.choices?.[0]?.message?.content || '') || {
      raw: data.choices?.[0]?.message?.content,
    };

    res.json({
      language,
      reviewers: reviews.length,
      aggregation: parsed,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

module.exports = router;
