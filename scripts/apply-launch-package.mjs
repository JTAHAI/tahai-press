import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './lib/content.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

if (!process.argv.includes('--confirm')) {
  console.error('Launch application changes publication files. Run: npm run launch:apply -- --package <tahai-press-launch-package.json> --confirm');
  process.exit(1);
}

const packageArg = argument('--package');
if (!packageArg) {
  console.error('Missing --package <file>.');
  process.exit(1);
}

const packagePath = path.resolve(process.cwd(), packageArg);
if (!fs.existsSync(packagePath)) {
  console.error(`Launch package not found: ${packagePath}`);
  process.exit(1);
}

const payload = readJson(packagePath);
if (payload.schema_version !== 1 || payload.software !== 'TAHAI Press') {
  console.error('This is not a supported TAHAI Press Launch Desk package.');
  process.exit(1);
}
if (!payload.site_config || typeof payload.site_config !== 'object') {
  console.error('Launch package is missing site_config.');
  process.exit(1);
}
if (!payload.first_article?.slug || !payload.first_article?.title) {
  console.error('Launch package is missing a valid first_article.');
  process.exit(1);
}
if (payload.site_config.template_mode !== false) {
  console.error('Launch package must disable template_mode before it can be applied.');
  process.exit(1);
}

const contentRoot = path.join(ROOT, 'content');
const articleRoot = path.join(contentRoot, 'articles');
const authorRoot = path.join(contentRoot, 'authors');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(ROOT, '.artifacts', `launch-backup-${stamp}`);
fs.mkdirSync(backupRoot, { recursive: true });

function backup(relativePath) {
  const source = path.join(ROOT, relativePath);
  if (!fs.existsSync(source)) return false;
  const destination = path.join(backupRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
}

backup('content/site.json');
for (const filename of payload.demo_article_files || []) backup(`content/articles/${filename}`);
backup('content/authors/editorial-team.json');

fs.mkdirSync(articleRoot, { recursive: true });
for (const filename of payload.demo_article_files || []) {
  if (!/^[a-z0-9][a-z0-9._-]*\.json$/i.test(filename)) continue;
  fs.rmSync(path.join(articleRoot, filename), { force: true });
}

fs.writeFileSync(path.join(contentRoot, 'site.json'), `${JSON.stringify(payload.site_config, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(articleRoot, `${payload.first_article.slug}.json`), `${JSON.stringify(payload.first_article, null, 2)}\n`, 'utf8');

if (payload.author_record?.slug) {
  fs.mkdirSync(authorRoot, { recursive: true });
  fs.writeFileSync(path.join(authorRoot, `${payload.author_record.slug}.json`), `${JSON.stringify(payload.author_record, null, 2)}\n`, 'utf8');
}

console.log('TAHAI Press Launch Desk package applied.');
console.log(`Backup: ${path.relative(ROOT, backupRoot)}`);
console.log(`Publication: ${payload.site_config.title}`);
console.log(`First story: content/articles/${payload.first_article.slug}.json (Draft)`);
console.log('Next: npm run validate && npm test && npm run build:cloudflare');
