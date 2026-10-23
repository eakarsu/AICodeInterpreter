import React,{useEffect,useState,useCallback} from 'react';
import Wave30AiResult from '../components/Wave30AiResult';
const hdrs=()=>({'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('token')||'')});
export default function Wave30Page(){
  const [tasks,setTasks]=useState([]);const [title,setTitle]=useState('');const [search,setSearch]=useState('');const [ai,setAi]=useState(null);const [err,setErr]=useState('');
  const load=useCallback(async()=>{try{const r=await fetch('/api/wave30/tasks',{headers:hdrs()});const d=await r.json();setTasks(Array.isArray(d.data)?d.data:[]);}catch(e){setErr(e.message);}},[]);
  useEffect(()=>{load();},[load]);
  async function create(e){e.preventDefault();const r=await fetch('/api/wave30/tasks',{method:'POST',headers:hdrs(),body:JSON.stringify({title})});if(r.ok){setTitle('');load();}else{const d=await r.json().catch(()=>({}));setErr(d.error||'Create failed');}}
  async function toggle(t){await fetch('/api/wave30/tasks/'+t.id,{method:'PATCH',headers:hdrs(),body:JSON.stringify({status:t.status==='done'?'open':'done'})});load();}
  async function runAi(kind){const r=await fetch('/api/wave30/ai/'+kind,{method:'POST',headers:hdrs(),body:JSON.stringify({})});setAi(await r.json());}
  async function download(fmt){const q=new URLSearchParams({format:fmt});if(search)q.set('search',search);const r=await fetch('/api/wave30/records/export?'+q,{headers:hdrs()});const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='records.'+fmt;a.click();}
  const visible=tasks.filter(t=>!search||(t.title+' '+(t.description||'')).toLowerCase().includes(search.toLowerCase()));
  return (<div style={{padding:20,maxWidth:900}}>
    <h1>Tasks, Export &amp; AI Summaries</h1>{err?<p role="alert">{err}</p>:null}
    <form onSubmit={create}><input aria-label="Task title" value={title} onChange={e=>setTitle(e.target.value)} placeholder="New task title"/><button type="submit">Create task</button></form>
    <input aria-label="Search tasks" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search / filter tasks"/>
    <ul>{visible.map(t=>(<li key={t.id}>{t.title} — {t.status} <button onClick={()=>toggle(t)}>{t.status==='done'?'Reopen':'Mark done'}</button></li>))}</ul>
    {visible.length===0?<p>No tasks found.</p>:null}
    <h2>Export main records</h2><button onClick={()=>download('csv')}>Export CSV</button> <button onClick={()=>download('json')}>Export JSON</button>
    <h2>AI summaries (over your records)</h2>
    <button onClick={()=>runAi('portfolio-summary')}>Portfolio summary</button> <button onClick={()=>runAi('readiness-summary')}>Readiness summary</button> <button onClick={()=>runAi('coverage-summary')}>Coverage summary</button>
    <Wave30AiResult result={ai}/>
  </div>);
}
