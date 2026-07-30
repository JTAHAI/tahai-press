import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DIST } from './lib/content.mjs';
import { matchStaticRedirect, parsePagesRedirects } from './lib/redirects.mjs';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  throw new Error('dist/index.html is missing. Run npm run build first.');
}

const redirectRules = fs.existsSync(path.join(DIST, '_redirects'))
  ? parsePagesRedirects(fs.readFileSync(path.join(DIST, '_redirects'), 'utf8'))
  : [];

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.pdf', 'application/pdf'], ['.txt', 'text/plain; charset=utf-8']
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const redirect = matchStaticRedirect(pathname, redirectRules);
  if (redirect) {
    response.writeHead(redirect.status, { Location: redirect.target, 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  let file = path.join(DIST, pathname);
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
  const missing = !fs.existsSync(file) || fs.statSync(file).isDirectory();
  if (missing) file = path.join(DIST, '404.html');
  response.writeHead(missing ? 404 : 200, {
    'Content-Type': types.get(path.extname(file).toLowerCase()) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

try {
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const checks = [
    ['/', 200, 'text/html'],
    ['/stories/', 200, 'text/html'],
    ['/sections/', 200, 'text/html'],
    ['/sections/investigation/', 200, 'text/html'],
    ['/series/', 200, 'text/html'],
    ['/series/transparent-local-record/', 200, 'text/html'],
    ['/accessibility/', 200, 'text/html'],
    ['/search/', 200, 'text/html'],
    ['/puzzles/', 200, 'text/html'],
    ['/assets/crossword.js', 200, 'text/javascript'],
    ['/assets/crosswords.json', 200, 'application/json'],
    ['/search-index.json', 200, 'application/json'],
    ['/categories/public-records/', 200, 'text/html'],
    ['/topics/pdf/', 200, 'text/html'],
    ['/authors/editorial-team/', 200, 'text/html'],
    ['/hubs/primary-coverage/', 200, 'text/html'],
    ['/archive/2026/07/', 200, 'text/html'],
    ['/stories/sample-written-story/', 200, 'text/html'],
    ['/stories/sample-pdf-record/', 200, 'text/html'],
    ['/uploads/documents/sample-document.pdf', 200, 'application/pdf'],
    ['/.well-known/publication-health.json', 200, 'application/json'],
    ['/.well-known/tahai-press.json', 200, 'application/json'],
    ['/humans.txt', 200, 'text/plain'],
    ['/not-a-real-route/', 404, 'text/html']
  ];

  for (const [route, status, contentType] of checks) {
    const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
    assert.equal(response.status, status, `${route} returned ${response.status}`);
    assert.match(response.headers.get('content-type') || '', new RegExp(contentType.replace('/', '\\/')), `${route} content type`);
    const body = await response.arrayBuffer();
    assert.ok(body.byteLength > 0, `${route} returned an empty body`);
  }

  const redirects = [
    ['/news/sample-written-story/', '/stories/sample-written-story/'],
    ['/2026/07/sample-written-story/', '/stories/sample-written-story/'],
    ['/sample-legacy-page/', '/about/']
  ];
  for (const [route, location] of redirects) {
    const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
    assert.equal(response.status, 301, `${route} did not return a permanent redirect`);
    assert.equal(response.headers.get('location'), location, `${route} redirect target`);
  }

  const searchIndex = await fetch(`${origin}/search-index.json`).then((response) => response.json());
  assert.equal(searchIndex.count, searchIndex.entries.length);
  assert.ok(searchIndex.entries.every((entry) => entry.url.startsWith('/stories/')));

  const crosswords = await fetch(`${origin}/assets/crosswords.json`).then((response) => response.json());
  assert.ok(crosswords.puzzles.some((item) => item.difficulty === 'novice'));
  assert.ok(crosswords.puzzles.some((item) => item.difficulty === 'expert'));

  const health = await fetch(`${origin}/.well-known/publication-health.json`).then((response) => response.json());
  assert.equal(health.ok, true);
  assert.equal(health.output, 'static');

  const provenance = await fetch(`${origin}/.well-known/tahai-press.json`).then((response) => response.json());
  assert.equal(provenance.software, 'TAHAI Press');
  assert.equal(provenance.website, 'https://tahai.net');
  console.log(`HTTP smoke proof passed for ${checks.length} routes and ${redirects.length} permanent redirects on an ephemeral local server.`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
