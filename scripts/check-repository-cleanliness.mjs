import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', '.artifacts', 'release-proof', 'proof']);
const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.pdf', '.ico', '.zip']);
const errors = [];
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    const relative = path.relative(ROOT, full).replaceAll('\\', '/');
    if (entry.isDirectory()) walk(full);
    else files.push({ full, relative });
  }
}

walk(ROOT);

for (const { full, relative } of files) {
  if (relative === 'scripts/check-repository-cleanliness.mjs') continue;
  if (/^(?:PASS\d|proof\/pass-|docs\/PASS-)/i.test(relative) || /pass-\d{2}/i.test(relative)) {
    errors.push(`Pass-era path remains: ${relative}`);
  }
  if (binaryExtensions.has(path.extname(relative).toLowerCase())) continue;
  const text = fs.readFileSync(full, 'utf8');
  if (/\bOpen Publication(?: Starter)?\b/i.test(text)) errors.push(`Retired demo identity remains in ${relative}`);
  if (/\bPass\s*\d{1,2}\b/i.test(text) || /\bpass-\d{2}\b/i.test(text)) errors.push(`Pass-era note remains in ${relative}`);
}

const required = [
  'README.md', 'LICENSE', 'CHANGELOG.md', 'SUPPORT.md', 'CITATION.cff', '.gitattributes',
  'github-pages/index.html', 'github-pages/assets/site.css',
  'public/assets/tahai-press-logo.png', 'public/assets/crossword.js'
];
for (const relative of required) {
  if (!fs.existsSync(path.join(ROOT, relative))) errors.push(`Required public-repository file is missing: ${relative}`);
}

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
for (const link of ['https://github.com/JTAHAI/tahai-press', 'https://tahai.net']) {
  if (!readme.includes(link)) errors.push(`README is missing ${link}`);
}

if (errors.length) {
  console.error(`Repository cleanliness check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Repository cleanliness check passed across ${files.length} tracked-source candidates.`);
}
