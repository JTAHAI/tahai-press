import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';
import { contrastRatio, themeContrastChecks, themeContrastErrors } from '../scripts/lib/accessibility.mjs';

const siteFile = path.join(ROOT, 'content/site.json');

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('contrast utilities implement the WCAG luminance ratio and the default theme passes every enforced pair', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  const site = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
  const checks = themeContrastChecks(site.theme);
  assert.equal(checks.length >= 10, true);
  assert.deepEqual(checks.filter((check) => !check.pass), []);
});

test('contrast validator rejects inaccessible publisher theme combinations instead of silently shipping them', () => {
  const site = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
  const unsafe = { ...site.theme, accent: '#fffefb', accent_dark: '#d6d6d6' };
  const errors = themeContrastErrors(unsafe);
  assert.equal(errors.length >= 2, true);
  assert.match(errors.join('\n'), /Primary button text/);
  assert.match(errors.join('\n'), /Accent links on paper/);
});

test('content validation fails closed when a configured theme loses required contrast', () => {
  const original = fs.readFileSync(siteFile, 'utf8');
  try {
    const site = JSON.parse(original);
    site.theme.accent = '#fffefb';
    fs.writeFileSync(siteFile, `${JSON.stringify(site, null, 2)}\n`);
    const result = spawnSync(process.execPath, ['scripts/validate-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /theme contrast: Primary button text/);
  } finally {
    fs.writeFileSync(siteFile, original);
  }
});

test('publisher-configured accessibility statement remains publisher-only after demo mode is disabled', () => {
  const original = fs.readFileSync(siteFile, 'utf8');
  try {
    const site = JSON.parse(original);
    site.template_mode = false;
    site.title = 'Example Gazette';
    site.short_title = 'Example Gazette';
    site.tagline = 'Local reporting.';
    site.logo = '';
    site.seo.social_profiles = [];
    fs.writeFileSync(siteFile, `${JSON.stringify(site, null, 2)}
`);
    build();
    const html = fs.readFileSync(path.join(DIST, 'accessibility/index.html'), 'utf8');
    const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    assert.match(html, /<h1>Access should not depend on a particular device or browser\.<\/h1>/);
    assert.match(html, /mailto:editor@example\.org\?subject=Accessibility%20feedback/);
    assert.match(home, /href="\/accessibility\/">Accessibility<\/a>/);
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
    assert.doesNotMatch(body, /TAHAI Press|Justin Tahai|TAHAI Web Services|tahai\.net|github\.com\/JTAHAI\/tahai-press/i);
  } finally {
    fs.writeFileSync(siteFile, original);
    build();
  }
});

test('static accessibility audit passes every generated page with resolved landmarks, names, and ARIA references', () => {
  build();
  const report = path.join(ROOT, '.artifacts/test-accessibility-audit.json');
  execFileSync(process.execPath, ['scripts/audit-accessibility.mjs', '--report', report], { cwd: ROOT, stdio: 'pipe' });
  const payload = JSON.parse(fs.readFileSync(report, 'utf8'));
  assert.equal(payload.passed, true);
  assert.equal(payload.error_count, 0);
  assert.equal(payload.warning_count, 0);
  assert.equal(payload.page_count, walk(DIST).filter((file) => file.endsWith('.html')).length);
});

test('every generated new-tab link is safe and announces its behavior to assistive technology', () => {
  build();
  for (const file of walk(DIST).filter((item) => item.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/gi)) {
      assert.match(match[0], /rel="[^"]*noopener[^"]*"/);
      assert.match(match[0], /new-tab-note/);
    }
  }
});

test('search exposes labeled controls, atomic status updates, busy state, and focus after explicit submit', () => {
  build();
  const html = fs.readFileSync(path.join(DIST, 'search/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(ROOT, 'public/assets/search.js'), 'utf8');
  assert.match(html, /aria-describedby="publication-search-help"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true" tabindex="-1"/);
  assert.match(html, /data-search-results[^>]*aria-busy="true"/);
  assert.match(script, /runSearch\(\{ focusStatus: true \}\)/);
  assert.match(script, /results\.setAttribute\('aria-busy', 'false'\)/);
});

test('CSS and PDF controls include zoom resilience, minimum targets, reduced motion, increased contrast, and forced-color support', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/assets/styles.css'), 'utf8');
  const pdfScript = fs.readFileSync(path.join(ROOT, 'public/assets/pdf-reader.js'), 'utf8');
  assert.match(css, /-webkit-text-size-adjust: 100%/);
  assert.match(css, /min-block-size: 2\.75rem/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(pdfScript, /else if \(wasFullscreen\) fullscreenButton\.focus/);
});
