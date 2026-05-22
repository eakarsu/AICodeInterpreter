import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { FiRefreshCw, FiSave, FiTrash2, FiPlus } from 'react-icons/fi';

export default function ExecutionPolicyEditor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState({}); // name -> partial policy
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get('/custom-views/execution-policy');
      setData(data);
      const map = {};
      (data.policies || []).forEach(p => { map[p.name] = { ...p.policy }; });
      setEditing(map);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (name, key, value) => {
    setEditing(prev => ({
      ...prev,
      [name]: { ...prev[name], [key]: value },
    }));
  };

  const save = async (name) => {
    setBusy(true); setError(null);
    try {
      await api.put(`/custom-views/execution-policy/${encodeURIComponent(name)}`,
        { policy: editing[name] });
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  const remove = async (name) => {
    if (name === 'default') return;
    if (!window.confirm(`Delete policy "${name}"?`)) return;
    setBusy(true); setError(null);
    try {
      await api.delete(`/custom-views/execution-policy/${encodeURIComponent(name)}`);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!newName) return;
    setBusy(true); setError(null);
    try {
      await api.post('/custom-views/execution-policy', {
        name: newName,
        policy: data?.defaults || {},
      });
      setNewName('');
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  if (loading) return <div className="card" style={{padding:20}}>Loading policies...</div>;

  const policies = data?.policies || [];

  return (
    <div className="card" style={{padding:20}} data-view="execution-policy">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:15,fontWeight:700}}>Execution Policy / Limits Editor</h3>
        <button className="btn btn-sm btn-secondary" onClick={load}><FiRefreshCw/> Refresh</button>
      </div>
      <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:14}}>
        CRUD CPU / memory / timeout policies. Each policy applies to a labeled sandbox profile.
      </p>

      {error && <div style={{marginBottom:10,color:'var(--danger)',fontSize:12}}>Error: {error}</div>}

      <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center'}}>
        <input className="form-input" placeholder="new-policy-name"
               value={newName} onChange={e => setNewName(e.target.value)}
               style={{maxWidth:240}}/>
        <button className="btn btn-primary btn-sm" disabled={busy || !newName} onClick={create}
                data-action="create">
          <FiPlus/> Create Policy
        </button>
      </div>

      {policies.map(p => {
        const cur = editing[p.name] || p.policy;
        return (
          <div key={p.name} className="card"
               style={{padding:14,marginBottom:12,background:'var(--bg-tertiary)'}}
               data-policy={p.name}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div>
                <div style={{fontWeight:700}}>{p.name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>
                  {p.updated_at ? `Updated ${new Date(p.updated_at).toLocaleString()}` : 'Defaults (unsaved)'}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="btn btn-sm btn-primary" disabled={busy}
                        onClick={() => save(p.name)} data-action="save">
                  <FiSave/> Save
                </button>
                {p.name !== 'default' && (
                  <button className="btn btn-sm btn-danger" disabled={busy}
                          onClick={() => remove(p.name)} data-action="delete">
                    <FiTrash2/> Delete
                  </button>
                )}
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
              <Field label="CPU Limit (cores)" value={cur.cpu_limit}
                     onChange={v => update(p.name, 'cpu_limit', v)}/>
              <Field label="Memory (MB)" type="number" value={cur.memory_limit_mb}
                     onChange={v => update(p.name, 'memory_limit_mb', Number(v))}/>
              <Field label="Timeout (s)" type="number" value={cur.timeout_seconds}
                     onChange={v => update(p.name, 'timeout_seconds', Number(v))}/>
              <Field label="Max Processes" type="number" value={cur.max_processes}
                     onChange={v => update(p.name, 'max_processes', Number(v))}/>
              <Field label="Output Limit (KB)" type="number" value={cur.output_limit_kb}
                     onChange={v => update(p.name, 'output_limit_kb', Number(v))}/>
              <Field label="Default Language" value={cur.default_language}
                     onChange={v => update(p.name, 'default_language', v)}/>
              <Toggle label="Network Enabled" value={!!cur.network_enabled}
                      onChange={v => update(p.name, 'network_enabled', v)}/>
              <Toggle label="Filesystem Writable" value={!!cur.filesystem_writable}
                      onChange={v => update(p.name, 'filesystem_writable', v)}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:11}}>
      <span style={{color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:0.5}}>{label}</span>
      <input className="form-input" type={type} value={value ?? ''}
             onChange={e => onChange(e.target.value)}/>
    </label>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginTop:18}}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)}/>
      {label}
    </label>
  );
}
