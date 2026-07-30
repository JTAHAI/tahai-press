import fs from 'node:fs';
import path from 'node:path';
import { DIST, ROOT, loadContent } from './lib/content.mjs';
import { performanceHealth } from './lib/operations.mjs';

const args = process.argv.slice(2);
const reportArg = args.indexOf('--report');
const reportPath = reportArg >= 0 && args[reportArg + 1]
  ? path.resolve(ROOT, args[reportArg + 1])
  : path.join(ROOT, '.artifacts', 'performance-audit.json');
const content = loadContent();
if (!fs.existsSync(DIST)) throw new Error('dist/ does not exist. Run npm run build first.');
const report = performanceHealth({ dist: DIST, budgets: content.site.operations?.performance_budgets });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
for (const check of report.checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.key}: ${check.value}/${check.limit}`);
console.log(`Report: ${path.relative(ROOT, reportPath)}`);
if (!report.passed) process.exit(1);
