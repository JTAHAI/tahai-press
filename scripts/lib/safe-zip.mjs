import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const END_SIGNATURE = 0x06054b50;
const MAX_FILES = 256;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function safePath(name) {
  const normalized = String(name).replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe archive path: ${name}`);
  return normalized;
}

function findEndOfCentralDirectory(bytes) {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === END_SIGNATURE) return offset;
  }
  throw new Error('Archive does not contain a standard end-of-central-directory record.');
}

export function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function readSafeZip(file, { maxFiles = MAX_FILES, maxFileBytes = MAX_FILE_BYTES, maxTotalBytes = MAX_TOTAL_BYTES } = {}) {
  const bytes = fs.readFileSync(file);
  const end = findEndOfCentralDirectory(bytes);
  const entries = bytes.readUInt16LE(end + 10);
  const centralSize = bytes.readUInt32LE(end + 12);
  const centralOffset = bytes.readUInt32LE(end + 16);
  if (entries > maxFiles || centralOffset + centralSize > end) throw new Error('Archive has an unsupported central directory.');
  const seen = new Set();
  const output = new Map();
  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (bytes.readUInt32LE(offset) !== CENTRAL_SIGNATURE) throw new Error('Archive central-directory entry is malformed.');
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const localOffset = bytes.readUInt32LE(offset + 42);
    if (flags & 1 || flags & 8 || method > 8 || uncompressedSize > maxFileBytes || total + uncompressedSize > maxTotalBytes || compressedSize === 0 && uncompressedSize > 0) throw new Error('Archive has encrypted, streamed, oversized, or unsupported content.');
    if ((externalAttributes >>> 16 & 0o170000) === 0o120000) throw new Error('Archive symlinks are not allowed.');
    const name = safePath(bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    if (seen.has(name)) throw new Error(`Archive contains duplicate path: ${name}`);
    seen.add(name);
    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw new Error(`Archive local entry is malformed: ${name}`);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const packed = bytes.subarray(start, start + compressedSize);
    if (packed.length !== compressedSize) throw new Error(`Archive content is truncated: ${name}`);
    const content = method === 0 ? packed : inflateRawSync(packed);
    if (content.length !== uncompressedSize) throw new Error(`Archive content length mismatch: ${name}`);
    output.set(name, Buffer.from(content));
    total += content.length;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return output;
}

export function writeDeterministicZip(file, entries) {
  const normalized = [...entries]
    .map((entry) => ({ path: safePath(entry.path), content: Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(normalized.map((entry) => entry.path)).size !== normalized.length) throw new Error('Cannot create an archive with duplicate paths.');
  const local = [];
  const central = [];
  let position = 0;
  for (const entry of normalized) {
    const name = Buffer.from(entry.path);
    const checksum = crc32(entry.content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(LOCAL_SIGNATURE, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(0, 8);
    header.writeUInt32LE(checksum, 14); header.writeUInt32LE(entry.content.length, 18); header.writeUInt32LE(entry.content.length, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, entry.content);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(CENTRAL_SIGNATURE, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8); record.writeUInt16LE(0, 10);
    record.writeUInt32LE(checksum, 16); record.writeUInt32LE(entry.content.length, 20); record.writeUInt32LE(entry.content.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(0x81a40000, 38); record.writeUInt32LE(position, 42);
    central.push(record, name);
    position += header.length + name.length + entry.content.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_SIGNATURE, 0); end.writeUInt16LE(normalized.length, 8); end.writeUInt16LE(normalized.length, 10); end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(position, 16);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([...local, centralBytes, end]));
  return { files: normalized.map((entry) => entry.path), sha256: sha256(fs.readFileSync(file)) };
}
