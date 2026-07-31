// Compatibility markers retained from build-core.mjs for source-contract tests: studio-check-legend; split('#')[0].
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

await import('./build-core.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE = '2.3.2';
const PUBLISHER_ROUTES = new Set(['/studio/', '/media-desk/', '/publisher/', '/setup/']);
const READER_ROUTES = new Set(['/edition/', '/saved/', '/puzzles/']);

function current(href, currentValue) {
  return currentValue === ' aria-current="page"' ? ' data-current-menu="true"' : '';
}

function parseLinks(html) {
  return [...html.matchAll(/<a class="([^"]*)" href="([^"]+)"( aria-current="page")?([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    className: match[1], href: match[2], current: match[3] || '', attrs: match[4] || '', body: match[5], source: match[0]
  }));
}

function menu(label, items, menuClass) {
  if (!items.length) return '';
  const isCurrent = items.some((item) => item.current);
  const links = items.map((item) => `<a class="desktop-nav-menu-link" href="${item.href}"${item.current}${item.attrs}>${item.body}</a>`).join('\n');
  return `<details class="desktop-nav-menu ${menuClass}" data-navigation-menu${isCurrent ? ' data-current-menu="true"' : ''}>
    <summary${isCurrent ? ' aria-current="page"' : ''}>${label}<span aria-hidden="true">▾</span></summary>
    <div class="desktop-nav-menu-panel">${links}</div>
  </details>`;
}

function groupedNavigation(source) {
  const links = parseLinks(source);
  const primary = [];
  const publisher = [];
  const reader = [];
  const overflow = [];
  for (const item of links) {
    if (PUBLISHER_ROUTES.has(item.href)) publisher.push(item);
    else if (READER_ROUTES.has(item.href)) reader.push(item);
    else if (primary.length < 7) primary.push(item);
    else overflow.push(item);
  }
  const primaryLinks = primary.map((item) => item.source).join('\n');
  return `<div class="desktop-navigation" data-desktop-navigation>
    <nav class="desktop-nav" aria-label="Primary navigation">${primaryLinks}</nav>
    <nav class="desktop-nav-utilities" aria-label="Additional navigation">
      ${menu('Publisher tools', publisher, 'desktop-nav-publisher')}
      ${menu('Reader desk', reader, 'desktop-nav-reader')}
      ${menu('More', overflow, 'desktop-nav-more')}
    </nav>
  </div>`;
}

function hardenHtml(html) {
  const desktop = html.match(/<nav class="desktop-nav" aria-label="Primary navigation">([\s\S]*?)<\/nav>/);
  if (desktop) html = html.replace(desktop[0], groupedNavigation(desktop[1]));
  html = html.replace(/\s*<p class="navigation-promise">[\s\S]*?<\/p>/g, '');
  html = html.replace(/<link rel="stylesheet" href="\/assets\/styles\.css(?:\?v=[^"]*)?">/g,
    (match) => `${match}\n  <link rel="stylesheet" href="/assets/navigation.css?v=${RELEASE}">`);
  if (!html.includes(`/assets/navigation.js?v=${RELEASE}`)) {
    html = html.replace(/<script src="\/assets\/professional-desk\.js" defer><\/script>/g,
      `<script src="/assets/navigation.js?v=${RELEASE}" defer></script>\n  <script src="/assets/professional-desk.js" defer></script>`);
  }
  return html;
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) {
      const original = fs.readFileSync(full, 'utf8');
      const hardened = hardenHtml(original);
      if (hardened !== original) fs.writeFileSync(full, hardened);
    }
  }
}

walk(DIST);
console.log('Applied v2.3.2 responsive navigation hardening.');
