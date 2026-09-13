import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { readSafeZip, sha256 } from './lib/safe-zip.mjs';

const archive = path.join(ROOT, '.artifacts', 'transfer', 'publisher-transfer.zip');
const reportFile = path.join(ROOT, '.artifacts', 'transfer', 'publisher-transfer-proof.json');
if (!fs.existsSync(archive)) throw new Error('Publisher transfer archive is missing. Run npm run package:transfer first.');
const entries = readSafeZip(archive);
const manifestBytes = entries.get('TRANSFER-MANIFEST.json');
if (!manifestBytes) throw new Error('Publisher transfer archive has no manifest.');
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Publisher transfer manifest is invalid.');
const listed = new Set();
for (const file of manifest.files) {
  if (!/^(?:content|themes\/published|docs)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(file.path || '') || file.path.includes('..') || file.path.includes('\\')) throw new Error(`Transfer manifest has an unsafe path: ${file.path}`);
  if (listed.has(file.path)) throw new Error(`Transfer manifest has a duplicate path: ${file.path}`);
  listed.add(file.path);
  const bytes = entries.get(file.path);
  if (!bytes || bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Transfer file failed verification: ${file.path}`);
}
const unexpected = [...entries.keys()].filter((name) => name !== 'TRANSFER-MANIFEST.json' && !listed.has(name));
if (unexpected.length) throw new Error(`Transfer archive has unlisted files: ${unexpected.join(', ')}`);
const forbidden = [...entries.keys()].filter((name) => /(^|\/)(?:\.env(?:\.|$)|dist|node_modules|\.artifacts|\.git)(?:\/|$)/i.test(name) || /^[A-Za-z]:|^\//.test(name));
if (forbidden.length) throw new Error(`Transfer archive leaks forbidden paths: ${forbidden.join(', ')}`);
const proof = { schemaVersion: 1, archive: path.basename(archive), archiveSha256: sha256(fs.readFileSync(archive)), files: manifest.files.length, verified: true, forbiddenPaths: 0 };
fs.writeFileSync(reportFile, `${JSON.stringify(proof, null, 2)}\n`);
console.log(`Publisher transfer verification passed: ${proof.files} files. Report: .artifacts/transfer/publisher-transfer-proof.json`);
