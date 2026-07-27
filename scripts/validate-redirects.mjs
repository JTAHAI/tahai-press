import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadContent } from './lib/content.mjs';
import { createRedirectPlan, readRedirectConfig, routeFileForPath, targetPath } from './lib/redirects.mjs';

const { site, articles } = loadContent();
const config = readRedirectConfig();
const errors = [];

try {
  const raw = JSON.parse(fs.readFileSync(config.__file, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) errors.push('content/redirects.json must be an object with a redirects array');
  else if (!Array.isArray(raw.redirects)) errors.push('content/redirects.json redirects must be an array');
  else {
    for (const [index, item] of raw.redirects.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) errors.push(`redirect #${index + 1} must be an object`);
      for (const key of Object.keys(item || {})) {
        if (!['from', 'to', 'status', 'preserve_query_string', 'note'].includes(key)) errors.push(`redirect #${index + 1} contains unsupported field: ${key}`);
      }
      if (item?.preserve_query_string !== undefined && typeof item.preserve_query_string !== 'boolean') errors.push(`redirect #${index + 1} preserve_query_string must be true or false`);
      if (item?.note !== undefined && (typeof item.note !== 'string' || item.note.length > 500)) errors.push(`redirect #${index + 1} note must be a string of 500 characters or fewer`);
    }
  }
} catch (error) {
  errors.push(`content/redirects.json is invalid: ${error.message}`);
}

const plan = createRedirectPlan({ site, articles, config, checkTargets: false });
errors.push(...plan.errors);

const expected = new Set(['/', '/stories/', '/hubs/', '/about/', '/submit/', '/contact/', '/404.html']);
for (const article of articles) if (article.status === 'published') expected.add(`/stories/${article.slug}/`);
const publicRoot = path.join(ROOT, 'public');
if (fs.existsSync(publicRoot)) {
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  for (const file of walk(publicRoot)) expected.add(`/${path.relative(publicRoot, file).replaceAll('\\', '/')}`);
}

for (const rule of plan.rules) {
  const target = targetPath(rule.target);
  if (target && !expected.has(target)) errors.push(`${rule.origin}: internal target is not a generated route or public asset (${target})`);
  if (expected.has(rule.source)) errors.push(`${rule.origin}: source collides with a generated route or public asset (${rule.source})`);
}

if (errors.length) {
  console.error(`Redirect validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Redirect config valid: ${plan.counts.total} static rule(s), ${plan.counts.article_aliases} article alias(es), no duplicates, chains, loops, or route collisions.`);
