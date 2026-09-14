import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';

const reportPath = path.join(ROOT, '.artifacts', 'ga-gate-report.json');
if (!fs.existsSync(reportPath)) throw new Error('GA report is missing.');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const failed = report.checks?.find((check) => !check.passed);
if (!failed) throw new Error('GA report has no failed check.');
const sanitize = (value = '') => String(value).replace(/(?:token|secret|password|authorization)\s*[:=]\s*\S+/gi, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(-4000);
const output = { schema_version: 1, release_identity: report.releaseIdentity, started_at: report.startedAt, completed_at: report.completedAt, failed_gate: { id: failed.id, command: failed.command, cwd: failed.cwd, exit_code: failed.exitCode, duration_ms: failed.durationMs, launcher_error: sanitize(failed.launcherError), stderr: sanitize(failed.stderr), stdout: sanitize(failed.stdout) } };
fs.writeFileSync(path.join(ROOT, '.artifacts', 'ga-failure-diagnostics.json'), JSON.stringify(output, null, 2) + '\n');
console.log('Sanitized GA failure diagnostics written for ' + failed.id + '.');
