import fs from 'node:fs';
import path from 'node:path';
import { DIST, relativeFile, loadContent } from './lib/content.mjs';
import { deploymentContext } from './lib/deployment.mjs';
import { createRedirectPlan, pagesRedirectText, readRedirectConfig } from './lib/redirects.mjs';
import { TAHAI_PRESS_PROVENANCE, humansText, sourceProvenanceComment } from './lib/provenance.mjs';
import { accessibilityStatement } from './lib/accessibility.mjs';

const errors = [];
const required = [
  'index.html',
  '404.html',
  'robots.txt',
  '_redirects',
  'assets/styles.css',
  'assets/pdf-reader.js',
  'assets/search.js',
  'assets/crossword.js',
  'puzzles/index.html',
  '.well-known/publication-build.json',
  '.well-known/publication-health.json',
  '.well-known/publication-redirects.json',
  '.well-known/tahai-press.json',
  'humans.txt'
];

function fail(message) {
  errors.push(message);
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`Symlink is not allowed in deployment output: ${relativeFile(full)}`);
    else if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function routeTarget(raw) {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const pathname = value.split('#')[0].split('?')[0];
  if (!pathname.startsWith('/')) return null;
  let target = path.join(DIST, pathname);
  if (pathname.endsWith('/')) target = path.join(target, 'index.html');
  return target;
}

function publicRouteForHtml(file) {
  const relative = path.relative(DIST, file).replaceAll('\\', '/');
  if (relative === 'index.html') return '/';
  if (relative === '404.html') return '/404.html';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}

if (!fs.existsSync(DIST)) fail('dist/ does not exist. Run the build first.');
else {
  for (const item of required) {
    if (!fs.existsSync(path.join(DIST, item))) fail(`Missing deployment file: ${item}`);
  }

  const files = walk(DIST);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  if (!htmlFiles.length) fail('Deployment output contains no HTML files.');

  const { site, articles } = loadContent();
  const accessibility = accessibilityStatement(site);
  if (accessibility.enabled && !fs.existsSync(path.join(DIST, 'accessibility/index.html'))) fail('Accessibility statement is enabled but dist/accessibility/index.html is missing.');
  const redirectPlan = createRedirectPlan({ site, articles, config: readRedirectConfig(), dist: DIST, checkTargets: true });
  for (const error of redirectPlan.errors) fail(`Redirect contract: ${error}`);
  const redirectFile = path.join(DIST, '_redirects');
  if (fs.existsSync(redirectFile) && fs.readFileSync(redirectFile, 'utf8') !== pagesRedirectText(redirectPlan)) {
    fail('dist/_redirects does not exactly match the validated source redirect plan.');
  }
  const redirectSources = new Set(redirectPlan.rules.map((rule) => rule.source));
  const canonicalOwners = new Map();
  let siteOrigin = '';
  try { siteOrigin = new URL(site.site_url).origin; } catch {}

  const forbiddenOutput = files.filter((file) => /(?:^|\/)(?:content|scripts|tests|\.github)(?:\/|$)/.test(path.relative(DIST, file).replaceAll('\\', '/')));
  for (const file of forbiddenOutput) fail(`Source-only path leaked into dist/: ${path.relative(DIST, file)}`);

  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /(?:api[_-]?token|secret[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i
  ];

  const context = deploymentContext();
  const indexingBlocked = context.isPreview || site.template_mode !== false;
  for (const file of files) {
    if (fs.statSync(file).size > 25 * 1024 * 1024) fail(`Deployment file exceeds TAHAI Press's 25 MiB Cloudflare Pages asset limit: ${path.relative(DIST, file)}`);
    if (!/\.(?:html|css|js|json|txt|xml|md)$/i.test(file) && path.basename(file) !== '_redirects') continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(text)) fail(`Possible secret material found in ${path.relative(DIST, file)}`);
    }
    if (/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(text)) {
      fail(`Localhost URL leaked into ${path.relative(DIST, file)}`);
    }
  }

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/^<!doctype html>/i.test(html.trimStart())) fail(`Missing HTML doctype: ${path.relative(DIST, file)}`);
    if (!/<main\b[^>]*id=["']main["'][^>]*tabindex=["']-1["']/i.test(html)) fail(`Missing focusable main landmark: ${path.relative(DIST, file)}`);
    if (/editor_notes|private_editor_notes/i.test(html)) fail(`Private editor data leaked into ${path.relative(DIST, file)}`);
    if (indexingBlocked && !/<meta\s+name=["']robots["']\s+content=["']noindex,nofollow(?:,noarchive)?["']/i.test(html)) {
      fail(`Index-blocked page is missing noindex protection: ${path.relative(DIST, file)}`);
    }
    const generatorMatches = [...html.matchAll(/<meta\s+name=["']generator["']\s+content=["']TAHAI Press["']\s*\/?>(?:\s*)/gi)];
    if (generatorMatches.length !== 1) fail(`Expected exactly one TAHAI Press generator tag in ${path.relative(DIST, file)}, found ${generatorMatches.length}.`);
    if (!html.includes(sourceProvenanceComment())) fail(`Missing TAHAI Press source provenance comment: ${path.relative(DIST, file)}`);
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
    if (site.template_mode === false && /Justin Tahai|TAHAI Web Services|https:\/\/tahai\.net|github\.com\/JTAHAI\/tahai-press|template-project-credit|TAHAI Press demo edition/i.test(body)) {
      fail(`Visible TAHAI Press project attribution must disappear when template_mode is false: ${path.relative(DIST, file)}`);
    }
    if (site.template_mode !== false && publicRouteForHtml(file) === '/') {
      if (!body.includes('https://github.com/JTAHAI/tahai-press')) fail('Template homepage is missing the public repository link.');
      if (!body.includes('https://tahai.net')) fail('Template homepage is missing the developer link.');
    }
    if (/<meta\s+name=["']keywords["']/i.test(html)) fail(`Meta keywords are not permitted: ${path.relative(DIST, file)}`);

    const canonicalMatches = [...html.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/gi)];
    if (canonicalMatches.length !== 1) fail(`Expected exactly one canonical URL in ${path.relative(DIST, file)}, found ${canonicalMatches.length}.`);
    else {
      try {
        const canonical = new URL(canonicalMatches[0][1]);
        const route = publicRouteForHtml(file);
        if (!['http:', 'https:'].includes(canonical.protocol)) fail(`Canonical URL must use HTTP(S): ${path.relative(DIST, file)}`);
        if (canonical.username || canonical.password) fail(`Canonical URL contains credentials: ${path.relative(DIST, file)}`);
        if (canonical.search || canonical.hash) fail(`Canonical URL contains a query string or fragment: ${path.relative(DIST, file)}`);
        if (canonicalOwners.has(canonical.href)) fail(`Duplicate canonical URL in ${path.relative(DIST, file)} and ${canonicalOwners.get(canonical.href)}`);
        else canonicalOwners.set(canonical.href, path.relative(DIST, file));
        if (canonical.origin === siteOrigin && canonical.pathname !== route) fail(`Same-site canonical does not match its generated route in ${path.relative(DIST, file)} (${canonical.pathname} != ${route})`);
        if (canonical.origin === siteOrigin && redirectSources.has(canonical.pathname)) fail(`Canonical path is also a redirect source in ${path.relative(DIST, file)}: ${canonical.pathname}`);
      } catch (error) {
        fail(`Invalid canonical URL in ${path.relative(DIST, file)}: ${error.message}`);
      }
    }

    for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
      const target = routeTarget(match[1]);
      if (target && !fs.existsSync(target)) fail(`Broken internal asset or route in ${path.relative(DIST, file)}: ${match[1]}`);
    }
  }

  if (fs.existsSync(path.join(DIST, 'robots.txt'))) {
    const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
    if (indexingBlocked && !/Disallow:\s*\//i.test(robots)) fail('Preview or template-mode robots.txt must disallow crawling.');
    if (!indexingBlocked && !/Allow:\s*\//i.test(robots)) fail('Launch-ready production/local robots.txt must allow crawling.');
  }


  const humansPath = path.join(DIST, 'humans.txt');
  if (fs.existsSync(humansPath) && fs.readFileSync(humansPath, 'utf8') !== humansText()) fail('humans.txt does not match the TAHAI Press provenance contract.');

  const tahaiPressPath = path.join(DIST, '.well-known/tahai-press.json');
  if (fs.existsSync(tahaiPressPath)) {
    try {
      const record = JSON.parse(fs.readFileSync(tahaiPressPath, 'utf8'));
      if (JSON.stringify(record) !== JSON.stringify(TAHAI_PRESS_PROVENANCE)) fail('TAHAI Press well-known JSON does not match the provenance contract.');
    } catch (error) {
      fail(`TAHAI Press well-known JSON is invalid: ${error.message}`);
    }
  }

  if (fs.existsSync(path.join(DIST, '.well-known/publication-build.json'))) {
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-build.json'), 'utf8'));
      for (const key of ['schema_version', 'environment', 'provider', 'branch', 'production_branch', 'commit', 'article_count', 'search_index_count', 'topic_count', 'redirect_count', 'redirect_sha256']) {
        if (!(key in metadata)) fail(`Build metadata is missing ${key}.`);
      }
      if (metadata.environment !== context.environment) fail('Build metadata environment does not match the active deployment context.');
      if (metadata.redirect_count !== redirectPlan.counts.total) fail('Build metadata redirect_count does not match the validated redirect plan.');
      const searchIndexFile = path.join(DIST, 'search-index.json');
      if (!fs.existsSync(searchIndexFile)) fail('Static search index is missing.');
      else {
        const searchIndex = JSON.parse(fs.readFileSync(searchIndexFile, 'utf8'));
        if (!Array.isArray(searchIndex.entries)) fail('Static search index entries must be an array.');
        if (searchIndex.count !== searchIndex.entries?.length) fail('Static search index count does not match its entries.');
        if (metadata.search_index_count !== searchIndex.count) fail('Build metadata search_index_count does not match search-index.json.');
      }
      if (metadata.redirect_sha256 !== redirectPlan.sha256) fail('Build metadata redirect_sha256 does not match the validated redirect plan.');
    } catch (error) {
      fail(`Build metadata is invalid JSON: ${error.message}`);
    }
  }

  if (fs.existsSync(path.join(DIST, '.well-known/publication-redirects.json'))) {
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(DIST, '.well-known/publication-redirects.json'), 'utf8'));
      if (metadata.rule_count !== redirectPlan.counts.total) fail('Redirect metadata rule_count does not match the generated plan.');
      if (metadata.sha256 !== redirectPlan.sha256) fail('Redirect metadata SHA-256 does not match the generated plan.');
    } catch (error) {
      fail(`Redirect metadata is invalid JSON: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error(`Deployment verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Deployment verification passed: routes, assets, accessibility landmarks, canonicals, redirects, indexing controls, TAHAI Press provenance, metadata, and output boundaries are intact.');
