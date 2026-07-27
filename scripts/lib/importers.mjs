import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './content.mjs';

export const IMPORT_TYPES = new Set(['auto', 'wordpress', 'markdown', 'json', 'csv', 'pdf']);
export const CONFLICT_MODES = new Set(['skip', 'suffix', 'overwrite']);

export function slugify(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120) || 'untitled-import';
}

export function titleFromFilename(file) {
  return path.basename(file, path.extname(file))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Untitled import';
}

function decodeEntities(value = '') {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…'
  };
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

export function htmlToMarkdown(value = '') {
  let text = String(value)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n## $1\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, body) => `\n${body.replace(/<br\s*\/?\s*>/gi, '\n').split(/\n+/).map((line) => `> ${line}`).join('\n')}\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|section|article|ul|ol)>/gi, '\n\n')
    .replace(/<(p|div|section|article|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  text = decodeEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

export function plainText(value = '') {
  return htmlToMarkdown(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeExcerpt(value = '', fallback = 'Imported content awaiting editorial review before publication.') {
  const text = plainText(value) || fallback;
  if (text.length <= 340) return text;
  return `${text.slice(0, 337).replace(/\s+\S*$/, '')}…`;
}

function parseScalar(value = '') {
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).split(',').map((item) => parseScalar(item)).filter((item) => item !== '');
  }
  return trimmed;
}

export function parseFrontmatter(text = '') {
  const normalized = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return { data: {}, body: normalized };
  const end = normalized.indexOf('\n---\n', 4);
  if (end < 0) return { data: {}, body: normalized };
  const header = normalized.slice(4, end);
  const data = {};
  let listKey = '';
  for (const rawLine of header.split('\n')) {
    if (/^\s*-\s+/.test(rawLine) && listKey) {
      if (!Array.isArray(data[listKey])) data[listKey] = [];
      data[listKey].push(parseScalar(rawLine.replace(/^\s*-\s+/, '')));
      continue;
    }
    const match = rawLine.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!rawValue.trim()) {
      data[key] = [];
      listKey = key;
    } else {
      data[key] = parseScalar(rawValue);
      listKey = '';
    }
  }
  return { data, body: normalized.slice(end + 5).trim() };
}

function parseCsvRows(text = '') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => cell.trim()));
}

export function parseCsv(text = '') {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function xmlTag(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(block).match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeEntities(match[1]).trim() : '';
}

function xmlTerms(block, domain) {
  const output = [];
  const regex = /<category\s+([^>]*)>([\s\S]*?)<\/category>/gi;
  let match;
  while ((match = regex.exec(block))) {
    const attrs = match[1];
    const domainMatch = attrs.match(/domain=["']([^"']+)["']/i);
    if (domainMatch?.[1] === domain) output.push(decodeEntities(match[2]).trim());
  }
  return output;
}

export function parseWordPressWxr(text = '') {
  const posts = [];
  const items = String(text).match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const item of items) {
    const postType = xmlTag(item, 'wp:post_type') || 'post';
    if (!['post', 'page'].includes(postType)) continue;
    const rawStatus = xmlTag(item, 'wp:status') || 'draft';
    const title = xmlTag(item, 'title') || 'Untitled import';
    const content = xmlTag(item, 'content:encoded');
    const excerpt = xmlTag(item, 'excerpt:encoded');
    posts.push({
      title,
      slug: xmlTag(item, 'wp:post_name') || slugify(title),
      body: htmlToMarkdown(content),
      excerpt: makeExcerpt(excerpt || content),
      published_at: normalizeDate(xmlTag(item, 'wp:post_date_gmt') || xmlTag(item, 'wp:post_date')),
      updated_at: normalizeDate(xmlTag(item, 'wp:post_modified_gmt') || xmlTag(item, 'wp:post_modified')),
      legacy_url: xmlTag(item, 'link'),
      legacy_id: xmlTag(item, 'wp:post_id'),
      original_status: rawStatus,
      categories: xmlTerms(item, 'category'),
      tags: xmlTerms(item, 'post_tag'),
      creator: xmlTag(item, 'dc:creator'),
      post_type: postType,
      import_warnings: [
        ...(/<img\b/i.test(content) ? ['Inline WordPress images were not downloaded; review and reattach media manually.'] : []),
        ...(/\[[A-Za-z][^\]]*\]/.test(content) ? ['WordPress shortcodes may require manual cleanup.'] : [])
      ],
      source_name: title
    });
  }
  return posts;
}

export function normalizeDate(value = '') {
  const raw = String(value).trim();
  if (!raw || raw.startsWith('0000-00-00')) return '';
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const date = new Date(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value || '').split(/[|;,]/).map((item) => item.trim()).filter(Boolean);
}

function pick(record, names, fallback = '') {
  for (const name of names) {
    if (record?.[name] !== undefined && record?.[name] !== null && String(record[name]).trim() !== '') return record[name];
  }
  return fallback;
}

export function normalizeRecord(record, defaults = {}) {
  const title = String(pick(record, ['title', 'post_title', 'name'], 'Untitled import')).trim();
  const body = String(pick(record, ['body', 'content', 'post_content', 'markdown', 'description'], '')).trim();
  const rawCategories = stringList(pick(record, ['categories', 'category'], []));
  const tags = [...new Set([...stringList(pick(record, ['tags', 'tag'], [])), ...rawCategories])].slice(0, 20);
  const pdfValue = String(pick(record, ['pdf_file', 'pdf', 'document', 'attachment'], '')).trim();
  const pdfUrl = String(pick(record, ['pdf_url', 'document_url'], '')).trim();
  const isExternal = /^https?:\/\//i.test(pdfUrl || pdfValue);
  const hasPdf = Boolean(pdfValue || pdfUrl);
  const type = String(pick(record, ['article_type', 'type'], hasPdf ? (body ? 'mixed' : (isExternal ? 'external' : 'pdf')) : 'standard')).toLowerCase();
  const originalStatus = String(pick(record, ['status', 'post_status', 'original_status'], '')).toLowerCase();
  const sourcePublished = originalStatus === 'publish' || originalStatus === 'published';
  const requestedStatus = defaults.status === 'preserve'
    ? (sourcePublished && defaults.markReviewed ? 'published' : originalStatus === 'archived' ? 'archived' : 'draft')
    : (defaults.status || 'draft');
  const isPublished = requestedStatus === 'published';
  const publishedAt = normalizeDate(pick(record, ['published_at', 'published', 'date', 'post_date'], ''));
  const updatedAt = normalizeDate(pick(record, ['updated_at', 'modified', 'post_modified'], ''));
  const legacyUrl = String(pick(record, ['legacy_url', 'url', 'link', 'canonical_url'], '')).trim();
  const sourceLinks = legacyUrl && /^https?:\/\//i.test(legacyUrl)
    ? [{ label: 'Original publication URL', url: legacyUrl, note: 'Preserved during import for migration review.' }]
    : [];
  return {
    title,
    slug: slugify(pick(record, ['slug', 'post_name'], title)),
    status: ['draft', 'published', 'archived'].includes(requestedStatus) ? requestedStatus : 'draft',
    article_type: ['standard', 'pdf', 'mixed', 'external'].includes(type) ? type : 'standard',
    kicker: String(pick(record, ['kicker', 'section'], 'Imported content')).slice(0, 100),
    excerpt: makeExcerpt(pick(record, ['excerpt', 'summary', 'dek'], body)),
    body: htmlToMarkdown(body),
    published_at: publishedAt,
    updated_at: updatedAt && updatedAt !== publishedAt ? updatedAt : '',
    author: String(pick(record, ['author'], defaults.author || 'editorial-team')),
    categories: stringList(pick(record, ['category_slugs'], defaults.category || 'community-reporting')).map(slugify).slice(0, 5),
    tags,
    hub: String(pick(record, ['hub'], defaults.hub || '')),
    featured: false,
    featured_image: String(pick(record, ['featured_image', 'image'], '')),
    featured_image_alt: String(pick(record, ['featured_image_alt', 'image_alt'], '')).slice(0, 240),
    pdf_file: !isExternal ? pdfValue : '',
    pdf_url: isExternal ? (pdfUrl || pdfValue) : pdfUrl,
    pdf_title: hasPdf ? String(pick(record, ['pdf_title', 'document_title'], title)).slice(0, 180) : '',
    document_description: hasPdf ? String(pick(record, ['document_description'], 'Imported document awaiting editorial context.')).slice(0, 600) : '',
    document_date: String(pick(record, ['document_date'], '')),
    document_pages: Number.parseInt(pick(record, ['document_pages', 'pages'], 0), 10) || 0,
    document_source: String(pick(record, ['document_source', 'source'], '')).slice(0, 180),
    external_link_label: isExternal ? String(pick(record, ['external_link_label'], 'Open source document')).slice(0, 100) : '',
    allow_download: Boolean(!isExternal && hasPdf),
    pdf_viewer_default: 'fit-width',
    show_author_bio: true,
    source_links: sourceLinks,
    seo_title: '',
    seo_description: '',
    canonical_url: '',
    legacy_urls: legacyUrl ? [legacyUrl] : [],
    noindex: !isPublished,
    review_content: Boolean(isPublished && defaults.markReviewed),
    review_rights: Boolean(isPublished && defaults.markReviewed),
    review_accessibility: Boolean(isPublished && defaults.markReviewed),
    editor_notes: `Imported from ${record.source_name || 'a migration source'} with original status ${originalStatus || 'unknown'}. Verify formatting, facts, rights, accessibility, dates, links, taxonomy, and legacy URL.${record.legacy_id ? ` Legacy ID: ${record.legacy_id}.` : ''}`
  };
}

export function detectImportType(input) {
  const extension = path.extname(input).toLowerCase();
  if (extension === '.xml') return 'wordpress';
  if (extension === '.md' || extension === '.markdown') return 'markdown';
  if (extension === '.json') return 'json';
  if (extension === '.csv') return 'csv';
  if (extension === '.pdf') return 'pdf';
  if (fs.existsSync(input) && fs.statSync(input).isDirectory()) return 'auto';
  throw new Error(`Unable to detect import type for ${input}`);
}

function listFiles(input, extensions) {
  const stat = fs.statSync(input);
  if (stat.isFile()) return extensions.includes(path.extname(input).toLowerCase()) ? [input] : [];
  return fs.readdirSync(input, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(input, entry.name);
      return entry.isDirectory() ? listFiles(full, extensions) : [full];
    })
    .filter((file) => extensions.includes(path.extname(file).toLowerCase()))
    .sort();
}

export function discoverRecords(input, type = 'auto') {
  const selected = type === 'auto' ? detectImportType(input) : type;
  if (!IMPORT_TYPES.has(selected)) throw new Error(`Unsupported import type: ${selected}`);
  if (selected === 'wordpress') {
    return parseWordPressWxr(fs.readFileSync(input, 'utf8')).map((record) => ({ record, source: input, kind: 'wordpress' }));
  }
  if (selected === 'markdown') {
    return listFiles(input, ['.md', '.markdown']).map((file) => {
      const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      const heading = parsed.body.match(/^#\s+(.+)$/m)?.[1];
      const title = parsed.data.title || heading || titleFromFilename(file);
      const body = heading ? parsed.body.replace(/^#\s+.+(?:\n+|$)/, '').trim() : parsed.body;
      const importWarnings = /!\[[^\]]*\]\([^)]+\)/.test(body)
        ? ['Markdown image references were preserved but image files were not copied automatically.']
        : [];
      return { record: { ...parsed.data, title, body, import_warnings: importWarnings, source_name: path.basename(file) }, source: file, kind: 'markdown' };
    });
  }
  if (selected === 'json') {
    const parsed = JSON.parse(fs.readFileSync(input, 'utf8'));
    const records = Array.isArray(parsed) ? parsed : (parsed.articles || parsed.posts || parsed.items || [parsed]);
    return records.map((record, index) => ({ record: { ...record, source_name: record.source_name || `${path.basename(input)}#${index + 1}` }, source: input, kind: 'json' }));
  }
  if (selected === 'csv') {
    return parseCsv(fs.readFileSync(input, 'utf8')).map((record, index) => ({ record: { ...record, source_name: `${path.basename(input)}#${index + 2}` }, source: input, kind: 'csv' }));
  }
  if (selected === 'pdf') {
    return listFiles(input, ['.pdf']).map((file) => ({ record: { title: titleFromFilename(file), pdf_source_path: file, source_name: path.basename(file) }, source: file, kind: 'pdf' }));
  }
  // Auto directory intake intentionally supports mixed Markdown, JSON, CSV, XML, and PDF batches.
  const types = [
    ['markdown', ['.md', '.markdown']], ['json', ['.json']], ['csv', ['.csv']], ['wordpress', ['.xml']], ['pdf', ['.pdf']]
  ];
  return types.flatMap(([childType, extensions]) => listFiles(input, extensions).flatMap((file) => discoverRecords(file, childType)));
}

function existingSlugs(directory) {
  if (!fs.existsSync(directory)) return new Set();
  return new Set(fs.readdirSync(directory).filter((file) => file.endsWith('.json')).map((file) => path.basename(file, '.json')));
}

function chooseSlug(base, used, mode) {
  if (!used.has(base)) return { slug: base, conflict: false };
  if (mode === 'overwrite') return { slug: base, conflict: true };
  if (mode === 'skip') return { slug: base, conflict: true, skip: true };
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return { slug: `${base}-${index}`, conflict: true };
}

function copyPdf(source, destinationDirectory, baseSlug, dryRun) {
  const bytes = fs.readFileSync(source);
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error(`Rejected ${source}: file does not have a PDF signature`);
  const fingerprint = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);
  const safeName = `${baseSlug}-${fingerprint}.pdf`;
  const destination = path.join(destinationDirectory, safeName);
  if (!dryRun) {
    fs.mkdirSync(destinationDirectory, { recursive: true });
    if (!fs.existsSync(destination)) fs.writeFileSync(destination, bytes);
  }
  return { destination, publicPath: `/uploads/documents/${safeName}`, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

export function importContent(options) {
  if (options.defaults?.status === 'published' && !options.defaults?.markReviewed) {
    throw new Error('Published imports require an explicit markReviewed acknowledgement');
  }
  const input = path.resolve(options.input);
  const outputDirectory = path.resolve(options.outputDirectory || path.join(ROOT, 'content/articles'));
  const mediaDirectory = path.resolve(options.mediaDirectory || path.join(ROOT, 'public/uploads/documents'));
  const conflictMode = options.conflictMode || 'skip';
  if (!CONFLICT_MODES.has(conflictMode)) throw new Error(`Unsupported conflict mode: ${conflictMode}`);
  const discovered = discoverRecords(input, options.type || 'auto');
  const used = existingSlugs(outputDirectory);
  const items = [];
  let imported = 0;
  let planned = 0;
  let skipped = 0;
  let failed = 0;
  let assetsCopied = 0;
  let assetsPlanned = 0;

  for (const entry of discovered) {
    const item = { source: path.relative(ROOT, entry.source).replaceAll('\\', '/'), kind: entry.kind, status: 'pending', warnings: [], errors: [] };
    try {
      let record = { ...entry.record };
      if (Array.isArray(record.import_warnings)) item.warnings.push(...record.import_warnings);
      if (entry.kind === 'wordpress') {
        record = { ...record, tags: [...new Set([...(record.tags || []), ...(record.categories || [])])] };
      }
      if (entry.kind === 'pdf') {
        record = {
          ...record,
          article_type: 'pdf',
          pdf_file: `/uploads/documents/${slugify(record.title)}.pdf`,
          pdf_title: record.title,
          document_description: 'Imported PDF awaiting editorial context and accessibility review.',
          excerpt: 'Imported PDF document awaiting editorial context and publication review.',
          document_source: '',
          document_pages: 0
        };
      }
      const article = normalizeRecord(record, options.defaults || {});
      const selected = chooseSlug(article.slug, used, conflictMode);
      item.slug = selected.slug;
      item.legacy_url = record.legacy_url || '';
      item.route = `/stories/${selected.slug}/`;
      if (selected.skip) {
        item.status = 'skipped';
        item.warnings.push('Slug already exists. Use --conflict suffix or --conflict overwrite to import it.');
        skipped += 1;
        items.push(item);
        continue;
      }
      article.slug = selected.slug;
      if (entry.kind === 'pdf') {
        const copied = copyPdf(record.pdf_source_path, mediaDirectory, selected.slug, Boolean(options.dryRun));
        article.pdf_file = copied.publicPath;
        item.asset = path.relative(ROOT, copied.destination).replaceAll('\\', '/');
        item.asset_bytes = copied.bytes;
        item.asset_sha256 = copied.sha256;
        if (options.dryRun) assetsPlanned += 1;
        else assetsCopied += 1;
      }
      if (selected.conflict && conflictMode === 'suffix') item.warnings.push(`Slug collision resolved as ${selected.slug}.`);
      const destination = path.join(outputDirectory, `${selected.slug}.json`);
      item.article = path.relative(ROOT, destination).replaceAll('\\', '/');
      if (!options.dryRun) {
        fs.mkdirSync(outputDirectory, { recursive: true });
        fs.writeFileSync(destination, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
      }
      used.add(selected.slug);
      item.status = options.dryRun ? 'planned' : (selected.conflict && conflictMode === 'overwrite' ? 'overwritten' : 'imported');
      if (options.dryRun) planned += 1;
      else imported += 1;
    } catch (error) {
      item.status = 'failed';
      item.errors.push(error.message);
      failed += 1;
    }
    items.push(item);
  }

  const report = {
    report_version: 1,
    import_type: options.type || 'auto',
    input: path.relative(ROOT, input).replaceAll('\\', '/'),
    dry_run: Boolean(options.dryRun),
    conflict_mode: conflictMode,
    defaults: options.defaults || {},
    summary: { discovered: discovered.length, planned, imported, skipped, failed, assets_planned: assetsPlanned, assets_copied: assetsCopied },
    url_map: items.filter((item) => item.legacy_url && item.route && item.status !== 'failed').map((item) => ({ from: item.legacy_url, to: item.route, status: item.status })),
    items
  };
  if (options.reportFile) {
    const reportFile = path.resolve(options.reportFile);
    if (!options.dryRun || options.writeDryRunReport) {
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
      fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
  }
  return report;
}
