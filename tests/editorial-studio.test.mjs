import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, DIST, loadContent } from '../scripts/lib/content.mjs';
import { createSearchIndex } from '../scripts/lib/discovery.mjs';
import { imageDimensions, STORY_BLOCK_TYPES } from '../scripts/lib/editorial.mjs';

const articlesPath = path.join(ROOT, 'content', 'articles');
let buildRan = false;

function run(script, args = [], env = {}) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function build() {
  if (!buildRan) {
    run('scripts/build.mjs');
    buildRan = true;
  }
}

function completeArticle(overrides = {}) {
  return {
    title: 'Editorial Studio test article',
    slug: 'editorial-studio-test-article',
    status: 'published',
    article_type: 'standard',
    kicker: 'Test',
    excerpt: 'A complete test article used to prove structured editorial validation and rendering behavior.',
    body: '## Reader-first structure\n\nThis is a complete article body with enough content for the publication contract.',
    published_at: '2027-01-01T12:00:00Z',
    updated_at: '',
    author: 'editorial-team',
    categories: ['community-reporting'],
    tags: [],
    hub: 'primary-coverage',
    featured: false,
    featured_image: '',
    featured_image_alt: '',
    featured_image_caption: '',
    featured_image_credit: '',
    featured_image_rights: '',
    featured_image_aspect: 'landscape',
    featured_image_focal_point: 'center',
    story_blocks: [],
    pdf_file: '',
    pdf_url: '',
    pdf_title: '',
    document_description: '',
    document_date: '',
    document_pages: 0,
    document_source: '',
    external_link_label: '',
    allow_download: false,
    pdf_viewer_default: 'fit-width',
    show_author_bio: true,
    source_links: [],
    seo_title: '',
    seo_description: '',
    canonical_url: '',
    legacy_urls: [],
    noindex: false,
    review_content: true,
    review_rights: true,
    review_accessibility: true,
    editor_notes: '',
    ...overrides
  };
}

function withArticle(record, callback) {
  const file = path.join(articlesPath, `${record.slug}.json`);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  try { return callback(file); }
  finally { fs.rmSync(file, { force: true }); }
}

test('Editorial Studio builds as a private browser-only composer with fast authoring controls', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'studio', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(DIST, 'assets', 'writer-desk.js'), 'utf8');
  assert.match(html, /data-editorial-studio/);
  assert.match(html, /Writer Desk/);
  assert.match(html, /Saved only in this browser/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow/);
  assert.match(script, /localStorage/);
  assert.match(script, /new Blob/);
  assert.match(script, /featured_image_alt/);
  assert.match(script, /commandDefinitions/);
  assert.match(script, /htmlToMarkdown/);
  assert.match(script, /parseDirectives/);
  assert.doesNotMatch(script, /\bfetch\s*\(/);
});

test('Editorial Studio required fields remain visibly bounded and programmatically identified', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'studio', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(DIST, 'assets', 'styles.css'), 'utf8');
  assert.match(html, /studio-label-text[^>]*>Headline/);
  assert.match(html, /visually-hidden">\(required\)/);
  assert.match(html, /id="studio-title"[^>]*required/);
  assert.match(css, /--line-strong:\s*var\(--line-dark\)/);
  assert.match(css, /\.studio-form input[^}]*border:1px solid var\(--line-strong\)/);
});

test('structured article blocks render professional newspaper components and an accessible lightbox', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'stories', 'sample-written-story', 'index.html'), 'utf8');
  for (const className of ['story-block-key-points', 'story-block-pull-quote', 'story-block-fact-box', 'story-block-gallery', 'story-block-timeline', 'story-block-callout', 'story-block-document']) {
    assert.match(html, new RegExp(className));
  }
  assert.match(html, /<dialog class="media-lightbox"/);
  assert.match(html, /data-lightbox-open/);
  assert.match(html, /width="1200" height="675"/);
  assert.match(html, /Sample illustration/);
});

test('local image metadata supplies intrinsic dimensions without a database or image service', () => {
  assert.deepEqual(imageDimensions('/uploads/images/editorial-desk.svg'), { width: 1200, height: 675 });
  assert.deepEqual(imageDimensions('/assets/tahai-press-social.png'), { width: 1200, height: 630 });
  assert.equal(imageDimensions('/missing-image.png'), null);
});

test('search indexing includes structured story-block text but not private editor notes', () => {
  const content = loadContent();
  const index = createSearchIndex({ ...content, articles: content.articles.filter((article) => article.status === 'published') });
  const item = index.find((entry) => entry.url === '/stories/sample-written-story/');
  assert.ok(item);
  assert.match(item.searchable, /no database and no extra publishing account/);
  assert.doesNotMatch(item.searchable, /replace or remove before launch/);
});

test('Pages CMS uses its block editor for all supported structured story shapes', () => {
  const config = fs.readFileSync(path.join(ROOT, '.pages.yml'), 'utf8');
  assert.match(config, /- name: story_blocks[\s\S]*?type: block[\s\S]*?blockKey: type/);
  for (const type of STORY_BLOCK_TYPES) assert.match(config, new RegExp(`- name: ${type}\\n\\s+label:`));
  assert.match(config, /Accessible image gallery/);
  assert.match(config, /Scheduled — publishes at the selected date and time/);
});

test('published image blocks fail closed when meaningful alternative text is missing', () => {
  const record = completeArticle({
    slug: 'missing-block-alt-proof',
    story_blocks: [{ type: 'image', src: '/uploads/images/editorial-desk.svg', alt: '', decorative: false }]
  });
  withArticle(record, () => {
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /story_blocks\[0\]\.alt is required unless the image is decorative/);
  });
});

test('draft image blocks can remain incomplete without blocking the publication build', () => {
  const record = completeArticle({
    slug: 'draft-block-alt-proof',
    status: 'draft',
    published_at: '',
    review_content: false,
    review_rights: false,
    review_accessibility: false,
    story_blocks: [{ type: 'image', src: '/uploads/images/editorial-desk.svg', alt: '', decorative: false }]
  });
  withArticle(record, () => {
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /WARNING .*story_blocks\[0\]\.alt is required unless the image is decorative/);
  });
});

test('scheduled publishing promotes only due articles and retains future entries', () => {
  const due = completeArticle({ slug: 'scheduled-due-proof', status: 'scheduled', published_at: '2027-01-01T10:00:00Z' });
  const future = completeArticle({ slug: 'scheduled-future-proof', status: 'scheduled', published_at: '2027-01-03T10:00:00Z' });
  const dueFile = path.join(articlesPath, `${due.slug}.json`);
  const futureFile = path.join(articlesPath, `${future.slug}.json`);
  fs.writeFileSync(dueFile, `${JSON.stringify(due, null, 2)}\n`);
  fs.writeFileSync(futureFile, `${JSON.stringify(future, null, 2)}\n`);
  try {
    const output = run('scripts/publish-due.mjs', ['--write'], { TAHAI_PRESS_NOW: '2027-01-02T12:00:00Z' });
    assert.match(output, /Published 1 scheduled article/);
    assert.equal(JSON.parse(fs.readFileSync(dueFile, 'utf8')).status, 'published');
    assert.equal(JSON.parse(fs.readFileSync(futureFile, 'utf8')).status, 'scheduled');
  } finally {
    fs.rmSync(dueFile, { force: true });
    fs.rmSync(futureFile, { force: true });
  }
});

test('scheduled publishing workflow remains free-tier GitHub automation with narrow write scope', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'scheduled-publishing.yml'), 'utf8');
  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.match(workflow, /permissions:\s*\n\s+contents: write/);
  assert.match(workflow, /npm run publish:due -- --write/);
  assert.match(workflow, /git add content\/articles/);
  assert.doesNotMatch(workflow, /secrets\./);
});
