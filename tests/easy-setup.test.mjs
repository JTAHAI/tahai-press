import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST, readJson } from '../scripts/lib/content.mjs';
import { THEME_PRESETS, normalizeSiteConfig, titleInitials } from '../scripts/lib/site-config.mjs';
import { themeContrastErrors } from '../scripts/lib/accessibility.mjs';

const node = process.execPath;
const sitePath = path.join(ROOT, 'content', 'site.json');
let buildRan = false;

function run(script, cwd = ROOT, env = {}) {
  return execFileSync(node, [script], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
}

function build() {
  if (!buildRan) {
    run('scripts/build.mjs');
    buildRan = true;
  }
}

function buildSnapshot(mutator) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-easy-setup-'));
  try {
    for (const entry of ['content', 'public', 'scripts']) {
      fs.cpSync(path.join(ROOT, entry), path.join(temp, entry), { recursive: true });
    }
    for (const entry of ['package.json', 'package-lock.json', '.node-version']) {
      fs.copyFileSync(path.join(ROOT, entry), path.join(temp, entry));
    }
    const tempSitePath = path.join(temp, 'content', 'site.json');
    const site = JSON.parse(fs.readFileSync(tempSitePath, 'utf8'));
    mutator(site);
    fs.writeFileSync(tempSitePath, `${JSON.stringify(site, null, 2)}\n`);
    run('scripts/build.mjs', temp, { CF_PAGES_BRANCH: 'main', PUBLICATION_PRODUCTION_BRANCH: 'main' });
    return {
      home: fs.readFileSync(path.join(temp, 'dist', 'index.html'), 'utf8'),
      setupExists: fs.existsSync(path.join(temp, 'dist', 'setup', 'index.html'))
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('all built-in newspaper themes pass the enforced contrast contract', () => {
  assert.equal(Object.keys(THEME_PRESETS).length, 8);
  for (const [id, preset] of Object.entries(THEME_PRESETS)) {
    assert.deepEqual(themeContrastErrors(preset.theme), [], `${id} must remain accessible`);
  }
});

test('site setup normalization supplies safe identity, navigation, homepage, and layout defaults', () => {
  const site = normalizeSiteConfig({ title: 'Neighborhood Ledger' });
  assert.equal(site.short_title, 'Neighborhood Ledger');
  assert.equal(site.brand_mark, 'NL');
  assert.equal(titleInitials('Public Record'), 'PR');
  assert.equal(site.theme_preset, 'classic-broadsheet');
  assert.ok(site.navigation.items.length >= 5);
  assert.ok(site.homepage.modules.some((module) => module.type === 'intro'));
  assert.equal(site.layout.density, 'balanced');
});

test('template build includes the private setup assistant, readiness summary, and static wizard asset', () => {
  build();
  const setup = fs.readFileSync(path.join(DIST, 'setup', 'index.html'), 'utf8');
  const readiness = readJson(path.join(DIST, '.well-known', 'publication-readiness.json'));
  assert.match(setup, /From first deploy to a publishable newsroom in under ten minutes/);
  assert.match(setup, /data-launch-desk/);
  assert.match(setup, /setup-wizard\.js/);
  assert.equal(readiness.setup_route, '/setup/');
  assert.equal(readiness.template_mode, true);
  assert.equal(fs.existsSync(path.join(DIST, 'assets', 'setup-wizard.js')), true);
});

test('publisher mode removes the visible setup route and TAHAI Press demo modules', () => {
  const snapshot = buildSnapshot((site) => {
    site.template_mode = false;
    site.title = 'Example Gazette';
    site.short_title = 'Example Gazette';
    site.logo = '';
    site.default_social_image = '';
    site.default_social_image_alt = '';
    site.site_url = 'https://news.example.org';
  });
  assert.equal(snapshot.setupExists, false);
  assert.doesNotMatch(snapshot.home, /TAHAI Press demo edition/);
  assert.doesNotMatch(snapshot.home, /Configure a publication in five guided steps/);
});

test('homepage module order and navigation are controlled entirely by site data', () => {
  const snapshot = buildSnapshot((site) => {
    site.navigation.items = [{ label: 'Front', href: '/' }, { label: 'Records', href: '/stories/' }];
    site.homepage.modules = [
      { type: 'intro', enabled: true },
      { type: 'latest', enabled: true, heading: 'Fresh from the desk', count: 2 }
    ];
  });
  assert.match(snapshot.home, />Front<\/a>/);
  assert.match(snapshot.home, />Records<\/a>/);
  assert.match(snapshot.home, /Fresh from the desk/);
  assert.doesNotMatch(snapshot.home, /Coverage hubs that fit the publication/);
  assert.doesNotMatch(snapshot.home, /Apache 2\.0 · Publisher freedom/);
});
