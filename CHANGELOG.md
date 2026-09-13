# Changelog

## 3.0.0-alpha.1 — Independent Press Baseline

- Established the v3 development line on a clean sibling worktree from `origin/main`.
- Moved navigation grouping into the authoritative renderer and removed the post-build HTML hardener.
- Locked GitHub Actions to manual dispatch-only workflows and added workflow-trigger audit coverage.
- Advanced the repository version identity to `3.0.0-alpha.1` while preserving the historical release record below.

## 2.3.0 — Publishing Console

- Added a schema-safe Publishing Console route for site structure, article workflow, collections, and release review.
- Added draft/review/scheduled/published/corrected/archived workflow support with diff, conflict, and handoff checks.
- Added structured footer-link rendering and homepage console promotion in the generated public shell.
- Added console tests and updated the release copy, roadmap, and editorial handoff docs to the v2.3.0 release line.

## 2.2.1 — Media Pipeline Hardened

- Replaced the width-suffixed placeholder copies with real resized responsive derivatives.
- Added dimension verification, byte-identity checks, and build-time responsive-image proof.
- Added async near-duplicate media reporting and removed runtime Node version drift from public build metadata.
- Extended Media Desk with zoom, rotation, undo, decorative-image handling, and safer format fallback behavior.

## 2.2.0 — Media Pipeline

- Expanded Media Desk with PNG and conditional AVIF export, responsive image handoff, and a visual media-library panel.
- Added build-time media variant generation for deploy output, plus a private media asset manifest beneath `/.well-known/`.
- Wired article rendering to emit responsive image markup for local uploads when responsive variants are available.
- Updated media audits, release labels, and supporting documentation for the v2.2 pipeline pass.

## 2.1.0 — Writer Desk

- Replaced the textarea-only drafting lane with a TAHAI-owned rich Markdown workspace while preserving plain Markdown and article JSON.
- Added formatting controls, keyboard command palette, slash commands, structured story directives, source-desk export, focus mode, and browser-local revision snapshots.
- Added conservative HTML paste cleanup for Word, Google Docs, email, and web content without a network request or proprietary editor format.
- Refactored the Writer Desk overview, form, and preview grids to prevent orphaned single-word columns at laptop widths and collapse earlier on constrained viewports.
- Added responsive regression coverage for the 1280 × 853 demo viewport and narrower tablet/mobile layouts.

All notable public releases of TAHAI Press are recorded here.

## 2.0.0 - 2026-07-29

### Added

- Unified, noindex Publisher Studio command center at `/publisher/`
- Optional Sveltia CMS 0.164.2 Git Draft Desk at `/admin/`
- Safe `content/inbox/` intake boundary that cannot silently rewrite production articles
- `npm run newsroom:promote -- --file content/inbox/<slug>.json` normalization and promotion command
- Repository and branch overrides through `TAHAI_PRESS_CMS_REPO` and `TAHAI_PRESS_CMS_BRANCH`
- Permissive-FOSS adoption policy, third-party notice ledger, and v2 better-than-WordPress roadmap
- Windows and Linux/WSL Cloudflare Pages direct-upload packaging scripts
- Generated Git CMS configuration and build metadata

### Changed

- Package version advanced to 2.0.0
- Publisher operations are now grouped behind one newsroom doorway while preserving Pages CMS, local Composer, Media Desk, and static-first deployment
- Every planned pass now includes both clean-source and Cloudflare direct-upload release ZIPs

### Security and resilience

- Git-backed drafts are isolated from `content/articles/` until explicit validation and promotion
- Promotion refuses overwrite by default and always preserves draft status
- Optional CMS code is pinned to an exact reviewed version and kept out of the public reader bundle
- Production pages remain fully static and readable when the optional Git editor is unavailable

## 1.9.0 - 2026-07-28

### Media Desk

- Added a private browser-only Media Desk at `/media-desk/` for local image preparation
- Added Original, Feature, Article landscape, Social card, Square card, and Portrait card publishing presets
- Added click, keyboard, slider, and named focal-point controls with a rule-of-thirds crop preview
- Added optimized WebP and JPEG export with adjustable compression quality and estimated output size
- Added source-file size, dimension, pixel-count, and supported-format safeguards before decoding
- Added required image descriptions plus caption, creator/source credit, and rights or reuse fields
- Added readiness guidance for weak descriptions, missing credit or rights context, substantial upscaling, and aggressive compression
- Added a downloadable media manifest containing source, crop, output, accessibility, credit, rights, and article-field metadata
- Added copyable TAHAI Press featured-image fields with schema-compatible aspect and focal-point values
- Linked Media Desk from Contributor Composer, the demonstration navigation, the homepage newsroom tools, the footer, and the formal project site
- Added Media Desk documentation, responsive and print styling, no-JavaScript guidance, privacy checks, and regression coverage
- Package version advanced to 1.9.0

### Privacy and resilience

- Selected images, descriptions, captions, credits, and rights notes remain in browser memory and are never uploaded
- Media Desk makes no fetch, XMLHttpRequest, WebSocket, beacon, analytics, or hosted image-service request
- Only non-content preferences for preset, format, and compression quality may be stored locally
- The Media Desk route is noindex, excluded from the sitemap, and produces ordinary publisher-owned files

## 1.8.0 - 2026-07-28

### Launch Desk

- Replaced the long setup form with a persistent seven-step first-day newsroom experience
- Added visible “0 of 7” progress, local resume state, one primary action per screen, and contextual help
- Added recommended settings for identity, accessible appearance, front-page structure, navigation, and first-story wording
- Added a live publication preview that updates before repository files are changed
- Added bounded undo history, local reset, and a downloadable pre-launch backup
- Added a guided first-story walkthrough that creates a Draft instead of publishing automatically
- Added one launch package that disables demo mode, removes sample stories, writes the publication settings, and creates the first draft
- Added progressive local-repository application through the native File System Access API with explicit folder permission
- Added `npm run launch:apply -- --package <file> --confirm` with timestamped backups beneath `.artifacts/`
- Added a persistent demonstration-site “Start here” control with locally stored completion count
- Added Launch Desk documentation, tests, accessibility coverage, publisher-mode removal checks, and repository-cleanliness proof
- Package version advanced to 1.8.0

## 1.7.0 - 2026-07-28

### Reader Reach

- Added installable same-origin offline reading with a generated service worker, web app manifest, and plain-language offline fallback
- Added a browser-local saved-story library with per-article save controls, removal, clearing, and no reader account
- Added accessible browser sharing through the native share sheet with a copy-link fallback
- Added a formal printable current edition generated from the newest published stories
- Added Reader Reach controls to Pages CMS and the setup assistant
- Added publisher-safe manifest icon behavior so non-demo sites do not retain TAHAI Press demonstration icons
- Added deterministic Reader Reach tests, deployment verification, accessibility coverage, and performance-budget proof
- Package version advanced to 1.7.0

## 1.6.0 - 2026-07-27

### Added

- Private newsroom-health HTML and JSON reports generated only beneath `.artifacts/`
- Media inventory covering missing references, unused uploads, exact duplicates, image dimensions, and large files
- Explicit performance budgets for homepage HTML, CSS, total JavaScript, search data, generated file count, and individual assets
- Browser-local Contributor Composer draft library with up to 20 named copies
- Local TAHAI Press article JSON import and contributor-package export
- CMS-managed crossword records with validated grids, clues, difficulty, rotation order, active state, and print controls
- Operational, Contributor Composer, and revised crossword documentation
- GitHub Actions retention of newsroom, media, performance, and release-proof artifacts

### Changed

- Crossword data moved from hardcoded JavaScript into `content/crosswords/`
- The public crossword player now initializes from sanitized static content data and makes no runtime fetch request
- `npm run ci` now includes strict media health, performance-budget enforcement, and private newsroom reporting
- Publication setup schema advanced to version 4 with configurable operational thresholds
- README and formal GitHub Pages project site now describe Operational Polish and the Contributor Composer workflow
- Package version advanced to 1.6.0

### Accessibility, privacy, and resilience

- Operational reports remain private build artifacts and are regression-tested against accidental publication
- Contributor drafts and puzzle progress remain local to the browser with no account, analytics request, or application backend
- Crossword records are validated before build and preserve keyboard, screen-reader, mobile, print, and no-service behavior
- Audits report maintenance issues without automatically deleting editorial media or changing article content

## 1.5.0 - 2026-07-27

### Added

- Explicit editorial classifications for News, Analysis, Opinion, Investigation, Public Record, Explainer, Interview, Announcement, and Developing coverage
- Generated editorial section fronts at `/sections/` with classification-specific archives
- Generated multipart series fronts at `/series/` with stable reading order and installment context
- Article-level methodology, disclosure, rights and reuse, update history, correction history, and “What changed” fields
- Related-coverage selections with validated article references
- Permanent human-readable citation blocks plus local copy-citation and copy-link controls
- Professional Desk metadata in static search and standards-based JSON-LD
- Professional Desk documentation and regression coverage

### Changed

- Editorial Studio now asks for an article classification during Quick Story drafting
- Pages CMS exposes professional trust, series, correction, update, and related-coverage fields in plain language
- Article cards and story headers clearly label editorial classification
- Public-record and document-led sample content now demonstrates transparent corrections, methodology, and source context
- Navigation and footer discovery now include Sections and Series
- Package version advanced to 1.5.0

### Accessibility and trust

- Editorial labels are visible text, keyboard-accessible links, and never communicated by color alone
- Corrections, updates, disclosures, methodology, related coverage, and citations remain readable without JavaScript
- Copy controls progressively enhance ordinary visible citation text and require no account, database, analytics service, or network request
- Section and series fronts preserve semantic headings, reading order, focus states, narrow-screen layouts, and print behavior

## 1.4.0 - 2026-07-27

### Added

- Browser-local reader tools for text size, line spacing, reading measure, paper/sepia/dark/high-contrast surfaces, link underlines, reduced decoration, and reduced motion
- Simplified noindex article routes with direct source-document access and no embedded PDF dependency
- Required plain-language descriptions and substantial HTML summaries for published and scheduled document-led stories
- Optional document accessibility notes for known barriers, remediation, and alternate formats
- Expanded Editorial Studio checks with Ready, Needs attention, and Publication blocker severity levels
- Reader-experience audit covering preference controls, simplified routes, document summaries, target sizing, and 400% zoom fallback

### Changed

- PDF-first, mixed, and external-document templates place the HTML alternative alongside the source record
- Accessibility settings now control reader tools, simplified views, default link underlines, and document-summary enforcement
- Static accessibility auditing now verifies dialog names, disclosure summaries, table headers, and `aria-controls` references
- Setup output preserves the Accessibility Edition configuration and advances to setup schema version 3
- Package version advanced to 1.4.0

### Accessibility

- Reader preferences remain local to the browser and require no account, cookie banner, analytics service, or server storage
- Standard and simplified article views share one canonical search identity
- Document-led reporting remains understandable when native PDF rendering or assistive-technology access is unavailable
- High zoom, forced colors, reduced motion, keyboard focus, and no-JavaScript paths remain part of the release contract

## 1.3.0 - 2026-07-27

### Added

- Browser-only Editorial Studio at `/studio/` with local autosave, live newspaper preview, plain-language readiness checks, and copy/download JSON handoff
- Structured Pages CMS story blocks for key points, pull quotes, fact boxes, inline images, galleries, timelines, callouts, and document cards
- Featured-image captions, credits, rights notes, aspect treatments, and focal-point controls
- Build-time intrinsic dimensions for local PNG, JPEG, GIF, WebP, and SVG media
- Accessible gallery dialog with keyboard operation, focus return, captions, credits, and no-JavaScript fallbacks
- Scheduled article status and an hourly GitHub Actions publishing workflow that requires no additional service account
- Structured-block text in the static browser search index
- Editorial Studio, media, scheduling, and structured-content documentation

### Changed

- Reading-time calculations include structured editorial blocks
- Published and scheduled articles share strict release-completeness and image-description gates
- Demonstration navigation and homepage modules now surface the Editorial Studio
- Package version advanced to 1.3.0

### Accessibility

- Meaningful images cannot be released without reader-facing descriptions
- Galleries preserve ordinary links and captions without JavaScript and enhance to a focus-managed dialog when scripting is available
- Studio checks flag missing summaries, vague links, all-capital headlines, long paragraphs, and missing image descriptions before export

## 1.2.0 - 2026-07-27

### Added

- Private browser-based five-step publication setup assistant at `/setup/`
- Eight automated, contrast-tested newspaper theme presets
- Configurable density, reading width, masthead alignment, headline style, panel style, and reading surface
- Data-driven main navigation with safe external-link handling
- Data-driven homepage section order, visibility, headings, and item limits
- Public non-secret launch-readiness summary under `/.well-known/publication-readiness.json`
- One-command demonstration-content cleanup with `npm run setup:clear-demo -- --confirm`
- Easy Setup documentation and regression tests

### Changed

- Publication identity now supplies safe fallbacks for short title, brand initials, description, masthead, hero copy, and editorial promise
- Pages CMS publication settings now prioritize accessible presets and guided choices before advanced custom colors
- Demo-only setup, license, and project sections disappear automatically from publisher-mode builds
- Package version advanced to 1.2.0

### Accessibility

- Setup fields use explicit labels, keyboard-safe controls, visible focus, minimum target sizes, and live status announcements
- Homepage ordering controls preserve focus after movement
- All built-in themes pass the enforced TAHAI Press contrast contract

## 1.1.0 - 2026-07-27

### Added

- Novice and Expert crossword difficulty modes
- Multiple fifteen-by-fifteen blocked expert grids with longer newsroom entries
- Clickable clues, numbered starts, and direction-aware keyboard controls
- Live demo links for `https://tahai-press.tahai.net`
- Front-page explanation of Apache 2.0 source obligations and publisher-facing freedom
- `NOTICE` file for source distributions

### Changed

- Project license restored to Apache License 2.0
- Template-mode copyright now credits TAHAI Web Services and links to `https://tahai.net`
- Documentation clarifies that generated publisher sites require no visible TAHAI Press banner, footer credit, logo, or backlink

## 1.0.0 - 2026-07-27

### Added

- Database-free static publication generator
- Written, PDF-first, mixed, and external-document article templates
- Formal newspaper-inspired first-deploy edition using the TAHAI Press mark
- Pages CMS editorial configuration
- WordPress WXR, Markdown, JSON, CSV, PDF, and folder import tools
- Browser search and generated category, topic, contributor, hub, and date archives
- RSS, JSON Feed, sitemap, canonical URLs, social metadata, and structured data
- Cloudflare Pages redirects and optional Bulk Redirect export
- Accessible PDF reader fallbacks and generated-page accessibility auditing
- GitHub Actions quality, production-readiness, and GitHub Pages workflows
- Formal GitHub Pages project site
- Rotating static daily mini crossword
- Repository cleanliness validation and public maintainer documentation

### Security and privacy

- Draft and archived content excluded from public output
- Preview and template deployments blocked from indexing
- Secret-pattern and private-note leakage checks
- Safe redirect, URL, file, and publication-state validation
