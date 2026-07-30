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
  if (/^TAHAI Press$/i.test(site.title || '')) errors.push('publication title still uses the TAHAI Press demonstration identity');
  if (String(site.logo || '').includes('tahai-press')) errors.push('logo still uses a TAHAI Press demonstration asset');
  if (String(site.default_social_image || '').includes('tahai-press')) errors.push('default_social_image still uses a TAHAI Press demonstration asset');
  if (!Array.isArray(site.navigation?.items) || site.navigation.items.length === 0) errors.push('navigation has no public links');
  if (!Array.isArray(site.homepage?.modules) || !site.homepage.modules.some((module) => module.type === 'intro' && module.enabled !== false)) errors.push('homepage introduction is missing or disabled');
  if (Number(site.setup_version || 0) < 1) warnings.push('setup_version is missing; run the guided setup or update content/site.json');
  if (!site.default_social_image) warnings.push('default_social_image is empty; social cards may appear without an image');
  else if (!localAssetExists(site.default_social_image)) errors.push('default_social_image does not resolve to a local file');
  if (site.logo && !localAssetExists(site.logo)) errors.push('logo does not resolve to a local file');

  const publishedSamples = articles.filter((article) => article.status === 'published' && (
    article.slug?.startsWith('sample-') || /\bsample\b/i.test(article.title || '') || /sample content/i.test(article.editor_notes || '')
  ));
  if (publishedSamples.length) errors.push(`published sample content remains: ${publishedSamples.map((item) => item.slug).join(', ')}`);
  const sampleAuthors = authors.filter((author) => /\bsample\b/i.test(`${author.name || ''} ${author.bio || ''}`));
  if (sampleAuthors.length) errors.push(`sample contributor records remain: ${sampleAuthors.map((item) => item.slug).join(', ')}`);
  if (!articles.some((article) => article.status === 'published')) warnings.push('no published articles are available yet');

  const sampleHubs = hubs.filter((hub) => /\bsample\b/i.test(`${hub.name || ''} ${hub.region || ''} ${hub.description || ''}`));
  if (sampleHubs.length) errors.push(`sample coverage hubs remain: ${sampleHubs.map((item) => item.slug).join(', ')}`);

  return { ok: errors.length === 0, errors, warnings };
}
