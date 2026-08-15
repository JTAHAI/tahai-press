# GA release gates

Run `npm run verify:ga` from a clean checkout to create the authoritative local GA report at `.artifacts/ga-gate-report.json`.

The command verifies clean installation, content validation, the root suite, build and reader audits, public distribution, smoke and release evidence, security and production dependency audit, themes, evidence records, portable transfer and release packages, optional Worker and collaboration packages, and the real Chromium/Firefox/WebKit matrix. It stops at the first failed gate and preserves command output in the report.

`npm run verify:ga -- --skip-install` is a diagnostic shortcut only. It is not acceptable as a clean-install GA proof.
