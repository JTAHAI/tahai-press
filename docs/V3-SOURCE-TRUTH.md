# v3 source truth

## Authoritative baseline

The implementation baseline is `origin/main` at `d707835a54a0aec7ae006e125a15d8689f9f1296`, in sibling worktree `D:\dev\tahai-press-v3` on `feature/v3-independent-press`, plus the locally verified alpha changes that are committed with this phase.

The development identity is `3.0.0-alpha.1`. It is not a claim that GA features or release artifacts exist.

## Verified baseline facts

- `npm ci --ignore-scripts` completes.
- `npm audit --json` reports no vulnerabilities.
- `npm test` passes 177 tests.
- The release-equivalent command chain builds 51 routes and passes generated-output, accessibility, reader, performance, media, and HTTP smoke checks.
- `.github/workflows` contains only manual `workflow_dispatch` triggers and the repository test enforces that rule.

## Non-authoritative historical material

Versioned v2.11 archives in the original checkout are historical evidence only. Inspection found that their purported newsroom Worker contains documentation paths but no Worker implementation source; they cannot support a Worker completion claim.

The v3 alpha source archives are snapshots of the current candidate, not independent proof. They are intentionally excluded from commits and public output.

## Donor policy

An overlay may be recovered only after path-by-path compatibility and executable verification. No version number, report, archive name, or README is accepted as implementation evidence.
