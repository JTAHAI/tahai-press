import fs from 'node:fs';
import path from 'node:path';
import { DIST, ROOT, loadContent } from './lib/content.mjs';
import { accessibilityStatement } from './lib/accessibility.mjs';

const args = process.argv.slice(2);
const reportIndex = args.indexOf('--report');
const reportPath = reportIndex >= 0 && args[reportIndex + 1]
  ? path.resolve(ROOT, args[reportIndex + 1])
  : null;

if (!fs.existsSync(DIST)) {
  console.error('Reader experience audit requires dist/. Run npm run build first.');
  process.exit(1);
}

const { site, articles } = loadContent();
const settings = accessibilityStatement(site);
const published = articles.filter((article) => article.status === 'published');
const errors = [];
const checks = [];
const pass = (name, ok, detail = '') => {
  checks.push({ name, passed: ok, detail });
  if (!ok) errors.push(`${name}${detail ? `: ${detail}` : ''}`);
};

const cssPath = path.join(DIST, 'assets', 'styles.css');
const jsPath = path.join(DIST, 'assets', 'reading-tools.js');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
const script = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf8') : '';

if (settings.readerToolsEnabled) {
  pass('reader tools asset exists', Boolean(script), 'dist/assets/reading-tools.js');
  pass('reader tools are browser-local', /localStorage/.test(script) && !/\bfetch\s*\(/.test(script), 'must use localStorage without network requests');
  for (const selector of [
    "data-reader-text", "data-reader-spacing", "data-reader-measure", "data-reader-surface",
    "reader-underline-links", "reader-simplified", "reader-reduce-motion"
  ]) pass(`reader preference contract: ${selector}`, css.includes(selector) || script.includes(selector));
}

let readerRoutes = 0;
let documentSummaries = 0;
for (const article of published) {
  const articlePath = path.join(DIST, 'stories', article.slug, 'index.html');
  const readerPath = path.join(DIST, 'stories', article.slug, 'reader', 'index.html');
  const html = fs.existsSync(articlePath) ? fs.readFileSync(articlePath, 'utf8') : '';
  pass(`article route exists: ${article.slug}`, Boolean(html));

  if (settings.simplifiedReadingEnabled) {
    pass(`standard article links to simplified view: ${article.slug}`, html.includes(`/stories/${article.slug}/reader/`));
    const reader = fs.existsSync(readerPath) ? fs.readFileSync(readerPath, 'utf8') : '';
    pass(`simplified route exists: ${article.slug}`, Boolean(reader));
    if (reader) {
      readerRoutes += 1;
      pass(`simplified route is noindex: ${article.slug}`, /<meta name="robots" content="[^"]*noindex/.test(reader));
      pass(`simplified route avoids embedded PDF: ${article.slug}`, !/<iframe\b/i.test(reader));
      pass(`simplified route keeps one primary heading: ${article.slug}`, (reader.match(/<h1\b/gi) || []).length === 1);
      pass(`simplified route points canonical to standard article: ${article.slug}`, reader.includes(`<link rel="canonical" href="${article.canonical_url || new URL(`/stories/${article.slug}/`, site.site_url).href}">`));
    }
  }

  if (['pdf', 'mixed', 'external'].includes(article.article_type)) {
    const hasSummary = html.includes('document-accessible-summary') && html.includes('Document summary in HTML');
    pass(`document HTML alternative exists: ${article.slug}`, hasSummary);
    if (hasSummary) documentSummaries += 1;
  }
}

pass('400 percent zoom fallback is present', /@media \(max-width: 20rem\)/.test(css));
pass('minimum interactive target contract is present', /min-block-size:\s*2\.75rem/.test(css));

const report = {
  schema_version: 1,
  audit: 'TAHAI Press reader experience audit',
  passed: errors.length === 0,
  published_articles: published.length,
  simplified_routes: readerRoutes,
  document_html_summaries: documentSummaries,
  check_count: checks.length,
  error_count: errors.length,
  checks,
  errors
};

if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`Reader experience audit failed: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`Reader experience audit passed: ${published.length} article(s), ${readerRoutes} simplified route(s), ${documentSummaries} document summary route(s).`);
