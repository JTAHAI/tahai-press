import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';
import { readSafeZip } from '../scripts/lib/safe-zip.mjs';

test('portable transfer package contains publisher files and no deployment output', () => {
  execFileSync(process.execPath, ['scripts/package-transfer.mjs'], { cwd: ROOT });
  const archive = path.join(ROOT, '.artifacts/transfer/publisher-transfer.zip');
  const entries = readSafeZip(archive);
  assert.ok(entries.has('content/site.json'));
  assert.ok(entries.has('TRANSFER-MANIFEST.json'));
  assert.ok(![...entries.keys()].some((entry) => entry.startsWith('dist/') || entry.startsWith('.artifacts/')));
});

test('safety copies use a relative archive reference and reject unsafe source entries', () => {
  execFileSync(process.execPath, ['scripts/recovery.mjs', 'create'], { cwd: ROOT });
  const record = JSON.parse(fs.readFileSync(path.join(ROOT, '.artifacts/recovery/publisher-safety-copy.json'), 'utf8'));
  assert.equal(record.archive, 'publisher-safety-copy.zip');
  assert.ok(record.files.length > 0);
  assert.ok(record.files.every((entry) => entry.path.startsWith('content/') || entry.path.startsWith('themes/published/')));
  const source = fs.readFileSync(path.join(ROOT, 'scripts/recovery.mjs'), 'utf8');
  assert.match(source, /isSymbolicLink/);
  assert.match(source, /archive inventory does not match its manifest/);
  assert.match(source, /isSafeArchivePath/);
});
