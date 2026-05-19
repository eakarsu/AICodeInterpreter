import React, { useState } from 'react';
import { FiActivity, FiPieChart, FiFileText, FiSettings } from 'react-icons/fi';
import ExecutionTimelineView from '../components/ExecutionTimelineView';
import LanguageDistributionDonut from '../components/LanguageDistributionDonut';
import NotebookPdfExportView from '../components/NotebookPdfExportView';
import ExecutionPolicyEditor from '../components/ExecutionPolicyEditor';

const TABS = [
  { key: 'timeline',     label: 'Execution Timeline',     icon: <FiActivity/>,  kind: 'viz' },
  { key: 'distribution', label: 'Language Distribution',  icon: <FiPieChart/>,  kind: 'viz' },
  { key: 'pdf',          label: 'Notebook PDF Export',    icon: <FiFileText/>,  kind: 'tool' },
  { key: 'policy',       label: 'Execution Policy',       icon: <FiSettings/>,  kind: 'tool' },
];

export default function CustomViewsPage() {
  const [tab, setTab] = useState('timeline');

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Interpreter Views</h1>
          <p className="page-subtitle">Custom synthesized views for the AI code execution interpreter</p>
        </div>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className={`btn ${tab===t.key?'btn-primary':'btn-secondary'}`}
                  data-tab={t.key}>
            {t.icon} {t.label}
            <span style={{
              marginLeft:8,fontSize:10,padding:'2px 6px',borderRadius:4,
              background: t.kind==='viz' ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.2)',
              color: t.kind==='viz' ? '#3b82f6' : '#8b5cf6'
            }}>{t.kind === 'viz' ? 'VIZ' : 'TOOL'}</span>
          </button>
        ))}
      </div>

      <div data-view={tab}>
        {tab === 'timeline'     && <ExecutionTimelineView/>}
        {tab === 'distribution' && <LanguageDistributionDonut/>}
        {tab === 'pdf'          && <NotebookPdfExportView/>}
        {tab === 'policy'       && <ExecutionPolicyEditor/>}
      </div>
    </div>
  );
}
