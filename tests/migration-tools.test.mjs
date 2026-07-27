import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';
import {
  discoverRecords, htmlToMarkdown, importContent, parseCsv, parseFrontmatter,
  parseWordPressWxr, slugify
} from '../scripts/lib/importers.mjs';

const fixtures = path.join(ROOT, 'tests/fixtures/imports');

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'publication-import-'));
  const articles = path.join(root, 'articles');
  const media = path.join(root, 'documents');
  const report = path.join(root, 'reports', 'report.json');
  fs.mkdirSync(articles, { recursive: true });
  return { root, articles, media, report };
}

function importFixture(input, type, extra = {}) {
  const temp = workspace();
  const report = importContent({
    input,
    type,
    outputDirectory: temp.articles,
    mediaDirectory: temp.media,
    reportFile: temp.report,
    conflictMode: 'skip',
    defaults: { status: 'draft', author: 'editorial-team', category: 'community-reporting', hub: '' },
    ...extra
  });
  return { temp, report };
}

test('slug, HTML, frontmatter, and CSV helpers preserve editorial content safely', () => {
  assert.equal(slugify('  Café & Council — Update! '), 'cafe-and-council-update');
  assert.match(htmlToMarkdown('<h2>Finding</h2><p>A <strong>public</strong> record.</p>'), /## Finding/);
  assert.match(htmlToMarkdown('<h2>Finding</h2><p>A <strong>public</strong> record.</p>'), /\*\*public\*\*/);
  const markdown = fs.readFileSync(path.join(fixtures, 'markdown/field-notes.md'), 'utf8');
  const parsed = parseFrontmatter(markdown);
  assert.equal(parsed.data.slug, 'field-notes-library');
  assert.deepEqual(parsed.data.tags, ['library', 'community']);
  const rows = parseCsv(fs.readFileSync(path.join(fixtures, 'articles.csv'), 'utf8'));
  assert.equal(rows[0].title, 'CSV Story, with a Comma');
  assert.match(rows[0].body, /line breaks/);
});

test('WordPress WXR parser imports posts, ignores attachments, and records legacy URLs', () => {
  const records = parseWordPressWxr(fs.readFileSync(path.join(fixtures, 'sample-wxr.xml'), 'utf8'));
  assert.equal(records.length, 1);
  assert.equal(records[0].slug, 'council-community-update');
  assert.equal(records[0].legacy_id, '42');
  assert.equal(records[0].legacy_url, 'https://example.org/2024/03/council-community-update/');
  assert.deepEqual(records[0].categories, ['Local Government']);
  assert.deepEqual(records[0].tags, ['Public Records']);
  assert.match(records[0].body, /## What happened/);
});

test('WordPress imports are safe drafts with review gates off and a URL map', () => {
  const { temp, report } = importFixture(path.join(fixtures, 'sample-wxr.xml'), 'wordpress');
  assert.deepEqual(report.summary, { discovered: 1, planned: 0, imported: 1, skipped: 0, failed: 0, assets_planned: 0, assets_copied: 0 });
  assert.equal(report.url_map.length, 1);
  assert.equal(report.url_map[0].to, '/stories/council-community-update/');
  const article = JSON.parse(fs.readFileSync(path.join(temp.articles, 'council-community-update.json'), 'utf8'));
  assert.equal(article.status, 'draft');
  assert.equal(article.noindex, true);
  assert.deepEqual(article.legacy_urls, ['https://example.org/2024/03/council-community-update/']);
  assert.equal(article.review_content, false);
  assert.equal(article.review_rights, false);
  assert.equal(article.review_accessibility, false);
  assert.equal(article.author, 'editorial-team');
  assert.deepEqual(article.categories, ['community-reporting']);
  assert.ok(article.tags.includes('Local Government'));
  assert.ok(report.items[0].warnings.some((warning) => warning.includes('images were not downloaded')));
  assert.ok(report.items[0].warnings.some((warning) => warning.includes('shortcodes')));
});

test('Markdown, JSON, and CSV imports normalize into the same article contract', () => {
  const inputs = [
    [path.join(fixtures, 'markdown'), 'markdown', 'field-notes-library'],
    [path.join(fixtures, 'articles.json'), 'json', 'json-import-example'],
    [path.join(fixtures, 'articles.csv'), 'csv', 'csv-story']
  ];
  for (const [input, type, slug] of inputs) {
    const { temp, report } = importFixture(input, type);
    assert.equal(report.summary.failed, 0, type);
    const article = JSON.parse(fs.readFileSync(path.join(temp.articles, `${slug}.json`), 'utf8'));
    assert.equal(article.slug, slug);
    assert.equal(article.status, 'draft');
    assert.equal(article.article_type, 'standard');
    assert.ok(article.excerpt.length >= 20);
    assert.match(article.body, /##/);
  }
});

test('PDF-folder intake copies each PDF once and creates document-first drafts', () => {
  const { temp, report } = importFixture(path.join(fixtures, 'pdfs'), 'pdf');
  assert.equal(report.summary.discovered, 1);
  assert.equal(report.summary.assets_copied, 1);
  const article = JSON.parse(fs.readFileSync(path.join(temp.articles, 'meeting-packet.json'), 'utf8'));
  assert.equal(article.article_type, 'pdf');
  assert.equal(article.allow_download, true);
  assert.match(article.pdf_file, /^\/uploads\/documents\/meeting-packet-[a-f0-9]{10}\.pdf$/);
  assert.equal(fs.existsSync(path.join(temp.media, path.basename(article.pdf_file))), true);
  assert.equal(report.items[0].asset_sha256.length, 64);
});

test('dry runs write nothing while still producing a complete migration plan', () => {
  const temp = workspace();
  const report = importContent({
    input: path.join(fixtures, 'markdown'),
    type: 'markdown',
    outputDirectory: temp.articles,
    mediaDirectory: temp.media,
    reportFile: temp.report,
    dryRun: true,
    defaults: { status: 'draft', author: 'editorial-team', category: 'community-reporting', hub: '' }
  });
  assert.equal(report.items[0].status, 'planned');
  assert.equal(report.summary.planned, 1);
  assert.equal(report.summary.imported, 0);
  assert.deepEqual(fs.readdirSync(temp.articles), []);
  assert.equal(fs.existsSync(temp.report), false);
  assert.equal(fs.existsSync(temp.media), false);
});

test('conflict policies skip, suffix, or overwrite without silent replacement', () => {
  const temp = workspace();
  const existing = { marker: 'keep me' };
  fs.writeFileSync(path.join(temp.articles, 'json-import-example.json'), JSON.stringify(existing));
  const common = {
    input: path.join(fixtures, 'articles.json'), type: 'json', outputDirectory: temp.articles,
    mediaDirectory: temp.media, defaults: { status: 'draft', author: 'editorial-team', category: 'community-reporting', hub: '' }
  };
  const skipped = importContent({ ...common, conflictMode: 'skip' });
  assert.equal(skipped.summary.skipped, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(temp.articles, 'json-import-example.json'), 'utf8')), existing);
  const suffixed = importContent({ ...common, conflictMode: 'suffix' });
  assert.equal(suffixed.items[0].slug, 'json-import-example-2');
  assert.equal(fs.existsSync(path.join(temp.articles, 'json-import-example-2.json')), true);
  const overwritten = importContent({ ...common, conflictMode: 'overwrite' });
  assert.equal(overwritten.items[0].status, 'overwritten');
  assert.equal(JSON.parse(fs.readFileSync(path.join(temp.articles, 'json-import-example.json'), 'utf8')).title, 'JSON Import Example');
});

test('auto directory intake discovers all supported source formats recursively', () => {
  const records = discoverRecords(fixtures, 'auto');
  assert.equal(records.length, 5);
  assert.deepEqual([...new Set(records.map((item) => item.kind))].sort(), ['csv', 'json', 'markdown', 'pdf', 'wordpress']);
});


test('published imports require an explicit reviewed-content acknowledgement', () => {
  const temp = workspace();
  const common = {
    input: path.join(fixtures, 'articles.json'), type: 'json', outputDirectory: temp.articles,
    mediaDirectory: temp.media, defaults: { status: 'published', author: 'editorial-team', category: 'community-reporting', hub: '' }
  };
  assert.throws(() => importContent(common), /markReviewed acknowledgement/);
  const report = importContent({ ...common, defaults: { ...common.defaults, markReviewed: true } });
  assert.equal(report.summary.imported, 1);
  const article = JSON.parse(fs.readFileSync(path.join(temp.articles, 'json-import-example.json'), 'utf8'));
  assert.equal(article.status, 'published');
  assert.equal(article.noindex, false);
  assert.equal(article.review_content, true);
  assert.equal(article.review_rights, true);
  assert.equal(article.review_accessibility, true);
});

test('PDF intake rejects extension-only impostors before copying them', () => {
  const temp = workspace();
  const fakeDirectory = path.join(temp.root, 'fake-pdfs');
  fs.mkdirSync(fakeDirectory);
  fs.writeFileSync(path.join(fakeDirectory, 'not-a-document.pdf'), 'not actually a PDF');
  const report = importContent({
    input: fakeDirectory, type: 'pdf', outputDirectory: temp.articles, mediaDirectory: temp.media,
    defaults: { status: 'draft', author: 'editorial-team', category: 'community-reporting', hub: '' }
  });
  assert.equal(report.summary.failed, 1);
  assert.equal(report.summary.imported, 0);
  assert.match(report.items[0].errors[0], /does not have a PDF signature/);
  assert.equal(fs.existsSync(temp.media), false);
});

test('CLI exposes help and a dry-run path without third-party packages', () => {
  const help = execFileSync(process.execPath, ['scripts/import-content.mjs', '--help'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(help, /WordPress WXR/);
  assert.match(help, /--dry-run/);
  const output = execFileSync(process.execPath, [
    'scripts/import-content.mjs', '--type', 'markdown', '--input', path.join(fixtures, 'markdown'), '--dry-run'
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /"discovered": 1/);
  assert.match(output, /Dry run complete/);
});
