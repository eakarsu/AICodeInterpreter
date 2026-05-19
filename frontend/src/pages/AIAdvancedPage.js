import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import { toast } from 'react-toastify';
import {
  FiPlay, FiGitBranch, FiActivity, FiCopy, FiBookOpen, FiUsers,
} from 'react-icons/fi';

const TOOLS = [
  {
    id: 'sandbox-execute',
    name: 'Sandbox Execute',
    desc: 'Real or simulated code execution.',
    icon: <FiPlay />,
    endpoint: '/ai-advanced/sandbox-execute',
    fields: [
      { name: 'code', label: 'Code', type: 'textarea', required: true },
      {
        name: 'language', label: 'Language', type: 'select',
        options: ['python', 'javascript', 'typescript', 'go', 'rust', 'java', 'ruby', 'shell'],
      },
      { name: 'stdin', label: 'STDIN', type: 'textarea' },
    ],
  },
  {
    id: 'review-diff',
    name: 'Review Diff',
    desc: 'Compare two versions; track improvements.',
    icon: <FiGitBranch />,
    endpoint: '/ai-advanced/review-diff',
    fields: [
      { name: 'previous_code', label: 'Previous Code', type: 'textarea', required: true },
      { name: 'current_code', label: 'Current Code', type: 'textarea', required: true },
      { name: 'language', label: 'Language' },
    ],
  },
  {
    id: 'performance-profile',
    name: 'Performance Profiler',
    desc: 'Hotspots, optimisations ranked, benchmark estimate.',
    icon: <FiActivity />,
    endpoint: '/ai-advanced/performance-profile',
    fields: [
      { name: 'code', label: 'Code', type: 'textarea', required: true },
      {
        name: 'language', label: 'Language', type: 'select',
        options: ['python', 'javascript', 'typescript', 'go', 'rust', 'java', 'ruby', 'sql'],
      },
      { name: 'target_input_size', label: 'Target input size (n)', type: 'number' },
    ],
  },
  {
    id: 'clone-detect',
    name: 'Clone Detector',
    desc: 'Cluster duplicated logic across snippets.',
    icon: <FiCopy />,
    endpoint: '/ai-advanced/clone-detect',
    fields: [
      { name: 'snippet_ids', label: 'Snippet IDs (comma) or empty for latest 25' },
      { name: 'min_similarity', label: 'Min similarity (0-1, default 0.6)', type: 'number' },
    ],
    transform: (form) => ({
      snippet_ids: form.snippet_ids
        ? String(form.snippet_ids).split(',').map((s) => Number(s.trim())).filter(Boolean)
        : undefined,
      min_similarity: form.min_similarity ? Number(form.min_similarity) : 0.6,
    }),
  },
  {
    id: 'docs-refresh',
    name: 'Docs Refresher',
    desc: 'Refresh stale docs/README from current code.',
    icon: <FiBookOpen />,
    endpoint: '/ai-advanced/docs-refresh',
    fields: [
      { name: 'code', label: 'Code', type: 'textarea', required: true },
      { name: 'current_docs', label: 'Current Docs (optional)', type: 'textarea' },
      { name: 'language', label: 'Language' },
      { name: 'file_path', label: 'File Path (optional)' },
    ],
  },
  {
    id: 'collab-review',
    name: 'Collaborative Review',
    desc: 'Aggregate multi-reviewer feedback into consensus + conflicts.',
    icon: <FiUsers />,
    endpoint: '/ai-advanced/collab-review',
    fields: [
      { name: 'code', label: 'Code', type: 'textarea', required: true },
      { name: 'language', label: 'Language' },
      {
        name: 'reviews_text',
        label: 'Reviews (one per line: reviewer | comment)',
        type: 'textarea',
        required: true,
        placeholder: 'alice | This violates SRP\nbob | Looks fine to me',
      },
    ],
    transform: (form) => {
      const reviews = String(form.reviews_text || '')
        .split('\n')
        .map((line) => {
          const [reviewer, ...rest] = line.split('|');
          return { reviewer: (reviewer || '').trim(), comment: rest.join('|').trim() };
        })
        .filter((r) => r.comment);
      return {
        code: form.code,
        language: form.language || 'unknown',
        reviews,
      };
    },
  },
];

export default function AIAdvancedPage() {
  const [active, setActive] = useState(TOOLS[0]);
  const [form, setForm] = useState({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const payload = active.transform ? active.transform(form) : form;
      const { data } = await api.post(active.endpoint, payload);
      setResult(data);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
    setRunning(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Advanced Tools</h1>
          <p className="page-subtitle">{TOOLS.length} non-CRUD AI workflows</p>
        </div>
      </div>

      <div className="ai-tools-grid">
        {TOOLS.map((t) => (
          <div
            key={t.id}
            className={`ai-tool-card ${active.id === t.id ? 'active' : ''}`}
            onClick={() => {
              setActive(t);
              setForm({});
              setResult(null);
            }}
          >
            <div className="ai-tool-icon">{t.icon}</div>
            <div className="ai-tool-name">{t.name}</div>
            <div className="ai-tool-desc">{t.desc}</div>
          </div>
        ))}
      </div>

      <div className="ai-chat-container">
        <form
          className="ai-form"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="ai-form-row">
            {active.fields.map((f) => (
              <div
                className="form-group"
                key={f.name}
                style={f.type === 'textarea' ? { gridColumn: '1/-1' } : {}}
              >
                <label className="form-label">
                  {f.label}
                  {f.required && ' *'}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    className="form-textarea"
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
                    value={form[f.name] || ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    required={f.required}
                  />
                ) : f.type === 'select' ? (
                  <select
                    className="form-select"
                    value={form[f.name] || ''}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    type={f.type || 'text'}
                    value={form[f.name] || ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    required={f.required}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={running}
            style={{ alignSelf: 'flex-start' }}
          >
            {running ? 'Running...' : `Run ${active.name}`}
          </button>
        </form>

        {result && (
          <div className="chat-message assistant" style={{ marginTop: 18 }}>
            <div className="chat-avatar">$</div>
            <div className="chat-content">
              <ReactMarkdown>
                {'```json\n' + JSON.stringify(result, null, 2) + '\n```'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
