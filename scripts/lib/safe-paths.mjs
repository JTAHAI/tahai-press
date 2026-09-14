import path from 'node:path';

const WINDOWS_RESERVED = new Set(['con', 'prn', 'aux', 'nul', ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`), ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)]);

export function safeSlug(value, label = 'slug') {
  const slug = String(value || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || WINDOWS_RESERVED.has(slug.toLowerCase())) throw new Error(`${label} must use lowercase letters, numbers, and single hyphens.`);
  return slug;
}

export function safeJsonFilename(value, label = 'filename') {
  const name = String(value || '');
  if (!/^[a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?\.json$/i.test(name) || /[\\/:]/.test(name) || WINDOWS_RESERVED.has(name.split('.')[0].toLowerCase())) throw new Error(`${label} must be a simple JSON filename.`);
  return name;
}

export function containedPath(root, ...parts) {
  const base = path.resolve(root);
  const target = path.resolve(base, ...parts);
  if (target === base || !target.startsWith(`${base}${path.sep}`)) throw new Error('Destination escapes its allowed directory.');
  return target;
}
