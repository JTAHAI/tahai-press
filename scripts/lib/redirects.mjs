import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DIST, readJson } from './content.mjs';

export const PAGES_STATIC_REDIRECT_LIMIT = 2000;
export const SUPPORTED_REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
export const BULK_SUPPORTED_REDIRECT_CODES = new Set([301, 302, 307, 308]);
const CONTROL_OR_SPACE = /[\u0000-\u001f\u007f\s]/;
const DYNAMIC_TOKEN = /[*:]|:[A-Za-z][A-Za-z0-9_]*/;

export function readRedirectConfig() {
  const file = path.join(ROOT, 'content', 'redirects.json');
  if (!fs.existsSync(file)) return { redirects: [], __file: file };
  const parsed = readJson(file);
  return {
    redirects: Array.isArray(parsed) ? parsed : (Array.isArray(parsed.redirects) ? parsed.redirects : []),
    __file: file
  };
}

export function normalizeSiteUrl(value) {
  const parsed = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('site_url must use HTTP or HTTPS');
  if (parsed.username || parsed.password) throw new Error('site_url cannot contain credentials');
  if (parsed.search || parsed.hash) throw new Error('site_url cannot contain a query string or fragment');
  parsed.pathname = '/';
  return parsed;
}

function rejectUnsafeText(value, label) {
  if (!value) throw new Error(`${label} is required`);
  if (CONTROL_OR_SPACE.test(value)) throw new Error(`${label} cannot contain spaces or control characters`);
  if (value.length > 900) throw new Error(`${label} is too long for a safe Cloudflare Pages redirect rule`);
}

export function sourcePathFromLegacyUrl(value) {
  const raw = String(value || '').trim();
  rejectUnsafeText(raw, 'redirect source');
  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password) throw new Error('redirect source cannot contain credentials');
    if (parsed.search || parsed.hash) throw new Error('redirect source cannot contain a query string or fragment');
    pathname = parsed.pathname;
  } else {
    if (!raw.startsWith('/')) throw new Error('redirect source must be a site path or an absolute HTTP(S) URL');
    if (raw.includes('?') || raw.includes('#')) throw new Error('redirect source cannot contain a query string or fragment');
  }
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.startsWith('//')) throw new Error('redirect source cannot be protocol-relative');
  if (pathname.includes('\\')) throw new Error('redirect source cannot contain backslashes');
  if (DYNAMIC_TOKEN.test(pathname)) throw new Error('The starter supports static legacy paths only; use Cloudflare rules for dynamic patterns');
  return pathname;
}

export function normalizeRedirectTarget(value, siteUrl) {
  const raw = String(value || '').trim();
  rejectUnsafeText(raw, 'redirect target');
  if (raw.startsWith('/')) {
    if (raw.startsWith('//')) throw new Error('redirect target cannot be protocol-relative');
    if (raw.includes('\\')) throw new Error('redirect target cannot contain backslashes');
    if (DYNAMIC_TOKEN.test(raw.split(/[?#]/)[0])) throw new Error('The starter supports static targets only');
    return raw;
  }
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('redirect target must use HTTP or HTTPS');
  if (parsed.username || parsed.password) throw new Error('redirect target cannot contain credentials');
  const site = normalizeSiteUrl(siteUrl);
  if (parsed.origin === site.origin) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return parsed.href;
}

export function targetPath(value) {
  const raw = String(value || '');
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw.split('#')[0].split('?')[0] || '/';
}

export function routeFileForPath(pathname, dist = DIST) {
  const clean = String(pathname || '/').split('#')[0].split('?')[0];
  if (!clean.startsWith('/') || clean.startsWith('//')) return null;
  if (clean === '/') return path.join(dist, 'index.html');
  const relative = clean.replace(/^\/+/, '');
  if (clean.endsWith('/')) return path.join(dist, relative, 'index.html');
  if (path.extname(relative)) return path.join(dist, relative);
  const asDirectory = path.join(dist, relative, 'index.html');
  if (fs.existsSync(asDirectory)) return asDirectory;
  return path.join(dist, relative);
}

function ruleLabel(rule) {
  return rule.note ? `${rule.origin}: ${rule.note}` : rule.origin;
}

export function createRedirectPlan({ site, articles, config = readRedirectConfig(), dist = DIST, checkTargets = true, enforcePagesLimit = true } = {}) {
  const candidates = [];
  for (const article of articles || []) {
    if (article.status !== 'published') continue;
    const aliases = Array.isArray(article.legacy_urls) ? article.legacy_urls : [];
    for (const alias of aliases) {
      candidates.push({
        from: alias,
        to: `/stories/${article.slug}/`,
        status: 301,
        preserve_query_string: true,
        origin: `article:${article.slug}`,
        note: 'Article legacy URL'
      });
    }
  }
  for (const [index, item] of (config.redirects || []).entries()) {
    candidates.push({
      from: item?.from,
      to: item?.to,
      status: item?.status ?? 301,
      preserve_query_string: item?.preserve_query_string ?? true,
      origin: `content/redirects.json#${index + 1}`,
      note: item?.note || ''
    });
  }

  const errors = [];
  const rules = [];
  const sourceOwners = new Map();
  const siteUrl = site?.site_url;
  let siteOrigin = '';
  try {
    siteOrigin = normalizeSiteUrl(siteUrl).origin;
  } catch (error) {
    errors.push(error.message);
  }

  for (const candidate of candidates) {
    try {
      const source = sourcePathFromLegacyUrl(candidate.from);
      const target = normalizeRedirectTarget(candidate.to, siteUrl);
      const status = Number(candidate.status);
      if (!SUPPORTED_REDIRECT_CODES.has(status)) throw new Error(`redirect status must be one of ${[...SUPPORTED_REDIRECT_CODES].join(', ')}`);
      if (source === targetPath(target)) throw new Error('redirect source and target resolve to the same path');
      if (sourceOwners.has(source)) {
        throw new Error(`duplicate redirect source also declared by ${sourceOwners.get(source)}`);
      }
      sourceOwners.set(source, ruleLabel(candidate));
      rules.push({
        source,
        target,
        status,
        preserve_query_string: Boolean(candidate.preserve_query_string),
        original_source: String(candidate.from),
        origin: candidate.origin,
        note: candidate.note || ''
      });
    } catch (error) {
      errors.push(`${ruleLabel(candidate)}: ${error.message}`);
    }
  }

  const sources = new Set(rules.map((rule) => rule.source));
  for (const rule of rules) {
    const internalTarget = targetPath(rule.target);
    if (internalTarget && sources.has(internalTarget)) {
      errors.push(`${rule.origin}: redirect chain is not allowed (${rule.source} -> ${internalTarget}); point directly to the final route`);
    }
    if (checkTargets && internalTarget) {
      const targetFile = routeFileForPath(internalTarget, dist);
      if (!targetFile || !fs.existsSync(targetFile)) errors.push(`${rule.origin}: internal redirect target does not exist in dist (${internalTarget})`);
    }
    if (checkTargets) {
      const sourceFile = routeFileForPath(rule.source, dist);
      if (sourceFile && fs.existsSync(sourceFile)) errors.push(`${rule.origin}: redirect source collides with a generated route or asset (${rule.source})`);
    }
  }

  if (enforcePagesLimit && rules.length > PAGES_STATIC_REDIRECT_LIMIT) {
    errors.push(`redirect count ${rules.length} exceeds Cloudflare Pages' ${PAGES_STATIC_REDIRECT_LIMIT} static-rule limit; export and configure Bulk Redirects instead`);
  }

  rules.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  const pageLines = rules.map((rule) => `${rule.source} ${rule.target} ${rule.status}`);
  for (const line of pageLines) {
    if (line.length > 1000) errors.push(`Cloudflare Pages redirect declaration exceeds 1,000 characters: ${line.slice(0, 120)}…`);
  }
  const digest = crypto.createHash('sha256').update(`${pageLines.join('\n')}\n`).digest('hex');

  return {
    site_origin: siteOrigin,
    rules,
    errors,
    counts: { total: rules.length, static: rules.length, article_aliases: rules.filter((rule) => rule.origin.startsWith('article:')).length, manual: rules.filter((rule) => rule.origin.startsWith('content/')).length },
    sha256: digest
  };
}

export function pagesRedirectText(plan) {
  const header = [
    '# Generated by TAHAI Press. Do not edit dist/_redirects directly.',
    '# Edit article legacy_urls or content/redirects.json, then rebuild.'
  ];
  return `${[...header, ...plan.rules.map((rule) => `${rule.source} ${rule.target} ${rule.status}`)].join('\n')}\n`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function bulkRedirectCsv(plan, siteUrl) {
  const site = normalizeSiteUrl(siteUrl);
  for (const rule of plan.rules) {
    if (!BULK_SUPPORTED_REDIRECT_CODES.has(rule.status)) {
      throw new Error(`Cloudflare Bulk Redirect CSV does not support status ${rule.status}; use 301, 302, 307, or 308`);
    }
  }
  return `${plan.rules.map((rule) => {
    let source = rule.original_source;
    if (!/^https?:\/\//i.test(source)) source = new URL(rule.source, site).href;
    const target = /^https?:\/\//i.test(rule.target) ? rule.target : new URL(rule.target, site).href;
    return [source, target, rule.status, rule.preserve_query_string ? 'TRUE' : 'FALSE', 'FALSE', 'FALSE', 'TRUE'].map(csvCell).join(',');
  }).join('\n')}${plan.rules.length ? '\n' : ''}`;
}

export function parsePagesRedirects(text) {
  const rules = [];
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [source, target, code = '302', ...rest] = line.split(/\s+/);
    if (rest.length || !source || !target) continue;
    if (DYNAMIC_TOKEN.test(source)) continue;
    rules.push({ source, target, status: Number(code) || 302 });
  }
  return rules;
}

export function matchStaticRedirect(pathname, rules) {
  return (rules || []).find((rule) => rule.source === pathname) || null;
}
