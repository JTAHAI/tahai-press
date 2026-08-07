# Installable themes

TAHAI Press themes are ordinary, portable ZIP archives. They contain declarative CSS, JSON layout descriptions, a manifest, a license, previews, and checksums—never JavaScript, templates, installers, remote fonts, or tracking.

Build the eight project-owned packages with `npm run theme:build-official`; build their checked catalog with `npm run theme:catalog:build`. Validate any package before use with `npm run theme:validate -- themes/official/classic-broadsheet.zip`.

Install, activate, inspect, export, and roll back only through the named commands. Installation copies the verified ZIP into ignored local state, and activation is a private Workshop preview state only. To make a validated installed package part of a deployable publication, run `npm run theme:apply -- <theme-id>` explicitly. The command pins the package id, version, tracked ZIP path, and SHA-256 checksum in `content/site.json`; the static build validates that selection, emits same-origin CSS, and adds its theme class to generated reader pages. Non-official applied packages are copied into `themes/published/` so the selected artifact is reviewable and source-controlled.

An exported theme is immediately revalidated as untrusted input. A build fails closed if its pinned package is missing, invalid, outside the approved tracked directories, or does not match the recorded checksum.
