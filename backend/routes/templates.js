const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/templates?language=&category= — list templates with filtering and pagination
router.get('/', auth, async (req, res) => {
  try {
    const { language, category, search, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (language) { conditions.push(`language = $${idx++}`); values.push(language); }
    if (category) { conditions.push(`category = $${idx++}`); values.push(category); }
    if (search) { conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`); values.push(`%${search}%`); idx++; }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM code_templates ${where}`, values);
    const result = await pool.query(
      `SELECT * FROM code_templates ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, pageSize, offset]
    );

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: result.rows,
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
      filters: { language: language || null, category: category || null, search: search || null },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/templates/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM code_templates WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/templates — create a template
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, language, category, code, variables } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'title (string) is required.' });
    }
    if (!language || typeof language !== 'string') {
      return res.status(400).json({ error: 'language (string) is required.' });
    }
    if (code && Buffer.byteLength(code, 'utf8') > 50 * 1024) {
      return res.status(400).json({ error: 'code must not exceed 50KB.' });
    }

    const r = await pool.query(
      `INSERT INTO code_templates (title, description, language, category, code, variables)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title.trim(), description || '', language, category || 'general', code || '', JSON.stringify(variables || [])]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/templates/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, language, category, code, variables } = req.body;

    if (code && Buffer.byteLength(code, 'utf8') > 50 * 1024) {
      return res.status(400).json({ error: 'code must not exceed 50KB.' });
    }

    const r = await pool.query(
      `UPDATE code_templates
       SET title=$1, description=$2, language=$3, category=$4, code=$5, variables=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [title, description, language, category, code, JSON.stringify(variables || []), req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/templates/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM code_templates WHERE id = $1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
