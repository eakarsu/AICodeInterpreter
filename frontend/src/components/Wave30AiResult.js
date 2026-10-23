import React from 'react';
export function fmtVal(v){if(v===false)return 'false';if(v===true)return 'true';if(v===0)return '0';if(v===''||v===null||v===undefined)return '(empty)';if(typeof v==='object')return JSON.stringify(v);return String(v);}
export default function Wave30AiResult({result}){
  if(!result)return null;
  const sections=Array.isArray(result.sections)?result.sections:[];
  return (<div data-testid="wave30-ai-result" style={{border:'1px solid #ddd',borderRadius:8,padding:12,marginTop:12}}>
    <div><strong>{result.feature||'AI result'}</strong>{result.aiGenerated===false?' — deterministic fallback (no AI provider configured)':result.aiGenerated===true?' — AI-generated':''}</div>
    <div style={{fontSize:12,opacity:0.8}}>Source: {fmtVal(result.source)}</div>
    {sections.length===0?<p>(empty)</p>:sections.map((s,i)=>(<div key={i} style={{marginTop:6}}><span style={{fontWeight:600}}>{s.label}: </span><span>{fmtVal(s.value)}</span></div>))}
  </div>);
}
