import React, { useState } from 'react';
import api from '../services/api';

export default function SandboxRiskScannerPage() {
  const [code, setCode] = useState("import os\nimport subprocess\nprint(os.environ.get('OPENAI_API_KEY'))\nsubprocess.run(['cat','/etc/passwd'])");
  const [result, setResult] = useState(null);

  const run = async () => {
    const response = await api.post('/sandbox-risk/scan', { runtime: 'python', code });
    setResult(response.data);
  };

  return (
    <div className="page">
      <h1>Sandbox Escape Risk</h1>
      <p className="text-muted">Scan notebook code for filesystem, process, network, secret, and package-install risks before execution.</p>
      <div className="card" style={{ marginTop: 20 }}>
        <textarea style={{ width: '100%', minHeight: 220 }} value={code} onChange={(event) => setCode(event.target.value)} />
        <button className="btn btn-primary" onClick={run} style={{ marginTop: 12 }}>Scan Cell</button>
      </div>
      {result && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>{result.tier} · {result.score}</h2>
          <p>{result.policy}</p>
          {result.findings.map((finding) => <div key={finding.type} className="card" style={{ marginTop: 10 }}>{finding.type}: {finding.mitigation}</div>)}
        </div>
      )}
    </div>
  );
}
