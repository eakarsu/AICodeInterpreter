const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/notebooks — list all notebooks with pagination
router.get('/', auth, async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    let countResult, result;
    if (search) {
      countResult = await pool.query('SELECT COUNT(*) FROM notebooks WHERE title ILIKE $1', [`%${search}%`]);
      result = await pool.query(
        'SELECT id, title, description, language, created_at, updated_at FROM notebooks WHERE title ILIKE $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3',
        [`%${search}%`, pageSize, offset]
      );
    } else {
      countResult = await pool.query('SELECT COUNT(*) FROM notebooks');
      result = await pool.query(
        'SELECT id, title, description, language, created_at, updated_at FROM notebooks ORDER BY updated_at DESC LIMIT $1 OFFSET $2',
        [pageSize, offset]
      );
    }

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: result.rows,
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notebooks/:id — get a notebook with all its cells
router.get('/:id', auth, async (req, res) => {
  try {
    const notebook = await pool.query('SELECT * FROM notebooks WHERE id = $1', [req.params.id]);
    if (notebook.rows.length === 0) return res.status(404).json({ error: 'Notebook not found' });

    let cells = [];
    try {
      const cellResult = await pool.query(
        'SELECT * FROM notebook_cells WHERE notebook_id = $1 ORDER BY position ASC, created_at ASC',
        [req.params.id]
      );
      cells = cellResult.rows;
    } catch (_) {
      // notebook_cells table may not exist yet; return empty array
    }

    res.json({ ...notebook.rows[0], cells });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notebooks — create a notebook
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, language } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'title (string) is required.' });
    }
    const result = await pool.query(
      'INSERT INTO notebooks (title, description, language) VALUES ($1, $2, $3) RETURNING *',
      [title.trim(), description || '', language || 'python']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notebooks/:id — update notebook metadata
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, language } = req.body;
    const result = await pool.query(
      'UPDATE notebooks SET title=$1, description=$2, language=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [title, description, language, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/notebooks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    // Attempt to cascade-delete cells if table exists
    try {
      await pool.query('DELETE FROM notebook_cells WHERE notebook_id = $1', [req.params.id]);
    } catch (_) {}
    const result = await pool.query('DELETE FROM notebooks WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Notebook deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notebooks/:id/cells — list cells of a notebook
router.get('/:id/cells', auth, async (req, res) => {
  try {
    const notebook = await pool.query('SELECT id FROM notebooks WHERE id = $1', [req.params.id]);
    if (notebook.rows.length === 0) return res.status(404).json({ error: 'Notebook not found' });

    const cells = await pool.query(
      'SELECT * FROM notebook_cells WHERE notebook_id = $1 ORDER BY position ASC, created_at ASC',
      [req.params.id]
    );
    res.json(cells.rows);
  } catch (err) {
    if (err.message.includes('notebook_cells')) {
      return res.json([]); // Table not yet created
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notebooks/:id/cells — add a cell to a notebook
router.post('/:id/cells', auth, async (req, res) => {
  try {
    const notebook = await pool.query('SELECT id FROM notebooks WHERE id = $1', [req.params.id]);
    if (notebook.rows.length === 0) return res.status(404).json({ error: 'Notebook not found' });

    const { cell_type, content, position, metadata } = req.body;
    const allowedTypes = ['code', 'markdown', 'raw'];
    const type = allowedTypes.includes(cell_type) ? cell_type : 'code';

    // Determine next position if not supplied
    let pos = position;
    if (pos === undefined || pos === null) {
      try {
        const posResult = await pool.query(
          'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM notebook_cells WHERE notebook_id = $1',
          [req.params.id]
        );
        pos = posResult.rows[0].next_pos;
      } catch (_) { pos = 0; }
    }

    const result = await pool.query(
      `INSERT INTO notebook_cells (notebook_id, cell_type, content, position, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, type, content || '', pos, JSON.stringify(metadata || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notebooks/cells/:cellId — update a specific cell
router.put('/cells/:cellId', auth, async (req, res) => {
  try {
    const { content, cell_type, position, metadata, output } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (content !== undefined) { fields.push(`content=$${idx++}`); values.push(content); }
    if (cell_type !== undefined) { fields.push(`cell_type=$${idx++}`); values.push(cell_type); }
    if (position !== undefined) { fields.push(`position=$${idx++}`); values.push(position); }
    if (metadata !== undefined) { fields.push(`metadata=$${idx++}`); values.push(JSON.stringify(metadata)); }
    if (output !== undefined) { fields.push(`output=$${idx++}`); values.push(JSON.stringify(output)); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    fields.push(`updated_at=NOW()`);
    values.push(req.params.cellId);

    const result = await pool.query(
      `UPDATE notebook_cells SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cell not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/notebooks/cells/:cellId — delete a specific cell
router.delete('/cells/:cellId', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM notebook_cells WHERE id = $1 RETURNING *', [req.params.cellId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cell not found' });
    res.json({ message: 'Cell deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
