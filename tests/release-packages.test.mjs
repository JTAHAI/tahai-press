import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readSafeZip } from '../scripts/lib/safe-zip.mjs';
import { ROOT } from '../scripts/lib/content.mjs';

test('release packager is deterministic, keeps deployment files at ZIP root, and avoids user-owned release archives', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const historicalFile = path.join(ROOT, `tahai-press_v${version}_clean-source.zip`);
  const historicalHash = fs.existsSync(historicalFile) ? crypto.createHash('sha256').update(fs.readFileSync(historicalFile)).digest('hex') : null;
  execFileSync(process.execPath, ['scripts/package-release.mjs'], { cwd: ROOT, stdio: 'pipe' });
  const output = path.join(ROOT, '.artifacts', 'release-packages');
  const first = fs.readFileSync(path.join(output, `tahai-press_v${version}_cloudflare-deploy.zip`));
  execFileSync(process.execPath, ['scripts/package-release.mjs'], { cwd: ROOT, stdio: 'pipe' });
  assert.deepEqual(first, fs.readFileSync(path.join(output, `tahai-press_v${version}_cloudflare-deploy.zip`)));
  const entries = readSafeZip(path.join(output, `tahai-press_v${version}_cloudflare-deploy.zip`));
  assert.ok(entries.has('index.html'));
  assert.ok(entries.has('RELEASE-MANIFEST.json'));
  assert.ok(fs.existsSync(path.join(output, 'SHA256SUMS.txt')));
  if (historicalHash) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(historicalFile)).digest('hex'), historicalHash);
});
