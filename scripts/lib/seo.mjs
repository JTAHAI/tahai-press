import path from 'node:path';
import { escapeHtml, safeUrl } from './content.mjs';

const PUBLISHER_TYPES = new Set(['Organization', 'NewsMediaOrganization']);
const ARTICLE_TYPES = new Set(['Article', 'NewsArticle', 'BlogPosting']);

export function templateMode(site = {}) {
  return site.template_mode !== false;
}

export function absoluteResource(value, siteUrl) {
  const safe = safeUrl(value || '');
  if (!safe) return '';
  return new URL(safe, siteUrl).href;
}

export function jsonForHtml(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

export function jsonLdScript(value) {
  return `<script type="application/ld+json">${jsonForHtml(value)}</script>`;
}

function compactObject(value) {
  if (Array.isArray(value)) return value.map(compactObject).filter((item) => item !== undefined && item !== '');
  if (!value || typeof value !== 'object') return value === '' || value === undefined || value === null ? undefined : value;
  return Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, compactObject(item)])
    .filter(([, item]) => item !== undefined && !(Array.isArray(item) && item.length === 0)));
}

function publisherEntity(site) {
  const configured = site.seo?.publisher_type;
  const type = PUBLISHER_TYPES.has(configured) ? configured : 'Organization';
  const logo = absoluteResource(site.logo, site.site_url);
  return compactObject({
    '@type': type,
    '@id': `${site.site_url}#publisher`,
    name: site.title,
    url: site.site_url,
    logo: logo ? { '@type': 'ImageObject', url: logo } : undefined,
    sameAs: Array.isArray(site.seo?.social_profiles) ? site.seo.social_profiles : []
  });
}

function authorEntity(author, site) {
  if (!author) return undefined;
  const type = author.entity_type === 'Organization' ? 'Organization' : 'Person';
  return compactObject({
    '@type': type,
    name: author.name,
    url: author.slug ? new URL(`/authors/${author.slug}/`, site.site_url).href : undefined
  });
}

export function pageHead({
  site,
  deployment,
  route,
  pageTitle,
  description,
  canonical,
  noindex = false,
  image = '',
  imageAlt = '',
  article = null,
  author = null,
  categories = [],
  tags = []
}) {
  const globallyBlocked = templateMode(site) || Boolean(deployment?.isPreview);
  const robots = (noindex || globallyBlocked) ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large';
  const resolvedImage = absoluteResource(image || site.default_social_image, site.site_url);
  const resolvedImageAlt = imageAlt || site.default_social_image_alt || '';
  const ogType = article ? 'article' : 'website';
  const twitterSite = String(site.seo?.twitter_site || '').trim();
  const publisher = publisherEntity(site);
  const graph = [];

  if (article) {
    const configuredType = site.seo?.article_schema_type;
    const articleType = ARTICLE_TYPES.has(configuredType) ? configuredType : 'Article';
    graph.push(compactObject({
      '@type': articleType,
      '@id': `${canonical}#article`,
      headline: article.title,
      description,
      url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      datePublished: article.published_at,
      dateModified: article.updated_at || article.published_at,
      author: authorEntity(author, site),
      publisher,
      image: resolvedImage ? [resolvedImage] : undefined,
      articleSection: categories,
      genre: article.classification,
      isPartOf: article.series_slug ? { '@type': 'CreativeWorkSeries', name: article.series_title, url: new URL(`/series/${article.series_slug}/`, site.site_url).href } : undefined,
      backstory: article.methodology || undefined,
      correction: Array.isArray(article.corrections) && article.corrections.length ? article.corrections.map((entry) => `${entry.date}: ${entry.body}`) : undefined,
      copyrightNotice: article.rights_and_reuse || undefined,
      keywords: tags,
      isAccessibleForFree: true
    }));
    graph.push(compactObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: site.site_url },
        { '@type': 'ListItem', position: 2, name: 'Stories', item: new URL('/stories/', site.site_url).href },
        { '@type': 'ListItem', position: 3, name: article.title, item: canonical }
      ]
    }));
  } else {
    graph.push(compactObject({
      '@type': 'WebSite',
      '@id': `${site.site_url}#website`,
      url: site.site_url,
      name: site.title,
      description: site.description,
      publisher,
      inLanguage: site.locale,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${new URL('/search/', site.site_url).href}?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    }));
    graph.push(compactObject({
      '@type': route === '/' ? 'WebPage' : 'CollectionPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: pageTitle,
      description,
      isPartOf: { '@id': `${site.site_url}#website` },
      inLanguage: site.locale
    }));
  }

  const tagsHtml = [
    `<meta name="robots" content="${robots}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:site_name" content="${escapeHtml(site.title)}">`,
    `<meta property="og:locale" content="${escapeHtml(String(site.locale || 'en-US').replace('-', '_'))}">`,
    `<meta property="og:title" content="${escapeHtml(pageTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta name="twitter:card" content="${resolvedImage ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(pageTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    twitterSite ? `<meta name="twitter:site" content="${escapeHtml(twitterSite.startsWith('@') ? twitterSite : `@${twitterSite}`)}">` : '',
    resolvedImage ? `<meta property="og:image" content="${escapeHtml(resolvedImage)}">` : '',
    resolvedImage ? `<meta name="twitter:image" content="${escapeHtml(resolvedImage)}">` : '',
    resolvedImageAlt ? `<meta property="og:image:alt" content="${escapeHtml(resolvedImageAlt)}">` : '',
    resolvedImageAlt ? `<meta name="twitter:image:alt" content="${escapeHtml(resolvedImageAlt)}">` : '',
    article ? `<meta property="article:published_time" content="${escapeHtml(article.published_at)}">` : '',
    article?.updated_at ? `<meta property="article:modified_time" content="${escapeHtml(article.updated_at)}">` : '',
    ...categories.map((category) => `<meta property="article:section" content="${escapeHtml(category)}">`),
    ...tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}">`),
    `<link rel="alternate" type="application/rss+xml" title="${escapeHtml(site.seo?.feed_title || `${site.title} RSS`)}" href="${escapeHtml(new URL('/feed.xml', site.site_url).href)}">`,
    `<link rel="alternate" type="application/feed+json" title="${escapeHtml(site.seo?.feed_title || `${site.title} JSON Feed`)}" href="${escapeHtml(new URL('/feed.json', site.site_url).href)}">`,
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
    '<link rel="manifest" href="/site.webmanifest">',
    jsonLdScript({ '@context': 'https://schema.org', '@graph': graph })
  ].filter(Boolean);

  return { html: tagsHtml.join('\n  '), robots, globallyBlocked, image: resolvedImage };
}

export function xmlEscape(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildSitemap(entries = []) {
  const urls = entries
    .filter((entry) => entry.include !== false)
    .map((entry) => `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : ''}\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRss({ site, articles, authors, categories }) {
  const authorMap = new Map(authors.map((item) => [item.slug, item]));
  const categoryMap = new Map(categories.map((item) => [item.slug, item]));
  const limit = Number(site.seo?.feed_limit || 50);
  const items = articles.slice(0, limit).map((article) => {
    const url = new URL(`/stories/${article.slug}/`, site.site_url).href;
    const date = new Date(article.published_at).toUTCString();
    const author = authorMap.get(article.author)?.name || article.author;
    return `  <item>\n    <title>${xmlEscape(article.title)}</title>\n    <link>${xmlEscape(url)}</link>\n    <guid isPermaLink="true">${xmlEscape(url)}</guid>\n    <pubDate>${xmlEscape(date)}</pubDate>\n    <dc:creator>${xmlEscape(author)}</dc:creator>\n    <description>${xmlEscape(article.excerpt)}</description>\n${(article.categories || []).map((slug) => `    <category>${xmlEscape(categoryMap.get(slug)?.name || slug)}</category>`).join('\n')}\n  </item>`;
  }).join('\n');
  const latest = articles[0]?.updated_at || articles[0]?.published_at;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n<channel>\n  <title>${xmlEscape(site.seo?.feed_title || site.title)}</title>\n  <link>${xmlEscape(site.site_url)}</link>\n  <atom:link href="${xmlEscape(new URL('/feed.xml', site.site_url).href)}" rel="self" type="application/rss+xml"/>\n  <description>${xmlEscape(site.seo?.feed_description || site.description)}</description>\n  <language>${xmlEscape(site.locale)}</language>${latest ? `\n  <lastBuildDate>${xmlEscape(new Date(latest).toUTCString())}</lastBuildDate>` : ''}\n${items}\n</channel>\n</rss>\n`;
}

export function buildJsonFeed({ site, articles, authors, tagsByArticle = new Map() }) {
  const authorMap = new Map(authors.map((item) => [item.slug, item]));
  const limit = Number(site.seo?.feed_limit || 50);
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: site.seo?.feed_title || site.title,
    home_page_url: site.site_url,
    feed_url: new URL('/feed.json', site.site_url).href,
    description: site.seo?.feed_description || site.description,
    language: site.locale,
    icon: absoluteResource(site.logo, site.site_url) || undefined,
    authors: [{ name: site.title, url: site.site_url }],
    items: articles.slice(0, limit).map((article) => {
      const url = new URL(`/stories/${article.slug}/`, site.site_url).href;
      const author = authorMap.get(article.author);
      return compactObject({
        id: url,
        url,
        title: article.title,
        summary: article.excerpt,
        date_published: article.published_at,
        date_modified: article.updated_at || article.published_at,
        authors: author ? [{ name: author.name, url: new URL(`/authors/${author.slug}/`, site.site_url).href }] : undefined,
        tags: tagsByArticle.get(article.slug) || article.tags || []
      });
    })
  };
}

export function routeFromHtmlFile(file, dist) {
  const relative = path.relative(dist, file).replaceAll('\\', '/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}
