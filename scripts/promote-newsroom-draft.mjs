import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ROOT, readJson, relativeFile } from './lib/content.mjs';
import { normalizeNewsroomDraft, newsroomDraftErrors, promotionDestination } from './lib/open-publishing.mjs';

function usage() {
  console.log(`Promote a validated TAHAI Press newsroom-inbox draft into content/articles/.\n\nUsage:\n  npm run newsroom:promote -- --file content/inbox/story-slug.json [--force] [--remove]\n\nThe promoted article remains a draft. Publication still requires the ordinary review gates.`);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}

const input = option('--file');
if (!input) {
  usage();
  process.exit(1);
}

const source = path.resolve(ROOT, input);
const inbox = path.join(ROOT, 'content', 'inbox');
if (!(source === inbox || source.startsWith(`${inbox}${path.sep}`))) {
  throw new Error('The source file must be inside content/inbox/.');
}
if (!fs.existsSync(source) || path.extname(source).toLowerCase() !== '.json') {
  throw new Error(`Inbox draft not found: ${relativeFile(source)}`);
}

const draft = normalizeNewsroomDraft(readJson(source));
const errors = newsroomDraftErrors(draft);
if (errors.length) throw new Error(`Inbox draft is not promotable:\n- ${errors.join('\n- ')}`);

const destination = promotionDestination(ROOT, draft.slug);
if (fs.existsSync(destination) && !process.argv.includes('--force')) {
  throw new Error(`${relativeFile(destination)} already exists. Review it or rerun with --force.`);
}

fs.writeFileSync(destination, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');
if (process.argv.includes('--remove')) fs.rmSync(source);
console.log(`Promoted ${relativeFile(source)} to ${relativeFile(destination)} as a draft.`);
console.log('Run npm run validate and complete publication review before changing status to published.');
