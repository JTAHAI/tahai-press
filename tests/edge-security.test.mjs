import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cloudflareHeadersText, edgeSecurityHeaders } from '../scripts/lib/edge-security.mjs';
import { publicIntegrityEntries, releaseIntegrityManifest, sha256Text } from '../scripts/lib/release-integrity.mjs';

test('edge headers preserve a strict static-reader policy and only noindex blocked releases', () => {
  const blocked = cloudflareHeadersText({ indexingBlocked: true });
  const launchReady = cloudflareHeadersText({ indexingBlocked: false });
  for (const name of ['Content-Security-Policy', 'Cross-Origin-Opener-Policy', 'Permissions-Policy', 'Referrer-Policy', 'X-Content-Type-Options', 'X-Frame-Options']) assert.match(blocked, new RegExp(name));
  assert.match(blocked, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(blocked, /script-src[^;]*'unsafe-eval'/);
  assert.match(blocked, /X-Robots-Tag: noindex, nofollow, noarchive/);
  assert.doesNotMatch(launchReady, /X-Robots-Tag/);
  assert.match(blocked, /\/\.well-known\/\*[\s\S]*Cache-Control: no-store/);
  assert.equal(edgeSecurityHeaders({ indexingBlocked: true }).at(-1)?.name, 'X-Robots-Tag');
});

test('release integrity records immutable public files deterministically', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-integrity-'));
  try {
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>', 'utf8');
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'console.log("ok")', 'utf8');
    fs.mkdirSync(path.join(root, '.well-known'), { recursive: true });
    fs.writeFileSync(path.join(root, '.well-known', 'publication-build.json'), '{}', 'utf8');
    const entries = publicIntegrityEntries(root, ['/assets/app.js', '/', '/.well-known/publication-build.json']);
    assert.deepEqual(entries.map((entry) => entry.path), ['/', '/assets/app.js']);
    const manifest = releaseIntegrityManifest({ commit: 'abc123', environment: 'production', headerPolicySha256: sha256Text('headers'), entries });
    assert.equal(manifest.commit, 'abc123');
    assert.equal(manifest.files[1].bytes, Buffer.byteLength('console.log("ok")'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
