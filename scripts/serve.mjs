import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DIST } from './lib/content.mjs';
import { matchStaticRedirect, parsePagesRedirects } from './lib/redirects.mjs';

const port = Number(process.env.PORT || 4173);
const redirectRules = fs.existsSync(path.join(DIST, '_redirects'))
  ? parsePagesRedirects(fs.readFileSync(path.join(DIST, '_redirects'), 'utf8'))
  : [];

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.pdf', 'application/pdf'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp']
]);

http.createServer((request, response) => {
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
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, '404.html');
  response.writeHead(file.endsWith('404.html') ? 404 : 200, {
    'Content-Type': types.get(path.extname(file).toLowerCase()) || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Preview: http://127.0.0.1:${port}`);
});
