import fs from 'node:fs';
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

const { site, articles, authors, categories, hubs } = loadContent();
const packageInfo = readJson(path.join(ROOT, 'package.json'));
const deployment = deploymentContext();
const authorMap = new Map(authors.map((item) => [item.slug, item]));
const categoryMap = new Map(categories.map((item) => [item.slug, item]));
const hubMap = new Map(hubs.map((item) => [item.slug, item]));
const routeManifest = [];
const accessibility = accessibilityStatement(site);
const PROJECT_REPOSITORY = 'https://github.com/JTAHAI/tahai-press';
const DEVELOPER_SITE = 'https://tahai.net';

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true, force: true });

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
    puzzle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18"/><path d="M9 9h6v6H9z"/></svg>'
  };
  return icons[name] || '';
}

const navItems = [
  { href: '/stories/', label: 'Stories' },
  { href: '/search/', label: 'Search' },
  { href: '/hubs/', label: 'Coverage Hubs' },
  { href: '/puzzles/', label: 'Crossword' },
  { href: '/about/', label: 'About' },
  { href: '/submit/', label: 'Submit' }
];

function isCurrent(route, href) {
  if (href === '/') return route === '/';
  return route === href || route.startsWith(href);
}

function navLinks(route, className = '') {
  return navItems.map(({ href, label }) => `<a class="${className}" href="${href}"${isCurrent(route, href) ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a>`).join('\n');
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
  return `<style>:root{
    --brand:${safeThemeColor(theme.brand, '#17324d')};
    --brand-deep:${safeThemeColor(theme.brand_deep, '#0d2236')};
    --brand-soft:${safeThemeColor(theme.brand_soft, '#dce7ef')};
    --accent:${safeThemeColor(theme.accent, '#9a4c20')};
    --accent-dark:${safeThemeColor(theme.accent_dark, '#6d3213')};
    --highlight:${safeThemeColor(theme.highlight, '#c49a42')};
    --surface:${safeThemeColor(theme.surface, '#f4f0e8')};
    --surface-deep:${safeThemeColor(theme.surface_deep, '#e9e0d2')};
    --paper:${safeThemeColor(theme.paper, '#fffefb')};
  }</style>`;
}

function layout({
  route = '/', title, description, canonical, body, noindex = false, pageClass = '',
  article = null, author = null, categoryNames = [], tags = [], socialImage = '', socialImageAlt = ''
}) {
  const pageTitle = title === site.title ? site.title : `${title} | ${site.short_title}`;
  const head = pageHead({
    site, deployment, route, pageTitle, description, canonical, noindex,
    image: socialImage, imageAlt: socialImageAlt, article, author,
    categories: categoryNames, tags
  });
  const templateNotice = templateMode(site) ? `<div class="template-notice" role="note"><div class="shell template-notice-inner"><p><strong>TAHAI Press demo edition.</strong> This first-deploy identity and sample newsroom are intentionally blocked from search indexing.</p><nav aria-label="TAHAI Press project links"><a href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">Source on GitHub${newTabNote()}</a><a href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">Developer site${newTabNote()}</a></nav></div></div>` : '';
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
  <script src="/assets/pdf-reader.js" defer></script>
  <script src="/assets/search.js" defer></script>
  <script src="/assets/crossword.js" defer></script>
  ${themeVariables()}
</head>
<body class="${escapeHtml(pageClass)}">
  <a class="skip-link" href="#main">Skip to content</a>
  ${templateNotice}
  <div class="publication-bar">
    <div class="shell publication-bar-inner">
      <p>${escapeHtml(site.masthead_kicker || site.tagline)}</p>
      ${templateMode(site) ? `<a href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">GitHub repository${newTabNote()}</a>` : `<a href="/about/#standards">${escapeHtml(site.standards_label || 'Editorial standards')}</a>`}
    </div>
  </div>
  <header class="site-header">
    <div class="shell masthead-row">
      <div class="masthead-folio" aria-hidden="true"><span>${templateMode(site) ? 'EST. 2026' : 'INDEPENDENT'}</span><strong>${templateMode(site) ? 'OPEN-SOURCE EDITION' : 'PUBLICATION'}</strong></div>
      <a class="brand" href="/" aria-label="${escapeHtml(site.title)} home">
        ${brandMark()}
        <span class="brand-copy"><strong>${escapeHtml(site.title)}</strong><small>${escapeHtml(site.tagline)}</small></span>
      </a>
      <div class="masthead-actions"><a class="header-contact" href="${escapeHtml(site.contact_url || '/contact/')}">${icon('mail')}<span>Contact</span></a>${templateMode(site) ? `<a class="header-contact" href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">${icon('github')}<span>GitHub</span>${newTabNote()}</a>` : ''}</div>
    </div>
    <div class="navigation-wrap">
      <div class="shell navigation-inner">
        <nav class="desktop-nav" aria-label="Primary navigation">${navLinks(route)}</nav>
        <details class="mobile-nav">
          <summary>${icon('menu')}<span>Menu</span></summary>
          <nav aria-label="Mobile navigation">
            ${navLinks(route, 'mobile-nav-link')}
            <a class="mobile-nav-contact" href="${escapeHtml(site.contact_url || '/contact/')}">Contact the publication</a>
          </nav>
        </details>
        <p class="navigation-promise">${escapeHtml(site.navigation_note || 'Static-first. Editor-friendly. Open source.')}</p>
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
      <nav aria-label="Footer publication links">
        <h2>Publication</h2>
        <a href="/stories/">Stories</a>
        <a href="/search/">Search</a>
        <a href="/categories/">Categories</a>
        <a href="/topics/">Topics</a>
        <a href="/about/">About</a>
        <a href="/puzzles/">Daily crossword</a>
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
    ${templateMode(site) ? `<div class="shell template-project-credit"><p><strong>TAHAI Press</strong> is open-source software created by Justin Tahai and TAHAI Web Services.</p><p><a href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">View the repository${newTabNote()}</a><span aria-hidden="true"> · </span><a href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">Visit tahai.net${newTabNote()}</a></p></div>` : ''}
    <div class="shell footer-bottom">
      <p>© ${new Date().getFullYear()} ${escapeHtml(site.title)}.</p>
      ${site.footer_note ? `<p>${escapeHtml(site.footer_note)}</p>` : ''}
    </div>
  </footer>
</body>
</html>`;
}

function articleFormat(article) {
  if (article.article_type === 'pdf') return 'PDF document';
  if (article.article_type === 'mixed') return 'Story + PDF';
  if (article.article_type === 'external') return 'External document';
  return 'Written story';
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
  return `<dl class="${className}">${present.map((item) => `<div><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`).join('')}</dl>`;
}

function renderArticleByline(article, author, hub) {
  const publishedLabel = formatDate(article.published_at, site.locale, site.timezone);
  const updatedLabel = article.updated_at ? formatDate(article.updated_at, site.locale, site.timezone) : '';
  const readingMinutes = estimateReadingMinutes(article.body || '');
  const details = [
    `<span>Published <time datetime="${escapeHtml(machineDate(article.published_at))}">${escapeHtml(publishedLabel)}</time>${hub ? ` · ${escapeHtml(hub.name)}` : ''}</span>`,
    updatedLabel ? `<span>Updated <time datetime="${escapeHtml(machineDate(article.updated_at))}">${escapeHtml(updatedLabel)}</time></span>` : '',
    readingMinutes ? `<span>${readingMinutes} min read</span>` : ''
  ].filter(Boolean).join('');
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

function renderPdfDocument(article, pdf, { primary = false } = {}) {
  const title = article.pdf_title || article.title;
  const isLocal = pdf.startsWith('/');
  const defaultView = article.pdf_viewer_default === 'fit-page' ? 'Fit' : 'FitH';
  const readerId = `pdf-reader-${article.slug}`;
  const frameId = `pdf-frame-${article.slug}`;
  const supportId = `pdf-support-${article.slug}`;
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
    <div class="pdf-reader" id="${readerId}" data-pdf-reader data-pdf-source="${directUrl}" data-default-view="${defaultView}">
      <div class="pdf-toolbar" role="toolbar" aria-label="PDF preview controls">
        <div class="pdf-toolbar-status"><span class="pdf-status-dot" aria-hidden="true"></span><span data-pdf-status aria-live="polite">PDF preview</span></div>
        <div class="pdf-toolbar-group pdf-view-controls" role="group" aria-label="Page fit">
          <button class="pdf-control" type="button" data-pdf-view="FitH" aria-pressed="${defaultView === 'FitH'}">${icon('fitWidth')}<span>Fit width</span></button>
          <button class="pdf-control" type="button" data-pdf-view="Fit" aria-pressed="${defaultView === 'Fit'}">${icon('fitPage')}<span>Fit page</span></button>
        </div>
        <div class="pdf-toolbar-group pdf-toolbar-actions" role="group" aria-label="Preview actions">
          <button class="pdf-control" type="button" data-pdf-fullscreen aria-controls="${readerId}" aria-pressed="false">${icon('expand')}<span>Full screen</span></button>
          <a class="pdf-control" href="${directUrl}" target="_blank" rel="noopener noreferrer">${icon('open')}<span>Open</span>${newTabNote()}</a>
        </div>
      </div>
      <div class="pdf-frame pdf-stage" id="${frameId}" data-pdf-stage tabindex="-1" role="region" aria-label="Embedded PDF preview: ${escapeHtml(title)}">
        <div class="pdf-loading" data-pdf-loading><span class="pdf-loading-spinner" aria-hidden="true"></span><p>Preparing the browser PDF preview…</p></div>
        <iframe src="${previewUrl}" data-pdf-frame title="${escapeHtml(title)} PDF preview" aria-describedby="${supportId}" loading="${primary ? 'eager' : 'lazy'}" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen"></iframe>
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
  return `<section class="sources"><p class="eyebrow">Sources</p><h2>Related links and supporting material</h2><ul>${sourceLinks.map((source) => `<li><a href="${escapeHtml(safeUrl(source.url))}"${String(source.url).startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(source.label)}${String(source.url).startsWith('http') ? newTabNote() : ''}</a>${source.note ? ` — ${escapeHtml(source.note)}` : ''}</li>`).join('')}</ul></section>`;
}

function renderTags(article) {
  const tags = (article.tags || []).filter(Boolean);
  if (!tags.length) return '';
  return `<section class="article-tags" aria-label="Article topics"><p class="eyebrow">Topics</p><ul>${tags.map((tag) => `<li><a href="/topics/${escapeHtml(topicSlug(tag))}/">${escapeHtml(tag)}</a></li>`).join('')}</ul></section>`;
}

function renderAuthorCard(article, author) {
  if (article.show_author_bio === false || !author) return '';
  return `<aside class="author-card" aria-labelledby="author-card-heading-${escapeHtml(article.slug)}"><span class="author-card-mark" aria-hidden="true">${escapeHtml(author.name.charAt(0))}</span><div><p class="eyebrow">About the contributor</p><h2 id="author-card-heading-${escapeHtml(article.slug)}">${escapeHtml(author.name)}</h2>${author.role ? `<p class="author-role">${escapeHtml(author.role)}</p>` : ''}${author.bio ? `<p>${escapeHtml(author.bio)}</p>` : ''}</div></aside>`;
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
        <span class="format-label">${escapeHtml(articleFormat(article))}</span>
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
        <span class="format-label">${escapeHtml(category?.name || articleFormat(article))}</span>
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
  return `<nav class="pagination" aria-label="Archive pagination">${links.join('')}</nav>`;
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
  .filter((article) => article.status === 'published')
  .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
const featured = published.find((article) => article.featured) || published[0];
const latest = published.filter((article) => article.slug !== featured?.slug).slice(0, 6);
const activeHubs = hubs.filter((hub) => hub.active !== false);

const homeBody = `<section class="home-intro">
  <div class="shell home-intro-grid">
    <div class="home-intro-copy">
      <p class="eyebrow">${escapeHtml(site.hero_kicker || site.tagline)}</p>
      <h1>${escapeHtml(site.hero_title || 'Publish stories and source documents without a database.')}</h1>
      <p class="lede">${escapeHtml(site.hero_description || site.description)}</p>
      <div class="button-row">
        <a class="button" href="/stories/">Explore the archive ${icon('arrow')}</a>
        <a class="button button-quiet" href="/about/">How this publication works</a>
      </div>
    </div>
    <aside class="home-intro-note" aria-label="Editorial promise">
      <span class="note-icon">${icon('source')}</span>
      <p class="eyebrow">Publication promise</p>
      <p>${escapeHtml(site.editorial_promise || site.description)}</p>
      <a class="text-link" href="/about/#standards">Read the standards ${icon('arrow')}</a>
    </aside>
  </div>
</section>
${featured ? `<section class="section section-featured shell" aria-labelledby="featured-heading">
  <div class="section-kicker-row"><p class="eyebrow">In focus</p><p class="section-rule-label">Articles · Primary documents · Community updates</p></div>
  <h2 class="visually-hidden" id="featured-heading">Featured story</h2>
  ${featuredStory(featured)}
</section>` : ''}
<section class="section section-latest shell" aria-labelledby="latest-heading">
  <div class="section-heading">
    <div><p class="eyebrow">Latest publishing</p><h2 id="latest-heading">Stories and documents</h2></div>
    <a class="section-link" href="/stories/">View the full archive ${icon('arrow')}</a>
  </div>
  ${latest.length ? `<div class="story-grid">${latest.map((article) => articleCard(article)).join('\n')}</div>` : (featured ? `<div class="story-grid story-grid-single">${articleCard(featured)}</div>` : emptyStories())}
</section>
${templateMode(site) ? `<section class="section shell product-broadsheet" aria-labelledby="product-heading"><div class="product-broadsheet-heading"><p class="eyebrow">From the publisher's desk</p><h2 id="product-heading">Fork the press. Keep the files. Publish on your terms.</h2><p>TAHAI Press is a reusable publication engine, not a hosted lock-in service. The repository includes the newsroom templates, Pages CMS configuration, import tools, redirect preservation, accessibility checks, and Cloudflare build contract.</p></div><div class="product-broadsheet-columns"><article><span class="column-number">01</span><h3>Read the source</h3><p>Inspect every build step, content rule, and generated page in the public repository.</p><a class="text-link" href="${PROJECT_REPOSITORY}" target="_blank" rel="noopener noreferrer">Open GitHub ${icon('arrow')}${newTabNote()}</a></article><article><span class="column-number">02</span><h3>Meet the developer</h3><p>Created by Justin Tahai and TAHAI Web Services as a practical open-source publishing foundation.</p><a class="text-link" href="${DEVELOPER_SITE}" target="_blank" rel="noopener noreferrer">Visit tahai.net ${icon('arrow')}${newTabNote()}</a></article><article><span class="column-number">03</span><h3>Test the press</h3><p>Browse sample articles, open original PDFs, search the archive, and solve the rotating daily mini crossword.</p><a class="text-link" href="/puzzles/">Solve today's crossword ${icon('arrow')}</a></article></div></section>` : ''}
<section class="mission-band" aria-labelledby="mission-heading">
  <div class="shell">
    <div class="mission-heading"><p class="eyebrow">A practical publishing foundation</p><h2 id="mission-heading">Clear enough for readers. Simple enough for editors.</h2></div>
    <div class="pillar-grid">
      <article><span>${icon('document')}</span><h3>Publish</h3><p>Create written stories, PDF-first posts, or mixed articles from structured content files.</p></article>
      <article><span>${icon('source')}</span><h3>Preserve</h3><p>Keep original documents available beside the context that explains why they matter.</p></article>
      <article><span>${icon('community')}</span><h3>Organize</h3><p>Group coverage by category, contributor, or geographic and subject-matter hub.</p></article>
    </div>
  </div>
</section>
<section class="section shell community-grid" aria-labelledby="community-heading">
  <div class="community-copy">
    <p class="eyebrow">Flexible organization</p>
    <h2 id="community-heading">Coverage hubs that fit the publication.</h2>
    <p class="lede">Use hubs for towns, regions, beats, projects, case files, organizations, or any other recurring coverage lane.</p>
    <a class="button button-secondary" href="/hubs/">Explore coverage hubs ${icon('arrow')}</a>
  </div>
  <div class="hub-preview" aria-label="Active coverage hubs">
    ${activeHubs.length ? activeHubs.slice(0, 4).map((hub) => `<a href="/hubs/${escapeHtml(hub.slug)}/"><span>${icon('location')}</span><span><strong>${escapeHtml(hub.name)}</strong><small>${escapeHtml(hub.description || hub.region || 'Organized coverage')}</small></span>${icon('arrow')}</a>`).join('') : '<p>New hubs will appear here as they are configured.</p>'}
  </div>
</section>
<section class="story-tip-band">
  <div class="shell story-tip-inner">
    <div><p class="eyebrow">Invite participation</p><h2>Give readers a clear path to share a tip, document, or correction.</h2><p>The starter uses email by default so no unprotected form or server is required.</p></div>
    <a class="button button-light" href="${escapeHtml(site.submit_story_url || '/submit/')}">Open submission guidance ${icon('arrow')}</a>
  </div>
</section>`;

writeRoute('/', layout({
  route: '/',
  title: site.title,
  description: site.description,
  canonical: absoluteUrl('/'),
  pageClass: 'home-page',
  body: homeBody
}));

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

const searchBody = `<section class="page-hero page-hero-search"><div class="shell page-hero-grid"><div><p class="eyebrow">Search</p><h1>Find a story, topic, contributor, or source document.</h1><p class="lede">Search runs entirely in the browser against a small static index. No query is sent to a database or third-party search service.</p></div><span class="hero-illustration" aria-hidden="true">${icon('search')}</span></div></section>
<section class="section shell search-layout" data-publication-search data-index-url="/search-index.json" data-result-limit="${Number(site.discovery?.search_result_limit || 50)}">
  <form class="search-form" role="search" data-search-form>
    <div class="search-field"><label for="publication-search">Search the publication</label><div class="search-input-wrap">${icon('search')}<input id="publication-search" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-describedby="publication-search-help" placeholder="Try a name, place, phrase, or document topic" data-search-input><span class="visually-hidden" id="publication-search-help">Results update as you type. Use the Search button to move focus to the result summary.</span></div></div>
    <div class="search-filter"><label for="publication-search-type">Format</label><select id="publication-search-type" name="type" data-search-type><option value="">All formats</option><option value="standard">Written stories</option><option value="pdf">PDF records</option><option value="mixed">Stories + PDFs</option><option value="external">External documents</option></select></div>
    <div class="search-filter"><label for="publication-search-category">Category</label><select id="publication-search-category" name="category" data-search-category><option value="">All categories</option>${categories.map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</option>`).join('')}</select></div>
    <button class="button" type="submit">Search ${icon('arrow')}</button>
  </form>
  <p class="search-status" id="publication-search-status" data-search-status role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Enter a search term or choose a format.</p>
  <div class="search-results" data-search-results aria-labelledby="publication-search-status" aria-busy="true"></div>
  <noscript><div class="search-noscript"><h2>JavaScript is required for instant search.</h2><p>You can still browse by <a href="/categories/">category</a>, <a href="/topics/">topic</a>, <a href="/authors/">contributor</a>, <a href="/archive/">date</a>, or the <a href="/stories/">complete story archive</a>.</p></div></noscript>
</section>`;
writeRoute('/search/', layout({ route: '/search/', title: 'Search', description: `Search published stories and documents from ${site.title}.`, canonical: absoluteUrl('/search/'), pageClass: 'search-page', body: searchBody }));

const categoryCards = categories.map((category) => {
  const items = published.filter((article) => (article.categories || []).includes(category.slug));
  return `<a class="discovery-card" href="/categories/${escapeHtml(category.slug)}/"><span class="eyebrow">Category</span><h2>${escapeHtml(category.name)}</h2><p>${escapeHtml(category.description || 'Browse this publication category.')}</p><strong>${items.length} ${items.length === 1 ? 'entry' : 'entries'} ${icon('arrow')}</strong></a>`;
}).join('');
writeRoute('/categories/', layout({ route: '/categories/', title: 'Categories', description: `Browse ${site.title} by category.`, canonical: absoluteUrl('/categories/'), pageClass: 'discovery-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Browse by category</p><h1>Stable editorial lanes.</h1><p class="lede">Categories provide broad, intentional groupings for recurring publication work.</p></div></section><section class="section shell discovery-grid">${categoryCards || '<p>No categories are configured.</p>'}</section>` }));
for (const category of categories) {
  const items = published.filter((article) => (article.categories || []).includes(category.slug));
  writePaginatedArchive({ base: `/categories/${category.slug}/`, title: category.name, description: category.description || `Published entries in ${category.name}.`, eyebrow: 'Category archive', items, pageClass: 'category-archive-page' });
}

writeRoute('/topics/', layout({ route: '/topics/', title: 'Topics', description: `Browse ${site.title} by topic.`, canonical: absoluteUrl('/topics/'), pageClass: 'discovery-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Browse by topic</p><h1>Specific subjects across the archive.</h1><p class="lede">Topics are generated from article tags and remain linked to every related published entry.</p></div></section><section class="section shell"><div class="topic-cloud">${topics.map((topic) => `<a href="/topics/${escapeHtml(topic.slug)}/"><span>${escapeHtml(topic.name)}</span><strong>${topic.count}</strong></a>`).join('') || '<p>No topics are published yet.</p>'}</div></section>` }));
for (const topic of topics) {
  const items = published.filter((article) => (article.tags || []).some((tag) => topicSlug(tag) === topic.slug));
  writePaginatedArchive({ base: `/topics/${topic.slug}/`, title: topic.name, description: `Published entries tagged “${topic.name}.”`, eyebrow: 'Topic archive', items, pageClass: 'topic-archive-page' });
}

const activeAuthors = authors.filter((author) => author.active !== false);
writeRoute('/authors/', layout({ route: '/authors/', title: 'Contributors', description: `Browse contributors to ${site.title}.`, canonical: absoluteUrl('/authors/'), pageClass: 'discovery-index-page', body: `<section class="page-hero"><div class="shell narrow"><p class="eyebrow">Contributors</p><h1>People behind the publishing.</h1><p class="lede">Contributor pages gather each person’s published work without exposing private editor data.</p></div></section><section class="section shell discovery-grid">${activeAuthors.map((author) => { const count = published.filter((article) => article.author === author.slug).length; return `<a class="discovery-card" href="/authors/${escapeHtml(author.slug)}/"><span class="author-card-mark" aria-hidden="true">${escapeHtml(author.name.charAt(0))}</span><span class="eyebrow">${escapeHtml(author.role || 'Contributor')}</span><h2>${escapeHtml(author.name)}</h2><p>${escapeHtml(author.bio || 'Published contributor.')}</p><strong>${count} ${count === 1 ? 'entry' : 'entries'} ${icon('arrow')}</strong></a>`; }).join('') || '<p>No active contributors are configured.</p>'}</section>` }));
for (const author of activeAuthors) {
  const items = published.filter((article) => article.author === author.slug);
  writePaginatedArchive({ base: `/authors/${author.slug}/`, title: author.name, description: author.bio || `Published entries by ${author.name}.`, eyebrow: author.role || 'Contributor archive', items, pageClass: 'author-archive-page' });
}

const dateGroups = new Map();
const crosswordBody = `<section class="page-hero page-hero-crossword"><div class="shell page-hero-grid"><div><p class="eyebrow">The daily press break</p><h1>A rotating static mini crossword.</h1><p class="lede">Seven hand-set word-square puzzles rotate by date entirely in the browser. No account, database, analytics call, or puzzle service is involved.</p></div><span class="hero-illustration" aria-hidden="true">${icon('puzzle')}</span></div></section>
<section class="section shell crossword-layout" data-crossword-app>
  <div class="crossword-paper">
    <div class="crossword-mast"><p class="eyebrow">TAHAI Press Mini</p><h2 data-crossword-title>Loading today's edition...</h2><p data-crossword-deck>A five-by-five daily word square.</p></div>
    <div class="crossword-grid-wrap"><div class="crossword-grid" data-crossword-grid role="group" aria-label="Five by five crossword grid"></div><p class="crossword-status" data-crossword-status role="status" aria-live="polite">Enter one letter in each square.</p></div>
    <div class="crossword-controls"><button class="button" type="button" data-crossword-check>Check answers</button><button class="button button-secondary" type="button" data-crossword-reveal>Reveal</button><button class="button button-quiet" type="button" data-crossword-reset>Reset</button><button class="button button-quiet" type="button" data-crossword-next>Next puzzle</button></div>
  </div>
  <aside class="crossword-clues"><section><p class="eyebrow">Across</p><ol data-crossword-across></ol></section><section><p class="eyebrow">Down</p><ol data-crossword-down></ol></section><p class="crossword-note">Because each edition is a word square, the across and down answers cross perfectly. Progress is stored only in this browser.</p></aside>
  <noscript><div class="search-noscript"><h2>JavaScript is required for the interactive grid.</h2><p>The rest of TAHAI Press remains readable without JavaScript.</p></div></noscript>
</section>`;
writeRoute('/puzzles/', layout({ route: '/puzzles/', title: 'Daily Crossword', description: 'Solve the rotating static TAHAI Press mini crossword.', canonical: absoluteUrl('/puzzles/'), pageClass: 'crossword-page', body: crosswordBody }));

for (const article of published) {
  const parts = archiveDateParts(article.published_at);
  if (!parts) continue;
  const year = dateGroups.get(parts.year) || new Map();
  const month = year.get(parts.month) || [];
  month.push(article);
  year.set(parts.month, month);
  dateGroups.set(parts.year, year);
}
const yearLinks = [...dateGroups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => `<section class="date-archive-year"><h2><a href="/archive/${year}/">${year}</a></h2><div>${[...months.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, items]) => { const label = new Intl.DateTimeFormat(site.locale, { month: 'long', timeZone: 'UTC' }).format(new Date(`${year}-${month}-01T12:00:00Z`)); return `<a href="/archive/${year}/${month}/"><span>${escapeHtml(label)}</span><strong>${items.length}</strong></a>`; }).join('')}</div></section>`).join('');
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
  <div class="hub-grid">${activeHubs.length ? activeHubs.map((hub) => `<article class="hub-card" id="${escapeHtml(hub.slug)}"><span class="hub-card-icon">${icon('location')}</span><p class="eyebrow">${escapeHtml(hub.region || 'Coverage lane')}</p><h3>${escapeHtml(hub.name)}</h3><p>${escapeHtml(hub.description || 'Organized stories and public information.')}</p><a class="text-link" href="/hubs/${escapeHtml(hub.slug)}/">View related stories ${icon('arrow')}</a></article>`).join('') : '<p>No active hubs are configured yet.</p>'}</div>
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
    <p>The public repository includes the generator, Pages CMS editing model, WordPress and bulk import tools, redirect preservation, browser search, feeds, accessibility checks, document-reader fallbacks, and deployment proof.</p>
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
        <li>Readable text widths, responsive layouts, reduced-motion support, and high-contrast system-mode support.</li>
        <li>Alternative direct links for PDF documents when the embedded browser preview is unavailable.</li>
      </ul>
      <h2>PDF and source-document limitations</h2>
      <p>Embedded PDF behavior depends on the reader’s browser and assistive technology. Every PDF-first page keeps a direct open link, and locally hosted documents can also provide a download link. Publishers should add accessible article context and should remediate source documents whenever they control the original file.</p>
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
    { label: 'Format', value: articleTemplateLabel(article) },
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
      <div class="story-card-labels">${article.categories?.[0] ? `<a class="eyebrow discovery-label-link" href="/categories/${escapeHtml(article.categories[0])}/">${escapeHtml(kicker)}</a>` : `<span class="eyebrow">${escapeHtml(kicker)}</span>`}<span class="format-label">${escapeHtml(articleFormat(article))}</span></div>
      <h1>${escapeHtml(article.title)}</h1>
      <p class="article-deck">${escapeHtml(article.excerpt)}</p>
      ${renderArticleByline(article, author, hub)}
      ${headerFacts}
    </header>
    ${article.featured_image ? `<figure class="article-featured-image"><img src="${escapeHtml(safeUrl(article.featured_image))}" alt="${escapeHtml(article.featured_image_alt)}"></figure>` : ''}
    <div class="article-template article-template-${escapeHtml(article.article_type)}">${primaryContent}</div>
    ${renderSources(sourceLinks)}
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
    pageClass: `article-page article-page-${article.article_type}`,
    article,
    author,
    categoryNames,
    tags: article.tags || [],
    socialImage: article.featured_image || site.default_social_image,
    socialImageAlt: article.featured_image ? article.featured_image_alt : site.default_social_image_alt,
    body: articleBody
  }), { sitemap: !article.noindex, lastmod: machineDate(article.updated_at || article.published_at) });
}

const newestPublicationDate = machineDate(published[0]?.updated_at || published[0]?.published_at || '');
const sitemapEntries = routeManifest.map((entry) => ({ ...entry, lastmod: entry.lastmod || newestPublicationDate }));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemapEntries), 'utf8');
fs.writeFileSync(path.join(DIST, 'feed.xml'), buildRss({ site, articles: published, authors, categories }), 'utf8');
fs.writeFileSync(path.join(DIST, 'feed.json'), `${jsonForHtml(buildJsonFeed({ site, articles: published, authors }))}\n`, 'utf8');
fs.writeFileSync(path.join(DIST, 'site.webmanifest'), `${JSON.stringify({
  name: site.title,
  short_name: site.short_title,
  description: site.description,
  start_url: '/',
  display: 'browser',
  background_color: safeThemeColor(site.theme?.paper, '#fffefb'),
  theme_color: safeThemeColor(site.theme?.brand, '#17324d'),
  icons: [{ src: '/assets/tahai-press-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/assets/tahai-press-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }]
}, null, 2)}\n`, 'utf8');

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
  node: process.version
};
fs.writeFileSync(path.join(wellKnown, 'publication-build.json'), `${JSON.stringify(buildInfo, null, 2)}\n`);
fs.writeFileSync(path.join(wellKnown, 'tahai-press.json'), `${JSON.stringify(TAHAI_PRESS_PROVENANCE, null, 2)}\n`);
fs.writeFileSync(path.join(DIST, 'humans.txt'), humansText(), 'utf8');

fs.writeFileSync(path.join(wellKnown, 'publication-health.json'), `${JSON.stringify({
  ok: true,
  output: 'static',
  environment: deployment.environment,
  commit: deployment.shortCommit,
  article_count: published.length,
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

console.log(`TAHAI Press built ${published.length} published article(s), ${routeManifest.length} routes, and the static crossword into ${path.relative(ROOT, DIST)}/ (${deployment.environment}:${deployment.branch}).`);
