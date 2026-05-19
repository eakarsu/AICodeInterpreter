const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/collaborators — list collaborators, optionally filtered by resource
router.get('/', auth, async (req, res) => {
  try {
    const { resource_type, resource_id, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    let countResult, result;
    if (resource_type && resource_id) {
      countResult = await pool.query(
        'SELECT COUNT(*) FROM collaborators WHERE resource_type = $1 AND resource_id = $2',
        [resource_type, resource_id]
      );
      result = await pool.query(
        'SELECT * FROM collaborators WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
        [resource_type, resource_id, pageSize, offset]
      );
    } else {
      countResult = await pool.query('SELECT COUNT(*) FROM collaborators');
      result = await pool.query(
        'SELECT * FROM collaborators ORDER BY created_at DESC LIMIT $1 OFFSET $2',
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

// GET /api/collaborators/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM collaborators WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Collaborator not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/collaborators/invite — invite a collaborator to a snippet or notebook
router.post('/invite', auth, async (req, res) => {
  try {
    const { email, resource_type, resource_id, role } = req.body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    if (!resource_type || !['snippet', 'notebook', 'dataset', 'environment'].includes(resource_type)) {
      return res.status(400).json({ error: 'resource_type must be one of: snippet, notebook, dataset, environment.' });
    }
    if (!resource_id) {
      return res.status(400).json({ error: 'resource_id is required.' });
    }

    const allowedRoles = ['viewer', 'editor', 'admin'];
    const collaboratorRole = allowedRoles.includes(role) ? role : 'viewer';

    // Check if collaborator already exists for this resource
    const existing = await pool.query(
      'SELECT id FROM collaborators WHERE email = $1 AND resource_type = $2 AND resource_id = $3',
      [email.toLowerCase(), resource_type, resource_id]
    );

    if (existing.rows.length > 0) {
      // Update role instead of duplicating
      const updated = await pool.query(
        'UPDATE collaborators SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [collaboratorRole, existing.rows[0].id]
      );
      return res.json({ ...updated.rows[0], message: 'Collaborator role updated.' });
    }

    const r = await pool.query(
      `INSERT INTO collaborators (email, resource_type, resource_id, role, invited_by, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [email.toLowerCase(), resource_type, resource_id, collaboratorRole, req.user.id]
    );

    res.status(201).json({
      ...r.rows[0],
      message: `Invitation sent to ${email} as ${collaboratorRole} for ${resource_type} #${resource_id}.`,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/collaborators/:id — update collaborator role or status
router.put('/:id', auth, async (req, res) => {
  try {
    const { role, status } = req.body;
    const allowedRoles = ['viewer', 'editor', 'admin'];
    const allowedStatuses = ['pending', 'accepted', 'declined'];

    const fields = [];
    const values = [];
    let idx = 1;

    if (role && allowedRoles.includes(role)) { fields.push(`role=$${idx++}`); values.push(role); }
    if (status && allowedStatuses.includes(status)) { fields.push(`status=$${idx++}`); values.push(status); }

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });

    fields.push(`updated_at=NOW()`);
    values.push(req.params.id);

    const r = await pool.query(
      `UPDATE collaborators SET ${fields.join(', ')} WHERE id=$${idx} RETURNING *`,
      values
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Collaborator not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/collaborators/:id — remove a collaborator
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM collaborators WHERE id = $1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Collaborator not found' });
    res.json({ message: 'Collaborator removed successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
