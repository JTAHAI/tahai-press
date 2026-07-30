import { storyBlocksPlainText } from './editorial.mjs';

export function topicSlug(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function uniqueTopics(articles = []) {
  const owners = new Map();
  const topics = new Map();
  for (const article of articles) {
    for (const rawTag of article.tags || []) {
      const name = String(rawTag || '').trim();
      const slug = topicSlug(name);
      if (!name || !slug) continue;
      const normalized = name.toLocaleLowerCase('en-US');
      const previous = owners.get(slug);
      if (previous && previous !== normalized) {
        throw new Error(`Topic slug collision: “${name}” and another topic both resolve to “${slug}”`);
      }
      owners.set(slug, normalized);
      const existing = topics.get(slug) || { slug, name, count: 0 };
      existing.count += 1;
      topics.set(slug, existing);
    }
  }
  return [...topics.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function paginate(items = [], pageSize = 12) {
  const size = Number(pageSize);
  if (!Number.isInteger(size) || size < 1 || size > 100) {
    throw new Error('archive page size must be an integer between 1 and 100');
  }
  const pages = [];
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  for (let page = 1; page <= totalPages; page += 1) {
    pages.push({
      page,
      totalPages,
      totalItems: items.length,
      pageSize: size,
      items: items.slice((page - 1) * size, page * size)
    });
  }
  return pages;
}

export function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function plainText(markdown = '') {
  return String(markdown)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_>#~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createSearchIndex({ articles = [], authors = [], categories = [], hubs = [] } = {}) {
  const authorMap = new Map(authors.map((item) => [item.slug, item]));
  const categoryMap = new Map(categories.map((item) => [item.slug, item]));
  const hubMap = new Map(hubs.map((item) => [item.slug, item]));
  return articles.map((article) => {
    const author = authorMap.get(article.author);
    const categoryNames = (article.categories || []).map((slug) => categoryMap.get(slug)?.name).filter(Boolean);
    const hub = hubMap.get(article.hub);
    const body = plainText(`${article.body || ''} ${storyBlocksPlainText(article)}`);
    const searchable = normalizeSearchText([
      article.title,
      article.kicker,
      article.excerpt,
      body,
      author?.name,
      ...categoryNames,
      ...(article.tags || []),
      hub?.name,
      article.pdf_title,
      article.document_description,
      article.document_source,
      article.classification,
      article.series_title,
      article.series_description,
      article.methodology,
      article.disclosure,
      article.what_changed,
      ...(article.update_history || []).flatMap((entry) => [entry.title, entry.body]),
      ...(article.corrections || []).flatMap((entry) => [entry.title, entry.body])
    ].filter(Boolean).join(' '));
    return {
      title: article.title,
      url: `/stories/${article.slug}/`,
      excerpt: article.excerpt,
      published_at: article.published_at,
      updated_at: article.updated_at || '',
      article_type: article.article_type,
      classification: article.classification || 'news',
      series: article.series_slug ? { slug: article.series_slug, title: article.series_title } : null,
      author: author ? { name: author.name, slug: author.slug } : null,
      categories: (article.categories || []).map((slug) => ({ slug, name: categoryMap.get(slug)?.name || slug })),
      tags: (article.tags || []).map((name) => ({ name, slug: topicSlug(name) })).filter((item) => item.slug),
      hub: hub ? { name: hub.name, slug: hub.slug } : null,
      searchable
    };
  });
}

export function archiveDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return { year, month };
}
