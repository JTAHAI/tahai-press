import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST, readJson } from '../scripts/lib/content.mjs';

const node = process.execPath;
const setupAsset = path.join(ROOT, 'public', 'assets', 'setup-wizard.js');
let buildRan = false;

function run(script, args = [], cwd = ROOT, env = {}) {
  return execFileSync(node, [script, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
}

function build() {
  if (!buildRan) {
    run('scripts/build.mjs');
    buildRan = true;
  }
}

function buildPublisherModeSnapshot() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-launch-desk-build-'));
  try {
    for (const entry of ['content', 'public', 'scripts']) {
      fs.cpSync(path.join(ROOT, entry), path.join(temp, entry), { recursive: true });
    }
    for (const entry of ['package.json', 'package-lock.json', '.node-version']) {
      fs.copyFileSync(path.join(ROOT, entry), path.join(temp, entry));
    }
    const sitePath = path.join(temp, 'content', 'site.json');
    const site = readJson(sitePath);
    site.template_mode = false;
    site.title = 'Publisher Test';
    site.short_title = 'Publisher Test';
    site.logo = '';
    site.default_social_image = '';
    site.default_social_image_alt = '';
    site.site_url = 'https://news.example.org';
    site.editor_email = 'editor@news.example.org';
    fs.writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`);
    run('scripts/build.mjs', [], temp, { CF_PAGES_BRANCH: 'main', PUBLICATION_PRODUCTION_BRANCH: 'main' });
    return {
      setupExists: fs.existsSync(path.join(temp, 'dist', 'setup', 'index.html')),
      setupScriptExists: fs.existsSync(path.join(temp, 'dist', 'assets', 'setup-wizard.js')),
      launchProgressExists: fs.existsSync(path.join(temp, 'dist', 'assets', 'launch-progress.js')),
      homeHtml: fs.readFileSync(path.join(temp, 'dist', 'index.html'), 'utf8')
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('current package preserves Launch Desk and a safe launch-package applicator', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  assert.equal(pkg.version, '2.3.0');
  assert.equal(pkg.scripts['launch:apply'], 'node scripts/apply-launch-package.mjs');
  assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'apply-launch-package.mjs')), true);
});

test('Launch Desk generates seven low-friction steps, persistent progress, preview, backup, undo, and first-story guidance', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'setup', 'index.html'), 'utf8');
  assert.match(html, /data-launch-desk/);
  assert.equal((html.match(/data-launch-step="\d"/g) || []).length, 7);
  assert.match(html, /0 of 7 launch steps complete/);
  assert.match(html, /data-download-backup/);
  assert.match(html, /data-undo-change/);
  assert.match(html, /data-publication-preview/);
  assert.match(html, /Replace the example instead of starting from a blank page/);
  assert.match(html, /Remove demo and prepare launch package/);
  assert.match(html, /No TAHAI Press banner, logo, footer credit, backlink, hidden link, or “Powered by” notice is required/);
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert.match(home, /Start or resume setup/);
  assert.match(home, /data-launch-progress>0\/7/);
});

test('Launch Desk stays browser-local and progressively enhances direct repository application', () => {
  const source = fs.readFileSync(setupAsset, 'utf8');
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(source, /showDirectoryPicker/);
  assert.match(source, /\.launch-backups/);
  assert.match(source, /authorBackupWriter/);
  assert.match(fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8'), /^\.launch-backups\/$/m);
  assert.match(source, /tahai-press-launch-package\.json/);
  assert.match(source, /state\.history/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/);
});

test('Launch package applicator backs up source files, disables demo mode, replaces sample stories, and creates the first draft', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-launch-desk-'));
  try {
    fs.cpSync(path.join(ROOT, 'scripts'), path.join(temp, 'scripts'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'content'), path.join(temp, 'content'), { recursive: true });
    const site = readJson(path.join(ROOT, 'content', 'site.json'));
    site.title = 'Launch Test Ledger';
    site.short_title = 'Launch Test Ledger';
    site.template_mode = false;
    site.site_url = 'https://news.example.org';
    site.editor_email = 'editor@news.example.org';
    site.setup_version = 6;
    const article = {
      title: 'Welcome to Launch Test Ledger', slug: 'welcome-to-launch-test-ledger', status: 'draft', article_type: 'standard',
      kicker: 'From the editor', excerpt: 'A first draft prepared by Launch Desk.', body: '## Welcome\n\nThis is a first draft.',
      published_at: '', updated_at: '', author: 'editorial-team', categories: ['community-reporting'], tags: ['welcome'],
      hub: 'primary-coverage', featured: true, featured_image: '', featured_image_alt: '', pdf_file: '', pdf_url: '', pdf_title: '',
      document_description: '', document_date: '', document_pages: 0, document_source: '', external_link_label: '', allow_download: false,
      show_author_bio: true, source_links: [], seo_title: 'Welcome', seo_description: 'A first draft prepared by Launch Desk.',
      canonical_url: '', noindex: true, review_content: false, review_rights: true, review_accessibility: true, editor_notes: 'Draft.',
      legacy_urls: [], story_blocks: [], classification: 'news', related_articles: [], update_history: [], corrections: []
    };
    const payload = {
      schema_version: 1, software: 'TAHAI Press', release: '2.0.0', remove_demo: true,
      demo_article_files: ['sample-written-story.json', 'sample-pdf-record.json', 'sample-pdf-story.json', 'sample-external-document.json'],
      site_config: site, first_article: article,
      author_record: { slug: 'editorial-team', name: 'Launch Test Ledger Editorial Team', role: 'Editorial team', bio: 'Reporting and editing.', active: true }
    };
    const packagePath = path.join(temp, 'launch.json');
    fs.writeFileSync(packagePath, `${JSON.stringify(payload, null, 2)}\n`);
    const output = run('scripts/apply-launch-package.mjs', ['--package', packagePath, '--confirm'], temp);
    assert.match(output, /Launch Desk package applied/);
    assert.equal(readJson(path.join(temp, 'content', 'site.json')).template_mode, false);
    assert.equal(fs.existsSync(path.join(temp, 'content', 'articles', 'sample-written-story.json')), false);
    assert.equal(readJson(path.join(temp, 'content', 'articles', 'welcome-to-launch-test-ledger.json')).status, 'draft');
    assert.equal(readJson(path.join(temp, 'content', 'authors', 'editorial-team.json')).name, 'Launch Test Ledger Editorial Team');
    assert.equal(fs.readdirSync(path.join(temp, '.artifacts')).some((name) => name.startsWith('launch-backup-')), true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('publisher mode removes Launch Desk route and progress assets', () => {
  const snapshot = buildPublisherModeSnapshot();
  assert.equal(snapshot.setupExists, false);
  assert.equal(snapshot.setupScriptExists, false);
  assert.equal(snapshot.launchProgressExists, false);
  assert.doesNotMatch(snapshot.homeHtml, /Start here <strong data-launch-progress/);
});
