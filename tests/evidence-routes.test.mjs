import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });

test('published evidence records render only public metadata and link their receipts context', () => {
  const index = fs.readFileSync(path.join(DIST, 'records', 'index.html'), 'utf8');
  const record = fs.readFileSync(path.join(DIST, 'records', 'sample-meeting-record', 'index.html'), 'utf8');
  assert.match(index, /Public evidence records/);
  assert.match(index, /sample-meeting-record/);
  assert.match(record, /Sample meeting record evidence ledger/);
  assert.match(record, /Sample meeting document/);
  assert.match(record, /Receipts Mode/);
  assert.doesNotMatch(record, /private_note|editor_notes|token/i);
});
