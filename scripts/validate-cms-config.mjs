import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';

const configPath = path.join(ROOT, '.pages.yml');
const schemaPath = path.join(ROOT, 'schemas', 'article.schema.json');
const source = fs.readFileSync(configPath, 'utf8');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const errors = [];

function requireMatch(pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}
function sectionBetween(startPattern, endPattern) {
  const start = source.search(startPattern);
  if (start < 0) return '';
  const tail = source.slice(start);
  const end = tail.slice(1).search(endPattern);
  return end < 0 ? tail : tail.slice(0, end + 1);
}

function yamlDoubleQuotedEscapeErrors(text) {
  const findings = [];
  const singleEscapes = new Set(['0', 'a', 'b', 't', 'n', 'v', 'f', 'r', 'e', ' ', '"', '/', '\\', 'N', '_', 'L', 'P']);
  const hexLengths = { x: 2, u: 4, U: 8 };
  const lineAt = (index) => text.slice(0, index).split('\n').length;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '#') {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (character === "'") {
      index += 1;
      while (index < text.length) {
        if (text[index] === "'" && text[index + 1] === "'") {
          index += 2;
          continue;
        }
        if (text[index] === "'") break;
        index += 1;
      }
      continue;
    }
    if (character !== '"') continue;

    index += 1;
    while (index < text.length && text[index] !== '"') {
      if (text[index] !== '\\') {
        index += 1;
        continue;
      }
      const escapeIndex = index;
      const marker = text[index + 1];
      if (singleEscapes.has(marker)) {
        index += 2;
        continue;
      }
      if (Object.hasOwn(hexLengths, marker)) {
        const length = hexLengths[marker];
        const digits = text.slice(index + 2, index + 2 + length);
        if (digits.length !== length || !new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(digits)) {
          findings.push(`line ${lineAt(escapeIndex)} has an incomplete or invalid \\${marker} escape`);
        }
        index += 2 + length;
        continue;
      }
      findings.push(`line ${lineAt(escapeIndex)} has an invalid YAML double-quoted escape \\${marker || '(end of file)'}`);
      index += 2;
    }
  }
  return findings;
}

if (/\t/.test(source)) errors.push('tabs are not allowed in .pages.yml');
if (/ +$/m.test(source)) errors.push('trailing spaces are not allowed in .pages.yml');
if (!source.endsWith('\n')) errors.push('.pages.yml must end with a newline');
for (const finding of yamlDoubleQuotedEscapeErrors(source)) errors.push(finding);

for (const key of ['media:', 'components:', 'settings:', 'content:']) requireMatch(new RegExp(`^${key.replace(':', '\\:')}`, 'm'), `missing top-level ${key}`);
requireMatch(/^\s+hide: true$/m, 'Pages CMS settings page must remain hidden for the simplified editor workflow');
requireMatch(/^\s+merge: true$/m, 'structured content must use merge mode to preserve unmanaged keys');
requireMatch(/input: public\/uploads\/images[\s\S]*output: \/uploads\/images/, 'image media paths are not configured safely');
requireMatch(/input: public\/uploads\/documents[\s\S]*output: \/uploads\/documents/, 'document media paths are not configured safely');
requireMatch(/extensions: \[pdf\]/, 'document uploads must be restricted to PDF files');
requireMatch(/rename: safe/, 'uploaded media must use safe filenames');

const articleSection = sectionBetween(/^\s{6}- name: articles$/m, /^\s{2}- name: newsroom$/m);
if (!articleSection) errors.push('articles collection is missing');
else {
  requireMatch(/template: "\{fields\.slug\}\.json"/, 'article filenames must be derived from the explicit slug field');
  if (!/filename:\n\s+template: "\{fields\.slug\}\.json"\n\s+field: false/.test(articleSection)) errors.push('article filename input must be hidden and derived from slug');
  if (!/name: status[\s\S]*?default: draft/.test(articleSection)) errors.push('new articles must default to Draft');
  if (!/name: article_type[\s\S]*?default: standard/.test(articleSection)) errors.push('new articles must default to Written article');
  if (!/name: body[\s\S]*?format: markdown/.test(articleSection)) errors.push('article body must save Markdown');
  if (!/name: pdf_file[\s\S]*?media: documents[\s\S]*?extensions: \[pdf\]/.test(articleSection)) errors.push('article PDF field must use the documents media source and PDF extension restriction');
  if (!/name: legacy_urls[\s\S]*?list:[\s\S]*?max: 30/.test(articleSection)) errors.push('article previous-URL field must support a bounded list of legacy aliases');

  const configuredFields = new Set([...articleSection.matchAll(/^\s{10}- name: ([a-z0-9_]+)$/gm)].map((match) => match[1]));
  for (const field of Object.keys(schema.properties || {})) {
    if (!configuredFields.has(field)) errors.push(`article schema field is missing from Pages CMS: ${field}`);
  }
  for (const field of ['review_content', 'review_rights', 'review_accessibility', 'editor_notes']) {
    if (!configuredFields.has(field)) errors.push(`publishing safety field is missing: ${field}`);
  }
}

requireMatch(/^\s{6}- name: redirects$[\s\S]*?path: content\/redirects\.json[\s\S]*?name: preserve_query_string/m, 'manual redirects editor is missing or incomplete');
requireMatch(/name: site_url[\s\S]*?regex: "\^https:\/\//, 'site URL editor must require HTTPS');

const collectionNames = [...source.matchAll(/^\s{6}- name: ([a-z0-9_]+)$/gm)].map((match) => match[1]);
const duplicates = collectionNames.filter((name, index) => collectionNames.indexOf(name) !== index);
if (duplicates.length) errors.push(`duplicate collection names: ${[...new Set(duplicates)].join(', ')}`);

for (const forbidden of ['password', 'secret_key', 'api_key', 'private_key']) {
  if (new RegExp(`name: ${forbidden}`, 'i').test(source)) errors.push(`CMS must not expose secret field: ${forbidden}`);
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR .pages.yml: ${error}`);
  console.error(`\nPages CMS validation failed: ${errors.length} error(s).`);
  process.exit(1);
}

console.log(`Pages CMS config valid: ${Object.keys(schema.properties || {}).length} article fields exposed with draft-first publishing safeguards.`);
