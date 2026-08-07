import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST, loadContent } from '../scripts/lib/content.mjs';
import { createSearchIndex, paginate, topicSlug, uniqueTopics } from '../scripts/lib/discovery.mjs';

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

test('topic slugs are stable, readable, and URL-safe', () => {
  assert.equal(topicSlug('Public Records & Courts'), 'public-records-and-courts');
  assert.equal(topicSlug('  Café updates  '), 'cafe-updates');
  assert.equal(topicSlug('PDF'), 'pdf');
});

test('topic discovery counts repeated tags and rejects ambiguous slug collisions', () => {
  const topics = uniqueTopics([{ tags: ['Public records', 'PDF'] }, { tags: ['PDF'] }]);
  assert.deepEqual(topics.find((item) => item.slug === 'pdf'), { slug: 'pdf', name: 'PDF', count: 2 });
  assert.throws(() => uniqueTopics([{ tags: ['A+B'] }, { tags: ['A B'] }]), /Topic slug collision/);
});

test('pagination creates deterministic pages and rejects unsafe sizes', () => {
  const pages = paginate(['a', 'b', 'c', 'd', 'e'], 2);
  assert.equal(pages.length, 3);
  assert.deepEqual(pages[1].items, ['c', 'd']);
  assert.equal(pages[2].totalPages, 3);
  assert.throws(() => paginate([], 0), /between 1 and 100/);
});

test('search index contains public discovery metadata without private editor fields', () => {
  const { articles, authors, categories, hubs } = loadContent();
  const published = articles.filter((article) => article.status === 'published');
  const index = createSearchIndex({ articles: published, authors, categories, hubs });
  assert.equal(index.length, published.length);
  const serialized = JSON.stringify(index);
  assert.doesNotMatch(serialized, /editor_notes|private editor/i);
  assert.match(index[0].searchable, /sample editorial team/);
});

test('build creates search, category, topic, contributor, hub, and date archive routes', () => {
  build();
  const expected = [
    'search/index.html', 'knowledge/index.html', 'search-index.json', 'search-synonyms.json', 'assets/search.js',
    'categories/index.html', 'categories/public-records/index.html',
    'topics/index.html', 'topics/pdf/index.html',
    'authors/index.html', 'authors/editorial-team/index.html',
    'hubs/primary-coverage/index.html',
    'archive/index.html', 'archive/2026/index.html', 'archive/2026/07/index.html'
  ];
  for (const item of expected) assert.equal(fs.existsSync(path.join(DIST, item)), true, `${item} missing`);
});

test('search page supports query parameters, filters, live status, and no-script browsing', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'search/index.html'), 'utf8');
  assert.match(html, /data-publication-search/);
  assert.match(html, /data-search-input/);
  assert.match(html, /data-search-type/);
  assert.match(html, /data-search-category/);
  assert.match(html, /data-search-summary/);
  assert.match(html, /data-search-reset/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<noscript>/);
});

test('knowledge desk is generated from content-managed search synonym groups', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'knowledge/index.html'), 'utf8');
  assert.match(html, /Knowledge Desk/);
  assert.match(html, /Search synonym group/);
  const payload = JSON.parse(fs.readFileSync(path.join(DIST, 'search-synonyms.json'), 'utf8'));
  assert.equal(payload.schema_version, 1);
  assert.ok(Array.isArray(payload.groups));
  assert.ok(payload.groups.length > 0);
});

test('generated static search index includes only published articles', () => {
  build();
  const payload = JSON.parse(fs.readFileSync(path.join(DIST, 'search-index.json'), 'utf8'));
  assert.equal(payload.schema_version, 1);
  assert.equal(payload.count, 4);
  assert.equal(payload.entries.length, 4);
  assert.ok(payload.entries.every((entry) => entry.url.startsWith('/stories/')));
});

test('search export derives only public facets and accepts explicit publisher-managed metadata', () => {
  const entries = createSearchIndex({
    articles: [{ slug: 'metadata-proof', title: 'Metadata proof', excerpt: 'A long enough public summary for the search metadata proof.', body: 'Public evidence only.', status: 'published', published_at: '2026-08-07T12:00:00Z', article_type: 'pdf', classification: 'public-record', search_metadata: { agency: 'Fictional Records Office', jurisdiction: 'Example County', place: 'Example City' }, corrections: [{ title: 'Correction', body: 'A public correction.' }], update_history: [{ title: 'Update', body: 'A public update.' }], categories: [], tags: [] }],
    authors: [], categories: [], hubs: []
  });
  assert.deepEqual(entries[0].facets, { organization: '', section: '', agency: 'Fictional Records Office', jurisdiction: 'Example County', place: 'Example City', year: '2026', month: '08', classification: 'public-record', public_record: true, public_document: true, developing: false, corrected: true, updated: true });
  assert.match(entries[0].searchable, /fictional records office/);
});

test('the pinned Pagefind index is built for public discovery and ignores private newsroom routes', () => {
  build();
  assert.equal(fs.existsSync(path.join(DIST, 'pagefind', 'pagefind.js')), true);
  const setup = fs.readFileSync(path.join(DIST, 'setup', 'index.html'), 'utf8');
  const studio = fs.readFileSync(path.join(DIST, 'studio', 'index.html'), 'utf8');
  assert.match(setup, /<body[^>]+data-pagefind-ignore/);
  assert.match(studio, /<body[^>]+data-pagefind-ignore/);
});

test('archive pagination generates canonical page-two routes when configured below the article count', () => {
  const siteFile = path.join(ROOT, 'content/site.json');
  const original = fs.readFileSync(siteFile, 'utf8');
  const site = JSON.parse(original);
  site.discovery.archive_page_size = 2;
  fs.writeFileSync(siteFile, `${JSON.stringify(site, null, 2)}\n`);
  try {
    build();
    const pageTwo = path.join(DIST, 'stories/page/2/index.html');
    assert.equal(fs.existsSync(pageTwo), true);
    const html = fs.readFileSync(pageTwo, 'utf8');
    assert.match(html, /Page 2 of 2/);
    assert.match(html, /rel="prev" href="\/stories\/"/);
    assert.match(html, /rel="canonical" href="https:\/\/example\.pages\.dev\/stories\/page\/2\/"/);
  } finally {
    fs.writeFileSync(siteFile, original);
    build();
  }
});

test('search client uses DOM construction rather than interpolating index HTML', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public/assets/search.js'), 'utf8');
  assert.match(source, /document\.createElement/);
  assert.match(source, /textContent/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.match(source, /history\.replaceState/);
});
