# Git-connected publishing and deployment

TAHAI Press uses Cloudflare Pages' native Git integration for deployment and GitHub Actions for independent release proof. The repository contains no Cloudflare API token, deploy key, database credential, or custom deployment bot.

## Why this split is deliberate

Cloudflare Pages owns the actual preview and production deployment. GitHub Actions independently validates the same source, builds the static output, performs HTTP smoke checks, and publishes a downloadable proof artifact. A failed validation exits non-zero and blocks the Cloudflare build when `npm run build:cloudflare` is used.

The publishing path is:

```text
Pages CMS or a Git commit
        ↓
feature branch / pull request
        ↓
GitHub quality proof + Cloudflare preview
        ↓
review the preview
        ↓
merge to main
        ↓
Cloudflare production build + GitHub production-readiness artifact
```

## One-time Cloudflare Pages setup

1. Put the starter in a GitHub repository.
2. In Cloudflare, create a **Pages** project using **Connect to Git**.
3. Select the repository and use the values in `deployment/cloudflare-pages.json`:
   - Framework preset: `None`
   - Production branch: `main`
   - Root directory: repository root
   - Build command: `npm run build:cloudflare`
   - Build output directory: `dist`
4. Set `NODE_VERSION=22` and `PUBLICATION_PRODUCTION_BRANCH=main` if the dashboard does not inherit the checked-in `.node-version` and default branch value.
5. Leave preview branch deployments enabled for branches created inside the repository.
6. Do not place API tokens, passwords, or private source records in build environment variables unless a later fork truly requires them.

The checked-in `deployment/cloudflare-pages.json` is a human- and test-readable setup contract. Cloudflare does not automatically consume that file.

## Preview behavior

When Cloudflare provides `CF_PAGES=1` and the current branch differs from `PUBLICATION_PRODUCTION_BRANCH`, the build automatically:

- adds `noindex,nofollow` to every generated HTML page;
- replaces `robots.txt` with a site-wide crawl block;
- records `preview`, branch, short commit, and deployment URL in public build metadata;
- preserves all normal routes and direct PDF fallbacks for review.

This prevents a temporary branch URL from competing with the real publication in search results. It does not make a preview private. Use Cloudflare Access or another access-control feature when preview content must be confidential.

## Production promotion

A change becomes production content only after it reaches the configured production branch. The recommended path is:

1. create or edit content on a branch;
2. wait for **Quality checks** and the Cloudflare preview status;
3. open the preview URL and inspect the affected pages;
4. merge the pull request into `main`;
5. confirm both the Cloudflare production deployment and **Production readiness** workflow are green.

Pages CMS may be configured to commit directly to `main`, but a branch-and-review workflow is safer for publications with more than one editor. Direct-to-main editing remains supported because the deployment build still runs validation, tests, generation, and output verification before Cloudflare uploads anything.

## Build and deployment proof

`npm run ci` performs:

1. content validation;
2. Pages CMS contract validation;
3. redirect and canonical-source validation;
4. all automated tests;
5. static generation;
6. deployment-output verification;
7. HTTP-level route and redirect smoke checks;
8. an exact SHA-256 release manifest.

The generated site exposes two intentionally public operational files:

- `/.well-known/publication-health.json` — small health and article-count record;
- `/.well-known/publication-build.json` — build environment, branch, short commit, output type, redirect digest, and Node version;
- `/.well-known/publication-redirects.json` — generated rule count and SHA-256 digest.

Neither file includes secrets, GitHub tokens, Cloudflare account identifiers, private editor notes, or full environment dumps.

## GitHub workflow artifacts and notifications

The two checked-in workflows upload `dist/` and `release-proof/` as immutable artifacts tied to the commit SHA. They also write a concise run summary. GitHub's normal Actions and repository notification settings provide build-failure notifications without adding a third-party alerting service.

Recommended repository settings:

- watch **Actions** failures or enable email notifications for failed workflows;
- require the **Validate, test, build, and smoke** check before merging;
- require the Cloudflare Pages preview/deployment check before merging once it appears in the repository;
- keep production changes flowing through `main`.

Configure branch protection, required checks, least-privilege repository access, and account multi-factor authentication before production launch.

## Rollback

Use the least disruptive rollback that matches the incident.

### Immediate Cloudflare rollback

In the Pages project, open **Deployments**, select the last known-good production deployment, and choose **Rollback**. A preview deployment is not a valid production rollback target.

This restores service quickly but does not change the repository. Follow it with a Git correction so the next deployment does not reintroduce the bad state.

### Repository rollback

For an auditable source correction:

```bash
git log --oneline
git revert <bad-commit-sha>
git push origin main
```

Prefer `git revert` over rewriting public history. Cloudflare will build the revert as a new production deployment.

### Content-only recovery

When only one article is wrong, restore that article JSON or media file from Git history, validate it, and commit the correction. Do not roll back unrelated stories unless the incident affects the whole build.

## Failure triage

- **Content validation failed:** fix the named JSON field or publishing review gate.
- **CMS validation failed:** reconcile `.pages.yml`, schema, and validator expectations.
- **Tests failed:** open the failing test name; the public site is not safe to deploy yet.
- **Output verification failed:** inspect broken internal paths, canonical mismatches, redirect drift, leaked private notes, oversized assets, or missing required files.
- **Smoke proof failed:** rebuild locally and inspect the route, PDF, health endpoint, or 404 behavior named in the error.
- **GitHub green but Cloudflare failed:** compare Cloudflare's Node version, build command, output directory, and branch environment variables with `deployment/cloudflare-pages.json`.
- **Cloudflare green but the domain is stale:** inspect the active production deployment and custom-domain association before changing DNS.

## Local production-equivalent proof

```bash
npm run ci
npm run preview
```

To simulate Cloudflare preview indexing controls locally:

```bash
CF_PAGES=1 \
CF_PAGES_BRANCH=preview-test \
CF_PAGES_COMMIT_SHA=0123456789abcdef0123456789abcdef01234567 \
PUBLICATION_PRODUCTION_BRANCH=main \
npm run build

npm run verify:dist
```

On PowerShell, set the variables through `$env:` before running the same commands.
