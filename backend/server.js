require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET must be at least 32 characters');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./db');
const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const corsOrigins = (process.env.CORS_ORIGIN || `http://localhost:${process.env.FRONTEND_PORT || 3000}`)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
// LLM analysis only; the API does not execute submitted code.
app.use('/api/ai', require('./routes/aiNew'));
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
app.use('/api/governed-jobs', require('./routes/governedJobs'));
// Audit-recommended additions (notifications, webhooks)
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/webhooks', require('./routes/webhooks'));

// GET /api/stats — quick summary counts (public dashboard)
app.get('/api/stats', require('./middleware/auth'), async (req, res) => {
  try {
    const tables = [
      { key: 'snippets', table: 'code_snippets' },
      { key: 'executions', table: 'executions' },
      { key: 'reviews', table: 'code_reviews' },
      { key: 'users', table: 'users' },
      { key: 'notebooks', table: 'notebooks' },
      { key: 'templates', table: 'code_templates' },
      { key: 'secrets', table: 'secrets' },
      { key: 'collaborators', table: 'collaborators' },
    ];
    const stats = {};
    for (const t of tables) {
      try {
        const r = await pool.query(`SELECT COUNT(*) FROM ${t.table}`);
        stats[t.key] = parseInt(r.rows[0].count);
      } catch (_) { stats[t.key] = 0; }
    }
    res.json({ stats, generated_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

app.use('/api/data-analyst-agent', require('./routes/dataAnalystAgent')); // apply pass 6 — audit custom suggestion

app.use('/api/notebook-rag', require('./routes/notebookRag')); // apply pass 6 — audit custom suggestion

app.use('/api/shared-kernel', require('./routes/sharedKernelPresence')); // apply pass 6 — audit custom suggestion

app.use('/api/enterprise-ds-white-label', require('./routes/enterpriseDsWhiteLabel')); // apply pass 6 — audit custom suggestion
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));


// Interpreter Views — 4 custom synthesized endpoints (2 viz + 2 non-viz)
app.use('/api/custom-views', require('./routes/customViews'));
app.use('/api/sandbox-risk', require('./routes/sandboxRiskScanner'));
