# TAHAI Press Installable Themes v1.4.0

TAHAI Press now has a complete, hardened installable-theme system designed for static-first publishing without surrendering content integrity, accessibility, performance, or publisher control.

## What this release adds

- Safe installable theme ZIP packages
- Versioned theme manifests and compatibility gates
- Stable design-token and layout-contract APIs
- Seven supported presentation surfaces: homepage, article, section, archive, public records, navigation, and footer
- A local visual Theme Manager for installing, previewing, activating, updating, duplicating, customizing, comparing, exporting, and rolling back themes
- Deterministic package generation and checksum verification
- Installed-theme and active-state tamper detection
- Accessibility, forced-colors, reduced-motion, print, and performance gates
- Eight official themes:
  - Classic Broadsheet
  - Community Weekly
  - Civic Record
  - Modern Daily
  - Investigative Journal
  - Arts and Culture
  - High Contrast
  - Warm Reading Edition

## Security model

Themes remain declarative. They cannot run arbitrary installers, Node scripts, shell commands, remote JavaScript, tracking pixels, external fonts, or remote CSS. Layouts may only arrange approved TAHAI Press components inside approved regions. Core publishing logic, content, navigation behavior, accessibility fallbacks, and security remain authoritative.

## Verification

- 82/82 tests passed
- 8/8 official themes hardened
- 56/56 theme and surface combinations validated
- 280/280 contrast checks passed
- Clean-extraction verification passed
- Byte-for-byte overlay reproduction passed
- Standalone theme-package validation passed for all eight official themes
- Install, switch, rollback, resolution, staging, tamper, and recovery drills passed

## Release components

- Theme engine: 1.4.0
- Theme Manager: 1.4.0
- Layout contracts: 1.0.0
- Hardening layer: 1.0.0
- Official collection: 1.1.0

## TAHAI Press compatibility

This cumulative overlay requires TAHAI Press >=2.9.0 and <3.0.0. It intentionally refuses older repositories to prevent silent removal of later Search, Public Records, migration, editions, data, and collaboration capabilities.

GitHub `main` currently remains on the older v2.3.2 baseline. This release branch preserves the completed theme-system source and proof artifacts until the latest cumulative TAHAI Press source is integrated and verified.

## Primary artifacts

- `TAHAI_PRESS_THEME_FINAL_OVERLAY_v1.4.0.zip`
- `TAHAI_PRESS_OFFICIAL_THEME_COLLECTION_v1.1.0.zip`
- `TAHAI_PRESS_THEME_FINAL_PROOF_BUNDLE_v1.4.0.zip`
- `TAHAI_PRESS_THEME_FINAL_SHA256SUMS.txt`
- `TAHAI_PRESS_THEME_FINAL_RELEASE_MANIFEST.json`
- `TAHAI_PRESS_THEME_FINAL_CI.log`

## Primary checksums

- Final overlay: `8c17e366e49d497a3fe07482bbd02c72af0ed10d5af51a10d91b6f13c91c1e30`
- Official theme collection: `2bf45d4fb696e7868f336d7d4ff007618a56eee724c79e2f8d27cbf6b8fecd50`
- Proof bundle: `89721b698643fbef744f38dcb8d9eac8ab826fff66f8b62671fab2b2f076936f`

## Windows verification note

PowerShell was not available in the Linux verification environment. The installer was source-reviewed, and every Node command it invokes was independently executed and passed. Windows-side runtime execution of the `.ps1` remains an integration verification item.
