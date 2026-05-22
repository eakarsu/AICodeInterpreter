import React, { useState } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiDownload, FiPackage } from 'react-icons/fi';

export default function SnippetExportView() {
  const [language, setLanguage] = useState('');
  const [ids, setIds] = useState('');
  const [includeCode, setIncludeCode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const run = async (asDownload) => {
    setBusy(true); setPreview(null);
    try {
      const body = { include_code: includeCode };
      if (language) body.language = language;
      const parsedIds = ids.split(',').map(s => parseInt(s.trim())).filter(Boolean);
      if (parsedIds.length) body.ids = parsedIds;

      const { data } = await api.post('/custom-views/snippet-export', body);
      if (asDownload) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snippets-export-${Date.now()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${data.count} snippet(s)`);
      } else {
        setPreview(data);
        toast.success(`Previewed ${data.count} snippet(s)`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Export failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{padding:20}}>
      <h3 style={{fontSize:15,fontWeight:700,marginBottom:12}}>
        <FiPackage style={{verticalAlign:'middle',marginRight:8}}/>Snippet Export to JSON
      </h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)'}}>Language filter (optional)</label>
          <select value={language} onChange={e => setLanguage(e.target.value)}
                  style={{width:'100%',padding:8,borderRadius:6,background:'var(--bg-tertiary)',color:'var(--text-primary)',border:'1px solid var(--border)'}}>
            <option value="">(all)</option>
            {['python','javascript','typescript','go','rust','java','ruby','shell','sql'].map(l =>
              <option key={l} value={l}>{l}</option>
            )}
          </select>
        </div>
        <div>
          <label style={{fontSize:11,color:'var(--text-muted)'}}>IDs (comma-separated, optional)</label>
          <input value={ids} onChange={e => setIds(e.target.value)}
                 placeholder="e.g. 1,2,5"
                 style={{width:'100%',padding:8,borderRadius:6,background:'var(--bg-tertiary)',color:'var(--text-primary)',border:'1px solid var(--border)'}}/>
        </div>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginBottom:14}}>
        <input type="checkbox" checked={includeCode} onChange={e => setIncludeCode(e.target.checked)}/>
        Include source code in export
      </label>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-secondary" disabled={busy} onClick={() => run(false)}>
          Preview
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={() => run(true)}>
          <FiDownload/> Download JSON
        </button>
      </div>
      {preview && (
        <div style={{marginTop:14}}>
          <div style={{fontSize:12,color:'var(--text-secondary)',marginBottom:6}}>
            schema: <code>{preview.schema}</code> &mdash; {preview.count} snippet(s)
          </div>
          <pre style={{background:'var(--bg-tertiary)',padding:12,borderRadius:8,maxHeight:260,overflow:'auto',fontSize:11}}>
{JSON.stringify(preview, null, 2).slice(0, 4000)}
          </pre>
        </div>
      )}
    </div>
  );
}
