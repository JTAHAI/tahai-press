import { formatDate } from './content.mjs';

export const ARTICLE_CLASSIFICATIONS = Object.freeze({
  news: { label: 'News', description: 'Verified reporting about events, decisions, and developments.' },
  analysis: { label: 'Analysis', description: 'Evidence-based interpretation that explains meaning, context, or consequences.' },
  opinion: { label: 'Opinion', description: 'A clearly labeled viewpoint, argument, or editorial position.' },
  investigation: { label: 'Investigation', description: 'Original reporting built from sustained research, records, interviews, or data.' },
  'public-record': { label: 'Public Record', description: 'A source-centered record, filing, document, meeting packet, or official release.' },
  explainer: { label: 'Explainer', description: 'A reader-focused guide to a complicated process, issue, or public question.' },
  interview: { label: 'Interview', description: 'A question-and-answer or conversation-led article.' },
  announcement: { label: 'Announcement', description: 'A clearly identified publication, community, or organizational notice.' },
  developing: { label: 'Developing', description: 'An active story that may change as verified information becomes available.' }
});

export const ARTICLE_CLASSIFICATION_KEYS = Object.freeze(Object.keys(ARTICLE_CLASSIFICATIONS));

export function classificationInfo(value = 'news') {
  const key = ARTICLE_CLASSIFICATIONS[value] ? value : 'news';
  return { key, ...ARTICLE_CLASSIFICATIONS[key] };
}

export function seriesForArticles(articles = []) {
  const series = new Map();
  for (const article of articles) {
    const slug = String(article.series_slug || '').trim();
    const title = String(article.series_title || '').trim();
    if (!slug || !title) continue;
    const existing = series.get(slug) || {
      slug,
      title,
      description: String(article.series_description || '').trim(),
      articles: []
    };
    if (!existing.description && article.series_description) existing.description = String(article.series_description).trim();
    existing.articles.push(article);
    series.set(slug, existing);
  }
  return [...series.values()]
    .map((entry) => ({
      ...entry,
      articles: entry.articles.sort((a, b) => {
        const orderA = Number.isInteger(a.series_order) ? a.series_order : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isInteger(b.series_order) ? b.series_order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB || new Date(a.published_at) - new Date(b.published_at);
      })
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function articleCitation({ article, author, site, url }) {
  const date = formatDate(article.published_at, site.locale, site.timezone);
  const authorName = author?.name || article.author || site.title;
  return `${authorName}. “${article.title}.” ${site.title}, ${date}. ${url}`;
}

export function publicationHistory(article = {}) {
  const updates = Array.isArray(article.update_history) ? article.update_history : [];
  const corrections = Array.isArray(article.corrections) ? article.corrections : [];
  return {
    updates: [...updates].sort((a, b) => new Date(b.date) - new Date(a.date)),
    corrections: [...corrections].sort((a, b) => new Date(b.date) - new Date(a.date))
  };
}
