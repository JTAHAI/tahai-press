import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

test('browser matrix covers Chromium, Firefox, and WebKit against an owned local static server', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'browser-matrix.mjs'), 'utf8');
  assert.match(source, /\['chromium', chromium\]/);
  assert.match(source, /\['firefox', firefox\]/);
  assert.match(source, /\['webkit', webkit\]/);
  assert.match(source, /127\.0\.0\.1/);
  assert.match(source, /console_errors/);
  assert.match(source, /local Pagefind index/);
  assert.match(source, /data-pdf-canvas/);
});
