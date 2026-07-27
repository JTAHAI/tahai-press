# SEO, feeds, and social metadata

TAHAI Press generates standards-based discovery output from the publisher's configured identity and published content:

- one absolute canonical URL per HTML route;
- robots metadata that blocks template and preview deployments;
- Open Graph and social-card metadata;
- publisher-configured Article, NewsArticle, or BlogPosting JSON-LD;
- WebSite, WebPage, CollectionPage, BreadcrumbList, Person, and Organization entities where appropriate;
- `sitemap.xml` containing indexable generated routes;
- RSS 2.0 at `/feed.xml`;
- JSON Feed 1.1 at `/feed.json`;
- a publisher-configured web manifest.

TAHAI Press does not emit meta-keyword tags, hidden keyword copy, hidden promotional links, unrelated schema entities, or TAHAI Web Services publisher data. Template mode is enabled in the boilerplate so an unconfigured fork remains blocked from search indexing until the publisher intentionally replaces the sample identity and disables `template_mode`.
