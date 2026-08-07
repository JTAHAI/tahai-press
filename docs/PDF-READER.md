# PDF reader and document-alternative contract

TAHAI Press treats a PDF as an original source file, not as content locked inside a proprietary viewer. The same-origin PDF.js reader is a progressive convenience. The article, HTML summary, direct links, and simplified reading view are the durable reader experience.

## Required HTML alternative

Published and Scheduled PDF, mixed, and external-document stories require:

- a concise `document_description`; and
- a substantial `document_accessible_summary`.

The HTML summary should communicate the document's purpose and important content without requiring the reader to open the PDF. An optional `document_accessibility_note` can identify known barriers, ongoing remediation, or another available format.

A generated document article therefore remains useful when:

- the browser does not support embedded PDFs;
- the progressive reader cannot load or JavaScript is unavailable;
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

`public/assets/pdf-reader.js` dynamically imports the pinned, same-origin PDF.js modules only on `pdf` and `mixed` article routes. It adds:

- fit width;
- fit whole page;
- full-screen reader mode with an Escape path and focus return;
- page-aware loading status and previous/next-page controls;
- zoom in, zoom out, fit width, and fit page;
- article-page printing.

These controls are progressively disclosed only when JavaScript is available. The reader continues to expose the source file and HTML alternative if PDF.js fails to load or cannot render a document.

## Mobile and zoom behavior

The rendered document canvas remains inside a responsive stage on ordinary small screens, while surrounding controls reflow into full-width targets. Open and download actions repeat immediately below the reader.

At very narrow effective widths and high zoom, direct document access and the HTML summary take priority over forcing a large embedded viewport into the page. The simplified article route omits the frame entirely.

## Failure behavior

The loading message reports an unavailable or failed document reader without blocking the rest of the article. Direct links, the HTML summary, and the simplified view never depend on reader status.

## Printing

Printing the article hides navigation, interactive reader controls, and the rendered document stage. It preserves article context, document metadata, the HTML summary, and an absolute link to the source file. Print the PDF itself after opening the original document.

## Deliberate non-goals

TAHAI Press bundles the pinned `pdfjs-dist` runtime as generated, same-origin output for document routes only. It does not add OCR, indexing of private documents, annotation, server-side document conversion, or document-upload processing. Publishers remain responsible for source-document remediation and publication rights.
