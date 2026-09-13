import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildEvidencePacket, validateEvidenceRecord } from '../scripts/lib/evidence.mjs';
import { readSafeZip } from '../scripts/lib/safe-zip.mjs';

function record() {
  return { schema_version: 1, id: 'packet-proof', title: 'Packet proof', status: 'published', record_type: 'document', linked_article: 'story-proof', published_at: '2026-08-07T12:00:00Z', sensitivity: 'public', public_release_confirmed: true, rights_confirmed: true, redactions: [], source_materials: [{ id: 'source-proof', title: 'Source proof', url: 'https://example.com/record.pdf', publisher: 'Example office', retrieved_at: '2026-08-07T12:00:00Z', media_type: 'application/pdf', description: 'Public demonstration source.' }] };
}

test('public evidence records validate only explicit public metadata', () => {
  assert.deepEqual(validateEvidenceRecord(record(), { articleSlugs: new Set(['story-proof']) }), []);
  const unsafe = record();
  unsafe.private_note = 'do not publish';
  assert.match(validateEvidenceRecord(unsafe, { articleSlugs: new Set(['story-proof']) }).join('\n'), /private_note/);
});

test('evidence packets are deterministic metadata-only archives', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-press-evidence-'));
  try {
    const first = path.join(directory, 'first.zip');
    const second = path.join(directory, 'second.zip');
    buildEvidencePacket(record(), first, { articleSlugs: new Set(['story-proof']) });
    buildEvidencePacket(record(), second, { articleSlugs: new Set(['story-proof']) });
    assert.deepEqual(fs.readFileSync(first), fs.readFileSync(second));
    const entries = readSafeZip(first);
    assert.deepEqual([...entries.keys()].sort(), ['README.md', 'SHA256SUMS.txt', 'manifest.json'].sort());
    assert.match(entries.get('manifest.json').toString('utf8'), /source-proof/);
    assert.doesNotMatch(entries.get('manifest.json').toString('utf8'), /private_note/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
