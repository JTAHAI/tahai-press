import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadContent } from './lib/content.mjs';
import { buildEvidencePacket, recordFileName, validateEvidenceRecord } from './lib/evidence.mjs';

const [command = 'help', id, destination] = process.argv.slice(2);
const { records, articles } = loadContent();
const articleSlugs = new Set(articles.map((article) => article.slug));
function recordFor(recordId) { return records.find((record) => record.id === recordId); }
function usage() { console.log('Usage: node scripts/evidence-packet.mjs <validate|build> [record-id] [output.zip]'); }

try {
  if (command === 'validate') {
    const selected = id ? [recordFor(id)].filter(Boolean) : records;
    if (!selected.length) throw new Error(id ? `Unknown evidence record: ${id}` : 'No evidence records found.');
    const invalid = selected.flatMap((record) => validateEvidenceRecord(record, { articleSlugs }).map((message) => `${record.id}: ${message}`));
    if (invalid.length) throw new Error(invalid.join('\n'));
    console.log(`Evidence records valid: ${selected.length}.`);
  } else if (command === 'build') {
    const record = recordFor(id);
    if (!record) throw new Error(`Unknown evidence record: ${id || '(missing id)'}`);
    const output = path.resolve(ROOT, destination || path.join('.artifacts', 'evidence-packets', recordFileName(record)));
    const result = buildEvidencePacket(record, output, { articleSlugs });
    console.log(`Evidence packet created: ${path.relative(ROOT, output)} (${result.sha256})`);
  } else usage();
} catch (error) {
  console.error(`Evidence packet failed: ${error.message}`);
  process.exitCode = 1;
}
