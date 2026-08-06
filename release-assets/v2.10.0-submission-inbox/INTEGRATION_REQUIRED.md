# Integration Required

This release record is not a production deployment.

Before enabling the service:

1. Integrate the cumulative overlay into the latest TAHAI Press source (`>=2.9.0`, `<3.0.0`).
2. Install the pinned Hono and Wrangler dependencies from an accessible registry.
3. Generate and commit the lockfile.
4. Create and bind the D1 database.
5. Optionally create and bind the private R2 bucket and rate-limit KV namespace.
6. Configure the exact public origin, Turnstile secret, expected hostname/action, and admin bearer token.
7. Run local Worker, D1 migration, Turnstile, attachment, export, deletion, and retention tests.
8. Perform a deployed Cloudflare smoke test before accepting real submissions.

The static publication remains fully functional when this optional service is absent.
