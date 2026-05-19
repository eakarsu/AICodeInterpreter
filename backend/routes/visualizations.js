const express = require('express');
const axios = require('axios');
const pool = require('../db');
const auth = require('../middleware/auth');
const aiRateLimiter = require('../middleware/rateLimiter');
const router = express.Router();

const AI_SYSTEM_PROMPT = 'You are an expert software engineer and coding assistant. Provide accurate, detailed code analysis, debugging help, and educational explanations across all programming languages.';

const aiCall = async (userMsg) => {
  const response = await axios.post(
    `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'system', content: AI_SYSTEM_PROMPT }, { role: 'user', content: userMsg }],
      temperature: 0.3,
      max_tokens: 4096,
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
  return response.data.choices?.[0]?.message?.content || '';
};

// GET /api/visualizations — list with pagination
router.get('/', auth, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    const countResult = await pool.query('SELECT COUNT(*) FROM visualizations');
    const result = await pool.query(
      'SELECT * FROM visualizations ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [pageSize, offset]
    );

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: result.rows,
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/visualizations/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM visualizations WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/visualizations/generate — AI generates Vega-Lite spec
// Input: {data_json, chart_type}
router.post('/generate', auth, aiRateLimiter, async (req, res) => {
  try {
    const { data_json, chart_type } = req.body;

    if (!data_json) {
      return res.status(400).json({ error: 'data_json is required.' });
    }
    const dataStr = typeof data_json === 'string' ? data_json : JSON.stringify(data_json);
    if (Buffer.byteLength(dataStr, 'utf8') > 100 * 1024) {
      return res.status(400).json({ error: 'data_json must not exceed 100KB.' });
    }
    const allowedTypes = ['bar', 'line', 'scatter', 'area', 'pie', 'histogram', 'heatmap', 'boxplot', 'auto'];
    const chartType = allowedTypes.includes(chart_type) ? chart_type : 'auto';

    const userMsg = `Generate a Vega-Lite specification for visualizing the following data${chartType !== 'auto' ? ` as a ${chartType} chart` : ''}.\n\nData:\n${dataStr.slice(0, 10000)}${dataStr.length > 10000 ? '\n... (truncated)' : ''}\n\nRequirements:\n- Return ONLY a valid JSON Vega-Lite spec (version 5), no markdown, no explanation\n- Choose the most appropriate chart type if not specified (currently: ${chartType})\n- Include proper axis labels, title, and legend\n- Use meaningful color encoding if applicable\n- Make the visualization informative and readable\n- The spec should render correctly in Vega-Embed\n- Use inline data in the spec`;

    const aiResponse = await aiCall(userMsg);

    let vegaSpec;
    try {
      // Extract JSON from potential markdown code block
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, aiResponse];
      vegaSpec = JSON.parse(jsonMatch[1].trim());
    } catch {
      vegaSpec = { raw_response: aiResponse, error: 'Could not parse Vega-Lite spec from AI response' };
    }

    // Save to DB
    const saved = await pool.query(
      'INSERT INTO visualizations (title, chart_type, config, data_source) VALUES ($1, $2, $3, $4) RETURNING *',
      [
        vegaSpec.title || `${chartType} chart`,
        chartType,
        JSON.stringify(vegaSpec),
        JSON.stringify({ original_data: dataStr.slice(0, 5000) }),
      ]
    );

    res.status(201).json({
      id: saved.rows[0].id,
      vega_lite_spec: vegaSpec,
      chart_type: chartType,
      saved: saved.rows[0],
    });
  } catch (err) {
    console.error('visualizations/generate error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/visualizations — create manually
router.post('/', auth, async (req, res) => {
  try {
    const { title, chart_type, config, data_source } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required.' });
    const r = await pool.query(
      'INSERT INTO visualizations (title, chart_type, config, data_source) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, chart_type || 'bar', JSON.stringify(config || {}), JSON.stringify(data_source || {})]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/visualizations/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, chart_type, config, data_source } = req.body;
    const r = await pool.query(
      'UPDATE visualizations SET title=$1, chart_type=$2, config=$3, data_source=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [title, chart_type, JSON.stringify(config), JSON.stringify(data_source), req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/visualizations/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM visualizations WHERE id = $1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
