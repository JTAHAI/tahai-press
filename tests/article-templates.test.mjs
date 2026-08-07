import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });

function article(slug) {
  return fs.readFileSync(path.join(DIST, 'stories', slug, 'index.html'), 'utf8');
}

test('written template prioritizes prose and omits a document viewer', () => {
  const html = article('sample-written-story');
  assert.match(html, /article article-standard/);
  assert.match(html, /article-template-standard/);
  assert.match(html, /class="prose article-prose"/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ol>/);
  assert.match(html, /min read/);
  assert.match(html, /Updated <time/);
  assert.doesNotMatch(html, /class="pdf-frame"/);
  assert.doesNotMatch(html, /class="external-document"/);
});

test('PDF template is document-first and retains direct fallbacks', () => {
  const html = article('sample-pdf-record');
  assert.match(html, /article article-pdf/);
  assert.match(html, /document-section document-section-primary/);
  assert.match(html, /<canvas[^>]+data-pdf-canvas/);
  assert.doesNotMatch(html, /<iframe/);
  assert.match(html, /data-pdf-fullscreen/);
  assert.match(html, />Full screen<\/span>/);
  assert.match(html, /Download PDF/);
  assert.match(html, /Sample records office/);
  assert.match(html, /1 page/);
  assert.ok(html.indexOf('document-section-primary') < html.indexOf('article-context'), 'PDF must precede optional context');
});

test('mixed template renders editorial context before its supporting PDF', () => {
  const html = article('sample-pdf-story');
  assert.match(html, /article article-mixed article-featured/);
  assert.match(html, /article-template-mixed/);
  assert.match(html, /Supporting document/);
  assert.ok(html.indexOf('article-context') < html.indexOf('document-section'), 'context must precede PDF');
});

test('external template uses a safe outbound card and never assumes iframe support', () => {
  const html = article('sample-external-document');
  assert.match(html, /article article-external/);
  assert.match(html, /class="external-document"/);
  assert.match(html, /href="https:\/\/example\.com\/sample-public-document\.pdf"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Open the source record/);
  assert.doesNotMatch(html, /<iframe/);
});

test('all article formats include reusable contributor and topic treatments', () => {
  for (const slug of ['sample-written-story', 'sample-pdf-record', 'sample-pdf-story', 'sample-external-document']) {
    const html = article(slug);
    assert.match(html, /class="author-card"/);
    assert.match(html, /class="article-tags"/);
    assert.match(html, /class="breadcrumbs"/);
  }
});
