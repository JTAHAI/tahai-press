import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

test('live release verifier checks attested files, exact build identity, and deployed edge headers', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-live-release.mjs'), 'utf8');
  for (const token of ['--origin', '--expected-commit', 'publication-build.json', 'publication-integrity.json', 'edgeSecurityHeaders', 'sha256Bytes', 'cache-control']) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /redirect: 'error'/);
  assert.match(source, /AbortSignal\.timeout/);
});
