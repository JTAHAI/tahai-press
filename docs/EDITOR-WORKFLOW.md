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
