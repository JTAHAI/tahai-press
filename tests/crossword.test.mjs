import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

const scriptFile = path.join(ROOT, 'public/assets/crossword.js');

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

test('crossword data contains seven valid five-by-five word-square editions', () => {
  const script = fs.readFileSync(scriptFile, 'utf8');
  const matches = [...script.matchAll(/words:\s*\[([^\]]+)\]/g)];
  assert.equal(matches.length, 7);
  for (const match of matches) {
    const words = [...match[1].matchAll(/'([A-Z]{5})'/g)].map((item) => item[1]);
    assert.equal(words.length, 5);
    for (let row = 0; row < 5; row += 1) {
      const column = words.map((word) => word[row]).join('');
      assert.equal(column, words[row], `${words.join(', ')} is not a word square at ${row}`);
    }
  }
});

test('crossword route and controls are generated as local static assets', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'puzzles/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(DIST, 'assets/crossword.js'), 'utf8');
  assert.match(html, /data-crossword-app/);
  assert.match(html, /data-crossword-grid/);
  assert.match(html, /data-crossword-check/);
  assert.match(html, /data-crossword-reveal/);
  assert.match(html, /data-crossword-reset/);
  assert.match(html, /data-crossword-next/);
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /Date\.now\(\) \/ 86400000/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket/);
});
