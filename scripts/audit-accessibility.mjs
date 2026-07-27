import fs from 'node:fs';
import path from 'node:path';
import { DIST, ROOT } from './lib/content.mjs';

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function stripTags(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z0-9#]+;/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function collectIds(html) {
  return [...html.matchAll(/\sid=(?:"([^"]+)"|'([^']+)')/gi)].map((match) => match[1] || match[2]);
}

function checkPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(DIST, file).replaceAll(path.sep, '/');
  const errors = [];
  const warnings = [];
  const fail = (message) => errors.push(message);
  const warn = (message) => warnings.push(message);

  if (!/^<!doctype html>/i.test(html.trimStart())) fail('missing HTML doctype');
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || '';
  if (!attribute(htmlTag, 'lang')) fail('html element is missing a language');
  if (!/<meta\s+name="viewport"\s+content="[^"]*width=device-width/i.test(html)) fail('missing responsive viewport metadata');
  if (!stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1])) fail('document title is empty');

  const mains = [...html.matchAll(/<main\b[^>]*>/gi)].map((match) => match[0]);
  if (mains.length !== 1) fail(`expected exactly one main landmark; found ${mains.length}`);
  else {
    if (attribute(mains[0], 'id') !== 'main') fail('main landmark must use id="main"');
    if (attribute(mains[0], 'tabindex') !== '-1') fail('main landmark must support programmatic focus with tabindex="-1"');
  }
  if (!/<a\b[^>]*class="[^"]*skip-link[^"]*"[^>]*href="#main"/i.test(html)) fail('missing skip link to #main');

  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) fail(`expected exactly one h1; found ${h1Count}`);

  const ids = collectIds(html);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) fail(`duplicate ids: ${duplicates.join(', ')}`);
  const idSet = new Set(ids);

  for (const match of html.matchAll(/\saria-(?:labelledby|describedby)=(?:"([^"]+)"|'([^']+)')/gi)) {
    const references = (match[1] || match[2] || '').split(/\s+/).filter(Boolean);
    for (const reference of references) if (!idSet.has(reference)) fail(`ARIA reference does not resolve: ${reference}`);
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    if (attribute(match[0], 'alt') === null) fail(`image is missing alt text: ${match[0].slice(0, 120)}`);
  }
  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    if (!attribute(match[0], 'title')) fail('iframe is missing a non-empty title');
  }

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const tag = `<button${match[1]}>`;
    const name = stripTags(match[2]) || attribute(tag, 'aria-label') || attribute(tag, 'title');
    if (!name) fail('button is missing an accessible name');
  }

  for (const match of html.matchAll(/<a\b[^>]*target=(?:"_blank"|'_blank')[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = match[0].match(/^<a\b[^>]*>/i)?.[0] || '';
    const rel = (attribute(tag, 'rel') || '').split(/\s+/);
    if (!rel.includes('noopener')) fail('new-tab link is missing rel="noopener"');
    if (!rel.includes('noreferrer')) warn('new-tab link should include noreferrer for privacy');
    if (!/class="[^"]*new-tab-note[^"]*"/i.test(match[0]) && !/opens in (?:a )?new tab/i.test(stripTags(match[0]))) {
      fail('new-tab link is missing an accessible new-tab notice');
    }
  }

  const labels = new Set([...html.matchAll(/<label\b[^>]*for=(?:"([^"]+)"|'([^']+)')/gi)].map((match) => match[1] || match[2]));
  for (const match of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = match[0];
    if (attribute(tag, 'type')?.toLowerCase() === 'hidden') continue;
    const id = attribute(tag, 'id');
    const named = attribute(tag, 'aria-label') || attribute(tag, 'aria-labelledby');
    if (!named && (!id || !labels.has(id))) fail(`${match[1].toLowerCase()} control is missing an associated label`);
  }

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] > headings[index - 1] + 1) warn(`heading order skips from h${headings[index - 1]} to h${headings[index]}`);
  }

  if (/<a\b[^>]*href=(?:""|'')/i.test(html)) fail('empty link destination');

  return { file: relative, errors, warnings };
}

const args = process.argv.slice(2);
const reportIndex = args.indexOf('--report');
const reportPath = reportIndex >= 0 && args[reportIndex + 1]
  ? path.resolve(ROOT, args[reportIndex + 1])
  : null;

if (!fs.existsSync(DIST)) {
  console.error('Accessibility audit requires a built dist/ directory. Run npm run build first.');
  process.exit(1);
}

const pages = walk(DIST).filter((file) => file.endsWith('.html')).map(checkPage);
const errors = pages.flatMap((page) => page.errors.map((message) => `${page.file}: ${message}`));
const warnings = pages.flatMap((page) => page.warnings.map((message) => `${page.file}: ${message}`));
const report = {
  schema_version: 1,
  audit: 'TAHAI Press static accessibility audit',
  page_count: pages.length,
  error_count: errors.length,
  warning_count: warnings.length,
  passed: errors.length === 0,
  checks: [
    'document language and titles',
    'main landmark and skip-link target',
    'single primary heading',
    'unique IDs and resolved ARIA references',
    'image and iframe alternatives',
    'button and form-control names',
    'safe and announced new-tab links',
    'basic heading-order review'
  ],
  pages,
  errors,
  warnings
};

if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

for (const warning of warnings) console.warn(`WARNING ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`Accessibility audit failed: ${errors.length} error(s), ${warnings.length} warning(s) across ${pages.length} page(s).`);
  process.exit(1);
}
console.log(`Accessibility audit passed: ${pages.length} page(s), ${warnings.length} warning(s), 0 errors.`);
