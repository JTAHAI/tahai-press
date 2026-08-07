import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DIST, ROOT, readJson } from '../scripts/lib/content.mjs';
import {
  cmsBranch,
  cmsRepository,
  normalizeNewsroomDraft,
  newsroomDraftErrors,
  promotionDestination,
  repositorySlugFromUrl,
  SVELTIA_CMS_SCRIPT,
  SVELTIA_CMS_VERSION,
  sveltiaCmsConfig
} from '../scripts/lib/open-publishing.mjs';

const run = (script, args = [], env = {}) => execFileSync(process.execPath, [script, ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, ...env }
});

const built = (relative) => fs.readFileSync(path.join(DIST, relative), 'utf8');

test('v2.0 package exposes the open publishing foundation', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  assert.equal(pkg.version, '3.0.0-alpha.1');
  assert.equal(pkg.scripts['newsroom:promote'], 'node scripts/promote-newsroom-draft.mjs');
  assert.equal(fs.existsSync(path.join(ROOT, 'docs', 'FOSS-FOUNDATION.md')), true);
  assert.equal(fs.existsSync(path.join(ROOT, 'docs', 'V2-ROADMAP.md')), true);
  assert.equal(fs.existsSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md')), true);
});

test('repository slug parsing accepts ordinary GitHub URL and SSH forms', () => {
  assert.equal(repositorySlugFromUrl('https://github.com/JTAHAI/tahai-press.git'), 'JTAHAI/tahai-press');
  assert.equal(repositorySlugFromUrl('git@github.com:JTAHAI/tahai-press.git'), 'JTAHAI/tahai-press');
  assert.equal(repositorySlugFromUrl('JTAHAI/tahai-press'), 'JTAHAI/tahai-press');
  assert.equal(repositorySlugFromUrl('https://example.com/too/many/segments'), '');
});

test('Git CMS repository and branch can be safely overridden', () => {
  const pkg = { repository: { url: 'https://github.com/JTAHAI/tahai-press.git' } };
  assert.equal(cmsRepository({}, pkg), 'JTAHAI/tahai-press');
  assert.equal(cmsRepository({ TAHAI_PRESS_CMS_REPO: 'community/local-paper' }, pkg), 'community/local-paper');
  assert.equal(cmsBranch({ TAHAI_PRESS_CMS_BRANCH: 'release/v2' }), 'release/v2');
  assert.throws(() => cmsBranch({ TAHAI_PRESS_CMS_BRANCH: '../secret' }), /unsupported/);
});

test('generated Sveltia configuration is pinned and confined to the newsroom inbox', () => {
  const config = sveltiaCmsConfig({
    site: { title: 'Example Press', site_url: 'https://news.example.org' },
    repository: 'example/newsroom',
    branch: 'main'
  });
  assert.match(config, /repo: example\/newsroom/);
  assert.match(config, /folder: content\/inbox/);
  assert.doesNotMatch(config, /folder: content\/articles/);
  assert.match(config, /status, widget: hidden, default: draft/);
  assert.equal(SVELTIA_CMS_VERSION, '0.164.2');
  assert.equal(SVELTIA_CMS_SCRIPT, 'https://unpkg.com/@sveltia/cms@0.164.2/dist/sveltia-cms.js');
});

test('newsroom draft normalization forces safe draft state without deleting valid editorial fields', () => {
  const normalized = normalizeNewsroomDraft({
    title: '  A careful story  ',
    slug: 'careful-story',
    status: 'published',
    article_type: 'standard',
    classification: 'analysis',
    excerpt: 'This is a long enough summary for validation.',
    body: 'The complete story.',
    author: 'editorial-team',
    categories: ['community-reporting'],
    featured_image: '',
    featured_image_alt: 'Must disappear with an empty image.',
    review_content: true,
    review_rights: false,
    review_accessibility: true
  });
  assert.equal(normalized.title, 'A careful story');
  assert.equal(normalized.status, 'draft');
  assert.equal(normalized.classification, 'analysis');
  assert.equal(normalized.review_content, true);
  assert.equal(normalized.review_accessibility, true);
  assert.equal('featured_image_alt' in normalized, false);
});

test('newsroom promotion validation blocks incomplete or inaccessible draft records', () => {
  assert.deepEqual(newsroomDraftErrors({}), [
    'title is required',
    'slug must use lowercase letters, numbers, and single hyphens',
    'excerpt must be between 20 and 360 characters',
    'body is required',
    'author is required',
    'categories must contain one to five slugs'
  ]);
  assert.deepEqual(newsroomDraftErrors({
    title: 'Image story',
    slug: 'image-story',
    excerpt: 'This summary is definitely long enough.',
    body: 'Story body.',
    author: 'editorial-team',
    categories: ['community-reporting'],
    featured_image: '/uploads/images/story.webp'
  }), ['featured_image_alt is required when featured_image is set']);
});

test('promotion destination remains inside content/articles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-press-promotion-'));
  assert.equal(promotionDestination(root, 'safe-story'), path.join(root, 'content', 'articles', 'safe-story.json'));
});

test('Publishing Console and Git Draft Desk build as private operational routes', () => {
  run('scripts/build.mjs');
  const publisher = built('publisher/index.html');
  const admin = built('admin/index.html');
  const config = built('admin/config.yml');
  const metadata = JSON.parse(built('.well-known/publication-build.json'));

  assert.match(publisher, /TAHAI Publishing Console/);
  assert.match(publisher, /Schema-safe Git editing for the newsroom model/);
  assert.match(publisher, /data-publishing-console/);
  assert.match(publisher, /\/assets\/publishing-console\.js/);
  assert.match(publisher, /content\/inbox/);
  assert.match(publisher, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(admin, /Git Draft Desk/);
  assert.match(admin, /@sveltia\/cms@0\.164\.2/);
  assert.match(admin, /<main id="main" tabindex="-1">/);
  assert.match(config, /repo: JTAHAI\/tahai-press/);
  assert.match(config, /folder: content\/inbox/);
  assert.doesNotMatch(config, /content\/articles/);
  assert.equal(metadata.publisher_studio_enabled, true);
  assert.equal(metadata.git_cms_version, '0.164.2');
  assert.doesNotMatch(built('sitemap.xml'), /publisher|admin/);
});
