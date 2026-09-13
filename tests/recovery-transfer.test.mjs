import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';
import { readSafeZip } from '../scripts/lib/safe-zip.mjs';
import { createSafetyCopy, planSafetyCopyRestore, recoveryHistory, restoreSafetyCopy, undoSafetyCopyRestore, verifySafetyCopy } from '../scripts/lib/recovery.mjs';

test('portable transfer package contains publisher files and no deployment output', () => {
  execFileSync(process.execPath, ['scripts/package-transfer.mjs'], { cwd: ROOT });
  const archive = path.join(ROOT, '.artifacts/transfer/publisher-transfer.zip');
  const entries = readSafeZip(archive);
  assert.ok(entries.has('content/site.json'));
  assert.ok(entries.has('TRANSFER-MANIFEST.json'));
  assert.ok(![...entries.keys()].some((entry) => entry.startsWith('dist/') || entry.startsWith('.artifacts/')));
});

test('safety copies require confirmation, restore atomically, and preserve an undo path', () => {
  const fixture = fs.mkdtempSync(path.join(process.cwd(), '.artifacts', 'recovery-fixture-'));
  const artifacts = path.join(fixture, 'private-recovery');
  try {
    fs.mkdirSync(path.join(fixture, 'content'), { recursive: true });
    fs.mkdirSync(path.join(fixture, 'themes', 'published'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'content', 'site.json'), '{"edition":"original"}\n');
    fs.writeFileSync(path.join(fixture, 'themes', 'published', 'custom.zip'), 'original-theme');
    const created = createSafetyCopy({ repositoryRoot: fixture, artifactRoot: artifacts });
    assert.equal(created.archive, 'publisher-safety-copy.zip');
    assert.equal(verifySafetyCopy({ repositoryRoot: fixture, artifactRoot: artifacts }).files, 2);
    assert.deepEqual(planSafetyCopyRestore({ repositoryRoot: fixture, artifactRoot: artifacts }).affectedPaths, ['content', 'themes/published']);
    fs.writeFileSync(path.join(fixture, 'content', 'site.json'), '{"edition":"changed"}\n');
    assert.throws(() => restoreSafetyCopy({ repositoryRoot: fixture, artifactRoot: artifacts }), /explicit confirmation/);
    const restored = restoreSafetyCopy({ repositoryRoot: fixture, artifactRoot: artifacts, confirm: true });
    assert.equal(fs.readFileSync(path.join(fixture, 'content', 'site.json'), 'utf8'), '{"edition":"original"}\n');
    assert.equal(recoveryHistory({ repositoryRoot: fixture, artifactRoot: artifacts }).length, 1);
    assert.throws(() => undoSafetyCopyRestore({ repositoryRoot: fixture, artifactRoot: artifacts, transactionId: restored.transactionId }), /explicit confirmation/);
    undoSafetyCopyRestore({ repositoryRoot: fixture, artifactRoot: artifacts, transactionId: restored.transactionId, confirm: true });
    assert.equal(fs.readFileSync(path.join(fixture, 'content', 'site.json'), 'utf8'), '{"edition":"changed"}\n');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
