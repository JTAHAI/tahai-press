import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './content.mjs';

const PLACEHOLDER_HOSTS = new Set(['example.com', 'example.org', 'example.net', 'example.pages.dev', 'legacy.example.org']);

function isPlaceholderEmail(value = '') {
  const domain = String(value).split('@')[1]?.toLowerCase();
  return !domain || PLACEHOLDER_HOSTS.has(domain) || domain.endsWith('.example');
}

function isPlaceholderUrl(value = '') {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return PLACEHOLDER_HOSTS.has(host) || host.endsWith('.example');
  } catch {
    return true;
  }
}

function localAssetExists(value = '') {
  if (!String(value).startsWith('/')) return true;
  const candidate = path.resolve(ROOT, 'public', String(value).slice(1));
  const publicRoot = path.resolve(ROOT, 'public');
  return candidate.startsWith(`${publicRoot}${path.sep}`) && fs.existsSync(candidate);
}

export function launchReadiness({ site = {}, articles = [], authors = [], hubs = [] } = {}) {
  const errors = [];
  const warnings = [];
  if (site.template_mode !== false) errors.push('template_mode must be false before a public launch');
  if (isPlaceholderUrl(site.site_url)) errors.push('site_url still uses a placeholder host');
  if (isPlaceholderEmail(site.editor_email)) errors.push('editor_email still uses a placeholder domain');
  if (!site.default_social_image) warnings.push('default_social_image is empty; social cards may appear without an image');
  else if (!localAssetExists(site.default_social_image)) errors.push('default_social_image does not resolve to a local file');
  if (site.logo && !localAssetExists(site.logo)) errors.push('logo does not resolve to a local file');

  const publishedSamples = articles.filter((article) => article.status === 'published' && (
    article.slug?.startsWith('sample-') || /\bsample\b/i.test(article.title || '') || /sample content/i.test(article.editor_notes || '')
  ));
  if (publishedSamples.length) errors.push(`published sample content remains: ${publishedSamples.map((item) => item.slug).join(', ')}`);
  const sampleAuthors = authors.filter((author) => /\bsample\b/i.test(`${author.name || ''} ${author.bio || ''}`));
  if (sampleAuthors.length) errors.push(`sample contributor records remain: ${sampleAuthors.map((item) => item.slug).join(', ')}`);
  const sampleHubs = hubs.filter((hub) => /\bsample\b/i.test(`${hub.name || ''} ${hub.region || ''} ${hub.description || ''}`));
  if (sampleHubs.length) errors.push(`sample coverage hubs remain: ${sampleHubs.map((item) => item.slug).join(', ')}`);

  return { ok: errors.length === 0, errors, warnings };
}
