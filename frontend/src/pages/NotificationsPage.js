import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiBell, FiPlus, FiTrash2, FiCheck, FiCheckCircle } from 'react-icons/fi';

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', type: 'info', user_id: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notifications');
      const list = Array.isArray(data) ? data : (data.notifications || data.items || data.data || []);
      setItems(list);
      try {
        const c = await api.get('/notifications/unread-count');
        setUnread(c.data.count ?? c.data.unread ?? 0);
      } catch (_) {
        setUnread(list.filter(n => !(n.read || n.is_read)).length);
      }
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = { ...form };
      if (!body.user_id) delete body.user_id;
      await api.post('/notifications', body);
      toast.success('Notification created');
      setShowForm(false);
      setForm({ title: '', message: '', type: 'info', user_id: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); load(); }
    catch { toast.error('Failed'); }
  };

  const markAllRead = async () => {
    try { await api.post('/notifications/mark-all-read'); load(); toast.success('All marked read'); }
    catch { toast.error('Failed'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try { await api.delete(`/notifications/${id}`); load(); toast.success('Deleted'); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title"><FiBell style={{verticalAlign:'middle',marginRight:8}}/>Notifications</h1>
          <p className="page-subtitle">{unread} unread</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={markAllRead}><FiCheckCircle/> Mark all read</button>
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}><FiPlus/> {showForm ? 'Cancel' : 'New'}</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={create} className="card" style={{padding:20, marginBottom:20, maxWidth:600}}>
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} required rows={3} />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="form-group">
            <label>User ID (optional)</label>
            <input value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="loading"><div className="spinner"></div>Loading notifications...</div>
      ) : (
        <div className="card" style={{padding:0}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Message</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(n => (
                <tr key={n.id}>
                  <td><strong>{n.title}</strong></td>
                  <td>{n.message}</td>
                  <td>{n.type || 'info'}</td>
                  <td>{(n.read || n.is_read) ? 'read' : 'unread'}</td>
                  <td>{n.created_at ? new Date(n.created_at).toLocaleString() : '-'}</td>
                  <td>
                    {!(n.read || n.is_read) && (
                      <button className="btn btn-sm" onClick={() => markRead(n.id)}><FiCheck/></button>
                    )}{' '}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(n.id)}><FiTrash2/></button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} style={{textAlign:'center', padding:24, color:'var(--text-muted, #71717a)'}}>No notifications</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
