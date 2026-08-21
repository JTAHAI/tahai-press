import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';

test('Migration Studio proves dry-run immutability and exact rollback in isolation', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['verify:migration'], 'node scripts/verify-migration.mjs');
  const output = execFileSync(process.execPath, ['scripts/verify-migration.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /Migration proof passed/);
  const proof = JSON.parse(fs.readFileSync(path.join(ROOT, '.artifacts', 'migration-proof.json'), 'utf8'));
  assert.deepEqual(proof.dryRun, { planned: 1, wroteFiles: false });
  assert.equal(proof.rollback.exactRestoration, true);
});
