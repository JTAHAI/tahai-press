# Search and archives

TAHAI Press generates discovery without a database, hosted search product, serverless function, analytics dependency, or external API.

## Static search contract

The build writes `/search-index.json` from Published articles only. Each entry contains the public title, URL, summary, dates, article format, contributor, categories, topics, coverage hub, and normalized searchable text. Drafts, Archived records, private editor notes, source-file paths, and migration reports are excluded.

`/search/` loads that index in the browser and supports:

- words and phrases across headline, summary, article text, contributor, category, topic, hub, and document metadata;
- format filtering;
- category filtering;
- query-string state for shareable or reloadable searches;
- live result counts and an explicit no-results state;
- a bounded result limit configured in `content/site.json`;
- DOM-only result construction so index values are never assigned through `innerHTML`.

The search script is progressive enhancement. When JavaScript is disabled or the index fails to load, readers receive links to the normal static archives.

## Generated archives

Every build creates:

```text
/stories/
/categories/
/categories/<category>/
/topics/
/topics/<topic>/
/authors/
/authors/<author>/
/hubs/
/hubs/<hub>/
/archive/
/archive/<year>/
/archive/<year>/<month>/
```

Archive pages sort newest first. When an archive exceeds `discovery.archive_page_size`, later pages use `/page/2/`, `/page/3/`, and so on. Every page receives its own canonical URL plus previous and next navigation.

Topic slugs are normalized from article tags. Validation fails when two distinct labels would collapse to the same URL slug, preventing one topic page from silently taking ownership of another.

## Configuration

`content/site.json` contains:

```json
"discovery": {
  "archive_page_size": 12,
  "search_result_limit": 50
}
```

Both values must be integers from 1 through 100. The same controls are available under Site settings in Pages CMS.

## Operational behavior

- New Published content enters the search index and all applicable archives on the next successful build.
- Draft and Archived records do not appear.
- Removing a tag can retire its generated topic route; preserve an externally used topic URL through `content/redirects.json` when needed.
- Changing a category, author, or hub slug changes its archive URL and requires reference updates plus a redirect if the old route was public.
- Search data is public because it is downloaded by readers. Do not place secrets or private information in Published content fields.

## Sections and series

Professional Desk adds two static discovery systems:

- `/sections/` groups public articles by their explicit editorial classification.
- `/series/` groups continuing packages and links to ordered series fronts.

Classification, series title, methodology, disclosures, corrections, and update summaries contribute to the local search index when publicly rendered. Draft and Scheduled records remain absent until they become Published.
