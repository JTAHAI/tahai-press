import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

const script = fs.readFileSync(path.join(ROOT, 'public/assets/navigation.js'), 'utf8');

test('navigation menus close on Escape and outside pointer interaction', () => {
  assert.match(script, /event\.key !== 'Escape'/);
  assert.match(script, /summary\?\.focus\(\)/);
  assert.match(script, /document\.addEventListener\('pointerdown'/);
  assert.match(script, /other !== menu/);
});

test('navigation enhancement has no network or credential behavior', () => {
  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage']) {
    assert.equal(script.includes(forbidden), false, `navigation enhancement must not use ${forbidden}`);
  }
});
