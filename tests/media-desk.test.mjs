import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { ROOT, DIST, readJson } from '../scripts/lib/content.mjs';

const run = (script, args = []) => execFileSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });
let buildRan = false;
const build = () => {
  if (!buildRan) {
    run('scripts/build.mjs');
    buildRan = true;
  }
};
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const built = (relative) => fs.readFileSync(path.join(DIST, relative), 'utf8');

test('v2.3 package exposes the browser-only Media Desk release', () => {
  const pkg = readJson(path.join(ROOT, 'package.json'));
  assert.equal(pkg.version, '2.3.0');
  assert.equal(fs.existsSync(path.join(ROOT, 'docs', 'MEDIA-DESK.md')), true);
  assert.equal(fs.existsSync(path.join(ROOT, 'public', 'assets', 'media-desk.js')), true);
});

test('Media Desk builds as a noindex local image workspace with constrained publishing presets', () => {
  build();
  const html = built('media-desk/index.html');
  assert.match(html, /data-media-desk/);
  assert.match(html, /data-media-workspace/);
  assert.match(html, /data-media-preview[^>]*role="img"[^>]*tabindex="0"/);
  assert.match(html, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(html, /Feature image · 1600 × 900/);
  assert.match(html, /Social card · 1200 × 630/);
  assert.match(html, /Portrait card · 1080 × 1350/);
  assert.match(html, /image\/png/);
  assert.match(html, /image\/avif/);
  assert.match(html, /media-library/);
  assert.match(html, /data-media-alt[^>]*required/);
  assert.match(html, /data-media-status[^>]*role="status"/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  const sitemap = built('sitemap.xml');
  assert.doesNotMatch(sitemap, /media-desk/);
});

test('Media Desk performs crop, focal-point, compression, and export work entirely in the browser', () => {
  const script = read('public/assets/media-desk.js');
  assert.match(script, /createImageBitmap/);
  assert.match(script, /drawImage\(source\.image/);
  assert.match(script, /toBlob/);
  assert.match(script, /image\/webp/);
  assert.match(script, /image\/jpeg/);
  assert.match(script, /image\/png/);
  assert.match(script, /image\/avif/);
  assert.match(script, /source_crop/);
  assert.match(script, /featured_image_alt/);
  assert.match(script, /featured_image_focal_point/);
  assert.match(script, /data-media-zoom/);
  assert.match(script, /data-media-rotation/);
  assert.match(script, /data-media-decorative/);
  assert.match(script, /data-undo-media/);
  assert.match(script, /localStorage\.setItem\(SETTINGS_KEY/);
  assert.doesNotMatch(script, /localStorage[^\n]*(?:alt|caption|credit|rights)/i);
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
});

test('Media Desk rejects unexpectedly large or unsupported source images before export', () => {
  const script = read('public/assets/media-desk.js');
  assert.match(script, /MAX_FILE_BYTES = 30 \* 1024 \* 1024/);
  assert.match(script, /MAX_SOURCE_PIXELS = 80_000_000/);
  assert.match(script, /MAX_SOURCE_EDGE = 16_384/);
  assert.match(script, /\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  assert.match(script, /file\.size > MAX_FILE_BYTES/);
  assert.match(script, /width \* height > MAX_SOURCE_PIXELS/);
});

test('Media Desk is connected to the contributor and publication workflows without becoming indexable content', () => {
  build();
  const studio = built('studio/index.html');
  const home = built('index.html');
  const site = readJson(path.join(ROOT, 'content', 'site.json'));
  assert.match(studio, /Prepare and compress an image in Media Desk/);
  assert.match(home, /Open Media Desk/);
  assert.ok(site.navigation.items.some((item) => item.href === '/media-desk/' && item.label === 'Media Desk'));
  assert.match(built('media-desk/index.html'), /Nothing is uploaded/);
  assert.match(read('README.md'), /## Media Desk/);
  assert.match(read('github-pages/index.html'), /Media Desk · Version 2\.2/);
});

test('Media Desk build writes real responsive variants with verified dimensions and non-identical bytes', async () => {
  build();
  const sourcePath = path.join(DIST, 'uploads', 'images', 'media-pipeline-demo.png');
  const variantPaths = [480, 768, 1024, 1440].map((width) => path.join(DIST, 'uploads', 'images', `media-pipeline-demo-${width}w.png`));
  const webpVariantPaths = [480, 768, 1024, 1440].map((width) => path.join(DIST, 'uploads', 'images', `media-pipeline-demo-${width}w.webp`));
  const sourceBytes = fs.readFileSync(sourcePath);
  const sourceHash = crypto.createHash('sha256').update(sourceBytes).digest('hex');
  const sourceMeta = await sharp(sourcePath).metadata();
  assert.equal(sourceMeta.width, 1600);
  for (const [index, width] of [480, 768, 1024, 1440].entries()) {
    const file = variantPaths[index];
    const webpFile = webpVariantPaths[index];
    assert.equal(fs.existsSync(file), true, path.basename(file));
    assert.equal(fs.existsSync(webpFile), true, path.basename(webpFile));
    const meta = await sharp(file).metadata();
    const webpMeta = await sharp(webpFile).metadata();
    assert.equal(meta.width, width);
    assert.equal(webpMeta.width, width);
    assert.ok(meta.height < sourceMeta.height || meta.width < sourceMeta.width);
    assert.ok(fs.statSync(webpFile).size < sourceBytes.length, `${path.basename(webpFile)} should be smaller than the source`);
    assert.notEqual(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), sourceHash);
  }
  const html = built('stories/sample-written-story/index.html');
  assert.match(html, /<picture>[\s\S]*image\/webp[\s\S]*<\/picture>/);
  assert.match(html, /srcset="[^"]*480w[^"]*768w[^"]*1024w[^"]*1440w/);
  assert.match(html, /sizes="[^"]+"/);
});

test('Media Desk build metadata omits runtime Node version and records the supported major version', () => {
  build();
  const metadata = JSON.parse(built('.well-known/publication-build.json'));
  assert.equal(metadata.supported_node_major, 22);
  assert.equal('node' in metadata, false);
});

test('Media Desk styles preserve responsive controls, visible focus, and print-safe output', () => {
  const css = read('public/assets/styles.css');
  assert.match(css, /\.media-preview-frame canvas:focus-visible/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*?\.media-desk-layout/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.media-actions/);
  assert.match(css, /@media print[\s\S]*?\.media-desk-page/);
});
