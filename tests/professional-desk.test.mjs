import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, DIST, loadContent } from '../scripts/lib/content.mjs';
import {
  ARTICLE_CLASSIFICATION_KEYS,
  articleCitation,
  classificationInfo,
  publicationHistory,
  seriesForArticles
} from '../scripts/lib/professional-desk.mjs';

const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const articleFile = (slug) => path.join(ROOT, 'content', 'articles', `${slug}.json`);
let buildRan = false;

function build() {
  if (!buildRan) {
    run('scripts/build.mjs');
    buildRan = true;
  }
}

function withArticleMutation(slug, mutate, callback) {
  const file = articleFile(slug);
  const original = fs.readFileSync(file, 'utf8');
  try {
    const article = JSON.parse(original);
    mutate(article);
    fs.writeFileSync(file, `${JSON.stringify(article, null, 2)}\n`);
    return callback();
  } finally {
    fs.writeFileSync(file, original);
  }
}

test('Professional Desk exposes explicit editorial classifications and stable series ordering', () => {
  assert.deepEqual(ARTICLE_CLASSIFICATION_KEYS, [
    'news', 'analysis', 'opinion', 'investigation', 'public-record',
    'explainer', 'interview', 'announcement', 'developing'
  ]);
  assert.equal(classificationInfo('public-record').label, 'Public Record');
  assert.equal(classificationInfo('unknown').key, 'news');
  const grouped = seriesForArticles([
    { slug: 'third', series_slug: 'proof', series_title: 'Proof', series_order: 3, published_at: '2026-01-03T00:00:00Z' },
    { slug: 'first', series_slug: 'proof', series_title: 'Proof', series_order: 1, published_at: '2026-01-01T00:00:00Z' },
    { slug: 'standalone', published_at: '2026-01-02T00:00:00Z' },
    { slug: 'second', series_slug: 'proof', series_title: 'Proof', series_order: 2, published_at: '2026-01-02T00:00:00Z' }
  ]);
  assert.equal(grouped.length, 1);
  assert.deepEqual(grouped[0].articles.map((article) => article.slug), ['first', 'second', 'third']);
});

test('citation and history helpers produce public, chronological reader records', () => {
  const { site, articles, authors } = loadContent();
  const article = articles.find((item) => item.slug === 'sample-pdf-record');
  const author = authors.find((item) => item.slug === article.author);
  const citation = articleCitation({ article, author, site, url: `${site.site_url}stories/${article.slug}/` });
  assert.match(citation, /Sample Meeting Record/);
  assert.match(citation, new RegExp(site.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(citation, /^.+\. “.+”/);
  const history = publicationHistory({
    update_history: [{ date: '2026-01-01T00:00:00Z', body: 'First' }, { date: '2026-02-01T00:00:00Z', body: 'Second' }],
    corrections: [{ date: '2026-03-01T00:00:00Z', body: 'Correction' }]
  });
  assert.equal(history.updates[0].body, 'Second');
  assert.equal(history.corrections[0].body, 'Correction');
});

test('Pages CMS and JSON Schema expose the complete professional editorial record', () => {
  const cms = read('.pages.yml');
  const schema = JSON.parse(read('schemas/article.schema.json'));
  for (const field of [
    'classification', 'series_slug', 'series_title', 'series_order', 'related_articles',
    'methodology', 'disclosure', 'rights_and_reuse', 'what_changed', 'update_history', 'corrections'
  ]) {
    assert.match(cms, new RegExp(`name: ${field}`));
    assert.ok(schema.properties[field], `schema missing ${field}`);
  }
  assert.ok(schema.allOf[0].then.required.includes('classification'));
  assert.equal(schema.properties.corrections.maxItems, 25);
});

test('build creates professional section fronts, series fronts, trust panels, history, related coverage, and citation tools', () => {
  build();
  for (const relative of [
    'sections/index.html',
    'sections/investigation/index.html',
    'sections/public-record/index.html',
    'series/index.html',
    'series/transparent-local-record/index.html',
    'assets/professional-desk.js'
  ]) assert.ok(fs.existsSync(path.join(DIST, relative)), `missing ${relative}`);

  const article = fs.readFileSync(path.join(DIST, 'stories', 'sample-pdf-record', 'index.html'), 'utf8');
  assert.match(article, /classification-public-record/);
  assert.match(article, /Part 3 of a series/);
  assert.match(article, /Updates and corrections/);
  assert.match(article, /Demonstration correction/);
  assert.match(article, /About this reporting/);
  assert.match(article, /Related coverage/);
  assert.match(article, /Permanent citation/);
  assert.match(article, /data-copy-target="citation-sample-pdf-record"/);
});

test('professional metadata enters static search and standards-based article structured data', () => {
  build();
  const search = JSON.parse(fs.readFileSync(path.join(DIST, 'search-index.json'), 'utf8'));
  const entry = search.entries.find((item) => item.url === '/stories/sample-written-story/');
  assert.equal(entry.classification, 'investigation');
  assert.equal(entry.series.slug, 'transparent-local-record');
  assert.match(entry.searchable, /methodology|demonstration|transparent local record/);

  const html = fs.readFileSync(path.join(DIST, 'stories', 'sample-pdf-record', 'index.html'), 'utf8');
  assert.match(html, /"genre":"public-record"/);
  assert.match(html, /"@type":"CreativeWorkSeries"/);
  assert.match(html, /"correction":\[/);
  assert.doesNotMatch(html, /editor_notes/);
});

test('copy and citation enhancement remains static, local, and optional', () => {
  const script = read('public/assets/professional-desk.js');
  assert.match(script, /navigator\.clipboard/);
  assert.match(script, /document\.execCommand\('copy'\)/);
  assert.match(script, /data-copy-target/);
  assert.match(script, /window\.location\.href/);
  assert.doesNotMatch(script, /\bfetch\s*\(/);
  assert.doesNotMatch(script, /XMLHttpRequest|WebSocket|sendBeacon/);
});

test('published work fails closed when classification or related-article references are invalid', () => {
  withArticleMutation('sample-written-story', (article) => { article.classification = ''; }, () => {
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /classification is required before publishing/);
  });

  withArticleMutation('sample-written-story', (article) => { article.related_articles = ['not-a-real-article']; }, () => {
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /related_articles references unknown article/);
  });
});

test('series contracts reject inconsistent names and duplicate reading-order positions', () => {
  withArticleMutation('sample-pdf-story', (article) => {
    article.series_title = 'A Different Series Name';
    article.series_order = 1;
  }, () => {
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /series_title must match/);
    assert.match(`${result.stdout}\n${result.stderr}`, /series_order 1 is already used/);
  });
});
