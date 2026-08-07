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

In progress. Launch Desk now contains thirteen locally persisted, publisher-facing steps and blocks package generation or local application until its mission, trust, import, public-record, ownership, and final-readiness gates are complete. The completed steps remain only one portion of the Phase 1 acceptance criteria; the phase is not marked passed until its full evidence suite is produced.
