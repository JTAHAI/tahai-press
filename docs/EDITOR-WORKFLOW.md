# Editor workflow

## Publish a written article

1. Open **Publishing → Articles**.
2. Create an article.
3. Enter a headline and permanent URL slug.
4. Leave the status as **Draft**.
5. Choose **Written article**.
6. Add the summary, article text, author, category, and publication time.
7. Add sources, tags, a hub, and a featured image only when useful.
8. Complete the three publication review confirmations.
9. Change the status to **Published** and save.

## Publish a PDF-first record

1. Create an article and leave it as **Draft**.
2. Choose **PDF-first document record**.
3. Add a headline and reader-facing summary.
4. Drop the PDF into **Upload a local PDF**.
5. Add the document title and, when known, the date, page count, source, and description.
6. Add brief context in the article text field only when it helps the reader.
7. Choose the initial fit mode.
8. Complete the publication metadata and review confirmations.
9. Change the status to **Published** and save.

## Publish context with a supporting PDF

Choose **Written article with supporting PDF**. Both the written article body and the PDF are required before publication. The public page presents the context first and the source document second.

## Link to a document hosted elsewhere

Choose **Document hosted on another website** and paste a complete `https://` URL into **External document URL**. Leave **Upload a local PDF** empty. The public page uses an explicit outbound source card rather than assuming the other host allows embedding.


## Preserve an old article address

Before changing an established article slug, add the current path to **Previous article URLs**. A complete former URL may also be used during a domain migration. Save and review the preview before removing or renaming the old route.

The build creates the redirect only when the destination article is Published. Do not add the current article route as its own previous URL.

For a retired non-article page, use **Site settings → Manual redirects**. Point directly to the final live destination; redirect chains are blocked.

## Correct or update an article

1. Open the existing article.
2. Make the correction or update.
3. Set **Last updated** only when the public page should display a meaningful update date.
4. Re-check the publication confirmations.
5. Save.

Git preserves the previous version. Do not change the slug for a normal correction.

## Remove an article from public view

Change the status to **Archived** or **Draft** and save. The file remains in Git, but the next successful build removes its public route and archive card.

## Troubleshooting

**The site build says the article is incomplete.** Read the first validation error. Published entries are blocked when required fields or review confirmations are missing. Change the entry back to Draft while work continues.

**The PDF does not preview in the browser.** Confirm the direct **Open PDF** link works. Native preview behavior varies by browser, but the open and download paths remain the required fallback.

**The article URL is unexpected.** Confirm the slug uses lowercase letters, numbers, and single hyphens and that the JSON filename matches it. Pages CMS handles this automatically for newly created entries. When replacing a previously public slug, add the old address under **Previous article URLs** before publishing.

**An image is rejected.** Use a supported web image format and provide useful alternative text before publishing.

**A PDF is too large.** Use an external public document URL or a deliberate object-storage workflow such as Cloudflare R2.

**A redirect build failed.** Read the first redirect error. Remove duplicate aliases, point chains directly to their final destination, and confirm internal targets are Published routes or existing public files.

## Draft quickly in Editorial Studio

1. Open `/studio/` on the deployed site.
2. Enter the headline, contributor, category, summary, and article text.
3. Add a featured image only when it improves the story.
4. Describe what the image communicates to a reader who cannot see it.
5. Resolve the plain-language checklist items.
6. Download the article JSON.
7. Add the file under `content/articles/`.
8. Open it in Pages CMS for source, rights, accessibility, and publication review.

The studio saves in the local browser and never publishes directly. See [EDITORIAL-STUDIO.md](EDITORIAL-STUDIO.md).

## Add structured newspaper blocks

In the full article editor, open **Structured story blocks** and choose the block needed for the reporting:

- use **Key points** for a concise reader briefing;
- use **Pull quote** for an important attributed statement;
- use **Fact box** for compact label/value context;
- use **Image** for an inline, wide, or full-width visual;
- use **Gallery** for two or more related images;
- use **Timeline** for a sequence of events;
- use **Callout** for important context or a warning;
- use **Document card** for a source file or record that should open separately.

Keep blocks in reading order. Do not use a decorative block where an ordinary heading and paragraph would be clearer.

## Image checklist

Before releasing an article with images:

1. Confirm the image may be published.
2. Write an image description for meaningful content.
3. Add a factual caption when the context is not obvious.
4. Credit the photographer, agency, public body, or source when appropriate.
5. Record rights or reuse information when useful.
6. Choose an aspect treatment only when the crop does not hide important content.
7. Set a focal point when the subject is not centered.
8. Preview the article at desktop and narrow mobile widths.

## Schedule an article

1. Complete the article exactly as if publishing immediately.
2. Set the status to **Scheduled**.
3. Choose the intended future publication time.
4. Complete all three publication review confirmations.
5. Save the commit.
6. Confirm the **Scheduled publishing** GitHub Action is enabled.

The workflow checks hourly and changes due records to Published. Scheduled work remains absent from public pages, search, feeds, and sitemaps until that commit occurs. GitHub's scheduler may run later than the exact minute, so do not use it for a deadline that cannot tolerate a delay.

## Professional Desk release review

Before scheduling or publishing an article:

1. Select the classification that accurately describes the work.
2. Add series metadata only when the article belongs to a named continuing package.
3. Add only directly relevant public article slugs under related coverage.
4. Add methodology or disclosure language when readers need it to assess the reporting.
5. Add `what_changed` and a dated update entry for a material revision.
6. Record a factual correction in the corrections list rather than silently replacing it.
7. Preview the citation, section front, series page, and simplified reading view.

Git retains every file revision, while the public history fields explain meaningful changes to readers. See [PROFESSIONAL-DESK.md](PROFESSIONAL-DESK.md).
