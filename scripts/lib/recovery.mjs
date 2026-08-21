import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './content.mjs';
import { readSafeZip, sha256, writeDeterministicZip } from './safe-zip.mjs';

export const RECOVERY_PATHS = ['content', 'themes/published'];

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function relative(value) { return value.replaceAll('\\', '/'); }
function safeFilePath(value) {
  return typeof value === 'string'
    && /^(?:content|themes\/published)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)
    && !value.includes('..')
    && !value.includes('\\');
}
function paths(repositoryRoot, artifactRoot) {
  const root = artifactRoot || path.join(repositoryRoot, '.artifacts', 'recovery');
  return { root, archive: path.join(root, 'publisher-safety-copy.zip'), manifest: path.join(root, 'publisher-safety-copy.json'), transactions: path.join(root, 'transactions') };
}
function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error(`Recovery archives cannot include symbolic links: ${file}`);
    if (stat.isDirectory()) return walk(file);
    if (!stat.isFile()) throw new Error(`Recovery archives can only include ordinary files: ${file}`);
    return [file];
  });
}
function sourceEntries(repositoryRoot) {
  return RECOVERY_PATHS.flatMap((top) => walk(path.join(repositoryRoot, top)).map((file) => ({ path: relative(path.relative(repositoryRoot, file)), content: fs.readFileSync(file) })));
}
function readManifest(pathsValue) {
  if (!fs.existsSync(pathsValue.manifest) || !fs.existsSync(pathsValue.archive)) throw new Error('No safety copy exists. Run recovery create first.');
  const manifest = JSON.parse(fs.readFileSync(pathsValue.manifest, 'utf8'));
  if (manifest.version !== 2 || manifest.archive !== path.basename(pathsValue.archive) || !/^[a-f0-9]{64}$/i.test(manifest.sha256 || '') || !Array.isArray(manifest.files)) throw new Error('Safety-copy manifest is invalid.');
  if (!manifest.files.length || !manifest.files.every((entry) => safeFilePath(entry.path) && Number.isInteger(entry.bytes) && entry.bytes >= 0 && /^[a-f0-9]{64}$/i.test(entry.sha256 || ''))) throw new Error('Safety-copy manifest contains unsafe file metadata.');
  if (new Set(manifest.files.map((entry) => entry.path)).size !== manifest.files.length) throw new Error('Safety-copy manifest contains duplicate paths.');
  return manifest;
}
function verify(pathsValue) {
  const manifest = readManifest(pathsValue);
  if (sha256(fs.readFileSync(pathsValue.archive)) !== manifest.sha256) throw new Error('Safety-copy checksum failed.');
  const unpacked = readSafeZip(pathsValue.archive);
  const expected = new Set(manifest.files.map((entry) => entry.path));
  if (unpacked.size !== expected.size || [...unpacked.keys()].some((name) => !expected.has(name))) throw new Error('Safety-copy archive inventory does not match its manifest.');
  for (const entry of manifest.files) {
    const value = unpacked.get(entry.path);
    if (!value || value.length !== entry.bytes || sha256(value) !== entry.sha256) throw new Error(`Safety-copy archive file failed verification: ${entry.path}`);
  }
  return { manifest, unpacked };
}
function latestTransaction(pathsValue) {
  if (!fs.existsSync(pathsValue.transactions)) throw new Error('No restore transaction exists to undo.');
  const files = fs.readdirSync(pathsValue.transactions).filter((name) => /^restore-[a-f0-9-]+\.json$/i.test(name)).sort();
  if (!files.length) throw new Error('No restore transaction exists to undo.');
  return path.join(pathsValue.transactions, files.at(-1));
}

export function createSafetyCopy({ repositoryRoot = ROOT, artifactRoot } = {}) {
  const value = paths(repositoryRoot, artifactRoot);
  const files = sourceEntries(repositoryRoot);
  if (!files.length) throw new Error('No publisher-owned files were found for the safety copy.');
  fs.mkdirSync(value.root, { recursive: true });
  writeDeterministicZip(value.archive, files);
  const manifest = { version: 2, createdAt: new Date().toISOString(), archive: path.basename(value.archive), sha256: sha256(fs.readFileSync(value.archive)), includes: RECOVERY_PATHS, files: files.map((file) => ({ path: file.path, bytes: file.content.length, sha256: sha256(file.content) })) };
  fs.writeFileSync(value.manifest, json(manifest));
  return { archive: manifest.archive, sha256: manifest.sha256, files: manifest.files.length, includes: manifest.includes };
}

export function verifySafetyCopy(options = {}) {
  const value = paths(options.repositoryRoot || ROOT, options.artifactRoot);
  const { manifest } = verify(value);
  return { archive: manifest.archive, sha256: manifest.sha256, files: manifest.files.length, includes: manifest.includes };
}

export function planSafetyCopyRestore(options = {}) {
  const value = paths(options.repositoryRoot || ROOT, options.artifactRoot);
  const { manifest } = verify(value);
  return { archive: manifest.archive, verifiedFiles: manifest.files.length, affectedPaths: RECOVERY_PATHS.filter((top) => manifest.files.some((entry) => entry.path.startsWith(`${top}/`))), requiresConfirmation: true };
}

export function restoreSafetyCopy({ repositoryRoot = ROOT, artifactRoot, confirm = false } = {}) {
  if (!confirm) throw new Error('Restore requires explicit confirmation. Re-run with --confirm after reviewing the plan.');
  const value = paths(repositoryRoot, artifactRoot);
  const { manifest, unpacked } = verify(value);
  const staging = fs.mkdtempSync(path.join(value.root, 'stage-'));
  const transactionId = crypto.randomUUID();
  const transactionRoot = path.join(value.transactions, transactionId);
  const moved = [];
  try {
    for (const [name, content] of unpacked) {
      const destination = path.join(staging, name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content);
    }
    fs.mkdirSync(transactionRoot, { recursive: true });
    for (const top of RECOVERY_PATHS) {
      const source = path.join(staging, top);
      if (!fs.existsSync(source)) continue;
      const target = path.join(repositoryRoot, top);
      const backup = path.join(transactionRoot, 'before', top);
      const replacement = path.join(repositoryRoot, `.${path.basename(top)}.restore-${transactionId}`);
      if (fs.existsSync(target)) { fs.mkdirSync(path.dirname(backup), { recursive: true }); fs.renameSync(target, backup); }
      fs.renameSync(source, replacement);
      fs.renameSync(replacement, target);
      moved.push({ top, hadPrevious: fs.existsSync(backup) });
    }
    const transaction = { version: 1, id: transactionId, createdAt: new Date().toISOString(), archive: manifest.archive, restoredFiles: manifest.files.length, paths: moved, undoneAt: null };
    fs.writeFileSync(path.join(value.transactions, `restore-${transactionId}.json`), json(transaction));
    return { transactionId, restoredFiles: manifest.files.length, undoAvailable: true };
  } catch (error) {
    for (const entry of [...moved].reverse()) {
      const target = path.join(repositoryRoot, entry.top);
      const backup = path.join(transactionRoot, 'before', entry.top);
      if (fs.existsSync(target)) fs.renameSync(target, path.join(transactionRoot, `failed-${entry.top}`));
      if (fs.existsSync(backup)) fs.renameSync(backup, target);
    }
    throw error;
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
}

export function undoSafetyCopyRestore({ repositoryRoot = ROOT, artifactRoot, transactionId, confirm = false } = {}) {
  if (!confirm) throw new Error('Undo requires explicit confirmation. Re-run with --confirm after reviewing the restore transaction.');
  const value = paths(repositoryRoot, artifactRoot);
  const file = transactionId ? path.join(value.transactions, `restore-${transactionId}.json`) : latestTransaction(value);
  if (!fs.existsSync(file)) throw new Error('Restore transaction was not found.');
  const transaction = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (transaction.version !== 1 || transaction.undoneAt || !Array.isArray(transaction.paths) || !transaction.paths.every((entry) => RECOVERY_PATHS.includes(entry.top) && typeof entry.hadPrevious === 'boolean')) throw new Error('Restore transaction is invalid or has already been undone.');
  const transactionRoot = path.join(value.transactions, transaction.id);
  for (const entry of [...transaction.paths].reverse()) {
    const target = path.join(repositoryRoot, entry.top);
    const preserved = path.join(transactionRoot, 'undone-current', entry.top);
    if (fs.existsSync(target)) { fs.mkdirSync(path.dirname(preserved), { recursive: true }); fs.renameSync(target, preserved); }
    if (entry.hadPrevious) {
      const backup = path.join(transactionRoot, 'before', entry.top);
      if (!fs.existsSync(backup)) throw new Error(`Restore transaction backup is missing: ${entry.top}`);
      fs.renameSync(backup, target);
    }
  }
  transaction.undoneAt = new Date().toISOString();
  fs.writeFileSync(file, json(transaction));
  return { transactionId: transaction.id, restoredPreviousPaths: transaction.paths.length, preservedRevertedContent: true };
}

export function recoveryHistory({ repositoryRoot = ROOT, artifactRoot } = {}) {
  const value = paths(repositoryRoot, artifactRoot);
  if (!fs.existsSync(value.transactions)) return [];
  return fs.readdirSync(value.transactions).filter((name) => /^restore-[a-f0-9-]+\.json$/i.test(name)).sort().map((name) => JSON.parse(fs.readFileSync(path.join(value.transactions, name), 'utf8')));
}
