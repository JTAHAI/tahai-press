import fs from 'node:fs';
import path from 'node:path';
import { loadContent, relativeFile, ROOT } from './lib/content.mjs';
import { sourcePathFromLegacyUrl } from './lib/redirects.mjs';
import { uniqueTopics } from './lib/discovery.mjs';
import { themeContrastErrors } from './lib/accessibility.mjs';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS = new Set(['draft', 'published', 'archived']);
const TYPES = new Set(['standard', 'pdf', 'mixed', 'external']);
const PDF_VIEW_MODES = new Set(['fit-width', 'fit-page']);
const THEME_FIELDS = ['brand', 'brand_deep', 'brand_soft', 'accent', 'accent_dark', 'highlight', 'surface', 'surface_deep', 'paper'];
const PUBLISH_REVIEW_FIELDS = ['review_content', 'review_rights', 'review_accessibility'];
const PUBLISHER_TYPES = new Set(['Organization', 'NewsMediaOrganization']);
const ARTICLE_SCHEMA_TYPES = new Set(['Article', 'NewsArticle', 'BlogPosting']);
const AUTHOR_ENTITY_TYPES = new Set(['Person', 'Organization']);
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
  issue(article.status === 'published' ? errors : warnings, article.__file, message);
}

const { site, articles, authors, categories, hubs } = loadContent();
const siteFile = path.join(ROOT, 'content', 'site.json');
validateSluggedCollection(authors, 'author', { requireActive: true });
validateSluggedCollection(categories, 'category');
validateSluggedCollection(hubs, 'hub', { requireActive: true });

const authorSlugs = new Set(authors.map((item) => item.slug));
const categorySlugs = new Set(categories.map((item) => item.slug));
const hubSlugs = new Set(hubs.map((item) => item.slug));
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

if (!site.theme || typeof site.theme !== 'object' || Array.isArray(site.theme)) {
  issue(errors, siteFile, 'theme must be an object');
} else {
  let colorsValid = true;
  for (const field of THEME_FIELDS) {
    if (!HEX_COLOR.test(site.theme[field] || '')) {
      colorsValid = false;
      issue(errors, siteFile, `theme.${field} must be a six-digit hex color`);
    }
  }
  if (colorsValid) {
    for (const message of themeContrastErrors(site.theme)) issue(errors, siteFile, `theme contrast: ${message}`);
  }
}

if (!site.accessibility || typeof site.accessibility !== 'object' || Array.isArray(site.accessibility)) {
  issue(errors, siteFile, 'accessibility must be an object');
} else {
  if (typeof site.accessibility.statement_enabled !== 'boolean') issue(errors, siteFile, 'accessibility.statement_enabled must be true or false');
  optionalString(site.accessibility, 'statement_intro', siteFile, 900);
  optionalString(site.accessibility, 'feedback_note', siteFile, 700);
  if (site.accessibility.contact_email && !EMAIL.test(site.accessibility.contact_email)) issue(errors, siteFile, 'accessibility.contact_email must be a valid email address');
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

  const isPublished = article.status === 'published';
  if (isPublished && String(article.title || '').trim().length < 5) issue(errors, article.__file, 'published title must contain at least 5 characters');
  if (isPublished && String(article.excerpt || '').trim().length < 20) issue(errors, article.__file, 'published excerpt must contain at least 20 characters');
  optionalString(article, 'excerpt', article.__file, 360);
  optionalString(article, 'kicker', article.__file, 100);
  optionalString(article, 'featured_image_alt', article.__file, 240);
  optionalString(article, 'pdf_title', article.__file, 180);
  optionalString(article, 'document_description', article.__file, 600);
  optionalString(article, 'document_source', article.__file, 180);
  optionalString(article, 'external_link_label', article.__file, 100);
  optionalString(article, 'seo_title', article.__file, 70);
  optionalString(article, 'seo_description', article.__file, 170);
  optionalString(article, 'editor_notes', article.__file, 2000);

  if (isPublished && !article.published_at) issue(errors, article.__file, 'published_at is required before publishing');
  if (article.published_at && Number.isNaN(new Date(article.published_at).getTime())) issue(errors, article.__file, 'published_at must be a valid ISO date-time');
  if (article.updated_at) {
    const updated = new Date(article.updated_at);
    const published = new Date(article.published_at);
    if (Number.isNaN(updated.getTime())) issue(errors, article.__file, 'updated_at must be a valid ISO date-time');
    else if (!article.published_at) issue(errors, article.__file, 'updated_at requires published_at');
    else if (!Number.isNaN(published.getTime()) && updated < published) issue(errors, article.__file, 'updated_at cannot be earlier than published_at');
  }

  if (isPublished && !article.author) issue(errors, article.__file, 'author is required before publishing');
  if (article.author && !authorSlugs.has(article.author)) issue(errors, article.__file, `unknown author reference: ${article.author}`);
  if (article.categories !== undefined && !Array.isArray(article.categories)) {
    issue(errors, article.__file, 'categories must be an array');
  } else {
    const selected = article.categories || [];
    if (isPublished && selected.length < 1) issue(errors, article.__file, 'at least one category is required before publishing');
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
  if (isPublished) {
    for (const field of PUBLISH_REVIEW_FIELDS) if (article[field] !== true) issue(errors, article.__file, `${field} must be confirmed before publishing`);
  }

  let canonical = '';
  if (article.canonical_url && !validAbsoluteWebUrl(article.canonical_url)) issue(errors, article.__file, 'canonical_url must be an absolute HTTP(S) URL');
  else if (isPublished && siteUrl) {
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
  if (isPublished && article.noindex) issue(warnings, article.__file, 'published article is marked noindex');
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
console.log(`Content valid: ${articles.length} article(s), ${authors.length} author(s), ${categories.length} category item(s), ${hubs.length} hub(s).`);
if (warnings.length) console.log(`Warnings: ${warnings.length}`);
