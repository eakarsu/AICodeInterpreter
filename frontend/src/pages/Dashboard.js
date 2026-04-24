import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiCode, FiPlay, FiBook, FiBox, FiPackage, FiBarChart2, FiDatabase, FiSearch, FiCopy, FiClock, FiLock, FiUsers, FiFileText } from 'react-icons/fi';

const statMeta = [
  { key:'snippets', label:'Code Snippets', icon:<FiCode/>, path:'/snippets', color:'#10b981' },
  { key:'executions', label:'Executions', icon:<FiPlay/>, path:'/executions', color:'#3b82f6' },
  { key:'notebooks', label:'Notebooks', icon:<FiBook/>, path:'/notebooks', color:'#8b5cf6' },
  { key:'environments', label:'Environments', icon:<FiBox/>, path:'/environments', color:'#06b6d4' },
  { key:'packages', label:'Packages', icon:<FiPackage/>, path:'/packages', color:'#f59e0b' },
  { key:'visualizations', label:'Visualizations', icon:<FiBarChart2/>, path:'/visualizations', color:'#ec4899' },
  { key:'datasets', label:'Datasets', icon:<FiDatabase/>, path:'/datasets', color:'#14b8a6' },
  { key:'reviews', label:'Code Reviews', icon:<FiSearch/>, path:'/reviews', color:'#ef4444' },
  { key:'templates', label:'Templates', icon:<FiCopy/>, path:'/templates', color:'#a855f7' },
  { key:'history', label:'History', icon:<FiClock/>, path:'/history', color:'#6366f1' },
  { key:'secrets', label:'Secrets', icon:<FiLock/>, path:'/secrets', color:'#f97316' },
  { key:'collaborators', label:'Collaborators', icon:<FiUsers/>, path:'/collaborators', color:'#0ea5e9' },
  { key:'logs', label:'Exec Logs', icon:<FiFileText/>, path:'/logs', color:'#22c55e' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">AI Code Interpreter Overview</p>
        </div>
      </div>
      {loading ? (
        <div className="loading"><div className="spinner"></div>Loading dashboard...</div>
      ) : (
        <div className="stats-grid">
          {statMeta.map(s => (
            <Link key={s.key} to={s.path} className="stat-card">
              <div className="stat-icon" style={{color: s.color}}>{s.icon}</div>
              <div className="stat-value">{stats[s.key] ?? 0}</div>
              <div className="stat-label">{s.label}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
