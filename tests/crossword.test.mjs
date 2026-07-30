import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST, loadContent } from '../scripts/lib/content.mjs';
import { publicCrossword, scanCrossword, validateCrossword } from '../scripts/lib/crosswords.mjs';

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

test('crossword content contains seven valid five-by-five word-square editions', () => {
  const { crosswords } = loadContent();
  const novice = crosswords.filter((item) => item.difficulty === 'novice');
  assert.equal(novice.length, 7);
  for (const puzzle of novice) {
    assert.deepEqual(validateCrossword(puzzle), []);
    assert.equal(puzzle.grid.length, 5);
    for (let row = 0; row < 5; row += 1) {
      const column = puzzle.grid.map((word) => word[row]).join('');
      assert.equal(column, puzzle.grid[row], `${puzzle.slug} is not a word square at ${row}`);
    }
  }
});

test('expert crossword collection includes multiple blocked fifteen-by-fifteen editions with long answers', () => {
  const { crosswords } = loadContent();
  const expert = crosswords.filter((item) => item.difficulty === 'expert');
  assert.ok(expert.length >= 3);
  for (const puzzle of expert) {
    assert.deepEqual(validateCrossword(puzzle), []);
    assert.equal(puzzle.grid.length, 15);
    assert.equal(puzzle.grid.every((row) => row.length === 15), true);
    assert.equal(puzzle.grid.some((row) => row.includes('#')), true);
    assert.equal(scanCrossword(puzzle).entries.some((entry) => entry.answer.length >= 8), true);
  }
});

test('crossword route, print control, and CMS-managed data are generated as local static assets', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'puzzles/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(DIST, 'assets/crossword.js'), 'utf8');
  const data = JSON.parse(fs.readFileSync(path.join(DIST, 'assets/crosswords.json'), 'utf8'));
  assert.match(html, /data-crossword-app/);
  assert.match(html, /id="crossword-data"/);
  assert.match(html, /data-crossword-print/);
  assert.match(html, /data-crossword-mode="novice"/);
  assert.match(html, /data-crossword-mode="expert"/);
  assert.equal(data.puzzles.length, 10);
  assert.ok(data.puzzles.every((item) => !('__file' in item)));
  assert.match(script, /localStorage\.setItem/);
  assert.match(script, /ArrowLeft/);
  assert.match(script, /window\.print/);
  assert.doesNotMatch(script, /const noviceWordSquares|const expertPuzzles/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|WebSocket/);
});

test('public crossword records expose only the playable grid and clue contract', () => {
  const puzzle = loadContent().crosswords[0];
  const record = publicCrossword(puzzle);
  assert.equal(record.slug, puzzle.slug);
  assert.equal(record.clues.length, scanCrossword(puzzle).entries.length);
  assert.ok(record.clues.every((clue) => clue.clue && clue.answer));
  assert.deepEqual(Object.keys(record).sort(), ['clues', 'deck', 'difficulty', 'grid', 'rotation_order', 'slug', 'title']);
});

test('crossword JSON Schema documents the CMS-managed source contract', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/crossword.schema.json'), 'utf8'));
  assert.equal(schema.title, 'TAHAI Press crossword');
  assert.deepEqual(schema.properties.difficulty.enum, ['novice', 'expert']);
  assert.equal(schema.properties.grid.items.pattern, '^[A-Z#]+$');
  assert.equal(schema.properties.clues.items.additionalProperties, false);
});
