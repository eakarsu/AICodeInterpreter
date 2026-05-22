import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { FiRefreshCw } from 'react-icons/fi';

export default function ExecutionTimelineView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/custom-views/execution-timeline?limit=60');
      setData(data);
      if (data?.sessions?.length) setSelected(data.sessions[0].session_id);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="card" style={{padding:20}}>Loading timeline...</div>;
  if (error) return <div className="card" style={{padding:20,color:'var(--danger)'}}>Error: {error}</div>;

  const sessions = data?.sessions || [];
  const current = sessions.find(s => String(s.session_id) === String(selected)) || sessions[0] || { events: [], summary: {} };
  const events = current.events || [];
  const max = Math.max(1, ...events.map(e => e.duration_ms));

  const W = 760, H = 220, padL = 40, padB = 28;
  const barW = events.length ? Math.max(6, (W - padL - 12) / events.length - 4) : 10;

  return (
    <div className="card" style={{padding:20}} data-view="execution-timeline">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:15,fontWeight:700}}>Per-Session Execution Timeline</h3>
        <button className="btn btn-sm btn-secondary" onClick={load}><FiRefreshCw/> Refresh</button>
      </div>

      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
        {sessions.map(s => (
          <button key={s.session_id}
                  className={`btn btn-sm ${String(s.session_id)===String(selected)?'btn-primary':'btn-secondary'}`}
                  onClick={() => setSelected(s.session_id)}
                  data-session={s.session_id}>
            #{s.session_id} · {s.title?.slice(0,28) || 'Session'} ({s.summary?.total || 0})
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,marginBottom:14}}>
        <Stat label="Session Total" value={current.summary?.total || 0}/>
        <Stat label="Success" value={current.summary?.success || 0} color="var(--success)"/>
        <Stat label="Failed" value={current.summary?.failed || 0} color="var(--danger)"/>
        <Stat label="Avg ms" value={current.summary?.avg_ms || 0}/>
        <Stat label="Max ms" value={current.summary?.max_ms || 0}/>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{background:'var(--bg-tertiary)',borderRadius:8}}>
        <line x1={padL} y1={H-padB} x2={W-4} y2={H-padB} stroke="#334155" strokeWidth="1"/>
        {[0,0.5,1].map((p,i) => (
          <g key={i}>
            <text x={4} y={(H-padB) - p*(H-padB-12) + 4} fontSize="9" fill="#94a3b8">
              {Math.round(max*p)}
            </text>
            <line x1={padL} y1={(H-padB) - p*(H-padB-12)} x2={W-4} y2={(H-padB) - p*(H-padB-12)} stroke="#1e293b" strokeWidth="1"/>
          </g>
        ))}
        {events.map((e, i) => {
          const h = ((e.duration_ms / max) * (H - padB - 12)) || 2;
          const x = padL + 4 + i * (barW + 4);
          const y = (H - padB) - h;
          const ok = e.status !== 'failed' && (e.exit_code === 0 || e.exit_code == null);
          return (
            <rect key={e.id} x={x} y={y} width={barW} height={h}
                  fill={ok ? '#10b981' : '#ef4444'} rx="2">
              <title>{`#${e.id} ${e.language} ${e.duration_ms}ms`}</title>
            </rect>
          );
        })}
        <text x={padL} y={H-8} fontSize="10" fill="#64748b">oldest -&gt; newest</text>
      </svg>

      <div style={{marginTop:12,maxHeight:160,overflow:'auto'}}>
        <table className="data-table" style={{width:'100%',fontSize:12}}>
          <thead><tr><th>ID</th><th>Language</th><th>Status</th><th>ms</th><th>MB</th><th>When</th></tr></thead>
          <tbody>
            {events.slice().reverse().slice(0, 10).map(e => (
              <tr key={e.id}>
                <td>#{e.id}</td>
                <td>{e.language}</td>
                <td><span style={{color: e.status==='failed' ? 'var(--danger)':'var(--success)'}}>{e.status}</span></td>
                <td>{e.duration_ms}</td>
                <td>{e.memory_mb}</td>
                <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '-'}</td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={6} style={{textAlign:'center',padding:14,color:'var(--text-muted)'}}>No executions in this session</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{background:'var(--bg-tertiary)',borderRadius:8,padding:'10px 12px'}}>
      <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1}}>{label}</div>
      <div style={{fontSize:20,fontWeight:700,color:color||'var(--text-primary)'}}>{value}</div>
    </div>
  );
}
