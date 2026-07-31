import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

function routeExists(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return fs.existsSync(path.join(DIST, 'index.html'));
  const relative = clean.replace(/^\//, '');
  if (path.extname(relative)) return fs.existsSync(path.join(DIST, relative));
  return fs.existsSync(path.join(DIST, relative, 'index.html'));
}

test('generated internal navigation links resolve to built files', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
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

test('primary navigation marks the current route', () => {
  const stories = fs.readFileSync(path.join(DIST, 'stories/index.html'), 'utf8');
  assert.match(stories, /href="\/stories\/" aria-current="page"/);
  const hubs = fs.readFileSync(path.join(DIST, 'hubs/index.html'), 'utf8');
  assert.match(hubs, /href="\/hubs\/" aria-current="page"/);
});


test('desktop navigation is grouped by the post-build hardener', () => {
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const primary = home.match(/<nav class="desktop-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  const utilities = home.match(/<nav class="desktop-nav-utilities"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  for (const label of ['Stories', 'Sections', 'Series', 'Search', 'Coverage Hubs', 'About', 'Submit']) assert.match(primary, new RegExp(`>${label}<`));
  assert.match(utilities, /<summary>Publisher tools/);
  assert.match(utilities, /<summary>Reader desk/);
  assert.match(home, /href="\/assets\/navigation\.css\?v=2\.3\.2"/);
  assert.match(home, /src="\/assets\/navigation\.js\?v=2\.3\.2" defer/);
  assert.doesNotMatch(home, /class="navigation-promise"/);
});
