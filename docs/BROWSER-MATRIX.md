# Browser matrix proof

Run `npm run verify:browsers` after a normal build. The command starts an owned, loopback-only static server on an ephemeral port, then uses locally provisioned Playwright Chromium, Firefox, and WebKit engines against the public generated site.

Every engine checks the home page, a Pagefind-ranked search query, the route-scoped PDF reader markup and direct-download fallback, and a public evidence record. Pagefind is explicitly initialized as a same-origin main-thread instance: the publication's small static index remains locally ranked without relying on a browser-specific Worker lifecycle. It fails on page errors, console errors, or horizontal overflow on the home and search pages. Screenshots and the JSON result are written under ignored `.artifacts/browser-matrix/` and `.artifacts/browser-matrix.json`.

The matrix does not send content to external services, use publisher credentials, or test private newsroom routes.
