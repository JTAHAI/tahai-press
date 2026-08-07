import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DIST } from './lib/content.mjs';
import { writeDeterministicZip } from './lib/safe-zip.mjs';

const OUTPUT = path.join(ROOT, '.artifacts', 'release-packages');
const SOURCE_EXCLUDES = new Set(['.git', '.artifacts', 'dist', 'node_modules', 'release-proof', 'proof']);
const ROOT_ARTIFACT = /^(?:SHA256SUMS\.txt|tahai-press_v.+_(?:clean-source|cloudflare-deploy)\.(?:zip|sha256)|TAHAI_PRESS_v.+_(?:clean-source|cloudflare-direct-upload)\.zip)$/i;

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function collect(root, { source = false } = {}) {
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const relative = path.relative(root, path.join(directory, entry.name)).replaceAll('\\', '/');
      if (entry.isSymbolicLink()) throw new Error(`Release packaging refuses symlink: ${relative}`);
      if (entry.isDirectory()) {
        if (source && (SOURCE_EXCLUDES.has(entry.name) || entry.name.startsWith('.tmp-'))) continue;
        visit(path.join(directory, entry.name));
      } else if (entry.isFile()) {
        if (source && (ROOT_ARTIFACT.test(relative) || relative === '.env' || relative.startsWith('.env.'))) continue;
        output.push({ path: relative, content: fs.readFileSync(path.join(directory, entry.name)) });
      }
    }
  };
  visit(root);
  return output;
}
function manifest(entries, version, kind) {
  return `${JSON.stringify({ schema_version: 1, product: 'TAHAI Press', version, kind, files: entries.map((entry) => ({ path: entry.path, sha256: sha256(entry.content), bytes: entry.content.length })) }, null, 2)}\n`;
}
function packageArchive(file, entries, version, kind) {
  const report = manifest(entries, version, kind);
  return writeDeterministicZip(file, [...entries, { path: 'RELEASE-MANIFEST.json', content: report }]);
}

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ is missing. Run npm run build first.');
fs.mkdirSync(OUTPUT, { recursive: true });
const sourceFile = path.join(OUTPUT, `tahai-press_v${version}_clean-source.zip`);
const deployFile = path.join(OUTPUT, `tahai-press_v${version}_cloudflare-deploy.zip`);
const source = packageArchive(sourceFile, collect(ROOT, { source: true }), version, 'clean-source');
const deploy = packageArchive(deployFile, collect(DIST), version, 'cloudflare-deploy');
const checksums = `${source.sha256}  ${path.basename(sourceFile)}\n${deploy.sha256}  ${path.basename(deployFile)}\n`;
fs.writeFileSync(path.join(OUTPUT, 'SHA256SUMS.txt'), checksums, 'utf8');
console.log(`Deterministic release packages created in ${path.relative(ROOT, OUTPUT)} for ${version}.`);
