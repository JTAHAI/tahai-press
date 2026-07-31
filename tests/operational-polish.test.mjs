import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST, loadContent } from '../scripts/lib/content.mjs';
import { mediaHealth, performanceHealth, newsroomHealth } from '../scripts/lib/operations.mjs';
import { launchReadiness } from '../scripts/lib/launch-readiness.mjs';

const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
let buildRan = false;

function build() {
  if (!buildRan) {
    run('scripts/build.mjs');
    buildRan = true;
  }
}

test('Operational Polish package exposes one-command operational health checks', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.3.2');
  for (const command of ['audit:media', 'audit:performance', 'newsroom:health']) assert.ok(pkg.scripts[command]);
  assert.match(pkg.scripts.check, /audit:media/);
  assert.match(pkg.scripts.check, /audit:performance/);
  assert.match(pkg.scripts.check, /newsroom:health/);
});

test('media health reports references, dimensions, duplicates, missing files, and oversized uploads', async () => {
  const content = loadContent();
  const report = await mediaHealth(content);
  assert.equal(report.summary.missing, 0);
  assert.equal(report.summary.orphaned, 0);
  assert.equal(report.summary.oversized, 0);
  assert.equal(report.summary.duplicates, 0);
  assert.equal(report.summary.near_duplicates >= 0, true);
  assert.ok(report.inventory.some((item) => item.type === 'document'));
  assert.ok(report.inventory.filter((item) => item.type === 'image').every((item) => item.dimensions));
});

test('performance budgets protect the homepage, styles, scripts, search, file count, and Cloudflare asset ceiling', () => {
  build();
  const content = loadContent();
  const report = performanceHealth({ dist: DIST, budgets: content.site.operations.performance_budgets });
  assert.equal(report.passed, true);
  assert.equal(report.checks.length, 6);
  assert.ok(report.largest_files.length > 0);
  assert.ok(report.metrics.homepage_html_bytes > 0);
});

test('newsroom dashboard remains private and summarizes editorial, launch, media, and performance state', () => {
  build();
  run('scripts/audit-media.mjs');
  run('scripts/audit-performance.mjs');
  run('scripts/create-newsroom-dashboard.mjs');
  const html = read('.artifacts/newsroom-health/index.html');
  const report = JSON.parse(read('.artifacts/newsroom-health/report.json'));
  assert.match(html, /Private build artifact/);
  assert.match(html, /Newsroom health/);
  assert.equal(report.summary.media_warnings, 0);
  assert.equal(report.summary.performance_budgets_passed, true);
  assert.equal(fs.existsSync(path.join(DIST, 'newsroom-health', 'index.html')), false);
});

test('Contributor Composer opens article JSON and manages up to twenty browser-local drafts without a server', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'studio', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(DIST, 'assets', 'writer-desk.js'), 'utf8');
  assert.match(html, /Contributor Composer/);
  assert.match(html, /data-studio-draft-library/);
  assert.match(html, /data-studio-save-draft/);
  assert.match(html, /data-studio-import/);
  assert.match(html, /Download contributor package/);
  assert.match(script, /draftLibraryKey/);
  assert.match(script, /file\.text\(\)/);
  assert.match(script, /writeRecords\(draftLibraryKey,[\s\S]*?, 20\)/);
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
});

test('Pages CMS exposes crossword rotation without adding another publishing account', () => {
  const cms = read('.pages.yml');
  assert.match(cms, /name: crosswords[\s\S]*?path: content\/crosswords/);
  assert.match(cms, /label: Include in rotation/);
  assert.match(cms, /label: Grid rows/);
  assert.match(cms, /label: Clues/);
  assert.match(cms, /Use uppercase A-Z letters and # black squares only/);
});

test('operational health composes deterministic private newsroom state', async () => {
  build();
  const content = loadContent();
  const media = await mediaHealth(content);
  const performance = performanceHealth({ dist: DIST, budgets: content.site.operations.performance_budgets });
  const report = newsroomHealth({ site: content.site, articles: content.articles, redirects: 3, media, performance, launch: launchReadiness(content) });
  assert.equal(report.summary.published, 4);
  assert.equal(report.summary.redirects, 3);
  assert.equal(report.summary.attention_items, 0);
  assert.equal(report.performance.passed, true);
});

test('first-deploy and GitHub project pages explain Operational Polish without exposing the private dashboard', () => {
  build();
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const project = read('github-pages/index.html');
  assert.match(home, /private operational health reports/i);
  assert.match(home, /Open the Contributor Composer/);
  assert.doesNotMatch(home, /\.artifacts\/newsroom-health\/index\.html/);
  assert.match(project, /Operational Polish · Version 1\.6/);
  assert.match(project, /Reader Reach · Version 1\.7/);
  assert.match(project, /tahai-press\.tahai\.net/);
});
