# Migration Studio acceptance proof

TAHAI Press imports WordPress WXR, Markdown, JSON, CSV, and PDF folders into draft-first, review-gated article records. Every real import writes a private transaction; rollback checks that no post-import edits would be overwritten without explicit force.

Run `npm run verify:migration` to exercise the production importer against an isolated fixture. It proves that dry run writes nothing, an overwrite import creates a reversible transaction, and rollback restores publisher-owned bytes exactly. The resulting evidence is `.artifacts/migration-proof.json`.
