# Media Desk

TAHAI Press Media Desk is a browser-only image preparation workspace at `/media-desk/`.

It is designed for editors and contributors who need publication-ready image files but do not need or want a hosted image service, media database, analytics layer, or additional account.

## Privacy and ownership

Media Desk runs entirely in the reader's browser:

- the selected source image is decoded locally;
- the image is never uploaded;
- no network request is made by the editor;
- no image, description, caption, credit, or rights note is written to browser storage;
- only the last selected preset, format, and compression quality may be remembered locally;
- closing or clearing the page releases the in-memory source image.

The editor downloads ordinary JPEG, PNG, WebP, AVIF when supported, and JSON files. The publisher remains responsible for placing those files in the repository and completing normal editorial review.

## Supported source files

Media Desk accepts:

- JPEG;
- PNG;
- WebP.

The browser rejects source files larger than 30 MB, images larger than 16,384 pixels on either edge, and images exceeding 80 million pixels. These limits reduce the chance of browser instability from accidentally enormous or malformed source files.

SVG, GIF, animated images, and remote URLs are intentionally excluded from the first Media Desk release. AVIF export appears only when the browser can encode it reliably.

## Publishing presets

The included presets are deliberately constrained:

| Preset | Output | Article aspect |
|---|---:|---|
| Original ratio | Up to 2400 × 2400 | `original` |
| Feature image | 1600 × 900 | `landscape` |
| Article landscape | 1440 × 960 | `landscape` |
| Social card | 1200 × 630 | `landscape` |
| Square card | 1080 × 1080 | `square` |
| Portrait card | 1080 × 1350 | `portrait` |

The fixed presets make common publishing decisions repeatable. They are not intended to replace a full design application.

## Crop and focal point

The source image is cropped around a focal point. Editors can:

- choose Top, Left, Center, Right, or Bottom;
- adjust horizontal and vertical focus with sliders;
- click the preview to place the focal point;
- focus the preview and use arrow keys for fine adjustments;
- hold Shift with an arrow key for a larger movement.

The downloaded article fields use the nearest schema-compatible focal value: `center`, `top`, `bottom`, `left`, or `right`.

The preview includes a rule-of-thirds grid. The grid is guidance only and is not included in the exported file.

## Compression and formats

Media Desk exports:

- WebP;
- JPEG;
- PNG;
- AVIF when supported by the browser.

The quality control ranges from 40% to 95% and defaults to 82%. The browser displays an estimated output size before download. WebP is the default because it normally produces a smaller file at comparable visual quality, while JPEG remains available for older workflows and broad compatibility. PNG remains lossless for images that need it.

JPEG export uses a white background. This prevents transparent PNG pixels from becoming black or unpredictable after conversion.

Editors should inspect the downloaded result at full size, especially when:

- the source is smaller than the selected preset;
- the image contains text or line art;
- quality is below 60%;
- a face or critical piece of evidence sits near the crop edge.

## Accessibility, credit, and rights

An image description is required before any image, manifest, or article fields can be exported. The readiness panel also reviews:

- unusually short descriptions;
- descriptions that appear to repeat a filename;
- missing creator or source credit;
- missing rights or reuse information;
- substantial upscaling;
- aggressive compression.

The image description is not embedded invisibly inside the JPEG or WebP file. It is preserved in the Media Desk manifest and article-field JSON so it can be committed alongside the article record, where the public site and assistive technology can use it reliably.

## Repository handoff

Media Desk produces three useful outputs.

### Optimized image

Place the downloaded file in:

```text
public/uploads/images/
```

The generated repository path points to:

```text
/uploads/images/<generated-filename>
```

### Media manifest

The manifest records:

- original filename, type, size, and dimensions;
- output filename, type, size, dimensions, quality, and preset;
- exact source crop coordinates;
- image description, caption, credit, and rights note;
- ready-to-use TAHAI Press article fields;
- the intended repository path for the optimized file.

The manifest is an editorial handoff record. It is not read automatically by the build and does not need to be published.

The deployment build also writes a private `.well-known/media-asset-manifest.json` with the current upload inventory, exact usage references, and responsive derivative plan.

### Copied article fields

The **Copy article fields** action copies a JSON object containing:

```json
{
  "featured_image": "/uploads/images/example-feature.webp",
  "featured_image_alt": "A clear description of the meaningful image content.",
  "featured_image_caption": "Why the image matters in this story.",
  "featured_image_credit": "Creator or source",
  "featured_image_rights": "Rights or reuse basis",
  "featured_image_aspect": "landscape",
  "featured_image_focal_point": "center"
}
```

Paste those values into the article record or enter the same information in Pages CMS.

## Editorial Studio workflow

A typical browser-only handoff is:

1. Open `/media-desk/`.
2. Select and prepare the source image.
3. Download the optimized file and media manifest.
4. Place the image under `public/uploads/images/`.
5. Copy the article fields.
6. Open `/studio/` or Pages CMS.
7. Add the image path and metadata to the story.
8. Complete normal content, rights, and accessibility review.
9. Validate and build the repository.

Media Desk does not publish automatically, write to the repository, or mark rights review complete.

The build adds a private media-library view and responsive deploy-time variants for local uploads when the source dimensions allow them.

## No-JavaScript behavior

The image editor requires JavaScript and canvas support. The route provides a plain-language fallback explaining that the publication remains readable and that a trusted desktop image editor may be used instead.

The Media Desk route is always `noindex`, is excluded from the sitemap, and is not part of the public editorial archive.
