import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, relativeFile } from './content.mjs';
import { articleMedia, imageDimensions } from './editorial.mjs';

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf']);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(file));
    else if (entry.isFile() && entry.name !== '.gitkeep') output.push(file);
  }
  return output.sort();
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function imageFingerprint(file) {
  const { data } = await sharp(file, { failOn: 'error' })
    .rotate()
    .resize(8, 8, { fit: 'fill' })
    .removeAlpha()
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const average = data.reduce((sum, value) => sum + value, 0) / data.length;
  let bits = '';
  for (const value of data) bits += value >= average ? '1' : '0';
  return bits;
}

function hammingDistance(left = '', right = '') {
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length);
  for (let index = 0; index < length; index += 1) if (left[index] !== right[index]) distance += 1;
  return distance;
}

function publicUrl(file) {
  return `/${path.relative(path.join(ROOT, 'public'), file).replaceAll('\\', '/')}`;
}

function localReference(value = '') {
  const raw = String(value || '').trim();
  return raw.startsWith('/') && !raw.startsWith('//') ? raw.split(/[?#]/)[0] : '';
}

function collectReferences({ site, articles, authors }) {
  const references = new Map();
  const add = (value, owner, kind) => {
    const url = localReference(value);
    if (!url) return;
    const current = references.get(url) || [];
    current.push({ owner, kind });
    references.set(url, current);
  };

  add(site.logo, 'content/site.json', 'publication logo');
  add(site.default_social_image, 'content/site.json', 'default social image');
  for (const author of authors) add(author.avatar, relativeFile(author.__file), 'author avatar');
  for (const article of articles) {
    const owner = relativeFile(article.__file);
    add(article.pdf_file, owner, 'article document');
    for (const media of articleMedia(article)) add(media.src, owner, media.context || 'article image');
    for (const block of article.story_blocks || []) {
      if (block?.type === 'document') add(block.url || block.file, owner, 'story document');
    }
  }
  return references;
}

export async function mediaHealth({ site, articles, authors }) {
  const publicRoot = path.join(ROOT, 'public');
  const mediaRoot = path.join(publicRoot, 'uploads');
  const files = walk(mediaRoot);
  const references = collectReferences({ site, articles, authors });
  const inventory = files.map((file) => {
    const url = publicUrl(file);
    const extension = path.extname(file).toLowerCase();
    const stat = fs.statSync(file);
    const type = IMAGE_EXTENSIONS.has(extension) ? 'image' : DOCUMENT_EXTENSIONS.has(extension) ? 'document' : 'other';
    return {
      path: relativeFile(file),
      url,
      type,
      extension,
      size_bytes: stat.size,
      sha256: sha256(file),
      dimensions: type === 'image' ? imageDimensions(url) : null,
      references: references.get(url) || []
    };
  });

  const fingerprints = new Map();
  for (const item of inventory) {
    if (item.type !== 'image' || !fs.existsSync(path.join(ROOT, item.path))) continue;
    try {
      fingerprints.set(item.url, await imageFingerprint(path.join(ROOT, item.path)));
    } catch {}
  }

  const inventoryByUrl = new Map(inventory.map((item) => [item.url, item]));
  const missing = [...references.entries()]
    .filter(([url]) => !inventoryByUrl.has(url) && url.startsWith('/uploads/'))
    .map(([url, owners]) => ({ url, references: owners }));
  const orphaned = inventory.filter((item) => item.references.length === 0);
  const oversized = inventory.filter((item) => (
    (item.type === 'image' && item.size_bytes > 2 * 1024 * 1024)
    || (item.type === 'document' && item.size_bytes > 20 * 1024 * 1024)
  ));
  const undecodableImages = inventory.filter((item) => item.type === 'image' && !item.dimensions && item.extension !== '.avif');

  const hashGroups = new Map();
  for (const item of inventory) {
    const group = hashGroups.get(item.sha256) || [];
    group.push(item.url);
    hashGroups.set(item.sha256, group);
  }
  const duplicates = [...hashGroups.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([hash, urls]) => ({ sha256: hash, urls }));

  const nearDuplicates = [];
  const images = inventory.filter((item) => item.type === 'image' && fingerprints.has(item.url));
  for (let left = 0; left < images.length; left += 1) {
    for (let right = left + 1; right < images.length; right += 1) {
      if (images[left].sha256 === images[right].sha256) continue;
      const distance = hammingDistance(fingerprints.get(images[left].url), fingerprints.get(images[right].url));
      if (distance <= 6) {
        nearDuplicates.push({
          distance,
          urls: [images[left].url, images[right].url],
          dimensions: [images[left].dimensions, images[right].dimensions]
        });
      }
    }
  }

  const warnings = [
    ...missing.map((item) => `Missing local media: ${item.url}`),
    ...orphaned.map((item) => `Unused upload: ${item.url}`),
    ...oversized.map((item) => `Oversized ${item.type}: ${item.url} (${item.size_bytes} bytes)`),
    ...duplicates.map((item) => `Duplicate uploads: ${item.urls.join(', ')}`),
    ...nearDuplicates.map((item) => `Near-duplicate uploads: ${item.urls.join(', ')} (distance ${item.distance})`),
    ...undecodableImages.map((item) => `Image dimensions could not be read: ${item.url}`)
  ];

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    summary: {
      files: inventory.length,
      images: inventory.filter((item) => item.type === 'image').length,
      documents: inventory.filter((item) => item.type === 'document').length,
      referenced: inventory.filter((item) => item.references.length > 0).length,
      orphaned: orphaned.length,
      missing: missing.length,
      oversized: oversized.length,
      duplicates: duplicates.length,
      near_duplicates: nearDuplicates.length,
      warnings: warnings.length
    },
    thresholds: {
      image_warning_bytes: 2 * 1024 * 1024,
      document_warning_bytes: 20 * 1024 * 1024,
      cloudflare_file_limit_bytes: 25 * 1024 * 1024
    },
    missing,
    orphaned,
    oversized,
    duplicates,
    near_duplicates: nearDuplicates,
    undecodable_images: undecodableImages,
    inventory,
    warnings
  };
}

function fileSize(file) {
  try { return fs.statSync(file).size; } catch { return 0; }
}

function largestFiles(directory, limit = 20) {
  return walk(directory)
    .map((file) => ({ path: relativeFile(file), size_bytes: fileSize(file) }))
    .sort((a, b) => b.size_bytes - a.size_bytes)
    .slice(0, limit);
}

export function performanceHealth({ dist, budgets = {} }) {
  const defaults = {
    homepage_html_bytes: 300 * 1024,
    stylesheet_bytes: 250 * 1024,
    javascript_total_bytes: 500 * 1024,
    search_index_bytes: 2 * 1024 * 1024,
    generated_file_count: 20000,
    individual_file_bytes: 25 * 1024 * 1024
  };
  const limits = { ...defaults, ...(budgets || {}) };
  const allFiles = walk(dist);
  const homepage = path.join(dist, 'index.html');
  const stylesheet = path.join(dist, 'assets', 'styles.css');
  const searchIndex = path.join(dist, 'search-index.json');
  const scripts = allFiles.filter((file) => path.extname(file).toLowerCase() === '.js');
  const metrics = {
    homepage_html_bytes: fileSize(homepage),
    stylesheet_bytes: fileSize(stylesheet),
    javascript_total_bytes: scripts.reduce((sum, file) => sum + fileSize(file), 0),
    search_index_bytes: fileSize(searchIndex),
    generated_file_count: allFiles.length,
    generated_total_bytes: allFiles.reduce((sum, file) => sum + fileSize(file), 0),
    largest_file_bytes: Math.max(0, ...allFiles.map(fileSize))
  };
  const checks = Object.entries(limits).map(([key, limit]) => {
    const metric = key === 'individual_file_bytes' ? metrics.largest_file_bytes : metrics[key];
    return { key, value: metric, limit, pass: metric <= limit };
  });
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    budgets: limits,
    metrics,
    checks,
    passed: checks.every((check) => check.pass),
    largest_files: largestFiles(dist)
  };
}

export function newsroomHealth({ site, articles, redirects = 0, media, performance, launch }) {
  const now = Date.now();
  const staleCutoffDays = Number(site.operations?.stale_article_days || 730);
  const staleCutoff = now - staleCutoffDays * 86400000;
  const published = articles.filter((article) => article.status === 'published');
  const scheduled = articles.filter((article) => article.status === 'scheduled');
  const drafts = articles.filter((article) => article.status === 'draft');
  const archived = articles.filter((article) => article.status === 'archived');
  const stale = published.filter((article) => {
    const date = new Date(article.updated_at || article.published_at || 0).getTime();
    return Number.isFinite(date) && date < staleCutoff;
  }).map((article) => ({ slug: article.slug, title: article.title, last_activity: article.updated_at || article.published_at }));
  const withoutRelated = published.filter((article) => !(article.related_articles || []).length).map((article) => article.slug);
  const noFeaturedImage = published.filter((article) => !article.featured_image).map((article) => article.slug);
  const scheduledDue = scheduled.filter((article) => new Date(article.published_at).getTime() <= now).map((article) => article.slug);

  const attention = [
    ...(media?.warnings || []),
    ...(!performance?.passed ? performance.checks.filter((check) => !check.pass).map((check) => `Performance budget exceeded: ${check.key}`) : []),
    ...scheduledDue.map((slug) => `Scheduled article is due but not published: ${slug}`),
    ...stale.map((article) => `Published article may need review: ${article.slug}`)
  ];

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    publication: site.title,
    summary: {
      published: published.length,
      drafts: drafts.length,
      scheduled: scheduled.length,
      archived: archived.length,
      redirects,
      media_files: media?.summary?.files || 0,
      media_warnings: media?.summary?.warnings || 0,
      performance_budgets_passed: Boolean(performance?.passed),
      launch_ready: Boolean(launch?.ready ?? launch?.ok),
      attention_items: attention.length
    },
    editorial: {
      scheduled_due: scheduledDue,
      stale_after_days: staleCutoffDays,
      stale_articles: stale,
      published_without_related_coverage: withoutRelated,
      published_without_featured_image: noFeaturedImage
    },
    launch,
    media: media?.summary || {},
    performance: performance ? { passed: performance.passed, metrics: performance.metrics, failed_checks: performance.checks.filter((check) => !check.pass) } : {},
    attention
  };
}
