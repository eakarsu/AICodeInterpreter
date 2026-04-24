require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/snippets', require('./routes/snippets'));
app.use('/api/executions', require('./routes/executions'));
app.use('/api/notebooks', require('./routes/notebooks'));
app.use('/api/environments', require('./routes/environments'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/visualizations', require('./routes/visualizations'));
app.use('/api/datasets', require('./routes/datasets'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/history', require('./routes/history'));
app.use('/api/secrets', require('./routes/secrets'));
app.use('/api/collaborators', require('./routes/collaborators'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/settings', require('./routes/settings'));

// Dashboard stats
app.use('/api/dashboard', require('./middleware/auth'), async (req, res) => {
  try {
    const tables = [
      { key: 'snippets', table: 'code_snippets' },
      { key: 'executions', table: 'executions' },
      { key: 'notebooks', table: 'notebooks' },
      { key: 'environments', table: 'environments' },
      { key: 'packages', table: 'packages' },
      { key: 'visualizations', table: 'visualizations' },
      { key: 'datasets', table: 'datasets' },
      { key: 'reviews', table: 'code_reviews' },
      { key: 'templates', table: 'code_templates' },
      { key: 'history', table: 'execution_history' },
      { key: 'secrets', table: 'secrets' },
      { key: 'collaborators', table: 'collaborators' },
      { key: 'logs', table: 'execution_logs' },
    ];
    const stats = {};
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*) FROM ${t.table}`);
      stats[t.key] = parseInt(r.rows[0].count);
    }
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.BACKEND_PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
