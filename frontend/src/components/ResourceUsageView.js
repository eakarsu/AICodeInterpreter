import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { FiRefreshCw } from 'react-icons/fi';

export default function ResourceUsageView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get('/custom-views/resource-usage');
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="card" style={{padding:20}}>Loading resource usage...</div>;
  if (error) return <div className="card" style={{padding:20,color:'var(--danger)'}}>Error: {error}</div>;

  const langs = data?.languages || [];
  const maxTime = Math.max(1, ...langs.map(l => l.avg_time_ms));
  const maxMem = Math.max(1, ...langs.map(l => l.avg_memory_mb));
  const W = 760, rowH = 32, padL = 110, padR = 60;
  const H = Math.max(120, langs.length * rowH + 40);

  return (
    <div className="card" style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:15,fontWeight:700}}>Resource Usage by Language</h3>
        <button className="btn btn-sm btn-secondary" onClick={load}><FiRefreshCw/> Refresh</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,marginBottom:14}}>
        <Stat label="Total runs" value={data?.summary?.total_runs || 0}/>
        <Stat label="Avg time (ms)" value={data?.summary?.weighted_avg_time_ms || 0}/>
        <Stat label="Avg memory (MB)" value={data?.summary?.weighted_avg_memory_mb || 0}/>
        <Stat label="Languages" value={data?.summary?.languages || 0}/>
      </div>

      {langs.length === 0 ? (
        <div style={{padding:24,textAlign:'center',color:'var(--text-muted)'}}>No execution data yet</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{background:'var(--bg-tertiary)',borderRadius:8}}>
          {langs.map((l, i) => {
            const y = 20 + i * rowH;
            const tBar = ((l.avg_time_ms / maxTime) * (W - padL - padR)) || 1;
            const mBar = ((l.avg_memory_mb / maxMem) * (W - padL - padR)) || 1;
            return (
              <g key={l.language}>
                <text x={8} y={y + 11} fontSize="11" fill="#cbd5e1">{l.language}</text>
                <rect x={padL} y={y} width={tBar} height={10} fill="#3b82f6" rx="2">
                  <title>{`avg ${l.avg_time_ms}ms over ${l.runs} runs`}</title>
                </rect>
                <rect x={padL} y={y + 12} width={mBar} height={10} fill="#8b5cf6" rx="2">
                  <title>{`avg ${l.avg_memory_mb}MB`}</title>
                </rect>
                <text x={W - padR + 4} y={y + 9} fontSize="10" fill="#94a3b8">{l.avg_time_ms}ms</text>
                <text x={W - padR + 4} y={y + 21} fontSize="10" fill="#94a3b8">{l.avg_memory_mb}MB</text>
              </g>
            );
          })}
          <g transform={`translate(${padL}, ${H - 12})`}>
            <rect x={0} y={-8} width={10} height={8} fill="#3b82f6"/>
            <text x={14} y={-1} fontSize="10" fill="#cbd5e1">avg time</text>
            <rect x={80} y={-8} width={10} height={8} fill="#8b5cf6"/>
            <text x={94} y={-1} fontSize="10" fill="#cbd5e1">avg memory</text>
          </g>
        </svg>
      )}

      <div style={{marginTop:12,maxHeight:200,overflow:'auto'}}>
        <table className="data-table" style={{width:'100%',fontSize:12}}>
          <thead><tr><th>Language</th><th>Runs</th><th>Avg ms</th><th>Max ms</th><th>Avg MB</th><th>Max MB</th></tr></thead>
          <tbody>
            {langs.map(l => (
              <tr key={l.language}>
                <td>{l.language}</td>
                <td>{l.runs}</td>
                <td>{l.avg_time_ms}</td>
                <td>{l.max_time_ms}</td>
                <td>{l.avg_memory_mb}</td>
                <td>{l.max_memory_mb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{background:'var(--bg-tertiary)',borderRadius:8,padding:'10px 12px'}}>
      <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1}}>{label}</div>
      <div style={{fontSize:20,fontWeight:700}}>{value}</div>
    </div>
  );
}
