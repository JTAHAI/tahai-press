import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';
import { importContent, rollbackImportTransaction } from './lib/importers.mjs';

const fixture = path.join(ROOT, 'tests', 'fixtures', 'imports', 'articles.json');
const reportFile = path.join(ROOT, '.artifacts', 'migration-proof.json');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-press-migration-proof-'));
const articles = path.join(root, 'articles');
const documents = path.join(root, 'documents');
const transactions = path.join(root, 'transactions');
const quarantine = path.join(root, 'quarantine');
const target = path.join(articles, 'json-import-example.json');
const original = Buffer.from('{\n  "publisher_owned": "preserve these exact bytes"\n}\n', 'utf8');

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function defaults() { return { status: 'draft', author: 'editorial-team', category: 'community-reporting', hub: '' }; }

try {
  fs.mkdirSync(articles, { recursive: true });
  fs.writeFileSync(target, original);
  const dryRun = importContent({ input: fixture, type: 'json', outputDirectory: articles, mediaDirectory: documents, reportFile: path.join(root, 'dry-run.json'), transactionDirectory: transactions, quarantineDirectory: quarantine, dryRun: true, conflictMode: 'overwrite', defaults: defaults() });
  if (dryRun.summary.planned !== 1 || !fs.readFileSync(target).equals(original)) throw new Error('Migration dry run modified a publisher-owned target or did not produce one plan.');
  const applied = importContent({ input: fixture, type: 'json', outputDirectory: articles, mediaDirectory: documents, reportFile: path.join(root, 'import-report.json'), transactionDirectory: transactions, quarantineDirectory: quarantine, conflictMode: 'overwrite', defaults: defaults() });
  if (applied.summary.overwritten !== undefined || applied.transaction.overwritten !== 1 || fs.readFileSync(target).equals(original)) throw new Error('Migration apply did not create a reversible overwrite transaction.');
  const rollback = rollbackImportTransaction(applied.transaction.file);
  const restored = fs.readFileSync(target);
  if (!restored.equals(original)) throw new Error('Migration rollback did not restore the original publisher bytes.');
  const proof = { schemaVersion: 1, generatedAt: new Date().toISOString(), sourceType: 'json', dryRun: { planned: dryRun.summary.planned, wroteFiles: false }, apply: { imported: applied.summary.imported, overwritten: applied.transaction.overwritten, transactionState: applied.transaction.state }, rollback: { ...rollback, restoredSha256: digest(restored), exactRestoration: true } };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`Migration proof passed: dry run, reversible apply, and exact rollback. Report: .artifacts/migration-proof.json`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
