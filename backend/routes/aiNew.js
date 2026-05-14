const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const aiRateLimiter = require('../middleware/rateLimiter');
const router = express.Router();

const MAX_CODE_BYTES = 50 * 1024; // 50KB

const AI_SYSTEM_PROMPT = 'You are an expert software engineer and coding assistant. Provide accurate, detailed code analysis, debugging help, and educational explanations across all programming languages.';

const aiCall = async (system, userMsg, temp = 0.5) => {
  const response = await axios.post(
    `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }],
      temperature: temp,
      max_tokens: 4096,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Code Interpreter',
      },
    }
  );
  return response.data.choices?.[0]?.message?.content || '';
};

function validateCode(code, res) {
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'code (string) is required.' });
    return false;
  }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    res.status(400).json({ error: `code must not exceed ${MAX_CODE_BYTES / 1024}KB (${MAX_CODE_BYTES} bytes).` });
    return false;
  }
  return true;
}

// POST /api/ai/debug-assistant
// {code, error_message, language} → root cause analysis, fix suggestions, explanation
router.post('/debug-assistant', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, error_message, language } = req.body;
    if (!validateCode(code, res)) return;

    const lang = typeof language === 'string' ? language.slice(0, 50) : 'unknown';
    const errMsg = typeof error_message === 'string' ? error_message.slice(0, 2000) : '';

    const userMsg = `Debug the following ${lang} code${errMsg ? ` that produces this error:\n\nError: ${errMsg}` : ''}:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\nProvide:\n1. **Root Cause Analysis**: Exactly what is wrong and why\n2. **Bug Location**: Specific lines or functions that are incorrect\n3. **Fixed Code**: Complete corrected version\n4. **Explanation**: Clear explanation of the fix\n5. **Prevention Tips**: How to avoid similar bugs\n6. **Edge Cases**: Related edge cases to watch for`;

    const result = await aiCall(AI_SYSTEM_PROMPT, userMsg, 0.3);
    res.json({ result, language: lang, error_message: errMsg });
  } catch (err) {
    console.error('debug-assistant error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/ai/explain-code
// {code, level (beginner/intermediate/expert)} → line-by-line explanation at appropriate level
router.post('/explain-code', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, level, language } = req.body;
    if (!validateCode(code, res)) return;

    const allowedLevels = ['beginner', 'intermediate', 'expert'];
    const explanationLevel = allowedLevels.includes(level) ? level : 'intermediate';
    const lang = typeof language === 'string' ? language.slice(0, 50) : '';

    const levelInstructions = {
      beginner: 'Explain as if to someone learning to code for the first time. Use simple analogies, avoid jargon, and define every technical term. Be encouraging and thorough.',
      intermediate: 'Explain to a developer with 1-3 years experience. Reference standard patterns and best practices. Explain the "why" behind design choices.',
      expert: 'Explain to a senior engineer. Focus on advanced concepts, performance implications, edge cases, trade-offs, and architectural considerations. Be concise and precise.',
    };

    const userMsg = `Explain the following ${lang} code at the **${explanationLevel}** level:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n${levelInstructions[explanationLevel]}\n\nStructure your explanation as:\n1. **Overview**: What does this code do in one paragraph?\n2. **Line-by-Line Breakdown**: Walk through each section explaining what it does\n3. **Key Concepts**: List and explain the programming concepts used\n4. **Data Flow**: How data moves through the code\n5. **Complexity**: Time and space complexity (Big-O)\n6. **Common Gotchas**: Potential pitfalls or misunderstandings`;

    const result = await aiCall(AI_SYSTEM_PROMPT, userMsg, 0.4);
    res.json({ result, level: explanationLevel, language: lang });
  } catch (err) {
    console.error('explain-code error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/ai/generate-tests
// {code, framework (jest/pytest/mocha)} → generates test suite with edge cases
router.post('/generate-tests', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, framework, language } = req.body;
    if (!validateCode(code, res)) return;

    const allowedFrameworks = ['jest', 'pytest', 'mocha', 'vitest', 'junit', 'rspec', 'go_test', 'xunit'];
    const testFramework = allowedFrameworks.includes(framework) ? framework : 'jest';
    const lang = typeof language === 'string' ? language.slice(0, 50) : '';

    const frameworkNotes = {
      jest: 'Use describe/it/expect. Include beforeEach/afterEach if needed. Use jest.fn() for mocks.',
      pytest: 'Use pytest conventions. Include fixtures where appropriate. Use parametrize for multiple inputs.',
      mocha: 'Use describe/it with Chai assertions. Include before/after hooks if needed.',
      vitest: 'Use Vitest with describe/it/expect. Similar to Jest but for Vite projects.',
      junit: 'Use JUnit 5 annotations (@Test, @BeforeEach, etc.). Include appropriate assertions.',
      rspec: 'Use RSpec with describe/context/it. Include let/before hooks as needed.',
      go_test: 'Use Go testing package with t.Run for subtests. Include table-driven tests.',
      xunit: 'Use xUnit with [Fact] and [Theory] attributes.',
    };

    const userMsg = `Generate a comprehensive test suite using **${testFramework}** for the following ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n${frameworkNotes[testFramework] || ''}\n\nInclude:\n1. **Happy Path Tests**: Normal expected behavior\n2. **Edge Cases**: Boundary values, empty inputs, null/undefined\n3. **Error Cases**: Invalid inputs, exceptions, error handling\n4. **Integration Points**: Mock external dependencies\n5. **Performance Tests**: If applicable (large inputs)\n\nProvide complete, runnable test code with clear test names and comments explaining what each test validates.`;

    const result = await aiCall(AI_SYSTEM_PROMPT, userMsg, 0.4);
    res.json({ result, framework: testFramework, language: lang });
  } catch (err) {
    console.error('generate-tests error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/ai/complexity-analysis
// {code} → time/space complexity, Big-O notation, optimization suggestions
router.post('/complexity-analysis', auth, aiRateLimiter, async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!validateCode(code, res)) return;

    const lang = typeof language === 'string' ? language.slice(0, 50) : '';

    const userMsg = `Perform a thorough complexity analysis of the following ${lang} code:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\nProvide a detailed analysis covering:\n1. **Time Complexity**: Big-O for each function/section and overall\n2. **Space Complexity**: Memory usage, auxiliary space, stack space for recursion\n3. **Complexity Breakdown**: Walk through each loop, recursion, and data structure operation\n4. **Best/Average/Worst Cases**: Where they differ, explain why\n5. **Bottlenecks**: Identify the most expensive operations\n6. **Optimization Suggestions**: Concrete changes with their expected complexity improvement\n7. **Optimized Version**: Provide an improved implementation if significant gains are possible\n8. **Tradeoffs**: Space-time tradeoffs in the suggested optimizations`;

    const result = await aiCall(AI_SYSTEM_PROMPT, userMsg, 0.3);
    res.json({ result, language: lang });
  } catch (err) {
    console.error('complexity-analysis error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

module.exports = router;
