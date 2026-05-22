import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { FiRefreshCw } from 'react-icons/fi';

export default function LanguageDistributionDonut() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.get('/custom-views/language-distribution');
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="card" style={{padding:20}}>Loading language distribution...</div>;
  if (error) return <div className="card" style={{padding:20,color:'var(--danger)'}}>Error: {error}</div>;

  const slices = data?.slices || [];
  const total = data?.summary?.total_runs || 0;

  // SVG donut geometry
  const cx = 120, cy = 120, R = 95, r = 60;
  const polar = (pct) => {
    const ang = (pct / 100) * 2 * Math.PI - Math.PI / 2;
    return { x: Math.cos(ang), y: Math.sin(ang) };
  };
  const arcPath = (s) => {
    const a = polar(s.start_pct), b = polar(s.end_pct);
    const large = (s.end_pct - s.start_pct) > 50 ? 1 : 0;
    return [
      `M ${cx + a.x*R} ${cy + a.y*R}`,
      `A ${R} ${R} 0 ${large} 1 ${cx + b.x*R} ${cy + b.y*R}`,
      `L ${cx + b.x*r} ${cy + b.y*r}`,
      `A ${r} ${r} 0 ${large} 0 ${cx + a.x*r} ${cy + a.y*r}`,
      'Z',
    ].join(' ');
  };

  return (
    <div className="card" style={{padding:20}} data-view="language-distribution">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <h3 style={{fontSize:15,fontWeight:700}}>Language Distribution</h3>
        <button className="btn btn-sm btn-secondary" onClick={load}><FiRefreshCw/> Refresh</button>
      </div>

      <div style={{display:'flex',gap:24,flexWrap:'wrap',alignItems:'center'}}>
        <svg viewBox="0 0 240 240" width="240" height="240">
          {slices.length === 0 && (
            <>
              <circle cx={cx} cy={cy} r={R} fill="none" stroke="#334155" strokeWidth="35"/>
              <text x={cx} y={cy} textAnchor="middle" fontSize="14" fill="#94a3b8">No data</text>
            </>
          )}
          {slices.map((s) => (
            <path key={s.language} d={arcPath(s)}
                  fill={s.color}
                  opacity={hover && hover !== s.language ? 0.35 : 1}
                  onMouseEnter={() => setHover(s.language)}
                  onMouseLeave={() => setHover(null)}>
              <title>{`${s.language}: ${s.runs} runs (${s.percent}%)`}</title>
            </path>
          ))}
          <text x={cx} y={cy-6} textAnchor="middle" fontSize="22" fontWeight="700" fill="#e2e8f0">{total}</text>
          <text x={cx} y={cy+14} textAnchor="middle" fontSize="11" fill="#94a3b8">total runs</text>
        </svg>

        <div style={{flex:1,minWidth:220}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:8,marginBottom:14}}>
            <Stat label="Languages" value={data?.summary?.languages || 0}/>
            <Stat label="Top" value={data?.summary?.top || '-'}/>
            <Stat label="Top Share" value={`${data?.summary?.top_share_pct || 0}%`}/>
          </div>
          <table className="data-table" style={{width:'100%',fontSize:12}}>
            <thead><tr><th></th><th>Language</th><th>Runs</th><th>%</th><th>Avg ms</th></tr></thead>
            <tbody>
              {slices.map(s => (
                <tr key={s.language}
                    style={{background: hover===s.language ? 'var(--bg-tertiary)' : 'transparent'}}>
                  <td><span style={{display:'inline-block',width:10,height:10,background:s.color,borderRadius:2}}/></td>
                  <td>{s.language}</td>
                  <td>{s.runs}</td>
                  <td>{s.percent}%</td>
                  <td>{s.avg_time_ms}</td>
                </tr>
              ))}
              {slices.length === 0 && <tr><td colSpan={5} style={{padding:12,textAlign:'center',color:'var(--text-muted)'}}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{background:'var(--bg-tertiary)',borderRadius:8,padding:'10px 12px'}}>
      <div style={{fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1}}>{label}</div>
      <div style={{fontSize:18,fontWeight:700}}>{value}</div>
    </div>
  );
}
