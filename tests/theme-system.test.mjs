import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';
import { OFFICIAL_THEME_IDS, createThemePackage, loadPublishedTheme, validateThemeEntries, validateThemeZip } from '../scripts/lib/themes.mjs';
import { readSafeZip, writeDeterministicZip } from '../scripts/lib/safe-zip.mjs';

test('eight official themes are real deterministic packages with distinct structural contracts', () => {
  execFileSync(process.execPath, ['scripts/theme.mjs', 'catalog:build'], { cwd: ROOT, stdio: 'pipe' });
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'themes', 'catalog', 'official.json'), 'utf8'));
  assert.equal(catalog.themes.length, 8);
  assert.deepEqual(catalog.themes.map((theme) => theme.id), OFFICIAL_THEME_IDS);
  const structures = new Set();
  for (const theme of catalog.themes) {
    const file = path.join(ROOT, 'themes', theme.package);
    const result = validateThemeZip(file);
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.equal(theme.sha256, result.sha256);
    const entries = readSafeZip(file);
    structures.add(JSON.parse(entries.get('layouts/homepage.json').toString('utf8')).structure);
    assert.ok(entries.has('assets/preview.webp'));
    assert.ok(entries.has('styles/print.css'));
  }
  assert.equal(structures.size, 8);
});

test('theme archive validation rejects active files and traversal instead of accepting them as a theme', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-theme-test-'));
  try {
    const entries = createThemePackage({ id: 'test-theme', name: 'Test theme', description: 'A test package.', palette: { background: '#fff', surface: '#eee', text: '#111', muted: '#333', link: '#0011aa', accent: '#0055aa', focus: '#7a5200', headline: 'Georgia, serif', body: 'Georgia, serif', measure: '65ch', space: '.5rem', radius: '0', rule: '1px', image: 'square' } });
    const safe = path.join(temp, 'safe.zip');
    const first = writeDeterministicZip(safe, entries);
    const second = writeDeterministicZip(path.join(temp, 'second.zip'), entries);
    assert.equal(first.sha256, second.sha256);
    assert.equal(validateThemeZip(safe).valid, true);
    assert.throws(() => writeDeterministicZip(path.join(temp, 'unsafe.zip'), [...entries, { path: '../evil.js', content: 'alert(1)' }]), /Unsafe archive path/);
    const modified = new Map(entries.map((entry) => [entry.path, entry.content]));
    modified.set('danger.js', Buffer.from('alert(1)'));
    assert.equal(validateThemeEntries(modified).valid, false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('Theme Workshop remains a token-protected localhost tool and is absent from public reader assets', () => {
  const workshop = fs.readFileSync(path.join(ROOT, 'scripts', 'theme-manager.mjs'), 'utf8');
  assert.match(workshop, /const host = '127\.0\.0\.1'/);
  assert.match(workshop, /timingSafeEqual/);
  assert.match(workshop, /Cache-Control': 'no-store'/);
  assert.match(workshop, /exportInstalledTheme/);
  const publicScripts = fs.readdirSync(path.join(ROOT, 'public', 'assets')).join('\n');
  assert.doesNotMatch(publicScripts, /theme-manager|theme-workshop/);
});

test('a source-pinned official package can be materialized as static publication CSS', () => {
  const file = path.join(ROOT, 'themes', 'official', 'classic-broadsheet.zip');
  const validation = validateThemeZip(file);
  const applied = loadPublishedTheme({ id: validation.manifest.id, version: validation.manifest.version, file: 'themes/official/classic-broadsheet.zip', sha256: validation.sha256 });
  assert.equal(applied.id, 'classic-broadsheet');
  assert.match(applied.css, /--theme-background:/);
  assert.match(applied.css, /theme-classic-broadsheet/);
  assert.throws(() => loadPublishedTheme({ id: validation.manifest.id, version: validation.manifest.version, file: 'themes/official/classic-broadsheet.zip', sha256: '0'.repeat(64) }), /checksum/);
});
