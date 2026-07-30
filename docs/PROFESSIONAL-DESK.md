# Professional Desk

TAHAI Press Professional Desk adds the editorial signals readers expect from a serious publication while preserving the platform's static-first architecture.

It does not add reader accounts, an application database, analytics, a hosted editorial service, or a paid dependency. Editors continue to work with ordinary repository files through Pages CMS or the browser-only Editorial Studio.

## Product principles

- **Make it easy.** Put the common editorial decisions in plain language.
- **Make it fast.** Reuse structured fields instead of repeatedly formatting trust information by hand.
- **Make it accessible.** Never rely on color alone, preserve semantic headings, and keep citations, histories, and related coverage keyboard and screen-reader accessible.
- **Keep the publisher in control.** All classifications, histories, series, citations, and section fronts are generated from publisher-owned files.

## Article classifications

Every Scheduled or Published article requires one classification:

| Value | Reader-facing label | Intended use |
| --- | --- | --- |
| `news` | News | Verified reporting about events, decisions, and public activity |
| `analysis` | Analysis | Evidence-based interpretation that goes beyond a straight event report |
| `opinion` | Opinion | A clearly labeled viewpoint or argument |
| `investigation` | Investigation | Sustained original reporting based on documents, interviews, or data |
| `public-record` | Public Record | Source-centered publication of filings, records, reports, and evidence |
| `explainer` | Explainer | Background, process, or context written for reader understanding |
| `interview` | Interview | Question-and-answer or conversation-led reporting |
| `announcement` | Announcement | A clearly identified notice from the publication or another named source |
| `developing` | Developing | Active coverage expected to change as facts are verified |

The classification appears as text on cards and article pages, contributes to browser search, is included in structured metadata, and links to a generated section front under `/sections/`.

Drafts may omit a classification while work is incomplete. The release validator blocks Scheduled and Published articles until one is selected.

## Series and continuing coverage

Use a series when multiple stories belong to one sustained reporting project, investigation, public-record collection, or recurring package.

Fields:

- `series_slug` creates the permanent series route.
- `series_title` is the visible name.
- `series_description` explains the project to readers.
- `series_order` controls reading order within the series.

The build groups matching articles into a generated series page under `/series/<series-slug>/`. It rejects conflicting titles, conflicting descriptions, duplicate order numbers, and incomplete series records before deployment.

A series is not a category replacement. Categories organize the newsroom broadly; series identify a specific body of connected coverage.

## Related coverage

`related_articles` accepts article slugs from the same publication. The build verifies that each reference resolves to a public article and prevents an article from linking to itself.

Use related coverage selectively. Two or three directly useful links are usually better than a large automated list.

## Corrections, updates, and publication history

Professional Desk keeps public changes explicit.

- `what_changed` gives readers a concise current summary when an article has been materially revised.
- `update_history` records dated additions, clarifications, and substantial revisions.
- `corrections` records dated corrections to previously published information.
- `updated_at` controls the visible last-updated date when the public record meaningfully changed.

Each history entry includes a date and plain-language explanation. The build presents corrections separately from ordinary updates and preserves the underlying file history in Git.

Do not use a correction entry for spelling or typographic cleanup that did not change meaning. Do not silently replace materially incorrect reporting without recording the correction.

## Methodology, disclosure, and reuse

The trust desk can display:

- `methodology` — how the reporting, records review, interviews, or analysis were conducted;
- `disclosure` — relevant relationships, limitations, conflicts, or editorial context;
- `rights_and_reuse` — publication-specific reuse, quotation, syndication, or licensing guidance.

These fields are optional because not every short news item needs a methodology statement. They are particularly useful for investigations, analysis, data work, public-record packages, and opinion.

## Permanent citation

Every public article receives a generated citation based on the publisher name, article title, publication date, canonical URL, and available contributor information.

The article page includes:

- a visible citation;
- **Copy citation**;
- **Copy link**;
- the canonical article address.

Copy actions use local browser APIs only. They do not contact a third-party service and the citation remains readable when JavaScript is unavailable.

## Pages CMS workflow

1. Create or open an article.
2. Choose the article classification.
3. Add series information only when the story belongs to a defined package.
4. Add a small number of directly relevant article slugs under related coverage.
5. Add methodology, disclosure, and reuse notes where they improve reader understanding.
6. Record meaningful updates and corrections in publication history.
7. Complete the ordinary content, rights, and accessibility review gates.
8. Preview the public article and its section or series front before release.

## Accessibility behavior

- Classifications are visible text and never color-only.
- Update and correction histories use semantic headings and lists.
- Copy buttons have explicit labels and status feedback.
- Section and series fronts retain one page heading and logical card headings.
- Related coverage uses descriptive article titles rather than generic link text.
- The same trust information remains available in simplified article views.
- Print layouts keep the citation and correction history readable.

## Generated routes

```text
/sections/
/sections/<classification>/
/series/
/series/<series-slug>/
/stories/<article-slug>/
/stories/<article-slug>/reader/
```

Only classifications and series containing public articles receive public detail routes.

## Validation commands

```bash
npm run validate
npm test
npm run build
npm run audit:a11y
npm run verify:dist
```

The generator remains the source of truth. Pages CMS makes the fields easier to edit, but it cannot bypass the release contract.
