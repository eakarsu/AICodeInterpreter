import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import { FiSend, FiTerminal, FiPlay, FiSearch, FiCode, FiAlertTriangle, FiBookOpen, FiRefreshCw, FiDatabase, FiRepeat } from 'react-icons/fi';

const tools = [
  { id:'chat', name:'Chat', desc:'Code assistant', icon:<FiTerminal/>, endpoint:'/ai/chat' },
  { id:'execute', name:'Execute', desc:'Run & interpret code', icon:<FiPlay/>, endpoint:'/ai/execute',
    fields:[
      {name:'code',label:'Code',type:'textarea',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','php','sql','shell']},
      {name:'context',label:'Context'},
    ]},
  { id:'review', name:'Review', desc:'Code review & analysis', icon:<FiSearch/>, endpoint:'/ai/review',
    fields:[
      {name:'code',label:'Code',type:'textarea',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','php']},
      {name:'review_type',label:'Review Type',type:'select',options:['full','security','performance','clean-code','bugs','architecture']},
    ]},
  { id:'generate', name:'Generate', desc:'Generate code from description', icon:<FiCode/>, endpoint:'/ai/generate',
    fields:[
      {name:'description',label:'Description',type:'textarea',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','shell']},
      {name:'framework',label:'Framework'},
      {name:'style',label:'Style',type:'select',options:['production-ready','prototype','minimal','documented','tested']},
    ]},
  { id:'debug', name:'Debug', desc:'Find & fix bugs', icon:<FiAlertTriangle/>, endpoint:'/ai/debug',
    fields:[
      {name:'code',label:'Code with Bug',type:'textarea',required:true},
      {name:'error_message',label:'Error Message',type:'textarea'},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby']},
    ]},
  { id:'explain', name:'Explain', desc:'Explain code step by step', icon:<FiBookOpen/>, endpoint:'/ai/explain',
    fields:[
      {name:'code',label:'Code to Explain',type:'textarea',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','sql']},
      {name:'detail_level',label:'Detail Level',type:'select',options:['beginner','intermediate','advanced','expert']},
    ]},
  { id:'refactor', name:'Refactor', desc:'Improve & optimize code', icon:<FiRefreshCw/>, endpoint:'/ai/refactor',
    fields:[
      {name:'code',label:'Code to Refactor',type:'textarea',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java']},
      {name:'goal',label:'Goal',type:'select',options:['modernize','performance','readability','patterns','functional','typescript']},
    ]},
  { id:'analyze-data', name:'Analyze Data', desc:'Data analysis code', icon:<FiDatabase/>, endpoint:'/ai/analyze-data',
    fields:[
      {name:'data_description',label:'Data Description',type:'textarea',required:true},
      {name:'question',label:'Question'},
      {name:'output_format',label:'Output Format',type:'select',options:['Python with pandas','R with tidyverse','SQL','Python with PySpark']},
    ]},
  { id:'convert', name:'Convert', desc:'Convert between languages', icon:<FiRepeat/>, endpoint:'/ai/convert',
    fields:[
      {name:'code',label:'Source Code',type:'textarea',required:true},
      {name:'from_language',label:'From',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','php','cpp']},
      {name:'to_language',label:'To',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','php','cpp']},
    ]},
];

export default function AIChatPage() {
  const [activeTool, setActiveTool] = useState(tools[0]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [form, setForm] = useState({});
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState(null);
  const messagesEnd = useRef(null);

  useEffect(() => { messagesEnd.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

  const sendChat = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role:'user', content:msg }]);
    setSending(true);
    try {
      const { data } = await api.post(activeTool.endpoint, { message:msg, conversation_id:convId });
      setConvId(data.conversation_id);
      setMessages(prev => [...prev, { role:'assistant', content:data.message, model:data.model, usage:data.usage }]);
    } catch (err) {
      setMessages(prev => [...prev, { role:'assistant', content:`Error: ${err.response?.data?.error || err.message}` }]);
    }
    setSending(false);
  };

  const sendTool = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    const desc = Object.entries(form).filter(([,v])=>v).map(([k,v])=>`**${k}:** ${v.length > 100 ? v.substring(0,100)+'...' : v}`).join('\n');
    setMessages(prev => [...prev, { role:'user', content:`[${activeTool.name}]\n${desc}` }]);
    try {
      const { data } = await api.post(activeTool.endpoint, form);
      setMessages(prev => [...prev, { role:'assistant', content:data.result, model:data.model, usage:data.usage }]);
      setForm({});
    } catch (err) {
      setMessages(prev => [...prev, { role:'assistant', content:`Error: ${err.response?.data?.error || err.message}` }]);
    }
    setSending(false);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Assistant</h1>
          <p className="page-subtitle">9 AI-powered code tools</p>
        </div>
      </div>

      <div className="ai-tools-grid">
        {tools.map(t => (
          <div key={t.id} className={`ai-tool-card ${activeTool.id === t.id ? 'active' : ''}`} onClick={() => { setActiveTool(t); setForm({}); }}>
            <div className="ai-tool-icon">{t.icon}</div>
            <div className="ai-tool-name">{t.name}</div>
            <div className="ai-tool-desc">{t.desc}</div>
          </div>
        ))}
      </div>

      <div className="ai-chat-container">
        {activeTool.fields && (
          <form className="ai-form" onSubmit={sendTool}>
            <div className="ai-form-row">
              {activeTool.fields.map(f => (
                <div className="form-group" key={f.name} style={f.type==='textarea'?{gridColumn:'1/-1'}:{}}>
                  <label className="form-label">{f.label}{f.required && ' *'}</label>
                  {f.type === 'textarea' ? (
                    <textarea className="form-textarea" style={{fontFamily:'JetBrains Mono, monospace',fontSize:13}} value={form[f.name]||''} placeholder={f.placeholder} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required} />
                  ) : f.type === 'select' ? (
                    <select className="form-select" value={form[f.name]||''} onChange={e=>setForm({...form,[f.name]:e.target.value})}>
                      <option value="">Select...</option>
                      {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" type={f.type||'text'} value={form[f.name]||''} placeholder={f.placeholder} onChange={e=>setForm({...form,[f.name]:e.target.value})} required={f.required} />
                  )}
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={sending} style={{alignSelf:'flex-start'}}>
              {sending ? 'Processing...' : `Run ${activeTool.name}`}
            </button>
          </form>
        )}

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">{'>'}_</div>
              <div className="empty-text">Start coding with the AI assistant</div>
              <p style={{color:'var(--text-muted)',fontSize:12}}>Select a tool above or start chatting</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-message ${m.role}`}>
              <div className="chat-avatar">{m.role === 'user' ? '>' : '$'}</div>
              <div className="chat-content">
                <ReactMarkdown>{m.content}</ReactMarkdown>
                {m.model && (
                  <div className="chat-meta">
                    <span>model: {m.model}</span>
                    {m.usage && <span>tokens: {m.usage.total_tokens}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="chat-message assistant">
              <div className="chat-avatar">$</div>
              <div className="chat-content"><div className="loading"><div className="spinner"></div>Processing...</div></div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {activeTool.id === 'chat' && (
          <div className="chat-input-area">
            <textarea className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask about code, algorithms, debugging, best practices..." rows={1} />
            <button className="btn btn-primary chat-send" onClick={sendChat} disabled={sending || !input.trim()}>
              <FiSend/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
