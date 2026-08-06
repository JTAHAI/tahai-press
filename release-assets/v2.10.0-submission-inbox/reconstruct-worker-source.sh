#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-$ROOT/TAHAI_PRESS_V2.10.0_SUBMISSION_INBOX_WORKER_SOURCE.zip}"
cat "$ROOT"/worker-source/part-*.b64part | base64 --decode > "$OUT"
echo "0ce2223c13f759c7be40bc82f583d99f90546f14f96dffe95e97fa000ebb1a38  $OUT" | sha256sum --check --status
echo "Reconstructed and verified: $OUT"
