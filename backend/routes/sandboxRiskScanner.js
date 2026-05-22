const express = require('express');
const router = express.Router();

const riskyPatterns = [
  { key: 'filesystem_escape', pattern: /\.\.\/|\/etc\/|\/var\/run|~\//i, weight: 22 },
  { key: 'process_spawn', pattern: /child_process|subprocess|exec\(|spawn\(|popen/i, weight: 24 },
  { key: 'network_exfiltration', pattern: /curl |wget |requests\.post|fetch\(|socket/i, weight: 18 },
  { key: 'secret_access', pattern: /process\.env|os\.environ|AWS_SECRET|OPENAI_API_KEY|token/i, weight: 20 },
  { key: 'package_install', pattern: /pip install|npm install|apt-get|brew install/i, weight: 14 },
];

router.post('/scan', (req, res) => {
  const code = String(req.body?.code || "import os\nprint(os.environ.get('OPENAI_API_KEY'))\nsubprocess.run(['cat','/etc/passwd'])");
  const runtime = String(req.body?.runtime || 'python');
  const findings = riskyPatterns
    .filter((rule) => rule.pattern.test(code))
    .map((rule) => ({ type: rule.key, weight: rule.weight, mitigation: `Restrict ${rule.key.replace(/_/g, ' ')} in the ${runtime} sandbox policy.` }));
  const score = Math.min(100, findings.reduce((sum, finding) => sum + finding.weight, 0) + (code.length > 5000 ? 8 : 0));
  res.json({
    runtime,
    score,
    tier: score >= 70 ? 'block' : score >= 45 ? 'review' : score >= 20 ? 'warn' : 'allow',
    findings,
    policy: score >= 70 ? 'Deny execution until a reviewer approves the notebook cell.' : 'Run with network, filesystem, and secret scopes reduced to least privilege.',
  });
});

module.exports = router;
