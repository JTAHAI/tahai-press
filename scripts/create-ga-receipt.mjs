import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';

const reportPath = path.join(ROOT, '.artifacts', 'ga-gate-report.json');
if (!fs.existsSync(reportPath)) throw new Error('GA report is missing. Run npm run verify:ga before creating a receipt.');
const reportSource = fs.readFileSync(reportPath);
const report = JSON.parse(reportSource);
if (!report.passed || report.skipInstall) throw new Error('A GA receipt requires a passing clean-install GA report.');
const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
const receipt = {
  schema_version: 1,
  release_identity: report.releaseIdentity,
  commit,
  generated_at: new Date().toISOString(),
  ga_started_at: report.startedAt,
  ga_completed_at: report.completedAt,
  report_sha256: crypto.createHash('sha256').update(reportSource).digest('hex'),
  checks: report.checks.map(({ id, passed, exitCode, durationMs }) => ({ id, passed, exit_code: exitCode, duration_ms: durationMs }))
};
const output = path.join(ROOT, '.artifacts', 'ga-release-receipt.json');
fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n');
console.log('Sanitized GA receipt written: .artifacts/ga-release-receipt.json');
