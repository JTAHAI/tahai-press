import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const article = (slug) => fs.readFileSync(path.join(DIST, 'stories', slug, 'index.html'), 'utf8');

test('PDF record renders a progressively enhanced reader with direct fallbacks', () => {
  const html = article('sample-pdf-record');
  assert.match(html, /data-pdf-reader/);
  assert.match(html, /role="toolbar" aria-label="PDF preview controls"/);
  assert.match(html, /data-pdf-view="FitH" aria-pressed="true"/);
  assert.match(html, /data-pdf-view="Fit" aria-pressed="false"/);
  assert.match(html, /data-pdf-fullscreen aria-controls="pdf-reader-sample-pdf-record"/);
  assert.match(html, /loading="eager"/);
  assert.match(html, /Preview not working\?/);
  assert.match(html, /<noscript>/);
  assert.match(html, /https:\/\/example\.pages\.dev\/uploads\/documents\/sample-document\.pdf/);
});

test('mixed article honors fit-page default and lazy-loads its supporting preview', () => {
  const html = article('sample-pdf-story');
  assert.match(html, /data-default-view="Fit"/);
  assert.match(html, /data-pdf-view="Fit" aria-pressed="true"/);
  assert.match(html, /#view=Fit&amp;toolbar=1&amp;navpanes=0/);
  assert.match(html, /loading="lazy"/);
});

test('local document metadata includes an automatically derived PDF file size', () => {
  const html = article('sample-pdf-record');
  assert.match(html, /<dt>File<\/dt><dd>PDF · [0-9.]+ (?:bytes|KB|MB|GB)<\/dd>/);
});

test('PDF reader script provides loading, view switching, and fullscreen state', () => {
  const script = read('public/assets/pdf-reader.js');
  assert.match(script, /documentElement\.classList\.add\('js'\)/);
  assert.match(script, /data-pdf-view/);
  assert.match(script, /requestFullscreen/);
  assert.match(script, /fullscreenchange/);
  assert.match(script, /12000/);
  assert.match(script, /initialLoadingMessage/);
  assert.match(script, /message === 'Loading preview…' \? initialLoadingMessage : message/);
  assert.match(script, /Preview may still be loading/);
  assert.match(script, /window\.print\(\)/);
  const builder = read('scripts/build.mjs');
  assert.match(builder, /split\('#'\)\[0\]/);
});

test('PDF reader CSS includes compact mobile actions, fullscreen layout, and print fallback', () => {
  const css = read('public/assets/styles.css');
  assert.match(css, /\.pdf-reader:fullscreen/);
  assert.match(css, /\.pdf-mobile-actions/);
  assert.match(css, /\.print-document-link/);
  assert.match(css, /@media print/);
  assert.match(css, /\.js \.pdf-view-controls/);
});

test('schema, CMS, and validator agree on PDF default-view options', () => {
  const schema = JSON.parse(read('schemas/article.schema.json'));
  assert.deepEqual(schema.properties.pdf_viewer_default.enum, ['fit-width', 'fit-page']);
  const cms = read('.pages.yml');
  const validator = read('scripts/validate-content.mjs');
  assert.match(cms, /name: pdf_viewer_default/);
  assert.match(cms, /name: fit-width/);
  assert.match(cms, /name: fit-page/);
  assert.match(validator, /PDF_VIEW_MODES/);
});
