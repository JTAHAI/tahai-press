import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

test('the enterprise gate defines twenty publisher-safe release controls and a durable report', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['verify:enterprise'], 'node scripts/verify-enterprise.mjs');
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-enterprise.mjs'), 'utf8');
  const ids = ['governance-contract', 'package-runtime-contract', 'lockfile-contract', 'content-contract', 'cms-boundary', 'redirect-contract', 'unit-suite', 'media-health', 'static-build', 'deployment-integrity', 'accessibility-experience', 'reader-experience', 'performance-budget', 'source-security', 'theme-supply-chain', 'evidence-boundary', 'migration-reversibility', 'recovery-roundtrip', 'publisher-transfer', 'release-package'];
  assert.equal(ids.length, 20);
  for (const id of ids) assert.match(source, new RegExp(`id: '${id}'`));
  assert.match(source, /expectedControlCount/);
  assert.match(source, /enterprise-release-report\.json/);
  assert.match(source, /if \(!result\.passed\) break/);
});
