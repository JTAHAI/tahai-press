# Accessibility and readability

TAHAI Press is a reusable publishing template. Accessibility behavior belongs to the publisher-facing site and remains configurable; TAHAI Press does not add visible platform branding, a powered-by notice, or a TAHAI backlink.

## Generated accessibility contract

Every generated HTML route is expected to provide:

- a declared document language and non-empty browser title;
- one `main` landmark with `id="main"` and programmatic focus support;
- a visible-on-focus skip link;
- exactly one `h1` page heading;
- unique IDs and resolvable `aria-labelledby` and `aria-describedby` references;
- alternative text attributes for images and descriptive titles for PDF iframes;
- accessible names for buttons and associated labels for form controls;
- `noopener noreferrer` plus an assistive-technology notice on links that open a new tab;
- direct open/download fallbacks when embedded PDF support fails.

The dependency-free auditor checks these contracts against every generated HTML file:

```bash
npm run build
npm run audit:a11y
```

The Cloudflare production command runs the audit automatically. A failure stops the deployment.

## Configurable accessibility statement

`content/site.json` contains an `accessibility` object:

```json
{
  "statement_enabled": true,
  "contact_email": "editor@example.org",
  "statement_intro": "This publication aims to provide a readable experience...",
  "feedback_note": "When reporting a barrier, include the page address..."
}
```

When enabled, the build creates `/accessibility/` and links it from the publication footer. Leaving `contact_email` empty falls back to the main editor email. Pages CMS exposes these settings under **Site settings → Publication settings → Accessibility statement**.

## Theme contrast enforcement

Publisher colors remain editable, but the build rejects color combinations that would make ordinary text, links, buttons, or control boundaries unreadable. The checks cover:

- white text on primary accent, brand, and deep-brand backgrounds;
- accent and brand text on paper and surface backgrounds;
- fixed body, secondary, and muted text on configurable backgrounds;
- visible control boundaries against the page background.

Ordinary text combinations require at least `4.5:1`; core body text is held to a `7:1` enhanced threshold; non-text control boundaries require at least `3:1`.

## Reader behavior

The stylesheet includes:

- browser text-size adjustment support;
- readable article line lengths;
- minimum 44-pixel-equivalent interactive targets;
- long-word and long-URL wrapping;
- responsive behavior down to 320–360 CSS pixels;
- `prefers-reduced-motion`, `prefers-contrast: more`, and `forced-colors` handling;
- print-specific document links.

Search results announce through an atomic live region. Explicit form submission moves focus to the result summary, while live typing and filter updates do not repeatedly move the reader’s focus.

The PDF reader returns focus to the full-screen trigger after the reader exits full-screen mode. Native PDF rendering still depends on the browser and operating system, so direct document links always remain available.

## Publisher responsibilities

The template cannot make an inaccessible source PDF accessible by itself. Publishers should:

- provide useful context in the article body;
- upload tagged, searchable PDFs when they control the source;
- add meaningful image descriptions;
- avoid image-only documents when a text version can be provided;
- review headings and link labels for meaning in context;
- test real content with keyboard navigation, browser zoom, and at least one screen reader before launch.

Each publication remains responsible for reviewing its final identity, content, documents, live deployment, and third-party destinations.
