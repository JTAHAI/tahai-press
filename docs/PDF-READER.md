# PDF reader contract

The starter treats the PDF as the original source file, not as content locked inside a proprietary viewer.

## Always available

Every embedded PDF page contains ordinary HTML links that work without JavaScript:

- open the original PDF in a new tab;
- download a local PDF when the article permits downloads;
- reach the same actions from a compact mobile action row;
- print an absolute PDF URL with the article page;
- read a fallback explanation when the browser does not display PDFs inline.

## Progressive controls

`public/assets/pdf-reader.js` adds the following after JavaScript is available:

- fit width;
- fit whole page;
- full-screen reader mode with an Escape exit path;
- preview loading and delayed-preview status;
- article-page printing.

The controls change standard PDF URL fragments. The browser's built-in PDF viewer still determines the exact appearance and available native toolbar features.

## Mobile behavior

The embedded frame remains present on small screens, but the surrounding controls reflow into full-width tap targets. Open and download actions are repeated immediately below the frame because embedded PDF behavior varies substantially across mobile browsers.

## Failure behavior

The loading cover is removed either when the iframe reports a load event or after the delayed-preview threshold. A slow or unsupported viewer therefore cannot permanently cover the native frame. The page never removes direct links based on viewer status.

## Printing

Printing the article page hides navigation, interactive reader controls, and the embedded frame. It preserves article context, document metadata, and an absolute link to the attached PDF. Printing the PDF itself should be performed after opening the original file.

## Deliberate non-goals

TAHAI Press does not bundle PDF.js, OCR, text extraction, annotation, page thumbnails, or server-side document conversion. Those would materially increase build weight and maintenance responsibility. Publishers may use external storage for large documents without changing the reader contract.
