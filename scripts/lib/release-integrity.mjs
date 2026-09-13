import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const INTEGRITY_MANIFEST_PATH = '/.well-known/publication-integrity.json';

const MUTABLE_OR_SELF_REFERENTIAL_PATHS = new Set([
  '/.well-known/publication-build.json',
  '/.well-known/publication-health.json',
  INTEGRITY_MANIFEST_PATH
]);

export function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sha256Text(value) {
  return sha256Bytes(Buffer.from(String(value), 'utf8'));
}

export function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

export function publicIntegrityEntries(dist, paths) {
  return [...new Set(paths)]
    .map((pathname) => String(pathname || '').trim())
    .filter((pathname) => pathname.startsWith('/') && !MUTABLE_OR_SELF_REFERENTIAL_PATHS.has(pathname))
    .sort((a, b) => a.localeCompare(b))
    .map((pathname) => {
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      const file = path.join(dist, relative);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Integrity manifest references a missing deployment file: ${pathname}`);
      const bytes = fs.readFileSync(file);
      return { path: pathname, bytes: bytes.length, sha256: sha256Bytes(bytes) };
    });
}

export function releaseIntegrityManifest({ commit, environment, headerPolicySha256, entries }) {
  return {
    schema_version: 1,
    algorithm: 'sha-256',
    commit: String(commit || 'local'),
    environment: String(environment || 'local'),
    header_policy_sha256: String(headerPolicySha256 || ''),
    files: entries
  };
}
