# Security model

TAHAI Press is static-first. Public reader delivery does not require a database, account system, analytics profile, or private operator service. Public content is generated from reviewed source files; drafts, inboxes, import transactions, recovery state, editor notes, and optional service configuration are excluded from `dist/`.

The optional Worker and collaboration services are isolated packages. They are not reader dependencies. Their deployment requires owner-provided credentials and explicit account configuration; public forms use exact-origin CORS and private operations require authorization.

Run `node scripts/create-security-report.mjs` after a build. It scans source for credentials/private keys and generated output for private operational paths and editor fields, inventories locked dependencies, and fails on findings.

## Edge delivery policy

Every generated deployment includes a deterministic Cloudflare `_headers` policy. It applies a same-origin Content Security Policy (including the narrowly required Pagefind WebAssembly capability), clickjacking protection, MIME sniffing prevention, restrictive browser permissions, cross-origin isolation defaults, and strict referrer handling. Template and preview builds also receive an `X-Robots-Tag` crawl block. Public build, health, integrity, and robots records are explicitly `no-store` so deployment checks cannot read a stale release identity.

The build emits `/.well-known/publication-integrity.json` with byte counts and SHA-256 digests for the reader shell and core assets. Its digest is recorded in `publication-build.json` and `publication-health.json`. This is an integrity attestation, not a signature or a substitute for account security.
