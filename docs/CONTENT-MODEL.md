# Content model

## Article identity

The article `slug` is the permanent public identifier and must match its JSON filename.

```text
content/articles/example-story.json
https://example.pages.dev/stories/example-story/
```

Slugs use lowercase letters, numbers, and single hyphens. Renaming a slug changes the public URL. Preserve the old address in `legacy_urls`; the build emits a validated permanent redirect to the new route.

## Supported article formats

- `standard`: written article without a primary document. The body is required and receives the focused long-form layout.
- `pdf`: document-first record page. A PDF and document title are required; optional written context appears after the viewer.
- `mixed`: written context followed by an embedded PDF. Both the body and document title are required.
- `external`: contextual article plus a safe outbound document card. An absolute HTTP(S) `pdf_url` is required and the template does not assume iframe permission.

The renderer infers the page layout from `article_type`; editors do not select or maintain template code.

## Publishing state

- `draft`: kept in Git but excluded from the public build.
- `published`: included in the homepage, archive, and article output.
- `archived`: retained in Git but excluded until an archive policy is implemented.

## Required editorial fields

Every stored record needs a headline, URL slug, publishing status, and article format. Drafts may remain incomplete while reporting or document preparation continues.

Before `status` can be `published`, validation requires:

- a headline of at least five characters;
- a homepage summary of at least 20 characters;
- a publication date and time;
- a valid author;
- one to five valid categories;
- all content required by the selected article format;
- the three publication review confirmations.

PDF, mixed, and external articles also require a reader-facing document title. PDF and mixed records require a local or remote PDF. External records require an absolute HTTP(S) document URL.

## Article presentation fields

- `kicker`: optional eyebrow text above the headline.
- `updated_at`: optional update timestamp; it cannot precede `published_at`.
- `show_author_bio`: controls the contributor biography card.
- `tags`: rendered as accessible topic labels.
- `featured`: promotes the entry on the homepage and adds a subtle featured marker to the article header.

Written content supports second- and third-level headings, unordered and ordered lists, quotations, horizontal rules, emphasis, inline code, and safe links. Raw HTML is escaped.

## Document metadata

Document articles can provide:

- `pdf_title`
- `document_description`
- `document_date`
- `document_pages`
- `document_source`
- `external_link_label`
- `allow_download`
- `pdf_viewer_default`: `fit-width` or `fit-page`; omitted values default to fit width.

Date-only document values render consistently in the configured publication time zone.

## Media fields

`pdf_file` stores a site-relative path created by Pages CMS, such as:

```text
/uploads/documents/meeting-minutes.pdf
```

`pdf_url` is reserved for a public HTTP or HTTPS URL when a file should not be stored in the repository. When both are present, the local `pdf_file` takes precedence and validation emits a warning.

`featured_image_alt` becomes required whenever a featured image is present.

## Referential content

Articles store stable slugs for authors, categories, and hubs. Pages CMS displays friendly names while saving those slugs. The build rejects unknown references before deployment.

## Publication safety rules

- duplicate article slugs fail validation;
- article filenames must match slugs;
- malformed dates fail validation;
- unknown author, category, and hub references fail validation;
- missing local PDFs fail validation;
- raw HTML in article text is escaped;
- script and other unsafe URL protocols are rejected;
- draft and archived content are not published;
- theme colors must use six-digit hex notation;
- a reusable-template regression test blocks recipient-specific site names and domains.

- standard and mixed entries require written body content;
- PDF, mixed, and external entries require a document title;
- external entries require an absolute HTTP(S) URL and reject local PDF fields;
- update timestamps cannot precede publication timestamps;
- source link objects and document metadata are validated before build;
- external documents use an outbound card rather than an unreliable third-party iframe.

## PDF reader behavior

Local and remotely hosted PDFs used by `pdf` or `mixed` articles render inside a responsive native-browser frame. The site does not bundle a third-party PDF rendering engine. This keeps the starter small and avoids a separate PDF-library update stream, but preview behavior can vary by browser.

The generated page always includes direct access outside the embedded preview:

- **Open PDF** opens the original file in a new tab.
- **Download PDF** appears for local files when `allow_download` is true.
- compact mobile actions repeat the essential open/download paths beneath the preview;
- print output suppresses the embedded viewer and prints an absolute document URL;
- a no-JavaScript message explains that the file and direct links still work.

JavaScript progressively adds fit-width, fit-page, full-screen, loading status, and print-page controls. These controls are hidden when JavaScript is unavailable, preventing dead or misleading UI. Local PDF file size is derived during the build and displayed automatically.


## Pages CMS publication gates

Pages CMS creates new articles as Draft and derives the JSON filename from the explicit slug. Drafts are excluded from public output and may be incomplete without failing the build. Published entries activate strict validation.

The non-public workflow fields are:

- `review_content`
- `review_rights`
- `review_accessibility`
- `editor_notes`

All review fields must be true for Published status. `editor_notes` are never rendered, but they remain visible to repository collaborators and in Git history.

## Imported article records

All import formats normalize into the same article schema; there is no second migration-only content model. Safe defaults are:

- `status: draft`
- `noindex: true`
- `review_content: false`
- `review_rights: false`
- `review_accessibility: false`

Imported articles carry a private editor note identifying the migration source and original status. A direct published import requires explicit operator acknowledgement and then uses the same validator as an article created in Pages CMS.

WordPress taxonomy names are retained as topic tags while a configured existing category slug is assigned. This avoids creating uncontrolled category files during bulk intake. Original source URLs are represented in the import report, source links, and `legacy_urls` so they can be reviewed before a Published build generates redirect rules.

PDF-folder intake creates `pdf` articles and stores copied files under content-hashed names. The importer checks the `%PDF-` signature before copying, records the full SHA-256 digest, and leaves page count, source, rights, and accessibility review for an editor.


## URL identity fields

- `canonical_url`: optional absolute HTTPS override. Normally empty so the generated article route remains canonical.
- `legacy_urls`: optional list of previous site paths or complete old HTTP(S) URLs. Published records generate permanent redirects from each normalized path.

Legacy sources cannot include query strings, fragments, credentials, wildcards, or placeholders. The same normalized path may appear only once across all article and manual redirect records.

## Scheduled publishing

`scheduled` is a stored editorial state for a complete article with a future `published_at` timestamp. Scheduled articles are excluded from generated public routes, feeds, search, and archives until the repository record becomes `published`.

The included `scripts/publish-due.mjs` command changes due records to Published only when run with `--write`:

```bash
npm run publish:due -- --write
```

The GitHub Actions schedule runs this command hourly. The validator applies the same completeness, media-description, source-review, rights-review, and accessibility-review requirements to Scheduled and Published records.

## Structured story blocks

`story_blocks` is an ordered array of typed editorial components. Blocks are rendered after the ordinary article body, allowing the fast Markdown path and structured layouts to coexist.

Supported `type` values are:

- `text`: additional Markdown section with an optional heading;
- `key_points`: a heading and two or more concise takeaways;
- `pull_quote`: a quotation with optional attribution;
- `fact_box`: a heading plus label/value rows;
- `image`: one editorial image with layout metadata;
- `gallery`: two or more editorial images;
- `timeline`: dated or labeled chronological entries;
- `callout`: a heading, body, and informational, important, or warning tone;
- `document`: a title, description, and public HTTP(S) or site-relative source link.

Pages CMS exposes these as a block editor. The saved `type` key selects the renderer; editors never select template code.

### Editorial image object

Structured image and gallery records support:

- `src`: site-relative or absolute HTTP(S) image URL;
- `alt`: required description of meaningful content;
- `caption`: optional visible explanation;
- `credit`: optional creator or source credit;
- `rights`: optional internal/public rights note, rendered with the caption when supplied;
- `aspect`: `original`, `landscape`, `portrait`, or `square`;
- `focal_point`: `center`, `top`, `bottom`, `left`, or `right`;
- `layout`: `standard`, `wide`, or `full` for standalone image blocks.

Local PNG, JPEG, GIF, WebP, and SVG files receive intrinsic `width` and `height` attributes during the build. The dimensions reserve layout space and reduce movement while images load. Remote images retain safe lazy-loading behavior but cannot be measured without introducing a network fetch into the build.

A Published or Scheduled article containing a meaningful image without `alt` fails validation. Draft records receive a warning so incomplete reporting work can remain in Git without blocking unrelated builds.

### Gallery behavior

Gallery markup is useful before JavaScript runs: every image, caption, and credit appears in the document. The optional `media-gallery.js` enhancement opens the selected image in a native dialog, traps browser focus through the dialog's native behavior, supports Escape, returns focus to the triggering image, and closes from its explicit control or backdrop.

## Featured-image metadata

The original `featured_image` and `featured_image_alt` fields remain supported. The following optional fields provide professional presentation without changing the article type:

- `featured_image_caption`
- `featured_image_credit`
- `featured_image_rights`
- `featured_image_aspect`
- `featured_image_focal_point`

The featured image description remains mandatory for Published and Scheduled entries.

## Accessibility Edition fields

Document-led articles support:

```json
{
  "document_description": "A concise description of the source record and its relevance.",
  "document_accessible_summary": "A substantial plain-language HTML alternative to the source document.",
  "document_accessibility_note": "Optional information about known barriers or another available format."
}
```

Published and Scheduled `pdf`, `mixed`, and `external` records require `document_description` and `document_accessible_summary`. The summary is rendered on the standard article and simplified reader route, indexed with the article, and remains available when the browser cannot display the source document.

Site-level accessibility settings are stored under `content/site.json`:

- `reader_tools_enabled`
- `simplified_reading_enabled`
- `default_link_underlines`
- `document_summary_required`

Reader preferences are not part of the content model. They remain local to each visitor's browser.

## Professional Desk fields

Released articles may use the following professional editorial fields:

- `classification` — required for Scheduled and Published articles; one of news, analysis, opinion, investigation, public-record, explainer, interview, announcement, or developing.
- `series_slug`, `series_title`, `series_description`, and `series_order` — optional as a group for continuing coverage.
- `related_articles` — article slugs for directly useful related coverage.
- `methodology` — how reporting, records review, interviews, or analysis were conducted.
- `disclosure` — relevant relationships, limitations, or editorial context.
- `rights_and_reuse` — publication-specific reuse guidance.
- `what_changed` — a concise summary of a material current revision.
- `update_history` — dated public update entries.
- `corrections` — dated correction entries.

The build rejects unknown classifications, incomplete or conflicting series metadata, duplicate series order numbers, unresolved related-article references, self-references, and malformed history entries. See [PROFESSIONAL-DESK.md](PROFESSIONAL-DESK.md).

## Crossword records

Crossword records are stored separately from articles in `content/crosswords/`:

- `slug` — permanent filename and puzzle identifier;
- `title` — reader-facing edition title;
- `difficulty` — `novice` or `expert`;
- `deck` — short introduction;
- `active` — whether the edition participates in public rotation;
- `rotation_order` — unique positive order within its difficulty;
- `grid` — square array of uppercase rows using `#` for black cells;
- `clues` — number, direction, answer, and clue text for every generated entry.

Crossword validation derives entries from the grid rather than trusting the clue list alone. See [CROSSWORD.md](CROSSWORD.md).

## Operational settings

`content/site.json` may contain:

```json
{
  "operations": {
    "stale_article_days": 730,
    "performance_budgets": {
      "homepage_html_bytes": 307200,
      "stylesheet_bytes": 256000,
      "javascript_total_bytes": 512000,
      "search_index_bytes": 2097152,
      "generated_file_count": 20000,
      "individual_file_bytes": 26214400
    }
  }
}
```

These values affect private build reports and deployment gates only. They do not add reader tracking or a public administration endpoint.
