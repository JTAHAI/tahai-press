# Pages CMS setup and operating contract

Pages CMS is the optional browser-based editor for this starter. It edits the repository files directly through GitHub. It does not introduce a separate content database, media database, API, or server process.

## Connect a fork

1. Create or fork a GitHub repository containing this project.
2. Keep `.pages.yml` at the repository root.
3. Sign in to the hosted Pages CMS application with the GitHub account that owns or can edit the repository.
4. Install the Pages CMS GitHub App for only the repository or organization that should be editable.
5. Open the repository and select the branch used for publishing.
6. Confirm the sidebar shows **Publishing**, **Publication data**, and **Site settings**.

For the simplest owner-operated setup, Pages CMS may write directly to `main`. The included automation also supports safer review branches and Cloudflare preview deployments before merging into production.

## What the CMS may edit

- `content/articles/*.json`
- `content/authors/*.json`
- `content/categories/*.json`
- `content/hubs/*.json`
- `content/site.json`
- `content/redirects.json`
- images under `public/uploads/images/`
- PDFs under `public/uploads/documents/`

The CMS configuration intentionally does not expose workflow files, build scripts, environment files, deployment credentials, or security policy files. It exposes bounded previous-URL and manual static-redirect fields because those are editorial migration data.

## Draft-first behavior

New articles start as `draft`. Draft and archived entries stay in Git history but are excluded from the generated public site.

A draft may be incomplete. Editors can save a headline and slug first, then return later for the body, source document, metadata, and publication checks. Missing format-specific fields produce warnings for drafts instead of blocking unrelated site builds.

Switching an entry to `published` activates strict validation. A published record must have:

- a usable headline and summary;
- a publication date and time;
- a valid author and at least one category;
- all content required by the selected article format;
- useful alternative text when a featured image is present;
- all three publication review confirmations.

A failed production validation does not make an incomplete article public. The previous successful Cloudflare deployment remains available while the content is corrected.

## Article filename and URL safety

Pages CMS creates article filenames from the explicit `slug` field:

```text
content/articles/example-story.json
```

That becomes:

```text
/stories/example-story/
```

The CMS hides its separate filename input so an editor cannot accidentally create a filename that disagrees with the public slug. Changing an existing slug changes the public URL. Add the former address to `legacy_urls` before the change; the build generates and validates the permanent redirect.

## Media behavior

Images and PDFs use separate media sources. Uploads are renamed safely and stored at predictable public paths.

```text
public/uploads/images/
public/uploads/documents/
```

The document picker accepts PDF files only. Cloudflare Pages currently limits an individual deployed asset to 25 MiB, so a larger file should remain on an external document host or use a deliberate object-storage workflow such as Cloudflare R2.

Do not upload credentials, private discovery material, unredacted personal identifiers, medical records, private child information, or any file the publication does not have the right to share.

## Publication review confirmations

Every published article requires these fields to be true:

- `review_content`: public text, names, dates, source descriptions, and links were checked;
- `review_rights`: publishing rights and unintended private information were checked;
- `review_accessibility`: image descriptions, document title, direct file access, and mobile fallbacks were checked.

These confirmations are editorial gates, not legal guarantees. They create a deliberate pause before a status change becomes public.

## Private editor notes

`editor_notes` are stored in Git but are never rendered by the site generator. They are suitable for brief workflow notes, not secrets or highly sensitive personal information. Anyone with repository access may read Git history.

## Configuration verification

Run:

```bash
npm run validate:cms
```

The dependency-free contract validator checks the critical CMS paths, draft defaults, safe filename behavior, article field parity, media restrictions, and publication review fields.

For an additional syntax check on a workstation with Ruby installed:

```bash
ruby -e 'require "yaml"; YAML.load_file(".pages.yml"); puts "YAML valid"'
```


## Redirect editing

Use **Previous article URLs** on an article for old addresses that should lead to that article. Use **Site settings → Manual redirects** only for non-article pages. The build rejects query-bearing sources, fragments, wildcards, placeholders, duplicates, chains, loops, source collisions, and missing internal destinations.

The manual `preserve_query_string` switch applies to the optional Bulk Redirect CSV export. It is not an additional capability of the Pages `_redirects` syntax.

## Launch Desk handoff

The first-deploy `/setup/` route is a seven-step Launch Desk for nontechnical publishers. It covers identity, an accessible theme, a safe front-page arrangement, editor connection, a first article, and launch review. Progress, undo, previews, and backups remain in the browser; no setup data is sent to a service.

The desk exports a normal launch package rather than creating a second content system. After it is applied and committed, Pages CMS edits the resulting `content/site.json`, first article, author record, media, and all later publication work in the same repository.

Use the local command when direct folder access is unavailable:

```bash
npm run launch:apply -- --package ./tahai-press-launch-package.json --confirm
```

The applicator validates the package, backs up affected source records, removes the known demonstration articles, writes the first draft, and leaves all changes uncommitted for review. See [LAUNCH-DESK.md](LAUNCH-DESK.md).

## Editorial Studio and full editor

TAHAI Press provides two complementary authoring surfaces:

- `/studio/` is a browser-only Quick Story composer that exports a Draft JSON record.
- Pages CMS is the complete repository editor for sources, documents, structured blocks, review gates, redirects, and publication status.

Quick Story does not bypass Pages CMS or publication review. It removes technical friction from the first draft, then hands the ordinary article record to the existing editorial system.

## Structured block editor

The article collection uses a Pages CMS block field for `story_blocks`. Each item stores a `type` key and only the fields relevant to that block. Editors can add, remove, and reorder key points, pull quotes, fact boxes, images, galleries, timelines, callouts, and document cards without writing custom markup.

The generator and validator remain authoritative. A CMS control cannot make an unsafe URL, missing required image description, or incomplete public record valid.

## Scheduled status

The status selector includes **Scheduled**. Scheduled records must be as complete as Published records and must include a future publication timestamp. They are not rendered publicly until the included GitHub Actions workflow commits the status change to Published.

Repository administrators should confirm Actions are enabled and that the workflow has permission to write repository contents. No additional secret is required for the standard same-repository workflow.

## Document accessibility fields

Document-led article formats include three reader-facing fields:

- `document_description` — a concise explanation of what the document is and why it matters;
- `document_accessible_summary` — a substantial HTML-readable summary of the document's useful content;
- `document_accessibility_note` — an optional note about known barriers, remediation, or alternate formats.

Published and Scheduled PDF, mixed, and external-document stories require the first two fields. Draft records may remain incomplete and receive warnings instead of blocking the repository.

Publication settings also control whether reader tools, simplified article routes, default link underlines, and the document-summary gate are enabled. The recommended defaults keep all four protections active except forced link underlines, which readers can enable themselves.

## Professional Desk fields

The article editor groups the v1.5 newsroom fields into plain-language controls for classification, series membership, related coverage, reporting methodology, disclosures, reuse guidance, updates, and corrections.

Scheduled and Published records require a classification. Series fields operate as one set: when a series slug is present, provide its title, description, and a unique positive order number. Related coverage uses existing article slugs rather than pasted public URLs so the build can verify every reference.

Update and correction entries are public. Keep private deliberation out of those fields and use the existing editor notes only for non-secret workflow context. See [PROFESSIONAL-DESK.md](PROFESSIONAL-DESK.md).

## Crossword desk

The **Crossword desk** collection edits records under `content/crosswords/`. Editors choose difficulty, rotation order, active state, grid rows, and clue records without editing JavaScript.

Keep a new puzzle inactive until local validation passes. The build verifies dimensions, characters, generated entries, answers, clue coverage, and unique active rotation positions. See [CROSSWORD.md](CROSSWORD.md).

## Operational reports

Pages CMS remains an editorial interface and does not expose the private operational dashboard. Maintainers run `npm run ci` locally or download the `newsroom-health`, media-health, and performance artifacts from GitHub Actions.

This separation prevents a public or semi-public CMS page from becoming an infrastructure console while still giving maintainers concrete maintenance guidance. See [OPERATIONS.md](OPERATIONS.md).

## Contributor package intake

The browser Contributor Composer can download an ordinary draft article JSON file. Add the file to `content/articles/` through a local checkout, GitHub, or a pull request. After it is committed, Pages CMS displays it like every other article.

Pages CMS remains the place to complete structured blocks, sources, trust notes, documents, review gates, scheduling, and final publication status. See [CONTRIBUTOR-COMPOSER.md](CONTRIBUTOR-COMPOSER.md).

## Reader Reach settings

Under **Publication settings → Reader Reach**, editors can enable or disable:

- installable offline reading;
- saved stories on the current device;
- browser-native sharing;
- the printable current edition.

The two numeric controls select how many current-edition stories are displayed and how many recent article routes are included in the initial offline cache. Both accept values from 1 through 50.

These controls do not create reader accounts or synchronize reader data. Saved stories and preferences stay in each reader's browser. See [READER-REACH.md](READER-REACH.md).
