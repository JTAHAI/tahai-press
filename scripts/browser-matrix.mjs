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

async function verifyEngine(name, browserType, baseUrl) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(normalizeConsole(message)); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    await page.goto(`${baseUrl}search/`, { waitUntil: 'networkidle' });
    await page.getByLabel('Search the publication').fill('meeting');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByText('Sample Meeting Record').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-search-summary]')?.textContent?.includes('local Pagefind index'));
    const searchOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    await page.goto(`${baseUrl}stories/sample-pdf-record/`, { waitUntil: 'networkidle' });
    await page.locator('[data-pdf-canvas]').waitFor();
    await page.getByRole('link', { name: /Download PDF/ }).waitFor();

    await page.goto(`${baseUrl}records/sample-meeting-record/`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1, name: 'Sample meeting record evidence ledger' }).waitFor();
    await page.screenshot({ path: path.join(artifactDirectory, `${name}-records.png`), fullPage: false });
    if (homeOverflow || searchOverflow) throw new Error(`${name} rendered horizontal overflow on a core page.`);
    if (consoleErrors.length) throw new Error(`${name} console errors: ${consoleErrors.join(' | ')}`);
    return { name, version: browser.version(), home_overflow: homeOverflow, search_overflow: searchOverflow, console_errors: consoleErrors, status: 'passed' };
  } finally { await browser.close(); }
}

fs.mkdirSync(artifactDirectory, { recursive: true });
const port = await freePort();
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const baseUrl = `http://127.0.0.1:${port}/`;
try {
  await waitForServer(baseUrl);
  const results = [];
  for (const [name, browserType] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) results.push(await verifyEngine(name, browserType, baseUrl));
  const report = { schema_version: 1, generated_at: new Date().toISOString(), base_url: baseUrl, results };
  fs.writeFileSync(path.join(ROOT, '.artifacts', 'browser-matrix.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Browser matrix passed: ${results.map((result) => `${result.name} ${result.version}`).join(', ')}.`);
} finally {
  if (!server.killed) server.kill();
}
