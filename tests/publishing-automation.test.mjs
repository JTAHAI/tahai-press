import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

function runNode(script, env = {}) {
  return execFileSync(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('Cloudflare Pages setup contract matches the hardened build command', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'deployment/cloudflare-pages.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(config.production_branch, 'main');
  assert.equal(config.build_command, 'npm run build:cloudflare');
  assert.equal(config.build_output_directory, 'dist');
  assert.equal(config.environment_variables.NODE_VERSION, '22');
  assert.equal(config.preview_policy.automatic_noindex, true);
  assert.match(pkg.scripts['build:cloudflare'], /validate.*test.*build.*verify:dist/);
  assert.equal(fs.readFileSync(path.join(ROOT, '.node-version'), 'utf8').trim(), '22');
});

test('GitHub workflows use least privilege, cancellation, Node 22, and immutable artifacts', () => {
  for (const name of ['quality.yml', 'production-readiness.yml']) {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows', name), 'utf8');
    assert.match(workflow, /permissions:\s*\n\s+contents: read/);
    assert.match(workflow, /cancel-in-progress: true/);
    assert.match(workflow, /node-version: 22/);
    assert.match(workflow, /npm run ci/);
    assert.match(workflow, /actions\/upload-artifact@v4/);
    assert.match(workflow, /if-no-files-found: error/);
    assert.doesNotMatch(workflow, /secrets\./);
  }
});

test('local build emits public, non-secret health and provenance metadata', () => {
  runNode('scripts/build.mjs', {
    CF_PAGES: '', CF_PAGES_BRANCH: '', CF_PAGES_COMMIT_SHA: '', CF_PAGES_URL: '',
    PUBLICATION_FORCE_PREVIEW: ''
  });
  runNode('scripts/verify-dist.mjs', {
    CF_PAGES: '', CF_PAGES_BRANCH: '', CF_PAGES_COMMIT_SHA: '', CF_PAGES_URL: '',
    PUBLICATION_FORCE_PREVIEW: ''
  });
  const metadata = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-build.json'), 'utf8'));
  const health = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-health.json'), 'utf8'));
  assert.equal(metadata.environment, 'local');
  assert.equal(metadata.provider, 'local');
  assert.equal(metadata.article_count, 4);
  assert.equal(metadata.redirect_count, 3);
  assert.match(metadata.redirect_sha256, /^[a-f0-9]{64}$/);
  assert.equal(metadata.build_command, 'npm run build:cloudflare');
  assert.equal(health.ok, true);
  assert.equal(health.output, 'static');
  assert.doesNotMatch(JSON.stringify(metadata), /token|password|secret/i);
});

test('Cloudflare preview builds automatically block indexing on every HTML route', () => {
  const env = {
    CF_PAGES: '1',
    CF_PAGES_BRANCH: 'preview/pdf-reader-polish',
    CF_PAGES_COMMIT_SHA: '0123456789abcdef0123456789abcdef01234567',
    CF_PAGES_URL: 'https://example.pages.dev',
    PUBLICATION_PRODUCTION_BRANCH: 'main'
  };
  runNode('scripts/build.mjs', env);
  runNode('scripts/verify-dist.mjs', env);
  const htmlFiles = walk(DIST).filter((file) => file.endsWith('.html'));
  assert.ok(htmlFiles.length >= 10);
  for (const file of htmlFiles) {
    assert.match(fs.readFileSync(file, 'utf8'), /<meta name="robots" content="noindex,nofollow(?:,noarchive)?">/);
  }
  assert.match(fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8'), /Disallow: \//);
  const metadata = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-build.json'), 'utf8'));
  assert.equal(metadata.environment, 'preview');
  assert.equal(metadata.branch, 'preview/pdf-reader-polish');
  assert.equal(metadata.commit, '0123456789ab');
});

test('Cloudflare production build restores normal crawl policy', () => {
  const env = {
    CF_PAGES: '1',
    CF_PAGES_BRANCH: 'main',
    CF_PAGES_COMMIT_SHA: 'fedcba9876543210fedcba9876543210fedcba98',
    CF_PAGES_URL: 'https://example.pages.dev',
    PUBLICATION_PRODUCTION_BRANCH: 'main'
  };
  const sitePath = path.join(ROOT, 'content/site.json');
  const originalSite = fs.readFileSync(sitePath, 'utf8');
  const launchSite = JSON.parse(originalSite);
  launchSite.template_mode = false;
  fs.writeFileSync(sitePath, `${JSON.stringify(launchSite, null, 2)}\n`);
  try {
    runNode('scripts/build.mjs', env);
    runNode('scripts/verify-dist.mjs', env);
  } finally {
    fs.writeFileSync(sitePath, originalSite);
  }
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert.doesNotMatch(home, /<meta name="robots" content="noindex,nofollow(?:,noarchive)?">/);
  assert.match(fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8'), /Allow: \//);
  const metadata = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-build.json'), 'utf8'));
  assert.equal(metadata.environment, 'production');
  assert.equal(metadata.branch, 'main');
});


test('repeated builds are byte-for-byte reproducible for the same deployment context', () => {
  const env = {
    CF_PAGES: '1',
    CF_PAGES_BRANCH: 'main',
    CF_PAGES_COMMIT_SHA: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    CF_PAGES_URL: 'https://example.pages.dev',
    PUBLICATION_PRODUCTION_BRANCH: 'main'
  };
  runNode('scripts/build.mjs', env);
  const first = new Map(walk(DIST).map((file) => [path.relative(DIST, file).replaceAll('\\', '/'), hash(file)]));
  runNode('scripts/build.mjs', env);
  const second = new Map(walk(DIST).map((file) => [path.relative(DIST, file).replaceAll('\\', '/'), hash(file)]));
  assert.deepEqual(second, first);
});

test('release proof records an exact SHA-256 manifest for the generated site', () => {
  runNode('scripts/create-release-proof.mjs');
  const proofPath = path.join(ROOT, '.artifacts/release-proof/tahai-press-release-proof.json');
  const sumsPath = path.join(ROOT, '.artifacts/release-proof/SHA256SUMS.txt');
  const proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
  assert.equal(proof.file_count, proof.files.length);
  assert.ok(proof.file_count >= 18);
  for (const record of proof.files) {
    const file = path.join(DIST, record.path);
    assert.equal(fs.existsSync(file), true, record.path);
    assert.equal(record.bytes, fs.statSync(file).size);
    assert.equal(record.sha256, hash(file));
  }
  assert.equal(fs.readFileSync(sumsPath, 'utf8').trim().split('\n').length, proof.file_count);
});

test('built site passes an HTTP-level route, PDF, health, and 404 smoke proof', () => {
  const output = runNode('scripts/smoke-built-site.mjs');
  assert.match(output, /HTTP smoke proof passed for 18 routes/);
});
