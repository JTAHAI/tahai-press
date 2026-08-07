<p align="center">
  <img src="public/assets/tahai-press-logo.png" alt="TAHAI Press" width="320">
</p>

# TAHAI Press

<p align="center"><strong>A publisher-owned, database-free newsroom for articles, public records, PDFs, community reporting, and independent publications.</strong></p>

<p align="center">
  Built for <strong>GitHub</strong>, <strong>Pages CMS</strong>, and <strong>Cloudflare Pages</strong>.
</p>

**Created by Justin Tahai and TAHAI Web Services**  
[https://tahai.net](https://tahai.net)

<p align="center">
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-123a5a"></a>
  <img alt="Node 22" src="https://img.shields.io/badge/Node.js-22%2B-123a5a">
  <img alt="Database free" src="https://img.shields.io/badge/database-none-061b2d">
  <img alt="Static first" src="https://img.shields.io/badge/output-static_HTML-345f7f">
</p>

---

## The front page

TAHAI Press is a complete static publishing platform presented with the formality and readability of a newspaper.

It gives independent publishers a serious editorial surface without requiring a WordPress runtime, application server, proprietary CMS database, or permanent technical caretaker. Articles remain readable structured files. PDFs and images remain ordinary media. Git records every revision. The public site becomes plain HTML, CSS, JavaScript, and source documents that can be deployed almost anywhere.

The included first-deploy edition is intentionally branded as **TAHAI Press** so a new repository and test deployment look finished immediately. Publisher identity remains configurable in `content/site.json` and Pages CMS. Once `template_mode` is disabled, visible project credit disappears from publication pages; the resulting site displays the publisher's own identity.

**Product principle:** **Make it easy. Make it fast. Make it accessible.**

**Project repository:** [github.com/JTAHAI/tahai-press](https://github.com/JTAHAI/tahai-press)  
**Live demo:** [tahai-press.tahai.net](https://tahai-press.tahai.net)  
**Project site:** [JTAHAI.github.io/tahai-press](https://JTAHAI.github.io/tahai-press/)  
**Developer:** [TAHAI Web Services](https://tahai.net)

---

## Contents

- [Why TAHAI Press](#why-tahai-press)
- [What ships](#what-ships)
- [Architecture](#architecture)
- [Launch Desk](#launch-desk)
- [Editorial Studio](#editorial-studio)
- [Media Desk](#media-desk)
- [Publisher Studio](#publisher-studio)
- [Accessibility Edition](#accessibility-edition)
- [Professional Desk](#professional-desk)
- [Operational Polish](#operational-polish)
- [Reader Reach](#reader-reach)
- [Quick start](#quick-start)
- [Cloudflare Pages deployment](#cloudflare-pages-deployment)
- [Pages CMS editing](#pages-cms-editing)
- [Article formats](#article-formats)
- [Newspaper reading system](#newspaper-reading-system)
- [Static daily crossword](#static-daily-crossword)
- [Migration and imports](#migration-and-imports)
- [Search, archives, feeds, and redirects](#search-archives-feeds-and-redirects)
- [Accessibility and resilience](#accessibility-and-resilience)
- [Security model](#security-model)
- [Customization](#customization)
- [Commands](#commands)
- [Repository map](#repository-map)
- [GitHub Pages project site](#github-pages-project-site)
- [Contributing and support](#contributing-and-support)
- [Credits and license](#credits-and-license)

---

## Why TAHAI Press

Traditional publishing systems often make a simple editorial need depend on a large operational stack:

- a database;
- a long-running application server;
- plugin and theme maintenance;
- authentication and password recovery;
- backup and migration procedures;
- runtime security patching;
- proprietary exports or fragile page builders.

TAHAI Press starts from a different premise:

> **The files are the publication.**

A story is a structured record. A source document is a file or durable URL. A public page is generated output. Git is the revision ledger. Cloudflare Pages or another static host is the delivery layer. Pages CMS can provide the familiar browser editor without becoming the owner of the archive.

This architecture is especially useful for:

- independent newspapers and local publications;
- community reporting projects;
- advocates publishing public records with context;
- small newsrooms without dedicated infrastructure staff;
- researchers and watchdog organizations;
- project journals, accountability archives, and case-file publications;
- publishers who want an exit path that is simply a folder of files.

---

## What ships

### Editorial publishing

- Standard written articles
- PDF-first public-record pages
- Mixed articles with written context and an embedded PDF
- External-document records with safe outbound behavior
- Authors, roles, biographies, categories, topics, coverage hubs, dates, and sources
- Draft, scheduled, published, and archived states
- Publication-review gates for attribution, rights, privacy, accessibility, and source review
- Featured stories and structured archive cards
- Browser-only Contributor Composer with live newspaper preview, JSON import/export, autosave, and up to 20 local draft copies
- Browser-only Media Desk with crop presets, focal points, JPEG/WebP compression, accessibility metadata, rights notes, and article-field export
- Structured key-points, pull-quote, fact-box, image, gallery, timeline, callout, and document blocks
- Image captions, credits, rights notes, aspect ratios, focal points, intrinsic dimensions, and accessible lightbox behavior
- News, Analysis, Opinion, Investigation, Public Record, Explainer, Interview, Announcement, and Developing labels
- Multipart series, related coverage, methodology, disclosures, update logs, correction histories, and rights statements
- Permanent article citations with local copy-citation and copy-link controls

### Reader experience

- Formal newspaper-inspired masthead and front page
- Drop caps, small-cap opening lines, measured reading widths, and typographic hierarchy
- Responsive layouts for desktop, tablet, narrow mobile, zoom, and print
- Keyboard navigation, visible focus, semantic landmarks, and skip navigation
- Search, editorial sections, multipart series, categories, topics, contributors, hubs, year archives, and month archives
- RSS, JSON Feed, sitemap, canonical URLs, Open Graph, social cards, and JSON-LD
- Embedded PDF reader with direct-open, download, full-screen, fit-width, fit-page, print, and no-JavaScript alternatives
- Local reader controls for text size, line spacing, reading measure, paper/sepia/dark/high-contrast surfaces, link underlines, reduced decoration, and reduced motion
- Simplified noindex reading routes for every article, with direct document access and no embedded PDF dependency
- Required plain-HTML summaries for published document-led stories
- CMS-managed rotating crosswords with Novice five-by-five and Expert blocked-grid modes, local progress, and print controls
- Installable same-origin offline reading for the latest edition and core publication routes
- Browser-local saved-story library with no reader account or tracking profile
- Accessible native sharing with a copy-link fallback
- Formal printable current-edition route generated from the newest published stories

### Easy setup and customization

- Persistent thirteen-step Launch Desk generated only in demo mode
- Eight contrast-tested newspaper themes
- Configurable density, reading measure, masthead alignment, headline style, panel shape, and reading surface
- CMS-editable navigation labels, destinations, and order
- CMS-editable homepage sections, order, visibility, headings, and item limits
- Automatic publication initials, short-title fallback, and plain-language copy fallbacks
- Persistent progress, one-decision screens, safe recommendations, and contextual help
- Live publication preview, undo, downloadable backup, and launch-readiness summary
- Guided first-story draft that replaces example content
- One launch package that disables demo mode, removes sample stories, and preserves a backup
- Hourly, free GitHub Actions publishing for articles marked Scheduled

### Publishing operations

- Dependency-free Node.js generator
- Pages CMS configuration
- GitHub Actions quality checks
- Cloudflare Pages build contract
- Preview-deployment indexing protection
- Content, CMS, URL, accessibility, output, and repository-cleanliness validation
- WordPress WXR, Markdown, JSON, CSV, PDF, and mixed-folder import tools
- Legacy URL preservation and Cloudflare `_redirects` generation
- Optional Cloudflare Bulk Redirect CSV export
- Deterministic build manifest and SHA-256 release proof
- Private newsroom-health dashboard generated only as a CI/build artifact
- Media inventory with missing, orphaned, duplicate, dimension, and size checks
- Performance budgets for homepage HTML, CSS, JavaScript, search, file count, and individual assets

---

## Architecture

```text
Editor
  │
  ├── Pages CMS in the browser
  └── or normal JSON / Markdown / media files
  │
  ▼
GitHub repository
  │
  ├── content/articles/*.json
  ├── content/authors/*.json
  ├── public/uploads/images/*
  ├── public/uploads/documents/*
  ├── content/crosswords/*.json
  └── complete revision and rollback history
  │
  ▼
TAHAI Press build
  │
  ├── validate content, CMS configuration, crosswords, and redirects
  ├── test article templates, search, redirects, PDFs, crosswords, and accessibility
  ├── audit media references and enforce performance budgets
  ├── generate routes, feeds, social metadata, search index, and redirects
  └── verify deployment boundaries and produce optional release proof
  │
  ▼
Cloudflare Pages
  │
  └── static HTML, CSS, JavaScript, images, and PDFs
```

No public article request depends on an application database. No reader query is sent to a third-party search service. Crosswords, reader preferences, and saved-story lists remain local to the reader's browser. The optional service worker caches only same-origin publication routes and assets.

---

## Launch Desk

Deploy the template once, then open:

```text
https://example.pages.dev/setup/
```

TAHAI Press v3 replaces the long configuration form with a persistent thirteen-step first-day newsroom guide. It is designed for a publisher who should not need to understand JSON, repository layout, build systems, or deployment terminology.

Launch Desk walks through:

1. the complete ten-minute launch path;
2. publication name, live address, and public contact;
3. one contrast-tested newspaper appearance;
4. a constrained front page and clear navigation;
5. the existing GitHub, Pages CMS, and Cloudflare connection;
6. a first-story draft created by replacing useful example text;
7. backup, final preview, demonstration removal, and launch.

Progress remains in local browser storage. Every step has one primary action, recommended settings, plain-language explanations, contextual help, and a live preview. The most recent change can be undone. A pre-launch backup can be downloaded before anything is replaced.

The final action creates `tahai-press-launch-package.json`. Apply it from the repository with:

```bash
npm run launch:apply -- --package tahai-press-launch-package.json --confirm
```

Chrome and Edge can also apply the package directly after the publisher selects the local repository folder. The browser first writes a backup under `.launch-backups/`, removes the four sample stories, writes the finished `content/site.json`, creates the first article as a Draft, and updates the generic editorial-team author record. Browsers without secure folder access use the download-and-command path.

The setup route is excluded from the sitemap and disappears automatically when `template_mode` is disabled. Publisher-facing pages then show only the publisher's identity.

See [docs/LAUNCH-DESK.md](docs/LAUNCH-DESK.md) and [docs/EASY-SETUP.md](docs/EASY-SETUP.md).

---

## Writer Desk / Editorial Studio

Open the browser-only quick composer at:

```text
https://example.pages.dev/studio/
```

Writer Desk is designed for a contributor or editor who should not need to understand JSON, Markdown front matter, or repository structure. It keeps the current draft in local browser storage, can retain up to 20 named local draft copies, opens an existing article JSON file for revision, previews the newspaper presentation as the editor types, checks common accessibility and publishing issues, and exports a ready-to-review contributor package. No draft text, image, or publication detail is uploaded to TAHAI Press or another service.

The Quick Story surface asks only for the fields most articles need:

- headline;
- summary;
- article text;
- author;
- category;
- optional featured image with description, caption, and credit;
- optional kicker, date, and tags.

Pages CMS remains the full editorial desk. Its article editor now includes structured newspaper blocks for key points, pull quotes, fact boxes, inline images, accessible galleries, timelines, callouts, and document cards. Published and scheduled stories are blocked when required image descriptions or release-review confirmations are missing.

To schedule a story, select **Scheduled**, choose a future publication time, and save. The included hourly GitHub Actions workflow changes due entries to **Published**, validates the repository, and commits only the affected article files. No paid scheduler or additional account is required.

See [docs/CONTRIBUTOR-COMPOSER.md](docs/CONTRIBUTOR-COMPOSER.md), [docs/EDITORIAL-STUDIO.md](docs/EDITORIAL-STUDIO.md), and [docs/EDITOR-WORKFLOW.md](docs/EDITOR-WORKFLOW.md).

---

## Media Desk

Open the browser-only image workspace at:

```text
https://example.pages.dev/media-desk/
```

TAHAI Press v2.2 expands Media Desk into a fuller media pipeline for editors who need publication-ready files without adding an image service, media database, upload account, or desktop-only dependency.

Media Desk accepts JPEG, PNG, and WebP source files and provides:

- Original, Feature, Article landscape, Social card, Square card, and Portrait card presets;
- click, keyboard, slider, and Top/Left/Center/Right/Bottom focal-point controls;
- rule-of-thirds crop preview;
- WebP and JPEG export with adjustable compression quality;
- estimated output size before download;
- required image descriptions plus caption, creator/source credit, and rights or reuse notes;
- readiness checks for missing metadata, substantial upscaling, and aggressive compression;
- PNG, WebP, JPEG, and browser-supported AVIF export;
- a downloadable media manifest with source, crop, output, accessibility, credit, rights, and usage details;
- a visual library view of current uploads and their references;
- ready-to-paste TAHAI Press featured-image fields.

The selected image and its editorial metadata remain in browser memory. No image is uploaded, no remote URL is fetched, and no description, caption, credit, or rights note is stored in local storage. Only the last preset, format, and quality preference may be remembered on that device.

After export, place the optimized file in `public/uploads/images/`, then paste the generated article fields into Editorial Studio, Pages CMS, or an article JSON record. Media Desk does not publish automatically or mark editorial review complete. The static build can emit responsive deploy-time variants and a private media asset manifest from those uploads.

See [docs/MEDIA-DESK.md](docs/MEDIA-DESK.md).

---


## Publisher Studio

TAHAI Press v2 groups the publishing workflow behind one private, noindex command center at `/publisher/`.

- **Contributor Composer** remains the local-first writing and article-package desk.
- **Media Desk** remains the local crop, compression, rights, credit, and accessibility-metadata desk.
- **Launch Desk** remains the guided publication setup path while demo mode is enabled.
- **Git Draft Desk** is an optional Sveltia CMS 0.164.2 bridge at `/admin/`.

The Git Draft Desk is intentionally narrower than Pages CMS in v2.0. It creates and edits JSON drafts only in `content/inbox/`; it cannot rewrite production articles or the complete site configuration. Promote an approved inbox item from the repository with:

```bash
npm run newsroom:promote -- --file content/inbox/story-slug.json
```

The command validates required fields, normalizes the record, refuses an existing destination unless `--force` is supplied, and always promotes the article with `status: "draft"`.

Set a reusable repository or branch at build time when the package metadata is not the desired target:

```bash
TAHAI_PRESS_CMS_REPO=owner/publication TAHAI_PRESS_CMS_BRANCH=main npm run build
```

The optional editor bundle is pinned rather than loaded from an unversioned channel. The public reader does not load it. See `docs/FOSS-FOUNDATION.md`, `docs/V2-ROADMAP.md`, and `THIRD_PARTY_NOTICES.md`.


## Accessibility Edition

The Accessibility Edition introduced in TAHAI Press v1.4 places accessibility assistance at three layers: the editor, the build, and the reader. The goal is to prevent common barriers before publication while giving readers useful controls without an account, cookie banner, analytics service, or server-side preference store.

### Reader tools

When enabled in publication settings, every public reading surface includes a native disclosure labeled **Reading tools**. Preferences remain in that browser only and include:

- smaller, default, or larger text;
- normal, relaxed, or open line spacing;
- narrow, standard, or wide reading measure;
- publication, paper, sepia, dark, or high-contrast surfaces;
- persistent link underlines;
- reduced visual decoration;
- reduced motion;
- one-action reset.

The controls use ordinary HTML and local storage. The article remains readable when JavaScript is disabled.

### Simplified reading view

Every public article has a **Simplified view** at `/stories/<slug>/reader/`. The route removes nonessential publication furniture, does not embed PDFs, preserves article text and structured reporting blocks, and provides direct document links. Simplified routes are deliberately `noindex` and canonicalize to the standard article so they improve access without splitting search identity.

### Document accessibility

Published and scheduled PDF, mixed, and external-document articles require both a plain-language document description and a substantial HTML summary. A source PDF may still be inaccessible, but the surrounding article no longer depends on the native PDF viewer to communicate the record’s purpose and key content.

### Editor guidance and automated proof

Writer Desk separates **Ready**, **Needs attention**, and **Publication blocker** findings. It checks image descriptions, heading order, vague or empty links, conflicting link labels, long headings and paragraphs, likely table-header problems, unexplained abbreviations, and all-capital headlines before export. The release build then audits every generated route plus the reader-tools and simplified-view contracts.

See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md), [docs/EDITORIAL-STUDIO.md](docs/EDITORIAL-STUDIO.md), and [docs/PDF-READER.md](docs/PDF-READER.md).

---

## Professional Desk

TAHAI Press v1.5 adds the publication signals readers expect from a serious newsroom without adding a database, a custom account system, or a hosted editorial service.

### Clear article classifications

Every released article has one visible editorial classification:

- **News** for verified reporting about events and decisions;
- **Analysis** for evidence-based interpretation;
- **Opinion** for a clearly labeled viewpoint;
- **Investigation** for sustained original reporting;
- **Public Record** for source-centered documents and filings;
- **Explainer** for reader-focused background and guidance;
- **Interview** for conversation-led publishing;
- **Announcement** for clearly identified notices;
- **Developing** for active stories that may change as information is verified.

The label appears on article cards and story pages, is available to static search and structured data, and links to a generated section front under `/sections/`. Labels are text, not color-only signals.

### Series and continuing coverage

Articles can share a series slug, title, description, and reading-order number. The build creates a permanent series front under `/series/<slug>/`, validates that names remain consistent, and rejects duplicate installment positions. Series work well for investigations, case files, multipart explainers, recurring public-record collections, and long-running local issues.

### Trust and correction record

Pages CMS exposes plain-language fields for:

- reporting methodology;
- disclosure and reader context;
- article-specific rights and reuse guidance;
- a short **What changed** summary;
- chronological update history;
- explicit correction history;
- selected related coverage.

These sections remain ordinary semantic HTML and stay readable without JavaScript. The copy-citation and copy-link buttons are optional progressive enhancements over visible citation text and make no network request.

See [docs/PROFESSIONAL-DESK.md](docs/PROFESSIONAL-DESK.md), [docs/CONTENT-MODEL.md](docs/CONTENT-MODEL.md), and [docs/EDITOR-WORKFLOW.md](docs/EDITOR-WORKFLOW.md).

---

## Operational Polish

TAHAI Press v1.6 adds a private operational desk without creating a public admin application or another account.

### Newsroom health

`npm run newsroom:health` writes a private HTML dashboard and machine-readable report under `.artifacts/newsroom-health/`. It summarizes published, draft, scheduled, and archived work; redirect count; launch state; media warnings; performance budgets; due scheduled stories; stale entries; and articles that may need stronger related coverage. The dashboard is never copied into `dist/`.

### Media health

`npm run audit:media` inventories `public/uploads/` and reports:

- missing referenced files;
- unused uploads;
- exact duplicate files by SHA-256;
- image dimensions where the format can be read safely;
- files above the recommended image and document sizes;
- files approaching Cloudflare Pages' individual-asset ceiling.

The strict deployment contract blocks missing uploads and oversized public assets while leaving ordinary cleanup guidance visible as a private report.

### Performance budgets

`npm run audit:performance` protects the simple, fast baseline with explicit limits for homepage HTML, the main stylesheet, total JavaScript, the search index, generated file count, and the largest individual asset. Budgets live in `content/site.json` under `operations.performance_budgets` and can be adjusted deliberately instead of allowing unnoticed growth.

### Contributor Composer

The browser-only studio can now open an existing TAHAI Press article JSON file, keep up to 20 local draft copies, and export a clean contributor package. Drafts remain in that browser. No account, network request, database, or hosted writing service is introduced.

### CMS-managed crossword desk

Puzzle records now live in `content/crosswords/`, are editable in Pages CMS, and are validated before build. Editors can control difficulty, rotation order, black-square grids, and clues. The public crossword remains static JavaScript with local progress and a print control.

See [docs/OPERATIONS.md](docs/OPERATIONS.md), [docs/CONTRIBUTOR-COMPOSER.md](docs/CONTRIBUTOR-COMPOSER.md), and [docs/CROSSWORD.md](docs/CROSSWORD.md).

---

## Reader Reach

TAHAI Press v1.7 extends a static publication beyond the first page view without introducing reader accounts, analytics, or a hosted backend.

### Offline and installable

When enabled, the build generates a same-origin service worker and an installable web app manifest. The publication home, current edition, search, crossword desk, core scripts, and a configurable number of recent articles are cached after a successful visit. Navigation uses the network when available and falls back to cached pages or `/offline/` when disconnected.

### Saved stories

Every article can expose a **Save story** control. The browser stores up to 100 story records in local storage and displays them at `/saved/`. Readers can remove one story or clear the entire list. Nothing is sent to the publisher, and no login is required.

### Accessible sharing

A **Share** control uses the browser's native share sheet when available. Browsers without that API receive a copy-link fallback and an announced status message. The underlying article link remains ordinary HTML and works without JavaScript.

### Current edition

`/edition/` creates a formal, printable front-to-back list of the newest published work. Editors choose the number of stories through Pages CMS or `content/site.json`. The route remains normal static HTML and prints without site navigation or interactive controls.

All Reader Reach features are optional under `reader_reach` in `content/site.json`. Publisher-mode manifests use the publisher's logo or a neutral favicon rather than TAHAI Press demonstration icons.

See [docs/READER-REACH.md](docs/READER-REACH.md).

---

## Quick start

### Requirements

- Git
- Node.js 22 or newer
- No npm dependencies are required for the generator itself

### Clone and prove the repository

```bash
git clone https://github.com/JTAHAI/tahai-press.git
cd tahai-press
npm run ci
```

The command validates the content model and Pages CMS file, runs the test suite, builds `dist/`, audits generated accessibility and reader behavior, inventories media, enforces performance budgets, writes a private newsroom-health dashboard, verifies the distribution, starts an HTTP smoke proof, and creates a SHA-256 release manifest under `.artifacts/`.

### Preview locally

```bash
npm run preview
```

Open:

```text
http://localhost:8788
```

### First files to edit

```text
content/site.json
content/articles/
content/authors/
content/categories/
content/hubs/
content/crosswords/
public/uploads/images/
public/uploads/documents/
```

The sample deployment stays blocked from indexing while `template_mode` is `true`.

---

## Cloudflare Pages deployment

Every cumulative release now includes a `tahai-press_vX.Y.Z_cloudflare-deploy.zip` whose archive root is directly uploadable to Cloudflare Pages. Build the same package locally with `deployment/package-cloudflare-direct-upload.ps1` on Windows or `deployment/package-cloudflare-direct-upload.sh` on Linux/WSL.

Connect the GitHub repository to Cloudflare Pages with these settings:

```text
Framework preset: None
Production branch: main
Build command: npm run build:cloudflare
Build output directory: dist
Root directory: .
Node version: 22
```

The build command validates and tests before writing the deployable site. Cloudflare branch previews remain blocked from indexing, and the sample first-deploy edition is also blocked while template mode is active.

Before a real publication launch:

1. Replace the sample publication name, description, URL, email, logo, and social image.
2. Remove or rewrite sample articles.
3. Review categories, contributors, hubs, submission guidance, and editorial standards.
4. Set the final HTTPS `site_url`.
5. Set `template_mode` to `false`.
6. Run `npm run ci`.
7. Inspect a Cloudflare preview.
8. Merge to the production branch.

See [docs/DEPLOYMENT-AUTOMATION.md](docs/DEPLOYMENT-AUTOMATION.md) and [docs/RELEASE-RUNBOOK.md](docs/RELEASE-RUNBOOK.md).

---

## Pages CMS editing

The root `.pages.yml` defines a browser-based editorial desk designed to put the common choices first and advanced controls later:

- articles;
- contributors;
- categories;
- coverage hubs;
- CMS-managed novice and expert crosswords;
- quick publication identity and launch settings;
- accessible newspaper theme presets;
- advanced custom colors;
- homepage section order and visibility;
- navigation labels, destinations, and order;
- accessibility settings;
- search and archive limits;
- manual redirects;
- separate image and PDF media libraries.

Pages CMS commits changes directly to GitHub. It does not require a separate publication database.

### Typical editor workflow

1. Sign in to Pages CMS with GitHub.
2. Choose **Articles**.
3. Create a draft.
4. Choose the article format.
5. Add the headline, summary, author, category, and context.
6. Add structured story blocks, a PDF, or featured media when useful.
7. Describe every meaningful image and add caption, credit, or rights notes when applicable.
8. Complete the publication-review fields.
9. Change the status to **Published** or **Scheduled**.
10. Save the commit and review the Cloudflare preview or production deployment.

Draft, future scheduled, and archived content are excluded from the public site and search index. Due scheduled entries become public only after the included publishing workflow changes their status to Published.

See [docs/PAGES-CMS.md](docs/PAGES-CMS.md) and [docs/EDITOR-WORKFLOW.md](docs/EDITOR-WORKFLOW.md).

---

## Article formats

### Written article

Use for reporting, commentary, explainers, interviews, updates, and other text-led publishing.

```json
{
  "title": "A clear public headline",
  "slug": "a-clear-public-headline",
  "status": "published",
  "article_type": "standard",
  "excerpt": "A plain-language summary for the front page and archives.",
  "body": "The article body is written in Markdown."
}
```

### PDF-first record

Use when the source document is the main public artifact. The PDF reader appears before optional written notes.

### Mixed article and PDF

Use when context and reporting should be read before the original supporting document.

### External document

Use when a document must remain on another trusted site. TAHAI Press presents a safe outbound card rather than assuming third-party iframe support.

### Structured editorial blocks

Standard and mixed articles can combine ordinary Markdown with reusable newsroom blocks:

- key points;
- pull quote;
- fact box;
- inline image;
- accessible image gallery;
- timeline;
- informational, important, or warning callout;
- source-document card.

Each image supports a required reader description plus optional caption, credit, rights note, aspect treatment, and focal point. The build reads local image dimensions and writes intrinsic width and height attributes to reduce layout shift. Galleries remain useful without JavaScript; the script adds a keyboard-operable dialog lightbox as progressive enhancement.

The full schema is documented in [docs/CONTENT-MODEL.md](docs/CONTENT-MODEL.md).

---

## Newspaper reading system

The default first-deploy edition uses the supplied TAHAI Press newspaper mark and a formal print-inspired visual system:

- centered masthead with edition folios;
- double rules and restrained newsprint textures;
- large serif headlines with balanced wrapping;
- drop caps on opening article paragraphs;
- small-cap opening lines;
- readable line lengths and generous leading;
- hanging punctuation and hyphenation where supported;
- editorial decks, bylines, facts, source lists, and document metadata;
- high-contrast interactive controls;
- print styles that remove navigation and application controls.

All publication-facing identity is configured through `content/site.json`. The visible TAHAI Press repository and developer links are limited to the sample template edition. Disable template mode for a publisher-only public surface.

See [docs/BRANDING.md](docs/BRANDING.md).

---

## Static daily crossword

TAHAI Press includes a small press-break feature at:

```text
/puzzles/
```

The crossword is deliberately local, durable, and more substantial than a decorative widget:

- a **Novice** mode with seven hand-set five-by-five word-square editions;
- an **Expert** mode with multiple fifteen-by-fifteen blocked grids and longer newsroom-themed entries;
- automatic daily rotation within each difficulty;
- an explicit Novice/Expert toggle and a **Next puzzle** control;
- black squares, numbered entries, clickable clues, and direction-aware keyboard movement;
- arrow-key navigation, Space to switch direction, and backspace movement;
- check, reveal, reset, next-edition, and print controls;
- accessible labels and live status messages;
- local browser storage for progress;
- no account, database, API, analytics request, or puzzle provider.

Puzzle records live in `content/crosswords/*.json`, where Pages CMS can edit them. The local player lives in `public/assets/crossword.js`, and the build emits a sanitized `assets/crosswords.json` data file plus an embedded copy on the puzzle page. Publishers can replace the included puzzle set or remove the route and navigation item.

See [docs/CROSSWORD.md](docs/CROSSWORD.md).

---

## Migration and imports

The local importer supports:

- WordPress WXR/XML exports;
- Markdown files;
- JSON article arrays;
- CSV article tables;
- individual PDF files;
- recursive folders containing PDFs and supported content files.

Start with a dry run:

```bash
npm run import -- --input imports/inbox --dry-run
```

Normal imports are conservative:

- articles start as drafts;
- imported records are blocked from indexing;
- publication-review switches remain off;
- collisions are skipped unless an explicit strategy is chosen;
- PDF signatures are verified;
- stable content hashes are recorded;
- original WordPress paths are retained as legacy URL candidates;
- remote sites and remote media are not scraped automatically.
- completed imports retain a private, byte-checked rollback transaction; failed records are quarantined for review.

See [docs/MIGRATION-IMPORTS.md](docs/MIGRATION-IMPORTS.md).

---

## Search, archives, feeds, and redirects

TAHAI Press generates discovery at build time:

- full-site browser search;
- categories;
- topics generated from tags;
- contributor archives;
- coverage-hub archives;
- year and month archives;
- paginated story archives;
- RSS feed;
- JSON Feed;
- XML sitemap;
- Open Graph and social metadata;
- canonical URLs;
- JSON-LD for publication and article pages.

Article records can retain former paths in `legacy_urls`. The build combines these with controlled manual redirects and rejects:

- duplicate sources;
- self-redirects;
- chains;
- loops;
- collisions with live routes or assets;
- unsafe wildcards and placeholders;
- missing internal destinations;
- rule-count overflow.

See [docs/SEARCH-AND-ARCHIVES.md](docs/SEARCH-AND-ARCHIVES.md), [docs/SEO-SOCIAL.md](docs/SEO-SOCIAL.md), and [docs/URL-REDIRECTS.md](docs/URL-REDIRECTS.md).

---

## Accessibility and resilience

The generator and public templates include:

- semantic landmarks and one primary heading per page;
- skip navigation and strong visible focus;
- keyboard-operable navigation, search, PDF controls, galleries, reading tools, and crossword controls;
- minimum target sizing and layouts tested for narrow screens and high zoom;
- alternative-text enforcement for meaningful images;
- readable contrast validation for configurable themes;
- reduced-motion, increased-contrast, and forced-color support;
- browser-local reader preferences with no account or tracking;
- simplified article routes that remain useful without embedded media;
- required HTML summaries for released document-led stories;
- direct open and download alternatives to embedded PDFs;
- editor-side Ready, Needs attention, and Publication blocker guidance;
- generated-page and reader-experience accessibility audits;
- a configurable publisher accessibility statement and feedback address.

Accessibility remains a continuing editorial responsibility. Publishers should remediate documents they control, describe images meaningfully, use headings and tables correctly, provide transcripts for time-based media, and test real content with keyboard navigation, browser zoom, and assistive technology.

See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

---

## Security model

TAHAI Press reduces the public attack surface by generating static files. That does not remove the need for disciplined repository and account security.

Recommended controls:

- require multi-factor authentication for GitHub and Cloudflare;
- protect the production branch;
- require green GitHub Actions checks before merge;
- limit repository write access;
- review Pages CMS access;
- never commit secrets or private source material;
- treat public uploads as immediately publishable once merged;
- review rights, privacy, redaction, and accessibility before publication;
- use Cloudflare R2 or another deliberate document store for files beyond static-host limits;
- verify rollback procedures before a high-risk release.

TAHAI Press scans generated output for common secret patterns and private editor notes. It cannot determine whether a document is legally or ethically appropriate to publish.

See [SECURITY.md](SECURITY.md).

---

## Customization

### Publication identity

Edit `content/site.json` or use Pages CMS:

```json
{
  "title": "Your Publication",
  "short_title": "Your Publication",
  "tagline": "A clear public promise.",
  "site_url": "https://news.example.org",
  "editor_email": "editor@example.org",
  "logo": "/uploads/images/logo.png",
  "default_social_image": "/uploads/images/social-card.png",
  "template_mode": false
}
```

### Theme

Nine six-digit colors control the public system:

- `brand`
- `brand_deep`
- `brand_soft`
- `accent`
- `accent_dark`
- `highlight`
- `surface`
- `surface_deep`
- `paper`

The build rejects key color combinations that fail required contrast thresholds.

### Navigation and routes

Primary navigation and homepage section order live in `content/site.json` and are editable through Pages CMS or the guided setup assistant. Route templates remain generated by `scripts/build.mjs`; public style and interactive behavior live in `public/assets/`.

### Sample content

The records under `content/articles/` demonstrate every supported article format. Replace or remove them before production launch.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run clean` | Remove generated output and audit artifacts |
| `npm run validate` | Validate content, Pages CMS, and redirects |
| `npm test` | Run the complete Node test suite |
| `npm run build` | Generate the static site in `dist/` |
| `npm run build:cloudflare` | Run the Cloudflare deployment build contract |
| `npm run audit:a11y` | Audit generated HTML and write an ignored report |
| `npm run audit:reader` | Verify reader tools, simplified views, document summaries, target sizing, and zoom resilience |
| `npm run audit:media` | Inventory uploads and report missing, unused, duplicate, oversized, or unreadable media |
| `npm run audit:performance` | Enforce static output performance budgets |
| `npm run newsroom:health` | Generate the private newsroom-health dashboard under `.artifacts/` |
| `npm run verify:dist` | Verify routes, metadata, files, indexing rules, and leakage boundaries |
| `npm run smoke` | Serve and test the generated site over HTTP |
| `npm run preview` | Start the local preview server on port 8788 |
| `npm run release:proof` | Create SHA-256 deployment proof under `.artifacts/` |
| `npm run repo:check` | Reject retired branding, pass-era debris, or missing public-repository files |
| `npm run check` | Clean, validate, test, build, audit, verify, and inspect the repository |
| `npm run ci` | Run the full release proof |
| `npm run launch:apply -- --package <file> --confirm` | Apply a Launch Desk package, preserve a local backup, remove sample stories, and create the first draft |
| `npm run setup:clear-demo -- --confirm` | Remove demonstration content and reset to a neutral indexing-blocked identity |
| `npm run publish:due -- --write` | Publish scheduled articles whose publication time has arrived |
| `npm run import:help` | Show migration importer options |
| `npm run redirects:bulk` | Export Cloudflare Bulk Redirect CSV data |

---

## Repository map

```text
.github/
  ISSUE_TEMPLATE/          Public issue forms
  workflows/               Quality, production, scheduled publishing, and GitHub Pages workflows
content/
  articles/                Structured article records
  authors/                 Contributor records
  categories/              Broad editorial lanes
  hubs/                    Recurring coverage desks
  crosswords/              CMS-managed novice and expert puzzle records
  redirects.json           Manual static redirects
  site.json                Publication identity and settings
deployment/
  cloudflare-pages.json    Deployment contract reference
docs/                      Operator and publisher documentation
github-pages/              Formal project landing page for GitHub Pages
imports/
  inbox/                   Local migration source area
  reports/                 Local importer reports
public/
  assets/                  Public CSS, JavaScript, logo, icons, and social image
  uploads/documents/       Local public PDFs
  uploads/images/          Public editorial images
schemas/                   JSON Schema
scripts/                   Generator, Launch Desk applicator, validators, contributor tools, media/performance audits, newsroom dashboard, scheduling, importers, smoke tests, and proof tools
tests/                     Node test suite
.pages.yml                 Pages CMS editorial configuration
package.json               Commands and project metadata
```

Generated directories such as `dist/` and `.artifacts/` are ignored and are not part of a clean source checkout.

---

## GitHub Pages project site

The formal project landing page lives in:

```text
github-pages/
```

The `GitHub Pages` workflow deploys this directory when it changes on `main`.

Repository settings must use **GitHub Actions** as the Pages source. The resulting project site is expected at:

```text
https://JTAHAI.github.io/tahai-press/
```

The GitHub Pages site describes TAHAI Press itself. It is separate from the Cloudflare Pages publication demo generated into `dist/`.

---

## Contributing and support

Contributions are welcome when they preserve the project's core principles:

- publisher ownership;
- static-first delivery;
- accessibility and readability;
- source-document resilience;
- safe defaults;
- transparent generated output;
- minimal operational burden.

Read:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)
- [SUPPORT.md](SUPPORT.md)

Use [GitHub Issues](https://github.com/JTAHAI/tahai-press/issues) for reproducible defects and focused feature proposals.

---

## Credits and license

**TAHAI Press** was created by **Justin Tahai and TAHAI Web Services**.

Developer site: [https://tahai.net](https://tahai.net)  
Repository: [https://github.com/JTAHAI/tahai-press](https://github.com/JTAHAI/tahai-press)

Released under the [Apache License, Version 2.0](LICENSE). See also [NOTICE](NOTICE).

The license governs use and redistribution of the software source. When redistributing TAHAI Press or a modified source distribution, retain the license and required notices and identify material changes as Apache 2.0 requires.

**TAHAI Press does not require any public-facing platform attribution on a publisher's website.** Publishers do not need to display a banner, “Powered by” line, footer credit, TAHAI Press logo, backlink, hidden link, or other visible project branding on sites generated with the software. Repository and source-distribution obligations remain in the source where they belong.

The TAHAI Press name and supplied project artwork identify the upstream project. Forks may replace the visible first-deploy publication identity with the publisher's own branding through the included configuration.
