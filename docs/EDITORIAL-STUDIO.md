# Writer Desk (Editorial Studio)

TAHAI Press v2.2 keeps the Writer Desk route stable while the surrounding release expands the media pipeline and preserves the same portable article JSON handoff.

TAHAI Press Editorial Studio is a fast, browser-only drafting surface for contributors and nontechnical editors. It prepares a valid article record without requiring the writer to open source code, understand the repository layout, or create another account.

## Open the studio

On a demonstration or publisher deployment, open:

```text
https://example.pages.dev/studio/
```

The route is excluded from search-engine indexing. It is a local composing tool, not a private server application: anyone who knows the address can load the blank editor, but the draft remains inside that person's browser until they deliberately copy or download it.

## Privacy boundary

Editorial Studio:

- does not send draft text to TAHAI Press;
- does not call an AI, analytics, image, or writing service;
- does not upload selected images;
- does not create a user account;
- does not write directly to GitHub;
- stores the current draft and up to 20 named local copies in that browser's local storage;
- can reopen an existing TAHAI Press article JSON file;
- exports an ordinary JSON contributor package for review.

A shared or public computer should be treated as shared storage. Use **Reset** after exporting a sensitive draft, or clear the browser's site data.

## Quick Story fields

The default view keeps the form deliberately short:

1. Headline
2. Contributor
3. Category
4. Plain-language summary
5. Article text
6. Optional featured image
7. Image description, caption, and credit

The advanced disclosure adds only the fields commonly needed during handoff:

- kicker;
- publication date and time;
- topics.

The exported record remains a **Draft**. Source review, rights review, accessibility review, and final publication remain explicit editorial decisions in Pages CMS or the repository.

## Live preview

The right-hand preview updates while the writer works and approximates the public newspaper presentation. It shows:

- kicker and headline hierarchy;
- summary deck;
- byline and reading-time estimate;
- image, description, and caption;
- basic Markdown paragraphs, headings, lists, quotations, emphasis, and links.

The preview is a writing aid rather than a separate publication renderer. The complete generator remains the source of truth for the final page.

## Readiness checks

The studio uses plain-language statuses:

- **Ready**: the field is complete enough for handoff;
- **Needs attention**: the editor should review the item;
- **Publication blocker**: the article should not be released yet.

Checks include:

- missing or very short headline;
- missing summary;
- empty article body;
- all-capital headline text;
- vague link text such as “click here”;
- unusually long uninterrupted paragraphs;
- selected image without a reader description;
- missing contributor or category.

These checks reduce common mistakes but do not replace editorial judgment, source verification, privacy review, rights review, or the build's stricter validator.

## Local draft desk

The current draft autosaves while the contributor works. **Save local copy** keeps a named snapshot in the same browser. Use **Open selected** or **Delete selected** to manage up to 20 local copies. These copies are convenient working storage, not a remote backup.

Choose **Open article JSON** to load an existing TAHAI Press record from the device. Import is local-only and limited to a small JSON file; no draft content is uploaded.

## Export and publication handoff

### Download contributor package

Choose **Download contributor package**. The browser saves a file named from the permanent slug, for example:

```text
council-approves-capital-plan.json
```

Place the file under:

```text
content/articles/
```

Then open the article in Pages CMS, complete sources and review gates, and change the status when it is ready.

### Copy JSON

Choose **Copy article JSON** to place the record on the clipboard. This is useful when an editor is already working in GitHub or Pages CMS.

### Import through Pages CMS

Pages CMS does not currently provide a generic “upload this JSON as a new record” button. The dependable handoff is to add the exported file to `content/articles/` through GitHub, a local checkout, or a pull request. Once committed, the record appears in Pages CMS like every other article.

## Structured story blocks

Quick Story intentionally exports a simple written article. The full Pages CMS article editor can add structured blocks afterward:

- key points;
- pull quote;
- fact box;
- inline image;
- gallery;
- timeline;
- callout;
- document card.

This division keeps first-draft work fast while preserving professional layout controls for the editor who needs them.

## Scheduled publication

Choose **Scheduled** in Pages CMS and provide a future `published_at` time. The included GitHub Actions workflow runs hourly and changes due entries to **Published**.

The workflow:

1. checks out the repository;
2. runs `npm run publish:due -- --write`;
3. validates the changed records;
4. commits only `content/articles/` when an article becomes due;
5. allows the normal Cloudflare Pages Git integration to deploy the commit.

No external scheduler, database, API key, or paid service is required. GitHub Actions schedules are not guaranteed to run at an exact minute, so use ordinary immediate publishing for time-critical breaking news.

## Accessibility expectations

- Describe what a meaningful image communicates, not merely what its filename says.
- Leave decorative imagery out of article content instead of adding empty descriptions to meaningful editorial media.
- Keep captions factual and separate from the image description.
- Use descriptive link text that makes sense out of context.
- Break long articles with informative headings.
- Keep source documents accompanied by a plain-language description or HTML summary.

The public build independently enforces the required image-description and publication-review gates.

## Accessibility Edition checks

The v1.4 checker expands the original readiness list without making the editor feel like a technical audit console. Findings remain grouped into three plain-language levels and identify a specific action.

Additional checks include:

- empty or incomplete Markdown links;
- identical link labels that lead to different destinations;
- Markdown images without descriptions;
- skipped heading levels and accidental level-one headings in the body;
- headings that are difficult to scan;
- likely Markdown tables without a header row;
- unexplained abbreviations;
- long uninterrupted paragraphs;
- all-capital headline text.

**Download contributor package** and **Copy article JSON** stop only when a Publication blocker remains. Needs-attention findings remain visible for editorial judgment and do not turn the fast drafting surface into a rigid form.

The full public build remains the final authority. It validates document summaries, media descriptions, release-review fields, generated semantics, and the reader-experience contract after the article enters the repository.

## Professional Desk handoff

Quick Story now asks for an article classification so the exported draft arrives at the full editorial desk with the basic reader label already selected. Series membership, related coverage, methodology, disclosure, corrections, and update history remain in Pages CMS, where an editor can review them with the complete article record before publication.


For the complete local-draft, import, privacy, and handoff contract, see [CONTRIBUTOR-COMPOSER.md](CONTRIBUTOR-COMPOSER.md).


## Writer Desk v2.2

Writer Desk adds:

- a formatting toolbar that preserves clean Markdown;
- `Ctrl+K` / `Cmd+K` command palette;
- slash commands at the start of a new line;
- structured directives for key points, pull quotes, fact boxes, timelines, callouts, supporting documents, inline images, and source links;
- safe HTML-paste cleanup for material copied from Word, Google Docs, email, and web pages;
- automatic browser-local revision snapshots;
- focus mode;
- responsive editor and preview columns that collapse before either lane becomes unreadably narrow.

Structured directives are converted to ordinary `story_blocks` and `source_links` fields when the contributor package is exported. The directive text is not published in the article body.
