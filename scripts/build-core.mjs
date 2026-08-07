import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  ROOT, DIST, loadContent, readJson, escapeHtml, safeUrl, renderMarkdown, formatDate, estimateReadingMinutes
} from './lib/content.mjs';
import { deploymentContext } from './lib/deployment.mjs';
import { createRedirectPlan, pagesRedirectText, readRedirectConfig } from './lib/redirects.mjs';
import { archiveDateParts, createSearchIndex, paginate, topicSlug, uniqueTopics } from './lib/discovery.mjs';
import { buildJsonFeed, buildRss, buildSitemap, jsonForHtml, pageHead, templateMode } from './lib/seo.mjs';
import { TAHAI_PRESS_PROVENANCE, humansText, sourceProvenanceComment } from './lib/provenance.mjs';
import { accessibilityStatement } from './lib/accessibility.mjs';
import { ensureResponsiveMediaVariants, mediaAssetManifest } from './lib/media-pipeline.mjs';
import { themePresetList } from './lib/site-config.mjs';
import { loadPublishedTheme } from './lib/themes.mjs';
import { launchReadiness } from './lib/launch-readiness.mjs';
import { renderEditorialImage, renderStoryBlocks, storyBlocksPlainText } from './lib/editorial.mjs';
import { ARTICLE_CLASSIFICATION_KEYS, articleCitation, classificationInfo, publicationHistory, seriesForArticles } from './lib/professional-desk.mjs';
import { publicCrossword } from './lib/crosswords.mjs';
import { readerReachConfig, serviceWorkerSource } from './lib/reader-reach.mjs';
import { cmsBranch, cmsRepository, SVELTIA_CMS_LICENSE, SVELTIA_CMS_SCRIPT, SVELTIA_CMS_VERSION, sveltiaCmsConfig } from './lib/open-publishing.mjs';
import { stableStringify, WORKFLOW_STATES, workflowTransitions } from './lib/publishing-console.mjs';
import { mediaHealth } from './lib/operations.mjs';
import { buildApi, buildAtom, renderNewsletter } from './lib/syndication.mjs';

const { site, articles, authors, categories, hubs, crosswords, records, editions, newsletters } = loadContent();
const packageInfo = readJson(path.join(ROOT, 'package.json'));
const assetVersion = packageInfo.version;
const deployment = deploymentContext();
const gitCmsRepository = cmsRepository(process.env, packageInfo);
const gitCmsBranch = cmsBranch(process.env);
const gitCmsConfig = sveltiaCmsConfig({ site, repository: gitCmsRepository, branch: gitCmsBranch });
const authorMap = new Map(authors.map((item) => [item.slug, item]));
const categoryMap = new Map(categories.map((item) => [item.slug, item]));
const hubMap = new Map(hubs.map((item) => [item.slug, item]));
const activeCrosswords = crosswords.filter((item) => item.active !== false).sort((a, b) => a.difficulty.localeCompare(b.difficulty) || a.rotation_order - b.rotation_order || a.slug.localeCompare(b.slug)).map(publicCrossword);
const routeManifest = [];
const accessibility = accessibilityStatement(site);
const readerReach = readerReachConfig(site);
const appliedTheme = loadPublishedTheme(site.theme_package);
const mediaReport = await mediaHealth({ site, articles, authors });
const PROJECT_REPOSITORY = 'https://github.com/JTAHAI/tahai-press';
const DEVELOPER_SITE = 'https://tahai.net';
const DEMO_SITE = 'https://tahai-press.tahai.net';

fs.rmSync(DIST, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true, force: true });
if (appliedTheme) {
  const themeOutput = path.join(DIST, 'assets', 'themes');
  fs.mkdirSync(themeOutput, { recursive: true });
  fs.writeFileSync(path.join(themeOutput, `${appliedTheme.id}.css`), appliedTheme.css, 'utf8');
}
// PDF.js is copied as same-origin, generated output. It is dynamically imported only
// by the document reader; ordinary reader pages never request either module.
const pdfjsSource = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build');
const pdfjsOutput = path.join(DIST, 'assets', 'pdfjs');
if (fs.existsSync(path.join(pdfjsSource, 'pdf.min.mjs')) && fs.existsSync(path.join(pdfjsSource, 'pdf.worker.min.mjs'))) {
  fs.mkdirSync(pdfjsOutput, { recursive: true });
  for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs']) fs.copyFileSync(path.join(pdfjsSource, file), path.join(pdfjsOutput, file));
} else console.warn('PDF.js is unavailable in this dependency-free fixture; direct PDF and HTML-summary fallbacks remain available.');
fs.mkdirSync(path.join(DIST, 'admin'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'admin', 'config.yml'), gitCmsConfig, 'utf8');
if (!templateMode(site)) {
  fs.rmSync(path.join(DIST, 'assets', 'setup-wizard.js'), { force: true });
  fs.rmSync(path.join(DIST, 'assets', 'launch-progress.js'), { force: true });
}

const responsiveMediaVariants = await ensureResponsiveMediaVariants({ distRoot: DIST, inventory: mediaReport.inventory });
fs.mkdirSync(path.join(DIST, '.well-known'), { recursive: true });
fs.writeFileSync(path.join(DIST, '.well-known', 'media-asset-manifest.json'), `${JSON.stringify(mediaAssetManifest({
  generatedAt: deployment.shortCommit || deployment.commit || 'local',
  inventory: mediaReport.inventory,
  variants: responsiveMediaVariants
}), null, 2)}\n`);

function writeRoute(route, html, { sitemap = true, lastmod = '' } = {}) {
  const normalized = route === '/' ? '' : route.replace(/^\//, '').replace(/\/$/, '');
  const directory = path.join(DIST, normalized);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), html, 'utf8');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1] || absoluteUrl(route);
  routeManifest.push({ route, loc: canonical, include: sitemap, lastmod });
}

function absoluteUrl(route) {
  return new URL(route, site.site_url).href;
}

function newTabNote() {
  return '<span class="visually-hidden new-tab-note"> (opens in a new tab)</span>';
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizeRouteRoute(route = '') {
  return String(route || '').trim().replace(/\/+/g, '/');
}

function renderMediaLibrary(report) {
  const cards = report.inventory
    .filter((item) => item.type === 'image')
    .map((item) => {
      const refs = item.references.length
        ? `<ul class="media-library-references">${item.references.map((reference) => `<li><strong>${escapeHtml(reference.kind)}</strong><span>${escapeHtml(reference.owner)}</span></li>`).join('')}</ul>`
        : '<p class="media-library-empty">Unused in current content.</p>';
      const dimensions = item.dimensions ? `${item.dimensions.width} × ${item.dimensions.height}` : 'Dimensions unavailable';
      return `<article class="media-library-card${item.references.length ? ' media-library-card-used' : ' media-library-card-orphan'}">
        <a class="media-library-preview" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(item.url)}" alt="" loading="lazy" decoding="async">${newTabNote()}</a>
        <div class="media-library-copy">
          <p class="eyebrow">${escapeHtml(item.extension.replace('.', '').toUpperCase())}</p>
          <h3>${escapeHtml(path.basename(item.path))}</h3>
          <p class="media-library-meta">${escapeHtml(dimensions)} · ${escapeHtml(new Intl.NumberFormat('en-US').format(item.size_bytes))} bytes</p>
          <p class="media-library-meta">SHA-256 ${escapeHtml(item.sha256.slice(0, 12))}…</p>
          ${refs}
        </div>
      </article>`;
    });
  return `<section class="media-library" aria-labelledby="media-library-heading">
    <div class="media-section-heading"><div><p class="eyebrow">4 · Media library</p><h3 id="media-library-heading">Current uploads and usage ledger</h3></div><strong>${report.summary.images} image(s)</strong></div>
    <p class="fine-print">The build writes a private asset manifest to <code>.well-known/media-asset-manifest.json</code> and keeps the original upload path recoverable. Responsive image variants are emitted for deployment when the source dimensions allow them.</p>
    <div class="media-library-grid">${cards.join('') || '<p class="media-library-empty">No uploads found in <code>public/uploads/images/</code>.</p>'}</div>
    ${report.duplicates.length ? `<aside class="media-library-warning"><p class="eyebrow">Duplicate media</p><ul>${report.duplicates.map((item) => `<li>${escapeHtml(item.urls.join(', '))}</li>`).join('')}</ul></aside>` : ''}
    ${report.near_duplicates?.length ? `<aside class="media-library-warning"><p class="eyebrow">Near-duplicate media</p><ul>${report.near_duplicates.map((item) => `<li>${escapeHtml(item.urls.join(', '))} · distance ${escapeHtml(String(item.distance))}</li>`).join('')}</ul></aside>` : ''}
  </section>`;
}

function icon(name) {
  const icons = {
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
    document: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></svg>',
    location: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3z"/><path d="m3 6 9 7 9-7"/></svg>',
    source: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5H5v14h14v-3"/><path d="M11 13 20 4M14 4h6v6"/></svg>',
    community: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.5-4 2.2-6 5-6s4.5 2 5 6M13 15c2.8-.7 6 .7 7 5"/></svg>',
    expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg>',
    fitWidth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7v10M20 7v10M7 12h10M9 9l-3 3 3 3M15 9l3 3-3 3"/></svg>',
    fitPage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18H7zM4 8v8M20 8v8"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5H5v14h14v-3M12 12l8-8M14 4h6v6"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
    puzzle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/><path d="M9 9h6v6H9z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13 7 4 4M4 20l4-4"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="9" r="2"/><path d="m4 18 5-5 4 4 2-2 5 5"/></svg>',
    read: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.2-.8 5.8-.3 8 1.5 2.2-1.8 4.8-2.3 8-1.5v13c-3.2-.8-5.8-.3-8 1.5-2.2-1.8-4.8-2.3-8-1.5z"/><path d="M12 7v13"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.1M8.7 13.3l6.6 4.1"/></svg>',
    install: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg>',
    offline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15a4 4 0 0 1 1.8-7.4A7 7 0 0 1 19 10a4 4 0 0 1 0 8H7"/><path d="M8 21 21 8M6 8l-3-3"/></svg>',
    edition: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></svg>'
  };
  return icons[name] || '';
}

const navItems = (Array.isArray(site.navigation?.items) ? site.navigation.items : []).filter((item) => {
  const href = String(item?.href || '');
  if (href === '/saved/' && !(readerReach.enabled && readerReach.savedArticlesEnabled)) return false;
  if (href === '/edition/' && !(readerReach.enabled && readerReach.currentEditionEnabled)) return false;
  return true;
});

const PUBLISHER_ROUTES = new Set(['/studio/', '/media-desk/', '/publisher/', '/setup/']);
const READER_ROUTES = new Set(['/edition/', '/saved/', '/puzzles/']);

function isExternalNavigation(href = '') {
  return /^https?:\/\//i.test(String(href));
}

function isCurrent(route, href) {
  if (isExternalNavigation(href)) return false;
  if (href === '/') return route === '/';
  return route === href || route.startsWith(href);
}

function navEntry(route, item, className = '') {
  const safeHref = safeUrl(item?.href || '');
  if (!safeHref || !item?.label) return null;
  const external = isExternalNavigation(safeHref);
  return {
    href: safeHref,
    label: item.label,
    current: isCurrent(route, safeHref),
    external,
    markup: `<a class="${className}" href="${escapeHtml(safeHref)}"${isCurrent(route, safeHref) ? ' aria-current="page"' : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(item.label)}${external ? newTabNote() : ''}</a>`
  };
}

function navLinks(route, className = '') {
  return navItems.map((item) => navEntry(route, item, className)?.markup).filter(Boolean).join('\n');
}

function partitionNavigation(route) {
  const entries = navItems.map((item) => navEntry(route, item)).filter(Boolean);
  const primary = [];
  const publisher = [];
  const reader = [];
  const overflow = [];
  for (const item of entries) {
    if (PUBLISHER_ROUTES.has(item.href)) publisher.push(item);
    else if (READER_ROUTES.has(item.href)) reader.push(item);
    else if (primary.length < 7) primary.push(item);
    else overflow.push(item);
  }
  return { primary, publisher, reader, overflow };
}

function renderNavigationMenu(label, items, menuClass) {
  if (!items.length) return '';
  const isCurrent = items.some((item) => item.current);
  const links = items.map((item) => `<a class="desktop-nav-menu-link" href="${escapeHtml(item.href)}"${item.current ? ' aria-current="page"' : ''}${item.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(item.label)}${item.external ? newTabNote() : ''}</a>`).join('\n');
  return `<details class="desktop-nav-menu ${menuClass}" data-navigation-menu${isCurrent ? ' data-current-menu="true"' : ''}>
    <summary${isCurrent ? ' aria-current="page"' : ''}>${label}<span aria-hidden="true">▾</span></summary>
    <div class="desktop-nav-menu-panel">${links}</div>
  </details>`;
}

function renderDesktopNavigation(route) {
  const { primary, publisher, reader, overflow } = partitionNavigation(route);
  const primaryLinks = primary.map((item) => item.markup).join('\n');
  return `<div class="desktop-navigation" data-desktop-navigation>
    <nav class="desktop-nav" aria-label="Primary navigation">${primaryLinks}</nav>
    <nav class="desktop-nav-utilities" aria-label="Additional navigation">
      ${renderNavigationMenu('Publisher tools', publisher, 'desktop-nav-publisher')}
      ${renderNavigationMenu('Reader desk', reader, 'desktop-nav-reader')}
      ${renderNavigationMenu('More', overflow, 'desktop-nav-more')}
    </nav>
  </div>`;
}

function renderMobileNavigation(route) {
  return `<details class="mobile-nav">
    <summary>${icon('menu')}<span>Menu</span></summary>
    <nav aria-label="Mobile navigation">
      ${navLinks(route, 'mobile-nav-link')}
      <a class="mobile-nav-contact" href="${escapeHtml(site.contact_url || '/contact/')}">Contact the publication</a>
    </nav>
  </details>`;
}

function brandMark() {
  if (safeUrl(site.logo || '')) {
    return `<span class="brand-symbol brand-symbol-image" aria-hidden="true"><img src="${escapeHtml(safeUrl(site.logo))}" alt="" width="675" height="594"></span>`;
  }
  const fallback = String(site.short_title || site.title || 'T').match(/[A-Za-z0-9]/)?.[0] || 'T';
  const letters = String(site.brand_mark || fallback).trim().slice(0, 2).toUpperCase();
  return `<span class="brand-symbol" aria-hidden="true">
    <span class="brand-symbol-ring"></span>
    <span class="brand-symbol-rule"></span>
    <span class="brand-symbol-letter">${escapeHtml(letters)}</span>
  </span>`;
}

function safeThemeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}

function themeVariables() {
  const theme = site.theme || {};
  const packageMapping = appliedTheme ? `
    --brand:var(--theme-link, ${safeThemeColor(theme.brand, '#17324d')});
    --brand-deep:var(--theme-text, ${safeThemeColor(theme.brand_deep, '#0d2236')});
    --brand-soft:var(--theme-surface, ${safeThemeColor(theme.brand_soft, '#dce7ef')});
    --accent:var(--theme-accent, ${safeThemeColor(theme.accent, '#9a4c20')});
    --accent-dark:var(--theme-accent, ${safeThemeColor(theme.accent_dark, '#6d3213')});
    --highlight:var(--theme-focus, ${safeThemeColor(theme.highlight, '#c49a42')});
    --surface:var(--theme-surface, ${safeThemeColor(theme.surface, '#f4f0e8')});
    --surface-deep:var(--theme-surface, ${safeThemeColor(theme.surface_deep, '#e9e0d2')});
    --paper:var(--theme-background, ${safeThemeColor(theme.paper, '#fffefb')});
    --ink:var(--theme-text, #17201f);
    --ink-soft:var(--theme-muted-text, #394441);
    --serif:var(--theme-headline-font, Georgia, serif);
    --sans:var(--theme-body-font, ui-sans-serif, system-ui, sans-serif);
    --reading-measure:var(--theme-reading-measure, 68ch);` : '';
  return `<style>:root{
    --brand:${safeThemeColor(theme.brand, '#17324d')};
    --brand-deep:${safeThemeColor(theme.brand_deep, '#0d2236')};
    --brand-soft:${safeThemeColor(theme.brand_soft, '#dce7ef')};
    --accent:${safeThemeColor(theme.accent, '#9a4c20')};
    --accent-dark:${safeThemeColor(theme.accent_dark, '#6d3213')};
    --highlight:${safeThemeColor(theme.highlight, '#c49a42')};
    --surface:${safeThemeColor(theme.surface, '#f4f0e8')};
    --surface-deep:${safeThemeColor(theme.surface_deep, '#e9e0d2')};
    --paper:${safeThemeColor(theme.paper, '#fffefb')};${packageMapping}
  }</style>`;
}

function themeStylesheet() { return appliedTheme ? `<link rel="stylesheet" href="/assets/themes/${escapeHtml(appliedTheme.id)}.css">` : ''; }

function renderReadingTools() {
  if (!accessibility.readerToolsEnabled) return '';
  return `<details class="reading-tools" data-reading-tools>
    <summary>${icon('read')}<span>Reading tools</span></summary>
    <div class="reading-tools-panel">
      <div class="reading-tools-heading"><div><p class="eyebrow">Reader preferences</p><h2>Adjust this page</h2></div><button class="reading-tools-reset js-only" type="button" data-reader-reset>Reset</button></div>
      <noscript><p>Reader preference controls require JavaScript. The publication remains fully readable without them.</p></noscript>
      <div class="reading-tools-controls js-only">
        <fieldset><legend>Text size</legend><div class="segmented-controls"><button type="button" data-reader-text="smaller" aria-label="Decrease text size">A−</button><button type="button" data-reader-text="default">A</button><button type="button" data-reader-text="larger" aria-label="Increase text size">A+</button></div></fieldset>
        <fieldset><legend>Line spacing</legend><div class="segmented-controls"><button type="button" data-reader-spacing="normal">Normal</button><button type="button" data-reader-spacing="relaxed">Relaxed</button><button type="button" data-reader-spacing="open">Open</button></div></fieldset>
        <fieldset><legend>Reading width</legend><div class="segmented-controls"><button type="button" data-reader-measure="narrow">Narrow</button><button type="button" data-reader-measure="standard">Standard</button><button type="button" data-reader-measure="wide">Wide</button></div></fieldset>
        <label for="reader-surface">Reading surface<select id="reader-surface" data-reader-surface><option value="publication">Publication</option><option value="paper">Paper</option><option value="sepia">Sepia</option><option value="dark">Dark</option><option value="contrast">High contrast</option></select></label>
        <label class="reader-switch"><input type="checkbox" data-reader-underline aria-label="Underline every link"> Underline every link</label>
        <label class="reader-switch"><input type="checkbox" data-reader-simplify aria-label="Reduce decorative page elements"> Reduce decoration</label>
        <label class="reader-switch"><input type="checkbox" data-reader-motion aria-label="Reduce motion"> Reduce motion</label>
      </div>
      <p class="reading-tools-status" data-reader-status role="status" aria-live="polite" aria-atomic="true"></p>
      <p class="reading-tools-privacy">Preferences stay in this browser. Nothing is sent to the publisher.</p>
    </div>
  </details>`;
}

function layout({
  route = '/', title, description, canonical, body, noindex = false, pageClass = '',
  article = null, author = null, categoryNames = [], tags = [], socialImage = '', socialImageAlt = '', scripts = []
}) {
  const pageTitle = title === site.title ? site.title : `${title} | ${site.short_title}`;
  const head = pageHead({
    site, deployment, route, pageTitle, description, canonical, noindex,
    image: socialImage, imageAlt: socialImageAlt, article, author,
    categories: categoryNames, tags
  });
  const templateNotice = templateMode(site) ? `<div class="template-notice" role="note"><div class="shell template-notice-inner"><p><strong>TAHAI Press demo edition.</strong> This first-deploy identity and sample newsroom are intentionally blocked from search indexing.</p><nav aria-label="TAHAI Press project links"><a href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">Source on GitHub${newTabNote()}</a><a href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">Developer site${newTabNote()}</a></nav></div></div>` : '';
  const footerColumns = Array.isArray(site.footer?.columns) ? site.footer.columns : [];
  const footerColumnsMarkup = footerColumns.length
    ? `<section class="footer-structured-links" aria-label="Additional publication links">${footerColumns.map((column) => `<div class="footer-column"><h2>${escapeHtml(column.heading || 'Links')}</h2>${(column.links || []).map((link) => {
      const href = safeUrl(link.href || '');
      if (!href) return '';
      const external = /^https?:\/\//i.test(href);
      return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(link.label || href)}${external ? newTabNote() : ''}</a>`;
    }).filter(Boolean).join('')}</div>`).join('')}</section>`
    : '';
  const footerNote = site.footer?.note || site.footer_note || '';
  return `<!doctype html>
${sourceProvenanceComment()}
<html lang="${escapeHtml(site.locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="${escapeHtml(safeThemeColor(site.theme?.brand, '#17324d'))}">
  <meta name="generator" content="${TAHAI_PRESS_PROVENANCE.software}">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  ${head.html}
  <link rel="stylesheet" href="/assets/styles.css">
  ${themeStylesheet()}
  <link rel="stylesheet" href="/assets/navigation.css?v=${assetVersion}">
  ${article && ['pdf', 'mixed'].includes(article.article_type) ? '<script src="/assets/pdf-reader.js" defer></script>' : ''}
  <script src="/assets/search.js" defer></script>
  <script src="/assets/crossword.js" defer></script>
  <script src="/assets/media-gallery.js" defer></script>
  <script src="/assets/navigation.js?v=${assetVersion}" defer></script>
  <script src="/assets/professional-desk.js" defer></script>
  ${accessibility.readerToolsEnabled ? '<script src="/assets/reading-tools.js" defer></script>' : ''}
  ${readerReach.enabled ? `<script src="/assets/reader-reach.js" defer data-reader-reach data-offline-enabled="${readerReach.offlineEnabled ? 'true' : 'false'}"></script>` : ''}
  ${templateMode(site) ? '<script src="/assets/launch-progress.js" defer></script>' : ''}
  ${scripts.map((src) => `<script src="${escapeHtml(src)}" defer></script>`).join('\n  ')}
  ${themeVariables()}
</head>
<body class="${escapeHtml(`${pageClass} ${appliedTheme ? `theme-${appliedTheme.id}` : ''} density-${site.layout?.density || 'balanced'} reading-${site.layout?.reading_width || 'standard'} masthead-${site.layout?.masthead_alignment || 'center'} headlines-${site.layout?.headline_style || 'serif'} panels-${site.layout?.panel_style || 'square'} surface-${site.layout?.reader_surface || 'paper'}${accessibility.defaultLinkUnderlines ? ' default-link-underlines' : ''}`)}"${noindex ? ' data-pagefind-ignore' : ''}>
  <a class="skip-link" href="#main">Skip to content</a>
  ${templateNotice}
  ${templateMode(site) ? `<div class="publication-bar">
    <div class="shell publication-bar-inner">
      <p>${escapeHtml(site.masthead_kicker || site.tagline)}</p>
      <a href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">GitHub repository${newTabNote()}</a>
    </div>
  </div>` : `<div class="publication-bar">
    <div class="shell publication-bar-inner">
      <p>${escapeHtml(site.tagline || site.standards_label || 'Independent reporting and standards-based publishing.')}</p>
      <a href="/about/#standards">${escapeHtml(site.standards_label || 'Editorial standards')}</a>
    </div>
  </div>`}
  <header class="site-header">
    <div class="shell masthead-row">
      <div class="masthead-folio" aria-hidden="true"><span>${templateMode(site) ? 'EST. 2026' : 'INDEPENDENT'}</span><strong>${templateMode(site) ? 'OPEN-SOURCE EDITION' : 'PUBLICATION'}</strong></div>
      <a class="brand" href="/" aria-label="${escapeHtml(site.title)} home">
        ${brandMark()}
        <span class="brand-copy"><strong>${escapeHtml(site.title)}</strong><small>${escapeHtml(site.tagline)}</small></span>
      </a>
      <div class="masthead-actions">${templateMode(site) ? `<a class="header-contact launch-start-link" href="/setup/">${icon('edit')}<span>Start here <strong data-launch-progress>0/13</strong></span></a>` : ''}${renderReadingTools()}${readerReach.enabled && readerReach.savedArticlesEnabled ? `<a class="header-contact" href="/saved/">${icon('bookmark')}<span>Saved <span class="saved-count-badge" data-saved-count>0</span></span></a>` : ''}${readerReach.enabled && readerReach.offlineEnabled ? `<button class="header-contact header-install js-only" type="button" data-install-publication hidden>${icon('install')}<span>Install</span></button>` : ''}<a class="header-contact" href="${escapeHtml(site.contact_url || '/contact/')}">${icon('mail')}<span>Contact</span></a>${templateMode(site) ? `<a class="header-contact" href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">${icon('github')}<span>GitHub</span>${newTabNote()}</a>` : ''}</div>
    </div>
    <div class="navigation-wrap">
      <div class="shell navigation-inner">
        ${renderDesktopNavigation(route)}
        ${renderMobileNavigation(route)}
        <p class="navigation-promise">${escapeHtml(site.navigation?.note || site.navigation_note || 'Static-first. Editor-friendly. Open source.')}</p>
      </div>
    </div>
  </header>
  <main id="main" tabindex="-1">${body}</main>
  <footer class="site-footer">
    <div class="shell footer-grid">
      <section class="footer-brand" aria-labelledby="footer-brand-title">
        <a class="brand brand-footer" href="/">${brandMark()}<span class="brand-copy"><strong id="footer-brand-title">${escapeHtml(site.title)}</strong><small>${escapeHtml(site.tagline)}</small></span></a>
        <p>${escapeHtml(site.description)}</p>
      </section>
      ${footerColumnsMarkup}
      <nav aria-label="Footer publication links">
        <h2>Publication</h2>
        <a href="/stories/">Stories</a>
        <a href="/search/">Search</a>
        <a href="/categories/">Categories</a>
        <a href="/sections/">Sections</a>
        <a href="/series/">Series</a>
        <a href="/topics/">Topics</a>
        <a href="/about/">About</a>
        <a href="/puzzles/">Daily crossword</a>
        <a href="/studio/">Contributor Composer</a>
        <a href="/media-desk/">Media Desk</a>
        <a href="/publisher/">Publishing Console</a>
        ${readerReach.enabled && readerReach.currentEditionEnabled ? '<a href="/edition/">Current edition</a>' : ''}
        ${readerReach.enabled && readerReach.savedArticlesEnabled ? '<a href="/saved/">Saved stories</a>' : ''}
        ${accessibility.enabled ? `<a href="/accessibility/">Accessibility</a>` : ''}
      </nav>
      <nav aria-label="Footer participation links">
        <h2>Participate</h2>
        <a href="/submit/">Submit</a>
        <a href="/contact/">Contact</a>
        <a href="mailto:${escapeHtml(site.editor_email)}">Email the editor</a>
        <a href="/feed.xml">RSS feed</a>
      </nav>
    </div>
    ${templateMode(site) ? `<div class="shell template-project-credit"><p><strong>TAHAI Press</strong> is open-source software created by Justin Tahai and TAHAI Web Services.</p><p><a href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">View the repository${newTabNote()}</a><span aria-hidden="true"> · </span><a href="${DEMO_SITE}" target="_blank" rel="noopener noreferrer">Open the live demo${newTabNote()}</a><span aria-hidden="true"> · </span><a href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">Visit tahai.net${newTabNote()}</a></p></div>` : ''}
    <div class="shell footer-bottom">
      ${templateMode(site) ? `<p>© ${new Date().getFullYear()} <a href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">TAHAI Web Services${newTabNote()}</a>.</p>` : `<p>© ${new Date().getFullYear()} ${escapeHtml(site.title)}.</p>`}
      ${footerNote ? `<p>${escapeHtml(footerNote)}</p>` : ''}
    </div>
  </footer>
</body>
</html>`;
}


function cmsLayout() {
  const route = '/admin/';
  const canonical = absoluteUrl(route);
  return `<!doctype html>
${sourceProvenanceComment()}
<html lang="${escapeHtml(site.locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="${escapeHtml(safeThemeColor(site.theme?.brand, '#17324d'))}">
  <meta name="generator" content="${TAHAI_PRESS_PROVENANCE.software}">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Git Draft Desk | ${escapeHtml(site.short_title)}</title>
  <meta name="description" content="Optional Git-backed newsroom intake for ${escapeHtml(site.title)}.">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="stylesheet" href="/assets/styles.css">
</head>
<body class="git-cms-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <main id="main" tabindex="-1">
    <section class="git-cms-loader" aria-labelledby="git-cms-title">
      <span class="git-cms-mark" aria-hidden="true">TP</span>
      <p class="eyebrow">TAHAI Publishing Console</p>
      <h1 id="git-cms-title">Opening the Git Draft Desk.</h1>
      <p>This optional editor writes only to <code>content/inbox/</code>. Production articles are protected until a repository operator validates and promotes the draft.</p>
      <p><strong>Repository:</strong> <code>${escapeHtml(gitCmsRepository)}</code> · <strong>Branch:</strong> <code>${escapeHtml(gitCmsBranch)}</code></p>
      <div class="button-row"><a class="button button-secondary" href="/publisher/">Return to Publishing Console</a><a class="button button-quiet" href="/studio/">Use the local Composer</a></div>
      <noscript><p><strong>JavaScript is required for the Git Draft Desk.</strong> The local Contributor Composer remains available at <a href="/studio/">/studio/</a>.</p></noscript>
    </section>
  </main>
  <script data-cfasync="false" src="${escapeHtml(SVELTIA_CMS_SCRIPT)}"></script>
</body>
</html>`;
}

function renderReachArticleActions(article) {
  if (!readerReach.enabled) return '';
  const route = `/stories/${article.slug}/`;
  const save = readerReach.savedArticlesEnabled ? `<button type="button" class="button button-secondary js-only" data-save-article data-article-url="${escapeHtml(route)}" data-article-title="${escapeHtml(article.title)}" data-article-excerpt="${escapeHtml(article.excerpt)}" data-article-date="${escapeHtml(article.published_at || '')}" aria-pressed="false">${icon('bookmark')}<span data-save-label>Save story</span></button>` : '';
  const share = readerReach.browserShareEnabled ? `<button type="button" class="button button-secondary js-only" data-share-article data-article-url="${escapeHtml(route)}" data-article-title="${escapeHtml(article.title)}" data-article-excerpt="${escapeHtml(article.excerpt)}">${icon('share')}<span>Share</span></button>` : '';
  if (!save && !share) return '';
  return `<section class="reader-reach-actions" data-reach-actions aria-label="Save or share this article"><div class="button-row">${save}${share}</div><p class="reader-reach-status" data-reach-status role="status" aria-live="polite" aria-atomic="true"></p><noscript><p>Use your browser bookmarks or share menu when JavaScript is unavailable.</p></noscript></section>`;
}

function readerLayout({ route, article, author, body }) {
  const canonical = article.canonical_url || absoluteUrl(`/stories/${article.slug}/`);
  const pageTitle = `${article.title} — simplified reading view | ${site.short_title}`;
  const head = pageHead({
    site, deployment, route, pageTitle,
    description: article.seo_description || article.excerpt,
    canonical, noindex: true,
    image: article.featured_image || site.default_social_image,
    imageAlt: article.featured_image ? article.featured_image_alt : site.default_social_image_alt,
    article, author,
    categories: (article.categories || []).map((slug) => categoryMap.get(slug)?.name).filter(Boolean),
    tags: article.tags || []
  });
  return `<!doctype html>
${sourceProvenanceComment()}
<html lang="${escapeHtml(site.locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="${escapeHtml(safeThemeColor(site.theme?.paper, '#fffefb'))}">
  <meta name="generator" content="${TAHAI_PRESS_PROVENANCE.software}">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(article.seo_description || article.excerpt)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  ${head.html}
  <link rel="stylesheet" href="/assets/styles.css">
  ${themeStylesheet()}
  ${accessibility.readerToolsEnabled ? '<script src="/assets/reading-tools.js" defer></script>' : ''}
  ${themeVariables()}
</head>
<body class="reader-view${appliedTheme ? ` theme-${appliedTheme.id}` : ''}${accessibility.defaultLinkUnderlines ? ' default-link-underlines' : ''}">
  <a class="skip-link" href="#main">Skip to article</a>
  <header class="reader-view-header">
    <div class="reader-view-header-inner">
      <a class="reader-view-brand" href="/">${escapeHtml(site.short_title)}</a>
      <nav aria-label="Reading view controls"><a href="/stories/${escapeHtml(article.slug)}/">Standard article view</a>${renderReadingTools()}</nav>
    </div>
  </header>
  <main id="main" tabindex="-1">${body}</main>
  <footer class="reader-view-footer"><p><a href="/stories/${escapeHtml(article.slug)}/">Return to the standard article page</a></p><p>Reader preferences stay in this browser.</p></footer>
</body>
</html>`;
}

function renderSimplifiedStoryBlocks(article = {}) {
  const blocks = Array.isArray(article.story_blocks) ? article.story_blocks : [];
  return blocks.map((block, index) => {
    if (!block || typeof block !== 'object') return '';
    const heading = escapeHtml(block.heading || 'Story detail');
    if (block.type === 'text') return `<section class="reader-block"><h2>${heading}</h2><div class="prose">${renderMarkdown(block.body || '')}</div></section>`;
    if (block.type === 'key_points') return `<section class="reader-block"><h2>${escapeHtml(block.heading || 'Key points')}</h2><ul>${(block.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
    if (block.type === 'pull_quote') return `<figure class="reader-block reader-quote"><blockquote>${escapeHtml(block.quote || '')}</blockquote>${block.attribution ? `<figcaption>${escapeHtml(block.attribution)}</figcaption>` : ''}</figure>`;
    if (block.type === 'fact_box' || block.type === 'callout') return `<section class="reader-block"><h2>${heading}</h2><div class="prose">${renderMarkdown(block.body || '')}</div></section>`;
    if (block.type === 'image') {
      const src = safeUrl(block.src || block.image || '');
      if (!src) return '';
      return `<figure class="reader-block reader-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(block.decorative ? '' : block.alt || '')}" loading="lazy" decoding="async">${block.caption || block.credit ? `<figcaption>${[block.caption, block.credit].filter(Boolean).map(escapeHtml).join(' · ')}</figcaption>` : ''}</figure>`;
    }
    if (block.type === 'gallery') return `<section class="reader-block"><h2>${escapeHtml(block.heading || 'Gallery')}</h2>${block.description ? `<p>${escapeHtml(block.description)}</p>` : ''}<div class="reader-gallery">${(block.items || []).map((item) => {
      const src = safeUrl(item?.src || item?.image || '');
      if (!src) return '';
      return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(item.decorative ? '' : item.alt || '')}" loading="lazy" decoding="async">${item.caption || item.credit ? `<figcaption>${[item.caption, item.credit].filter(Boolean).map(escapeHtml).join(' · ')}</figcaption>` : ''}</figure>`;
    }).join('')}</div></section>`;
    if (block.type === 'timeline') return `<section class="reader-block"><h2>${escapeHtml(block.heading || 'Timeline')}</h2><ol>${(block.items || []).map((item) => `<li>${item.date ? `<p><strong>${escapeHtml(item.date)}</strong></p>` : ''}<h3>${escapeHtml(item.title || 'Timeline entry')}</h3>${item.body ? `<div class="prose">${renderMarkdown(item.body)}</div>` : ''}</li>`).join('')}</ol></section>`;
    if (block.type === 'document') {
      const href = safeUrl(block.url || block.file || '');
      if (!href) return '';
      const external = /^https?:\/\//i.test(href);
      return `<section class="reader-block"><h2>${heading}</h2>${block.description ? `<p>${escapeHtml(block.description)}</p>` : ''}<p><a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(block.label || 'Open document')}${external ? newTabNote() : ''}</a></p></section>`;
    }
    return '';
  }).filter(Boolean).join('\n');
}

function renderSimplifiedDocument(article, documentUrl) {
  if (!documentUrl) return '';
  const external = /^https?:\/\//i.test(documentUrl);
  return `<section class="reader-block reader-document"><h2>${escapeHtml(article.pdf_title || 'Source document')}</h2>${renderDocumentAccessibleSummary(article, { compact: true })}<p><a class="button button-secondary" href="${escapeHtml(documentUrl)}" target="_blank" rel="noopener noreferrer">Open the original document${newTabNote()}</a></p></section>`;
}

function articleFormat(article) {
  if (article.article_type === 'pdf') return 'PDF document';
  if (article.article_type === 'mixed') return 'Story + PDF';
  if (article.article_type === 'external') return 'External document';
  return 'Written story';
}

function articleStatusLabel(status = 'draft') {
  return {
    draft: 'Draft',
    review: 'Review',
    scheduled: 'Scheduled',
    published: 'Published',
    corrected: 'Corrected',
    archived: 'Archived'
  }[status] || 'Draft';
}

function articleTemplateLabel(article) {
  if (article.article_type === 'pdf') return 'Document record';
  if (article.article_type === 'mixed') return 'Context + source document';
  if (article.article_type === 'external') return 'Linked source record';
  return 'Written reporting';
}

function machineDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function renderMetaList(items, className = 'article-facts') {
  const present = items.filter((item) => item?.value);
  if (!present.length) return '';
  return `<dl class="${className}">${present.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('\n')}</dl>`;
}

function renderArticleByline(article, author, hub) {
  const publishedLabel = formatDate(article.published_at, site.locale, site.timezone);
  const updatedLabel = article.updated_at ? formatDate(article.updated_at, site.locale, site.timezone) : '';
  const readingMinutes = estimateReadingMinutes(`${article.body || ''} ${storyBlocksPlainText(article)}`);
  const details = [
    `<span>Published <time datetime="${escapeHtml(machineDate(article.published_at))}">${escapeHtml(publishedLabel)}</time>${hub ? ` · ${escapeHtml(hub.name)}` : ''}</span>`,
    updatedLabel ? `<span>Updated <time datetime="${escapeHtml(machineDate(article.updated_at))}">${escapeHtml(updatedLabel)}</time></span>` : '',
    readingMinutes ? `<span>${readingMinutes} min read</span>` : ''
  ].filter(Boolean).join('\n');
  return `<div class="article-byline"><span class="author-mark" aria-hidden="true">${escapeHtml((author?.name || article.author).charAt(0))}</span><p><strong>${escapeHtml(author?.name || article.author)}</strong>${details}</p></div>`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function localPublicFileSize(url) {
  if (!String(url || '').startsWith('/')) return '';
  const publicRoot = path.resolve(ROOT, 'public');
  const candidate = path.resolve(publicRoot, String(url).slice(1));
  if (!candidate.startsWith(`${publicRoot}${path.sep}`)) return '';
  try {
    return formatFileSize(fs.statSync(candidate).size);
  } catch {
    return '';
  }
}

function renderDocumentMetadata(article, pdf = '') {
  return renderMetaList([
    { label: 'Document date', value: article.document_date ? formatDate(article.document_date, site.locale, site.timezone) : '' },
    { label: 'Length', value: article.document_pages ? `${article.document_pages} ${article.document_pages === 1 ? 'page' : 'pages'}` : '' },
    { label: 'File', value: localPublicFileSize(pdf) ? `PDF · ${localPublicFileSize(pdf)}` : (pdf ? 'PDF' : '') },
    { label: 'Source', value: article.document_source || '' }
  ], 'document-facts');
}

function renderDocumentAccessibleSummary(article, { compact = false } = {}) {
  const summary = String(article.document_accessible_summary || '').trim();
  const note = String(article.document_accessibility_note || '').trim();
  if (!summary && !note) return '';
  const headingId = `document-accessible-summary-${article.slug}`;
  return `<section class="document-accessible-summary${compact ? ' document-accessible-summary-compact' : ''}" aria-labelledby="${escapeHtml(headingId)}">
    <div class="document-accessible-summary-heading"><p class="eyebrow">Accessible alternative</p><h2 id="${escapeHtml(headingId)}">Document summary in HTML</h2></div>
    ${summary ? `<div class="prose">${renderMarkdown(summary)}</div>` : ''}
    ${note ? `<p class="document-accessibility-note"><strong>Access note:</strong> ${escapeHtml(note)}</p>` : ''}
  </section>`;
}

function renderPdfDocument(article, pdf, { primary = false } = {}) {
  const title = article.pdf_title || article.title;
  const isLocal = pdf.startsWith('/');
  const defaultView = article.pdf_viewer_default === 'fit-page' ? 'Fit' : 'FitH';
  const readerId = `pdf-reader-${article.slug}`;
  const frameId = `pdf-frame-${article.slug}`;
  const supportId = `pdf-support-${article.slug}`;
  const summaryId = `document-accessible-summary-${article.slug}`;
  const directUrl = escapeHtml(pdf);
  const previewUrl = escapeHtml(`${String(pdf).split('#')[0]}#view=${defaultView}&toolbar=1&navpanes=0`);
  const printUrl = escapeHtml(new URL(pdf, site.site_url).href);
  const download = article.allow_download && isLocal
    ? `<a class="pdf-action pdf-action-primary" href="${directUrl}" download>${icon('download')}<span>Download PDF</span></a>`
    : '';
  return `<section class="document-section${primary ? ' document-section-primary' : ''}" aria-labelledby="document-heading-${escapeHtml(article.slug)}">
    <div class="document-heading-row">
      <div><p class="eyebrow">${primary ? 'Primary record' : 'Supporting document'}</p><h2 id="document-heading-${escapeHtml(article.slug)}">${escapeHtml(title)}</h2>${article.document_description ? `<p class="document-description">${escapeHtml(article.document_description)}</p>` : ''}</div>
      <div class="document-actions"><a class="button button-secondary" href="${directUrl}" target="_blank" rel="noopener noreferrer">Open PDF ${icon('open')}${newTabNote()}</a>${article.allow_download && isLocal ? `<a class="button" href="${directUrl}" download>Download PDF ${icon('download')}</a>` : ''}<button class="button button-quiet js-only" type="button" data-print-page>Print article ${icon('print')}</button></div>
    </div>
    ${renderDocumentMetadata(article, pdf)}
    ${renderDocumentAccessibleSummary(article)}
    <div class="pdf-reader" id="${readerId}" data-pdf-reader data-pdf-source="${directUrl}" data-default-view="${defaultView}">
      <div class="pdf-toolbar" role="toolbar" aria-label="PDF preview controls">
        <div class="pdf-toolbar-status"><span class="pdf-status-dot" aria-hidden="true"></span><span data-pdf-status aria-live="polite">PDF preview</span></div>
        <div class="pdf-toolbar-group" role="group" aria-label="Page navigation">
          <button class="pdf-control" type="button" data-pdf-previous disabled><span>Previous</span></button>
          <span class="pdf-page-count" data-pdf-page-count>Page 0 of 0</span>
          <button class="pdf-control" type="button" data-pdf-next disabled><span>Next</span></button>
        </div>
        <div class="pdf-toolbar-group pdf-view-controls" role="group" aria-label="Page fit">
          <button class="pdf-control" type="button" data-pdf-view="FitH" aria-pressed="${defaultView === 'FitH'}">${icon('fitWidth')}<span>Fit width</span></button>
          <button class="pdf-control" type="button" data-pdf-view="Fit" aria-pressed="${defaultView === 'Fit'}">${icon('fitPage')}<span>Fit page</span></button>
        </div>
        <div class="pdf-toolbar-group" role="group" aria-label="Zoom controls"><button class="pdf-control" type="button" data-pdf-zoom-out><span>Zoom out</span></button><button class="pdf-control" type="button" data-pdf-zoom-in><span>Zoom in</span></button></div>
        <div class="pdf-toolbar-group pdf-toolbar-actions" role="group" aria-label="Preview actions">
          <button class="pdf-control" type="button" data-pdf-fullscreen aria-controls="${readerId}" aria-pressed="false">${icon('expand')}<span>Full screen</span></button>
          <a class="pdf-control" href="${directUrl}" target="_blank" rel="noopener noreferrer">${icon('open')}<span>Open</span>${newTabNote()}</a>
        </div>
      </div>
      <div class="pdf-frame pdf-stage" id="${frameId}" data-pdf-stage tabindex="-1" role="region" aria-label="Embedded PDF preview: ${escapeHtml(title)}" aria-describedby="${summaryId} ${supportId}">
        <div class="pdf-loading" data-pdf-loading><span class="pdf-loading-spinner" aria-hidden="true"></span><p>Preparing the accessible PDF preview…</p></div>
        <canvas data-pdf-canvas hidden></canvas>
      </div>
      <div class="pdf-mobile-actions" aria-label="Mobile PDF actions">
        <a class="pdf-action" href="${directUrl}" target="_blank" rel="noopener noreferrer">${icon('open')}<span>Open in browser</span>${newTabNote()}</a>${download}
      </div>
    </div>
    <div class="pdf-support" id="${supportId}">
      <p><strong>Preview not working?</strong> Browser PDF support varies, especially on phones and privacy-focused browsers. <a href="${directUrl}" target="_blank" rel="noopener noreferrer">Open the PDF directly${newTabNote()}</a>${article.allow_download && isLocal ? ` or <a href="${directUrl}" download>download a copy</a>` : ''}.</p>
      <p class="pdf-reader-help">Use the controls above to fit the page or enter full-screen mode. Press Escape to leave full screen.</p>
    </div>
    <p class="print-document-link"><strong>Attached PDF:</strong> <a href="${printUrl}">${printUrl}</a></p>
    <noscript><p class="pdf-noscript">JavaScript is disabled. The embedded PDF and direct links still work; fit and full-screen controls are unavailable.</p></noscript>
  </section>`;
}

function renderExternalDocument(article, url) {
  const label = article.external_link_label || 'Open external document';
  return `<section class="external-document" aria-labelledby="external-document-heading-${escapeHtml(article.slug)}">
    <div class="external-document-icon" aria-hidden="true">${icon('source')}</div>
    <div class="external-document-copy">
      <p class="eyebrow">External source</p>
      <h2 id="external-document-heading-${escapeHtml(article.slug)}">${escapeHtml(article.pdf_title || article.title)}</h2>
      <p>${escapeHtml(article.document_description || 'This source document is maintained on another website and opens in a new tab.')}</p>
      ${renderDocumentMetadata(article, url)}
      ${renderDocumentAccessibleSummary(article, { compact: true })}
    </div>
    <a class="button" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ${icon('arrow')}${newTabNote()}</a>
  </section>`;
}

function renderArticleContext(article, heading = 'Article') {
  if (!article.body) return '';
  return `<section class="article-context" aria-labelledby="article-context-heading-${escapeHtml(article.slug)}"><h2 class="visually-hidden" id="article-context-heading-${escapeHtml(article.slug)}">${escapeHtml(heading)}</h2><div class="prose article-prose">${renderMarkdown(article.body)}</div></section>`;
}

function renderSources(sourceLinks) {
  if (!sourceLinks.length) return '';
  return `<section class="sources"><p class="eyebrow">Sources</p><h2>Related links and supporting material</h2><ul>${sourceLinks.map((source) => `<li><a href="${escapeHtml(safeUrl(source.url))}"${String(source.url).startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(source.label)}${String(source.url).startsWith('http') ? newTabNote() : ''}</a>${source.note ? ` — ${escapeHtml(source.note)}` : ''}</li>`).join('\n')}</ul></section>`;
}

function renderTags(article) {
  const tags = (article.tags || []).filter(Boolean);
  if (!tags.length) return '';
  return `<section class="article-tags" aria-label="Article topics"><p class="eyebrow">Topics</p><ul>${tags.map((tag) => `<li><a href="/topics/${escapeHtml(topicSlug(tag))}/">${escapeHtml(tag)}</a></li>`).join('\n')}</ul></section>`;
}

function renderAuthorCard(article, author) {
  if (article.show_author_bio === false || !author) return '';
  return `<aside class="author-card" aria-labelledby="author-card-heading-${escapeHtml(article.slug)}"><span class="author-card-mark" aria-hidden="true">${escapeHtml(author.name.charAt(0))}</span><div><p class="eyebrow">About the contributor</p><h2 id="author-card-heading-${escapeHtml(article.slug)}">${escapeHtml(author.name)}</h2>${author.role ? `<p class="author-role">${escapeHtml(author.role)}</p>` : ''}${author.bio ? `<p>${escapeHtml(author.bio)}</p>` : ''}</div></aside>`;
}

function renderClassificationBadge(article, { link = true } = {}) {
  const info = classificationInfo(article.classification);
  const label = escapeHtml(info.label);
  return link ? `<a class="classification-label classification-${escapeHtml(info.key)}" href="/sections/${escapeHtml(info.key)}/">${label}</a>` : `<span class="classification-label classification-${escapeHtml(info.key)}">${label}</span>`;
}

function renderSeriesNotice(article) {
  if (!article.series_slug || !article.series_title) return '';
  const part = Number.isInteger(article.series_order) ? `Part ${article.series_order}` : 'Series';
  return `<aside class="series-notice" aria-label="Series information"><p class="eyebrow">${escapeHtml(part)} of a series</p><h2><a href="/series/${escapeHtml(article.series_slug)}/">${escapeHtml(article.series_title)}</a></h2>${article.series_description ? `<p>${escapeHtml(article.series_description)}</p>` : ''}</aside>`;
}

function renderPublicationHistory(article) {
  const { updates, corrections } = publicationHistory(article);
  if (!updates.length && !corrections.length && !article.what_changed) return '';
  return `<section class="publication-history" aria-labelledby="publication-history-${escapeHtml(article.slug)}"><div class="section-heading compact-heading"><div><p class="eyebrow">Transparency record</p><h2 id="publication-history-${escapeHtml(article.slug)}">Updates and corrections</h2></div></div>${article.what_changed ? `<div class="what-changed"><strong>What changed</strong><p>${escapeHtml(article.what_changed)}</p></div>` : ''}${corrections.length ? `<div class="history-group history-corrections"><h3>Corrections</h3><ol>${corrections.map((entry) => `<li><time datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date, site.locale, site.timezone))}</time><strong>${escapeHtml(entry.title || 'Correction')}</strong><p>${escapeHtml(entry.body)}</p></li>`).join('')}</ol></div>` : ''}${updates.length ? `<details class="history-group"><summary>View update history (${updates.length})</summary><ol>${updates.map((entry) => `<li><time datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date, site.locale, site.timezone))}</time><strong>${escapeHtml(entry.title || 'Update')}</strong><p>${escapeHtml(entry.body)}</p></li>`).join('')}</ol></details>` : ''}</section>`;
}

function renderTrustDesk(article) {
  const sections = [];
  if (String(article.methodology || '').trim()) sections.push(`<section><p class="eyebrow">How this was reported</p><h3>Methodology</h3><div class="prose">${renderMarkdown(article.methodology)}</div></section>`);
  if (String(article.disclosure || '').trim()) sections.push(`<section><p class="eyebrow">Reader context</p><h3>Disclosure</h3><div class="prose">${renderMarkdown(article.disclosure)}</div></section>`);
  if (String(article.rights_and_reuse || '').trim()) sections.push(`<section><p class="eyebrow">Rights and reuse</p><h3>Using this work</h3><p>${escapeHtml(article.rights_and_reuse)}</p></section>`);
  if (!sections.length) return '';
  return `<aside class="trust-desk" aria-labelledby="trust-desk-${escapeHtml(article.slug)}"><div class="trust-desk-heading"><p class="eyebrow">Trust and context</p><h2 id="trust-desk-${escapeHtml(article.slug)}">About this reporting</h2></div><div class="trust-desk-grid">${sections.join('')}</div></aside>`;
}

function renderRelatedCoverage(article) {
  const related = (article.related_articles || []).map((slug) => publishedArticleMap.get(slug)).filter(Boolean).slice(0, 6);
  if (!related.length) return '';
  return `<section class="related-coverage" aria-labelledby="related-coverage-${escapeHtml(article.slug)}"><div class="section-heading compact-heading"><div><p class="eyebrow">Continue reading</p><h2 id="related-coverage-${escapeHtml(article.slug)}">Related coverage</h2></div></div><div class="related-coverage-grid">${related.map((item) => articleCard(item, { compact: true })).join('')}</div></section>`;
}

function renderCitationDesk(article, author) {
  const url = article.canonical_url || absoluteUrl(`/stories/${article.slug}/`);
  const citation = articleCitation({ article, author, site, url });
  const id = `citation-${article.slug}`;
  return `<aside class="citation-desk" data-copy-region aria-labelledby="citation-heading-${escapeHtml(article.slug)}"><div><p class="eyebrow">Permanent citation</p><h2 id="citation-heading-${escapeHtml(article.slug)}">Cite or share this article</h2><p id="${escapeHtml(id)}" class="citation-text">${escapeHtml(citation)}</p></div><div class="citation-actions js-only"><button type="button" class="button button-secondary" data-copy-target="${escapeHtml(id)}">Copy citation</button><button type="button" class="button button-quiet" data-copy-url>Copy link</button></div><p class="citation-status" data-copy-status role="status" aria-live="polite"></p></aside>`;
}

function storyMedia(article, { featured = false } = {}) {
  const image = safeUrl(article.featured_image || '');
  const category = article.categories?.[0] || 'reporting';
  if (image) {
    return `<figure class="story-media${featured ? ' story-media-featured' : ''}">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(article.featured_image_alt)}" loading="${featured ? 'eager' : 'lazy'}" decoding="async">
    </figure>`;
  }
  return `<div class="story-media story-media-placeholder${featured ? ' story-media-featured' : ''}" data-tone="${escapeHtml(category)}" aria-hidden="true">
    <span class="placeholder-mark">${brandMark()}</span>
    <span class="placeholder-type">${escapeHtml(articleFormat(article))}</span>
  </div>`;
}

function storyMeta(article) {
  const author = authorMap.get(article.author);
  return `${formatDate(article.published_at, site.locale, site.timezone)}${author ? ` <span aria-hidden="true">·</span> <a href="/authors/${escapeHtml(author.slug)}/">${escapeHtml(author.name)}</a>` : ''}`;
}

function articleCard(article, { compact = false } = {}) {
  const category = categoryMap.get(article.categories?.[0]);
  return `<article class="story-card${compact ? ' story-card-compact' : ''}">
    <a class="story-card-media-link" href="/stories/${escapeHtml(article.slug)}/" tabindex="-1" aria-hidden="true">${storyMedia(article)}</a>
    <div class="story-card-body">
      <div class="story-card-labels">
        ${category ? `<a class="eyebrow discovery-label-link" href="/categories/${escapeHtml(category.slug)}/">${escapeHtml(category.name)}</a>` : '<span class="eyebrow">Story</span>'}
        ${renderClassificationBadge(article)}<span class="format-label">${escapeHtml(articleFormat(article))}</span><span class="status-label status-${escapeHtml(article.status)}">${escapeHtml(articleStatusLabel(article.status))}</span>
      </div>
      <h2><a href="/stories/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a></h2>
      <p>${escapeHtml(article.excerpt)}</p>
      <p class="byline">${storyMeta(article)}</p>
      <a class="text-link" href="/stories/${escapeHtml(article.slug)}/">Read the full story ${icon('arrow')}</a>
    </div>
  </article>`;
}

function featuredStory(article) {
  const category = categoryMap.get(article.categories?.[0]);
  return `<article class="featured-story">
    <div class="featured-story-copy">
      <div class="story-card-labels">
        <span class="eyebrow">Featured</span>
        ${renderClassificationBadge(article)}<span class="format-label">${escapeHtml(category?.name || articleFormat(article))}</span><span class="status-label status-${escapeHtml(article.status)}">${escapeHtml(articleStatusLabel(article.status))}</span>
      </div>
      <h2><a href="/stories/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a></h2>
      <p class="featured-deck">${escapeHtml(article.excerpt)}</p>
      <p class="byline">${storyMeta(article)}</p>
      <a class="button" href="/stories/${escapeHtml(article.slug)}/">Open featured story ${icon('arrow')}</a>
    </div>
    <a class="featured-story-media-link" href="/stories/${escapeHtml(article.slug)}/" tabindex="-1" aria-hidden="true">${storyMedia(article, { featured: true })}</a>
  </article>`;
}

function emptyStories() {
  return `<div class="empty-state">
    <span class="empty-state-icon">${icon('document')}</span>
    <h2>The archive is ready for its first story.</h2>
    <p>Published entries will appear here automatically.</p>
  </div>`;
}


function collectionRoute(base, page) {
  return page === 1 ? base : `${base}page/${page}/`;
}

function paginationNav({ base, page, totalPages }) {
  if (totalPages <= 1) return '';
  const links = [];
  if (page > 1) links.push(`<a rel="prev" href="${collectionRoute(base, page - 1)}">${icon('arrow')}<span>Newer</span></a>`);
  links.push(`<span>Page ${page} of ${totalPages}</span>`);
  if (page < totalPages) links.push(`<a rel="next" href="${collectionRoute(base, page + 1)}"><span>Older</span>${icon('arrow')}</a>`);
  return `<nav class="pagination" aria-label="Archive pagination">${links.join('\n')}</nav>`;
}

function archiveListing({ eyebrow = 'Archive', title, description, articles: items, base, page = 1, totalPages = 1, emptyMessage = 'No published entries match this archive.' }) {
  return `<section class="page-hero page-hero-newsroom"><div class="shell page-hero-grid"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(description)}</p></div><div class="page-hero-stat"><strong>${items.length}</strong><span>${items.length === 1 ? 'entry on this page' : 'entries on this page'}</span></div></div></section>
  <section class="section shell" aria-labelledby="archive-results-heading"><div class="section-heading"><div><p class="eyebrow">Latest first</p><h2 id="archive-results-heading">Published entries</h2></div><a class="section-link" href="/search/">Search all publishing ${icon('search')}</a></div>
  ${items.length ? `<div class="story-grid">${items.map((article) => articleCard(article)).join('\n')}</div>` : `<div class="empty-state"><span class="empty-state-icon">${icon('document')}</span><h2>${escapeHtml(emptyMessage)}</h2><p>Try another archive or use full-site search.</p></div>`}
  ${paginationNav({ base, page, totalPages })}</section>`;
}

function writePaginatedArchive({ base, title, description, eyebrow, items, pageClass = 'archive-page' }) {
  const pageSize = site.discovery?.archive_page_size || 12;
  for (const pageData of paginate(items, pageSize)) {
    const route = collectionRoute(base, pageData.page);
    const pageTitle = pageData.page === 1 ? title : `${title} — Page ${pageData.page}`;
    writeRoute(route, layout({
      route,
      title: pageTitle,
      description,
      canonical: absoluteUrl(route),
      pageClass,
      body: archiveListing({ eyebrow, title: pageTitle, description, articles: pageData.items, base, page: pageData.page, totalPages: pageData.totalPages })
    }));
  }
}

const published = articles
  .filter((article) => ['published', 'corrected'].includes(article.status))
  .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
const publishedArticleMap = new Map(published.map((article) => [article.slug, article]));
const classificationGroups = new Map(ARTICLE_CLASSIFICATION_KEYS.map((key) => [key, published.filter((article) => classificationInfo(article.classification).key === key)]));
const publicationSeries = seriesForArticles(published);
const featured = published.find((article) => article.featured) || published[0];
const latest = published.filter((article) => article.slug !== featured?.slug).slice(0, 6);
const activeHubs = hubs.filter((hub) => hub.active !== false);
const publicEditions = editions.filter((edition) => edition.status === 'published').map((edition) => ({
  ...edition,
  sections: Array.isArray(edition.sections) ? edition.sections.map((section) => ({
    title: String(section.title || 'Untitled section'),
    story_ids: Array.isArray(section.story_ids) ? section.story_ids : [],
    record_ids: Array.isArray(section.record_ids) ? section.record_ids : []
  })) : []
}));
const publicNewsletters = newsletters.filter((newsletter) => newsletter.status === 'published');

function renderHomeModule(module) {
  const type = module.type;
  if (module.enabled === false) return '';
  if (['setup', 'license', 'product'].includes(type) && !templateMode(site)) return '';
  if (type === 'lead_story') return renderHomeModule({ ...module, type: 'featured' });
  if (type === 'secondary_headlines') return renderHomeModule({ ...module, type: 'latest', heading: module.heading || 'More headlines', count: module.count || 3 });
  if (type === 'coverage_hub') return renderHomeModule({ ...module, type: 'hubs' });
  if (type === 'submission_callout') return renderHomeModule({ ...module, type: 'submit' });
  if (type === 'category_strip') {
    return `<section class="section shell" aria-labelledby="category-strip-heading"><div class="section-heading"><div><p class="eyebrow">Browse by desk</p><h2 id="category-strip-heading">${escapeHtml(module.heading || 'Categories')}</h2></div></div><div class="topic-chip-list">${categories.map((category) => `<a class="topic-chip" href="/categories/${escapeHtml(category.slug)}/">${escapeHtml(category.name)}</a>`).join('')}</div></section>`;
  }
  if (type === 'public_record_desk' || type === 'featured_investigation') {
    const classification = type === 'public_record_desk' ? 'public-record' : 'investigation';
    const items = published.filter((article) => classificationInfo(article.classification).key === classification).slice(0, Math.max(1, Math.min(12, Number(module.count || 3))));
    const label = type === 'public_record_desk' ? 'Public record desk' : 'Featured investigation';
    return `<section class="section shell" aria-labelledby="${type}-heading"><div class="section-heading"><div><p class="eyebrow">${label}</p><h2 id="${type}-heading">${escapeHtml(module.heading || label)}</h2></div></div>${items.length ? `<div class="story-grid">${items.map((article) => articleCard(article)).join('')}</div>` : '<div class="empty-state"><p>Published coverage will appear here.</p></div>'}</section>`;
  }
  if (type === 'editors_note' || type === 'custom_text_panel') {
    const label = type === 'editors_note' ? 'From the editor' : 'Information';
    const heading = module.heading || (type === 'editors_note' ? 'Editor’s note' : 'Community notice');
    const body = module.body || module.text || site.editorial_promise || site.description;
    return `<section class="section shell"><aside class="story-block story-block-callout callout-context"><p class="eyebrow">${label}</p><h2>${escapeHtml(heading)}</h2><div class="prose">${renderMarkdown(String(body))}</div></aside></section>`;
  }
  if (type === 'recently_updated') {
    const items = [...published].sort((a, b) => new Date(b.updated_at || b.published_at) - new Date(a.updated_at || a.published_at)).slice(0, Math.max(1, Math.min(12, Number(module.count || 5))));
    return `<section class="section shell" aria-labelledby="recently-updated-heading"><div class="section-heading"><div><p class="eyebrow">Revision ledger</p><h2 id="recently-updated-heading">${escapeHtml(module.heading || 'Most recently updated')}</h2></div></div><div class="story-grid">${items.map((article) => articleCard(article)).join('')}</div></section>`;
  }
  if (type === 'document_spotlight') {
    const item = published.find((article) => ['pdf', 'mixed'].includes(article.article_type));
    return item ? `<section class="section shell" aria-labelledby="document-spotlight-heading"><div class="section-heading"><div><p class="eyebrow">Document spotlight</p><h2 id="document-spotlight-heading">${escapeHtml(module.heading || 'Read the record')}</h2></div></div>${articleCard(item)}</section>` : '';
  }
  if (type === 'crossword_promotion') return `<section class="section shell"><aside class="story-block story-block-callout callout-note"><p class="eyebrow">Reader break</p><h2>${escapeHtml(module.heading || 'Crossword')}</h2><p>Take a short break with a publication-owned crossword—no account or tracking required.</p><a class="button button-secondary" href="/puzzles/">Open the crossword ${icon('arrow')}</a></aside></section>`;
  if (type === 'accessibility_notice') return `<section class="section shell"><aside class="story-block story-block-callout callout-context"><p class="eyebrow">Accessibility</p><h2>${escapeHtml(module.heading || 'Designed for more readers')}</h2><p>${escapeHtml(module.body || 'Use the reader controls to adjust text, spacing, contrast, and motion. Contact the editor when an alternative format would help.')}</p></aside></section>`;
  if (type === 'intro') {
    return `<section class="home-intro">
  <div class="shell home-intro-grid">
    <div class="home-intro-copy">
      <p class="eyebrow">${escapeHtml(site.hero_kicker || site.tagline)}</p>
      <h1>${escapeHtml(site.hero_title || 'Publish stories and source documents without a database.')}</h1>
      <p class="lede">${escapeHtml(site.hero_description || site.description)}</p>
      <div class="button-row">
        ${templateMode(site) ? `<a class="button" href="/setup/">Set up your publication ${icon('arrow')}</a><a class="button button-quiet" href="/stories/">Explore the demo</a>` : `<a class="button" href="/stories/">Explore the archive ${icon('arrow')}</a><a class="button button-quiet" href="/about/">How this publication works</a>`}
      </div>
    </div>
    <aside class="home-intro-note" aria-label="Editorial promise">
      <span class="note-icon">${icon('source')}</span>
      <p class="eyebrow">Publication promise</p>
      <p>${escapeHtml(site.editorial_promise || site.description)}</p>
      <a class="text-link" href="/about/#standards">Read the standards ${icon('arrow')}</a>
    </aside>
  </div>
</section>`;
  }
  if (type === 'setup') {
    return `<section class="section shell easy-setup-frontispiece" aria-labelledby="easy-setup-heading"><div class="easy-setup-copy"><p class="eyebrow">Make it easy. Make it fast.</p><h2 id="easy-setup-heading">Launch a publication in thirteen short, guided steps.</h2><p>Launch Desk remembers progress on this device, supplies safe defaults, previews every change, creates first drafts and records, and prepares one clean launch package. No screen asks for more than the next decision.</p><div class="button-row"><a class="button" href="/setup/">Start or resume setup <span class="launch-progress-pill" data-launch-progress>0/13</span> ${icon('arrow')}</a><a class="button button-secondary" href="https://pagescms.org" target="_blank" rel="noopener noreferrer">Open Pages CMS${newTabNote()}</a></div></div><ol class="setup-step-list"><li><strong>Identity</strong><span>Name, web address, and contact.</span></li><li><strong>Appearance</strong><span>Choose a tested newspaper look.</span></li><li><strong>Front page</strong><span>Keep only the sections readers need.</span></li><li><strong>Trust</strong><span>Set the mission and editorial promises.</span></li><li><strong>First publication</strong><span>Prepare a story and public record.</span></li><li><strong>Ownership</strong><span>Back up and plan recovery.</span></li><li><strong>Launch</strong><span>Preview, connect, and apply.</span></li></ol></section>`;
  }
  if (type === 'license') {
    return `<section class="section shell license-frontispiece" aria-labelledby="license-heading"><div><p class="eyebrow">Apache 2.0 · Publisher freedom</p><h2 id="license-heading">Keep the license in the source. Keep your public pages entirely your own.</h2></div><div class="license-frontispiece-copy"><p>TAHAI Press is released under the Apache License, Version 2.0. When redistributing the software or a modified source distribution, retain the license and required notices and identify material changes as the license requires.</p><p><strong>No public-facing platform credit is required.</strong> A publisher does not have to display a TAHAI Press banner, “Powered by” line, footer note, logo, backlink, hidden link, or other visible attribution on a website built with this system.</p><p><a class="text-link" href="${PROJECT_REPOSITORY}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Read the Apache 2.0 license ${icon('arrow')}${newTabNote()}</a></p></div></section>`;
  }
  if (type === 'featured') {
    if (!featured) return '';
    return `<section class="section section-featured shell" aria-labelledby="featured-heading"><div class="section-kicker-row"><p class="eyebrow">In focus</p><p class="section-rule-label">Articles · Primary documents · Community updates</p></div><h2 class="visually-hidden" id="featured-heading">Featured story</h2>${featuredStory(featured)}</section>`;
  }
  if (type === 'latest') {
    const count = Math.max(1, Math.min(24, Number(module.count || 6)));
    const items = published.filter((article) => article.slug !== featured?.slug).slice(0, count);
    const heading = module.heading || 'Stories and documents';
    return `<section class="section section-latest shell" aria-labelledby="latest-heading"><div class="section-heading"><div><p class="eyebrow">Latest publishing</p><h2 id="latest-heading">${escapeHtml(heading)}</h2></div><a class="section-link" href="/stories/">View the full archive ${icon('arrow')}</a></div>${items.length ? `<div class="story-grid">${items.map((article) => articleCard(article)).join('\n')}</div>` : (featured ? `<div class="story-grid story-grid-single">${articleCard(featured)}</div>` : emptyStories())}</section>`;
  }
  if (type === 'reach') {
    if (!readerReach.enabled) return '';
    return `<section class="section shell reader-reach-frontispiece" aria-labelledby="reader-reach-heading"><div><p class="eyebrow">Reader Reach · private by default</p><h2 id="reader-reach-heading">Save stories, read offline, share accessibly, and print a complete edition.</h2><p>Everything runs in the reader's browser. Saved-story lists and preferences remain on that device; no account, analytics service, hosted database, or tracking profile is created.</p><div class="button-row">${readerReach.currentEditionEnabled ? `<a class="button" href="/edition/">Open current edition ${icon('edition')}</a>` : ''}${readerReach.savedArticlesEnabled ? `<a class="button button-secondary" href="/saved/">Open saved stories ${icon('bookmark')}</a>` : ''}${readerReach.offlineEnabled ? `<button class="button button-quiet js-only" type="button" data-install-publication hidden>Install publication ${icon('install')}</button>` : ''}</div><p class="reader-reach-connection"><span data-connection-status>Online</span></p></div><div class="reader-reach-feature-grid"><article><span>${icon('offline')}</span><h3>Offline reading</h3><p>The latest edition and core publication pages are cached after the first visit.</p></article><article><span>${icon('bookmark')}</span><h3>Local reading list</h3><p>Readers save up to 100 story links in local browser storage and can remove them at any time.</p></article><article><span>${icon('share')}</span><h3>Native sharing</h3><p>The browser share sheet is used when available, with a copy-link fallback.</p></article></div></section>`;
  }
  if (type === 'studio') {
    return `<section class="section shell editorial-studio-frontispiece" aria-labelledby="studio-front-heading"><div class="editorial-studio-front-copy"><p class="eyebrow">Browser-local newsroom tools</p><h2 id="studio-front-heading">Draft the story and prepare its images without touching code.</h2><p>Contributor Composer generates the article file and checks common accessibility issues. Media Desk crops, compresses, describes, credits, and exports publication-ready JPEG or WebP images. Both tools stay in the browser and send nothing to a server.</p><div class="button-row"><a class="button" href="/studio/">Open Contributor Composer ${icon('edit')}</a><a class="button button-secondary" href="/media-desk/">Open Media Desk ${icon('image')}</a></div></div><div class="editorial-studio-feature-list"><article><span>${icon('edit')}</span><h3>Quick Story</h3><p>Headline, summary, article, author, category, and image—only the fields most contributors need.</p></article><article><span>${icon('source')}</span><h3>Local draft desk</h3><p>Keep up to 20 named browser-local copies or reopen an existing TAHAI Press article file.</p></article><article><span>${icon('image')}</span><h3>Media Desk</h3><p>Use publishing presets, focal points, compression, accessibility metadata, and a clean repository handoff.</p></article></div></section>`;
  }
  if (type === 'console') {
    return `<section class="section shell publishing-console-frontispiece" aria-labelledby="console-front-heading"><div class="publishing-console-front-copy"><p class="eyebrow">Publishing Console</p><h2 id="console-front-heading">Schema-safe Git editing for the newsroom model.</h2><p>Articles, authors, categories, hubs, navigation, homepage modules, footer columns, and publication settings stay visible in one role-ready editing surface with workflow states, diff review, and stale-revision checks.</p><div class="button-row"><a class="button" href="/publisher/">Open the Publishing Console ${icon('edit')}</a><a class="button button-secondary" href="/studio/">Use Contributor Composer</a></div></div><div class="publishing-console-feature-list"><article><span>${icon('source')}</span><h3>Workflow states</h3><p>Draft, review, scheduled, published, corrected, and archived records are tracked with fail-closed transitions.</p></article><article><span>${icon('document')}</span><h3>Diff review</h3><p>Preview the file changes and reject a stale or conflicting revision before export.</p></article><article><span>${icon('community')}</span><h3>Site structure</h3><p>Navigation, homepage modules, and footer links share the same schema-safe handoff.</p></article></div></section>`;
  }
  if (type === 'product') {
    return `<section class="section shell product-broadsheet" aria-labelledby="product-heading"><div class="product-broadsheet-heading"><p class="eyebrow">From the publisher's desk</p><h2 id="product-heading">Fork the press. Keep the files. Publish on your terms.</h2><p>TAHAI Press is a reusable publication engine, not a hosted lock-in service. The repository includes newsroom templates, Pages CMS configuration, import tools, redirect preservation, accessibility checks, private operational health reports, explicit performance budgets, CMS-managed crosswords, and the Cloudflare build contract.</p></div><div class="product-broadsheet-columns"><article><span class="column-number">01</span><h3>Read the source</h3><p>Inspect every build step, content rule, operational check, and generated page in the public repository.</p><a class="text-link" href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">Open GitHub ${icon('arrow')}${newTabNote()}</a></article><article><span class="column-number">02</span><h3>Meet the developer</h3><p>Created by Justin Tahai and TAHAI Web Services as a practical open-source publishing foundation.</p><a class="text-link" href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">Visit tahai.net ${icon('arrow')}${newTabNote()}</a></article><article><span class="column-number">03</span><h3>Operate without a backend</h3><p>Audit media, protect performance, review private newsroom health, edit crosswords as content, and keep contributor drafts local.</p><a class="text-link" href="/studio/">Open the Contributor Composer ${icon('arrow')}</a></article></div></section>`;
  }
  if (type === 'pillars') {
    return `<section class="mission-band" aria-labelledby="mission-heading"><div class="shell"><div class="mission-heading"><p class="eyebrow">A practical publishing foundation</p><h2 id="mission-heading">Clear enough for readers. Simple enough for editors.</h2></div><div class="pillar-grid"><article><span>${icon('document')}</span><h3>Publish</h3><p>Create written stories, PDF-first posts, or mixed articles from structured content files.</p></article><article><span>${icon('source')}</span><h3>Preserve</h3><p>Keep original documents available beside the context that explains why they matter.</p></article><article><span>${icon('community')}</span><h3>Organize</h3><p>Group coverage by category, contributor, or geographic and subject-matter hub.</p></article></div></div></section>`;
  }
  if (type === 'hubs') {
    const count = Math.max(1, Math.min(12, Number(module.count || 4)));
    return `<section class="section shell community-grid" aria-labelledby="community-heading"><div class="community-copy"><p class="eyebrow">Flexible organization</p><h2 id="community-heading">Coverage hubs that fit the publication.</h2><p class="lede">Use hubs for towns, regions, beats, projects, case files, organizations, or any other recurring coverage lane.</p><a class="button button-secondary" href="/hubs/">Explore coverage hubs ${icon('arrow')}</a></div><div class="hub-preview" aria-label="Active coverage hubs">${activeHubs.length ? activeHubs.slice(0, count).map((hub) => `<a href="/hubs/${escapeHtml(hub.slug)}/"><span>${icon('location')}</span><span><strong>${escapeHtml(hub.name)}</strong><small>${escapeHtml(hub.description || hub.region || 'Organized coverage')}</small></span>${icon('arrow')}</a>`).join('\n') : '<p>New hubs will appear here as they are configured.</p>'}</div></section>`;
  }
  if (type === 'submit') {
    return `<section class="story-tip-band"><div class="shell story-tip-inner"><div><p class="eyebrow">Invite participation</p><h2>Give readers a clear path to share a tip, document, or correction.</h2><p>The starter uses email by default so no unprotected form or server is required.</p></div><a class="button button-light" href="${escapeHtml(site.submit_story_url || '/submit/')}">Open submission guidance ${icon('arrow')}</a></div></section>`;
  }
  return '';
}

const homeBody = (site.homepage?.modules || []).map(renderHomeModule).join('\n');


writeRoute('/', layout({
  route: '/',
  title: site.title,
  description: site.description,
  canonical: absoluteUrl('/'),
  pageClass: 'home-page',
  body: homeBody
}));

if (readerReach.enabled && readerReach.savedArticlesEnabled) {
  const savedBody = `<section class="page-hero page-hero-saved"><div class="shell page-hero-grid"><div><p class="eyebrow">Private reading list</p><h1>Saved stories on this device.</h1><p class="lede">Save story links for later without creating an account. The list stays in this browser and is never sent to the publisher.</p></div><span class="hero-illustration" aria-hidden="true">${icon('bookmark')}</span></div></section>
  <section class="section shell saved-library" data-saved-library><div class="section-heading"><div><p class="eyebrow">Local browser storage</p><h2 data-saved-library-count>0 saved stories</h2></div><button class="button button-quiet js-only" type="button" data-clear-saved>Clear saved stories</button></div><noscript><div class="empty-state"><h2>JavaScript is required for the saved-story list.</h2><p>All publication pages remain readable without JavaScript. Use your browser bookmarks as an alternative.</p></div></noscript><div class="saved-story-list" data-saved-list></div><div class="empty-state" data-saved-empty><span class="empty-state-icon">${icon('bookmark')}</span><h2>No stories are saved yet.</h2><p>Open any article and choose <strong>Save story</strong>. The list will appear here on this device.</p><a class="button" href="/stories/">Browse stories ${icon('arrow')}</a></div><p class="reader-reach-status" data-reach-status role="status" aria-live="polite" aria-atomic="true"></p></section>`;
  writeRoute('/saved/', layout({ route: '/saved/', title: 'Saved Stories', description: `A private browser-local reading list for ${site.title}.`, canonical: absoluteUrl('/saved/'), noindex: true, pageClass: 'saved-page', body: savedBody }), { sitemap: false });
}

if (readerReach.enabled && readerReach.currentEditionEnabled) {
  const editionItems = published.slice(0, readerReach.currentEditionCount);
  const editionDate = editionItems[0]?.published_at ? formatDate(editionItems[0].published_at, site.locale, site.timezone) : 'Current edition';
  const editionBody = `<section class="edition shell"><header class="edition-masthead"><p class="edition-folio">${escapeHtml(site.masthead_kicker || site.tagline)}</p><h1>${escapeHtml(site.title)}</h1><p>${escapeHtml(editionDate)} · Current edition</p><div class="edition-actions"><button class="button js-only" type="button" data-print-edition>${icon('print')} Print edition</button><a class="button button-secondary" href="/stories/">Open full archive</a></div></header>${editionItems.length ? `<ol class="edition-story-list">${editionItems.map((article, index) => { const author = authorMap.get(article.author); return `<li class="edition-story"><p class="edition-number">${String(index + 1).padStart(2, '0')}</p><div>${renderClassificationBadge(article)}<h2><a href="/stories/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a></h2><p class="edition-deck">${escapeHtml(article.excerpt)}</p><p class="byline">${author ? `By ${escapeHtml(author.name)} · ` : ''}${escapeHtml(formatDate(article.published_at, site.locale, site.timezone))}</p></div></li>`; }).join('')}</ol>` : emptyStories()}<footer class="edition-footer"><p>${escapeHtml(site.editorial_promise || site.description)}</p><p><a href="${escapeHtml(absoluteUrl('/edition/'))}">${escapeHtml(absoluteUrl('/edition/'))}</a></p></footer></section>`;
  writeRoute('/edition/', layout({ route: '/edition/', title: 'Current Edition', description: `A printable current edition of the latest publishing from ${site.title}.`, canonical: absoluteUrl('/edition/'), pageClass: 'edition-page', body: editionBody }), { lastmod: machineDate(editionItems[0]?.updated_at || editionItems[0]?.published_at || '') });
}

if (readerReach.enabled && readerReach.offlineEnabled) {
  const offlineBody = `<section class="not-found shell offline-fallback"><span class="not-found-mark">${icon('offline')}</span><p class="eyebrow">Offline reading</p><h1>This page is not cached yet.</h1><p class="lede">The latest edition and core publication pages remain available after a successful online visit. Reconnect to open a page that has not been stored on this device.</p><p class="reader-reach-connection"><strong data-connection-status>Offline — cached pages remain available</strong></p><div class="button-row">${readerReach.currentEditionEnabled ? `<a class="button" href="/edition/">Open cached edition ${icon('edition')}</a>` : ''}${readerReach.savedArticlesEnabled ? `<a class="button button-secondary" href="/saved/">Saved stories ${icon('bookmark')}</a>` : ''}<a class="button button-quiet" href="/">Publication home</a></div><p data-offline-status role="status" aria-live="polite"></p></section>`;
  writeRoute('/offline/', layout({ route: '/offline/', title: 'Offline', description: `Offline reading fallback for ${site.title}.`, canonical: absoluteUrl('/offline/'), noindex: true, pageClass: 'offline-page', body: offlineBody }), { sitemap: false });
}

const studioAuthors = authors.filter((author) => author.active !== false).map((author) => ({ slug: author.slug, name: author.name }));
const studioCategories = categories.map((category) => ({ slug: category.slug, name: category.name }));
const studioBody = `<section class="page-hero studio-hero"><div class="shell page-hero-grid"><div><p class="eyebrow">Writer Desk · private by design</p><h1>Write cleanly. Review clearly. Publish without plugin debt.</h1><p class="lede">A focused Markdown newsroom with structured story commands, local revisions, paste cleanup, live preview, and publication checks. Draft text stays in this browser.</p></div><span class="hero-illustration" aria-hidden="true">${icon('edit')}</span></div></section>
<section class="section shell writer-desk-overview" aria-labelledby="writer-desk-overview-heading">
  <div class="writer-desk-overview-copy"><p class="eyebrow">Writer Desk v2.3</p><h2 id="writer-desk-overview-heading">Publish faster without lowering editorial standards.</h2><p>TAHAI Press keeps the durable part of publishing—plain Markdown and ordinary files—while removing the plugin stack, database maintenance, and formatting cleanup that slow small newsrooms down.</p><div class="button-row"><a class="button" href="#writer-editor">Open the Writer Desk ${icon('arrow')}</a><a class="button button-secondary" href="/publisher/">Publishing Console</a></div></div>
  <div class="writer-desk-feature-grid" aria-label="Writer Desk capabilities"><article><span aria-hidden="true">${icon('edit')}</span><div><p class="eyebrow">Draft assistant</p><h3>Headline and summary</h3><p>Clear required fields, reading-time feedback, and useful editorial checks stay close to the story.</p></div></article><article><span aria-hidden="true">${icon('document')}</span><div><p class="eyebrow">Structured reporting</p><h3>Commands, sources, and story blocks</h3><p>Use the toolbar, slash commands, or the keyboard palette without exposing readers to proprietary editor markup.</p></div></article><article><span aria-hidden="true">${icon('image')}</span><div><p class="eyebrow">Media and access</p><h3>Rights and accessibility before export</h3><p>Image descriptions, source context, and publication blockers are reviewed before the contributor package leaves the browser.</p></div></article></div>
</section>
<section class="section shell editorial-studio" id="writer-editor" data-editorial-studio>
  <noscript><div class="empty-state"><h2>JavaScript is required for the enhanced Writer Desk.</h2><p>The article textarea remains visible and usable, and all finished publication pages remain readable without JavaScript. Pages CMS and ordinary article JSON files remain supported fallbacks.</p></div></noscript>
  <div class="studio-layout">
    <form class="studio-form" data-studio-form novalidate>
      <div class="studio-form-heading"><div><p class="eyebrow">Contributor Composer</p><h2>Writer Desk</h2></div><p class="studio-privacy-note">Saved only in this browser.</p></div>
      <section class="studio-draft-desk" aria-labelledby="studio-draft-desk-heading"><div><p class="eyebrow">Local draft desk</p><h3 id="studio-draft-desk-heading">Open, save, revise, or hand off a story</h3><p>Keep named drafts and automatic revision snapshots in this browser, or open an article JSON file sent by another contributor. Nothing is uploaded.</p></div><div class="studio-draft-controls"><label for="studio-draft-library">Saved local drafts<select id="studio-draft-library" data-studio-draft-library><option value="">No saved drafts</option></select></label><div class="button-row"><button class="button button-secondary" type="button" data-studio-save-draft>Save local copy</button><button class="button button-quiet" type="button" data-studio-open-draft>Open selected</button><button class="button button-quiet" type="button" data-studio-delete-draft>Delete selected</button></div><details class="writer-revision-desk"><summary>Automatic revisions</summary><div class="writer-revision-controls"><label for="writer-revision-library">Revision history<select id="writer-revision-library" data-writer-revision-library><option value="">No revisions yet</option></select></label><div class="button-row"><button class="button button-quiet" type="button" data-writer-restore-revision>Restore revision</button><button class="button button-quiet" type="button" data-writer-delete-revision>Delete revision</button></div></div></details><label class="studio-import-label" for="studio-import-file">Open article JSON<input id="studio-import-file" data-studio-import type="file" accept=".json,application/json"></label></div></section>
      <label for="studio-title"><span class="studio-label-text">Headline <span aria-hidden="true">*</span><span class="visually-hidden">(required)</span></span><input id="studio-title" name="title" maxlength="180" required autocomplete="off"></label>
      <div class="studio-grid studio-grid-three"><label for="studio-author"><span class="studio-label-text">Author <span aria-hidden="true">*</span><span class="visually-hidden">(required)</span></span><select id="studio-author" name="author" required>${studioAuthors.map((author) => `<option value="${escapeHtml(author.slug)}">${escapeHtml(author.name)}</option>`).join('')}</select></label><label for="studio-category"><span class="studio-label-text">Category <span aria-hidden="true">*</span><span class="visually-hidden">(required)</span></span><select id="studio-category" name="category" required>${studioCategories.map((category) => `<option value="${escapeHtml(category.slug)}">${escapeHtml(category.name)}</option>`).join('')}</select></label><label for="studio-classification"><span class="studio-label-text">Classification <span aria-hidden="true">*</span><span class="visually-hidden">(required)</span></span><select id="studio-classification" name="classification" required>${ARTICLE_CLASSIFICATION_KEYS.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(classificationInfo(key).label)}</option>`).join('')}</select></label></div>
      <label for="studio-summary"><span class="studio-label-text">Plain-language summary <span aria-hidden="true">*</span><span class="visually-hidden">(required)</span></span><textarea id="studio-summary" name="excerpt" rows="3" minlength="20" maxlength="360" required></textarea><small><span data-summary-count>0</span>/360 characters</small></label>
      <div class="writer-editor-shell" data-writer-editor>
        <div class="writer-toolbar" role="toolbar" aria-label="Article formatting and story commands"><div class="writer-toolbar-group"><button type="button" data-writer-command="h2" title="Section heading">H2</button><button type="button" data-writer-command="bold" title="Bold"><strong>B</strong></button><button type="button" data-writer-command="italic" title="Italic"><em>I</em></button><button type="button" data-writer-command="link" title="Link">Link</button><button type="button" data-writer-command="quote" title="Block quote">Quote</button><button type="button" data-writer-command="bullets" title="Bulleted list">List</button><button type="button" data-writer-command="source" title="Source link">Source</button></div><div class="writer-toolbar-group writer-toolbar-actions"><button type="button" data-writer-open-palette aria-haspopup="dialog">Commands <kbd>Ctrl K</kbd></button><button type="button" data-writer-focus-mode aria-pressed="false">Focus</button></div></div>
        <label class="writer-body-label" for="studio-body"><span class="studio-label-text">Article text <span aria-hidden="true">*</span><span class="visually-hidden">(required)</span></span><textarea id="studio-body" name="body" rows="20" required data-writer-body spellcheck="true" placeholder="Start with the most important information. Type / on a new line for story commands, or press Ctrl+K for the command palette."></textarea><small>Clean Markdown is preserved. Estimated reading time: <strong data-reading-time>0 minutes</strong>. <span data-structure-count>0 structured blocks</span>.</small></label>
        <div class="writer-slash-menu" data-writer-slash-menu hidden><p class="eyebrow">Insert a command</p><ul role="listbox" aria-label="Matching writing commands" data-writer-slash-results></ul></div>
      </div>
      <fieldset class="studio-image-fields"><legend>Featured image <span>optional</span></legend><p class="studio-field-help"><a class="text-link" href="/media-desk/" target="_blank" rel="noopener noreferrer">Prepare and compress an image in Media Desk${newTabNote()}</a></p><label for="studio-image">Repository image path<input id="studio-image" name="featured_image" placeholder="/uploads/images/story-photo.jpg"></label><label for="studio-image-alt">Image description<textarea id="studio-image-alt" name="featured_image_alt" rows="2" maxlength="240"></textarea></label><div class="studio-grid"><label for="studio-image-caption">Caption<input id="studio-image-caption" name="featured_image_caption" maxlength="300"></label><label for="studio-image-credit">Credit<input id="studio-image-credit" name="featured_image_credit" maxlength="160"></label></div></fieldset>
      <details class="studio-advanced"><summary>Optional publishing details</summary><div class="studio-grid"><label for="studio-kicker">Eyebrow<input id="studio-kicker" name="kicker" maxlength="100" placeholder="Analysis"></label><label for="studio-publish-date">Publish date and time<input id="studio-publish-date" name="published_at" type="datetime-local"></label></div><label for="studio-tags">Topic tags<input id="studio-tags" name="tags" placeholder="housing, city council, public records"><small>Separate tags with commas.</small></label></details>
      <div class="studio-check-panel" aria-labelledby="studio-check-heading"><div><p class="eyebrow">Before export</p><h3 id="studio-check-heading">Accessibility and publishing checks</h3><p>Publication blockers must be resolved before export. Needs-attention items are editorial guidance that should be reviewed.</p></div><div class="studio-check-legend" aria-label="Review status legend"><span class="check-ready">Ready</span><span class="check-attention">Needs attention</span><span class="check-blocker">Publication blocker</span></div><ul data-studio-checks aria-live="polite" aria-atomic="true"></ul></div>
      <div class="studio-actions"><button class="button" type="button" data-studio-download>Download contributor package</button><button class="button button-secondary" type="button" data-studio-copy>Copy JSON</button><button class="button button-quiet" type="button" data-studio-sample>Load sample</button><button class="button button-quiet" type="reset" data-studio-reset>Reset</button></div>
      <p class="studio-status" data-studio-status role="status" aria-live="polite"></p>
    </form>
    <aside class="studio-preview-panel" aria-labelledby="studio-preview-heading"><div class="studio-preview-toolbar"><div><p class="eyebrow">Live newspaper preview</p><h2 id="studio-preview-heading">Reader view</h2></div><span data-preview-status>Draft</span></div><article class="studio-preview"><p class="eyebrow" data-preview-kicker>Quick Story</p><h2 data-preview-headline>Untitled story</h2><p class="article-deck" data-preview-summary>Add a clear summary to preview the deck.</p><p class="studio-preview-byline" data-preview-byline></p><figure data-preview-figure hidden><img data-preview-image src="" alt=""><figcaption data-preview-caption></figcaption></figure><div class="prose" data-preview-body><p>Start writing to preview the story.</p></div><div class="writer-preview-blocks" data-preview-blocks></div></article><div class="studio-handoff"><h3>How to publish</h3><ol><li>Download the contributor package or save a local draft.</li><li>Add it to <code>content/inbox/</code> for review or <code>content/articles/</code> through the trusted editor workflow.</li><li>Review sources, rights, and accessibility.</li><li>Promote the validated draft and change its status when publication is approved.</li></ol></div></aside>
  </div>
  <dialog class="writer-command-palette" data-writer-palette aria-labelledby="writer-command-heading"><div class="writer-command-dialog"><header><div><p class="eyebrow">Writer commands</p><h2 id="writer-command-heading">Insert clean Markdown or a structured story block</h2></div><button type="button" class="writer-command-close" data-writer-close-palette aria-label="Close command palette">×</button></header><label for="writer-command-search">Find a command<input id="writer-command-search" data-writer-command-search type="search" autocomplete="off" placeholder="Try source, timeline, quote, image…"></label><div class="writer-command-results" data-writer-command-results role="listbox" aria-label="Writer commands"></div><p class="fine-print">Keyboard: <kbd>Ctrl K</kbd> opens this palette. Type <kbd>/</kbd> at the start of a new line for matching slash commands.</p></div></dialog>
</section>`;

writeRoute('/studio/', layout({
  route: '/studio/',
  title: 'Editorial Studio',
  description: 'A private, browser-only quick story composer for TAHAI Press article files.',
  canonical: absoluteUrl('/studio/'),
  noindex: true,
  pageClass: 'editorial-studio-page',
  scripts: ['/assets/writer-desk.js'],
  body: studioBody
}), { sitemap: false });

const mediaDeskBody = `<section class="page-hero media-desk-hero"><div class="shell page-hero-grid"><div><p class="eyebrow">Media Desk · browser-only</p><h1>Crop, compress, describe, and export publication-ready images.</h1><p class="lede">Prepare JPEG, PNG, or WebP source files entirely in this browser. The image and its editorial metadata never leave this device.</p></div><span class="hero-illustration" aria-hidden="true">${icon('image')}</span></div></section>
<section class="section shell media-desk" data-media-desk>
  <noscript><div class="empty-state"><h2>JavaScript is required for image preparation.</h2><p>The publication remains readable without JavaScript. Use a trusted desktop image editor and record the image description, credit, and rights information manually when scripting is unavailable.</p></div></noscript>
  <section class="media-intake" aria-labelledby="media-intake-heading">
    <div><p class="eyebrow">Local image intake</p><h2 id="media-intake-heading">Choose one source image</h2><p>Accepted formats: JPEG, PNG, and WebP. Files are decoded locally, are never uploaded, and are cleared when this page closes.</p></div>
    <label class="media-drop-zone" data-media-drop for="media-file"><span>${icon('image')}</span><strong>Drop an image here or choose a file</strong><small>Maximum 30 MB · maximum 16,384 pixels on either edge</small><input id="media-file" data-media-file type="file" accept="image/jpeg,image/png,image/webp"></label>
  </section>
  <section class="media-workspace" data-media-workspace hidden aria-labelledby="media-workspace-heading">
    <header class="media-workspace-heading"><div><p class="eyebrow">Source image</p><h2 id="media-workspace-heading" data-source-name>Selected image</h2><p data-source-details></p></div><div class="media-workspace-actions"><button class="button button-quiet" type="button" data-undo-media disabled>Undo last change</button><button class="button button-quiet" type="button" data-reset-media>Choose another image</button></div></header>
    <div class="media-desk-layout">
      <div class="media-preview-column">
        <div class="media-preview-frame"><canvas data-media-preview role="img" tabindex="0" aria-label="Image crop preview. Use the focal controls or arrow keys to reposition the crop."></canvas></div>
        <p class="media-preview-help">Click the preview to place the focal point. With the preview focused, use the arrow keys for fine adjustments and hold Shift for larger steps. Zoom and rotation controls stay keyboard-friendly, and the desk falls back safely if your browser cannot encode the selected format.</p>
        <div class="media-focal-controls">
          <fieldset><legend>Quick focal point</legend><div class="media-focal-buttons"><button type="button" data-focal-point="top" aria-pressed="false">Top</button><button type="button" data-focal-point="left" aria-pressed="false">Left</button><button type="button" data-focal-point="center" aria-pressed="true">Center</button><button type="button" data-focal-point="right" aria-pressed="false">Right</button><button type="button" data-focal-point="bottom" aria-pressed="false">Bottom</button></div></fieldset>
          <div class="media-slider-grid"><label for="media-focal-x">Horizontal focus<input id="media-focal-x" data-focal-x type="range" min="0" max="100" value="50"><small>Left to right</small></label><label for="media-focal-y">Vertical focus<input id="media-focal-y" data-focal-y type="range" min="0" max="100" value="50"><small>Top to bottom</small></label></div>
          <div class="media-slider-grid"><label for="media-zoom">Zoom<input id="media-zoom" data-media-zoom type="range" min="100" max="400" value="100"><small>100% keeps the whole frame; higher values crop tighter.</small></label><label for="media-rotation">Rotation<input id="media-rotation" data-media-rotation type="range" min="-180" max="180" value="0"><small>Rotate the crop before export.</small></label></div>
        </div>
      </div>
      <form class="media-controls" novalidate>
        <section aria-labelledby="media-output-heading"><div class="media-section-heading"><div><p class="eyebrow">1 · Output</p><h3 id="media-output-heading">Choose a publishing preset</h3></div><strong data-output-dimensions>—</strong></div>
          <label for="media-preset">Crop and dimensions<select id="media-preset" data-media-preset><option value="original">Free crop · 2400 px maximum</option><option value="feature" selected>Feature image · 1600 × 900</option><option value="article">Article landscape · 1440 × 960</option><option value="social">Social card · 1200 × 630</option><option value="square">Square card · 1080 × 1080</option><option value="portrait">Portrait card · 1080 × 1350</option></select></label>
          <fieldset><legend>Export format</legend><div class="segmented-controls media-format-controls"><label for="media-format-webp"><input id="media-format-webp" type="radio" name="media-format" value="image/webp" checked> WebP</label><label for="media-format-jpeg"><input id="media-format-jpeg" type="radio" name="media-format" value="image/jpeg"> JPEG</label><label for="media-format-png"><input id="media-format-png" type="radio" name="media-format" value="image/png"> PNG</label><label for="media-format-avif"><input id="media-format-avif" type="radio" name="media-format" value="image/avif"> AVIF</label></div></fieldset>
          <label for="media-quality">Compression quality <output for="media-quality" data-media-quality-output>82%</output><input id="media-quality" data-media-quality type="range" min="40" max="95" value="82"><small>WebP and JPEG use the quality slider. PNG stays lossless. AVIF is available when the browser can encode it.</small></label>
          <p class="media-estimate" data-output-estimate>Estimated export appears after the image loads.</p>
        </section>
        <section aria-labelledby="media-metadata-heading"><div class="media-section-heading"><div><p class="eyebrow">2 · Accessibility and rights</p><h3 id="media-metadata-heading">Keep the image context with the file</h3></div></div>
          <label class="media-toggle-row" for="media-decorative"><input id="media-decorative" data-media-decorative type="checkbox"><span>Decorative image</span></label>
          <label for="media-alt"><span>Image description <span aria-hidden="true">*</span><span class="visually-hidden">(required unless decorative)</span></span><textarea id="media-alt" data-media-alt rows="3" maxlength="240" required placeholder="Describe the meaningful people, place, action, text, or visual evidence shown."></textarea><small>Do not begin with “image of.” Describe what a reader needs to understand.</small></label>
          <label for="media-caption">Caption<textarea id="media-caption" data-media-caption rows="2" maxlength="300" placeholder="Explain why this image matters in the story."></textarea></label>
          <div class="media-field-grid"><label for="media-credit">Creator or source<input id="media-credit" data-media-credit maxlength="160" placeholder="Photographer, agency, archive, or contributor"></label><label for="media-rights">Rights or reuse note<input id="media-rights" data-media-rights maxlength="240" placeholder="Owned, licensed, public domain, permission, or other basis"></label></div>
        </section>
        <section aria-labelledby="media-handoff-heading"><div class="media-section-heading"><div><p class="eyebrow">3 · Handoff</p><h3 id="media-handoff-heading">Name the repository file</h3></div></div>
          <label for="media-output-name">Filename base<input id="media-output-name" data-output-name maxlength="80" autocomplete="off"></label>
          <label for="media-repository-path">TAHAI Press image path<input id="media-repository-path" data-repository-path readonly></label>
          <p class="fine-print">After download, place the optimized image in <code>public/uploads/images/</code>. The manifest and copied fields preserve the description, caption, credit, rights note, decorative state, aspect, focal point, zoom, and rotation.</p>
        </section>
        <section class="media-readiness" aria-labelledby="media-readiness-heading"><div><p class="eyebrow">Export readiness</p><h3 id="media-readiness-heading">Review before download</h3></div><ul data-media-checks aria-live="polite" aria-atomic="true"></ul></section>
        <div class="media-actions"><button class="button" type="button" data-download-image disabled>Download optimized image</button><button class="button button-secondary" type="button" data-download-manifest disabled>Download media manifest</button><button class="button button-quiet" type="button" data-copy-media-fields disabled>Copy article fields</button></div>
      </form>
    </div>
  </section>
  <p class="media-status" data-media-status role="status" aria-live="polite" aria-atomic="true">Choose an image to begin. Nothing is uploaded.</p>
  ${renderMediaLibrary(mediaReport)}
</section>`;
writeRoute('/media-desk/', layout({
  route: '/media-desk/',
  title: 'Media Desk',
  description: 'A private browser-only image crop, compression, accessibility metadata, and publishing export desk.',
  canonical: absoluteUrl('/media-desk/'),
  noindex: true,
  pageClass: 'media-desk-page',
  scripts: ['/assets/media-desk.js'],
  body: mediaDeskBody
}), { sitemap: false });

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function scrubConsoleArticle(article = {}) {
  const clone = cloneJson(article);
  delete clone.__file;
  delete clone.editor_notes;
  delete clone.private_editor_notes;
  return clone;
}

function scrubConsoleRecord(record = {}) {
  const clone = cloneJson(record);
  delete clone.__file;
  return clone;
}

function sanitizeConsoleSiteForPublicMode(value = {}) {
  const clone = cloneJson(value);
  delete clone.logo;
  delete clone.default_social_image;
  delete clone.default_social_image_alt;
  delete clone.masthead_kicker;
  if (clone.seo && typeof clone.seo === 'object') {
    delete clone.seo.social_profiles;
    delete clone.seo.feed_title;
    delete clone.seo.feed_description;
  }
  return clone;
}

const consoleArticle = scrubConsoleArticle(articles.find((article) => article.status === 'draft') || articles[0] || {});
const consoleSite = templateMode(site) ? cloneJson(site) : sanitizeConsoleSiteForPublicMode(site);
const consoleSource = {
  site: consoleSite,
  article: consoleArticle,
  articles: articles.map((article) => scrubConsoleArticle(article)),
  authors: authors.map((author) => scrubConsoleRecord(author)),
  categories: categories.map((category) => scrubConsoleRecord(category)),
  hubs: hubs.map((hub) => scrubConsoleRecord(hub)),
  navigation: cloneJson(site.navigation),
  homepage: cloneJson(site.homepage),
  footer: cloneJson(site.footer),
  publication_settings: cloneJson(site.publication_settings),
  workflow: 'draft',
  workflow_states: WORKFLOW_STATES,
  workflow_transitions: Object.fromEntries(WORKFLOW_STATES.map((state) => [state, workflowTransitions(state)]))
};
const publishingConsoleData = {
  schema_version: 1,
  source_hash: sha256(stableStringify(consoleSource)),
  ...consoleSource,
  content_counts: {
    articles: articles.length,
    authors: authors.length,
    categories: categories.length,
    hubs: hubs.length
  }
};
const publisherStudioBody = `<section class="page-hero publisher-console-hero"><div class="shell page-hero-grid"><div><p class="eyebrow">${templateMode(site) ? 'TAHAI Publishing Console' : 'Publishing Console'}</p><h1>Schema-safe Git editing for the newsroom model.</h1><p class="lede">One browser workspace handles articles, authors, categories, hubs, navigation, homepage modules, footer columns, and publication settings with workflow states, preview diffs, and stale-revision checks.</p></div><span class="hero-illustration" aria-hidden="true">${icon('source')}</span></div></section>
<section class="section shell publisher-console-shell" data-publishing-console>
  <div class="publisher-console-toolbar">
    <div>
      <p class="eyebrow">Versioned publication model</p>
      <h2>Draft, review, schedule, publish, correct, archive.</h2>
      <p>The console stays browser-local until you export a release bundle or copy the generated files into <code>content/inbox/</code> for review.</p>
    </div>
    <div class="button-row">
      <label class="button button-secondary publisher-console-import" for="publisher-console-import">Import bundle<input id="publisher-console-import" type="file" accept=".json,application/json" data-console-import hidden></label>
      <button class="button" type="button" data-console-export>Download bundle</button>
      <button class="button button-secondary" type="button" data-console-copy>Copy JSON</button>
      <button class="button button-quiet" type="button" data-console-reset>Reset</button>
    </div>
  </div>
  <div class="publisher-console-tabs" role="tablist" aria-label="Publishing console sections">
    <button type="button" role="tab" aria-selected="true" data-console-tab="site">Site</button>
    <button type="button" role="tab" aria-selected="false" data-console-tab="article">Article</button>
    <button type="button" role="tab" aria-selected="false" data-console-tab="collections">Collections</button>
    <button type="button" role="tab" aria-selected="false" data-console-tab="workflow">Workflow</button>
    <button type="button" role="tab" aria-selected="false" data-console-tab="preview">Preview</button>
  </div>
  <div class="publisher-console-layout">
    <section class="publisher-console-editor" data-console-editor></section>
    <aside class="publisher-console-aside">
      <section class="publisher-console-card" data-console-preview aria-labelledby="publisher-console-preview-heading"><div class="publisher-console-card-heading"><p class="eyebrow">Preview</p><h3 id="publisher-console-preview-heading">Live release preview</h3></div><div data-console-preview-body><p>Choose a tab to inspect the generated output.</p></div></section>
      <section class="publisher-console-card" data-console-validation aria-labelledby="publisher-console-validation-heading"><div class="publisher-console-card-heading"><p class="eyebrow">Validation</p><h3 id="publisher-console-validation-heading">Schema and workflow checks</h3></div><div data-console-validation-body><p>Waiting for the console to load.</p></div></section>
      <section class="publisher-console-card" data-console-diff aria-labelledby="publisher-console-diff-heading"><div class="publisher-console-card-heading"><p class="eyebrow">Diff</p><h3 id="publisher-console-diff-heading">Release handoff</h3></div><div data-console-diff-body><p>Preview the release bundle before committing.</p></div></section>
    </aside>
  </div>
  <p class="fine-print">The console is role-ready, but it does not require a user account in the static core. Conflict detection refuses stale bundles before a handoff is exported.</p>
</section>
<script id="publishing-console-data" type="application/json">${jsonForHtml(publishingConsoleData)}</script>`;

writeRoute('/publisher/', layout({
  route: '/publisher/',
  title: 'Publishing Console',
  description: 'The schema-safe TAHAI Press newsroom editor for articles, site structure, navigation, homepage modules, footer links, and workflow review.',
  canonical: absoluteUrl('/publisher/'),
  noindex: true,
  pageClass: 'publisher-console-page',
  scripts: ['/assets/publishing-console.js'],
  body: publisherStudioBody
}), { sitemap: false });

writeRoute('/admin/', cmsLayout(), { sitemap: false });

const readiness = launchReadiness({ site, articles, authors, hubs });
const presetMap = Object.fromEntries(themePresetList().map((preset) => [preset.id, preset]));
if (templateMode(site)) {
const setupSampleArticle = { ...(articles.find((article) => article.slug === 'sample-written-story') || {}) };
delete setupSampleArticle.__file;
delete setupSampleArticle.editor_notes;
const setupBody = `<section class="page-hero setup-hero"><div class="shell narrow"><p class="eyebrow">TAHAI Press Launch Desk</p><h1>From first deploy to a publishable newsroom in under ten minutes.</h1><p class="lede">One clear decision at a time. Progress stays on this device, every change can be previewed, and nothing is sent to a server.</p></div></section>
<section class="section shell launch-desk" data-launch-desk>
  <noscript><p class="setup-noscript"><strong>Launch Desk requires JavaScript.</strong> The publication remains readable without it. Use Pages CMS or edit <code>content/site.json</code> when scripting is unavailable.</p></noscript>
  <header class="launch-desk-header">
    <div><p class="eyebrow">Start here</p><h2 data-current-step-title tabindex="-1">Step 1</h2><p data-progress-text>0 of 13 launch steps complete</p></div>
    <progress data-progress-bar max="13" value="0">0 of 13</progress>
    <div class="launch-desk-utilities" aria-label="Setup utilities"><button class="button button-quiet" type="button" data-undo-change disabled>Undo last change</button><button class="button button-quiet" type="button" data-download-backup>Download backup</button><button class="button button-quiet" type="button" data-reset-launch>Reset</button></div>
  </header>
  <div class="launch-desk-layout">
    <nav class="launch-step-nav" aria-label="Launch steps"><ol data-step-list>
      <li><button type="button" data-step-jump="1"><span>1</span><strong>Start here</strong><small>The whole path</small></button></li>
      <li><button type="button" data-step-jump="2"><span>2</span><strong>Name it</strong><small>Identity and contact</small></button></li>
      <li><button type="button" data-step-jump="3"><span>3</span><strong>Choose the look</strong><small>Accessible defaults</small></button></li>
      <li><button type="button" data-step-jump="4"><span>4</span><strong>Shape the front page</strong><small>Sections and menu</small></button></li>
      <li><button type="button" data-step-jump="5"><span>5</span><strong>Connect the editor</strong><small>GitHub and Cloudflare</small></button></li>
      <li><button type="button" data-step-jump="6"><span>6</span><strong>Write the first story</strong><small>Replace the example</small></button></li>
      <li><button type="button" data-step-jump="7"><span>7</span><strong>Review and launch</strong><small>Backup and apply</small></button></li>
      <li><button type="button" data-step-jump="8"><span>8</span><strong>Mission and structure</strong><small>Purpose and beats</small></button></li>
      <li><button type="button" data-step-jump="9"><span>9</span><strong>Trust policies</strong><small>Standards and corrections</small></button></li>
      <li><button type="button" data-step-jump="10"><span>10</span><strong>Existing content</strong><small>Import safely</small></button></li>
      <li><button type="button" data-step-jump="11"><span>11</span><strong>First public record</strong><small>Evidence-led publishing</small></button></li>
      <li><button type="button" data-step-jump="12"><span>12</span><strong>Ownership and recovery</strong><small>Backups and transfer</small></button></li>
      <li><button type="button" data-step-jump="13"><span>13</span><strong>Final readiness</strong><small>Deploy when ready</small></button></li>
    </ol></nav>
    <form class="launch-step-workspace" novalidate>
      <section class="launch-step" data-launch-step="1" data-step-title="Start here" aria-labelledby="launch-step-1-title">
        <p class="eyebrow">Step 1 of 13 · about one minute</p><h2 id="launch-step-1-title" tabindex="-1">You will make thirteen small decisions.</h2>
        <p class="launch-step-lede">Launch Desk remembers where you stopped. Safe answers are filled in automatically, advanced controls stay out of the way, and the last change can always be undone.</p>
        <ol class="launch-path"><li><strong>Name the publication.</strong><span>Add the web address and contact email.</span></li><li><strong>Choose a tested look.</strong><span>Every built-in theme meets the project contrast rules.</span></li><li><strong>Keep the front page simple.</strong><span>Use recommended sections, then change only what matters.</span></li><li><strong>Confirm the free publishing path.</strong><span>GitHub stores files, Pages CMS edits them, and Cloudflare publishes them.</span></li><li><strong>Replace one example story.</strong><span>Start from useful sample text instead of a blank page.</span></li><li><strong>Preview and back up.</strong><span>Nothing is applied without a final review.</span></li><li><strong>Remove the demo and launch.</strong><span>Create one package or apply it directly to a local repository.</span></li></ol>
        <aside class="launch-help"><strong>No new accounts are required.</strong><p>TAHAI Press uses the GitHub and Cloudflare accounts already needed for the site. Pages CMS signs in through GitHub and remains free.</p></aside>
        <div class="launch-primary-action"><button class="button" type="button" data-next-step>Begin setup ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="2" data-step-title="Name the publication" aria-labelledby="launch-step-2-title" hidden>
        <p class="eyebrow">Step 2 of 13 · about two minutes</p><h2 id="launch-step-2-title" tabindex="-1">What should readers call this publication?</h2>
        <p class="launch-step-lede">Only the name, web address, and contact email are required. Everything else has a useful default.</p>
        <div class="setup-grid launch-essential-fields"><label for="setup-title">Publication name<input id="setup-title" name="title" required maxlength="100" autocomplete="organization" placeholder="The Community Ledger"><small>The name shown in the masthead and browser title.</small></label><label for="setup-editor-email">Public contact email<input id="setup-editor-email" name="editor_email" type="email" autocomplete="email" placeholder="editor@yourdomain.org"><small>Used for corrections, accessibility feedback, and submissions.</small></label><label class="field-wide" for="setup-site-url">Live web address<input id="setup-site-url" name="site_url" type="url" inputmode="url" placeholder="https://news.example.org"><small>Use the final custom domain or the Cloudflare <code>pages.dev</code> address.</small></label></div>
        <button class="recommended-button" type="button" data-use-recommended>Use recommended wording and remove the demo logo</button>
        <details class="launch-advanced"><summary>Optional wording and images</summary><div class="setup-grid"><label for="setup-tagline">Short tagline<input id="setup-tagline" name="tagline" maxlength="140"></label><label class="field-wide" for="setup-description">Plain-language description<textarea id="setup-description" name="description" rows="3" maxlength="500"></textarea></label><label for="setup-logo">Logo file path<input id="setup-logo" name="logo" placeholder="/uploads/images/logo.png"><small>Leave blank to use publication initials.</small></label><label for="setup-social-image">Social preview image path<input id="setup-social-image" name="default_social_image" placeholder="/uploads/images/social.png"></label></div></details>
        <details class="field-help"><summary>What is a file path?</summary><p>A file path tells the site where an uploaded image lives. Upload an image under <code>public/uploads/images/</code>, then enter a path such as <code>/uploads/images/logo.png</code>.</p></details>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Preview the look ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="3" data-step-title="Choose the look" aria-labelledby="launch-step-3-title" hidden>
        <p class="eyebrow">Step 3 of 13 · about one minute</p><h2 id="launch-step-3-title" tabindex="-1">Choose one accessible newspaper style.</h2>
        <p class="launch-step-lede">Classic Broadsheet is the recommended starting point. All eight presets pass TAHAI Press contrast checks.</p>
        <label class="launch-feature-field" for="setup-theme-preset">Newspaper theme<select id="setup-theme-preset" name="theme_preset">${themePresetList().map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`).join('')}</select></label>
        <button class="recommended-button" type="button" data-use-recommended>Use the recommended accessible appearance</button>
        <details class="launch-advanced"><summary>Optional layout controls</summary><div class="setup-grid"><label for="setup-density">Page spacing<select id="setup-density" name="density"><option value="compact">Compact</option><option value="balanced">Balanced</option><option value="spacious">Spacious</option></select></label><label for="setup-reading-width">Article width<select id="setup-reading-width" name="reading_width"><option value="narrow">Narrow</option><option value="standard">Standard</option><option value="wide">Wide</option></select></label><label for="setup-masthead-alignment">Masthead<select id="setup-masthead-alignment" name="masthead_alignment"><option value="center">Centered</option><option value="left">Left aligned</option></select></label><label for="setup-headline-style">Headlines<select id="setup-headline-style" name="headline_style"><option value="serif">Newspaper serif</option><option value="sans">Modern sans serif</option></select></label><label for="setup-panel-style">Panel corners<select id="setup-panel-style" name="panel_style"><option value="square">Square</option><option value="soft">Soft</option></select></label><label for="setup-reader-surface">Reading surface<select id="setup-reader-surface" name="reader_surface"><option value="paper">Paper</option><option value="light">Light</option><option value="sepia">Sepia</option></select></label></div><fieldset class="setup-reader-reach"><legend>Reader features</legend><div class="setup-toggle-grid"><label class="setup-toggle" for="setup-reader-reach"><input id="setup-reader-reach" name="reader_reach_enabled" type="checkbox"> Enable reader tools</label><label class="setup-toggle" for="setup-offline"><input id="setup-offline" name="offline_enabled" type="checkbox"> Offline reading</label><label class="setup-toggle" for="setup-saved"><input id="setup-saved" name="saved_articles_enabled" type="checkbox"> Saved stories</label><label class="setup-toggle" for="setup-share"><input id="setup-share" name="browser_share_enabled" type="checkbox"> Browser sharing</label><label class="setup-toggle" for="setup-edition"><input id="setup-edition" name="current_edition_enabled" type="checkbox"> Printable edition</label></div></fieldset></details>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Shape the front page ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="4" data-step-title="Shape the front page" aria-labelledby="launch-step-4-title" hidden>
        <p class="eyebrow">Step 4 of 13 · about two minutes</p><h2 id="launch-step-4-title" tabindex="-1">Keep only what helps a reader find the news.</h2>
        <p class="launch-step-lede">The recommended front page uses a lead story, latest stories, coverage sections, reader tools, and a clear contact path. Demo-only sections disappear at launch.</p>
        <button class="recommended-button" type="button" data-use-recommended>Use the recommended front page and menu</button>
        <details class="launch-advanced" open><summary>Front-page sections</summary><p>Turn sections on or off. Use the arrow buttons to change reading order, remove a section, or add a reader-facing module.</p><ol class="module-order-list" data-module-list></ol><div class="button-row"><label for="setup-add-home-module">Add a section<select id="setup-add-home-module" data-add-home-module><option value="lead_story">Lead story</option><option value="secondary_headlines">Secondary headlines</option><option value="latest">Latest stories</option><option value="category_strip">Category strip</option><option value="coverage_hub">Coverage hub</option><option value="public_record_desk">Public-record desk</option><option value="featured_investigation">Featured investigation</option><option value="editors_note">Editor’s note</option><option value="recently_updated">Most recently updated</option><option value="document_spotlight">Document spotlight</option><option value="crossword_promotion">Crossword promotion</option><option value="submission_callout">Submission callout</option><option value="accessibility_notice">Accessibility notice</option><option value="custom_text_panel">Custom text panel</option></select></label><button class="button button-secondary" type="button" data-add-home-module>Add section</button></div></details>
        <details class="launch-advanced"><summary>Edit the menu</summary><label for="setup-navigation">One link per line: <strong>Label | /path/</strong><textarea id="setup-navigation" name="navigation" rows="7" spellcheck="false" aria-describedby="navigation-help"></textarea><small id="navigation-help">The recommended menu already covers the common newsroom pages.</small></label></details>
        <details class="field-help"><summary>Why is reading order different from visual layout?</summary><p>Screen readers and keyboard users follow the document order. Launch Desk preserves that order even when the newspaper design places sections side by side.</p></details>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Connect the editor ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="5" data-step-title="Connect the editor" aria-labelledby="launch-step-5-title" hidden>
        <p class="eyebrow">Step 5 of 13 · about one minute</p><h2 id="launch-step-5-title" tabindex="-1">Confirm the free publishing path.</h2>
        <p class="launch-step-lede">GitHub stores the publication, Pages CMS provides the browser editor, and Cloudflare Pages publishes each approved change.</p>
        <div class="launch-connection-cards"><article><span>1</span><h3>GitHub</h3><p>The repository must be visible to the publisher and connected to Pages CMS.</p><a class="text-link" href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">Open the repository${newTabNote()}</a></article><article><span>2</span><h3>Pages CMS</h3><p>Sign in with GitHub, choose the repository, and confirm that Publication settings and Articles appear.</p><a class="text-link" href="https://pagescms.org" target="_blank" rel="noopener noreferrer">Open Pages CMS${newTabNote()}</a></article><article><span>3</span><h3>Cloudflare Pages</h3><p>Connect the <code>main</code> branch, run <code>npm run build:cloudflare</code>, and publish the <code>dist</code> directory.</p></article></div>
        <div class="launch-confirmations"><label class="setup-toggle" for="launch-editor-ready"><input id="launch-editor-ready" name="editor_ready" type="checkbox"> I can open the repository in Pages CMS.</label><label class="setup-toggle" for="launch-deployment-ready"><input id="launch-deployment-ready" name="deployment_ready" type="checkbox"> Cloudflare Pages is connected to the repository's main branch.</label></div>
        <details class="field-help"><summary>What happens when I publish?</summary><p>Pages CMS commits the edited file to GitHub. Cloudflare sees that commit, runs the tested static build, and replaces the public site. Git keeps the previous version for rollback.</p></details>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Draft the first story ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="6" data-step-title="Write the first story" aria-labelledby="launch-step-6-title" hidden>
        <p class="eyebrow">Step 6 of 13 · about two minutes</p><h2 id="launch-step-6-title" tabindex="-1">Replace the example instead of starting from a blank page.</h2>
        <p class="launch-step-lede">This creates a draft, not an immediate public story. Review sources, image rights, and accessibility in Pages CMS before changing its status to Published.</p>
        <button class="recommended-button" type="button" data-use-recommended>Use a welcoming first-story example</button>
        <div class="setup-grid launch-article-fields"><label class="field-wide" for="launch-article-title">Headline<input id="launch-article-title" name="article_title" maxlength="160" required></label><label class="field-wide" for="launch-article-excerpt">Two-sentence summary<textarea id="launch-article-excerpt" name="article_excerpt" rows="3" maxlength="500" required></textarea></label><label class="field-wide" for="launch-article-body">Article text<textarea id="launch-article-body" name="article_body" rows="10" required></textarea><small>Use <code>##</code> for a section heading. The generated file remains a draft.</small></label><label for="launch-article-author">Author record<input id="launch-article-author" name="article_author" value="editorial-team"></label><label for="launch-article-category">Category record<input id="launch-article-category" name="article_category" value="community-reporting"></label></div>
        <details class="launch-advanced"><summary>Optional lead image</summary><div class="setup-grid"><label for="launch-article-image">Image path<input id="launch-article-image" name="article_image" placeholder="/uploads/images/welcome.jpg"></label><label for="launch-article-image-alt">Image description<textarea id="launch-article-image-alt" name="article_image_alt" rows="2" maxlength="240"></textarea><small>Describe meaningful content. Leave both fields blank when there is no image.</small></label></div></details>
        <div class="launch-article-result"><p><strong>Draft filename:</strong> <code data-first-article-slug>welcome-to-our-publication.json</code></p><p><strong>Status:</strong> <span data-first-article-state>Needs a little more information</span></p></div>
        <details class="field-help"><summary>Alt text is not a caption</summary><p>Alt text conveys the useful visual information to someone who cannot see the image. A caption adds visible context for every reader. Launch Desk never invents alt text and will block a meaningful image that has no description.</p></details>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Review everything ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="7" data-step-title="Review and launch" aria-labelledby="launch-step-7-title" hidden>
        <p class="eyebrow">Step 7 of 13 · early review</p><h2 id="launch-step-7-title" tabindex="-1">Preview the foundation before adding newsroom commitments.</h2>
        <p class="launch-step-lede">The launch package turns off demo mode, removes the sample stories, preserves a backup, and adds the first-story draft. Nothing is published until the repository change is committed.</p>
        <ul class="launch-checklist" data-launch-checklist></ul>
        <div class="launch-license-note"><h3>Your publication does not owe a public platform credit.</h3><p>Keep the Apache 2.0 license and required notices in redistributed source. No TAHAI Press banner, logo, footer credit, backlink, hidden link, or “Powered by” notice is required on the publisher's public pages.</p></div>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Set the mission ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="8" data-step-title="Mission and newsroom structure" aria-labelledby="launch-step-8-title" hidden>
        <p class="eyebrow">Step 8 of 13 · about one minute</p><h2 id="launch-step-8-title" tabindex="-1">State the purpose readers can hold you to.</h2>
        <p class="launch-step-lede">A short mission makes editorial choices easier. It can be refined later, but it should be plain about whom you serve and what reporting you will do.</p>
        <label class="field-wide" for="launch-mission">Publication mission<textarea id="launch-mission" name="mission" rows="4" maxlength="600" placeholder="We report on our community, public decisions, and the records behind them."></textarea></label>
        <label class="setup-toggle" for="launch-mission-ready"><input id="launch-mission-ready" name="mission_ready" type="checkbox"> This mission describes the publication in plain language.</label>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Set editorial commitments ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="9" data-step-title="Editorial trust and policies" aria-labelledby="launch-step-9-title" hidden>
        <p class="eyebrow">Step 9 of 13 · about one minute</p><h2 id="launch-step-9-title" tabindex="-1">Make the trust commitments visible from day one.</h2>
        <p class="launch-step-lede">The publication already supports sources, corrections, updates, methodology, and accessibility feedback. Confirm the editorial team will use them before publishing.</p>
        <div class="launch-confirmations"><label class="setup-toggle" for="launch-standards-ready"><input id="launch-standards-ready" name="standards_ready" type="checkbox"> We will distinguish reporting, analysis, and opinion and correct mistakes visibly.</label><label class="setup-toggle" for="launch-accessibility-ready"><input id="launch-accessibility-ready" name="accessibility_ready" type="checkbox"> We will provide useful image descriptions and HTML summaries for public documents.</label></div>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Plan the import ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="10" data-step-title="Existing-content import" aria-labelledby="launch-step-10-title" hidden>
        <p class="eyebrow">Step 10 of 13 · about one minute</p><h2 id="launch-step-10-title" tabindex="-1">Bring existing work in safely, not all at once.</h2>
        <p class="launch-step-lede">Migration Studio always starts as a dry run. Unsupported material is quarantined with a reason; it is never silently discarded or published.</p>
        <details class="launch-advanced" open><summary>Choose a safe first import</summary><p>Use <code>npm run import:help</code> to see supported WordPress, Markdown, JSON, CSV, and PDF-folder formats. Begin with a copy and review the generated plan before applying it.</p></details>
        <label class="setup-toggle" for="launch-import-ready"><input id="launch-import-ready" name="import_ready" type="checkbox"> I will run an import dry run before changing existing content.</label>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Prepare the first record ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="11" data-step-title="First public record" aria-labelledby="launch-step-11-title" hidden>
        <p class="eyebrow">Step 11 of 13 · about one minute</p><h2 id="launch-step-11-title" tabindex="-1">Publish evidence with context, not just a file.</h2>
        <p class="launch-step-lede">A public record should retain its original file, an accessible HTML summary, source context, and any necessary rights information. The PDF-led article workflow blocks incomplete published summaries.</p>
        <div class="setup-grid"><label class="field-wide" for="launch-record-title">Record title<input id="launch-record-title" name="record_title" maxlength="180" placeholder="Public record: meeting agenda"></label><label class="field-wide" for="launch-record-summary">Plain-language record summary<textarea id="launch-record-summary" name="record_summary" rows="3" maxlength="600" placeholder="Explain what the record is, who published it, and why it matters."></textarea></label></div>
        <label class="setup-toggle" for="launch-record-ready"><input id="launch-record-ready" name="record_ready" type="checkbox"> I will add the original file and an HTML summary before publishing this public-record draft.</label>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Protect publisher ownership ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="12" data-step-title="Ownership, backup, and recovery" aria-labelledby="launch-step-12-title" hidden>
        <p class="eyebrow">Step 12 of 13 · about one minute</p><h2 id="launch-step-12-title" tabindex="-1">Keep the files, the history, and a safe copy.</h2>
        <p class="launch-step-lede">Your articles, media, redirects, and configuration remain ordinary files. This launch flow downloads a pre-launch backup; Git records revisions, and the repository can be transferred without a TAHAI account.</p>
        <label class="setup-toggle" for="launch-ownership-ready"><input id="launch-ownership-ready" name="ownership_ready" type="checkbox"> I downloaded or stored a backup and understand that Git is the revision ledger.</label>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button><button class="button" type="button" data-next-step>Final readiness ${icon('arrow')}</button></div>
      </section>

      <section class="launch-step" data-launch-step="13" data-step-title="Final readiness" aria-labelledby="launch-step-13-title" hidden>
        <p class="eyebrow">Step 13 of 13 · final review</p><h2 id="launch-step-13-title" tabindex="-1">Preview first. Back up. Then remove the demonstration.</h2>
        <p class="launch-step-lede">The launch package turns off demo mode, removes the sample stories, preserves a backup, and adds the first-story draft. Nothing is published until the repository change is committed.</p>
        <ul class="launch-checklist" data-final-launch-checklist></ul>
        <div class="launch-final-actions"><button class="button" type="button" data-download-launch>Remove demo and prepare launch package</button><button class="button button-secondary" type="button" data-apply-local>Apply to a local repository</button><button class="button button-quiet" type="button" data-download-config>Download only site.json</button><button class="button button-quiet" type="button" data-copy-config>Copy settings</button></div>
        <p class="launch-apply-note">The local-repository button is shown only in browsers that support secure folder access. The download works everywhere.</p>
        <div class="launch-step-actions"><button class="button button-secondary" type="button" data-back-step>Back</button></div>
      </section>
    </form>

    <aside class="launch-preview-panel" aria-labelledby="launch-preview-heading">
      <div class="launch-preview-heading"><p class="eyebrow">Preview before applying</p><h2 id="launch-preview-heading">Your first edition</h2><p>Updates as you make choices.</p></div>
      <div class="launch-publication-preview" data-publication-preview data-density="balanced" data-headline="serif">
        <header><p data-preview-nav>Stories · Search · About</p><h3 data-preview-title>Your Publication</h3><span data-preview-tagline>Independent reporting, clearly presented.</span></header>
        <article><p class="eyebrow">From the editor</p><h4 data-preview-headline>Welcome to our publication</h4><p data-preview-excerpt>Replace this example summary with two or three sentences explaining the first story.</p><span>Draft preview</span></article>
      </div>
      <details class="launch-generated-config"><summary>View generated site.json</summary><pre tabindex="0" data-config-output></pre></details>
      <p class="setup-status" data-launch-status role="status" aria-live="polite" aria-atomic="true">Launch Desk is ready.</p>
    </aside>
  </div>
</section>
<script id="setup-initial-config" type="application/json">${jsonForHtml(site)}</script>
<script id="setup-theme-presets" type="application/json">${jsonForHtml(presetMap)}</script>
<script id="setup-sample-article" type="application/json">${jsonForHtml(setupSampleArticle)}</script>`;
writeRoute('/setup/', layout({ route: '/setup/', title: 'Launch Desk', description: 'A thirteen-step first-day newsroom guide for configuring and launching TAHAI Press.', canonical: absoluteUrl('/setup/'), noindex: true, pageClass: 'setup-page launch-desk-page', scripts: ['/assets/setup-wizard.js'], body: setupBody }), { sitemap: false });
}

writePaginatedArchive({
  base: '/stories/',
  title: 'Stories, context, and source documents.',
  description: 'Every published content record becomes a permanent, readable page with its original supporting file when one is provided.',
  eyebrow: 'Publication archive',
  items: published,
  pageClass: 'archive-page'
});


const topics = uniqueTopics(published);
const searchIndex = createSearchIndex({ articles: published, authors, categories, hubs });
fs.writeFileSync(path.join(DIST, 'search-index.json'), `${JSON.stringify({ schema_version: 1, generated_from: 'published-content', count: searchIndex.length, entries: searchIndex }, null, 2)}\n`, 'utf8');
const searchSynonymsPath = path.join(ROOT, 'content', 'search-synonyms.json');
const searchSynonyms = fs.existsSync(searchSynonymsPath) ? readJson(searchSynonymsPath) : { schema_version: 1, groups: [] };
fs.writeFileSync(path.join(DIST, 'search-synonyms.json'), `${JSON.stringify(searchSynonyms, null, 2)}\n`, 'utf8');

const knowledgeGroups = Array.isArray(searchSynonyms.groups) ? searchSynonyms.groups : [];
const knowledgeBody = `<section class="page-hero page-hero-search"><div class="shell page-hero-grid"><div><p class="eyebrow">Knowledge Desk</p><h1>Search language, labels, and coverage structure.</h1><p class="lede">This desk explains the publication’s search groups and offers fast links back to search. It stays static and browser-only.</p></div><span class="hero-illustration" aria-hidden="true">${icon('source')}</span></div></section>
<section class="section shell discovery-grid">${knowledgeGroups.length ? knowledgeGroups.map((group) => `<article class="discovery-card"><span class="eyebrow">Search synonym group</span><h2>${escapeHtml(group.label)}</h2><p>${escapeHtml((group.terms || []).join(', '))}</p><strong>${(group.terms || []).length} terms</strong></article>`).join('\n') : '<p>No search synonym groups are configured.</p>'}</section>
<section class="section shell"><div class="section-heading"><div><p class="eyebrow">Next step</p><h2>Use the search desk</h2></div><a class="section-link" href="/search/">Open search ${icon('arrow')}</a></div><p class="lede">The knowledge desk is a companion index for people who want to understand how the browser search groups the archive.</p></section>`;
writeRoute('/knowledge/', layout({ route: '/knowledge/', title: 'Knowledge Desk', description: `Search language and coverage structure for ${site.title}.`, canonical: absoluteUrl('/knowledge/'), pageClass: 'search-page', body: knowledgeBody }));

const searchBody = `<section class="page-hero page-hero-search"><div class="shell page-hero-grid"><div><p class="eyebrow">Search</p><h1>Find a story, topic, contributor, or source document.</h1><p class="lede">Search runs entirely in the browser against a small static index. No query is sent to a database or third-party search service. See the <a href="/knowledge/">Knowledge Desk</a> for search language and coverage structure.</p></div><span class="hero-illustration" aria-hidden="true">${icon('search')}</span></div></section>
<section class="section shell search-layout" data-publication-search data-index-url="/search-index.json" data-result-limit="${Number(site.discovery?.search_result_limit || 50)}">
  <form class="search-form" role="search" data-search-form>
    <div class="search-field"><label for="publication-search">Search the publication</label><div class="search-input-wrap">${icon('search')}<input id="publication-search" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-describedby="publication-search-help" placeholder="Try a name, place, phrase, or document topic" data-search-input><span class="visually-hidden" id="publication-search-help">Results update as you type. Use the Search button to move focus to the result summary.</span></div></div>
    <div class="search-filter"><label for="publication-search-type">Format</label><select id="publication-search-type" name="type" data-search-type><option value="">All formats</option><option value="standard">Written stories</option><option value="pdf">PDF records</option><option value="mixed">Stories + PDFs</option><option value="external">External documents</option></select></div>
    <div class="search-filter"><label for="publication-search-category">Category</label><select id="publication-search-category" name="category" data-search-category><option value="">All categories</option>${categories.map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</option>`).join('\n')}</select></div>
    <div class="search-actions"><button class="button" type="submit">Search ${icon('arrow')}</button><button class="button button-secondary" type="button" data-search-reset>Reset</button></div>
  </form>
  <p class="search-summary" data-search-summary aria-live="polite" aria-atomic="true">Search suggestions will appear here.</p>
  <p class="search-status" id="publication-search-status" data-search-status role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Enter a search term or choose a format.</p>
  <div class="search-results" data-search-results aria-labelledby="publication-search-status" aria-busy="true"></div>
  <noscript><div class="search-noscript"><h2>JavaScript is required for instant search.</h2><p>You can still browse by <a href="/categories/">category</a>, <a href="/topics/">topic</a>, <a href="/authors/">contributor</a>, <a href="/archive/">date</a>, the <a href="/knowledge/">Knowledge Desk</a>, or the <a href="/stories/">complete story archive</a>.</p></div></noscript>
</section>`;
writeRoute('/search/', layout({ route: '/search/', title: 'Search', description: `Search published stories and documents from ${site.title}.`, canonical: absoluteUrl('/search/'), pageClass: 'search-page', body: searchBody }));

const categoryCards = categories.map((category) => {
  const items = published.filter((article) => (article.categories || []).includes(category.slug));
  return `<a class="discovery-card" href="/categories/${escapeHtml(category.slug)}/"><span class="eyebrow">Category</span><h2>${escapeHtml(category.name)}</h2><p>${escapeHtml(category.description || 'Browse this publication category.')}</p><strong>${items.length} ${items.length === 1 ? 'entry' : 'entries'} ${icon('arrow')}</strong></a>`;
}).join('\n');
writeRoute('/categories/', layout({ route: '/categories/', title: 'Categories', description: `Browse ${site.title} by category.`, canonical: absoluteUrl('/categories/'), pageClass: 'discovery-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Browse by category</p><h1>Stable editorial lanes.</h1><p class="lede">Categories provide broad, intentional groupings for recurring publication work.</p></div></section><section class="section shell discovery-grid">${categoryCards || '<p>No categories are configured.</p>'}</section>` }));
for (const category of categories) {
  const items = published.filter((article) => (article.categories || []).includes(category.slug));
  writePaginatedArchive({ base: `/categories/${category.slug}/`, title: category.name, description: category.description || `Published entries in ${category.name}.`, eyebrow: 'Category archive', items, pageClass: 'category-archive-page' });
}

writeRoute('/topics/', layout({ route: '/topics/', title: 'Topics', description: `Browse ${site.title} by topic.`, canonical: absoluteUrl('/topics/'), pageClass: 'discovery-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Browse by topic</p><h1>Specific subjects across the archive.</h1><p class="lede">Topics are generated from article tags and remain linked to every related published entry.</p></div></section><section class="section shell"><div class="topic-cloud">${topics.map((topic) => `<a href="/topics/${escapeHtml(topic.slug)}/"><span>${escapeHtml(topic.name)}</span><strong>${topic.count}</strong></a>`).join('\n') || '<p>No topics are published yet.</p>'}</div></section>` }));
for (const topic of topics) {
  const items = published.filter((article) => (article.tags || []).some((tag) => topicSlug(tag) === topic.slug));
  writePaginatedArchive({ base: `/topics/${topic.slug}/`, title: topic.name, description: `Published entries tagged “${topic.name}.”`, eyebrow: 'Topic archive', items, pageClass: 'topic-archive-page' });
}

const activeAuthors = authors.filter((author) => author.active !== false);
writeRoute('/authors/', layout({ route: '/authors/', title: 'Contributors', description: `Browse contributors to ${site.title}.`, canonical: absoluteUrl('/authors/'), pageClass: 'discovery-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Contributors</p><h1>People behind the publishing.</h1><p class="lede">Contributor pages gather each person’s published work without exposing private editor data.</p></div></section><section class="section shell discovery-grid">${activeAuthors.map((author) => { const count = published.filter((article) => article.author === author.slug).length; return `<a class="discovery-card" href="/authors/${escapeHtml(author.slug)}/"><span class="author-card-mark" aria-hidden="true">${escapeHtml(author.name.charAt(0))}</span><span class="eyebrow">${escapeHtml(author.role || 'Contributor')}</span><h2>${escapeHtml(author.name)}</h2><p>${escapeHtml(author.bio || 'Published contributor.')}</p><strong>${count} ${count === 1 ? 'entry' : 'entries'} ${icon('arrow')}</strong></a>`; }).join('\n') || '<p>No active contributors are configured.</p>'}</section>` }));
for (const author of activeAuthors) {
  const items = published.filter((article) => article.author === author.slug);
  writePaginatedArchive({ base: `/authors/${author.slug}/`, title: author.name, description: author.bio || `Published entries by ${author.name}.`, eyebrow: author.role || 'Contributor archive', items, pageClass: 'author-archive-page' });
}


const sectionCards = ARTICLE_CLASSIFICATION_KEYS.map((key) => {
  const info = classificationInfo(key);
  const items = classificationGroups.get(key) || [];
  if (!items.length) return '';
  return `<article class="section-front-card"><p class="eyebrow">${escapeHtml(info.label)}</p><h2><a href="/sections/${escapeHtml(key)}/">${escapeHtml(info.label)}</a></h2><p>${escapeHtml(info.description)}</p><strong>${items.length} ${items.length === 1 ? 'article' : 'articles'}</strong></article>`;
}).filter(Boolean).join('');
writeRoute('/sections/', layout({ route: '/sections/', title: 'Editorial Sections', description: `Browse ${site.title} by editorial classification.`, canonical: absoluteUrl('/sections/'), pageClass: 'section-fronts-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Editorial sections</p><h1>Clear labels for the kind of work readers are seeing.</h1><p class="lede">News, analysis, opinion, investigations, explainers, public records, interviews, announcements, and developing coverage remain visibly distinct.</p></div></section><section class="section shell section-front-grid">${sectionCards || '<p>No classified articles are published yet.</p>'}</section>` }));
for (const key of ARTICLE_CLASSIFICATION_KEYS) {
  const items = classificationGroups.get(key) || [];
  if (!items.length) continue;
  const info = classificationInfo(key);
  writePaginatedArchive({ base: `/sections/${key}/`, title: info.label, description: info.description, eyebrow: 'Editorial section', items, pageClass: `classification-front classification-${key}` });
}

writeRoute('/series/', layout({ route: '/series/', title: 'Series and Investigations', description: `Browse multipart reporting and continuing coverage from ${site.title}.`, canonical: absoluteUrl('/series/'), pageClass: 'series-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Series desk</p><h1>Multipart reporting kept together in reading order.</h1><p class="lede">Series fronts give investigations, explainers, case files, and continuing coverage a permanent home.</p></div></section><section class="section shell series-index-grid">${publicationSeries.length ? publicationSeries.map((entry) => `<article class="series-index-card"><p class="eyebrow">${entry.articles.length} ${entry.articles.length === 1 ? 'installment' : 'installments'}</p><h2><a href="/series/${escapeHtml(entry.slug)}/">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.description || 'A continuing collection of related reporting.')}</p><a class="text-link" href="/series/${escapeHtml(entry.slug)}/">Open the series ${icon('arrow')}</a></article>`).join('') : '<p>No series are published yet.</p>'}</section>` }));
for (const entry of publicationSeries) {
  const route = `/series/${entry.slug}/`;
  writeRoute(route, layout({ route, title: entry.title, description: entry.description || `A continuing series from ${site.title}.`, canonical: absoluteUrl(route), pageClass: 'series-front-page', body: `<section class="page-hero series-front-hero"><div class="shell narrow"><p class="eyebrow">Series · ${entry.articles.length} ${entry.articles.length === 1 ? 'part' : 'parts'}</p><h1>${escapeHtml(entry.title)}</h1><p class="lede">${escapeHtml(entry.description || 'A continuing collection of related reporting.')}</p></div></section><section class="section shell series-reading-order" aria-labelledby="series-reading-order-${escapeHtml(entry.slug)}"><div class="section-heading"><div><p class="eyebrow">Reading order</p><h2 id="series-reading-order-${escapeHtml(entry.slug)}">All installments</h2></div></div><ol>${entry.articles.map((article, index) => `<li><span class="series-order-number">${Number.isInteger(article.series_order) ? article.series_order : index + 1}</span><div>${renderClassificationBadge(article)}<h3><a href="/stories/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a></h3><p>${escapeHtml(article.excerpt)}</p><p class="byline">${storyMeta(article)}</p></div></li>`).join('')}</ol></section>` }));
}

const dateGroups = new Map();
const crosswordBody = `<section class="page-hero page-hero-crossword"><div class="shell page-hero-grid"><div><p class="eyebrow">The daily press break</p><h1>Crosswords for the coffee break and the long edition.</h1><p class="lede">Choose a five-by-five novice word square or an expert blocked grid with longer newsroom entries. Every puzzle runs entirely in the browser with no account, database, analytics call, or puzzle service.</p></div><span class="hero-illustration" aria-hidden="true">${icon('puzzle')}</span></div></section>
<section class="section shell crossword-layout" data-crossword-app>
  <div class="crossword-paper">
    <div class="crossword-mast"><p class="eyebrow">TAHAI Press Crossword Desk</p><h2 data-crossword-title>Loading today's edition...</h2><p data-crossword-deck>Select a difficulty and begin.</p></div>
    <div class="crossword-difficulty" role="group" aria-label="Crossword difficulty"><span>Difficulty</span><button type="button" class="is-active" aria-pressed="true" data-crossword-mode="novice">Novice mini</button><button type="button" aria-pressed="false" data-crossword-mode="expert">Expert blocked grid</button></div>
    <div class="crossword-grid-wrap"><div class="crossword-grid" data-crossword-grid role="group" aria-label="Crossword grid"></div><p class="crossword-status" data-crossword-status role="status" aria-live="polite">Enter one letter in each open square.</p></div>
    <div class="crossword-controls"><button class="button" type="button" data-crossword-check>Check answers</button><button class="button button-secondary" type="button" data-crossword-reveal>Reveal</button><button class="button button-quiet" type="button" data-crossword-reset>Reset</button><button class="button button-quiet" type="button" data-crossword-next>Next puzzle</button><button class="button button-quiet" type="button" data-crossword-print>Print puzzle</button></div>
  </div>
  <aside class="crossword-clues"><section><p class="eyebrow">Across</p><ol data-crossword-across></ol></section><section><p class="eyebrow">Down</p><ol data-crossword-down></ol></section><p class="crossword-note">Black squares close entries in Expert mode. Click a clue to jump to its first square; use the arrow keys to move, or press Space to switch entry direction. Progress is stored only in this browser.</p></aside>
  <script id="crossword-data" type="application/json">${jsonForHtml({ schema_version: 1, puzzles: activeCrosswords })}</script>
  <noscript><div class="search-noscript"><h2>JavaScript is required for the interactive grid.</h2><p>The rest of TAHAI Press remains readable without JavaScript.</p></div></noscript>
</section>`;
writeRoute('/puzzles/', layout({ route: '/puzzles/', title: 'Daily Crossword', description: 'Solve rotating novice and expert static TAHAI Press crosswords.', canonical: absoluteUrl('/puzzles/'), pageClass: 'crossword-page', body: crosswordBody }));
fs.writeFileSync(path.join(DIST, 'assets', 'crosswords.json'), `${JSON.stringify({ schema_version: 1, puzzles: activeCrosswords }, null, 2)}\n`, 'utf8');

for (const article of published) {
  const parts = archiveDateParts(article.published_at);
  if (!parts) continue;
  const year = dateGroups.get(parts.year) || new Map();
  const month = year.get(parts.month) || [];
  month.push(article);
  year.set(parts.month, month);
  dateGroups.set(parts.year, year);
}
const yearLinks = [...dateGroups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => `<section class="date-archive-year"><h2><a href="/archive/${year}/">${year}</a></h2><div>${[...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, items]) => { const label = new Intl.DateTimeFormat(site.locale, { month: 'long', timeZone: 'UTC' }).format(new Date(`${year}-${month}-01T12:00:00Z`)); return `<a href="/archive/${year}/${month}/"><span>${escapeHtml(label)}</span><strong>${items.length}</strong></a>`; }).join('\n')}</div></section>`).join('\n');
writeRoute('/archive/', layout({ route: '/archive/', title: 'Date Archive', description: `Browse ${site.title} by publication date.`, canonical: absoluteUrl('/archive/'), pageClass: 'date-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Date archive</p><h1>Publishing organized by year and month.</h1><p class="lede">Date archives are generated from published timestamps and update automatically with every build.</p></div></section><section class="section shell date-archive-index">${yearLinks || '<p>No dated publishing is available.</p>'}</section>` }));
for (const [year, months] of dateGroups) {
  const yearItems = [...months.values()].flat().sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  writePaginatedArchive({ base: `/archive/${year}/`, title: year, description: `Published entries from ${year}.`, eyebrow: 'Year archive', items: yearItems, pageClass: 'date-archive-page' });
  for (const [month, items] of months) {
    const monthLabel = new Intl.DateTimeFormat(site.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${year}-${month}-01T12:00:00Z`));
    writePaginatedArchive({ base: `/archive/${year}/${month}/`, title: monthLabel, description: `Published entries from ${monthLabel}.`, eyebrow: 'Month archive', items, pageClass: 'date-archive-page' });
  }
}

const hubsBody = `<section class="page-hero page-hero-hubs">
  <div class="shell page-hero-grid">
    <div><p class="eyebrow">Coverage structure</p><h1>Organize recurring coverage without adding complexity.</h1><p class="lede">Hubs can represent places, beats, projects, institutions, public bodies, or any other subject that deserves a stable home.</p></div>
    <span class="hero-illustration" aria-hidden="true">${icon('location')}</span>
  </div>
</section>
<section class="section shell" aria-labelledby="hub-list-heading">
  <div class="section-heading"><div><p class="eyebrow">Configured now</p><h2 id="hub-list-heading">Active hubs</h2></div><a class="section-link" href="/contact/">Suggest a hub ${icon('arrow')}</a></div>
  <div class="hub-grid">${activeHubs.length ? activeHubs.map((hub) => `<article class="hub-card" id="${escapeHtml(hub.slug)}"><span class="hub-card-icon">${icon('location')}</span><p class="eyebrow">${escapeHtml(hub.region || 'Coverage lane')}</p><h3>${escapeHtml(hub.name)}</h3><p>${escapeHtml(hub.description || 'Organized stories and public information.')}</p><a class="text-link" href="/hubs/${escapeHtml(hub.slug)}/">View related stories ${icon('arrow')}</a></article>`).join('\n') : '<p>No active hubs are configured yet.</p>'}</div>
</section>
<section class="mission-band compact-band"><div class="shell split-callout"><div><p class="eyebrow">Make it your own</p><h2>Rename hubs to match the publication.</h2></div><div><p>The content model is intentionally broad: community desks, subject areas, projects, regions, or document collections all fit.</p><a class="button button-light" href="/about/">Read about the model ${icon('arrow')}</a></div></div></section>`;
writeRoute('/hubs/', layout({
  route: '/hubs/',
  title: 'Coverage Hubs',
  description: `Explore coverage hubs from ${site.title}.`,
  canonical: absoluteUrl('/hubs/'),
  pageClass: 'hubs-page',
  body: hubsBody
}));

for (const hub of activeHubs) {
  const items = published.filter((article) => article.hub === hub.slug);
  writePaginatedArchive({ base: `/hubs/${hub.slug}/`, title: hub.name, description: hub.description || `Published entries in ${hub.name}.`, eyebrow: hub.region || 'Coverage hub', items, pageClass: 'hub-archive-page' });
}

const aboutBody = templateMode(site) ? `<section class="page-hero page-hero-about"><div class="shell narrow"><p class="eyebrow">About TAHAI Press</p><h1>A publisher-owned newsroom in plain files.</h1><p class="lede">TAHAI Press is a database-free, static-first publishing platform for independent publications, community reporting, public records, and source-document journalism.</p></div></section>
<section class="section shell editorial-layout">
  <div class="editorial-main prose prose-large">
    <p>Created by <strong>Justin Tahai and TAHAI Web Services</strong>, TAHAI Press keeps the publication portable: articles are structured files, PDFs and images remain ordinary media, Git records every revision, and Cloudflare Pages serves the finished newsroom.</p>
    <h2>Built for ownership, not lock-in.</h2>
    <p>The public repository includes the generator, Pages CMS editing model, Contributor Composer, WordPress and bulk import tools, redirect preservation, browser search, feeds, accessibility checks, document-reader fallbacks, CMS-managed crosswords, private operational health reports, performance budgets, and deployment proof.</p>
    <p><a class="button" href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">Explore the GitHub repository ${icon('github')}${newTabNote()}</a> <a class="button button-secondary" href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">Visit the developer site ${icon('open')}${newTabNote()}</a></p>
    <h2 id="standards">Editorial foundation</h2>
    <ul><li><strong>Accuracy:</strong> distinguish verified facts, source documents, analysis, and opinion.</li><li><strong>Context:</strong> explain why a document or event matters instead of publishing it without guidance.</li><li><strong>Transparency:</strong> preserve sources and explain material corrections.</li><li><strong>Respect:</strong> publish responsibly and avoid unnecessary harm or spectacle.</li></ul>
  </div>
  <aside class="editorial-aside"><p class="eyebrow">The publishing promise</p><blockquote>${escapeHtml(site.editorial_promise || '')}</blockquote><a class="text-link" href="/puzzles/">Take the daily press break ${icon('puzzle')}</a></aside>
</section>` : `<section class="page-hero page-hero-about"><div class="shell narrow"><p class="eyebrow">About this publication</p><h1>${escapeHtml(site.title)}</h1><p class="lede">${escapeHtml(site.description)}</p></div></section><section class="section shell editorial-layout"><div class="editorial-main prose prose-large"><h2 id="standards">Editorial standards</h2><p>${escapeHtml(site.editorial_promise || site.description)}</p><p>Use this page to describe the publisher, newsroom, ownership, corrections policy, and editorial practices.</p></div><aside class="editorial-aside"><p class="eyebrow">Contact</p><a class="text-link" href="/contact/">Contact the publication ${icon('arrow')}</a></aside></section>`;
writeRoute('/about/', layout({
  route: '/about/',
  title: 'About',
  description: `About ${site.title} and its publishing model.`,
  canonical: absoluteUrl('/about/'),
  pageClass: 'about-page',
  body: aboutBody
}));

if (accessibility.enabled) {
  const accessibilitySubject = encodeURIComponent(`Accessibility feedback for ${site.title}`);
  const accessibilityBody = `<section class="page-hero page-hero-accessibility"><div class="shell narrow"><p class="eyebrow">Accessibility</p><h1>Access should not depend on a particular device or browser.</h1><p class="lede">${escapeHtml(accessibility.intro)}</p></div></section>
  <section class="section shell editorial-layout">
    <div class="editorial-main prose prose-large">
      <h2>What this template provides</h2>
      <ul>
        <li>Keyboard-operable navigation, search, article controls, and document fallbacks.</li>
        <li>Visible focus indicators, skip navigation, structured headings, and labeled landmarks.</li>
        <li>Readable text widths, responsive layouts, reduced-motion support, high-contrast system-mode support, and optional local reader preferences.</li>
        <li>Simplified, noindex article views that remove most publication decoration while preserving the full reporting record.</li>
        <li>Alternative direct links and required plain-language HTML summaries for PDF and external-document articles.</li>
      </ul>
      <h2>PDF and source-document limitations</h2>
      <p>Embedded PDF behavior depends on the reader’s browser and assistive technology. Every document article keeps a direct open link and a reader-facing HTML summary of the document’s essential meaning and context. Locally hosted documents can also provide a download link. Publishers should still remediate source documents whenever they control the original file.</p>
      <h2>Reader preferences</h2>
      <p>The Reading tools control can increase text size and line spacing, change reading width and surface, underline links, reduce decoration, and reduce motion. Preferences stay in the reader’s browser and are never sent to the publication.</p>
      <h2>Report an accessibility barrier</h2>
      <p>${escapeHtml(accessibility.feedbackNote)}</p>
      <p><a class="button" href="mailto:${escapeHtml(accessibility.contactEmail)}?subject=${accessibilitySubject}">Email accessibility feedback ${icon('mail')}</a></p>
    </div>
    <aside class="editorial-aside"><p class="eyebrow">Contact</p><h2>Accessibility feedback</h2><p><a href="mailto:${escapeHtml(accessibility.contactEmail)}">${escapeHtml(accessibility.contactEmail)}</a></p><p>Publishers should replace the sample address before launch.</p></aside>
  </section>`;
  writeRoute('/accessibility/', layout({
    route: '/accessibility/',
    title: 'Accessibility',
    description: `Accessibility information and feedback options for ${site.title}.`,
    canonical: absoluteUrl('/accessibility/'),
    pageClass: 'accessibility-page',
    body: accessibilityBody
  }));
}

const submissionSubject = encodeURIComponent(`Submission for ${site.title}`);
const submitBody = `<section class="page-hero page-hero-submit"><div class="shell page-hero-grid"><div><p class="eyebrow">Reader participation</p><h1>Submit a story idea or document.</h1><p class="lede">The default workflow uses email so a publication can accept leads without maintaining a form backend, account system, or upload service.</p></div><span class="hero-illustration" aria-hidden="true">${icon('document')}</span></div></section>
<section class="section shell submission-layout">
  <div class="submission-copy"><h2>What helps an editor review a submission?</h2><ol class="numbered-list"><li><span>1</span><div><strong>Describe what happened.</strong><p>Include the people, organization, decision, event, or issue involved.</p></div></li><li><span>2</span><div><strong>Provide dates and sources.</strong><p>Identify documents, emails, agendas, photographs, or public links when available.</p></div></li><li><span>3</span><div><strong>Explain why it matters.</strong><p>Describe the effect on the relevant community or audience.</p></div></li></ol></div>
  <aside class="contact-panel"><span class="contact-panel-icon">${icon('mail')}</span><p class="eyebrow">Default intake</p><h2>Email the editor</h2><p>This static starter intentionally avoids an unprotected upload form. A future owner can add a secure form service when needed.</p><a class="button" href="mailto:${escapeHtml(site.editor_email)}?subject=${submissionSubject}">Start a submission ${icon('arrow')}</a><p class="fine-print">Replace the sample email in <code>content/site.json</code> before public deployment.</p></aside>
</section>`;
writeRoute('/submit/', layout({
  route: '/submit/',
  title: 'Submit',
  description: `Submit a story idea or document to ${site.title}.`,
  canonical: absoluteUrl('/submit/'),
  pageClass: 'submit-page',
  body: submitBody
}));

const contactBody = `<section class="page-hero page-hero-contact"><div class="shell narrow"><p class="eyebrow">Contact</p><h1>Make the next step obvious.</h1><p class="lede">Use this page for questions, corrections, collaborations, submissions, or coverage-hub inquiries.</p></div></section>
<section class="section shell contact-grid">
  <a class="contact-card" href="mailto:${escapeHtml(site.editor_email)}"><span>${icon('mail')}</span><p class="eyebrow">Email</p><h2>Editorial and general inquiries</h2><p>${escapeHtml(site.editor_email)}</p><strong>Write to the editor ${icon('arrow')}</strong></a>
  <a class="contact-card" href="/submit/"><span>${icon('document')}</span><p class="eyebrow">Submissions</p><h2>Share a lead or source document</h2><p>Provide enough context for the publication to understand why the material matters.</p><strong>Open submission guidance ${icon('arrow')}</strong></a>
  <a class="contact-card" href="/hubs/"><span>${icon('location')}</span><p class="eyebrow">Coverage</p><h2>Suggest a recurring coverage hub</h2><p>Organize related publishing around a place, beat, project, or institution.</p><strong>Explore configured hubs ${icon('arrow')}</strong></a>
</section>`;
writeRoute('/contact/', layout({
  route: '/contact/',
  title: 'Contact',
  description: `Contact ${site.title}.`,
  canonical: absoluteUrl('/contact/'),
  pageClass: 'contact-page',
  body: contactBody
}));

for (const article of published) {
  const author = authorMap.get(article.author);
  const categoryNames = (article.categories || []).map((slug) => categoryMap.get(slug)?.name).filter(Boolean);
  const hub = hubMap.get(article.hub);
  const pdf = safeUrl(article.pdf_file || article.pdf_url || '');
  const sourceLinks = (article.source_links || []).filter((source) => safeUrl(source.url));
  const kicker = article.kicker || (article.featured ? 'Featured story' : categoryNames.join(' · ') || 'Story');
  const headerFacts = renderMetaList([
    { label: 'Status', value: articleStatusLabel(article.status) },
    { label: 'Classification', value: classificationInfo(article.classification).label },
    { label: 'Format', value: articleTemplateLabel(article) },
    { label: 'Series', value: article.series_title || '' },
    { label: 'Coverage', value: hub?.name || categoryNames[0] || '' },
    { label: 'Updated', value: article.updated_at ? formatDate(article.updated_at, site.locale, site.timezone) : '' }
  ]);

  let primaryContent = '';
  if (article.article_type === 'standard') {
    primaryContent = renderArticleContext(article, 'Written story');
  } else if (article.article_type === 'pdf') {
    primaryContent = `${renderPdfDocument(article, pdf, { primary: true })}${renderArticleContext(article, 'Context and notes')}`;
  } else if (article.article_type === 'mixed') {
    primaryContent = `${renderArticleContext(article, 'Story context')}${renderPdfDocument(article, pdf)}`;
  } else {
    primaryContent = `${renderArticleContext(article, 'Document context')}${renderExternalDocument(article, pdf)}`;
  }

  const articleBody = `<article class="article article-${escapeHtml(article.article_type)}${article.featured ? ' article-featured' : ''} shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/stories/">Stories</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(article.title)}</span></nav>
    <header class="article-header">
      <div class="story-card-labels">${article.categories?.[0] ? `<a class="eyebrow discovery-label-link" href="/categories/${escapeHtml(article.categories[0])}/">${escapeHtml(kicker)}</a>` : `<span class="eyebrow">${escapeHtml(kicker)}</span>`}${renderClassificationBadge(article)}<span class="format-label">${escapeHtml(articleFormat(article))}</span></div>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="article-deck">${escapeHtml(article.excerpt)}</p>
      ${renderArticleByline(article, author, hub)}
      ${headerFacts}
    </header>
    ${renderSeriesNotice(article)}
    ${accessibility.simplifiedReadingEnabled ? `<nav class="article-reading-actions" aria-label="Article reading options"><a href="/stories/${escapeHtml(article.slug)}/reader/">Simplified reading view ${icon('read')}</a><button class="js-only" type="button" data-print-page>Print article ${icon('print')}</button></nav>` : ''}
    ${renderReachArticleActions(article)}
    ${article.featured_image ? renderEditorialImage({
      src: article.featured_image,
      alt: article.featured_image_alt,
      caption: article.featured_image_caption,
      credit: article.featured_image_credit,
      rights: article.featured_image_rights,
      layout: 'wide',
      aspect: article.featured_image_aspect || 'landscape',
      focal_point: article.featured_image_focal_point || 'center',
      lightbox: true
    }, { className: 'article-featured-image', eager: true, lightbox: true }) : ''}
    <div class="article-template article-template-${escapeHtml(article.article_type)}">${primaryContent}</div>
    ${renderStoryBlocks(article)}
    ${renderPublicationHistory(article)}
    ${renderTrustDesk(article)}
    ${renderSources(sourceLinks)}
    ${renderRelatedCoverage(article)}
    ${renderCitationDesk(article, author)}
    ${renderTags(article)}
    ${renderAuthorCard(article, author)}
    <aside class="article-endnote"><span>${icon('source')}</span><div><p class="eyebrow">Publication note</p><p>${escapeHtml(site.editorial_promise || site.description)}</p></div><a class="text-link" href="/submit/">Share related information ${icon('arrow')}</a></aside>
  </article>`;
  writeRoute(`/stories/${article.slug}/`, layout({
    route: `/stories/${article.slug}/`,
    title: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    canonical: article.canonical_url || absoluteUrl(`/stories/${article.slug}/`),
    noindex: Boolean(article.noindex),
    pageClass: `article-page article-page-${article.article_type} article-page-${classificationInfo(article.classification).key}`,
    article,
    author,
    categoryNames,
    tags: article.tags || [],
    socialImage: article.featured_image || site.default_social_image,
    socialImageAlt: article.featured_image ? article.featured_image_alt : site.default_social_image_alt,
    body: articleBody
  }), { sitemap: !article.noindex, lastmod: machineDate(article.updated_at || article.published_at) });

  const receiptsBody = `<article class="receipts-mode shell"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/stories/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a><span aria-hidden="true">/</span><span aria-current="page">Receipts</span></nav><header class="page-hero"><p class="eyebrow">Receipts Mode · public evidence only</p><h1>${escapeHtml(article.title)}</h1><p class="lede">This reader record lists public supporting material, reporting context, and visible update history. It makes no automated assessment of truth or credibility.</p></header><section class="receipts-section"><h2>Permanent article citation</h2><p><a href="${escapeHtml(article.canonical_url || absoluteUrl(`/stories/${article.slug}/`))}">${escapeHtml(article.canonical_url || absoluteUrl(`/stories/${article.slug}/`))}</a></p></section>${sourceLinks.length ? `<section class="receipts-section"><h2>Public sources and supporting links</h2>${renderSources(sourceLinks)}</section>` : '<section class="receipts-section"><h2>Public sources and supporting links</h2><p>No separate public source links have been attached to this article.</p></section>'}${['pdf', 'mixed'].includes(article.article_type) && pdf ? `<section class="receipts-section"><h2>Supporting document</h2><p><a href="${escapeHtml(pdf)}">${escapeHtml(article.pdf_title || 'Open the original PDF')}</a></p>${renderDocumentAccessibleSummary(article, { compact: true })}</section>` : ''}${article.methodology ? `<section class="receipts-section"><h2>Methodology</h2><div class="prose">${renderMarkdown(article.methodology)}</div></section>` : ''}${renderPublicationHistory(article)}${article.disclosure ? `<section class="receipts-section"><h2>Disclosure</h2><div class="prose">${renderMarkdown(article.disclosure)}</div></section>` : ''}<section class="receipts-section"><h2>Questions and right of reply</h2><p>${escapeHtml(article.right_of_reply_note || 'No public right-of-reply record has been published for this article.')}</p></section></article>`;
  writeRoute(`/stories/${article.slug}/receipts/`, layout({ route: `/stories/${article.slug}/receipts/`, title: `Receipts: ${article.title}`, description: `Public supporting material for ${article.title}.`, canonical: absoluteUrl(`/stories/${article.slug}/receipts/`), pageClass: 'receipts-page', article, author, categoryNames, tags: article.tags || [], body: receiptsBody }), { sitemap: !article.noindex, lastmod: machineDate(article.updated_at || article.published_at) });

  if (accessibility.simplifiedReadingEnabled) {
    const readerBody = `<article class="reader-article">
      <header class="reader-article-header"><p class="eyebrow">Simplified reading view</p><h1>${escapeHtml(article.title)}</h1><p class="article-deck">${escapeHtml(article.excerpt)}</p>${renderArticleByline(article, author, hub)}</header>
      ${renderReachArticleActions(article)}
      ${article.featured_image ? `<figure class="reader-lead-image"><img src="${escapeHtml(safeUrl(article.featured_image))}" alt="${escapeHtml(article.featured_image_alt || '')}" loading="eager" decoding="async">${article.featured_image_caption || article.featured_image_credit ? `<figcaption>${[article.featured_image_caption, article.featured_image_credit].filter(Boolean).map(escapeHtml).join(' · ')}</figcaption>` : ''}</figure>` : ''}
      ${renderArticleContext(article, 'Article text')}
      ${['pdf', 'mixed', 'external'].includes(article.article_type) ? renderSimplifiedDocument(article, pdf) : ''}
      ${renderSimplifiedStoryBlocks(article)}
      ${renderPublicationHistory(article)}
      ${renderTrustDesk(article)}
      ${renderSources(sourceLinks)}
      ${renderCitationDesk(article, author)}
      ${renderTags(article)}
    </article>`;
    writeRoute(`/stories/${article.slug}/reader/`, readerLayout({ route: `/stories/${article.slug}/reader/`, article, author, body: readerBody }), { sitemap: false });
  }
}

const publicRecords = records.filter((record) => record.status === 'published').sort((left, right) => String(right.published_at || '').localeCompare(String(left.published_at || '')) || left.id.localeCompare(right.id));
const recordCards = publicRecords.map((record) => `<article class="story-card"><p class="eyebrow">Public evidence record · ${escapeHtml(record.record_type)}</p><h2><a href="/records/${escapeHtml(record.id)}/">${escapeHtml(record.title)}</a></h2><p>${escapeHtml(`${record.source_materials.length} public source${record.source_materials.length === 1 ? '' : 's'}${record.sensitivity === 'redacted' ? ' · redaction notice included' : ''}`)}</p></article>`).join('');
writeRoute('/records/', layout({ route: '/records/', title: 'Public Evidence Records', description: `Browse publisher-cleared evidence ledgers from ${site.title}.`, canonical: absoluteUrl('/records/'), pageClass: 'records-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Evidence desk</p><h1>Public evidence records</h1><p class="lede">Each ledger identifies publisher-cleared public source material and any declared redaction. These records do not score truth or replicate source files.</p></div></section><section class="section shell story-grid">${recordCards || '<p>No public evidence records have been published.</p>'}</section>` }));
for (const record of publicRecords) {
  const linkedArticle = articles.find((article) => article.slug === record.linked_article && published.includes(article));
  const sources = record.source_materials.map((source) => `<li><a href="${escapeHtml(safeUrl(source.url))}"${String(source.url).startsWith('/') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${escapeHtml(source.title)}${String(source.url).startsWith('/') ? '' : newTabNote()}</a>${source.publisher ? ` <span>· ${escapeHtml(source.publisher)}</span>` : ''}${source.retrieved_at ? ` <span>· retrieved ${escapeHtml(formatDate(source.retrieved_at, site.locale, site.timezone))}</span>` : ''}${source.sha256 ? ` <code>SHA-256 ${escapeHtml(source.sha256)}</code>` : ''}${source.description ? `<p>${escapeHtml(source.description)}</p>` : ''}</li>`).join('');
  const redactions = record.redactions.length ? `<section class="receipts-section"><h2>Declared redactions</h2><ul>${record.redactions.map((item) => `<li><strong>${escapeHtml(item.scope)}</strong>: ${escapeHtml(item.reason)}</li>`).join('')}</ul></section>` : '';
  const recordBody = `<article class="receipts-mode shell"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/records/">Public evidence records</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(record.title)}</span></nav><header class="page-hero"><p class="eyebrow">Public evidence record · ${escapeHtml(record.record_type)}</p><h1>${escapeHtml(record.title)}</h1><p class="lede">This is a publisher-cleared public metadata ledger. It does not assign a truth score, create a custody claim, or duplicate source files.</p></header>${linkedArticle ? `<section class="receipts-section"><h2>Related publication</h2><p><a href="/stories/${escapeHtml(linkedArticle.slug)}/">${escapeHtml(linkedArticle.title)}</a> · <a href="/stories/${escapeHtml(linkedArticle.slug)}/receipts/">Receipts Mode</a></p></section>` : ''}<section class="receipts-section"><h2>Public source materials</h2><ul class="source-list">${sources}</ul></section>${redactions}<section class="receipts-section"><h2>Release boundary</h2><p>Public release and rights were confirmed by the publisher before this ledger was published. Source URLs remain authoritative; this record intentionally contains no copied private material.</p></section></article>`;
  writeRoute(`/records/${record.id}/`, layout({ route: `/records/${record.id}/`, title: record.title, description: `Public evidence record: ${record.title}.`, canonical: absoluteUrl(`/records/${record.id}/`), pageClass: 'record-page', body: recordBody }), { lastmod: machineDate(record.published_at || '') });
}

const publicRecordMap = new Map(publicRecords.map((record) => [record.id, record]));
const editionCards = publicEditions.map((edition) => `<article class="story-card"><p class="eyebrow">${escapeHtml(edition.template.replaceAll('-', ' '))} · Volume ${escapeHtml(edition.volume || '—')} · Issue ${escapeHtml(edition.issue || '—')}</p><h2><a href="/editions/${escapeHtml(edition.id)}/">${escapeHtml(edition.title)}</a></h2><p>${escapeHtml(edition.editor_note || 'A print-ready selection of canonical reporting and records.')}</p></article>`).join('');
writeRoute('/editions/', layout({ route: '/editions/', title: 'Editions', description: `Print-ready editions from ${site.title}.`, canonical: absoluteUrl('/editions/'), pageClass: 'editions-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Edition desk</p><h1>Canonical reporting, arranged for print.</h1><p class="lede">Editions link to the authoritative articles and records. They do not duplicate or supersede the underlying reporting.</p></div></section><section class="section shell story-grid">${editionCards || '<p>No editions have been published.</p>'}</section>` }));
for (const edition of publicEditions) {
  const sections = edition.sections.map((section, sectionIndex) => {
    const stories = section.story_ids.map((id) => publishedArticleMap.get(id)).filter(Boolean);
    const sectionRecords = section.record_ids.map((id) => publicRecordMap.get(id)).filter(Boolean);
    return `<section class="edition-section"><header><p class="edition-folio">Section ${String(sectionIndex + 1).padStart(2, '0')}</p><h2>${escapeHtml(section.title)}</h2></header><ol class="edition-story-list">${stories.map((article, index) => `<li class="edition-story"><p class="edition-number">${String(index + 1).padStart(2, '0')}</p><div><h3><a href="/stories/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a></h3><p class="edition-deck">${escapeHtml(article.excerpt)}</p><p class="byline"><a href="/stories/${escapeHtml(article.slug)}/receipts/">Receipts Mode and canonical article</a></p></div></li>`).join('')}${sectionRecords.map((record) => `<li class="edition-story"><p class="edition-number">R</p><div><p class="eyebrow">Public evidence record</p><h3><a href="/records/${escapeHtml(record.id)}/">${escapeHtml(record.title)}</a></h3><p class="edition-deck">${escapeHtml(`${record.source_materials.length} public source materials · ${record.record_type}`)}</p></div></li>`).join('')}</ol></section>`;
  }).join('');
  const editionBody = `<article class="edition shell"><header class="edition-masthead"><p class="edition-folio">${escapeHtml(edition.cover_kicker || site.masthead_kicker || site.tagline)}</p><h1>${escapeHtml(edition.title)}</h1><p>Volume ${escapeHtml(edition.volume || '—')} · Issue ${escapeHtml(edition.issue || '—')} · ${escapeHtml(formatDate(edition.date, site.locale, site.timezone))}</p><div class="edition-actions"><button class="button js-only" type="button" data-print-edition>${icon('print')} Print edition</button><a class="button button-secondary" href="/editions/">All editions</a></div></header><section class="edition-editor-note"><h2>From the editor</h2><p>${escapeHtml(edition.editor_note || '')}</p></section><nav class="edition-contents" aria-label="Edition contents"><h2>Contents</h2><ol>${edition.sections.map((section) => `<li>${escapeHtml(section.title)}</li>`).join('')}</ol></nav>${sections}${edition.inserts?.length ? `<aside class="edition-inserts"><h2>Inserts and source notes</h2><ul>${edition.inserts.map((insert) => `<li>${escapeHtml(insert)}</li>`).join('')}</ul></aside>` : ''}<footer class="edition-footer"><p>${escapeHtml(edition.credits || site.editorial_promise || site.description)}</p><p>${escapeHtml(edition.corrections_note || 'Corrections remain on the linked canonical publications.')}</p><p class="edition-folio">${escapeHtml(absoluteUrl(`/editions/${edition.id}/`))}</p></footer></article>`;
  writeRoute(`/editions/${edition.id}/`, layout({ route: `/editions/${edition.id}/`, title: edition.title, description: edition.editor_note || `Print-ready edition from ${site.title}.`, canonical: absoluteUrl(`/editions/${edition.id}/`), pageClass: 'edition-page edition-canonical-page', body: editionBody }), { lastmod: machineDate(edition.date) });
}

const newsletterCards = publicNewsletters.map((newsletter) => `<article class="story-card"><p class="eyebrow">Tracking-free email edition</p><h2><a href="/newsletters/${escapeHtml(newsletter.id)}/">${escapeHtml(newsletter.title)}</a></h2><p>${escapeHtml(newsletter.preview_text || newsletter.description || '')}</p></article>`).join('');
writeRoute('/newsletters/', layout({ route: '/newsletters/', title: 'Newsletter archive', description: `Provider-neutral newsletter editions from ${site.title}.`, canonical: absoluteUrl('/newsletters/'), pageClass: 'newsletter-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Newsletter desk</p><h1>Prepared for email, never sent by this site.</h1><p class="lede">These browser-readable archives have matching email-safe HTML and plain-text exports. They contain no tracking pixels, remote fonts, scripts, or email provider lock-in.</p></div></section><section class="section shell story-grid">${newsletterCards || '<p>No newsletters have been published.</p>'}</section>` }));
for (const newsletter of publicNewsletters) {
  const rendered = renderNewsletter({ newsletter, site, articleMap: publishedArticleMap });
  fs.mkdirSync(path.join(DIST, 'newsletters', newsletter.id), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'newsletters', newsletter.id, 'email.html'), rendered.html, 'utf8');
  fs.writeFileSync(path.join(DIST, 'newsletters', newsletter.id, 'email.txt'), `${rendered.text}\n`, 'utf8');
  writeRoute(`/newsletters/${newsletter.id}/`, layout({ route: `/newsletters/${newsletter.id}/`, title: newsletter.title, description: rendered.preview, canonical: absoluteUrl(`/newsletters/${newsletter.id}/`), pageClass: 'newsletter-page', body: `<article class="shell prose"><p class="eyebrow">Newsletter archive</p><h1>${escapeHtml(newsletter.title)}</h1><p class="lede">${escapeHtml(rendered.preview)}</p><p><a class="button" href="/newsletters/${escapeHtml(newsletter.id)}/email.html">Download email-safe HTML</a> <a class="button button-secondary" href="/newsletters/${escapeHtml(newsletter.id)}/email.txt">Plain-text edition</a></p><section><h2>Included canonical reporting</h2><ul>${rendered.articles.map((article) => `<li><a href="/stories/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a> — ${escapeHtml(article.excerpt)}</li>`).join('')}</ul></section><p>Before sending, replace the provider-neutral unsubscribe placeholder with the recipient email provider’s approved unsubscribe mechanism.</p></article>` }));
}

const editionBuilderData = {
  templates: ['daily', 'community-weekly', 'investigative-special', 'records-packet', 'arts', 'developing-bulletin'],
  stories: published.map((article) => ({ id: article.slug, title: article.title, type: 'story', excerpt: article.excerpt })),
  records: publicRecords.map((record) => ({ id: record.id, title: record.title, type: 'record', excerpt: `${record.source_materials.length} public source materials` }))
};
const editionBuilderBody = `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Local Edition Builder</p><h1>Arrange canonical reporting into a print-ready edition.</h1><p class="lede">Selections and ordering stay in this browser until you download an ordinary edition JSON file for review and commit. The builder does not publish, send email, or change source files.</p></div></section><section class="section shell"><noscript><p>This local builder needs JavaScript to arrange and export an edition. Existing editions remain printable without JavaScript at <a href="/editions/">/editions/</a>.</p></noscript><form class="edition-builder" data-edition-builder><div class="studio-grid"><label for="edition-builder-title">Edition title</label><input id="edition-builder-title" name="title" required maxlength="160" value="New edition"><label for="edition-builder-template">Template</label><select id="edition-builder-template" name="template">${editionBuilderData.templates.map((template) => `<option value="${template}">${escapeHtml(template.replaceAll('-', ' '))}</option>`).join('')}</select><label for="edition-builder-date">Issue date</label><input id="edition-builder-date" name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div><p class="fine-print">Add published stories or public evidence records. Use the arrow keys after focusing a selected item to reorder it.</p><div class="edition-builder-grid"><section aria-labelledby="edition-builder-source"><h2 id="edition-builder-source">Canonical source material</h2><div data-edition-source></div></section><section aria-labelledby="edition-builder-selection"><h2 id="edition-builder-selection">Edition order</h2><ol data-edition-selection aria-live="polite"></ol><p data-edition-builder-status role="status" aria-live="polite">Choose reporting to begin.</p></section></div><div class="button-row"><button class="button" type="button" data-edition-export>Download edition JSON</button><button class="button button-secondary" type="button" data-edition-print>Print preview</button></div></form><script type="application/json" id="edition-builder-data">${jsonForHtml(editionBuilderData)}</script></section>`;
writeRoute('/edition-builder/', layout({ route: '/edition-builder/', title: 'Edition Builder', description: 'Local canonical-edition arrangement and export.', canonical: absoluteUrl('/edition-builder/'), noindex: true, pageClass: 'edition-builder-page', scripts: ['/assets/edition-builder.js'], body: editionBuilderBody }), { sitemap: false });

function embedCard({ eyebrow, title, description, href }) {
  return `<article class="shell embed-card"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1><a href="${escapeHtml(href)}">${escapeHtml(title)}</a></h1><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(href)}">Read the canonical publication</a></p></article>`;
}
const embedExamples = [];
for (const article of published) {
  const route = `/embeds/articles/${article.slug}/`;
  embedExamples.push({ label: article.title, route });
  writeRoute(route, layout({ route, title: article.title, description: article.excerpt, canonical: absoluteUrl(route), noindex: true, pageClass: 'embed-page', body: embedCard({ eyebrow: article.classification || 'Reporting', title: article.title, description: article.excerpt, href: `/stories/${article.slug}/` }) }), { sitemap: false });
}
for (const record of publicRecords) {
  const route = `/embeds/records/${record.id}/`;
  embedExamples.push({ label: record.title, route });
  writeRoute(route, layout({ route, title: record.title, description: `Public evidence record from ${site.title}.`, canonical: absoluteUrl(route), noindex: true, pageClass: 'embed-page', body: embedCard({ eyebrow: 'Public evidence record', title: record.title, description: `${record.source_materials.length} publisher-cleared public source materials.`, href: `/records/${record.id}/` }) }), { sitemap: false });
}
for (const edition of publicEditions) {
  const route = `/embeds/editions/${edition.id}/`;
  embedExamples.push({ label: edition.title, route });
  writeRoute(route, layout({ route, title: edition.title, description: edition.editor_note || '', canonical: absoluteUrl(route), noindex: true, pageClass: 'embed-page', body: embedCard({ eyebrow: 'Print edition', title: edition.title, description: edition.editor_note || 'A canonical print-ready edition.', href: `/editions/${edition.id}/` }) }), { sitemap: false });
}
const embedIndexBody = `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Safe embeds</p><h1>Same-origin reading cards with no third-party script.</h1><p class="lede">Copy an iframe snippet for a public article, record, or edition. Embed routes expose only a title, public summary, and canonical link; they never expose publisher tools or private data.</p></div></section><section class="section shell"><ul class="embed-example-list">${embedExamples.map((example) => `<li><strong>${escapeHtml(example.label)}</strong><code>&lt;iframe src=&quot;${escapeHtml(absoluteUrl(example.route))}&quot; title=&quot;${escapeHtml(example.label)}&quot; loading=&quot;lazy&quot;&gt;&lt;/iframe&gt;</code></li>`).join('')}</ul></section>`;
writeRoute('/embeds/', layout({ route: '/embeds/', title: 'Safe embeds', description: 'Same-origin static publication embeds.', canonical: absoluteUrl('/embeds/'), noindex: true, pageClass: 'embeds-index-page', body: embedIndexBody }), { sitemap: false });

const newestPublicationDate = machineDate(published[0]?.updated_at || published[0]?.published_at || '');
const sitemapEntries = routeManifest.map((entry) => ({ ...entry, lastmod: entry.lastmod || newestPublicationDate }));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemapEntries), 'utf8');
fs.writeFileSync(path.join(DIST, 'feed.xml'), buildRss({ site, articles: published, authors, categories }), 'utf8');
fs.writeFileSync(path.join(DIST, 'atom.xml'), buildAtom({ site, articles: published, authors }), 'utf8');
fs.writeFileSync(path.join(DIST, 'feed.json'), `${jsonForHtml(buildJsonFeed({ site, articles: published, authors }))}\n`, 'utf8');
const apiRoot = path.join(DIST, 'api', 'v1');
fs.mkdirSync(apiRoot, { recursive: true });
const apiDocuments = buildApi({ site, articles: published, authors, categories, hubs: activeHubs, records: publicRecords, editions: publicEditions, routeManifest: sitemapEntries, generatedVersion: packageInfo.version });
for (const [name, document] of Object.entries(apiDocuments)) fs.writeFileSync(path.join(apiRoot, `${name}.json`), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
const manifestIcons = templateMode(site)
  ? [{ src: '/assets/tahai-press-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/assets/tahai-press-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }]
  : [{ src: String(site.logo || '').startsWith('/') ? site.logo : '/assets/favicon.svg', sizes: 'any', purpose: 'any maskable' }];
fs.writeFileSync(path.join(DIST, 'site.webmanifest'), `${JSON.stringify({
  id: '/',
  name: site.title,
  short_name: site.short_title,
  description: site.description,
  start_url: '/',
  scope: '/',
  display: readerReach.enabled && readerReach.offlineEnabled ? 'standalone' : 'browser',
  display_override: readerReach.enabled && readerReach.offlineEnabled ? ['window-controls-overlay', 'standalone', 'minimal-ui'] : ['browser'],
  background_color: safeThemeColor(site.theme?.paper, '#fffefb'),
  theme_color: safeThemeColor(site.theme?.brand, '#17324d'),
  icons: manifestIcons,
  shortcuts: [
    ...(readerReach.enabled && readerReach.currentEditionEnabled ? [{ name: 'Current edition', short_name: 'Edition', url: '/edition/' }] : []),
    ...(readerReach.enabled && readerReach.savedArticlesEnabled ? [{ name: 'Saved stories', short_name: 'Saved', url: '/saved/' }] : []),
    { name: 'Search', short_name: 'Search', url: '/search/' },
    { name: 'Crossword', short_name: 'Crossword', url: '/puzzles/' }
  ]
}, null, 2)}
`, 'utf8');

if (readerReach.enabled && readerReach.offlineEnabled) {
  const recentForOffline = published.slice(0, readerReach.offlineArticleCount);
  const precache = [
    '/', '/offline/', '/stories/', '/search/', '/puzzles/', '/site.webmanifest',
    '/assets/styles.css', '/assets/reader-reach.js', '/assets/reading-tools.js', '/assets/search.js', '/assets/crossword.js', '/assets/crosswords.json', '/assets/professional-desk.js', '/assets/media-gallery.js', '/assets/pdf-reader.js',
    ...(readerReach.savedArticlesEnabled ? ['/saved/'] : []),
    ...(readerReach.currentEditionEnabled ? ['/edition/'] : []),
    ...recentForOffline.flatMap((article) => [`/stories/${article.slug}/`, ...(accessibility.simplifiedReadingEnabled ? [`/stories/${article.slug}/reader/`] : [])]),
    ...(String(site.logo || '').startsWith('/') ? [site.logo] : []),
    ...(String(site.default_social_image || '').startsWith('/') ? [site.default_social_image] : [])
  ];
  fs.writeFileSync(path.join(DIST, 'service-worker.js'), serviceWorkerSource({ version: packageInfo.version, precache, offlineRoute: '/offline/' }), 'utf8');
}

fs.writeFileSync(path.join(DIST, '404.html'), layout({
  route: '/404.html',
  title: 'Page not found',
  description: 'The requested page could not be found.',
  canonical: absoluteUrl('/404.html'),
  noindex: true,
  pageClass: 'not-found-page',
  body: `<section class="not-found shell"><span class="not-found-mark">${brandMark()}</span><p class="eyebrow">Error 404</p><h1>That page is not in the archive.</h1><p class="lede">The address may have changed, or the entry may no longer be published.</p><div class="button-row"><a class="button" href="/search/">Search the archive ${icon('search')}</a><a class="button button-quiet" href="/stories/">Browse stories</a></div></section>`
}), 'utf8');

const redirectPlan = createRedirectPlan({ site, articles, config: readRedirectConfig(), dist: DIST, checkTargets: true });
if (redirectPlan.errors.length) {
  throw new Error(`Redirect validation failed with ${redirectPlan.errors.length} issue(s):\n- ${redirectPlan.errors.join('\n- ')}`);
}
fs.writeFileSync(path.join(DIST, '_redirects'), pagesRedirectText(redirectPlan), 'utf8');

const wellKnown = path.join(DIST, '.well-known');
fs.mkdirSync(wellKnown, { recursive: true });
fs.writeFileSync(path.join(wellKnown, 'publication-redirects.json'), `${JSON.stringify({
  schema_version: 1,
  rule_count: redirectPlan.counts.total,
  article_alias_count: redirectPlan.counts.article_aliases,
  manual_rule_count: redirectPlan.counts.manual,
  sha256: redirectPlan.sha256
}, null, 2)}\n`);
const buildInfo = {
  schema_version: 1,
  software: TAHAI_PRESS_PROVENANCE.software,
  tahai_press_version: packageInfo.version,
  environment: deployment.environment,
  provider: deployment.provider,
  branch: deployment.branch,
  production_branch: deployment.productionBranch,
  commit: deployment.shortCommit,
  deployment_url: deployment.deploymentUrl,
  site_url: site.site_url,
  article_count: published.length,
  crossword_count: activeCrosswords.length,
  reader_reach_enabled: readerReach.enabled,
  offline_reading_enabled: readerReach.enabled && readerReach.offlineEnabled,
  saved_articles_enabled: readerReach.enabled && readerReach.savedArticlesEnabled,
  current_edition_enabled: readerReach.enabled && readerReach.currentEditionEnabled,
  publisher_studio_enabled: true,
  git_cms_repository: gitCmsRepository,
  git_cms_branch: gitCmsBranch,
  git_cms_version: SVELTIA_CMS_VERSION,
  newsroom_inbox: 'content/inbox',
  search_index_count: searchIndex.length,
  topic_count: topics.length,
  redirect_count: redirectPlan.counts.total,
  redirect_sha256: redirectPlan.sha256,
  template_mode: templateMode(site),
  accessibility_statement: accessibility.enabled,
  accessibility_route: accessibility.enabled ? '/accessibility/' : '',
  indexing_blocked: deployment.isPreview || templateMode(site),
  sitemap_url_count: sitemapEntries.filter((entry) => entry.include !== false).length,
  feed_item_count: Math.min(published.length, Number(site.seo?.feed_limit || 50)),
  output: 'static',
  build_command: 'npm run build:cloudflare',
  supported_node_major: Number((fs.readFileSync(path.join(ROOT, '.node-version'), 'utf8').trim().match(/\d+/) || ['22'])[0])
};
fs.writeFileSync(path.join(wellKnown, 'publication-build.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
fs.writeFileSync(path.join(wellKnown, 'tahai-press.json'), `${JSON.stringify(TAHAI_PRESS_PROVENANCE, null, 2)}\n`);
fs.writeFileSync(path.join(DIST, 'humans.txt'), humansText(), 'utf8');

fs.writeFileSync(path.join(wellKnown, 'publication-readiness.json'), `${JSON.stringify({
  schema_version: 1,
  ok: readiness.ok,
  blocker_count: readiness.errors.length,
  warning_count: readiness.warnings.length,
  blockers: readiness.errors,
  warnings: readiness.warnings,
  template_mode: templateMode(site),
  setup_route: templateMode(site) ? '/setup/' : ''
}, null, 2)}
`);

fs.writeFileSync(path.join(wellKnown, 'publication-health.json'), `${JSON.stringify({
  ok: true,
  output: 'static',
  environment: deployment.environment,
  commit: deployment.shortCommit,
  article_count: published.length,
  crossword_count: activeCrosswords.length,
  reader_reach_enabled: readerReach.enabled,
  offline_reading_enabled: readerReach.enabled && readerReach.offlineEnabled,
  saved_articles_enabled: readerReach.enabled && readerReach.savedArticlesEnabled,
  current_edition_enabled: readerReach.enabled && readerReach.currentEditionEnabled,
  publisher_studio_enabled: true,
  git_cms_repository: gitCmsRepository,
  git_cms_branch: gitCmsBranch,
  git_cms_version: SVELTIA_CMS_VERSION,
  search_index_count: searchIndex.length,
  topic_count: topics.length,
  redirect_count: redirectPlan.counts.total,
  template_mode: templateMode(site),
  accessibility_statement: accessibility.enabled,
  accessibility_route: accessibility.enabled ? '/accessibility/' : '',
  indexing_blocked: deployment.isPreview || templateMode(site),
  sitemap_url_count: sitemapEntries.filter((entry) => entry.include !== false).length,
  feed_item_count: Math.min(published.length, Number(site.seo?.feed_limit || 50))
}, null, 2)}\n`);

const indexingBlocked = deployment.isPreview || templateMode(site);
const robotsText = indexingBlocked
  ? `User-agent: *\nDisallow: /\n# Template or preview deployment: indexing intentionally blocked.\n`
  : `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`;
fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsText, 'utf8');

console.log(`TAHAI Press built ${published.length} published article(s), ${routeManifest.length} routes, and ${activeCrosswords.length} CMS-managed crossword(s) into ${path.relative(ROOT, DIST)}/ (${deployment.environment}:${deployment.branch}).`);
