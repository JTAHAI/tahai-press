import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadContent } from './lib/content.mjs';
import { mediaHealth } from './lib/operations.mjs';

const args = process.argv.slice(2);
const reportArg = args.indexOf('--report');
const reportPath = reportArg >= 0 && args[reportArg + 1]
  ? path.resolve(ROOT, args[reportArg + 1])
  : path.join(ROOT, '.artifacts', 'media-health.json');
const strict = args.includes('--strict');
const content = loadContent();
const report = await mediaHealth(content);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Media health: ${report.summary.files} file(s), ${report.summary.referenced} referenced, ${report.summary.warnings} warning(s).`);
console.log(`Report: ${path.relative(ROOT, reportPath)}`);
if (report.warnings.length) report.warnings.forEach((warning) => console.warn(`WARNING ${warning}`));
if (strict && (report.summary.missing > 0 || report.summary.oversized > 0)) process.exit(1);
