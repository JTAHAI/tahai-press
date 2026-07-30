import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/lib/content.mjs';

const TEXT_EXTENSIONS = new Set(['.json', '.md', '.mjs', '.yml', '.yaml', '.css', '.html', '.txt']);
const EXCLUDED_DIRECTORIES = new Set(['dist', '.git', 'node_modules']);

function collectTextFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    if (entry.name === 'package-lock.json') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collectTextFiles(full, files);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

test('source uses a branded demo identity while retaining placeholder production contacts and fork-safe settings', () => {
  const files = collectTextFiles(ROOT);
  const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.match(combined, /TAHAI Press/);
  assert.match(combined, /Created by Justin Tahai and TAHAI Web Services/);
  const retiredDisplayName = ['TAHAI Press', 'Starter'].join(' ');
  const retiredPackageName = ['open-publication', 'starter'].join('-');
  assert.equal(combined.toLowerCase().includes(retiredDisplayName.toLowerCase()), false);
  assert.equal(combined.toLowerCase().includes(retiredPackageName.toLowerCase()), false);
  assert.match(combined, /https:\/\/example\.pages\.dev/);
  assert.match(combined, /editor@example\.org/);
  const urls = combined.match(/https:\/\/[^\s\"'`)]+/gi) || [];
  const allowedHosts = new Set(['example.pages.dev', 'example.org', 'news.example.org', 'legacy.example.org', 'old.example', 'old.example.org', 'example.com', 'json-schema.org', 'jsonfeed.org', 'schema.org', 'github.com', 'tahai.net', 'tahai-press.tahai.net', 'purl.org', 'jtahai.github.io', 'img.shields.io', 'pagescms.org', 'unpkg.com', 'registry.npmjs.org', 'opencollective.com', 'npmjs.com', 'www.npmjs.com']);
  for (const raw of urls) {
    const value = raw.replace(/[.,;:]+$/, '');
    let parsed;
    try { parsed = new URL(value); } catch { continue; } // Skip URL-like validation patterns in config files.
    assert.equal(allowedHosts.has(parsed.hostname), true, `unexpected production-like URL: ${value}`);
  }
});
