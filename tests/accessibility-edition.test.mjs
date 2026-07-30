import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function build() { run('scripts/build.mjs'); }

test('reader tools remain local, account-free, and available through named controls', () => {
  build();
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const script = read('public/assets/reading-tools.js');
  assert.match(home, /data-reading-tools/);
  assert.match(home, /Reader preferences/);
  assert.match(home, /data-reader-text="larger"/);
  assert.match(home, /data-reader-surface/);
  assert.match(script, /localStorage/);
  assert.match(script, /tahai-press-reader-preferences-v1/);
  assert.doesNotMatch(script, /\bfetch\s*\(/);
});

test('reader preference CSS supports text, spacing, measure, surfaces, link visibility, decoration, motion, and 400 percent zoom fallback', () => {
  const css = read('public/assets/styles.css');
  for (const token of [
    "data-reader-text='larger'", "data-reader-spacing='open'", "data-reader-measure='narrow'",
    "data-reader-surface='dark'", 'reader-underline-links', 'reader-simplified', 'reader-reduce-motion'
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(css, /@media \(max-width: 20rem\)/);
  assert.match(css, /\.js \.reading-tools-controls\.js-only\s*\{[^}]*display:grid !important/s);
});

test('every published article receives a noindex simplified reading route without an embedded PDF', () => {
  build();
  const articles = fs.readdirSync(path.join(ROOT, 'content/articles')).map((name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content/articles', name), 'utf8'))).filter((article) => article.status === 'published');
  for (const article of articles) {
    const standard = fs.readFileSync(path.join(DIST, 'stories', article.slug, 'index.html'), 'utf8');
    const reader = fs.readFileSync(path.join(DIST, 'stories', article.slug, 'reader', 'index.html'), 'utf8');
    assert.match(standard, new RegExp(`/stories/${article.slug}/reader/`));
    assert.match(reader, /Simplified reading view/);
    assert.match(reader, /<meta name="robots" content="[^"]*noindex/);
    assert.doesNotMatch(reader, /<iframe\b/);
    assert.equal((reader.match(/<h1\b/g) || []).length, 1);
  }
});

test('document articles publish a visible HTML alternative and connect the PDF preview to it', () => {
  build();
  const pdf = fs.readFileSync(path.join(DIST, 'stories', 'sample-pdf-record', 'index.html'), 'utf8');
  const external = fs.readFileSync(path.join(DIST, 'stories', 'sample-external-document', 'index.html'), 'utf8');
  assert.match(pdf, /Document summary in HTML/);
  assert.match(pdf, /aria-describedby="document-accessible-summary-sample-pdf-record pdf-support-sample-pdf-record"/);
  assert.match(external, /document-accessible-summary/);
  assert.match(external, /The HTML summary is provided/);
});

test('published document articles fail closed when their accessible HTML summary is missing', () => {
  const file = path.join(ROOT, 'content/articles/sample-pdf-record.json');
  const original = fs.readFileSync(file, 'utf8');
  try {
    const article = JSON.parse(original);
    article.document_accessible_summary = '';
    fs.writeFileSync(file, `${JSON.stringify(article, null, 2)}\n`);
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /document_accessible_summary of at least 40 characters/);
  } finally {
    fs.writeFileSync(file, original);
  }
});

test('incomplete document summaries remain warnings for drafts rather than blocking draft saves', () => {
  const file = path.join(ROOT, 'content/articles/sample-pdf-record.json');
  const original = fs.readFileSync(file, 'utf8');
  try {
    const article = JSON.parse(original);
    article.status = 'draft';
    article.published_at = '';
    article.document_accessible_summary = '';
    article.review_content = false;
    article.review_rights = false;
    article.review_accessibility = false;
    fs.writeFileSync(file, `${JSON.stringify(article, null, 2)}\n`);
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /WARNING .*document_accessible_summary/);
  } finally {
    fs.writeFileSync(file, original);
  }
});

test('Editorial Studio distinguishes ready, attention, and blocking accessibility guidance', () => {
  const script = read('public/assets/writer-desk.js');
  const builder = read('scripts/build.mjs');
  assert.match(script, /Publication blocker/);
  assert.match(script, /Needs attention/);
  assert.match(script, /skippedHeading/);
  assert.match(script, /Markdown image needs alternative text|Markdown images need alternative text|Every meaningful Markdown image needs alternative text/);
  assert.match(script, /item\.level === 'blocker'/);
  assert.match(builder, /studio-check-legend/);
});

test('reader experience release audit passes the generated publication', () => {
  build();
  const report = path.join(ROOT, '.artifacts', 'test-reader-experience.json');
  run('scripts/audit-reader-experience.mjs', ['--report', report]);
  const payload = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.equal(payload.passed, true);
  assert.equal(payload.error_count, 0);
  assert.equal(payload.simplified_routes, 4);
  assert.equal(payload.document_html_summaries, 3);
});

test('Pages CMS exposes reader settings and required document alternatives in plain language', () => {
  const config = read('.pages.yml');
  const schema = JSON.parse(read('schemas/article.schema.json'));
  assert.match(config, /name: document_accessible_summary/);
  assert.match(config, /Accessible HTML document summary/);
  assert.match(config, /name: reader_tools_enabled/);
  assert.match(config, /name: simplified_reading_enabled/);
  assert.equal(schema.properties.document_accessible_summary.maxLength, 5000);
  assert.ok(schema.allOf.some((rule) => rule.then?.required?.includes('document_accessible_summary')));
});
