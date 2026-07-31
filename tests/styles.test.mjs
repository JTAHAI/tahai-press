import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

const css = fs.readFileSync(path.join(ROOT, 'public/assets/styles.css'), 'utf8');

test('visual system defines semantic publication tokens and responsive layouts', () => {
  for (const token of ['--brand:', '--brand-deep:', '--accent:', '--surface:', '--paper:', '--serif:', '--sans:', '--max:']) {
    assert.equal(css.includes(token), true, `missing ${token}`);
  }
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 500px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
});

test('keyboard and mobile-navigation states are explicitly styled', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.skip-link:focus/);
  assert.match(css, /\.mobile-nav\[open\]/);
  assert.match(css, /\[aria-current='page'\]/);
});

test('default brand mark and article placeholders use reusable semantic classes', () => {
  assert.match(css, /\.brand-symbol-ring/);
  assert.match(css, /\.brand-symbol-rule/);
  assert.match(css, /data-tone='community-reporting'/);
  assert.match(css, /data-tone='public-records'/);
});


test('article templates and PDF reader have dedicated layout treatments', () => {
  for (const selector of ['.article-facts', '.document-section-primary', '.external-document', '.article-tags', '.author-card']) {
    assert.equal(css.includes(selector), true, `missing ${selector}`);
  }
  assert.match(css, /\.prose blockquote/);
  assert.match(css, /\.prose ol/);
});


test('search and archive discovery have dedicated responsive treatments', () => {
  for (const selector of ['.search-form', '.search-result', '.discovery-grid', '.topic-cloud', '.date-archive-year', '.pagination']) {
    assert.equal(css.includes(selector), true, `missing ${selector}`);
  }
  assert.match(css, /grid-template-columns: minmax\(18rem, 2fr\)/);
});

test('mobile masthead preserves the publication name instead of squeezing it beside reader actions', () => {
  assert.match(css, /@media \(max-width: 45rem\)[\s\S]*?\.masthead-row\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.brand-copy strong\s*\{[\s\S]*?white-space: nowrap;[\s\S]*?word-break: normal;/);
  assert.match(css, /\.masthead-actions\s*\{[\s\S]*?width: 100%;[\s\S]*?flex-wrap: wrap;/);
});

test('dedicated responsive navigation stylesheet keeps labels unbroken before mobile takeover', () => {
  const navigationCss = fs.readFileSync(path.join(ROOT, 'public/assets/navigation.css'), 'utf8');
  assert.match(navigationCss, /white-space:nowrap/);
  assert.match(navigationCss, /word-break:normal/);
  assert.match(navigationCss, /overflow-wrap:normal/);
  assert.match(navigationCss, /flex:0 0 auto/);
  assert.match(navigationCss, /@media\(max-width:70rem\)/);
  assert.match(navigationCss, /\.desktop-navigation\{display:none\}/);
});
