import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandoff, createReviewRecord, createYjsDraft, exportYjsDraft, importHandoff, importYjsDraft, verifyReviewRecord } from '../index.mjs';

test('portable review records and handoffs are checksum verified', () => {
  const record = createReviewRecord({ article_id: 'sample-written-story', author: 'editor', kind: 'suggestion', body: 'Clarify the source date.' });
  assert.equal(verifyReviewRecord(record), true);
  const handoff = createHandoff({ article_id: record.article_id, records: [record], snapshots: [] });
  assert.equal(importHandoff(handoff).records.length, 1);
  assert.throws(() => importHandoff({ ...handoff, records: [{ ...record, body: 'tampered' }] }), /checksum/);
});

test('real Yjs updates round-trip without becoming a reader dependency', () => {
  const first = createYjsDraft('Public source ');
  first.getText('draft').insert(first.getText('draft').length, 'reviewed.');
  const restored = importYjsDraft(exportYjsDraft(first));
  assert.equal(restored.getText('draft').toString(), 'Public source reviewed.');
});
