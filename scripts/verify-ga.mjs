import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const artifact = path.join(ROOT, '.artifacts', 'ga-gate-report.json');
const startedAt = new Date().toISOString();
const skipInstall = process.argv.includes('--skip-install');

const checks = [
  ...(!skipInstall ? [{ id: 'root-clean-install', cwd: ROOT, command: npm, args: ['ci', '--ignore-scripts'] }] : []),
  ...(!skipInstall ? [{ id: 'playwright-browser-install', cwd: ROOT, command: npx, args: ['playwright', 'install', 'chromium', 'firefox', 'webkit'] }] : []),
  { id: 'content-and-cms-validation', cwd: ROOT, command: npm, args: ['run', 'validate'] },
  { id: 'root-test-suite', cwd: ROOT, command: npm, args: ['test'] },
  { id: 'enterprise-release-controls', cwd: ROOT, command: npm, args: ['run', 'verify:enterprise'] },
  { id: 'media-audit', cwd: ROOT, command: npm, args: ['run', 'audit:media'] },
  { id: 'static-build', cwd: ROOT, command: npm, args: ['run', 'build'] },
  { id: 'accessibility-audit', cwd: ROOT, command: npm, args: ['run', 'audit:a11y'] },
  { id: 'reader-audit', cwd: ROOT, command: npm, args: ['run', 'audit:reader'] },
  { id: 'performance-audit', cwd: ROOT, command: npm, args: ['run', 'audit:performance'] },
  { id: 'distribution-verification', cwd: ROOT, command: npm, args: ['run', 'verify:dist'] },
  { id: 'http-smoke', cwd: ROOT, command: npm, args: ['run', 'smoke'] },
  { id: 'release-proof', cwd: ROOT, command: npm, args: ['run', 'release:proof'] },
  { id: 'security-audit', cwd: ROOT, command: npm, args: ['run', 'audit:security'] },
  { id: 'production-audit', cwd: ROOT, command: npm, args: ['audit', '--omit=dev', '--audit-level=high'] },
  { id: 'official-themes', cwd: ROOT, command: npm, args: ['run', 'theme:catalog:build'] },
  { id: 'theme-integrity', cwd: ROOT, command: npm, args: ['run', 'theme:integrity-audit'] },
  { id: 'evidence-validation', cwd: ROOT, command: npm, args: ['run', 'evidence:validate'] },
  { id: 'migration-proof', cwd: ROOT, command: npm, args: ['run', 'verify:migration'] },
  { id: 'transfer-package', cwd: ROOT, command: npm, args: ['run', 'package:transfer'] },
  { id: 'transfer-verification', cwd: ROOT, command: npm, args: ['run', 'verify:transfer'] },
  { id: 'release-packages', cwd: ROOT, command: npm, args: ['run', 'package:release'] },
  ...(!skipInstall ? [{ id: 'worker-clean-install', cwd: path.join(ROOT, 'services', 'newsroom-worker'), command: npm, args: ['ci', '--ignore-scripts'] }] : []),
  { id: 'worker-tests', cwd: path.join(ROOT, 'services', 'newsroom-worker'), command: npm, args: ['test'] },
  ...(!skipInstall ? [{ id: 'collaboration-clean-install', cwd: path.join(ROOT, 'services', 'collaboration'), command: npm, args: ['ci', '--ignore-scripts'] }] : []),
  { id: 'collaboration-tests', cwd: path.join(ROOT, 'services', 'collaboration'), command: npm, args: ['test'] },
  { id: 'real-browser-matrix', cwd: ROOT, command: npm, args: ['run', 'verify:browsers'] }
];

const results = [];
for (const check of checks) {
  const began = Date.now();
  const options = { cwd: check.cwd, encoding: 'utf8', stdio: 'pipe', windowsHide: true };
  const execution = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [check.command, ...check.args].join(' ')], options)
    : spawnSync(check.command, check.args, options);
  const passed = execution.status === 0 && !execution.error;
  results.push({ id: check.id, command: [check.command, ...check.args].join(' '), cwd: path.relative(ROOT, check.cwd).replaceAll('\\', '/') || '.', passed, exitCode: execution.status, durationMs: Date.now() - began, stdout: execution.stdout?.slice(-12000) || '', stderr: execution.stderr?.slice(-12000) || '', launcherError: execution.error?.message || null });
  if (!passed) break;
}

const report = { schemaVersion: 1, releaseIdentity: JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, startedAt, completedAt: new Date().toISOString(), skipInstall, passed: results.length === checks.length && results.every((result) => result.passed), checks: results };
fs.mkdirSync(path.dirname(artifact), { recursive: true });
fs.writeFileSync(artifact, `${JSON.stringify(report, null, 2)}\n`);
console.log(`GA gate ${report.passed ? 'passed' : 'failed'}: ${results.filter((result) => result.passed).length}/${checks.length} checks. Report: .artifacts/ga-gate-report.json`);
if (!report.passed) process.exitCode = 1;
