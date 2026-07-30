# PDF reader and document-alternative contract

TAHAI Press treats a PDF as an original source file, not as content locked inside a proprietary viewer. The embedded frame is a convenience. The article, HTML summary, direct links, and simplified reading view are the durable reader experience.

## Required HTML alternative

Published and Scheduled PDF, mixed, and external-document stories require:

- a concise `document_description`; and
- a substantial `document_accessible_summary`.

The HTML summary should communicate the document's purpose and important content without requiring the reader to open the PDF. An optional `document_accessibility_note` can identify known barriers, ongoing remediation, or another available format.

A generated document article therefore remains useful when:

- the browser does not support embedded PDFs;
- a mobile browser replaces the frame with its own viewer;
- assistive technology cannot interpret the file;
- the reader chooses the simplified view;
- JavaScript is disabled.

## Always available

Every embedded PDF page contains ordinary HTML links that work without JavaScript:

- open the original PDF in a new tab;
- download a local PDF when allowed;
- reach the same actions from a compact mobile action row;
- print an absolute PDF URL with the article page;
- read the document description and accessible HTML summary;
- open the noindex simplified article without an embedded frame;
- read a fallback explanation when the browser does not display PDFs inline.

## Progressive controls

`public/assets/pdf-reader.js` adds:

- fit width;
- fit whole page;
- full-screen reader mode with an Escape path and focus return;
- preview loading and delayed-preview status;
- article-page printing.

These controls are progressively disclosed only when JavaScript is available. The browser's native PDF viewer still determines exact rendering and native toolbar behavior.

## Mobile and zoom behavior

The embedded frame remains present on ordinary small screens, while surrounding controls reflow into full-width targets. Open and download actions repeat immediately below the frame because mobile PDF behavior varies widely.

At very narrow effective widths and high zoom, direct document access and the HTML summary take priority over forcing a large embedded viewport into the page. The simplified article route omits the frame entirely.

## Failure behavior

The loading cover is removed when the iframe reports a load event or after the delayed-preview threshold. A slow or unsupported viewer cannot permanently cover the native frame. Direct links, the HTML summary, and the simplified view never depend on viewer status.

## Printing

Printing the article hides navigation, interactive reader controls, and the embedded frame. It preserves article context, document metadata, the HTML summary, and an absolute link to the source file. Print the PDF itself after opening the original document.

## Deliberate non-goals

TAHAI Press does not bundle PDF.js, OCR, text extraction, annotation, page thumbnails, or server-side document conversion. Those features would materially increase weight, privacy risk, and maintenance. Publishers can remediate source documents or use external storage without changing the static reader contract.
