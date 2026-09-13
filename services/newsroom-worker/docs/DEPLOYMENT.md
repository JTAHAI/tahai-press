# Optional Newsroom Worker

This Worker is not part of the static publication build. Set `PUBLIC_ORIGIN`, secret `OPERATOR_TOKEN`, and a real D1 database ID before deployment. Apply `migrations/0001_inbox.sql`, run `npm ci --ignore-scripts && npm test`, then deploy with a locally installed Wrangler after reviewing the account and project target.

Rollback is the Cloudflare deployment rollback plus a retained database backup. Teardown requires deleting the Worker deployment, D1 database, and any bindings in the owner’s account. The Worker stores only submitted contact content; it does not receive or store reader preferences, saved-story state, analytics identifiers, or browsing history.
