# URL, canonical, and redirect preservation

TAHAI Press preserves old article addresses without adding a database, server-side router, or manual post-deployment editing step.

## Article aliases

Each article can contain an optional `legacy_urls` list:

```json
{
  "slug": "example-story",
  "legacy_urls": [
    "/news/example-story/",
    "https://old.example.org/2024/05/example-story/"
  ]
}
```

When the article is Published, both old paths generate permanent redirects to:

```text
/stories/example-story/
```

An absolute legacy URL is preserved in source content and migration reports, while its path becomes the Cloudflare Pages rule. This allows an old domain that reaches the same Cloudflare deployment to retain its historical article paths. Draft and archived records do not publish redirects to routes that are not public.

In Pages CMS, edit **Publishing → Articles → Previous article URLs**. Normally, add an old address before changing an established slug.

## Manual redirects

Use **Site settings → Manual redirects** or edit `content/redirects.json` for retired non-article pages:

```json
{
  "redirects": [
    {
      "from": "/old-about/",
      "to": "/about/",
      "status": 301,
      "preserve_query_string": true,
      "note": "Retired navigation page"
    }
  ]
}
```

Article-specific aliases belong on the article record. Manual rules are intended for old landing pages, sections, or imported routes that do not map one-to-one to an article.

## Generated Cloudflare file

The build creates `dist/_redirects` from the validated source records. Never edit that generated file directly. Cloudflare Pages reads it from the deployment output.

The starter supports static path rules only. It deliberately rejects wildcards and placeholders so a broad rule cannot unexpectedly capture working pages. Dynamic domain, language, country, cookie, or regular-expression routing should be configured separately through the relevant Cloudflare Rules product after review.

## Fail-closed checks

`npm run validate:redirects` and the production build reject:

- duplicate source paths, including the same path supplied through two different old domains;
- self redirects;
- redirect chains and loops;
- sources that collide with a generated route or public asset;
- internal targets that do not exist;
- source query strings or fragments;
- credential-bearing URLs;
- wildcards and placeholders;
- unsupported status codes;
- declarations over Cloudflare Pages limits.

The generated rule list receives a SHA-256 digest. The same digest and rule count are written to:

```text
/.well-known/publication-redirects.json
/.well-known/publication-build.json
```

Deployment verification recomputes the plan and requires an exact match with `dist/_redirects` and both metadata records.

## Canonical URL contract

Every generated HTML page has exactly one absolute canonical URL.

- `content/site.json` must contain an HTTPS origin with no path, query string, fragment, or credentials.
- Normal article canonicals are generated from the article slug.
- A same-site canonical override must match the generated article route exactly.
- External canonical overrides are allowed for reviewed syndicated or republished material.
- Canonicals may not contain query strings, fragments, or credentials.
- Duplicate canonical URLs fail validation.
- A same-site canonical path cannot also be a redirect source.

The homepage canonical is normalized to the site root, including a trailing slash.

## Cloudflare Bulk Redirect export

Cloudflare Pages `_redirects` supports a bounded number of rules. For a migration that exceeds the Pages static-rule limit, generate a dashboard-ready Bulk Redirect CSV:

```bash
npm run redirects:bulk
```

Output:

```text
deployment/bulk-redirects.csv
```

The file has no header row and uses Cloudflare's expected column order:

```text
source,target,status,preserve-query,include-subdomains,subpath-matching,preserve-path-suffix
```

Regenerate the CSV after setting the real production `site_url`. The `preserve_query_string` field applies to this Bulk Redirect export; Cloudflare Pages `_redirects` does not expose the same per-rule switch.

A Bulk Redirect list is not activated merely by committing the CSV. It must be imported and enabled in the correct Cloudflare account and zone. Keep that one-time account configuration in the deployment handoff record.

## Migration workflow

1. Import content with a dry run.
2. Review the generated article records and migration URL map.
3. Confirm each article's `legacy_urls` values.
4. Publish the reviewed articles.
5. Run `npm run validate`.
6. Run `npm run build:cloudflare`.
7. Test representative old paths on the Cloudflare preview.
8. Merge to production only after the redirect targets and canonical tags are correct.
