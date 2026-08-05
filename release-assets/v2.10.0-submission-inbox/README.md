# TAHAI Press v2.10.0 — Forms and Private Submission Inbox

This directory publishes the verified release record for the optional TAHAI Press v2.10.0 Cloudflare newsroom service.

## Compatibility boundary

The cumulative overlay requires TAHAI Press `>=2.9.0` and `<3.0.0`. The repository `main` branch remains on an older baseline, so this record is intentionally artifact-only and must not be interpreted as applying v2.10.0 application source to `main`.

## Capabilities

- Contact forms
- Public-record tips
- Contributor proposals
- Server-side Turnstile validation
- Exact-origin CORS
- Optional salted-hash rate limiting
- Private D1 inbox
- Optional R2 attachments
- Attachment signature and checksum verification
- Editorial status workflow
- JSON and NDJSON exports
- Private attachment downloads
- Record deletion and scheduled retention purge
- Redacted operational logs
- Three accessible static form templates

## Verification

- 124/124 cumulative tests passed
- Two clean extractions passed
- Deterministic overlay reproduction passed
- Doctor and release verifier passed
- Public-reader isolation passed
- No embedded secrets or wildcard CORS detected

## Dependency boundary

The service pins Hono `4.12.32` and Wrangler `4.113.0`. The verification environment's internal package mirror returned 404 for those packages, so no claim is made that the Hono/Wrangler runtime was locally installed or deployed. The framework-independent service layer, adapter syntax, route operations, schemas, migration source, security boundaries, and cumulative tests were verified.

Before production deployment, integrate this overlay with the latest cumulative TAHAI Press source, run `npm install`, commit the generated lockfile, run local Wrangler/D1 tests, and complete a deployed Cloudflare smoke test.

## Primary artifacts

- `TAHAI_PRESS_V2.10.0_FORMS_PRIVATE_SUBMISSION_INBOX_OVERLAY.zip`
  - SHA-256: `b5744b80d17769bcb7170b951e5ee8a61708780d293b69f21111c2743bd5fe8e`
- `TAHAI_PRESS_V2.10.0_SUBMISSION_INBOX_WORKER_SOURCE.zip`
  - SHA-256: `0ce2223c13f759c7be40bc82f583d99f90546f14f96dffe95e97fa000ebb1a38`
- `TAHAI_PRESS_V2.10.0_FORMS_PRIVATE_INBOX_PROOF_BUNDLE.zip`
  - SHA-256: `ddee0891747128f408cc76258d81464f899fdeca784f84a5d99a1f0f34a59a86`

The exact worker-source ZIP is stored in this directory as Base64 text with Windows and Unix reconstruction scripts. Verify every reconstructed artifact against `SHA256SUMS.txt` before use.
