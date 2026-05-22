import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { FiDownload, FiFileText } from 'react-icons/fi';

export default function NotebookPdfExportView() {
  const [notebooks, setNotebooks] = useState([]);
  const [notebookId, setNotebookId] = useState('');
  const [includeExec, setIncludeExec] = useState(true);
  const [format, setFormat] = useState('html');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [error, setError] = useState(null);

  const loadNotebooks = useCallback(async () => {
    try {
      const { data } = await api.get('/notebooks?limit=50');
      const list = data?.data || data || [];
      setNotebooks(list);
      if (list[0]) setNotebookId(String(list[0].id));
    } catch (e) { /* tolerate */ }
  }, []);

  useEffect(() => { loadNotebooks(); }, [loadNotebooks]);

  const doExport = async () => {
    setBusy(true); setError(null); setLast(null);
    try {
      const body = {
        notebook_id: notebookId ? Number(notebookId) : undefined,
        include_executions: includeExec,
        format,
      };
      const resp = await api.post('/custom-views/notebook-pdf-export', body, {
        responseType: 'blob',
      });
      const blob = resp.data;
      const url = URL.createObjectURL(blob);
      const ext = format === 'json' ? 'json' : 'html';
      const a = document.createElement('a');
      a.href = url;
      a.download = `notebook-${notebookId || 'session'}.${ext}`;
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
      setLast({ at: new Date().toISOString(), size: blob.size, type: blob.type });
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{padding:20}} data-view="notebook-pdf-export">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:15,fontWeight:700}}><FiFileText/> Notebook Session PDF Export</h3>
      </div>
      <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>
        Export a notebook session (cells + recent executions) as a print-to-PDF friendly HTML
        document, or as a JSON bundle.
      </p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginBottom:14}}>
        <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12}}>
          <span style={{color:'var(--text-muted)'}}>Notebook</span>
          <select className="form-input" value={notebookId} onChange={e => setNotebookId(e.target.value)}>
            <option value="">— most recent —</option>
            {notebooks.map(n => (
              <option key={n.id} value={n.id}>#{n.id} · {n.title}</option>
            ))}
          </select>
        </label>
        <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:12}}>
          <span style={{color:'var(--text-muted)'}}>Format</span>
          <select className="form-input" value={format} onChange={e => setFormat(e.target.value)}>
            <option value="html">HTML (print to PDF)</option>
            <option value="json">JSON bundle</option>
          </select>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginTop:20}}>
          <input type="checkbox" checked={includeExec} onChange={e => setIncludeExec(e.target.checked)}/>
          Include recent executions
        </label>
      </div>

      <button className="btn btn-primary" disabled={busy} onClick={doExport} data-action="export">
        <FiDownload/> {busy ? 'Exporting...' : 'Export Notebook Session'}
      </button>

      {error && <div style={{marginTop:10,color:'var(--danger)',fontSize:12}}>Error: {error}</div>}
      {last && (
        <div style={{marginTop:10,fontSize:12,color:'var(--text-muted)'}}>
          Exported at {last.at} · {Math.round(last.size/1024)} KB · {last.type}
        </div>
      )}
    </div>
  );
}
