import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { writeDeterministicZip } from './lib/safe-zip.mjs';

const output = path.join(ROOT, '.artifacts', 'transfer', 'publisher-transfer.zip');
const include = ['content', 'themes/published', 'docs/RECOVERY.md', 'docs/INDEPENDENT-PRESS-STARTER-GUIDE.md'];
function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  if (fs.statSync(directory).isFile()) return [directory];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const files = include.flatMap((relative) => walk(path.join(ROOT, relative)).map((file) => ({ path: path.relative(ROOT, file).replaceAll('\\', '/'), content: fs.readFileSync(file) })));
const manifest = files.map((file) => ({ path: file.path, bytes: file.content.length, sha256: crypto.createHash('sha256').update(file.content).digest('hex') }));
files.push({ path: 'TRANSFER-MANIFEST.json', content: `${JSON.stringify({ version: 1, created_by: 'TAHAI Press', files: manifest }, null, 2)}\n` });
fs.mkdirSync(path.dirname(output), { recursive: true }); writeDeterministicZip(output, files);
console.log(`Portable transfer package created: ${path.relative(ROOT, output)} (${files.length} files).`);
