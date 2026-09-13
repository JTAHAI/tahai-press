import path from 'node:path';
import { sha256, writeDeterministicZip } from './safe-zip.mjs';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set(['draft', 'published', 'archived']);
const TYPES = new Set(['document', 'dataset', 'image', 'transcript', 'correspondence', 'other']);
const SENSITIVITY = new Set(['public', 'redacted']);
const FORBIDDEN_KEYS = /(?:^|_)(?:password|secret|token|api_key|private_note|editor_note|ssn|social_security|bank_account)(?:$|_)/i;

function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function publicUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('/uploads/')) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}
function scanForbidden(value, prefix = '') {
  if (!isObject(value) && !Array.isArray(value)) return [];
  const errors = [];
  for (const [key, item] of Object.entries(value)) {
    const location = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_KEYS.test(key)) errors.push(`${location} is not permitted in a public evidence record`);
    errors.push(...scanForbidden(item, location));
  }
  return errors;
}
function packetManifest(record) {
  return {
    schema_version: 1,
    id: record.id,
    title: record.title,
    record_type: record.record_type,
    linked_article: record.linked_article || '',
    published_at: record.published_at || '',
    sensitivity: record.sensitivity,
    public_release_confirmed: true,
    rights_confirmed: true,
    redactions: record.redactions || [],
    source_materials: record.source_materials.map(({ id, title, url, publisher = '', retrieved_at = '', sha256: digest = '', media_type = '', description = '' }) => ({ id, title, url, publisher, retrieved_at, sha256: digest, media_type, description }))
  };
}

export function validateEvidenceRecord(record, { articleSlugs = new Set() } = {}) {
  const errors = [];
  if (!isObject(record)) return ['record must be an object'];
  for (const key of Object.keys(record)) if (!['__file', 'schema_version', 'id', 'title', 'status', 'record_type', 'linked_article', 'published_at', 'sensitivity', 'public_release_confirmed', 'rights_confirmed', 'redactions', 'source_materials'].includes(key)) errors.push(`unsupported field: ${key}`);
  if (record.schema_version !== 1) errors.push('schema_version must be 1');
  if (!ID.test(record.id || '')) errors.push('id must use lowercase letters, numbers, and single hyphens');
  if (typeof record.title !== 'string' || !record.title.trim() || record.title.length > 180) errors.push('title must contain 1 to 180 characters');
  if (!STATUSES.has(record.status)) errors.push('status must be draft, published, or archived');
  if (!TYPES.has(record.record_type)) errors.push(`record_type must be one of: ${[...TYPES].join(', ')}`);
  if (!SENSITIVITY.has(record.sensitivity)) errors.push('sensitivity must be public or redacted');
  if (record.linked_article && !articleSlugs.has(record.linked_article)) errors.push('linked_article references an unknown article');
  if (record.published_at && Number.isNaN(new Date(record.published_at).getTime())) errors.push('published_at must be a valid ISO date-time');
  if (record.status === 'published' && record.public_release_confirmed !== true) errors.push('published records require public_release_confirmed: true');
  if (record.status === 'published' && record.rights_confirmed !== true) errors.push('published records require rights_confirmed: true');
  if (!Array.isArray(record.redactions)) errors.push('redactions must be an array');
  else if (record.redactions.length > 50) errors.push('redactions cannot contain more than 50 entries');
  else for (const [index, item] of record.redactions.entries()) {
    if (!isObject(item) || typeof item.scope !== 'string' || !item.scope.trim() || typeof item.reason !== 'string' || !item.reason.trim()) errors.push(`redactions[${index}] requires public scope and reason`);
  }
  if (!Array.isArray(record.source_materials) || record.source_materials.length < 1 || record.source_materials.length > 100) errors.push('source_materials must contain 1 to 100 public sources');
  else {
    const ids = new Set();
    for (const [index, source] of record.source_materials.entries()) {
      const base = `source_materials[${index}]`;
      if (!isObject(source)) { errors.push(`${base} must be an object`); continue; }
      if (!ID.test(source.id || '')) errors.push(`${base}.id must be a URL-safe identifier`);
      if (ids.has(source.id)) errors.push(`${base}.id must be unique`);
      ids.add(source.id);
      if (typeof source.title !== 'string' || !source.title.trim() || source.title.length > 240) errors.push(`${base}.title must contain 1 to 240 characters`);
      if (!publicUrl(source.url)) errors.push(`${base}.url must be an HTTP(S) URL or /uploads/ path`);
      if (source.sha256 && !/^[a-f0-9]{64}$/i.test(source.sha256)) errors.push(`${base}.sha256 must be a SHA-256 hex digest`);
      for (const field of ['publisher', 'retrieved_at', 'media_type', 'description']) if (source[field] !== undefined && (typeof source[field] !== 'string' || source[field].length > 1000)) errors.push(`${base}.${field} must be a string of 1000 characters or fewer`);
      if (source.retrieved_at && Number.isNaN(new Date(source.retrieved_at).getTime())) errors.push(`${base}.retrieved_at must be a valid ISO date-time`);
    }
  }
  return [...errors, ...scanForbidden(record)];
}

export function buildEvidencePacket(record, outputFile, options = {}) {
  const errors = validateEvidenceRecord(record, options);
  if (errors.length) throw new Error(`Evidence record is invalid:\n- ${errors.join('\n- ')}`);
  if (record.status !== 'published') throw new Error('Evidence packets can be created only for published records.');
  const manifest = packetManifest(record);
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const readme = `# ${record.title}\n\nThis packet contains a public metadata manifest, not copied source materials. Each source URL remains the authoritative access path.\n\nRecord ID: ${record.id}\nLinked article: ${record.linked_article || 'None'}\nSensitivity: ${record.sensitivity}\n`;
  const checksums = `SHA-256  manifest.json  ${sha256(manifestJson)}\nSHA-256  README.md  ${sha256(readme)}\n`;
  return writeDeterministicZip(outputFile, [
    { path: 'README.md', content: readme },
    { path: 'manifest.json', content: manifestJson },
    { path: 'SHA256SUMS.txt', content: checksums }
  ]);
}

export function recordFileName(record) { return `${path.basename(record.id)}.zip`; }
