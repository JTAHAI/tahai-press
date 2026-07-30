# Quick Start

## Fastest nontechnical path

1. Deploy the repository to Cloudflare Pages.
2. Open `/setup/` and choose **Start here**.
3. Follow the seven short launch steps; each screen presents one primary action.
4. Use **Recommended settings** whenever the safe default fits.
5. Review the live publication preview before applying anything.
6. Download a backup before the launch change.
7. Download the launch package or apply it directly to a local repository in a supported browser.
8. Commit the generated publication identity and first draft, then publish through Pages CMS.

The Launch Desk keeps setup progress and undo history in the current browser. It sends no configuration or draft data to TAHAI Press, analytics, or another service. See [LAUNCH-DESK.md](LAUNCH-DESK.md).

```bash
git clone https://github.com/JTAHAI/tahai-press.git
cd tahai-press
npm run ci
npm run preview
```

Open `http://localhost:8788/setup/`.

For Cloudflare Pages use:

```text
Build command: npm run build:cloudflare
Output directory: dist
Node version: 22
```

### Apply a downloaded launch package

The browser can download `tahai-press-launch-package.json`. Apply it from the repository root with:

```bash
npm run launch:apply -- --package ./tahai-press-launch-package.json --confirm
```

The command creates a timestamped backup under `.artifacts/`, replaces the demonstration identity, removes the sample stories, writes the first draft and editorial-team record, and leaves the result uncommitted for review.

## Try Editorial Studio

After the first build, open:

```text
http://localhost:8788/studio/
```

Draft a Quick Story, review the readiness checklist, and download the JSON file. Copy it into `content/articles/`, then run:

```bash
npm run validate
npm run build
```

Open the record through Pages CMS or edit the JSON to add sources, review confirmations, structured story blocks, and the final publication status.

## Check the accessibility experience

After the first build:

1. Open any article and expand **Reading tools**.
2. Test larger text, open line spacing, a narrow measure, high contrast, and link underlines.
3. Open the article's **Simplified view**.
4. Open a PDF-led sample and confirm that the HTML document summary is useful without the PDF frame.
5. Run:

```bash
npm run audit:a11y
npm run audit:reader
```

Before publishing a real document-led story, complete both its document description and accessible HTML summary in Pages CMS.

## Save or reopen contributor drafts

Editorial Studio automatically keeps the current draft in the browser. Use **Save local copy** for a named snapshot, or **Open article JSON** to reopen a contributor package. The local draft desk requires no account and does not send the article anywhere.

See [CONTRIBUTOR-COMPOSER.md](CONTRIBUTOR-COMPOSER.md).

## Review operational health

Run the complete proof:

```bash
npm run ci
```

Then open the private local report:

```text
.artifacts/newsroom-health/index.html
```

The report shows article-state counts, due scheduled content, media warnings, performance status, launch readiness, and maintenance lists. It is never copied to the public site.

Individual checks are also available:

```bash
npm run audit:media
npm run audit:performance
npm run newsroom:health
```

See [OPERATIONS.md](OPERATIONS.md).

## Edit crossword editions

Open **Crossword desk** in Pages CMS or edit `content/crosswords/*.json`. Keep new editions inactive until:

```bash
npm run validate
npm test
```

The public player remains static, stores progress locally, and requires no puzzle-provider account. See [CROSSWORD.md](CROSSWORD.md).

## Test Reader Reach

After `npm run preview`, visit:

```text
http://localhost:8788/edition/
http://localhost:8788/saved/
http://localhost:8788/offline/
```

Service-worker installation requires a secure context. `localhost` is accepted by modern browsers for development; the production test should use the real HTTPS Pages deployment. Open an article, choose **Save story**, confirm it appears under `/saved/`, test the browser Share control or copy fallback, print `/edition/`, then switch the browser offline and revisit a cached route.
