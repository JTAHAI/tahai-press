# Architecture

## Objective

Provide a reusable publishing system that is simple for a nontechnical editor and does not require a database, persistent server process, paid CMS, or routine developer intervention.

## Selected architecture

```text
Pages CMS editor (optional)
       |
       v
GitHub repository (JSON articles + PDFs + images)
       |
       v
Dependency-free Node build
       |
       v
Cloudflare Pages or another static host
```

## Why the build is dependency-free

A conventional framework could provide the same output, but it would add package upgrades, framework migrations, adapter changes, and a larger dependency supply chain. The generator uses only Node.js built-ins, which keeps the build reproducible locally, in GitHub Actions, and on Cloudflare Pages.

The content model remains portable. A downstream project can later migrate to Astro, Hugo, Eleventy, or another generator without rewriting the source article records.

## Source-of-truth boundaries

- Git is the source of truth for content and media.
- Pages CMS is an editing interface, not a separate content database.
- The static host serves generated files only.
- The build never modifies source content.
- Draft and archived entries are excluded from public output.
- Publication-specific migration work belongs in a downstream fork or separate branch.

## PDF storage tiers

1. Repository storage for normal article PDFs that fit the host's per-file limits.
2. External HTTPS URL fields for unusually large documents stored in object storage.
3. The article renderer treats both locations consistently.

## Visual architecture

- Semantic theme tokens are defined in CSS.
- Safe six-digit hex colors from `content/site.json` override the defaults.
- The brand mark is generated from one or two configured letters.
- Reusable layout primitives support home, archive, hub, editorial, contact, submission, article, document, and error routes.
- Responsive, keyboard, reduced-motion, and print states are built into the foundation before the dedicated accessibility pass.


## Article rendering architecture

The build uses one article record shape and selects a renderer from `article_type`:

```text
standard -> focused prose
pdf      -> document first, optional context after
mixed    -> context first, local or hosted PDF after
external -> context plus safe outbound document card
```

Shared components render publication metadata, contributor identity, sources, topic labels, document facts, and publication notes. This prevents four templates from drifting into four separate content systems. External records intentionally do not use an iframe because source hosts may block framing through security headers.

## PDF reader layer

`public/assets/pdf-reader.js` is a small progressive-enhancement layer copied unchanged into `dist/assets/`. It does not parse or render PDF bytes. The browser remains responsible for native PDF display. The script only manages preview status, fit fragments, full-screen state, and the print-page action. All essential document access remains ordinary HTML links.


## Pages CMS authoring architecture

`.pages.yml` is the browser-editor contract. It exposes only publication content, reference data, identity settings, and public media folders. It intentionally excludes application code, deployment workflows, credentials, and security configuration. The configuration includes narrowly scoped article-alias and manual static-redirect fields.

New article records use a draft-first lifecycle. The content validator treats incomplete drafts as non-public work in progress while applying strict completeness and review gates to Published records. The article JSON filename is derived from the explicit slug field, preventing filename and public-route drift.

The CMS configuration and `schemas/article.schema.json` are kept in parity by `scripts/validate-cms-config.mjs`. This is a dependency-free contract check rather than a replacement for Pages CMS itself. It verifies critical paths, field coverage, safe media handling, defaults, and publication-review controls before deployment.


## Publishing automation

Cloudflare Pages' native Git integration remains the deployment authority. No Cloudflare token is stored in the repository and GitHub Actions does not compete with Cloudflare by issuing a second production deployment.

The Cloudflare build command is `npm run build:cloudflare`, which validates content and CMS configuration, runs tests, generates `dist/`, and verifies the deployment output before returning success. Cloudflare-provided branch and commit environment values are reduced to a small public build record rather than exposing the full environment.

Non-production Cloudflare branches are treated as previews and receive global `noindex,nofollow` metadata plus a crawl-blocking `robots.txt`. The production branch defaults to `main` and is configurable through `PUBLICATION_PRODUCTION_BRANCH`.

GitHub Actions provides an independent proof lane:

```text
source commit
    -> cumulative validation and tests
    -> static build and output verification
    -> ephemeral HTTP smoke server
    -> exact SHA-256 file manifest
    -> commit-addressed artifact
```

The generated `/.well-known/publication-health.json` and `/.well-known/publication-build.json` files are deliberately small, public, and secret-free. They support deployment confirmation without adding a dynamic health service.

## Migration architecture

`scripts/import-content.mjs` is a local intake boundary, not part of the public site and not a server endpoint. It normalizes supported source formats into the same JSON article contract used by Pages CMS and the static generator.

```text
WordPress WXR / Markdown / JSON / CSV / PDF folder
                         |
                         v
              local dry-run + report
                         |
                         v
        normalized draft JSON + copied local PDFs
                         |
                         v
              existing validation and build
```

The importer uses only Node.js built-ins. It does not fetch remote URLs, scrape live sites, authenticate to WordPress, download media, directly modify deployment output, or publish to Cloudflare. Imported source files and generated reports live in Git-ignored directories by default. Existing slugs are never replaced unless an operator explicitly selects overwrite behavior.

The original URL is stored in the import report and normalized article `legacy_urls`. Redirect generation remains a separate build stage so migration intake cannot silently change live routing behavior.


## URL and canonical architecture

The source-of-truth hierarchy is:

```text
article legacy_urls + content/redirects.json
                    |
                    v
       dependency-free redirect planner
                    |
       validation against generated routes
                    |
                    v
              dist/_redirects
```

Article aliases are coupled to publication state: a Draft or Archived destination does not emit a live redirect. Manual rules cover retired non-article pages. The planner normalizes absolute old URLs into Pages path rules, rejects ambiguous or broad matching behavior, sorts rules deterministically, and hashes the exact output.

Canonical generation remains part of the HTML renderer, but source validation and deployment verification independently enforce one canonical per page, same-site path parity, uniqueness, HTTPS, and separation from redirect sources.

The optional Bulk Redirect CSV is an account-configuration artifact, not a hidden deployment action. This keeps Cloudflare account changes visible and reviewable while allowing migrations larger than the Pages file limit.

## Search and archive architecture

The build treats discovery as another deterministic static artifact:

```text
Published article records
        |
        +--> search-index.json --> browser search UI
        |
        +--> category/topic/author/hub/date groupings
                              |
                              +--> canonical paginated HTML routes
```

`scripts/lib/discovery.mjs` owns topic-slug normalization, search text normalization, public index creation, date grouping helpers, and deterministic pagination. The browser search script consumes only the generated public index and builds result nodes with DOM APIs. No search query leaves the reader's browser.

All archive links resolve to generated files and therefore pass the same route verification, canonical uniqueness, redirect collision, preview-indexing, and release-manifest checks as article pages. Topic slug collisions fail before output generation rather than allowing two labels to share a route.
