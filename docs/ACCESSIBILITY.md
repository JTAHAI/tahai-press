# Accessibility and readability

TAHAI Press is built around a simple product rule: **make it easy, make it fast, and make it accessible**. Accessibility is enforced in the editor, the static build, and the reader experience. All features remain static-first and require no user account, analytics service, preference database, or public TAHAI Press attribution.

## Three-layer accessibility model

### 1. Authoring guidance

Editorial Studio reports each check as:

- **Ready** — the item is complete enough for handoff;
- **Needs attention** — an editor should review it;
- **Publication blocker** — export or release should stop until corrected.

The browser-only checks cover missing image descriptions, vague or empty links, identical link labels pointing to different destinations, heading-order problems, overly long headings and paragraphs, all-capital headlines, likely Markdown tables without headers, and unexplained abbreviations. The checks are advisory except for explicit blockers; source verification, rights, privacy, and editorial judgment still belong to the publisher.

Pages CMS also presents plain-language accessibility fields for images and source documents. Published and Scheduled content is validated more strictly than Draft content so unfinished reporting can remain in Git without blocking unrelated work.

### 2. Build-time enforcement

Every generated HTML route is expected to provide:

- a declared language and non-empty browser title;
- one `main` landmark with `id="main"` and focus support;
- a visible-on-focus skip link;
- exactly one `h1`;
- unique IDs and resolvable ARIA references;
- accessible names for controls and dialogs;
- labels for form fields;
- useful image alternative text;
- table headers when tables are present;
- meaningful summaries for native disclosures;
- safe notices for links that open new tabs;
- direct document access when embedded PDF support fails.

Run the audits locally:

```bash
npm run build
npm run audit:a11y
npm run audit:reader
```

`audit:a11y` inspects all generated HTML. `audit:reader` verifies the reader-tools asset, local-only preference behavior, simplified article routes, noindex and canonical handling, document summaries, minimum target sizing, and 400% zoom fallback. The Cloudflare production build runs both audits and stops on failure.

## Reader tools

When `reader_tools_enabled` is true, the masthead provides a native **Reading tools** disclosure. Preferences are stored only in the reader's browser and never sent to the publisher or TAHAI Press.

Available controls:

- smaller, default, or larger text;
- normal, relaxed, or open line spacing;
- narrow, standard, or wide reading measure;
- publication, paper, sepia, dark, or high-contrast surfaces;
- underline all links;
- reduce visual decoration;
- reduce motion;
- reset all preferences.

The underlying article remains ordinary HTML. When JavaScript is disabled, the site keeps the publisher's accessible default styles and all content remains available.

## Simplified reading view

Every public article can generate a simplified route at:

```text
/stories/<slug>/reader/
```

The simplified view:

- removes nonessential publication furniture;
- preserves the headline, summary, byline, article body, structured reporting blocks, and sources;
- omits embedded PDF frames;
- provides direct document links;
- keeps reader tools available;
- uses `noindex` and canonicalizes to the standard article.

This route is an alternative presentation of the same content, not a second indexed article.

## Document-led publishing

A source PDF can be inaccessible even when the surrounding webpage is excellent. Published and Scheduled PDF, mixed, and external-document articles therefore require:

- a plain-language `document_description`; and
- a substantial `document_accessible_summary` rendered as HTML.

The summary should explain the document's purpose, key findings, parties, dates, and limitations in language a reader can understand without opening the file. `document_accessibility_note` can describe known barriers, remediation status, or the availability of another format.

The native PDF viewer remains an optional convenience. Direct open and download links, the HTML summary, print-safe URLs, and the simplified view remain available independently.

## Configurable accessibility settings

`content/site.json` contains:

```json
{
  "accessibility": {
    "statement_enabled": true,
    "contact_email": "editor@example.org",
    "statement_intro": "This publication aims to provide a readable experience...",
    "feedback_note": "When reporting a barrier, include the page address...",
    "reader_tools_enabled": true,
    "simplified_reading_enabled": true,
    "default_link_underlines": false,
    "document_summary_required": true
  }
}
```

Pages CMS exposes these under **Publication settings → Accessibility**. The setup assistant preserves these values when it generates a replacement `site.json`.

## Theme and layout enforcement

Publisher colors remain configurable, but the build rejects combinations that make ordinary text, links, buttons, or control boundaries unreadable. Ordinary text combinations require at least `4.5:1`; core body text is held to a `7:1` enhanced threshold; non-text control boundaries require at least `3:1`.

The stylesheet also includes:

- browser text-size adjustment support;
- readable article measures;
- minimum 44-pixel-equivalent targets;
- long-word and long-URL wrapping;
- responsive behavior through narrow mobile and high zoom;
- `prefers-reduced-motion`, `prefers-contrast: more`, and `forced-colors` handling;
- print-specific document alternatives.

## Editorial responsibilities

The platform cannot determine whether every sentence, image, table, audio clip, video, or source document is accessible and appropriate. Publishers should:

- describe meaningful images by purpose and content;
- keep decorative images out of editorial content or mark them appropriately;
- use headings in a logical order;
- give links descriptive text;
- use real table headers;
- provide captions and transcripts for time-based media;
- remediate documents they control;
- provide an HTML summary for every public record;
- test real content at 200%, 300%, and 400% zoom;
- test keyboard operation and at least one screen reader before launch.

## Public attribution

Apache License 2.0 obligations apply to software source and redistributed source distributions. TAHAI Press does not require a public banner, powered-by line, footer credit, logo, backlink, hidden link, or other visible project attribution on generated publisher pages. When `template_mode` is disabled, the public surface is the publisher's own.

## Reader Reach accessibility

Reader Reach is progressive enhancement over normal links and pages:

- Save controls expose an `aria-pressed` state and announce save or removal results.
- Share controls announce whether the share sheet opened or the link was copied.
- Install controls are hidden until the browser exposes a valid installation prompt.
- `/saved/` has a real no-JavaScript explanation and supports removing one record or clearing the list.
- `/offline/` provides clear recovery routes and a connection-status message.
- `/edition/` uses an ordered list, remains readable without JavaScript, and has a grayscale-safe print layout.

Browser-local data is not synchronized. Clearing site data removes saved stories and reader preferences; the interface should never imply otherwise.
