const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

function createCrudRouter(table, { orderBy = 'created_at DESC', jsonFields = [] } = {}) {
  const router = express.Router();

  router.get('/', auth, async (req, res) => {
    try { res.json((await pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`)).rows); }
    catch (err) { res.status(500).json({ error: err.message }); }
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
