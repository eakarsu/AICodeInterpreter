const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

function createCrudRouter(table, { orderBy = 'created_at DESC', jsonFields = [] } = {}) {
  const router = express.Router();

  // GET / — list with pagination support (?page=1&limit=20)
  router.get('/', auth, async (req, res) => {
    try {
      const { page, limit, search, search_field } = req.query;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
      const offset = (pageNum - 1) * pageSize;

      let countResult, result;

      if (search && search_field) {
        // Whitelist search_field to prevent SQL injection (only allow word chars)
        const safeField = search_field.replace(/[^\w]/g, '');
        countResult = await pool.query(
          `SELECT COUNT(*) FROM ${table} WHERE ${safeField} ILIKE $1`, [`%${search}%`]
        );
        result = await pool.query(
          `SELECT * FROM ${table} WHERE ${safeField} ILIKE $1 ORDER BY ${orderBy} LIMIT $2 OFFSET $3`,
          [`%${search}%`, pageSize, offset]
        );
      } else {
        countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        result = await pool.query(
          `SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
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

  router.get('/:id', auth, async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/', auth, async (req, res) => {
    try {
      const keys = Object.keys(req.body);
      if (keys.length === 0) return res.status(400).json({ error: 'Request body cannot be empty.' });
      const vals = keys.map((k, i) => `$${i + 1}`);
      const values = keys.map(k => jsonFields.includes(k) ? JSON.stringify(req.body[k]) : req.body[k]);
      const r = await pool.query(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${vals.join(',')}) RETURNING *`, values
      );
      res.status(201).json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/:id', auth, async (req, res) => {
    try {
      const keys = Object.keys(req.body);
      if (keys.length === 0) return res.status(400).json({ error: 'No fields to update.' });
      const sets = keys.map((k, i) => `${k}=$${i + 1}`);
      const values = keys.map(k => jsonFields.includes(k) ? JSON.stringify(req.body[k]) : req.body[k]);
      values.push(req.params.id);
      const r = await pool.query(
        `UPDATE ${table} SET ${sets.join(',')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/:id', auth, async (req, res) => {
    try {
      const r = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ message: 'Deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}

module.exports = createCrudRouter;
