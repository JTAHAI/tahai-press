import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

test('static build creates all release routes, PDF reader assets, and media', () => {
  build();
  const expected = [
    'index.html',
    'stories/index.html',
    'hubs/index.html',
    'about/index.html',
    'accessibility/index.html',
    'submit/index.html',
    'contact/index.html',
    'stories/sample-written-story/index.html',
    'stories/sample-pdf-record/index.html',
    'stories/sample-pdf-story/index.html',
    'stories/sample-external-document/index.html',
    'uploads/documents/sample-document.pdf',
    'assets/styles.css',
    'assets/pdf-reader.js',
    'assets/search.js',
    'assets/crossword.js',
    'assets/tahai-press-logo.png',
    'assets/tahai-press-social.png',
    'puzzles/index.html',
    'search/index.html',
    'search-index.json',
    'categories/index.html',
    'topics/index.html',
    'authors/index.html',
    'archive/index.html',
    '_redirects',
    '.well-known/publication-redirects.json',
    '.well-known/media-asset-manifest.json',
    '.well-known/tahai-press.json',
    'humans.txt',
    'sitemap.xml',
    'feed.xml',
    'feed.json',
    'site.webmanifest',
    '404.html'
  ];
  for (const item of expected) {
    assert.equal(fs.existsSync(path.join(DIST, item)), true, `${item} was not built`);
  }
});

test('homepage contains the branded newspaper foundation, project links, and featured template proof', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert.match(html, /class="publication-bar"/);
  assert.match(html, /class="brand-symbol(?:\s|\")/);
  assert.match(html, /A serious publishing desk\. No database required\./);
  assert.match(html, /How PDF-First Publishing Works/);
  assert.match(html, /class="featured-story"/);
  assert.match(html, /class="mission-band"/);
  assert.match(html, /class="[^"]*product-broadsheet[^"]*"/);
  assert.match(html, /https:\/\/github\.com\/JTAHAI\/tahai-press/);
  assert.match(html, /https:\/\/tahai\.net/);
  assert.match(html, /tahai-press-logo\.png/);
  assert.match(html, /class="story-tip-band"/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.match(html, /aria-label="Mobile navigation"/);
  assert.match(html, /--brand:#123a5a/);
  assert.doesNotMatch(html, /undefined|null/);
});
