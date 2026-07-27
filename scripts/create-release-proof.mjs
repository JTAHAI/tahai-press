import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIST, ROOT } from './lib/content.mjs';
import { TAHAI_PRESS_PROVENANCE } from './lib/provenance.mjs';

const releaseDir = path.join(ROOT, '.artifacts', 'release-proof');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  throw new Error('dist/ is not ready. Run the full deployment build before creating release proof.');
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    })
    .sort();
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

const files = walk(DIST);
const records = files.map((file) => ({
  path: path.relative(DIST, file).replaceAll('\\', '/'),
  bytes: fs.statSync(file).size,
  sha256: sha256(file)
}));
const buildInfo = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-build.json'), 'utf8'));
const proof = {
  schema_version: 1,
  software: TAHAI_PRESS_PROVENANCE.software,
  creator: TAHAI_PRESS_PROVENANCE.creator,
  organization: TAHAI_PRESS_PROVENANCE.organization,
  website: TAHAI_PRESS_PROVENANCE.website,
  license: TAHAI_PRESS_PROVENANCE.license,
  build: buildInfo,
  file_count: records.length,
  total_bytes: records.reduce((sum, item) => sum + item.bytes, 0),
  files: records
};

fs.writeFileSync(path.join(releaseDir, 'tahai-press-release-proof.json'), `${JSON.stringify(proof, null, 2)}\n`);
fs.writeFileSync(
  path.join(releaseDir, 'SHA256SUMS.txt'),
  `${records.map((item) => `${item.sha256}  dist/${item.path}`).join('\n')}\n`
);
fs.writeFileSync(path.join(releaseDir, 'README.txt'), [
  'TAHAI Press deployment proof',
  '',
  'tahai-press-release-proof.json records every generated file, size, and SHA-256 hash.',
  'SHA256SUMS.txt can be checked with: cd .artifacts/release-proof && sha256sum -c SHA256SUMS.txt',
  'The Cloudflare Pages deployment itself is performed by the repository Git integration.',
  ''
].join('\n'));

console.log(`Release proof created for ${records.length} deployment files (${proof.total_bytes} bytes).`);
