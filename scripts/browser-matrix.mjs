import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium, firefox, webkit } from 'playwright';
import { ROOT } from './lib/content.mjs';

const artifactDirectory = path.join(ROOT, '.artifacts', 'browser-matrix');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}
function waitForServer(url, limit = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryRequest = () => {
      http.get(url, (response) => { response.resume(); if (response.statusCode === 200) resolve(); else retry(); }).on('error', retry);
    };
    const retry = () => { if (++attempts >= limit) reject(new Error(`Local preview did not answer at ${url}`)); else setTimeout(tryRequest, 200); };
    tryRequest();
  });
}
function normalizeConsole(message) { return message.text().replace(/\s+/g, ' ').trim(); }
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 }
];

async function verifyStoryLayout(browser, name, baseUrl, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}stories/sample-written-story/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.article-featured-image img').waitFor();
    const layout = await page.evaluate(() => {
      const overflows = document.documentElement.scrollWidth > window.innerWidth;
      const image = document.querySelector('.article-featured-image img');
      const figure = document.querySelector('.article-featured-image');
      const footer = document.querySelector('.site-footer');
      const brokenWords = [];
      for (const element of document.querySelectorAll('.footer-column h2, .footer-column a')) {
        const node = [...element.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
        if (!node) continue;
        const text = node.textContent;
        for (const match of text.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length);
          if (range.getClientRects().length > 1) brokenWords.push(match[0]);
        }
      }
      const imageRect = image.getBoundingClientRect();
      const figureRect = figure.getBoundingClientRect();
      return {
        overflows,
        imageContained: imageRect.width <= figureRect.width + 1 && imageRect.left >= figureRect.left - 1 && imageRect.right <= figureRect.right + 1,
        imageStyle: { maxWidth: getComputedStyle(image).maxWidth, objectFit: getComputedStyle(image).objectFit },
        footerOverflows: footer.scrollWidth > footer.clientWidth,
        brokenWords
      };
    });
    const zoomOverflow = viewport.name === 'desktop' ? await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      const footer = document.querySelector('.site-footer');
      const image = document.querySelector('.article-featured-image img');
      const figure = document.querySelector('.article-featured-image');
      return footer.scrollWidth > footer.clientWidth || image.getBoundingClientRect().width > figure.getBoundingClientRect().width + 1;
    }) : false;
    layout.zoomOverflow = zoomOverflow;
    if (layout.overflows || layout.footerOverflows || zoomOverflow || !layout.imageContained || layout.imageStyle.maxWidth !== '100%' || layout.imageStyle.objectFit !== 'contain' || layout.brokenWords.length) {
      throw new Error(`${name} ${viewport.name} story layout failed: ${JSON.stringify(layout)}`);
    }
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifactDirectory, `${name}-${viewport.name}-footer.png`), fullPage: false });
    return { viewport, ...layout };
  } finally { await context.close(); }
}

async function verifyEngine(name, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(normalizeConsole(message)); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  try {
    const storyLayouts = [];
    for (const viewport of VIEWPORTS) storyLayouts.push(await verifyStoryLayout(browser, name, baseUrl, viewport));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    await page.goto(`${baseUrl}search/`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Search the publication').fill('meeting');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('heading', { level: 2, name: 'Sample Meeting Record' }).waitFor();
    await page.waitForFunction(() => document.querySelector('[data-publication-search]')?.dataset.searchEngine === 'pagefind', undefined, { timeout: 60_000 });
    const searchState = await page.evaluate(() => ({
      engine: document.querySelector('[data-publication-search]')?.dataset.searchEngine,
      resultCount: document.querySelectorAll('[data-search-results] .search-result').length
    }));
    if (searchState.engine !== 'pagefind' || searchState.resultCount < 1) {
      throw new Error(`${name} search did not return a local Pagefind result state.`);
    }
    const searchOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    await page.goto(`${baseUrl}stories/sample-pdf-record/`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-pdf-canvas]').waitFor();
    await page.getByRole('link', { name: /Download PDF/ }).waitFor();

    await page.goto(`${baseUrl}records/sample-meeting-record/`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: 'Sample meeting record evidence ledger' }).waitFor();
    await page.screenshot({ path: path.join(artifactDirectory, `${name}-records.png`), fullPage: false });
    if (homeOverflow || searchOverflow) throw new Error(`${name} rendered horizontal overflow on a core page.`);
    if (consoleErrors.length) throw new Error(`${name} console errors: ${consoleErrors.join(' | ')}`);
    return { name, version: browser.version(), story_layouts: storyLayouts, home_overflow: homeOverflow, search_overflow: searchOverflow, console_errors: consoleErrors, status: 'passed' };
  } finally { await context.close(); await browser.close(); }
}

fs.mkdirSync(artifactDirectory, { recursive: true });
const port = await freePort();
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const baseUrl = `http://127.0.0.1:${port}/`;
try {
  await waitForServer(baseUrl);
  const results = [];
  for (const [name, browserType] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
    try {
      results.push(await verifyEngine(name, browserType, baseUrl));
    } catch (error) {
      error.message = `${name}: ${error.message}`;
      throw error;
    }
  }
  const report = { schema_version: 1, generated_at: new Date().toISOString(), base_url: baseUrl, results };
  fs.writeFileSync(path.join(ROOT, '.artifacts', 'browser-matrix.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Browser matrix passed: ${results.map((result) => `${result.name} ${result.version}`).join(', ')}.`);
} finally {
  if (!server.killed) server.kill();
}
