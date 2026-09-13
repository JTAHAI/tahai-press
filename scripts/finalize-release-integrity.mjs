import fs from 'node:fs';
import path from 'node:path';
import { DIST } from './lib/content.mjs';
import { INTEGRITY_MANIFEST_PATH, publicIntegrityEntries, releaseIntegrityManifest, sha256Text } from './lib/release-integrity.mjs';

const wellKnown = path.join(DIST, '.well-known');
const buildPath = path.join(wellKnown, 'publication-build.json');
const healthPath = path.join(wellKnown, 'publication-health.json');
if (!fs.existsSync(buildPath) || !fs.existsSync(healthPath)) throw new Error('Build integrity finalization requires publication build and health metadata.');

const build = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
const health = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
const requiredPaths = [
  '/', '/robots.txt', '/site.webmanifest', '/assets/styles.css', '/assets/search.js', '/assets/pdf-reader.js',
  '/assets/reader-reach.js', '/assets/crossword.js', '/assets/professional-desk.js', '/assets/navigation.js',
  '/pagefind/pagefind.js', '/.well-known/publication-readiness.json', '/.well-known/publication-redirects.json',
  '/.well-known/tahai-press.json'
].filter((pathname) => fs.existsSync(path.join(DIST, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''))));
if (fs.existsSync(path.join(DIST, 'service-worker.js'))) requiredPaths.push('/service-worker.js');

const headerPolicy = fs.readFileSync(path.join(DIST, '_headers'), 'utf8');
const integrity = releaseIntegrityManifest({
  commit: build.commit,
  environment: build.environment,
  headerPolicySha256: sha256Text(headerPolicy),
  entries: publicIntegrityEntries(DIST, requiredPaths)
});
const integrityText = `${JSON.stringify(integrity, null, 2)}\n`;
const integritySha256 = sha256Text(integrityText);
fs.writeFileSync(path.join(DIST, INTEGRITY_MANIFEST_PATH.replace(/^\//, '')), integrityText, 'utf8');

for (const record of [build, health]) {
  record.integrity_manifest = INTEGRITY_MANIFEST_PATH;
  record.integrity_manifest_sha256 = integritySha256;
  record.edge_header_policy_sha256 = integrity.header_policy_sha256;
}
fs.writeFileSync(buildPath, `${JSON.stringify(build, null, 2)}\n`, 'utf8');
fs.writeFileSync(healthPath, `${JSON.stringify(health, null, 2)}\n`, 'utf8');
console.log(`Release integrity finalized for ${integrity.files.length} public files.`);
