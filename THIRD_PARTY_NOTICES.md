# Third-party notices

TAHAI Press is licensed under Apache License 2.0. The following optional third-party component is referenced by the v2.0 distribution.

## Sveltia CMS

- Upstream: https://github.com/sveltia/sveltia-cms
- Version: 0.164.2
- License: MIT
- Integration: `scripts/build.mjs` generates `/admin/`, which loads the exact pinned browser bundle from UNPKG.
- Shipped code: No Sveltia source or compiled bundle is included in the TAHAI Press v2.0 source or deployment ZIP. The deployment contains only the integration page and generated configuration.
- Purpose: Optional Git-backed drafts written to `content/inbox/`.

Sveltia CMS remains the work of its upstream authors and contributors. Its repository identifies the project as MIT licensed. When a later release vendors or modifies the bundle, the upstream copyright and full MIT license text must be copied into the vendored subtree and this notice must be expanded.

## Candidate components

Projects listed in `docs/FOSS-FOUNDATION.md` are research candidates only. Listing a project does not mean its code is included, linked, modified, or distributed.
