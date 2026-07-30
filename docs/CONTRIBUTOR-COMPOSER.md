# Contributor Composer

The Contributor Composer is the fast, browser-only drafting desk at `/studio/`. It is designed for contributors and nontechnical editors who should not need to understand Git, JSON, repository folders, or deployment systems to prepare a clean story handoff.

## What it does

- provides the short Quick Story form;
- previews the newspaper presentation while the contributor writes;
- calculates a slug and reading time;
- runs plain-language accessibility and completeness checks;
- autosaves the current draft in that browser;
- keeps up to 20 named local draft copies;
- opens an existing TAHAI Press article JSON file;
- downloads a contributor package as an ordinary article JSON file;
- copies the article JSON for an editor who prefers the clipboard.

## What it does not do

- create an account;
- send draft text to TAHAI Press;
- upload files to a server;
- call an AI service;
- write directly to GitHub;
- publish an article;
- replace source, privacy, rights, or editorial review.

The Composer makes first-draft work easy and fast. Pages CMS and the build remain the deliberate publication desk.

## Preparing a featured image

Use `/media-desk/` before or during the Contributor Composer workflow when a source image needs cropping, compression, focal-point control, or a cleaner metadata handoff.

Media Desk can export:

- an optimized WebP or JPEG file;
- a media manifest recording the crop, dimensions, compression, description, caption, credit, and rights note;
- ready-to-paste TAHAI Press featured-image fields.

Place the downloaded image under `public/uploads/images/`, then paste or enter the generated path and metadata in the Composer. The image remains local throughout preparation and is not uploaded by either browser tool.

See [MEDIA-DESK.md](MEDIA-DESK.md).

## Local draft desk

The current draft autosaves as the contributor types. Use **Save local copy** to keep a named snapshot in the same browser. The draft list supports:

- opening a saved copy;
- replacing the current form with the selected copy;
- deleting a selected copy;
- keeping up to 20 local copies.

Browser-local storage is convenient, not a backup system. Export important work and avoid leaving sensitive drafts on a shared device.

## Open an existing article

Choose **Open article JSON** and select a TAHAI Press article file. The Composer imports the ordinary Quick Story fields it understands and leaves the source file unchanged.

Import safeguards include:

- local file selection only;
- a 2 MiB maximum JSON file size;
- JSON parsing and record-shape checks;
- no network request;
- no automatic publication-state change.

Complex Professional Desk and structured-block fields remain in the original article record and should be reviewed in Pages CMS. The Composer is optimized for the common writing fields rather than exposing every advanced switch.

## Download a contributor package

Choose **Download contributor package** after Publication blocker findings are resolved. The browser saves an article JSON file named from the generated slug.

The exported article remains a Draft with release-review gates disabled. An editor can:

1. place the file in `content/articles/`;
2. commit it through GitHub or a local checkout;
3. open it in Pages CMS;
4. add structured blocks, sources, related coverage, corrections, documents, and trust notes as needed;
5. complete content, rights, privacy, source, and accessibility review;
6. publish or schedule the story.

## Accessibility guidance

The Composer groups findings into:

- **Ready**;
- **Needs attention**;
- **Publication blocker**.

Checks cover common authoring problems such as missing summaries, empty bodies, vague links, missing image descriptions, all-capital headlines, skipped headings, very long paragraphs, incomplete Markdown links, and likely tables without a header row.

These checks are intentionally understandable. They help contributors fix issues before handoff, while the full build remains the final accessibility authority.

## Privacy and recovery

Drafts remain in local browser storage until the contributor deletes them or clears the site data. On a shared computer:

1. download the contributor package;
2. confirm the file opens correctly;
3. delete saved local copies;
4. reset the current form;
5. clear site data when the material is sensitive.

No draft recovery is possible from TAHAI Press because the project never receives the draft.
