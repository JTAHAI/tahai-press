import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './lib/content.mjs';
import { containedPath, safeJsonFilename, safeSlug } from './lib/safe-paths.mjs';

function argument(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ''; }
function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function copyIfPresent(source, destination) { if (fs.existsSync(source)) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.cpSync(source, destination, { recursive: true, force: true, dereference: false }); } }
function replaceFile(file, content, rollback) {
  const before = fs.existsSync(file) ? fs.readFileSync(file) : null;
  rollback.push(() => before === null ? fs.rmSync(file, { force: true }) : fs.writeFileSync(file, before));
  const temporary = `${file}.launch-${process.pid}.tmp`;
  fs.writeFileSync(temporary, content); fs.renameSync(temporary, file);
}
function removeFile(file, rollback) { if (fs.existsSync(file)) { const before = fs.readFileSync(file); rollback.push(() => fs.writeFileSync(file, before)); fs.rmSync(file, { force: true }); } }

function validate(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.schema_version !== 1 || payload.software !== 'TAHAI Press') throw new Error('This is not a supported TAHAI Press Launch Desk package.');
  if (!payload.site_config || typeof payload.site_config !== 'object' || Array.isArray(payload.site_config)) throw new Error('Launch package is missing site_config.');
  if (payload.site_config.template_mode !== false) throw new Error('Launch package must disable template_mode before it can be applied.');
  if (!payload.first_article || typeof payload.first_article !== 'object' || !String(payload.first_article.title || '').trim()) throw new Error('Launch package is missing a valid first_article.');
  const firstArticle = { ...payload.first_article, slug: safeSlug(payload.first_article.slug, 'first_article.slug'), status: 'draft' }; delete firstArticle.published_at;
  const firstRecord = payload.first_record === undefined ? null : payload.first_record;
  if (firstRecord !== null && (!firstRecord || typeof firstRecord !== 'object' || !String(firstRecord.title || '').trim())) throw new Error('Launch package first_record must include a slug and title when supplied.');
  const normalizedRecord = firstRecord === null ? null : { ...firstRecord, slug: safeSlug(firstRecord.slug, 'first_record.slug'), status: 'draft' };
  if (normalizedRecord?.slug === firstArticle.slug) throw new Error('Launch package first_record must not overwrite the first_article.');
  const author = payload.author_record === undefined ? null : payload.author_record;
  if (author !== null && (!author || typeof author !== 'object' || !String(author.slug || '').trim())) throw new Error('Launch package author_record must include a slug when supplied.');
  const normalizedAuthor = author === null ? null : { ...author, slug: safeSlug(author.slug, 'author_record.slug') };
  if (!Array.isArray(payload.demo_article_files) || !payload.demo_article_files.every((file) => typeof file === 'string')) throw new Error('Launch package demo_article_files must be an array of JSON filenames.');
  const demoFiles = [...new Set(payload.demo_article_files.map((file) => safeJsonFilename(file, 'demo_article_files entry')))];
  if (demoFiles.length !== payload.demo_article_files.length) throw new Error('Launch package demo_article_files contains duplicate destinations.');
  return { site: payload.site_config, firstArticle, firstRecord: normalizedRecord, author: normalizedAuthor, demoFiles };
}

if (!process.argv.includes('--confirm')) { console.error('Launch application changes publication files. Run: npm run launch:apply -- --package <tahai-press-launch-package.json> --confirm'); process.exit(1); }
const packageArg = argument('--package');
if (!packageArg) { console.error('Missing --package <file>.'); process.exit(1); }
const packagePath = path.resolve(process.cwd(), packageArg);
if (!fs.existsSync(packagePath) || !fs.statSync(packagePath).isFile()) { console.error(`Launch package not found: ${packagePath}`); process.exit(1); }

try {
  const launch = validate(readJson(packagePath));
  const contentRoot = containedPath(ROOT, 'content'); const articleRoot = containedPath(contentRoot, 'articles'); const authorRoot = containedPath(contentRoot, 'authors');
  const backupRoot = containedPath(ROOT, '.launch-backups', `launch-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const rollback = [];
  fs.mkdirSync(backupRoot, { recursive: true });
  copyIfPresent(contentRoot, containedPath(backupRoot, 'content'));
  copyIfPresent(containedPath(ROOT, 'public', 'uploads'), containedPath(backupRoot, 'public', 'uploads'));
  fs.writeFileSync(containedPath(backupRoot, 'launch-package.json'), json({ schema_version: 1, applied_at: new Date().toISOString(), source: path.basename(packagePath) }));
  try {
    fs.mkdirSync(articleRoot, { recursive: true });
    for (const filename of launch.demoFiles) removeFile(containedPath(articleRoot, filename), rollback);
    replaceFile(containedPath(contentRoot, 'site.json'), json(launch.site), rollback);
    replaceFile(containedPath(articleRoot, `${launch.firstArticle.slug}.json`), json(launch.firstArticle), rollback);
    if (launch.firstRecord) replaceFile(containedPath(articleRoot, `${launch.firstRecord.slug}.json`), json(launch.firstRecord), rollback);
    if (launch.author) { fs.mkdirSync(authorRoot, { recursive: true }); replaceFile(containedPath(authorRoot, `${launch.author.slug}.json`), json(launch.author), rollback); }
  } catch (error) { for (const undo of rollback.reverse()) { try { undo(); } catch {} } throw error; }
  console.log('TAHAI Press Launch Desk package applied.'); console.log(`Verified backup: ${path.relative(ROOT, backupRoot)}`); console.log(`Publication: ${launch.site.title}`); console.log(`First story: content/articles/${launch.firstArticle.slug}.json (Draft)`); if (launch.firstRecord) console.log(`First record: content/articles/${launch.firstRecord.slug}.json (Draft)`); console.log('Next: npm run validate && npm test && npm run build:cloudflare');
} catch (error) { console.error(`Launch application failed: ${error.message}`); process.exitCode = 1; }
