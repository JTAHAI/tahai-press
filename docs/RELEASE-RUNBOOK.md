# Release runbook

## Before merge

1. Confirm the article is intentionally **Published**, not Draft or Archived.
2. Confirm sources, rights/privacy, and reader-access review gates are complete.
3. Run `npm run ci` or wait for the GitHub quality workflow.
4. Open the Cloudflare Pages preview and check the changed route on desktop and mobile.
5. Confirm direct PDF open/download behavior when the article includes a document.

## Promote

Merge the reviewed branch into `main`. Cloudflare Pages deploys `main` as production, while GitHub creates a commit-addressed production-readiness artifact.

## Confirm

- Production deployment is green.
- `/.well-known/publication-health.json` returns `ok: true`.
- The affected public route loads.
- The article appears in the archive when it should.
- Draft or archived material does not appear.

## Roll back

1. Roll Cloudflare Pages back to the last known-good production deployment for immediate recovery.
2. Revert or correct the repository commit.
3. Allow the corrected `main` build to become the new production deployment.
4. Record what failed and add a regression test when appropriate.
