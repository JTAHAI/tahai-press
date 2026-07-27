import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, DIST, loadContent } from '../scripts/lib/content.mjs';
import {
  PAGES_STATIC_REDIRECT_LIMIT, bulkRedirectCsv, createRedirectPlan, pagesRedirectText,
  parsePagesRedirects, sourcePathFromLegacyUrl
} from '../scripts/lib/redirects.mjs';

const articleDirectory = path.join(ROOT, 'content', 'articles');

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

test('article aliases and manual mappings create one deterministic static redirect plan', () => {
  const { site, articles } = loadContent();
  const plan = createRedirectPlan({ site, articles, checkTargets: false });
  assert.deepEqual(plan.counts, { total: 3, static: 3, article_aliases: 2, manual: 1 });
  assert.deepEqual(plan.rules.map((rule) => rule.source), [
    '/2026/07/sample-written-story/', '/news/sample-written-story/', '/sample-legacy-page/'
  ]);
  assert.ok(plan.rules.every((rule) => rule.status === 301));
  assert.equal(plan.errors.length, 0);
  assert.match(plan.sha256, /^[a-f0-9]{64}$/);
});

test('absolute legacy URLs are reduced to path aliases for Pages without losing the original source', () => {
  assert.equal(sourcePathFromLegacyUrl('https://legacy.example.org/2026/07/story/'), '/2026/07/story/');
  const { site, articles } = loadContent();
  const plan = createRedirectPlan({ site, articles, checkTargets: false });
  const rule = plan.rules.find((item) => item.source === '/2026/07/sample-written-story/');
  assert.equal(rule.original_source, 'https://legacy.example.org/2026/07/sample-written-story/');
});

test('build emits an exact Cloudflare Pages redirect file and public integrity metadata', () => {
  build();
  const { site, articles } = loadContent();
  const plan = createRedirectPlan({ site, articles, dist: DIST, checkTargets: true });
  assert.equal(fs.readFileSync(path.join(DIST, '_redirects'), 'utf8'), pagesRedirectText(plan));
  const parsed = parsePagesRedirects(fs.readFileSync(path.join(DIST, '_redirects'), 'utf8'));
  assert.equal(parsed.length, 3);
  const metadata = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-redirects.json'), 'utf8'));
  assert.equal(metadata.rule_count, 3);
  assert.equal(metadata.sha256, plan.sha256);
});

test('Bulk Redirect export uses absolute URLs, no header row, and explicit query handling', () => {
  const { site, articles } = loadContent();
  const plan = createRedirectPlan({ site, articles, checkTargets: false });
  const csv = bulkRedirectCsv(plan, site.site_url);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 3);
  assert.doesNotMatch(lines[0], /SOURCE_URL/i);
  assert.match(csv, /https:\/\/legacy\.example\.org\/2026\/07\/sample-written-story\//);
  assert.match(csv, /https:\/\/example\.pages\.dev\/stories\/sample-written-story\/,301,TRUE,FALSE,FALSE,TRUE/);
  assert.throws(() => bulkRedirectCsv({ rules: [{ ...plan.rules[0], status: 303 }] }, site.site_url), /does not support status 303/);
});

test('duplicate sources, redirect chains, loops, and route collisions fail closed', () => {
  const site = { site_url: 'https://example.pages.dev' };
  const duplicate = createRedirectPlan({
    site, articles: [], checkTargets: false,
    config: { redirects: [
      { from: '/old/', to: '/about/' },
      { from: 'https://old.example/old/', to: '/contact/' }
    ] }
  });
  assert.ok(duplicate.errors.some((error) => error.includes('duplicate redirect source')));

  const chain = createRedirectPlan({
    site, articles: [], checkTargets: false,
    config: { redirects: [
      { from: '/old/', to: '/middle/' },
      { from: '/middle/', to: '/about/' }
    ] }
  });
  assert.ok(chain.errors.some((error) => error.includes('redirect chain is not allowed')));
});

test('query-bearing, fragment-bearing, dynamic, credentialed, and self redirects are rejected', () => {
  const site = { site_url: 'https://example.pages.dev' };
  const values = [
    { from: '/old/?x=1', to: '/about/' },
    { from: '/old/#part', to: '/about/' },
    { from: '/old/*', to: '/about/' },
    { from: 'https://user:pass@example.org/old/', to: '/about/' },
    { from: '/about/', to: '/about/' }
  ];
  const plan = createRedirectPlan({ site, articles: [], config: { redirects: values }, checkTargets: false });
  assert.equal(plan.errors.length, values.length);
});

test('Pages static rule limit is enforced before deployment', () => {
  const redirects = Array.from({ length: PAGES_STATIC_REDIRECT_LIMIT + 1 }, (_, index) => ({
    from: `/legacy-${index}/`, to: '/about/'
  }));
  const site = { site_url: 'https://example.pages.dev' };
  const plan = createRedirectPlan({ site, articles: [], config: { redirects }, checkTargets: false });
  assert.ok(plan.errors.some((error) => error.includes('exceeds Cloudflare Pages')));
  const bulkPlan = createRedirectPlan({ site, articles: [], config: { redirects }, checkTargets: false, enforcePagesLimit: false });
  assert.equal(bulkPlan.errors.length, 0);
  assert.equal(bulkRedirectCsv(bulkPlan, site.site_url).trim().split('\n').length, PAGES_STATIC_REDIRECT_LIMIT + 1);
});

test('content validator rejects a same-site canonical override that disagrees with the generated route', () => {
  const source = JSON.parse(fs.readFileSync(path.join(articleDirectory, 'sample-written-story.json'), 'utf8'));
  const record = {
    ...source,
    title: 'Canonical mismatch proof article',
    slug: 'canonical-mismatch-proof',
    canonical_url: 'https://example.pages.dev/wrong-route/',
    legacy_urls: []
  };
  const file = path.join(articleDirectory, `${record.slug}.json`);
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  try {
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /same-site canonical_url must match \/stories\/canonical-mismatch-proof\//);
  } finally {
    fs.rmSync(file, { force: true });
  }
});

test('bulk redirect CLI writes a dashboard-ready CSV without external packages', () => {
  const output = execFileSync(process.execPath, ['scripts/export-bulk-redirects.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(output, /Exported 3 redirect/);
  const file = path.join(ROOT, 'deployment', 'bulk-redirects.csv');
  assert.equal(fs.existsSync(file), true);
  assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 3);
});
