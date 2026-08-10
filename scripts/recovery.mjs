#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { readSafeZip, writeDeterministicZip, sha256 } from './lib/safe-zip.mjs';

const root = path.join(ROOT, '.artifacts', 'recovery');
const snapshot = path.join(root, 'publisher-safety-copy.zip');
const manifest = path.join(root, 'publisher-safety-copy.json');
const include = ['content', 'themes/published'];
function isSafeArchivePath(value) { return typeof value === 'string' && /^(?:content|themes\/published)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value) && !value.includes('..') && !value.includes('\\'); }
function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink()) throw new Error(`Safety copies cannot include symbolic links: ${candidate}`);
    if (stat.isDirectory()) return walk(candidate);
    if (!stat.isFile()) throw new Error(`Safety copies can only include ordinary files: ${candidate}`);
    return [candidate];
  });
}
function entries() { return include.flatMap((relative) => walk(path.join(ROOT, relative)).map((file) => ({ path: path.relative(ROOT, file).replaceAll('\\', '/'), content: fs.readFileSync(file) }))); }
function create() {
  fs.mkdirSync(root, { recursive: true }); const files = entries(); writeDeterministicZip(snapshot, files);
  const record = { version: 1, created_at: new Date().toISOString(), archive: path.basename(snapshot), sha256: sha256(fs.readFileSync(snapshot)), files: files.map((file) => ({ path: file.path, sha256: sha256(file.content), bytes: file.content.length })) };
  fs.writeFileSync(manifest, `${JSON.stringify(record, null, 2)}\n`); return record;
}
function restore() {
  const record = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (record.version !== 1 || !Array.isArray(record.files) || !record.files.every((entry) => isSafeArchivePath(entry.path) && /^[a-f0-9]{64}$/i.test(entry.sha256 || ''))) throw new Error('Safety-copy manifest is invalid.');
  if (record.archive !== path.basename(snapshot) || !/^[a-f0-9]{64}$/i.test(record.sha256 || '')) throw new Error('Safety-copy manifest references an invalid archive.');
  if (sha256(fs.readFileSync(snapshot)) !== record.sha256) throw new Error('Safety-copy checksum failed.');
  const unpacked = readSafeZip(snapshot);
  const expected = new Set(record.files.map((entry) => entry.path));
  if (expected.size !== record.files.length || [...unpacked.keys()].some((name) => !expected.has(name)) || [...expected].some((name) => !unpacked.has(name))) throw new Error('Safety-copy archive inventory does not match its manifest.');
  const staging = fs.mkdtempSync(path.join(root, 'restore-'));
  for (const [name, content] of unpacked) { const target = path.join(staging, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
  for (const entry of record.files) if (!Number.isInteger(entry.bytes) || entry.bytes < 0 || sha256(fs.readFileSync(path.join(staging, entry.path))) !== entry.sha256) throw new Error(`Staged restore checksum failed: ${entry.path}`);
  for (const top of include) {
    const source = path.join(staging, top); const target = path.join(ROOT, top); if (!fs.existsSync(source)) continue;
    const temporary = `${target}.restore-${crypto.randomUUID()}`; const undo = path.join(root, `undo-${path.basename(top)}-${crypto.randomUUID()}`);
    fs.cpSync(source, temporary, { recursive: true });
    try { if (fs.existsSync(target)) fs.renameSync(target, undo); fs.renameSync(temporary, target); }
    catch (error) { if (fs.existsSync(undo) && !fs.existsSync(target)) fs.renameSync(undo, target); throw error; }
  }
  return { restored: record.files.length, archive: record.archive };
}
try { const command = process.argv[2]; if (command === 'create') console.log(JSON.stringify(create(), null, 2)); else if (command === 'restore') console.log(JSON.stringify(restore(), null, 2)); else throw new Error('Usage: node scripts/recovery.mjs <create|restore>'); } catch (error) { console.error(`Recovery failed: ${error.message}`); process.exitCode = 1; }
