import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiSave, FiRotateCcw, FiSettings } from 'react-icons/fi';

export default function SandboxConfigEditor() {
  const [config, setConfig] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [persisted, setPersisted] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/custom-views/sandbox-config');
      setConfig(data.config);
      setDefaults(data.defaults);
      setPersisted(data.persisted);
      setUpdatedAt(data.updated_at);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Load failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/custom-views/sandbox-config', { config });
      setConfig(data.config);
      setUpdatedAt(data.updated_at);
      setPersisted(true);
      toast.success('Sandbox config saved');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const reset = () => { if (defaults) setConfig({ ...defaults }); };

  if (loading || !config) return <div className="card" style={{padding:20}}>Loading sandbox config...</div>;

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:15,fontWeight:700}}>
          <FiSettings style={{verticalAlign:'middle',marginRight:8}}/>Sandbox Config Editor
        </h3>
        <span style={{fontSize:11,color:'var(--text-muted)'}}>
          {persisted ? `saved ${updatedAt ? new Date(updatedAt).toLocaleString() : ''}` : 'using defaults'}
        </span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="CPU limit (cores)">
          <input value={config.cpu_limit || ''} onChange={e => upd('cpu_limit', e.target.value)} style={inp}/>
        </Field>
        <Field label="Memory limit (MB)">
          <input type="number" value={config.memory_limit_mb || 0}
                 onChange={e => upd('memory_limit_mb', parseInt(e.target.value) || 0)} style={inp}/>
        </Field>
        <Field label="Timeout (seconds)">
          <input type="number" value={config.timeout_seconds || 0}
                 onChange={e => upd('timeout_seconds', parseInt(e.target.value) || 0)} style={inp}/>
        </Field>
        <Field label="Max processes">
          <input type="number" value={config.max_processes || 0}
                 onChange={e => upd('max_processes', parseInt(e.target.value) || 0)} style={inp}/>
        </Field>
        <Field label="Default language">
          <select value={config.default_language || 'python'} onChange={e => upd('default_language', e.target.value)} style={inp}>
            {(config.allowed_languages || ['python','javascript','go','rust','shell']).map(l =>
              <option key={l} value={l}>{l}</option>
            )}
          </select>
        </Field>
        <Field label="Runtime version">
          <input value={config.default_runtime_version || ''} onChange={e => upd('default_runtime_version', e.target.value)} style={inp}/>
        </Field>
        <Field label="Output limit (KB)">
          <input type="number" value={config.output_limit_kb || 0}
                 onChange={e => upd('output_limit_kb', parseInt(e.target.value) || 0)} style={inp}/>
        </Field>
        <Field label="Allowed languages (comma-separated)">
          <input value={(config.allowed_languages || []).join(',')}
                 onChange={e => upd('allowed_languages', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                 style={inp}/>
        </Field>
      </div>

      <div style={{display:'flex',gap:14,marginTop:14}}>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
          <input type="checkbox" checked={!!config.network_enabled}
                 onChange={e => upd('network_enabled', e.target.checked)}/>
          Network enabled
        </label>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
          <input type="checkbox" checked={!!config.filesystem_writable}
                 onChange={e => upd('filesystem_writable', e.target.checked)}/>
          Filesystem writable
        </label>
      </div>

      <div style={{marginTop:14,display:'flex',gap:8}}>
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          <FiSave/> {saving ? 'Saving...' : 'Save Config'}
        </button>
        <button className="btn btn-secondary" onClick={reset}>
          <FiRotateCcw/> Reset to defaults
        </button>
      </div>

      <details style={{marginTop:14}}>
        <summary style={{cursor:'pointer',fontSize:12,color:'var(--text-secondary)'}}>Raw JSON</summary>
        <pre style={{background:'var(--bg-tertiary)',padding:12,borderRadius:8,marginTop:8,maxHeight:200,overflow:'auto',fontSize:11}}>
{JSON.stringify(config, null, 2)}
        </pre>
      </details>
    </div>
  );
}

const inp = {
  width:'100%',padding:8,borderRadius:6,
  background:'var(--bg-tertiary)',color:'var(--text-primary)',
  border:'1px solid var(--border)',fontFamily:'inherit',fontSize:12
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{fontSize:11,color:'var(--text-muted)',display:'block',marginBottom:4}}>{label}</label>
      {children}
    </div>
  );
}
