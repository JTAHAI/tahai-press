# Pages CMS setup and operating contract

Pages CMS is the optional browser-based editor for this starter. It edits the repository files directly through GitHub. It does not introduce a separate content database, media database, API, or server process.

## Connect a fork

1. Create or fork a GitHub repository containing this project.
2. Keep `.pages.yml` at the repository root.
3. Sign in to the hosted Pages CMS application with the GitHub account that owns or can edit the repository.
4. Install the Pages CMS GitHub App for only the repository or organization that should be editable.
5. Open the repository and select the branch used for publishing.
6. Confirm the sidebar shows **Publishing**, **Publication data**, and **Site settings**.

For the simplest owner-operated setup, Pages CMS may write directly to `main`. The included automation also supports safer review branches and Cloudflare preview deployments before merging into production.

## What the CMS may edit

- `content/articles/*.json`
- `content/authors/*.json`
- `content/categories/*.json`
- `content/hubs/*.json`
- `content/site.json`
- `content/redirects.json`
- images under `public/uploads/images/`
- PDFs under `public/uploads/documents/`

The CMS configuration intentionally does not expose workflow files, build scripts, environment files, deployment credentials, or security policy files. It exposes bounded previous-URL and manual static-redirect fields because those are editorial migration data.

## Draft-first behavior

New articles start as `draft`. Draft and archived entries stay in Git history but are excluded from the generated public site.

A draft may be incomplete. Editors can save a headline and slug first, then return later for the body, source document, metadata, and publication checks. Missing format-specific fields produce warnings for drafts instead of blocking unrelated site builds.

Switching an entry to `published` activates strict validation. A published record must have:

- a usable headline and summary;
- a publication date and time;
- a valid author and at least one category;
- all content required by the selected article format;
- useful alternative text when a featured image is present;
- all three publication review confirmations.

A failed production validation does not make an incomplete article public. The previous successful Cloudflare deployment remains available while the content is corrected.

## Article filename and URL safety

Pages CMS creates article filenames from the explicit `slug` field:

```text
content/articles/example-story.json
```

That becomes:

```text
/stories/example-story/
```

The CMS hides its separate filename input so an editor cannot accidentally create a filename that disagrees with the public slug. Changing an existing slug changes the public URL. Add the former address to `legacy_urls` before the change; the build generates and validates the permanent redirect.

## Media behavior

Images and PDFs use separate media sources. Uploads are renamed safely and stored at predictable public paths.

```text
public/uploads/images/
public/uploads/documents/
```

The document picker accepts PDF files only. Cloudflare Pages currently limits an individual deployed asset to 25 MiB, so a larger file should remain on an external document host or use a deliberate object-storage workflow such as Cloudflare R2.

Do not upload credentials, private discovery material, unredacted personal identifiers, medical records, private child information, or any file the publication does not have the right to share.

## Publication review confirmations

Every published article requires these fields to be true:

- `review_content`: public text, names, dates, source descriptions, and links were checked;
- `review_rights`: publishing rights and unintended private information were checked;
- `review_accessibility`: image descriptions, document title, direct file access, and mobile fallbacks were checked.

These confirmations are editorial gates, not legal guarantees. They create a deliberate pause before a status change becomes public.

## Private editor notes

`editor_notes` are stored in Git but are never rendered by the site generator. They are suitable for brief workflow notes, not secrets or highly sensitive personal information. Anyone with repository access may read Git history.

## Configuration verification

Run:

```bash
npm run validate:cms
```

The dependency-free contract validator checks the critical CMS paths, draft defaults, safe filename behavior, article field parity, media restrictions, and publication review fields.

For an additional syntax check on a workstation with Ruby installed:

```bash
ruby -e 'require "yaml"; YAML.load_file(".pages.yml"); puts "YAML valid"'
```


## Redirect editing

Use **Previous article URLs** on an article for old addresses that should lead to that article. Use **Site settings → Manual redirects** only for non-article pages. The build rejects query-bearing sources, fragments, wildcards, placeholders, duplicates, chains, loops, source collisions, and missing internal destinations.

The manual `preserve_query_string` switch applies to the optional Bulk Redirect CSV export. It is not an additional capability of the Pages `_redirects` syntax.
