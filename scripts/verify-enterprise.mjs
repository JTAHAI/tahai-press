import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const artifact = path.join(ROOT, '.artifacts', 'enterprise-release-report.json');
const startedAt = new Date().toISOString();

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function governanceContract() {
  const required = ['LICENSE', 'NOTICE', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SUPPORT.md', 'CHANGELOG.md', 'CITATION.cff', '.github/ISSUE_TEMPLATE/config.yml'];
  for (const file of required) assert(fs.existsSync(path.join(ROOT, file)), `Missing governance record: ${file}`);
  return `${required.length} governance records are present.`;
}

function packageRuntimeContract() {
  const pkg = readJson('package.json');
  assert(pkg.private === true, 'The source package must remain private.');
  assert(pkg.license === 'Apache-2.0', 'The source package must declare Apache-2.0.');
  assert(pkg.engines?.node === '>=22', 'The supported Node contract must remain >=22.');
  for (const script of ['build', 'test', 'validate', 'verify:ga', 'verify:enterprise', 'package:release', 'package:transfer', 'recovery']) assert(pkg.scripts?.[script], `Missing package script: ${script}`);
  return `Package ${pkg.name}@${pkg.version} has the supported runtime and publisher commands.`;
}

function lockfileContract() {
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  assert(lock.lockfileVersion >= 3, 'package-lock.json must use lockfile version 3 or later.');
  const root = lock.packages?.[''];
  assert(root?.name === pkg.name && root.version === pkg.version, 'The lockfile root must match package.json identity.');
  assert(JSON.stringify(root.dependencies || {}) === JSON.stringify(pkg.dependencies || {}), 'The lockfile runtime dependency contract differs from package.json.');
  assert(JSON.stringify(root.devDependencies || {}) === JSON.stringify(pkg.devDependencies || {}), 'The lockfile development dependency contract differs from package.json.');
  return `Lockfile v${lock.lockfileVersion} matches the declared runtime and development dependencies.`;
}

function transferControl() {
  const packageResult = execute({ command: npm, args: ['run', 'package:transfer'], cwd: ROOT });
  if (!packageResult.passed) return packageResult;
  const verification = execute({ command: npm, args: ['run', 'verify:transfer'], cwd: ROOT });
  return {
    ...verification,
    command: `${packageResult.command} && ${verification.command}`,
    durationMs: packageResult.durationMs + verification.durationMs,
    stdout: `${packageResult.stdout}\n${verification.stdout}`.slice(-12000),
    stderr: `${packageResult.stderr}\n${verification.stderr}`.slice(-12000)
  };
}

function execute(check) {
  const began = Date.now();
  if (check.run) {
    try {
      const message = check.run();
      return { passed: true, exitCode: 0, durationMs: Date.now() - began, stdout: message, stderr: null, launcherError: null, command: 'local contract' };
    } catch (error) {
      return { passed: false, exitCode: 1, durationMs: Date.now() - began, stdout: '', stderr: error.message, launcherError: null, command: 'local contract' };
    }
  }
  const options = { cwd: check.cwd, encoding: 'utf8', stdio: 'pipe', windowsHide: true };
  const isCommandShim = process.platform === 'win32' && /\.cmd$/i.test(check.command);
  const result = isCommandShim
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [check.command, ...check.args].join(' ')], options)
    : spawnSync(check.command, check.args, options);
  return {
    passed: result.status === 0 && !result.error,
    exitCode: result.status,
    durationMs: Date.now() - began,
    stdout: result.stdout?.slice(-12000) || '',
    stderr: result.stderr?.slice(-12000) || '',
    launcherError: result.error?.message || null,
    command: [check.command, ...check.args].join(' ')
  };
}

const checks = [
  { id: 'governance-contract', run: governanceContract },
  { id: 'package-runtime-contract', run: packageRuntimeContract },
  { id: 'lockfile-contract', run: lockfileContract },
  { id: 'content-contract', cwd: ROOT, command: npm, args: ['run', 'validate:content'] },
  { id: 'cms-boundary', cwd: ROOT, command: npm, args: ['run', 'validate:cms'] },
  { id: 'redirect-contract', cwd: ROOT, command: npm, args: ['run', 'validate:redirects'] },
  { id: 'unit-suite', cwd: ROOT, command: npm, args: ['test'] },
  { id: 'media-health', cwd: ROOT, command: npm, args: ['run', 'audit:media'] },
  { id: 'static-build', cwd: ROOT, command: npm, args: ['run', 'build'] },
  { id: 'deployment-integrity', cwd: ROOT, command: npm, args: ['run', 'verify:dist'] },
  { id: 'accessibility-experience', cwd: ROOT, command: npm, args: ['run', 'audit:a11y'] },
  { id: 'reader-experience', cwd: ROOT, command: npm, args: ['run', 'audit:reader'] },
  { id: 'performance-budget', cwd: ROOT, command: npm, args: ['run', 'audit:performance'] },
  { id: 'source-security', cwd: ROOT, command: npm, args: ['run', 'audit:security'] },
  { id: 'theme-supply-chain', cwd: ROOT, command: npm, args: ['run', 'theme:integrity-audit'] },
  { id: 'evidence-boundary', cwd: ROOT, command: npm, args: ['run', 'evidence:validate'] },
  { id: 'migration-reversibility', cwd: ROOT, command: npm, args: ['run', 'verify:migration'] },
  { id: 'recovery-roundtrip', cwd: ROOT, command: process.execPath, args: ['--test', 'tests/recovery-transfer.test.mjs'] },
  { id: 'publisher-transfer', run: transferControl },
  { id: 'release-package', cwd: ROOT, command: npm, args: ['run', 'package:release'] }
];

const controls = [];
for (const check of checks) {
  const result = check.run === transferControl ? transferControl() : execute(check);
  controls.push({ id: check.id, ...result });
  if (!result.passed) break;
}

const report = {
  schemaVersion: 1,
  releaseIdentity: readJson('package.json').version,
  startedAt,
  completedAt: new Date().toISOString(),
  expectedControlCount: checks.length,
  passed: controls.length === checks.length && controls.every((control) => control.passed),
  controls
};
fs.mkdirSync(path.dirname(artifact), { recursive: true });
fs.writeFileSync(artifact, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Enterprise release gate ${report.passed ? 'passed' : 'failed'}: ${controls.filter((control) => control.passed).length}/${checks.length} controls. Report: .artifacts/enterprise-release-report.json`);
if (!report.passed) process.exitCode = 1;
