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
function walk(directory) { return fs.existsSync(directory) ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]) : []; }
function entries() { return include.flatMap((relative) => walk(path.join(ROOT, relative)).map((file) => ({ path: path.relative(ROOT, file).replaceAll('\\', '/'), content: fs.readFileSync(file) }))); }
function create() {
  fs.mkdirSync(root, { recursive: true }); const files = entries(); writeDeterministicZip(snapshot, files);
  const record = { version: 1, created_at: new Date().toISOString(), archive: snapshot, sha256: sha256(fs.readFileSync(snapshot)), files: files.map((file) => ({ path: file.path, sha256: sha256(file.content), bytes: file.content.length })) };
  fs.writeFileSync(manifest, `${JSON.stringify(record, null, 2)}\n`); return record;
}
function restore() {
  const record = JSON.parse(fs.readFileSync(manifest, 'utf8')); if (sha256(fs.readFileSync(record.archive)) !== record.sha256) throw new Error('Safety-copy checksum failed.');
  const unpacked = readSafeZip(record.archive); const staging = fs.mkdtempSync(path.join(root, 'restore-'));
  for (const [name, content] of unpacked) { const target = path.join(staging, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
  for (const entry of record.files) if (sha256(fs.readFileSync(path.join(staging, entry.path))) !== entry.sha256) throw new Error(`Staged restore checksum failed: ${entry.path}`);
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
