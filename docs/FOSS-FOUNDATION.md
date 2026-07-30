# TAHAI Press permissive FOSS foundation

**Reviewed:** July 29, 2026
**Default intake rule:** Apache-2.0, MIT, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, or CC0 only.

TAHAI Press remains the product. External projects provide narrow primitives behind TAHAI-owned editorial workflows; no third-party project controls the publication model, public identity, article archive, or deployment output.

## Adoption rules

1. Verify the upstream repository, SPDX license, release activity, and security posture before every adoption.
2. Pin the exact reviewed version. Do not load an unversioned `latest` build.
3. Preserve required copyright and license notices in `THIRD_PARTY_NOTICES.md` and any vendored subtree.
4. Prefer browser-local or build-time components over permanent services.
5. Keep the public publication readable when an optional component fails or JavaScript is disabled.
6. Never let an editor integration silently delete fields it does not understand.
7. Reject GPL, AGPL, SSPL, BSL, Commons Clause, noncommercial, source-available, and ambiguous-license dependencies from the default distribution.
8. Treat MPL/LGPL components as exceptional legal-review items, not ordinary building blocks.
9. Do not import code merely because a repository is public. A recognizable open-source license is mandatory.
10. Record every adopted component, version, purpose, source, modifications, and shipped files.

## Integrated in v2.0

| Component | Version | License | Use | Delivery |
|---|---:|---|---|---|
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | 0.164.2 | MIT | Optional Git-backed newsroom inbox | Pinned CDN script on `/admin/`; no Sveltia code is vendored in v2.0 |

The Sveltia bridge writes only to `content/inbox/`. It does not edit `content/articles/` or the full publication configuration. This is deliberate: an editor that lacks field parity must not rewrite production records.

## Integrated in v2.2

| Component | Version | License | Use | Delivery |
|---|---:|---|---|---|
| Browser crop and focal workflow | TAHAI Press Media Desk | MIT-compatible custom code | Local image preparation with responsive handoff metadata | Self-hosted `public/assets/media-desk.js` and `scripts/lib/media-pipeline.mjs` |
| Responsive image variant pipeline | TAHAI Press build output | MIT-compatible custom code | Deploy-time upload variants, manifest, and media library | Self-hosted build scripts; Sharp remains an optional future encoder |

## Approved candidates for later passes

| Capability | Preferred candidate | License | Planned role |
|---|---|---|---|
| Rich Markdown writing | [Milkdown](https://github.com/Milkdown/milkdown) | MIT | TAHAI Writer Desk editing engine |
| Structured rich text | [Lexical](https://github.com/facebook/lexical) | MIT | Alternative accessible editing engine |
| Image crop and focal point | [Cropper.js](https://github.com/fengyuanchen/cropperjs) | MIT | Browser-local image preparation |
| Browser image compression | [Squoosh](https://github.com/GoogleChromeLabs/squoosh) | Apache-2.0 | Local codecs and optimization patterns |
| Build-time image pipeline | [Sharp](https://github.com/lovell/sharp) | Apache-2.0 | Responsive derivatives, dimensions, AVIF/WebP |
| Static search | [Pagefind](https://github.com/CloudCannon/pagefind) | MIT | Low-bandwidth generated search index |
| Advanced local search | [Orama](https://github.com/oramasearch/orama) | Apache-2.0 | Optional faceting and hybrid search |
| PDF reading | [PDF.js](https://github.com/mozilla/pdf.js) | Apache-2.0 | First-class public-record viewer |
| PDF creation/editing | [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | Document assembly and metadata workflows |
| Print editions | [Paged.js](https://github.com/pagedjs/pagedjs) | MIT | Formal printable editions and reports |
| WordPress HTML conversion | [Turndown](https://github.com/mixmark-io/turndown) | MIT | HTML-to-Markdown migration pipeline |
| Offline caching | [Workbox](https://github.com/GoogleChrome/workbox) | MIT | Hardened optional service worker tooling |
| Collaboration | [Yjs](https://github.com/yjs/yjs) | MIT | Optional real-time/local-first collaboration |
| Data graphics | [Observable Plot](https://github.com/observablehq/plot) | ISC | Accessible editorial charts |
| Maps | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | BSD-3-Clause | Optional open mapping surface |
| Cloudflare functions | [Hono](https://github.com/honojs/hono) | MIT | Small optional Worker APIs |
| D1 data access | [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) | Apache-2.0 | Typed optional D1 access |
| Performance QA | [Lighthouse](https://github.com/GoogleChrome/lighthouse) | Apache-2.0 | Release performance/accessibility checks |
| HTML validation | [Nu Html Checker](https://github.com/validator/validator) | MIT | Standards validation |
| Link validation | [Linkinator](https://github.com/JustinBeckwith/linkinator) | MIT | External and internal link checking |

## Projects not selected as foundations

- Backend-heavy CMS platforms may be studied for UX ideas but will not become runtime dependencies.
- BlockNote XL is not suitable for the default stack because its extended package is GPL-3.0 and the base project uses MPL-2.0.
- WordPress plugins and themes are not copied unless each specific component has a compatible license and a clear, isolated use.
- A public repository with no license is treated as all-rights-reserved.

## Required review record for every new component

Add an entry to `THIRD_PARTY_NOTICES.md` containing:

- project and upstream URL;
- exact version or commit;
- SPDX identifier;
- files or package names shipped;
- whether code was vendored, modified, linked, or used only as design reference;
- required attribution or notice text;
- reason the feature cannot be implemented more safely with existing code.
