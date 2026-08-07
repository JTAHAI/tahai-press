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
