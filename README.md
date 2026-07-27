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
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-123a5a"></a>
  <img alt="Node 22" src="https://img.shields.io/badge/Node.js-22%2B-123a5a">
  <img alt="Database free" src="https://img.shields.io/badge/database-none-061b2d">
  <img alt="Static first" src="https://img.shields.io/badge/output-static_HTML-345f7f">
</p>

---

## The front page

TAHAI Press is a complete static publishing platform presented with the formality and readability of a newspaper.

It gives independent publishers a serious editorial surface without requiring a WordPress runtime, application server, proprietary CMS database, or permanent technical caretaker. Articles remain readable structured files. PDFs and images remain ordinary media. Git records every revision. The public site becomes plain HTML, CSS, JavaScript, and source documents that can be deployed almost anywhere.

The included first-deploy edition is intentionally branded as **TAHAI Press** so a new repository and test deployment look finished immediately. Publisher identity remains configurable in `content/site.json` and Pages CMS. Once `template_mode` is disabled, visible project credit disappears from publication pages; the resulting site displays the publisher's own identity.

**Project repository:** [github.com/JTAHAI/tahai-press](https://github.com/JTAHAI/tahai-press)  
**Project site:** [JTAHAI.github.io/tahai-press](https://JTAHAI.github.io/tahai-press/)  
**Developer:** [TAHAI Web Services](https://tahai.net)

---

## Contents

- [Why TAHAI Press](#why-tahai-press)
- [What ships](#what-ships)
- [Architecture](#architecture)
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
- Draft, published, and archived states
- Publication-review gates for attribution, rights, privacy, accessibility, and source review
- Featured stories and structured archive cards

### Reader experience

- Formal newspaper-inspired masthead and front page
- Drop caps, small-cap opening lines, measured reading widths, and typographic hierarchy
- Responsive layouts for desktop, tablet, narrow mobile, zoom, and print
- Keyboard navigation, visible focus, semantic landmarks, and skip navigation
- Search, categories, topics, contributors, hubs, year archives, and month archives
- RSS, JSON Feed, sitemap, canonical URLs, Open Graph, social cards, and JSON-LD
- Embedded PDF reader with direct-open, download, full-screen, fit-width, fit-page, print, and no-JavaScript alternatives
- A rotating static five-by-five daily crossword

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
  └── complete revision and rollback history
  │
  ▼
TAHAI Press build
  │
  ├── validate content and CMS configuration
  ├── test article templates, search, redirects, PDFs, and accessibility
  ├── generate routes, feeds, social metadata, search index, and redirects
  └── verify deployment boundaries and produce optional release proof
  │
  ▼
Cloudflare Pages
  │
  └── static HTML, CSS, JavaScript, images, and PDFs
```

No public article request depends on an application database. No reader query is sent to a third-party search service. The crossword rotates and stores progress locally in the reader's browser.

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

The command validates the content model and Pages CMS file, runs the test suite, builds `dist/`, audits generated accessibility, verifies the distribution, starts an HTTP smoke proof, and creates a SHA-256 release manifest under `.artifacts/`.

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
public/uploads/images/
public/uploads/documents/
```

The sample deployment stays blocked from indexing while `template_mode` is `true`.

---

## Cloudflare Pages deployment

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

The root `.pages.yml` defines a browser-based editorial desk for:

- articles;
- contributors;
- categories;
- coverage hubs;
- publication identity;
- theme colors;
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
6. Drag in a PDF or featured image when required.
7. Complete the publication-review fields.
8. Change the status to **Published**.
9. Save the commit.
10. Review the Cloudflare preview or production deployment.

Draft and archived content are excluded from the public site and search index.

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

The crossword is deliberately simple and durable:

- seven hand-set five-by-five word-square editions;
- automatic daily rotation based on the date;
- a **Next puzzle** control for testing every edition;
- keyboard navigation with arrow keys and backspace;
- check, reveal, and reset controls;
- accessible labels and live status messages;
- local browser storage for progress;
- no account, database, API, analytics request, or puzzle provider.

The puzzle data and behavior live in:

```text
public/assets/crossword.js
```

Publishers can replace the included puzzle set or remove the route and navigation item.

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
npm run import -- --source imports/inbox --dry-run
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
- skip navigation;
- keyboard-operable navigation, search, PDF controls, and crossword controls;
- strong visible focus indicators;
- minimum touch-target sizing;
- alternative text enforcement for meaningful images;
- readable contrast validation for configurable theme colors;
- reduced-motion support;
- increased-contrast and forced-color support;
- narrow-width and zoom resilience;
- direct alternatives to embedded PDFs;
- generated-page accessibility auditing;
- a configurable publisher accessibility statement.

Accessibility is a continuing editorial responsibility. Publishers should remediate documents they control, describe images meaningfully, use headings in order, and test real content with the readers and technologies they expect to serve.

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

Primary navigation and route templates live in `scripts/build.mjs`. Public style and interactive behavior live in `public/assets/`.

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
| `npm run verify:dist` | Verify routes, metadata, files, indexing rules, and leakage boundaries |
| `npm run smoke` | Serve and test the generated site over HTTP |
| `npm run preview` | Start the local preview server on port 8788 |
| `npm run release:proof` | Create SHA-256 deployment proof under `.artifacts/` |
| `npm run repo:check` | Reject retired branding, pass-era debris, or missing public-repository files |
| `npm run check` | Clean, validate, test, build, audit, verify, and inspect the repository |
| `npm run ci` | Run the full release proof |
| `npm run import:help` | Show migration importer options |
| `npm run redirects:bulk` | Export Cloudflare Bulk Redirect CSV data |

---

## Repository map

```text
.github/
  ISSUE_TEMPLATE/          Public issue forms
  workflows/               Quality, production, and GitHub Pages workflows
content/
  articles/                Structured article records
  authors/                 Contributor records
  categories/              Broad editorial lanes
  hubs/                    Recurring coverage desks
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
scripts/                   Generator, validators, importers, smoke tests, and proof tools
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

Released under the [MIT License](LICENSE).

The TAHAI Press name and supplied project artwork identify the upstream project. Forks may replace the visible first-deploy publication identity with the publisher's own branding through the included configuration.
