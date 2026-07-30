# Operational health

TAHAI Press keeps routine maintenance visible without adding a dashboard service, database, analytics account, or paid monitoring product. The operational reports are generated locally and in GitHub Actions, written under `.artifacts/`, and never copied into the public `dist/` directory.

The operating principle is the same as the publishing principle:

> Make it easy. Make it fast. Make it accessible.

## One-command proof

Run:

```bash
npm run ci
```

That command validates content and Pages CMS, runs the full test suite, audits media, builds the site, audits generated accessibility and reader behavior, enforces performance budgets, creates the private newsroom report, verifies the deployable output, performs an HTTP smoke test, and writes release proof.

## Private newsroom-health report

Run:

```bash
npm run newsroom:health
```

The command writes:

```text
.artifacts/newsroom-health/index.html
.artifacts/newsroom-health/report.json
```

Open the HTML file locally or download the `newsroom-health` GitHub Actions artifact. It summarizes:

- published, draft, scheduled, and archived article counts;
- scheduled articles that are already due;
- articles that may be stale according to the configured review period;
- media warnings;
- performance-budget status;
- launch-readiness status;
- articles without related coverage or a featured image;
- the current attention list.

The report is intentionally private. `scripts/verify-dist.mjs` and the test suite reject any accidental publication of `.artifacts/` content.

## Media health

Run:

```bash
npm run audit:media
```

The audit inventories files under `public/uploads/` and compares them with references in publication settings, author records, articles, structured image blocks, galleries, PDFs, and document cards.

It reports:

- missing referenced uploads;
- unused uploads;
- exact duplicate files by SHA-256;
- image dimensions when the file format can be decoded locally;
- large images above 2 MiB;
- large documents above 20 MiB;
- the Cloudflare Pages 25 MiB individual-file boundary;
- image files whose dimensions could not be determined.

The build runs this audit in strict mode. Missing files and unsafe deployment sizes should be corrected before publishing. Orphaned or duplicate media remain cleanup guidance rather than silently deleting editorial material.

The machine-readable report is:

```text
.artifacts/media-health.json
```

## Performance budgets

Run:

```bash
npm run audit:performance
```

Budgets are configured in `content/site.json`:

```json
{
  "operations": {
    "stale_article_days": 730,
    "performance_budgets": {
      "homepage_html_bytes": 307200,
      "stylesheet_bytes": 256000,
      "javascript_total_bytes": 512000,
      "search_index_bytes": 2097152,
      "generated_file_count": 20000,
      "individual_file_bytes": 26214400
    }
  }
}
```

The audit measures:

- homepage HTML;
- the main stylesheet;
- total public JavaScript;
- the static search index;
- generated file count;
- total generated size;
- largest individual generated file.

A deployment fails when a configured budget is exceeded. This makes growth deliberate: raise a limit only after reviewing why the publication needs the additional weight.

The machine-readable report is:

```text
.artifacts/performance-audit.json
```

## GitHub Actions artifacts

The included quality and production workflows preserve the operational reports with the release proof. Maintainers can download them from the workflow run without exposing them on the publication.

The workflows require only the repository and GitHub Actions already used by TAHAI Press. They do not require an external monitoring account.

## Recommended routine

### Before each release

```bash
npm run ci
```

Review any failures and inspect the newsroom-health report when it lists attention items.

### Monthly

- remove confirmed unused uploads;
- resolve duplicate media when the copies are accidental;
- review due scheduled stories;
- check articles marked as potentially stale;
- confirm that performance budgets still pass;
- review the Cloudflare deployment history and a current production page.

### Before raising a budget

1. Inspect the largest-files list in the performance report.
2. Compress or replace unusually large media.
3. Remove unused scripts or styles.
4. Confirm that the larger limit is an editorial requirement rather than an accidental regression.
5. Commit the budget change with a clear explanation.

## No automatic deletion

TAHAI Press never deletes media, changes articles, or publishes scheduled content merely because an audit found an issue. Audits report; editors decide. The separate `publish:due` workflow is the only automated content-state change, and it operates only on complete articles explicitly marked Scheduled.
