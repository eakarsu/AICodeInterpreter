import { completeExample } from './AIFieldPresets';

const cases = [
  {
    label: 'Sales totals', language: 'python',
    code: 'orders = [120, 85, 240, 0]\nprint(sum(orders))',
    previous_code: 'total = 0\nfor amount in [120, 85, 240, 0]:\n    total += amount\nprint(total)',
    current_code: 'orders = [120, 85, 240, 0]\nprint(sum(orders))',
    current_docs: 'Calculate the total of a list of order amounts.',
    description: 'Write a Python function that totals order amounts and returns zero for an empty list.',
    data_description: 'A CSV contains order_id, region, and amount columns; some amounts are zero.',
    question: 'What is the total amount by region?',
    error_message: 'Expected 445 but got 0 for the supplied orders.',
    reviews_text: 'Avery | Handle empty input explicitly.\nJordan | Add a unit test for zero values.',
    context: 'Four illustrative order amounts, including zero.',
    framework: 'Python standard library', style: 'tested', goal: 'readability',
    review_type: 'full', detail_level: 'beginner', output_format: 'Python with pandas',
    from_language: 'python', to_language: 'javascript',
    stdin: '120\n85\n240\n0', target_input_size: 1000,
    min_similarity: 0.6, file_path: 'orders.py',
  },
  {
    label: 'Inventory alert', language: 'javascript',
    code: 'const stock = [4, 0, 12];\nconsole.log(stock.filter(n => n < 5));',
    previous_code: 'const low = [];\nfor (const n of [4, 0, 12]) if (n < 5) low.push(n);',
    current_code: 'const low = [4, 0, 12].filter(n => n < 5);',
    current_docs: 'Return stock levels below the reorder threshold.',
    description: 'Create a JavaScript function that identifies products below a configurable reorder threshold.',
    data_description: 'Inventory rows have sku, warehouse, quantity, and reorder_threshold.',
    question: 'Which warehouses have the most low-stock items?',
    error_message: 'The zero-stock item is missing from the low-stock list.',
    reviews_text: 'Casey | Keep zero-stock items in the result.\nMorgan | Document the threshold comparison.',
    context: 'Illustrative stock levels for a reorder check.',
    framework: 'Node.js', style: 'documented', goal: 'performance',
    review_type: 'bugs', detail_level: 'intermediate', output_format: 'SQL',
    from_language: 'javascript', to_language: 'python',
    stdin: '4\n0\n12', target_input_size: 10000,
    min_similarity: 0.75, file_path: 'inventory.js',
  },
  {
    label: 'Session timing', language: 'python',
    code: 'durations = [30, 45, 0, 60]\nprint(max(durations) - min(durations))',
    previous_code: 'durations = [30, 45, 0, 60]\nprint(sorted(durations)[-1] - sorted(durations)[0])',
    current_code: 'durations = [30, 45, 0, 60]\nprint(max(durations) - min(durations))',
    current_docs: 'Report the range of session durations in minutes.',
    description: 'Write a Python function that summarizes session durations with count, minimum, maximum, and mean.',
    data_description: 'Session events have session_id, started_at, ended_at, and device_type.',
    question: 'How do median session durations compare by device type?',
    error_message: 'Empty duration input raises ValueError at max().',
    reviews_text: 'Riley | Guard the empty-list case.\nSam | Explain whether zero duration is valid.',
    context: 'Illustrative durations in minutes, including zero.',
    framework: 'Python standard library', style: 'production-ready', goal: 'modernize',
    review_type: 'performance', detail_level: 'advanced', output_format: 'Python with pandas',
    from_language: 'python', to_language: 'typescript',
    stdin: '30\n45\n0\n60', target_input_size: 50000,
    min_similarity: 0.9, file_path: 'sessions.py',
  },
];

export const codeToolSamples = cases.map(({ label, ...values }) => ({ label, values }));

export function codeToolExample(fields, sample, index, toolId, current = {}) {
  return completeExample(fields.map((field) => ({ ...field, key: field.name })), sample, index, toolId, current);
}
