import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

test('the GA gate covers static delivery, portability, optional services, and real browsers', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['verify:ga'], 'node scripts/verify-ga.mjs');
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-ga.mjs'), 'utf8');
  for (const id of ['root-clean-install', 'playwright-browser-install', 'root-test-suite', 'accessibility-audit', 'security-audit', 'official-themes', 'evidence-validation', 'migration-proof', 'transfer-package', 'release-packages', 'worker-tests', 'collaboration-tests', 'real-browser-matrix']) assert.match(source, new RegExp(`id: '${id}'`));
  assert.match(source, /ga-gate-report\.json/);
  assert.match(source, /if \(!passed\) break/);
});
