import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { activateTheme, exportInstalledTheme, listInstalledThemes, themePaths } from './lib/themes.mjs';

const host = '127.0.0.1';
const port = Number(process.env.TAHAI_THEME_PORT || 4398);
const tokenFile = path.join(ROOT, 'themes', '.manager-token');
function ensureToken() {
  if (!fs.existsSync(tokenFile)) { fs.mkdirSync(path.dirname(tokenFile), { recursive: true }); fs.writeFileSync(tokenFile, crypto.randomBytes(32).toString('base64url'), { mode: 0o600 }); }
  return fs.readFileSync(tokenFile, 'utf8').trim();
}
const writeToken = ensureToken();
function page(message = '') {
  const themes = listInstalledThemes().filter((item) => item.validation.valid).map((item) => `<li><strong>${item.validation.manifest.name}</strong> <code>${item.id}</code> — validated package</li>`).join('') || '<li>No installed theme packages yet. Use the named install command first.</li>';
  const active = fs.existsSync(themePaths.ACTIVE_FILE) ? JSON.parse(fs.readFileSync(themePaths.ACTIVE_FILE, 'utf8')).id : 'none';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TAHAI Press Theme Workshop</title><style>body{max-width:50rem;margin:2rem auto;padding:0 1rem;font:1rem/1.5 system-ui;color:#17212b}input,select,button{font:inherit;padding:.6rem;margin:.25rem 0}label{display:block;font-weight:700}fieldset{margin:1.5rem 0;padding:1rem}code{overflow-wrap:anywhere}.notice{padding:.75rem;background:#f1eadf;border-left:.3rem solid #7a4a22}</style><main><h1>Theme Workshop</h1><p>This private local tool is bound to <code>127.0.0.1</code>. It uses real theme packages and never changes publication articles, media, or generated reader pages.</p>${message ? `<p class="notice">${message}</p>` : ''}<p>Active theme: <strong>${active}</strong></p><h2>Validated installed packages</h2><ul>${themes}</ul><form method="post" action="/activate"><fieldset><legend>Activate a validated package</legend><label for="theme">Theme identifier</label><input id="theme" name="theme" required pattern="[a-z0-9-]+"><label for="token">Local write token</label><input id="token" name="token" type="password" required autocomplete="off"><button>Activate theme</button></fieldset></form><form method="post" action="/export"><fieldset><legend>Export the current package</legend><label for="export-theme">Theme identifier</label><input id="export-theme" name="theme" required pattern="[a-z0-9-]+"><label for="export-token">Local write token</label><input id="export-token" name="token" type="password" required autocomplete="off"><button>Export and revalidate</button></fieldset></form><p>Read the local token from <code>themes/.manager-token</code>. It is intentionally never emitted into a public page, build, log, or reader bundle.</p></main></html>`;
}
function form(request) { return new Promise((resolve, reject) => { let body = ''; request.on('data', (chunk) => { body += chunk; if (body.length > 8192) request.destroy(); }); request.on('end', () => resolve(Object.fromEntries(new URLSearchParams(body)))); request.on('error', reject); }); }
function send(response, status, body) { response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(body); }
http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') { response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify({ service: 'theme-workshop', host, installed: listInstalledThemes().length })); return; }
    if (request.method === 'GET') { send(response, 200, page()); return; }
    const data = await form(request);
    const suppliedToken = Buffer.from(String(data.token || ''));
    const expectedToken = Buffer.from(writeToken);
    if (suppliedToken.length !== expectedToken.length || !crypto.timingSafeEqual(suppliedToken, expectedToken)) { send(response, 403, page('Write token was not accepted. No files changed.')); return; }
    if (request.url === '/activate') { const result = activateTheme(data.theme); send(response, 200, page(`Activated ${result.active}; prior theme: ${result.previous || 'none'}.`)); return; }
    if (request.url === '/export') { const destination = path.join(ROOT, 'themes', 'exports', `${data.theme}.zip`); const result = exportInstalledTheme(data.theme, destination); send(response, 200, page(`Exported and revalidated ${result.manifest.name}.`)); return; }
    send(response, 404, page('Unknown local operation.'));
  } catch (error) { send(response, 400, page(`Operation refused: ${error.message}`)); }
}).listen(port, host, () => console.log(`Theme Workshop listening on http://${host}:${port} (local token stored at themes/.manager-token).`));
