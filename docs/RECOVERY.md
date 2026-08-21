# Recovery and transfer

Run `npm run recovery -- create` to make a deterministic, checksum-verified private safety copy under `.artifacts/recovery/`. It includes publisher content and published theme packages only; it never enters `dist/` or a public release package.

Use `verify` and then `plan` before any write. `restore --confirm` verifies the archive, stages every byte, atomically replaces each included top-level directory, and writes a private restore transaction. `undo --confirm --transaction <id>` restores the pre-restore files while preserving the reverted files for inspection. `history` lists restore transactions. Recovery rejects symbolic links, duplicate or unsafe paths, archive tampering, and missing transaction backups.

Run `npm run package:transfer` followed by `npm run verify:transfer` to produce and independently validate a portable publisher handoff archive. Its manifest verifies every included file and rejects deployment output, local artifacts, dependencies, Git state, credentials, and absolute paths.
