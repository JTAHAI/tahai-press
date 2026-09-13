import crypto from 'node:crypto';
import * as Y from 'yjs';

const iso = () => new Date().toISOString();
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function createReviewRecord({ article_id, author, kind, body, base_revision = '' }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article_id || '')) throw new Error('article_id must be a safe slug');
  if (!['comment', 'suggestion', 'decision', 'snapshot'].includes(kind)) throw new Error('unsupported review kind');
  if (!String(author || '').trim() || !String(body || '').trim()) throw new Error('author and body are required');
  const record = { version: 1, id: crypto.randomUUID(), article_id, author: String(author).trim(), kind, body: String(body).trim(), base_revision, created_at: iso(), decision: kind === 'decision' ? 'pending' : '' };
  return { ...record, checksum: hash(record) };
}

export function verifyReviewRecord(record) {
  const { checksum, ...payload } = record || {};
  return Boolean(checksum && checksum === hash(payload));
}

export function createHandoff({ article_id, records = [], snapshots = [] }) {
  if (!records.every(verifyReviewRecord)) throw new Error('review handoff contains a record with an invalid checksum');
  const handoff = { version: 1, article_id, exported_at: iso(), records, snapshots };
  return { ...handoff, checksum: hash(handoff) };
}

export function importHandoff(handoff) {
  const { checksum, ...payload } = handoff || {};
  if (!checksum || checksum !== hash(payload)) throw new Error('review handoff checksum failed');
  if (!Array.isArray(handoff.records) || !handoff.records.every(verifyReviewRecord)) throw new Error('review handoff has invalid records');
  return handoff;
}

export function createYjsDraft(initial = '') {
  const doc = new Y.Doc();
  doc.getText('draft').insert(0, String(initial));
  return doc;
}

export function exportYjsDraft(doc) {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
}

export function importYjsDraft(encoded) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(String(encoded), 'base64'));
  return doc;
}
