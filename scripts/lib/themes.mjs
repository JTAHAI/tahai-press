import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './content.mjs';
import { readSafeZip, sha256, writeDeterministicZip } from './safe-zip.mjs';

export const THEME_SCHEMA_VERSION = 1;
export const REQUIRED_TOKEN_NAMES = ['background', 'surface', 'text', 'muted-text', 'link', 'accent', 'focus', 'success', 'warning', 'error', 'headline-font', 'body-font', 'utility-font', 'reading-measure', 'space-1', 'space-2', 'card-radius', 'rule-width', 'image-treatment', 'print-background'];
export const LAYOUT_CONTRACTS = ['site-shell', 'masthead', 'primary-navigation', 'utility-navigation', 'homepage-lead', 'homepage-latest', 'article', 'section-front', 'archive-list', 'records-collection', 'search-result', 'forms', 'footer', 'print-edition'];
export const OFFICIAL_THEME_IDS = ['classic-broadsheet', 'community-weekly', 'civic-record', 'modern-daily', 'investigative-journal', 'arts-culture', 'high-contrast', 'warm-reading'];

const THEME_ROOT = path.join(ROOT, 'themes');
const OFFICIAL_ROOT = path.join(THEME_ROOT, 'official');
const INSTALLED_ROOT = path.join(THEME_ROOT, 'installed');
const ACTIVE_FILE = path.join(THEME_ROOT, 'active.json');
const PREVIEW_WEBP = Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQnUpUq/+BiOh/AAA=', 'base64');

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function safeId(value) { return /^[a-z0-9][a-z0-9-]{1,62}$/.test(String(value)); }
function checksumLines(entries) { return [...entries].sort((a, b) => a.path.localeCompare(b.path)).map((entry) => `${sha256(entry.content)}  ${entry.path}`).join('\n') + '\n'; }
function packageEntries(entries) {
  const withoutChecksums = entries.filter((entry) => entry.path !== 'checksums.sha256');
  return [...withoutChecksums, { path: 'checksums.sha256', content: checksumLines(withoutChecksums) }];
}

export function validateThemeEntries(entries, { compatibility = '3.0.0-alpha.1' } = {}) {
  const errors = [];
  const warnings = [];
  const names = [...entries.keys()];
  const manifestBytes = entries.get('theme.json');
  if (!manifestBytes) return { valid: false, errors: ['theme.json is required'], warnings, manifest: null };
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { return { valid: false, errors: ['theme.json must be valid JSON'], warnings, manifest: null }; }
  if (manifest.schema_version !== THEME_SCHEMA_VERSION) errors.push('Unsupported theme schema version.');
  if (!safeId(manifest.id)) errors.push('Theme id must be a lowercase URL-safe identifier.');
  for (const key of ['name', 'version', 'author', 'license', 'description', 'compatibility']) if (!String(manifest[key] || '').trim()) errors.push(`theme.json requires ${key}.`);
  if (!String(manifest.compatibility || '').includes('3.0')) errors.push(`Theme is incompatible with ${compatibility}.`);
  if (!Array.isArray(manifest.capabilities) || !manifest.capabilities.every((value) => LAYOUT_CONTRACTS.includes(value))) errors.push('Theme capabilities must use known layout contracts.');
  if (!Array.isArray(manifest.entry_points) || !manifest.entry_points.includes('styles/tokens.css')) errors.push('Theme entry_points must include styles/tokens.css.');
  const allowed = /^(theme\.json|README\.md|LICENSE\.txt|checksums\.sha256|styles\/(tokens|components|layouts|reader-surfaces|print)\.css|layouts\/[a-z-]+\.json|assets\/(preview|thumbnail)\.webp)$/;
  for (const name of names) {
    if (!allowed.test(name)) errors.push(`Undeclared or unsafe theme file: ${name}`);
    if (/\.(?:js|mjs|cjs|ps1|sh|cmd|bat|exe|html|svg)$/i.test(name)) errors.push(`Executable or active file is not allowed: ${name}`);
  }
  for (const required of ['styles/tokens.css', 'styles/components.css', 'styles/layouts.css', 'styles/reader-surfaces.css', 'styles/print.css', 'layouts/homepage.json', 'layouts/article.json', 'layouts/section.json', 'layouts/archive.json', 'layouts/records.json', 'layouts/search.json', 'layouts/navigation.json', 'layouts/footer.json', 'README.md', 'LICENSE.txt', 'checksums.sha256']) if (!entries.has(required)) errors.push(`Missing required theme file: ${required}`);
  const tokens = entries.get('styles/tokens.css')?.toString('utf8') || '';
  if (/@import|url\s*\(|<style|expression\s*\(/i.test(tokens)) errors.push('Theme CSS may not load remote assets or use active CSS constructs.');
  for (const token of REQUIRED_TOKEN_NAMES) if (!tokens.includes(`--theme-${token}:`)) errors.push(`Missing design token --theme-${token}.`);
  for (const name of names.filter((name) => name.startsWith('layouts/'))) {
    try { JSON.parse(entries.get(name).toString('utf8')); } catch { errors.push(`${name} must be valid JSON.`); }
  }
  const checksum = entries.get('checksums.sha256')?.toString('utf8') || '';
  for (const [name, value] of entries) {
    if (name === 'checksums.sha256') continue;
    if (!checksum.includes(`${sha256(value)}  ${name}`)) errors.push(`Checksum is missing or wrong for ${name}.`);
  }
  if (!names.includes('assets/preview.webp')) warnings.push('Theme has no preview image.');
  return { valid: errors.length === 0, errors, warnings, manifest };
}

export function validateThemeZip(file) {
  try {
    const entries = readSafeZip(file);
    return { ...validateThemeEntries(entries), archive: path.basename(file), sha256: sha256(fs.readFileSync(file)) };
  } catch (error) {
    return { valid: false, errors: [error.message], warnings: [], manifest: null, archive: path.basename(file) };
  }
}

export function createThemePackage({ id, name, description, palette, structure = 'lead-first' }) {
  if (!safeId(id)) throw new Error('A valid theme id is required.');
  const tokenValues = {
    background: palette.background, surface: palette.surface, text: palette.text, 'muted-text': palette.muted, link: palette.link, accent: palette.accent, focus: palette.focus,
    success: '#14532d', warning: '#713f12', error: '#7f1d1d', 'headline-font': palette.headline, 'body-font': palette.body, 'utility-font': 'ui-sans-serif, system-ui, sans-serif', 'reading-measure': palette.measure,
    'space-1': palette.space, 'space-2': `calc(${palette.space} * 2)`, 'card-radius': palette.radius, 'rule-width': palette.rule, 'image-treatment': palette.image, 'print-background': '#ffffff'
  };
  const tokens = `:root {\n${Object.entries(tokenValues).map(([key, value]) => `  --theme-${key}: ${value};`).join('\n')}\n}\n`;
  const manifest = { schema_version: THEME_SCHEMA_VERSION, id, name, version: '1.0.0', author: 'TAHAI Press', license: 'Apache-2.0', description, compatibility: '>=3.0.0-alpha.1 <4.0.0', capabilities: LAYOUT_CONTRACTS, entry_points: ['styles/tokens.css', 'styles/components.css', 'styles/layouts.css', 'styles/reader-surfaces.css', 'styles/print.css'], preview: 'assets/preview.webp', asset_budgets: { package_bytes: 262144, file_bytes: 65536 }, structure };
  const layouts = Object.fromEntries(['homepage', 'article', 'section', 'archive', 'records', 'search', 'navigation', 'footer'].map((route) => [route, { contract: route === 'section' ? 'section-front' : route === 'archive' ? 'archive-list' : route === 'records' ? 'records-collection' : route === 'navigation' ? 'primary-navigation' : route === 'footer' ? 'footer' : route === 'homepage' ? 'homepage-lead' : route, structure }]));
  const entries = [
    { path: 'theme.json', content: json(manifest) }, { path: 'styles/tokens.css', content: tokens },
    { path: 'styles/components.css', content: `.theme-${id} .story-card { border-radius: var(--theme-card-radius); border-top: var(--theme-rule-width) solid var(--theme-accent); }\n` },
    { path: 'styles/layouts.css', content: `.theme-${id} [data-layout="homepage"] { --theme-home-structure: ${structure}; }\n` },
    { path: 'styles/reader-surfaces.css', content: `.theme-${id} .article-body { max-width: var(--theme-reading-measure); }\n` },
    { path: 'styles/print.css', content: `@media print { .theme-${id} { background: var(--theme-print-background); color: #000; } }\n` },
    ...Object.entries(layouts).map(([route, value]) => ({ path: `layouts/${route}.json`, content: json(value) })),
    { path: 'assets/preview.webp', content: PREVIEW_WEBP },
    { path: 'assets/thumbnail.webp', content: PREVIEW_WEBP },
    { path: 'README.md', content: `# ${name}\n\n${description}\n\nThis declarative package styles TAHAI Press layout contracts without replacing publishing logic.\n` },
    { path: 'LICENSE.txt', content: 'Apache License 2.0\n\nCopyright 2026 TAHAI Press contributors\n' }
  ];
  return packageEntries(entries);
}

export function buildThemeZip(file, definition) { return writeDeterministicZip(file, createThemePackage(definition)); }

export function installThemeZip(file) {
  const validation = validateThemeZip(file);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  const destination = path.join(INSTALLED_ROOT, validation.manifest.id, `${validation.manifest.version}.zip`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
  return { ...validation, installed: path.relative(ROOT, destination).replaceAll('\\', '/') };
}

export function listInstalledThemes() {
  if (!fs.existsSync(INSTALLED_ROOT)) return [];
  return fs.readdirSync(INSTALLED_ROOT).flatMap((id) => {
    const folder = path.join(INSTALLED_ROOT, id);
    return fs.statSync(folder).isDirectory() ? fs.readdirSync(folder).filter((name) => name.endsWith('.zip')).map((name) => ({ id, file: path.relative(ROOT, path.join(folder, name)).replaceAll('\\', '/'), validation: validateThemeZip(path.join(folder, name)) })) : [];
  });
}

export function activateTheme(id) {
  const candidate = listInstalledThemes().find((entry) => entry.id === id && entry.validation.valid);
  if (!candidate) throw new Error(`Validated installed theme not found: ${id}`);
  const previous = fs.existsSync(ACTIVE_FILE) ? JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8')) : null;
  fs.mkdirSync(path.dirname(ACTIVE_FILE), { recursive: true });
  fs.writeFileSync(ACTIVE_FILE, json({ id, file: candidate.file, activated_at: 'deterministic-local-state' }));
  return { active: id, previous: previous?.id || null };
}

export function exportInstalledTheme(id, destination) {
  const candidate = listInstalledThemes().find((entry) => entry.id === id && entry.validation.valid);
  if (!candidate) throw new Error(`Validated installed theme not found: ${id}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(ROOT, candidate.file), destination);
  const result = validateThemeZip(destination);
  if (!result.valid) throw new Error(`Export revalidation failed: ${result.errors.join('; ')}`);
  return result;
}

export const themePaths = { THEME_ROOT, OFFICIAL_ROOT, INSTALLED_ROOT, ACTIVE_FILE };
