const express = require('express');
const axios = require('axios');
const pool = require('../db');
const auth = require('../middleware/auth');
const aiRateLimiter = require('../middleware/rateLimiter');
const router = express.Router();

const aiCall = async (system, userMsg, temp = 0.7) => {
  const response = await axios.post(
    `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: process.env.OPENROUTER_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
      temperature: temp, max_tokens: 4096,
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Code Interpreter',
      }
    }
  );
  return response.data;
};

// Chat - General code assistant
router.post('/chat', auth, aiRateLimiter, async (req, res) => {
  try {
    const { message, conversation_id } = req.body;
    const data = await aiCall(
      'You are an expert code interpreter and software engineer. Help users write, debug, analyze, and understand code in any programming language. Provide clear explanations, working code examples, and best practices. When executing code conceptually, show expected output. Format code with proper syntax highlighting using markdown code blocks.',
      message
    );
    const reply = data.choices?.[0]?.message?.content || 'No response';
    let convId = conversation_id;
    if (!convId) {
      const r = await pool.query('INSERT INTO conversations (title, model, status) VALUES ($1,$2,$3) RETURNING id',
        [message.substring(0, 100), process.env.OPENROUTER_MODEL, 'active']);
      convId = r.rows[0].id;
    }
    await pool.query('INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1,$2,$3)', [convId, 'user', message]);
    await pool.query('INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1,$2,$3)', [convId, 'assistant', reply]);
    res.json({ conversation_id: convId, message: reply, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    console.error('AI Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Execute/Interpret code
router.post('/execute', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language, context } = req.body;
    const data = await aiCall(
      'You are a code execution engine and interpreter. When given code, analyze it step by step, trace through the execution, and provide the exact output. Show variable states, function calls, and return values. If the code has errors, explain them clearly. Format your response with:\n1. Code Analysis\n2. Step-by-step Execution Trace\n3. Output\n4. Memory/Variable State\n5. Performance Notes\n6. Potential Issues',
      `Execute and interpret this ${language || 'code'}:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n${context ? `\nContext: ${context}` : ''}`,
      0.3
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Code Review
router.post('/review', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language, review_type } = req.body;
    const types = {
      'full': 'Perform a comprehensive code review covering all aspects.',
      'security': 'Focus on security vulnerabilities, injection risks, auth issues, and data exposure.',
      'performance': 'Focus on performance bottlenecks, memory leaks, algorithmic complexity, and optimization.',
      'clean-code': 'Focus on code quality, naming conventions, SOLID principles, and readability.',
      'bugs': 'Focus on finding bugs, edge cases, race conditions, and logical errors.',
      'architecture': 'Focus on design patterns, architecture decisions, coupling, and scalability.',
    };
    const data = await aiCall(
      'You are a senior code reviewer with 20+ years of experience. Provide thorough, actionable code reviews with specific line references, severity ratings, and fixed code examples.',
      `${types[review_type] || types['full']}\n\nReview this ${language || 'code'}:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nProvide:\n1. Overall Score (1-10) with letter grade\n2. Summary of findings\n3. Critical issues (with severity: critical/high/medium/low)\n4. Code quality metrics\n5. Specific improvements with corrected code\n6. Best practices recommendations\n7. Security considerations`,
      0.4
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Generate Code
router.post('/generate', auth, aiRateLimiter, async (req, res) => {
  try {
    const { description, language, framework, style } = req.body;
    const data = await aiCall(
      'You are an expert code generator. Write production-quality code that is clean, well-documented, and follows best practices. Include error handling, type safety where applicable, and comprehensive comments.',
      `Generate ${language || 'Python'} code${framework ? ` using ${framework}` : ''}:\n\nDescription: ${description}\nStyle: ${style || 'production-ready'}\n\nProvide:\n1. Complete working code with imports\n2. Inline documentation\n3. Example usage\n4. Unit test examples\n5. Dependencies needed\n6. Configuration notes`,
      0.7
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Debug Code
router.post('/debug', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, error_message, language } = req.body;
    const data = await aiCall(
      'You are an expert debugger. Analyze code with errors, identify root causes, and provide clear fixes with explanations. Think systematically about what could go wrong.',
      `Debug this ${language || 'code'}:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n${error_message ? `\nError message: ${error_message}` : ''}\n\nProvide:\n1. Root cause analysis\n2. Bug identification with line numbers\n3. Fixed code\n4. Explanation of the fix\n5. How to prevent similar bugs\n6. Related edge cases to test`,
      0.4
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Explain Code
router.post('/explain', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language, detail_level } = req.body;
    const data = await aiCall(
      'You are a patient and thorough code educator. Explain code clearly for developers of all skill levels. Use analogies, diagrams (ASCII), and real-world examples.',
      `Explain this ${language || 'code'} at ${detail_level || 'intermediate'} level:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nProvide:\n1. High-level overview (what it does)\n2. Line-by-line explanation\n3. Key concepts used\n4. Data flow diagram (ASCII)\n5. Time/space complexity\n6. Real-world analogy\n7. Common modifications`,
      0.5
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Refactor Code
router.post('/refactor', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language, goal } = req.body;
    const goals = {
      'modernize': 'Modernize using latest language features and patterns.',
      'performance': 'Optimize for maximum performance and minimal resource usage.',
      'readability': 'Improve readability, naming, and code organization.',
      'patterns': 'Apply appropriate design patterns and SOLID principles.',
      'functional': 'Convert to functional programming style.',
      'typescript': 'Add TypeScript types and interfaces.',
    };
    const data = await aiCall(
      'You are a code refactoring expert. Transform code to be cleaner, faster, and more maintainable while preserving exact functionality.',
      `${goals[goal] || goals['readability']}\n\nRefactor this ${language || 'code'}:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nProvide:\n1. Refactored code\n2. What changed and why\n3. Before/after comparison\n4. Performance impact\n5. Breaking changes (if any)\n6. Migration steps`,
      0.5
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Data Analysis
router.post('/analyze-data', auth, aiRateLimiter, async (req, res) => {
  try {
    const { data_description, question, output_format } = req.body;
    const data = await aiCall(
      'You are a data scientist and analyst. Generate code for data analysis, visualization, and statistical processing. Use pandas, numpy, matplotlib, and other data science libraries.',
      `Analyze this data:\n\n${data_description}\n\nQuestion: ${question || 'Provide comprehensive analysis'}\nOutput format: ${output_format || 'Python with pandas'}\n\nProvide:\n1. Data loading code\n2. Data cleaning steps\n3. Exploratory analysis code\n4. Statistical summaries\n5. Visualization code (matplotlib/seaborn)\n6. Key insights\n7. Recommendations`,
      0.6
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Convert Code
router.post('/convert', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, from_language, to_language } = req.body;
    const data = await aiCall(
      'You are a polyglot programmer expert in translating code between programming languages. Preserve functionality, use idiomatic patterns in the target language, and handle language-specific differences.',
      `Convert this code from ${from_language || 'Python'} to ${to_language || 'JavaScript'}:\n\`\`\`${from_language || ''}\n${code}\n\`\`\`\n\nProvide:\n1. Converted code (idiomatic ${to_language || 'JavaScript'})\n2. Language-specific changes explained\n3. API/library equivalents used\n4. Gotchas and differences\n5. Testing the converted code\n6. Dependencies needed`,
      0.4
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Conversations
router.get('/conversations', auth, async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM conversations ORDER BY created_at DESC')).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/conversations/:id', auth, async (req, res) => {
  try {
    const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (conv.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const msgs = await pool.query('SELECT * FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC', [req.params.id]);
    res.json({ ...conv.rows[0], messages: msgs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM conversation_messages WHERE conversation_id = $1', [req.params.id]);
    await pool.query('DELETE FROM conversations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
