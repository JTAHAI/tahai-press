import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { edgeSecurityHeaders } from './lib/edge-security.mjs';
import { INTEGRITY_MANIFEST_PATH, sha256Bytes, sha256Text } from './lib/release-integrity.mjs';

function option(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : fallback;
}

function releaseOrigin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('Use an absolute HTTP(S) origin without credentials, a query string, fragment, or path.');
  }
  return url.origin;
}

async function responseFor(origin, pathname) {
  const response = await fetch(new URL(pathname, `${origin}/`), { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}.`);
  return response;
}

function normalized(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const origin = releaseOrigin(option('--origin'));
const expectedCommit = option('--expected-commit');
const reportPath = path.resolve(ROOT, option('--report', '.artifacts/live-release-verification.json'));
const startedAt = new Date().toISOString();

const buildResponse = await responseFor(origin, '/.well-known/publication-build.json');
const buildText = await buildResponse.text();
const build = JSON.parse(buildText);
if (expectedCommit && build.commit !== expectedCommit) throw new Error(`Live build commit ${build.commit} does not match expected commit ${expectedCommit}.`);
if (build.integrity_manifest !== INTEGRITY_MANIFEST_PATH || !/^[a-f0-9]{64}$/.test(build.integrity_manifest_sha256 || '')) throw new Error('Live build does not expose a valid integrity-manifest reference.');

const integrityResponse = await responseFor(origin, build.integrity_manifest);
const integrityText = await integrityResponse.text();
if (sha256Text(integrityText) !== build.integrity_manifest_sha256) throw new Error('Live integrity manifest digest does not match build metadata.');
const integrity = JSON.parse(integrityText);
if (integrity.commit !== build.commit || integrity.environment !== build.environment || !Array.isArray(integrity.files) || integrity.files.length < 8) throw new Error('Live integrity manifest does not match the release identity.');

const expectedHeaders = edgeSecurityHeaders({ indexingBlocked: build.indexing_blocked === true });
for (const { name, value } of expectedHeaders) {
  const actual = normalized(buildResponse.headers.get(name));
  if (actual !== normalized(value)) throw new Error(`Live release is missing the expected ${name} header.`);
}
for (const [pathname, expectedCache] of [['/.well-known/publication-build.json', 'no-store'], ['/.well-known/publication-integrity.json', 'no-store'], ['/robots.txt', 'no-store']]) {
  const response = pathname === '/.well-known/publication-build.json' ? buildResponse : await responseFor(origin, pathname);
  if (!normalized(response.headers.get('cache-control')).includes(expectedCache)) throw new Error(`${pathname} is missing its ${expectedCache} cache policy.`);
}

const verifiedFiles = [];
for (const entry of integrity.files) {
  if (!entry?.path?.startsWith('/') || !Number.isInteger(entry.bytes) || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) throw new Error('Live integrity manifest contains an invalid file entry.');
  const response = await responseFor(origin, entry.path);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== entry.bytes || sha256Bytes(bytes) !== entry.sha256) throw new Error(`Live file integrity mismatch for ${entry.path}.`);
  verifiedFiles.push(entry.path);
}

const report = {
  schema_version: 1,
  origin,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  commit: build.commit,
  environment: build.environment,
  indexing_blocked: build.indexing_blocked === true,
  integrity_manifest: build.integrity_manifest,
  verified_file_count: verifiedFiles.length,
  verified_files: verifiedFiles,
  edge_header_names: expectedHeaders.map((header) => header.name),
  passed: true
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Live release verification passed for ${origin}: ${verifiedFiles.length} integrity files and ${expectedHeaders.length} edge headers.`);
