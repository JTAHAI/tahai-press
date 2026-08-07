# Deterministic release packages

Run `npm run package:release` after a production-style build. It writes a clean-source ZIP, a Cloudflare direct-upload ZIP, and `SHA256SUMS.txt` under ignored `.artifacts/release-packages/`. The deployment archive has `index.html` at its root.

The packager uses the repository’s deterministic ZIP writer, records per-file checksums in each archive, rejects symlinks, excludes `.git`, dependencies, build artifacts, environment files, and user-owned historical archives, and does not delete or overwrite those historical archives.

Packages use the current package version. Creating a public GitHub release, a tag, or a production deployment remains a separate release-authority step.
