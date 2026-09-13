import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withBuildLock } from '../scripts/lib/build-lock.mjs';

function temporaryLock() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-press-build-lock-'));
  return { directory, lockPath: path.join(directory, 'build.lock') };
}

test('build lock releases after successful work and removes stale holders', async (t) => {
  const { directory, lockPath } = temporaryLock();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  await withBuildLock(async () => assert.ok(fs.existsSync(lockPath)), { lockPath });
  assert.ok(!fs.existsSync(lockPath));

  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'holder.json'), '{"pid":-1}\n', 'utf8');
  await withBuildLock(async () => assert.ok(fs.existsSync(lockPath)), { lockPath });
  assert.ok(!fs.existsSync(lockPath));
});

test('build lock fails fast while a live holder owns the output', async (t) => {
  const { directory, lockPath } = temporaryLock();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, 'holder.json'), `${JSON.stringify({ pid: process.pid })}\n`, 'utf8');
  await assert.rejects(
    withBuildLock(async () => {}, { lockPath }),
    /already running/
  );
});
