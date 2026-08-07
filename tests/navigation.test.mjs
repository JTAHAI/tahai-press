import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

const VERSION = '3.0.0-alpha.1';

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

function routeExists(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return fs.existsSync(path.join(DIST, 'index.html'));
  const relative = clean.replace(/^\//, '');
  if (path.extname(relative)) return fs.existsSync(path.join(DIST, relative));
  return fs.existsSync(path.join(DIST, relative, 'index.html'));
}

function captureNavigation(html) {
  const match = html.match(/<nav class="desktop-nav" aria-label="Primary navigation">([\s\S]*?)<\/nav>\s*<nav class="desktop-nav-utilities" aria-label="Additional navigation">([\s\S]*?)<\/nav>/);
  assert.ok(match, 'desktop navigation shell was not rendered');
  return { primary: match[1], utilities: match[2] };
}

test('generated internal navigation links resolve to built files', () => {
  build();
  const htmlFiles = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.html')) htmlFiles.push(file);
    }
  };
  walk(DIST);

  const missing = [];
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      if (!routeExists(href)) missing.push(`${path.relative(DIST, file)} -> ${href}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('primary navigation is rendered by the build core and grouped before mobile takeover', () => {
  build();
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const { primary, utilities } = captureNavigation(home);
  assert.match(home, /<div class="desktop-navigation" data-desktop-navigation>/);
  assert.match(home, new RegExp(`/assets/navigation\\.css\\?v=${VERSION}`));
  assert.match(home, new RegExp(`/assets/navigation\\.js\\?v=${VERSION}`));
  assert.match(home, /class="navigation-promise"/);
  for (const href of ['\/stories\/', '\/sections\/', '\/series\/', '\/search\/', '\/hubs\/', '\/about\/', '\/submit\/']) {
    assert.match(primary, new RegExp(`href="${href}"`));
  }
  assert.doesNotMatch(primary, /href="\/saved\/"/);
  assert.doesNotMatch(primary, /href="\/edition\/"/);
  assert.match(utilities, /<summary>Publisher tools/);
  assert.match(utilities, /<summary>Reader desk/);
  assert.match(utilities, /data-navigation-menu/);
  assert.match(utilities, /href="\/media-desk\/"/);
  assert.match(utilities, /href="\/studio\/"/);
  assert.match(utilities, /href="\/saved\/"/);
  assert.match(utilities, /href="\/edition\/"/);
});

test('current-route markers remain correct on section and archive pages', () => {
  build();
  const stories = fs.readFileSync(path.join(DIST, 'stories/index.html'), 'utf8');
  assert.match(stories, /href="\/stories\/" aria-current="page"/);
  const hubs = fs.readFileSync(path.join(DIST, 'hubs/index.html'), 'utf8');
  assert.match(hubs, /href="\/hubs\/" aria-current="page"/);
});
