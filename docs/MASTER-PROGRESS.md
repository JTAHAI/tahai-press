# TAHAI Press 3.0 progress

## Phase 0 — source truth

- Original mixed checkout preserved at `D:\dev\tahai-press-recovery-20260806-225648` with a SHA-256 inventory.
- Existing v3 candidate worktree preserved at `D:\dev\tahai-press-v3-candidate-recovery-20260806-225802` before evaluation.
- Clean-install verification passed with `npm ci --ignore-scripts`.
- `npm audit` reported 0 vulnerabilities.
- Source suite passed: 177 tests.
- Release-equivalent build passed: content validation, CMS validation, redirect validation, 177 tests, media audit, generated-site accessibility/reader/performance audits, output verification, HTTP smoke test, and release proof.
- Active source identity is `3.0.0-alpha.1`; package and lockfile agree.
- All source workflows are manually dispatched only, and a repository test rejects automatic triggers and bootstrap references.

Phase 0 completed at commit `ad435c25ae837fce3de601a8dd956eed84ec246e`. The accepted candidate is limited to the behavior covered by the executed baseline. Release archives and historical version labels remain non-authoritative until the later release gates are complete.

## Phase 1 — core publisher experience

Completed at `fb8cebb`. The publisher experience now includes a thirteen-step, locally persisted Launch Desk; safe launch-package application with backups; a configurable homepage module builder; declarative professional story blocks; Quick Story and full editorial workflows; Media Desk; accessibility authoring checks; reader preferences and simplified views; public-record presentation; static search, archives, redirects, feeds, offline reading, and local operational tools. A fresh 320×568 browser check caught and then verified the repair of the Launch Desk navigation: all thirteen destinations remain readable, without page-width overflow or console errors.

The phase gate passed with content/CMS/redirect validation, 179 source tests, strict media audit, production-style static build, 52-page accessibility audit, reader audit, performance budget audit, deployment verification, HTTP smoke proof, and release proof. No optional account or hosted service is required for reader delivery.

## Phase 2 — installable theme ecosystem

In progress. Eight checksum-verified official theme packages, package validation, install/export/integrity commands, and a token-protected `127.0.0.1` Theme Workshop are implemented. An explicit source-controlled apply command pins a package checksum and materializes same-origin static CSS in the build; full Workshop flow and multi-browser verification remain open release gates.

## Phase 3 — Search and Knowledge Desk

In progress. Pagefind `1.5.2` is pinned and generated from public static pages only; explicit publisher-managed discovery metadata is validated and exported as public facets. Reader search uses the local Pagefind index for query ranking and retains the existing static index as an offline/failure fallback and facet source. Cross-engine browser proof is tracked in the GA verification pass.

## Phase 4 — Evidence, records, and packets

In progress. Every public article has a static Receipts Mode route. Public evidence records are validated from `content/records/`, rendered at `/records/`, tied to related Receipts Mode pages, and can produce deterministic metadata-only packet ZIPs. The implementation deliberately excludes private material ingestion, custody assertions, and automated truth scoring; a full Evidence Workbench remains open.

## Release preparation

Deterministic clean-source and Cloudflare-root release packages can be generated into ignored build artifacts without overwriting user-owned historical archives. The project remains on the documented alpha identity until all master-plan phases and external publication gates are complete.

## Phase 6 — editions and syndication

In progress. Explicit edition and newsletter content models now build canonical print editions, provider-neutral newsletter archive/email/plain-text exports, RSS, Atom, JSON Feed, and a versioned same-origin public API. The integrated builder, safe embed cards, broader print/theme/browser matrices, and final feed-family coverage remain open before this phase can be marked complete.

## Phase 7 — Data, Maps, and Developing Coverage

In progress. Schema-checked static datasets now include a downloadable source, accessible table, methodology, definitions, units, limitations, and print/no-JavaScript output. Explicit map records provide a location-list fallback without inferred geography. Developing records preserve pinned, timestamped, source-linked history. Local import/preview tooling, optional chart/map enhancements, and the full large-data/browser matrix remain open.

## Phase 8 — Local-first collaboration

In progress. An isolated optional collaboration service now has portable checksum-verified review records and handoffs plus a genuine pinned Yjs package and round-trip test. It remains absent from the public reader build. Local promotion tooling, file-based review UI, retention/session controls, and a real optional editor-only provider integration remain open.

## Phase 9 — Optional Newsroom Worker

In progress. The optional native Worker has its own package lockfile, Wrangler configuration, D1 migration, exact-origin CORS, public health endpoint, contact intake, bearer-gated attachment validation, deployment/rollback/teardown documentation, and passing tests. It is not connected to reader delivery and has not been deployed; owner account credentials and the real D1 identifier remain external gates.
