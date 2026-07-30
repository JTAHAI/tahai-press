import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './lib/content.mjs';
import { titleInitials } from './lib/site-config.mjs';

if (!process.argv.includes('--confirm')) {
  console.error('Demo cleanup is destructive. Run: npm run setup:clear-demo -- --confirm');
  process.exit(1);
}

const contentRoot = path.join(ROOT, 'content');
const collections = ['articles', 'authors', 'categories', 'hubs'];
const removed = [];
for (const collection of collections) {
  const directory = path.join(contentRoot, collection);
  fs.mkdirSync(directory, { recursive: true });
  for (const file of fs.readdirSync(directory)) {
    if (!file.endsWith('.json')) continue;
    fs.rmSync(path.join(directory, file));
    removed.push(`${collection}/${file}`);
  }
  fs.writeFileSync(path.join(directory, '.gitkeep'), '', 'utf8');
}

const sitePath = path.join(contentRoot, 'site.json');
const site = readJson(sitePath);
const title = 'Your Publication';
Object.assign(site, {
  title,
  short_title: title,
  brand_mark: titleInitials(title),
  tagline: 'Independent reporting, clearly presented.',
  description: 'Replace this description with a concise explanation of the publication and the communities it serves.',
  site_url: 'https://example.pages.dev',
  editor_email: 'editor@example.org',
  logo: '',
  default_social_image: '',
  default_social_image_alt: '',
  masthead_kicker: `${title} · Independent publication`,
  hero_kicker: 'Latest edition',
  hero_title: `Reporting and source documents from ${title}.`,
  hero_description: 'Replace this introduction with a clear statement of what readers can expect.',
  editorial_promise: 'Accurate reporting. Clear sourcing. Accessible publishing.',
  navigation_note: 'Make it easy. Make it fast.',
  template_mode: true,
  theme_preset: 'classic-broadsheet',
  setup_version: 6
});
site.navigation = site.navigation || {};
site.navigation.note = 'Make it easy. Make it fast.';
site.seo = site.seo || {};
site.seo.social_profiles = [];
site.seo.feed_title = title;
site.seo.feed_description = site.description;
site.accessibility = site.accessibility || {};
site.accessibility.contact_email = site.editor_email;
site.accessibility.reader_tools_enabled = true;
site.accessibility.simplified_reading_enabled = true;
site.accessibility.default_link_underlines = false;
site.accessibility.document_summary_required = true;
fs.writeFileSync(sitePath, `${JSON.stringify(site, null, 2)}\n`, 'utf8');

console.log(`Removed ${removed.length} demonstration content file(s).`);
console.log('Reset content/site.json to a neutral, indexing-blocked publication identity.');
console.log('Next: open /setup/ on the deployed template or edit Publication settings in Pages CMS.');
