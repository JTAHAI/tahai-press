# TAHAI Press Installable Themes v1.4.0 release branch

This branch preserves the final cumulative installable-theme overlay, release notes, checksums, verification logs, and manifest.

The overlay is stored as ordered Base64 chunks because this branch was published through a repository connector without direct GitHub Release asset upload.

## Reconstruct on Windows

```powershell
.\scripts\reconstruct-release.ps1
```

## Reconstruct on Linux/macOS

```bash
bash ./scripts/reconstruct-release.sh
```

Both scripts verify SHA-256 before reporting success.

This is an artifact branch, not a merge target for the older `main` baseline. Integrate the overlay only into TAHAI Press >=2.9.0 and <3.0.0.
