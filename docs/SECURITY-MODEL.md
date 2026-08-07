# Security model

TAHAI Press is static-first. Public reader delivery does not require a database, account system, analytics profile, or private operator service. Public content is generated from reviewed source files; drafts, inboxes, import transactions, recovery state, editor notes, and optional service configuration are excluded from `dist/`.

The optional Worker and collaboration services are isolated packages. They are not reader dependencies. Their deployment requires owner-provided credentials and explicit account configuration; public forms use exact-origin CORS and private operations require authorization.

Run `node scripts/create-security-report.mjs` after a build. It scans source for credentials/private keys and generated output for private operational paths and editor fields, inventories locked dependencies, and fails on findings.
