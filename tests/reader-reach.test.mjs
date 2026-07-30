import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST, loadContent } from '../scripts/lib/content.mjs';
import { readerReachConfig, serviceWorkerSource } from '../scripts/lib/reader-reach.mjs';

const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const built = (relative) => fs.readFileSync(path.join(DIST, relative), 'utf8');
let buildRan = false;

function build() {
  if (!buildRan) {
    run('scripts/build.mjs');
    buildRan = true;
  }
}

test('the current package and site configuration enable static Reader Reach without another account', () => {
  const pkg = JSON.parse(read('package.json'));
  const { site } = loadContent();
  const reach = readerReachConfig(site);
  assert.equal(pkg.version, '2.3.0');
  assert.equal(reach.enabled, true);
  assert.equal(reach.offlineEnabled, true);
  assert.equal(reach.savedArticlesEnabled, true);
  assert.equal(reach.browserShareEnabled, true);
  assert.equal(reach.currentEditionEnabled, true);
});

test('build generates installable offline reading, saved stories, and a printable current edition', () => {
  build();
  for (const relative of ['service-worker.js', 'site.webmanifest', 'offline/index.html', 'saved/index.html', 'edition/index.html', 'assets/reader-reach.js']) {
    assert.equal(fs.existsSync(path.join(DIST, relative)), true, relative);
  }
  const manifest = JSON.parse(built('site.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.shortcuts.some((item) => item.url === '/edition/'));
  assert.ok(manifest.shortcuts.some((item) => item.url === '/saved/'));
});

test('article pages expose accessible save and share controls with local status announcements', () => {
  build();
  const html = built('stories/sample-written-story/index.html');
  assert.match(html, /data-save-article/);
  assert.match(html, /data-share-article/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /data-reach-status[^>]*role="status"/);
  assert.match(html, /Save or share this article/);
});

test('saved-story library uses browser-local storage and never calls a hosted backend', () => {
  const html = read('public/assets/reader-reach.js');
  assert.match(html, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(html, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(html, /navigator\.share/);
  assert.match(html, /navigator\.clipboard/);
  assert.match(html, /serviceWorker\.register\('\/service-worker\.js'/);
  assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//);
});

test('generated service worker precaches only same-origin publication routes and provides an offline fallback', () => {
  build();
  const worker = built('service-worker.js');
  assert.match(worker, /const OFFLINE_ROUTE = "\/offline\/"/);
  assert.match(worker, /\/stories\/sample-written-story\//);
  assert.match(worker, /request\.mode === 'navigate'/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.doesNotMatch(worker, /https?:\/\//);
});

test('current edition is formal, readable, printable, and linked to complete articles', () => {
  build();
  const html = built('edition/index.html');
  assert.match(html, /Current edition/);
  assert.match(html, /data-print-edition/);
  assert.match(html, /edition-story-list/);
  assert.match(html, /\/stories\/sample-written-story\//);
  assert.match(read('public/assets/styles.css'), /@media print[\s\S]*?\.edition-page/);
});

test('Pages CMS and guided setup expose Reader Reach in plain language', () => {
  const cms = read('.pages.yml');
  const setup = read('public/assets/setup-wizard.js');
  assert.match(cms, /name: reader_reach[\s\S]*?label: Reader Reach/);
  assert.match(cms, /label: Cache recent pages for offline reading/);
  assert.match(cms, /label: Let readers save stories on this device/);
  assert.match(cms, /label: Generate a printable current edition/);
  assert.match(setup, /reader_reach_enabled/);
  assert.match(setup, /offline_enabled/);
  assert.match(setup, /saved_articles_enabled/);
});

test('service worker generator produces a deterministic cache contract', () => {
  const first = serviceWorkerSource({ version: '1.7.0', precache: ['/', '/offline/', '/'] });
  const second = serviceWorkerSource({ version: '1.7.0', precache: ['/', '/offline/'] });
  assert.equal(first, second);
  assert.match(first, /tahai-press-reader-1\.7\.0/);
  assert.match(first, /"\/offline\/"/);
});
