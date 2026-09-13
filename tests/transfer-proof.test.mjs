import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';

test('publisher transfer archive is self-verifying and excludes private build state', () => {
  execFileSync(process.execPath, ['scripts/package-transfer.mjs'], { cwd: ROOT });
  const output = execFileSync(process.execPath, ['scripts/verify-transfer.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /Publisher transfer verification passed/);
  const proof = JSON.parse(fs.readFileSync(path.join(ROOT, '.artifacts', 'transfer', 'publisher-transfer-proof.json'), 'utf8'));
  assert.equal(proof.verified, true);
  assert.equal(proof.forbiddenPaths, 0);
});
