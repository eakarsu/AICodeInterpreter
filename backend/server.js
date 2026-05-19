require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
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
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ai', require('./routes/aiNew')); // Additional specialized AI endpoints
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
app.use('/api/ai-advanced', require('./routes/aiAdvanced'));
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


// === Batch 01 Gaps & Frontend Mounts ===
app.use('/api/gap-no-ai-auto-eda-dataset-profiler', require('./routes/gap_no_ai_auto_eda_dataset_profiler'));
app.use('/api/gap-no-ai-chart-recommendation-from-data-shape', require('./routes/gap_no_ai_chart_recommendation_from_data_shape'));
app.use('/api/gap-no-ai-agentic-notebook-write-run-fix-loop', require('./routes/gap_no_ai_agentic_notebook_write_run_fix_loop'));
app.use('/api/gap-no-ai-privacy-pii-scanner-over-datasets', require('./routes/gap_no_ai_privacy_pii_scanner_over_datasets'));
app.use('/api/gap-only-6-frontend-pages-despite-20-backend-routes-ui', require('./routes/gap_only_6_frontend_pages_despite_20_backend_routes_ui'));
app.use('/api/gap-notification-routes-exist-but-no-email-slack-deliv', require('./routes/gap_notification_routes_exist_but_no_email_slack_deliv'));
app.use('/api/gap-no-export-reporting-pdf-html-notebook-export-endpo', require('./routes/gap_no_export_reporting_pdf_html_notebook_export_endpo'));
app.use('/api/gap-no-ci-cd-or-scheduled-job-trigger-orchestration', require('./routes/gap_no_ci_cd_or_scheduled_job_trigger_orchestration'));
app.use('/api/gap-no-gpu-accelerator-quota-billing-ui', require('./routes/gap_no_gpu_accelerator_quota_billing_ui'));
app.use('/api/gap-no-real-time-collaborative-cursors-presence', require('./routes/gap_no_real_time_collaborative_cursors_presence'));

// Interpreter Views — 4 custom synthesized endpoints (2 viz + 2 non-viz)
app.use('/api/custom-views', require('./routes/customViews'));
