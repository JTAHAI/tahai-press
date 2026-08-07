import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { OFFICIAL_THEME_IDS, activateTheme, applyThemeToSource, buildThemeZip, exportInstalledTheme, installThemeZip, listInstalledThemes, themePaths, validateThemeZip } from './lib/themes.mjs';

const definitions = {
  'classic-broadsheet': ['Classic Broadsheet', 'Traditional newspaper hierarchy with warm paper, formal rules, and a lead-first front page.', ['#fffdf7', '#f3efe5', '#14202a', '#52616a', '#123a5a', '#345f7f', '#9b5d11', 'Georgia, serif', 'Georgia, serif', '68ch', '.55rem', '0', '1px', 'square'], 'lead-first'],
  'community-weekly': ['Community Weekly', 'Approachable neighborhood reporting with generous cards, evergreen ink, and community callouts.', ['#fffdf8', '#f5f1e7', '#1b2b24', '#5d6c63', '#24513f', '#7a4a22', '#9b5d11', 'Georgia, serif', 'system-ui, sans-serif', '66ch', '.7rem', '.7rem', '2px', 'rounded'], 'community-grid'],
  'civic-record': ['Civic Record', 'Source-forward public-record presentation with compact docket cards and structured document hierarchy.', ['#ffffff', '#f2f0ea', '#101e2b', '#50606b', '#183b5b', '#8c2f39', '#8a5a00', 'ui-serif, Georgia, serif', 'ui-sans-serif, system-ui, sans-serif', '72ch', '.5rem', '0', '1px', 'document'], 'records-led'],
  'modern-daily': ['Modern Daily', 'Compact contemporary reporting with a clean utility masthead and fast-scanning story grid.', ['#ffffff', '#f2f4f5', '#17212b', '#56616b', '#1769aa', '#1769aa', '#8a5a00', 'ui-sans-serif, system-ui, sans-serif', 'ui-sans-serif, system-ui, sans-serif', '64ch', '.45rem', '.35rem', '3px', 'edge-to-edge'], 'compact-grid'],
  'investigative-journal': ['Investigative Journal', 'Long-form accountability reporting with restrained burgundy, spacious reading, and document emphasis.', ['#fffdfa', '#f3efe8', '#252021', '#655c5e', '#4d1422', '#7a2638', '#9b5d11', 'Georgia, serif', 'Georgia, serif', '74ch', '.8rem', '0', '1px', 'document'], 'longform-led'],
  'arts-culture': ['Arts and Culture', 'Expressive arts reporting with editorial plum, gallery-forward cards, and a relaxed reading rhythm.', ['#fffdf9', '#f5f0e8', '#2f2035', '#66586a', '#4c3159', '#8a5a1f', '#8a5a00', 'Georgia, serif', 'ui-sans-serif, system-ui, sans-serif', '67ch', '.75rem', '1rem', '2px', 'gallery'], 'gallery-led'],
  'high-contrast': ['High Contrast', 'Maximum visual separation, clear focus, and low-ambiguity component boundaries.', ['#ffffff', '#f5f5f5', '#000000', '#222222', '#00366d', '#004f9e', '#7a5200', 'Arial, sans-serif', 'Arial, sans-serif', '70ch', '.65rem', '0', '3px', 'high-contrast'], 'clarity-led'],
  'warm-reading': ['Warm Reading Edition', 'Low-glare warm surfaces for long reading, understated cards, and print-like rhythm.', ['#fff9ef', '#f1eadf', '#30251e', '#675a50', '#4a392d', '#7b4b2a', '#765000', 'Georgia, serif', 'Georgia, serif', '76ch', '.8rem', '.45rem', '1px', 'soft'], 'reading-led']
};

function palette(values) { const [background, surface, text, muted, link, accent, focus, headline, body, measure, space, radius, rule, image] = values; return { background, surface, text, muted, link, accent, focus, headline, body, measure, space, radius, rule, image }; }
function officialZip(id) { return path.join(themePaths.OFFICIAL_ROOT, `${id}.zip`); }
function ensureOfficial() { for (const id of OFFICIAL_THEME_IDS) { const [name, description, values, structure] = definitions[id]; buildThemeZip(officialZip(id), { id, name, description, palette: palette(values), structure }); } }
function catalog() {
  ensureOfficial();
  const themes = OFFICIAL_THEME_IDS.map((id) => { const file = officialZip(id); const result = validateThemeZip(file); if (!result.valid) throw new Error(`Official theme ${id} failed validation: ${result.errors.join('; ')}`); return { id, name: result.manifest.name, version: result.manifest.version, compatibility: result.manifest.compatibility, license: result.manifest.license, capabilities: result.manifest.capabilities, package: `official/${id}.zip`, bytes: fs.statSync(file).size, sha256: result.sha256, trust: 'official', release_notes: 'Initial Independent Press Edition theme package.' }; });
  const output = { schema_version: 1, generated_by: 'scripts/theme.mjs', themes };
  const destination = path.join(ROOT, 'themes', 'catalog', 'official.json'); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`); return output;
}
function usage() { console.log('Usage: node scripts/theme.mjs <build-official|validate|install|list|activate|apply|export|rollback|integrity-audit|catalog:build> [arguments]'); }
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'build-official') { ensureOfficial(); console.log(`Built ${OFFICIAL_THEME_IDS.length} deterministic official theme packages.`); }
  else if (command === 'catalog:build') { const output = catalog(); console.log(`Built catalog for ${output.themes.length} official themes.`); }
  else if (command === 'validate') { const result = validateThemeZip(path.resolve(ROOT, args[0] || '')); if (!result.valid) throw new Error(result.errors.join('\n')); console.log(`Valid theme: ${result.manifest.id} (${result.sha256})`); }
  else if (command === 'install') { const result = installThemeZip(path.resolve(ROOT, args[0] || '')); console.log(`Installed ${result.manifest.id} at ${result.installed}`); }
  else if (command === 'list') { console.log(JSON.stringify(listInstalledThemes().map(({ id, file, validation }) => ({ id, file, valid: validation.valid })), null, 2)); }
  else if (command === 'activate') { console.log(JSON.stringify(activateTheme(args[0]), null, 2)); }
  else if (command === 'apply') { console.log(JSON.stringify(applyThemeToSource(args[0]), null, 2)); }
  else if (command === 'export') { const result = exportInstalledTheme(args[0], path.resolve(ROOT, args[1] || `themes/exports/${args[0]}.zip`)); console.log(`Exported and revalidated ${result.manifest.id} (${result.sha256})`); }
  else if (command === 'rollback') { const active = fs.existsSync(themePaths.ACTIVE_FILE) ? JSON.parse(fs.readFileSync(themePaths.ACTIVE_FILE, 'utf8')) : null; if (!active) throw new Error('No active theme state exists to roll back.'); fs.unlinkSync(themePaths.ACTIVE_FILE); console.log(`Rolled back ${active.id}; publication source was unchanged.`); }
  else if (command === 'integrity-audit') { const results = listInstalledThemes().map(({ id, file }) => ({ id, file, ...validateThemeZip(path.join(ROOT, file)) })); if (results.some((result) => !result.valid)) throw new Error('One or more installed themes failed integrity validation.'); console.log(JSON.stringify(results.map(({ id, file, sha256 }) => ({ id, file, sha256 })), null, 2)); }
  else { usage(); process.exitCode = command ? 1 : 0; }
} catch (error) { console.error(`Theme command failed: ${error.message}`); process.exitCode = 1; }
