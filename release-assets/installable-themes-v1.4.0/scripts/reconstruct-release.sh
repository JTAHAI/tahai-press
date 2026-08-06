#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/TAHAI_PRESS_THEME_FINAL_OVERLAY_v1.4.0.zip}"
cat "$ROOT"/artifacts/overlay-v1.4.0/part-*.b64part | base64 --decode > "$OUT"
echo "8c17e366e49d497a3fe07482bbd02c72af0ed10d5af51a10d91b6f13c91c1e30  $OUT" | sha256sum --check --status
echo "Reconstructed and verified: $OUT"
