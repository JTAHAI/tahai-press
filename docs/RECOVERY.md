# Recovery and transfer

Run `node scripts/recovery.mjs create` to make a deterministic, checksum-verified private safety copy under `.artifacts/recovery/`. It includes publisher content and published theme packages only; it never enters `dist/` or a public release package.

`node scripts/recovery.mjs restore` verifies the archive and every staged file before atomically replacing each included top-level directory. Review the backup and commit state before restoring. Cloudflare account recreation, deployment rollback, and domain changes remain account-owner operations.
