import crypto from 'node:crypto';
import { escapeHtml } from './content.mjs';
import { xmlEscape } from './seo.mjs';

function absolute(site, route) {
  return new URL(route, site.site_url).href;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function publicArticle(article, site) {
  const route = `/stories/${article.slug}/`;
  return {
    id: article.slug,
    type: 'article',
    title: article.title,
    url: absolute(site, route),
    canonical_url: article.canonical_url || absolute(site, route),
    excerpt: article.excerpt,
    published_at: article.published_at,
    updated_at: article.updated_at || article.published_at,
    author_id: article.author,
    category_ids: article.categories || [],
    topic_ids: article.tags || [],
    series_id: article.series_slug || '',
    classification: article.classification,
    article_type: article.article_type,
    corrected: Array.isArray(article.corrections) && article.corrections.length > 0,
    source_url: article.pdf_url || article.pdf_file || ''
  };
}

function publicRecord(record, site) {
  const route = `/records/${record.id}/`;
  return {
    id: record.id,
    type: 'record',
    title: record.title,
    url: absolute(site, route),
    canonical_url: absolute(site, route),
    published_at: record.published_at || '',
    record_type: record.record_type,
    linked_article_id: record.linked_article || '',
    source_count: Array.isArray(record.source_materials) ? record.source_materials.length : 0,
    sensitivity: record.sensitivity || 'public'
  };
}

export function buildAtom({ site, articles, authors }) {
  const authorMap = new Map(authors.map((author) => [author.slug, author]));
  const entries = articles.slice(0, Number(site.seo?.feed_limit || 50)).map((article) => {
    const url = absolute(site, `/stories/${article.slug}/`);
    const author = authorMap.get(article.author)?.name || article.author;
    return `  <entry>\n    <id>${xmlEscape(url)}</id>\n    <title>${xmlEscape(article.title)}</title>\n    <link href="${xmlEscape(url)}"/>\n    <updated>${xmlEscape(article.updated_at || article.published_at)}</updated>\n    <published>${xmlEscape(article.published_at)}</published>\n    <author><name>${xmlEscape(author)}</name></author>\n    <summary>${xmlEscape(article.excerpt)}</summary>\n${(article.categories || []).map((category) => `    <category term="${xmlEscape(category)}"/>`).join('\n')}\n  </entry>`;
  }).join('\n');
  const updated = articles[0]?.updated_at || articles[0]?.published_at || new Date(0).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n  <id>${xmlEscape(site.site_url)}</id>\n  <title>${xmlEscape(site.seo?.feed_title || site.title)}</title>\n  <updated>${xmlEscape(updated)}</updated>\n  <link href="${xmlEscape(site.site_url)}"/>\n  <link href="${xmlEscape(absolute(site, '/atom.xml'))}" rel="self" type="application/atom+xml"/>\n  <subtitle>${xmlEscape(site.seo?.feed_description || site.description)}</subtitle>\n${entries}\n</feed>\n`;
}

export function buildApi({ site, articles, authors, categories, hubs, records, editions, routeManifest, generatedVersion }) {
  const publicArticles = articles.map((article) => publicArticle(article, site));
  const publicRecords = records.map((record) => publicRecord(record, site));
  const publicEditions = editions.map((edition) => ({
    id: edition.id,
    type: 'edition',
    title: edition.title,
    template: edition.template,
    date: edition.date,
    url: absolute(site, `/editions/${edition.id}/`),
    canonical_url: absolute(site, `/editions/${edition.id}/`),
    story_ids: edition.sections.flatMap((section) => section.story_ids),
    record_ids: edition.sections.flatMap((section) => section.record_ids)
  }));
  const collections = {
    articles: publicArticles,
    authors: authors.map(({ __file, bio, email, ...author }) => ({ ...author, url: absolute(site, `/authors/${author.slug}/`) })),
    categories: categories.map(({ __file, ...category }) => ({ ...category, url: absolute(site, `/categories/${category.slug}/`) })),
    sections: categories.map(({ __file, ...category }) => ({ ...category, url: absolute(site, `/categories/${category.slug}/`) })),
    topics: [...new Set(publicArticles.flatMap((article) => article.topic_ids))].sort().map((id) => ({ id, url: absolute(site, `/topics/${encodeURIComponent(id)}/`) })),
    series: [...new Set(publicArticles.map((article) => article.series_id).filter(Boolean))].sort().map((id) => ({ id, url: absolute(site, `/series/${id}/`) })),
    hubs: hubs.map(({ __file, ...hub }) => ({ ...hub, url: absolute(site, `/hubs/${hub.slug}/`) })),
    records: publicRecords,
    evidence: publicRecords.map(({ id, url, source_count, sensitivity }) => ({ id, url, source_count, sensitivity })),
    editions: publicEditions,
    feeds: [
      { id: 'rss', url: absolute(site, '/feed.xml'), type: 'application/rss+xml' },
      { id: 'atom', url: absolute(site, '/atom.xml'), type: 'application/atom+xml' },
      { id: 'json-feed', url: absolute(site, '/feed.json'), type: 'application/feed+json' }
    ]
  };
  const generatedAt = articles.map((article) => article.updated_at || article.published_at).filter(Boolean).sort().at(-1) || '';
  const documents = Object.fromEntries(Object.entries(collections).map(([name, items]) => {
    const payload = { schema_version: 1, generated_version: generatedVersion, generated_at: generatedAt, canonical_url: absolute(site, `/api/v1/${name}.json`), checksum: digest(items), count: items.length, page: 1, page_size: items.length, items };
    return [name, payload];
  }));
  documents.manifest = {
    schema_version: 1,
    generated_version: generatedVersion,
    generated_at: generatedAt,
    canonical_url: absolute(site, '/api/v1/manifest.json'),
    checksum: digest(documents),
    routes: routeManifest.filter((route) => route.include !== false).map((route) => route.loc),
    collections: Object.keys(collections).sort().map((name) => ({ name, url: absolute(site, `/api/v1/${name}.json`), count: collections[name].length }))
  };
  return documents;
}

export function renderNewsletter({ newsletter, site, articleMap }) {
  const articles = newsletter.story_ids.map((id) => articleMap.get(id)).filter(Boolean);
  const subject = newsletter.subject || `${site.title}: ${newsletter.title}`;
  const preview = newsletter.preview_text || newsletter.description || site.description;
  const list = articles.map((article) => `<tr><td style="padding:18px 0;border-top:1px solid #d7d2c8"><a href="${escapeHtml(absolute(site, `/stories/${article.slug}/`))}" style="color:#17324d;font:700 22px Georgia,serif;text-decoration:none">${escapeHtml(article.title)}</a><p style="margin:8px 0 0;color:#3d4852;font:16px/1.5 Arial,sans-serif">${escapeHtml(article.excerpt)}</p></td></tr>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f3f0e9;color:#17212b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;padding:32px"><tr><td><p style="margin:0;color:#59636d;font:13px Arial,sans-serif">${escapeHtml(preview)}</p><h1 style="margin:18px 0 8px;font:700 34px Georgia,serif">${escapeHtml(newsletter.title)}</h1><p style="font:16px/1.5 Arial,sans-serif">${escapeHtml(newsletter.description || '')}</p></td></tr>${list}<tr><td style="padding-top:20px;border-top:1px solid #d7d2c8;font:13px/1.5 Arial,sans-serif">You are receiving this because you subscribed to ${escapeHtml(site.title)}. Replace this provider-neutral placeholder with your email provider’s unsubscribe link before sending.</td></tr></table></td></tr></table></body></html>`;
  const text = [subject, preview, newsletter.description || '', ...articles.flatMap((article) => [article.title, article.excerpt, absolute(site, `/stories/${article.slug}/`), '']), 'Unsubscribe: replace this provider-neutral placeholder before sending.'].filter(Boolean).join('\n');
  return { subject, preview, html, text, articles };
}
