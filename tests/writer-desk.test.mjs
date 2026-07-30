import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DIST, ROOT, readJson } from '../scripts/lib/content.mjs';

const runBuild = () => execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, encoding: 'utf8' });
const built = (relative) => fs.readFileSync(path.join(DIST, relative), 'utf8');
let buildRan = false;

function build() {
  if (!buildRan) {
    runBuild();
    buildRan = true;
  }
}

test('v2.2 identifies the Writer Desk release and keeps the studio route stable', () => {
  assert.equal(readJson(path.join(ROOT, 'package.json')).version, '2.2.1');
  build();
  const html = built('studio/index.html');
  assert.match(html, /Writer Desk · private by design/);
  assert.match(html, /id="writer-editor"/);
  assert.match(html, /data-writer-body/);
  assert.match(html, /data-writer-open-palette/);
  assert.match(html, /data-writer-focus-mode/);
  assert.match(html, /data-writer-revision-library/);
  assert.match(html, /\/assets\/writer-desk\.js/);
  assert.doesNotMatch(html, /\/assets\/editorial-studio\.js/);
});

test('Writer Desk preserves a no-network local drafting contract', () => {
  build();
  const script = built('assets/writer-desk.js');
  assert.match(script, /localStorage/);
  assert.match(script, /DOMParser/);
  assert.match(script, /new Blob/);
  assert.match(script, /navigator\.clipboard/);
  assert.match(script, /:::key-points/);
  assert.match(script, /:::sources/);
  assert.match(script, /story_blocks: structured\.blocks/);
  assert.match(script, /source_links: structured\.sources/);
  assert.doesNotMatch(script, /\bfetch\s*\(/);
  assert.doesNotMatch(script, /XMLHttpRequest/);
});

test('Writer Desk responsive rules prevent orphaned laptop columns', () => {
  build();
  const css = built('assets/styles.css');
  assert.match(css, /\.writer-desk-overview\s*\{[\s\S]*?grid-template-columns:\s*minmax\(20rem,\s*0\.78fr\)\s*minmax\(0,\s*1\.22fr\)/);
  assert.match(css, /\.writer-desk-feature-grid\s*\{[\s\S]*?repeat\(auto-fit,\s*minmax\(min\(100%,\s*13\.5rem\),\s*1fr\)\)/);
  assert.match(css, /\.studio-layout\s*\{[\s\S]*?minmax\(38rem,\s*1\.35fr\)\s*minmax\(22rem,\s*\.65fr\)/);
  assert.match(css, /@media \(max-width:\s*70rem\)[\s\S]*?\.writer-desk-overview\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width:\s*70rem\)[\s\S]*?\.studio-layout\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /\.writer-desk-overview-copy h2[\s\S]*?overflow-wrap:\s*normal/);
});

test('Writer Desk includes keyboard, slash-command, paste-cleanup, and revision controls', () => {
  build();
  const script = built('assets/writer-desk.js');
  for (const contract of [
    "event.key.toLowerCase() === 'k'",
    'updateSlashMenu',
    'htmlToMarkdown',
    'revisionLibraryKey',
    'saveRevision',
    'writer-focus-mode',
    'pull-quote',
    'fact-box',
    'timeline',
    'document'
  ]) assert.match(script, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
