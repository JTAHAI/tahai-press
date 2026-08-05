# TAHAI Press v2.10.0 — Forms and Private Submission Inbox

TAHAI Press v2.10.0 adds a fully optional Cloudflare newsroom service for public contact, public-record tips, and contributor proposals. The publication remains static-first and fully usable when the service is not installed or deployed.

## Included

- Hono-based Cloudflare Worker adapter
- Framework-independent, testable submission service core
- D1 schema and migration
- Optional R2 attachment storage
- Server-side Turnstile verification with hostname and action enforcement
- Exact-origin CORS policy
- Optional salted-hash rate-limiter binding
- Three accessible form templates
- Private list, detail, status, export, attachment-download, deletion, and purge routes
- JSON single-record and NDJSON batch exports
- Retention expiry and scheduled deletion
- Redacted operational logs
- Security model, operator runbook, schemas, doctor, verifier, tests, and Windows overlay installer

## Attachment limits

Records-tip and contributor forms may accept up to three allow-listed files, no larger than 5 MiB each or 10 MiB combined. Contact forms do not accept files. Filename extension, MIME declaration, and file signature are checked before private R2 storage. Downloads are checksum-verified.

## Dependency state

The service pins Hono 4.12.32 and Wrangler 4.113.0 exactly. The verification environment's internal package mirror did not contain either package, so the Hono/Wrangler runtime was not falsely reported as installed. The complete service core, route operations, schemas, migration source, adapter syntax, security boundaries, and cumulative product suite were tested independently. The integrated repository must run `npm install`, commit the generated lockfile, execute local Wrangler/D1 tests, and perform a deployed smoke before production use.

## Verification

- 124 cumulative tests passed
- Submission service doctor passed
- Release verifier passed
- All JavaScript sources parsed
- Clean extraction and deterministic packaging passed
- Public output isolation passed
- No embedded secrets or wildcard CORS detected
