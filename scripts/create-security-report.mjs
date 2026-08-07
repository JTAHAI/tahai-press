import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DIST } from './lib/content.mjs';

const output = path.join(ROOT, '.artifacts', 'security-report.json');
const packageInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
function walk(directory) { return fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]) : []; }
const sourceFiles = walk(ROOT).filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`) && !file.includes(`${path.sep}.git${path.sep}`) && !file.includes(`${path.sep}.artifacts${path.sep}`));
const textFiles = sourceFiles.filter((file) => /\.(?:mjs|js|json|md|ya?ml|css|html|txt|toml|sql)$/i.test(file));
const outputFiles = walk(DIST);
const findings = [];
for (const file of textFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9_]{20,}/.test(text)) findings.push({ type: 'credential_or_private_key', file: path.relative(ROOT, file) });
}
for (const file of outputFiles.filter((file) => /\.(?:html|js|json|txt|xml|css)$/i.test(file))) {
  const text = fs.readFileSync(file, 'utf8');
  if (/"(?:editor_notes|private_editor_notes)"\s*:|(?:imports|\.artifacts)\/[A-Za-z0-9_-]+|[A-Z]:\\Users\\/i.test(text)) findings.push({ type: 'generated_output_leakage', file: path.relative(ROOT, file) });
}
const dependencies = Object.entries(lock.packages || {}).filter(([name]) => name.startsWith('node_modules/')).map(([name, meta]) => ({ name: name.replace(/^node_modules\//, ''), version: meta.version, license: meta.license || 'unknown', dev: Boolean(meta.dev) })).sort((a, b) => a.name.localeCompare(b.name));
const report = { schema_version: 1, generated_at: new Date().toISOString(), package: { name: packageInfo.name, version: packageInfo.version, license: packageInfo.license }, lifecycle_hooks: Object.keys(packageInfo.scripts || {}).filter((name) => /^(pre|post)(install|pack|publish)$/.test(name)), dependencies, scans: { credentials_and_keys: findings.filter((item) => item.type === 'credential_or_private_key'), generated_output_leakage: findings.filter((item) => item.type === 'generated_output_leakage'), remote_public_assets: [] }, passed: findings.length === 0, sha256: crypto.createHash('sha256').update(JSON.stringify({ dependencies, findings })).digest('hex') };
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) { console.error(JSON.stringify(report.scans, null, 2)); process.exitCode = 1; } else console.log(`Security report passed: ${dependencies.length} locked dependencies, no credential or output-leak findings.`);
