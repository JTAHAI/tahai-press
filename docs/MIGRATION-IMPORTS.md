# Migration and bulk import guide

TAHAI Press provides dependency-free migration tools for WordPress exports, Markdown, JSON, CSV, and folders of PDFs. The importer does not scrape websites, fetch remote media, or publish unreviewed material automatically. It records legacy URLs in draft article data; only the later validated build can emit redirects for Published destinations.

## Safety model

The default import contract is deliberately conservative:

- imported records are `draft`;
- imported records are `noindex`;
- content, rights/privacy, and accessibility review confirmations are false;
- existing article slugs are skipped rather than replaced;
- WordPress attachments and inline images are not downloaded;
- private source files belong in ignored `imports/inbox/`;
- reports belong in ignored `imports/reports/`;
- every import produces an itemized result and a legacy URL map when source URLs exist;
- source URLs are also stored in the normalized article `legacy_urls` list for explicit review.

An operator may explicitly use `--status published --mark-reviewed`. That acknowledgement means the operator accepts responsibility for the imported content, rights, privacy, accessibility, metadata, and links. It is not a substitute for reviewing the migration.

## First run

```bash
npm run import:help
npm run import -- --input imports/inbox --dry-run --write-dry-run-report
```

Review `imports/reports/import-report.json`, correct source issues, then run the import without `--dry-run`.

```bash
npm run import -- --input imports/inbox --conflict skip
npm run validate
npm test
npm run build
```

## Supported inputs

### WordPress WXR/XML

Export the site through WordPress **Tools → Export**, place the XML file in `imports/inbox/`, then run:

```bash
npm run import -- --type wordpress --input imports/inbox/export.xml --dry-run --write-dry-run-report
```

The importer reads posts and pages, preserves titles, slugs, article text, excerpts, dates, tags, legacy IDs, and original URLs. WordPress categories are retained as topic tags while the starter's configured default category is assigned. Attachments are ignored and inline image/shortcode warnings are surfaced in the report. A recipient-specific media migration should be handled separately with the owner's permission.

### Markdown

Markdown may be a single file or a recursive folder. Optional YAML-like frontmatter supports common fields such as `title`, `slug`, `published_at`, `tags`, `excerpt`, `author`, and `article_type`.

```bash
npm run import -- --type markdown --input imports/inbox/markdown
```

### JSON

JSON may be one article, an array, or an object containing `articles`, `posts`, or `items`. Common field aliases such as `summary`, `content`, `date`, and `document_url` are normalized.

```bash
npm run import -- --type json --input imports/inbox/articles.json
```

### CSV

CSV supports quoted commas, escaped quotes, and multiline fields. The example header in `imports/examples/articles.csv` is a practical starting point.

```bash
npm run import -- --type csv --input imports/inbox/articles.csv
```

### PDF folder

Every valid `.pdf` file becomes a document-first draft. The importer verifies the PDF signature, copies the file with a slug plus content hash, and records its SHA-256 digest and size in the report.

```bash
npm run import -- --type pdf --input imports/inbox/documents
```

### Mixed folder

With `--type auto`, a directory is scanned recursively for `.xml`, `.md`, `.markdown`, `.json`, `.csv`, and `.pdf` files.

```bash
npm run import -- --input imports/inbox --type auto
```

## Collision policies

- `--conflict skip` is the default and never changes an existing article.
- `--conflict suffix` creates `slug-2`, `slug-3`, and so on.
- `--conflict overwrite` replaces an article with the same slug and should only be used after a reviewed dry run and repository backup.

PDF filenames include a content hash, so repeated copies of the same source remain stable and auditable.

## Defaults

```bash
npm run import -- \
  --input imports/inbox/export.xml \
  --author editorial-team \
  --category community-reporting \
  --hub primary-coverage \
  --status draft
```

The referenced author, category, and hub must already exist in `content/`. Validation catches missing references before deployment.

## Report contract

The JSON report includes:

- discovered, planned, imported, skipped, failed, planned-asset, and copied-asset counts;
- source type and source path for every record;
- selected slug and generated route;
- warnings and errors;
- copied PDF size and SHA-256 digest;
- original URL to new route mappings and the article aliases used by the redirect-preservation build.

The importer intentionally does not write `dist/_redirects`. Imported URLs are stored on article records, and the normal build generates redirect rules only after those destinations are Published and all redirect and canonical checks pass. See `docs/URL-REDIRECTS.md`.
