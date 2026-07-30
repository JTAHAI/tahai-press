import fs from 'node:fs';
import path from 'node:path';
import { ROOT, escapeHtml, renderMarkdown, safeUrl } from './content.mjs';
import { responsiveMediaData } from './media-pipeline.mjs';

export const STORY_BLOCK_TYPES = Object.freeze([
  'text',
  'key_points',
  'pull_quote',
  'fact_box',
  'image',
  'gallery',
  'timeline',
  'callout',
  'document'
]);

export const IMAGE_LAYOUTS = Object.freeze(['standard', 'wide', 'full', 'left', 'right']);
export const IMAGE_ASPECTS = Object.freeze(['original', 'landscape', 'portrait', 'square']);
export const IMAGE_FOCAL_POINTS = Object.freeze(['center', 'top', 'bottom', 'left', 'right']);
export const CALLOUT_TONES = Object.freeze(['neutral', 'note', 'important', 'context']);

function publicFile(src = '') {
  if (!String(src).startsWith('/')) return null;
  const publicRoot = path.resolve(ROOT, 'public');
  const candidate = path.resolve(publicRoot, String(src).slice(1));
  if (!candidate.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(candidate)) return null;
  return candidate;
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function gifDimensions(buffer) {
  if (buffer.length < 10 || !/^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (sof.has(marker) && length >= 7) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buffer.toString('ascii', 12, 16);
  if (kind === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (kind === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  if (kind === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }
  return null;
}

function svgDimensions(text) {
  const open = String(text).match(/<svg\b[^>]*>/i)?.[0] || '';
  const width = Number(open.match(/\bwidth=["']([0-9.]+)/i)?.[1]);
  const height = Number(open.match(/\bheight=["']([0-9.]+)/i)?.[1]);
  if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) };
  const viewBox = open.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)/i);
  if (viewBox) return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) };
  return null;
}

export function imageDimensions(src = '') {
  const file = publicFile(src);
  if (!file) return null;
  try {
    const extension = path.extname(file).toLowerCase();
    if (extension === '.svg') return svgDimensions(fs.readFileSync(file, 'utf8'));
    const buffer = fs.readFileSync(file);
    if (extension === '.png') return pngDimensions(buffer);
    if (extension === '.gif') return gifDimensions(buffer);
    if (extension === '.jpg' || extension === '.jpeg') return jpegDimensions(buffer);
    if (extension === '.webp') return webpDimensions(buffer);
  } catch {}
  return null;
}

function imageCaption(item = {}) {
  const caption = String(item.caption || '').trim();
  const credit = String(item.credit || '').trim();
  const rights = String(item.rights || '').trim();
  if (!caption && !credit && !rights) return '';
  return `<figcaption>${caption ? `<span class="media-caption">${escapeHtml(caption)}</span>` : ''}${credit ? `<span class="media-credit">${escapeHtml(credit)}</span>` : ''}${rights ? `<span class="media-rights">${escapeHtml(rights)}</span>` : ''}</figcaption>`;
}

function imageAttributes(item = {}, { eager = false } = {}) {
  const src = safeUrl(item.src || item.image || '');
  const dimensions = imageDimensions(src);
  const alt = item.decorative ? '' : String(item.alt || '').trim();
  const position = IMAGE_FOCAL_POINTS.includes(item.focal_point) ? item.focal_point : 'center';
  const responsive = responsiveMediaData(src, dimensions, item.layout || 'standard');
  const picture = responsive.webpSrcset && !path.extname(src).toLowerCase().endsWith('webp')
    ? `<picture><source type="image/webp" srcset="${escapeHtml(responsive.webpSrcset)}"${responsive.sizes ? ` sizes="${escapeHtml(responsive.sizes)}"` : ''}>`
      + `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${dimensions?.width ? ` width="${dimensions.width}"` : ''}${dimensions?.height ? ` height="${dimensions.height}"` : ''}${responsive.srcset ? ` srcset="${escapeHtml(responsive.srcset)}"` : ''}${responsive.sizes ? ` sizes="${escapeHtml(responsive.sizes)}"` : ''} loading="${eager ? 'eager' : 'lazy'}" decoding="async"${item.decorative ? ' role="presentation"' : ''} style="--image-position:${escapeHtml(position)}"></picture>`
    : '';
  return {
    src,
    alt,
    position,
    dimensions,
    attrs: [
      `src="${escapeHtml(src)}"`,
      `alt="${escapeHtml(alt)}"`,
      dimensions?.width ? `width="${dimensions.width}"` : '',
      dimensions?.height ? `height="${dimensions.height}"` : '',
      responsive.srcset ? `srcset="${escapeHtml(responsive.srcset)}"` : '',
      responsive.sizes ? `sizes="${escapeHtml(responsive.sizes)}"` : '',
      `loading="${eager ? 'eager' : 'lazy'}"`,
      'decoding="async"',
      item.decorative ? 'role="presentation"' : '',
      `style="--image-position:${escapeHtml(position)}"`
    ].filter(Boolean).join(' '),
    picture
  };
}

export function renderEditorialImage(item = {}, {
  className = 'editorial-media',
  eager = false,
  lightbox = false,
  index = 0
} = {}) {
  const details = imageAttributes(item, { eager });
  if (!details.src) return '';
  const layout = IMAGE_LAYOUTS.includes(item.layout) ? item.layout : 'standard';
  const aspect = IMAGE_ASPECTS.includes(item.aspect) ? item.aspect : 'original';
  const figureClass = `${className} media-layout-${layout} media-aspect-${aspect}`;
  const image = details.picture || `<img ${details.attrs}>`;
  const media = lightbox && !item.decorative
    ? `<button class="media-lightbox-trigger" type="button" data-lightbox-open data-lightbox-src="${escapeHtml(details.src)}" data-lightbox-alt="${escapeHtml(details.alt)}" data-lightbox-caption="${escapeHtml(item.caption || '')}" aria-label="Open image ${index + 1} in a larger viewer">${image}<span class="media-zoom-label" aria-hidden="true">View larger</span></button>`
    : image;
  return `<figure class="${figureClass}">${media}${imageCaption(item)}</figure>`;
}

function renderBlock(block = {}, index = 0) {
  const type = String(block.type || '');
  const headingId = `story-block-${index + 1}`;
  if (type === 'text') {
    return `<section class="story-block story-block-text prose"${block.heading ? ` aria-labelledby="${headingId}"` : ''}>${block.heading ? `<h2 id="${headingId}">${escapeHtml(block.heading)}</h2>` : ''}${renderMarkdown(block.body || '')}</section>`;
  }
  if (type === 'key_points') {
    const items = (block.items || []).filter((item) => String(item || '').trim());
    if (!items.length) return '';
    return `<section class="story-block story-block-key-points" aria-labelledby="${headingId}"><p class="eyebrow">At a glance</p><h2 id="${headingId}">${escapeHtml(block.heading || 'Key points')}</h2><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`;
  }
  if (type === 'pull_quote') {
    return `<figure class="story-block story-block-pull-quote"><blockquote>${escapeHtml(block.quote || '')}</blockquote>${block.attribution ? `<figcaption>${escapeHtml(block.attribution)}</figcaption>` : ''}</figure>`;
  }
  if (type === 'fact_box') {
    return `<aside class="story-block story-block-fact-box" aria-labelledby="${headingId}"><p class="eyebrow">Context</p><h2 id="${headingId}">${escapeHtml(block.heading || 'Fact box')}</h2><div class="prose">${renderMarkdown(block.body || '')}</div></aside>`;
  }
  if (type === 'image') {
    return `<section class="story-block story-block-image"${block.heading ? ` aria-labelledby="${headingId}"` : ''}>${block.heading ? `<h2 class="visually-hidden" id="${headingId}">${escapeHtml(block.heading)}</h2>` : ''}${renderEditorialImage(block, { className: 'story-image', lightbox: block.lightbox !== false, index })}</section>`;
  }
  if (type === 'gallery') {
    const items = (block.items || []).filter((item) => safeUrl(item?.src || item?.image || ''));
    if (!items.length) return '';
    return `<section class="story-block story-block-gallery" aria-labelledby="${headingId}"><div class="story-block-heading"><p class="eyebrow">Photo desk</p><h2 id="${headingId}">${escapeHtml(block.heading || 'Gallery')}</h2>${block.description ? `<p>${escapeHtml(block.description)}</p>` : ''}</div><div class="editorial-gallery" data-gallery>${items.map((item, itemIndex) => renderEditorialImage(item, { className: 'gallery-item', lightbox: true, index: itemIndex })).join('')}</div></section>`;
  }
  if (type === 'timeline') {
    const items = (block.items || []).filter((item) => item && (item.title || item.date || item.body));
    if (!items.length) return '';
    return `<section class="story-block story-block-timeline" aria-labelledby="${headingId}"><p class="eyebrow">Chronology</p><h2 id="${headingId}">${escapeHtml(block.heading || 'Timeline')}</h2><ol>${items.map((item) => `<li><div class="timeline-marker" aria-hidden="true"></div><div>${item.date ? `<p class="timeline-date">${escapeHtml(item.date)}</p>` : ''}<h3>${escapeHtml(item.title || 'Timeline entry')}</h3>${item.body ? `<div class="prose">${renderMarkdown(item.body)}</div>` : ''}</div></li>`).join('')}</ol></section>`;
  }
  if (type === 'callout') {
    const tone = CALLOUT_TONES.includes(block.tone) ? block.tone : 'neutral';
    return `<aside class="story-block story-block-callout callout-${tone}" aria-labelledby="${headingId}"><p class="eyebrow">${escapeHtml(tone === 'important' ? 'Important' : tone === 'context' ? 'Background' : tone === 'note' ? 'Editor note' : 'Note')}</p><h2 id="${headingId}">${escapeHtml(block.heading || 'Note')}</h2><div class="prose">${renderMarkdown(block.body || '')}</div></aside>`;
  }
  if (type === 'document') {
    const href = safeUrl(block.url || block.file || '');
    if (!href) return '';
    const external = /^https?:\/\//i.test(href);
    return `<aside class="story-block story-block-document" aria-labelledby="${headingId}"><div class="story-block-document-mark" aria-hidden="true">PDF</div><div><p class="eyebrow">Supporting record</p><h2 id="${headingId}">${escapeHtml(block.heading || block.label || 'Open source document')}</h2>${block.description ? `<p>${escapeHtml(block.description)}</p>` : ''}<a class="button button-secondary" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(block.label || 'Open document')}${external ? '<span class="visually-hidden"> (opens in a new tab)</span>' : ''}</a></div></aside>`;
  }
  return '';
}

export function renderStoryBlocks(article = {}) {
  const blocks = Array.isArray(article.story_blocks) ? article.story_blocks : [];
  const rendered = blocks.map(renderBlock).filter(Boolean).join('\n');
  if (!rendered) return '';
  return `<div class="story-blocks" aria-label="Story details">${rendered}</div><dialog class="media-lightbox" data-media-lightbox aria-labelledby="media-lightbox-title"><div class="media-lightbox-panel"><div class="media-lightbox-toolbar"><h2 id="media-lightbox-title">Image viewer</h2><button type="button" data-lightbox-close>Close</button></div><img data-lightbox-image src="" alt=""><p data-lightbox-caption></p></div></dialog>`;
}

function flattenValue(value, output) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => flattenValue(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => flattenValue(item, output));
}

export function storyBlocksPlainText(article = {}) {
  const output = [];
  flattenValue(article.story_blocks || [], output);
  return output.join(' ');
}

export function articleMedia(article = {}) {
  const media = [];
  if (article.featured_image) media.push({ src: article.featured_image, alt: article.featured_image_alt, context: 'featured image' });
  for (const [blockIndex, block] of (article.story_blocks || []).entries()) {
    if (block?.type === 'image' && (block.src || block.image)) media.push({ ...block, src: block.src || block.image, context: `story_blocks[${blockIndex}] image` });
    if (block?.type === 'gallery') {
      for (const [itemIndex, item] of (block.items || []).entries()) media.push({ ...item, src: item?.src || item?.image, context: `story_blocks[${blockIndex}].items[${itemIndex}]` });
    }
  }
  return media;
}
