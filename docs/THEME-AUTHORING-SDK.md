# Theme authoring SDK

Run `npm run theme:build-official` to inspect complete reference packages, then use the manifest and token schemas as the authoring contract. A theme must provide all five CSS entry points, eight route-layout JSON files, README, license, previews, and checksums.

Use `npm run theme:validate -- path/to/theme.zip` before sharing a package. The validator rejects active code, remote assets, traversal, duplicate paths, symlinks, encrypted or streamed entries, unsafe CSS, invalid checksums, and incompatible manifests.
