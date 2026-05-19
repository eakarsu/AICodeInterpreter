import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiZap, FiPlus, FiTrash2, FiPlay } from 'react-icons/fi';

export default function WebhooksPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: '', active: true });
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/webhooks');
      setItems(Array.isArray(data) ? data : (data.webhooks || data.items || data.data || []));
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = {
        ...form,
        events: form.events.split(',').map(s => s.trim()).filter(Boolean),
      };
      await api.post('/webhooks', body);
      toast.success('Webhook created');
      setShowForm(false);
      setForm({ name: '', url: '', events: '', active: true });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    try { await api.delete(`/webhooks/${id}`); load(); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  const testDeliver = async (id) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await api.post(`/webhooks/${id}/test`, { event: 'test', payload: { hello: 'world' } });
      setTestResult({ id, ok: true, data: res.data });
      toast.success('Test dispatched');
    } catch (err) {
      setTestResult({ id, ok: false, data: err.response?.data || { error: err.message } });
      toast.error('Test failed');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FiZap style={{verticalAlign:'middle',marginRight:8}}/>Webhooks</h1>
          <p className="page-subtitle">Outbound webhook registry</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          <FiPlus/> {showForm ? 'Cancel' : 'New Webhook'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card" style={{padding:20, marginBottom:20, maxWidth:600}}>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>URL</label>
            <input type="url" value={form.url} onChange={e => setForm({...form, url: e.target.value})} required placeholder="https://..." />
          </div>
          <div className="form-group">
            <label>Events (comma-separated)</label>
            <input value={form.events} onChange={e => setForm({...form, events: e.target.value})} placeholder="execution.completed, snippet.created" />
          </div>
          <div className="form-group">
            <label style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />
              Active
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {testResult && (
        <div className="card" style={{padding:16, marginBottom:20, borderColor: testResult.ok ? '#22c55e' : '#ef4444'}}>
          <strong>Test #{testResult.id}: {testResult.ok ? 'OK' : 'Failed'}</strong>
          <pre style={{overflow:'auto', fontSize:12, marginTop:8, maxHeight:240}}>
            {JSON.stringify(testResult.data, null, 2)}
          </pre>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner"></div>Loading webhooks...</div>
      ) : (
        <div className="card" style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Events</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(w => (
                <tr key={w.id}>
                  <td><strong>{w.name}</strong></td>
                  <td><span style={{display:'inline-block', maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{w.url}</span></td>
                  <td>{Array.isArray(w.events) ? w.events.join(', ') : (w.events || '-')}</td>
                  <td>{w.active ? 'yes' : 'no'}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => testDeliver(w.id)} disabled={testing === w.id}>
                      <FiPlay/> {testing === w.id ? 'Testing...' : 'Test'}
                    </button>{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(w.id)}><FiTrash2/></button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} style={{textAlign:'center', padding:24, color:'var(--text-muted, #71717a)'}}>No webhooks</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
