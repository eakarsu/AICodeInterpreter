import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiGrid, FiCode, FiPlay, FiBook, FiBox, FiPackage, FiBarChart2, FiDatabase, FiSearch, FiCopy, FiClock, FiLock, FiUsers, FiFileText, FiSettings, FiTerminal, FiChevronLeft, FiChevronRight, FiLogOut } from 'react-icons/fi';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CrudPage from './components/CrudPage';
import AIChatPage from './pages/AIChatPage';

const pages = [
  { path:'/snippets', label:'Code Snippets', icon:<FiCode/>, api:'snippets',
    columns:['title','language','status','run_count','is_public'],
    fields:[
      {name:'title',label:'Title',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','php','cpp','sql','shell','yaml']},
      {name:'code',label:'Code',type:'textarea'},
      {name:'description',label:'Description',type:'textarea'},
      {name:'tags',label:'Tags'},
      {name:'is_public',label:'Public',type:'select',options:['true','false']},
      {name:'status',label:'Status',type:'select',options:['active','archived','draft']},
    ]},
  { path:'/executions', label:'Executions', icon:<FiPlay/>, api:'executions',
    columns:['snippet_id','language','status','exit_code','execution_time_ms','memory_used_mb'],
    fields:[
      {name:'snippet_id',label:'Snippet ID',type:'number'},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','shell']},
      {name:'code',label:'Code',type:'textarea'},
      {name:'status',label:'Status',type:'select',options:['pending','running','completed','failed','timeout']},
      {name:'exit_code',label:'Exit Code',type:'number'},
      {name:'stdout',label:'Stdout',type:'textarea'},
      {name:'stderr',label:'Stderr',type:'textarea'},
      {name:'execution_time_ms',label:'Exec Time (ms)',type:'number'},
      {name:'memory_used_mb',label:'Memory (MB)',type:'number'},
    ]},
  { path:'/notebooks', label:'Notebooks', icon:<FiBook/>, api:'notebooks',
    columns:['title','language','cell_count','status','tags'],
    fields:[
      {name:'title',label:'Title',required:true},
      {name:'description',label:'Description',type:'textarea'},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','r','julia','sql']},
      {name:'cell_count',label:'Cell Count',type:'number'},
      {name:'status',label:'Status',type:'select',options:['active','archived','draft']},
      {name:'tags',label:'Tags'},
    ]},
  { path:'/environments', label:'Environments', icon:<FiBox/>, api:'environments',
    columns:['name','runtime','version','status','memory_limit','timeout_seconds'],
    fields:[
      {name:'name',label:'Name',required:true},
      {name:'runtime',label:'Runtime',type:'select',options:['python','nodejs','go','rust','typescript','java','ruby','php','cpp','r','shell','multi']},
      {name:'version',label:'Version'},
      {name:'description',label:'Description',type:'textarea'},
      {name:'status',label:'Status',type:'select',options:['active','inactive','maintenance']},
      {name:'memory_limit',label:'Memory Limit'},
      {name:'timeout_seconds',label:'Timeout (sec)',type:'number'},
    ]},
  { path:'/packages', label:'Packages', icon:<FiPackage/>, api:'packages',
    columns:['name','version','language','license','downloads','status'],
    fields:[
      {name:'name',label:'Name',required:true},
      {name:'version',label:'Version'},
      {name:'language',label:'Language',type:'select',options:['python','javascript','go','rust','java','ruby']},
      {name:'description',label:'Description',type:'textarea'},
      {name:'install_command',label:'Install Command'},
      {name:'homepage',label:'Homepage'},
      {name:'license',label:'License'},
      {name:'downloads',label:'Downloads',type:'number'},
      {name:'status',label:'Status',type:'select',options:['installed','available','outdated','deprecated']},
    ]},
  { path:'/visualizations', label:'Visualizations', icon:<FiBarChart2/>, api:'visualizations',
    columns:['title','viz_type','library','status'],
    fields:[
      {name:'title',label:'Title',required:true},
      {name:'viz_type',label:'Type',type:'select',options:['line','bar','pie','donut','scatter','heatmap','histogram','radar','network','gauge','treemap','sankey','calendar','grouped-bar']},
      {name:'description',label:'Description',type:'textarea'},
      {name:'code',label:'Code',type:'textarea'},
      {name:'library',label:'Library',type:'select',options:['matplotlib','seaborn','plotly','networkx','bokeh','altair','d3']},
      {name:'status',label:'Status',type:'select',options:['active','draft','archived']},
    ]},
  { path:'/datasets', label:'Datasets', icon:<FiDatabase/>, api:'datasets',
    columns:['name','format','size','row_count','column_count','status'],
    fields:[
      {name:'name',label:'Name',required:true},
      {name:'description',label:'Description',type:'textarea'},
      {name:'format',label:'Format',type:'select',options:['csv','json','parquet','npz','log','fasta','pcap','xlsx','sql','xml']},
      {name:'size',label:'Size'},
      {name:'row_count',label:'Rows',type:'number'},
      {name:'column_count',label:'Columns',type:'number'},
      {name:'source',label:'Source'},
      {name:'status',label:'Status',type:'select',options:['active','inactive','processing']},
    ]},
  { path:'/reviews', label:'Code Reviews', icon:<FiSearch/>, api:'reviews',
    columns:['title','language','review_type','score','grade','status'],
    fields:[
      {name:'title',label:'Title',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','ruby','php','cpp']},
      {name:'code',label:'Code',type:'textarea'},
      {name:'review_type',label:'Review Type',type:'select',options:['full','security','performance','clean-code','bugs','architecture']},
      {name:'score',label:'Score (1-10)',type:'number'},
      {name:'grade',label:'Grade'},
      {name:'summary',label:'Summary',type:'textarea'},
      {name:'status',label:'Status',type:'select',options:['pending','in-progress','completed']},
    ]},
  { path:'/templates', label:'Templates', icon:<FiCopy/>, api:'templates',
    columns:['name','language','category','usage_count','is_public'],
    fields:[
      {name:'name',label:'Name',required:true},
      {name:'language',label:'Language',type:'select',options:['python','javascript','typescript','go','rust','java','yaml','makefile','hcl','nginx','shell']},
      {name:'category',label:'Category',type:'select',options:['web','cli','testing','devops','frontend','database','realtime','ci-cd','infrastructure','build']},
      {name:'description',label:'Description',type:'textarea'},
      {name:'code',label:'Code',type:'textarea'},
      {name:'usage_count',label:'Usage Count',type:'number'},
      {name:'is_public',label:'Public',type:'select',options:['true','false']},
    ]},
  { path:'/history', label:'History', icon:<FiClock/>, api:'history',
    columns:['snippet_id','language','code_preview','status','execution_time_ms','triggered_by'],
    fields:[
      {name:'snippet_id',label:'Snippet ID',type:'number'},
      {name:'language',label:'Language'},
      {name:'code_preview',label:'Code Preview'},
      {name:'status',label:'Status',type:'select',options:['completed','failed','timeout']},
      {name:'execution_time_ms',label:'Exec Time (ms)',type:'number'},
      {name:'exit_code',label:'Exit Code',type:'number'},
      {name:'triggered_by',label:'Triggered By',type:'select',options:['manual','notebook','api','scheduler','webhook']},
    ]},
  { path:'/secrets', label:'Secrets', icon:<FiLock/>, api:'secrets',
    columns:['name','secret_type','masked_value','environment','status'],
    fields:[
      {name:'name',label:'Name',required:true},
      {name:'description',label:'Description',type:'textarea'},
      {name:'secret_type',label:'Type',type:'select',options:['api_key','connection_string','password','secret','dsn','webhook','certificate']},
      {name:'masked_value',label:'Masked Value'},
      {name:'environment',label:'Environment',type:'select',options:['all','development','staging','production','ci']},
      {name:'status',label:'Status',type:'select',options:['active','inactive','expired','revoked']},
    ]},
  { path:'/collaborators', label:'Collaborators', icon:<FiUsers/>, api:'collaborators',
    columns:['user_email','notebook_id','role','permissions','status'],
    fields:[
      {name:'notebook_id',label:'Notebook ID',type:'number'},
      {name:'user_email',label:'Email',required:true},
      {name:'role',label:'Role',type:'select',options:['viewer','editor','admin','owner']},
      {name:'permissions',label:'Permissions'},
      {name:'status',label:'Status',type:'select',options:['active','inactive','pending']},
      {name:'invited_by',label:'Invited By'},
    ]},
  { path:'/logs', label:'Exec Logs', icon:<FiFileText/>, api:'logs',
    columns:['execution_id','level','message','source','line_number'],
    fields:[
      {name:'execution_id',label:'Execution ID',type:'number'},
      {name:'level',label:'Level',type:'select',options:['info','warning','error','debug','trace']},
      {name:'message',label:'Message',type:'textarea'},
      {name:'source',label:'Source'},
      {name:'line_number',label:'Line Number',type:'number'},
      {name:'timestamp_ms',label:'Timestamp (ms)',type:'number'},
    ]},
  { path:'/settings', label:'Settings', icon:<FiSettings/>, api:'settings',
    columns:['key','value','category'],
    fields:[
      {name:'key',label:'Key',required:true},
      {name:'value',label:'Value',required:true},
      {name:'category',label:'Category',type:'select',options:['general','editor','execution','appearance','ai']},
      {name:'description',label:'Description',type:'textarea'},
    ]},
];

function ProtectedRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />;
}

function Sidebar({ collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem('token'); navigate('/login'); };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">{'>_'}</div>
        <span className="sidebar-title">Code Interpreter</span>
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <FiChevronRight/> : <FiChevronLeft/>}
        </button>
      </div>
      <div className="sidebar-section-title">Main</div>
      <ul className="nav-items">
        <NavLink to="/dashboard" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
          <span className="nav-icon"><FiGrid/></span><span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink to="/ai-chat" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
          <span className="nav-icon"><FiTerminal/></span><span className="nav-label">AI Assistant</span>
        </NavLink>
      </ul>
      <div className="sidebar-section-title">Code</div>
      <ul className="nav-items">
        {pages.slice(0,3).map(p => (
          <NavLink key={p.path} to={p.path} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">{p.icon}</span><span className="nav-label">{p.label}</span>
          </NavLink>
        ))}
      </ul>
      <div className="sidebar-section-title">Runtime</div>
      <ul className="nav-items">
        {pages.slice(3,6).map(p => (
          <NavLink key={p.path} to={p.path} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">{p.icon}</span><span className="nav-label">{p.label}</span>
          </NavLink>
        ))}
      </ul>
      <div className="sidebar-section-title">Analysis</div>
      <ul className="nav-items">
        {pages.slice(6,10).map(p => (
          <NavLink key={p.path} to={p.path} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">{p.icon}</span><span className="nav-label">{p.label}</span>
          </NavLink>
        ))}
      </ul>
      <div className="sidebar-section-title">Management</div>
      <ul className="nav-items">
        {pages.slice(10).map(p => (
          <NavLink key={p.path} to={p.path} className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">{p.icon}</span><span className="nav-label">{p.label}</span>
          </NavLink>
        ))}
      </ul>
      <div style={{marginTop:'auto',padding:'12px 8px',borderTop:'1px solid var(--border)'}}>
        <div className="nav-item" onClick={logout}>
          <span className="nav-icon"><FiLogOut/></span><span className="nav-label">Logout</span>
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`main-content ${collapsed ? 'expanded' : ''}`}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard pages={pages}/>} />
          <Route path="/ai-chat" element={<AIChatPage/>} />
          {pages.map(p => (
            <Route key={p.path} path={p.path} element={
              <CrudPage title={p.label} apiPath={p.api} columns={p.columns} fields={p.fields} />
            }/>
          ))}
          <Route path="*" element={<Navigate to="/dashboard"/>} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/*" element={<ProtectedRoute><AppLayout/></ProtectedRoute>} />
      </Routes>
      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
    </BrowserRouter>
  );
}
