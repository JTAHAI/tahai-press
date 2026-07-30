import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson, relativeFile } from './lib/content.mjs';

const write = process.argv.includes('--write');
const nowValue = process.env.TAHAI_PRESS_NOW || new Date().toISOString();
const now = new Date(nowValue);
if (Number.isNaN(now.getTime())) {
  console.error(`Invalid TAHAI_PRESS_NOW value: ${nowValue}`);
  process.exit(1);
}

const directory = path.join(ROOT, 'content', 'articles');
const due = [];
for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort()) {
  const file = path.join(directory, filename);
  const article = readJson(file);
  if (article.status !== 'scheduled' || !article.published_at) continue;
  const publicationDate = new Date(article.published_at);
  if (Number.isNaN(publicationDate.getTime()) || publicationDate > now) continue;
  due.push({ file, article });
}

if (!due.length) {
  console.log(`No scheduled articles are due as of ${now.toISOString()}.`);
  process.exit(0);
}

for (const entry of due) {
  console.log(`${write ? 'Publishing' : 'Due'}: ${entry.article.title} (${relativeFile(entry.file)})`);
  if (!write) continue;
  entry.article.status = 'published';
  fs.writeFileSync(entry.file, `${JSON.stringify(entry.article, null, 2)}\n`, 'utf8');
}

if (write) console.log(`Published ${due.length} scheduled article(s).`);
else console.log(`${due.length} scheduled article(s) are due. Re-run with --write to update the files.`);
