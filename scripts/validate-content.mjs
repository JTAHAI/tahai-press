import fs from 'node:fs';
import path from 'node:path';
import { loadContent, relativeFile, ROOT } from './lib/content.mjs';
import { sourcePathFromLegacyUrl } from './lib/redirects.mjs';
import { uniqueTopics } from './lib/discovery.mjs';
import { themeContrastErrors } from './lib/accessibility.mjs';
import { THEME_PRESET_IDS, LAYOUT_OPTIONS } from './lib/site-config.mjs';
import { STORY_BLOCK_TYPES, IMAGE_LAYOUTS, IMAGE_ASPECTS, IMAGE_FOCAL_POINTS, CALLOUT_TONES, articleMedia } from './lib/editorial.mjs';
import { ARTICLE_CLASSIFICATION_KEYS } from './lib/professional-desk.mjs';
import { validateCrossword } from './lib/crosswords.mjs';
import { validateEvidenceRecord } from './lib/evidence.mjs';
import { loadPublishedTheme } from './lib/themes.mjs';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS = new Set(['draft', 'review', 'scheduled', 'published', 'corrected', 'archived']);
const RELEASE_STATUSES = new Set(['scheduled', 'published', 'corrected']);
const LIVE_STATUSES = new Set(['published', 'corrected']);
const TYPES = new Set(['standard', 'pdf', 'mixed', 'external']);
const CLASSIFICATIONS = new Set(ARTICLE_CLASSIFICATION_KEYS);
const PDF_VIEW_MODES = new Set(['fit-width', 'fit-page']);
const THEME_FIELDS = ['brand', 'brand_deep', 'brand_soft', 'accent', 'accent_dark', 'highlight', 'surface', 'surface_deep', 'paper'];
const PUBLISH_REVIEW_FIELDS = ['review_content', 'review_rights', 'review_accessibility'];
const PUBLISHER_TYPES = new Set(['Organization', 'NewsMediaOrganization']);
const ARTICLE_SCHEMA_TYPES = new Set(['Article', 'NewsArticle', 'BlogPosting']);
const HOME_MODULE_TYPES = new Set([
  'intro', 'setup', 'license', 'featured', 'latest', 'reach', 'studio', 'console', 'product', 'pillars', 'hubs', 'submit',
  'lead_story', 'secondary_headlines', 'category_strip', 'coverage_hub', 'public_record_desk', 'featured_investigation',
  'editors_note', 'recently_updated', 'document_spotlight', 'crossword_promotion', 'submission_callout', 'accessibility_notice', 'custom_text_panel'
]);
const AUTHOR_ENTITY_TYPES = new Set(['Person', 'Organization']);
const PUBLICATION_WORKFLOWS = new Set(['editorial_review', 'strict_review']);
const RESERVED_INTERNAL_PATHS = [
  /^\/(?:assets|uploads|\.well-known)(?:\/|$)/,
  /^\/(?:_redirects|404\.html|service-worker\.js|site\.webmanifest)$/i,
  /^\/admin\/config\.yml$/i
];
const KNOWN_INTERNAL_PATHS = new Set([
  '/', '/stories/', '/search/', '/topics/', '/authors/', '/categories/', '/sections/', '/series/', '/records/',
  '/archive/', '/hubs/', '/about/', '/accessibility/', '/submit/', '/contact/', '/edition/', '/editions/', '/newsletters/',
  '/saved/', '/puzzles/', '/studio/', '/publisher/', '/media-desk/', '/setup/', '/admin/', '/offline/'
]);
const KNOWN_INTERNAL_PREFIXES = [
  /^\/stories\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/topics\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/authors\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/categories\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/sections\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/series\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/hubs\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/archive\/\d{4}\/?$/i,
  /^\/archive\/\d{4}\/\d{2}\/?$/i,
  /^\/archive\/\d{4}\/\d{2}\/page\/\d+\/?$/i,
  /^\/stories\/[a-z0-9]+(?:-[a-z0-9]+)*\/page\/\d+\/?$/i,
  /^\/records\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/editions\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i,
  /^\/newsletters\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i
];
const errors = [];
const warnings = [];

function issue(list, file, message) {
  list.push(`${relativeFile(file)}: ${message}`);
}
function requiredString(record, field, file, min = 1) {
  if (typeof record[field] !== 'string' || record[field].trim().length < min) {
    issue(errors, file, `${field} must be a string with at least ${min} character(s)`);
  }
}
function optionalString(record, field, file, max = Infinity) {
  if (record[field] === undefined || record[field] === null || record[field] === '') return;
  if (typeof record[field] !== 'string') issue(errors, file, `${field} must be a string`);
  else if (record[field].length > max) issue(errors, file, `${field} must be ${max} characters or fewer`);
}
function validWebOrLocalUrl(value) {
  if (!value) return true;
  if (String(value).startsWith('/')) return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol);
  } catch {
    return false;
  }
}
function normalizeInternalPath(value = '') {
  return String(value).trim().split('?')[0].split('#')[0];
}
function isReservedInternalPath(value = '') {
  const pathValue = normalizeInternalPath(value);
  return RESERVED_INTERNAL_PATHS.some((pattern) => pattern.test(pathValue));
}
function validPublicationRoute(value = '') {
  const pathValue = normalizeInternalPath(value);
  if (!pathValue.startsWith('/')) return false;
  if (isReservedInternalPath(pathValue)) return false;
  if (KNOWN_INTERNAL_PATHS.has(pathValue)) return true;
  return KNOWN_INTERNAL_PREFIXES.some((pattern) => pattern.test(pathValue));
}
function validAbsoluteWebUrl(value) {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateLocalAsset(value, file, field) {
  if (!String(value || '').startsWith('/')) return;
  const publicRoot = path.resolve(ROOT, 'public');
  const candidate = path.resolve(publicRoot, String(value).slice(1));
  if (!candidate.startsWith(`${publicRoot}${path.sep}`)) issue(errors, file, `${field} must remain inside public/`);
  else if (!fs.existsSync(candidate)) issue(errors, file, `${field} does not exist: ${value}`);
}

function validateSluggedCollection(items, name, { requireActive = false } = {}) {
  const seen = new Set();
  for (const item of items) {
    requiredString(item, 'name', item.__file);
    requiredString(item, 'slug', item.__file);
    if (!SLUG.test(item.slug || '')) issue(errors, item.__file, 'slug must use lowercase letters, numbers, and single hyphens');
    if (seen.has(item.slug)) issue(errors, item.__file, `duplicate ${name} slug: ${item.slug}`);
    seen.add(item.slug);
    if (path.basename(item.__file, '.json') !== item.slug) issue(errors, item.__file, `filename must match slug (${item.slug}.json)`);
    if (requireActive && item.active !== undefined && typeof item.active !== 'boolean') issue(errors, item.__file, 'active must be true or false');
    if (name === 'author' && item.entity_type !== undefined && !AUTHOR_ENTITY_TYPES.has(item.entity_type)) issue(errors, item.__file, 'entity_type must be Person or Organization');
  }
}
function publishIssue(article, message) {
  issue(RELEASE_STATUSES.has(article.status) ? errors : warnings, article.__file, message);
}


function validateHistory(article, field, label) {
  const entries = article[field];
  if (entries === undefined) return;
  if (!Array.isArray(entries)) {
    issue(errors, article.__file, `${field} must be an array`);
    return;
  }
  if (entries.length > 25) issue(errors, article.__file, `${field} cannot contain more than 25 entries`);
  let previous = null;
  for (const [index, entry] of entries.entries()) {
    const base = `${field}[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      issue(errors, article.__file, `${base} must be an object`);
      continue;
    }
    if (!String(entry.body || '').trim()) publishIssue(article, `${base}.body is required`);
    if (String(entry.body || '').length > 1000) issue(errors, article.__file, `${base}.body must be 1000 characters or fewer`);
    if (entry.title !== undefined && (typeof entry.title !== 'string' || entry.title.length > 160)) issue(errors, article.__file, `${base}.title must be 160 characters or fewer`);
    const date = new Date(entry.date || '');
    if (Number.isNaN(date.getTime())) issue(errors, article.__file, `${base}.date must be a valid ISO date-time`);
    if (previous && !Number.isNaN(date.getTime()) && date < previous) issue(warnings, article.__file, `${label} entries are not in chronological order; the public page will sort them newest first`);
    if (!Number.isNaN(date.getTime())) previous = date;
  }
}

function validateStoryBlocks(article) {
  const blocks = article.story_blocks;
  if (blocks === undefined) return;
  if (!Array.isArray(blocks)) {
    issue(errors, article.__file, 'story_blocks must be an array');
    return;
  }
  if (blocks.length > 30) issue(errors, article.__file, 'story_blocks cannot contain more than 30 blocks');
  for (const [index, block] of blocks.entries()) {
    const base = `story_blocks[${index}]`;
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      issue(errors, article.__file, `${base} must be an object`);
      continue;
    }
    if (!STORY_BLOCK_TYPES.includes(block.type)) {
      issue(errors, article.__file, `${base}.type must be one of: ${STORY_BLOCK_TYPES.join(', ')}`);
      continue;
    }
    if (block.heading !== undefined && (typeof block.heading !== 'string' || block.heading.length > 180)) issue(errors, article.__file, `${base}.heading must be 180 characters or fewer`);
    if (block.type === 'text' && !String(block.body || '').trim()) publishIssue(article, `${base}.body is required for a text block`);
    if (block.type === 'key_points') {
      if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 12) publishIssue(article, `${base}.items must contain between 1 and 12 key points`);
      else for (const [itemIndex, item] of block.items.entries()) if (typeof item !== 'string' || !item.trim() || item.length > 300) issue(errors, article.__file, `${base}.items[${itemIndex}] must be 1 to 300 characters`);
    }
    if (block.type === 'pull_quote' && (!String(block.quote || '').trim() || String(block.quote).length > 500)) publishIssue(article, `${base}.quote must contain 1 to 500 characters`);
    if (['fact_box', 'callout'].includes(block.type)) {
      if (!String(block.heading || '').trim()) publishIssue(article, `${base}.heading is required`);
      if (!String(block.body || '').trim()) publishIssue(article, `${base}.body is required`);
    }
    if (block.type === 'callout' && block.tone !== undefined && !CALLOUT_TONES.includes(block.tone)) issue(errors, article.__file, `${base}.tone must be one of: ${CALLOUT_TONES.join(', ')}`);
    if (block.type === 'image') {
      if (!validWebOrLocalUrl(block.src || '')) publishIssue(article, `${base}.src must be site-relative or HTTP(S)`);
      validateLocalAsset(block.src, article.__file, `${base}.src`);
      if (!block.decorative && !String(block.alt || '').trim()) publishIssue(article, `${base}.alt is required unless the image is decorative`);
      if (block.layout !== undefined && !IMAGE_LAYOUTS.includes(block.layout)) issue(errors, article.__file, `${base}.layout must be one of: ${IMAGE_LAYOUTS.join(', ')}`);
      if (block.aspect !== undefined && !IMAGE_ASPECTS.includes(block.aspect)) issue(errors, article.__file, `${base}.aspect must be one of: ${IMAGE_ASPECTS.join(', ')}`);
      if (block.focal_point !== undefined && !IMAGE_FOCAL_POINTS.includes(block.focal_point)) issue(errors, article.__file, `${base}.focal_point must be one of: ${IMAGE_FOCAL_POINTS.join(', ')}`);
    }
    if (block.type === 'gallery') {
      if (!Array.isArray(block.items) || block.items.length < 2 || block.items.length > 12) publishIssue(article, `${base}.items must contain between 2 and 12 images`);
      else for (const [itemIndex, item] of block.items.entries()) {
        const itemBase = `${base}.items[${itemIndex}]`;
        if (!item || typeof item !== 'object' || Array.isArray(item)) { issue(errors, article.__file, `${itemBase} must be an object`); continue; }
        if (!validWebOrLocalUrl(item.src || '')) publishIssue(article, `${itemBase}.src must be site-relative or HTTP(S)`);
        validateLocalAsset(item.src, article.__file, `${itemBase}.src`);
        if (!item.decorative && !String(item.alt || '').trim()) publishIssue(article, `${itemBase}.alt is required unless the image is decorative`);
        if (item.aspect !== undefined && !IMAGE_ASPECTS.includes(item.aspect)) issue(errors, article.__file, `${itemBase}.aspect must be one of: ${IMAGE_ASPECTS.join(', ')}`);
        if (item.focal_point !== undefined && !IMAGE_FOCAL_POINTS.includes(item.focal_point)) issue(errors, article.__file, `${itemBase}.focal_point must be one of: ${IMAGE_FOCAL_POINTS.join(', ')}`);
      }
    }
    if (block.type === 'timeline') {
      if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 20) publishIssue(article, `${base}.items must contain between 1 and 20 timeline entries`);
      else for (const [itemIndex, item] of block.items.entries()) if (!item || typeof item !== 'object' || !String(item.title || '').trim()) publishIssue(article, `${base}.items[${itemIndex}].title is required`);
    }
    if (block.type === 'document') {
      if (!String(block.heading || '').trim()) publishIssue(article, `${base}.heading is required`);
      if (!validWebOrLocalUrl(block.url || '')) publishIssue(article, `${base}.url must be site-relative or HTTP(S)`);
      validateLocalAsset(block.url, article.__file, `${base}.url`);
    }
    if (['numbered_findings', 'source_list', 'related_coverage'].includes(block.type)) {
      if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 30) publishIssue(article, `${base}.items must contain between 1 and 30 entries`);
      else for (const [itemIndex, item] of block.items.entries()) if (typeof item !== 'string' || !item.trim() || item.length > 1000) issue(errors, article.__file, `${base}.items[${itemIndex}] must be 1 to 1000 characters`);
    }
    if (block.type === 'data_table') {
      if (!Array.isArray(block.columns) || block.columns.length < 1 || block.columns.length > 12) publishIssue(article, `${base}.columns must contain between 1 and 12 labels`);
      if (!Array.isArray(block.rows) || block.rows.length < 1 || block.rows.length > 100) publishIssue(article, `${base}.rows must contain between 1 and 100 rows`);
      else for (const [rowIndex, row] of block.rows.entries()) {
        const cells = Array.isArray(row) ? row : typeof row === 'string' ? row.split('|').map((cell) => cell.trim()) : [];
        if (cells.length !== block.columns.length || cells.some((cell) => typeof cell !== 'string' || cell.length > 1000)) issue(errors, article.__file, `${base}.rows[${rowIndex}] must match columns with cells of 1000 characters or fewer`);
      }
    }
    if (['correction_notice', 'update_notice', 'editor_note', 'definition_box', 'methodology_box'].includes(block.type) && !String(block.body || '').trim()) publishIssue(article, `${base}.body is required`);
  }
}

const { site, articles, authors, categories, hubs, crosswords, records, editions, newsletters } = loadContent();
const siteFile = path.join(ROOT, 'content', 'site.json');
const rawSite = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
validateSluggedCollection(authors, 'author', { requireActive: true });
validateSluggedCollection(categories, 'category');
validateSluggedCollection(hubs, 'hub', { requireActive: true });

const crosswordSlugs = new Set();
const crosswordOrders = new Set();
for (const crossword of crosswords) {
  requiredString(crossword, 'slug', crossword.__file);
  requiredString(crossword, 'title', crossword.__file);
  requiredString(crossword, 'deck', crossword.__file);
  if (!SLUG.test(crossword.slug || '')) issue(errors, crossword.__file, 'slug must use lowercase letters, numbers, and single hyphens');
  if (crosswordSlugs.has(crossword.slug)) issue(errors, crossword.__file, `duplicate crossword slug: ${crossword.slug}`);
  crosswordSlugs.add(crossword.slug);
  if (path.basename(crossword.__file, '.json') !== crossword.slug) issue(errors, crossword.__file, `filename must match slug (${crossword.slug}.json)`);
  if (crossword.active !== undefined && typeof crossword.active !== 'boolean') issue(errors, crossword.__file, 'active must be true or false');
  if (!Number.isInteger(crossword.rotation_order) || crossword.rotation_order < 1) issue(errors, crossword.__file, 'rotation_order must be a positive integer');
  const orderKey = `${crossword.difficulty}:${crossword.rotation_order}`;
  if (crosswordOrders.has(orderKey)) issue(errors, crossword.__file, `rotation_order ${crossword.rotation_order} is already used for ${crossword.difficulty}`);
  crosswordOrders.add(orderKey);
  for (const message of validateCrossword(crossword)) issue(errors, crossword.__file, message);
}
for (const difficulty of ['novice', 'expert']) {
  if (!crosswords.some((item) => item.active !== false && item.difficulty === difficulty)) issue(errors, siteFile, `at least one active ${difficulty} crossword is required`);
}

const authorSlugs = new Set(authors.map((item) => item.slug));
const categorySlugs = new Set(categories.map((item) => item.slug));
const hubSlugs = new Set(hubs.map((item) => item.slug));
const articleSlugs = new Set(articles.map((item) => item.slug));
const recordIds = new Set(records.map((item) => item.id));
const evidenceIds = new Set();
for (const record of records) {
  if (evidenceIds.has(record.id)) issue(errors, record.__file, `duplicate evidence record id: ${record.id}`);
  evidenceIds.add(record.id);
  if (path.basename(record.__file, '.json') !== record.id) issue(errors, record.__file, `filename must match id (${record.id}.json)`);
  for (const message of validateEvidenceRecord(record, { articleSlugs })) issue(errors, record.__file, message);
}
const editionIds = new Set();
for (const edition of editions) {
  if (!SLUG.test(edition.id || '')) issue(errors, edition.__file, 'id must use lowercase letters, numbers, and single hyphens');
  if (editionIds.has(edition.id)) issue(errors, edition.__file, `duplicate edition id: ${edition.id}`);
  editionIds.add(edition.id);
  if (path.basename(edition.__file, '.json') !== edition.id) issue(errors, edition.__file, `filename must match id (${edition.id}.json)`);
  requiredString(edition, 'title', edition.__file, 3);
  if (!['draft', 'published', 'archived'].includes(edition.status)) issue(errors, edition.__file, 'status must be draft, published, or archived');
  if (!['daily', 'community-weekly', 'investigative-special', 'records-packet', 'arts', 'developing-bulletin'].includes(edition.template)) issue(errors, edition.__file, 'template is not supported');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edition.date || '')) issue(errors, edition.__file, 'date must use YYYY-MM-DD');
  if (!Array.isArray(edition.sections) || edition.sections.length < 1) issue(errors, edition.__file, 'sections must contain at least one section');
  else for (const [index, section] of edition.sections.entries()) {
    requiredString(section || {}, 'title', edition.__file, 2);
    for (const storyId of section.story_ids || []) if (!articleSlugs.has(storyId)) issue(errors, edition.__file, `sections[${index}] references unknown article ${storyId}`);
    for (const recordId of section.record_ids || []) if (!recordIds.has(recordId)) issue(errors, edition.__file, `sections[${index}] references unknown record ${recordId}`);
  }
}
const newsletterIds = new Set();
for (const newsletter of newsletters) {
  if (!SLUG.test(newsletter.id || '')) issue(errors, newsletter.__file, 'id must use lowercase letters, numbers, and single hyphens');
  if (newsletterIds.has(newsletter.id)) issue(errors, newsletter.__file, `duplicate newsletter id: ${newsletter.id}`);
  newsletterIds.add(newsletter.id);
  if (path.basename(newsletter.__file, '.json') !== newsletter.id) issue(errors, newsletter.__file, `filename must match id (${newsletter.id}.json)`);
  requiredString(newsletter, 'title', newsletter.__file, 3);
  requiredString(newsletter, 'subject', newsletter.__file, 3);
  if (!['draft', 'published', 'archived'].includes(newsletter.status)) issue(errors, newsletter.__file, 'status must be draft, published, or archived');
  if (!Array.isArray(newsletter.story_ids) || newsletter.story_ids.length < 1) issue(errors, newsletter.__file, 'story_ids must contain at least one article');
  else for (const storyId of newsletter.story_ids) if (!articleSlugs.has(storyId)) issue(errors, newsletter.__file, `references unknown article ${storyId}`);
}
const seenArticleSlugs = new Set();
const seenCanonicalUrls = new Map();
let siteUrl = null;

for (const field of [
  'title', 'short_title', 'tagline', 'masthead_kicker', 'hero_title',
  'hero_description', 'editorial_promise', 'description', 'site_url',
  'locale', 'timezone', 'editor_email'
]) requiredString(site, field, siteFile);

if (!validAbsoluteWebUrl(site.site_url || '')) issue(errors, siteFile, 'site_url must be an absolute HTTP(S) URL');
else {
  siteUrl = new URL(site.site_url);
  if (siteUrl.protocol !== 'https:') issue(errors, siteFile, 'site_url must use HTTPS for public deployment');
  if (siteUrl.username || siteUrl.password) issue(errors, siteFile, 'site_url cannot contain credentials');
  if (siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash) issue(errors, siteFile, 'site_url must be the publication origin only, without a path, query string, or fragment');
}
if (!EMAIL.test(site.editor_email || '')) issue(errors, siteFile, 'editor_email must be a valid email address');
if (typeof site.template_mode !== 'boolean') issue(errors, siteFile, 'template_mode must be true or false');
optionalString(site, 'default_social_image_alt', siteFile, 240);
if (site.default_social_image && !site.default_social_image_alt) issue(errors, siteFile, 'default_social_image_alt is required when default_social_image is set');
if (site.brand_mark && !/^[a-z0-9]{1,2}$/i.test(site.brand_mark)) issue(errors, siteFile, 'brand_mark must contain one or two letters or numbers');
for (const field of ['submit_story_url', 'contact_url']) {
  if (!validWebOrLocalUrl(site[field] || '')) issue(errors, siteFile, `${field} must be site-relative or HTTP(S)`);
}
for (const field of ['logo', 'default_social_image']) {
  if (!validWebOrLocalUrl(site[field] || '')) issue(errors, siteFile, `${field} must be site-relative or HTTP(S)`);
  validateLocalAsset(site[field], siteFile, field);
}
if (!site.seo || typeof site.seo !== 'object' || Array.isArray(site.seo)) {
  issue(errors, siteFile, 'seo must be an object');
} else {
  if (!PUBLISHER_TYPES.has(site.seo.publisher_type)) issue(errors, siteFile, 'seo.publisher_type must be Organization or NewsMediaOrganization');
  if (!ARTICLE_SCHEMA_TYPES.has(site.seo.article_schema_type)) issue(errors, siteFile, 'seo.article_schema_type must be Article, NewsArticle, or BlogPosting');
  optionalString(site.seo, 'twitter_site', siteFile, 16);
  if (site.seo.twitter_site && !/^@?[A-Za-z0-9_]{1,15}$/.test(site.seo.twitter_site)) issue(errors, siteFile, 'seo.twitter_site must be a valid X/Twitter handle');
  optionalString(site.seo, 'feed_title', siteFile, 120);
  optionalString(site.seo, 'feed_description', siteFile, 500);
  const feedLimit = Number(site.seo.feed_limit ?? 50);
  if (!Number.isInteger(feedLimit) || feedLimit < 1 || feedLimit > 100) issue(errors, siteFile, 'seo.feed_limit must be an integer between 1 and 100');
  if (!Array.isArray(site.seo.social_profiles)) issue(errors, siteFile, 'seo.social_profiles must be an array');
  else {
    if (site.seo.social_profiles.length > 20) issue(errors, siteFile, 'seo.social_profiles cannot contain more than 20 URLs');
    for (const [index, value] of site.seo.social_profiles.entries()) if (!validAbsoluteWebUrl(value)) issue(errors, siteFile, `seo.social_profiles[${index}] must be an absolute HTTP(S) URL`);
  }
}
if (site.discovery !== undefined) {
  if (!site.discovery || typeof site.discovery !== 'object' || Array.isArray(site.discovery)) {
    issue(errors, siteFile, 'discovery must be an object');
  } else {
    const archivePageSize = Number(site.discovery.archive_page_size ?? 12);
    const searchResultLimit = Number(site.discovery.search_result_limit ?? 50);
    if (!Number.isInteger(archivePageSize) || archivePageSize < 1 || archivePageSize > 100) issue(errors, siteFile, 'discovery.archive_page_size must be an integer between 1 and 100');
    if (!Number.isInteger(searchResultLimit) || searchResultLimit < 1 || searchResultLimit > 100) issue(errors, siteFile, 'discovery.search_result_limit must be an integer between 1 and 100');
  }
}

if (rawSite.theme_preset !== undefined && !THEME_PRESET_IDS.includes(rawSite.theme_preset)) {
  issue(errors, siteFile, `theme_preset must be one of: ${THEME_PRESET_IDS.join(', ')}`);
}
if (rawSite.theme_package !== undefined) {
  try { loadPublishedTheme(rawSite.theme_package); } catch (error) { issue(errors, siteFile, `theme_package: ${error.message}`); }
}
if (rawSite.layout !== undefined) {
  if (!rawSite.layout || typeof rawSite.layout !== 'object' || Array.isArray(rawSite.layout)) issue(errors, siteFile, 'layout must be an object');
  else for (const [field, allowed] of Object.entries(LAYOUT_OPTIONS)) if (rawSite.layout[field] !== undefined && !allowed.includes(rawSite.layout[field])) issue(errors, siteFile, `layout.${field} must be one of: ${allowed.join(', ')}`);
}
if (rawSite.navigation !== undefined) {
  if (!rawSite.navigation || typeof rawSite.navigation !== 'object' || Array.isArray(rawSite.navigation)) issue(errors, siteFile, 'navigation must be an object');
  else {
    optionalString(rawSite.navigation, 'note', siteFile, 120);
    if (!Array.isArray(rawSite.navigation.items)) issue(errors, siteFile, 'navigation.items must be an array');
    else {
      if (rawSite.navigation.items.length < 1 || rawSite.navigation.items.length > 12) issue(errors, siteFile, 'navigation.items must contain between 1 and 12 links');
      const destinations = new Set();
      for (const [index, item] of rawSite.navigation.items.entries()) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) { issue(errors, siteFile, `navigation.items[${index}] must be an object`); continue; }
        if (!String(item.label || '').trim() || String(item.label).length > 80) issue(errors, siteFile, `navigation.items[${index}].label must contain 1 to 80 characters`);
        const href = String(item.href || '').trim();
        if (!(href.startsWith('/') || /^https:\/\//i.test(href))) issue(errors, siteFile, `navigation.items[${index}].href must begin with / or https://`);
        if (href.startsWith('/') && !validPublicationRoute(href)) issue(errors, siteFile, `navigation.items[${index}].href points to a reserved or unknown route: ${href}`);
        if (destinations.has(href)) issue(errors, siteFile, `navigation.items contains duplicate destination: ${href}`);
        destinations.add(href);
      }
    }
  }
}
if (rawSite.footer !== undefined) {
  if (!rawSite.footer || typeof rawSite.footer !== 'object' || Array.isArray(rawSite.footer)) issue(errors, siteFile, 'footer must be an object');
  else {
    optionalString(rawSite.footer, 'note', siteFile, 160);
    if (!Array.isArray(rawSite.footer.columns)) issue(errors, siteFile, 'footer.columns must be an array');
    else {
      if (rawSite.footer.columns.length < 1 || rawSite.footer.columns.length > 4) issue(errors, siteFile, 'footer.columns must contain between 1 and 4 columns');
      const destinations = new Set();
      for (const [columnIndex, column] of rawSite.footer.columns.entries()) {
        if (!column || typeof column !== 'object' || Array.isArray(column)) { issue(errors, siteFile, `footer.columns[${columnIndex}] must be an object`); continue; }
        if (!String(column.heading || '').trim() || String(column.heading).length > 80) issue(errors, siteFile, `footer.columns[${columnIndex}].heading must contain 1 to 80 characters`);
        if (!Array.isArray(column.links)) issue(errors, siteFile, `footer.columns[${columnIndex}].links must be an array`);
        else {
          if (column.links.length < 1 || column.links.length > 8) issue(errors, siteFile, `footer.columns[${columnIndex}].links must contain between 1 and 8 links`);
          for (const [linkIndex, link] of column.links.entries()) {
            if (!link || typeof link !== 'object' || Array.isArray(link)) { issue(errors, siteFile, `footer.columns[${columnIndex}].links[${linkIndex}] must be an object`); continue; }
            if (!String(link.label || '').trim() || String(link.label).length > 80) issue(errors, siteFile, `footer.columns[${columnIndex}].links[${linkIndex}].label must contain 1 to 80 characters`);
            const href = String(link.href || '').trim();
            if (!(href.startsWith('/') || /^https:\/\//i.test(href))) issue(errors, siteFile, `footer.columns[${columnIndex}].links[${linkIndex}].href must begin with / or https://`);
            if (href.startsWith('/') && !validPublicationRoute(href)) issue(errors, siteFile, `footer.columns[${columnIndex}].links[${linkIndex}].href points to a reserved or unknown route: ${href}`);
            if (destinations.has(href)) issue(errors, siteFile, `footer.columns contains duplicate destination: ${href}`);
            destinations.add(href);
          }
        }
      }
    }
  }
}
if (rawSite.homepage !== undefined) {
  if (!rawSite.homepage || typeof rawSite.homepage !== 'object' || Array.isArray(rawSite.homepage)) issue(errors, siteFile, 'homepage must be an object');
  else if (!Array.isArray(rawSite.homepage.modules)) issue(errors, siteFile, 'homepage.modules must be an array');
  else {
    if (rawSite.homepage.modules.length < 1 || rawSite.homepage.modules.length > 24) issue(errors, siteFile, 'homepage.modules must contain between 1 and 24 sections');
    const seenModules = new Set();
    for (const [index, module] of rawSite.homepage.modules.entries()) {
      if (!module || typeof module !== 'object' || Array.isArray(module)) { issue(errors, siteFile, `homepage.modules[${index}] must be an object`); continue; }
      if (!HOME_MODULE_TYPES.has(module.type)) issue(errors, siteFile, `homepage.modules[${index}].type is not supported`);
      if (seenModules.has(module.type)) issue(errors, siteFile, `homepage.modules contains duplicate section type: ${module.type}`);
      seenModules.add(module.type);
      if (module.enabled !== undefined && typeof module.enabled !== 'boolean') issue(errors, siteFile, `homepage.modules[${index}].enabled must be true or false`);
      if (module.heading !== undefined && (typeof module.heading !== 'string' || module.heading.length > 120)) issue(errors, siteFile, `homepage.modules[${index}].heading must be 120 characters or fewer`);
      if (module.count !== undefined && (!Number.isInteger(Number(module.count)) || Number(module.count) < 1 || Number(module.count) > 24)) issue(errors, siteFile, `homepage.modules[${index}].count must be an integer between 1 and 24`);
      if (module.body !== undefined && (typeof module.body !== 'string' || module.body.length > 5000)) issue(errors, siteFile, `homepage.modules[${index}].body must be 5000 characters or fewer`);
      if (module.type === 'console' && module.heading !== undefined && String(module.heading).length < 5) issue(errors, siteFile, `homepage.modules[${index}].heading must contain at least 5 characters`);
    }
    if (!rawSite.homepage.modules.some((module) => module.type === 'intro' && module.enabled !== false)) issue(warnings, siteFile, 'homepage introduction is disabled; readers may lack a clear page heading and publication summary');
  }
}
if (rawSite.publication_settings !== undefined) {
  if (!rawSite.publication_settings || typeof rawSite.publication_settings !== 'object' || Array.isArray(rawSite.publication_settings)) issue(errors, siteFile, 'publication_settings must be an object');
  else {
    if (rawSite.publication_settings.schema_version !== undefined && (!Number.isInteger(Number(rawSite.publication_settings.schema_version)) || Number(rawSite.publication_settings.schema_version) < 1)) issue(errors, siteFile, 'publication_settings.schema_version must be a positive integer');
    if (rawSite.publication_settings.workflow !== undefined && !PUBLICATION_WORKFLOWS.has(rawSite.publication_settings.workflow)) issue(errors, siteFile, `publication_settings.workflow must be one of: ${[...PUBLICATION_WORKFLOWS].join(', ')}`);
    for (const field of ['scheduled_publishing', 'corrections_enabled', 'archive_withdrawn_publications', 'conflict_detection', 'preview_before_commit']) {
      if (rawSite.publication_settings[field] !== undefined && typeof rawSite.publication_settings[field] !== 'boolean') issue(errors, siteFile, `publication_settings.${field} must be true or false`);
    }
  }
}

const themeForValidation = rawSite.theme && typeof rawSite.theme === 'object' && !Array.isArray(rawSite.theme) ? rawSite.theme : site.theme;
if (!themeForValidation || typeof themeForValidation !== 'object' || Array.isArray(themeForValidation)) {
  issue(errors, siteFile, 'theme must be an object');
} else {
  let colorsValid = true;
  for (const field of THEME_FIELDS) {
    if (!HEX_COLOR.test(themeForValidation[field] || '')) {
      colorsValid = false;
      issue(errors, siteFile, `theme.${field} must be a six-digit hex color`);
    }
  }
  if (colorsValid) {
    for (const message of themeContrastErrors(themeForValidation)) issue(errors, siteFile, `theme contrast: ${message}`);
  }
}

if (!site.reader_reach || typeof site.reader_reach !== 'object' || Array.isArray(site.reader_reach)) {
  issue(errors, siteFile, 'reader_reach must be an object');
} else {
  for (const field of ['enabled', 'offline_enabled', 'saved_articles_enabled', 'browser_share_enabled', 'current_edition_enabled']) {
    if (site.reader_reach[field] !== undefined && typeof site.reader_reach[field] !== 'boolean') issue(errors, siteFile, `reader_reach.${field} must be true or false`);
  }
  for (const [field, fallback] of [['current_edition_count', 8], ['offline_article_count', 12]]) {
    const value = Number(site.reader_reach[field] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > 50) issue(errors, siteFile, `reader_reach.${field} must be an integer between 1 and 50`);
  }
  if (site.reader_reach.enabled === false && (site.reader_reach.offline_enabled || site.reader_reach.saved_articles_enabled || site.reader_reach.browser_share_enabled || site.reader_reach.current_edition_enabled)) {
    issue(warnings, siteFile, 'reader_reach is disabled, so its individual features will not be generated');
  }
}

if (!site.accessibility || typeof site.accessibility !== 'object' || Array.isArray(site.accessibility)) {
  issue(errors, siteFile, 'accessibility must be an object');
} else {
  if (typeof site.accessibility.statement_enabled !== 'boolean') issue(errors, siteFile, 'accessibility.statement_enabled must be true or false');
  optionalString(site.accessibility, 'statement_intro', siteFile, 900);
  optionalString(site.accessibility, 'feedback_note', siteFile, 700);
  if (site.accessibility.contact_email && !EMAIL.test(site.accessibility.contact_email)) issue(errors, siteFile, 'accessibility.contact_email must be a valid email address');
  for (const field of ['reader_tools_enabled', 'simplified_reading_enabled', 'default_link_underlines', 'document_summary_required']) {
    if (site.accessibility[field] !== undefined && typeof site.accessibility[field] !== 'boolean') issue(errors, siteFile, `accessibility.${field} must be true or false`);
  }
}

for (const article of articles) {
  requiredString(article, 'title', article.__file, 1);
  requiredString(article, 'slug', article.__file);

  if (!SLUG.test(article.slug || '')) issue(errors, article.__file, 'slug must use lowercase letters, numbers, and single hyphens');
  if (seenArticleSlugs.has(article.slug)) issue(errors, article.__file, `duplicate slug: ${article.slug}`);
  seenArticleSlugs.add(article.slug);
  if (path.basename(article.__file, '.json') !== article.slug) issue(errors, article.__file, `filename must match slug (${article.slug}.json)`);
  if (!STATUS.has(article.status)) issue(errors, article.__file, `unsupported status: ${article.status}`);
  if (!TYPES.has(article.article_type)) issue(errors, article.__file, `unsupported article_type: ${article.article_type}`);
  if (!article.classification) publishIssue(article, 'classification is required before publishing');
  else if (!CLASSIFICATIONS.has(article.classification)) issue(errors, article.__file, `classification must be one of: ${ARTICLE_CLASSIFICATION_KEYS.join(', ')}`);

  const isPublished = LIVE_STATUSES.has(article.status);
  const isReleaseReady = RELEASE_STATUSES.has(article.status);
  if (isReleaseReady && String(article.title || '').trim().length < 5) issue(errors, article.__file, 'published title must contain at least 5 characters');
  if (isReleaseReady && String(article.excerpt || '').trim().length < 20) issue(errors, article.__file, 'published excerpt must contain at least 20 characters');
  optionalString(article, 'excerpt', article.__file, 360);
  optionalString(article, 'kicker', article.__file, 100);
  optionalString(article, 'featured_image_alt', article.__file, 240);
  optionalString(article, 'featured_image_caption', article.__file, 300);
  optionalString(article, 'featured_image_credit', article.__file, 160);
  optionalString(article, 'featured_image_rights', article.__file, 300);
  optionalString(article, 'pdf_title', article.__file, 180);
  optionalString(article, 'document_description', article.__file, 600);
  optionalString(article, 'document_accessible_summary', article.__file, 5000);
  optionalString(article, 'document_accessibility_note', article.__file, 600);
  optionalString(article, 'document_source', article.__file, 180);
  optionalString(article, 'external_link_label', article.__file, 100);
  optionalString(article, 'seo_title', article.__file, 70);
  optionalString(article, 'seo_description', article.__file, 170);
  optionalString(article, 'editor_notes', article.__file, 2000);
  optionalString(article, 'series_slug', article.__file, 120);
  optionalString(article, 'series_title', article.__file, 180);
  optionalString(article, 'series_description', article.__file, 360);
  optionalString(article, 'methodology', article.__file, 5000);
  optionalString(article, 'disclosure', article.__file, 2000);
  optionalString(article, 'rights_and_reuse', article.__file, 1000);
  optionalString(article, 'what_changed', article.__file, 1000);
  if (article.search_metadata !== undefined) {
    if (!article.search_metadata || typeof article.search_metadata !== 'object' || Array.isArray(article.search_metadata)) issue(errors, article.__file, 'search_metadata must be an object');
    else {
      const allowedSearchMetadata = new Set(['organization', 'section', 'agency', 'jurisdiction', 'place']);
      for (const [key, value] of Object.entries(article.search_metadata)) {
        if (!allowedSearchMetadata.has(key)) issue(errors, article.__file, `search_metadata.${key} is not supported`);
        else optionalString({ [key]: value }, key, article.__file, key === 'section' ? 100 : 180);
      }
    }
  }

  const seriesFields = [article.series_slug, article.series_title].filter((value) => String(value || '').trim());
  if (seriesFields.length === 1) issue(errors, article.__file, 'series_slug and series_title must be provided together');
  if (article.series_slug && !SLUG.test(article.series_slug)) issue(errors, article.__file, 'series_slug must use lowercase letters, numbers, and single hyphens');
  if (article.series_order !== undefined && (!Number.isInteger(article.series_order) || article.series_order < 1 || article.series_order > 999)) issue(errors, article.__file, 'series_order must be an integer between 1 and 999');
  if (article.series_slug && article.series_order === undefined) publishIssue(article, 'series_order is required when an article belongs to a series');
  if (!article.series_slug && article.series_order !== undefined) issue(errors, article.__file, 'series_order requires series_slug and series_title');
  if (article.related_articles !== undefined) {
    if (!Array.isArray(article.related_articles)) issue(errors, article.__file, 'related_articles must be an array');
    else {
      if (article.related_articles.length > 12) issue(errors, article.__file, 'related_articles cannot contain more than 12 slugs');
      if (new Set(article.related_articles).size !== article.related_articles.length) issue(errors, article.__file, 'related_articles must not contain duplicates');
      for (const [index, slug] of article.related_articles.entries()) {
        if (!SLUG.test(String(slug || ''))) issue(errors, article.__file, `related_articles[${index}] must be an article slug`);
        else if (slug === article.slug) issue(errors, article.__file, 'related_articles cannot include the current article');
        else if (!articleSlugs.has(slug)) issue(errors, article.__file, `related_articles references unknown article: ${slug}`);
      }
    }
  }
  validateHistory(article, 'update_history', 'Update history');
  validateHistory(article, 'corrections', 'Correction history');
  if (article.corrections?.length && !article.updated_at) issue(warnings, article.__file, 'corrections are present but updated_at is empty');
  if (article.classification === 'developing' && !(article.update_history || []).length) issue(warnings, article.__file, 'developing coverage should include at least one update_history entry');
  if (article.status === 'corrected' && !(article.corrections || []).length && !String(article.what_changed || '').trim()) issue(errors, article.__file, 'corrected articles require a correction entry or what_changed note');

  if (isReleaseReady && !article.published_at) issue(errors, article.__file, 'published_at is required before publishing');
  if (article.published_at && Number.isNaN(new Date(article.published_at).getTime())) issue(errors, article.__file, 'published_at must be a valid ISO date-time');
  if (article.status === 'scheduled' && article.published_at && new Date(article.published_at) <= new Date()) issue(warnings, article.__file, 'scheduled article is due now; run npm run publish:due or wait for the scheduled GitHub workflow');
  if (article.updated_at) {
    const updated = new Date(article.updated_at);
    const published = new Date(article.published_at);
    if (Number.isNaN(updated.getTime())) issue(errors, article.__file, 'updated_at must be a valid ISO date-time');
    else if (!article.published_at) publishIssue(article, 'updated_at requires published_at');
    else if (!Number.isNaN(published.getTime()) && updated < published) issue(errors, article.__file, 'updated_at cannot be earlier than published_at');
  }

  if (isReleaseReady && !article.author) issue(errors, article.__file, 'author is required before publishing');
  if (article.author && !authorSlugs.has(article.author)) issue(errors, article.__file, `unknown author reference: ${article.author}`);
  if (article.categories !== undefined && !Array.isArray(article.categories)) {
    issue(errors, article.__file, 'categories must be an array');
  } else {
    const selected = article.categories || [];
    if (isReleaseReady && selected.length < 1) issue(errors, article.__file, 'at least one category is required before publishing');
    if (selected.length > 5) issue(errors, article.__file, 'no more than five categories are allowed');
    if (new Set(selected).size !== selected.length) issue(errors, article.__file, 'categories must not contain duplicates');
    for (const category of selected) if (!categorySlugs.has(category)) issue(errors, article.__file, `unknown category reference: ${category}`);
  }
  if (article.hub && !hubSlugs.has(article.hub)) issue(errors, article.__file, `unknown hub reference: ${article.hub}`);
  if (article.tags !== undefined) {
    if (!Array.isArray(article.tags)) issue(errors, article.__file, 'tags must be an array');
    else {
      if (article.tags.length > 20) issue(errors, article.__file, 'no more than 20 tags are allowed');
      if (new Set(article.tags.map((tag) => String(tag).toLowerCase())).size !== article.tags.length) issue(errors, article.__file, 'tags must not contain duplicates');
      for (const tag of article.tags) if (typeof tag !== 'string' || !tag.trim() || tag.length > 60) issue(errors, article.__file, 'each tag must be a non-empty string of 60 characters or fewer');
    }
  }

  const pdf = article.pdf_file || article.pdf_url || '';
  if (['pdf', 'mixed'].includes(article.article_type) && !pdf) publishIssue(article, `${article.article_type} articles require pdf_file or pdf_url`);
  if (article.article_type === 'external' && !article.pdf_url) publishIssue(article, 'external articles require an absolute pdf_url');
  if (article.article_type === 'external' && article.pdf_file) publishIssue(article, 'external articles cannot use pdf_file');
  if (['standard', 'mixed'].includes(article.article_type) && !String(article.body || '').trim()) publishIssue(article, `${article.article_type} articles require article body text`);
  if (article.article_type === 'standard' && pdf) issue(warnings, article.__file, 'standard articles ignore PDF fields; use mixed or pdf instead');
  if (['pdf', 'mixed', 'external'].includes(article.article_type) && !String(article.pdf_title || '').trim()) publishIssue(article, `${article.article_type} articles require pdf_title`);
  if (['pdf', 'mixed', 'external'].includes(article.article_type)) {
    if (String(article.document_description || '').trim().length < 20) publishIssue(article, `${article.article_type} articles require a document_description of at least 20 characters`);
    if (site.accessibility?.document_summary_required !== false && String(article.document_accessible_summary || '').trim().length < 40) publishIssue(article, `${article.article_type} articles require a document_accessible_summary of at least 40 characters`);
  }
  if (article.pdf_file && article.pdf_url) issue(warnings, article.__file, 'both pdf_file and pdf_url are set; pdf_file takes precedence');
  if (article.pdf_viewer_default !== undefined && !PDF_VIEW_MODES.has(article.pdf_viewer_default)) issue(errors, article.__file, 'pdf_viewer_default must be fit-width or fit-page');
  if (article.pdf_viewer_default && !['pdf', 'mixed'].includes(article.article_type)) issue(warnings, article.__file, 'pdf_viewer_default is ignored unless article_type is pdf or mixed');
  if (!validWebOrLocalUrl(article.pdf_file || '')) issue(errors, article.__file, 'pdf_file must be a site-relative or HTTP(S) URL');
  if (article.pdf_url && !validAbsoluteWebUrl(article.pdf_url)) issue(errors, article.__file, 'pdf_url must be an absolute HTTP(S) URL');
  if (article.pdf_file?.startsWith('/')) {
    const localPath = path.join(ROOT, 'public', article.pdf_file.slice(1));
    if (!fs.existsSync(localPath)) issue(errors, article.__file, `local PDF does not exist: ${article.pdf_file}`);
  }

  if (article.document_date && Number.isNaN(new Date(article.document_date).getTime())) issue(errors, article.__file, 'document_date must be a valid date');
  if (article.document_pages !== undefined && (!Number.isInteger(article.document_pages) || article.document_pages < 0)) issue(errors, article.__file, 'document_pages must be a non-negative integer');
  for (const field of ['featured', 'allow_download', 'show_author_bio', 'noindex', ...PUBLISH_REVIEW_FIELDS]) {
    if (article[field] !== undefined && typeof article[field] !== 'boolean') issue(errors, article.__file, `${field} must be true or false`);
  }
  if (isReleaseReady) {
    for (const field of PUBLISH_REVIEW_FIELDS) if (article[field] !== true) issue(errors, article.__file, `${field} must be confirmed before publishing`);
  }

  let canonical = '';
  if (article.canonical_url && !validAbsoluteWebUrl(article.canonical_url)) issue(errors, article.__file, 'canonical_url must be an absolute HTTP(S) URL');
  else if (isReleaseReady && siteUrl) {
    try {
      const parsed = new URL(article.canonical_url || `/stories/${article.slug}/`, siteUrl);
      canonical = parsed.href;
      if (parsed.protocol !== 'https:') issue(errors, article.__file, 'canonical_url must use HTTPS');
      if (parsed.username || parsed.password) issue(errors, article.__file, 'canonical_url cannot contain credentials');
      if (parsed.search || parsed.hash) issue(errors, article.__file, 'canonical_url cannot contain a query string or fragment');
      if (parsed.origin === siteUrl.origin && parsed.pathname !== `/stories/${article.slug}/`) {
        issue(errors, article.__file, `same-site canonical_url must match /stories/${article.slug}/`);
      }
      if (seenCanonicalUrls.has(canonical)) issue(errors, article.__file, `canonical URL is already used by ${seenCanonicalUrls.get(canonical)}`);
      else seenCanonicalUrls.set(canonical, relativeFile(article.__file));
    } catch (error) {
      issue(errors, article.__file, `canonical_url is invalid: ${error.message}`);
    }
  }

  if (article.legacy_urls !== undefined && !Array.isArray(article.legacy_urls)) issue(errors, article.__file, 'legacy_urls must be an array');
  else {
    const legacy = article.legacy_urls || [];
    if (legacy.length > 30) issue(errors, article.__file, 'no more than 30 legacy URLs are allowed per article');
    const normalized = new Set();
    for (const [index, value] of legacy.entries()) {
      if (typeof value !== 'string' || !value.trim() || value.length > 900) {
        issue(errors, article.__file, `legacy_urls[${index}] must be a non-empty string of 900 characters or fewer`);
        continue;
      }
      try {
        const source = sourcePathFromLegacyUrl(value);
        if (normalized.has(source)) issue(errors, article.__file, `legacy_urls contains duplicate path: ${source}`);
        normalized.add(source);
      } catch (error) {
        issue(errors, article.__file, `legacy_urls[${index}] is invalid: ${error.message}`);
      }
    }
  }

  validateStoryBlocks(article);

  if (!Array.isArray(article.source_links || [])) {
    issue(errors, article.__file, 'source_links must be an array');
  } else {
    if ((article.source_links || []).length > 30) issue(errors, article.__file, 'no more than 30 source links are allowed');
    for (const [index, source] of (article.source_links || []).entries()) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        issue(errors, article.__file, `source_links[${index}] must be an object`);
        continue;
      }
      if (!String(source.label || '').trim()) issue(errors, article.__file, `source_links[${index}].label is required`);
      if (!validWebOrLocalUrl(source.url || '')) issue(errors, article.__file, `source_links[${index}].url must be site-relative or HTTP(S)`);
    }
  }
  if (article.featured_image && !validWebOrLocalUrl(article.featured_image)) issue(errors, article.__file, 'featured_image must be site-relative or HTTP(S)');
  validateLocalAsset(article.featured_image, article.__file, 'featured_image');
  if (article.featured_image && !article.featured_image_alt) publishIssue(article, 'featured_image_alt is required when featured_image is set');
  if (article.featured_image_aspect !== undefined && !IMAGE_ASPECTS.includes(article.featured_image_aspect)) issue(errors, article.__file, `featured_image_aspect must be one of: ${IMAGE_ASPECTS.join(', ')}`);
  if (article.featured_image_focal_point !== undefined && !IMAGE_FOCAL_POINTS.includes(article.featured_image_focal_point)) issue(errors, article.__file, `featured_image_focal_point must be one of: ${IMAGE_FOCAL_POINTS.join(', ')}`);
  const mediaSources = articleMedia(article).filter((item) => item.src);
  if (mediaSources.length > 30) issue(errors, article.__file, 'an article cannot reference more than 30 images');
  if (isPublished && article.noindex) issue(warnings, article.__file, 'published article is marked noindex');
}


const seriesOwners = new Map();
const seriesOrders = new Map();
for (const article of articles) {
  if (!article.series_slug) continue;
  const owner = seriesOwners.get(article.series_slug);
  const title = String(article.series_title || '').trim();
  const description = String(article.series_description || '').trim();
  if (owner && owner.title !== title) issue(errors, article.__file, `series_title must match “${owner.title}” for series ${article.series_slug}`);
  else if (!owner) seriesOwners.set(article.series_slug, { title, description, file: article.__file });
  else if (owner.description && description && owner.description !== description) issue(errors, article.__file, `series_description must match the other entries in series ${article.series_slug}`);
  const orderKey = `${article.series_slug}:${article.series_order}`;
  if (article.series_order !== undefined) {
    if (seriesOrders.has(orderKey)) issue(errors, article.__file, `series_order ${article.series_order} is already used by ${relativeFile(seriesOrders.get(orderKey))}`);
    else seriesOrders.set(orderKey, article.__file);
  }
}

try {
  uniqueTopics(articles.filter((article) => article.status === 'published'));
} catch (error) {
  issue(errors, siteFile, error.message);
}

const featuredPublished = articles.filter((article) => article.status === 'published' && article.featured);
if (featuredPublished.length > 1) issue(warnings, siteFile, `${featuredPublished.length} published articles are featured; the newest becomes the homepage feature`);

for (const warning of warnings) console.warn(`WARNING ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  console.error(`\nValidation failed: ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`Content valid: ${articles.length} article(s), ${authors.length} author(s), ${categories.length} category item(s), ${hubs.length} hub(s), ${crosswords.length} crossword(s).`);
if (warnings.length) console.log(`Warnings: ${warnings.length}`);
