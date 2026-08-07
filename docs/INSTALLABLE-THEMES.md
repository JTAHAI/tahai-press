# Installable themes

TAHAI Press themes are ordinary, portable ZIP archives. They contain declarative CSS, JSON layout descriptions, a manifest, a license, previews, and checksums—never JavaScript, templates, installers, remote fonts, or tracking.

Build the eight project-owned packages with `npm run theme:build-official`; build their checked catalog with `npm run theme:catalog:build`. Validate any package before use with `npm run theme:validate -- themes/official/classic-broadsheet.zip`.

Install, activate, inspect, export, and roll back only through the named commands. Installation copies the verified ZIP into ignored local state; it does not rewrite publication content or modify reader output. An exported theme is immediately revalidated as untrusted input.
