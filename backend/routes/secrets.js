const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY || '';

function getEncryptionKey() {
  if (!ENCRYPTION_KEY_RAW) return null;
  // Derive a 32-byte key from the env var (handles keys of any length)
  return crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest();
}

function encrypt(plaintext) {
  const key = getEncryptionKey();
  if (!key) return null; // Encryption not configured — skip silently

  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Combine iv:authTag:ciphertext into a single storable string
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(stored) {
  const key = getEncryptionKey();
  if (!key || !stored) return null;

  const [ivHex, authTagHex, encrypted] = stored.split(':');
  if (!ivHex || !authTagHex || !encrypted) return null;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// GET /api/secrets — list secrets (key names only, never decrypt values)
router.get('/', auth, async (req, res) => {
  try {
    const { page, limit, resource_type, resource_id } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * pageSize;

    let countResult, result;
    if (resource_type && resource_id) {
      countResult = await pool.query(
        'SELECT COUNT(*) FROM secrets WHERE resource_type = $1 AND resource_id = $2',
        [resource_type, resource_id]
      );
      result = await pool.query(
        `SELECT id, key_name, description, resource_type, resource_id, created_at, updated_at
         FROM secrets WHERE resource_type = $1 AND resource_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [resource_type, resource_id, pageSize, offset]
      );
    } else {
      countResult = await pool.query('SELECT COUNT(*) FROM secrets');
      result = await pool.query(
        `SELECT id, key_name, description, resource_type, resource_id, created_at, updated_at
         FROM secrets ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
    }

    const total = parseInt(countResult.rows[0].count);
    res.json({
      data: result.rows, // value_encrypted is never returned
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
      encryption_enabled: !!getEncryptionKey(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/secrets/:id — return key name only, never decrypt to client
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, key_name, description, resource_type, resource_id, created_at, updated_at FROM secrets WHERE id = $1',
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });
    // Intentionally exclude value_encrypted from response
    res.json({ ...r.rows[0], note: 'Secret values are never returned to the client.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/secrets — store encrypted secret
router.post('/', auth, async (req, res) => {
  try {
    const { key_name, value, description, resource_type, resource_id } = req.body;

    if (!key_name || typeof key_name !== 'string' || key_name.trim().length === 0) {
      return res.status(400).json({ error: 'key_name (string) is required.' });
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key_name.trim())) {
      return res.status(400).json({ error: 'key_name must start with a letter or underscore and contain only alphanumerics/underscores.' });
    }
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'value is required.' });
    }
    const valueStr = String(value);
    if (valueStr.length > 10000) {
      return res.status(400).json({ error: 'value must not exceed 10000 characters.' });
    }

    const encryptionKey = getEncryptionKey();
    let valueEncrypted;

    if (encryptionKey) {
      valueEncrypted = encrypt(valueStr);
    } else {
      // ENCRYPTION_KEY not set — store a marker so we know the value is unencrypted
      // In production, you'd want to reject this or warn loudly
      console.warn('[secrets] ENCRYPTION_KEY not set — storing placeholder. Value NOT stored.');
      valueEncrypted = 'NO_ENCRYPTION_KEY_SET';
    }

    const r = await pool.query(
      `INSERT INTO secrets (key_name, value_encrypted, description, resource_type, resource_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, key_name, description, resource_type, resource_id, created_at`,
      [key_name.trim(), valueEncrypted, description || '', resource_type || null, resource_id || null]
    );

    res.status(201).json({
      ...r.rows[0],
      encryption_enabled: !!encryptionKey,
      message: encryptionKey
        ? 'Secret stored with AES-256-GCM encryption.'
        : 'Warning: ENCRYPTION_KEY is not set. Value was not stored.',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/secrets/:id — update a secret (re-encrypts value)
router.put('/:id', auth, async (req, res) => {
  try {
    const { key_name, value, description } = req.body;

    const existing = await pool.query('SELECT id FROM secrets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });

    const fields = [];
    const values = [];
    let idx = 1;

    if (key_name !== undefined) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key_name.trim())) {
        return res.status(400).json({ error: 'Invalid key_name format.' });
      }
      fields.push(`key_name=$${idx++}`); values.push(key_name.trim());
    }
    if (description !== undefined) { fields.push(`description=$${idx++}`); values.push(description); }
    if (value !== undefined) {
      const encryptionKey = getEncryptionKey();
      const encrypted = encryptionKey ? encrypt(String(value)) : 'NO_ENCRYPTION_KEY_SET';
      fields.push(`value_encrypted=$${idx++}`); values.push(encrypted);
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update.' });
    fields.push(`updated_at=NOW()`);
    values.push(req.params.id);

    const r = await pool.query(
      `UPDATE secrets SET ${fields.join(', ')} WHERE id=$${idx} RETURNING id, key_name, description, resource_type, resource_id, created_at, updated_at`,
      values
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/secrets/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM secrets WHERE id = $1 RETURNING id, key_name', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });
    res.json({ message: `Secret "${r.rows[0].key_name}" deleted successfully.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
