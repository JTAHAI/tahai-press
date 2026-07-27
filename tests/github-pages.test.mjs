import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

const page = fs.readFileSync(path.join(ROOT, 'github-pages/index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'github-pages/assets/site.css'), 'utf8');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/github-pages.yml'), 'utf8');

test('GitHub Pages project site is a formal newspaper-style product page with official links', () => {
  assert.match(page, /Set the record in type/);
  assert.match(page, /class="[^"]*newspaper-copy[^"]*"/);
  assert.match(page, /https:\/\/github\.com\/JTAHAI\/tahai-press/);
  assert.match(page, /https:\/\/tahai\.net/);
  assert.match(page, /https:\/\/tahai-press\.tahai\.net/);
  assert.match(page, /Apache 2\.0/);
  assert.match(page, /No public-facing platform credit is required/);
  assert.match(page, /tahai-press-logo\.png/);
  const retiredName = ['Open', 'Publication', 'Starter'].join(' ');
  assert.equal(page.includes(retiredName), false);
  assert.doesNotMatch(page, /PASS[\s_-]*\d/i);
  assert.match(css, /::first-letter/);
  assert.match(css, /columns:3 18rem/);
});

test('GitHub Pages mobile layout contains grid and code blocks without document overflow', () => {
  assert.match(css, /\.steps article\{grid-template-columns:2\.6rem minmax\(0,1fr\)/);
  assert.match(css, /\.command-box pre\{max-width:100%;white-space:pre;overflow-x:auto\}/);
  assert.match(css, /overflow-wrap:anywhere/);
});

test('GitHub Pages workflow publishes only the dedicated project-site directory', () => {
  assert.match(workflow, /path:\s*github-pages/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
});
