import fs from 'node:fs';
import path from 'node:path';
import { normalizeSiteConfig } from './site-config.mjs';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const CONTENT = path.join(ROOT, 'content');
export const DIST = path.join(ROOT, 'dist');

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read JSON ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

export function readCollection(name) {
  const directory = path.join(CONTENT, name);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      ...readJson(path.join(directory, file)),
      __file: path.join(directory, file)
    }));
}

export function loadContent() {
  return {
    site: normalizeSiteConfig(readJson(path.join(CONTENT, 'site.json'))),
    articles: readCollection('articles'),
    authors: readCollection('authors'),
    categories: readCollection('categories'),
    hubs: readCollection('hubs'),
    crosswords: readCollection('crosswords'),
    records: readCollection('records'),
    editions: readCollection('editions'),
    newsletters: readCollection('newsletters'),
    datasets: readCollection('datasets'),
    maps: readCollection('maps'),
    developing: readCollection('developing')
  };
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function safeUrl(value = '') {
  const raw = String(value).trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const parsed = new URL(raw);
    if (['https:', 'http:', 'mailto:'].includes(parsed.protocol)) return parsed.href;
  } catch {}
  return '';
}

function inlineMarkdown(text) {
  let output = escapeHtml(text);
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const safe = safeUrl(href);
    return safe ? `<a href="${escapeHtml(safe)}">${label}</a>` : label;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  return output;
}

export function renderMarkdown(markdown = '') {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = '';
  let blockquote = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = '';
  };
  const flushBlockquote = () => {
    if (!blockquote.length) return;
    html.push(`<blockquote><p>${inlineMarkdown(blockquote.join(' '))}</p></blockquote>`);
    blockquote = [];
  };
  const flushAll = () => {
    flushParagraph();
    closeList();
    flushBlockquote();
  };
  const openList = (type) => {
    if (listType === type) return;
    closeList();
    html.push(`<${type}>`);
    listType = type;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushAll();
      continue;
    }
    if (line === '---') {
      flushAll();
      html.push('<hr>');
      continue;
    }
    if (line.startsWith('### ')) {
      flushAll();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushAll();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('> ')) {
      flushParagraph();
      closeList();
      blockquote.push(line.slice(2));
      continue;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      flushBlockquote();
      openList('ul');
      html.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushBlockquote();
      openList('ol');
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }
    flushBlockquote();
    paragraph.push(line);
  }
  flushAll();
  return html.join('\n');
}

export function estimateReadingMinutes(markdown = '', wordsPerMinute = 225) {
  const text = String(markdown)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.split(' ').length / wordsPerMinute));
}

export function formatDate(value, locale = 'en-US', timezone = 'America/New_York') {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone
  }).format(date);
}

export function relativeFile(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}
