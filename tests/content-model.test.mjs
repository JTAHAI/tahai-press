import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadContent, ROOT, renderMarkdown, safeUrl, estimateReadingMinutes, formatDate } from '../scripts/lib/content.mjs';

test('article slugs are unique and filenames match', () => {
  const { articles } = loadContent();
  const slugs = new Set();
  for (const article of articles) {
    assert.match(article.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(path.basename(article.__file), `${article.slug}.json`);
    assert.equal(slugs.has(article.slug), false, `duplicate slug ${article.slug}`);
    slugs.add(article.slug);
  }
});

test('local PDF references resolve to real files', () => {
  const { articles } = loadContent();
  for (const article of articles) {
    if (article.pdf_file?.startsWith('/')) {
      assert.equal(fs.existsSync(path.join(ROOT, 'public', article.pdf_file.slice(1))), true);
    }
  }
});

test('site identity and theme remain data-driven', () => {
  const { site } = loadContent();
  assert.equal(site.title, 'TAHAI Press');
  assert.equal(site.site_url, 'https://example.pages.dev');
  assert.match(site.editor_email, /@example\.org$/);
  assert.match(site.brand_mark, /^[A-Z0-9]{1,2}$/);
  for (const value of Object.values(site.theme)) assert.match(value, /^#[0-9a-f]{6}$/i);
});

test('markdown renderer escapes raw HTML', () => {
  const html = renderMarkdown('<script>alert(1)</script>');
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
});

test('URL sanitizer blocks script protocols', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('/uploads/documents/test.pdf'), '/uploads/documents/test.pdf');
  assert.equal(safeUrl('https://example.com/file.pdf'), 'https://example.com/file.pdf');
});


test('cumulative sample content proves every supported article format', () => {
  const { articles } = loadContent();
  assert.deepEqual(new Set(articles.map((article) => article.article_type)), new Set(['standard', 'pdf', 'mixed', 'external']));
  for (const article of articles) {
    assert.equal(typeof article.show_author_bio, 'boolean');
    assert.equal(article.review_content, true);
    assert.equal(article.review_rights, true);
    assert.equal(article.review_accessibility, true);
    if (['pdf', 'mixed', 'external'].includes(article.article_type)) assert.ok(article.pdf_title);
    if (['pdf', 'mixed'].includes(article.article_type)) assert.match(article.pdf_viewer_default, /^fit-(width|page)$/);
  }
  const written = articles.find((article) => article.slug === 'sample-written-story');
  assert.equal(written.legacy_urls.length, 2);
});

test('article rendering helpers support editorial structures and stable dates', () => {
  const html = renderMarkdown('> A quotation\n\n1. First\n2. Second\n\n---');
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<hr>/);
  assert.equal(estimateReadingMinutes('A small amount of text.'), 1);
  assert.equal(formatDate('2026-07-20'), 'July 20, 2026');
});
