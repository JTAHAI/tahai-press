import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { DIST, ROOT } from './content.mjs';

export const RESPONSIVE_IMAGE_WIDTHS = Object.freeze([480, 768, 1024, 1440, 1920, 2400]);
export const PROVEN_MEDIA_OUTPUT_FORMATS = Object.freeze(
  ['jpeg', 'png', 'webp', 'avif'].filter((format) => Boolean(sharp.format[format]?.output?.file))
);

export function mediaSizesForLayout(layout = 'standard') {
  switch (layout) {
    case 'full':
      return 'calc(100vw - 2rem)';
    case 'wide':
      return '(min-width: 90rem) 90rem, calc(100vw - 2rem)';
    case 'left':
    case 'right':
      return '(min-width: 90rem) 25rem, (min-width: 48rem) 33vw, calc(100vw - 2rem)';
    default:
      return '(min-width: 48rem) 48rem, calc(100vw - 2rem)';
  }
}

export function isLocalMediaSource(src = '') {
  return String(src).startsWith('/uploads/');
}

export function mediaFileFromSource(src = '', root = ROOT) {
  if (!isLocalMediaSource(src)) return null;
  const file = path.join(root, 'public', String(src).slice(1));
  return fs.existsSync(file) ? file : null;
}

export function mediaVariantUrl(src = '', width = 0, extension = '') {
  const raw = String(src).split(/[?#]/)[0];
  const ext = path.extname(raw);
  if (!raw || !ext || !width) return raw;
  const base = raw.slice(0, -ext.length);
  return `${base}-${width}w.${extension || ext.slice(1)}`;
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function imageFormatForExtension(extension = '') {
  const ext = String(extension).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  if (ext === '.png') return 'png';
  if (ext === '.webp') return 'webp';
  if (ext === '.avif') return 'avif';
  return '';
}

function outputOptions(format, width) {
  switch (format) {
    case 'jpeg':
      return { quality: 84, mozjpeg: true, progressive: true };
    case 'png':
      return { compressionLevel: 9, adaptiveFiltering: true };
    case 'webp':
      return { quality: 84, effort: 6 };
    case 'avif':
      return { quality: 60, effort: 4 };
    default:
      return { width };
  }
}

async function sourceMetadata(sourcePath) {
  const metadata = await sharp(sourcePath, { failOn: 'error' }).metadata();
  const rotation = [5, 6, 7, 8].includes(metadata.orientation || 0);
  return {
    width: rotation ? metadata.height || 0 : metadata.width || 0,
    height: rotation ? metadata.width || 0 : metadata.height || 0,
    pages: metadata.pages || 0,
    format: metadata.format || ''
  };
}

async function writeResponsiveVariant(sourcePath, variantPath, width, format) {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!format || !PROVEN_MEDIA_OUTPUT_FORMATS.includes(format) || extension === '.gif') {
    return null;
  }

  const original = fs.readFileSync(sourcePath);
  const pipeline = sharp(sourcePath, { failOn: 'error' }).rotate().resize({
    width,
    withoutEnlargement: true,
    fit: 'inside'
  });
  const { data, info } = await pipeline.toFormat(format, outputOptions(format, width)).toBuffer({ resolveWithObject: true });
  if (info.width !== width) {
    throw new Error(`Responsive variant width mismatch for ${path.basename(variantPath)}: expected ${width}, received ${info.width}.`);
  }
  if (Buffer.compare(original, data) === 0) {
    throw new Error(`Responsive variant for ${path.basename(variantPath)} is byte-identical to the source image.`);
  }
  fs.writeFileSync(variantPath, data);
  const written = fs.readFileSync(variantPath);
  if (hashBuffer(written) !== hashBuffer(data)) {
    throw new Error(`Responsive variant write verification failed for ${path.basename(variantPath)}.`);
  }
  const writtenMetadata = await sharp(written, { failOn: 'error' }).metadata();
  const normalizedWidth = [5, 6, 7, 8].includes(writtenMetadata.orientation || 0) ? writtenMetadata.height || 0 : writtenMetadata.width || 0;
  if (normalizedWidth !== width) {
    throw new Error(`Responsive variant on disk has width ${normalizedWidth}, expected ${width}.`);
  }
  return {
    width,
    height: info.height,
    extension: extension.slice(1),
    bytes: written.length,
    sha256: hashBuffer(written)
  };
}

export function responsiveMediaData(src = '', dimensions = null, layout = 'standard') {
  const original = String(src).split(/[?#]/)[0];
  if (!isLocalMediaSource(original) || !dimensions?.width || path.extname(original).toLowerCase() === '.svg') {
    return { srcset: '', webpSrcset: '', sizes: mediaSizesForLayout(layout) };
  }
  const widths = RESPONSIVE_IMAGE_WIDTHS.filter((candidate) => candidate < dimensions.width);
  const entries = widths.map((width) => `${mediaVariantUrl(original, width)} ${width}w`);
  const webpEntries = path.extname(original).toLowerCase() === '.webp'
    ? []
    : widths.map((width) => `${mediaVariantUrl(original, width, 'webp')} ${width}w`);
  if (!entries.length) return { srcset: '', webpSrcset: '', sizes: mediaSizesForLayout(layout) };
  entries.push(`${original} ${dimensions.width}w`);
  if (path.extname(original).toLowerCase() !== '.webp') webpEntries.push(`${mediaVariantUrl(original, dimensions.width, 'webp')} ${dimensions.width}w`);
  return { srcset: entries.join(', '), webpSrcset: webpEntries.join(', '), sizes: mediaSizesForLayout(layout) };
}

export async function ensureResponsiveMediaVariants({ distRoot = DIST, inventory = [] } = {}) {
  const generated = [];
  for (const item of inventory) {
    if (item.type !== 'image' || !item.dimensions?.width || !isLocalMediaSource(item.url)) continue;
    const sourcePath = path.join(distRoot, item.url.slice(1));
    if (!fs.existsSync(sourcePath)) continue;
    const extension = path.extname(sourcePath).toLowerCase();
    if (extension === '.svg') continue;
    const metadata = await sourceMetadata(sourcePath);
    if (metadata.pages > 1) continue;
    const base = sourcePath.slice(0, -extension.length);
    const sourceFormat = imageFormatForExtension(extension);
    const outputFormats = new Set([sourceFormat]);
    if (sourceFormat !== 'webp' && PROVEN_MEDIA_OUTPUT_FORMATS.includes('webp')) outputFormats.add('webp');
    for (const width of RESPONSIVE_IMAGE_WIDTHS) {
      if (width >= metadata.width) continue;
      for (const outputFormat of outputFormats) {
        const outputExtension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
        const variantPath = `${base}-${width}w.${outputExtension}`;
        const variant = await writeResponsiveVariant(sourcePath, variantPath, width, outputFormat);
        if (variant) {
          generated.push({
            source: item.url,
            url: `/${path.relative(distRoot, variantPath).replaceAll('\\', '/')}`,
            width: variant.width,
            height: variant.height,
            format: outputFormat,
            extension: outputExtension,
            bytes: variant.bytes,
            sha256: variant.sha256
          });
        }
      }
    }
    if (sourceFormat !== 'webp' && PROVEN_MEDIA_OUTPUT_FORMATS.includes('webp') && metadata.width > 0) {
      const variantPath = `${base}-${metadata.width}w.webp`;
      const variant = await writeResponsiveVariant(sourcePath, variantPath, metadata.width, 'webp');
      if (variant) {
        generated.push({
          source: item.url,
          url: `/${path.relative(distRoot, variantPath).replaceAll('\\', '/')}`,
          width: variant.width,
          height: variant.height,
          format: 'webp',
          extension: 'webp',
          bytes: variant.bytes,
          sha256: variant.sha256
        });
      }
    }
  }
  return generated;
}

export function mediaAssetManifest({ generatedAt = new Date().toISOString(), inventory = [], variants = [] } = {}) {
  const sourceImages = inventory.filter((item) => item.type === 'image').length;
  const supportedFormats = PROVEN_MEDIA_OUTPUT_FORMATS.map((format) => `image/${format}`);
  return {
    schema_version: 1,
    generated_at: generatedAt,
    summary: {
      files: inventory.length,
      source_images: sourceImages,
      variants: variants.length
    },
    supported_formats: supportedFormats,
    inventory,
    variants
  };
}
