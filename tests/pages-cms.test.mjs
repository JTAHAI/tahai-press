import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

const configPath = path.join(ROOT, '.pages.yml');
const articlesPath = path.join(ROOT, 'content', 'articles');

function runValidator() {
  return spawnSync(process.execPath, ['scripts/validate-content.mjs'], {
    cwd: ROOT,
    encoding: 'utf8'
  });
}

function withTemporaryArticle(record, callback) {
  const file = path.join(articlesPath, `${record.slug}.json`);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  try {
    return callback(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

test('Pages CMS configuration passes its dependency-free contract validator', () => {
  const output = execFileSync(process.execPath, ['scripts/validate-cms-config.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /draft-first publishing safeguards/);
});


test('Pages CMS validator rejects invalid YAML escapes before deployment', () => {
  const original = fs.readFileSync(configPath, 'utf8');
  const validLine = String.raw`regex: "^$|^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"`;
  const invalidLine = String.raw`regex: "^$|^[^\s@]+@[^\s@]+\.[^\s@]+$"`;
  const invalid = original.replace(validLine, invalidLine);
  assert.notEqual(invalid, original, 'test fixture must introduce an invalid YAML escape');
  fs.writeFileSync(configPath, invalid);
  try {
    const result = spawnSync(process.execPath, ['scripts/validate-cms-config.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid YAML double-quoted escape/);
  } finally {
    fs.writeFileSync(configPath, original);
  }
});

test('new CMS articles default to draft and filenames derive from the explicit slug', () => {
  const config = fs.readFileSync(configPath, 'utf8');
  assert.match(config, /template: "\{fields\.slug\}\.json"/);
  assert.match(config, /- name: status[\s\S]*?default: draft/);
  assert.match(config, /- name: article_type[\s\S]*?default: standard/);
  assert.match(config, /- name: pdf_file[\s\S]*?extensions: \[pdf\]/);
  assert.match(config, /- name: legacy_urls[\s\S]*?max: 30/);
});

test('an incomplete draft can be saved without blocking the site build and remains private', () => {
  const draft = {
    title: 'CMS draft proof',
    slug: 'cms-draft-proof',
    status: 'draft',
    article_type: 'mixed',
    featured: false,
    allow_download: true,
    show_author_bio: true,
    noindex: true
  };
  withTemporaryArticle(draft, () => {
    const validation = runValidator();
    assert.equal(validation.status, 0, validation.stderr);
    assert.match(validation.stderr, /WARNING .*mixed articles require pdf_file or pdf_url/);
    execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
    assert.equal(fs.existsSync(path.join(DIST, 'stories', draft.slug, 'index.html')), false);
    const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    assert.doesNotMatch(home, /CMS draft proof/);
  });
});

test('Published status is rejected until all editorial review confirmations are true', () => {
  const article = {
    title: 'CMS publication gate proof',
    slug: 'cms-publication-gate-proof',
    status: 'published',
    article_type: 'standard',
    excerpt: 'This complete sample isolates the publication checklist gate for automated testing.',
    body: '## Reviewed body\n\nThis record has enough public content to reach the final publication gate.',
    published_at: '2026-07-27T09:00:00-04:00',
    updated_at: '',
    author: 'editorial-team',
    categories: ['community-reporting'],
    tags: [],
    hub: 'primary-coverage',
    featured: false,
    featured_image: '',
    featured_image_alt: '',
    pdf_file: '',
    pdf_url: '',
    pdf_title: '',
    document_description: '',
    document_date: '',
    document_pages: 0,
    document_source: '',
    external_link_label: '',
    allow_download: false,
    show_author_bio: true,
    source_links: [],
    seo_title: '',
    seo_description: '',
    canonical_url: '',
    noindex: false,
    review_content: true,
    review_rights: false,
    review_accessibility: true,
    editor_notes: 'Private test note.'
  };
  withTemporaryArticle(article, () => {
    const validation = runValidator();
    assert.notEqual(validation.status, 0);
    assert.match(validation.stderr, /review_rights must be confirmed before publishing/);
  });
});

test('private editor notes are never rendered into public output', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
  const output = fs.readFileSync(path.join(DIST, 'stories', 'sample-written-story', 'index.html'), 'utf8');
  assert.doesNotMatch(output, /Sample content reviewed for starter validation/);
  assert.doesNotMatch(output, /editor_notes/);
});

test('article JSON Schema applies completeness rules only to Published records', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'article.schema.json'), 'utf8'));
  assert.equal(schema.required.includes('excerpt'), false);
  assert.equal(schema.required.includes('published_at'), false);
  assert.ok(schema.properties.review_content);
  assert.ok(schema.properties.review_rights);
  assert.ok(schema.properties.review_accessibility);
  const publicationRule = schema.allOf.find((rule) => rule.then?.required?.includes('review_content'));
  assert.ok(publicationRule);
  assert.equal(publicationRule.then.properties.review_rights.const, true);
});
